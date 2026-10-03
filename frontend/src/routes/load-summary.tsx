import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { useState, useMemo, useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useConfirm } from "@/hooks/use-confirm";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { Plus, Download, Trash, Copy, X, Database, Filter, ArrowUpDown, Sparkles, FileText, MessageSquare, Flag } from "lucide-react";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent } from "@/components/ui/context-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { getMergedItemComments } from "@/utils/commentHelpers";
import type { TaskComment } from "@/lib/ventilation-calc";
import {
  CalculationPreviewModal,
  type CalculationPreviewData,
} from "@/components/calculator-framework/CalculationPreviewModal";
import { toast } from "sonner";

export const Route = createFileRoute("/load-summary")({
  head: () => ({
    meta: [
      { title: "Load Summary â€” MEP Calc" },
      { name: "description", content: "Calculate electrical load summary" },
    ],
  }),
  component: LoadSummaryPage,
});

interface LoadRow {
  id: string;
  description: string;
  qty: number;
  area: number;
  lighting: number;
  power: number;
  hvac: number;
  other: number;
  totalLoad: number;
  remarks: string;
  flagged?: boolean;
  comments?: TaskComment[];
}

const computeRowOutputs = (row: LoadRow): LoadRow => {
  const qty = row.qty || 0;
  const lighting = row.lighting || 0;
  const power = row.power || 0;
  const hvac = row.hvac || 0;
  const other = row.other || 0;

  let totalLoad = 0;
  if (qty > 0) {
    totalLoad = qty * (lighting + power + hvac + other);
  } else {
    totalLoad = lighting + power + hvac + other;
  }

  return { ...row, totalLoad: Number(totalLoad.toFixed(2)) };
};

const pushToHistory = (
  currentRows: LoadRow[],
  history: LoadRow[][],
  setHistory: (h: LoadRow[][]) => void,
  setRedoStack?: (r: LoadRow[][]) => void
) => {
  setHistory([...history, [...currentRows]]);
  if (setRedoStack) setRedoStack([]);
};

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  onDoubleClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}

function InlineInput({
  value,
  onCommit,
  className = "",
  type = "text",
  step,
  min,
  placeholder,
  disabled,
  onDoubleClick,
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

  return (
    <input
      type={type}
      step={step}
      min={min}
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
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        if (onDoubleClick) {
          onDoubleClick(e);
        }
      }}
      className={`bg-transparent w-full border border-transparent py-0.5 px-1.5 rounded text-foreground transition-colors ${
        isEffectiveDisabled
          ? "cursor-not-allowed opacity-75 select-none hover:border-transparent focus:border-transparent"
          : "hover:border-muted-foreground/25 focus:border-primary focus:outline-none focus:ring-0 cursor-text"
      } ${className}`}
    />
  );
}

function LoadSummaryPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/load-summary", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/load-summary", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();

  const [rows, setRows] = useState<LoadRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeRowId, setActiveRowId] = useState<string>();
  
  const [history, setHistory] = useState<LoadRow[][]>([]);
  const [redoStack, setRedoStack] = useState<LoadRow[][]>([]);
  
  const [transformers, setTransformers] = useState("");

  // Unit System State (SI / IP)
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">(() => {
    if (typeof window === "undefined") return "si";
    try {
      const pId = project?.id || "default";
      return (localStorage.getItem(`mep_calc_unit_${pId}_/load-summary`) as "si" | "ip") || "si";
    } catch {
      return "si";
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pId = project?.id || "default";
      localStorage.setItem(`mep_calc_unit_${pId}_/load-summary`, unitSystem);
    } catch {}
  }, [unitSystem, project?.id]);

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    pushToHistory(rows, history, setHistory, setRedoStack);
    setUnitSystem(newSystem);
    if (shouldConvert) {
      setRows(prev => prev.map(r => {
        const oldArea = Number(r.area) || 0;
        const newArea = newSystem === "ip"
          ? Number((oldArea * 10.7639).toFixed(2))
          : Number((oldArea / 10.7639).toFixed(2));
        return {
          ...r,
          area: newArea
        };
      }));
      toast.success(`Converted units to ${newSystem.toUpperCase()}`);
    } else {
      toast.success(`Switched unit display to ${newSystem.toUpperCase()}`);
    }
  };

  // Comments & Notifications State
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type?: string } | null>(null);
  const [commentsList, setCommentsList] = useState<TaskComment[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const pId = project?.id || "default";
      const saved = localStorage.getItem(`mep_calc_comments_${pId}_/load-summary`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pId = project?.id || "default";
      const saved = localStorage.getItem(`mep_calc_comments_${pId}_/load-summary`);
      if (saved) setCommentsList(JSON.parse(saved));
      else setCommentsList([]);
    } catch {
      setCommentsList([]);
    }
  }, [project?.id]);

  const saveComments = (newList: TaskComment[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/load-summary`, JSON.stringify(newList));
  };

  const handleOpenComment = (id: string, name: string, type: string = "load") => {
    setCommentTargetItem({ id, name, type });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: TaskComment) => {
    const enrichedComment = {
      ...comment,
      targetId: commentTargetItem?.id || "load-summary",
      targetName: commentTargetItem?.name || "Electrical Load",
      targetType: commentTargetItem?.type || "load",
      calculatorTitle: "Electrical Load Summary",
      calculatorPath: "/load-summary",
      projectId: project?.id || "default",
      projectName: project?.name || "Electrical Load Summary",
    };
    const updated = [enrichedComment, ...commentsList];
    saveComments(updated);

    if (commentTargetItem?.id && commentTargetItem.id !== "load-summary-sheet") {
      setRows(prev => prev.map(r => {
        if (r.id === commentTargetItem.id) {
          const existing = r.comments || [];
          return { ...r, comments: [enrichedComment, ...existing] };
        }
        return r;
      }));
    }

    notifyCommentAssigned({
      comment: enrichedComment,
      targetId: commentTargetItem?.id || "load-summary",
      targetName: commentTargetItem?.name || "Electrical Load",
      targetType: commentTargetItem?.type || "load",
      calculatorTitle: "Electrical Load Summary",
      calculatorPath: "/load-summary",
      project,
      currentUserName,
      currentUserId: userData?.id || profile?.id
    }).catch(console.error);
  };

  // Toolbar state: search, filter, and sort
  const [previewRow, setPreviewRow] = useState<LoadRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "lighting" | "power" | "hvac" | "other">("all");
  const [filterNonZeroOnly, setFilterNonZeroOnly] = useState(false);
  const [filterWithRemarksOnly, setFilterWithRemarksOnly] = useState(false);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<"default" | "description" | "qty" | "area" | "lighting" | "power" | "hvac" | "other" | "totalLoad">("default");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const activeFiltersCount = (filterType !== "all" ? 1 : 0) + (filterNonZeroOnly ? 1 : 0) + (filterWithRemarksOnly ? 1 : 0) + (filterFlaggedOnly ? 1 : 0);

  const handleResetFilters = () => {
    setFilterType("all");
    setFilterNonZeroOnly(false);
    setFilterWithRemarksOnly(false);
    setFilterFlaggedOnly(false);
  };

  const handleResetSort = () => {
    setSortKey("default");
    setSortDirection("asc");
  };

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        (r.description || "").toLowerCase().includes(q) || 
        (r.remarks || "").toLowerCase().includes(q)
      );
    }

    if (filterType === "lighting") {
      result = result.filter(r => (r.lighting || 0) > 0);
    } else if (filterType === "power") {
      result = result.filter(r => (r.power || 0) > 0);
    } else if (filterType === "hvac") {
      result = result.filter(r => (r.hvac || 0) > 0);
    } else if (filterType === "other") {
      result = result.filter(r => (r.other || 0) > 0);
    }

    if (filterNonZeroOnly) {
      result = result.filter(r => (r.totalLoad || 0) > 0);
    }

    if (filterWithRemarksOnly) {
      result = result.filter(r => !!r.remarks && r.remarks.trim() !== "");
    }

    if (filterFlaggedOnly) {
      result = result.filter(r => !!r.flagged);
    }

    if (sortKey !== "default") {
      result.sort((a, b) => {
        let valA = a[sortKey as keyof LoadRow];
        let valB = b[sortKey as keyof LoadRow];

        if (typeof valA === "string") {
          const comp = (valA || "").localeCompare(String(valB || ""));
          return sortDirection === "asc" ? comp : -comp;
        } else {
          const numA = Number(valA) || 0;
          const numB = Number(valB) || 0;
          return sortDirection === "asc" ? numA - numB : numB - numA;
        }
      });
    }

    return result;
  }, [rows, searchQuery, filterType, filterNonZeroOnly, filterWithRemarksOnly, filterFlaggedOnly, sortKey, sortDirection]);

  const totalPower = rows.reduce((acc, row) => acc + row.totalLoad, 0);
  const totalPowerWithSafety = totalPower * 1.1;
  const filteredPower = filteredRows.reduce((acc, row) => acc + row.totalLoad, 0);
  const isFiltered = filteredRows.length !== rows.length;

  const updateRow = (id: string, updates: Partial<LoadRow>) => {
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    if (selected.has(id) && selected.size > 1) {
      setRows(prev => prev.map(row => {
        if (selected.has(row.id)) {
          return computeRowOutputs({ ...row, ...updates });
        }
        return row;
      }));
    } else {
      setRows(prev => prev.map(row => 
        row.id === id ? computeRowOutputs({ ...row, ...updates }) : row
      ));
    }
  };

  const handleToggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isShift && activeRowId) {
        const currentIndex = filteredRows.findIndex(r => r.id === id);
        const activeIndex = filteredRows.findIndex(r => r.id === activeRowId);
        
        if (currentIndex !== -1 && activeIndex !== -1) {
          const start = Math.min(currentIndex, activeIndex);
          const end = Math.max(currentIndex, activeIndex);
          for (let i = start; i <= end; i++) {
            next.add(filteredRows[i].id);
          }
          return next;
        }
      }
      
      if (next.has(id)) next.delete(id);
      else next.add(id);
      
      return next;
    });
    setActiveRowId(id);
  };

  const handleToggleAll = () => {
    if (selected.size === filteredRows.length && filteredRows.length > 0) {
       setSelected(new Set());
    } else {
       setSelected(new Set(filteredRows.map(r => r.id)));
    }
  };

  const addRow = () => {
    const newId = `ls_${Math.random().toString(36).slice(2, 9)}`;
    const newRow: LoadRow = {
      id: newId,
      description: "",
      qty: 1,
      area: 0,
      lighting: 0,
      power: 0,
      hvac: 0,
      other: 0,
      totalLoad: 0,
      remarks: "",
      flagged: false
    };
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, computeRowOutputs(newRow)]);
    setSelected(new Set());
    setActiveRowId(newId);
  };

  const loadDummyData = () => {
    const dummy: LoadRow[] = [
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, description: "First Floor Office", qty: 1, area: 150, lighting: 1.5, power: 3.0, hvac: 15.0, other: 0, totalLoad: 0, remarks: "", flagged: false },
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, description: "Second Floor Meeting Rooms", qty: 2, area: 40, lighting: 0.5, power: 1.0, hvac: 4.0, other: 0, totalLoad: 0, remarks: "Dimmable", flagged: false },
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, description: "Server Room", qty: 1, area: 20, lighting: 0.2, power: 20.0, hvac: 25.0, other: 0, totalLoad: 0, remarks: "Critical load", flagged: true },
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, description: "Pantry", qty: 1, area: 15, lighting: 0.15, power: 5.0, hvac: 1.5, other: 0, totalLoad: 0, remarks: "", flagged: false }
    ];
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, ...dummy.map(computeRowOutputs)]);
    toast.success("Loaded sample office loads.");
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (await confirm(`Are you sure you want to delete ${selected.size} selected row(s)?`)) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
      setActiveRowId(undefined);
      toast.success("Selected load(s) deleted.");
    }
  };

  const duplicateSelected = () => {
    if (selected.size === 0) return;
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    const duplicated: LoadRow[] = [];
    rows.forEach(r => {
      if (selected.has(r.id)) {
        duplicated.push({
          ...r,
          id: `ls_dup_${Math.random().toString(36).slice(2, 9)}`,
          description: `${r.description} (Copy)`,
          flagged: r.flagged
        });
      }
    });
    setRows(prev => [...prev, ...duplicated]);
    toast.success(`Duplicated ${duplicated.length} row(s).`);
  };

  const handleToggleFlag = (id: string) => {
    const isTargetSelected = selected.has(id);
    const targetIds = isTargetSelected ? Array.from(selected) : [id];
    const targetRow = rows.find(r => r.id === id);
    const nextFlagged = !targetRow?.flagged;

    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => prev.map(r => targetIds.includes(r.id) ? { ...r, flagged: nextFlagged } : r));
    toast.info(nextFlagged ? `Flagged ${targetIds.length} load(s) for review` : `Unflagged ${targetIds.length} load(s)`);
  };

  const getCalculationPreview = (row: LoadRow): CalculationPreviewData => {
    const qty = Number(row.qty) || 1;
    const area = Number(row.area) || 0;
    const lighting = Number(row.lighting) || 0;
    const power = Number(row.power) || 0;
    const hvac = Number(row.hvac) || 0;
    const other = Number(row.other) || 0;
    const unitLoad = lighting + power + hvac + other;
    const totalLoad = row.totalLoad || (qty > 0 ? qty * unitLoad : unitLoad);
    const areaUnit = unitSystem === "ip" ? "sq.ft" : "sq.m";
    const densityUnit = unitSystem === "ip" ? "W/sq.ft" : "W/m²";
    const powerDensity = area > 0 ? (totalLoad * 1000) / area : 0;
    const projectShare = totalPower > 0 ? (totalLoad / totalPower) * 100 : 0;
    const totalWithSafety = totalLoad * 1.1;

    const steps = [
      {
        stepNumber: 1,
        label: "Sub-Loads Summation (Unit Power Demand)",
        formula: "P_unit = P_lighting + P_power + P_hvac + P_other",
        substitution: `${lighting} kW + ${power} kW + ${hvac} kW + ${other} kW`,
        result: `${unitLoad.toFixed(2)} kW`,
        status: "pass" as const,
        description: "Direct summation of all connected branch loads for a single unit of this space.",
      },
      {
        stepNumber: 2,
        label: "Total Connected Load (with Quantity Multiplier)",
        formula: qty > 0 ? "P_total = Qty × P_unit" : "P_total = P_unit",
        substitution: qty > 0 ? `${qty} × ${unitLoad.toFixed(2)} kW` : `${unitLoad.toFixed(2)} kW`,
        result: `${totalLoad.toFixed(2)} kW`,
        status: "pass" as const,
        description: "Gross active power demand taking into account space multiplier quantity.",
      },
    ];

    if (area > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        label: `Area Power Density (${densityUnit})`,
        formula: "Power Density = (P_total × 1000) / Area",
        substitution: `(${totalLoad.toFixed(2)} kW × 1000) / ${area} ${areaUnit}`,
        result: `${powerDensity.toFixed(2)} ${densityUnit}`,
        status: "pass" as const,
        description: "Specific power demand per unit area for space benchmarking and thermal compliance.",
      });
    }

    if (totalPower > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        label: "Share of Total Facility Connected Load",
        formula: "Project Share = (P_total / P_project_total) × 100%",
        substitution: `(${totalLoad.toFixed(2)} kW / ${totalPower.toFixed(2)} kW) × 100%`,
        result: `${projectShare.toFixed(1)}%`,
        status: "pass" as const,
        description: "Contribution of this space to the entire facility's active connected power.",
      });
    }

    steps.push({
      stepNumber: steps.length + 1,
      label: "Design Safety Margin (10% Additional Capacity)",
      formula: "P_design = P_total × 1.10",
      substitution: `${totalLoad.toFixed(2)} kW × 1.10`,
      result: `${totalWithSafety.toFixed(2)} kW`,
      status: "pass" as const,
      description: "Standard 10% design safety margin allocated for feeder cable and transformer sizing.",
    });

    return {
      title: "Electrical Load Calculation Breakdown",
      itemName: row.description || "Unnamed Load Area",
      standardReference: "IEC 60364-5-52 / ASHRAE 90.1 / NEC NFPA 70",
      inputs: [
        { label: "Space Description", value: row.description || "—" },
        { label: "Quantity (Units)", value: qty },
        { label: "Floor Area", value: area > 0 ? area : "N/A", unit: area > 0 ? areaUnit : undefined },
        { label: "Lighting Load", value: lighting, unit: "kW" },
        { label: "Power Load", value: power, unit: "kW" },
        { label: "HVAC Load", value: hvac, unit: "kW" },
        { label: "Other Load", value: other, unit: "kW" },
        { label: "Remarks / Notes", value: row.remarks || "None" },
      ],
      steps,
      finalResultLabel: "Total Design Load (+10% Safety)",
      finalResultValue: totalWithSafety.toFixed(2),
      finalResultUnit: "kW",
      complianceNote: "Calculations follow standard electrical engineering practices for commercial and residential load estimation.",
    };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Enter" && activeEl.tagName === "INPUT") {
        activeEl.blur();
        return;
      }

      if (e.key === "Escape") {
        activeEl?.blur();
        if (selected.size > 0) {
          e.preventDefault();
          setSelected(new Set());
          setActiveRowId(undefined);
        }
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && activeEl.tagName === "INPUT") {
        const rowIdxStr = activeEl.getAttribute("data-row-idx");
        const colIdxStr = activeEl.getAttribute("data-col-idx");
        if (rowIdxStr !== null && colIdxStr !== null) {
          let rIdx = parseInt(rowIdxStr);
          let cIdx = parseInt(colIdxStr);
          
          if (e.key === "ArrowUp") rIdx--;
          else if (e.key === "ArrowDown") rIdx++;
          else if (e.key === "ArrowLeft") cIdx--;
          else if (e.key === "ArrowRight") cIdx++;

          const nextInput = document.querySelector(`input[data-row-idx="${rIdx}"][data-col-idx="${cIdx}"]`) as HTMLInputElement;
          if (nextInput) {
            e.preventDefault();
            nextInput.focus();
            setTimeout(() => nextInput.select(), 0);
          }
          return;
        }
      }

      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable
      );
      if (isInput) return;

      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(filteredRows.map(r => r.id)));
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        deleteSelected();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (history.length > 0) {
          const prev = history[history.length - 1];
          setRedoStack(rs => [[...rows], ...rs]);
          setHistory(h => h.slice(0, -1));
          setRows(prev);
          setSelected(new Set());
        }
      }

      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        if (redoStack.length > 0) {
          const next = redoStack[0];
          setHistory(h => [...h, [...rows]]);
          setRedoStack(rs => rs.slice(1));
          setRows(next);
          setSelected(new Set());
        }
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_load", JSON.stringify(toCopy));
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "x" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_load", JSON.stringify(toCopy));
        pushToHistory(rows, history, setHistory, setRedoStack);
        setRows(prev => prev.filter(r => !selected.has(r.id)));
        setSelected(new Set());
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        try {
          const clip = localStorage.getItem("mep_clipboard_load");
          if (clip) {
            const parsed = JSON.parse(clip) as LoadRow[];
            const pasted = parsed.map((item, i) => ({
              ...item,
              id: `ls_paste_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`,
              description: `${item.description} (Copy)`
            }));
            pushToHistory(rows, history, setHistory, setRedoStack);
            setRows(prev => [...prev, ...pasted]);
          }
        } catch (err) {}
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, filteredRows, selected, history, redoStack, confirm]);

  const importColumnMapping = {
    description: ["Description", "Space", "Room", "Area Name", "Load Description", "Tap Off Points", "Item Description", "Name"],
    qty: ["Qty", "Quantity", "Unit", "Count", "Qty unit", "Qty (unit)", "Qty\nunit"],
    area: ["Area", "Area sq.m", "Area (sq.m)", "Area (m2)", "sq.m", "m2", "Area sq.ft", "Area (sq.ft)", "Area (sq ft)", "sq.ft", "sqft", "ft2", "Area sq. m.", "Area\nsq. m."],
    lighting: ["Lighting", "Lighting kW", "Lighting (kW)", "Light", "LTG", "Lighting\nkW", "Lighting Load (kW)"],
    power: ["Power", "Power kW", "Power (kW)", "Small Power", "Power\nkW", "Power Load (kW)"],
    hvac: ["HVAC", "HVAC kW", "HVAC (kW)", "AC", "Cooling", "HVAC\nkW", "HVAC Load (kW)"],
    other: ["Other", "Other Load", "Other kW", "Other (kW)", "Other Load kW", "Other Load\nkW"],
    remarks: ["Remarks", "Notes", "Comment", "Comments"]
  };

  const handleImportExcelRows = (mappedRows: any[]) => {
    // Smart filter: keep rows that have either a description or any non-zero load / remark
    const relevantRows = mappedRows.filter(mr => {
      const hasDesc = Boolean(mr.description && String(mr.description).trim() !== "");
      const hasValue = Boolean(
        (Number(mr.area) || 0) > 0 ||
        (Number(mr.lighting) || 0) > 0 ||
        (Number(mr.power) || 0) > 0 ||
        (Number(mr.hvac) || 0) > 0 ||
        (Number(mr.other) || 0) > 0 ||
        (mr.remarks && String(mr.remarks).trim() !== "")
      );
      return hasDesc || hasValue;
    });

    const rowsToProcess = relevantRows.length > 0 ? relevantRows : mappedRows;

    const newRows: LoadRow[] = rowsToProcess.map((mr, idx) => {
      const row: LoadRow = {
        id: `ls_import_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        description: mr.description || mr.space || mr.name || `Imported Load ${idx + 1}`,
        qty: mr.qty !== undefined && mr.qty !== null && !isNaN(Number(mr.qty)) ? Number(mr.qty) : 1,
        area: Number(mr.area) || 0,
        lighting: Number(mr.lighting) || 0,
        power: Number(mr.power) || 0,
        hvac: Number(mr.hvac) || 0,
        other: Number(mr.other) || 0,
        totalLoad: 0,
        remarks: mr.remarks || "",
        flagged: Boolean(mr.flagged)
      };
      return computeRowOutputs(row);
    });
    
    if (newRows.length > 0) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(prev => [...prev, ...newRows]);
      toast.success(`Successfully imported ${newRows.length} load row(s) from Excel.`);
    } else {
      toast.info("No load rows found to import.");
    }
  };

  const exportPDF = () => {
    if (rows.length === 0) {
      toast.info("No load rows to export.");
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const columnStyles = {
        0: { cellWidth: 10, halign: "center" as const },
        1: { cellWidth: 42, halign: "left" as const },
        2: { cellWidth: 14, halign: "center" as const },
        3: { cellWidth: 16, halign: "center" as const },
        4: { cellWidth: 16, halign: "center" as const },
        5: { cellWidth: 16, halign: "center" as const },
        6: { cellWidth: 16, halign: "center" as const },
        7: { cellWidth: 18, halign: "center" as const },
        8: { cellWidth: 18, halign: "center" as const },
        9: { cellWidth: 24, halign: "left" as const }
      };

      const currentDate = formatDateStr(new Date().toISOString());

      // 1. Top Header Box
      autoTable(doc, {
        startY: 10,
        margin: { left: 10, right: 10 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          fontStyle: "bold",
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          cellPadding: 2,
          valign: "middle"
        },
        body: [
          [
            { content: "Calculation No: CEC-EED-PXXX-203   Rev. No.:", colSpan: 7, styles: { halign: "left" } },
            { content: `Date : ${currentDate}`, colSpan: 3, styles: { halign: "left" } }
          ],
          [
            { content: `Project No : ${project?.code || ""}`, colSpan: 7, styles: { halign: "left" } },
            { content: `Client : ${(project as any)?.client || ""}`, colSpan: 3, styles: { halign: "left" } }
          ],
          [
            { content: `Project Name : ${project?.name || ""}`, colSpan: 7, styles: { halign: "left" } },
            { content: `End User : ${(project as any)?.endUser || ""}`, colSpan: 3, styles: { halign: "left" } }
          ]
        ],
        columnStyles,
        tableWidth: 190
      });

      const headerEndY = (doc as any).lastAutoTable.finalY;

      // 2. Main Data Rows
      const dataRows = rows.map((r, i) => [
        { content: String(i + 1), styles: { halign: "center" as const } },
        { content: r.description || "", styles: { halign: "left" as const } },
        { content: String(r.qty ?? 0), styles: { halign: "center" as const } },
        { content: String(r.area ?? 0), styles: { halign: "center" as const } },
        { content: String(r.lighting ?? 0), styles: { halign: "center" as const } },
        { content: String(r.power ?? 0), styles: { halign: "center" as const } },
        { content: String(r.hvac ?? 0), styles: { halign: "center" as const } },
        { content: String(r.other ?? 0), styles: { halign: "center" as const } },
        { content: String(r.totalLoad ?? 0), styles: { halign: "center" as const } },
        { content: r.remarks || "", styles: { halign: "left" as const } }
      ]);

      autoTable(doc, {
        startY: headerEndY,
        margin: { left: 10, right: 10, top: 10, bottom: 10 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 7.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          cellPadding: 1,
          valign: "middle"
        },
        head: [
          [
            { content: "S.No", styles: { halign: "center" } },
            { content: "Description", styles: { halign: "center" } },
            { content: "Qty\nunit", styles: { halign: "center" } },
            { content: unitSystem === "ip" ? "Area\nsq. ft." : "Area\nsq. m.", styles: { halign: "center" } },
            { content: "Lighting\nkW", styles: { halign: "center" } },
            { content: "Power\nkW", styles: { halign: "center" } },
            { content: "HVAC\nkW", styles: { halign: "center" } },
            { content: "Other Load\nkW", styles: { halign: "center" } },
            { content: "Total Load\nkW", styles: { halign: "center" } },
            { content: "Remarks", styles: { halign: "center" } }
          ]
        ],
        headStyles: {
          fillColor: [217, 217, 217],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          fontSize: 7.5
        },
        body: dataRows,
        columnStyles,
        tableWidth: 190
      });

      // Check remaining space before summary + references + signature block
      const neededSpace = 75;
      let currentY = (doc as any).lastAutoTable.finalY + 2;
      if (doc.internal.pageSize.getHeight() - currentY < neededSpace) {
        doc.addPage();
        currentY = 10;
      }

      // 3. Summary Rows Table
      autoTable(doc, {
        startY: currentY,
        margin: { left: 10, right: 10 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 7.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          cellPadding: 1.2,
          valign: "middle"
        },
        body: [
          [
            { content: "  Total Electrical Power", colSpan: 8, styles: { halign: "left", fontStyle: "bold" } },
            { content: String(totalPower), styles: { halign: "center", fontStyle: "bold" } },
            { content: "", styles: { halign: "center" } }
          ],
          [
            { content: "  Total Power Required Considering 10% safety (kW)", colSpan: 8, styles: { halign: "left", fontStyle: "bold" } },
            { content: String(Number(totalPowerWithSafety.toFixed(2))), styles: { halign: "center", fontStyle: "bold" } },
            { content: "", styles: { halign: "center" } }
          ],
          [
            { content: "  Selected Number of Transformers", colSpan: 8, styles: { halign: "left", fontStyle: "bold" } },
            { content: transformers || "", colSpan: 2, styles: { halign: "center", fontStyle: "bold" } }
          ]
        ],
        columnStyles,
        tableWidth: 190
      });

      // 4. References Table
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 2,
        margin: { left: 10, right: 10 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 7.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          cellPadding: 1.2,
          valign: "middle",
          fontStyle: "bold"
        },
        body: [
          [{ content: "  Reference: 1. Architectural Drawings", colSpan: 10, styles: { halign: "left" } }],
          [{ content: "                    2. DBR", colSpan: 10, styles: { halign: "left" } }],
          [{ content: "                    3. Summary of Cooling Load", colSpan: 10, styles: { halign: "left" } }],
          [{ content: "                    4. Selection from Manufacturer", colSpan: 10, styles: { halign: "left" } }]
        ],
        tableWidth: 190
      });

      // 5. Sign-off Block Table
      const sigColWidth1 = 10 + 42 + 14; // 66mm (cols 1..3)
      const sigColWidth2 = 16 + 16 + 16; // 48mm (cols 4..6)
      const sigColWidth3 = 16 + 18 + 18 + 24; // 76mm (cols 7..10)

      const sigDetails = getSignatureBlockDetails(project?.id || "default", "/load-summary", currentUserName);
      const origName = sigDetails.originatedName || currentUserName || "";
      const origDate = sigDetails.originatedDate || currentDate;
      const revName = sigDetails.reviewerName || "";
      const revDate = sigDetails.reviewerDate || "";
      const appName = sigDetails.approverName || "";
      const appDate = sigDetails.approverDate || "";

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 2,
        margin: { left: 10, right: 10 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          cellPadding: 1.5,
          valign: "middle"
        },
        body: [
          [
            { content: "Originator", styles: { halign: "center", fontStyle: "bold", fillColor: [252, 213, 180] } },
            { content: "Reviewer", styles: { halign: "center", fontStyle: "bold", fillColor: [252, 213, 180] } },
            { content: "Approver", styles: { halign: "center", fontStyle: "bold", fillColor: [252, 213, 180] } }
          ],
          [
            { content: `  Name:   ${origName}`, styles: { halign: "left", fontStyle: "bold", minCellHeight: 6.5 } },
            { content: revName ? `  Name:   ${revName}` : "  Name:", styles: { halign: "left", fontStyle: "bold", minCellHeight: 6.5 } },
            { content: appName ? `  Name:   ${appName}` : "  Name:", styles: { halign: "left", fontStyle: "bold", minCellHeight: 6.5 } }
          ],
          [
            { content: "  Signature:", styles: { halign: "left", fontStyle: "bold", minCellHeight: 6.5 } },
            { content: "  Signature:", styles: { halign: "left", fontStyle: "bold", minCellHeight: 6.5 } },
            { content: "  Signature:", styles: { halign: "left", fontStyle: "bold", minCellHeight: 6.5 } }
          ],
          [
            { content: `  Date:   ${origDate}`, styles: { halign: "left", fontStyle: "bold", minCellHeight: 6.5 } },
            { content: revDate ? `  Date:   ${revDate}` : "  Date:", styles: { halign: "left", fontStyle: "bold", minCellHeight: 6.5 } },
            { content: appDate ? `  Date:   ${appDate}` : "  Date:", styles: { halign: "left", fontStyle: "bold", minCellHeight: 6.5 } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: sigColWidth1 },
          1: { cellWidth: sigColWidth2 },
          2: { cellWidth: sigColWidth3 }
        },
        tableWidth: 190
      });

      const fileName = `Load_Summary_${(project?.code || project?.name || "Project").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      doc.save(fileName);
      toast.success("PDF report exported successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to export PDF report.");
    }
  };

  const columns: Column<LoadRow>[] = useMemo(() => [
    {
      key: "id",
      header: "S.NO",
      width: 50,
      align: "center",
      mono: true,
      render: (row) => {
        const index = filteredRows.findIndex(r => r.id === row.id) + 1;
        return (
          <span
            onDoubleClick={() => setPreviewRow(row)}
            className="text-muted-foreground font-mono text-[12px] cursor-default"
          >
            {index}
          </span>
        );
      }
    },
    {
      key: "description",
      header: "SPACE NAME",
      width: 240,
      render: (row) => {
        const index = filteredRows.findIndex(r => r.id === row.id) + 1;
        const rowComments = getMergedItemComments(
          row.id,
          row.description,
          (row as any).comments || commentsList.filter(c => c.targetId === row.id || (c as any).itemId === row.id),
          "/load-summary",
          project?.id
        );

        return (
          <div className="w-full h-full flex items-center gap-1 px-1 group">
            <InlineInput
              disabled={isEffectiveReadOnly}
              value={row.description}
              placeholder="e.g. Ground Floor Main Office"
              onCommit={(val) => updateRow(row.id, { description: val })}
              onDoubleClick={() => setPreviewRow(row)}
              className="text-[12.5px] font-medium min-w-0 flex-1"
            />
            {rowComments.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenComment(row.id, row.description || `Load ${index}`);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10.5px] font-bold shrink-0 cursor-pointer transition-colors"
                title={`${rowComments.length} comment(s) / task(s). Click to view or reply.`}
              >
                <MessageSquare className="size-3 fill-blue-500/20" />
                <span>{rowComments.length}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenComment(row.id, row.description || `Load ${index}`);
                }}
                className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity p-0.5 cursor-pointer shrink-0"
                title="Add Comment / Assign Task"
              >
                <MessageSquare className="size-3.5" />
              </button>
            )}
          </div>
        );
      }
    },
    {
      key: "qty",
      header: "QTY",
      width: 65,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          min={0}
          value={row.qty === 0 ? "" : row.qty}
          onCommit={(val) => updateRow(row.id, { qty: parseFloat(val) || 0 })}
          onDoubleClick={() => setPreviewRow(row)}
          className="font-mono tabular text-[12.5px] text-center"
        />
      )
    },
    {
      key: "area",
      header: unitSystem === "ip" ? "AREA (SQ.FT)" : "AREA (M²)",
      width: 90,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          step="0.1"
          min={0}
          value={row.area === 0 ? "" : row.area}
          onCommit={(val) => updateRow(row.id, { area: parseFloat(val) || 0 })}
          onDoubleClick={() => setPreviewRow(row)}
          className="font-mono tabular text-[12.5px] text-center"
        />
      )
    },
    {
      key: "lighting",
      header: "LIGHTING (KW)",
      width: 100,
      align: "right",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          step="0.1"
          min={0}
          value={row.lighting === 0 ? "" : row.lighting}
          onCommit={(val) => updateRow(row.id, { lighting: parseFloat(val) || 0 })}
          onDoubleClick={() => setPreviewRow(row)}
          className="font-mono tabular text-[12.5px] text-right"
        />
      )
    },
    {
      key: "power",
      header: "POWER (KW)",
      width: 95,
      align: "right",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          step="0.1"
          min={0}
          value={row.power === 0 ? "" : row.power}
          onCommit={(val) => updateRow(row.id, { power: parseFloat(val) || 0 })}
          onDoubleClick={() => setPreviewRow(row)}
          className="font-mono tabular text-[12.5px] text-right"
        />
      )
    },
    {
      key: "hvac",
      header: "HVAC (KW)",
      width: 95,
      align: "right",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          step="0.1"
          min={0}
          value={row.hvac === 0 ? "" : row.hvac}
          onCommit={(val) => updateRow(row.id, { hvac: parseFloat(val) || 0 })}
          onDoubleClick={() => setPreviewRow(row)}
          className="font-mono tabular text-[12.5px] text-right"
        />
      )
    },
    {
      key: "other",
      header: "OTHER (KW)",
      width: 95,
      align: "right",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          step="0.1"
          min={0}
          value={row.other === 0 ? "" : row.other}
          onCommit={(val) => updateRow(row.id, { other: parseFloat(val) || 0 })}
          onDoubleClick={() => setPreviewRow(row)}
          className="font-mono tabular text-[12.5px] text-right"
        />
      )
    },
    {
      key: "totalLoad",
      header: "TOTAL LOAD (KW)",
      width: 120,
      align: "right",
      mono: true,
      render: (row) => (
        <span
          onDoubleClick={() => setPreviewRow(row)}
          className="w-full text-right px-1 font-mono tabular font-medium text-foreground text-[12.5px] cursor-default"
        >
          {row.totalLoad.toFixed(2)}
        </span>
      )
    },
    {
      key: "remarks",
      header: "REMARKS",
      width: 170,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="text"
          value={row.remarks}
          placeholder="Remarks..."
          onCommit={(val) => updateRow(row.id, { remarks: val })}
          onDoubleClick={() => setPreviewRow(row)}
          className="text-[12px] text-left"
        />
      )
    },
    {
      key: "flagged",
      header: "",
      width: 36,
      align: "center",
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleFlag(row.id);
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
          title={row.flagged ? "Unflag load (Click to remove flag)" : "Flag load for review / attention"}
        >
          <Flag
            className={`size-3.5 transition-all duration-200 ${
              row.flagged
                ? "fill-red-500 text-red-500 scale-110"
                : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
            }`}
          />
        </button>
      )
    }
  ], [filteredRows, commentsList, unitSystem, selected, rows, isEffectiveReadOnly]);

  return (
    <AppShell 
      title="Load Summary" 
      spaceCount={rows.length}
      spaceCountUnit={rows.length === 1 ? "space" : "spaces"}
      actions={
        <UnitToggle
          unitSystem={unitSystem}
          onChange={handleUnitToggle}
          disabled={isEffectiveReadOnly}
          inputDescriptions="Area (sq.m / sq.ft)"
          conversionExample={
            unitSystem === "si"
              ? "Convert 100 sq.m → 1076.39 sq.ft"
              : "Convert 1000 sq.ft → 92.90 sq.m"
          }
        />
      }
    >
      <div className={`flex-1 flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30`}>
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Toolbar matching Preliminary Cooling Load & Reference Screenshot */}
          <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none">
            {/* Pill Search Input */}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter spaces..."
              className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition-all placeholder:text-muted-foreground"
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
                  title="Filter Loads"
                >
                  <Filter className="size-3.5 shrink-0" />
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
                      onClick={handleResetFilters}
                      className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Load Type</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                  >
                    <option value="all">All Loads</option>
                    <option value="lighting">Has Lighting Load (&gt; 0 kW)</option>
                    <option value="power">Has Power Load (&gt; 0 kW)</option>
                    <option value="hvac">Has HVAC Load (&gt; 0 kW)</option>
                    <option value="other">Has Other Load (&gt; 0 kW)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
                  <label className="flex items-center gap-2 text-[11.5px] font-medium text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterFlaggedOnly}
                      onChange={(e) => setFilterFlaggedOnly(e.target.checked)}
                      className="rounded border-gray-300 text-primary size-3.5 focus:ring-primary cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <Flag className="size-3 text-red-500 fill-red-500" />
                      Flagged Only
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-[11.5px] font-medium text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterNonZeroOnly}
                      onChange={(e) => setFilterNonZeroOnly(e.target.checked)}
                      className="rounded border-gray-300 text-primary size-3.5 focus:ring-primary cursor-pointer"
                    />
                    <span>Non-zero Total Load Only</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11.5px] font-medium text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterWithRemarksOnly}
                      onChange={(e) => setFilterWithRemarksOnly(e.target.checked)}
                      className="rounded border-gray-300 text-primary size-3.5 focus:ring-primary cursor-pointer"
                    />
                    <span>Has Remarks Only</span>
                  </label>
                </div>
              </PopoverContent>
            </Popover>

            {/* Sort Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                    sortKey !== "default"
                      ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                      : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                  title="Sort Loads"
                >
                  <ArrowUpDown className="size-3.5 shrink-0" />
                  {sortKey !== "default" && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                      âœ“
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <span className="text-[12px] font-semibold text-foreground">Sort Loads</span>
                  {sortKey !== "default" && (
                    <button
                      onClick={handleResetSort}
                      className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort Field</span>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as any)}
                    className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                  >
                    <option value="default">Default (S.No / Entry order)</option>
                    <option value="description">Description</option>
                    <option value="totalLoad">Total Load (kW)</option>
                    <option value="area">Area (sq.m)</option>
                    <option value="qty">Qty</option>
                    <option value="lighting">Lighting (kW)</option>
                    <option value="power">Power (kW)</option>
                    <option value="hvac">HVAC (kW)</option>
                  </select>
                </div>

                {sortKey !== "default" && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Direction</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSortDirection("asc")}
                        className={`flex-1 py-1 px-2 rounded text-[11.5px] border cursor-pointer ${sortDirection === "asc" ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-surface-2 text-foreground border-border hover:bg-surface-3"}`}
                      >
                        Ascending
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortDirection("desc")}
                        className={`flex-1 py-1 px-2 rounded text-[11.5px] border cursor-pointer ${sortDirection === "desc" ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-surface-2 text-foreground border-border hover:bg-surface-3"}`}
                      >
                        Descending
                      </button>
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Right side buttons */}
            <div className="ml-auto flex items-center gap-1.5">
              <ImportExcelBtn
                columnMapping={importColumnMapping}
                onImport={handleImportExcelRows}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium border border-border bg-background hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <Download className="size-3.5" /> Import
              </ImportExcelBtn>

              <TBtn onClick={exportPDF}>
                <FileText className="size-3.5" /> Export
              </TBtn>

              <TBtn primary onClick={addRow}>
                <Plus className="size-3.5" /> New Load
              </TBtn>
            </div>

            {/* Bulk Actions Bar Overlay */}
            {selected.size > 0 && (
              <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                <span className="font-semibold">{selected.size} selected</span>
                <span className="text-primary/30">·</span>
                <BulkBtn icon={Flag} onClick={() => {
                  if (selected.size === 0) return;
                  const allFlagged = Array.from(selected).every(id => rows.find(r => r.id === id)?.flagged);
                  const nextState = !allFlagged;
                  pushToHistory(rows, history, setHistory, setRedoStack);
                  setRows(prev => prev.map(r => selected.has(r.id) ? { ...r, flagged: nextState } : r));
                  toast.info(nextState ? `Flagged ${selected.size} load(s) for review` : `Unflagged ${selected.size} load(s)`);
                }}>
                  Flag
                </BulkBtn>
                <BulkBtn icon={MessageSquare} onClick={() => {
                  const firstSelectedId = Array.from(selected)[0];
                  const targetRow = rows.find(r => r.id === firstSelectedId);
                  handleOpenComment(firstSelectedId, targetRow?.description || "Selected Load");
                }}>
                  Comment
                </BulkBtn>
                <BulkBtn icon={Copy} onClick={duplicateSelected}>
                  Duplicate
                </BulkBtn>
                <BulkBtn icon={Trash} onClick={deleteSelected}>
                  Delete
                </BulkBtn>
                <button
                  onClick={() => {
                    setSelected(new Set());
                    setActiveRowId(undefined);
                  }}
                  className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                >
                  <X className="size-3" /> Clear
                </button>
              </div>
            )}
          </div>
          
          {/* Main Content Area - Flush with Toolbar, No Gap */}
          <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
             {/* Unified Single Container for Grid & Footer Calculations */}
             <div className="flex-1 min-h-0 flex flex-col bg-background overflow-hidden">
                {rows.length > 0 ? (
                  filteredRows.length > 0 ? (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                      <DataGrid
                        rows={filteredRows}
                        columns={columns}
                        selected={selected}
                        onToggle={handleToggle}
                        onToggleAll={handleToggleAll}
                        onRowDoubleClick={(row) => setPreviewRow(row)}
                        rowClassName={(row) => (row.flagged ? "bg-red-500/[0.04] dark:bg-red-500/[0.08]" : "")}
                        renderContextMenu={(row) => {
                          const rowComments = getMergedItemComments(row.id, row.description, (row as any).comments || commentsList.filter(c => c.targetId === row.id || (c as any).itemId === row.id), "/load-summary", project?.id);
                          return (
                            <ContextMenuContent className="w-56">
                              <ContextMenuItem onClick={() => setPreviewRow(row)}>
                                <Sparkles className="size-4 mr-2 text-amber-500" />
                                <span>Calculation Preview</span>
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleToggleFlag(row.id)}>
                                <Flag className="size-4 mr-2 text-red-500" />
                                <span>{row.flagged ? "Unflag Load" : "Flag for Review"}</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => handleOpenComment(row.id, row.description || `Load ${row.id}`)}>
                                <MessageSquare className="size-4 mr-2 text-blue-500" />
                                <span>{rowComments.length > 0 ? `Comments (${rowComments.length})` : "Add Comment / Assign Task"}</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => {
                                const newRow = { ...row, id: `ls_${Math.random().toString(36).slice(2, 9)}` };
                                pushToHistory(rows, history, setHistory);
                                setRows(prev => {
                                  const idx = prev.findIndex(r => r.id === row.id);
                                  const next = [...prev];
                                  next.splice(idx + 1, 0, newRow);
                                  return next;
                                });
                              }}>
                                <Copy className="size-4 mr-2" /> Duplicate Row
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => {
                                pushToHistory(rows, history, setHistory);
                                setRows(prev => prev.filter(r => r.id !== row.id));
                                setSelected(prev => {
                                  const next = new Set(prev);
                                  next.delete(row.id);
                                  return next;
                                });
                              }} className="text-red-600 dark:text-red-400 focus:text-red-600">
                                <Trash className="size-4 mr-2" /> Delete Row
                              </ContextMenuItem>
                            </ContextMenuContent>
                          );
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm text-muted-foreground">
                        <Filter className="size-5" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">No matching loads found</h3>
                      <p className="text-xs text-muted-foreground max-w-sm mb-4">
                        No rows match your current search or filter query. Try clearing filters to see all loads.
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          handleResetFilters();
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                      >
                        Reset Search & Filters
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm">
                      <Plus className="size-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">No load summary rows</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mb-4">
                      Add a row or load sample data to begin calculating your total electrical load.
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={addRow}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-[12.5px] font-medium shadow-sm transition-all cursor-pointer"
                      >
                        <Plus className="size-3.5" /> Add First Row
                      </button>
                      <button 
                        onClick={loadDummyData}
                        className="flex items-center gap-1.5 px-4 py-2 border border-border hover:bg-surface-2 rounded-full text-[12.5px] font-medium transition-all cursor-pointer"
                      >
                        <Sparkles className="size-3.5 text-primary" /> Load Sample Data
                      </button>
                    </div>
                  </div>
                )}

                {/* Clean Status Bar Footer matching ventilation screenshot */}
                {rows.length > 0 && (
                  <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print select-none">
                    <div>
                      Showing <span className="text-foreground font-medium tabular">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} spaces
                      {isFiltered && (
                        <span className="ml-2 font-mono text-primary font-medium">({filteredPower.toFixed(2)} kW filtered)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 tabular">
                      <span>Σ Power: <span className="font-mono text-foreground font-semibold">{totalPower.toFixed(2)} kW</span></span>
                      <span>Σ Power (+10%): <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{totalPowerWithSafety.toFixed(2)} kW</span></span>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/80">
                        <span>Transformers:</span>
                        <input
                          type="text"
                          value={transformers}
                          onChange={(e) => setTransformers(e.target.value)}
                          placeholder="e.g. 2 x 1500 kVA"
                          className="h-5 w-32 px-1.5 bg-background/80 border border-border/80 rounded text-[11px] font-mono outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Assign Comment & Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType={commentTargetItem.type || "load"}
          calculatorTitle="Electrical Load Summary"
          calculatorPath="/load-summary"
          existingComments={getMergedItemComments(commentTargetItem.id, commentTargetItem.name, commentsList, "/load-summary", project?.id)}
          onSave={handleSaveComment}
        />
      )}

      {/* Calculation Preview Modal on Double-click */}
      <CalculationPreviewModal
        isOpen={!!previewRow}
        onClose={() => setPreviewRow(null)}
        data={previewRow ? getCalculationPreview(previewRow) : null}
      />
    </AppShell>
  );
}
