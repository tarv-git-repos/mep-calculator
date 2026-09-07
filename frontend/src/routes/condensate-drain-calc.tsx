import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
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

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    dirtyStore.set(true);
    if ((window as any).__mep_keep_values) return;
    const convT = (t: number) => unit === "ip" ? cToF(t) : fToC(t);
    const convF = (f: number) => unit === "ip" ? lpsToCfm(f) : cfmToLps(f);

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

  // Keyboard shortcuts listener (Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+A, Delete, Ctrl+Z, Ctrl+Y, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting input fields
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(rows.map(r => r.id)));
      } else if (e.key === "Escape") {
        setSelected(new Set());
      } else if (e.key === "Delete" && selected.size > 0) {
        e.preventDefault();
        handleDeleteCoil(Array.from(selected));
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "c") {
        if (selected.size > 0) {
          e.preventDefault();
          handleCopyCoil();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "x") {
        if (selected.size > 0) {
          e.preventDefault();
          handleCutCoil();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "v") {
        if (clipboard.length > 0) {
          e.preventDefault();
          handlePasteCoil();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (isCtrlOrCmd && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, clipboard, historyIndex, history, isLocked]);

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
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6 animate-in fade-in-50 duration-200">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0 select-none">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; CONDENSATE CALCULATION</span>
              <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                <div className="flex items-baseline gap-2 shrink-0">
                  <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-foreground whitespace-nowrap">Coil Condensate Calculator</h1>
                  <span className="text-[14px] sm:text-[15px] font-semibold text-muted-foreground whitespace-nowrap">{rows.length} {rows.length === 1 ? "coil" : "coils"}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIntelOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12px] sm:text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  Intelligence
                </button>
                <CalculationReviewBar projectId={project?.id} calculatorPath="/condensate-drain-calc" calculatorTitle="Coil Condensate Calculator" />
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Input entering and leaving air conditions for multiple cooling coils to formulate aggregate condensate drainage loads.
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={handleUndo}
                disabled={isLocked || historyIndex <= 0}
                title="Undo (Ctrl+Z)"
                className="p-2 border border-border/80 rounded-xl bg-card hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
              >
                <Undo className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={isLocked || historyIndex >= history.length - 1}
                title="Redo (Ctrl+Y)"
                className="p-2 border border-border/80 rounded-xl bg-card hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
              >
                <Redo className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLocked) {
                    toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
                    return;
                  }
                  setIsImportModalOpen(true);
                }}
                disabled={isLocked}
                className="flex items-center gap-1.5 border border-border/80 bg-card hover:bg-accent text-foreground rounded-xl px-3 py-2 text-[12.5px] font-bold transition cursor-pointer shadow-xs disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="size-4 text-primary" />
                <span>Import</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 border border-border/80 bg-card hover:bg-accent text-foreground rounded-xl px-3 py-2 text-[12.5px] font-bold transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 border border-border/80 bg-card hover:bg-accent text-foreground rounded-xl px-3 py-2 text-[12.5px] font-bold transition cursor-pointer shadow-xs"
              >
                <FileText className="size-4 text-rose-600 dark:text-rose-400" />
                <span>Export PDF</span>
              </button>
              <button
                onClick={handleSaveCurrent}
                className="flex items-center gap-1.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-all border-0 cursor-pointer shadow-sm animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap"
              >
                <Save className="size-4" />
                <span>Save</span>
                <span className="hidden xl:inline">Calculation</span>
              </button>
            </div>
          </div>

          {/* Unit Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-border/60 self-start select-none">
            <button type="button" onClick={() => handleUnitSystemChange("ip")} disabled={isLocked} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-60 ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
            <button type="button" onClick={() => handleUnitSystemChange("si")} disabled={isLocked} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-60 ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
          </div>

          {/* Moisture Extraction Schedule Full-Width Card */}
          <div className="bg-card border border-border rounded-2xl shadow-xs p-5 flex flex-col gap-5">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Moisture Extraction Schedule</h3>
                <span className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold text-muted-foreground">
                  {rows.length} {rows.length === 1 ? "coil" : "coils"}
                </span>
              </div>
            </div>

            {/* Add Coil Form - Responsive Grid Layout */}
            <div className="bg-slate-50/80 dark:bg-slate-950/20 p-3.5 border border-border/80 rounded-xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 items-end text-xs">
              <div className="col-span-2 sm:col-span-1 lg:col-span-1 flex flex-col gap-1 min-w-0">
                <label className="font-semibold text-muted-foreground font-sans text-[11px] truncate">Unit Ref</label>
                <input
                  type="text"
                  placeholder="e.g. AHU-2"
                  disabled={isLocked}
                  value={newCoil.name}
                  onChange={e => setNewCoil({ ...newCoil, name: e.target.value })}
                  onKeyDown={e => { if (e.key === "Enter") handleAddCoil(); }}
                  className="h-8.5 w-full bg-background border border-border/80 rounded-lg px-2.5 text-xs font-bold outline-none focus:border-[#0A7BC7] disabled:opacity-60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label className="font-semibold text-muted-foreground font-sans text-[11px] truncate">On DB ({uTemp})</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={isLocked}
                  value={newCoil.dbIn}
                  placeholder={ip ? "75.2" : "24.0"}
                  onChange={e => setNewCoil({ ...newCoil, dbIn: e.target.value === "" ? "" : Number(e.target.value) })}
                  onKeyDown={e => { if (e.key === "Enter") handleAddCoil(); }}
                  className="h-8.5 w-full bg-background border border-border/80 rounded-lg px-2 text-xs font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal disabled:opacity-60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label className="font-semibold text-muted-foreground font-sans text-[11px] truncate">On WB ({uTemp})</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={isLocked}
                  value={newCoil.wbIn}
                  placeholder={ip ? "62.6" : "17.0"}
                  onChange={e => setNewCoil({ ...newCoil, wbIn: e.target.value === "" ? "" : Number(e.target.value) })}
                  onKeyDown={e => { if (e.key === "Enter") handleAddCoil(); }}
                  className="h-8.5 w-full bg-background border border-border/80 rounded-lg px-2 text-xs font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal disabled:opacity-60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label className="font-semibold text-muted-foreground font-sans text-[11px] truncate">Off DB ({uTemp})</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={isLocked}
                  value={newCoil.dbOut}
                  placeholder={ip ? "57.2" : "14.0"}
                  onChange={e => setNewCoil({ ...newCoil, dbOut: e.target.value === "" ? "" : Number(e.target.value) })}
                  onKeyDown={e => { if (e.key === "Enter") handleAddCoil(); }}
                  className="h-8.5 w-full bg-background border border-border/80 rounded-lg px-2 text-xs font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal disabled:opacity-60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label className="font-semibold text-muted-foreground font-sans text-[11px] truncate">Off WB ({uTemp})</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={isLocked}
                  value={newCoil.wbOut}
                  placeholder={ip ? "55.4" : "13.0"}
                  onChange={e => setNewCoil({ ...newCoil, wbOut: e.target.value === "" ? "" : Number(e.target.value) })}
                  onKeyDown={e => { if (e.key === "Enter") handleAddCoil(); }}
                  className="h-8.5 w-full bg-background border border-border/80 rounded-lg px-2 text-xs font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal disabled:opacity-60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label className="font-semibold text-muted-foreground font-sans text-[11px] truncate">Airflow ({uFlow})</label>
                <input
                  type="number"
                  step="1"
                  disabled={isLocked}
                  value={newCoil.flow}
                  placeholder={ip ? "1000" : "500"}
                  onChange={e => setNewCoil({ ...newCoil, flow: e.target.value === "" ? "" : Number(e.target.value) })}
                  onKeyDown={e => { if (e.key === "Enter") handleAddCoil(); }}
                  className="h-8.5 w-full bg-background border border-border/80 rounded-lg px-2 text-xs font-bold outline-none focus:border-[#0A7BC7] placeholder:text-muted-foreground/45 placeholder:font-normal disabled:opacity-60 transition-all"
                />
              </div>
              <div className="col-span-2 sm:col-span-1 lg:col-span-1 flex flex-col justify-end">
                <button
                  type="button"
                  onClick={handleAddCoil}
                  disabled={isLocked}
                  className="h-8.5 bg-[#0A7BC7] text-white px-3 font-bold rounded-lg hover:bg-[#06456F] cursor-pointer flex items-center justify-center gap-1.5 transition-colors w-full text-xs shadow-xs shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="whitespace-nowrap font-sans font-bold">Add Coil</span>
                </button>
              </div>
            </div>

            {/* Bulk actions bar overlay exactly matching Ventilation */}
            {selected.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#eef6fc] dark:bg-[#0c2233] border border-[#d0e5f5] dark:border-[#143750] rounded-xl text-[12px] text-[#06456F] dark:text-[#0A7BC7] animate-in fade-in duration-150 select-none">
                <span className="font-semibold">{selected.size} selected</span>
                <span className="text-[#06456F]/30 dark:text-[#0A7BC7]/30">·</span>
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

            {/* Coils Table with Multi-Selection, Double-Click, Flagging & Context Menu */}
            <div className="overflow-x-auto border border-border/60 rounded-xl">
              <table className="w-full text-xs text-left border-collapse select-none">
                <thead>
                  <tr className="border-b border-border/70 bg-slate-50/70 dark:bg-slate-900/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center"
                        title={selected.size === rows.length ? "Deselect All" : "Select All"}
                      >
                        {selected.size > 0 && selected.size === rows.length ? (
                          <CheckSquare className="size-4 text-[#0A7BC7]" />
                        ) : (
                          <Square className="size-4 text-muted-foreground/60" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Unit Ref</th>
                    <th className="py-2.5 px-3">Entering DB/WB</th>
                    <th className="py-2.5 px-3">Leaving DB/WB</th>
                    <th className="py-2.5 px-3">Air Flow</th>
                    <th className="py-2.5 px-3">W_in (kg/kg)</th>
                    <th className="py-2.5 px-3">W_out (kg/kg)</th>
                    <th className="py-2.5 px-3 text-primary font-bold">Condensate ({ip ? "GPM" : "L/s"})</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                    <th className="py-2.5 px-2 w-10 text-center" title="Flag coil for attention"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {calculatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground font-sans text-xs">
                        No cooling coils added. Use the form above to add a coil to the schedule.
                      </td>
                    </tr>
                  ) : (
                    calculatedRows.map((r, idx) => {
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
                                  : isFlagged
                                  ? "bg-red-500/[0.04] dark:bg-red-950/20 border-l-2 border-l-red-500/80 hover:bg-red-500/[0.08]"
                                  : "hover:bg-slate-50/80 dark:hover:bg-slate-900/30"
                              }`}
                            >
                              {/* 1. Checkbox */}
                              <td className="py-2.5 px-3 text-center" onClick={(e) => handleToggleSelectRow(r.id, e)}>
                                {isSelected ? (
                                  <CheckSquare className="size-4 text-[#0A7BC7] inline" />
                                ) : (
                                  <Square className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground inline" />
                                )}
                              </td>

                              {/* 2. Unit Ref */}
                              <td className="py-2.5 px-3 font-sans font-semibold text-[13px] text-foreground">
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
                              <td className="py-2.5 px-3 text-[13px] font-mono">
                                {r.dbIn}/{r.wbIn} {uTemp}
                              </td>

                              {/* 4. Leaving DB/WB */}
                              <td className="py-2.5 px-3 text-[13px] font-mono">
                                {r.dbOut}/{r.wbOut} {uTemp}
                              </td>

                              {/* 5. Air Flow */}
                              <td className="py-2.5 px-3 text-[13px] font-mono">
                                {r.flow.toLocaleString()} {uFlow}
                              </td>

                              {/* 6. W_in */}
                              <td className="py-2.5 px-3 text-[13px] font-mono">{r.wIn.toFixed(6)}</td>

                              {/* 7. W_out */}
                              <td className="py-2.5 px-3 text-[13px] font-mono">{r.wOut.toFixed(6)}</td>

                              {/* 8. Condensate Flow */}
                              <td className="py-2.5 px-3 text-[13px] font-mono font-bold text-primary">
                                {ip ? lpsToGpm(r.condFlow).toFixed(5) : r.condFlow.toFixed(5)} {ip ? "GPM" : "L/s"}
                              </td>

                              {/* 9. Actions */}
                              <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleRowDoubleClick(r)}
                                    title="Edit Coil Properties (Double-Click)"
                                    className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent transition cursor-pointer"
                                  >
                                    <Edit3 className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenComment(r)}
                                    title="Add Comment / Task"
                                    className="p-1 text-muted-foreground hover:text-blue-600 rounded hover:bg-accent transition cursor-pointer"
                                  >
                                    <MessageSquare className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCoil(r.id)}
                                    title="Delete Coil"
                                    className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10 transition cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* 10. Flag Column (Far Right Column, exactly matching Ventilation) */}
                              <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                  className="p-1.5 rounded-lg hover:bg-muted/80 transition-all cursor-pointer group inline-flex items-center justify-center"
                                >
                                  <Flag
                                    className={`size-3.5 transition-all duration-200 ${
                                      isFlagged
                                        ? "fill-red-500 text-red-500 scale-110 drop-shadow-xs"
                                        : "text-muted-foreground/30 hover:text-red-500/70 group-hover:scale-110"
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
          </div>

          {/* Totals Summary - Optimized Section Positioned Below Moisture Extraction Schedule */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Totals Summary</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">Aggregated across all scheduled coils</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Active Coils */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-4 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Coils</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold font-mono text-foreground">{rows.length}</span>
                    <span className="text-xs text-muted-foreground font-sans">{rows.length === 1 ? "unit" : "units"}</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-200/60 dark:bg-slate-800 text-muted-foreground">
                  <Layers className="size-5" />
                </div>
              </div>

              {/* Total Sized Airflow */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-4 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Sized Airflow</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold font-mono text-foreground">{totals.totalFlow.toLocaleString()}</span>
                    <span className="text-xs font-bold text-muted-foreground">{uFlow}</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-[#0A7BC7]">
                  <Wind className="size-5" />
                </div>
              </div>

              {/* Total Condensate Flow */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Total Condensate Flow</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold font-mono text-primary">
                      {ip ? lpsToGpm(totals.totalCond).toFixed(4) : totals.totalCond.toFixed(4)}
                    </span>
                    <span className="text-xs font-bold text-primary">{ip ? "GPM" : "L/s"}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    ({!ip ? `${lpsToGpm(totals.totalCond).toFixed(4)} GPM` : `${totals.totalCond.toFixed(4)} L/s`})
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Droplets className="size-5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 mr-4 ml-0 border border-border rounded-2xl bg-card shadow-lg" : "w-0"
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
