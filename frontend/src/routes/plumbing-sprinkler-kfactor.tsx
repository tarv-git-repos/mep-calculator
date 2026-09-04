import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { api } from "@/services/api";
import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { EditSprinklerCustomModal } from "@/components/workspace/EditSprinklerCustomModal";
import { SprinklerKFactorSelect } from "@/components/workspace/SprinklerKFactorSelect";
import { SprinklerHazardSelect } from "@/components/workspace/SprinklerHazardSelect";
import { useAuth } from "@/contexts/AuthContext";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { exportSprinklerKFactorPDF, type SprinklerExportRow } from "@/lib/exportSprinklerKFactorPDF";
import { exportSprinklerKFactorExcel } from "@/lib/exportSprinklerKFactorExcel";
import { addPdfSignatureBlock, resolveLatestReviewState } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import ExcelJS from "exceljs";
import {
  Plus, Download, Upload, Filter, Trash2, Edit3, Copy, X, Sparkles,
  AlertTriangle, CheckCircle2, Info, FileText, Printer, FileSpreadsheet,
  ArrowUpDown, ChevronRight, ChevronDown, RefreshCw, Play, Settings, Search,
  HelpCircle, Share2, Clipboard, Undo, Redo,
  Activity, Droplet, Flag, MessageSquare, Check, Eye, Wrench
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace } from "@/lib/workspace-store";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { dirtyStore } from "@/lib/dirty-store";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-sprinkler-kfactor")({
  head: () => ({
    meta: [
      { title: "Sprinkler K-Factor — MEP Calc" },
      { name: "description", content: "NFPA 13 Sprinkler K-Factor calculations, flow rates, operating pressures, and design schedules." },
    ],
  }),
  component: SprinklerKFactorPage,
});

interface SprinklerRow {
  id: string;
  floor?: string;
  label: string;
  kFactor: number;
  solveFor: "Q" | "P";
  pressure: number;
  flow: number;
  coverage: number;
  hazard: string;
  notes?: string;
  comments?: any[];
  flagged?: boolean;
  flagReason?: string;
}

const STANDARD_K_FACTORS = [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];

interface KFactorDetail {
  orifice: string;
  thread: string;
  desc: string;
}

const K_FACTOR_DETAILS: Record<number, KFactorDetail> = {
  2.8: { orifice: '3/8" (10 mm)', thread: '1/2" NPT', desc: "Small orifice for residential and light hazard applications" },
  4.2: { orifice: '7/16" (11 mm)', thread: '1/2" NPT', desc: "Standard small orifice for low hazard density control" },
  5.6: { orifice: '1/2" (15 mm)', thread: '1/2" NPT', desc: "Standard orifice sprinkler - most widely used commercially" },
  8.0: { orifice: '17/32" (20 mm)', thread: '3/4" NPT', desc: "Large orifice (ELO) - higher discharge at lower water pressure" },
  11.2: { orifice: '5/8" (20 mm)', thread: '3/4" NPT', desc: "Extra-large orifice (VELO) for high-challenge storage density" },
  14.0: { orifice: '3/4" (20 mm)', thread: '3/4" NPT', desc: "ESFR / Storage early suppression fast response applications" },
  16.8: { orifice: '3/4" (20 mm)', thread: '3/4" NPT', desc: "High density storage control without in-rack sprinkler heads" },
  19.6: { orifice: '1" (25 mm)', thread: '1" NPT', desc: "Very high volume ESFR for palletized ceiling storage >35 ft" },
  22.4: { orifice: '1" (25 mm)', thread: '1" NPT', desc: "High discharge large droplet ESFR storage protection" },
  25.2: { orifice: '1" (25 mm)', thread: '1" NPT', desc: "Ultra high volume ESFR suppression for high-bay warehousing" },
  28.0: { orifice: '1" (25 mm)', thread: '1" NPT', desc: "Maximum flow capacity ESFR for extra high bay ceiling configurations" },
};

function getKFactorDetail(k: number, isSi: boolean): KFactorDetail {
  const ipK = isSi ? parseFloat((k / 14.288).toFixed(1)) : k;
  let closest = 5.6;
  let minDiff = Infinity;
  for (const std of STANDARD_K_FACTORS) {
    const diff = Math.abs(std - ipK);
    if (diff < minDiff) {
      minDiff = diff;
      closest = std;
    }
  }
  return K_FACTOR_DETAILS[closest] || {
    orifice: isSi ? '15 mm' : '1/2" NPT',
    thread: isSi ? '1/2" (15 mm)' : '1/2" NPT',
    desc: `Custom K-${k.toFixed(1)} sprinkler head configuration`
  };
}

interface BulbRating {
  color: string;
  tempF: string;
  tempC: string;
  classification: string;
  hex: string;
  bgHex: string;
  textHex: string;
}

const BULB_RATINGS: BulbRating[] = [
  { color: "orange", tempF: "135°F", tempC: "57°C", classification: "Ordinary", hex: "#f97316", bgHex: "bg-orange-500/10", textHex: "text-orange-500" },
  { color: "red", tempF: "155°F", tempC: "68°C", classification: "Ordinary", hex: "#ef4444", bgHex: "bg-red-500/10", textHex: "text-red-500" },
  { color: "yellow", tempF: "175°F", tempC: "79°C", classification: "Intermediate", hex: "#eab308", bgHex: "bg-yellow-500/10", textHex: "text-yellow-500" },
  { color: "green", tempF: "200°F", tempC: "93°C", classification: "Intermediate", hex: "#22c55e", bgHex: "bg-green-500/10", textHex: "text-green-500" },
  { color: "blue", tempF: "286°F", tempC: "141°C", classification: "High", hex: "#3b82f6", bgHex: "bg-blue-500/10", textHex: "text-blue-500" },
  { color: "mauve", tempF: "360°F", tempC: "182°C", classification: "Extra High", hex: "#a855f7", bgHex: "bg-purple-500/10", textHex: "text-purple-500" },
  { color: "black", tempF: "500°F", tempC: "260°C", classification: "Ultra High", hex: "#18181b", bgHex: "bg-zinc-500/10", textHex: "text-zinc-700 dark:text-zinc-300" },
];

const HAZARD_LIMITS: Record<string, number> = {
  "Light Hazard": 225,
  "Ordinary Hazard Gp 1": 130,
  "Ordinary Hazard Gp 2": 130,
  "Extra Hazard Gp 1": 100,
  "Extra Hazard Gp 2": 100,
};

const DEFAULT_ROWS: SprinklerRow[] = [
  {
    id: "sprink_1",
    floor: "Level 1",
    label: "Office Room 101 - Pendent",
    kFactor: 5.6,
    solveFor: "Q",
    pressure: 15.0,
    flow: 21.69,
    coverage: 130,
    hazard: "Ordinary Hazard Gp 1",
    notes: "Standard office coverage",
    comments: [
      {
        id: "c_demo_1",
        authorName: "Design Engineer",
        text: "Verify hydraulic calculation with pump head",
        timestamp: "2026-09-02T10:00:00.000Z",
        status: "in_progress"
      }
    ]
  },
  {
    id: "sprink_2",
    floor: "Ground Floor",
    label: "Reception Area - Pendent",
    kFactor: 5.6,
    solveFor: "Q",
    pressure: 12.0,
    flow: 19.40,
    coverage: 130,
    hazard: "Ordinary Hazard Gp 1",
    notes: ""
  },
  {
    id: "sprink_3",
    floor: "Level 1",
    label: "Server Room - Upright",
    kFactor: 8.0,
    solveFor: "Q",
    pressure: 20.0,
    flow: 35.78,
    coverage: 90,
    hazard: "Extra Hazard Gp 1",
    notes: "High density area"
  },
  {
    id: "sprink_4",
    floor: "Ground Floor",
    label: "Storage Closet - Sidewall",
    kFactor: 4.2,
    solveFor: "Q",
    pressure: 10.0,
    flow: 13.28,
    coverage: 100,
    hazard: "Light Hazard",
    notes: "Small storage"
  }
];

// Helper to compute row flow/pressure
function computeRowOutputs(row: SprinklerRow): SprinklerRow {
  const K = row.kFactor || 5.6;
  if (row.solveFor === "Q") {
    const P = Math.max(0, row.pressure);
    const Q = K * Math.sqrt(P);
    return { ...row, flow: parseFloat(Q.toFixed(2)) };
  } else {
    const Q = Math.max(0, row.flow);
    const P = Math.pow(Q / K, 2);
    return { ...row, pressure: parseFloat(P.toFixed(2)) };
  }
}

export function extractFloor(name: string): string {
  if (!name) return "Ground Floor";
  const lower = name.toLowerCase();
  if (lower.includes("basement") || lower.includes("b1") || lower.includes("b2")) return "Basement";
  if (lower.includes("ground") || lower.includes("gf") || lower.includes("level 0")) return "Ground Floor";
  if (lower.includes("1st") || lower.includes("first") || lower.includes("level 1") || lower.includes("l1") || lower.includes("101") || lower.includes("102") || lower.includes("103")) return "Level 1";
  if (lower.includes("2nd") || lower.includes("second") || lower.includes("level 2") || lower.includes("l2") || lower.includes("201") || lower.includes("202")) return "Level 2";
  if (lower.includes("3rd") || lower.includes("third") || lower.includes("level 3") || lower.includes("l3") || lower.includes("301")) return "Level 3";
  if (lower.includes("roof") || lower.includes("terrace")) return "Roof";
  return "Ground Floor";
}

export function checkIfSprinklerMissingData(row: SprinklerRow): { isMissing: boolean; reason?: string } {
  if (!row.label || row.label.trim() === "") {
    return { isMissing: true, reason: "Missing Sprinkler Label / Location" };
  }
  if (!row.kFactor || row.kFactor <= 0 || isNaN(row.kFactor)) {
    return { isMissing: true, reason: "Missing or invalid K-Factor" };
  }
  if (!row.pressure || row.pressure <= 0 || isNaN(row.pressure)) {
    return { isMissing: true, reason: "Missing operating pressure" };
  }
  if (!row.flow || row.flow <= 0 || isNaN(row.flow)) {
    return { isMissing: true, reason: "Missing flow rate" };
  }
  if (!row.hazard || row.hazard.trim() === "") {
    return { isMissing: true, reason: "Missing hazard classification" };
  }
  return { isMissing: false };
}

function SprinklerKFactorPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, activeProjectId } = useWorkspace();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Review & Approval State
  const [calcReviewState, setCalcReviewState] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const pId = project?.id || "default";
        return resolveLatestReviewState(pId, "/plumbing-sprinkler-kfactor");
      } catch (e) {}
    }
    return { status: "DRAFT" };
  });
  const isApprovedLocked = calcReviewState?.status === "APPROVED";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleReviewUpdate = (e: any) => {
      if (e.detail) {
        setCalcReviewState(e.detail);
      }
    };
    window.addEventListener("mep_calc_review_updated" as any, handleReviewUpdate);
    window.addEventListener("mep-review-state-updated" as any, handleReviewUpdate);
    return () => {
      window.removeEventListener("mep_calc_review_updated" as any, handleReviewUpdate);
      window.removeEventListener("mep-review-state-updated" as any, handleReviewUpdate);
    };
  }, []);

  // Version History Restore Listener (Full parity with VersionManager)
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = `mep_sprinklers_${project?.id || "default"}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredRows: SprinklerRow[] | null = null;
      if (lsCache && lsCache[pKey]) {
        try {
          restoredRows = typeof lsCache[pKey] === "string" ? JSON.parse(lsCache[pKey]) : lsCache[pKey];
        } catch (err) {}
      }
      if (!restoredRows) {
        const stored = localStorage.getItem(pKey);
        if (stored) {
          try {
            restoredRows = JSON.parse(stored);
          } catch (err) {}
        }
      }
      if (restoredRows && Array.isArray(restoredRows)) {
        setRows(restoredRows);
        setUndoStack([]);
        setRedoStack([]);
        setSelected(new Set());
        setLastSelectedId(null);
        toast.success("Sprinkler schedule restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  // Tabs
    // Sync with project changes (exact PCL logic)
  useEffect(() => {
    const projId = activeProjectId || project?.id;
    if (!projId) return;
    const projKey = `mep_sprinklers_${projId}`;
    const saved = localStorage.getItem(projKey) || localStorage.getItem(`mep_sprinkler_rows_${projId}`);
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRows(parsed);
          return;
        }
      } catch (e) {}
    } else {
      const savedLegacy = localStorage.getItem("mep_sprinklers_default") || localStorage.getItem("sprinkler_rows");
      if (savedLegacy !== null) {
        try {
          const parsed = JSON.parse(savedLegacy);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRows(parsed);
            return;
          }
        } catch (e) {}
      }
    }
  }, [activeProjectId, project?.id]);

  const [tab, setTab] = useState<"schedule" | "solver" | "report">("schedule");
  const [intelOpen, setIntelOpen] = useState(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");

  // Quick Solver State
  const [solverK, setSolverK] = useState<number | "">(5.6);
  const [solverSolveFor, setSolverSolveFor] = useState<"Q" | "P">("Q");
  const [solverKnownVal, setSolverKnownVal] = useState<number | "">(30.0);
  const [isCustomK, setIsCustomK] = useState(false);
  const [selectedBulbColor, setSelectedBulbColor] = useState<string>("red");

  // Grid/Schedule State
  const [rows, setRows] = useState<SprinklerRow[]>(() => {
    try {
      if (typeof window !== "undefined") {
        const pKey = `mep_sprinklers_${project?.id || "default"}`;
        const stored = localStorage.getItem(pKey);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      }
      return DEFAULT_ROWS;
    } catch {
      return DEFAULT_ROWS;
    }
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [floorFilter, setFloorFilter] = useState("All");
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type: "space" | "zone" | "equipment" } | null>(null);

  const handleOpenComment = (row: SprinklerRow) => {
    setCommentTargetItem({ id: row.id, name: row.label, type: "space" });
    setCommentModalOpen(true);
  };
  const [hazardFilter, setHazardFilter] = useState("All");
  const [kFilter, setKFilter] = useState("All");
  const [flagFilterOnly, setFlagFilterOnly] = useState(false);

  const allUniqueFloors = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      set.add(r.floor || "Ground Floor");
    });
    return Array.from(set).sort();
  }, [rows]);
  const [editingSprinkler, setEditingSprinkler] = useState<SprinklerRow | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<{
    hazard?: string;
    kFactor?: number;
    solveFor?: "Q" | "P";
    pressure?: number;
  }>({});

  // History Stack (Local Undo/Redo)
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const pushToUndo = (newRows: SprinklerRow[]) => {
    setUndoStack(prev => [...prev.slice(-49), JSON.stringify(rows)]);
    setRedoStack([]);
  };

  const saveRows = (newRows: SprinklerRow[]) => {
    setRows(newRows);
    const key = `mep_sprinklers_${project?.id || "default"}`;
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(newRows));
      if (project?.id) {
        localStorage.setItem(`mep_sprinkler_rows_${project.id}`, JSON.stringify(newRows));
      }
    }
    if (project?.id) {
      try {
        let wdata = project.workspace_data || {};
        if (typeof wdata === 'string') { try { wdata = JSON.parse(wdata); } catch(e) {} }
        wdata.sprinklers = newRows;
        wdata.sprinkler_rows = newRows;
        api.updateProject(project.id, { workspace_data: wdata }).catch(console.error);
      } catch(e) {}
    }
    dirtyStore.set(true);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, JSON.stringify(rows)]);
    const parsed = JSON.parse(previous);
    setRows(parsed);
    if (project?.id) localStorage.setItem(`mep_sprinklers_${project.id}`, previous);
    toast.info("Undo performed");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, JSON.stringify(rows)]);
    const parsed = JSON.parse(next);
    setRows(parsed);
    if (project?.id) localStorage.setItem(`mep_sprinklers_${project.id}`, next);
    toast.info("Redo performed");
  };

  // Load data when active project changes
  useEffect(() => {
    const key = `mep_sprinklers_${project?.id || "default"}`;
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRows(parsed);
          setUndoStack([]);
          setRedoStack([]);
          return;
        }
      } catch (e) {
        console.error("Failed to parse sprinklers data from localStorage", e);
      }
    } else {
      setRows(DEFAULT_ROWS);
      localStorage.setItem(key, JSON.stringify(DEFAULT_ROWS));
    }
    setUndoStack([]);
    setRedoStack([]);
  }, [project?.id]);

  const [highlightedSprinklerId, setHighlightedSprinklerId] = useState<string | null>(null);

  // Listen for comment scroll/highlight navigation from notifications
  useEffect(() => {
    const handleNotificationTarget = (targetId?: string | null, targetName?: string | null) => {
      if (!targetId && !targetName) return;

      // 1. Ensure schedule tab is active so DataGrid is mounted
      setTab("schedule");

      // 2. Clear any active filters that might hide the target sprinkler row
      setSearchQuery("");
      setFloorFilter("All");
      setHazardFilter("All");
      setKFilter("All");
      setFlagFilterOnly(false);

      // 3. Find and select the target row in state
      const cleanId = String(targetId || "").toLowerCase().trim();
      const cleanIdNorm = cleanId.replace(/[^a-z0-9]/g, "");
      const cleanTarget = String(targetName || "").toLowerCase().trim();
      const cleanTargetNorm = cleanTarget.replace(/[^a-z0-9]/g, "");

      const matched = rows.find(r => {
        const rId = String(r.id || "").toLowerCase().trim();
        const rIdNorm = rId.replace(/[^a-z0-9]/g, "");
        if (cleanId && (rId === cleanId || (cleanIdNorm && rIdNorm === cleanIdNorm))) return true;

        if (cleanTargetNorm) {
          const rLabel = String(r.label || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
          if (rLabel && (rLabel === cleanTargetNorm || rLabel.includes(cleanTargetNorm) || cleanTargetNorm.includes(rLabel))) return true;
          if (rIdNorm && (rIdNorm === cleanTargetNorm || rIdNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rIdNorm))) return true;
        }
        return false;
      });

      const finalId = matched ? matched.id : (cleanId || targetId || "");
      if (finalId) {
        setSelected(new Set([finalId]));
        setLastSelectedId(finalId);
        setHighlightedSprinklerId(finalId);
        setTimeout(() => setHighlightedSprinklerId(null), 5000);
      }

      // 4. Staggered trigger to guarantee DataGrid and DOM scroll & highlight
      const intervals = [50, 150, 300, 500, 800, 1200];
      intervals.forEach(delay => {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("mep-scroll-to-item", {
              detail: { id: finalId, name: matched?.label || targetName },
            })
          );
        }, delay);
      });
    };

    // Check URL query parameters
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("commentTargetId");
      const targetName = params.get("commentTargetName");
      if (targetId || targetName) {
        handleNotificationTarget(targetId, targetName);
      }
    }

    // Listen to mep-scroll-to-item window event
    const handleScrollEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string; name?: string; type?: string }>;
      if (!customEvent || !customEvent.detail) return;
      handleNotificationTarget(customEvent.detail.id, customEvent.detail.name);
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
    };
  }, [rows]);

  const handleUnitToggle = (newSystem: "si" | "ip") => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    
    // Convert rows in table
    setRows(prevRows => prevRows.map(row => {
      let k = row.kFactor;
      let p = row.pressure;
      let q = row.flow;
      let cov = row.coverage;
      
      if (newSystem === "si") {
        k = parseFloat((k * 14.28).toFixed(1));
        p = parseFloat((p / 14.5038).toFixed(2));
        q = parseFloat((q * 3.78541).toFixed(2));
        cov = parseFloat((cov / 10.7639).toFixed(1));
      } else {
        k = parseFloat((k / 14.28).toFixed(1));
        p = parseFloat((p * 14.5038).toFixed(2));
        q = parseFloat((q / 3.78541).toFixed(2));
        cov = parseFloat((cov * 10.7639).toFixed(1));
      }
      
      return {
        ...row,
        kFactor: k,
        pressure: p,
        flow: q,
        coverage: cov
      };
    }));

    // Convert Quick Solver states
    if (newSystem === "si") {
      setSolverK(prev => prev === "" ? "" : parseFloat((prev * 14.28).toFixed(1)));
      setSolverKnownVal(prev => {
        const numericPrev = prev === "" ? 0 : prev;
        if (solverSolveFor === "Q") {
          return parseFloat((numericPrev / 14.5038).toFixed(2));
        } else {
          return parseFloat((numericPrev * 3.78541).toFixed(2));
        }
      });
    } else {
      setSolverK(prev => prev === "" ? "" : parseFloat((prev / 14.28).toFixed(1)));
      setSolverKnownVal(prev => {
        const numericPrev = prev === "" ? 0 : prev;
        if (solverSolveFor === "Q") {
          return parseFloat((numericPrev * 14.5038).toFixed(2));
        } else {
          return parseFloat((numericPrev / 3.78541).toFixed(2));
        }
      });
    }
  };

  // Sync to localstorage
  useEffect(() => {
    const key = `mep_sprinklers_${project?.id || "default"}`;
    localStorage.setItem(key, JSON.stringify(rows));
    dirtyStore.set(true);
  }, [rows, project?.id]);

  // Keyboard shortcuts handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.getAttribute("contenteditable") === "true"
      );
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Selection: Ctrl + A
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (tab === "schedule") {
          setSelected(new Set(rows.map(r => r.id)));
        }
      }

      // History: Ctrl + Z / Ctrl + Y / Ctrl + Shift + Z
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        handleRedo();
      }

      // Add Row: Ctrl + N / Insert
      if ((isCmdOrCtrl && e.key.toLowerCase() === "n") || e.key === "Insert") {
        if (tab === "schedule") {
          e.preventDefault();
          addSprinkler();
        }
      }

      // Duplicate: Ctrl + D
      if (isCmdOrCtrl && e.key.toLowerCase() === "d" && tab === "schedule" && selected.size > 0) {
        e.preventDefault();
        duplicateSelected();
      }

      // Delete / Backspace key
      if ((e.key === "Delete" || e.key === "Backspace") && tab === "schedule" && selected.size > 0) {
        e.preventDefault();
        confirmDeleteSelected();
      }

      // Print / PDF: Ctrl + P
      if (isCmdOrCtrl && e.key.toLowerCase() === "p") {
        e.preventDefault();
        exportPdf();
      }

      // Escape key
      if (e.key === "Escape") {
        e.preventDefault();
        setSelected(new Set());
        setLastSelectedId(null);
      }

      // Clipboard: Copy (Ctrl + C)
      if (isCmdOrCtrl && e.key.toLowerCase() === "c" && tab === "schedule" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_sprinklers", JSON.stringify(toCopy));
        toast.info(`${toCopy.length} sprinkler(s) copied to clipboard`);
      }

      // Clipboard: Cut (Ctrl + X)
      if (isCmdOrCtrl && e.key.toLowerCase() === "x" && tab === "schedule" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_sprinklers", JSON.stringify(toCopy));
        pushToUndo(rows);
        setRows(prev => prev.filter(r => !selected.has(r.id)));
        setSelected(new Set());
        toast.info(`${toCopy.length} sprinkler(s) cut to clipboard`);
      }

      // Clipboard: Paste (Ctrl + V)
      if (isCmdOrCtrl && e.key.toLowerCase() === "v" && tab === "schedule") {
        e.preventDefault();
        try {
          const clipboardData = localStorage.getItem("mep_clipboard_sprinklers");
          if (clipboardData) {
            const parsed = JSON.parse(clipboardData) as SprinklerRow[];
            const pasted = parsed.map((item, idx) => ({
              ...item,
              id: `sprink_paste_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
              label: `${item.label} (Copy)`
            }));
            pushToUndo(rows);
            setRows(prev => [...prev, ...pasted]);
            toast.success(`${pasted.length} sprinkler(s) pasted`);
          }
        } catch (err) {
          console.error("Paste failed:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, tab, undoStack, redoStack, isApprovedLocked]);

  // Quick Solver Math
  const solverResult = useMemo(() => {
    const isSI = unitSystem === "si";
    const knownValNum = solverKnownVal === "" ? 0 : solverKnownVal;
    const kFactorNum = solverK === "" ? 0 : solverK;
    if (solverSolveFor === "Q") {
      const flow = kFactorNum * Math.sqrt(Math.max(0, knownValNum));
      return {
        val: parseFloat(flow.toFixed(2)),
        unit: isSI ? "L/min" : "GPM",
        label: "Discharge Flow (Q)",
        formula: `Q = K × √P = ${kFactorNum} × √${knownValNum} = ${flow.toFixed(2)} ${isSI ? "L/min" : "GPM"}`,
        pressure: knownValNum
      };
    } else {
      const press = Math.pow(Math.max(0, knownValNum) / (kFactorNum || 1), 2);
      return {
        val: parseFloat(press.toFixed(2)),
        unit: isSI ? "bar" : "psi",
        label: "Required Pressure (P)",
        formula: `P = (Q / K)² = (${knownValNum} / ${kFactorNum || 1})² = ${press.toFixed(2)} ${isSI ? "bar" : "psi"}`,
        pressure: press
      };
    }
  }, [solverK, solverSolveFor, solverKnownVal, unitSystem]);

  // SVG Chart points calculation
  const chartSvg = useMemo(() => {
    const isSI = unitSystem === "si";
    const xMax = isSI ? 7.0 : 100;
    const pts: [number, number][] = [];
    const kFactorNum = solverK === "" ? 0 : solverK;
    for (let p = 0; p <= xMax; p += xMax / 50) {
      pts.push([p, kFactorNum * Math.sqrt(p)]);
    }
    const markP = solverResult.pressure;
    const markQ = solverSolveFor === "Q" ? solverResult.val : (solverKnownVal === "" ? 0 : solverKnownVal);

    // SVG Drawing boundaries
    const W = 500;
    const H = 240;
    const PL = 50;
    const PR = 20;
    const PT = 30;
    const PB = 40;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const xMin = 0;
    const yMin = 0;
    const yMax = Math.max(...pts.map(p => p[1])) * 1.15 || 10;

    const sx = (v: number) => PL + (v - xMin) / (xMax - xMin) * CW;
    const sy = (v: number) => PT + CH - (v - yMin) / (yMax - yMin) * CH;

    const pathD = pts
      .map((p, i) => (i === 0 ? `M${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}` : `L${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`))
      .join(" ");

    const fillD = `${pathD} L${sx(xMax).toFixed(1)},${(PT + CH).toFixed(1)} L${PL},${(PT + CH).toFixed(1)} Z`;

    const markX = sx(markP);
    const markY = sy(markQ);

    return {
      W, H, PL, PR, PT, PB, CW, CH, sx, sy, pathD, fillD, markX, markY, markP, markQ, yMax, xMax
    };
  }, [solverK, solverResult, solverSolveFor, solverKnownVal, unitSystem]);

  const kDetails = useMemo(() => getKFactorDetail(solverK, unitSystem === "si"), [solverK, unitSystem]);

  // Aggregate stats from the grid
  const aggregateMetrics = useMemo(() => {
    let totalFlow = 0;
    let maxPressure = 0;
    let maxDens = 0.15;

    rows.forEach(r => {
      totalFlow += r.flow || 0;
      if (r.pressure > maxPressure) {
        maxPressure = r.pressure;
      }
      if (r.hazard.includes("Extra")) {
        maxDens = 0.30;
      } else if (r.hazard.includes("Ordinary Gp 2")) {
        maxDens = 0.20;
      }
    });

    // NFPA 13 hose allowance
    let hoseAllowance = unitSystem === "si" ? 946 : 250;
    if (maxPressure <= 0) {
      hoseAllowance = 0;
    } else if (maxDens <= 0.10) {
      hoseAllowance = unitSystem === "si" ? 378 : 100;
    } else if (maxDens <= 0.20) {
      hoseAllowance = unitSystem === "si" ? 946 : 250;
    } else {
      hoseAllowance = unitSystem === "si" ? 1893 : 500;
    }

    const systemDemand = totalFlow + hoseAllowance;

    return {
      totalFlow,
      maxPressure,
      hoseAllowance,
      systemDemand
    };
  }, [rows, unitSystem]);

  const reportBreakdowns = useMemo(() => {
    const kCounts: Record<string, number> = {};
    const hazardCounts: Record<string, number> = {};
    const totalRows = rows.length;

    rows.forEach(r => {
      const kKey = `K-${r.kFactor.toFixed(1)}`;
      kCounts[kKey] = (kCounts[kKey] || 0) + 1;
      hazardCounts[r.hazard] = (hazardCounts[r.hazard] || 0) + 1;
    });

    return {
      kCounts,
      hazardCounts,
      totalRows
    };
  }, [rows]);

  // Flag toggle helper
  const toggleFlag = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    pushToUndo(rows);
    setRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const nextFlag = !r.flagged;
        return {
          ...r,
          flagged: nextFlag,
          flagReason: nextFlag ? (r.flagReason || "Requires engineering review") : undefined
        };
      })
    );
  };

  // Grid editing helpers
  const updateRow = (id: string, field: keyof SprinklerRow, val: any) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit values.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(rows);
    setRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        let updated = { ...row, [field]: val };
        updated = computeRowOutputs(updated);
        return updated;
      })
    );
  };

  const addSprinkler = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to add sprinklers.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(rows);
    const newSprink: SprinklerRow = {
      id: `sprink_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      label: `Sprinkler ${rows.length + 1}`,
      kFactor: 5.6,
      solveFor: "Q",
      pressure: 15.0,
      flow: 21.69,
      coverage: 130,
      hazard: "Ordinary Hazard Gp 1",
      notes: ""
    };
    setRows(prev => [...prev, newSprink]);
    toast.success("New sprinkler added");
  };

  const duplicateSelected = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to duplicate sprinklers.", { id: "readonly-notice" });
      return;
    }
    if (selected.size === 0) return;
    pushToUndo(rows);
    const duplicated: SprinklerRow[] = [];
    rows.forEach(r => {
      if (selected.has(r.id)) {
        duplicated.push({
          ...r,
          id: `sprink_dup_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          label: `${r.label} (Clone)`
        });
      }
    });
    setRows(prev => [...prev, ...duplicated]);
    toast.success(`Duplicated ${duplicated.length} sprinkler(s)`);
  };

  const confirmDeleteSelected = async () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to delete sprinklers.", { id: "readonly-notice" });
      return;
    }
    const proceed = await confirm(`Are you sure you want to delete ${selected.size} selected sprinkler(s)?`);
    if (proceed) {
      pushToUndo(rows);
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
      toast.success("Selected sprinklers deleted");
    }
  };

  // Bulk Edit Handler
  const handleBulkEditSave = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit values.", { id: "readonly-notice" });
      return;
    }
    if (selected.size === 0) return;
    pushToUndo(rows);
    setRows(prev =>
      prev.map(r => {
        if (!selected.has(r.id)) return r;
        let next = { ...r };
        if (bulkEditData.hazard) next.hazard = bulkEditData.hazard;
        if (bulkEditData.kFactor !== undefined) next.kFactor = bulkEditData.kFactor;
        if (bulkEditData.solveFor) next.solveFor = bulkEditData.solveFor;
        if (bulkEditData.pressure !== undefined) next.pressure = bulkEditData.pressure;
        return computeRowOutputs(next);
      })
    );
    setBulkEditOpen(false);
    setBulkEditData({});
    toast.success(`Updated ${selected.size} selected sprinklers`);
  };

  // Grid context menu builder
    const renderFloorGroupHeader = (floor: string) => {
    const floorRows = filteredRows.filter((r) => (r.floor || "Ground Floor") === floor);
    return (
      <span className="flex items-center gap-1.5 font-medium">
        <span><strong className="font-bold text-primary">{floor}</strong></span>
        <span className="text-[10px] text-muted-foreground font-normal">({floorRows.length} heads) (Right-click to manage floor)</span>
      </span>
    );
  };

  const renderFloorGroupContextMenu = (floor: string) => {
    return (
      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={async () => {
            const newFloor = await prompt("Enter new floor / level name:", floor, { title: "Rename Floor / Level" });
            if (newFloor && newFloor.trim() !== "" && newFloor.trim() !== floor) {
              const trimmed = newFloor.trim();
              pushToUndo(rows);
              setRows(prev => prev.map(s => (s.floor || "Ground Floor") === floor ? { ...s, floor: trimmed } : s));
              toast.success(`Renamed floor to "${trimmed}"`);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Rename Floor</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />
        
        <ContextMenuItem
          onClick={async () => {
            const floorSpaces = rows.filter((s) => (s.floor || "Ground Floor") === floor);
            if (floorSpaces.length > 0) {
              if (await confirm(`Are you sure you want to delete all ${floorSpaces.length} sprinklers on "${floor}"?`)) {
                pushToUndo(rows);
                setRows(prev => prev.filter((s) => (s.floor || "Ground Floor") !== floor));
                setSelected(new Set());
                toast.success(`Deleted sprinklers on ${floor}`);
              }
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Floor Group</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const renderSprinklerContextMenu = (row: SprinklerRow) => {
    const targetIds = selected.has(row.id) ? Array.from(selected) : [row.id];
    const isMulti = targetIds.length > 1;

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => {
            setSelected(new Set([row.id]));
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-foreground"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Edit Sprinkler</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => {
            pushToUndo(rows);
            const dupList: SprinklerRow[] = [];
            rows.forEach(item => {
              if (targetIds.includes(item.id)) {
                dupList.push({
                  ...item,
                  id: `sprink_ctx_dup_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                  label: `${item.label} (Duplicate)`
                });
              }
            });
            setRows(prev => [...prev, ...dupList]);
            toast.success(`Duplicated ${dupList.length} sprinkler(s)`);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-foreground"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Duplicate Selected" : "Duplicate Sprinkler"}</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => {
            pushToUndo(rows);
            const anyUnflagged = targetIds.some(id => !rows.find(r => r.id === id)?.flagged);
            setRows(prev =>
              prev.map(item => {
                if (targetIds.includes(item.id)) {
                  return { ...item, flagged: anyUnflagged, flagReason: anyUnflagged ? "Flagged via menu" : undefined };
                }
                return item;
              })
            );
            toast.success(anyUnflagged ? `Flagged ${targetIds.length} item(s)` : `Unflagged ${targetIds.length} item(s)`);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-foreground"
        >
          <Flag className={`size-3.5 ${row.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          <span>{row.flagged ? (isMulti ? "Unflag Selected" : "Unflag Sprinkler") : (isMulti ? "Flag Selected" : "Flag for Review")}</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={() => handleOpenComment(row)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment / Assign Task</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={async () => {
            const proceed = await confirm(
              targetIds.length === 1
                ? `Are you sure you want to delete sprinkler "${row.label}"?`
                : `Are you sure you want to delete the ${targetIds.length} selected sprinklers?`
            );
            if (proceed) {
              pushToUndo(rows);
              setRows(prev => prev.filter(r => !targetIds.includes(r.id)));
              setSelected(new Set());
              toast.success("Deleted");
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
        >
          <Trash2 className="size-3.5" />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  // File import/export handling
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to import data.", { id: "readonly-notice" });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("No worksheet found");

      const imported: SprinklerRow[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;
        const label = String(row.getCell(2).value || `Sprinkler ${rowNumber - 1}`);
        const k = parseFloat(String(row.getCell(3).value)) || 5.6;
        const solve = String(row.getCell(4).value).toLowerCase().includes("p") ? "P" : "Q";
        const press = parseFloat(String(row.getCell(5).value)) || 15.0;
        const fl = parseFloat(String(row.getCell(6).value)) || 21.69;
        const cov = parseFloat(String(row.getCell(7).value)) || 130;
        const haz = String(row.getCell(8).value || "Ordinary Hazard Gp 1");

        let newRow: SprinklerRow = {
          id: `sprink_imp_${Date.now()}_${rowNumber}_${Math.floor(Math.random() * 1000)}`,
          label,
          kFactor: k,
          solveFor: solve,
          pressure: press,
          flow: fl,
          coverage: cov,
          hazard: haz,
          notes: ""
        };
        newRow = computeRowOutputs(newRow);
        imported.push(newRow);
      });

      if (imported.length > 0) {
        pushToUndo(rows);
        setRows(prev => [...prev, ...imported]);
        toast.success(`Imported ${imported.length} sprinklers from Excel`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse Excel file. Please ensure standard structure.");
    }
    e.target.value = "";
  };

  // Standardized Excel Export matching Ventilation / Preliminary theme
  const exportExcel = async () => {
    if (!rows || rows.length === 0) {
      toast.error("No sprinkler rows available to export.");
      return;
    }
    try {
      await exportSprinklerKFactorExcel(
        rows,
        {
          projectName: project?.name || "Sprinkler Hydraulic Calculation",
          client: project?.client || "Consistent Engineering Consultants",
          projectNo: project?.code || "SPRINKLER-01",
          date: project?.date || new Date().toISOString().split("T")[0],
          unitSystem: unitSystem,
          userName: currentUserName,
        },
        calcReviewState
      );
      toast.success("Sprinkler K-Factor Excel calculation exported successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to generate Excel report.");
    }
  };

  const exportPdf = () => {
    const exportRows: SprinklerExportRow[] = rows.map(r => ({
      id: r.id,
      floor: r.floor || "Ground Floor",
      label: r.label,
      kFactor: r.kFactor,
      solveFor: r.solveFor,
      pressure: r.pressure,
      flow: r.flow,
      coverage: r.coverage,
      hazard: r.hazard,
      notes: r.notes,
      flagged: r.flagged,
      flagReason: r.flagReason
    }));

    exportSprinklerKFactorPDF(
      exportRows,
      {
        projectName: project?.name || "Sprinkler Hydraulic Calculation",
        client: project?.client || "Consistent Engineering Consultants",
        projectNo: project?.code || "SPRINKLER-01",
        date: project?.date || new Date().toISOString().split("T")[0],
        unitSystem: unitSystem,
        userName: currentUserName,
      },
      calcReviewState
    );
  };

  // AI intelligence optimizations & audit checks
  const warningsList = useMemo(() => {
    const list: { id: string; rowId: string; type: "critical" | "warning"; title: string; desc: string; fixable: boolean; action?: () => void }[] = [];
    rows.forEach((r) => {
      // 1. Missing Data validation
      const missingCheck = checkIfSprinklerMissingData(r);
      if (missingCheck.isMissing) {
        list.push({
          id: `w_miss_${r.id}`,
          rowId: r.id,
          type: "critical",
          title: `Incomplete Data on "${r.label}"`,
          desc: missingCheck.reason || "Required hydraulic fields are missing or invalid.",
          fixable: false,
        });
      }

      // 2. Minimum operating pressure guard
      const minP = unitSystem === "si" ? 0.48 : 7.0;
      if (r.pressure < minP) {
        list.push({
          id: `w_press_${r.id}`,
          rowId: r.id,
          type: "critical",
          title: `Low Operating Pressure (${r.label})`,
          desc: `Calculated pressure is ${r.pressure.toFixed(2)} ${unitSystem === "si" ? "bar" : "psi"}, below NFPA 13 minimum (${minP} ${unitSystem === "si" ? "bar" : "psi"}).`,
          fixable: true,
          action: () => {
            saveRows(rows.map(item => item.id === r.id ? computeRowOutputs({ ...item, pressure: minP, solveFor: "Q" }) : item));
            toast.success(`Adjusted "${r.label}" pressure to ${minP} ${unitSystem === "si" ? "bar" : "psi"}`);
          }
        });
      }

      // 3. Over-coverage area check
      let limit = 130;
      if (r.hazard.startsWith("Light")) limit = 225;
      else if (r.hazard.startsWith("Extra")) limit = 100;
      const actualLimit = unitSystem === "si" ? parseFloat((limit / 10.7639).toFixed(1)) : limit;
      if (r.coverage > actualLimit) {
        list.push({
          id: `w_cov_${r.id}`,
          rowId: r.id,
          type: "warning",
          title: `Excess Coverage Area (${r.label})`,
          desc: `Coverage area is ${r.coverage} ${unitSystem === "si" ? "m²" : "ft²"}, exceeding NFPA limit of ${actualLimit} ${unitSystem === "si" ? "m²" : "ft²"} for ${r.hazard}.`,
          fixable: true,
          action: () => {
            saveRows(rows.map(item => item.id === r.id ? { ...item, coverage: actualLimit } : item));
            toast.success(`Adjusted coverage on "${r.label}" to ${actualLimit} ${unitSystem === "si" ? "m²" : "ft²"}`);
          }
        });
      }

      // 4. High operating pressure (> 35 psi / 2.41 bar) optimization check
      const maxP = unitSystem === "si" ? 2.41 : 35.0;
      if (r.pressure > maxP && r.kFactor < (unitSystem === "si" ? 160 : 11.2)) {
        const nextKIdx = STANDARD_K_FACTORS.indexOf(r.kFactor) + 1;
        const nextK = STANDARD_K_FACTORS[nextKIdx] || r.kFactor;
        const newP = Math.pow(r.flow / nextK, 2);
        list.push({
          id: `w_opt_${r.id}`,
          rowId: r.id,
          type: "warning",
          title: `High Pressure Optimizer (${r.label})`,
          desc: `Pressure is ${r.pressure.toFixed(1)} ${unitSystem === "si" ? "bar" : "psi"}. Upgrading to K-${nextK} lowers pressure to ${newP.toFixed(1)} ${unitSystem === "si" ? "bar" : "psi"}.`,
          fixable: true,
          action: () => {
            saveRows(rows.map(item => item.id === r.id ? computeRowOutputs({ ...item, kFactor: nextK, solveFor: "P" }) : item));
            toast.success(`Upgraded "${r.label}" to K-${nextK}`);
          }
        });
      }
    });
    return list;
  }, [rows, unitSystem]);

  // Jump to row in grid from Intelligence drawer
  const handleJumpToRow = (rowId: string) => {
    setTab("schedule");
    setSelected(new Set([rowId]));
    setLastSelectedId(rowId);
    toast.info("Selected targeted sprinkler head in schedule");
  };

  const handleFixAllPressures = () => {
    const minP = unitSystem === "si" ? 0.48 : 7.0;
    const updated = rows.map(r => {
      if (r.pressure < minP) {
        return computeRowOutputs({ ...r, pressure: minP, solveFor: "Q" });
      }
      return r;
    });
    saveRows(updated);
    toast.success(`All low pressures adjusted to NFPA 13 minimum (${minP} ${unitSystem === "si" ? "bar" : "psi"})`);
  };

  const handleOptimizeAllKFactors = () => {
    const maxP = unitSystem === "si" ? 2.41 : 35.0;
    let count = 0;
    const updated = rows.map(r => {
      if (r.pressure > maxP && r.kFactor < (unitSystem === "si" ? 160 : 11.2)) {
        const nextKIdx = STANDARD_K_FACTORS.indexOf(r.kFactor) + 1;
        const nextK = STANDARD_K_FACTORS[nextKIdx] || r.kFactor;
        count++;
        return computeRowOutputs({ ...r, kFactor: nextK, solveFor: "P" });
      }
      return r;
    });
    saveRows(updated);
    toast.success(`Optimized K-factors for ${count} sprinkler(s)`);
  };

  const handleFixAllOverCoverage = () => {
    let count = 0;
    const updated = rows.map(r => {
      let limit = 130;
      if (r.hazard.startsWith("Light")) limit = 225;
      else if (r.hazard.startsWith("Extra")) limit = 100;
      const actualLimit = unitSystem === "si" ? parseFloat((limit / 10.7639).toFixed(1)) : limit;
      if (r.coverage > actualLimit) {
        count++;
        return { ...r, coverage: actualLimit };
      }
      return r;
    });
    saveRows(updated);
    toast.success(`Aligned ${count} sprinkler head(s) to NFPA 13 maximum coverage limits`);
  };

  const handleFlagAllWarningRows = () => {
    const warningRowIds = new Set(warningsList.map(w => w.rowId));
    const updated = rows.map(r => warningRowIds.has(r.id) ? { ...r, flagged: true, flagReason: "Flagged by Intelligence Audit" } : r);
    saveRows(updated);
    toast.success(`Flagged ${warningRowIds.size} non-compliant head(s) for engineering review`);
  };

  const complianceScore = useMemo(() => {
    if (rows.length === 0) return 100;
    const criticalCount = warningsList.filter(w => w.type === "critical").length;
    return Math.max(0, Math.round(((rows.length - criticalCount) / rows.length) * 100));
  }, [rows.length, warningsList]);

  // Filter rows for grid display
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchHazard = hazardFilter === "All" || r.hazard === hazardFilter;
      const matchK = kFilter === "All" || r.kFactor === parseFloat(kFilter);
      const matchFlag = !flagFilterOnly || r.flagged;
      return matchSearch && matchHazard && matchK && matchFlag;
    });
  }, [rows, searchQuery, hazardFilter, kFilter, flagFilterOnly]);

  const flaggedCount = useMemo(() => rows.filter(r => r.flagged || checkIfSprinklerMissingData(r).isMissing).length, [rows]);

  // Inline inputs
  interface InlineInputProps {
    value: string | number;
    onCommit: (val: string) => void;
    className?: string;
    type?: "text" | "number";
    step?: string;
    min?: number;
    disabled?: boolean;
  }

  function InlineInput({ value, onCommit, className = "", type = "text", step, min, disabled = false }: InlineInputProps) {
    const [localVal, setLocalVal] = useState(String(value));

    useEffect(() => {
      setLocalVal(String(value));
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        setLocalVal(String(value));
        e.currentTarget.blur();
      }
    };

    return (
      <input
        type={type}
        step={step}
        min={min}
        disabled={disabled}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => {
          if (localVal !== String(value)) {
            onCommit(localVal);
          }
        }}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-foreground transition-all cursor-text disabled:opacity-40 outline-none ${className}`}
      />
    );
  }

  // Define Columns
  const columns = useMemo<Column<SprinklerRow>[]>(() => [
    {
      key: "label",
      header: "Sprinkler Label / Location",
      width: 210,
      render: (row) => {
        const isStandardList = unitSystem === "si" ? [40, 60, 80, 115, 160, 200, 242, 282, 320, 360, 400] : [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];
        const isCustom = row.hazard?.endsWith(" (Custom)") || String(row.label).endsWith(" (Custom)") || !isStandardList.some(k => Math.abs(k - row.kFactor) < 0.05);

        return (
          <div className="flex items-center gap-1.5 w-full">
            {Array.isArray(row.comments) && row.comments.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenComment(row);
                }}
                title={`${row.comments.length} comment(s)/task(s) assigned to "${row.label}"`}
                className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <MessageSquare className="size-3.5 fill-blue-100" />
                <span className="text-[10px] font-bold">{row.comments.length}</span>
              </button>
            )}
            <InlineInput
              value={row.label}
              onCommit={(val) => updateRow(row.id, "label", val)}
              className="text-[13px] font-medium"
            />
            {isCustom && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingSprinkler(row);
                }}
                title="Configure custom sprinkler parameters"
                className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
              >
                <Wrench className="size-3" />
              </button>
            )}
            {row.notes && (
              <span title={row.notes} className="text-muted-foreground hover:text-foreground cursor-help shrink-0">
                <MessageSquare className="size-3 text-primary/70" />
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: "kFactor",
      header: "K-Factor",
      width: 140,
      render: (row) => {
        const isStandardList = unitSystem === "si" ? [40, 60, 80, 115, 160, 200, 242, 282, 320, 360, 400] : [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];
        const isCustomK = !isStandardList.some(k => Math.abs(k - row.kFactor) < 0.05);

        return (
          <div className="flex items-center gap-1 w-full">
            <SprinklerKFactorSelect
              value={row.kFactor}
              unitSystem={unitSystem}
              onChange={(val) => updateRow(row.id, "kFactor", val)}
              onOpenCustomModal={() => setEditingSprinkler(row)}
              hideChevron={isCustomK}
            />
            {isCustomK && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingSprinkler(row);
                }}
                title="Configure custom parameters"
                className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
              >
                <Wrench className="size-3" />
              </button>
            )}
          </div>
        );
      }
    },
    {
      key: "solveFor",
      header: "Sizing Target",
      width: 100,
      render: (row) => (
        <select
          value={row.solveFor}
          onChange={(e) => updateRow(row.id, "solveFor", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-[13px] text-foreground font-medium transition-all outline-none cursor-pointer"
        >
          <option value="Q">Flow (Q)</option>
          <option value="P">Pressure (P)</option>
        </select>
      )
    },
    {
      key: "pressure",
      header: `Pressure (${unitSystem === "si" ? "bar" : "psi"})`,
      width: 100,
      render: (row) => {
        const isCalculated = row.solveFor === "P";
        return isCalculated ? (
          <span className="font-mono text-primary font-bold px-2">{row.pressure.toFixed(2)}</span>
        ) : (
          <InlineInput
            type="number"
            step={unitSystem === "si" ? "0.05" : "0.5"}
            min={0}
            value={row.pressure}
            onCommit={(val) => updateRow(row.id, "pressure", parseFloat(val) || 0)}
            className="font-mono text-[13px]"
          />
        );
      }
    },
    {
      key: "flow",
      header: `Flow Rate (${unitSystem === "si" ? "L/min" : "GPM"})`,
      width: 110,
      render: (row) => {
        const isCalculated = row.solveFor === "Q";
        return isCalculated ? (
          <span className="font-mono text-primary font-bold px-2">{row.flow.toFixed(1)}</span>
        ) : (
          <InlineInput
            type="number"
            step="1"
            min={0}
            value={row.flow}
            onCommit={(val) => updateRow(row.id, "flow", parseFloat(val) || 0)}
            className="font-mono text-[13px]"
          />
        );
      }
    },
    {
      key: "coverage",
      header: `Coverage (${unitSystem === "si" ? "m²" : "ft²"})`,
      width: 100,
      render: (row) => (
        <InlineInput
          type="number"
          min={0}
          value={row.coverage}
          onCommit={(val) => updateRow(row.id, "coverage", parseFloat(val) || 0)}
          className="font-mono text-[13px]"
        />
      )
    },
    {
      key: "hazard",
      header: "Hazard Classification",
      width: 190,
      render: (row) => {
        const standardHazards = ["Light Hazard", "Ordinary Hazard Gp 1", "Ordinary Hazard Gp 2", "Extra Hazard Gp 1", "Extra Hazard Gp 2", "Storage / ESFR"];
        const isCustomHazard = row.hazard?.endsWith(" (Custom)") || !standardHazards.includes(row.hazard);

        return (
          <div className="flex items-center gap-1 w-full">
            <SprinklerHazardSelect
              value={row.hazard}
              unitSystem={unitSystem}
              onChange={(val) => updateRow(row.id, "hazard", val)}
              onOpenCustomModal={() => setEditingSprinkler(row)}
              hideChevron={isCustomHazard}
            />
            {isCustomHazard && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingSprinkler(row);
                }}
                title="Configure custom parameters"
                className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
              >
                <Wrench className="size-3" />
              </button>
            )}
          </div>
        );
      }
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      render: (row) => {
        const isLowPressure = row.pressure < (unitSystem === "si" ? 0.48 : 7.0);
        const baseLimit = HAZARD_LIMITS[row.hazard] || 130;
        const limit = unitSystem === "si" ? parseFloat((baseLimit / 10.7639).toFixed(1)) : baseLimit;
        const isOverCoverage = row.coverage > limit;

        if (isLowPressure) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mr-1.5" />
              Low Press
            </span>
          );
        }
        if (isOverCoverage) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-warning/15 text-warning border border-warning/20 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 mr-1.5" />
              Over Area
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/10 text-success border border-success/20 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0 mr-1.5" />
            Complied
          </span>
        );
      }
    },
    {
      key: "flagged",
      header: "",
      width: 40,
      align: "center",
      render: (row) => {
        const check = checkIfSprinklerMissingData(row);
        const isFlagged = Boolean(row.flagged || check.isMissing);
        const tooltip = check.isMissing
          ? check.reason
          : (row.flagged ? "Flagged for engineering review (click to unflag)" : "Click to flag sprinkler");

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFlag(row.id, e);
            }}
            title={tooltip}
            className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
          >
            <Flag
              className={`size-3.5 transition-all duration-200 ${
                isFlagged
                  ? "fill-red-500 text-red-500 scale-110"
                  : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
              }`}
            />
          </button>
        );
      },
    },
  ], [rows, unitSystem, selected, toggleFlag, updateRow]);

  const toggleSelect = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isShift && lastSelectedId) {
        const lastIdx = filteredRows.findIndex(r => r.id === lastSelectedId);
        const currentIdx = filteredRows.findIndex(r => r.id === id);
        if (lastIdx !== -1 && currentIdx !== -1) {
          if (!isCtrl) {
            next.clear();
          }
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          for (let i = start; i <= end; i++) {
            next.add(filteredRows[i].id);
          }
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        if (!isCtrl && !isShift) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
  };

  const toggleSelectAll = () => {
    setSelected(prev => {
      if (prev.size === rows.length) {
        return new Set();
      } else {
        return new Set(rows.map(r => r.id));
      }
    });
  };

  const actions = (
    <div className="flex items-center gap-1.5">
      {undoStack.length > 0 && (
        <button
          onClick={handleUndo}
          title="Undo (Ctrl+Z)"
          className="size-7 grid place-items-center rounded-xl border border-border bg-background hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Undo className="size-3.5" />
        </button>
      )}
      {redoStack.length > 0 && (
        <button
          onClick={handleRedo}
          title="Redo (Ctrl+Y)"
          className="size-7 grid place-items-center rounded-xl border border-border bg-background hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Redo className="size-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <AppShell 
      title="Sprinkler K-Factor"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">FIRE FIGHTING &gt; SPRINKLER K-FACTOR</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sprinkler K-Factor</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} heads</span>
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
                  projectId={project?.id || "default"}
                  calculatorPath="/plumbing-sprinkler-kfactor"
                  calculatorTitle="Sprinkler K-Factor"
                  onReviewStateChange={setCalcReviewState}
                />
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                NFPA 13 sprinkler discharge, operating pressure, and water demand calculation schedule.
              </p>
            </div>
            
            {/* Actions / Export buttons on the right */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex rounded-full border border-border p-0.5 bg-surface-2 shrink-0">
                <button
                  onClick={() => handleUnitToggle("si")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "si" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  SI
                </button>
                <button
                  onClick={() => handleUnitToggle("ip")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "ip" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  IP
                </button>
              </div>
              {actions}
            </div>
          </div>

          

          {/* White card container for Tabs & Data Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setTab("schedule")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "schedule"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sprinkler Schedule
                </button>
                <button
                  onClick={() => setTab("solver")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "solver"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Quick Solver
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
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {/* Quick Solver Tab */}
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                  <div className="w-full flex flex-col gap-6">
                    {/* Overview box */}
                    <div className="flex gap-3.5 p-4 bg-background border border-border rounded-3xl shadow-xs transition-all hover:border-primary/30">
                    <Info className="size-4.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[13.5px] font-bold text-foreground">Sprinkler Sizing Equation</h4>
                      <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                        Calculate discharge flow rate based on nozzle pressure and standard K-factor coefficient (Q = K × √P), or determine required operating pressure to deliver target fire load.
                      </p>
                    </div>
                  </div>

                  {/* Sizing inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3 transition-all hover:border-primary/30">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sizing Variable</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSolverSolveFor("Q");
                            setSolverKnownVal(30.0);
                          }}
                          className={`flex-1 py-2 px-4 rounded-xl text-[13px] font-bold border text-center transition-all cursor-pointer shadow-xs ${
                            solverSolveFor === "Q"
                              ? "bg-primary text-primary-foreground border-primary shadow-primary/10 font-bold"
                              : "border-border hover:bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          Solve Flow (Q)
                        </button>
                        <button
                          onClick={() => {
                            setSolverSolveFor("P");
                            setSolverKnownVal(20.0);
                          }}
                          className={`flex-1 py-2 px-4 rounded-xl text-[13px] font-bold border text-center transition-all cursor-pointer shadow-xs ${
                            solverSolveFor === "P"
                              ? "bg-primary text-primary-foreground border-primary shadow-primary/10 font-bold"
                              : "border-border hover:bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          Solve Pressure (P)
                        </button>
                      </div>
                    </div>
                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3 transition-all hover:border-primary/30">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">K-Factor Coefficient</label>
                      <div className="flex gap-2">
                        <select
                          value={isCustomK ? "custom" : solverK}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setIsCustomK(true);
                            } else {
                              setIsCustomK(false);
                              setSolverK(parseFloat(e.target.value));
                            }
                          }}
                          className="flex-1 h-10 px-3 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl bg-background text-[13px] outline-none font-bold cursor-pointer transition-all shadow-sm"
                        >
                          {unitSystem === "si" ? (
                            <>
                              <option value="40.0">K-40.0 - Residential</option>
                              <option value="60.0">K-60.0 - Small Orifice</option>
                              <option value="80.0">K-80.0 - Standard Spray</option>
                              <option value="115.0">K-115.0 - Large Orifice</option>
                              <option value="160.0">K-160.0 - ESFR / Storage</option>
                              <option value="200.0">K-200.0 - Early Suppression</option>
                              <option value="242.0">K-242.0 - Ultra Large</option>
                              <option value="282.0">K-282.0 - Heavy Storage</option>
                              <option value="320.0">K-320.0 - High Flow</option>
                              <option value="360.0">K-360.0 - Deluge System</option>
                              <option value="400.0">K-400.0 - High Density Deluge</option>
                            </>
                          ) : (
                            <>
                              <option value="2.8">K-2.8 - Residential</option>
                              <option value="4.2">K-4.2 - Small Orifice</option>
                              <option value="5.6">K-5.6 - Standard Spray</option>
                              <option value="8.0">K-8.0 - Large Orifice</option>
                              <option value="11.2">K-11.2 - ESFR / Storage</option>
                              <option value="14.0">K-14.0 - Early Suppression</option>
                              <option value="16.8">K-16.8 - Ultra Large</option>
                              <option value="19.6">K-19.6 - Heavy Storage</option>
                              <option value="22.4">K-22.4 - High Flow</option>
                              <option value="25.2">K-25.2 - Deluge System</option>
                              <option value="28.0">K-28.0 - High Density Deluge</option>
                            </>
                          )}
                          <option value="custom">Custom K-Factor...</option>
                        </select>
                        {isCustomK && (
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={solverK}
                            onChange={(e) => setSolverK(e.target.value === "" ? "" : parseFloat(e.target.value) || 5.6)}
                            className="w-24 h-10 px-3 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl bg-background text-[13px] font-mono font-bold outline-none shadow-sm"
                            placeholder="e.g. 5.8"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Input Parameter Card */}
                  <div className="border border-border rounded-3xl p-5 bg-background shadow-sm flex flex-col gap-3.5 transition-all hover:border-primary/30">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {solverSolveFor === "Q" ? "Known Operating Pressure" : "Known Discharge Flow"}
                      </label>
                      <div className="relative flex items-center mt-1 select-none">
                        <input
                          type="number"
                          value={solverKnownVal}
                          step={solverSolveFor === "Q" ? (unitSystem === "si" ? "0.05" : "0.5") : "1"}
                          min={0}
                          onChange={(e) => setSolverKnownVal(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                          className="w-full h-11 pl-4 pr-20 bg-surface-2 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl text-lg font-bold font-mono outline-none text-foreground transition-all focus:bg-background"
                          placeholder="Enter value..."
                        />
                        <div className="absolute right-3 px-2.5 py-1 bg-background border border-border rounded-xl text-[11px] font-bold font-mono text-muted-foreground uppercase shadow-xs">
                          {solverSolveFor === "Q" ? (unitSystem === "si" ? "bar" : "psi") : (unitSystem === "si" ? "L/min" : "GPM")}
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-normal mt-1.5">
                        {solverSolveFor === "Q" 
                          ? `Specify sprinkler operating pressure. NFPA 13 requires a minimum of ${unitSystem === "si" ? "0.48 bar" : "7.0 psi"}.`
                          : "Specify sprinkler discharge flow rate."
                        }
                      </p>
                    </div>
                  </div>

                  {/* Quick Results Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-3xl p-5 bg-gradient-to-br from-background to-surface-2 shadow-sm flex flex-col justify-between min-h-[140px] transition-all hover:border-primary/30">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Calculated Variable</span>
                        <div className="flex items-baseline mt-2 gap-1.5">
                          <span className="text-[36px] font-extrabold tracking-tight font-mono text-primary leading-none">
                            {solverResult.val}
                          </span>
                          <span className="text-[14px] font-bold text-muted-foreground uppercase">{solverResult.unit}</span>
                        </div>
                      </div>
                      <div className="border-t border-border pt-3 mt-4 text-[12px] font-mono text-muted-foreground">
                        {solverResult.label}
                      </div>
                    </div>

                    <div className="border border-border rounded-3xl p-5 bg-gradient-to-br from-background to-surface-2 shadow-sm flex flex-col justify-between min-h-[140px] transition-all hover:border-primary/30">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sizing Formula</span>
                        <div className="text-[16px] font-bold text-foreground font-mono mt-3 leading-relaxed">
                          {solverResult.formula}
                        </div>
                      </div>
                      <div className="border-t border-border pt-3 mt-4 text-[12px] text-muted-foreground flex justify-between">
                        <span>Standard K: <span className="font-semibold">{solverK}</span></span>
                        <span>Unit System: <span className="font-semibold">{unitSystem === "si" ? "SI" : "IP"}</span></span>
                      </div>
                    </div>
                  </div>

                  {/* NFPA compliance checks */}
                  {solverResult.pressure < (unitSystem === "si" ? 0.48 : 7.0) && (
                    <div className="border border-destructive/25 bg-destructive/5 text-destructive rounded-3xl p-4 flex gap-3 items-start shadow-xs">
                      <AlertTriangle className="size-4.5 shrink-0 mt-0.5 text-destructive animate-pulse" />
                      <div>
                        <h4 className="text-[13px] font-bold text-destructive">NFPA 13 Code Violation</h4>
                        <p className="text-[12px] text-destructive/80 mt-1 leading-relaxed">
                          Pressure ({solverResult.pressure.toFixed(2)} {unitSystem === "si" ? "bar" : "psi"}) is below the minimum required {unitSystem === "si" ? "0.48 bar" : "7.0 psi"} limit. The sprinkler spray pattern will not disperse adequately to suppress fires. Increase K-factor or pressure.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sprinkler Schedule Tab */}
            {tab === "schedule" && (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="relative flex items-center justify-between border-b border-border px-4 py-2.5 bg-background select-none shrink-0 gap-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        placeholder="Search sprinklers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 w-48 pl-8 pr-7 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl text-[12.5px] bg-background outline-none transition-all"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Floor Filter */}
                    <select
                      value={floorFilter}
                      onChange={(e) => setFloorFilter(e.target.value)}
                      className="h-8 px-3 border border-border focus:border-primary rounded-xl text-[12.5px] bg-background text-foreground outline-none cursor-pointer font-medium transition-all shadow-xs"
                    >
                      <option value="All">All Floors</option>
                      {allUniqueFloors.map((fl) => (
                        <option key={fl} value={fl}>
                          {fl}
                        </option>
                      ))}
                    </select>

                    {/* Hazard Category Filter */}
                    <select
                      value={hazardFilter}
                      onChange={(e) => setHazardFilter(e.target.value)}
                      className="h-8 px-3 border border-border focus:border-primary rounded-xl text-[12.5px] bg-background text-foreground outline-none cursor-pointer font-medium transition-all shadow-xs"
                    >
                      <option value="All">All Hazards</option>
                      <option value="Light Hazard">Light Hazard</option>
                      <option value="Ordinary Hazard Gp 1">Ordinary Gp 1</option>
                      <option value="Ordinary Hazard Gp 2">Ordinary Gp 2</option>
                      <option value="Extra Hazard Gp 1">Extra Gp 1</option>
                      <option value="Extra Hazard Gp 2">Extra Gp 2</option>
                    </select>

                    {/* K-factor Filter */}
                    <select
                      value={kFilter}
                      onChange={(e) => setKFilter(e.target.value)}
                      className="h-8 px-3 border border-border focus:border-primary rounded-xl text-[12.5px] bg-background text-foreground outline-none cursor-pointer font-medium transition-all shadow-xs"
                    >
                      <option value="All">All K-Factors</option>
                      {STANDARD_K_FACTORS.map(k => (
                        <option key={k} value={k}>K-{k.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ml-auto flex items-center gap-1">
                    <TBtn disabled={isApprovedLocked} onClick={handleImportClick}><Download className="size-3.5" /> Import</TBtn>
                    <TBtn onClick={exportPdf}><FileText className="size-3.5" /> Export</TBtn>
                    <TBtn primary onClick={addSprinkler} disabled={isApprovedLocked} title={isApprovedLocked ? "Calculation is Approved & Locked. Unlock to add sprinklers." : "Add Sprinkler"}><Plus className="size-3.5" /> Add Sprinkler</TBtn>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImportFile}
                      style={{ display: "none" }}
                      accept=".xlsx,.xls,.csv"
                    />
                  </div>

                  {/* Bulk actions bar overlay matching Ventilation and Preliminary */}
                  {selected.size > 0 && (
                    <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                      <span className="font-semibold">{selected.size} selected</span>
                      <span className="text-primary/30">·</span>
                      <BulkBtn icon={Edit3} onClick={() => setBulkEditOpen(true)}>Bulk edit</BulkBtn>
                      <BulkBtn icon={Flag} onClick={() => {
                        pushToUndo(rows);
                        const targetIds = Array.from(selected);
                        const anyUnflagged = targetIds.some(id => !rows.find(r => r.id === id)?.flagged);
                        setRows(prev => prev.map(r => targetIds.includes(r.id) ? { ...r, flagged: anyUnflagged, flagReason: anyUnflagged ? "Bulk Flagged" : undefined } : r));
                        toast.success(anyUnflagged ? `Flagged ${targetIds.length} sprinklers` : `Unflagged ${targetIds.length} sprinklers`);
                      }}>Flag / Unflag</BulkBtn>
                      <BulkBtn icon={Copy} onClick={duplicateSelected}>Duplicate</BulkBtn>
                      <BulkBtn icon={Trash2} onClick={confirmDeleteSelected}>Delete</BulkBtn>
                      <button
                        onClick={() => setSelected(new Set())}
                        className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                      >
                        <X className="size-3" /> Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* DataGrid Area */}
                <div className="flex-1 min-h-0 bg-background overflow-hidden relative flex flex-col">
                  {filteredRows.length > 0 ? (
                    <DataGrid
                      rows={filteredRows}
                      columns={columns}
                      selected={selected}
                      onToggle={toggleSelect}
                      onToggleAll={toggleSelectAll}
                      renderContextMenu={renderSprinklerContextMenu}
                      groupBy={(r) => r.floor || "Ground Floor"}
                      groupOrder={allUniqueFloors}
                      renderGroupHeader={renderFloorGroupHeader}
                      renderGroupContextMenu={renderFloorGroupContextMenu}
                      activeRowId={highlightedSprinklerId || undefined}
                      rowClassName={(row, index) =>
                        highlightedSprinklerId === row.id
                          ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/25 font-bold shadow-lg"
                          : index % 2 === 0
                          ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebee] dark:hover:bg-[#25252b]"
                          : "bg-card hover:bg-[#ebebee] dark:hover:bg-[#25252b]"
                      }
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                      <HelpCircle className="size-8 text-muted-foreground/50" />
                      <span className="text-[13px]">No sprinklers match the current filter.</span>
                    </div>
                  )}
                  
                  {/* Clean Footer Bar */}
                  <div className="flex items-center justify-between px-4 h-9 border-t border-border bg-header-bg text-[11.5px] text-muted-foreground shrink-0 select-none font-medium">
                    <div>
                      Showing <span className="text-foreground font-bold tabular">{filteredRows.length}</span> of {rows.length} sprinklers
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground tabular">
                      <span>Total Flow: <span className="font-mono text-primary font-bold">{aggregateMetrics.totalFlow.toFixed(1)} {unitSystem === "si" ? "L/min" : "GPM"}</span></span>
                      <span>Max Pressure: <span className="font-mono text-foreground font-bold">{aggregateMetrics.maxPressure.toFixed(1)} {unitSystem === "si" ? "bar" : "psi"}</span></span>
                      <span>System Demand: <span className="font-mono text-red-500 font-bold">{aggregateMetrics.systemDemand.toFixed(1)} {unitSystem === "si" ? "L/min" : "GPM"}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {tab === "report" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6 w-full">
                {/* Toolbar */}
                <div className="flex justify-between items-center pb-4 border-b border-border">
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground">Sizing Report Summary</h3>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5">Review system compliance and download reports.</p>
                  </div>
                  <div className="flex items-center gap-1 no-print print:hidden">
                    <TBtn onClick={exportPdf}><FileText className="size-3.5" /> Export</TBtn>
                    <TBtn onClick={() => window.print()}><Printer className="size-3.5" /> Print Report</TBtn>
                  </div>
                </div>

                {/* Aggregate Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                      <Search className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Sprinklers Sized</span>
                      <div className="text-[20px] font-extrabold font-mono text-foreground mt-0.5">{rows.length} heads</div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">Active nodes in project</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                      <Activity className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Max Node Pressure</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {aggregateMetrics.maxPressure.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">{unitSystem === "si" ? "bar" : "psi"}</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">Highest node pressure</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-sky-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Droplet className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Sprinkler Discharge</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {aggregateMetrics.totalFlow.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">{unitSystem === "si" ? "L/min" : "GPM"}</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">Sum of sprinkler flows</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <Settings className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Water Demand</span>
                      <div className="text-[20px] font-extrabold font-mono text-red-500 mt-0.5">
                        {aggregateMetrics.systemDemand.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">{unitSystem === "si" ? "L/min" : "GPM"}</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">With hose stream allowance</span>
                    </div>
                  </div>
                </div>

                {/* Two Column Layout: Table (left) and Breakdowns + Audit (right) */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  
                  {/* Left Column: Sizing Grid Preview Table */}
                  <div className="flex-1 min-w-0 w-full border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-2/15 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-foreground">Sprinkler Sizing Grid Preview</span>
                      <span className="text-[11px] text-muted-foreground font-mono">{rows.length} Sized Nodes</span>
                    </div>
                    <div className="overflow-x-auto w-full">
                      <table className="w-full border-collapse text-[12.5px] text-left">
                        <thead>
                          <tr className="border-b border-border bg-surface/50 font-bold text-muted-foreground text-[11px] uppercase tracking-wider">
                            <th className="p-3 w-16 text-center">S.No</th>
                            <th className="p-3">Label / Location</th>
                            <th className="p-3">K-Factor</th>
                            <th className="p-3">Sizing Mode</th>
                            <th className="p-3 text-right">Pressure ({unitSystem === "si" ? "bar" : "psi"})</th>
                            <th className="p-3 text-right">Flow ({unitSystem === "si" ? "L/min" : "GPM"})</th>
                            <th className="p-3 text-right">Coverage ({unitSystem === "si" ? "m²" : "ft²"})</th>
                            <th className="p-3">Hazard</th>
                            <th className="p-3 w-28 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium text-foreground">
                          {rows.map((r, idx) => {
                            const isLowPressure = r.pressure < (unitSystem === "si" ? 0.48 : 7.0);
                            const baseLimit = HAZARD_LIMITS[r.hazard] || 130;
                            const limit = unitSystem === "si" ? parseFloat((baseLimit / 10.7639).toFixed(1)) : baseLimit;
                            const isOverCoverage = r.coverage > limit;

                            return (
                              <tr key={r.id} className="hover:bg-surface/30 transition-colors">
                                <td className="p-3 text-muted-foreground text-center font-mono">{idx + 1}</td>
                                <td className="p-3 text-foreground font-semibold">{r.label}</td>
                                <td className="p-3 font-mono">K-{r.kFactor.toFixed(1)}</td>
                                <td className="p-3">
                                  <span className="px-1.5 py-0.5 rounded-xl text-[11px] font-bold bg-muted text-muted-foreground">
                                    {r.solveFor === "Q" ? "Flow (Q)" : "Pressure (P)"}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-foreground">{r.pressure.toFixed(2)}</td>
                                <td className="p-3 text-right font-mono font-bold text-foreground">{r.flow.toFixed(2)}</td>
                                <td className="p-3 text-right font-mono text-muted-foreground">{r.coverage}</td>
                                <td className="p-3 text-muted-foreground text-[12px]">{r.hazard}</td>
                                <td className="p-3 text-center">
                                  {isLowPressure ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wide">
                                      <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mr-1.5" />
                                      Low Press
                                    </span>
                                  ) : isOverCoverage ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold bg-warning/15 text-warning border border-warning/20 uppercase tracking-wide">
                                      <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 mr-1.5" />
                                      Over Area
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold bg-success/10 text-success border border-success/20 uppercase tracking-wide">
                                      <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0 mr-1.5" />
                                      Complied
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Audits & Breakdowns */}
                  <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-4">
                    
                    {/* Compliance Auditor Card */}
                    {(() => {
                      const hasErrors = rows.some(r => r.pressure < (unitSystem === "si" ? 0.48 : 7.0));
                      return hasErrors ? (
                        <div className="border border-destructive/20 bg-destructive/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                          <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <h4 className="text-[13px] font-bold text-destructive">NFPA 13 Warnings</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                              Hydraulic violations detected in layout grid. Sized pressures must exceed the code limit of {unitSystem === "si" ? "0.48 bar" : "7.0 psi"}.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-success/20 bg-success/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                          <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[13px] font-bold text-success">NFPA 13 Sizing Audit</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                              System demand fully complies. All node calculations are within NFPA 13 pressure and coverage limits.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Classification breakdown card */}
                    <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-4">
                      <p className="text-[13px] font-bold text-foreground leading-snug">Design Classification</p>
                      
                      <div className="flex flex-col gap-3.5">
                        {Object.entries(reportBreakdowns.hazardCounts).map(([hazardName, count]) => {
                          const percentage = reportBreakdowns.totalRows > 0 ? (count / reportBreakdowns.totalRows) * 100 : 0;
                          return (
                            <div key={hazardName} className="flex flex-col gap-1.5 text-[12px]">
                              <div className="flex justify-between font-medium">
                                <span className="text-muted-foreground truncate pr-2">{hazardName}</span>
                                <span className="text-foreground font-mono font-bold">{count} ({percentage.toFixed(0)}%)</span>
                              </div>
                              <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* K-factor breakdown card */}
                    <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-4">
                      <p className="text-[13px] font-bold text-foreground leading-snug">Orifice / K-Factor Ratios</p>
                      
                      <div className="flex flex-col gap-3.5">
                        {Object.entries(reportBreakdowns.kCounts).map(([kValue, count]) => {
                          const percentage = reportBreakdowns.totalRows > 0 ? (count / reportBreakdowns.totalRows) * 100 : 0;
                          return (
                            <div key={kValue} className="flex flex-col gap-1.5 text-[12px]">
                              <div className="flex justify-between font-medium">
                                <span className="text-muted-foreground truncate">{kValue} Coefficient</span>
                                <span className="text-foreground font-mono font-bold">{count} ({percentage.toFixed(0)}%)</span>
                              </div>
                              <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/80 rounded-full" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Intelligence Side Drawer */}
        <div
          className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-out select-none no-print print:hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <div className="w-[360px] h-full flex flex-col min-h-0 bg-background font-sans">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-header-bg shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4.5 text-primary" />
                  <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">NFPA 13 Live Intelligence</h3>
                </div>
                <button onClick={() => setIntelOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-surface-2">
                  <X className="size-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {/* Hydraulic Compliance Scorecard */}
                <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Compliance Score</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      complianceScore === 100 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}>
                      {complianceScore === 100 ? "NFPA 13 Compliant" : `${warningsList.length} Action(s) Needed`}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-[28px] font-extrabold font-mono text-foreground leading-none">
                      {complianceScore}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            complianceScore === 100 ? "bg-emerald-500" : complianceScore >= 70 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${complianceScore}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10.5px] text-muted-foreground mt-1.5 font-medium">
                        <span>{rows.length} Total Heads</span>
                        <span>{rows.length - warningsList.filter(w => w.type === 'critical').length} Compliant</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Quick Optimizers */}
                <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[12.5px] font-bold text-foreground">AI Quick Optimizers</h4>
                    <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider">1-Click Actions</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                    Batch-optimize hydraulic flow, pressure limits, and spacing constraints across the active schedule.
                  </p>
                  
                  <div className="flex flex-col gap-2 mt-1">
                    <button
                      onClick={handleFixAllPressures}
                      className="w-full py-2 px-3 rounded-xl text-[11.5px] font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs"
                    >
                      <span>⚡ Fix All Low Pressures (&lt; 7.0 psi)</span>
                      <span className="text-[10px] font-mono text-primary/70">Auto-solve</span>
                    </button>

                    <button
                      onClick={handleOptimizeAllKFactors}
                      className="w-full py-2 px-3 rounded-xl text-[11.5px] font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs"
                    >
                      <span>🔄 Optimize High Pressure Heads (&gt; 35 psi)</span>
                      <span className="text-[10px] font-mono text-primary/70">Resize K</span>
                    </button>

                    <button
                      onClick={handleFixAllOverCoverage}
                      className="w-full py-2 px-3 rounded-xl text-[11.5px] font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs"
                    >
                      <span>📐 Auto-Align Hazard Area Limits</span>
                      <span className="text-[10px] font-mono text-primary/70">NFPA Spacing</span>
                    </button>

                    {warningsList.length > 0 && (
                      <button
                        onClick={handleFlagAllWarningRows}
                        className="w-full py-2 px-3 rounded-xl text-[11.5px] font-bold border border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 text-left transition-all cursor-pointer flex items-center justify-between shadow-2xs"
                      >
                        <span>🚩 Flag All Non-Compliant Heads</span>
                        <span className="text-[10px] font-mono opacity-80">{warningsList.length} items</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Dynamic Warnings Checklist with Clickable Jump Links */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Warnings & Fixes</span>
                    <span className="text-[10.5px] font-mono font-bold text-muted-foreground">{warningsList.length} item(s)</span>
                  </div>

                  {warningsList.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {warningsList.map((warn, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-2xl border text-[12px] flex flex-col gap-2 shadow-xs transition-all ${
                            warn.type === "critical"
                              ? "border-destructive/20 bg-destructive/5 text-foreground"
                              : "border-warning/20 bg-warning/5 text-foreground"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle className={`size-4 shrink-0 mt-0.5 ${warn.type === "critical" ? "text-destructive" : "text-warning"}`} />
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => handleJumpToRow(warn.rowId)}
                                className="font-bold text-left hover:text-primary hover:underline cursor-pointer block truncate w-full"
                                title="Click to select this sprinkler head in the schedule"
                              >
                                {warn.title}
                              </button>
                              <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">
                                {warn.desc}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-1">
                            <button
                              onClick={() => handleJumpToRow(warn.rowId)}
                              className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <span>👉 Jump to row</span>
                            </button>

                            {warn.fixable && warn.action && (
                              <button
                                onClick={warn.action}
                                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 px-2 py-0.5 rounded-lg"
                              >
                                <RefreshCw className="size-3" /> Auto-Fix
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-border/80 rounded-3xl p-5 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-8 bg-surface-2/10">
                      <CheckCircle2 className="size-9 text-emerald-500" />
                      <span className="text-[13px] font-bold text-foreground">Sizing Complies with NFPA 13!</span>
                      <span className="text-[11.5px] text-muted-foreground max-w-[240px]">All operating pressures, flow rates, and hazard coverage areas are within standard limits.</span>
                    </div>
                  )}
                </div>

                {/* Design Formulas & NFPA 13 Guidelines */}
                <div className="border border-border rounded-3xl p-3.5 bg-background shadow-xs flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-foreground">Hydraulic Formulas & Guidelines</h4>
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                    Standard NFPA 13 formulas calculate discharge and required node pressures:
                  </p>
                  <ul className="text-[11px] text-muted-foreground list-disc pl-4 flex flex-col gap-1 font-mono bg-surface-2/30 p-2.5 rounded-xl border border-border/50">
                    <li>Discharge: <strong>Q = K × √P</strong></li>
                    <li>Node Pressure: <strong>P = (Q / K)²</strong></li>
                    <li>Min Standard Pressure: <strong>7.0 psi (0.48 bar)</strong></li>
                    <li>Max Light Hazard Coverage: <strong>225 ft² (20.9 m²)</strong></li>
                    <li>Max Ordinary Hazard Coverage: <strong>130 ft² (12.1 m²)</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Sprinkler Parameter Modal */}
      {editingSprinkler && (
        <EditSprinklerCustomModal
          sprinkler={editingSprinkler}
          unitSystem={unitSystem}
          onClose={() => setEditingSprinkler(null)}
          onSave={(updated) => {
            pushToUndo(rows);
            setRows((prev) => prev.map((r) => (r.id === updated.id ? computeRowOutputs(updated) : r)));
          }}
        />
      )}

      {/* Bulk Edit Modal */}
      {bulkEditOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Edit3 className="size-4 text-primary" />
                <h3 className="text-[15px] font-bold text-foreground">Bulk Edit ({selected.size} Sprinklers)</h3>
              </div>
              <button onClick={() => setBulkEditOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-[13px]">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Hazard Classification</label>
                <select
                  value={bulkEditData.hazard || ""}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, hazard: e.target.value || undefined }))}
                  className="w-full h-10 px-3 border border-border rounded-xl bg-surface-2 text-foreground font-medium outline-none"
                >
                  <option value="">(Keep Existing)</option>
                  <option value="Light Hazard">Light Hazard</option>
                  <option value="Ordinary Hazard Gp 1">Ordinary Gp 1</option>
                  <option value="Ordinary Hazard Gp 2">Ordinary Gp 2</option>
                  <option value="Extra Hazard Gp 1">Extra Gp 1</option>
                  <option value="Extra Hazard Gp 2">Extra Gp 2</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">K-Factor</label>
                <select
                  value={bulkEditData.kFactor !== undefined ? String(bulkEditData.kFactor) : ""}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, kFactor: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="w-full h-10 px-3 border border-border rounded-xl bg-surface-2 text-foreground font-medium outline-none"
                >
                  <option value="">(Keep Existing)</option>
                  {STANDARD_K_FACTORS.map(k => (
                    <option key={k} value={k}>K-{k.toFixed(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Operating Pressure ({unitSystem === "si" ? "bar" : "psi"})</label>
                <input
                  type="number"
                  placeholder="(Keep Existing)"
                  value={bulkEditData.pressure !== undefined ? bulkEditData.pressure : ""}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, pressure: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="w-full h-10 px-3 border border-border rounded-xl bg-surface-2 text-foreground font-medium outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
              <button
                onClick={() => setBulkEditOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-surface-2 text-muted-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEditSave}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Comment & Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="Sprinkler Head"
          calculatorTitle="Sprinkler K-Factor"
          calculatorPath="/plumbing-sprinkler-kfactor"
          existingComments={rows.find(r => r.id === commentTargetItem.id)?.comments || []}
          onSave={(comment) => {
            const updatedRows = rows.map(r => r.id === commentTargetItem.id ? {
              ...r,
              comments: [...(r.comments || []), comment]
            } : r);
            saveRows(updatedRows);
            if (project?.id) {
              localStorage.setItem(`mep_sprinklers_${project.id}`, JSON.stringify(updatedRows));
              localStorage.setItem(`mep_sprinkler_rows_${project.id}`, JSON.stringify(updatedRows));
            }
          }}
        />
      )}
    </AppShell>
  );
}

interface BulkBtnProps {
  icon: React.ElementType;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function BulkBtn({ icon: Icon, onClick, children, disabled }: BulkBtnProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors text-[#06456F] hover:bg-primary/10 dark:text-[#0A7BC7] dark:hover:bg-primary/20 border border-transparent hover:border-primary/20 active:bg-primary/20 dark:active:bg-primary/30 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
    >
      <Icon className="size-3 shrink-0" />
      {children}
    </button>
  );
}
