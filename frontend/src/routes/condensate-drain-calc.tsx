import { CalculationReviewBar, useCalculationLock, useCalculationReviewState, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { cToF, fToC, lpsToCfm, cfmToLps, lpsToGpm } from "@/utils/conversions";
import { 
  calculateCondensateRows, 
  calculateCondensateTotals, 
  getCoilMissingReasons, 
  checkIfCoilMissingData,
  wFromWB,
  satP
} from "@/lib/calc-condensate-drain";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
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
  ChevronUp,
  ChevronRight,
  Scissors,
  Clipboard,
  Printer,
  TrendingUp,
  Check,
  ShieldCheck,
  BookOpen,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  Sliders,
  RefreshCw,
  GroupIcon,
  Calculator,
  ArrowRight,
  HelpCircle,
  Scale,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
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
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { EditCoilModal, type CoilRow } from "@/components/workspace/EditCoilModal";
import { ImportCoilModal } from "@/components/workspace/ImportCoilModal";
import { exportCondensatePDF } from "@/lib/exportCondensatePDF";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";

// IPC Pipe Sizing Matrix Table Data (IPC Section 307 / ASHRAE standard)
const IPC_PIPE_TABLE = [
  { sizeInch: '3/4"', dn: "DN20", maxGpm: 0.05, maxLps: 0.00315, tonnage: "< 20 Tons" },
  { sizeInch: '1"', dn: "DN25", maxGpm: 0.20, maxLps: 0.0126, tonnage: "20 – 40 Tons" },
  { sizeInch: '1-1/4"', dn: "DN32", maxGpm: 0.50, maxLps: 0.0315, tonnage: "40 – 90 Tons" },
  { sizeInch: '1-1/2"', dn: "DN40", maxGpm: 1.20, maxLps: 0.0757, tonnage: "90 – 125 Tons" },
  { sizeInch: '2"', dn: "DN50", maxGpm: 3.00, maxLps: 0.1893, tonnage: "125 – 250 Tons" },
  { sizeInch: '2-1/2"', dn: "DN65", maxGpm: 6.00, maxLps: 0.3785, tonnage: "250 – 450 Tons" },
  { sizeInch: '3"', dn: "DN80", maxGpm: 12.00, maxLps: 0.7571, tonnage: "> 450 Tons" },
];

export const Route = createFileRoute("/condensate-drain-calc")({
  head: () => ({
    meta: [
      { title: "Coil Condensate Calculator — MEP Calc" },
      { name: "description", content: "AC cooling coil condensation schedule sizer and total moisture calculator." },
    ],
  }),
  component: CondensateDrainCalcPage,
});



interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
}

