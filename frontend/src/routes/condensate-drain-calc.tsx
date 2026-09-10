import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { useConfirm } from "@/hooks/use-confirm";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { cToF, fToC, lpsToCfm, cfmToLps, lpsToGpm } from "@/utils/conversions";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
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
} from "lucide-react";
import * as XLSX from "xlsx";
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
import { exportCondensateExcel } from "@/lib/exportCondensateExcel";
import { exportCondensatePDF } from "@/lib/exportCondensatePDF";
import { UnitToggle } from "@/components/workspace/UnitToggle";

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
  const [tab, setTab] = useState<"coils" | "summary">("coils");
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
          { id: "coil-1", name: "AHU-01", dbIn: 24.0, wbIn: 18.0, dbOut: 13.0, wbOut: 12.0, flow: 1500 },
          { id: "coil-2", name: "FCU-01", dbIn: 24.0, wbIn: 17.0, dbOut: 14.0, wbOut: 13.0, flow: 400 }
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
          setLastSelectedId(null);
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

  const handleSaveCurrent = () => {
    try {
      const dataToSave = {
        unitSystem,
        rows
      };
      localStorage.setItem(`mep_condensate_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      forceSaveToCloud();
      toast.success("Condensate Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const [newCoil, setNewCoil] = useState<{
    name: string;
    dbIn: number | "";
    wbIn: number | "";
    dbOut: number | "";
    wbOut: number | "";
    flow: number | "";
  }>({
    name: "",
    dbIn: "",
    wbIn: "",
    dbOut: "",
    wbOut: "",
    flow: ""
  });

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

      setNewCoil(prev => ({
        ...prev,
        dbIn: prev.dbIn !== "" ? Number(convT(Number(prev.dbIn)).toFixed(1)) : "",
        wbIn: prev.wbIn !== "" ? Number(convT(Number(prev.wbIn)).toFixed(1)) : "",
        dbOut: prev.dbOut !== "" ? Number(convT(Number(prev.dbOut)).toFixed(1)) : "",
        wbOut: prev.wbOut !== "" ? Number(convT(Number(prev.wbOut)).toFixed(1)) : "",
        flow: prev.flow !== "" ? Number(convF(Number(prev.flow)).toFixed(0)) : ""
      }));
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
      const massAirFlow = (flowLps / 1000) * 1.2;
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
    return {
      totalFlow,
      totalCond
    };
  }, [calculatedRows, rows]);

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

  const handleAddCoil = () => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (!newCoil.name.trim()) {
      toast.error("Please enter a Unit Reference / Name");
      return;
    }
    const id = "coil-" + Date.now();
    const dbIn = newCoil.dbIn !== "" ? Number(newCoil.dbIn) : (ip ? 75.2 : 24.0);
    const wbIn = newCoil.wbIn !== "" ? Number(newCoil.wbIn) : (ip ? 62.6 : 17.0);
    const dbOut = newCoil.dbOut !== "" ? Number(newCoil.dbOut) : (ip ? 57.2 : 14.0);
    const wbOut = newCoil.wbOut !== "" ? Number(newCoil.wbOut) : (ip ? 55.4 : 13.0);
    const flow = newCoil.flow !== "" ? Number(newCoil.flow) : (ip ? 1000 : 500);

    const added: CoilRow = { id, name: newCoil.name.trim(), dbIn, wbIn, dbOut, wbOut, flow, comments: [] };
    updateRowsWithHistory([...rows, added]);
    toast.success(`Added coil "${added.name}"`);
    setNewCoil({
      name: "",
      dbIn: "",
      wbIn: "",
      dbOut: "",
      wbOut: "",
      flow: ""
    });
  };

  const handleDeleteCoil = (idOrIds: string | string[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const idsToDelete = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const newRows = rows.filter(r => !idsToDelete.includes(r.id));
    updateRowsWithHistory(newRows);
    setSelected(prev => {
      const next = new Set(prev);
      idsToDelete.forEach(id => next.delete(id));
      return next;
    });
    toast.success(`Deleted ${idsToDelete.length} coil${idsToDelete.length > 1 ? "s" : ""}`);
  };

  const handleDuplicateCoil = (coilOrCoils: CoilRow | CoilRow[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const coilsToDup = Array.isArray(coilOrCoils) ? coilOrCoils : [coilOrCoils];
    const duplicates: CoilRow[] = coilsToDup.map((c, idx) => ({
      ...c,
      id: `coil-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${c.name} (Copy)`,
      comments: []
    }));

    updateRowsWithHistory([...rows, ...duplicates]);
    setSelected(new Set(duplicates.map(d => d.id)));
    toast.success(`Duplicated ${duplicates.length} coil${duplicates.length > 1 ? "s" : ""}`);
  };

  const handleCopyCoil = (coilOrCoils?: CoilRow | CoilRow[]) => {
    let itemsToCopy: CoilRow[] = [];
    if (coilOrCoils) {
      itemsToCopy = Array.isArray(coilOrCoils) ? coilOrCoils : [coilOrCoils];
    } else if (selected.size > 0) {
      itemsToCopy = rows.filter(r => selected.has(r.id));
    }
    if (itemsToCopy.length === 0) {
      toast.info("No coil selected to copy");
      return;
    }
    setClipboard(itemsToCopy);
    toast.info(`Copied ${itemsToCopy.length} coil${itemsToCopy.length > 1 ? "s" : ""} to clipboard`);
  };

  const handleCutCoil = (coilOrCoils?: CoilRow | CoilRow[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    let itemsToCut: CoilRow[] = [];
    if (coilOrCoils) {
      itemsToCut = Array.isArray(coilOrCoils) ? coilOrCoils : [coilOrCoils];
    } else if (selected.size > 0) {
      itemsToCut = rows.filter(r => selected.has(r.id));
    }
    if (itemsToCut.length === 0) {
      toast.info("No coil selected to cut");
      return;
    }
    setClipboard(itemsToCut);
    const cutIds = new Set(itemsToCut.map(i => i.id));
    const remaining = rows.filter(r => !cutIds.has(r.id));
    updateRowsWithHistory(remaining);
    setSelected(new Set());
    toast.info(`Cut ${itemsToCut.length} coil${itemsToCut.length > 1 ? "s" : ""} to clipboard`);
  };

  const handlePasteCoil = () => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (clipboard.length === 0) {
      toast.info("Clipboard is empty. Copy or cut a coil first.");
      return;
    }
    const pastedRows: CoilRow[] = clipboard.map((c, idx) => ({
      ...c,
      id: `coil-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${c.name} (Copy)`,
      comments: []
    }));
    updateRowsWithHistory([...rows, ...pastedRows]);
    setSelected(new Set(pastedRows.map(p => p.id)));
    toast.success(`Pasted ${pastedRows.length} coil${pastedRows.length > 1 ? "s" : ""}`);
  };

  const handleSaveEditedCoil = (updated: CoilRow) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const isMulti = selected.has(updated.id) && selected.size > 1;
    const editIds = isMulti ? Array.from(selected) : [updated.id];

    const newRows = rows.map((r) => {
      if (editIds.includes(r.id)) {
        if (editIds.length > 1) {
          return {
            ...r,
            dbIn: updated.dbIn,
            wbIn: updated.wbIn,
            dbOut: updated.dbOut,
            wbOut: updated.wbOut,
            flow: updated.flow,
          };
        }
        return updated;
      }
      return r;
    });

    updateRowsWithHistory(newRows);
    setEditingCoil(null);
    toast.success(isMulti ? `Updated ${editIds.length} coils` : `Updated coil "${updated.name}"`);
  };

  // Scroll and highlight notification target item (smoothly scroll and highlight ONLY that target coil)
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanName = (targetName || "").toLowerCase().trim();

      const matched = rows.find(r => {
        const rId = String(r.id || "").toLowerCase().trim();
        const rName = String(r.name || "").toLowerCase().trim();
        if (cleanId && (rId === cleanId || rId.includes(cleanId) || cleanId.includes(rId))) return true;
        if (cleanName && (rName === cleanName || rName.includes(cleanName) || cleanName.includes(rName))) return true;
        return false;
      });

      if (matched) {
        // ONLY select and highlight this single target coil
        setSelected(new Set([matched.id]));
        setHighlightedRowId(matched.id);

        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedRowId(null);
          highlightTimeoutRef.current = null;
        }, 4000);

        setTimeout(() => {
          const el = document.getElementById(`coil-row-${matched.id}`) || document.querySelector(`[data-row-id="${matched.id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 150);
      }
    };

    // 1. Check URL parameters on mount / search params change
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
        handleScrollTarget(detail.id, detail.name);
      }
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [rows]);

  // Manual Flag / Unflag toggle handler matching Ventilation logic
  const handleToggleFlag = (idOrIds: string | string[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;

    const targetCalcRow = calculatedRows.find(r => r.id === ids[0]);
    const targetRawRow = rows.find(r => r.id === ids[0]);
    const isCurrentlyFlagged = Boolean(targetCalcRow?.isEffectivelyFlagged ?? targetRawRow?.flagged);
    const nextFlag = !isCurrentlyFlagged;

    const newRows = rows.map(r => {
      if (ids.includes(r.id)) {
        return { ...r, flagged: nextFlag };
      }
      return r;
    });

    updateRowsWithHistory(newRows);
    if (ids.length === 1) {
      const name = targetRawRow?.name || "Coil";
      toast.info(`${nextFlag ? "Flagged" : "Unflagged"} "${name}"`);
    } else {
      toast.info(`${nextFlag ? "Flagged" : "Unflagged"} ${ids.length} coils`);
    }
  };

  // Open Comment logic exactly matching Preliminary Cooling Load
  const handleOpenComment = (coil: CoilRow) => {
    setCommentTargetItem(coil);
    setCommentModalOpen(true);
  };

  // Row selection handlers
  const handleRowClick = (id: string, e: React.MouseEvent, index: number) => {
    if (e.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeIds = calculatedRows.slice(start, end + 1).map(r => r.id);
      setSelected(new Set(rangeIds));
    } else if (e.ctrlKey || e.metaKey) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastClickedIndex(index);
    } else {
      setSelected(new Set([id]));
      setLastClickedIndex(index);
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map(r => r.id)));
    }
  };

  const handleRowDoubleClick = (coil: CoilRow) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    setEditingCoil(coil);
  };

  // Keyboard shortcuts listener (Full Parity with Ventilation: Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+A, Delete, Backspace, Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+S, Ctrl+D, Escape, Arrow Up/Down, Enter/F2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Deselect all selected coils
      if (e.key === "Escape") {
        if (selected.size > 0) {
          e.preventDefault();
          setSelected(new Set());
          setLastClickedIndex(null);
        }
        return;
      }

      // Avoid intercepting when user is typing into text inputs, textareas, selects, or contenteditable
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isInput) return;

      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Ctrl+A (Select All)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (rows.length > 0) {
          setSelected(new Set(rows.map((r) => r.id)));
          toast.info(`Selected all ${rows.length} coil(s)`);
        }
        return;
      }

      // 2. Delete / Backspace (Shows confirmation popup)
      if (e.key === "Delete" || e.key === "Backspace") {
        if (isLocked) {
          toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit.", { id: "readonly-notice" });
          return;
        }
        if (selected.size > 0) {
          e.preventDefault();
          confirm(`Are you sure you want to delete the ${selected.size} selected coil(s)?`, {
            title: "Delete Coils",
            confirmText: "Delete",
            cancelText: "Cancel",
            variant: "destructive"
          }).then((ok) => {
            if (ok) {
              const count = selected.size;
              handleDeleteCoil(Array.from(selected));
              setSelected(new Set());
              setLastClickedIndex(null);
            }
          });
        }
        return;
      }

      // 3. Copy: Ctrl+C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (selected.size > 0) {
          e.preventDefault();
          handleCopyCoil();
        }
        return;
      }

      // 4. Cut: Ctrl+X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (isLocked) {
          toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit.", { id: "readonly-notice" });
          return;
        }
        if (selected.size > 0) {
          e.preventDefault();
          handleCutCoil();
        }
        return;
      }

      // 5. Paste: Ctrl+V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (isLocked) {
          toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit.", { id: "readonly-notice" });
          return;
        }
        e.preventDefault();
        handlePasteCoil();
        return;
      }

      // 6. Undo/Redo: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
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

      // 7. Save: Ctrl+S
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }

      // 8. Duplicate: Ctrl+D
      if (isCmdOrCtrl && e.key.toLowerCase() === "d" && selected.size > 0) {
        if (isLocked) {
          toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit.", { id: "readonly-notice" });
          return;
        }
        e.preventDefault();
        handleDuplicateCoil(rows.filter(x => selected.has(x.id)));
        return;
      }

      // 9. Edit: F2 / Enter (When single coil selected)
      if ((e.key === "F2" || e.key === "Enter") && selected.size === 1) {
        const singleId = Array.from(selected)[0];
        const targetCoil = rows.find(r => r.id === singleId);
        if (targetCoil) {
          e.preventDefault();
          handleRowDoubleClick(targetCoil);
        }
        return;
      }

      // 10. Arrow Up / Arrow Down Navigation
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && filteredRows.length > 0) {
        e.preventDefault();
        const currentIdx = lastClickedIndex !== null ? lastClickedIndex : 0;
        let nextIdx = e.key === "ArrowDown" ? currentIdx + 1 : currentIdx - 1;
        if (nextIdx < 0) nextIdx = 0;
        if (nextIdx >= filteredRows.length) nextIdx = filteredRows.length - 1;
        const nextCoil = filteredRows[nextIdx];
        if (nextCoil) {
          setSelected(new Set([nextCoil.id]));
          setLastClickedIndex(nextIdx);
          const el = document.getElementById(`coil-row-${nextCoil.id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    rows,
    filteredRows,
    selected,
    clipboard,
    historyIndex,
    history,
    isLocked,
    lastClickedIndex,
    confirm
  ]);

  const handleExportExcel = async () => {
    try {
      toast.loading("Generating calculation sheet...", { id: "condensate-export" });
      await exportCondensateExcel(calculatedRows, {
        calcNo: (project as any)?.calcNo || "CEC-MED-PXXX-114",
        revNo: "Rev.0",
        projectName: project?.name || "MEP Project",
        projectNo: project?.code || "P000",
        client: project?.client || "",
        endUser: (project as any)?.endUser || project?.location || "",
        unitSystem,
      });
      toast.dismiss("condensate-export");
      toast.success("Condensate calculation sheet exported successfully!");
    } catch (e) {
      console.error("Failed to export condensate excel", e);
      toast.dismiss("condensate-export");
      toast.error("Failed to export Excel calculation sheet.");
    }
  };

  const handleExportPDF = async () => {
    try {
      toast.loading("Generating calculation PDF sheet...", { id: "condensate-pdf-export" });
      await exportCondensatePDF(calculatedRows, {
        calcNo: (project as any)?.calcNo || "CEC-MED-PXXX-114",
        revNo: "Rev.0",
        projectName: project?.name || "MEP Project",
        projectNo: project?.code || "P000",
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
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; CONDENSATE CALCULATION</span>
              <div className="flex items-center gap-3 mt-0.5">
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
                />
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
                  Summary & Totals
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

                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => {
                          if (isLocked) {
                            toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to import.", { id: "readonly-notice" });
                            return;
                          }
                          setIsImportModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 h-7 text-xs font-semibold rounded-full border border-border hover:bg-surface-2 transition-colors cursor-pointer text-foreground disabled:opacity-50"
                      >
                        <Download className="size-3.5 text-primary" />
                        <span>Import</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportPDF}
                        className="inline-flex items-center gap-1.5 px-3 h-7 text-xs font-semibold rounded-full border border-border hover:bg-surface-2 transition-colors cursor-pointer text-foreground"
                      >
                        <FileText className="size-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Export PDF</span>
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={handleNewCoil}
                        className="inline-flex items-center gap-1.5 px-3 h-7 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/95 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Plus className="size-3.5" />
                        <span>New Coil</span>
                      </button>
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
                                        onClick={() => handleToggleFlag(isSelected && selected.size > 1 ? Array.from(selected) : r.id)}
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
                                        onClick={() => handleDeleteCoil(isSelected && selected.size > 1 ? Array.from(selected) : r.id)}
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
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground font-sans">Condensate Summary & Totals</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">Aggregated across all scheduled cooling coils</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Active Coils */}
                    <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between shadow-xs">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Coils</span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-3xl font-bold font-mono text-foreground">{rows.length}</span>
                          <span className="text-xs text-muted-foreground font-sans">{rows.length === 1 ? "unit" : "units"}</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                        <Layers className="size-6" />
                      </div>
                    </div>

                    {/* Total Sized Airflow */}
                    <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between shadow-xs">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Sized Airflow</span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-3xl font-bold font-mono text-foreground">{totals.totalFlow.toLocaleString()}</span>
                          <span className="text-xs font-bold text-muted-foreground">{uFlow}</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-500/10 text-[#0A7BC7]">
                        <Wind className="size-6" />
                      </div>
                    </div>

                    {/* Total Condensate Flow */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center justify-between shadow-xs">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Total Condensate Flow</span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-3xl font-bold font-mono text-primary">
                            {ip ? lpsToGpm(totals.totalCond).toFixed(4) : totals.totalCond.toFixed(4)}
                          </span>
                          <span className="text-xs font-bold text-primary">{ip ? "GPM" : "L/s"}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          ({!ip ? `${lpsToGpm(totals.totalCond).toFixed(4)} GPM` : `${totals.totalCond.toFixed(4)} L/s`})
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-primary/10 text-primary">
                        <Droplets className="size-6" />
                      </div>
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
  totals: { totalFlow: number; totalCond: number };
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
      <header className="h-12 px-4 flex items-center justify-between border-b border-border/80 bg-slate-50/50 dark:bg-slate-900/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <span className="text-[13px] font-bold text-foreground tracking-tight">Psychrometric Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto divide-y divide-border/60">
        {/* Compliance & Health */}
        <section className="p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-500" /> Psychrometric Health
            </span>
            <span className="font-mono text-xs font-bold text-foreground">{compliancePct}% Valid</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${compliancePct === 100 ? "bg-emerald-500" : compliancePct >= 70 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${compliancePct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {totalCoils === 0
              ? "Add cooling coils to verify thermodynamic states and calculate drainage loads."
              : `${validCoilsCount} of ${totalCoils} cooling coils have verified thermodynamic psychrometric states.`}
          </p>
        </section>

        {/* Aggregate Drainage Load */}
        <section className="p-4 flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Droplets className="size-3.5 text-primary" /> Total Drainage Load
          </span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Condensate</span>
              <div className="font-mono font-bold text-sm text-primary mt-0.5">
                {ip ? `${totalGpm.toFixed(4)} GPM` : `${totals.totalCond.toFixed(4)} L/s`}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                ({!ip ? `${totalGpm.toFixed(4)} GPM` : `${totals.totalCond.toFixed(4)} L/s`})
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Airflow</span>
              <div className="font-mono font-bold text-sm text-foreground mt-0.5">
                {totals.totalFlow.toLocaleString()} {uFlow}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {totalCoils} active unit{totalCoils === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </section>

        {/* Recommended Pipe Sizing (ASHRAE / IPC) */}
        <section className="p-4 flex flex-col gap-2">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setOpenSections(prev => ({ ...prev, pipeSizing: !prev.pipeSizing }))}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gauge className="size-3.5 text-[#0A7BC7]" /> Pipe Sizing Guide
            </span>
            {openSections.pipeSizing ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.pipeSizing && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">Main Header Size</span>
                  <span className="font-mono font-bold text-sm text-primary">
                    {recommendedPipe.metricDn} ({recommendedPipe.sizeInch})
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>Rated flow capacity:</span>
                  <span className="font-mono font-semibold text-foreground">{recommendedPipe.capacityGpm}</span>
                </div>
              </div>

              <div className="text-[11.5px] text-muted-foreground space-y-1 bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-border/60">
                <div className="flex items-center justify-between">
                  <span>Min. Gravity Slope:</span>
                  <span className="font-mono font-bold text-foreground">1% (1:100 / 1/8" per ft)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>P-Trap Water Seal:</span>
                  <span className="font-mono font-bold text-foreground">≥ 50 mm (2.0")</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Insulation:</span>
                  <span className="font-semibold text-foreground">13 mm Closed-Cell Elastomeric</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Calculation Issues & Flagged Coils */}
        <section className="p-4 flex flex-col gap-2">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setOpenSections(prev => ({ ...prev, issues: !prev.issues }))}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className={`size-3.5 ${flaggedCoils.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              Diagnostics & Flags ({flaggedCoils.length})
            </span>
            {openSections.issues ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.issues && (
            <div className="flex flex-col gap-2 mt-1">
              {flaggedCoils.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-border/60">
                  No psychrometric anomalies or flagged coils detected.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {flaggedCoils.map((c) => {
                    const reasons = c.missingReasons && c.missingReasons.length > 0
                      ? c.missingReasons.join(", ")
                      : "Manually flagged for review";
                    return (
                      <div
                        key={c.id}
                        onClick={() => onSelectCoil(c.id)}
                        className="flex items-start justify-between p-2 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 cursor-pointer transition-colors"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                          <span className="text-xs font-bold text-foreground truncate">{c.name || "Unnamed Coil"}</span>
                          <span className="text-[10.5px] text-red-600 dark:text-red-400 line-clamp-1">{reasons}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditCoil(c);
                          }}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                          title="Edit coil"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Top Condensate Contributors */}
        <section className="p-4 flex flex-col gap-2">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setOpenSections(prev => ({ ...prev, topContributors: !prev.topContributors }))}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3.5 text-primary" /> Top Condensate Loads
            </span>
            {openSections.topContributors ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.topContributors && (
            <div className="flex flex-col gap-1.5 mt-1">
              {rankedCoils.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-border/60">
                  No condensate loads calculated yet.
                </div>
              ) : (
                rankedCoils.map((c, i) => {
                  const coilGpm = lpsToGpm(c.condFlow || 0);
                  const pct = totals.totalCond > 0 ? Math.round(((c.condFlow || 0) / totals.totalCond) * 100) : 0;
                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelectCoil(c.id)}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/30 hover:bg-accent border border-border/60 cursor-pointer transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                        <span className="font-semibold text-foreground">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-primary font-bold">{ip ? `${coilGpm.toFixed(4)} GPM` : `${(c.condFlow || 0).toFixed(4)} L/s`}</span>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{pct}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* Engineering Standard Notes */}
        <section className="p-4 flex flex-col gap-2">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setOpenSections(prev => ({ ...prev, engineeringNotes: !prev.engineeringNotes }))}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Info className="size-3.5 text-muted-foreground" /> Standards & Psychrometrics
            </span>
            {openSections.engineeringNotes ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.engineeringNotes && (
            <div className="text-[11.5px] text-muted-foreground space-y-1.5 bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-border/60 mt-1 leading-relaxed">
              <p>• <strong>ASHRAE Saturation Pressure Model:</strong> Uses polynomial exponential saturation vapor pressure calculations calibrated at 101.325 kPa standard sea-level barometric pressure.</p>
              <p>• <strong>Moisture Extraction Formula:</strong> Moisture extraction is computed via &m_dot;<sub>w</sub> = &m_dot;<sub>a</sub> &times; (W<sub>in</sub> &minus; W<sub>out</sub>), assuming standard dry air density &rho; = 1.20 kg/m&sup3;.</p>
              <p>• <strong>Compliance Code:</strong> Sized in conformance with International Plumbing Code (IPC) Chapter 307 &amp; ASHRAE Handbook Fundamentals.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
