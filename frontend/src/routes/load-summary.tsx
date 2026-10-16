import { cn } from '@/lib/utils';
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportLoadSummaryPDF } from "@/lib/exportLoadSummaryPDF";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import React, { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { ImportSourceModal } from "@/components/workspace/ImportSourceModal";
import { useWorkspace } from "@/lib/workspace-store";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { Plus, Download, Upload, Printer, Trash, Trash2, Copy, CopyPlus, X, BookOpen, Calculator, Sliders, Info, Database, Filter, ArrowUpDown, SlidersHorizontal, Sparkles, FileText, MessageSquare, Flag, Zap, Activity, Layers, UploadCloud, Building2, ExternalLink, Loader2, RefreshCw, Box, Snowflake, Wind, ChevronDown, Edit3 } from "lucide-react";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent, ContextMenuShortcut } from "@/components/ui/context-menu";
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
import { EditLoadSummaryModal } from "@/components/workspace/EditLoadSummaryModal";
import { FloorSelect } from "@/components/workspace/FloorSelect";
import { LoadSummaryIntelligenceDrawer } from "@/components/workspace/LoadSummaryIntelligenceDrawer";
import {
  type LoadRow,
  computeRowOutputs,
  getCalculationPreview,
  pullFromOtherCalculators,
  exportToTransformerSizing,
  exportToGeneratorSizing,
  importIfcFileToLoadSummary,
  getCommercialBenchmarkLoads,
  hasActive3dSpaces,
  extractFloorName,
  sortLoadRowsFloorWise,
  cleanSpaceName,
  cleanRemarks,
  getPreliminaryCoolingLoadSpaces,
  importFromPreliminaryCoolingLoad,
  getVentilationSpaces,
  importFromVentilationCalc,
  getSpaceTypeBenchmark,
} from "@/lib/calc-load-summary";
import { getFloorRank } from "@/lib/bimViewerSpaceExtractor";
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
          : "hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 cursor-text"
      } ${className}`}
    />
  );
}

function LoadSummaryPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/load-summary", activeProjectId || project?.id);
  const rawReadOnly = useCalculationEffectiveReadOnly("/load-summary", activeProjectId || project?.id);
  const lockApproved = useCalculationLock("/load-summary");
  const isEffectiveReadOnly = rawReadOnly || lockApproved;
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();
  const prompt = usePrompt();
  const [intelOpen, setIntelOpen] = useState(false);

  const [rows, setRows] = useState<LoadRow[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const pId = activeProjectId || project?.id || "default";
      const saved = localStorage.getItem(`mep_load_summary_rows_${pId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: any) => {
            const floor = r.floor || extractFloorName(r);
            const description = cleanSpaceName(r.description || "");
            const remarks = cleanRemarks(r.remarks);
            return computeRowOutputs({ ...r, floor, description, remarks });
          });
        }
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pId = activeProjectId || project?.id || "default";
      const saved = localStorage.getItem(`mep_load_summary_rows_${pId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRows(parsed.map((r: any) => {
            const floor = r.floor || extractFloorName(r);
            const description = cleanSpaceName(r.description || "");
            const remarks = cleanRemarks(r.remarks);
            return computeRowOutputs({ ...r, floor, description, remarks });
          }));
        }
      }
    } catch {}
  }, [activeProjectId, project?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pId = activeProjectId || project?.id || "default";
      localStorage.setItem(`mep_load_summary_rows_${pId}`, JSON.stringify(rows));
    } catch {}
  }, [rows, activeProjectId, project?.id]);

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

  // Add Load Modal State
  const [showAddLoadModal, setShowAddLoadModal] = useState(false);
  const [newLoadFloor, setNewLoadFloor] = useState("FIRST FLOOR");
  const [newLoadDescription, setNewLoadDescription] = useState("");
  const [newLoadQty, setNewLoadQty] = useState<number | "">(1);
  const [newLoadArea, setNewLoadArea] = useState<number | "">("");
  const [newLoadLighting, setNewLoadLighting] = useState<number | "">("");
  const [newLoadPower, setNewLoadPower] = useState<number | "">("");
  const [newLoadHvac, setNewLoadHvac] = useState<number | "">("");
  const [newLoadOther, setNewLoadOther] = useState<number | "">("");
  const [newLoadRemarks, setNewLoadRemarks] = useState("");

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

  // Import Source Modal State
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // 3D BIM Sync Modal State
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [isExtractingIfc, setIsExtractingIfc] = useState(false);
  const [ifcFileName, setIfcFileName] = useState<string | null>(null);

  // Toolbar state: search, filter, and sort
  const [editingLoadRow, setEditingLoadRow] = useState<{ row: LoadRow; isNew?: boolean } | null>(null);
  const [previewRow, setPreviewRow] = useState<LoadRow | null>(null);
  const [activeTab, setActiveTab] = useState<"schedule" | "report">("schedule");
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<string>("all");
  const [customFloorOrder, setCustomFloorOrder] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<"all" | "lighting" | "power" | "hvac" | "other">("all");
  const [filterNonZeroOnly, setFilterNonZeroOnly] = useState(false);
  const [filterWithRemarksOnly, setFilterWithRemarksOnly] = useState(false);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<"default" | "floor" | "description" | "qty" | "area" | "lighting" | "power" | "hvac" | "other" | "totalLoad">("default");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const allUniqueFloors = useMemo(() => {
    const floorSet = new Set<string>();
    rows.forEach((r) => {
      floorSet.add(extractFloorName(r));
    });
    return Array.from(floorSet).sort((a, b) => {
      const rankA = getFloorRank(a);
      const rankB = getFloorRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [rows]);

  const activeFiltersCount = (selectedFloor !== "all" ? 1 : 0) + (filterType !== "all" ? 1 : 0) + (filterNonZeroOnly ? 1 : 0) + (filterWithRemarksOnly ? 1 : 0) + (filterFlaggedOnly ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedFloor("all");
    setFilterType("all");
    setFilterNonZeroOnly(false);
    setFilterWithRemarksOnly(false);
    setFilterFlaggedOnly(false);
  };

  const handleResetSort = () => {
    setSortKey("default");
    setSortDirection("asc");
    setCustomFloorOrder([]);
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

    if (selectedFloor !== "all") {
      result = result.filter(r => extractFloorName(r) === selectedFloor);
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

    if (sortKey === "default" || sortKey === "floor") {
      result = sortLoadRowsFloorWise(result, sortDirection);
    } else {
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
  }, [rows, searchQuery, selectedFloor, filterType, filterNonZeroOnly, filterWithRemarksOnly, filterFlaggedOnly, sortKey, sortDirection]);

  // Unique floors ordered by elevation (Basement -> Ground -> 1st -> 2nd -> Roof)
  const sortedFloorOrder = useMemo(() => {
    const floorSet = new Set<string>();
    filteredRows.forEach((r) => {
      floorSet.add(extractFloorName(r));
    });
    const floors = Array.from(floorSet);
    return floors.sort((a, b) => {
      if (customFloorOrder.length > 0) {
        const idxA = customFloorOrder.indexOf(a);
        const idxB = customFloorOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      const rankA = getFloorRank(a);
      const rankB = getFloorRank(b);
      if (rankA !== rankB) {
        return sortDirection === "desc" && (sortKey === "default" || sortKey === "floor")
          ? rankB - rankA
          : rankA - rankB;
      }
      const comp = a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "desc" && (sortKey === "default" || sortKey === "floor") ? -comp : comp;
    });
  }, [filteredRows, customFloorOrder, sortDirection, sortKey]);

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

  const addSpaceToFloor = (floor?: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const defaultFloor = floor || sortedFloorOrder[0] || "FIRST FLOOR";
    const nextNum = rows.length + 1;
    const newId = `ls_${Math.random().toString(36).slice(2, 9)}`;
    const newRow: LoadRow = {
      id: newId,
      floor: defaultFloor,
      description: `Space ${nextNum}`,
      qty: 1,
      area: unitSystem === "ip" ? 500 : 50,
      lighting: 10,
      power: 25,
      hvac: 80,
      other: 0,
      totalLoad: 0,
      remarks: "",
      flagged: false,
    };
    const computed = computeRowOutputs(newRow);
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows((prev) => [...prev, computed]);
    setSelected(new Set([newId]));
    setActiveRowId(newId);
    setEditingLoadRow({ row: computed, isNew: true });
  };

  const addRow = () => {
    const defaultFloor = sortedFloorOrder[0] || "FIRST FLOOR";
    addSpaceToFloor(defaultFloor);
  };

  const handleAddLoadSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isEffectiveReadOnly) {
      toast.info("Calculation is in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const floor = newLoadFloor.trim().toUpperCase() || "FIRST FLOOR";
    const newId = `ls_${Math.random().toString(36).slice(2, 9)}`;
    const newRow: LoadRow = {
      id: newId,
      floor,
      description: newLoadDescription.trim() || `Load ${rows.length + 1}`,
      qty: typeof newLoadQty === "number" ? newLoadQty : Number(newLoadQty) || 1,
      area: typeof newLoadArea === "number" ? newLoadArea : Number(newLoadArea) || 0,
      lighting: typeof newLoadLighting === "number" ? newLoadLighting : Number(newLoadLighting) || 0,
      power: typeof newLoadPower === "number" ? newLoadPower : Number(newLoadPower) || 0,
      hvac: typeof newLoadHvac === "number" ? newLoadHvac : Number(newLoadHvac) || 0,
      other: typeof newLoadOther === "number" ? newLoadOther : Number(newLoadOther) || 0,
      totalLoad: 0,
      remarks: newLoadRemarks.trim(),
      flagged: false,
    };
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows((prev) => [...prev, computeRowOutputs(newRow)]);
    setSelected(new Set());
    setActiveRowId(newId);
    setShowAddLoadModal(false);
    toast.success(`Load "${newRow.description}" added to ${newRow.floor}!`);
  };

  const loadDummyData = () => {
    const dummy: LoadRow[] = [
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, floor: "FIRST FLOOR", description: "Office", qty: 1, area: 150, lighting: 1.5, power: 3.0, hvac: 15.0, other: 0, totalLoad: 0, remarks: "", flagged: false },
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, floor: "SECOND FLOOR", description: "Meeting Rooms", qty: 2, area: 40, lighting: 0.5, power: 1.0, hvac: 4.0, other: 0, totalLoad: 0, remarks: "Dimmable", flagged: false },
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, floor: "GROUND FLOOR", description: "Server Room", qty: 1, area: 20, lighting: 0.2, power: 20.0, hvac: 25.0, other: 0, totalLoad: 0, remarks: "Critical load", flagged: true },
      { id: `ls_${Math.random().toString(36).slice(2, 9)}`, floor: "GROUND FLOOR", description: "Pantry", qty: 1, area: 15, lighting: 0.15, power: 5.0, hvac: 1.5, other: 0, totalLoad: 0, remarks: "", flagged: false }
    ];
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, ...dummy.map(computeRowOutputs)]);
    toast.success("Loaded sample office loads.");
  };

  const handlePullFromCalculators = () => {
    const pId = activeProjectId || project?.id || "default";
    const result = pullFromOtherCalculators(pId, rows);
    if (result.sourceType === "none" || (result.spacesUpdated === 0 && result.newSpacesAdded === 0)) {
      setSyncModalOpen(true);
      return;
    }
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(result.rows.map(r => ({ ...r, remarks: cleanRemarks(r.remarks) })));
    toast.success(`✨ Synced ${result.rows.length} spaces (${result.spacesUpdated} updated, ${result.newSpacesAdded} added)!`, {
      description: `Lighting: ${result.lightingTotalKw} kW · HVAC: ${result.hvacTotalKw} kW aggregated from 3D & other calculators.`,
    });
  };

  const pclSpacesCount = useMemo(() => {
    const pId = activeProjectId || project?.id || "default";
    return getPreliminaryCoolingLoadSpaces(pId).length;
  }, [activeProjectId, project?.id, syncModalOpen, sourceModalOpen]);

  const ventSpacesCount = useMemo(() => {
    const pId = activeProjectId || project?.id || "default";
    return getVentilationSpaces(pId).length;
  }, [activeProjectId, project?.id, syncModalOpen, sourceModalOpen]);

  const handleImportPreliminaryCooling = () => {
    const pId = activeProjectId || project?.id || "default";
    const newRows = importFromPreliminaryCoolingLoad(pId);
    if (newRows.length === 0) {
      toast.error("No spaces found in Preliminary Cooling Load yet.", {
        description: "Please calculate or add spaces in Preliminary Cooling Load (/preliminary-cooling-load) first.",
        action: {
          label: "Open Preliminary Cooling",
          onClick: () => {
            window.location.href = "/preliminary-cooling-load";
          },
        },
      });
      return;
    }
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(newRows);
    setSyncModalOpen(false);
    setSourceModalOpen(false);
    toast.success(`❄️ Imported ${newRows.length} spaces from Preliminary Cooling Load!`, {
      description: "Room areas, cooling kW loads, lighting, and small power calculated floor-wise.",
    });
  };

  const handleImportVentilation = () => {
    const pId = activeProjectId || project?.id || "default";
    const newRows = importFromVentilationCalc(pId);
    if (newRows.length === 0) {
      toast.error("No spaces found in Ventilation schedule yet.", {
        description: "Please add spaces in Ventilation Calculation (/ventilation) first.",
        action: {
          label: "Open Ventilation",
          onClick: () => {
            window.location.href = "/ventilation";
          },
        },
      });
      return;
    }
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(newRows);
    setSyncModalOpen(false);
    setSourceModalOpen(false);
    toast.success(`💨 Imported ${newRows.length} spaces from Ventilation schedule!`, {
      description: "Room areas, fresh air CFM, and electrical loads calculated floor-wise.",
    });
  };

  const handleIfcFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingIfc(true);
    setIfcFileName(file.name);
    try {
      const pId = activeProjectId || project?.id || "default";
      const newRows = await importIfcFileToLoadSummary(file, pId);
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(newRows.map(r => ({ ...r, remarks: cleanRemarks(r.remarks) })));
      setSyncModalOpen(false);
      setSourceModalOpen(false);
      toast.success(`✨ Extracted ${newRows.length} spaces from ${file.name}!`, {
        description: "Rooms, floor areas, and ASHRAE/NEC electrical & HVAC loads calculated.",
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to parse spaces from IFC file.");
    } finally {
      setIsExtractingIfc(false);
      e.target.value = "";
    }
  };

  const handleLoadBenchmarkSpaces = () => {
    const benchmarkRows = getCommercialBenchmarkLoads();
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(benchmarkRows.map(r => ({ ...r, remarks: cleanRemarks(r.remarks) })));
    setSyncModalOpen(false);
    setSourceModalOpen(false);
    toast.success(`🏢 Loaded 10 standard commercial spaces!`, {
      description: "Includes Reception, Open Office, Boardroom, Meeting Rooms, Server Room, AHU Plant Room, and Electrical Room.",
    });
  };

  const handleCascadeToTransformer = () => {
    if (rows.length === 0) {
      toast.error("No loads in Load Summary to size transformer.");
      return;
    }
    const pId = activeProjectId || project?.id || "default";
    const loads = exportToTransformerSizing(pId, rows);
    toast.success(`⚡ Exported ${loads.length} connected loads to Transformer Sizing!`, {
      action: {
        label: "Open Transformer Sizing",
        onClick: () => {
          window.location.href = "/transformer-sizing";
        },
      },
    });
  };

  const handleCascadeToGenerator = () => {
    if (rows.length === 0) {
      toast.error("No loads in Load Summary to size generator.");
      return;
    }
    const pId = activeProjectId || project?.id || "default";
    const loads = exportToGeneratorSizing(pId, rows);
    toast.success(`⚡ Exported ${loads.length} essential/emergency loads to Generator Sizing!`, {
      action: {
        label: "Open Generator Sizing",
        onClick: () => {
          window.location.href = "/generator-sizing";
        },
      },
    });
  };

  const deleteSelected = async () => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
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
    if (isEffectiveReadOnly) {
      toast.info("Calculation is in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
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

      if (e.key.toLowerCase() === "f" && !isCmdOrCtrl && selected.size > 0) {
        e.preventDefault();
        const allFlagged = Array.from(selected).every(id => rows.find(r => r.id === id)?.flagged);
        const nextState = !allFlagged;
        pushToHistory(rows, history, setHistory, setRedoStack);
        setRows(prev => prev.map(r => selected.has(r.id) ? { ...r, flagged: nextState } : r));
        toast.info(nextState ? `Flagged ${selected.size} load(s) for review` : `Unflagged ${selected.size} load(s)`);
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
              description: `${cleanSpaceName(item.description)} (Copy)`
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
    floor: ["Floor", "Level", "Floor Level", "Story", "Storey", "FLR", "Floor/Level", "Level/Floor", "Location", "Zone"],
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
    let currentActiveFloor = "FIRST FLOOR";
    const newRows: LoadRow[] = [];

    mappedRows.forEach((mr, idx) => {
      const rawDesc = String(mr.description || mr.space || mr.name || "").trim();
      const rawFloor = mr.floor ? String(mr.floor).trim().toUpperCase() : "";

      // Check if this row is a floor section header row (e.g., only "GROUND FLOOR" or "SECOND FLOOR", with no numbers)
      const isFloorHeader = !rawFloor && rawDesc && /^(?:BASEMENT\s*\d*|GROUND\s*FLOOR|FIRST\s*FLOOR|SECOND\s*FLOOR|THIRD\s*FLOOR|FOURTH\s*FLOOR|FIFTH\s*FLOOR|SIXTH\s*FLOOR|ROOF\s*(?:LEVEL|FLOOR)?|TYPICAL\s*FLOOR(?:\s*\([^)]*\))?|MEZZANINE|PODIUM|LEVEL\s*\d+|L\d+|B\d+|GF|FF|SF|TF)$/i.test(rawDesc);
      const isNumericRow = (Number(mr.area) || 0) > 0 || (Number(mr.lighting) || 0) > 0 || (Number(mr.power) || 0) > 0 || (Number(mr.hvac) || 0) > 0 || (Number(mr.other) || 0) > 0;

      if (isFloorHeader && !isNumericRow) {
        currentActiveFloor = extractFloorName({ description: rawDesc });
        return;
      }

      // If description and all numeric fields are blank, skip
      if (!rawDesc && !isNumericRow && !mr.remarks) return;

      const floor = rawFloor || extractFloorName({ floor: rawFloor, description: rawDesc }) || currentActiveFloor;
      if (floor && floor !== "FIRST FLOOR") {
        currentActiveFloor = floor;
      }

      const row: LoadRow = {
        id: `ls_import_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        floor: floor || currentActiveFloor,
        description: cleanSpaceName(rawDesc || `Load ${idx + 1}`),
        qty: mr.qty !== undefined && mr.qty !== null && !isNaN(Number(mr.qty)) && Number(mr.qty) > 0 ? Number(mr.qty) : 1,
        area: Number(mr.area) || 0,
        lighting: Number(mr.lighting) || 0,
        power: Number(mr.power) || 0,
        hvac: Number(mr.hvac) || 0,
        other: Number(mr.other) || 0,
        totalLoad: 0,
        remarks: mr.remarks || "",
        flagged: Boolean(mr.flagged)
      };
      newRows.push(computeRowOutputs(row));
    });
    
    if (newRows.length > 0) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(prev => [...prev, ...newRows]);
      toast.success(`Successfully imported ${newRows.length} load row(s) from Excel.`);
    } else {
      toast.info("No load rows found to import.");
    }
  };

  const handleExcelFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { read, utils } = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = read(data);
      if (!workbook.SheetNames.length) {
        toast.error("Excel file is empty");
        return;
      }
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      const raw2D = utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
      if (!raw2D || raw2D.length === 0) {
        toast.error("No valid data rows found in the Excel sheet");
        return;
      }

      const isHeaderTerm = (val: any) => {
        if (typeof val !== "string" && typeof val !== "number") return false;
        const s = String(val).toLowerCase().replace(/[^a-z0-9]/g, "");
        return [
          "description", "space", "room", "area", "qty", "lighting", "power", "hvac", "load", "kw", "remark"
        ].some((t) => s.includes(t));
      };

      let headerRowIndex = -1;
      let headerRow: string[] = [];
      for (let i = 0; i < Math.min(raw2D.length, 30); i++) {
        const rowArr = raw2D[i];
        if (Array.isArray(rowArr) && rowArr.some(isHeaderTerm)) {
          headerRowIndex = i;
          headerRow = rowArr.map((c) => String(c || "").trim());
          break;
        }
      }

      let jsonRows: Record<string, any>[] = [];
      if (headerRowIndex !== -1 && headerRow.length > 0) {
        for (let i = headerRowIndex + 1; i < raw2D.length; i++) {
          const rowArr = raw2D[i];
          if (!Array.isArray(rowArr) || rowArr.length === 0) continue;
          const rowObj: Record<string, any> = {};
          let hasValue = false;
          rowArr.forEach((cellVal, colIdx) => {
            const hName = headerRow[colIdx];
            if (hName) {
              rowObj[hName] = cellVal;
              if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== "") {
                hasValue = true;
              }
            }
          });
          if (hasValue) jsonRows.push(rowObj);
        }
      } else {
        jsonRows = utils.sheet_to_json<Record<string, any>>(firstSheet);
      }

      if (!jsonRows || jsonRows.length === 0) {
        toast.error("No valid data rows found in the Excel sheet");
        return;
      }

      // Map rows using importColumnMapping
      const mappedRows: Record<string, any>[] = [];
      jsonRows.forEach((row) => {
        const newObj: Record<string, any> = { ...row };
        for (const [key, mapping] of Object.entries(importColumnMapping)) {
          const targets = Array.isArray(mapping) ? mapping : [key, mapping];
          for (const target of targets) {
            if (row[target] !== undefined && row[target] !== null && row[target] !== "") {
              newObj[key] = row[target];
              break;
            }
            const normTarget = target.toLowerCase().replace(/[^a-z0-9]/g, "");
            for (const rKey of Object.keys(row)) {
              const normRKey = rKey.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (normRKey === normTarget && row[rKey] !== undefined && row[rKey] !== "") {
                newObj[key] = row[rKey];
                break;
              }
            }
            if (newObj[key] !== undefined) break;
          }
        }
        mappedRows.push(newObj);
      });

      handleImportExcelRows(mappedRows);
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse Excel file");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const exportPDF = () => {
    if (rows.length === 0) {
      toast.info("No load rows to export.");
      return;
    }

    exportLoadSummaryPDF(
      {
        rows,
        filteredRows,
        totalPower,
        totalPowerWithSafety,
        transformers,
        unitSystem,
        sortedFloorOrder,
      },
      unitSystem,
      {
        projectName: project?.name,
        projectNo: project?.code,
        client: (project as any)?.client,
        endUser: (project as any)?.endUser,
        userName: currentUserName,
      }
    );
  };

  const loadRowClasses = useMemo(() => {
    const classes: Record<string, string> = {};
    const floorGroups: Record<string, LoadRow[]> = {};
    filteredRows.forEach((r) => {
      const fl = extractFloorName(r);
      if (!floorGroups[fl]) floorGroups[fl] = [];
      floorGroups[fl].push(r);
    });

    sortedFloorOrder.forEach((fl) => {
      const groupRows = floorGroups[fl] || [];
      groupRows.forEach((r, idx) => {
        if (r.flagged) {
          classes[r.id] = "bg-red-500/[0.04] dark:bg-red-500/[0.08]";
        } else if (idx % 2 === 0) {
          classes[r.id] = "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80";
        } else {
          classes[r.id] = "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40";
        }
      });
    });
    return classes;
  }, [filteredRows, sortedFloorOrder]);

  const columns: Column<LoadRow>[] = useMemo(() => [
    {
      key: "description",
      header: "SPACE NAME",
      width: 240,
      editable: true,
      render: (row) => {
        const isInteractive = selected.has(row.id);
        return (
          <div className={cn("w-full h-full flex items-center px-1", !isInteractive && "pointer-events-none select-none")}>
            <InlineInput
              disabled={isEffectiveReadOnly}
              value={cleanSpaceName(row.description)}
              placeholder="e.g. Bathroom"
              onCommit={(val) => updateRow(row.id, { description: cleanSpaceName(val) })}
              onDoubleClick={() => setPreviewRow(row)}
              className="text-[13.5px] font-medium min-w-0 w-full"
            />
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
      render: (row) => {
        const isInteractive = selected.has(row.id);
        return (
          <div className={cn("w-full h-full flex items-center justify-center", !isInteractive && "pointer-events-none select-none")}>
            <InlineInput
              disabled={isEffectiveReadOnly}
              type="number"
              min={0}
              value={row.qty === 0 ? "" : row.qty}
              onCommit={(val) => updateRow(row.id, { qty: parseFloat(val) || 0 })}
              onDoubleClick={() => setPreviewRow(row)}
              className="font-mono tabular text-[13.5px] text-center"
            />
          </div>
        );
      }
    },
    {
      key: "area",
      header: unitSystem === "ip" ? "AREA (SQ.FT)" : "AREA (M²)",
      width: 90,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => {
        const isInteractive = selected.has(row.id);
        return (
          <div className={cn("w-full h-full flex items-center justify-center", !isInteractive && "pointer-events-none select-none")}>
            <InlineInput
              disabled={isEffectiveReadOnly}
              type="number"
              step="0.1"
              min={0}
              value={row.area === 0 ? "" : row.area}
              onCommit={(val) => updateRow(row.id, { area: parseFloat(val) || 0 })}
              onDoubleClick={() => setPreviewRow(row)}
              className="font-mono tabular text-[13.5px] text-center"
            />
          </div>
        );
      }
    },
    {
      key: "lighting",
      header: "LIGHTING (KW)",
      width: 100,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => {
        const isInteractive = selected.has(row.id);
        const isSuggested = !row.isLightingCustomized && row.lighting > 0;
        return (
          <div className={cn("flex items-center justify-center gap-1.5 w-full h-full px-1", !isInteractive && "pointer-events-none select-none")}>
            <span
              title={isSuggested ? "Auto-suggested benchmark value" : undefined}
              className={`size-1.5 rounded-full shrink-0 ${isSuggested ? "bg-blue-500 cursor-help" : "bg-transparent pointer-events-none"}`}
            />
            <InlineInput
              disabled={isEffectiveReadOnly}
              type="number"
              step="0.1"
              min={0}
              value={row.lighting === 0 ? "" : row.lighting}
              onCommit={(val) => updateRow(row.id, { lighting: parseFloat(val) || 0, isLightingCustomized: true })}
              onDoubleClick={() => setPreviewRow(row)}
              className="font-mono tabular text-[13.5px] text-center min-w-0 flex-1"
            />
            <span className="size-1.5 shrink-0 pointer-events-none bg-transparent" />
          </div>
        );
      }
    },
    {
      key: "power",
      header: "POWER (KW)",
      width: 95,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => {
        const isInteractive = selected.has(row.id);
        const isSuggested = !row.isPowerCustomized && row.power > 0;
        return (
          <div className={cn("flex items-center justify-center gap-1.5 w-full h-full px-1", !isInteractive && "pointer-events-none select-none")}>
            <span
              title={isSuggested ? "Auto-suggested benchmark value" : undefined}
              className={`size-1.5 rounded-full shrink-0 ${isSuggested ? "bg-blue-500 cursor-help" : "bg-transparent pointer-events-none"}`}
            />
            <InlineInput
              disabled={isEffectiveReadOnly}
              type="number"
              step="0.1"
              min={0}
              value={row.power === 0 ? "" : row.power}
              onCommit={(val) => updateRow(row.id, { power: parseFloat(val) || 0, isPowerCustomized: true })}
              onDoubleClick={() => setPreviewRow(row)}
              className="font-mono tabular text-[13.5px] text-center min-w-0 flex-1"
            />
            <span className="size-1.5 shrink-0 pointer-events-none bg-transparent" />
          </div>
        );
      }
    },
    {
      key: "hvac",
      header: "HVAC (KW)",
      width: 95,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => {
        const isInteractive = selected.has(row.id);
        const isSuggested = !row.isHvacCustomized && row.hvac > 0;
        return (
          <div className={cn("flex items-center justify-center gap-1.5 w-full h-full px-1", !isInteractive && "pointer-events-none select-none")}>
            <span
              title={isSuggested ? "Auto-suggested benchmark value" : undefined}
              className={`size-1.5 rounded-full shrink-0 ${isSuggested ? "bg-blue-500 cursor-help" : "bg-transparent pointer-events-none"}`}
            />
            <InlineInput
              disabled={isEffectiveReadOnly}
              type="number"
              step="0.1"
              min={0}
              value={row.hvac === 0 ? "" : row.hvac}
              onCommit={(val) => updateRow(row.id, { hvac: parseFloat(val) || 0, isHvacCustomized: true })}
              onDoubleClick={() => setPreviewRow(row)}
              className="font-mono tabular text-[13.5px] text-center min-w-0 flex-1"
            />
            <span className="size-1.5 shrink-0 pointer-events-none bg-transparent" />
          </div>
        );
      }
    },
    {
      key: "other",
      header: "OTHER (KW)",
      width: 95,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => {
        const isInteractive = selected.has(row.id);
        const isSuggested = !row.isOtherCustomized && row.other > 0;
        return (
          <div className={cn("flex items-center justify-center gap-1.5 w-full h-full px-1", !isInteractive && "pointer-events-none select-none")}>
            <span
              title={isSuggested ? "Auto-suggested benchmark value" : undefined}
              className={`size-1.5 rounded-full shrink-0 ${isSuggested ? "bg-blue-500 cursor-help" : "bg-transparent pointer-events-none"}`}
            />
            <InlineInput
              disabled={isEffectiveReadOnly}
              type="number"
              step="0.1"
              min={0}
              value={row.other === 0 ? "" : row.other}
              onCommit={(val) => updateRow(row.id, { other: parseFloat(val) || 0, isOtherCustomized: true })}
              onDoubleClick={() => setPreviewRow(row)}
              className="font-mono tabular text-[13.5px] text-center min-w-0 flex-1"
            />
            <span className="size-1.5 shrink-0 pointer-events-none bg-transparent" />
          </div>
        );
      }
    },
    {
      key: "totalLoad",
      header: "TOTAL LOAD (KW)",
      width: 120,
      align: "center",
      mono: true,
      render: (row) => (
        <span
          onDoubleClick={() => setPreviewRow(row)}
          className="w-full text-center px-1 font-mono tabular font-medium text-foreground text-[13.5px] cursor-default"
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
      render: (row) => {
        const isInteractive = selected.has(row.id);
        return (
          <div className={cn("w-full h-full flex items-center px-1", !isInteractive && "pointer-events-none select-none")}>
            <InlineInput
              disabled={isEffectiveReadOnly}
              type="text"
              value={row.remarks}
              placeholder="Remarks..."
              onCommit={(val) => updateRow(row.id, { remarks: val })}
              onDoubleClick={() => setPreviewRow(row)}
              className="text-[13.5px] text-left"
            />
          </div>
        );
      }
    },
    {
      key: "flagged",
      header: "",
      width: 36,
      align: "center",
      render: (row) => {
        const isNoArea = !row.area || parseFloat(String(row.area)) === 0 || isNaN(parseFloat(String(row.area)));
        const isNoLoad = !row.totalLoad || parseFloat(String(row.totalLoad)) === 0;
        const tooltipText = (() => {
          if (isNoArea && isNoLoad) return "Missing space area and load values";
          if (isNoArea) return "Missing space area";
          if (isNoLoad) return "Total connected load is 0 kW";
          return row.flagged ? "Unflag load" : "Flag load";
        })();

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFlag(row.id);
            }}
            className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
            title={tooltipText}
          >
            <Flag
              className={cn(
                "size-3.5 transition-all duration-200",
                row.flagged
                  ? "fill-red-500 text-red-500 scale-110"
                  : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
              )}
            />
          </button>
        );
      }
    }
  ], [filteredRows, commentsList, unitSystem, selected, rows, isEffectiveReadOnly]);

  return (
    <AppShell 
      title="Load Summary" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-center shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Load Summary</h1>
              </div>
              <button 
                type="button"
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Load Summary Intelligence"
              >
                <Sparkles className="size-3.5" /> Intelligence
              </button>
              <CalculationReviewBar 
                projectId={project?.id || "default"} 
                calculatorPath="/load-summary" 
                calculatorTitle="Load Summary" 
              />
            </div>
            
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* White Card Container for Content */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
                ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
                : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} h-full flex flex-col`}>
        <div className="flex flex-col h-full w-full">
          {/* Top Row 1: Section Navigation Tabs & Print matching Pump Sizing */}
          <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setActiveTab("schedule")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "schedule"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  Load Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "report"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  Report
                </button>
              </div>

              {/* Formula Breakdown button placed right next to tabs on the left */}
              <TBtn
                onClick={() => setShowFormulaModal(true)}
                title="View Step-by-Step Formula Breakdown"
              >
                <Info className="size-3.5 text-primary" /> Formula Breakdown
              </TBtn>
            </div>

            {/* Action button on the right of tabs matching Ventilation Standard */}
            <div className="flex items-center gap-2 select-none shrink-0">
              <TBtn onClick={exportPDF} title="Export PDF Calculation">
                <FileText className="size-3.5" /> Export
              </TBtn>
            </div>
          </div>

          {/* Main Schedule View / Preliminary Report View */}
          {activeTab === "schedule" ? (
            <>
              {/* Toolbar matching Preliminary Cooling Load & Reference Screenshot */}
              <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print modal-blur-bg select-none">
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
                  <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Floor Level</span>
                  <select
                    value={selectedFloor}
                    onChange={(e) => setSelectedFloor(e.target.value)}
                    className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                  >
                    <option value="all">All Floors</option>
                    {allUniqueFloors.map((fl) => (
                      <option key={fl} value={fl}>{fl}</option>
                    ))}
                  </select>
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
                    sortKey !== "default" || customFloorOrder.length > 0 || sortDirection !== "asc"
                      ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                      : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                  title="Sort Loads & Arrange Floors"
                >
                  <ArrowUpDown className="size-3.5 shrink-0" />
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                    Sort
                  </span>
                  {(sortKey !== "default" || customFloorOrder.length > 0 || sortDirection !== "asc") && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                      ✓
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <span className="text-[12px] font-semibold text-foreground">Sort & Arrange Floors</span>
                  {(sortKey !== "default" || customFloorOrder.length > 0 || sortDirection !== "asc") && (
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
                    <option value="default">Floor-wise & Space Name (Standard)</option>
                    <option value="floor">Floor Level (Elevation Order)</option>
                    <option value="description">Description (Space Name)</option>
                    <option value="totalLoad">Total Load (kW)</option>
                    <option value="area">{unitSystem === "ip" ? "Area (sq.ft)" : "Area (m²)"}</option>
                    <option value="qty">Qty</option>
                    <option value="lighting">Lighting (kW)</option>
                    <option value="power">Power (kW)</option>
                    <option value="hvac">HVAC (kW)</option>
                    <option value="other">Other (kW)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Direction</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSortDirection("asc")}
                      className={`flex-1 py-1 px-2 rounded text-[11px] border cursor-pointer ${sortDirection === "asc" ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-surface-2 text-foreground border-border hover:bg-surface-3"}`}
                    >
                      {sortKey === "default" || sortKey === "floor" ? "Asc (Basement → Roof)" : "Ascending"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortDirection("desc")}
                      className={`flex-1 py-1 px-2 rounded text-[11px] border cursor-pointer ${sortDirection === "desc" ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-surface-2 text-foreground border-border hover:bg-surface-3"}`}
                    >
                      {sortKey === "default" || sortKey === "floor" ? "Desc (Roof → Basement)" : "Descending"}
                    </button>
                  </div>
                </div>

                {allUniqueFloors.length > 1 && (
                  <div className="flex flex-col gap-1 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Arrange Floors</span>
                      {customFloorOrder.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCustomFloorOrder([])}
                          className="text-[9.5px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
                      {sortedFloorOrder.map((fl, idx) => (
                        <div key={fl} className="flex items-center justify-between px-2 py-1 bg-surface-2 rounded text-[11px] border border-border/60">
                          <span className="font-semibold text-foreground truncate flex-1 min-w-0">{fl}</span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                const next = [...sortedFloorOrder];
                                const tmp = next[idx - 1];
                                next[idx - 1] = next[idx];
                                next[idx] = tmp;
                                setCustomFloorOrder(next);
                              }}
                              className="p-0.5 rounded hover:bg-surface-3 text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title="Move floor up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={idx === sortedFloorOrder.length - 1}
                              onClick={() => {
                                const next = [...sortedFloorOrder];
                                const tmp = next[idx + 1];
                                next[idx + 1] = next[idx];
                                next[idx] = tmp;
                                setCustomFloorOrder(next);
                              }}
                              className="p-0.5 rounded hover:bg-surface-3 text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title="Move floor down"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                      localStorage.removeItem("mep_grid_load_summary");
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

            {/* Right side buttons */}
            <div className="ml-auto flex items-center gap-1">
              <TBtn
                disabled={isEffectiveReadOnly}
                onClick={() => {
                  if (isEffectiveReadOnly) {
                    toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
                    return;
                  }
                  setSourceModalOpen(true);
                }}
                title="Import Spaces from Excel, 3D Studio, Ventilation, or Preliminary Cooling Load"
              >
                <Download className="size-3.5" /> Import
              </TBtn>

              <TBtn onClick={exportPDF} title="Export PDF Report">
                <FileText className="size-3.5" /> Export
              </TBtn>

              <TBtn primary disabled={isEffectiveReadOnly} onClick={addRow}>
                <Plus className="size-3.5" /> New Load
              </TBtn>
            </div>

            {/* Bulk Actions Bar Overlay */}
            {selected.size > 0 && (
              <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                <span className="font-semibold">{selected.size} selected</span>
                <span className="text-primary/30">·</span>
                {selected.size === 1 && (() => {
                  const targetId = Array.from(selected)[0];
                  const found = rows.find(r => r.id === targetId);
                  if (found) {
                    return (
                      <BulkBtn icon={Edit3} onClick={() => setEditingLoadRow({ row: found, isNew: false })}>
                        Edit Load
                      </BulkBtn>
                    );
                  }
                  return null;
                })()}
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
                <BulkBtn icon={Layers} onClick={async () => {
                  const targetFloor = prompt ? await prompt("Enter floor name for selected loads:", "FIRST FLOOR", { title: "Set Floor for Selected Loads" }) : window.prompt("Enter floor name for selected loads:", "FIRST FLOOR");
                  if (targetFloor && targetFloor.trim()) {
                    const formatted = targetFloor.trim().toUpperCase();
                    pushToHistory(rows, history, setHistory, setRedoStack);
                    setRows(prev => prev.map(r => selected.has(r.id) ? { ...r, floor: formatted } : r));
                    toast.success(`Assigned ${selected.size} load(s) to ${formatted}`);
                  }
                }}>
                  Floor
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
                        gridId="load_summary"
                        rows={filteredRows}
                        columns={columns}
                        selected={selected}
                        onToggle={handleToggle}
                        onToggleAll={handleToggleAll}
                        onCommentClick={(row) => handleOpenComment(row.id, row.name || (row as any).spaceName || 'Space')}
                        activeRowId={editingLoadRow?.row.id}
                        onRowDoubleClick={(row) => setEditingLoadRow({ row, isNew: false })}
                        rowClassName={(row) => loadRowClasses[row.id] || ""}
                        groupBy={(row) => extractFloorName(row)}
                        groupOrder={sortedFloorOrder}
                        onToggleGroup={(ids, select) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
                            return next;
                          });
                        }}
                        renderGroupHeader={(floorName) => {
                          const floorRows = filteredRows.filter((r) => extractFloorName(r) === floorName);
                          const spaceCount = floorRows.length;
                          const floorTotalWatts = floorRows.reduce((sum, r) => sum + (r.totalLoad || 0) * (r.qty || 1) * 1000, 0);
                          const floorTotalKw = floorTotalWatts / 1000;
                          const floorTotalArea = floorRows.reduce((sum, r) => sum + (r.area || 0) * (r.qty || 1), 0);
                          return (
                            <div className="flex items-center justify-between w-full pr-3 text-[12px]">
                              <div className="flex items-center gap-2">
                                <span className="font-bold tracking-wide uppercase text-foreground">{floorName}</span>
                                <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">(Right-click or press Delete to remove)</span>
                              </div>
                              <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground font-mono">
                                <span>{spaceCount} {spaceCount === 1 ? "space" : "spaces"}</span>
                                <span>·</span>
                                <span>{floorTotalKw >= 10 ? `${floorTotalKw.toFixed(1)} kW` : `${Math.round(floorTotalWatts).toLocaleString()} W`}</span>
                                <span>·</span>
                                <span>{floorTotalArea.toFixed(1)} {unitSystem === "si" ? "m²" : "sq.ft"}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addSpaceToFloor(floorName);
                                  }}
                                  className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors cursor-pointer"
                                  title={`Add new space to ${floorName}`}
                                >
                                  <Plus className="size-3" /> Space
                                </button>
                              </div>
                            </div>
                          );
                        }}
                        renderGroupContextMenu={(floorName) => (
                          <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment(`fl_${floorName}`, `Floor: ${floorName}`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={async () => {
                                const newFloor = prompt ? await prompt("Enter new floor name:", floorName, { title: "Rename Floor" }) : window.prompt("Enter new floor name:", floorName);
                                if (newFloor && newFloor.trim() && newFloor.trim().toUpperCase() !== floorName) {
                                  const formatted = newFloor.trim().toUpperCase();
                                  pushToHistory(rows, history, setHistory, setRedoStack);
                                  setRows(prev => prev.map(r => ((r.floor || extractFloorName(r)) === floorName ? { ...r, floor: formatted } : r)));
                                  toast.success(`Renamed floor to ${formatted}`);
                                }
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Edit3 className="size-3.5 text-muted-foreground" />
                              <span>Rename Floor</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => {
                                pushToHistory(rows, history, setHistory);
                                setRows(prev => prev.filter(r => (r.floor || extractFloorName(r)) !== floorName));
                                toast.info(`Deleted all loads on ${floorName}`);
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete Floor</span>
                              <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto pl-3 whitespace-nowrap text-right">Delete</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        )}
                        renderContextMenu={(row) => (
                          <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            {/* Add Comment - AT THE TOP with blue ventilation styling */}
                            <ContextMenuItem
                              onClick={() => handleOpenComment(row.id, row.description || `Load ${row.id}`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>

                            {/* Calculation Preview */}
                            <ContextMenuItem
                              onClick={() => setPreviewRow(row)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Sparkles className="size-3.5 text-muted-foreground" />
                              <span>Calculation Preview</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</ContextMenuShortcut>
                            </ContextMenuItem>

                            {/* Flag Space */}
                            <ContextMenuItem
                              onClick={() => handleToggleFlag(row.id)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Flag className={`size-3.5 ${row.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                              <span>{row.flagged ? "Unflag Space" : "Flag Space"}</span>
                            </ContextMenuItem>

                            {(row.isLightingCustomized || row.isPowerCustomized || row.isHvacCustomized || row.isOtherCustomized) && (
                              <ContextMenuItem
                                onClick={() => {
                                  const bench = getSpaceTypeBenchmark(row.description);
                                  const area = row.area || 10;
                                  const lKw = Number(((area * bench.lpd) / 1000).toFixed(2));
                                  const pKw = Number(((area * bench.smallPower) / 1000).toFixed(2));
                                  const hKw = Number(((area * bench.hvacElectric) / 1000).toFixed(2));
                                  const oKw = bench.otherEquipment;
                                  updateRow(row.id, {
                                    lighting: lKw,
                                    power: pKw,
                                    hvac: hKw,
                                    other: oKw,
                                    isLightingCustomized: false,
                                    isPowerCustomized: false,
                                    isHvacCustomized: false,
                                    isOtherCustomized: false,
                                  });
                                  toast.success(`Reset loads for "${cleanSpaceName(row.description)}" to benchmark`);
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                              >
                                <RefreshCw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Benchmark Loads</span>
                              </ContextMenuItem>
                            )}

                            <ContextMenuItem
                              onClick={async () => {
                                const currentFl = row.floor || extractFloorName(row);
                                const targetFloor = prompt ? await prompt("Enter floor name for this space:", currentFl, { title: "Change Space Floor" }) : window.prompt("Enter floor name for this space:", currentFl);
                                if (targetFloor && targetFloor.trim()) {
                                  const formatted = targetFloor.trim().toUpperCase();
                                  pushToHistory(rows, history, setHistory, setRedoStack);
                                  updateRow(row.id, { floor: formatted });
                                  toast.success(`Moved "${cleanSpaceName(row.description)}" to ${formatted}`);
                                }
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Layers className="size-3.5 text-muted-foreground" />
                              <span>Change Floor ({row.floor || extractFloorName(row)})</span>
                            </ContextMenuItem>

                            <ContextMenuSeparator className="h-px bg-border my-1" />

                            {/* Duplicate Space */}
                            <ContextMenuItem
                              onClick={() => {
                                const newRow = { ...row, id: `ls_${Math.random().toString(36).slice(2, 9)}` };
                                pushToHistory(rows, history, setHistory);
                                setRows(prev => {
                                  const idx = prev.findIndex(r => r.id === row.id);
                                  const next = [...prev];
                                  next.splice(idx + 1, 0, newRow);
                                  return next;
                                });
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <CopyPlus className="size-3.5 text-muted-foreground" />
                              <span>Duplicate Space</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
                            </ContextMenuItem>

                            <ContextMenuSeparator className="h-px bg-border my-1" />

                            {/* Delete Space */}
                            <ContextMenuItem
                              onClick={() => {
                                pushToHistory(rows, history, setHistory);
                                setRows(prev => prev.filter(r => r.id !== row.id));
                                setSelected(prev => {
                                  const next = new Set(prev);
                                  next.delete(row.id);
                                  return next;
                                });
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete Space</span>
                              <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        )}
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
                        onClick={handlePullFromCalculators}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[12.5px] font-medium shadow-sm transition-all cursor-pointer"
                        title="Auto-pull spaces, Lighting kW, and HVAC kW from 3D Studio & other calculators"
                      >
                        <Sparkles className="size-3.5" /> Auto-Pull from 3D & Calculators
                      </button>
                      <button 
                        onClick={loadDummyData}
                        className="flex items-center gap-1.5 px-4 py-2 border border-border hover:bg-surface-2 rounded-full text-[12.5px] font-medium transition-all cursor-pointer"
                      >
                        <Layers className="size-3.5 text-muted-foreground" /> Load Sample Data
                      </button>
                    </div>
                  </div>
                )}

                {/* Clean Status Bar Footer matching ventilation screenshot */}
                {rows.length > 0 && (
                  <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print select-none">
                    <div className="flex items-center gap-3">
                      <div>
                        Showing <span className="text-foreground font-medium tabular">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} spaces
                        {isFiltered && (
                          <span className="ml-2 font-mono text-primary font-medium">({filteredPower.toFixed(2)} kW filtered)</span>
                        )}
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground/80 pl-2 border-l border-border/60">
                        <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                        Auto-suggested benchmark
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular">
                      <span>Σ Power: <span className="font-mono text-foreground font-semibold">{totalPower.toFixed(2)} kW</span></span>
                      <span>Σ (+10%): <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{totalPowerWithSafety.toFixed(2)} kW</span></span>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/80">
                        <span>Transformers:</span>
                        <input
                          type="text"
                          value={transformers}
                          onChange={(e) => setTransformers(e.target.value)}
                          placeholder="e.g. 2 x 1500 kVA"
                          className="h-5 w-28 px-1.5 bg-background/80 border border-border/80 rounded text-[11px] font-mono outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
             </div>
          </div>
            </>
          ) : (
            <LoadSummaryReportView
              rows={rows}
              filteredRows={filteredRows}
              sortedFloorOrder={sortedFloorOrder}
              totalPower={totalPower}
              totalPowerWithSafety={totalPowerWithSafety}
              transformers={transformers}
              unitSystem={unitSystem}
              project={project}
              calcReviewState={calcReviewState}
              currentUserName={currentUserName}
              onExportPdf={exportPDF}
            />
          )}
        </div>
      </div>
    </div>

    {/* Load Summary Intelligence Side Drawer */}
    <div
      className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
        intelOpen
          ? "w-[360px] mt-2 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg flex flex-col"
          : "w-0"
      }`}
    >
      {intelOpen && (
        <LoadSummaryIntelligenceDrawer
          rows={rows}
          unitSystem={unitSystem}
          onClose={() => setIntelOpen(false)}
          onScrollToSpace={(id) => {
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}
    </div>
  </div>

      {/* Add New Load Modal Popup */}
      {showAddLoadModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddLoadModal(false);
          }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-surface-1 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Plus className="size-4" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-foreground leading-tight">Add New Load</h2>
                  <p className="text-[11.5px] text-muted-foreground">
                    Add an electrical load item to the floor schedule
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddLoadModal(false)}
                className="p-1.5 hover:bg-surface-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAddLoadSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {/* Floor / Level */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Floor Level <span className="text-red-500">*</span>
                  </label>
                  <FloorSelect
                    value={newLoadFloor}
                    onChange={setNewLoadFloor}
                    availableFloors={sortedFloorOrder}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Description / Space Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newLoadDescription}
                    onChange={(e) => setNewLoadDescription(e.target.value)}
                    placeholder="e.g. Executive Office"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-[12.5px] font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Qty & Area */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={newLoadQty}
                    onChange={(e) => setNewLoadQty(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="1"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-[12.5px] font-mono text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Area ({unitSystem === "ip" ? "sq.ft" : "m²"})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newLoadArea}
                    onChange={(e) => setNewLoadArea(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="100"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-[12.5px] font-mono text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Electrical Connected Loads (kW) */}
              <div className="p-3.5 bg-surface-2/60 border border-border/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-foreground">Connected Loads (kW per Unit)</span>
                  <span className="text-[10.5px] font-semibold text-primary">
                    Total: {(((Number(newLoadLighting) || 0) + (Number(newLoadPower) || 0) + (Number(newLoadHvac) || 0) + (Number(newLoadOther) || 0)) * (Number(newLoadQty) || 1)).toFixed(2)} kW
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Lighting</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={newLoadLighting}
                      onChange={(e) => setNewLoadLighting(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="1.5"
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Power</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={newLoadPower}
                      onChange={(e) => setNewLoadPower(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="3.0"
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">HVAC</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={newLoadHvac}
                      onChange={(e) => setNewLoadHvac(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="15.0"
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Other</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={newLoadOther}
                      onChange={(e) => setNewLoadOther(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Remarks / Circuit Info</label>
                <input
                  type="text"
                  value={newLoadRemarks}
                  onChange={(e) => setNewLoadRemarks(e.target.value)}
                  placeholder="Optional load notes, panel destination, or diversity remarks"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-[12.5px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowAddLoadModal(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all shadow-sm cursor-pointer"
                >
                  Add Load
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Edit Load Space Modal (Exact Ventilation style with calculations preview) */}
      {editingLoadRow && (
        <EditLoadSummaryModal
          row={editingLoadRow.row}
          isNew={editingLoadRow.isNew}
          unitSystem={unitSystem}
          availableFloors={sortedFloorOrder}
          onClose={() => {
            if (editingLoadRow.isNew) {
              setRows(prev => prev.filter(r => r.id !== editingLoadRow.row.id));
            }
            setEditingLoadRow(null);
          }}
          onSave={(updated) => {
            const computed = computeRowOutputs(updated);
            pushToHistory(rows, history, setHistory, setRedoStack);
            setRows(prev => prev.map(r => r.id === updated.id ? computed : r));
            toast.success(`Updated electrical load "${updated.description}"`);
            setEditingLoadRow(null);
          }}
        />
      )}

      {/* Import Source Selection Modal */}
      <ImportSourceModal
        isOpen={sourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        title="Import Space Schedule & Loads"
        subtitle="Select data source to generate electrical load summary"
        excelTitle="Import from Excel (.xlsx)"
        excelSubtitle="Upload schedule or spreadsheet formatted with Floor, Space Name, Area & Loads."
        viewerTitle="Import from 3D Studio"
        viewerSubtitle="Extract spatial geometry, room names, levels, and floor areas directly from active 3D model."
        viewerBadge="3D Studio"
        ventilationTitle="Import from Ventilation"
        ventilationSubtitle={
          ventSpacesCount > 0
            ? `Import ${ventSpacesCount} space(s) directly from the active Ventilation schedule.`
            : "Import all room names, floor levels, and areas directly from the active Ventilation schedule."
        }
        ventilationBadge="Ventilation"
        preliminaryTitle="Import from Preliminary Cooling Load"
        preliminarySubtitle={
          pclSpacesCount > 0
            ? `Import ${pclSpacesCount} space(s) from Preliminary Cooling Load calculation.`
            : "Import room names, floor levels, areas, and space categories from Preliminary Cooling Load calculation."
        }
        preliminaryBadge="Cooling Load"
        benchmarkTitle="Load 10 Benchmark Spaces"
        benchmarkSubtitle="Populate calculation with standard reference architectural spaces for quick verification."
        benchmarkBadge="Benchmarks"
        onSelectExcel={() => {
          if (excelInputRef.current) {
            excelInputRef.current.value = "";
            excelInputRef.current.click();
          }
        }}
        onSelect3DViewer={handlePullFromCalculators}
        onSelectVentilation={handleImportVentilation}
        onSelectPreliminary={handleImportPreliminaryCooling}
        onSelectBenchmark={handleLoadBenchmarkSpaces}
        footerNote="Automatic ASHRAE diversity factors & load classifications applied"
      />
      <input
        type="file"
        ref={excelInputRef}
        onChange={handleExcelFileInputChange}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* Sync from 3D BIM / External Calculators Modal */}
      {syncModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => {
            if (!isExtractingIfc) setSyncModalOpen(false);
          }}
        >
          <div
            className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                  <Box className="size-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-foreground tracking-tight flex items-center gap-2">
                    Pull Spaces from 3D BIM / Calculators
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                      BIM SYNC
                    </span>
                  </h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Connect architectural spaces and calculate automated lighting, power, & HVAC loads
                  </p>
                </div>
              </div>
              <button
                disabled={isExtractingIfc}
                onClick={() => setSyncModalOpen(false)}
                className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Notice Banner */}
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[12px] text-indigo-950 dark:text-indigo-200 flex items-start gap-3">
                <Sparkles className="size-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">
                    Connect Spaces from Early-Stage Calcs or 3D Model
                  </p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                    At early concept/schematic stages without a 3D model, you can instantly pull room areas, cooling kW, and ventilation CFM from your existing calculations below:
                  </p>
                </div>
              </div>

              {/* Option 1: Import from Preliminary Cooling Load */}
              <div className="p-4 rounded-xl border border-border bg-surface-1 hover:border-sky-500/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500 shrink-0 mt-0.5">
                      <Snowflake className="size-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13px] font-semibold text-foreground">
                          Option 1: Import from Preliminary Cooling Load
                        </h4>
                        {pclSpacesCount > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            {pclSpacesCount} spaces ready
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            No spaces yet
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">
                        Instantly populates room names, floor areas, and exact cooling kW loads calculated in Preliminary Cooling Load (<code className="font-mono text-foreground font-semibold">/preliminary-cooling-load</code>). Automatically converts thermal cooling into electrical compressor/fan kW.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center justify-between">
                  {pclSpacesCount > 0 ? (
                    <button
                      type="button"
                      onClick={handleImportPreliminaryCooling}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer shadow-xs"
                    >
                      <Snowflake className="size-3.5" />
                      Import {pclSpacesCount} Spaces from Preliminary Cooling
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { window.location.href = "/preliminary-cooling-load"; }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-surface-2 hover:bg-surface-3 text-foreground border border-border transition-colors cursor-pointer"
                    >
                      <ExternalLink className="size-3.5" />
                      Open Preliminary Cooling Load
                    </button>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    HVAC kW &bull; Floor Areas &bull; Room Types
                  </span>
                </div>
              </div>

              {/* Option 2: Import from Ventilation Calculation */}
              <div className="p-4 rounded-xl border border-border bg-surface-1 hover:border-teal-500/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-500 shrink-0 mt-0.5">
                      <Wind className="size-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13px] font-semibold text-foreground">
                          Option 2: Import from Ventilation Schedule
                        </h4>
                        {ventSpacesCount > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                            {ventSpacesCount} spaces ready
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            No spaces yet
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">
                        Imports architectural rooms, floor areas, and fresh air ventilation flow rates (CFM) from the Ventilation Schedule (<code className="font-mono text-foreground font-semibold">/ventilation</code>). Automatically calculates outdoor air cooling and electrical sub-loads.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center justify-between">
                  {ventSpacesCount > 0 ? (
                    <button
                      type="button"
                      onClick={handleImportVentilation}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer shadow-xs"
                    >
                      <Wind className="size-3.5" />
                      Import {ventSpacesCount} Spaces from Ventilation
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { window.location.href = "/ventilation"; }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-surface-2 hover:bg-surface-3 text-foreground border border-border transition-colors cursor-pointer"
                    >
                      <ExternalLink className="size-3.5" />
                      Open Ventilation Calculation
                    </button>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    Fresh Air CFM &bull; Floor Areas &bull; Levels
                  </span>
                </div>
              </div>

              {/* Option 3: Direct IFC Upload */}
              <div className="p-4 rounded-xl border border-border bg-surface-1 hover:border-indigo-500/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5">
                      <UploadCloud className="size-4.5" />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-semibold text-foreground">
                        Option 3: Upload .IFC Model File Directly
                      </h4>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">
                        Instantly extracts all architectural spaces, floor areas, and levels with Web-IFC, automatically calculating ASHRAE & NEC load densities.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center gap-3">
                  <label className={`inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                    isExtractingIfc
                      ? "bg-muted text-muted-foreground cursor-wait"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow"
                  }`}>
                    {isExtractingIfc ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Extracting BIM spaces...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="size-3.5" />
                        Select .IFC File
                      </>
                    )}
                    <input
                      type="file"
                      accept=".ifc,.ifczip"
                      className="hidden"
                      disabled={isExtractingIfc}
                      onChange={handleIfcFileUpload}
                    />
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Supported: IFC2X3, IFC4
                  </span>
                </div>
              </div>

              {/* Option 4: Load Benchmark Template */}
              <div className="p-4 rounded-xl border border-border bg-surface-1 hover:border-emerald-500/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      <Building2 className="size-4.5" />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-semibold text-foreground">
                        Option 4: Load Standard Benchmark Project (10 Spaces)
                      </h4>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">
                        Populate 10 standard commercial spaces (Reception, Open Office, Boardroom, Server Room, AHU Plant Room, Electrical Room, etc.) with realistic ASHRAE 90.1 lighting LPD, NEC power, and HVAC loads.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-border/50">
                  <button
                    type="button"
                    onClick={handleLoadBenchmarkSpaces}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition-colors cursor-pointer"
                  >
                    <Sparkles className="size-3.5" />
                    Load 10 Standard Commercial Spaces
                  </button>
                </div>
              </div>

              {/* Option 5: Open 3D Studio */}
              <div className="p-4 rounded-xl border border-border bg-surface-1 hover:border-border-strong transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <Box className="size-4.5" />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-semibold text-foreground">
                        Option 5: Open 3D BIM Studio
                      </h4>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">
                        Load and inspect your full 3D building geometry in the interactive BIM viewer, then click <strong className="text-foreground">"Sync to Load Summary"</strong> in the Schedule Review modal.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/3d-view";
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-surface-2 hover:bg-surface-3 text-foreground border border-border transition-colors cursor-pointer"
                  >
                    <ExternalLink className="size-3.5" />
                    Open 3D Studio Viewer
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSyncModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-surface-2 hover:bg-surface-3 text-foreground border border-border transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Formula Breakdown Modal */}
      {showFormulaModal && (
        <LoadSummaryFormulaBreakdownModal
          onClose={() => setShowFormulaModal(false)}
          unitSystem={unitSystem}
          rows={rows}
          totalPower={totalPower}
          totalPowerWithSafety={totalPowerWithSafety}
          transformers={transformers}
        />
      )}
    </AppShell>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Preliminary Engineering Report Component (Matching Preliminary Cooling Load Standard)
// ─────────────────────────────────────────────────────────────────────────────
function LoadSummaryReportView({
  rows,
  filteredRows,
  sortedFloorOrder,
  totalPower,
  totalPowerWithSafety,
  transformers,
  unitSystem,
  project,
  calcReviewState,
  currentUserName,
  onExportPdf,
}: {
  rows: LoadRow[];
  filteredRows: LoadRow[];
  sortedFloorOrder: string[];
  totalPower: number;
  totalPowerWithSafety: number;
  transformers: string;
  unitSystem: "si" | "ip";
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  onExportPdf: () => void;
}) {
  const areaUnit = unitSystem === "ip" ? "sq.ft" : "m²";

  const sigDetails = getSignatureBlockDetails(project?.id || "default", "/load-summary", currentUserName, calcReviewState);

  const calcNo = (project as any)?.calcNo || "CEC-EED-PXXX-203";
  const today = formatDateStr(new Date().toISOString());
  const projectNo = project?.code || (project as any)?.projectNo || "P000";
  const projectName = project?.name || (project as any)?.projectName || "Electrical Load Summary";
  const clientName = project?.client || "-";
  const endUser = (project as any)?.endUser || (project as any)?.location || "-";

  // Group rows by floor
  const floorGroups: Record<string, LoadRow[]> = {};
  const activeRows = filteredRows.length > 0 ? filteredRows : rows;

  activeRows.forEach((r) => {
    const fl = extractFloorName(r);
    if (!floorGroups[fl]) floorGroups[fl] = [];
    floorGroups[fl].push(r);
  });

  const floorsToDisplay = sortedFloorOrder.filter((fl) => floorGroups[fl] && floorGroups[fl].length > 0);
  Object.keys(floorGroups).forEach((fl) => {
    if (!floorsToDisplay.includes(fl)) floorsToDisplay.push(fl);
  });

  let grandArea = 0;
  let grandLighting = 0;
  let grandPower = 0;
  let grandHvac = 0;
  let grandOther = 0;
  let grandTotalKw = 0;

  activeRows.forEach((r) => {
    const q = Number(r.qty) || 1;
    grandArea += (Number(r.area) || 0) * q;
    grandLighting += (Number(r.lighting) || 0) * q;
    grandPower += (Number(r.power) || 0) * q;
    grandHvac += (Number(r.hvac) || 0) * q;
    grandOther += (Number(r.other) || 0) * q;
    grandTotalKw += Number(r.totalLoad) || 0;
  });

  let globalSrNo = 1;

  return (
    <div className="flex flex-col h-full">
      {/* Printable Sheet View */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
        <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
          
          {/* 1. Title (Exact Preliminary format with Calculation keyword) */}
          <div className="pb-1">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Electrical Load Summary Calculation
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Connected Load Estimation, Diversity Sizing & Substation Transformer Schedule
            </p>
          </div>

          {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-border divide-x divide-border">
                  <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                  <td className="p-2.5 font-mono text-foreground font-medium">{calcNo}</td>
                  <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                  <td className="p-2.5 font-mono font-medium">{today}</td>
                </tr>
                <tr className="border-b border-border divide-x divide-border">
                  <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                  <td className="p-2.5 font-mono">{projectNo}</td>
                  <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                  <td className="p-2.5">{clientName}</td>
                </tr>
                <tr className="divide-x divide-border">
                  <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                  <td className="p-2.5">{projectName}</td>
                  <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                  <td className="p-2.5">{endUser}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. Electrical Load Schedule Table */}
          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                  <th rowSpan={2} className="p-2 border-r border-border w-12 text-center">
                    Sr.<br />No.
                  </th>
                  <th colSpan={3} className="p-2 border-r border-border text-center">
                    Space & Area Classification
                  </th>
                  <th colSpan={5} className="p-2 border-r border-border text-center">
                    Connected Electrical Load Components (kW)
                  </th>
                  <th rowSpan={2} className="p-2 text-left min-w-[120px]">
                    Remarks
                  </th>
                </tr>
                <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                  <th className="p-2 border-r border-border text-left min-w-[140px]">Floor / Space Description</th>
                  <th className="p-2 border-r border-border w-16 text-center">Qty</th>
                  <th className="p-2 border-r border-border w-24 text-center">Area ({areaUnit})</th>
                  <th className="p-2 border-r border-border w-20 text-center">Light (kW)</th>
                  <th className="p-2 border-r border-border w-20 text-center">Power (kW)</th>
                  <th className="p-2 border-r border-border w-20 text-center">HVAC (kW)</th>
                  <th className="p-2 border-r border-border w-20 text-center">Other (kW)</th>
                  <th className="p-2 border-r border-border w-24 text-center">Total (kW)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {floorsToDisplay.map((fl) => {
                  const floorRows = floorGroups[fl] || [];
                  const floorArea = floorRows.reduce((sum, r) => sum + (Number(r.area) || 0) * (Number(r.qty) || 1), 0);
                  const floorLight = floorRows.reduce((sum, r) => sum + (Number(r.lighting) || 0) * (Number(r.qty) || 1), 0);
                  const floorPower = floorRows.reduce((sum, r) => sum + (Number(r.power) || 0) * (Number(r.qty) || 1), 0);
                  const floorHvac = floorRows.reduce((sum, r) => sum + (Number(r.hvac) || 0) * (Number(r.qty) || 1), 0);
                  const floorOther = floorRows.reduce((sum, r) => sum + (Number(r.other) || 0) * (Number(r.qty) || 1), 0);
                  const floorTotalKw = floorRows.reduce((sum, r) => sum + (Number(r.totalLoad) || 0), 0);

                  return (
                    <React.Fragment key={fl}>
                      {/* Floor Header */}
                      <tr className="bg-slate-100/70 dark:bg-zinc-800/60 font-bold border-t border-b border-border">
                        <td colSpan={10} className="p-2 text-foreground">
                          Floor Level: {fl.toUpperCase()} ({floorRows.length} spaces) · {floorTotalKw.toFixed(2)} kW
                        </td>
                      </tr>

                      {floorRows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">
                            {globalSrNo++}
                          </td>
                          <td className="p-2 border-r border-border font-bold text-foreground">
                            {cleanSpaceName(r.description || "")}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {r.qty ?? 1}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {(Number(r.area) || 0).toLocaleString()}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {(Number(r.lighting) || 0).toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {(Number(r.power) || 0).toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {(Number(r.hvac) || 0).toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {(Number(r.other) || 0).toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono font-bold text-primary">
                            {(Number(r.totalLoad) || 0).toFixed(2)}
                          </td>
                          <td className="p-2 text-muted-foreground text-[11px]">
                            {r.remarks || "-"}
                          </td>
                        </tr>
                      ))}

                      {/* Floor Subtotal */}
                      <tr className="bg-slate-50 dark:bg-zinc-900/60 font-semibold border-b border-border text-xs">
                        <td className="p-2 border-r border-border text-center font-sans font-bold">Subtotal</td>
                        <td className="p-2 border-r border-border font-bold text-foreground">{fl.toUpperCase()} Subtotal</td>
                        <td className="p-2 border-r border-border text-center">-</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold">{floorArea.toFixed(1)}</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold">{floorLight.toFixed(2)}</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold">{floorPower.toFixed(2)}</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold">{floorHvac.toFixed(2)}</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold">{floorOther.toFixed(2)}</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold text-primary">{floorTotalKw.toFixed(2)}</td>
                        <td className="p-2 text-muted-foreground">-</td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Grand Total Row */}
                <tr className="bg-slate-100 dark:bg-zinc-800 font-bold border-t-2 border-border text-foreground">
                  <td className="p-2 border-r border-border text-center font-sans">TOTAL</td>
                  <td className="p-2 border-r border-border font-sans font-bold">ALL FLOORS ({activeRows.length} Spaces)</td>
                  <td className="p-2 border-r border-border text-center">-</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">{grandArea.toFixed(1)}</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">{grandLighting.toFixed(2)}</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">{grandPower.toFixed(2)}</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">{grandHvac.toFixed(2)}</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">{grandOther.toFixed(2)}</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold text-primary text-xs">{grandTotalKw.toFixed(2)} kW</td>
                  <td className="p-2 text-muted-foreground">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. Executive Power & Transformer Sizing Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Executive Electrical Sizing & Transformer Selection
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2 w-12 text-center border-r border-border">Sr.</th>
                    <th className="p-2 text-left border-r border-border min-w-[200px]">Electrical Parameter</th>
                    <th className="p-2 text-left border-r border-border w-40">Governing Standard</th>
                    <th className="p-2 text-center border-r border-border w-44">Calculated Value</th>
                    <th className="p-2 text-center border-r border-border w-20">Unit</th>
                    <th className="p-2 text-left min-w-[200px]">Engineering Compliance Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">1</td>
                    <td className="p-2 font-bold text-foreground border-r border-border">Total Connected Electrical Load</td>
                    <td className="p-2 text-muted-foreground border-r border-border">Sum(All Spaces)</td>
                    <td className="p-2 text-center font-mono font-bold border-r border-border">{totalPower.toFixed(2)}</td>
                    <td className="p-2 text-center font-mono border-r border-border">kW</td>
                    <td className="p-2 text-muted-foreground text-[11px]">Sum of Light, Power, HVAC, and Process equipment loads</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">2</td>
                    <td className="p-2 font-bold text-foreground border-r border-border">TOTAL LOAD WITH 10% SAFETY MARGIN</td>
                    <td className="p-2 text-muted-foreground border-r border-border">Design Margin (+10%)</td>
                    <td className="p-2 text-center font-mono text-primary text-xs font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                      {totalPowerWithSafety.toFixed(2)} kW
                    </td>
                    <td className="p-2 text-center font-mono border-r border-border">kW</td>
                    <td className="p-2 text-muted-foreground text-[11px]">Allowance for future expansion, cable losses & harmonics</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">3</td>
                    <td className="p-2 font-bold text-foreground border-r border-border">Selected Substation Transformers</td>
                    <td className="p-2 text-muted-foreground border-r border-border">Substation Sizing</td>
                    <td className="p-2 text-center font-mono text-emerald-700 dark:text-emerald-300 text-xs font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                      {transformers || "2 × 1500 kVA"}
                    </td>
                    <td className="p-2 text-center font-mono border-r border-border">qty × kVA</td>
                    <td className="p-2 text-muted-foreground text-[11px]">Recommended unit rating based on operating diversity</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. 3-Tier Signature Sign-Off Block (Exact #FFE6CC Header) */}
          <div className="pt-2">
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full border-collapse">
                <thead className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                  <tr className="divide-x border-border">
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
                      {sigDetails?.originatedDate || today}
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact Step-by-Step Formula Breakdown & Electrical Load Derivation Modal (Matching Fresh Air Cooling Load Standard)
// ─────────────────────────────────────────────────────────────────────────────
function LoadSummaryFormulaBreakdownModal({
  onClose,
  unitSystem,
  rows,
  totalPower,
  totalPowerWithSafety,
  transformers,
}: {
  onClose: () => void;
  unitSystem: "si" | "ip";
  rows: LoadRow[];
  totalPower: number;
  totalPowerWithSafety: number;
  transformers: string;
}) {
  const [activeTab, setActiveTab] = useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = useState(false);
  const ip = unitSystem === "ip";
  const areaUnit = ip ? "sq.ft" : "m²";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const sampleRow = rows[0] || {
    name: "Commercial Office Suite",
    area: ip ? 1200 : 120,
    qty: 1,
    watts: 3500,
    diversity: 0.85,
    power: 2.975,
    floor: "Ground Floor",
  };

  const qty = sampleRow.qty || 1;
  const watts = sampleRow.watts || 3500;
  const connKw = (qty * watts) / 1000;
  const divFactor = sampleRow.diversity !== undefined ? sampleRow.diversity : 0.85;
  const demKw = connKw * divFactor;
  const safetyFactorPct = 20;
  const totalWithSF = totalPowerWithSafety || totalPower * 1.20;
  const kvaApprox = totalWithSF / 0.90;

  const handleCopySummary = () => {
    const text = `=== ELECTRICAL LOAD SUMMARY FORMULA BREAKDOWN ===
Governing Design Standards: NEC (National Electrical Code - Article 220), IEC 60364 & IEEE 141
Unit System: ${ip ? "IP Imperial (sq.ft, kW, kVA)" : "SI Metric (m², kW, kVA)"}
Active Schedule: ${rows.length} Configured Load Spaces across Building Floors

--- 1. ACTIVE SIZING PARAMETERS ---
• Sample Load Item: ${sampleRow.name} (${sampleRow.floor || "Level"})
• Equipment Power: ${qty} Unit(s) @ ${watts} W = ${connKw.toFixed(2)} kW Connected
• Load Diversity Factor: ${(divFactor * 100).toFixed(0)}% (Demand: ${demKw.toFixed(2)} kW)
• Portfolio Total Peak Diversified Power: ${totalPower.toFixed(2)} kW
• Design Safety Margin: +${safetyFactorPct}% (${totalWithSF.toFixed(2)} kW with reserve)
• Apparent Electrical Power (cos φ = 0.90): ${kvaApprox.toFixed(1)} kVA
• Assigned Substation Transformers: ${transformers || "Standard N+1 Transformer Package"}

--- 2. STEP-BY-STEP CALCULATION STEPS ---
[1] Space Total Connected Load (P_conn):
    P_conn = (Quantity × Input_Watts) / 1000 = (${qty} × ${watts} W) / 1000 = ${connKw.toFixed(2)} kW

[2] Coincident Diversified Demand Load (P_demand):
    P_demand = P_conn × Diversity_Factor = ${connKw.toFixed(2)} kW × ${divFactor.toFixed(2)} = ${demKw.toFixed(2)} kW

[3] Portfolio Total Coincident Peak Demand:
    P_total = ∑ (P_conn_i × DF_i) = ${totalPower.toFixed(2)} kW across ${rows.length} spaces

[4] Design Load with Growth / Safety Allowance (P_design):
    P_design = P_total × (1 + SF) = ${totalPower.toFixed(2)} kW × 1.20 = ${totalWithSF.toFixed(2)} kW

[5] Total Apparent Power Demand (S_kVA):
    S = P_design / cos φ = ${totalWithSF.toFixed(2)} kW / 0.90 = ${kvaApprox.toFixed(1)} kVA

[6] Utility Substation Transformer Duty:
    Selection Target: Maximum 80% continuous operating loading guideline
    Recommended Transformer Sizing: ${transformers || `2 × ${Math.ceil((kvaApprox / 2) / 100) * 100} kVA`}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Electrical load calculation breakdown copied to clipboard!");
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
        {/* Header matching Fresh Air Cooling Load Standard */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Calculator className="size-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-[13px] font-bold text-foreground truncate">
                Electrical Load Summary Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              NEC / IEC 60364
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
          {/* TAB 1: CALCULATION STEPS */}
          {activeTab === "trace" && (
            <div className="space-y-2.5">
              {/* Active Conditions Banner */}
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider pb-1.5 mb-1.5 border-b border-border/60">
                  <span className="flex items-center gap-1 text-foreground">
                    <Sliders className="size-3 text-primary" /> Active Space ({sampleRow.name})
                  </span>
                  <span className="font-mono text-primary normal-case font-bold">
                    Floor: {sampleRow.floor || "Standard Level"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Connected Rating</span>
                    <span className="font-mono font-bold text-foreground">{qty} × {watts} W = {connKw.toFixed(2)} kW</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Diversity Applied</span>
                    <span className="font-mono font-bold text-foreground">{(divFactor * 100).toFixed(0)}% (DF = {divFactor})</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: CONNECTED LOAD CALCULATION */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">1</span>
                    <span className="font-bold text-[11.5px] text-foreground">Connected Load Calculation</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {connKw.toFixed(2)} kW
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: P_conn = (Quantity × Watts) / 1000</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">({qty} × {watts} W) ÷ 1000</span>
                    <span className="text-primary font-bold">= {connKw.toFixed(2)} kW</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: DIVERSIFIED DEMAND LOAD */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">2</span>
                    <span className="font-bold text-[11.5px] text-foreground">Diversified Space Demand (P_demand)</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {demKw.toFixed(2)} kW
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: P_demand = P_conn × Diversity_Factor</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{connKw.toFixed(2)} kW × {divFactor.toFixed(2)}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {demKw.toFixed(2)} kW</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: WHOLE-BUILDING TOTAL PEAK POWER */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">3</span>
                    <span className="font-bold text-[11.5px] text-foreground">Coincident Peak Demand (P_total)</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {totalPower.toFixed(2)} kW
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: P_total = ∑ (P_conn_i × DF_i)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Aggregated across {rows.length} spaces</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">= {totalPower.toFixed(2)} kW</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: DESIGN LOAD WITH SAFETY MARGIN */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">4</span>
                    <span className="font-bold text-[11.5px] text-foreground">Design Power with Reserve (+20%)</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {totalWithSF.toFixed(2)} kW
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Apparent Demand: S = P_design / 0.90 PF</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{totalWithSF.toFixed(2)} kW ÷ 0.90 PF</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">= {kvaApprox.toFixed(1)} kVA</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-3">
              <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                <div className="font-bold text-foreground text-[12px] flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" /> 1. Electrical Demand &amp; Diversity Calculation
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg font-mono text-[11px] space-y-1 border border-border/60">
                  <div className="text-primary font-bold">P_connected = ∑ (Quantity × Watts) / 1000 (kW)</div>
                  <div className="text-foreground">P_demand = P_connected × Diversity_Factor (DF)</div>
                  <div className="text-foreground">P_total = ∑ P_demand_i (kW)</div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Diversity factor accounts for the probability that not all electrical apparatus, lighting circuits, and mechanical loads operate concurrently at 100% capacity.
                </p>
              </div>

              <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                <div className="font-bold text-foreground text-[12px] flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" /> 2. Apparent Power &amp; Substation Sizing
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg font-mono text-[11px] space-y-1 border border-border/60">
                  <div className="text-blue-600 dark:text-blue-400 font-bold">S_kVA = P_design / cos φ</div>
                  <div className="text-foreground">Recommended S_transformer ≥ S_kVA / 0.80</div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Transformers are sized assuming an 80% maximum steady-state continuous loading threshold to optimize electrical efficiency and prevent insulation overheating.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: VARIABLES REFERENCE */}
          {activeTab === "variables" && (
            <div className="space-y-2">
              <div className="border border-border rounded-xl overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <tr className="divide-x divide-border">
                      <th className="p-2 text-left w-24">Symbol</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left w-24">Code Basis</th>
                      <th className="p-2 text-left w-20">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">P_conn</td>
                      <td className="p-2 text-muted-foreground">Total installed continuous connected electrical power</td>
                      <td className="p-2 font-mono text-[11px]">Equipment Schedule</td>
                      <td className="p-2 font-mono text-[11px]">kW</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">DF</td>
                      <td className="p-2 text-muted-foreground">Coincident operating load diversity factor</td>
                      <td className="p-2 font-mono text-[11px]">NEC Article 220</td>
                      <td className="p-2 font-mono text-[11px]">-</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">P_demand</td>
                      <td className="p-2 text-muted-foreground">Maximum concurrent peak active power demand</td>
                      <td className="p-2 font-mono text-[11px]">Calculated</td>
                      <td className="p-2 font-mono text-[11px]">kW</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">cos φ</td>
                      <td className="p-2 text-muted-foreground">Displacement operating power factor of composite load</td>
                      <td className="p-2 font-mono text-[11px]">Nominal 0.85-0.90</td>
                      <td className="p-2 font-mono text-[11px]">-</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">S_kVA</td>
                      <td className="p-2 text-muted-foreground">Total apparent power for sizing transformers and generators</td>
                      <td className="p-2 font-mono text-[11px]">IEEE 141</td>
                      <td className="p-2 font-mono text-[11px]">kVA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer matching Fresh Air Cooling Load Standard */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-2 hover:bg-surface-3 text-foreground border border-border transition-colors cursor-pointer"
          >
            <Copy className="size-3.5" />
            {copied ? "Copied!" : "Copy Breakdown"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