function InlineInput({
  value,
  onCommit,
  className = "",
  type = "text",
  step,
  min,
  max,
  placeholder,
  disabled
}: InlineInputProps) {
  const isReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly);
  const isEffectiveDisabled = disabled || isReadOnly;

  const getCleanVal = (val: any) => {
    if (val === undefined || val === null || val === "undefined" || val === "null") {
      return "";
    }
    return String(val);
  };

  const [localVal, setLocalVal] = useState(getCleanVal(value));

  useEffect(() => {
    const clean = getCleanVal(value);
    setLocalVal(prev => (prev === clean ? prev : clean));
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!isEffectiveDisabled && localVal !== getCleanVal(value)) {
        onCommit(localVal);
      }
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setLocalVal(getCleanVal(value));
      e.currentTarget.blur();
    }
  };

  const hasCustomWidth = className.includes("w-") && !className.includes("w-full");

  return (
    <input
      type={type}
      step={step}
      min={min}
      max={max}
      disabled={isEffectiveDisabled}
      placeholder={placeholder}
      value={localVal}
      onChange={(e) => {
        if (isEffectiveDisabled) return;
        setLocalVal(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (isEffectiveDisabled) {
          setLocalVal(getCleanVal(value));
          return;
        }
        if (localVal !== getCleanVal(value)) {
          onCommit(localVal);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
      }}
      className={`bg-transparent ${!hasCustomWidth ? "w-full" : ""} border border-transparent py-0.5 px-1 rounded text-foreground transition-colors ${
        isEffectiveDisabled
          ? "cursor-not-allowed opacity-75 select-none hover:border-transparent focus:border-transparent"
          : "hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 cursor-text"
      } ${className}`}
    />
  );
}

const DEFAULT_COILS: CoilRow[] = [
  { id: "coil-1", name: "AHU-01", dbIn: 24.0, wbIn: 18.0, dbOut: 13.0, wbOut: 12.0, flow: 1500, comments: [] },
  { id: "coil-2", name: "FCU-01", dbIn: 24.0, wbIn: 17.0, dbOut: 14.0, wbOut: 13.0, flow: 400, comments: [] },
  { id: "coil-3", name: "Coil 3", dbIn: 24.0, wbIn: 17.0, dbOut: 14.0, wbOut: 13.0, flow: 500, comments: [] }
];

function CondensateDrainCalcPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const { user, userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";
  const confirm = useConfirm();
  const prompt = usePrompt();
  const effectiveProjectId = activeProjectId || project?.id || "default";
  const isLocked = useCalculationLock("/condensate-drain-calc", effectiveProjectId);
  const calcReviewState = useCalculationReviewState("/condensate-drain-calc", effectiveProjectId);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  
  const [rows, setRows] = useState<CoilRow[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const pId = effectiveProjectId;
        const stored = localStorage.getItem(`mep_condensate_calc_${pId}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (Array.isArray(data.rows) && data.rows.length > 0) {
            return data.rows;
          }
        }
      } catch (e) {}
    }
    return DEFAULT_COILS;
  });

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  // Selection & UI State
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const highlightTimeoutRef = React.useRef<any>(null);
  const [clipboard, setClipboard] = useState<CoilRow[]>([]);
  const [editingCoil, setEditingCoil] = useState<CoilRow | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [tab, setTab] = useState<"coils" | "report">("coils");
  const [query, setQuery] = useState("");
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>("default");

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterFlaggedOnly) count++;
    return count;
  }, [filterFlaggedOnly]);
  
  // Comment & Task Modal State matching Preliminary Cooling Load
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<CoilRow | null>(null);
  
  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Undo / Redo history
  const [history, setHistory] = useState<CoilRow[][]>([DEFAULT_COILS]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const getCoilEditIds = (rId: string): string[] => {
    return selected.has(rId) ? Array.from(selected) : [rId];
  };

  const handleUpdateCoilField = (id: string, field: keyof CoilRow, val: string | number) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }

    const editIds = selected.has(id) && selected.size > 1 ? Array.from(selected) : [id];
    const editSet = new Set(editIds);

    const numFields: (keyof CoilRow)[] = ["dbIn", "wbIn", "dbOut", "wbOut", "flow"];
    const isNum = numFields.includes(field);

    let parsedVal: any = val;
    if (isNum) {
      if (val === "" || val === undefined || val === null) {
        parsedVal = "";
      } else {
        const num = parseFloat(String(val));
        parsedVal = isNaN(num) ? "" : num;
      }
    }

    setRows(prevRows => {
      const base = prevRows && prevRows.length > 0 ? prevRows : DEFAULT_COILS;
      const newRows = base.map((r) => {
        if (!editSet.has(r.id)) return r;
        if (field === "name" && editIds.length > 1 && r.id !== id) return r;
        const updatedRow = { ...r, [field]: parsedVal };
        const wasMissing = checkIfCoilMissingData(r);
        const isMissing = checkIfCoilMissingData(updatedRow);
        let flagged = updatedRow.flagged;
        if (isMissing) {
          flagged = true;
        } else if (wasMissing && !isMissing) {
          flagged = false;
        }
        return { ...updatedRow, flagged };
      });
      dirtyStore.set(true);
      setHistory(prevH => {
        const sliced = prevH.slice(0, historyIndex + 1);
        return [...sliced, newRows];
      });
      setHistoryIndex(prevIdx => prevIdx + 1);
      return newRows;
    });
  };

  const bulkUpdateCoils = (ids: string[], updates: Partial<CoilRow>) => {
    const editSet = new Set(ids);
    setRows(prevRows => {
      const base = prevRows && prevRows.length > 0 ? prevRows : DEFAULT_COILS;
      const newRows = base.map(r => {
        if (!editSet.has(r.id)) return r;
        const updatedRow = { ...r, ...updates };
        const wasMissing = checkIfCoilMissingData(r);
        const isMissing = checkIfCoilMissingData(updatedRow);
        let flagged = updatedRow.flagged;
        if (isMissing) {
          flagged = true;
        } else if (wasMissing && !isMissing) {
          flagged = false;
        }
        return { ...updatedRow, flagged };
      });
      dirtyStore.set(true);
      setHistory(prevH => {
        const sliced = prevH.slice(0, historyIndex + 1);
        return [...sliced, newRows];
      });
      setHistoryIndex(prevIdx => prevIdx + 1);
      return newRows;
    });
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
    const pId = effectiveProjectId;
    try {
      const stored = localStorage.getItem(`mep_condensate_calc_${pId}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
          setRows(data.rows);
          setHistory([data.rows]);
          setHistoryIndex(0);
        } else {
          setRows(DEFAULT_COILS);
          setHistory([DEFAULT_COILS]);
          setHistoryIndex(0);
        }
      } else {
        setUnitSystem("si");
        setRows(DEFAULT_COILS);
        setHistory([DEFAULT_COILS]);
        setHistoryIndex(0);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load condensate calculation", e);
    }
    setLoadedProjectId(pId);
  }, [project?.id, activeProjectId]);

  // Version History Restore Listener (Full parity with Ventilation & VersionManager)
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = `mep_condensate_calc_${project?.id || activeProjectId || "default"}`;
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
        if (restoredRows && Array.isArray(restoredRows) && restoredRows.length > 0) {
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
  }, [project?.id, activeProjectId]);

  useEffect(() => {
    const pId = project?.id || activeProjectId || "default";
    if (loadedProjectId === pId && rows && rows.length > 0) {
      const dataToSave = {
        unitSystem,
        rows
      };
      localStorage.setItem(`mep_condensate_calc_${pId}`, JSON.stringify(dataToSave));
    }
  }, [project?.id, activeProjectId, loadedProjectId, unitSystem, rows]);

  const ip = unitSystem === "ip";
  const uTemp = ip ? "°F" : "°C";
  const uFlow = ip ? "CFM" : "L/s";
  const uCond = ip ? "GPM" : "L/s";

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);
    dirtyStore.set(true);

    if (shouldConvert) {
      const convT = (t: any) => {
        const n = Number(t);
        if (isNaN(n) || t === "" || t === undefined || t === null) return "";
        const converted = targetUnit === "ip" ? cToF(n) : fToC(n);
        return isNaN(converted) ? "" : Number(converted.toFixed(1));
      };
      const convF = (f: any) => {
        const n = Number(f);
        if (isNaN(n) || f === "" || f === undefined || f === null) return "";
        const converted = targetUnit === "ip" ? lpsToCfm(n) : cfmToLps(n);
        return isNaN(converted) ? "" : Number(converted.toFixed(0));
      };

      const converted = rows.map(r => ({
        ...r,
        dbIn: convT(r.dbIn),
        wbIn: convT(r.wbIn),
        dbOut: convT(r.dbOut),
        wbOut: convT(r.wbOut),
        flow: convF(r.flow)
      }));

      updateRowsWithHistory(converted);
    }
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  const calculatedRows = useMemo(() => calculateCondensateRows(rows, ip), [rows, ip]);

  const totals = useMemo(() => calculateCondensateTotals(calculatedRows, rows), [calculatedRows, rows]);

  // Total count of all comments across all coils
  const totalCommentsCount = useMemo(() => {
    return rows.reduce((acc, r) => acc + (Array.isArray(r.comments) ? r.comments.length : 0), 0);
  }, [rows]);

  const firstCommentedCoil = useMemo(() => {
    return rows.find(r => Array.isArray(r.comments) && r.comments.length > 0);
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = calculatedRows.filter((r) => {
      if (filterFlaggedOnly && !r.isEffectivelyFlagged && !r.flagged && !r.isAutoFlagged) return false;
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

    if (sortBy === "name-asc") {
      list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true }));
    } else if (sortBy === "name-desc") {
      list = [...list].sort((a, b) => (b.name || "").localeCompare(a.name || "", undefined, { numeric: true }));
    } else if (sortBy === "flow-desc") {
      list = [...list].sort((a, b) => (Number(b.flow) || 0) - (Number(a.flow) || 0));
    } else if (sortBy === "flow-asc") {
      list = [...list].sort((a, b) => (Number(a.flow) || 0) - (Number(b.flow) || 0));
    } else if (sortBy === "cond-desc") {
      list = [...list].sort((a, b) => (Number(b.condFlow) || 0) - (Number(a.condFlow) || 0));
    } else if (sortBy === "cond-asc") {
      list = [...list].sort((a, b) => (Number(a.condFlow) || 0) - (Number(b.condFlow) || 0));
    }

    return list;
  }, [calculatedRows, query, filterFlaggedOnly, sortBy]);

  const handleToggleSelectAll = () => {
    if (isLocked) {
      toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
      return;
    }
    if (selected.size === filteredRows.length && filteredRows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRows.map((r) => r.id)));
    }
  };

  const handleToggleSelectRow = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    if (isLocked) {
      toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (isCtrl) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else if (isShift && filteredRows.length > 0) {
        const lastId = Array.from(next).pop();
        const lastIdx = filteredRows.findIndex((r) => r.id === lastId);
        const curIdx = filteredRows.findIndex((r) => r.id === id);
        if (lastIdx !== -1 && curIdx !== -1) {
          const start = Math.min(lastIdx, curIdx);
          const end = Math.max(lastIdx, curIdx);
          for (let i = start; i <= end; i++) {
            next.add(filteredRows[i].id);
          }
        } else {
          next.add(id);
        }
      } else {
        if (next.has(id) && next.size === 1) {
          next.clear();
        } else {
          next.clear();
          next.add(id);
        }
      }
      return next;
    });
  };

  const columns: Column<any>[] = useMemo(() => [
    {
      key: "name",
      header: "UNIT REF",
      width: 240,
      editable: true,
      render: (r: any) => (
        <div className="flex items-center gap-1.5 w-full">
          {Array.isArray(r.comments) && r.comments.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenComment(r);
              }}
              title={`${r.comments.length} comment(s)/task(s) assigned to coil "${r.name}"`}
              className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
            >
              <MessageSquare className="size-3.5 fill-blue-500/20" />
              <span className="text-[10px] font-bold">{r.comments.length}</span>
            </button>
          )}
          <InlineInput
            type="text"
            value={r.name}
            disabled={isLocked}
            onCommit={(val) => handleUpdateCoilField(r.id, "name", val)}
            className="font-medium text-[13.5px] flex-1 min-w-0"
            placeholder="Unit Ref / Tag"
          />
        </div>
      ),
    },
    {
      key: "dbIn",
      header: `ENTERING DB/WB (${uTemp})`,
      width: 140,
      align: "center",
      mono: true,
      editable: true,
      render: (r: any) => (
        <div className="flex items-center justify-center gap-0.5 w-full select-none" onClick={(e) => e.stopPropagation()}>
          <InlineInput
            type="number"
            step="0.1"
            value={r.dbIn}
            disabled={isLocked}
            onCommit={(val) => handleUpdateCoilField(r.id, "dbIn", val)}
            className="w-11 text-center font-mono tabular text-[13.5px] px-0.5"
            placeholder="DB"
          />
          <span className="text-muted-foreground/50 font-mono text-xs select-none px-0.5">/</span>
          <InlineInput
            type="number"
            step="0.1"
            value={r.wbIn}
            disabled={isLocked}
            onCommit={(val) => handleUpdateCoilField(r.id, "wbIn", val)}
            className="w-11 text-center font-mono tabular text-[13.5px] px-0.5"
            placeholder="WB"
          />
        </div>
      ),
    },
    {
      key: "dbOut",
      header: `LEAVING DB/WB (${uTemp})`,
      width: 140,
      align: "center",
      mono: true,
      editable: true,
      render: (r: any) => (
        <div className="flex items-center justify-center gap-0.5 w-full select-none" onClick={(e) => e.stopPropagation()}>
          <InlineInput
            type="number"
            step="0.1"
            value={r.dbOut}
            disabled={isLocked}
            onCommit={(val) => handleUpdateCoilField(r.id, "dbOut", val)}
            className="w-11 text-center font-mono tabular text-[13.5px] px-0.5"
            placeholder="DB"
          />
          <span className="text-muted-foreground/50 font-mono text-xs select-none px-0.5">/</span>
          <InlineInput
            type="number"
            step="0.1"
            value={r.wbOut}
            disabled={isLocked}
            onCommit={(val) => handleUpdateCoilField(r.id, "wbOut", val)}
            className="w-11 text-center font-mono tabular text-[13.5px] px-0.5"
            placeholder="WB"
          />
        </div>
      ),
    },
    {
      key: "flow",
      header: `AIR FLOW (${uFlow})`,
      width: 130,
      align: "center",
      mono: true,
      editable: true,
      render: (r: any) => (
        <div className="flex items-center justify-center w-full" onClick={(e) => e.stopPropagation()}>
          <InlineInput
            type="number"
            step="1"
            min={0}
            value={r.flow}
            disabled={isLocked}
            onCommit={(val) => handleUpdateCoilField(r.id, "flow", val)}
            className="w-24 text-center font-mono tabular text-[13.5px]"
            placeholder="0"
          />
        </div>
      ),
    },
    {
      key: "wIn",
      header: "W_IN (KG/KG)",
      width: 120,
      align: "center",
      mono: true,
      render: (r: any) => (
        <span className="text-muted-foreground font-mono tabular text-[13.5px] text-center block w-full">{Number(r.wIn || 0).toFixed(6)}</span>
      ),
    },
    {
      key: "wOut",
      header: "W_OUT (KG/KG)",
      width: 120,
      align: "center",
      mono: true,
      render: (r: any) => (
        <span className="text-muted-foreground font-mono tabular text-[13.5px] text-center block w-full">{Number(r.wOut || 0).toFixed(6)}</span>
      ),
    },
    {
      key: "condFlow",
      header: `CONDENSATE (${uCond})`,
      width: 145,
      align: "center",
      mono: true,
      render: (r: any) => (
        <span className="font-bold text-primary font-mono tabular text-[13.5px] text-center block w-full">
          {(ip ? lpsToGpm(r.condFlow || 0) : Number(r.condFlow || 0)).toFixed(5)}
        </span>
      ),
    },
    {
      key: "flagged",
      header: "",
      width: 36,
      align: "center",
      render: (r: any) => {
        const isFlagged = Boolean(r.flagged) || Boolean(r.isAutoFlagged) || Boolean(r.isEffectivelyFlagged);
        const missingReasonsList = r.missingReasons || [];
        const missingText = missingReasonsList.length > 0 ? missingReasonsList.join(" • ") : "";
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const editIds = selected.has(r.id) && selected.size > 1 ? Array.from(selected) : [r.id];
              handleToggleFlag(editIds);
            }}
            title={missingText ? `Flagged: ${missingText}` : (isFlagged ? "Unflag coil" : "Flag coil")}
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
  ], [uTemp, uFlow, uCond, ip, isLocked, selected]);

  const renderCoilContextMenu = (r: any) => {
    const isMulti = selected.size > 1 && selected.has(r.id);
    const selectedIds = isMulti ? Array.from(selected) : [r.id];
    const targetsCount = selectedIds.length;
    const targetCalcRow = calculatedRows.find(c => c.id === r.id);
    const isFlagged = targetCalcRow 
      ? (Boolean(targetCalcRow.flagged) || Boolean(targetCalcRow.isAutoFlagged) || Boolean(targetCalcRow.isEffectivelyFlagged)) 
      : Boolean(r.flagged);

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        {/* Add Comment */}
        <ContextMenuItem
          onClick={() => handleOpenComment(r)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Cut */}
        <ContextMenuItem
          onClick={() => {
            if (isLocked) {
              toast.info("Calculation is approved and locked. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            handleCutCoil(isMulti ? rows.filter((x) => selected.has(x.id)) : r);
          }}
          disabled={isLocked}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
        >
          <Scissors className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Cut Selected" : "Cut"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Copy */}
        <ContextMenuItem
          onClick={() => handleCopyCoil(isMulti ? rows.filter((x) => selected.has(x.id)) : r)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Copy Selected" : "Copy"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Paste */}
        <ContextMenuItem
          onClick={handlePasteCoil}
          disabled={isLocked || clipboard.length === 0}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50 data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
        >
          <Clipboard className="size-3.5 text-muted-foreground" />
          <span>Paste</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Edit */}
        <ContextMenuItem
          onClick={() => handleRowDoubleClick(r)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? `Bulk Edit (${targetsCount} coils)` : "Edit Coil"}</span>
          {!isMulti && (
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          )}
        </ContextMenuItem>

        {/* Duplicate */}
        <ContextMenuItem
          onClick={() => {
            if (isLocked) {
              toast.info("Calculation is approved and locked. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            handleDuplicateCoil(isMulti ? rows.filter((x) => selected.has(x.id)) : [r]);
          }}
          disabled={isLocked}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Duplicate Selected" : "Duplicate Coil"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Flag */}
        <ContextMenuItem
          onClick={() => {
            if (isLocked) {
              toast.info("Calculation is approved and locked. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            handleToggleFlag(selectedIds);
          }}
          disabled={isLocked}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
        >
          <Flag className={`size-3.5 ${isFlagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          <span>{isMulti ? `Toggle Flag (${targetsCount} selected)` : isFlagged ? "Unflag Coil" : "Flag Coil"}</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Delete */}
        <ContextMenuItem
          onClick={() => {
            if (isLocked) {
              toast.info("Calculation is approved and locked. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            handleDeleteCoil(selectedIds);
          }}
          disabled={isLocked}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
          <span>Delete</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const handleNewCoil = () => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const id = "coil-" + Date.now();
    const newName = `Coil ${rows.length + 1}`;
    const newCoilDraft: CoilRow = {
      id,
      name: newName,
      dbIn: "" as any,
      wbIn: "" as any,
      dbOut: "" as any,
      wbOut: "" as any,
      flow: "" as any,
      comments: []
    };
    setIsCreatingNew(true);
    setEditingCoil(newCoilDraft);
  };

  const handleCloseEditModal = () => {
    setIsCreatingNew(false);
    setEditingCoil(null);
  };

  const handleSaveEditedCoil = (updated: CoilRow) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }

    if (isCreatingNew) {
      const finalCoil: CoilRow = {
        ...updated,
        id: updated.id || `coil-${Date.now()}`,
        name: updated.name || `Coil ${rows.length + 1}`,
        dbIn: updated.dbIn === "" || updated.dbIn === undefined ? (ip ? 75.2 : 24.0) : Number(updated.dbIn),
        wbIn: updated.wbIn === "" || updated.wbIn === undefined ? (ip ? 62.6 : 17.0) : Number(updated.wbIn),
        dbOut: updated.dbOut === "" || updated.dbOut === undefined ? (ip ? 57.2 : 14.0) : Number(updated.dbOut),
        wbOut: updated.wbOut === "" || updated.wbOut === undefined ? (ip ? 55.4 : 13.0) : Number(updated.wbOut),
        flow: updated.flow === "" || updated.flow === undefined ? (ip ? 1000 : 500) : Number(updated.flow),
        comments: []
      };
      updateRowsWithHistory([...rows, finalCoil]);
      setIsCreatingNew(false);
      setEditingCoil(null);
      toast.success(`New Coil "${finalCoil.name}" added successfully!`);
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
    const targetCalcRow = calculatedRows.find(r => flagSet.has(r.id));
    const isCurrentlyFlagged = targetCalcRow 
      ? (Boolean(targetCalcRow.flagged) || Boolean(targetCalcRow.isAutoFlagged) || Boolean(targetCalcRow.isEffectivelyFlagged)) 
      : false;
    const nextVal = !isCurrentlyFlagged;
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

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          unitSystem,
          rows
        };
        localStorage.setItem(`mep_condensate_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Condensate calculation saved!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const blurActiveInput = () => {
    const activeEl = document.activeElement;
    if (!activeEl) return;
    const tagName = activeEl.tagName.toUpperCase();
    const isTextInput =
      (tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT" ||
      (activeEl as HTMLElement).isContentEditable ||
      activeEl.getAttribute("contenteditable") === "true";
    if (isTextInput) {
      (activeEl as HTMLElement).blur();
    }
  };

  const handleRowClick = (id: string, e: React.MouseEvent, idx: number) => {
    blurActiveInput();
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

  // Keyboard Shortcuts (Matching Ventilation: Ctrl+A, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y, Escape, Delete, Backspace, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Close open modals / dialogs or deselect rows
      if (e.key === "Escape") {
        if (editingCoil || commentModalOpen || isImportModalOpen || showFormulaModal) {
          setEditingCoil(null);
          setCommentModalOpen(false);
          setIsImportModalOpen(false);
          setShowFormulaModal(false);
        } else {
          const activeEl = document.activeElement;
          const isTextInput = activeEl && (
            (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "SELECT" ||
            (activeEl as HTMLElement).isContentEditable ||
            activeEl.getAttribute("contenteditable") === "true"
          );
          if (!isTextInput) {
            setSelected(new Set());
            setLastClickedIndex(null);
          }
        }
        return;
      }

      const activeEl = document.activeElement;
      const isTextInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "SELECT" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.getAttribute("contenteditable") === "true"
      );
      if (isTextInput) return;

      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Ctrl+A / Cmd+A (Select All)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const items = filteredRows.length > 0 ? filteredRows : rows;
        if (items.length > 0) {
          setSelected(new Set(items.map(r => r.id)));
          toast.info(`Selected all ${items.length} coil(s)`);
        }
        return;
      }

      // 2. Delete (Delete selected coils)
      if (e.key === "Delete") {
        if (selected.size > 0) {
          e.preventDefault();
          if (isLocked) {
            toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
            return;
          }
          handleDeleteCoil(Array.from(selected));
        }
        return;
      }

      // 3. Ctrl+C / Cmd+C: Copy selected coil(s)
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (selected.size > 0) {
          e.preventDefault();
          const toCopy = rows.filter(r => selected.has(r.id));
          handleCopyCoil(toCopy);
        }
        return;
      }

      // 4. Ctrl+X / Cmd+X: Cut selected coil(s)
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (isLocked) {
          toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
          return;
        }
        if (selected.size > 0) {
          e.preventDefault();
          const toCut = rows.filter(r => selected.has(r.id));
          handleCutCoil(toCut);
        }
        return;
      }

      // 5. Ctrl+V / Cmd+V: Paste coil(s)
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (isLocked) {
          toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
          return;
        }
        e.preventDefault();
        handlePasteCoil();
        return;
      }

      // 6. Ctrl+D / Cmd+D: Duplicate selected coil(s)
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (isLocked) {
          toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
          return;
        }
        if (selected.size > 0) {
          e.preventDefault();
          const toDuplicate = rows.filter(r => selected.has(r.id));
          handleDuplicateCoil(toDuplicate);
        }
        return;
      }

      // 7. Undo / Redo: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
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

      // 8. Ctrl+S / Cmd+S: Save calculation
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    rows,
    filteredRows,
    selected,
    editingCoil,
    commentModalOpen,
    isImportModalOpen,
    showFormulaModal,
    isLocked,
    clipboard,
    history,
    historyIndex,
    project?.id,
    unitSystem,
  ]);

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
        endUser: (project as any)?.endUser || (project as any)?.location || "",
        unitSystem,
      });
      toast.dismiss("condensate-pdf-export");
    } catch (e) {
      console.error("Failed to export condensate PDF", e);
      toast.dismiss("condensate-pdf-export");
      toast.error("Failed to export PDF calculation sheet.");
    }
  };



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

  // Top contributing coils
  const rankedCoils = useMemo(() => {
    return [...calculatedRows]
      .filter(c => (c.condFlow || 0) > 0)
      .sort((a, b) => (b.condFlow || 0) - (a.condFlow || 0));
  }, [calculatedRows]);

  const sigDetails = useMemo(() => {
    return getSignatureBlockDetails(project?.id || "default", "/condensate-drain-calc", currentUserName, calcReviewState);
  }, [project?.id, calcReviewState]);

  return (
    <AppShell 
      title="Coil Condensate Calculator" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Coil Condensate Calculator</h1>
              </div>
              
              <button 
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Coil Condensate Intelligence & Psychrometric Audit"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>

              <CalculationReviewBar
                projectId={activeProjectId || project?.id || "default"}
                calculatorPath="/condensate-drain-calc"
                calculatorTitle="Coil Condensate Calculator"
              />
            </div>

            {/* Unit System Toggle in Header inline with Approve / Reject */}
            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                disabled={isLocked}
                inputDescriptions="DB In, WB In, DB Out, WB Out, Airflow"
                conversionExample={unitSystem === "si" ? "Convert 24°C → 75.2°F, 1500 L/s → 3,178 CFM" : "Convert 75.2°F → 24°C, 3178 CFM → 1,500 L/s"}
              />
            </div>
          </div>

          {/* Main Card container for Tabs & Data Grid */}
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
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap modal-blur-bg">
              <div className="flex items-center gap-2.5 flex-wrap">
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

                {/* Formula Breakdown button placed right next to tabs */}
                <TBtn
                  onClick={() => setShowFormulaModal(true)}
                  title="Detailed Formulas & Sizing Derivations"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Right Side: Export button in line with Tabs matching Preliminary */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPDF}>
                  <FileText className="size-3.5" /> Export
                </TBtn>
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

                    {/* Filter Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                            activeFiltersCount > 0
                              ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                              : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                          }`}
                        >
                          <Filter className="size-3.5 shrink-0" />
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                            Filter
                          </span>
                          {activeFiltersCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                              {activeFiltersCount}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                        <div className="flex items-center justify-between pb-1.5 border-b border-border">
                          <span className="text-[12px] font-semibold text-foreground">Filters</span>
                          {activeFiltersCount > 0 && (
                            <button
                              onClick={() => {
                                setFilterFlaggedOnly(false);
                                setQuery("");
                              }}
                              className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        {/* Flagged coils filter */}
                        <div className="flex items-center justify-between py-1 px-1">
                          <span className="text-[11.5px] text-foreground font-medium">Flagged Coils Only</span>
                          <button
                            type="button"
                            onClick={() => setFilterFlaggedOnly(!filterFlaggedOnly)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              filterFlaggedOnly ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                                filterFlaggedOnly ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Sort Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                            sortBy !== "default"
                              ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                              : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                          }`}
                        >
                          <ArrowUpDown className="size-3.5 shrink-0" />
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                            Sort
                          </span>
                          {sortBy !== "default" && (
                            <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                              ✓
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-56 p-2 bg-popover border border-border rounded-xl shadow-lg font-sans z-50">
                        <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border">
                          <span className="text-[11.5px] font-semibold text-foreground">Sort Coils</span>
                          {sortBy !== "default" && (
                            <button
                              onClick={() => setSortBy("default")}
                              className="text-[10px] text-primary hover:underline font-medium hover:text-primary-strong cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 text-[11.5px]">
                          {[
                            { id: "default", label: "Default Order" },
                            { id: "name-asc", label: "Unit Ref (A → Z)" },
                            { id: "name-desc", label: "Unit Ref (Z → A)" },
                            { id: "flow-desc", label: `Airflow (High → Low)` },
                            { id: "flow-asc", label: `Airflow (Low → High)` },
                            { id: "cond-desc", label: `Condensate Rate (High → Low)` },
                            { id: "cond-asc", label: `Condensate Rate (Low → High)` },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => setSortBy(opt.id)}
                              className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                sortBy === opt.id
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-foreground hover:bg-surface-2"
                              }`}
                            >
                              <span>{opt.label}</span>
                              {sortBy === opt.id && <Check className="size-3 text-primary shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* View Options & Column Distribution Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="relative inline-flex items-center justify-center h-7 w-7 rounded-full border border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible"
                          title="View / Column Distribution"
                        >
                          <SlidersHorizontal className="size-3.5 shrink-0" />
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                            View Options
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-border">
                          <span className="text-[12px] font-semibold text-foreground">Column Distribution</span>
                        </div>
                        <p className="text-[10.5px] text-muted-foreground leading-snug">
                          Drag column divider lines in table headers to adjust custom widths. Click below to restore auto-distribution.
                        </p>
                        <button
                          onClick={() => {
                            try {
                              localStorage.removeItem("mep_grid_condensate_coils");
                              window.dispatchEvent(new Event("resize"));
                              toast.success("Column widths reset to auto-distribution");
                            } catch (e) {}
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 text-foreground font-semibold text-[11.5px] border border-border transition-colors cursor-pointer"
                        >
                          <RefreshCw className="size-3 text-primary" />
                          Reset Column Widths
                        </button>
                      </PopoverContent>
                    </Popover>

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
                        <BulkBtn
                          icon={Edit3}
                          onClick={() => {
                            if (isLocked) {
                              toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
                              return;
                            }
                            const firstSelected = rows.find(r => selected.has(r.id));
                            if (firstSelected) setEditingCoil(firstSelected);
                          }}
                        >
                          Bulk edit
                        </BulkBtn>
                        <BulkBtn
                          icon={MessageSquare}
                          onClick={() => {
                            const firstSelected = rows.find(r => selected.has(r.id));
                            if (firstSelected) handleOpenComment(firstSelected);
                          }}
                        >
                          Comment
                        </BulkBtn>
                        <BulkBtn
                          icon={Flag}
                          onClick={() => handleToggleFlag(Array.from(selected))}
                        >
                          Flag
                        </BulkBtn>
                        <BulkBtn
                          icon={Copy}
                          onClick={() => handleDuplicateCoil(rows.filter(x => selected.has(x.id)))}
                        >
                          Duplicate
                        </BulkBtn>
                        <BulkBtn
                          icon={Trash2}
                          onClick={() => handleDeleteCoil(Array.from(selected))}
                        >
                          Delete
                        </BulkBtn>
                        <button
                          type="button"
                          onClick={() => setSelected(new Set())}
                          className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                        >
                          <X className="size-3" /> Clear
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
                      <DataGrid
                        gridId="condensate_coils"
                        rows={filteredRows}
                        columns={columns}
                        selected={selected}
                        onToggle={handleToggleSelectRow}
                        onToggleAll={handleToggleSelectAll}
                        renderContextMenu={renderCoilContextMenu}
                        onRowDoubleClick={handleRowDoubleClick}
                        activeRowId={editingCoil?.id}
                        isReadOnly={isLocked}
                        rowClassName={(row, index) =>
                          index % 2 === 0
                            ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80"
                            : "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"
                        }
                      />
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



              {/* Printable Report Tab View matching Preliminary exact standard layout */}
              {tab === "report" && (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                    
                    {/* 1. Title (Exact Preliminary format with Calculation keyword) */}
                    <div className="pb-1">
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                        Coil Condensate Calculation
                      </h2>
                    </div>

                    {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b border-border divide-x divide-border">
                            <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                            <td className="p-2.5 font-mono text-foreground font-medium">
                              {(project as any)?.calcNo || `TRV-CAL-CCD-${(project?.id || "0000").slice(-4).toUpperCase()}`}
                            </td>
                            <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                            <td className="p-2.5 font-mono font-medium">
                              {formatDateStr(new Date().toISOString())}
                            </td>
                          </tr>
                          <tr className="border-b border-border divide-x divide-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                            <td className="p-2.5 font-mono">
                              {project?.code || (project?.id ? project.id.slice(0, 8) : "MEP-CCD-2026")}
                            </td>
                            <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                            <td className="p-2.5">{project?.client || "-"}</td>
                          </tr>
                          <tr className="divide-x divide-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                            <td className="p-2.5">{project?.name || "MEP Project"}</td>
                            <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                            <td className="p-2.5">{(project as any)?.endUser || (project as any)?.location || "-"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 3. Coil Condensate Schedule & Psychrometric Data (2-Tier Header Table) */}
                    <div className="border border-border rounded-xl overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                            <th rowSpan={2} className="p-2 border-r border-border w-12 text-center">
                              Sr.<br />No.
                            </th>
                            <th colSpan={2} className="p-2 border-r border-border text-center">
                              Equipment Parameters
                            </th>
                            <th colSpan={4} className="p-2 border-r border-border text-center">
                              Psychrometric Design Conditions
                            </th>
                            <th colSpan={2} className="p-2 text-center">
                              Condensation Load Metrics
                            </th>
                          </tr>
                          <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                            <th className="p-2 border-r border-border text-left min-w-[120px]">Unit Ref / Tag</th>
                            <th className="p-2 border-r border-border w-24 text-right">Air Flow ({uFlow})</th>
                            <th className="p-2 border-r border-border w-28 text-center">Entering DB/WB ({uTemp})</th>
                            <th className="p-2 border-r border-border w-28 text-center">Leaving DB/WB ({uTemp})</th>
                            <th className="p-2 border-r border-border w-24 text-right">W_in (kg/kg)</th>
                            <th className="p-2 border-r border-border w-24 text-right">W_out (kg/kg)</th>
                            <th className="p-2 border-r border-border w-24 text-right">dW (kg/kg)</th>
                            <th className="p-2 w-28 text-right">Condensate ({uCond})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {calculatedRows.map((r, idx) => {
                            const numFlow = typeof r.flow === "number" ? r.flow : parseFloat(String(r.flow)) || 0;
                            const numDbIn = typeof r.dbIn === "number" ? r.dbIn : parseFloat(String(r.dbIn));
                            const numWbIn = typeof r.wbIn === "number" ? r.wbIn : parseFloat(String(r.wbIn));
                            const numDbOut = typeof r.dbOut === "number" ? r.dbOut : parseFloat(String(r.dbOut));
                            const numWbOut = typeof r.wbOut === "number" ? r.wbOut : parseFloat(String(r.wbOut));
                            const numWIn = typeof r.wIn === "number" ? r.wIn : parseFloat(String(r.wIn));
                            const numWOut = typeof r.wOut === "number" ? r.wOut : parseFloat(String(r.wOut));
                            const numDw = typeof r.dw === "number" ? r.dw : (!isNaN(numWIn) && !isNaN(numWOut) ? Math.max(0, numWIn - numWOut) : 0);
                            const numCond = typeof r.condFlow === "number" ? r.condFlow : parseFloat(String(r.condFlow)) || 0;

                            const dbInStr = !isNaN(numDbIn) ? numDbIn.toFixed(1) : "-";
                            const wbInStr = !isNaN(numWbIn) ? numWbIn.toFixed(1) : "-";
                            const dbOutStr = !isNaN(numDbOut) ? numDbOut.toFixed(1) : "-";
                            const wbOutStr = !isNaN(numWbOut) ? numWbOut.toFixed(1) : "-";
                            const wInStr = !isNaN(numWIn) ? numWIn.toFixed(5) : "-";
                            const wOutStr = !isNaN(numWOut) ? numWOut.toFixed(5) : "-";
                            const dwStr = !isNaN(numDw) ? numDw.toFixed(5) : "-";
                            const condValStr = ip ? (!isNaN(numCond) ? lpsToGpm(numCond).toFixed(4) : "-") : (!isNaN(numCond) ? numCond.toFixed(4) : "-");

                            return (
                              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">
                                  {idx + 1}
                                </td>
                                <td className="p-2 border-r border-border font-sans font-bold text-foreground">
                                  {r.name || "-"}
                                </td>
                                <td className="p-2 border-r border-border text-right font-mono">
                                  {numFlow.toLocaleString()}
                                </td>
                                <td className="p-2 border-r border-border text-center font-mono">
                                  {dbInStr} / {wbInStr}
                                </td>
                                <td className="p-2 border-r border-border text-center font-mono">
                                  {dbOutStr} / {wbOutStr}
                                </td>
                                <td className="p-2 border-r border-border text-right font-mono text-muted-foreground">
                                  {wInStr}
                                </td>
                                <td className="p-2 border-r border-border text-right font-mono text-muted-foreground">
                                  {wOutStr}
                                </td>
                                <td className="p-2 border-r border-border text-right font-mono font-semibold">
                                  {dwStr}
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-primary">
                                  {condValStr}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Summary Total Row */}
                          <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold border-t-2 border-border text-foreground">
                            <td className="p-2 border-r border-border text-center font-sans">TOTAL</td>
                            <td className="p-2 border-r border-border font-sans font-bold">{rows.length} Units</td>
                            <td className="p-2 border-r border-border text-right font-mono font-bold">{(totals?.totalFlow || 0).toLocaleString()}</td>
                            <td className="p-2 border-r border-border text-center">-</td>
                            <td className="p-2 border-r border-border text-center">-</td>
                            <td className="p-2 border-r border-border text-right">-</td>
                            <td className="p-2 border-r border-border text-right">-</td>
                            <td className="p-2 border-r border-border text-right">-</td>
                            <td className="p-2 text-right font-mono font-bold text-primary text-xs">
                              {ip ? lpsToGpm(totals?.totalCond || 0).toFixed(4) : (totals?.totalCond || 0).toFixed(4)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 4. Table 2: Condensate Drainage Summary & Sizing Guidance */}
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                            <th className="p-2 w-12 text-center border-r border-border">Sr.</th>
                            <th className="p-2 text-left border-r border-border min-w-[180px]">Drainage Sizing Parameter</th>
                            <th className="p-2 text-left border-r border-border w-36">Governing Rule / Standard</th>
                            <th className="p-2 text-right border-r border-border w-44">Calculated Value</th>
                            <th className="p-2 text-center border-r border-border w-16">Unit</th>
                            <th className="p-2 text-left min-w-[200px]">Engineering Design Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-sans">
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">1</td>
                            <td className="p-2 font-medium border-r border-border">Total Active Cooling Coils</td>
                            <td className="p-2 text-muted-foreground border-r border-border">Quantity</td>
                            <td className="p-2 text-right font-mono font-bold border-r border-border">{rows.length} Units</td>
                            <td className="p-2 text-center text-muted-foreground border-r border-border">units</td>
                            <td className="p-2 text-muted-foreground text-[11px]">Total scheduled cooling units contributing to drain header</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">2</td>
                            <td className="p-2 font-medium border-r border-border">Aggregate Airflow Volume</td>
                            <td className="p-2 text-muted-foreground border-r border-border">Sum(Airflow)</td>
                            <td className="p-2 text-right font-mono font-bold border-r border-border">{(totals?.totalFlow || 0).toLocaleString()}</td>
                            <td className="p-2 text-center text-muted-foreground border-r border-border">{uFlow}</td>
                            <td className="p-2 text-muted-foreground text-[11px]">Total processed supply air across all cooling coils</td>
                          </tr>
                          {/* Row 3: Total Aggregate Condensate Flow - ONLY Calculated Value cell highlighted */}
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">3</td>
                            <td className="p-2 font-bold text-foreground border-r border-border">TOTAL AGGREGATE CONDENSATE FLOW</td>
                            <td className="p-2 text-muted-foreground border-r border-border">Sum(m_air × dW)</td>
                            <td className="p-2 text-right font-mono text-primary text-xs font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                              {ip ? `${totalGpm.toFixed(4)} GPM (${(totals?.totalCond || 0).toFixed(4)} L/s)` : `${(totals?.totalCond || 0).toFixed(4)} L/s (${totalGpm.toFixed(4)} GPM)`}
                            </td>
                            <td className="p-2 text-center font-mono border-r border-border">{ip ? "GPM" : "L/s"}</td>
                            <td className="p-2 text-muted-foreground text-[11px]">Equivalent to {totalLhr.toFixed(2)} L/hr moisture removal rate</td>
                          </tr>
                          {/* Row 4: Recommended Drain Header Pipe Size - ONLY Calculated Value cell highlighted */}
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">4</td>
                            <td className="p-2 font-bold text-foreground border-r border-border">Recommended Drain Header Pipe Size</td>
                            <td className="p-2 text-muted-foreground border-r border-border">IPC 307.2.2 / ASHRAE</td>
                            <td className="p-2 text-right font-mono text-emerald-700 dark:text-emerald-300 text-xs font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                              {ip ? `${recommendedPipe.sizeInch} (${recommendedPipe.metricDn})` : `${recommendedPipe.metricDn} (${recommendedPipe.sizeInch})`}
                            </td>
                            <td className="p-2 text-center font-mono border-r border-border">{ip ? "inch" : "mm"}</td>
                            <td className="p-2 text-muted-foreground text-[11px]">Gravity drainage sloped at min 1% (1/8 in/ft) to floor drain</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">5</td>
                            <td className="p-2 font-medium border-r border-border">Recommended Min P-Trap Seal Depth</td>
                            <td className="p-2 text-muted-foreground border-r border-border">H = 1 in + Fan ESP</td>
                            <td className="p-2 text-right font-mono font-bold border-r border-border">{ip ? "3.0 in" : "75 mm"}</td>
                            <td className="p-2 text-center text-muted-foreground border-r border-border">{ip ? "in" : "mm"}</td>
                            <td className="p-2 text-muted-foreground text-[11px]">Prevents air ingress/blowout and allows unhindered condensate drain</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 5. 3-Tier Signature Sign-Off Block (Exact #FFE6CC Header) */}
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
                                {sigDetails?.originatedName || currentUserName || "-"}
                              </td>
                              <td className="p-2.5 text-center font-medium">
                                {sigDetails?.reviewerName || ""}
                              </td>
                              <td className="p-2.5 text-center font-medium">
                                {sigDetails?.approverName || ""}
                              </td>
                            </tr>
                            <tr className="divide-x divide-border">
                              <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                              <td className="p-2.5 text-center font-mono">
                                {sigDetails?.originatedDate || formatDateStr(new Date().toISOString())}
                              </td>
                              <td className="p-2.5 text-center font-mono">
                                {sigDetails?.reviewerDate || ""}
                              </td>
                              <td className="p-2.5 text-center font-mono">
                                {sigDetails?.approverDate || ""}
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
        </div>
        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <CoilCondensateIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calculatedRows={calculatedRows}
              totals={totals}
              unitSystem={unitSystem}
              filterFlaggedOnly={filterFlaggedOnly}
              onToggleFilterFlagged={() => setFilterFlaggedOnly((prev) => !prev)}
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
              onOpenFormulaModal={() => setShowFormulaModal(true)}
            />
          )}
        </div>
      </div>

      {/* Edit Coil Modal */}
      <EditCoilModal
        isOpen={Boolean(editingCoil)}
        onClose={handleCloseEditModal}
        coil={editingCoil}
        isNew={isCreatingNew}
        selectedCount={!isCreatingNew && editingCoil && selected.has(editingCoil.id) && selected.size > 1 ? selected.size : 1}
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
                forceSaveToCloud();
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

      {/* Formula Breakdown Modal */}
      {showFormulaModal && (
        <CoilCondensateFormulaModal
          isOpen={showFormulaModal}
          onClose={() => setShowFormulaModal(false)}
          calculatedRows={calculatedRows}
          totals={totals}
          unitSystem={unitSystem}
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
  filterFlaggedOnly,
  onToggleFilterFlagged,
  onSelectCoil,
  onEditCoil,
  onOpenFormulaModal,
}: {
  onClose: () => void;
  calculatedRows: any[];
  totals: { totalFlow: number; totalCond: number; avgDw?: number };
  unitSystem: "si" | "ip";
  filterFlaggedOnly: boolean;
  onToggleFilterFlagged: () => void;
  onSelectCoil: (id: string) => void;
  onEditCoil: (coil: any) => void;
  onOpenFormulaModal: () => void;
}) {
  const ip = unitSystem === "ip";
  const uFlow = ip ? "CFM" : "L/s";
  const uCond = ip ? "GPM" : "L/s";

  // Fan ESP state for interactive trap seal calculator
  const [fanEsp, setFanEsp] = useState<number>(ip ? 1.5 : 375); // in. w.g. or Pa
  const [showIpcTable, setShowIpcTable] = useState(false);

  const totalCoils = calculatedRows.length;
  const flaggedCoils = calculatedRows.filter(r => r.isEffectivelyFlagged);
  const validCoilsCount = calculatedRows.filter(r => !r.isAutoFlagged).length;
  const compliancePct = totalCoils > 0 ? Math.round((validCoilsCount / totalCoils) * 100) : 100;

  // Drain pipe sizing logic according to IPC / ASHRAE guidelines
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

  // Trap seal calculations
  const fanEspInches = ip ? fanEsp : fanEsp / 248.84;
  const drawThroughHeightIn = (fanEspInches + 1.0).toFixed(2);
  const drawThroughHeightMm = Math.round((fanEspInches + 1.0) * 25.4);
  const blowThroughHeightIn = (fanEspInches + 0.5).toFixed(2);
  const blowThroughHeightMm = Math.round((fanEspInches + 0.5) * 25.4);

  // Top condensate contributors
  const rankedCoils = useMemo(() => {
    return [...calculatedRows]
      .filter(c => (c.condFlow || 0) > 0)
      .sort((a, b) => (b.condFlow || 0) - (a.condFlow || 0))
      .slice(0, 5);
  }, [calculatedRows]);

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in">
      {/* Header */}
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer transition"
          title="Close Intelligence Drawer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-xs custom-scrollbar">
        {/* Card 1: Schedule Health & Compliance Gauge */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3.5 text-primary" /> Schedule Health
            </span>
            <span className={`font-mono font-bold text-xs ${compliancePct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {compliancePct}% Complete
            </span>
          </div>

          <div className="h-2 w-full bg-border/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${compliancePct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${compliancePct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
            <span>{validCoilsCount} of {totalCoils} coils verified</span>
            {flaggedCoils.length > 0 ? (
              <button
                type="button"
                onClick={onToggleFilterFlagged}
                className="text-amber-600 dark:text-amber-400 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <AlertTriangle className="size-3" />
                {flaggedCoils.length} need attention ({filterFlaggedOnly ? "Active" : "Filter"})
              </button>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                <Check className="size-3" /> All inputs valid
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Pipe Sizing Recommendation (IPC 307.2.2 / ASHRAE) */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Gauge className="size-3.5 text-emerald-600" /> IPC Drain Sizing Audit
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              IPC 307.2.2 Pass
            </span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-foreground flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-muted-foreground font-medium">Header Pipe Size:</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  {ip ? recommendedPipe.sizeInch : recommendedPipe.metricDn}
                </span>
                <span className="text-xs text-muted-foreground">({ip ? recommendedPipe.metricDn : recommendedPipe.sizeInch})</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-500/20">
              <div>
                <span className="text-muted-foreground block text-[10px]">Total Flow:</span>
                <strong className="font-mono text-foreground">{ip ? `${totalGpm.toFixed(4)} GPM` : `${totals.totalCond.toFixed(4)} L/s`}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Hourly Removal:</span>
                <strong className="font-mono text-foreground">{totalLhr.toFixed(2)} L/hr</strong>
              </div>
            </div>

            <span className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
              Adequate for gravity drain sloped at minimum 1.0% (1/8 in/ft) to floor drain or waste receptor.
            </span>

            <button
              type="button"
              onClick={() => setShowIpcTable((v) => !v)}
              className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline pt-1.5 border-t border-emerald-500/20 cursor-pointer"
            >
              <span>{showIpcTable ? "Hide IPC Section 307 Table" : "View IPC Section 307 Table"}</span>
              {showIpcTable ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {showIpcTable && (
              <div className="overflow-x-auto border border-emerald-500/20 rounded-xl mt-1 bg-card/60">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-surface-2/80 text-muted-foreground font-semibold border-b border-border">
                      <th className="py-1.5 px-2">Size</th>
                      <th className="py-1.5 px-2 text-right">Max ({uCond})</th>
                      <th className="py-1.5 px-1.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono text-[10.5px]">
                    {IPC_PIPE_TABLE.map((pipe) => {
                      const isSelectedPipe = (ip ? pipe.sizeInch : pipe.dn) === (ip ? recommendedPipe.sizeInch : recommendedPipe.metricDn);
                      return (
                        <tr
                          key={pipe.sizeInch}
                          className={`transition-colors ${
                            isSelectedPipe
                              ? "bg-emerald-500/20 font-bold text-foreground"
                              : "hover:bg-surface-2/50 text-muted-foreground"
                          }`}
                        >
                          <td className="py-1.5 px-2">
                            <span className="font-sans font-semibold text-foreground">{pipe.sizeInch}</span> ({pipe.dn})
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            {ip ? `${pipe.maxGpm.toFixed(2)}` : `${pipe.maxLps.toFixed(4)}`}
                          </td>
                          <td className="py-1.5 px-1.5 text-center">
                            {isSelectedPipe ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                <Check className="size-2.5" /> Rec
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Interactive P-Trap Seal Depth Sizer */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Droplets className="size-3.5 text-primary" /> Live P-Trap Seal Sizer
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">ASHRAE Systems</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-surface-2/70 border border-border">
            <span className="text-[11px] font-medium text-foreground">Fan Static Pressure ({ip ? "in. w.g." : "Pa"}):</span>
            <input
              type="number"
              step={ip ? "0.1" : "25"}
              min="0"
              value={fanEsp}
              onChange={(e) => setFanEsp(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 px-2 py-0.5 rounded bg-background border border-border font-mono font-bold text-right text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col gap-0.5">
              <span className="text-blue-700 dark:text-blue-300 font-bold text-[10.5px]">Draw-Through (Suction)</span>
              <span className="text-xs font-mono font-bold text-foreground">
                {ip ? `${drawThroughHeightIn} in` : `${drawThroughHeightMm} mm`}
              </span>
              <span className="text-[9.5px] text-muted-foreground leading-tight mt-0.5">H = ESP + 1.0 in (25mm)</span>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-0.5">
              <span className="text-emerald-700 dark:text-emerald-300 font-bold text-[10.5px]">Blow-Through (Positive)</span>
              <span className="text-xs font-mono font-bold text-foreground">
                {ip ? `${blowThroughHeightIn} in` : `${blowThroughHeightMm} mm`}
              </span>
              <span className="text-[9.5px] text-muted-foreground leading-tight mt-0.5">H = ESP + 0.5 in (13mm)</span>
            </div>
          </div>
        </div>

        {/* Card 4: Top Condensate Contributors */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-2xs flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-primary" /> Top Condensate Contributors
          </span>
          {rankedCoils.length === 0 ? (
            <span className="text-muted-foreground text-[11px]">No coils with positive condensate load.</span>
          ) : (
            <div className="flex flex-col gap-2">
              {rankedCoils.map((c, i) => {
                const coilCond = c.condFlow || 0;
                const pctOfTotal = totals.totalCond > 0 ? Math.round((coilCond / totals.totalCond) * 100) : 0;
                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectCoil(c.id)}
                    className="p-2 rounded-xl bg-surface-2/60 hover:bg-surface-2 flex flex-col gap-1 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-foreground">{c.name}</span>
                      </div>
                      <span className="font-mono font-bold text-primary">
                        {ip ? `${lpsToGpm(coilCond).toFixed(4)} GPM` : `${coilCond.toFixed(4)} L/s`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-border/60 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pctOfTotal}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{pctOfTotal}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 5: Issues & Thermodynamic Warnings */}
        {flaggedCoils.length > 0 && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-2xl p-4 shadow-2xs flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" /> Thermodynamic / Input Issues ({flaggedCoils.length})
            </span>
            <div className="flex flex-col gap-2">
              {flaggedCoils.map(c => (
                <div
                  key={c.id}
                  onClick={() => onEditCoil(c)}
                  className="p-2 rounded-xl bg-background/90 border border-destructive/20 flex flex-col gap-1 cursor-pointer hover:border-destructive transition shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{c.name}</span>
                    <span className="text-[10px] font-bold text-primary hover:underline">Edit Coil →</span>
                  </div>
                  <span className="text-[10.5px] text-destructive leading-tight">
                    {c.missingReasons?.join(" • ") || "Flagged for engineer review"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Card 6: Statutory Installation Rules */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-2xs flex flex-col gap-2.5 text-xs text-muted-foreground">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-600" /> Mandatory Installation Codes
          </span>
          <div className="space-y-2 text-[11px]">
            <div className="p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <strong className="text-foreground block">1. Indirect Waste &amp; Air Gap:</strong>
              Discharge through an air gap of &ge; 1.0 in (25mm) above receptor rim to prevent sanitary back-siphonage.
            </div>
            <div className="p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <strong className="text-foreground block">2. Thermal Insulation:</strong>
              Insulate horizontal drain piping with closed-cell elastomeric foam (&ge; 13mm / 1/2 in) to stop sweating in ceiling voids.
            </div>
            <div className="p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <strong className="text-foreground block">3. Cleanout Access:</strong>
              Provide cleanout plugs at all &gt;45&deg; direction changes and manifold origins.
            </div>
          </div>
        </div>

        {/* Trigger to Mathematical Formula Modal */}
        <button
          type="button"
          onClick={onOpenFormulaModal}
          className="w-full py-2.5 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-semibold rounded-xl text-[12px] flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
        >
          <BookOpen className="size-3.5" />
          View Full Psychrometric Formulas Guide
        </button>
      </div>
    </div>
  );
}

// Compact Step-by-Step Formula Breakdown & Thermodynamic Derivation Modal (matching Fresh Air Cooling Load & Ventilation modal)
function CoilCondensateFormulaModal({
  isOpen = true,
  onClose,
  calculatedRows = [],
  totals = { totalFlow: 0, totalCond: 0 },
  unitSystem,
}: {
  isOpen?: boolean;
  onClose: () => void;
  calculatedRows?: any[];
  totals?: { totalFlow: number; totalCond: number; avgDw?: number };
  unitSystem: "si" | "ip";
}) {
  const [activeTab, setActiveTab] = useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = useState(false);
  const [selectedCoilId, setSelectedCoilId] = useState<string>(
    calculatedRows.length > 0 ? calculatedRows[0].id : ""
  );

  // Esc key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSI = unitSystem === "si";
  const ip = !isSI;
  const uT = isSI ? "°C" : "°F";
  const uFlow = ip ? "CFM" : "L/s";
  const uCond = ip ? "GPM" : "L/s";
  const uW = isSI ? "kg/kg" : "gr/lb";

  // Active coil data or sample fallback
  const activeCoil = calculatedRows.find((r) => r.id === selectedCoilId) || calculatedRows[0] || {
    name: "AHU-01 (Sample Coil)",
    flow: isSI ? 1500 : 3000,
    dbIn: isSI ? 24.0 : 75.2,
    wbIn: isSI ? 18.0 : 64.4,
    dbOut: isSI ? 13.0 : 55.4,
    wbOut: isSI ? 12.0 : 53.6,
    flowLps: isSI ? 1500 : 1415.8,
    condFlow: 0.0076,
  };

  const pAtm = 101325;
  const flowNum = Number(activeCoil.flow) || (isSI ? 1500 : 3000);
  const dbInNum = Number(activeCoil.dbIn) || (isSI ? 24.0 : 75.2);
  const wbInNum = Number(activeCoil.wbIn) || (isSI ? 18.0 : 64.4);
  const dbOutNum = Number(activeCoil.dbOut) || (isSI ? 13.0 : 55.4);
  const wbOutNum = Number(activeCoil.wbOut) || (isSI ? 12.0 : 53.6);

  const dbInC = isSI ? dbInNum : fToC(dbInNum);
  const wbInC = isSI ? wbInNum : fToC(wbInNum);
  const dbOutC = isSI ? dbOutNum : fToC(dbOutNum);
  const wbOutC = isSI ? wbOutNum : fToC(wbOutNum);

  const wInKg = wFromWB(dbInC, wbInC, pAtm);
  const wOutKg = wFromWB(dbOutC, wbOutC, pAtm);
  const deltaWKg = Math.max(0, wInKg - wOutKg);
  const deltaWGr = deltaWKg * 7000;

  const flowLps = isSI ? flowNum : cfmToLps(flowNum);
  const flowCfm = isSI ? lpsToCfm(flowNum) : flowNum;
  const flowM3s = flowLps / 1000;
  const mDot = flowM3s * 1.204; // kg/s

  const condLps = mDot * deltaWKg; // L/s (1 kg = 1 L water)
  const condLhr = condLps * 3600;
  const condGpm = lpsToGpm(condLps);
  const condGph = condGpm * 60;

  const getPipeRecommendation = (gpm: number) => {
    if (gpm <= 0.05) return { sizeMm: "20 mm", sizeInch: '3/4"', metricDn: "DN20", capacityGpm: "0.05 GPM" };
    if (gpm <= 0.20) return { sizeMm: "25 mm", sizeInch: '1"', metricDn: "DN25", capacityGpm: "0.20 GPM" };
    if (gpm <= 0.50) return { sizeMm: "32 mm", sizeInch: '1-1/4"', metricDn: "DN32", capacityGpm: "0.50 GPM" };
    if (gpm <= 1.20) return { sizeMm: "40 mm", sizeInch: '1-1/2"', metricDn: "DN40", capacityGpm: "1.20 GPM" };
    if (gpm <= 3.00) return { sizeMm: "50 mm", sizeInch: '2"', metricDn: "DN50", capacityGpm: "3.00 GPM" };
    if (gpm <= 6.00) return { sizeMm: "65 mm", sizeInch: '2-1/2"', metricDn: "DN65", capacityGpm: "6.00 GPM" };
    return { sizeMm: "80 mm", sizeInch: '3"', metricDn: "DN80", capacityGpm: ">6.00 GPM" };
  };

  const pipeRec = getPipeRecommendation(condGpm);
  const totalCondFlowLps = totals.totalCond > 0 ? totals.totalCond : condLps;
  const totalCondGpm = lpsToGpm(totalCondFlowLps);
  const totalPipeRec = getPipeRecommendation(totalCondGpm);

  const handleCopySummary = () => {
    const text = `=== COIL CONDENSATE CALCULATION BREAKDOWN ===
Governing Design Standards: ASHRAE Fundamentals (Psychrometrics Ch. 1) & IPC Section 307.2
Unit System: ${ip ? "IP (Imperial)" : "SI (Metric)"}
Selected Coil: ${activeCoil.name || "Coil Unit"}

--- STATE PARAMETERS ---
• Entering (On-Coil): ${dbInNum}°/${wbInNum}° ${uT} | W_in: ${wInKg.toFixed(5)} kg/kg (${(wInKg * 7000).toFixed(1)} gr/lb)
• Leaving (Off-Coil): ${dbOutNum}°/${wbOutNum}° ${uT} | W_out: ${wOutKg.toFixed(5)} kg/kg (${(wOutKg * 7000).toFixed(1)} gr/lb)
• Airflow Rate: ${flowNum} ${uFlow} (${flowLps.toFixed(1)} L/s | ${flowCfm.toFixed(0)} CFM) | ṁ: ${mDot.toFixed(3)} kg/s

--- CALCULATION STEPS ---
[1] Moist Air Mass Flow: ṁ = ρ_air × V = 1.204 kg/m³ × ${flowM3s.toFixed(3)} m³/s = ${mDot.toFixed(3)} kg/s
[2] Moisture Extraction: ΔW = W_in - W_out = ${deltaWKg.toFixed(5)} kg/kg (${deltaWGr.toFixed(1)} gr/lb)
[3] Condensate Flow Rate: Q_cond = ṁ × ΔW = ${condLps.toFixed(4)} L/s (${condLhr.toFixed(2)} L/h | ${condGpm.toFixed(4)} GPM)
[4] Drain Pipe Sizing: ${isSI ? pipeRec.metricDn : pipeRec.sizeInch} (IPC Table 307.2.2 safe capacity: ${pipeRec.capacityGpm})
[5] Hydraulic P-Trap Seal: Draw-through = ${ip ? "2.50 in. w.g." : "63 mm"} | Blow-through = ${ip ? "2.00 in. w.g." : "51 mm"}

--- SCHEDULE SUMMARY ---
• Total Scheduled Coils: ${calculatedRows.length || 1}
• Aggregate Condensate Flow: ${ip ? totalCondGpm.toFixed(4) + " GPM" : totalCondFlowLps.toFixed(4) + " L/s"} (${(totalCondFlowLps * 3600).toFixed(2)} L/h)
• Recommended Header Main Pipe: ${isSI ? totalPipeRec.metricDn : totalPipeRec.sizeInch} (IPC 307.2.2)
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Calculation breakdown summary copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150 font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[86vh] flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Fresh Air Modal */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Calculator className="size-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-[13px] font-bold text-foreground truncate">
                Coil Condensate Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              IPC 307.2 / ASHRAE
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
                  <div className="flex items-center gap-1 text-foreground">
                    <Sliders className="size-3 text-primary" />
                    {calculatedRows.length > 1 ? (
                      <select
                        value={selectedCoilId}
                        onChange={(e) => setSelectedCoilId(e.target.value)}
                        className="bg-background text-foreground text-[10.5px] font-bold px-1.5 py-0.5 rounded border border-border/80 outline-none cursor-pointer"
                      >
                        {calculatedRows.map((r, i) => (
                          <option key={r.id || i} value={r.id}>
                            {r.name || `Coil ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{activeCoil.name || "Active Coil"}</span>
                    )}
                  </div>
                  <span className="font-mono text-primary normal-case font-bold">
                    {flowNum} {uFlow} ({flowLps.toFixed(0)} L/s | {flowCfm.toFixed(0)} CFM)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Entering Air (On-Coil)</span>
                    <span className="font-mono font-bold text-foreground">{dbInNum}° / {wbInNum}° {uT}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">({wInKg.toFixed(5)} {uW})</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Leaving Air (Off-Coil)</span>
                    <span className="font-mono font-bold text-foreground">{dbOutNum}° / {wbOutNum}° {uT}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">({wOutKg.toFixed(5)} {uW})</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: MOIST AIR MASS FLOW RATE */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Moist Air Mass Flow Rate (ṁ)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {mDot.toFixed(2)} kg/s
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: ṁ = ρ_air × V_airflow (ρ_air = 1.204 kg/m³)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">1.204 kg/m³ × {flowM3s.toFixed(3)} m³/s</span>
                    <span className="text-primary font-bold">= {mDot.toFixed(2)} kg/s</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: HUMIDITY RATIO & MOISTURE DELTA */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Moisture Extraction (ΔW)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {deltaWKg.toFixed(5)} kg/kg
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: ΔW = W_in - W_out (ASHRAE Psychrometrics)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{wInKg.toFixed(5)} - {wOutKg.toFixed(5)} kg/kg</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {deltaWKg.toFixed(5)} kg/kg ({deltaWGr.toFixed(1)} gr/lb)</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: CONDENSATE FLOW RATE */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Moisture Condensation Flow Rate (Q_cond)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {ip ? condGpm.toFixed(4) + " GPM" : condLps.toFixed(4) + " L/s"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_cond = ṁ · ΔW · (1.0 kg/L water)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{mDot.toFixed(2)} kg/s × {deltaWKg.toFixed(5)}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">= {condLps.toFixed(4)} L/s ({condLhr.toFixed(2)} L/h)</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: DRAIN PIPE SIZING */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Condensate Drain Pipe Sizing (IPC 307.2)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {isSI ? pipeRec.metricDn : pipeRec.sizeInch}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: IPC Table 307.2.2 Minimum Diameter @ 1% Slope</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Safe Capacity: {pipeRec.capacityGpm} @ 1% pitch</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">Recommended: {isSI ? pipeRec.metricDn : pipeRec.sizeInch}</span>
                  </div>
                </div>
              </div>

              {/* STEP 5: P-TRAP SEAL DEPTH */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      5
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Hydraulic P-Trap Seal Depth
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {ip ? "2.50 in. w.g." : "63 mm"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: H_trap = Static ESP + 1.0 in (25 mm) [Draw-Through]</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Draw-through: {ip ? "2.50 in" : "63 mm"}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">Blow-through: {ip ? "2.00 in" : "51 mm"}</span>
                  </div>
                </div>
              </div>

              {/* Sizing Outcome Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">Total Condensate Flow</div>
                  <div className="text-[11.5px] font-bold text-foreground mt-0.5">
                    {ip ? totalCondGpm.toFixed(4) + " GPM" : totalCondFlowLps.toFixed(4) + " L/s"} ({(totalCondFlowLps * 3600).toFixed(2)} L/h)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-primary leading-tight">
                    {isSI ? totalPipeRec.metricDn : totalPipeRec.sizeInch} <span className="text-xs font-normal">Header</span>
                  </div>
                  <div className="text-[9.5px] text-muted-foreground font-mono">IPC 307.2 Sized</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-blue-500" /> Saturation Pressure &amp; Humidity Ratio
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>ln(P_ws) = -5800.22/T + 1.3915 - 0.0486·T + 4.176×10⁻⁵·T²...</div>
                  <div>W = 0.621945 · P_ws(T_wb) / [ P_atm - P_ws(T_wb) ] [kg/kg]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  ASHRAE Fundamentals Psychrometric Chapter 1 moist air formulations at standard atmospheric pressure (101.325 kPa).
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Moisture Extraction &amp; Condensation Rate
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>SI: Q_cond (L/s) = ṁ_air · (W_on - W_off)  |  L/h = L/s × 3600</div>
                  <div>IP: Q_cond (GPM) = Q_cond(L/s) × 15.8503  |  GPH = L/h × 0.2642</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  where ṁ_air = ρ_air × V_airflow (standard dry air density ρ = 1.204 kg/m³ / 0.075 lb/ft³).
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-purple-500" /> IPC Table 307.2.2 Minimum Drain Sizing
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>≤20 TR: DN20 (3/4")  |  21-40 TR: DN25 (1")  |  41-90 TR: DN32 (1-1/4")</div>
                  <div>91-125 TR: DN40 (1-1/2")  |  126-250 TR: DN50 (2")  |  &gt;250 TR: DN65-80</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Minimum pitch of 1% (1/8 in. per foot or 1:100) toward drainage receptor required by IPC Section 307.2.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-500" /> Hydraulic P-Trap Water Seal Sizing
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Draw-Through (Suction): H_trap = Negative ESP (in. w.g.) + 1.0 in (25 mm)</div>
                  <div>Blow-Through (Positive): H_trap = Positive ESP (in. w.g.) + 0.5 in (13 mm)</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Maintains dynamic water barrier to prevent conditioned air loss and sewer gas back-siphonage into the air handling system.
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
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ṁ</td>
                      <td className="py-1.5 px-2 text-foreground">Air Mass Flow Rate</td>
                      <td className="py-1.5 px-2 font-mono">kg/s</td>
                      <td className="py-1.5 px-2 font-mono">lb/hr</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ρ_air</td>
                      <td className="py-1.5 px-2 text-foreground">Standard Air Density</td>
                      <td className="py-1.5 px-2 font-mono">1.204 kg/m³</td>
                      <td className="py-1.5 px-2 font-mono">0.075 lb/ft³</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">P_ws</td>
                      <td className="py-1.5 px-2 text-foreground">Saturation Vapor Pressure</td>
                      <td className="py-1.5 px-2 font-mono">Pascals (Pa)</td>
                      <td className="py-1.5 px-2 font-mono">psia</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">P_atm</td>
                      <td className="py-1.5 px-2 text-foreground">Atmospheric Pressure</td>
                      <td className="py-1.5 px-2 font-mono">101.325 kPa</td>
                      <td className="py-1.5 px-2 font-mono">14.696 psia</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">W_on / W_off</td>
                      <td className="py-1.5 px-2 text-foreground">Entering/Leaving Humidity</td>
                      <td className="py-1.5 px-2 font-mono">kg_w / kg_da</td>
                      <td className="py-1.5 px-2 font-mono">gr/lb</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ΔW</td>
                      <td className="py-1.5 px-2 text-foreground">Moisture Extraction Differential</td>
                      <td className="py-1.5 px-2 font-mono">kg_w / kg_da</td>
                      <td className="py-1.5 px-2 font-mono">gr/lb</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_cond</td>
                      <td className="py-1.5 px-2 text-foreground">Condensate Drainage Flow</td>
                      <td className="py-1.5 px-2 font-mono">L/s (or L/h)</td>
                      <td className="py-1.5 px-2 font-mono">GPM (or GPH)</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">H_trap</td>
                      <td className="py-1.5 px-2 text-foreground">P-Trap Water Seal Depth</td>
                      <td className="py-1.5 px-2 font-mono">mm w.g.</td>
                      <td className="py-1.5 px-2 font-mono">in. w.g.</td>
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
