import { CalculationReviewBar, useCalculationLock, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useConfirm } from "@/hooks/use-confirm";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { cToF, fToC, lpsToCfm, cfmToLps, lpsToGpm } from "@/utils/conversions";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Save,
  Edit3,
  Copy,
  MessageSquare,
  Undo,
  Redo,
  CheckSquare,
  Square,
  X,
  Droplets,
  Droplet,
  Wind,
  Layers,
  Download,
  Flag,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Gauge,
  Activity,
  ChevronDown,
  ChevronRight,
  Scissors,
  Clipboard,
  Printer,
  TrendingUp,
  Check,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { EditCoilModal, type CoilRow } from "@/components/workspace/EditCoilModal";
import { ImportCoilModal } from "@/components/workspace/ImportCoilModal";
import { exportCondensatePDF } from "@/lib/exportCondensatePDF";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";

export const Route = createFileRoute("/condensate-drain-calc")({
  head: () => ({
    meta: [
      { title: "Coil Condensate Calculator — MEP Calc" },
      { name: "description", content: "AC cooling coil condensation schedule sizer and total moisture calculator." },
    ],
  }),
  component: CondensateDrainCalcPage,
});

// ASHRAE two-equation saturation pressure model (Pa)
function satP(tK: number): number {
  if (tK >= 273.15) {
    return Math.exp(
      -5800.2206 / tK + 1.3914993 - 0.04864 * tK +
      4.1764768e-5 * tK ** 2 - 1.4452093e-8 * tK ** 3 +
      6.5459673 * Math.log(tK)
    );
  }
  return Math.exp(
    -5674.5359 / tK + 6.3925247 - 0.009677843 * tK +
    6.2215701e-7 * tK ** 2 + 2.0747825e-9 * tK ** 3 -
    9.484024e-19 * tK ** 4 + 4.1635019 * Math.log(tK)
  );
}

function wFromWB(db: number, wb: number, p: number = 101325): number {
  const ws = 0.621945 * satP(wb + 273.15) / (p - satP(wb + 273.15));
  return ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
}

// Auto-flag validation logic matching Ventilation missing data checks
export function getCoilMissingReasons(coil: {
  name?: string;
  dbIn?: number | "";
  wbIn?: number | "";
  dbOut?: number | "";
  wbOut?: number | "";
  flow?: number | "";
  wIn?: number;
  wOut?: number;
}): string[] {
  const reasons: string[] = [];

  const isNoName = !coil.name || coil.name.trim() === "";
  if (isNoName) reasons.push("Missing Unit Reference / Tag");

  const isNoFlow = coil.flow === "" || coil.flow === undefined || isNaN(Number(coil.flow)) || Number(coil.flow) <= 0;
  if (isNoFlow) reasons.push("Missing or invalid Airflow rate");

  const isNoDbIn = coil.dbIn === "" || coil.dbIn === undefined || isNaN(Number(coil.dbIn));
  if (isNoDbIn) reasons.push("Missing On-Coil Dry Bulb");

  const isNoWbIn = coil.wbIn === "" || coil.wbIn === undefined || isNaN(Number(coil.wbIn));
  if (isNoWbIn) reasons.push("Missing On-Coil Wet Bulb");

  const isNoDbOut = coil.dbOut === "" || coil.dbOut === undefined || isNaN(Number(coil.dbOut));
  if (isNoDbOut) reasons.push("Missing Off-Coil Dry Bulb");

  const isNoWbOut = coil.wbOut === "" || coil.wbOut === undefined || isNaN(Number(coil.wbOut));
  if (isNoWbOut) reasons.push("Missing Off-Coil Wet Bulb");

  if (!isNoDbIn && !isNoWbIn && Number(coil.wbIn) > Number(coil.dbIn)) {
    reasons.push("Entering Wet Bulb exceeds Dry Bulb (Thermodynamically invalid)");
  }

  if (!isNoDbOut && !isNoWbOut && Number(coil.wbOut) > Number(coil.dbOut)) {
    reasons.push("Leaving Wet Bulb exceeds Dry Bulb (Thermodynamically invalid)");
  }

  if (coil.wIn !== undefined && coil.wOut !== undefined && coil.wOut >= coil.wIn) {
    reasons.push("Leaving humidity ratio ≥ entering (No moisture extraction / sensible only)");
  }

  return reasons;
}

export function checkIfCoilMissingData(coil: any): boolean {
  return getCoilMissingReasons(coil).length > 0;
}

function CondensateDrainCalcPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const confirm = useConfirm();
  const isLocked = useCalculationLock("/condensate-drain-calc", project?.id);
  const [calcReviewState, setCalcReviewState] = useState<CalculationReviewState | null>(null);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [rows, setRows] = useState<CoilRow[]>([]);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Selection & UI State
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const highlightTimeoutRef = React.useRef<any>(null);
  const [clipboard, setClipboard] = useState<CoilRow[]>([]);
  const [editingCoil, setEditingCoil] = useState<CoilRow | null>(null);
  const [intelOpen, setIntelOpen] = useState(false);
  const [tab, setTab] = useState<"coils" | "summary" | "report">("coils");
  const [query, setQuery] = useState("");
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  
  // Comment & Task Modal State matching Preliminary Cooling Load
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<CoilRow | null>(null);
  
  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Undo / Redo history
  const [history, setHistory] = useState<CoilRow[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const getCoilEditIds = (rId: string): string[] => {
    return selected.has(rId) ? Array.from(selected) : [rId];
  };

  const bulkUpdateCoils = (ids: string[], updates: Partial<CoilRow>) => {
    const editSet = new Set(ids);
    const newRows = rows.map(r => {
      if (!editSet.has(r.id)) return r;
      return { ...r, ...updates };
    });
    updateRowsWithHistory(newRows);
  };

  const updateRowsWithHistory = (newRows: CoilRow[]) => {
    setRows(newRows);
    dirtyStore.set(true);
    setHistory(prev => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, newRows];
    });
    setHistoryIndex(prev => prev + 1);
  };

  const handleImportCoils = (importedRows: CoilRow[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    updateRowsWithHistory([...rows, ...importedRows]);
  };

  const handleUndo = () => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (historyIndex > 0) {
      const prevRows = history[historyIndex - 1];
      setRows(prevRows);
      setHistoryIndex(historyIndex - 1);
      dirtyStore.set(true);
      toast.info("Undo performed");
    }
  };

  const handleRedo = () => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (historyIndex < history.length - 1) {
      const nextRows = history[historyIndex + 1];
      setRows(nextRows);
      setHistoryIndex(historyIndex + 1);
      dirtyStore.set(true);
      toast.info("Redo performed");
    }
  };

  // Load state on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_condensate_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.rows && Array.isArray(data.rows)) {
          setRows(data.rows);
          setHistory([data.rows]);
          setHistoryIndex(0);
        }
      } else {
        // Defaults
        const defaultRows: CoilRow[] = [
          { id: "coil-1", name: "AHU-01", dbIn: 24.0, wbIn: 18.0, dbOut: 13.0, wbOut: 12.0, flow: 1500, comments: [] },
          { id: "coil-2", name: "FCU-01", dbIn: 24.0, wbIn: 17.0, dbOut: 14.0, wbOut: 13.0, flow: 400, comments: [] },
          { id: "coil-3", name: "Coil 3", dbIn: 24.0, wbIn: 17.0, dbOut: 14.0, wbOut: 13.0, flow: 500, comments: [] }
        ];
        setUnitSystem("si");
        setRows(defaultRows);
        setHistory([defaultRows]);
        setHistoryIndex(0);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load condensate calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  // Version History Restore Listener (Full parity with Ventilation & VersionManager)
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = `mep_condensate_calc_${project?.id || "default"}`;
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
      if (restoredData) {
        if (restoredData.unitSystem) {
          setUnitSystem(restoredData.unitSystem);
        }
        const restoredRows = Array.isArray(restoredData) ? restoredData : (restoredData.rows || null);
        if (restoredRows && Array.isArray(restoredRows)) {
          setRows(restoredRows);
          setHistory([restoredRows]);
          setHistoryIndex(0);
          setSelected(new Set());
          dirtyStore.set(false);
          toast.success("Condensate calculation restored to selected version!");
        }
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        rows
      };
      localStorage.setItem(`mep_condensate_calc_${project.id}`, JSON.stringify(dataToSave));
    }
  }, [project?.id, loadedProjectId, unitSystem, rows]);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);
    dirtyStore.set(true);

    if (shouldConvert) {
      const convT = (t: number) => targetUnit === "ip" ? cToF(t) : fToC(t);
      const convF = (f: number) => targetUnit === "ip" ? lpsToCfm(f) : cfmToLps(f);

      const converted = rows.map(r => ({
        ...r,
        dbIn: Number(convT(r.dbIn).toFixed(1)),
        wbIn: Number(convT(r.wbIn).toFixed(1)),
        dbOut: Number(convT(r.dbOut).toFixed(1)),
        wbOut: Number(convT(r.wbOut).toFixed(1)),
        flow: Number(convF(r.flow).toFixed(0))
      }));

      updateRowsWithHistory(converted);
    }
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  const calculatedRows = useMemo(() => {
    const pAtm = 101325;
    return rows.map(r => {
      const dbInC = ip ? fToC(r.dbIn) : r.dbIn;
      const wbInC = ip ? fToC(r.wbIn) : r.wbIn;
      const dbOutC = ip ? fToC(r.dbOut) : r.dbOut;
      const wbOutC = ip ? fToC(r.wbOut) : r.wbOut;

      let wIn = 0, wOut = 0;
      try { wIn = wFromWB(dbInC, wbInC, pAtm); } catch (e) {}
      try { wOut = wFromWB(dbOutC, wbOutC, pAtm); } catch (e) {}

      const dw = Math.max(0, wIn - wOut);
      // Flow conversion
      const flowLps = ip ? cfmToLps(r.flow) : r.flow;
      const massAirFlow = (flowLps / 1000) * 1.2; // kg/s
      const condFlow = massAirFlow * dw; // L/s

      const missingReasons = getCoilMissingReasons({
        name: r.name,
        dbIn: r.dbIn,
        wbIn: r.wbIn,
        dbOut: r.dbOut,
        wbOut: r.wbOut,
        flow: r.flow,
        wIn,
        wOut
      });

      const isAutoFlagged = missingReasons.length > 0;
      const isEffectivelyFlagged = Boolean(r.flagged) || isAutoFlagged;

      return {
        ...r,
        wIn,
        wOut,
        dw,
        condFlow,
        missingReasons,
        isAutoFlagged,
        isEffectivelyFlagged
      };
    });
  }, [rows, ip]);

  const totals = useMemo(() => {
    const totalFlow = rows.reduce((a, b) => a + b.flow, 0);
    const totalCond = calculatedRows.reduce((a, b) => a + b.condFlow, 0);
    const avgDw = calculatedRows.length > 0 
      ? calculatedRows.reduce((a, b) => a + b.dw, 0) / calculatedRows.length 
      : 0;
    return {
      totalFlow,
      totalCond,
      avgDw
    };
  }, [calculatedRows, rows]);

  // Total count of all comments across all coils
  const totalCommentsCount = useMemo(() => {
    return rows.reduce((acc, r) => acc + (Array.isArray(r.comments) ? r.comments.length : 0), 0);
  }, [rows]);

  const firstCommentedCoil = useMemo(() => {
    return rows.find(r => Array.isArray(r.comments) && r.comments.length > 0);
  }, [rows]);

  const filteredRows = useMemo(() => {
    return calculatedRows.filter((r) => {
      if (filterFlaggedOnly && !r.isEffectivelyFlagged) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchesName = (r.name || "").toLowerCase().includes(q);
        const matchesDbIn = String(r.dbIn).includes(q);
        const matchesWbIn = String(r.wbIn).includes(q);
        const matchesDbOut = String(r.dbOut).includes(q);
        const matchesWbOut = String(r.wbOut).includes(q);
        const matchesFlow = String(r.flow).includes(q);
        return matchesName || matchesDbIn || matchesWbIn || matchesDbOut || matchesWbOut || matchesFlow;
      }
      return true;
    });
  }, [calculatedRows, query, filterFlaggedOnly]);

  const handleNewCoil = () => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const id = "coil-" + Date.now();
    const newName = `Coil ${rows.length + 1}`;
    const dbIn = ip ? 75.2 : 24.0;
    const wbIn = ip ? 62.6 : 17.0;
    const dbOut = ip ? 57.2 : 14.0;
    const wbOut = ip ? 55.4 : 13.0;
    const flow = ip ? 1000 : 500;
    const newCoilItem: CoilRow = {
      id,
      name: newName,
      dbIn,
      wbIn,
      dbOut,
      wbOut,
      flow,
      comments: []
    };
    updateRowsWithHistory([...rows, newCoilItem]);
    setEditingCoil(newCoilItem);
    toast.success(`New Coil "${newCoilItem.name}" created! Edit details below.`);
  };

  const handleSaveEditedCoil = (updated: CoilRow) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const editIds = getCoilEditIds(updated.id);
    if (editIds.length > 1) {
      const otherUpdates: Partial<CoilRow> = {
        dbIn: updated.dbIn,
        wbIn: updated.wbIn,
        dbOut: updated.dbOut,
        wbOut: updated.wbOut,
        flow: updated.flow
      };
      bulkUpdateCoils(editIds, otherUpdates);
      toast.success(`Updated ${editIds.length} coils simultaneously!`);
    } else {
      const newRows = rows.map(r => (r.id === updated.id ? updated : r));
      updateRowsWithHistory(newRows);
      toast.success(`Coil "${updated.name}" updated!`);
    }
    setEditingCoil(null);
  };

  const handleDeleteCoil = async (ids: string[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const ok = await confirm(
      `Are you sure you want to delete ${ids.length} selected coil(s)?`,
      { title: "Delete Cooling Coil(s)", confirmText: "Delete", cancelText: "Cancel" }
    );
    if (!ok) return;
    const delSet = new Set(ids);
    const newRows = rows.filter(r => !delSet.has(r.id));
    updateRowsWithHistory(newRows);
    setSelected(new Set());
    toast.success(`Deleted ${ids.length} coil(s)`);
  };

  const handleDuplicateCoil = (items: CoilRow[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const duplicated: CoilRow[] = items.map((x, idx) => ({
      ...x,
      id: `coil-${Date.now()}-${idx}`,
      name: `${x.name} (Copy)`,
      comments: []
    }));
    updateRowsWithHistory([...rows, ...duplicated]);
    toast.success(`Duplicated ${duplicated.length} coil(s)`);
  };

  const handleCopyCoil = (items: CoilRow | CoilRow[]) => {
    const arr = Array.isArray(items) ? items : [items];
    setClipboard(arr);
    toast.success(`Copied ${arr.length} coil(s) to clipboard`);
  };

  const handleCutCoil = (items: CoilRow | CoilRow[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const arr = Array.isArray(items) ? items : [items];
    setClipboard(arr);
    const cutIds = new Set(arr.map(x => x.id));
    updateRowsWithHistory(rows.filter(x => !cutIds.has(x.id)));
    setSelected(new Set());
    toast.success(`Cut ${arr.length} coil(s)`);
  };

  const handlePasteCoil = () => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (clipboard.length === 0) return;
    const pasted: CoilRow[] = clipboard.map((x, idx) => ({
      ...x,
      id: `coil-${Date.now()}-${idx}`,
      name: `${x.name} (Pasted)`,
      comments: []
    }));
    updateRowsWithHistory([...rows, ...pasted]);
    toast.success(`Pasted ${pasted.length} coil(s)`);
  };

  const handleToggleFlag = (ids: string[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const flagSet = new Set(ids);
    const targetRow = rows.find(r => flagSet.has(r.id));
    const nextVal = targetRow ? !targetRow.flagged : true;
    const newRows = rows.map(r => {
      if (!flagSet.has(r.id)) return r;
      return { ...r, flagged: nextVal };
    });
    updateRowsWithHistory(newRows);
    toast.info(`${nextVal ? "Flagged" : "Unflagged"} ${ids.length} coil(s)`);
  };

  const handleOpenComment = (coil: CoilRow) => {
    setCommentTargetItem(coil);
    setCommentModalOpen(true);
  };

  const handleSelectAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map(r => r.id)));
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleRowClick = (id: string, e: React.MouseEvent, idx: number) => {
    if (e.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, idx);
      const end = Math.max(lastClickedIndex, idx);
      const rangeIds = filteredRows.slice(start, end + 1).map(r => r.id);
      setSelected(new Set([...Array.from(selected), ...rangeIds]));
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelected(next);
    } else {
      setSelected(new Set([id]));
    }
    setLastClickedIndex(idx);
  };

  const handleRowDoubleClick = (coil: CoilRow) => {
    setEditingCoil(coil);
  };

  const handleExportPDF = async () => {
    try {
      toast.loading("Generating calculation PDF sheet...", { id: "condensate-pdf-export" });
      await exportCondensatePDF(calculatedRows, {
        calcNo: (project as any)?.calcNo || `TRV-CAL-CCD-${(project?.id || "0000").slice(-4).toUpperCase()}`,
        revNo: "Rev.0",
        projectName: project?.name || "MEP Project",
        projectNo: project?.code || (project?.id ? project.id.slice(0, 8) : "P000"),
        client: project?.client || "",
        endUser: (project as any)?.endUser || project?.location || "",
        unitSystem,
      });
      toast.dismiss("condensate-pdf-export");
    } catch (e) {
      console.error("Failed to export condensate PDF", e);
      toast.dismiss("condensate-pdf-export");
      toast.error("Failed to export PDF calculation sheet.");
    }
  };

  const uTemp = ip ? "°F" : "°C";
  const uFlow = ip ? "CFM" : "L/s";
  const uCond = ip ? "GPM" : "L/s";

  // Pipe sizing calculation according to IPC Table 307.2.2
  const totalGpm = lpsToGpm(totals.totalCond);
  const totalLhr = totals.totalCond * 3600;

  const recommendedPipe = useMemo(() => {
    if (totalGpm <= 0.05) return { sizeMm: "20 mm", sizeInch: '3/4"', metricDn: "DN20", capacityGpm: "0.05 GPM" };
    if (totalGpm <= 0.20) return { sizeMm: "25 mm", sizeInch: '1"', metricDn: "DN25", capacityGpm: "0.20 GPM" };
    if (totalGpm <= 0.50) return { sizeMm: "32 mm", sizeInch: '1-1/4"', metricDn: "DN32", capacityGpm: "0.50 GPM" };
    if (totalGpm <= 1.20) return { sizeMm: "40 mm", sizeInch: '1-1/2"', metricDn: "DN40", capacityGpm: "1.20 GPM" };
    if (totalGpm <= 3.00) return { sizeMm: "50 mm", sizeInch: '2"', metricDn: "DN50", capacityGpm: "3.00 GPM" };
    if (totalGpm <= 6.00) return { sizeMm: "65 mm", sizeInch: '2-1/2"', metricDn: "DN65", capacityGpm: "6.00 GPM" };
    return { sizeMm: "80 mm", sizeInch: '3"', metricDn: "DN80", capacityGpm: ">6.00 GPM" };
  }, [totalGpm]);

  // IPC Pipe Sizing Matrix Table Data
  const ipcPipeTable = [
    { sizeInch: '3/4"', dn: "DN20", maxGpm: 0.05, maxLps: 0.00315, tonnage: "< 20 Tons" },
    { sizeInch: '1"', dn: "DN25", maxGpm: 0.20, maxLps: 0.0126, tonnage: "20 – 40 Tons" },
    { sizeInch: '1-1/4"', dn: "DN32", maxGpm: 0.50, maxLps: 0.0315, tonnage: "40 – 90 Tons" },
    { sizeInch: '1-1/2"', dn: "DN40", maxGpm: 1.20, maxLps: 0.0757, tonnage: "90 – 125 Tons" },
    { sizeInch: '2"', dn: "DN50", maxGpm: 3.00, maxLps: 0.1893, tonnage: "125 – 250 Tons" },
    { sizeInch: '2-1/2"', dn: "DN65", maxGpm: 6.00, maxLps: 0.3785, tonnage: "250 – 450 Tons" },
    { sizeInch: '3"', dn: "DN80", maxGpm: 12.00, maxLps: 0.7571, tonnage: "> 450 Tons" },
  ];

  // Top contributing coils
  const rankedCoils = useMemo(() => {
    return [...calculatedRows]
      .filter(c => (c.condFlow || 0) > 0)
      .sort((a, b) => (b.condFlow || 0) - (a.condFlow || 0));
  }, [calculatedRows]);

  const sigDetails = useMemo(() => {
    return getSignatureBlockDetails(project?.id || "default", "/condensate-drain-calc");
  }, [project?.id, calcReviewState]);

  return (
    <AppShell 
      title="Condensate Drain Calc" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Coil Condensate Calculator</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} {rows.length === 1 ? "coil" : "coils"}</span>
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
                  projectId={project?.id}
                  calculatorPath="/condensate-drain-calc"
                  calculatorTitle="Coil Condensate Calculator"
                  onReviewStateChange={setCalcReviewState}
                />
                {totalCommentsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (firstCommentedCoil) handleOpenComment(firstCommentedCoil);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
                    title={`${totalCommentsCount} total active comment(s)/task(s)`}
                  >
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>{totalCommentsCount} Active {totalCommentsCount === 1 ? "Comment/Task" : "Comments/Tasks"}</span>
                  </button>
                )}
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Input entering and leaving air conditions for multiple cooling coils to formulate aggregate condensate drainage loads.
              </p>
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className="flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setTab("coils")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "coils"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Coils
                </button>
                <button
                  type="button"
                  onClick={() => setTab("summary")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "summary"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Summary &amp; Totals
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

              {/* Units toggle option */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  inputDescriptions="DB In, WB In, DB Out, WB Out, Airflow"
                  conversionExample={unitSystem === "si" ? "Convert 24°C → 75.2°F, 1500 L/s → 3,178 CFM" : "Convert 75.2°F → 24°C, 3178 CFM → 1,500 L/s"}
                />
              </div>
            </div>

            {/* Active Tab View */}
            <div key={tab} className="flex-1 min-h-0 animate-fade-in flex flex-col">
              {tab === "coils" && (
                <div className="flex flex-col h-full">
                  {/* Toolbar */}
                  <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background shrink-0 flex-wrap no-print modal-blur-bg border-b border-border/40">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter coils..."
                      className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
                    />

                    <div className="ml-auto flex items-center gap-1">
                      <TBtn
                        disabled={isLocked}
                        onClick={() => {
                          if (isLocked) {
                            toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to import.", { id: "readonly-notice" });
                            return;
                          }
                          setIsImportModalOpen(true);
                        }}
                      >
                        <Download className="size-3.5" /> Import
                      </TBtn>
                      <TBtn
                        onClick={handleExportPDF}
                      >
                        <FileText className="size-3.5" /> Export PDF
                      </TBtn>
                      <TBtn
                        primary
                        disabled={isLocked}
                        onClick={handleNewCoil}
                      >
                        <Plus className="size-3.5" /> New Coil
                      </TBtn>
                    </div>

                    {/* Bulk actions bar overlay */}
                    {!isLocked && selected.size > 0 && (
                      <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                        <span className="font-semibold">{selected.size} selected</span>
                        <span className="text-primary/30">·</span>
                        <button
                          type="button"
                          onClick={() => {
                            const firstSelected = rows.find(r => selected.has(r.id));
                            if (firstSelected) setEditingCoil(firstSelected);
                          }}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-[#0A7BC7] hover:text-foreground text-[12px] px-2 py-1 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <Edit3 className="size-3.5" /> Bulk edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const firstSelected = rows.find(r => selected.has(r.id));
                            if (firstSelected) handleOpenComment(firstSelected);
                          }}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-[#0A7BC7] hover:text-foreground text-[12px] px-2 py-1 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="size-3.5" /> Comment
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleFlag(Array.from(selected))}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-[#0A7BC7] hover:text-foreground text-[12px] px-2 py-1 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <Flag className="size-3.5" /> Flag
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateCoil(rows.filter(x => selected.has(x.id)))}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-[#0A7BC7] hover:text-foreground text-[12px] px-2 py-1 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <Copy className="size-3.5" /> Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCoil(Array.from(selected))}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-[#0A7BC7] hover:text-destructive text-[12px] px-2 py-1 rounded hover:bg-destructive/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelected(new Set())}
                          className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                        >
                          <X className="size-3.5" /> Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Table Grid / Empty State */}
                  <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
                    {rows.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-2 min-h-[380px]">
                        <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center animate-scale-in">
                          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce">
                            <Download className="size-6" />
                          </div>
                          <h3 className="text-[15px] font-semibold tracking-tight">No Coils Loaded</h3>
                          <p className="text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                            Start by importing cooling coil schedule data or manually add coils. The psychrometric engine will compute humidity ratios, aggregate moisture condensation loads, and drain sizing parameters.
                          </p>
                          <div className="flex items-center gap-3 w-full">
                            <button
                              type="button"
                              onClick={() => setIsImportModalOpen(true)}
                              disabled={isLocked}
                              className="flex-1 bg-primary text-primary-foreground font-semibold h-9 rounded hover:bg-primary/95 transition-colors text-xs flex items-center justify-center gap-2 shadow cursor-pointer disabled:opacity-50"
                            >
                              <Download className="size-3.5" /> Import
                            </button>
                            <button
                              type="button"
                              onClick={handleNewCoil}
                              disabled={isLocked}
                              className="flex-1 border border-border hover:bg-surface-2 font-semibold h-9 rounded transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              <Plus className="size-3.5" /> Add Coil
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse select-none">
                          <thead className="sticky top-0 z-10">
                            <tr className="border-b border-border/70 bg-surface-2 text-muted-foreground font-semibold">
                              <th className="py-2.5 px-3 w-10 min-w-10 max-w-10 text-center">
                                <button
                                  type="button"
                                  onClick={handleSelectAll}
                                  className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center mx-auto"
                                  title={selected.size === rows.length ? "Deselect All" : "Select All"}
                                >
                                  {selected.size > 0 && selected.size === rows.length ? (
                                    <CheckSquare className="size-4 text-[#0A7BC7]" />
                                  ) : (
                                    <Square className="size-4 text-muted-foreground/60" />
                                  )}
                                </button>
                              </th>
                              <th className="py-2.5 px-3 w-[22%]">Unit Ref</th>
                              <th className="py-2.5 px-3 w-[13%]">Entering DB/WB</th>
                              <th className="py-2.5 px-3 w-[13%]">Leaving DB/WB</th>
                              <th className="py-2.5 px-3 w-[12%]">Air Flow</th>
                              <th className="py-2.5 px-3 w-[11%]">W_in (kg/kg)</th>
                              <th className="py-2.5 px-3 w-[11%]">W_out (kg/kg)</th>
                              <th className="py-2.5 px-3 text-primary font-bold">Condensate ({ip ? "GPM" : "L/s"})</th>
                              <th className="py-2.5 px-2 w-10 min-w-10 max-w-10 text-center" title="Flag coil for attention"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono">
                            {filteredRows.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="py-12 text-center text-muted-foreground font-sans text-xs">
                                  No coils match your search criteria.
                                </td>
                              </tr>
                            ) : (
                              filteredRows.map((r, idx) => {
                                const isSelected = selected.has(r.id);
                                const hasComments = Array.isArray(r.comments) && r.comments.length > 0;
                                const isFlagged = Boolean(r.isEffectivelyFlagged);
                                const missingText = r.missingReasons && r.missingReasons.length > 0 ? r.missingReasons.join(" • ") : "";

                                return (
                                  <ContextMenu key={r.id}>
                                    <ContextMenuTrigger asChild>
                                      <tr
                                        id={`coil-row-${r.id}`}
                                        data-row-id={r.id}
                                        data-item-id={r.id}
                                        data-coil-id={r.id}
                                        onClick={(e) => handleRowClick(r.id, e, idx)}
                                        onDoubleClick={() => handleRowDoubleClick(r)}
                                        className={`transition-colors cursor-pointer group ${
                                          highlightedRowId === r.id
                                            ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/25 z-20 relative font-bold"
                                            : isSelected
                                            ? "bg-[#0A7BC7]/10 dark:bg-[#0A7BC7]/20 border-l-2 border-l-[#0A7BC7]"
                                            : "hover:bg-slate-50/80 dark:hover:bg-slate-900/30"
                                        }`}
                                      >
                                        {/* 1. Checkbox */}
                                        <td className="py-2 px-3 w-10 min-w-10 max-w-10 text-center" onClick={(e) => handleToggleSelectRow(r.id, e)}>
                                          {isSelected ? (
                                            <CheckSquare className="size-4 text-[#0A7BC7] inline" />
                                          ) : (
                                            <Square className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground inline" />
                                          )}
                                        </td>

                                        {/* 2. Unit Ref */}
                                        <td className="py-2 px-3 font-sans font-semibold text-[13px] text-foreground">
                                          <div className="flex items-center gap-1.5">
                                            {hasComments && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenComment(r);
                                                }}
                                                title={`${r.comments?.length} comment(s)/task(s) assigned to coil "${r.name}"`}
                                                className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer"
                                              >
                                                <MessageSquare className="size-3.5 fill-blue-500/20" />
                                              </button>
                                            )}
                                            <span>{r.name}</span>
                                          </div>
                                        </td>

                                        {/* 3. Entering DB/WB */}
                                        <td className="py-2 px-3 text-[13px] font-mono">
                                          {r.dbIn}/{r.wbIn} {uTemp}
                                        </td>

                                        {/* 4. Leaving DB/WB */}
                                        <td className="py-2 px-3 text-[13px] font-mono">
                                          {r.dbOut}/{r.wbOut} {uTemp}
                                        </td>

                                        {/* 5. Air Flow */}
                                        <td className="py-2 px-3 text-[13px] font-mono">
                                          {r.flow.toLocaleString()} {uFlow}
                                        </td>

                                        {/* 6. W_in */}
                                        <td className="py-2 px-3 text-[13px] font-mono">{r.wIn.toFixed(6)}</td>

                                        {/* 7. W_out */}
                                        <td className="py-2 px-3 text-[13px] font-mono">{r.wOut.toFixed(6)}</td>

                                        {/* 8. Condensate Flow */}
                                        <td className="py-2 px-3 text-[13px] font-mono font-bold text-primary">
                                          {ip ? lpsToGpm(r.condFlow).toFixed(5) : r.condFlow.toFixed(5)} {ip ? "GPM" : "L/s"}
                                        </td>

                                        {/* 9. Flag Column */}
                                        <td className="py-2 px-2 w-10 min-w-10 max-w-10 text-center" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const editIds = selected.has(r.id) && selected.size > 1 ? Array.from(selected) : [r.id];
                                              handleToggleFlag(editIds);
                                            }}
                                            title={
                                              missingText
                                                ? missingText
                                                : isFlagged
                                                ? "Unflag coil"
                                                : "Flag coil"
                                            }
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
                                        </td>
                                      </tr>
                                    </ContextMenuTrigger>

                                    {/* Right-Click Context Menu */}
                                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1.5 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                                      <ContextMenuItem
                                        onClick={() => handleRowDoubleClick(r)}
                                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                      >
                                        <Edit3 className="size-3.5 text-muted-foreground" />
                                        <span>{isSelected && selected.size > 1 ? `Bulk Edit (${selected.size}) Coils` : "Edit Coil Properties"}</span>
                                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                                      </ContextMenuItem>

                                      <ContextMenuSeparator className="h-px bg-border my-1" />

                                      <ContextMenuItem
                                        onClick={() => handleCopyCoil(isSelected && selected.size > 1 ? rows.filter(x => selected.has(x.id)) : r)}
                                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                      >
                                        <Copy className="size-3.5 text-muted-foreground" />
                                        <span>{isSelected && selected.size > 1 ? `Copy (${selected.size}) Coils` : "Copy"}</span>
                                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                      </ContextMenuItem>

                                      <ContextMenuItem
                                        onClick={() => handleCutCoil(isSelected && selected.size > 1 ? rows.filter(x => selected.has(x.id)) : r)}
                                        disabled={isLocked}
                                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                      >
                                        <Scissors className="size-3.5 text-muted-foreground" />
                                        <span>{isSelected && selected.size > 1 ? `Cut (${selected.size}) Coils` : "Cut"}</span>
                                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
                                      </ContextMenuItem>

                                      <ContextMenuItem
                                        onClick={handlePasteCoil}
                                        disabled={isLocked || clipboard.length === 0}
                                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                      >
                                        <Clipboard className="size-3.5 text-muted-foreground" />
                                        <span>Paste {clipboard.length > 0 ? `(${clipboard.length})` : ""}</span>
                                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                                      </ContextMenuItem>

                                      <ContextMenuSeparator className="h-px bg-border my-1" />

                                      <ContextMenuItem
                                        onClick={() => handleDuplicateCoil(isSelected && selected.size > 1 ? rows.filter(x => selected.has(x.id)) : r)}
                                        disabled={isLocked}
                                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                      >
                                        <Copy className="size-3.5 text-muted-foreground" />
                                        <span>{isSelected && selected.size > 1 ? `Duplicate (${selected.size}) Coils` : "Duplicate Coil"}</span>
                                      </ContextMenuItem>

                                      <ContextMenuItem
                                        onClick={() => handleToggleFlag(isSelected && selected.size > 1 ? Array.from(selected) : [r.id])}
                                        disabled={isLocked}
                                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                      >
                                        <Flag className={`size-3.5 ${isFlagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                                        <span>{isSelected && selected.size > 1 ? `Toggle Flag (${selected.size}) Selected` : isFlagged ? "Unflag Coil" : "Flag Coil"}</span>
                                      </ContextMenuItem>

                                      <ContextMenuItem
                                        onClick={() => handleOpenComment(r)}
                                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                      >
                                        <MessageSquare className="size-3.5" />
                                        <span>Add Comment / Assign Task</span>
                                      </ContextMenuItem>

                                      <ContextMenuSeparator className="h-px bg-border my-1" />

                                      <ContextMenuItem
                                        onClick={() => handleDeleteCoil(isSelected && selected.size > 1 ? Array.from(selected) : [r.id])}
                                        disabled={isLocked}
                                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-destructive cursor-pointer font-medium disabled:opacity-50"
                                      >
                                        <Trash2 className="size-3.5" />
                                        <span>{isSelected && selected.size > 1 ? `Delete (${selected.size}) Selected` : "Delete Coil"}</span>
                                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg">
                    <div>
                      Showing <span className="text-foreground font-medium tabular">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} coils
                    </div>
                    <div className="flex items-center gap-3 tabular">
                      <span>Σ Airflow: <span className="font-mono text-foreground">{totals.totalFlow.toLocaleString()} {uFlow}</span></span>
                      <span>Σ Condensate: <span className="font-mono text-foreground">{ip ? lpsToGpm(totals.totalCond).toFixed(4) : totals.totalCond.toFixed(4)} {ip ? "GPM" : "L/s"}</span></span>
                    </div>
                  </div>
                </div>
              )}

              {tab === "summary" && (
                <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground font-sans">Condensate Summary &amp; Analytics</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">Aggregated psychrometrics &amp; IPC / ASHRAE drainage guidance</span>
                  </div>

                  {/* Top KPI Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                    {/* 1. Active Coils */}
                    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Active Coils</span>
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                          <Layers className="size-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-bold font-mono text-foreground">{rows.length}</span>
                        <span className="text-xs text-muted-foreground font-sans">{rows.length === 1 ? "unit" : "units"}</span>
                      </div>
                    </div>

                    {/* 2. Total Airflow */}
                    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Total Airflow</span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-[#0A7BC7]">
                          <Wind className="size-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-bold font-mono text-foreground">{totals.totalFlow.toLocaleString()}</span>
                        <span className="text-xs font-bold text-muted-foreground">{uFlow}</span>
                      </div>
                    </div>

                    {/* 3. Aggregate Condensate Flow */}
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col justify-between shadow-xs col-span-1 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary">Total Condensate Flow</span>
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                          <Droplets className="size-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-extrabold font-mono text-primary">
                          {ip ? lpsToGpm(totals.totalCond).toFixed(4) : totals.totalCond.toFixed(4)}
                        </span>
                        <span className="text-xs font-bold text-primary">{ip ? "GPM" : "L/s"}</span>
                        <span className="text-[11px] text-muted-foreground font-mono ml-auto">
                          ({totalLhr.toFixed(2)} L/hr)
                        </span>
                      </div>
                    </div>

                    {/* 4. Recommended Drain Main */}
                    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Drain Header Pipe</span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Gauge className="size-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {ip ? recommendedPipe.sizeInch : recommendedPipe.metricDn}
                        </span>
                        <span className="text-xs text-muted-foreground">({ip ? recommendedPipe.metricDn : recommendedPipe.sizeInch})</span>
                      </div>
                    </div>

                    {/* 5. Trap Seal Depth */}
                    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Min Trap Depth</span>
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Droplet className="size-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-xl font-bold font-mono text-foreground">
                          {ip ? "3.0 in" : "75 mm"}
                        </span>
                        <span className="text-xs text-muted-foreground">P-Trap</span>
                      </div>
                    </div>
                  </div>

                  {/* Two Column Analytical Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Ranked Coil Condensate Contributors */}
                    <div className="border border-border rounded-2xl p-5 bg-card flex flex-col gap-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[13px] font-bold text-foreground flex items-center gap-2">
                          <TrendingUp className="size-4 text-primary" />
                          Coil Condensate Contribution Breakdown
                        </h4>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Total: {ip ? `${totalGpm.toFixed(4)} GPM` : `${totals.totalCond.toFixed(4)} L/s`}
                        </span>
                      </div>

                      {rankedCoils.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          No active moisture extraction detected in coils.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {rankedCoils.map((c, idx) => {
                            const pct = totals.totalCond > 0 ? ((c.condFlow || 0) / totals.totalCond) * 100 : 0;
                            return (
                              <div key={c.id} className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-surface-2/40 border border-border/50">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 font-medium text-foreground">
                                    <span className="size-5 rounded-full bg-primary/10 text-primary font-mono text-[10.5px] font-bold flex items-center justify-center">
                                      {idx + 1}
                                    </span>
                                    <span className="font-semibold">{c.name}</span>
                                    <span className="text-muted-foreground font-mono text-[11px]">({c.flow.toLocaleString()} {uFlow})</span>
                                  </div>
                                  <div className="flex items-center gap-2 font-mono">
                                    <span className="font-bold text-primary">
                                      {ip ? lpsToGpm(c.condFlow).toFixed(4) : (c.condFlow || 0).toFixed(4)} {uCond}
                                    </span>
                                    <span className="text-muted-foreground text-[11px]">({pct.toFixed(1)}%)</span>
                                  </div>
                                </div>
                                <div className="h-1.5 w-full bg-border/60 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#0A7BC7] rounded-full transition-all duration-300"
                                    style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right: IPC Condensate Drain Sizing Table */}
                    <div className="border border-border rounded-2xl p-5 bg-card flex flex-col gap-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[13px] font-bold text-foreground flex items-center gap-2">
                          <Gauge className="size-4 text-emerald-600 dark:text-emerald-400" />
                          IPC &amp; ASHRAE Condensate Drain Sizing Table
                        </h4>
                        <span className="text-[11px] text-muted-foreground font-medium">IPC Section 307</span>
                      </div>

                      <div className="overflow-x-auto border border-border rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-surface-2 text-muted-foreground font-semibold border-b border-border">
                              <th className="py-2 px-3">Nominal Pipe Size</th>
                              <th className="py-2 px-3 text-right">Max Flow ({uCond})</th>
                              <th className="py-2 px-3 text-right">Cooling Capacity</th>
                              <th className="py-2 px-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border font-mono">
                            {ipcPipeTable.map((pipe) => {
                              const isSelectedPipe = (ip ? pipe.sizeInch : pipe.dn) === (ip ? recommendedPipe.sizeInch : recommendedPipe.metricDn);
                              return (
                                <tr
                                  key={pipe.sizeInch}
                                  className={`transition-colors ${
                                    isSelectedPipe
                                      ? "bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground"
                                      : "hover:bg-surface-2/50 text-muted-foreground"
                                  }`}
                                >
                                  <td className="py-2 px-3">
                                    <span className="font-sans font-semibold text-foreground">{pipe.sizeInch}</span> ({pipe.dn})
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {ip ? `${pipe.maxGpm.toFixed(2)} GPM` : `${pipe.maxLps.toFixed(4)} L/s`}
                                  </td>
                                  <td className="py-2 px-3 text-right font-sans text-[11px]">
                                    {pipe.tonnage}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {isSelectedPipe ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        <Check className="size-3" /> Recommended
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/50">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Pipe sizes based on gravity drainage slope of 1% (1/8 in/ft). Secondary emergency drains require equal or larger diameter.
                      </p>
                    </div>
                  </div>

                  {/* Trap Seal Guidance & Engineering Principles */}
                  <div className="border border-border rounded-2xl p-5 bg-card flex flex-col gap-3 shadow-xs">
                    <h4 className="text-[13px] font-bold text-foreground flex items-center gap-2">
                      <Droplets className="size-4 text-primary" />
                      Condensate Trap Seal Depth &amp; Hydraulic Installation Rules
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground mt-1">
                      <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60 flex flex-col gap-1.5">
                        <strong className="text-foreground font-semibold">1. Draw-Through Trap Sizing</strong>
                        <p className="leading-relaxed text-[11.5px]">
                          Fan creates negative static pressure in drain pan. Trap total height H must exceed fan static pressure + 1.0 inch (25 mm) to prevent air rushing into pan and holding back water.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60 flex flex-col gap-1.5">
                        <strong className="text-foreground font-semibold">2. Blow-Through Trap Sizing</strong>
                        <p className="leading-relaxed text-[11.5px]">
                          Fan creates positive static pressure. Trap seal depth must exceed positive static pressure + 0.5 inch (13 mm) to avoid blowing conditioned air through the drain piping.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60 flex flex-col gap-1.5">
                        <strong className="text-foreground font-semibold">3. Air Gap / Indirect Waste</strong>
                        <p className="leading-relaxed text-[11.5px]">
                          Condensate lines must terminate with a minimum 1.0 inch (25 mm) physical air gap above the rim of the floor drain or receptor to eliminate sewer gas back-siphonage.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PRINTABLE REPORT PREVIEW TAB (MATCHING VENTILATION REPORT FORMAT) */}
              {tab === "report" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                    
                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          Cooling Coil Condensate Calculation Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Design Standards: ASHRAE Psychrometric Principles &amp; IPC Section 307 Condensate Disposal
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TBtn onClick={() => window.print()}>
                          <Printer className="size-3.5" /> Print
                        </TBtn>
                        <TBtn primary onClick={handleExportPDF}>
                          <FileText className="size-3.5" /> Export PDF
                        </TBtn>
                      </div>
                    </div>

                    {/* Enclosed Project Metadata Grid (3 rows x 2 cols) */}
                    <div className="border border-border rounded-xl overflow-hidden text-[12px]">
                      <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/20">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Calculation No.:</span>
                          <span className="text-muted-foreground font-mono">TRV-CAL-CCD-{(project?.id || "0000").slice(-4).toUpperCase()}</span>
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

                    {/* Table 1: Coil Condensate Schedule & Psychrometric Data */}
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                              <th className="py-2 px-2.5 w-10">Sr.</th>
                              <th className="py-2 px-3 text-left">Unit Ref</th>
                              <th className="py-2 px-3 text-right">Air Flow ({uFlow})</th>
                              <th className="py-2 px-3">On-Coil DB/WB ({uTemp})</th>
                              <th className="py-2 px-3">Off-Coil DB/WB ({uTemp})</th>
                              <th className="py-2 px-2.5 text-right">W_in (kg/kg)</th>
                              <th className="py-2 px-2.5 text-right">W_out (kg/kg)</th>
                              <th className="py-2 px-2.5 text-right">ΔW (kg/kg)</th>
                              <th className="py-2 px-3 text-right">Condensate ({uCond})</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-mono">
                            {calculatedRows.map((r, idx) => {
                              const condVal = ip ? lpsToGpm(r.condFlow).toFixed(4) : r.condFlow.toFixed(4);
                              return (
                                <tr key={r.id} className="hover:bg-muted/30">
                                  <td className="py-2 px-2.5 text-center text-muted-foreground font-sans">{idx + 1}</td>
                                  <td className="py-2 px-3 font-sans font-bold text-foreground">{r.name}</td>
                                  <td className="py-2 px-3 text-right">{r.flow.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-center">{r.dbIn.toFixed(1)} / {r.wbIn.toFixed(1)}</td>
                                  <td className="py-2 px-3 text-center">{r.dbOut.toFixed(1)} / {r.wbOut.toFixed(1)}</td>
                                  <td className="py-2 px-2.5 text-right">{r.wIn.toFixed(5)}</td>
                                  <td className="py-2 px-2.5 text-right">{r.wOut.toFixed(5)}</td>
                                  <td className="py-2 px-2.5 text-right font-semibold">{r.dw.toFixed(5)}</td>
                                  <td className="py-2 px-3 text-right font-bold text-primary">{condVal}</td>
                                </tr>
                              );
                            })}
                            {/* Summary Total Row */}
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold border-t-2 border-border text-foreground">
                              <td className="py-2 px-2.5 text-center font-sans">TOTAL</td>
                              <td className="py-2 px-3 font-sans">{rows.length} Units</td>
                              <td className="py-2 px-3 text-right">{totals.totalFlow.toLocaleString()}</td>
                              <td className="py-2 px-3 text-center">-</td>
                              <td className="py-2 px-3 text-center">-</td>
                              <td className="py-2 px-2.5 text-right">-</td>
                              <td className="py-2 px-2.5 text-right">-</td>
                              <td className="py-2 px-2.5 text-right">-</td>
                              <td className="py-2 px-3 text-right text-primary font-mono text-[12px]">
                                {ip ? lpsToGpm(totals.totalCond).toFixed(4) : totals.totalCond.toFixed(4)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 2: Aggregate Condensate Drainage Summary & Sizing Guidance */}
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                              <th className="py-2 px-2.5 w-10">Sr.</th>
                              <th className="py-2 px-3 text-left">Drainage Sizing Parameter</th>
                              <th className="py-2 px-3 text-left">Governing Rule / Standard</th>
                              <th className="py-2 px-3 text-right">Calculated Value</th>
                              <th className="py-2 px-2.5 text-center">Unit</th>
                              <th className="py-2 px-3 text-left">Engineering Design Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-sans">
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">1</td>
                              <td className="py-2 px-3 font-medium">Total Active Cooling Coils</td>
                              <td className="py-2 px-3 text-muted-foreground">Quantity</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{rows.length} Units</td>
                              <td className="py-2 px-2.5 text-center text-muted-foreground">units</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Total scheduled cooling units contributing to drain header</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">2</td>
                              <td className="py-2 px-3 font-medium">Aggregate Airflow Volume</td>
                              <td className="py-2 px-3 text-muted-foreground">Sum(Airflow)</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{totals.totalFlow.toLocaleString()}</td>
                              <td className="py-2 px-2.5 text-center text-muted-foreground">{uFlow}</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Total processed supply air across all cooling coils</td>
                            </tr>
                            {/* Key Highlighted Row: Total Aggregate Condensate Flow */}
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground">
                              <td className="py-2 px-2.5 text-center font-mono">3</td>
                              <td className="py-2 px-3">TOTAL AGGREGATE CONDENSATE FLOW</td>
                              <td className="py-2 px-3">Sum(m_dot_air · ΔW)</td>
                              <td className="py-2 px-3 text-right font-mono text-primary text-[12px]">
                                {ip ? `${totalGpm.toFixed(4)} GPM (${totals.totalCond.toFixed(4)} L/s)` : `${totals.totalCond.toFixed(4)} L/s (${totalGpm.toFixed(4)} GPM)`}
                              </td>
                              <td className="py-2 px-2.5 text-center font-mono">{ip ? "GPM" : "L/s"}</td>
                              <td className="py-2 px-3 text-[10.5px]">Equivalent to {totalLhr.toFixed(2)} L/hr moisture removal rate</td>
                            </tr>
                            {/* Key Highlighted Row: Recommended Drain Main Size */}
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground">
                              <td className="py-2 px-2.5 text-center font-mono">4</td>
                              <td className="py-2 px-3">Recommended Drain Header Pipe Size</td>
                              <td className="py-2 px-3">IPC 307.2.2 / ASHRAE</td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300 text-[12px]">
                                {ip ? `${recommendedPipe.sizeInch} (${recommendedPipe.metricDn})` : `${recommendedPipe.metricDn} (${recommendedPipe.sizeInch})`}
                              </td>
                              <td className="py-2 px-2.5 text-center font-mono">{ip ? "inch" : "mm"}</td>
                              <td className="py-2 px-3 text-[10.5px]">Gravity drainage sloped at min 1% (1/8 in/ft) to floor drain</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">5</td>
                              <td className="py-2 px-3 font-medium">Recommended Min P-Trap Seal Depth</td>
                              <td className="py-2 px-3 text-muted-foreground">H = 1 in + Fan ESP</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{ip ? "3.0 in" : "75 mm"}</td>
                              <td className="py-2 px-2.5 text-center text-muted-foreground">{ip ? "in" : "mm"}</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Prevents air ingress/blowout and allows unhindered condensate drain</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 3: 4-Column Dynamic Signature Block */}
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
        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <CoilCondensateIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calculatedRows={calculatedRows}
              totals={totals}
              unitSystem={unitSystem}
              onSelectCoil={(id) => {
                setSelected(new Set([id]));
                const rowEl = document.getElementById(`coil-row-${id}`);
                if (rowEl) {
                  rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
              onEditCoil={(coil) => {
                setEditingCoil(coil);
              }}
            />
          )}
        </div>
      </div>

      {/* Edit Coil Modal */}
      <EditCoilModal
        isOpen={!!editingCoil}
        onClose={() => setEditingCoil(null)}
        coil={editingCoil}
        selectedCount={editingCoil && selected.has(editingCoil.id) && selected.size > 1 ? selected.size : 1}
        onSave={handleSaveEditedCoil}
        unitSystem={unitSystem}
      />

      {/* Assign Comment & Task Modal matching Preliminary Cooling Load */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="Cooling Coil"
          calculatorTitle="Coil Condensate Calculator"
          calculatorPath="/condensate-drain-calc"
          existingComments={rows.find(r => r.id === commentTargetItem.id)?.comments || []}
          onSave={(comment) => {
            const updatedRows = rows.map(r => r.id === commentTargetItem.id ? {
              ...r,
              comments: [...(r.comments || []), comment]
            } : r);
            updateRowsWithHistory(updatedRows);
            if (project?.id) {
              localStorage.setItem(`mep_condensate_calc_${project.id}`, JSON.stringify({ unitSystem, rows: updatedRows }));
            }
            try {
              if (typeof forceSaveToCloud === "function") {
                forceSaveToCloud(true);
              }
            } catch (e) {}
          }}
        />
      )}

      {/* Import Coil Schedule Modal */}
      {isImportModalOpen && (
        <ImportCoilModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportCoils}
          currentUnitSystem={unitSystem}
        />
      )}
    </AppShell>
  );
}

function CoilCondensateIntelligenceDrawer({
  onClose,
  calculatedRows,
  totals,
  unitSystem,
  onSelectCoil,
  onEditCoil,
}: {
  onClose: () => void;
  calculatedRows: any[];
  totals: { totalFlow: number; totalCond: number; avgDw?: number };
  unitSystem: "si" | "ip";
  onSelectCoil: (id: string) => void;
  onEditCoil: (coil: any) => void;
}) {
  const ip = unitSystem === "ip";
  const uFlow = ip ? "CFM" : "L/s";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    issues: true,
    pipeSizing: true,
    topContributors: true,
    engineeringNotes: false,
  });

  const totalCoils = calculatedRows.length;
  const flaggedCoils = calculatedRows.filter(r => r.isEffectivelyFlagged);
  const validCoilsCount = calculatedRows.filter(r => !r.isAutoFlagged).length;
  const compliancePct = totalCoils > 0 ? Math.round((validCoilsCount / totalCoils) * 100) : 100;

  // Drain pipe sizing logic according to IPC / ASHRAE guidelines
  const totalGpm = lpsToGpm(totals.totalCond);
  const recommendedPipe = useMemo(() => {
    if (totalGpm <= 0.05) return { sizeMm: "20 mm", sizeInch: '3/4"', metricDn: "DN20", capacityGpm: "0.05 GPM" };
    if (totalGpm <= 0.20) return { sizeMm: "25 mm", sizeInch: '1"', metricDn: "DN25", capacityGpm: "0.20 GPM" };
    if (totalGpm <= 0.50) return { sizeMm: "32 mm", sizeInch: '1-1/4"', metricDn: "DN32", capacityGpm: "0.50 GPM" };
    if (totalGpm <= 1.20) return { sizeMm: "40 mm", sizeInch: '1-1/2"', metricDn: "DN40", capacityGpm: "1.20 GPM" };
    if (totalGpm <= 3.00) return { sizeMm: "50 mm", sizeInch: '2"', metricDn: "DN50", capacityGpm: "3.00 GPM" };
    if (totalGpm <= 6.00) return { sizeMm: "65 mm", sizeInch: '2-1/2"', metricDn: "DN65", capacityGpm: "6.00 GPM" };
    return { sizeMm: "80 mm", sizeInch: '3"', metricDn: "DN80", capacityGpm: ">6.00 GPM" };
  }, [totalGpm]);

  // Top condensate contributors
  const rankedCoils = useMemo(() => {
    return [...calculatedRows]
      .filter(c => (c.condFlow || 0) > 0)
      .sort((a, b) => (b.condFlow || 0) - (a.condFlow || 0))
      .slice(0, 5);
  }, [calculatedRows]);

  return (
    <div className="h-full w-[360px] flex flex-col font-sans select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Psychrometric Intelligence</h3>
            <p className="text-[10px] text-muted-foreground">Automated audit &amp; sizing recommendations</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-7 rounded-lg hover:bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {/* Compliance Gauge */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Schedule Health</span>
            <span className={`font-mono font-bold text-xs ${compliancePct === 100 ? "text-emerald-600" : "text-amber-600"}`}>
              {compliancePct}% Valid
            </span>
          </div>
          <div className="h-2 w-full bg-border/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${compliancePct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${compliancePct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{validCoilsCount} of {totalCoils} coils complete</span>
            {flaggedCoils.length > 0 && <span className="text-red-500 font-semibold">{flaggedCoils.length} attention required</span>}
          </div>
        </div>

        {/* Section 1: Pipe Sizing Recommendation */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Gauge className="size-3.5 text-emerald-600" /> Drain Sizing Recommendation
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-foreground flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Aggregate Drain Pipe:</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {ip ? recommendedPipe.sizeInch : recommendedPipe.metricDn}
              </span>
              <span className="text-xs text-muted-foreground">({ip ? recommendedPipe.metricDn : recommendedPipe.sizeInch})</span>
            </div>
            <span className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
              Adequate for up to {recommendedPipe.capacityGpm} gravity drainage load at 1% slope.
            </span>
          </div>
        </div>

        {/* Section 2: Top Contributors */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-primary" /> Top Condensate Contributors
          </span>
          {rankedCoils.length === 0 ? (
            <span className="text-muted-foreground text-[11px]">No coils with positive condensate load.</span>
          ) : (
            <div className="flex flex-col gap-2">
              {rankedCoils.map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => onSelectCoil(c.id)}
                  className="p-2 rounded-xl bg-surface-2/60 hover:bg-surface-2 flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-foreground">{c.name}</span>
                  </div>
                  <span className="font-mono font-bold text-primary">
                    {ip ? `${lpsToGpm(c.condFlow).toFixed(4)} GPM` : `${(c.condFlow || 0).toFixed(4)} L/s`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Issues & Thermodynamic Warnings */}
        {flaggedCoils.length > 0 && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-2xl p-4 shadow-xs flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" /> Thermodynamic / Input Issues ({flaggedCoils.length})
            </span>
            <div className="flex flex-col gap-2">
              {flaggedCoils.map(c => (
                <div
                  key={c.id}
                  onClick={() => onEditCoil(c)}
                  className="p-2 rounded-xl bg-background/80 border border-destructive/20 flex flex-col gap-1 cursor-pointer hover:border-destructive transition"
                >
                  <span className="font-semibold text-foreground">{c.name}</span>
                  <span className="text-[10.5px] text-destructive leading-tight">
                    {c.missingReasons?.join(" • ") || "Flagged for engineer review"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
