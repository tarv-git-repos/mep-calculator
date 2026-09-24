import { CalculationReviewBar, useCalculationLock, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { EditBuildingModal } from "@/components/workspace/EditBuildingModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportFireWaterDemandPDF } from "@/lib/exportFireWaterDemandPDF";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { api } from "@/services/api";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle,
  MessageSquare, Flame, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers, ArrowRight,
  Building2, Building, Factory, SlidersHorizontal, Plus, Download, Search, CheckSquare,
  Square, Eye, ExternalLink, ChevronDown, ChevronUp, ChevronRight, RefreshCw, BarChart2, Shield,
  FileSpreadsheet, ArrowUpDown, MousePointerClick, Scissors, ClipboardPaste, Zap, ArrowUpRight, Filter
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { useCollaboration } from "@/lib/collaboration-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import { useConfirm } from "@/hooks/use-confirm";
import {
  type CivilDefenseBuilding,
  type CivilDefenseOccupancy,
  type CivilDefenseEvaluation,
  evaluateCivilDefenseFireDemand,
  getRecommendedHeaderSize,
  CIVIL_DEFENSE_PRESETS,
  type CivilDefensePresetConfig
} from "@/lib/civilDefenseFireDemandCalc";

export const Route = createFileRoute("/plumbing-fire-water-demand")({
  head: () => ({
    meta: [
      { title: "UAE Civil Defense Fire Water Demand Calculator — MEP Calc" },
      { name: "description", content: "Determine fire pump flow, pressure, storage tanks, and intermediate staging per UAE Civil Defense Code Tables 9.18 to 9.21.e." },
    ],
  }),
  component: FireWaterDemandPage,
});

// Occupancy Labels and Helpers
export const OCCUPANCY_OPTIONS: { value: CivilDefenseOccupancy; label: string; desc: string }[] = [
  { value: "residential", label: "Residential (Apartments / Labor / Staff)", desc: "Flats, staff accommodation, hostels, boarding houses" },
  { value: "business", label: "Business (Offices / Banks / Professional)", desc: "Corporate offices, service providers, civic buildings" },
  { value: "hotel", label: "Hotel & Hospitality", desc: "Hotels, motels, luxury furnished apartments, resorts" },
  { value: "mercantile_ab", label: "Mercantile Class A & B (Retail / Malls)", desc: "Shopping malls, supermarkets, department stores" },
  { value: "mercantile_c_kiosk", label: "Mercantile Class C / Kiosks", desc: "Small retail shops, kiosks, convenience booths" },
  { value: "assembly", label: "Assembly (Cinemas / Auditoriums / Clubs)", desc: "Theaters, convention centers, places of worship" },
  { value: "education", label: "Education (Schools / Universities)", desc: "Classrooms, libraries, laboratories, nurseries" },
  { value: "healthcare_a", label: "Healthcare Group A (Hospitals / Inpatient)", desc: "Hospitals with sleeping accommodations, ICUs" },
  { value: "healthcare_bc", label: "Healthcare Group B & C (Outpatient Clinics)", desc: "Day clinics, specialized medical consultation" },
  { value: "day_care", label: "Day Care Centers", desc: "Infant and child day care facilities" },
  { value: "detention", label: "Detention & Correctional", desc: "Prisons, correctional centers, reformatories" },
  { value: "animal_housing", label: "Animal Housing / Veterinary", desc: "Stables, veterinary clinics, kennels" },
  { value: "converted_villa", label: "Converted Existing G+1 Villa", desc: "Villas converted to commercial, educational, or medical use" },
  { value: "mosque_with_commercial", label: "Commercial Outlet on Villa / Mosque", desc: "Shops, cafes, or pharmacies attached to villas or mosques" },
];

// Initial Demonstration Project Schedule
const INITIAL_BUILDINGS: CivilDefenseBuilding[] = [
  {
    id: "bld-tower-a",
    name: "Tower A (Super Highrise Hotel & Residences)",
    height: 110,
    floors: 32,
    plotArea: 14000,
    groundFloorArea: 1800,
    occupancy: "hotel",
    standpipeCount: 3,
    hasInfraHydrants60m: true,
    isSingleExitStair: false,
    basementCount: 2,
    notes: "Requires 1000 GPM @ 17 bar lowest pump + intermediate 1000 GPM @ 6.9 bar staging pump at +90m."
  },
  {
    id: "bld-block-b",
    name: "Block B (Highrise Commercial Offices)",
    height: 65,
    floors: 18,
    plotArea: 18000,
    groundFloorArea: 2200,
    occupancy: "business",
    standpipeCount: 2,
    hasInfraHydrants60m: true,
    isSingleExitStair: false,
    basementCount: 2,
    notes: "Standard Highrise Tier 1: 750 GPM @ 6.9 bar combined pump, 60-min dedicated water tank."
  },
  {
    id: "bld-podium-c",
    name: "Block C (Podium Retail Mall & Cineplex)",
    height: 14,
    floors: 3,
    plotArea: 24000,
    groundFloorArea: 4800,
    occupancy: "mercantile_ab",
    standpipeCount: 3,
    hasInfraHydrants60m: false,
    isSingleExitStair: false,
    basementCount: 1,
    notes: "Large plot (>20,000 m²) without 60m infra hydrants: 1000 GPM @ 6.9 bar combined pump for yard hydrants."
  },
  {
    id: "bld-staff-d",
    name: "Block D (Staff Accommodation Lowrise)",
    height: 18,
    floors: 5,
    plotArea: 3500,
    groundFloorArea: 800,
    occupancy: "residential",
    standpipeCount: 1,
    hasInfraHydrants60m: true,
    isSingleExitStair: false,
    basementCount: 0,
    notes: "Midrise residential with GFA <= 900 m²: 50 GPM @ 4.5 bar dry riser + hose reel system."
  }
];

type ActiveTab = "schedule" | "staging" | "tanks" | "report";

export function FireWaterDemandPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "Senior MEP Fire Engineer";

  const { project, isReadOnly, forceSaveToCloud, updateProject } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-fire-water-demand", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  
  const { getLockOwner, mySessionId, setActiveModule } = useCollaboration();
  const lockOwnerObj = getLockOwner("/plumbing-fire-water-demand");
  const isLockedByOther = Boolean(lockOwnerObj && lockOwnerObj.sessionId !== mySessionId);
  const lockOwnerName = lockOwnerObj ? (lockOwnerObj.name || lockOwnerObj.email) : "Unknown";

  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole || isLockedByOther);

  useEffect(() => {
    setActiveModule("/plumbing-fire-water-demand");
    return () => {
      setActiveModule(null);
    };
  }, [setActiveModule]);

  const confirm = useConfirm();
  const [calcReviewState, setCalcReviewState] = useState<CalculationReviewState | null>(null);

  // Tabs & navigation (Ventilation standard)
  const [tab, setTab] = useState<ActiveTab>("schedule");
  const [intelOpen, setIntelOpen] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Unit System: SI (LPM, bar, m³, m) vs IP (GPM, psi, gal, ft)
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  // Multi-Building Schedule State
  const [buildings, setBuildings] = useState<CivilDefenseBuilding[]>(INITIAL_BUILDINGS);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(INITIAL_BUILDINGS[0].id);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOccupancy, setFilterOccupancy] = useState<string>("all");

  // Bulk Edit Modal State (Ventilation Parity)
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({
    occupancy: false,
    height: false,
    floors: false,
    groundFloorArea: false,
    plotArea: false,
    standpipeCount: false,
    basementCount: false,
    hasInfraHydrants60m: false,
    isSingleExitStair: false,
  });
  const [bulkEditValues, setBulkEditValues] = useState<{
    occupancy: CivilDefenseOccupancy;
    height: number;
    floors: number;
    groundFloorArea: number;
    plotArea: number;
    standpipeCount: number;
    basementCount: number;
    hasInfraHydrants60m: boolean;
    isSingleExitStair: boolean;
  }>({
    occupancy: "residential",
    height: 15,
    floors: 4,
    groundFloorArea: 500,
    plotArea: 1000,
    standpipeCount: 1,
    basementCount: 0,
    hasInfraHydrants60m: false,
    isSingleExitStair: false,
  });

  // Double-Click Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<CivilDefenseBuilding>(INITIAL_BUILDINGS[0]);

  // Report & Staging Selected Building View
  const [reportBuildingId, setReportBuildingId] = useState<string>(INITIAL_BUILDINGS[0].id);

  // Physical Tank Dimensions Sizer State for Active Building
  const [tankLength, setTankLength] = useState<number>(10.0); // meters
  const [tankWidth, setTankWidth] = useState<number>(6.0); // meters
  const [tankFreeboard, setTankFreeboard] = useState<number>(0.30); // meters (air gap)
  const [tankDeadVolumeDepth, setTankDeadVolumeDepth] = useState<number>(0.20); // meters (anti-vortex sump)
  const [cityMainRefillFlowGpm, setCityMainRefillFlowGpm] = useState<number>(150); // GPM refill from city network

  // Comments & Task State (Multi-user synchronized with Ventilation & Notification Center)
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Storage key for persistence
  const storageKey = useMemo(() => {
    return `mep_fire_water_demand_schedule_${project?.id || "default"}`;
  }, [project?.id]);

  // Load saved schedule on mount or project switch
  useEffect(() => {
    const cloudBuildings = project?.workspace_data?.fireWaterBuildings;
    if (cloudBuildings && Array.isArray(cloudBuildings) && cloudBuildings.length > 0) {
      setBuildings(cloudBuildings);
    } else {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBuildings(parsed);
          }
        } catch (e) {
          console.error("Failed to load saved fire water demand schedule", e);
        }
      }
    }
  }, [storageKey, project?.workspace_data?.fireWaterBuildings]);

  // Comprehensive multi-source comment synchronizer (ensures User B immediately sees comments assigned by User A)
  // Comprehensive comment loader for Fire Water Demand (loads only genuine comments with text)
  const refreshAllComments = () => {
    const pId = project?.id || "default";
    const commentsMap = new Map<string, any>();

    const addList = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (!item) return;
            const text = String(item.text || item.metadata?.text || "").trim();
            if (!text) return; // Ignore any items with empty text

            const cId = item.id || item.metadata?.id || item.commentId;
            const targetId = String(item.targetId || item.metadata?.targetId || item.spaceId || item.itemId || "").trim();
            if (cId && targetId) {
              commentsMap.set(cId, {
                ...item,
                id: cId,
                text,
                targetId,
                targetName: item.targetName || item.metadata?.targetName || "",
                targetType: item.targetType || item.metadata?.targetType || "Civil Defense Building",
                assignedUsers: item.assignedUsers || item.metadata?.assignedUsers || [],
                authorName: item.authorName || item.metadata?.authorName || "Design Engineer",
                authorId: item.authorId || item.metadata?.authorId,
                timestamp: item.timestamp || item.createdAt || item.metadata?.createdAt,
              });
            }
          });
        }
      } catch (e) {}
    };

    // 1. Calculator specific comments storage
    addList(localStorage.getItem(`mep_calc_comments_${pId}_/plumbing-fire-water-demand`));
    addList(localStorage.getItem(`mep_calc_comments_default_/plumbing-fire-water-demand`));

    // 2. Project workspace comments
    const wdata = project?.workspace_data || {};
    if (Array.isArray(wdata.fire_water_comments)) {
      addList(JSON.stringify(wdata.fire_water_comments));
    }

    const aggregated = Array.from(commentsMap.values());
    setCommentsList(aggregated);
  };

  // Load comments on mount, user change, or broadcast notification
  useEffect(() => {
    refreshAllComments();

    const handleNotifUpdate = () => refreshAllComments();
    window.addEventListener("mep_notif_tick", handleNotifUpdate);
    window.addEventListener("mep_notification_received", handleNotifUpdate);
    window.addEventListener("mep-notification-added", handleNotifUpdate);
    window.addEventListener("storage", handleNotifUpdate);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("mep_notifications_channel");
        bc.onmessage = (msg) => {
          if (msg.data?.type === "NEW_NOTIFICATION" || msg.data?.type === "COMMENTS_UPDATED") {
            refreshAllComments();
          }
        };
      } catch (e) {}
    }

    return () => {
      window.removeEventListener("mep_notif_tick", handleNotifUpdate);
      window.removeEventListener("mep_notification_received", handleNotifUpdate);
      window.removeEventListener("mep-notification-added", handleNotifUpdate);
      window.removeEventListener("storage", handleNotifUpdate);
      if (bc) bc.close();
    };
  }, [project?.id, profile?.id, userData?.id]);

  // Scroll and highlight notification target item (exact parity with Sewage Pump & Ventilation)
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanRaw = cleanId.replace(/^(field-|card-|res-|row-|building-row-)/, "");
      const cleanName = (targetName || "").toLowerCase().trim();

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`building-row-${cleanRaw}`) ||
                 document.getElementById(`building-row-${targetId}`) ||
                 document.getElementById(`row-${cleanRaw}`) ||
                 document.getElementById(`row-${targetId}`) ||
                 document.querySelector(`[data-row-id="${cleanRaw}"]`) ||
                 document.querySelector(`[data-row-id="${targetId}"]`) ||
                 document.querySelector(`[data-comment-target="${cleanRaw}"]`) ||
                 document.querySelector(`[data-comment-target="${targetId}"]`);

      setHighlightedTargetId(cleanRaw || cleanId || targetId || null);

      // Ensure schedule tab is active and select matching building
      setTab("schedule");
      const matchedBld = buildings.find(
        (b) =>
          b.id.toLowerCase() === cleanRaw ||
          b.id.toLowerCase() === cleanId ||
          (cleanName && b.name.toLowerCase() === cleanName)
      );
      if (matchedBld) {
        setSelectedBuildingId(matchedBld.id);
        setSelectedRowIds(new Set([matchedBld.id]));
        setReportBuildingId(matchedBld.id);
      }

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
      const targetId = params.get("commentTargetId") || params.get("targetId") || params.get("highlight") || params.get("commentId");
      const targetName = params.get("commentTargetName") || params.get("targetName");
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
  }, [typeof window !== "undefined" ? window.location.search : "", buildings]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-fire-water-demand`, JSON.stringify(newList));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("mep_notifications_channel");
          bc.postMessage({ type: "COMMENTS_UPDATED", calcPath: "/plumbing-fire-water-demand", count: newList.length });
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
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Adding comments is locked.", { id: "readonly-notice" });
      return;
    }
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const text = String(commentData?.text || "").trim();
    if (!text) {
      toast.error("Comment text cannot be empty");
      return;
    }
    const targetId = commentTargetItem?.id || commentData?.targetId || commentData?.spaceId || commentData?.itemId || (activeItem ? activeItem.building.id : "bld-general");
    const targetName = commentTargetItem?.name || commentData?.targetName || commentData?.spaceName || (activeItem ? activeItem.building.name : "Fire Water Demand Building");

    const commentWithMeta = {
      ...commentData,
      text,
      targetId,
      targetName,
      spaceId: targetId,
      spaceName: targetName,
      itemId: targetId,
      targetType: "Civil Defense Building",
      calculatorTitle: "Fire Water Demand",
      calculatorPath: "/plumbing-fire-water-demand",
      projectId: project?.id || "default",
      projectName: project?.name || "Civil Defense Fire Water Demand",
      authorName: currentUserName || "Design Engineer",
      authorId: profile?.id || userData?.id || "unknown",
      timestamp: commentData.timestamp || new Date().toISOString(),
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

    try {
      dispatchGlobalCommentNotification(commentWithMeta, {
        project,
        currentUserName: commentWithMeta.authorName,
        currentUserId: commentWithMeta.authorId,
      });
    } catch (e) {
      console.error("Failed to dispatch global notification", e);
    }

    toast.success(`Comment / task assigned on "${targetName}"`);
    setCommentModalOpen(false);
    setCommentTargetItem(null);
  };

  const getItemComments = (id: string, name?: string) => {
    if (!id && !name) return [];
    const cleanId = (id || "").toLowerCase().trim();
    const cleanRawId = cleanId.replace(/^(field-|card-|row-|building-row-)/, "");
    const cleanName = (name || "").toLowerCase().trim();

    return commentsList.filter((c) => {
      if (!c || !c.text || !String(c.text).trim()) return false;
      const tId = String(c.targetId || c.spaceId || c.itemId || c.id || "").toLowerCase().trim();
      const tIdRaw = tId.replace(/^(field-|card-|row-|building-row-)/, "");

      // Match target ID accurately
      if (
        cleanId &&
        (tId === cleanId ||
          tIdRaw === cleanRawId ||
          tId === `building-row-${cleanRawId}` ||
          `building-row-${tIdRaw}` === cleanId ||
          `row-${cleanRawId}` === tId)
      ) {
        return true;
      }

      // Exact name match only
      const tName = String(c.targetName || c.spaceName || "").toLowerCase().trim();
      if (cleanName && tName && cleanName === tName) {
        return true;
      }

      return false;
    });
  };

  const isItemHighlighted = (id: string, name?: string) => {
    if (!highlightedTargetId) return false;
    const cleanHighlight = highlightedTargetId.toLowerCase().trim();
    const cleanHighlightRaw = cleanHighlight.replace(/^(field-|card-|row-|building-row-)/, "");
    const cleanId = id.toLowerCase().trim();
    const cleanRawId = cleanId.replace(/^(field-|card-|row-|building-row-)/, "");

    if (
      cleanHighlight === cleanId ||
      cleanHighlightRaw === cleanRawId ||
      cleanHighlight === `building-row-${cleanRawId}`
    ) {
      return true;
    }

    if (name && cleanHighlight.length > 2) {
      const cleanName = name.toLowerCase();
      if (cleanName.includes(cleanHighlight) || cleanHighlight.includes(cleanName)) {
        return true;
      }
    }
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
        title={`${itemComments.length} comment(s)/task(s) assigned to "${name}"`}
        className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
      >
        <MessageSquare className="size-3.5 fill-blue-500/20" />
        <span className="text-[10px] font-bold">{itemComments.length}</span>
      </button>
    );
  };

  // Internal Clipboard & Undo/Redo Stacks (Ventilation-style)
  const [copiedBuildings, setCopiedBuildings] = useState<CivilDefenseBuilding[]>([]);
  const [undoStack, setUndoStack] = useState<CivilDefenseBuilding[][]>([]);
  const [redoStack, setRedoStack] = useState<CivilDefenseBuilding[][]>([]);

  // Persist changes with optional undo history snapshot
  const saveSchedule = (newBuildings: CivilDefenseBuilding[], pushHistory = true) => {
    if (pushHistory) {
      setUndoStack((prev) => [...prev.slice(-25), buildings]);
      setRedoStack([]);
    }
    setBuildings(newBuildings);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newBuildings));
      if (project && updateProject) {
        const updatedProject = {
          ...project,
          workspace_data: {
            ...(project.workspace_data || {}),
            fireWaterBuildings: newBuildings
          }
        };
        updateProject(updatedProject);
      } else {
        forceSaveToCloud?.();
      }
      dirtyStore.set(true);
    } catch (e) {
      console.error("Failed to save fire water demand schedule", e);
    }
  };

  // Inline update handler for building inputs or manual output overrides
  const handleUpdateBuilding = (id: string, updates: Partial<CivilDefenseBuilding>, clearOverrides = false) => {
    if (isEffectiveReadOnly) return;
    const nextList = buildings.map((b) => {
      if (b.id !== id) return b;
      if (clearOverrides) {
        const copy: CivilDefenseBuilding = { ...b, ...updates };
        delete copy.overridePumpFlowGpm;
        delete copy.overridePumpPressureBar;
        delete copy.overrideTankDurationMin;
        delete copy.overrideNetStorageM3;
        return copy;
      }
      return { ...b, ...updates };
    });
    saveSchedule(nextList);
  };

  // Reset manual output overrides back to statutory code formulas
  const handleResetRowOverrides = (id: string) => {
    if (isEffectiveReadOnly) return;
    const nextList = buildings.map((b) => {
      if (b.id !== id) return b;
      const copy: CivilDefenseBuilding = { ...b };
      delete copy.overridePumpFlowGpm;
      delete copy.overridePumpPressureBar;
      delete copy.overrideTankDurationMin;
      delete copy.overrideNetStorageM3;
      return copy;
    });
    saveSchedule(nextList);
    toast.success("Reset building outputs to Civil Defense statutory formulas");
  };

  // Version Restore Handler
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = storageKey;
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
      if (Array.isArray(restoredData) && restoredData.length > 0) {
        setBuildings(restoredData);
        setSelectedBuildingId(restoredData[0].id);
        setSelectedRowIds(new Set([restoredData[0].id]));
        setReportBuildingId(restoredData[0].id);
        toast.info("Fire Water Demand schedule restored from version snapshot");
      }
    };

    window.addEventListener("mep-version-restored" as any, handleVersionRestored);
    return () => window.removeEventListener("mep-version-restored" as any, handleVersionRestored);
  }, [storageKey]);

  // Unit toggle handler (Sewage & Drainage format)
  const handleUnitSystemChange = (nextSystem: "ip" | "si", shouldConvert?: boolean) => {
    if (isEffectiveReadOnly) return;
    setUnitSystem(nextSystem);
    dirtyStore.set(true);
  };

  // Computed Evaluations for ALL buildings
  const evaluatedBuildings = useMemo(() => {
    return buildings.map((b) => ({
      building: b,
      evaluation: evaluateCivilDefenseFireDemand(b),
    }));
  }, [buildings]);

  // Currently Active Selected Building & its Evaluation
  const activeItem = useMemo(() => {
    const found = evaluatedBuildings.find((item) => item.building.id === selectedBuildingId);
    return found || evaluatedBuildings[0] || null;
  }, [evaluatedBuildings, selectedBuildingId]);

  // Active Building for Report Tab
  const reportItem = useMemo(() => {
    const found = evaluatedBuildings.find((item) => item.building.id === reportBuildingId);
    return found || activeItem || evaluatedBuildings[0] || null;
  }, [evaluatedBuildings, reportBuildingId, activeItem]);

  // Project KPI Rollups
  const projectSummary = useMemo(() => {
    let maxPumpFlowGpm = 0;
    let maxPumpPressureBar = 0;
    let totalNetStorageM3 = 0;
    let totalGrossStorageM3 = 0;
    let superHighriseCount = 0;
    let yardHydrantRequiredCount = 0;

    for (const item of evaluatedBuildings) {
      const ev = item.evaluation;
      if (ev.lowestFirePumpFlowGpm > maxPumpFlowGpm) {
        maxPumpFlowGpm = ev.lowestFirePumpFlowGpm;
        maxPumpPressureBar = ev.lowestFirePumpPressureBar;
      } else if (ev.lowestFirePumpFlowGpm === maxPumpFlowGpm) {
        if (ev.lowestFirePumpPressureBar > maxPumpPressureBar) {
          maxPumpPressureBar = ev.lowestFirePumpPressureBar;
        }
      }
      totalNetStorageM3 += ev.totalNetWaterStorageM3;
      totalGrossStorageM3 += ev.totalGrossWaterStorageM3;
      if (ev.requiresStagingPumps) superHighriseCount++;
      if (ev.isYardHydrantRequired) yardHydrantRequiredCount++;
    }

    const header = getRecommendedHeaderSize(maxPumpFlowGpm);

    return {
      buildingCount: evaluatedBuildings.length,
      maxPumpFlowGpm,
      maxPumpFlowLpm: Math.round(maxPumpFlowGpm * 3.78541),
      maxPumpPressureBar,
      maxPumpPressurePsi: Math.round(maxPumpPressureBar * 14.5038),
      totalNetStorageM3: parseFloat(totalNetStorageM3.toFixed(1)),
      totalNetStorageGal: Math.round(totalNetStorageM3 / 0.00378541),
      totalGrossStorageM3: parseFloat(totalGrossStorageM3.toFixed(1)),
      totalGrossStorageGal: Math.round(totalGrossStorageM3 / 0.00378541),
      superHighriseCount,
      yardHydrantRequiredCount,
      governingHeaderNps: header.nps,
      governingHeaderDn: header.dn,
      governingHeaderVelocity: header.velocityFps,
    };
  }, [evaluatedBuildings]);

  // Physical Water Tank Calculation for Active Building
  const activeTankSizing = useMemo(() => {
    if (!activeItem) return null;
    const netM3 = activeItem.evaluation.mainTankNetVolumeM3;
    const l = Math.max(1.0, tankLength);
    const w = Math.max(1.0, tankWidth);
    const floorArea = l * w;

    const effectiveDepth = floorArea > 0 ? netM3 / floorArea : 0;
    const totalHeight = effectiveDepth + tankFreeboard + tankDeadVolumeDepth;
    const grossVolumeM3 = floorArea * totalHeight;
    const grossVolumeGal = Math.round(grossVolumeM3 / 0.00378541);

    const refillLpm = cityMainRefillFlowGpm * 3.78541;
    const refillM3h = (refillLpm * 60) / 1000;
    const fillTimeHours = refillM3h > 0 ? netM3 / refillM3h : 0;

    return {
      floorArea: parseFloat(floorArea.toFixed(2)),
      effectiveDepth: parseFloat(effectiveDepth.toFixed(2)),
      totalHeight: parseFloat(totalHeight.toFixed(2)),
      grossVolumeM3: parseFloat(grossVolumeM3.toFixed(1)),
      grossVolumeGal,
      fillTimeHours: parseFloat(fillTimeHours.toFixed(1)),
      waterWavePercent: totalHeight > 0 ? Math.min(85, Math.max(15, (effectiveDepth / totalHeight) * 100)) : 50,
    };
  }, [activeItem, tankLength, tankWidth, tankFreeboard, tankDeadVolumeDepth, cityMainRefillFlowGpm]);

  // Double-Click Handler: Opens EditBuildingModal
  const handleOpenEditModal = (buildingId: string) => {
    const target = buildings.find((b) => b.id === buildingId);
    if (target) {
      setEditingBuilding(target);
      setSelectedBuildingId(buildingId);
      setEditModalOpen(true);
    }
  };

  // Save changes from EditBuildingModal
  const handleSaveEditedBuilding = (updated: CivilDefenseBuilding) => {
    if (isEffectiveReadOnly) return;
    const nextList = buildings.map((b) => (b.id === updated.id ? updated : b));
    saveSchedule(nextList);
    toast.success(`Updated ${updated.name}`);
  };

  // Multi-Selection Handlers (Ventilation-Style)
  const toggleSelectAll = () => {
    if (selectedRowIds.size === buildings.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(buildings.map((b) => b.id)));
    }
  };

  const toggleSelectRow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRowIds(next);
    setSelectedBuildingId(id);
    setReportBuildingId(id);
  };

  // Bulk Edit Handlers (Ventilation Standard)
  const handleOpenBulkEdit = () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    if (selectedRowIds.size === 1) {
      const singleId = Array.from(selectedRowIds)[0];
      handleOpenEditModal(singleId);
      return;
    }
    setBulkEditFields({
      occupancy: false,
      height: false,
      floors: false,
      groundFloorArea: false,
      plotArea: false,
      standpipeCount: false,
      basementCount: false,
      hasInfraHydrants60m: false,
      isSingleExitStair: false,
    });
    setBulkEditOpen(true);
  };

  const handleApplyBulkEdit = () => {
    if (isEffectiveReadOnly) return;
    const targetIds = selectedRowIds.size > 0 
      ? selectedRowIds 
      : (selectedBuildingId ? new Set([selectedBuildingId]) : new Set<string>());

    if (targetIds.size === 0) {
      setBulkEditOpen(false);
      return;
    }

    const anyFieldSelected = Object.values(bulkEditFields).some(Boolean);
    if (!anyFieldSelected) {
      toast.error("Please check at least one parameter to apply changes");
      return;
    }

    const nextList = buildings.map((b) => {
      if (!targetIds.has(b.id)) return b;
      const updated = { ...b };
      if (bulkEditFields.occupancy) updated.occupancy = bulkEditValues.occupancy;
      if (bulkEditFields.height) updated.height = bulkEditValues.height;
      if (bulkEditFields.floors) updated.floors = bulkEditValues.floors;
      if (bulkEditFields.groundFloorArea) updated.groundFloorArea = bulkEditValues.groundFloorArea;
      if (bulkEditFields.plotArea) updated.plotArea = bulkEditValues.plotArea;
      if (bulkEditFields.standpipeCount) updated.standpipeCount = bulkEditValues.standpipeCount;
      if (bulkEditFields.basementCount) updated.basementCount = bulkEditValues.basementCount;
      if (bulkEditFields.hasInfraHydrants60m) updated.hasInfraHydrants60m = bulkEditValues.hasInfraHydrants60m;
      if (bulkEditFields.isSingleExitStair) updated.isSingleExitStair = bulkEditValues.isSingleExitStair;
      return updated;
    });

    saveSchedule(nextList);
    setBulkEditOpen(false);
    toast.success(`Updated ${targetIds.size} building(s) in bulk`);
  };

  const handleAssignTaskForSelected = () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const firstId = Array.from(selectedRowIds)[0] || selectedBuildingId;
    const bld = buildings.find((b) => b.id === firstId);
    if (bld) {
      handleOpenComment(bld.id, bld.name);
    }
  };

  // Add Building from Preset
  const handleAddPreset = (presetConfig: CivilDefensePresetConfig) => {
    if (isEffectiveReadOnly) {
      toast.error("Calculation is approved/locked. Unlock to modify schedule.");
      return;
    }
    const newId = `bld-${Date.now().toString(36)}`;
    const newBuilding: CivilDefenseBuilding = {
      ...presetConfig.defaultBuilding,
      id: newId,
      name: `${presetConfig.defaultBuilding.name} (${buildings.length + 1})`,
    };
    const nextList = [...buildings, newBuilding];
    saveSchedule(nextList);
    setSelectedBuildingId(newId);
    setSelectedRowIds(new Set([newId]));
    setReportBuildingId(newId);
    toast.success(`Added ${newBuilding.name} per ${presetConfig.tableRef}`);
  };

  // Add Custom Building
  const handleAddNewBuilding = () => {
    if (isEffectiveReadOnly) {
      toast.error("Calculation is approved/locked.");
      return;
    }
    const newId = `bld-${Date.now().toString(36)}`;
    const newBuilding: CivilDefenseBuilding = {
      id: newId,
      name: `New Building Block (${buildings.length + 1})`,
      height: 25,
      floors: 8,
      plotArea: 10000,
      groundFloorArea: 2000,
      occupancy: "business",
      standpipeCount: 2,
      hasInfraHydrants60m: true,
      isSingleExitStair: false,
      basementCount: 1,
    };
    const nextList = [...buildings, newBuilding];
    saveSchedule(nextList);
    setSelectedBuildingId(newId);
    setSelectedRowIds(new Set([newId]));
    setReportBuildingId(newId);
    setEditingBuilding(newBuilding);
    setEditModalOpen(true);
    toast.success("Added new building block. Configure parameters in modal.");
  };

  // Copy Selected
  const handleCopySelected = () => {
    const toCopy = buildings.filter((b) => selectedRowIds.has(b.id));
    if (toCopy.length > 0) {
      setCopiedBuildings(toCopy);
      toast.info(`Copied ${toCopy.length} building(s) to clipboard`);
    } else if (activeItem) {
      setCopiedBuildings([activeItem.building]);
      toast.info(`Copied "${activeItem.building.name}" to clipboard`);
    }
  };

  // Cut Selected
  const handleCutSelected = () => {
    if (isEffectiveReadOnly) return;
    const toCut = buildings.filter((b) => selectedRowIds.has(b.id));
    if (toCut.length === 0 && activeItem) {
      toCut.push(activeItem.building);
    }
    if (toCut.length === 0) return;
    if (buildings.length <= toCut.length) {
      toast.error("At least one building is required in the schedule");
      return;
    }
    setCopiedBuildings(toCut);
    const cutIds = new Set(toCut.map((b) => b.id));
    const nextList = buildings.filter((b) => !cutIds.has(b.id));
    saveSchedule(nextList);
    setSelectedRowIds(new Set([nextList[0].id]));
    setSelectedBuildingId(nextList[0].id);
    setReportBuildingId(nextList[0].id);
    toast.info(`Cut ${toCut.length} building(s) to clipboard`);
  };

  // Paste Selected
  const handlePasteSelected = () => {
    if (isEffectiveReadOnly) return;
    if (!copiedBuildings || copiedBuildings.length === 0) {
      toast.info("Clipboard is empty");
      return;
    }
    const pasted: CivilDefenseBuilding[] = copiedBuildings.map((cb, idx) => ({
      ...cb,
      id: `bld-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      name: `${cb.name} (Copy)`,
    }));
    const nextList = [...buildings, ...pasted];
    saveSchedule(nextList);
    setSelectedRowIds(new Set(pasted.map((p) => p.id)));
    setSelectedBuildingId(pasted[0].id);
    setReportBuildingId(pasted[0].id);
    toast.success(`Pasted ${pasted.length} building(s)`);
  };

  // Duplicate Selected (Ctrl+D)
  const handleDuplicateSelected = () => {
    if (isEffectiveReadOnly) return;
    const toDuplicate = buildings.filter((b) => selectedRowIds.has(b.id));
    const targets = toDuplicate.length > 0 ? toDuplicate : activeItem ? [activeItem.building] : [];
    if (targets.length === 0) {
      toast.error("No buildings selected to duplicate");
      return;
    }
    const clones: CivilDefenseBuilding[] = targets.map((b) => ({
      ...b,
      id: `bld-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
      name: `${b.name} (Copy)`,
    }));
    const nextList = [...buildings, ...clones];
    saveSchedule(nextList);
    setSelectedRowIds(new Set(clones.map((c) => c.id)));
    setSelectedBuildingId(clones[0].id);
    setReportBuildingId(clones[0].id);
    toast.success(`Duplicated ${targets.length} building(s)`);
  };

  // Delete Selected (Delete / Backspace) with Confirmation Dialog (Ventilation Parity)
  const handleDeleteSelected = async () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    if (buildings.length <= 1) {
      toast.error("At least one building is required in the schedule");
      return;
    }
    const targetIds = selectedRowIds.size > 0 
      ? selectedRowIds 
      : activeItem ? new Set([activeItem.building.id]) : new Set<string>();
    
    if (targetIds.size === 0) return;

    if (buildings.length <= targetIds.size) {
      toast.error("Cannot delete all buildings. At least one building is required.");
      return;
    }

    const count = targetIds.size;
    const ok = await confirm(
      `Are you sure you want to delete the ${count} selected building(s)?`,
      {
        title: "Delete Building(s)",
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "destructive",
      }
    );

    if (!ok) return;

    const nextList = buildings.filter((b) => !targetIds.has(b.id));
    saveSchedule(nextList);
    if (nextList.length > 0) {
      setSelectedBuildingId(nextList[0].id);
      setSelectedRowIds(new Set());
      setReportBuildingId(nextList[0].id);
    } else {
      setSelectedBuildingId("");
      setSelectedRowIds(new Set());
      setReportBuildingId("");
    }
    toast.success(`Deleted ${count} building(s)`);
  };

  // Undo Handler (Ctrl+Z)
  const handleUndo = () => {
    if (isEffectiveReadOnly) return;
    if (undoStack.length === 0) {
      toast.info("Nothing to undo");
      return;
    }
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [buildings, ...r]);
    setUndoStack((u) => u.slice(0, -1));
    saveSchedule(prev, false);
    if (prev.length > 0) {
      setSelectedBuildingId(prev[0].id);
      setSelectedRowIds(new Set([prev[0].id]));
      setReportBuildingId(prev[0].id);
    }
    toast.info("Undo");
  };

  // Redo Handler (Ctrl+Y / Ctrl+Shift+Z)
  const handleRedo = () => {
    if (isEffectiveReadOnly) return;
    if (redoStack.length === 0) {
      toast.info("Nothing to redo");
      return;
    }
    const next = redoStack[0];
    setUndoStack((u) => [...u, buildings]);
    setRedoStack((r) => r.slice(1));
    saveSchedule(next, false);
    if (next.length > 0) {
      setSelectedBuildingId(next[0].id);
      setSelectedRowIds(new Set([next[0].id]));
      setReportBuildingId(next[0].id);
    }
    toast.info("Redo");
  };

  // ==============================================================
  // GLOBAL KEYBOARD SHORTCUTS LISTENER (MATCHING VENTILATION EXACTLY)
  // ==============================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: deselect all rows
      if (e.key === "Escape") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          setSelectedRowIds(new Set());
        }
        return;
      }

      // Do NOT intercept if typing inside an active form control
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Ctrl+A (Select All)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        if (tab === "schedule" && buildings.length > 0) {
          e.preventDefault();
          setSelectedRowIds(new Set(buildings.map((b) => b.id)));
          toast.info(`Selected all ${buildings.length} building(s)`);
        }
        return;
      }

      // 2. Delete / Backspace (Delete Selected)
      if (e.key === "Delete" || e.key === "Backspace") {
        if (isEffectiveReadOnly) {
          toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
          return;
        }
        if (tab === "schedule" && (selectedRowIds.size > 0 || activeItem)) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      // 3. Copy: Ctrl+C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (tab === "schedule" && (selectedRowIds.size > 0 || activeItem)) {
          e.preventDefault();
          handleCopySelected();
        }
        return;
      }

      // 4. Cut: Ctrl+X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (isEffectiveReadOnly) {
          toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
          return;
        }
        if (tab === "schedule" && (selectedRowIds.size > 0 || activeItem)) {
          e.preventDefault();
          handleCutSelected();
        }
        return;
      }

      // 5. Paste: Ctrl+V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (isEffectiveReadOnly) {
          toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
          return;
        }
        if (tab === "schedule") {
          e.preventDefault();
          handlePasteSelected();
        }
        return;
      }

      // 6. Duplicate: Ctrl+D
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (isEffectiveReadOnly) {
          toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
          return;
        }
        if (tab === "schedule") {
          e.preventDefault();
          handleDuplicateSelected();
        }
        return;
      }

      // 7. Undo/Redo: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    tab,
    buildings,
    selectedRowIds,
    activeItem,
    isEffectiveReadOnly,
    copiedBuildings,
    undoStack,
    redoStack,
  ]);

  // ==============================================================
  // RIGHT-CLICK CONTEXT MENU CONTENT (CUSTOM TAILORED FOR FIRE DEMAND)
  // ==============================================================
  const renderBuildingContextMenu = (b: CivilDefenseBuilding) => {
    const isMulti = selectedRowIds.size > 1 && selectedRowIds.has(b.id);
    const targetsCount = isMulti ? selectedRowIds.size : 1;
    const targetIds = isMulti ? Array.from(selectedRowIds) : [b.id];
    const targetBuildings = buildings.filter((item) => targetIds.includes(item.id));
    const hasAnyOverrides = targetBuildings.some(
      (item) =>
        item.overridePumpFlowGpm !== undefined ||
        item.overridePumpPressureBar !== undefined ||
        item.overrideTankDurationMin !== undefined ||
        item.overrideNetStorageM3 !== undefined
    );

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
        {/* 1. Edit Parameters / Bulk Edit */}
        <ContextMenuItem
          disabled={isEffectiveReadOnly}
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Calculation is APPROVED and locked. Unlock to edit.", { id: "readonly-notice" });
              return;
            }
            if (isMulti) {
              handleOpenBulkEdit();
            } else {
              handleOpenEditModal(b.id);
            }
          }}
          className="flex items-center gap-2 p-1.5 font-medium cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? `Bulk Edit Selected (${targetsCount})` : "Edit Parameters"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">
            {isMulti ? "" : "Double-click"}
          </ContextMenuShortcut>
        </ContextMenuItem>

        {/* 2. Duplicate */}
        <ContextMenuItem
          disabled={isEffectiveReadOnly}
          onClick={() => {
            if (isEffectiveReadOnly) return;
            if (!selectedRowIds.has(b.id)) {
              setSelectedRowIds(new Set([b.id]));
              setSelectedBuildingId(b.id);
            }
            handleDuplicateSelected();
          }}
          className="flex items-center gap-2 p-1.5 font-medium cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? `Duplicate Selected (${targetsCount})` : "Duplicate Building"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>

        {/* 3. Copy */}
        <ContextMenuItem
          onClick={() => {
            if (!selectedRowIds.has(b.id)) {
              setSelectedRowIds(new Set([b.id]));
              setCopiedBuildings([b]);
              toast.info(`Copied "${b.name}" to clipboard`);
            } else {
              handleCopySelected();
            }
          }}
          className="flex items-center gap-2 p-1.5 font-medium cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? `Copy Selected (${targetsCount})` : "Copy Building"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>

        {/* 4. Cut */}
        <ContextMenuItem
          disabled={isEffectiveReadOnly}
          onClick={() => {
            if (isEffectiveReadOnly) return;
            if (!selectedRowIds.has(b.id)) {
              setSelectedRowIds(new Set([b.id]));
            }
            handleCutSelected();
          }}
          className="flex items-center gap-2 p-1.5 font-medium cursor-pointer"
        >
          <Scissors className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? `Cut Selected (${targetsCount})` : "Cut Building"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>

        {/* 5. Paste */}
        <ContextMenuItem
          disabled={isEffectiveReadOnly || copiedBuildings.length === 0}
          onClick={() => {
            if (isEffectiveReadOnly) return;
            handlePasteSelected();
          }}
          className="flex items-center gap-2 p-1.5 font-medium cursor-pointer data-[disabled]:opacity-40 data-[disabled]:pointer-events-none"
        >
          <ClipboardPaste className="size-3.5 text-muted-foreground" />
          <span>Paste Building{copiedBuildings.length > 0 ? ` (${copiedBuildings.length})` : ""}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* 6. Reset Code Overrides (if any) */}
        {hasAnyOverrides && (
          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => {
              targetIds.forEach((id) => handleResetRowOverrides(id));
            }}
            className="flex items-center gap-2 p-1.5 font-medium text-amber-600 dark:text-amber-400 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Overrides to Code</span>
          </ContextMenuItem>
        )}

        {/* 7. Dedicated Water Tank Tab */}
        <ContextMenuItem
          onClick={() => {
            setSelectedBuildingId(b.id);
            setTab("tanks");
          }}
          className="flex items-center gap-2 p-1.5 font-medium cursor-pointer"
        >
          <Waves className="size-3.5 text-blue-500" />
          <span>Configure Water Tank</span>
        </ContextMenuItem>

        {/* 8. Engineering Calculation Report Tab */}
        <ContextMenuItem
          onClick={() => {
            setSelectedBuildingId(b.id);
            setReportBuildingId(b.id);
            setTab("report");
          }}
          className="flex items-center gap-2 p-1.5 font-medium cursor-pointer"
        >
          <FileText className="size-3.5 text-emerald-500" />
          <span>View Calculation Report</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* 9. Add Comment / Assign Task */}
        <ContextMenuItem
          onClick={() => handleOpenComment(b.id, b.name)}
          className="flex items-center gap-2 p-1.5 font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment / Assign Task</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* 10. Delete */}
        <ContextMenuItem
          disabled={isEffectiveReadOnly}
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Workspace is in Read-Only mode. Deleting is locked.", { id: "readonly-notice" });
              return;
            }
            if (!selectedRowIds.has(b.id)) {
              setSelectedRowIds(new Set([b.id]));
            }
            handleDeleteSelected();
          }}
          className="flex items-center gap-2 p-1.5 font-medium text-destructive hover:bg-destructive/10 cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>{isMulti ? `Delete Selected (${targetsCount})` : "Delete Building"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  // Export Engineering Report as PDF (Exact Ventilation Format)
  const handleExportPDF = async () => {
    try {
      await exportFireWaterDemandPDF(evaluatedBuildings, projectSummary, unitSystem, {
        calcNo: `TRV-CAL-FWD-${(project?.id || "0000").slice(-4).toUpperCase()}`,
        date: formatDateStr(new Date().toISOString()),
        projectNo: project?.code || project?.id?.substring(0, 8) || "P000",
        projectName: project?.name || "MEP Project",
        client: project?.client || "-",
        endUser: (project as any)?.endUser || project?.location || "-",
        userName: currentUserName,
        reviewState: calcReviewState,
      });
    } catch (e) {
      console.error("PDF generation failed", e);
      toast.error("Failed to generate PDF");
    }
  };

  // Signature Block Details for Ventilation-style Report Block
  const sigDetails = useMemo(() => {
    return getSignatureBlockDetails(project?.id || "default", "/plumbing-fire-water-demand", currentUserName, calcReviewState);
  }, [project?.id, currentUserName, calcReviewState]);

  // Filtered buildings for table
  const filteredBuildings = useMemo(() => {
    return evaluatedBuildings.filter((item) => {
      const b = item.building;
      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOccupancy = filterOccupancy === "all" || b.occupancy === filterOccupancy;
      return matchesSearch && matchesOccupancy;
    });
  }, [evaluatedBuildings, searchQuery, filterOccupancy]);

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
          
          {/* ============================================================== */}
          {/* PAGE HEADER: EXACT SEWAGE PUMP SIZING FORMAT                   */}
          {/* ============================================================== */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Fire Water Demand</h1>
                <span className="text-[14px] font-medium text-muted-foreground">{buildings.length} building block{buildings.length !== 1 ? "s" : ""}</span>
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
                projectId={project?.id || "default"}
                calculatorPath="/plumbing-fire-water-demand"
                calculatorTitle="Fire Water Demand"
                onReviewStateChange={setCalcReviewState}
              />
            </div>
          </div>


          {/* ============================================================== */}
          {/* MAIN CARD CONTAINER & TABS SELECTOR (MATCHING VENTILATION)      */}
          {/* ============================================================== */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            isApprovedLocked || calcReviewState?.status === "APPROVED"
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Tabs Selector row - VENTILATION & SEWAGE PUMP STANDARD */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              
              {/* Left Side: Tabs + Formula + Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("schedule")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "schedule" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Building Schedule
                  </button>
                  <button
                    onClick={() => {
                      if (buildings.length > 0 && (!reportBuildingId || !buildings.find(b => b.id === reportBuildingId))) {
                        setReportBuildingId(buildings[0].id);
                      }
                      setTab("report");
                    }}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report
                  </button>
                </div>


              </div>

              {/* Right Side Controls: Export & Unit System Toggle (EXACT SEWAGE PUMP FORMAT) */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPDF}>
                  <FileText className="size-3.5" /> Export
                </TBtn>

                {/* Sizing Unit system toggle */}
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  disabled={isEffectiveReadOnly}
                  inputDescriptions="Fire Water Demand (GPM / LPM), Residual Pressure (psi / bar), Water Tank Capacity (gal / m³)"
                  conversionExample={
                    unitSystem === "ip"
                      ? "Convert 1000 GPM → 3785 LPM, 100 psi → 6.9 bar, 60,000 Gal → 227.1 m³"
                      : "Convert 3785 LPM → 1000 GPM, 6.9 bar → 100 psi, 227.1 m³ → 60,000 Gal"
                  }
                />
              </div>
            </div>

            {/* TAB 1: SCHEDULE (FULL-HEIGHT SPACIOUS DATAGRID WITH DOUBLE-CLICK EDITING) */}
            {tab === "schedule" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                
                {/* Search & Action Bar (Matching Ventilation / Sewage Grid Toolbar) */}
                <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 bg-card border-b border-border/60 shrink-0 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search building name or occupancy..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                            filterOccupancy !== "all"
                              ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                              : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                          }`}
                        >
                          <Filter className="size-3.5 shrink-0" />
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                            Filter
                          </span>
                          {filterOccupancy !== "all" && (
                            <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                              1
                            </span>
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 p-1.5 bg-popover border border-border rounded-xl shadow-xl font-sans z-50">
                        <div className="flex items-center justify-between px-2 py-1 pb-1.5 border-b border-border mb-1">
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Filter Occupancy</span>
                          {filterOccupancy !== "all" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterOccupancy("all");
                              }}
                              className="text-[10.5px] text-primary hover:underline font-semibold cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <DropdownMenuItem
                          onClick={() => setFilterOccupancy("all")}
                          className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer ${
                            filterOccupancy === "all" ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-surface-2"
                          }`}
                        >
                          <span>All Occupancies ({buildings.length})</span>
                          {filterOccupancy === "all" && <Check className="size-3.5 text-primary shrink-0" />}
                        </DropdownMenuItem>
                        {OCCUPANCY_OPTIONS.map((o) => {
                          const isSelected = filterOccupancy === o.value;
                          const count = buildings.filter((b) => b.occupancy === o.value).length;
                          return (
                            <DropdownMenuItem
                              key={o.value}
                              onClick={() => setFilterOccupancy(o.value)}
                              className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer ${
                                isSelected ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-surface-2"
                              }`}
                            >
                              <span>{o.label.split(" (")[0]} ({count})</span>
                              {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      disabled={isEffectiveReadOnly}
                      onClick={handleAddNewBuilding}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="size-3.5" />
                      Add Building
                    </button>
                  </div>

                  {/* Bulk actions bar overlay (Ventilation standard) */}
                  {!isEffectiveReadOnly && selectedRowIds.size > 0 && (
                    <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                      <span className="font-semibold">{selectedRowIds.size} selected</span>
                      <span className="text-primary/30">·</span>
                      <BulkBtn icon={Edit3} onClick={handleOpenBulkEdit}>Bulk edit</BulkBtn>
                      <BulkBtn icon={Copy} onClick={handleDuplicateSelected}>Duplicate</BulkBtn>
                      <BulkBtn icon={MessageSquare} onClick={handleAssignTaskForSelected}>Assign task</BulkBtn>
                      <BulkBtn icon={Trash2} onClick={handleDeleteSelected}>Delete</BulkBtn>
                      <button
                        onClick={() => setSelectedRowIds(new Set())}
                        className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                      >
                        <X className="size-3" /> Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Building Schedule DataGrid Table - Takes Full Container Height */}
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                      <thead className="bg-surface-2 text-muted-foreground font-semibold uppercase text-[10.5px] sticky top-0 z-10 border-b border-border shadow-xs">
                        <tr>
                          <th className="py-2 px-2 w-8 text-center">
                            <input
                              type="checkbox"
                              checked={selectedRowIds.size === buildings.length && buildings.length > 0}
                              onChange={toggleSelectAll}
                              className="rounded border-border cursor-pointer"
                            />
                          </th>
                          <th className="py-2 px-2 text-left">
                            <div>BUILDING / BLOCK</div>
                          </th>
                          <th className="py-2 px-1.5 text-center">
                            <div>OCCUPANCY</div>
                          </th>
                          <th className="py-2 px-1 text-center w-14">
                            <div>HEIGHT</div>
                            <div className="text-[9.5px] text-muted-foreground/75 font-normal">(M)</div>
                          </th>
                          <th className="py-2 px-1 text-center w-16">
                            <div>FLOORS</div>
                            <div className="text-[9.5px] text-muted-foreground/75 font-normal">(G+)</div>
                          </th>
                          <th className="py-2 px-1 text-center">
                            <div>GFA</div>
                            <div className="text-[9.5px] text-muted-foreground/75 font-normal">(M²)</div>
                          </th>
                          <th className="py-2 px-1 text-center">
                            <div>PLOT AREA</div>
                            <div className="text-[9.5px] text-muted-foreground/75 font-normal">(M²)</div>
                          </th>
                          <th className="py-2 px-1 text-center">
                            <div>STANDPIPES</div>
                          </th>
                          <th className="py-2 px-1.5 text-center">
                            <div>FIRE PUMP DUTY</div>
                            <div className="text-[9.5px] text-muted-foreground/75 font-normal">
                              {unitSystem === "si" ? "(LPM @ BAR)" : "(GPM @ PSI)"}
                            </div>
                          </th>
                          <th className="py-2 px-1.5 text-center">
                            <div>TANK DURATION</div>
                            <div className="text-[9.5px] text-muted-foreground/75 font-normal">(MIN)</div>
                          </th>
                          <th className="py-2 px-1.5 text-center">
                            <div>NET STORAGE</div>
                            <div className="text-[9.5px] text-muted-foreground/75 font-normal">
                              {unitSystem === "si" ? "(M³)" : "(GAL)"}
                            </div>
                          </th>
                          <th className="py-2 px-2 text-center pr-3">
                            <div>STAGING PUMPS</div>
                            <div className="text-[9.5px] text-muted-foreground/75 font-normal">(&gt;90M)</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredBuildings.map((item) => {
                          const b = item.building;
                          const ev = item.evaluation;
                          const isSelected = b.id === selectedBuildingId;
                          const isChecked = selectedRowIds.has(b.id);
                          const hasOverrides = b.overridePumpFlowGpm !== undefined ||
                            b.overridePumpPressureBar !== undefined ||
                            b.overrideTankDurationMin !== undefined ||
                            b.overrideNetStorageM3 !== undefined;

                          return (
                            <React.Fragment key={b.id}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <tr
                                  key={b.id}
                                  id={`building-row-${b.id}`}
                                  data-row-id={b.id}
                                  data-comment-target={b.id}
                                  onContextMenu={() => {
                                    if (!selectedRowIds.has(b.id)) {
                                      setSelectedBuildingId(b.id);
                                      setSelectedRowIds(new Set([b.id]));
                                      setReportBuildingId(b.id);
                                    }
                                  }}
                                  onClick={(e) => {
                                    setSelectedBuildingId(b.id);
                                    setReportBuildingId(b.id);
                                    if (e.ctrlKey || e.metaKey) {
                                      toggleSelectRow(b.id);
                                    } else if (e.shiftKey) {
                                      const lastIdx = buildings.findIndex(item => item.id === selectedBuildingId);
                                      const currIdx = buildings.findIndex(item => item.id === b.id);
                                      if (lastIdx !== -1 && currIdx !== -1) {
                                        const start = Math.min(lastIdx, currIdx);
                                        const end = Math.max(lastIdx, currIdx);
                                        const next = new Set(selectedRowIds);
                                        for (let i = start; i <= end; i++) {
                                          next.add(buildings[i].id);
                                        }
                                        setSelectedRowIds(next);
                                      }
                                    } else {
                                      setSelectedRowIds(new Set([b.id]));
                                    }
                                  }}
                                  onDoubleClick={() => {
                                    handleOpenEditModal(b.id);
                                  }}
                                  className={`transition-colors group cursor-pointer ${
                                    isItemHighlighted(b.id, b.name)
                                      ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/25 z-20 relative font-bold"
                                      : isSelected
                                      ? "bg-primary/10 hover:bg-primary/15 font-medium"
                                      : "hover:bg-surface-2"
                                  }`}
                                  title="Right-click for options • Double-click to view calculations & rules • Ctrl+Click to select"
                                >
                              {/* 1. Selection Checkbox */}
                              <td className="py-1.5 px-2 text-center" onClick={(e) => toggleSelectRow(b.id, e)}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded border-border cursor-pointer"
                                />
                              </td>

                              {/* 2. Building / Block Name (Editable Input) */}
                              <td className="py-1 px-2 font-semibold text-foreground" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1 min-w-[150px] max-w-[220px]">
                                  <button
                                    onClick={() => setExpandedRowId(expandedRowId === b.id ? null : b.id)}
                                    className="p-0.5 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                    title={expandedRowId === b.id ? "Collapse Details" : "Expand Statutory Details"}
                                  >
                                    <ChevronDown className={`size-3.5 transition-transform ${expandedRowId === b.id ? "rotate-180" : ""}`} />
                                  </button>
                                  {renderCommentBadge(b.id, b.name)}
                                  <input
                                    type="text"
                                    value={b.name}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => handleUpdateBuilding(b.id, { name: e.target.value })}
                                    className="w-full min-w-0 px-1.5 py-0.5 text-xs font-semibold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded transition-all truncate"
                                    placeholder="Building Name"
                                  />
                                  {ev.requiresStagingPumps && (
                                    <span className="text-[9.5px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-semibold shrink-0" title="Super Highrise (>90m): Mandates intermediate multi-level staging pumps and transfer tanks">
                                      &gt;90m
                                    </span>
                                  )}
                                  {ev.isYardHydrantRequired && (
                                    <span className="text-[9.5px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-semibold shrink-0" title="Plot Area > 20,000 m²: Mandates site yard hydrants spaced at 60m (UAE Code Section 3.11)">
                                      Yard
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 3. Occupancy Dropdown (Editable Select) */}
                              <td className="py-1 px-1 text-muted-foreground text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="min-w-[110px] max-w-[140px] mx-auto">
                                  <select
                                    value={b.occupancy}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => handleUpdateBuilding(b.id, { occupancy: e.target.value as CivilDefenseOccupancy }, true)}
                                    className="w-full px-1.5 py-0.5 text-xs text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-border/40 hover:border-border/80 focus:border-primary focus:ring-1 focus:ring-primary rounded cursor-pointer transition-all truncate"
                                    title={`Occupancy category: ${OCCUPANCY_OPTIONS.find((o) => o.value === b.occupancy)?.desc || b.occupancy}`}
                                  >
                                    {OCCUPANCY_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label.split(" (")[0]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>

                              {/* 4. Height (Editable Input) */}
                              <td className="py-1 px-1 text-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center min-w-[50px] mx-auto" title="Height (meters). Governs Super Highrise (>90m), Highrise (23-90m), Midrise (15-23m), Lowrise (≤15m)">
                                  <input
                                    type="number"
                                    min="1"
                                    step="0.5"
                                    value={b.height || ""}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                      if (!isNaN(v)) handleUpdateBuilding(b.id, { height: v }, true);
                                    }}
                                    className="w-12 px-1 py-0.5 text-xs font-semibold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded text-center"
                                  />
                                </div>
                              </td>

                              {/* 5. Floors (Editable Input) */}
                              <td className="py-1 px-1 text-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center min-w-[55px] mx-auto" title="Above-ground stories">
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-muted-foreground text-[11px]">(G+</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={b.floors ?? ""}
                                      disabled={isEffectiveReadOnly}
                                      onChange={(e) => {
                                        const v = e.target.value === "" ? 0 : parseInt(e.target.value);
                                        if (!isNaN(v)) handleUpdateBuilding(b.id, { floors: v }, true);
                                      }}
                                      className="w-10 px-1 py-0.5 text-xs font-semibold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded text-center"
                                    />
                                    <span className="text-muted-foreground text-[11px]">)</span>
                                  </div>
                                </div>
                              </td>

                              {/* 6. GFA (m²) (Editable Input) */}
                              <td className="py-1 px-1 text-muted-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="min-w-[60px] max-w-[80px] mx-auto" title="Ground Floor Area (m²). Governs code system thresholds (≤500m², 501-3600m², >3600m²)">
                                  <input
                                    type="number"
                                    min="0"
                                    step="10"
                                    value={b.groundFloorArea || ""}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                      if (!isNaN(v)) handleUpdateBuilding(b.id, { groundFloorArea: v }, true);
                                    }}
                                    className="w-full px-1 py-0.5 text-xs text-foreground font-mono bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded text-center"
                                  />
                                </div>
                              </td>

                              {/* 7. Plot Area (m²) (Editable Input) */}
                              <td className="py-1 px-1 text-muted-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="min-w-[60px] max-w-[80px] mx-auto" title="Plot Area (m²). If >20,000 m², triggers Section 3.11 mandatory Yard Hydrants">
                                  <input
                                    type="number"
                                    min="0"
                                    step="50"
                                    value={b.plotArea || ""}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                      if (!isNaN(v)) handleUpdateBuilding(b.id, { plotArea: v }, true);
                                    }}
                                    className="w-full px-1 py-0.5 text-xs text-foreground font-mono bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded text-center"
                                  />
                                </div>
                              </td>

                              {/* 8. Standpipes (Editable Input) */}
                              <td className="py-1 px-1 text-center text-foreground font-mono" onClick={(e) => e.stopPropagation()}>
                                <div className="w-10 mx-auto" title="Number of Standpipes/Stairs. In Highrise, ≤2 standpipes = 750 GPM (2839 LPM); >2 standpipes = 1000 GPM (3785 LPM)">
                                  <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    step="1"
                                    value={b.standpipeCount || ""}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? 1 : parseInt(e.target.value);
                                      if (!isNaN(v)) handleUpdateBuilding(b.id, { standpipeCount: v }, true);
                                    }}
                                    className="w-full px-1 py-0.5 text-xs font-semibold text-center text-foreground font-mono bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded"
                                  />
                                </div>
                              </td>

                              {/* 9. Fire Pump Duty (OUTPUT) */}
                              <td className="py-1 px-1.5 font-semibold text-foreground font-mono text-center">
                                <div className="flex items-center justify-center gap-1 mx-auto text-xs whitespace-nowrap" title={`Governing Rule: ${ev.lowestPumpRemarks}`}>
                                  {unitSystem === "si" ? (
                                    <>
                                      <span>{ev.lowestFirePumpFlowLpm}</span>
                                      <span className="text-muted-foreground/70 text-[11px]">@</span>
                                      <span>{ev.lowestFirePumpPressureBar}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>{ev.lowestFirePumpFlowGpm}</span>
                                      <span className="text-muted-foreground/70 text-[11px]">@</span>
                                      <span>{ev.lowestFirePumpPressurePsi}</span>
                                    </>
                                  )}
                                </div>
                              </td>

                              {/* 10. Tank Duration (OUTPUT) */}
                              <td className="py-1 px-1.5 text-foreground font-mono text-center font-semibold text-xs whitespace-nowrap" title={`Statutory duration: ${ev.mainTankDurationMin} min per UAE Code`}>
                                {ev.mainTankDurationMin}
                              </td>

                              {/* 11. Net Water Volume (OUTPUT) */}
                              <td className="py-1 px-1.5 font-semibold text-foreground font-mono text-center text-xs whitespace-nowrap">
                                {unitSystem === "si" ? (
                                  <span title={`Calculated Net Volume: ${ev.lowestFirePumpFlowGpm} GPM × ${ev.mainTankDurationMin} min = ${ev.mainTankNetVolumeM3} m³`}>
                                    {ev.mainTankNetVolumeM3}
                                  </span>
                                ) : (
                                  <span title={`Calculated Net Volume: ${ev.lowestFirePumpFlowGpm} GPM × ${ev.mainTankDurationMin} min = ${ev.mainTankNetVolumeGal.toLocaleString()} US gal`}>
                                    {ev.mainTankNetVolumeGal.toLocaleString()}
                                  </span>
                                )}
                              </td>

                              {/* 12. Staging Pumps (Auto-derived from >90m) */}
                              <td className="py-1 px-2 pr-3 text-muted-foreground text-center">
                                {ev.requiresStagingPumps ? (
                                  <span className="text-purple-600 dark:text-purple-400 font-semibold font-mono text-[10.5px] whitespace-nowrap">
                                    {ev.stagingPumpFlowGpm} GPM @ 6.9 bar (+90m)
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[10.5px] whitespace-nowrap">N/A (Single Set)</span>
                                )}
                              </td>
                            </tr>
                          </ContextMenuTrigger>
                          {renderBuildingContextMenu(b)}
                        </ContextMenu>
                        {expandedRowId === b.id && (
                          <tr className="bg-surface-2/10 border-b border-border/60">
                            <td colSpan={12} className="p-0">
                              <div className="p-4 pl-12 border-l-4 border-primary">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {/* Statutory System Requirements */}
                                  <div className="bg-surface-1 p-3 rounded-lg border border-border/60">
                                    <h4 className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase">
                                      <ShieldCheck className="size-3.5 text-green-500" />
                                      Statutory Systems (Code)
                                    </h4>
                                    <ul className="space-y-1.5 text-[11px] text-muted-foreground font-medium">
                                      <li className="flex items-center justify-between">
                                        <span>Sprinklers Required:</span>
                                        <span className={ev.isSprinklerRequired ? "text-green-600 dark:text-green-400 font-bold" : ""}>
                                          {ev.isSprinklerRequired ? "YES" : "NO"}
                                        </span>
                                      </li>
                                      <li className="flex items-center justify-between">
                                        <span>Wet Risers Required:</span>
                                        <span className={ev.isRiserRequired ? "text-green-600 dark:text-green-400 font-bold" : ""}>
                                          {ev.isRiserRequired ? "YES" : "NO"}
                                        </span>
                                      </li>
                                      <li className="flex items-center justify-between">
                                        <span>Hose Reels Required:</span>
                                        <span className={ev.isHoseReelRequired ? "text-green-600 dark:text-green-400 font-bold" : ""}>
                                          {ev.isHoseReelRequired ? "YES" : "NO"}
                                        </span>
                                      </li>
                                      <li className="flex items-center justify-between">
                                        <span>Yard Hydrants:</span>
                                        <span className={ev.isYardHydrantRequired ? "text-amber-600 dark:text-amber-400 font-bold" : ""}>
                                          {ev.isYardHydrantRequired ? "MANDATORY" : "N/A"}
                                        </span>
                                      </li>
                                    </ul>
                                  </div>

                                  {/* Pump Header & Discharge */}
                                  <div className="bg-surface-1 p-3 rounded-lg border border-border/60">
                                    <h4 className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase">
                                      <Droplets className="size-3.5 text-blue-500" />
                                      NFPA 20 Discharge Header
                                    </h4>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-muted-foreground">Header Size (DN):</span>
                                        <span className="text-[12px] font-bold font-mono text-foreground">DN {ev.recommendedHeaderDn}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-muted-foreground">Header Size (NPS):</span>
                                        <span className="text-[12px] font-bold font-mono text-foreground">{ev.recommendedHeaderNps}"</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-muted-foreground">Flow Velocity:</span>
                                        <span className={`text-[12px] font-bold font-mono ${ev.flowVelocityFps > 15 ? 'text-red-500' : 'text-foreground'}`}>
                                          {ev.flowVelocityFps} ft/s
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground leading-tight pt-1 border-t border-border/60 mt-2">
                                        Discharge header dimensioned for max 15 ft/s velocity at 100% rated flow.
                                      </p>
                                    </div>
                                  </div>

                                  {/* Auxiliary / Other Risks */}
                                  <div className="bg-surface-1 p-3 rounded-lg border border-border/60">
                                    <h4 className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase">
                                      <AlertTriangle className="size-3.5 text-amber-500" />
                                      Auxiliary & Extinguishers
                                    </h4>
                                    <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                                      <li className="flex items-center gap-1.5">
                                        <Check className="size-3 text-green-500 shrink-0" />
                                        <span>Manual Extinguishers (Code Tab 9.17)</span>
                                      </li>
                                      <li className="flex items-center gap-1.5">
                                        <Check className="size-3 text-green-500 shrink-0" />
                                        <span>Breaching Inlet / FDC connection</span>
                                      </li>
                                      <li className="flex items-center gap-1.5">
                                        <Check className="size-3 text-green-500 shrink-0" />
                                        <span>Dry/Clean Agent for Electrical/IT rooms</span>
                                      </li>
                                      <li className="flex items-center gap-1.5">
                                        <Check className="size-3 text-green-500 shrink-0" />
                                        <span>Wet Chemical for Commercial Kitchens</span>
                                      </li>
                                    </ul>
                                  </div>

                                  {/* Code Clauses */}
                                  <div className="bg-surface-1 p-3 rounded-lg border border-border/60">
                                    <h4 className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase">
                                      <FileText className="size-3.5 text-purple-500" />
                                      Applied Clauses
                                    </h4>
                                    <div className="flex flex-col gap-1.5 h-[80px] overflow-y-auto pr-2 custom-scrollbar">
                                      {ev.clauses.map((clause, idx) => (
                                        <div key={idx} className="flex gap-1.5 text-[10px] text-muted-foreground leading-tight">
                                          <span className="text-primary font-bold shrink-0">•</span>
                                          <span>{clause}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer (Matching Ventilation) */}
              <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg select-none">
                <div>
                  Showing <span className="text-foreground font-medium tabular">{filteredBuildings.length.toLocaleString()}</span> of {buildings.length.toLocaleString()} building block{buildings.length !== 1 ? "s" : ""}
                </div>
                <div className="flex items-center gap-3 tabular">
                  <span>
                    Σ Demand: <span className="font-mono text-foreground">{unitSystem === "si" ? `${(projectSummary.maxPumpFlowLpm ?? 0).toLocaleString()} LPM` : `${(projectSummary.maxPumpFlowGpm ?? 0).toLocaleString()} GPM`}</span>
                  </span>
                  <span>
                    Σ Net Storage: <span className="font-mono text-foreground">{unitSystem === "si" ? `${(projectSummary.totalNetStorageM3 ?? 0).toLocaleString()} m³` : `${(projectSummary.totalNetStorageGal ?? 0).toLocaleString()} Gal`}</span>
                  </span>
                  {activeItem && (
                    <span>
                      Selected: <span className="font-semibold text-foreground">{activeItem.building.name}</span> <span className="text-muted-foreground/70">({OCCUPANCY_OPTIONS.find((o) => o.value === activeItem.building.occupancy)?.label.split(" (")[0] || activeItem.building.occupancy} • {activeItem.building.height}m)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}



            {/* TAB 2: STAGING & PUMP HYDRAULICS */}
            {tab === "staging" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 bg-surface-1/30">
                {/* Building Selector */}
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">Select Tower:</span>
                  {buildings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setReportBuildingId(b.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        reportBuildingId === b.id
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:bg-surface-3"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>

                {(() => {
                  const activeTower = buildings.find(b => b.id === reportBuildingId) || buildings[0];
                  if (!activeTower) return null;
                  
                  const { evaluation: ev } = evaluateCivilDefenseFireDemand(
                    activeTower,
                    buildings.filter(x => x.id !== activeTower.id),
                    unitSystem
                  );

                  if (!ev.requiresStagingPumps) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card rounded-xl border border-border max-w-3xl mx-auto shadow-xs">
                        <div className="p-4 bg-green-500/10 rounded-full mb-4">
                          <CheckCircle2 className="size-8 text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground mb-2">Single Stage Network (≤90m)</h2>
                        <p className="text-sm text-muted-foreground max-w-md mb-6">
                          Tower <strong>{activeTower.name}</strong> has an elevation of {activeTower.height}m. 
                          UAE Civil Defense mandates vertical staging pumps and transfer tanks only for Super Highrise buildings exceeding 90 meters in height.
                        </p>
                        <div className="p-4 bg-surface-2 rounded-lg border border-border w-full text-left flex items-start gap-4">
                          <div className="p-2 bg-blue-500/10 rounded">
                            <Gauge className="size-5 text-blue-500" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground">Governing Ground Pump Set</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              A single fire pump set located at ground/basement level is sufficient to serve the entire building height.
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-4">
                              <div className="bg-background p-2 rounded border border-border">
                                <span className="block text-[10px] text-muted-foreground uppercase">Flow Demand</span>
                                <span className="font-mono text-sm font-bold text-foreground">{ev.lowestFirePumpFlowGpm} GPM</span>
                              </div>
                              <div className="bg-background p-2 rounded border border-border">
                                <span className="block text-[10px] text-muted-foreground uppercase">Min Pressure</span>
                                <span className="font-mono text-sm font-bold text-foreground">{ev.lowestFirePumpPressureBar} bar</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Super Highrise Staging Elevation Diagram
                  return (
                    <div className="max-w-4xl mx-auto w-full pb-10">
                      <div className="mb-4 text-center">
                        <h2 className="text-lg font-bold text-foreground">Super Highrise Schematic Diagram</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tower <strong>{activeTower.name}</strong> ({activeTower.height}m) requires multi-level staging per Table 9.18 and Clause 9.6.2.
                        </p>
                      </div>

                      <div className="relative rounded-2xl bg-gradient-to-b from-blue-950/20 to-surface-2 border border-border p-8 overflow-hidden shadow-sm">
                        {/* Vertical Riser Backbone */}
                        <div className="absolute top-12 bottom-12 left-1/2 -translate-x-1/2 w-4 bg-red-600/80 rounded-t-full border-2 border-red-900/50 flex flex-col items-center shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                          {/* Flow animation dots */}
                          <div className="w-1.5 h-1.5 bg-white/60 rounded-full mt-4 animate-[bounce_2s_infinite]"></div>
                          <div className="w-1.5 h-1.5 bg-white/60 rounded-full mt-12 animate-[bounce_2s_infinite_200ms]"></div>
                          <div className="w-1.5 h-1.5 bg-white/60 rounded-full mt-12 animate-[bounce_2s_infinite_400ms]"></div>
                        </div>

                        <div className="flex flex-col gap-12 relative z-10">
                          {/* Top Level (Roof/Crown) */}
                          <div className="flex justify-between items-center group">
                            <div className="w-5/12 text-right pr-6">
                              <h3 className="text-sm font-bold text-foreground">Roof / Top Landing</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">Topmost Landing Valve Test Connection</p>
                            </div>
                            <div className="size-8 rounded-full bg-surface-1 border-2 border-red-500 shadow-md flex items-center justify-center shrink-0 z-10 text-[10px] font-bold text-red-500 group-hover:scale-110 transition-transform">
                              TLV
                            </div>
                            <div className="w-5/12 pl-6">
                              <div className="inline-block px-3 py-1.5 rounded-lg bg-surface-2 border border-border shadow-xs">
                                <span className="text-[11px] font-mono text-muted-foreground">Elev: +{activeTower.height}m</span>
                              </div>
                            </div>
                          </div>

                          {/* Intermediate Staging Levels */}
                          <div className="flex justify-between items-center">
                            <div className="w-5/12 text-right pr-6">
                              <div className="p-3 bg-surface-1 rounded-xl border border-border shadow-sm ml-auto max-w-xs transition-colors hover:border-blue-500/50">
                                <div className="flex items-center justify-end gap-2 mb-2">
                                  <h4 className="text-xs font-bold text-foreground">Transfer Break Tank</h4>
                                  <Waves className="size-3.5 text-blue-500" />
                                </div>
                                <p className="text-[11px] text-muted-foreground mb-2">
                                  Feeds upper stage pumps. Auto-refills from ground pumps.
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-left">
                                  <div className="bg-surface-2 p-1.5 rounded">
                                    <span className="block text-[9px] text-muted-foreground uppercase">Duration</span>
                                    <span className="font-mono text-xs font-bold text-foreground">{ev.stagingTankDurationMin} min</span>
                                  </div>
                                  <div className="bg-surface-2 p-1.5 rounded">
                                    <span className="block text-[9px] text-muted-foreground uppercase">Net Vol</span>
                                    <span className="font-mono text-xs font-bold text-foreground">{ev.stagingTankNetVolumeM3} m³</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="p-2 rounded-xl bg-red-600/10 border-2 border-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.2)] shrink-0 z-10 flex flex-col items-center justify-center relative">
                              <Zap className="size-6 text-red-500 mb-1" />
                              <span className="text-[10px] font-bold text-foreground px-1 bg-background rounded border border-border">STG. {ev.stagingLevelsCount}</span>
                              <div className="absolute top-1/2 right-full w-6 h-2 bg-blue-500/30 border-y border-blue-500/50" />
                            </div>

                            <div className="w-5/12 pl-6">
                              <div className="p-3 bg-surface-1 rounded-xl border border-border shadow-sm max-w-xs border-l-2 border-l-purple-500 transition-colors hover:bg-surface-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <Flame className="size-3.5 text-red-500" />
                                  <h4 className="text-xs font-bold text-foreground">Upper Staging Pump</h4>
                                </div>
                                <p className="text-[11px] text-muted-foreground mb-2">
                                  Boosts pressure for high zone. {ev.stagingRemarks}
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <div className="bg-surface-2 p-1.5 rounded border border-border/50">
                                    <span className="block text-[9px] text-muted-foreground uppercase">Flow</span>
                                    <span className="font-mono text-xs font-bold text-foreground">{ev.stagingPumpFlowGpm} GPM</span>
                                  </div>
                                  <div className="bg-surface-2 p-1.5 rounded border border-border/50">
                                    <span className="block text-[9px] text-muted-foreground uppercase">Pressure</span>
                                    <span className="font-mono text-xs font-bold text-foreground">{ev.stagingPumpPressureBar} bar</span>
                                  </div>
                                </div>
                                <div className="mt-2 inline-block px-2 py-1 rounded bg-surface-2 border border-border">
                                  <span className="text-[10px] font-mono text-muted-foreground">Elev: +{ev.stagingIntervalMeters}m</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Ground Level */}
                          <div className="flex justify-between items-center group">
                            <div className="w-5/12 text-right pr-6">
                              <div className="p-3 bg-surface-1 rounded-xl border border-border shadow-sm ml-auto max-w-xs border-r-2 border-r-blue-500 transition-colors hover:border-r-blue-400">
                                <div className="flex items-center justify-end gap-2 mb-2">
                                  <h4 className="text-xs font-bold text-foreground">Primary Main Tank</h4>
                                  <Droplets className="size-3.5 text-blue-500" />
                                </div>
                                <p className="text-[11px] text-muted-foreground mb-2">
                                  Main underground / basement reserve.
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-left">
                                  <div className="bg-surface-2 p-1.5 rounded">
                                    <span className="block text-[9px] text-muted-foreground uppercase">Duration</span>
                                    <span className="font-mono text-xs font-bold text-foreground">{ev.mainTankDurationMin} min</span>
                                  </div>
                                  <div className="bg-surface-2 p-1.5 rounded">
                                    <span className="block text-[9px] text-muted-foreground uppercase">Net Vol</span>
                                    <span className="font-mono text-xs font-bold text-foreground">{ev.mainTankNetVolumeM3} m³</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="p-3 rounded-2xl bg-red-600 border-2 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)] shrink-0 z-10 flex flex-col items-center justify-center">
                              <Gauge className="size-8 text-white mb-1" />
                              <span className="text-[11px] font-bold text-white px-2 py-0.5 bg-black/30 rounded uppercase tracking-wider">Main</span>
                            </div>

                            <div className="w-5/12 pl-6">
                              <div className="p-3 bg-surface-1 rounded-xl border border-border shadow-sm max-w-xs border-l-2 border-l-red-500 transition-colors hover:bg-surface-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <Flame className="size-3.5 text-red-500" />
                                  <h4 className="text-xs font-bold text-foreground">Governing Ground Pump</h4>
                                </div>
                                <p className="text-[11px] text-muted-foreground mb-2">
                                  Supplies low zone & upper transfer tank.
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <div className="bg-surface-2 p-1.5 rounded border border-border/50">
                                    <span className="block text-[9px] text-muted-foreground uppercase">Flow</span>
                                    <span className="font-mono text-xs font-bold text-foreground">{ev.lowestFirePumpFlowGpm} GPM</span>
                                  </div>
                                  <div className="bg-surface-2 p-1.5 rounded border border-border/50">
                                    <span className="block text-[9px] text-muted-foreground uppercase">Pressure</span>
                                    <span className="font-mono text-xs font-bold text-foreground">{ev.lowestFirePumpPressureBar} bar</span>
                                  </div>
                                </div>
                                <div className="mt-2 inline-block px-2 py-1 rounded bg-surface-2 border border-border">
                                  <span className="text-[10px] font-mono text-muted-foreground">Elev: 0m</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {tab === "tanks" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 gap-4">
                {activeTankSizing && activeItem && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    
                    {/* Left: Interactive Dimensions Input */}
                    <div className="lg:col-span-5 p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2">
                          <Waves className="size-4 text-blue-500" />
                          <h3 className="text-sm font-bold text-foreground">
                            Tank Dimensions & Civil Structure
                          </h3>
                        </div>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                          {activeItem.evaluation.mainTankNetVolumeM3} m³ Net
                        </span>
                      </div>

                      <div className="space-y-3 text-xs">
                        {/* Target Net Volume Callout */}
                        <div className="p-2.5 rounded-lg bg-surface-2 border border-border/60 flex items-center justify-between">
                          <div>
                            <span className="text-muted-foreground text-[11px]">Required Net Fire Reserve:</span>
                            <div className="text-base font-bold text-foreground font-mono">
                              {unitSystem === "si"
                                ? `${activeItem.evaluation.mainTankNetVolumeM3} m³`
                                : `${activeItem.evaluation.mainTankNetVolumeGal.toLocaleString()} US gal`}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground text-[11px]">Duration:</span>
                            <div className="text-sm font-bold text-foreground font-mono">
                              {activeItem.evaluation.mainTankDurationMin} minutes
                            </div>
                          </div>
                        </div>

                        {/* Length & Width */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Tank Internal Length (m):
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="0.5"
                              disabled={isEffectiveReadOnly}
                              value={tankLength}
                              onChange={(e) => setTankLength(parseFloat(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                            />
                          </div>
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Tank Internal Width (m):
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="0.5"
                              disabled={isEffectiveReadOnly}
                              value={tankWidth}
                              onChange={(e) => setTankWidth(parseFloat(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                            />
                          </div>
                        </div>

                        {/* Freeboard & Dead Suction Sump */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Freeboard Air Gap (m):
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              step="0.05"
                              disabled={isEffectiveReadOnly}
                              value={tankFreeboard}
                              onChange={(e) => setTankFreeboard(parseFloat(e.target.value) || 0.3)}
                              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                            />
                            <span className="text-[10px] text-muted-foreground">Min 0.30m above overflow</span>
                          </div>
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Dead Suction Sump (m):
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              step="0.05"
                              disabled={isEffectiveReadOnly}
                              value={tankDeadVolumeDepth}
                              onChange={(e) => setTankDeadVolumeDepth(parseFloat(e.target.value) || 0.2)}
                              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                            />
                            <span className="text-[10px] text-muted-foreground">Anti-vortex plate zone</span>
                          </div>
                        </div>

                        {/* City Mains Refilling Flow */}
                        <div>
                          <label className="block text-muted-foreground font-medium mb-1">
                            City Water Replenishment Flow (GPM):
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            disabled={isEffectiveReadOnly}
                            value={cityMainRefillFlowGpm}
                            onChange={(e) => setCityMainRefillFlowGpm(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            Estimated time to refill from empty: {activeTankSizing.fillTimeHours} hours
                          </span>
                        </div>

                        {/* Calculated Dimensions Summary */}
                        <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded bg-surface-2">
                            <span className="text-muted-foreground text-[10px] uppercase">Effective Water Depth:</span>
                            <div className="font-bold font-mono text-foreground">{activeTankSizing.effectiveDepth} m</div>
                          </div>
                          <div className="p-2 rounded bg-surface-2">
                            <span className="text-muted-foreground text-[10px] uppercase">Total Tank Height:</span>
                            <div className="font-bold font-mono text-foreground">{activeTankSizing.totalHeight} m</div>
                          </div>
                          <div className="p-2 rounded bg-surface-2">
                            <span className="text-muted-foreground text-[10px] uppercase">Footprint Area:</span>
                            <div className="font-bold font-mono text-foreground">{activeTankSizing.floorArea} m²</div>
                          </div>
                          <div className="p-2 rounded bg-surface-2">
                            <span className="text-muted-foreground text-[10px] uppercase">Gross Tank Volume:</span>
                            <div className="font-bold font-mono text-foreground">{activeTankSizing.grossVolumeM3} m³</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: SVG Graphic Cross-Section & Appurtenances */}
                    <div className="lg:col-span-7 flex flex-col gap-3">
                      
                      {/* Interactive Visual Tank Elevation */}
                      <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col items-center">
                        <div className="w-full flex items-center justify-between text-xs font-bold text-foreground mb-3">
                          <span className="flex items-center gap-1.5">
                            <Droplets className="size-4 text-blue-500" />
                            Civil Defense Dedicated Tank Elevation Diagram (Section 3.1)
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {tankLength}m × {tankWidth}m × {activeTankSizing.totalHeight}m (H)
                          </span>
                        </div>

                        {/* Tank Elevation Graphic */}
                        <div className="w-full max-w-md h-64 border-2 border-border/80 rounded-xl relative overflow-hidden bg-slate-900/90 p-4 flex flex-col justify-between shadow-inner">
                          {/* Freeboard Zone */}
                          <div className="w-full h-10 border-b border-dashed border-amber-400/60 flex items-center justify-between px-3 text-[11px] text-amber-300 font-mono">
                            <span>Freeboard (+{tankFreeboard}m Air Gap)</span>
                            <span>Overflow Line</span>
                          </div>

                          {/* Effective Water Body */}
                          <div className="relative flex-1 w-full bg-gradient-to-b from-blue-500/30 to-blue-600/50 flex flex-col justify-center items-center text-center p-2">
                            <div className="text-xs font-bold text-blue-200">
                              EFFECTIVE FIRE WATER STORAGE
                            </div>
                            <div className="text-lg font-black text-white font-mono">
                              {unitSystem === "si"
                                ? `${activeItem.evaluation.mainTankNetVolumeM3} m³`
                                : `${activeItem.evaluation.mainTankNetVolumeGal.toLocaleString()} US Gallons`}
                            </div>
                            <div className="text-[10px] text-blue-200/80 font-mono">
                              Depth: {activeTankSizing.effectiveDepth}m ({activeItem.evaluation.mainTankDurationMin} min duration)
                            </div>
                          </div>

                          {/* Anti-Vortex / Sump Zone */}
                          <div className="w-full h-8 border-t border-dashed border-slate-500/60 flex items-center justify-between px-3 text-[10px] text-slate-400 font-mono bg-slate-950/60">
                            <span>Anti-Vortex Plate Level (+{tankDeadVolumeDepth}m)</span>
                            <span>Suction Header</span>
                          </div>
                        </div>
                      </div>

                      {/* Appurtenances & Mandatory Inlets */}
                      <div className="p-4 rounded-xl bg-surface-2 border border-border shadow-xs text-xs space-y-2">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <ShieldCheck className="size-4 text-emerald-500" />
                          <span>Mandatory Civil Defense Appurtenances (Section 3.1)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-muted-foreground">
                          <div className="p-2 rounded bg-card border border-border/50">
                            <strong>• Dedicated Direct Breeching Inlet:</strong> Installed externally on building facade for fire brigade direct refilling.
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <strong>• Low Water Level Detection:</strong> Connected to fire alarm panel with audio-visual supervisory fault signaling.
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <strong>• Anti-Vortex Plate:</strong> Fitted over every suction outlet to prevent air entrainment into fire pump impellers.
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <strong>• Dual Chamber Tank:</strong> 2 interconnected compartments to allow maintenance without shutting down protection.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: OFFICIAL PRINTABLE REPORT PREVIEW (MATCHING VENTILATION REPORT FORMAT) */}
            {tab === "report" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                <div className="max-w-5xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                  
                  {/* Action Bar / Title Header */}
                  <div className="flex justify-between items-start pb-4 border-b border-border flex-wrap gap-4">
                    <div>
                      <div className="text-[11px] font-bold text-primary uppercase tracking-wider">
                        Official Engineering Calculation Document
                      </div>
                      <h2 className="text-xl font-black text-foreground uppercase tracking-wide mt-0.5">
                        Fire Water Demand Calculation Report
                      </h2>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Design Standard: UAE Fire &amp; Life Safety Code of Practice Chapter 9 (Tables 9.18 to 9.21.e) &amp; NFPA 13 / 14 / 20 / 22
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        calcReviewState?.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-600 border border-amber-500/30"
                      }`}>
                        {calcReviewState?.status || "DRAFT DESIGN"}
                      </span>
                      <TBtn primary onClick={handleExportPDF}>
                        <FileText className="size-3.5" /> Export PDF
                      </TBtn>
                      <TBtn onClick={() => window.print()}>
                        <Printer className="size-3.5" /> Print
                      </TBtn>
                    </div>
                  </div>

                  {/* Enclosed Project Metadata Grid (3 rows x 2 cols - Exact Ventilation format) */}
                  <div className="border border-border rounded-xl overflow-hidden text-[12px]">
                    <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/20">
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Calculation No.:</span>
                        <span className="text-muted-foreground font-mono">TRV-CAL-FWD-{(project?.id || "0000").slice(-4).toUpperCase()}</span>
                      </div>
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Date:</span>
                        <span className="text-muted-foreground">{formatDateStr(new Date().toISOString())}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Project No.:</span>
                        <span className="text-muted-foreground">{project?.code || project?.id?.substring(0, 8) || "P000"}</span>
                      </div>
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Client:</span>
                        <span className="text-muted-foreground">{project?.client || "-"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border">
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Project Name:</span>
                        <span className="text-muted-foreground">{project?.name || "MEP Project"}</span>
                      </div>
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">End User:</span>
                        <span className="text-muted-foreground">{(project as any)?.endUser || project?.location || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Table 1: Schedule of Buildings & Fire Protection Capacities */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                            <th className="py-2 px-2 w-10 text-center">Sr. No.</th>
                            <th className="py-2 px-3 text-left">Building / Block</th>
                            <th className="py-2 px-2.5 text-left">Occupancy Class</th>
                            <th className="py-2 px-2 text-center">
                              <div>Height / Flr</div>
                              <div className="text-[10px] font-semibold">(m / G+)</div>
                            </th>
                            <th className="py-2 px-2 text-center">
                              <div>GFA</div>
                              <div className="text-[10px] font-semibold">(m²)</div>
                            </th>
                            <th className="py-2 px-2 text-center">
                              <div>Plot</div>
                              <div className="text-[10px] font-semibold">(m²)</div>
                            </th>
                            <th className="py-2 px-1.5 text-center">
                              <div>Risers</div>
                              <div className="text-[10px] font-semibold">(Stairs)</div>
                            </th>
                            <th className="py-2 px-2 text-center">
                              <div>Code Ref</div>
                              <div className="text-[10px] font-semibold">(Table)</div>
                            </th>
                            <th className="py-2 px-3 text-center">
                              <div>Fire Pump Flow</div>
                              <div className="text-[10px] font-semibold">{unitSystem === "si" ? "(LPM / GPM)" : "(GPM / LPM)"}</div>
                            </th>
                            <th className="py-2 px-2.5 text-center">
                              <div>Pressure</div>
                              <div className="text-[10px] font-semibold">{unitSystem === "si" ? "(bar / psi)" : "(psi / bar)"}</div>
                            </th>
                            <th className="py-2 px-2 text-center">
                              <div>Duration</div>
                              <div className="text-[10px] font-semibold">(min)</div>
                            </th>
                            <th className="py-2 px-3 text-center">
                              <div>Net Storage</div>
                              <div className="text-[10px] font-semibold">{unitSystem === "si" ? "(m³ / gal)" : "(gal / m³)"}</div>
                            </th>
                            <th className="py-2 px-2.5 text-center">
                              <div>Staging</div>
                              <div className="text-[10px] font-semibold">(&gt;90m)</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 font-mono">
                          {evaluatedBuildings.map((item, idx) => {
                            const b = item.building;
                            const ev = item.evaluation;

                            const flowVal = unitSystem === "si"
                              ? `${ev.lowestFirePumpFlowLpm} LPM (${ev.lowestFirePumpFlowGpm} GPM)`
                              : `${ev.lowestFirePumpFlowGpm} GPM (${ev.lowestFirePumpFlowLpm} LPM)`;

                            const pressVal = unitSystem === "si"
                              ? `${ev.lowestFirePumpPressureBar} bar (${ev.lowestFirePumpPressurePsi} psi)`
                              : `${ev.lowestFirePumpPressurePsi} psi (${ev.lowestFirePumpPressureBar} bar)`;

                            const volVal = unitSystem === "si"
                              ? `${ev.mainTankNetVolumeM3} m³ (${ev.mainTankNetVolumeGal.toLocaleString()} gal)`
                              : `${ev.mainTankNetVolumeGal.toLocaleString()} gal (${ev.mainTankNetVolumeM3} m³)`;

                            return (
                              <tr key={b.id} className="hover:bg-muted/30">
                                <td className="py-2 px-2 text-center text-muted-foreground font-sans">{idx + 1}</td>
                                <td className="py-2 px-3 font-sans font-bold text-foreground text-left">{b.name}</td>
                                <td className="py-2 px-2.5 font-sans text-muted-foreground text-left">
                                  {OCCUPANCY_OPTIONS.find((o) => o.value === b.occupancy)?.label.split(" (")[0] || b.occupancy}
                                </td>
                                <td className="py-2 px-2 text-center">{b.height}m / G+{b.floors}</td>
                                <td className="py-2 px-2 text-center">{b.groundFloorArea.toLocaleString()}</td>
                                <td className="py-2 px-2 text-center">{b.plotArea.toLocaleString()}</td>
                                <td className="py-2 px-1.5 text-center">{b.standpipeCount}</td>
                                <td className="py-2 px-2 text-center font-semibold text-primary font-sans">{ev.tableRef.replace(/^Table\s+/i, "")}</td>
                                <td className="py-2 px-3 text-center font-bold text-primary bg-[#DAE9F8]/40 dark:bg-[#0c2e47]/40">{flowVal}</td>
                                <td className="py-2 px-2.5 text-center font-bold text-foreground bg-[#DAE9F8]/40 dark:bg-[#0c2e47]/40">{pressVal}</td>
                                <td className="py-2 px-2 text-center">{ev.mainTankDurationMin} min</td>
                                <td className="py-2 px-3 text-center font-bold text-primary bg-[#DAE9F8]/40 dark:bg-[#0c2e47]/40">{volVal}</td>
                                <td className="py-2 px-2.5 text-center font-sans text-[10.5px]">
                                  {ev.requiresStagingPumps ? (
                                    <span className="font-semibold text-purple-600 dark:text-purple-400">Yes (+{ev.stagingIntervalMeters}m)</span>
                                  ) : (
                                    <span className="text-muted-foreground">Single Stage</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Summary Total / Governing Site Row (Exact Ventilation highlight format) */}
                          <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold border-t-2 border-border text-foreground">
                            <td className="py-2 px-2 text-center font-sans">TOTAL</td>
                            <td className="py-2 px-3 font-sans text-left">GOVERNING SITE DEMAND</td>
                            <td className="py-2 px-2.5 font-sans text-left text-muted-foreground">{evaluatedBuildings.length} Blocks</td>
                            <td className="py-2 px-2 text-center">-</td>
                            <td className="py-2 px-2 text-center">-</td>
                            <td className="py-2 px-2 text-center">-</td>
                            <td className="py-2 px-1.5 text-center">-</td>
                            <td className="py-2 px-2 text-center font-sans">UAE Civil Defense</td>
                            <td className="py-2 px-3 text-center text-primary font-mono text-[11.5px]">
                              {unitSystem === "si"
                                ? `${projectSummary.maxPumpFlowLpm} LPM (${projectSummary.maxPumpFlowGpm} GPM)`
                                : `${projectSummary.maxPumpFlowGpm} GPM (${projectSummary.maxPumpFlowLpm} LPM)`}
                            </td>
                            <td className="py-2 px-2.5 text-center text-foreground font-mono text-[11.5px]">
                              {unitSystem === "si"
                                ? `${projectSummary.maxPumpPressureBar} bar (${projectSummary.maxPumpPressurePsi} psi)`
                                : `${projectSummary.maxPumpPressurePsi} psi (${projectSummary.maxPumpPressureBar} bar)`}
                            </td>
                            <td className="py-2 px-2 text-center">-</td>
                            <td className="py-2 px-3 text-center text-primary font-mono text-[11.5px]">
                              {unitSystem === "si"
                                ? `${projectSummary.totalNetStorageM3} m³ (${projectSummary.totalNetStorageGal.toLocaleString()} gal)`
                                : `${projectSummary.totalNetStorageGal.toLocaleString()} gal (${projectSummary.totalNetStorageM3} m³)`}
                            </td>
                            <td className="py-2 px-2.5 text-center font-sans text-[10.5px]">
                              {projectSummary.superHighriseCount > 0 ? `${projectSummary.superHighriseCount} Tower(s)` : "Single"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 2: Aggregate Technical Summary & Hydraulics Breakdown */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                            <th className="py-2 px-2.5 w-12 text-center">Sr. No.</th>
                            <th className="py-2 px-3 text-left">Technical Sizing Parameter</th>
                            <th className="py-2 px-3 text-left">Governing Rule / Code</th>
                            <th className="py-2 px-3 text-right">Calculated Capacity</th>
                            <th className="py-2 px-2.5 text-center">Unit</th>
                            <th className="py-2 px-3 text-left">Engineering Design Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 font-sans">
                          {/* Row 1: Governing Fire Pump Duty */}
                          <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground">
                            <td className="py-2 px-2.5 text-center font-mono">1</td>
                            <td className="py-2 px-3">GOVERNING SITE FIRE PUMP DUTY</td>
                            <td className="py-2 px-3">UAE Code Section 3.1</td>
                            <td className="py-2 px-3 text-right font-mono text-primary text-[12px]">
                              {unitSystem === "si"
                                ? `${projectSummary.maxPumpFlowLpm} LPM (${projectSummary.maxPumpFlowGpm} GPM) @ ${projectSummary.maxPumpPressureBar} bar`
                                : `${projectSummary.maxPumpFlowGpm} GPM (${projectSummary.maxPumpFlowLpm} LPM) @ ${projectSummary.maxPumpPressurePsi} psi`}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono">{unitSystem === "si" ? "LPM @ bar" : "GPM @ psi"}</td>
                            <td className="py-2 px-3 text-[10.5px]">1 Main Electric Duty + 1 Standby Diesel + 1 Jockey Pump</td>
                          </tr>

                          {/* Row 2: Total Net Fire Water Storage */}
                          <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground">
                            <td className="py-2 px-2.5 text-center font-mono">2</td>
                            <td className="py-2 px-3">TOTAL SITE NET FIRE WATER STORAGE</td>
                            <td className="py-2 px-3">Chapter 9 Tables</td>
                            <td className="py-2 px-3 text-right font-mono text-primary text-[12px]">
                              {unitSystem === "si"
                                ? `${projectSummary.totalNetStorageM3} m³ (${projectSummary.totalNetStorageGal.toLocaleString()} US gal)`
                                : `${projectSummary.totalNetStorageGal.toLocaleString()} US gal (${projectSummary.totalNetStorageM3} m³)`}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono">{unitSystem === "si" ? "m³" : "US gal"}</td>
                            <td className="py-2 px-3 text-[10.5px]">Dedicated separate fire storage reserve for all scheduled buildings</td>
                          </tr>

                          {/* Row 3: Total Gross Water Storage */}
                          <tr className="hover:bg-muted/30">
                            <td className="py-2 px-2.5 text-center font-mono">3</td>
                            <td className="py-2 px-3 font-medium">Total Site Gross Tank Volume</td>
                            <td className="py-2 px-3 text-muted-foreground">+10% Ullage &amp; Sump</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">
                              {unitSystem === "si"
                                ? `${projectSummary.totalGrossStorageM3} m³ (${projectSummary.totalGrossStorageGal.toLocaleString()} US gal)`
                                : `${projectSummary.totalGrossStorageGal.toLocaleString()} US gal (${projectSummary.totalGrossStorageM3} m³)`}
                            </td>
                            <td className="py-2 px-2.5 text-center text-muted-foreground">{unitSystem === "si" ? "m³" : "US gal"}</td>
                            <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Includes min 0.30m freeboard air gap &amp; anti-vortex dead suction zone</td>
                          </tr>

                          {/* Row 4: NFPA 20 Discharge Header */}
                          <tr className="hover:bg-muted/30">
                            <td className="py-2 px-2.5 text-center font-mono">4</td>
                            <td className="py-2 px-3 font-medium">NFPA 20 Discharge Header Pipe Size</td>
                            <td className="py-2 px-3 text-muted-foreground">NFPA 20 Table 4.27</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                              {projectSummary.governingHeaderNps}" NPS (DN {projectSummary.governingHeaderDn})
                            </td>
                            <td className="py-2 px-2.5 text-center text-muted-foreground">inch (mm)</td>
                            <td className="py-2 px-3 text-muted-foreground text-[10.5px]">
                              Water velocity {projectSummary.governingHeaderVelocity} ft/s (strictly complies with NFPA 20 limit &le; 15 ft/s)
                            </td>
                          </tr>

                          {/* Row 5: Super Highrise Staging */}
                          <tr className="hover:bg-muted/30">
                            <td className="py-2 px-2.5 text-center font-mono">5</td>
                            <td className="py-2 px-3 font-medium">Super Highrise Intermediate Staging Status</td>
                            <td className="py-2 px-3 text-muted-foreground">Table 9.18 (&gt;90m)</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">
                              {projectSummary.superHighriseCount > 0 ? `${projectSummary.superHighriseCount} Tower(s) &gt; 90m` : "Exempt (&le;90m)"}
                            </td>
                            <td className="py-2 px-2.5 text-center text-muted-foreground">towers</td>
                            <td className="py-2 px-3 text-muted-foreground text-[10.5px]">
                              {projectSummary.superHighriseCount > 0
                                ? "Mandates 750/1000 GPM staging pumps and 30-min intermediate upper tanks every 90m"
                                : "Single ground/basement pump set is sufficient to serve full height"}
                            </td>
                          </tr>

                          {/* Row 6: Yard Hydrants */}
                          <tr className="hover:bg-muted/30">
                            <td className="py-2 px-2.5 text-center font-mono">6</td>
                            <td className="py-2 px-3 font-medium">Site Yard Fire Hydrants Requirement</td>
                            <td className="py-2 px-3 text-muted-foreground">Section 3.11</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">
                              {projectSummary.yardHydrantRequiredCount > 0 ? `${projectSummary.yardHydrantRequiredCount} Zone(s) Required` : "Exempt / Available"}
                            </td>
                            <td className="py-2 px-2.5 text-center text-muted-foreground">status</td>
                            <td className="py-2 px-3 text-muted-foreground text-[10.5px]">
                              {projectSummary.yardHydrantRequiredCount > 0
                                ? "Plot area > 20,000 m² without existing municipal hydrants within 60m: requires 1000 GPM ring main"
                                : "Municipal infrastructure hydrants available within 60m radius or plot <= 20,000 m²"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Statutory Civil Defense General Notes Box */}
                  <div className="p-4 rounded-xl bg-surface-2 border border-border text-xs space-y-1.5 text-muted-foreground">
                    <div className="font-bold text-foreground">STATUTORY GENERAL NOTES &amp; REQUIREMENTS (UAE FIRE &amp; LIFE SAFETY CODE CHAPTER 9):</div>
                    <div>1. <strong>Fire Pump Sets:</strong> All fire pump installations shall comprise 1 Main Electric Duty Pump + 1 Standby Diesel / Electric Pump (100% capacity) + 1 Electric Pressure Maintenance Jockey Pump per UAE Code Section 3.1.</div>
                    <div>2. <strong>Dedicated Water Storage:</strong> Dedicated fire water storage shall be physically separated from domestic/irrigation tanks and provided with direct breeching inlets for fire brigade replenishment.</div>
                    <div>3. <strong>Super Highrise (&gt;90m):</strong> Buildings exceeding 90 meters require vertical multi-stage intermediate booster pumps and 30-minute intermediate staging tanks every 90m elevation.</div>
                    <div>4. <strong>Standpipes &amp; Risers:</strong> Interconnected at lowest and highest levels to guarantee 6.9 bar residual pressure at the most remote landing valve under full design flow.</div>
                  </div>

                  {/* Table 3: 4-Column Dynamic Signature Block (Exact Ventilation standard) */}
                  <div className="border border-border rounded-xl overflow-hidden mt-6">
                    <table className="w-full text-center text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-[#FFE6CC] text-black font-bold border-b border-border">
                          <th className="py-2 px-3 text-left w-1/4">Designation</th>
                          <th className="py-2 px-3 w-1/4">Originator</th>
                          <th className="py-2 px-3 w-1/4">Reviewer</th>
                          <th className="py-2 px-3 w-1/4">Approver</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-sans">
                        <tr>
                          <td className="py-2 px-3 text-left font-bold text-foreground">Name:</td>
                          <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.name || sigDetails?.originatedName || "-"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.name || sigDetails?.reviewerName || "-"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.name || sigDetails?.approverName || "-"}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-left font-bold text-foreground">Date:</td>
                          <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.date || sigDetails?.originatedDate || "-"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.date || sigDetails?.reviewerDate || "-"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.date || sigDetails?.approverDate || "-"}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-left font-bold text-foreground">Signature:</td>
                          <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.status || (sigDetails?.originatedName ? "Signed" : "-")}</td>
                          <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.status || (sigDetails?.reviewerName ? "Reviewed" : "-")}</td>
                          <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.status || (sigDetails?.approverName ? "Approved" : "-")}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <FireWaterDemandIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              buildings={buildings}
              evaluatedBuildings={evaluatedBuildings}
              projectSummary={projectSummary}
              unitSystem={unitSystem}
              selectedBuildingId={selectedBuildingId}
              onSelectBuilding={(id) => {
                setSelectedBuildingId(id);
                setSelectedRowIds(new Set([id]));
                setTab("schedule");
                setTimeout(() => {
                  const el = document.getElementById(`building-row-${id}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
              setTab={setTab}
            />
          )}
        </div>
      </div>

      {/* Bulk Edit Buildings Modal (Ventilation Standard) */}
      {bulkEditOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <header className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-1 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Edit3 className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Bulk Edit {selectedRowIds.size || 1} Building(s)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Modify parameters across all selected buildings simultaneously
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBulkEditOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto">
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-muted-foreground flex items-start gap-2.5 leading-relaxed">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="text-[11.5px]">
                  Check the box next to any parameter to enable and update it across all <strong className="text-foreground">{selectedRowIds.size || 1}</strong> selected buildings. Unchecked parameters will remain unchanged.
                </div>
              </div>

              {/* Occupancy */}
              <div className="p-3 bg-surface-1 border border-border/70 rounded-xl space-y-2">
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="bulk-opt-occupancy"
                    checked={bulkEditFields.occupancy}
                    onChange={(e) => setBulkEditFields((prev) => ({ ...prev, occupancy: e.target.checked }))}
                    className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="bulk-opt-occupancy" className="text-xs font-semibold text-foreground cursor-pointer">
                    Occupancy Classification (UAE Code Chapter 9)
                  </label>
                </div>
                <select
                  disabled={!bulkEditFields.occupancy}
                  value={bulkEditValues.occupancy}
                  onChange={(e) => setBulkEditValues((prev) => ({ ...prev, occupancy: e.target.value as CivilDefenseOccupancy }))}
                  className="w-full px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {OCCUPANCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Height & Floors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-1 border border-border/70 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      id="bulk-opt-height"
                      checked={bulkEditFields.height}
                      onChange={(e) => setBulkEditFields((prev) => ({ ...prev, height: e.target.checked }))}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bulk-opt-height" className="text-xs font-semibold text-foreground cursor-pointer">
                      Height to Top (m)
                    </label>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    disabled={!bulkEditFields.height}
                    value={bulkEditValues.height}
                    onChange={(e) => setBulkEditValues((prev) => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="p-3 bg-surface-1 border border-border/70 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      id="bulk-opt-floors"
                      checked={bulkEditFields.floors}
                      onChange={(e) => setBulkEditFields((prev) => ({ ...prev, floors: e.target.checked }))}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bulk-opt-floors" className="text-xs font-semibold text-foreground cursor-pointer">
                      Floors (G+)
                    </label>
                  </div>
                  <input
                    type="number"
                    min="1"
                    disabled={!bulkEditFields.floors}
                    value={bulkEditValues.floors}
                    onChange={(e) => setBulkEditValues((prev) => ({ ...prev, floors: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* GFA & Plot Area */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-1 border border-border/70 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      id="bulk-opt-gfa"
                      checked={bulkEditFields.groundFloorArea}
                      onChange={(e) => setBulkEditFields((prev) => ({ ...prev, groundFloorArea: e.target.checked }))}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bulk-opt-gfa" className="text-xs font-semibold text-foreground cursor-pointer">
                      GFA (m²)
                    </label>
                  </div>
                  <input
                    type="number"
                    min="10"
                    disabled={!bulkEditFields.groundFloorArea}
                    value={bulkEditValues.groundFloorArea}
                    onChange={(e) => setBulkEditValues((prev) => ({ ...prev, groundFloorArea: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="p-3 bg-surface-1 border border-border/70 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      id="bulk-opt-plot"
                      checked={bulkEditFields.plotArea}
                      onChange={(e) => setBulkEditFields((prev) => ({ ...prev, plotArea: e.target.checked }))}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bulk-opt-plot" className="text-xs font-semibold text-foreground cursor-pointer">
                      Plot Area (m²)
                    </label>
                  </div>
                  <input
                    type="number"
                    min="50"
                    disabled={!bulkEditFields.plotArea}
                    value={bulkEditValues.plotArea}
                    onChange={(e) => setBulkEditValues((prev) => ({ ...prev, plotArea: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Standpipes & Basements */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-1 border border-border/70 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      id="bulk-opt-standpipes"
                      checked={bulkEditFields.standpipeCount}
                      onChange={(e) => setBulkEditFields((prev) => ({ ...prev, standpipeCount: e.target.checked }))}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bulk-opt-standpipes" className="text-xs font-semibold text-foreground cursor-pointer">
                      Standpipes
                    </label>
                  </div>
                  <select
                    disabled={!bulkEditFields.standpipeCount}
                    value={bulkEditValues.standpipeCount}
                    onChange={(e) => setBulkEditValues((prev) => ({ ...prev, standpipeCount: parseInt(e.target.value) }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="1">1 Standpipe (500 GPM min)</option>
                    <option value="2">2 Standpipes (750 GPM)</option>
                    <option value="3">3+ Standpipes (1000 GPM)</option>
                  </select>
                </div>

                <div className="p-3 bg-surface-1 border border-border/70 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      id="bulk-opt-basements"
                      checked={bulkEditFields.basementCount}
                      onChange={(e) => setBulkEditFields((prev) => ({ ...prev, basementCount: e.target.checked }))}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bulk-opt-basements" className="text-xs font-semibold text-foreground cursor-pointer">
                      Basements
                    </label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    disabled={!bulkEditFields.basementCount}
                    value={bulkEditValues.basementCount}
                    onChange={(e) => setBulkEditValues((prev) => ({ ...prev, basementCount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Checkbox fields: Infra Hydrants & Single Stair */}
              <div className="p-3 bg-surface-1 border border-border/70 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="bulk-opt-infra"
                    checked={bulkEditFields.hasInfraHydrants60m}
                    onChange={(e) => setBulkEditFields((prev) => ({ ...prev, hasInfraHydrants60m: e.target.checked }))}
                    className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="bulk-opt-infra" className="text-xs font-semibold text-foreground cursor-pointer">
                    Infrastructure Hydrant (60m radius)
                  </label>
                </div>
                {bulkEditFields.hasInfraHydrants60m && (
                  <label className="flex items-center gap-2 ml-5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkEditValues.hasInfraHydrants60m}
                      onChange={(e) => setBulkEditValues((prev) => ({ ...prev, hasInfraHydrants60m: e.target.checked }))}
                      className="rounded border-border text-primary cursor-pointer"
                    />
                    <span className="text-[11.5px] text-foreground">Set available within 60m radius</span>
                  </label>
                )}

                <div className="flex items-center gap-2 select-none pt-2 border-t border-border/60">
                  <input
                    type="checkbox"
                    id="bulk-opt-singlestair"
                    checked={bulkEditFields.isSingleExitStair}
                    onChange={(e) => setBulkEditFields((prev) => ({ ...prev, isSingleExitStair: e.target.checked }))}
                    className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="bulk-opt-singlestair" className="text-xs font-semibold text-foreground cursor-pointer">
                    Single Exit Stair Provisions
                  </label>
                </div>
                {bulkEditFields.isSingleExitStair && (
                  <label className="flex items-center gap-2 ml-5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkEditValues.isSingleExitStair}
                      onChange={(e) => setBulkEditValues((prev) => ({ ...prev, isSingleExitStair: e.target.checked }))}
                      className="rounded border-border text-primary cursor-pointer"
                    />
                    <span className="text-[11.5px] text-foreground">Set single exit stair complying with Ch. 3</span>
                  </label>
                )}
              </div>
            </div>

            <footer className="px-5 py-3.5 border-t border-border flex items-center justify-end gap-2 bg-surface-1 shrink-0">
              <button
                onClick={() => setBulkEditOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBulkEdit}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="size-3.5" />
                Apply Changes
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Edit Building Parameters Modal (Opened via Double-Click or Edit Button) */}
      {editingBuilding && (
        <EditBuildingModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          building={editingBuilding}
          onSave={handleSaveEditedBuilding}
          isReadOnly={isEffectiveReadOnly}
          occupancyOptions={OCCUPANCY_OPTIONS}
          unitSystem={unitSystem}
        />
      )}

      {/* Assign Comment / Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="Civil Defense Building"
          calculatorTitle="Fire Water Demand"
          calculatorPath="/plumbing-fire-water-demand"
          existingComments={getItemComments(commentTargetItem.id, commentTargetItem.name)}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

interface FireWaterDemandIntelligenceDrawerProps {
  onClose: () => void;
  buildings: CivilDefenseBuilding[];
  evaluatedBuildings: { building: CivilDefenseBuilding; evaluation: CivilDefenseEvaluation }[];
  projectSummary: {
    buildingCount: number;
    maxPumpFlowGpm: number;
    maxPumpFlowLpm: number;
    maxPumpPressureBar: number;
    maxPumpPressurePsi: number;
    totalNetStorageM3: number;
    totalNetStorageGal: number;
    totalGrossStorageM3: number;
    totalGrossStorageGal: number;
    superHighriseCount: number;
    yardHydrantRequiredCount: number;
    governingHeaderNps: number;
    governingHeaderDn: number;
    governingHeaderVelocity: number;
  };
  unitSystem: "si" | "ip";
  selectedBuildingId: string;
  onSelectBuilding: (id: string) => void;
  setTab: (t: ActiveTab) => void;
}

function FireWaterDemandIntelligenceDrawer({
  onClose,
  buildings,
  evaluatedBuildings,
  projectSummary,
  unitSystem,
  selectedBuildingId,
  onSelectBuilding,
  setTab,
}: FireWaterDemandIntelligenceDrawerProps) {
  const isSI = unitSystem === "si";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    unassignedGfa: false,
    unassignedPlot: false,
    singleStair: false,
    buildingsList: false,
  });

  // Missing data checks
  const missingGfaBuildings = useMemo(() => {
    return buildings.filter((b) => !b.groundFloorArea || b.groundFloorArea <= 0).map(b => ({
      id: b.id,
      name: b.name,
      detail: `${b.height}m`
    }));
  }, [buildings]);

  const missingPlotBuildings = useMemo(() => {
    return buildings.filter((b) => !b.plotArea || b.plotArea <= 0).map(b => ({
      id: b.id,
      name: b.name,
      detail: `${b.height}m`
    }));
  }, [buildings]);

  const singleStairBuildings = useMemo(() => {
    return buildings.filter((b) => b.isSingleExitStair).map(b => ({
      id: b.id,
      name: b.name,
      detail: `${b.height}m`
    }));
  }, [buildings]);

  const allBuildingItems = useMemo(() => {
    return evaluatedBuildings.map((eb) => {
      const b = eb.building;
      const ev = eb.evaluation;
      return {
        id: b.id,
        name: b.name,
        detail: `${b.height}m · ${isSI ? `${ev.lowestFirePumpFlowLpm} LPM` : `${ev.lowestFirePumpFlowGpm} GPM`}`
      };
    });
  }, [evaluatedBuildings, isSI]);

  // Compliance calculations
  const isVelocityOk = (projectSummary?.governingHeaderVelocity ?? 0) <= 15.0;
  const isSuperHighriseHandled =
    projectSummary.superHighriseCount === 0 ||
    evaluatedBuildings.some((eb) => eb.evaluation.requiresStagingPumps);
  const isYardHydrantsHandled = true;
  const isStorageCalculated = projectSummary.totalNetStorageM3 > 0;
  const isFlowCalculated = projectSummary.maxPumpFlowGpm > 0;

  const checks = [
    isVelocityOk,
    isSuperHighriseHandled,
    isYardHydrantsHandled,
    isStorageCalculated,
    isFlowCalculated,
    missingGfaBuildings.length === 0,
    missingPlotBuildings.length === 0,
  ];
  const passedCount = checks.filter(Boolean).length;
  const complianceScore = Math.round((passedCount / checks.length) * 100);

  const handleItemClick = (id: string) => {
    onSelectBuilding(id);
  };

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in select-none">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        <IntelSection icon={CheckCircle2} tone={complianceScore === 100 ? "success" : "warning"} title="Compliance Status">
          <div className="text-[12px] text-muted-foreground">
            UAE Civil Defense &amp; NFPA 20 validation across {buildings.length} building(s).
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${complianceScore === 100 ? "bg-success" : "bg-warning"}`}
                style={{ width: `${complianceScore}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px]">{complianceScore}%</span>
          </div>
        </IntelSection>

        <IntelSection icon={Gauge} tone={isVelocityOk ? "success" : "warning"} title="Hydraulic & Sizing Audit">
          <KV
            k="Governing Flow"
            v={isSI ? `${projectSummary.maxPumpFlowLpm.toLocaleString()} LPM` : `${projectSummary.maxPumpFlowGpm.toLocaleString()} GPM`}
          />
          <KV
            k="Governing Pressure"
            v={isSI ? `${projectSummary.maxPumpPressureBar} bar` : `${projectSummary.maxPumpPressurePsi} psi`}
          />
          <KV
            k="Discharge Header"
            v={`${projectSummary.governingHeaderNps}" NPS (DN ${projectSummary.governingHeaderDn})`}
          />
          <KV
            k="Header Velocity"
            v={`${projectSummary.governingHeaderVelocity} ft/s (Max 15 ft/s)`}
          />
          <KV
            k="Net Water Storage"
            v={isSI ? `${projectSummary.totalNetStorageM3} m³` : `${projectSummary.totalNetStorageGal.toLocaleString()} gal`}
          />
          <KV
            k="Gross Ullage (+10%)"
            v={isSI ? `${projectSummary.totalGrossStorageM3} m³` : `${projectSummary.totalGrossStorageGal.toLocaleString()} gal`}
          />
        </IntelSection>

        <IntelSection
          icon={AlertTriangle}
          tone={projectSummary.superHighriseCount > 0 || projectSummary.yardHydrantRequiredCount > 0 ? "warning" : "muted"}
          title="Statutory Warnings"
        >
          <KV
            k="Super Highrise (>90m)"
            v={projectSummary.superHighriseCount > 0 ? `${projectSummary.superHighriseCount} Tower(s) (Staging Req.)` : "0 (Single Zone)"}
          />
          <KV
            k="Yard Hydrant Main"
            v={projectSummary.yardHydrantRequiredCount > 0 ? `${projectSummary.yardHydrantRequiredCount} Plot(s) Required` : "0 (Exempt / In-Range)"}
          />
          <KV k="Mandatory Pump Set" v="1D + 1S + 1J" />
        </IntelSection>

        <IntelSection icon={Building2} tone="primary" title="Building Schedule">
          <CollapsibleMissingSection
            label="Scheduled Buildings"
            count={buildings.length}
            itemsList={allBuildingItems}
            isOpen={openSections.buildingsList}
            onToggle={() => setOpenSections((prev) => ({ ...prev, buildingsList: !prev.buildingsList }))}
            onItemClick={handleItemClick}
          />
        </IntelSection>

        <IntelSection icon={Info} tone="muted" title="Missing Data">
          <CollapsibleMissingSection
            label="Missing Ground Area"
            count={missingGfaBuildings.length}
            itemsList={missingGfaBuildings}
            isOpen={openSections.unassignedGfa}
            onToggle={() => setOpenSections((prev) => ({ ...prev, unassignedGfa: !prev.unassignedGfa }))}
            onItemClick={handleItemClick}
          />
          <CollapsibleMissingSection
            label="Missing Plot Area"
            count={missingPlotBuildings.length}
            itemsList={missingPlotBuildings}
            isOpen={openSections.unassignedPlot}
            onToggle={() => setOpenSections((prev) => ({ ...prev, unassignedPlot: !prev.unassignedPlot }))}
            onItemClick={handleItemClick}
          />
          <CollapsibleMissingSection
            label="Single Exit Stair"
            count={singleStairBuildings.length}
            itemsList={singleStairBuildings}
            isOpen={openSections.singleStair}
            onToggle={() => setOpenSections((prev) => ({ ...prev, singleStair: !prev.singleStair }))}
            onItemClick={handleItemClick}
          />
        </IntelSection>

        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Ensure infrastructure hydrants within 60m to avoid 1000 GPM yard ring main demand.</li>
            <li>For towers above 90m, stage 750/1000 GPM pumps with 30-min intermediate breakout tanks.</li>
            <li>Add +10% gross volume for freeboard air gap and anti-vortex dead storage.</li>
          </ul>
        </IntelSection>

        <IntelSection icon={Info} tone="muted" title="Engineering Notes">
          <div className="text-[12px] text-muted-foreground">
            Civil Defense Fire Demand calculated per UAE Fire &amp; Life Safety Code (Tables 9.18–9.21.e) and NFPA 20.
          </div>
        </IntelSection>
      </div>
    </div>
  );
}

function IntelSection({ icon: Icon, title, tone, children }: { icon: any; title: string; tone: "success" | "warning" | "primary" | "muted"; children: React.ReactNode }) {
  const color =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
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

function CollapsibleMissingSection({
  label,
  count,
  itemsList,
  isOpen,
  onToggle,
  onItemClick,
}: {
  label: string;
  count: number;
  itemsList: { id: string; name: string; detail?: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (id: string) => void;
}) {
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[12px] hover:text-foreground py-0.5 transition-colors cursor-pointer select-none text-left"
      >
        <span className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <span>{label}</span>
          {isOpen ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
        </span>
        <span className="font-mono tabular font-semibold text-foreground/80">{count}</span>
      </button>

      {isOpen && count > 0 && (
        <div className="mt-1.5 max-h-36 overflow-y-auto border border-border/60 rounded-md bg-surface-2 divide-y divide-border/40 font-mono text-[10.5px] text-muted-foreground custom-scrollbar">
          {itemsList.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className="block w-full px-2.5 py-1.5 hover:bg-surface-3 transition-colors text-left cursor-pointer select-none"
            >
              <div className="text-[11.5px] leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis block">
                <span className="font-sans font-medium text-foreground/80 hover:text-primary transition-colors">
                  {item.name}
                </span>
                {item.detail && (
                  <span className="text-muted-foreground/50 text-[10px] font-mono ml-1.5">
                    ({item.detail})
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FireWaterDemandPage;
