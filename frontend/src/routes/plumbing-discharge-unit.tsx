import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import {
  Trash2,
  Plus,
  FileSpreadsheet,
  Info,
  ChevronDown,
  ChevronRight,
  Save,
  X,
  Download,
  Flag,
  Search,
  Filter,
  SlidersHorizontal,
  FileText,
  Copy,
  Scissors,
  Clipboard,
  Edit3,
  Building2,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Check,
  Layers,
  ArrowUpDown,
  Printer,
  AlertTriangle
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { useAuth } from "@/contexts/AuthContext";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportDischargeUnitPDF } from "@/lib/exportDischargeUnitPDF";
import {
  type FUSpace,
  checkIfDUSpaceMissingData,
  getFUSpaceValidation,
  IP_DISCHARGE_UNITS,
  DU_FIXTURES_META,
  extractFloorFU,
  computePlumbingDischargeCalculations
} from "@/lib/calc-plumbing-discharge-unit";

function FloorNameInput({
  floor,
  disabled,
  onRename,
}: {
  floor: string;
  disabled: boolean;
  onRename: (oldName: string, newName: string) => void;
}) {
  const getCleanFloor = (f: string) => {
    if (!f || f.toLowerCase() === "undefined" || f.toLowerCase() === "null") return "1F";
    return f.trim().toUpperCase();
  };

  const [val, setVal] = useState(getCleanFloor(floor));

  useEffect(() => {
    setVal(getCleanFloor(floor));
  }, [floor]);

  const commitRename = () => {
    const trimmed = val.trim().toUpperCase();
    if (trimmed && trimmed !== floor) {
      onRename(floor, trimmed);
    } else {
      setVal(getCleanFloor(floor));
    }
  };

  return (
    <input
      type="text"
      value={val}
      disabled={disabled}
      onChange={e => setVal(e.target.value)}
      onBlur={commitRename}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setVal(getCleanFloor(floor));
          e.currentTarget.blur();
        }
      }}
      className="bg-transparent border border-transparent hover:border-border/80 focus:border-primary focus:bg-background px-2 py-0.5 rounded-md font-bold text-primary text-xs uppercase outline-none transition-all cursor-pointer focus:cursor-text min-w-[60px] max-w-[220px]"
      title="Click to edit floor name (Press Enter or click outside to save)"
    />
  );
}

export const Route = createFileRoute("/plumbing-discharge-unit")({
  head: () => ({
    meta: [
      { title: "Discharge Unit Calculator — MEP Calc" },
      { name: "description", content: "Water Supply Discharge Units (D.U.) sizing tool using Hunter's Curve Method." },
    ],
  }),
  component: DischargeUnitPage,
});

function DischargeUnitPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-discharge-unit", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-discharge-unit", activeProjectId || project?.id);
  const isApprovedLocked = useCalculationLock("/plumbing-discharge-unit", activeProjectId || project?.id);
  const isLocked = isEffectiveReadOnly || isApprovedLocked;
  
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [headerStd, setHeaderStd] = useState<string>("total-du");
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number>>({});
  const [floorSections, setFloorSections] = useState<string[]>(["1F", "2F"]);
  const [fuSpaces, setFuSpaces] = useState<FUSpace[]>([]);
  const [previewSpace, setPreviewSpace] = useState<FUSpace | null>(null);
  const [activeTab, setActiveTab] = useState<"spaces" | "report">("spaces");
  const [intelOpen, setIntelOpen] = useState(false);
  
  // Search, Filter & View Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"none" | "desc" | "du">("none");

  // Selection states
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lastClickedId, setLastClickedId] = useState<number | null>(null);
  const [bulkFloor, setBulkFloor] = useState("");
  const [editingSpace, setEditingSpace] = useState<FUSpace | null>(null);
  const [collapsedFloors, setCollapsedFloors] = useState<Set<string>>(new Set());

  // Move to Floor Modal State
  const [moveFloorModalOpen, setMoveFloorModalOpen] = useState(false);
  const [moveFloorTargetIds, setMoveFloorTargetIds] = useState<number[]>([]);

  // Auto-clear selection when locked
  useEffect(() => {
    if (isLocked) {
      setSelectedIds([]);
    }
  }, [isLocked]);

  // Comment Modal State
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<any>(null);

  const [undoStack, setUndoStack] = useState<any[][]>([]);
  const [redoStack, setRedoStack] = useState<any[][]>([]);
  const [clipboard, setClipboard] = useState<any[]>([]);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (newComment: any) => {
    if (!commentTargetItem) return;
    const nextSpaces = fuSpaces.map((s: any) => {
      if (String(s.id) === String(commentTargetItem.id)) {
        return { ...s, comments: [...(s.comments || []), newComment] };
      }
      return s;
    });
    setFuSpaces(nextSpaces);
  };

  const pushToUndo = (currentSpaces: any[]) => {
    setUndoStack((prev) => [...prev, currentSpaces]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is locked in read-only mode.", { id: "readonly-notice" });
      return;
    }
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, fuSpaces]);
    setFuSpaces(previous);
    setUndoStack((prev) => prev.slice(0, -1));
    toast.success("Undo successful");
  };

  const handleRedo = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is locked in read-only mode.", { id: "readonly-notice" });
      return;
    }
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, fuSpaces]);
    setFuSpaces(next);
    setRedoStack((prev) => prev.slice(0, -1));
    toast.success("Redo successful");
  };

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_discharge_unit_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.unitSystem) setUnitSystem(data.unitSystem);
          if (data.headerStd) setHeaderStd(data.headerStd);
          if (data.weightOverrides) setWeightOverrides(data.weightOverrides);
          if (data.fuSpaces && Array.isArray(data.fuSpaces)) {
            const processed = data.fuSpaces.map((s: any) => {
              const isMissing = checkIfDUSpaceMissingData(s);
              const flag = s.flagged !== undefined ? s.flagged : (s.isFlagged !== undefined ? s.isFlagged : isMissing);
              return { ...s, flagged: flag };
            });
            setFuSpaces(processed);
          }
          if (data.floorSections && Array.isArray(data.floorSections) && data.floorSections.length > 0) {
            setFloorSections(data.floorSections.map((f: any) => String(f).trim().toUpperCase()));
          } else if (data.fuSpaces && Array.isArray(data.fuSpaces) && data.fuSpaces.length > 0) {
            const extracted = Array.from(new Set(data.fuSpaces.map((s: any) => (s.floor || "1F").trim().toUpperCase())));
            setFloorSections(extracted.length > 0 ? extracted : ["1F", "2F"]);
          } else {
            setFloorSections(["1F", "2F"]);
          }
        } else {
          // Defaults
          setUnitSystem("si");
          setHeaderStd("total-du");
          setWeightOverrides({});
          setFloorSections(["1F", "2F"]);
          setFuSpaces([
            {
              id: 1,
              desc: "1F Male Washroom",
              floor: "1F",
              std: "total-du",
              fixtures: { wc: 4, urinal: 3, basin: 4 }
            },
            {
              id: 2,
              desc: "1F Female Washroom",
              floor: "1F",
              std: "total-du",
              fixtures: { wc: 5, basin: 4 }
            }
          ]);
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load fixture unit calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  // Auto save
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        headerStd,
        weightOverrides,
        floorSections,
        fuSpaces
      };
      localStorage.setItem(`mep_discharge_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, headerStd, weightOverrides, floorSections, fuSpaces]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          unitSystem,
          headerStd,
          weightOverrides,
          floorSections,
          fuSpaces
        };
        localStorage.setItem(`mep_discharge_unit_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Discharge Unit Calculation saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  useEffect(() => {
    const handleGlobalSave = (e: any) => {
      e.detail.handled = true;
      handleSaveCurrent();
    };
    window.addEventListener("mep-trigger-save", handleGlobalSave);
    return () => window.removeEventListener("mep-trigger-save", handleGlobalSave);
  }, [project?.id, unitSystem, headerStd, weightOverrides, floorSections, fuSpaces, forceSaveToCloud]);

  const ip = unitSystem === "ip";

  const handleUnitSystemChange = (targetUnit: "si" | "ip") => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved & Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);
    dirtyStore.set(true);
  };

  const getEffectiveUnitFU = (fixtureId: string, spaceStd: string) => {
    if (spaceStd === headerStd && weightOverrides[fixtureId] !== undefined) {
      return weightOverrides[fixtureId];
    }
    return IP_DISCHARGE_UNITS[fixtureId]?.[spaceStd] ?? 0;
  };

  // Calculations
  const calculations = useMemo(() => {
    return computePlumbingDischargeCalculations(fuSpaces, headerStd, weightOverrides, ip);
  }, [fuSpaces, headerStd, weightOverrides, ip]);

  // Clean floor name helper (prevents 'undefined' or empty floor groups)
  const cleanFloorName = (fl?: string) => {
    if (!fl) return "1F";
    const trimmed = String(fl).trim();
    if (trimmed === "" || trimmed.toLowerCase() === "undefined" || trimmed.toLowerCase() === "undefine" || trimmed.toLowerCase() === "null") {
      return "1F";
    }
    return trimmed.toUpperCase();
  };

  // Unique list of all floors
  const uniqueFloors = useMemo(() => {
    const list = [...floorSections.map(f => cleanFloorName(f))];
    fuSpaces.forEach(s => {
      const fl = cleanFloorName(s.floor);
      if (!list.includes(fl)) {
        list.push(fl);
      }
    });
    if (list.length === 0) list.push("1F");
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  }, [floorSections, fuSpaces]);

  // Filtered & Sorted Spaces
  const filteredSpaces = useMemo(() => {
    let list = [...fuSpaces];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => (s.desc || "").toLowerCase().includes(q) || cleanFloorName(s.floor).toLowerCase().includes(q));
    }
    if (showFlaggedOnly) {
      list = list.filter(s => getFUSpaceValidation(s).isFlagged);
    }
    if (filterFloor !== "all") {
      list = list.filter(s => cleanFloorName(s.floor) === filterFloor);
    }
    if (sortBy === "desc") {
      list.sort((a, b) => (a.desc || "").localeCompare(b.desc || ""));
    } else if (sortBy === "du") {
      list.sort((a, b) => (calculations.spaceTotals[b.id] || 0) - (calculations.spaceTotals[a.id] || 0));
    } else {
      // Default natural sort by floor then description
      list.sort((a, b) => {
        const floorA = cleanFloorName(a.floor);
        const floorB = cleanFloorName(b.floor);
        const floorComp = floorA.localeCompare(floorB, undefined, { numeric: true, sensitivity: "base" });
        if (floorComp !== 0) return floorComp;
        return (a.desc || "").localeCompare(b.desc || "", undefined, { numeric: true, sensitivity: "base" });
      });
    }
    return list;
  }, [fuSpaces, searchQuery, showFlaggedOnly, filterFloor, sortBy, calculations.spaceTotals]);

  const flaggedCount = useMemo(() => {
    return fuSpaces.filter(s => getFUSpaceValidation(s).isFlagged).length;
  }, [fuSpaces]);

  const activeFiltersCount = (filterFloor !== "all" ? 1 : 0) + (showFlaggedOnly ? 1 : 0);

  // Group by floor for listing
  const floorsGrouped = useMemo(() => {
    const grouped: Record<string, FUSpace[]> = {};
    const floorsToInclude = filterFloor !== "all" ? [filterFloor] : (uniqueFloors.length > 0 ? uniqueFloors : ["1F"]);
    
    floorsToInclude.forEach(fl => {
      grouped[fl] = [];
    });

    filteredSpaces.forEach(s => {
      const fl = cleanFloorName(s.floor);
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(s);
    });
    return grouped;
  }, [filteredSpaces, uniqueFloors, filterFloor]);

  const allSelected = filteredSpaces.length > 0 && filteredSpaces.every(s => selectedIds.includes(s.id));

  // Blur active input helper for keyboard shortcuts
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

  // Selection Handlers (Matching Ventilation / Loading Unit)
  const handleRowClick = (id: number, e: React.MouseEvent) => {
    if (isLocked) return;
    blurActiveInput();
    if (e.shiftKey && lastClickedId !== null) {
      const allIds = filteredSpaces.map(s => s.id);
      const lastIdx = allIds.indexOf(lastClickedId);
      const currIdx = allIds.indexOf(id);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        const rangeIds = allIds.slice(start, end + 1);
        const set = new Set([...selectedIds, ...rangeIds]);
        setSelectedIds(Array.from(set));
      }
    } else if (e.ctrlKey || e.metaKey) {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(x => x !== id));
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    } else {
      setSelectedIds([id]);
    }
    setLastClickedId(id);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (isLocked) {
      toast.info("Calculation is Approved & Locked. Selection is locked.", { id: "readonly-notice" });
      return;
    }
    if (checked) {
      setSelectedIds(filteredSpaces.map(s => s.id));
      toast.info(`Selected all ${filteredSpaces.length} space(s)`);
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number, checked: boolean) => {
    if (isLocked) return;
    if (checked) {
      setSelectedIds(prev => Array.from(new Set([...prev, id])));
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
    setLastClickedId(id);
  };

  // Bulk Operations
  const handleBulkDuplicate = () => {
    if (isLocked) return;
    if (selectedIds.length === 0) return;
    pushToUndo(fuSpaces);
    const clones: FUSpace[] = [];
    fuSpaces.forEach(s => {
      if (selectedIds.includes(s.id)) {
        clones.push({
          ...s,
          id: Date.now() + Math.random(),
          desc: `${s.desc} (Copy)`
        });
      }
    });
    setFuSpaces([...fuSpaces, ...clones]);
    setSelectedIds(clones.map(c => c.id));
    toast.success(`Duplicated ${clones.length} space(s)`);
  };

  const handleBulkDelete = () => {
    if (isLocked) {
      toast.info("Calculation is Approved & Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    if (selectedIds.length === 0) return;
    pushToUndo(fuSpaces);
    const count = selectedIds.length;
    setFuSpaces(prev => prev.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
    toast.info(`Deleted ${count} space(s)`);
  };

  const handleOpenMoveFloorModal = (customIds?: number[]) => {
    if (isLocked) {
      toast.info("Calculation is Approved & Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const idsToMove = customIds && customIds.length > 0 ? customIds : selectedIds;
    if (idsToMove.length === 0) {
      toast.info("Please select at least one space to move.");
      return;
    }
    setMoveFloorTargetIds(idsToMove);
    setMoveFloorModalOpen(true);
  };

  const handleConfirmMoveFloor = (targetFloor: string, targetIds: number[]) => {
    if (isLocked || targetIds.length === 0) return;
    const cleanFloor = targetFloor.trim().toUpperCase() || "1F";
    pushToUndo(fuSpaces);

    // If floor is new, ensure it gets added to floorSections if not present
    if (!floorSections.map(f => f.toUpperCase()).includes(cleanFloor)) {
      setFloorSections(prev => [...prev, cleanFloor]);
    }

    setFuSpaces(prev =>
      prev.map(s => (targetIds.includes(s.id) ? { ...s, floor: cleanFloor, isManualFloor: true } : s))
    );
    toast.success(`Moved ${targetIds.length} space(s) to ${cleanFloor}`);
  };

  // Keyboard Shortcuts Hook (Matching Ventilation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Deselect all or close modals
      if (e.key === "Escape") {
        if (editingSpace || commentModalOpen || moveFloorModalOpen) {
          setEditingSpace(null);
          setCommentModalOpen(false);
          setMoveFloorModalOpen(false);
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
            setSelectedIds([]);
            setLastClickedId(null);
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

      // Lock Protection: Block select-all and modification shortcuts when calculation is locked/approved
      if (isLocked) {
        if (isCmdOrCtrl && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
          e.preventDefault();
          toast.info("Calculation is Approved & Locked. Selection is locked.", { id: "readonly-notice" });
          return;
        }
        if (["Delete", "Backspace"].includes(e.key) || (isCmdOrCtrl && ["x", "v", "d", "z", "y"].includes(e.key.toLowerCase()))) {
          e.preventDefault();
          toast.info("Calculation is Approved & Locked. Modifications are locked.", { id: "readonly-notice" });
          return;
        }
      }

      // 1. Ctrl+A (Select All)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (filteredSpaces.length > 0) {
          setSelectedIds(filteredSpaces.map(s => s.id));
          toast.info(`Selected all ${filteredSpaces.length} space(s)`);
        }
        return;
      }

      // 2. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
        return;
      }

      // 3. Ctrl+C (Copy)
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          const toCopy = fuSpaces.filter(s => selectedIds.includes(s.id));
          setClipboard(toCopy);
          try {
            localStorage.setItem("mep_du_clipboard", JSON.stringify(toCopy));
          } catch (err) {}
          toast.info(`${toCopy.length} space(s) copied to clipboard`);
        }
        return;
      }

      // 4. Ctrl+X (Cut)
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (isApprovedLocked) {
          toast.info("Calculation is locked in read-only mode.", { id: "readonly-notice" });
          return;
        }
        if (selectedIds.length > 0) {
          e.preventDefault();
          const toCopy = fuSpaces.filter(s => selectedIds.includes(s.id));
          setClipboard(toCopy);
          pushToUndo(fuSpaces);
          const count = selectedIds.length;
          setFuSpaces(prev => prev.filter(s => !selectedIds.includes(s.id)));
          setSelectedIds([]);
          toast.info(`${count} space(s) cut to clipboard`);
        }
        return;
      }

      // 5. Ctrl+V (Paste)
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (isApprovedLocked) {
          toast.info("Calculation is locked in read-only mode.", { id: "readonly-notice" });
          return;
        }
        let itemsToPaste = clipboard;
        if (!itemsToPaste || itemsToPaste.length === 0) {
          try {
            const raw = localStorage.getItem("mep_du_clipboard");
            if (raw) itemsToPaste = JSON.parse(raw);
          } catch (err) {}
        }
        if (itemsToPaste && itemsToPaste.length > 0) {
          e.preventDefault();
          const targetFloor = uniqueFloors[0] || "1F";
          const pasted = itemsToPaste.map((s, idx) => ({
            ...s,
            id: Date.now() + idx + Math.floor(Math.random() * 1000),
            desc: s.desc ? `${s.desc} (Copy)` : "Pasted Space",
            floor: targetFloor,
          }));
          pushToUndo(fuSpaces);
          setFuSpaces(prev => [...prev, ...pasted]);
          setSelectedIds(pasted.map(p => p.id));
          toast.success(`${pasted.length} space(s) pasted`);
        }
        return;
      }

      // 6. Ctrl+D (Duplicate)
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleBulkDuplicate();
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

      // 8. Ctrl+S (Save)
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, fuSpaces, filteredSpaces, clipboard, undoStack, redoStack, isApprovedLocked, editingSpace, previewSpace, commentModalOpen, uniqueFloors]);

  // Handlers
  const handleAddSpace = (targetFloor?: string) => {
    if (isApprovedLocked) return;
    const defaultFloor = targetFloor || (filterFloor !== "all" ? filterFloor : (floorSections[floorSections.length - 1] || floorSections[0] || "1F"));
    const cleanFl = cleanFloorName(defaultFloor);
    const nextId = Date.now() + Math.floor(Math.random() * 1000);
    const newSpace: FUSpace = {
      id: nextId,
      desc: `New Space ${fuSpaces.length + 1}`,
      floor: cleanFl,
      std: "total-du",
      fixtures: {},
      flagged: true
    };
    pushToUndo(fuSpaces);
    setFuSpaces(prev => [...prev, newSpace]);
    toast.success(`Added new space to ${cleanFl}`);
  };

  const handleOpenSpaceModal = (spaceItem: FUSpace) => {
    if (isApprovedLocked) {
      toast.info("Calculation is locked in read-only mode.", { id: "readonly-notice" });
      return;
    }
    setEditingSpace(spaceItem);
  };

  const handleAddSpaceToFloor = (floorTarget: string) => {
    handleAddSpace(floorTarget);
  };

  const handleAddNewFloorSection = () => {
    if (isApprovedLocked) return;
    pushToUndo(fuSpaces);
    let maxNum = 0;
    floorSections.forEach(f => {
      const match = f.match(/^(\d+)F?$/i);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    });
    let newSection = maxNum > 0 ? `${maxNum + 1}F` : `FLOOR SECTION ${floorSections.length + 1}`;
    let count = floorSections.length + 1;
    while (floorSections.includes(newSection)) {
      count++;
      newSection = `${count}F`;
    }

    setFloorSections(prev => [...prev, newSection]);
    if (filterFloor !== "all") {
      setFilterFloor(newSection);
    }
    handleAddSpace(newSection);
    toast.success(`Created new floor section ${newSection}`);
  };

  const handleRenameFloorGroup = (oldName: string, newName: string) => {
    if (isApprovedLocked) return;
    const cleanOld = cleanFloorName(oldName);
    const cleanNew = cleanFloorName(newName);
    if (!cleanNew || cleanOld === cleanNew) return;

    pushToUndo(fuSpaces);
    setFloorSections(prev => prev.map(f => (cleanFloorName(f) === cleanOld ? cleanNew : f)));
    setFuSpaces(prev => prev.map(s => (cleanFloorName(s.floor) === cleanOld ? { ...s, floor: cleanNew, isManualFloor: true } : s)));
    if (filterFloor === cleanOld) {
      setFilterFloor(cleanNew);
    }
    toast.success(`Renamed floor section from ${cleanOld} to ${cleanNew}`);
  };

  const handleDeleteFloorGroup = (floorName: string) => {
    if (isApprovedLocked) return;
    if (floorSections.length <= 1) {
      toast.error("At least one floor section is required.");
      return;
    }
    const cleanFl = cleanFloorName(floorName);
    const spacesInFloor = fuSpaces.filter(s => cleanFloorName(s.floor) === cleanFl);
    const count = spacesInFloor.length;
    const msg = count > 0
      ? `Are you sure you want to delete floor section "${cleanFl}" and its ${count} space(s)?`
      : `Are you sure you want to delete floor section "${cleanFl}"?`;

    if (!window.confirm(msg)) return;

    pushToUndo(fuSpaces);
    setFloorSections(prev => prev.filter(f => cleanFloorName(f) !== cleanFl));
    setFuSpaces(prev => prev.filter(s => cleanFloorName(s.floor) !== cleanFl));
    if (filterFloor === cleanFl) {
      setFilterFloor("all");
    }
    toast.info(`Deleted floor section "${cleanFl}"`);
  };

  const handleFixtureChange = (spaceId: number, fixtureId: string, val: number) => {
    const targetIds = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setFuSpaces(prev => prev.map(s => {
      if (targetIds.includes(s.id)) {
        const wasMissing = checkIfDUSpaceMissingData(s);
        const updatedFixtures = {
          ...s.fixtures,
          [fixtureId]: Math.max(0, val)
        };
        const updated: FUSpace = {
          ...s,
          fixtures: updatedFixtures
        };
        const isMissing = checkIfDUSpaceMissingData(updated);
        let flagged = s.flagged;
        if (isMissing) {
          flagged = true;
        } else if (wasMissing && !isMissing) {
          flagged = false;
        }
        return { ...updated, flagged };
      }
      return s;
    }));
  };

  const handleSpaceChange = (spaceId: number, field: "desc" | "std", val: any) => {
    const targetIds = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setFuSpaces(prev => prev.map(s => {
      if (targetIds.includes(s.id)) {
        const wasMissing = checkIfDUSpaceMissingData(s);
        const updated: FUSpace = { ...s, [field]: val };
        if (field === "desc" && !s.isManualFloor) {
          updated.floor = extractFloorFU(val);
        }
        const isMissing = checkIfDUSpaceMissingData(updated);
        let flagged = s.flagged;
        if (isMissing) {
          flagged = true;
        } else if (wasMissing && !isMissing) {
          flagged = false;
        }
        return { ...updated, flagged };
      }
      return s;
    }));
  };

  const handleFloorRename = (oldFloor: string, newFloor: string) => {
    handleRenameFloorGroup(oldFloor, newFloor);
  };

  const handleToggleFlag = (spaceId: number) => {
    if (isApprovedLocked) return;
    const targetIds = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    const targetSpace = fuSpaces.find(s => s.id === spaceId);
    const validation = getFUSpaceValidation(targetSpace);
    const nextState = !validation.isFlagged;
    setFuSpaces(prev => prev.map(s => targetIds.includes(s.id) ? { ...s, flagged: nextState } : s));
    toast.info(nextState ? `Flagged ${targetIds.length} space(s)` : `Unflagged ${targetIds.length} space(s)`);
  };

  // Excel Import
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!rows || rows.length < 2) {
          toast.error("Imported sheet is empty or invalid format.");
          return;
        }

        const newSpaces: FUSpace[] = [];
        let currentFloor = "1F";

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || "").trim();
          if (!firstCell) continue;

          if (/floor|level|basement|ground|roof/i.test(firstCell) && row.length <= 3) {
            currentFloor = firstCell.toUpperCase();
            continue;
          }

          if (firstCell.toLowerCase() === "description" || firstCell.toLowerCase() === "sr." || firstCell.toLowerCase() === "space") continue;

          const fixtures: Record<string, number> = {};
          DU_FIXTURES_META.forEach((f, idx) => {
            const colVal = Number(row[idx + 1]);
            if (!isNaN(colVal) && colVal > 0) {
              fixtures[f.id] = colVal;
            }
          });

          const spaceItem: FUSpace = {
            id: Date.now() + i + Math.floor(Math.random() * 1000),
            desc: firstCell,
            floor: currentFloor,
            std: "total-du",
            fixtures,
          };
          spaceItem.flagged = checkIfDUSpaceMissingData(spaceItem);
          newSpaces.push(spaceItem);
        }

        if (newSpaces.length > 0) {
          pushToUndo(fuSpaces);
          setFuSpaces(prev => [...prev, ...newSpaces]);
          toast.success(`Successfully imported ${newSpaces.length} space(s) from Excel!`);
        } else {
          toast.error("Could not find valid space schedule rows in file.");
        }
      } catch (err) {
        console.error("Excel import error:", err);
        toast.error("Failed to parse Excel file.");
      } finally {
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  // PDF Export
  const handleExportPDF = async () => {
    if (fuSpaces.length === 0) {
      toast.info("No spaces to export.");
      return;
    }
    try {
      await exportDischargeUnitPDF(fuSpaces, calculations);
      toast.success("PDF report exported successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export PDF report.");
    }
  };

  const { user } = useAuth();
  const currentUserName = user?.name || user?.email || "Lead MEP Engineer";

  return (
    <AppShell title="Discharge Unit Calculator" hideSubHeader={true} onIntelClick={() => setIntelOpen((v) => !v)} intelOpen={intelOpen}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          
          {/* Page Header (Matching Ventilation exactly) */}
          <div className="flex justify-between items-center shrink-0 select-none no-print modal-blur-bg py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                  Discharge Unit Calculator
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Discharge Unit Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar 
                projectId={activeProjectId || project?.id}
                calculatorPath="/plumbing-discharge-unit" 
                calculatorTitle="Discharge Unit Calculator"
              />
            </div>

            {/* Right Side Header Controls: Unit System Toggle */}
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* Unified White Card Container (Matching Ventilation Layout Structure) */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                  ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                  : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Row 1: Header / Main Tabs on Left + Standard & Category Options on Right */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/50 gap-4 flex-wrap">
              <div className="flex bg-slate-100 dark:bg-slate-900/70 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setActiveTab("spaces")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "spaces" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Spaces
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "report" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Report
                </button>
              </div>

              {/* Right Side Options */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground font-medium">Standard:</span>
                  <div className="relative inline-flex items-center">
                    <select
                      value={headerStd}
                      onChange={(e) => setHeaderStd(e.target.value)}
                      className="h-7 pl-2.5 pr-7 bg-surface-2 border border-border/80 rounded-full text-xs font-semibold text-foreground outline-none cursor-pointer appearance-none hover:bg-surface-3 transition-colors"
                    >
                      <option value="total-du">Total D.U. (IPC Table E103.3)</option>
                      <option value="black-water">Black Water Only</option>
                      <option value="grey-water">Grey Water Only</option>
                    </select>
                    <ChevronDown className="size-3.5 absolute right-2 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Toolbar Strip inside Spaces Tab */}
            {activeTab === "spaces" && (
              <div className="relative flex items-center justify-between px-3 h-10 bg-background border-b border-border/60 shrink-0 select-none gap-2 flex-wrap no-print">
                {/* Left Controls: Search, Filter Popover, & Sort */}
                <div className="flex items-center gap-1.5 flex-1 w-full sm:w-auto">
                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter spaces..."
                      className="h-8 w-44 sm:w-56 pl-8 pr-3 bg-surface-2 border border-border rounded-full text-xs outline-none focus:border-primary focus:bg-background transition-all text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all duration-150 ease-out outline-none cursor-pointer group ${
                          activeFiltersCount > 0
                            ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                            : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        }`}
                        title="Filter Spaces"
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
                            onClick={() => {
                              setFilterFloor("all");
                              setShowFlaggedOnly(false);
                            }}
                            className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Floor</span>
                        <div className="relative flex items-center">
                          <select
                            value={filterFloor}
                            onChange={(e) => setFilterFloor(e.target.value)}
                            className="h-8 w-full pl-2.5 pr-7 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer appearance-none text-foreground"
                          >
                            <option value="all">All Floors</option>
                            {uniqueFloors.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                          <ChevronDown className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                        <label className="flex items-center gap-2 text-[11.5px] font-semibold text-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showFlaggedOnly}
                            onChange={(e) => setShowFlaggedOnly(e.target.checked)}
                            className="rounded border-gray-300 text-red-600 size-3.5 focus:ring-red-500"
                          />
                          <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                            <Flag className="size-3 fill-red-500 text-red-500" />
                            Flagged / Warnings Only
                          </span>
                        </label>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <button
                    onClick={() => {
                      setSortBy(prev => prev === "none" ? "desc" : prev === "desc" ? "du" : "none");
                      toast.info(`Sort: ${sortBy === "none" ? "By Description" : sortBy === "desc" ? "By Total D.U." : "Default Natural Sort"}`);
                    }}
                    className={`inline-flex items-center justify-center h-8 px-2.5 gap-1 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
                      sortBy !== "none" ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                    title="Toggle Table Sorting"
                  >
                    <ArrowUpDown className="size-3" />
                    <span>{sortBy === "desc" ? "Desc" : sortBy === "du" ? "D.U." : "Sort"}</span>
                  </button>
                </div>

                {/* Right Controls: Import, Export, Add Floor Section, Add Space */}
                <div className="flex items-center gap-2 flex-wrap shrink-0 justify-end w-full sm:w-auto">
                  <input
                    type="file"
                    ref={importFileRef}
                    onChange={handleImportExcel}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isApprovedLocked}
                    onClick={() => importFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-background hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <Download className="size-3.5" /> Import
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-background hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileText className="size-3.5" /> Export
                  </button>

                  <button
                    type="button"
                    onClick={handleAddNewFloorSection}
                    disabled={isApprovedLocked}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <Plus className="size-3.5" /> Add Floor Section
                  </button>

                  <button
                    type="button"
                    disabled={isApprovedLocked}
                    onClick={() => handleAddSpace()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="size-3.5" /> New Space
                  </button>
                </div>

                {/* Bulk actions bar overlay (Matching Ventilation & Loading Unit) */}
                {!isApprovedLocked && selectedIds.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-between px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{selectedIds.length} selected</span>
                      <span className="text-primary/30">·</span>
                      <BulkBtn icon={Copy} onClick={handleBulkDuplicate}>Duplicate ({selectedIds.length})</BulkBtn>
                      <BulkBtn icon={Building2} onClick={() => handleOpenMoveFloorModal()}>Move to Floor</BulkBtn>
                      <BulkBtn icon={Trash2} onClick={handleBulkDelete}>Delete</BulkBtn>
                    </div>

                    <button
                      onClick={() => setSelectedIds([])}
                      className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                    >
                      <X className="size-3" /> Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Tab Content Body Area */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {activeTab === "spaces" && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  
                  {/* Spaces Schedule Table with Floor Section Grouping - Fits screen without horizontal scrollbar */}
                  <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto w-full custom-scrollbar select-none">
                    <table className="w-full border-collapse text-[12px] font-sans text-left table-fixed">
                      <colgroup>
                        <col style={{ width: "3.2%" }} />
                        <col style={{ width: "21.0%" }} />
                        <col style={{ width: "5.0%" }} />
                        {DU_FIXTURES_META.map(f => (
                          <col key={f.id} style={{ width: "5.7%" }} />
                        ))}
                        <col style={{ width: "7.0%" }} />
                        <col style={{ width: "7.0%" }} />
                        <col style={{ width: "5.5%" }} />
                      </colgroup>
                      <thead className="bg-slate-50 dark:bg-slate-900/90 sticky top-0 z-20 border-b border-border text-muted-foreground uppercase text-[10.5px] tracking-wider font-bold">
                        <tr className="border-b border-border/80 h-9">
                          <th className="py-1 px-1 text-center border-r border-border/60">
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={allSelected && !isLocked}
                              onChange={(e) => handleToggleSelectAll(e.target.checked)}
                              className="size-3.5 accent-primary cursor-pointer rounded mx-auto block disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isLocked ? "Calculation is locked" : (allSelected ? "Deselect All Spaces" : "Select All Spaces")}
                            />
                          </th>
                          <th className="py-1.5 px-2.5 text-left text-[11px] font-bold tracking-wider text-muted-foreground truncate border-r border-border/60">
                            DESCRIPTION
                          </th>
                          <th className="py-1.5 px-1 text-center text-[10.5px] font-bold tracking-wider text-muted-foreground border-r border-border/60">
                            FLOOR
                          </th>
                          {DU_FIXTURES_META.map(f => {
                            const shortLabel = f.id === "wc" ? "WC" : f.id === "laundry" ? "WASHER" : f.id === "catchbasin" ? "CATCH B." : f.id === "basin" ? "BASIN" : f.id === "bath" ? "BATH" : f.short.toUpperCase();
                            return (
                              <th key={f.id} className="py-1 px-0.5 text-center font-mono text-[10px] sm:text-[10.5px] leading-tight font-bold uppercase tracking-wider text-muted-foreground truncate border-r border-border/60" title={f.short}>
                                <span className="block truncate">{shortLabel}</span>
                              </th>
                            );
                          })}
                          <th className="py-1.5 px-1 text-center text-red-600 dark:text-red-400 text-[10.5px] font-bold tracking-wider uppercase whitespace-nowrap border-r border-border/60">
                            BLACK DU
                          </th>
                          <th className="py-1.5 px-1 text-center text-emerald-600 dark:text-emerald-400 text-[10.5px] font-bold tracking-wider uppercase whitespace-nowrap border-r border-border/60">
                            GREY DU
                          </th>
                          <th className="py-1.5 px-1 text-center text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">
                            FLAG
                          </th>
                        </tr>

                        {/* Fixture Weights Overview Row */}
                        <tr className="bg-slate-100/70 dark:bg-slate-900/40 border-b border-border/60 text-[10.5px] text-muted-foreground select-none h-7.5">
                          <td className="p-1 text-center border-r border-border/60"></td>
                          <td className="p-1 px-2.5 text-left font-semibold text-muted-foreground italic text-[10.5px] truncate border-r border-border/60">
                            Standard Rate Override
                          </td>
                          <td className="p-1 text-center font-mono text-[10.5px] text-muted-foreground border-r border-border/60">
                            --
                          </td>
                          {DU_FIXTURES_META.map(f => {
                            const val = weightOverrides[f.id] !== undefined ? weightOverrides[f.id] : (IP_DISCHARGE_UNITS[f.id]?.[headerStd] ?? 0);
                            const isOverridden = weightOverrides[f.id] !== undefined;
                            return (
                              <td key={f.id} className="p-0.5 text-center font-mono border-r border-border/60">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  disabled={isApprovedLocked}
                                  value={val}
                                  onChange={(e) => {
                                    if (isApprovedLocked) return;
                                    const raw = e.target.value;
                                    if (raw === "") {
                                      const next = { ...weightOverrides };
                                      delete next[f.id];
                                      setWeightOverrides(next);
                                    } else {
                                      const num = parseFloat(raw);
                                      if (!isNaN(num) && num >= 0) {
                                        setWeightOverrides(prev => ({ ...prev, [f.id]: num }));
                                      }
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                  className={`w-full max-w-[44px] h-5.5 mx-auto block text-center text-[10.5px] font-bold font-mono rounded border outline-none transition-all ${
                                    isOverridden
                                      ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-extrabold focus:ring-1 focus:ring-amber-500"
                                      : "bg-blue-500/5 dark:bg-blue-950/40 border-blue-500/30 text-[#0A7BC7] dark:text-blue-400 focus:ring-1 focus:ring-[#0A7BC7]"
                                  } ${isApprovedLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                  title={
                                    isOverridden
                                      ? `Custom weight override (${val} DU). Clear to reset.`
                                      : `Standard rate (${val} DU). Click to override weight.`
                                  }
                                />
                              </td>
                            );
                          })}
                          <td className="p-0.5 text-center font-mono font-bold text-red-600 dark:text-red-400 text-[10.5px] whitespace-nowrap border-r border-border/60">
                            Σ Black
                          </td>
                          <td className="p-0.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[10.5px] whitespace-nowrap border-r border-border/60">
                            Σ Grey
                          </td>
                          <td className="p-0.5 text-center"></td>
                        </tr>
                      </thead>

                      {Object.keys(floorsGrouped).map((floor) => {
                        const isCollapsed = collapsedFloors.has(floor);
                        const floorItems = floorsGrouped[floor] || [];
                        return (
                          <tbody key={floor} className="divide-y divide-border/50 border-b border-border">
                            {/* Floor Group Section Header */}
                            <tr className="bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 border-y border-border text-primary font-semibold text-[12.5px] select-none h-8 transition-colors">
                              <td colSpan={DU_FIXTURES_META.length + 6} className="py-1 px-3 text-left">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCollapsedFloors((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(floor)) next.delete(floor);
                                          else next.add(floor);
                                          return next;
                                        });
                                      }}
                                      className="p-0.5 rounded hover:bg-primary/10 transition-colors text-primary/70 hover:text-primary flex items-center justify-center cursor-pointer"
                                    >
                                      {isCollapsed ? (
                                        <ChevronRight className="size-3.5" />
                                      ) : (
                                        <ChevronDown className="size-3.5" />
                                      )}
                                    </button>
                                    <FloorNameInput
                                      floor={floor}
                                      disabled={isApprovedLocked}
                                      onRename={handleRenameFloorGroup}
                                    />
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      ({floorItems.length} space types)
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      disabled={isApprovedLocked}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddSpaceToFloor(floor);
                                      }}
                                      className="flex items-center gap-1 text-[#0A7BC7] dark:text-[#38bdf8] hover:bg-blue-500/10 text-[10.5px] font-bold px-3 py-0.5 rounded-full border border-[#0A7BC7]/40 transition-colors cursor-pointer bg-transparent shadow-2xs"
                                      title={`Add space to ${floor}`}
                                    >
                                      <Plus className="size-3" />
                                      <span>Add Space to {floor}</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isApprovedLocked}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteFloorGroup(floor);
                                      }}
                                      className="text-rose-500 hover:text-rose-700 text-[10px] font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                      title={`Delete floor section ${floor}`}
                                    >
                                      Delete Floor
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* Existing Spaces on this Floor */}
                            {!isCollapsed && floorItems.map((s, spaceIdx) => {
                              const isSelected = selectedIds.includes(s.id);
                              const validation = getFUSpaceValidation(s);
                              const isEffectivelyFlagged = validation.isFlagged;
                              const spaceBlack = calculations.spaceBlackTotals[s.id] || 0;
                              const spaceGrey = calculations.spaceGreyTotals[s.id] || 0;
                              const itemComments = getMergedItemComments(String(s.id), s.desc, (s as any).comments, "/plumbing-discharge-unit", project?.id);

                              return (
                                <ContextMenu key={s.id}>
                                  <ContextMenuTrigger asChild>
                                    <tr
                                      id={`du-space-${s.id}`}
                                      data-row-id={s.id}
                                      data-space-id={s.id}
                                      onClick={(e) => {
                                        if (isLocked) return;
                                        const target = e.target as HTMLElement;
                                        if (target.tagName === "INPUT" || target.tagName === "BUTTON" || target.closest("button") || target.closest("input") || target.tagName === "SELECT") {
                                          return;
                                        }
                                        handleRowClick(s.id, e);
                                      }}
                                      onDoubleClick={() => handleOpenSpaceModal(s)}
                                      className={`group transition-all duration-150 cursor-pointer h-8 text-[12px] border-b border-border/50 select-none ${
                                        isSelected
                                          ? "bg-primary/15 font-medium dark:bg-primary/20 border-l-2 border-l-primary"
                                          : spaceIdx % 2 === 0
                                            ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80"
                                            : "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"
                                      }`}
                                    >
                                      {/* 1. Checkbox */}
                                      <td className="p-1 text-center border-r border-border/40 relative" onDoubleClick={() => handleOpenSpaceModal(s)} onClick={(e) => e.stopPropagation()}>
                                        {itemComments.length > 0 && (
                                          <RowCommentCornerBadge count={itemComments.length} onClick={() => handleOpenComment(String(s.id), s.desc)} />
                                        )}
                                        <div className="flex items-center justify-center gap-1">
                                          <input
                                            type="checkbox"
                                            checked={isSelected && !isLocked}
                                            disabled={isLocked}
                                            onChange={(e) => handleToggleSelect(s.id, e.target.checked)}
                                            className="size-3.5 accent-primary cursor-pointer rounded shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                          />
                                        </div>
                                      </td>

                                      {/* 2. Description */}
                                      <td className="p-0.5 px-2 truncate min-w-0 border-r border-border/40" onDoubleClick={() => handleOpenSpaceModal(s)}>
                                        <div className="flex items-center gap-1.5 w-full min-w-0">
                                          
                                          <input
                                            type="text"
                                            disabled={isApprovedLocked}
                                            value={s.desc || ""}
                                            placeholder="Space Description"
                                            onChange={(e) => handleSpaceChange(s.id, "desc", e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenSpaceModal(s);
                                            }}
                                            className="w-full bg-transparent hover:bg-background focus:bg-background border border-transparent hover:border-border/60 focus:border-primary rounded px-1.5 py-0.5 font-medium text-[12.5px] text-foreground outline-none transition-all truncate cursor-pointer focus:cursor-text disabled:cursor-not-allowed"
                                          />
                                        </div>
                                      </td>

                                      {/* 3. Floor */}
                                      <td className="p-0.5 px-1 text-center border-r border-border/40" onDoubleClick={() => handleOpenSpaceModal(s)}>
                                        <input
                                          type="text"
                                          disabled={isApprovedLocked}
                                          value={s.floor || "1F"}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setFuSpaces(prev => prev.map(x => x.id === s.id ? { ...x, floor: val, isManualFloor: true } : x));
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenSpaceModal(s);
                                          }}
                                          className="w-full text-center bg-transparent border border-transparent hover:border-border/60 focus:border-primary focus:bg-background rounded px-0.5 py-0.5 text-[12px] font-mono font-medium text-muted-foreground outline-none transition-all cursor-pointer focus:cursor-text disabled:cursor-not-allowed uppercase"
                                        />
                                      </td>

                                      {/* 4. Fixture Inputs */}
                                      {DU_FIXTURES_META.map(f => (
                                        <td key={f.id} className="p-0.5 text-center border-r border-border/40" onDoubleClick={() => handleOpenSpaceModal(s)}>
                                          <input
                                            type="number"
                                            min="0"
                                            disabled={isApprovedLocked}
                                            value={s.fixtures[f.id] === 0 ? "" : (s.fixtures[f.id] || "")}
                                            placeholder="-"
                                            onChange={(e) => handleFixtureChange(s.id, f.id, Number(e.target.value))}
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenSpaceModal(s);
                                            }}
                                            className="w-full h-full text-center bg-transparent border border-transparent hover:border-border/60 focus:border-primary focus:bg-background rounded px-0.5 py-0.5 text-[12.5px] font-mono tabular font-medium text-foreground outline-none transition-all cursor-pointer focus:cursor-text disabled:cursor-not-allowed"
                                          />
                                        </td>
                                      ))}

                                      {/* 5. Black DU Total */}
                                      <td className="p-0.5 px-1 text-center font-mono font-bold text-red-600 dark:text-red-400 text-[12.5px] tabular whitespace-nowrap border-r border-border/40" onDoubleClick={() => handleOpenSpaceModal(s)}>
                                        {spaceBlack > 0 ? spaceBlack.toFixed(1) : "-"}
                                      </td>

                                      {/* 6. Grey DU Total */}
                                      <td className="p-0.5 px-1 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[12.5px] tabular whitespace-nowrap border-r border-border/40" onDoubleClick={() => handleOpenSpaceModal(s)}>
                                        {spaceGrey > 0 ? spaceGrey.toFixed(1) : "-"}
                                      </td>

                                      {/* 7. Actions / Flag */}
                                      <td className="p-0.5 px-1 text-center" onDoubleClick={() => handleOpenSpaceModal(s)} onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          disabled={isApprovedLocked}
                                          title={
                                            validation.isMissing
                                              ? (validation.warnings.length > 0 ? validation.warnings.join("\n") : "Missing space fixture or name data")
                                              : (isEffectivelyFlagged ? "Unflag space (Manually Flagged)" : "Flag space for review")
                                          }
                                          onClick={() => handleToggleFlag(s.id)}
                                          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group inline-flex items-center justify-center mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Flag
                                            className={`size-3.5 transition-all duration-200 ${
                                              isEffectivelyFlagged
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
                                    onClick={() => setEditingSpace(s)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                  >
                                    <Edit3 className="size-3.5 text-muted-foreground" />
                                    <span>Edit Space Parameters</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                                  </ContextMenuItem>

                                  <ContextMenuSeparator className="h-px bg-border my-1" />

                                  <ContextMenuItem
                                    onClick={() => {
                                      const toCopy = selectedIds.includes(s.id) && selectedIds.length > 1 ? fuSpaces.filter(x => selectedIds.includes(x.id)) : [s];
                                      setClipboard(toCopy);
                                      toast.info(`${toCopy.length} space(s) copied to clipboard`);
                                    }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                  >
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    <span>{isSelected && selectedIds.length > 1 ? `Copy (${selectedIds.length}) Spaces` : "Copy"}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                  </ContextMenuItem>

                                  <ContextMenuItem
                                    onClick={() => {
                                      if (isApprovedLocked) return;
                                      const toCopy = selectedIds.includes(s.id) && selectedIds.length > 1 ? fuSpaces.filter(x => selectedIds.includes(x.id)) : [s];
                                      setClipboard(toCopy);
                                      pushToUndo(fuSpaces);
                                      const idsToRemove = toCopy.map(x => x.id);
                                      setFuSpaces(prev => prev.filter(x => !idsToRemove.includes(x.id)));
                                      setSelectedIds([]);
                                      toast.info(`${toCopy.length} space(s) cut to clipboard`);
                                    }}
                                    disabled={isApprovedLocked}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                  >
                                    <Scissors className="size-3.5 text-muted-foreground" />
                                    <span>{isSelected && selectedIds.length > 1 ? `Cut (${selectedIds.length}) Spaces` : "Cut"}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
                                  </ContextMenuItem>

                                  <ContextMenuItem
                                    onClick={() => {
                                      if (isApprovedLocked || clipboard.length === 0) return;
                                      const targetFloor = s.floor || "1F";
                                      const pasted = clipboard.map((x, idx) => ({
                                        ...x,
                                        id: Date.now() + idx + Math.floor(Math.random() * 1000),
                                        desc: `${x.desc} (Copy)`,
                                        floor: targetFloor
                                      }));
                                      pushToUndo(fuSpaces);
                                      setFuSpaces(prev => [...prev, ...pasted]);
                                      setSelectedIds(pasted.map(p => p.id));
                                      toast.success(`${pasted.length} space(s) pasted`);
                                    }}
                                    disabled={isApprovedLocked || clipboard.length === 0}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                  >
                                    <Clipboard className="size-3.5 text-muted-foreground" />
                                    <span>Paste {clipboard.length > 0 ? `(${clipboard.length})` : ""}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                                  </ContextMenuItem>

                                  <ContextMenuSeparator className="h-px bg-border my-1" />

                                  <ContextMenuItem
                                    onClick={() => handleBulkDuplicate()}
                                    disabled={isApprovedLocked}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                  >
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    <span>{isSelected && selectedIds.length > 1 ? `Duplicate (${selectedIds.length}) Spaces` : "Duplicate Space"}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
                                  </ContextMenuItem>

                                  <ContextMenuItem
                                    onClick={() => {
                                      if (isApprovedLocked) return;
                                      const targetIds = isSelected && selectedIds.length > 1 ? selectedIds : [s.id];
                                      handleOpenMoveFloorModal(targetIds);
                                    }}
                                    disabled={isApprovedLocked}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                  >
                                    <Building2 className="size-3.5 text-muted-foreground" />
                                    <span>{isSelected && selectedIds.length > 1 ? `Move (${selectedIds.length}) Spaces to Floor` : "Move to Floor"}</span>
                                  </ContextMenuItem>

                                  <ContextMenuItem
                                    onClick={() => handleToggleFlag(s.id)}
                                    disabled={isApprovedLocked}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                  >
                                    <Flag className={`size-3.5 ${isEffectivelyFlagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                                    <span>{isEffectivelyFlagged ? "Unflag Space" : "Flag Space"}</span>
                                  </ContextMenuItem>

                                  <ContextMenuItem
                                    onClick={() => handleOpenComment(String(s.id), s.desc)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                  >
                                    <MessageSquare className="size-3.5" />
                                    <span>Add Comment</span>
                                  </ContextMenuItem>

                                  <ContextMenuSeparator className="h-px bg-border my-1" />

                                  <ContextMenuItem
                                    onClick={() => {
                                      if (isApprovedLocked) return;
                                      const targetIds = isSelected && selectedIds.length > 1 ? selectedIds : [s.id];
                                      pushToUndo(fuSpaces);
                                      setFuSpaces(prev => prev.filter(x => !targetIds.includes(x.id)));
                                      setSelectedIds([]);
                                      toast.info(`Deleted ${targetIds.length} space(s)`);
                                    }}
                                    disabled={isApprovedLocked}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-destructive cursor-pointer font-medium disabled:opacity-50"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>{isSelected && selectedIds.length > 1 ? `Delete (${selectedIds.length}) Selected` : "Delete Space"}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            );
                          })}
                        </tbody>
                      );
                    })}
                    </table>
                  </div>

                  {/* Footer Bar (Matching Ventilation / Loading Unit) */}
                  <div className="flex items-center justify-between px-4 h-8 border-t border-border bg-header-bg text-[12px] text-muted-foreground shrink-0 select-none no-print">
                    <div>
                      Showing <span className="text-foreground font-medium tabular">{filteredSpaces.length.toLocaleString()}</span> of {fuSpaces.length.toLocaleString()} spaces
                    </div>
                    <div className="flex items-center gap-5 tabular font-mono text-[12.5px]">
                      <span>Σ Black DU: <strong className="text-red-600 dark:text-red-400">{calculations.blackTotalDU.toFixed(1)}</strong></span>
                      <span>Σ Grey DU: <strong className="text-emerald-600 dark:text-emerald-400">{calculations.greyTotalDU.toFixed(1)}</strong></span>
                      <span>Total DU: <strong className="text-foreground font-bold">{calculations.totalDU.toFixed(1)} D.U.</strong></span>
                      <span>Peak Flow: <strong className="text-primary font-bold">{calculations.displayFlow}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Report Tab */}
              {activeTab === "report" && (
                <DischargeUnitReportView
                  fuSpaces={fuSpaces}
                  calculations={calculations}
                  floorsGrouped={floorsGrouped}
                  project={project}
                  calcReviewState={calcReviewState}
                  currentUserName={currentUserName}
                  headerStd={headerStd}
                  weightOverrides={weightOverrides}
                  onExportPdf={handleExportPDF}
                />
              )}
            </div>
          </div>
        </div>

        {/* Intelligence Drawer (Collapsible Right Side Panel) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <DischargeUnitIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calculations={calculations}
              fuSpaces={fuSpaces}
              headerStd={headerStd}
              setActiveTab={setActiveTab}
            />
          )}
        </div>
      </div>

      {/* Edit Space Modal */}
      {editingSpace && (
        <DischargeSpacePreviewModal 
          space={editingSpace} 
          onClose={() => setEditingSpace(null)} 
          getEffectiveUnitFU={getEffectiveUnitFU} 
          onSave={(updated) => {
            pushToUndo(fuSpaces);
            const wasMissing = checkIfDUSpaceMissingData(editingSpace);
            const isMissing = checkIfDUSpaceMissingData(updated);
            let flagged = updated.flagged;
            if (isMissing) {
              flagged = true;
            } else if (wasMissing && !isMissing) {
              flagged = false;
            }
            const finalUpdated = { ...updated, flagged };
            setFuSpaces(prev => prev.map(s => s.id === updated.id ? finalUpdated : s));
            setEditingSpace(null);
            toast.success(`Updated "${updated.desc}" parameters`);
          }}
        />
      )}
    
      {/* Assign Comment Modal */}
      {commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="space"
          calculatorTitle="Discharge Unit Calculator"
          calculatorPath="/plumbing-discharge-unit"
          existingComments={getMergedItemComments(commentTargetItem.id, commentTargetItem.name, (fuSpaces.find(s => String(s.id) === commentTargetItem.id) as any)?.comments, "/plumbing-discharge-unit", project?.id)}
          onSave={handleSaveComment}
        />
      )}

      {/* Move to Floor Modal */}
      <MoveFloorModal
        isOpen={moveFloorModalOpen}
        onClose={() => setMoveFloorModalOpen(false)}
        spaceIds={moveFloorTargetIds}
        fuSpaces={fuSpaces}
        floorSections={floorSections}
        onConfirmMove={handleConfirmMoveFloor}
      />
    </AppShell>
  );
}

function DischargeSpacePreviewModal({
  space,
  onClose,
  getEffectiveUnitFU,
  onSave
}: {
  space: FUSpace;
  onClose: () => void;
  getEffectiveUnitFU: (fixtureId: string, spaceStd: string) => number;
  onSave: (s: FUSpace) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [tempSpace, setTempSpace] = useState<FUSpace>({ ...space });

  const spaceStd = tempSpace.std;
  let spaceDU = 0;
  const breakdown: any[] = [];
  
  DU_FIXTURES_META.forEach(f => {
    const qty = tempSpace.fixtures[f.id] || 0;
    if (qty > 0) {
      const unitFU = getEffectiveUnitFU(f.id, spaceStd);
      const subTotal = qty * unitFU;
      spaceDU += subTotal;
      breakdown.push({ name: f.short, qty, unitFU, subTotal });
    }
  });

  const handleFixtureChange = (id: string, qty: number) => {
    setTempSpace(prev => ({ ...prev, fixtures: { ...prev.fixtures, [id]: qty } }));
  };

  const labelClass = "block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide";
  const inputClass = "w-full h-9 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 text-[13px] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className={`bg-card text-card-foreground flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden transition-all duration-300 ease-out max-h-[90vh] ${
          showPreview ? "max-w-5xl" : "max-w-2xl"
        } w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
                Edit Space Parameters
              </h2>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Configure discharge units mapping and fixture quantities.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all shadow-sm cursor-pointer ${
                showPreview
                  ? "bg-primary text-primary-foreground hover:bg-primary/95 ring-2 ring-primary/20"
                  : "bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Info className="size-3.5" />
              Calculations Preview
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 form-scrollbar">
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                General Parameters
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClass}>Space Name</label>
                  <input type="text" value={tempSpace.desc} onChange={e => setTempSpace(p => ({...p, desc: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Floor</label>
                  <input type="text" value={tempSpace.floor} onChange={e => setTempSpace(p => ({...p, floor: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Standard</label>
                  <select value={tempSpace.std} onChange={e => setTempSpace(p => ({...p, std: e.target.value}))} className={inputClass}>
                    <option value="total-du">Total D.U.</option>
                    <option value="black-water">Black Water</option>
                    <option value="grey-water">Grey Water</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                Fixture Quantities
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {DU_FIXTURES_META.map(f => (
                  <div key={f.id}>
                    <label className={labelClass}>{f.short}</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={tempSpace.fixtures[f.id] || ""} 
                      onChange={e => handleFixtureChange(f.id, parseInt(e.target.value) || 0)} 
                      className={inputClass} 
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div
            className={`shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
              showPreview ? "w-[400px] opacity-100 p-6" : "w-0 opacity-0 p-0"
            }`}
          >
            <div className="w-[352px] space-y-5 flex flex-col h-full overflow-y-auto">
              <h3 className="text-[11px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0">
                Calculations Preview
              </h3>

              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 shadow-sm">
                  <div className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Discharge Units Breakdown
                  </div>

                  <div className="space-y-2">
                    {breakdown.length === 0 ? (
                      <div className="text-[11px] italic text-muted-foreground py-2 border-t border-black/5 dark:border-white/5">No fixtures added.</div>
                    ) : breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between items-baseline text-[12px] pt-1.5 border-t border-black/5 dark:border-white/5">
                        <span className="text-neutral-500 dark:text-neutral-400 font-medium truncate max-w-[150px]">{b.name}</span>
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <span>{b.qty} × {b.unitFU} =</span>
                          <span className="font-bold text-[13px] text-foreground w-12 text-right">{b.subTotal.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline text-[12px] pt-2 border-t-2 border-black/10 dark:border-white/10">
                      <span className="font-bold text-[#06456F] dark:text-sky-400">Total D.U.</span>
                      <span className="font-mono font-black text-[18px] text-[#0A7BC7]">
                        {spaceDU.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="px-6 h-16 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="h-10 px-5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(tempSpace)}
            className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-[12.5px] font-semibold transition-all shadow-md shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Move Space(s) to Floor Modal Dialog (High-End Custom Modal UI)
// ─────────────────────────────────────────────────────────────────────────────
interface MoveFloorModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceIds: number[];
  fuSpaces: FUSpace[];
  floorSections: string[];
  onConfirmMove: (targetFloor: string, spaceIds: number[]) => void;
}

function MoveFloorModal({
  isOpen,
  onClose,
  spaceIds,
  fuSpaces,
  floorSections,
  onConfirmMove,
}: MoveFloorModalProps) {
  const selectedSpaces = useMemo(() => {
    return fuSpaces.filter(s => spaceIds.includes(s.id));
  }, [fuSpaces, spaceIds]);

  const currentFloor = selectedSpaces[0]?.floor || floorSections[0] || "1F";
  const [selectedFloor, setSelectedFloor] = useState<string>(currentFloor);
  const [customFloorInput, setCustomFloorInput] = useState<string>("");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedFloor(currentFloor);
      setCustomFloorInput("");
      setIsCustomMode(false);
    }
  }, [isOpen, currentFloor]);

  if (!isOpen) return null;

  const handleCommit = () => {
    let target = isCustomMode ? customFloorInput.trim().toUpperCase() : selectedFloor.trim().toUpperCase();
    if (isCustomMode && !target) {
      toast.error("Please enter a valid floor name");
      return;
    }
    if (!target) {
      target = "1F";
    }
    onConfirmMove(target, spaceIds);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden transition-all duration-300 max-w-md w-full animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleCommit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Move Space(s) to Floor
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Relocate {selectedSpaces.length} selected space{selectedSpaces.length > 1 ? "s" : ""} to another floor section
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Selected Spaces Preview */}
          <div className="bg-slate-100/70 dark:bg-slate-900/50 p-3 rounded-xl border border-border/70 flex flex-col gap-1.5">
            <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
              Selected Space{selectedSpaces.length > 1 ? "s" : ""} ({selectedSpaces.length})
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
              {selectedSpaces.map(s => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-background border border-border/80 px-2 py-0.5 rounded-md text-foreground shadow-2xs"
                >
                  <span className="truncate max-w-[150px]">{s.desc || `Space #${s.id}`}</span>
                  <span className="text-[9.5px] text-primary font-bold">({s.floor || "1F"})</span>
                </span>
              ))}
            </div>
          </div>

          {/* Destination Floor Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Select Destination Floor
            </label>
            <div className="grid grid-cols-2 gap-2">
              {floorSections.map(fl => {
                const count = fuSpaces.filter(s => (s.floor || "1F").trim().toUpperCase() === fl.trim().toUpperCase()).length;
                const isSelected = !isCustomMode && selectedFloor.trim().toUpperCase() === fl.trim().toUpperCase();
                return (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => {
                      setSelectedFloor(fl);
                      setIsCustomMode(false);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-xs ring-1 ring-primary/30"
                        : "bg-background border-border hover:bg-slate-50 dark:hover:bg-slate-900 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-xs font-bold truncate">{fl}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Or Create New Floor Section */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="custom-floor-radio"
                checked={isCustomMode}
                onChange={() => setIsCustomMode(true)}
                className="size-3.5 accent-primary cursor-pointer"
              />
              <label
                htmlFor="custom-floor-radio"
                onClick={() => setIsCustomMode(true)}
                className="text-[11px] font-semibold text-foreground cursor-pointer select-none"
              >
                Or move to a new floor section:
              </label>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="e.g. 3F, BASEMENT 1, PODIUM, ROOF"
                value={customFloorInput}
                onFocus={() => setIsCustomMode(true)}
                onChange={(e) => {
                  setCustomFloorInput(e.target.value.toUpperCase());
                  setIsCustomMode(true);
                }}
                className={`h-9 w-full px-3 text-xs bg-background border rounded-xl outline-none transition-all uppercase placeholder:normal-case font-medium ${
                  isCustomMode
                    ? "border-primary ring-1 ring-primary/20 shadow-xs text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCommit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-xs transition-all cursor-pointer"
          >
            <Check className="size-3.5" />
            <span>Move to {isCustomMode && customFloorInput.trim() ? customFloorInput.trim().toUpperCase() : selectedFloor}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Browser Preliminary Engineering Report Component (Matching Preliminary & Loading Unit Format)
// ─────────────────────────────────────────────────────────────────────────────
function DischargeUnitReportView({
  fuSpaces,
  calculations,
  floorsGrouped,
  project,
  calcReviewState,
  currentUserName,
  headerStd,
  weightOverrides,
  onExportPdf,
}: {
  fuSpaces: FUSpace[];
  calculations: any;
  floorsGrouped: Record<string, FUSpace[]>;
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  headerStd: string;
  weightOverrides: Record<string, number>;
  onExportPdf: () => void;
}) {
  const calcNo = (project as any)?.calcNo || "TRV-DU-CALC-R01";
  const projectNo = project?.code || (project as any)?.projectNo || "P000";
  const projectName = project?.name || (project as any)?.projectName || "Plumbing Drainage & Discharge Units Sizing";
  const clientName = project?.client || "Design Client";
  const endUser = (project as any)?.endUser || (project as any)?.location || "Building Sanitary Drainage";
  const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");

  const sigDetails = getSignatureBlockDetails(project?.id || "default", "/plumbing-discharge-unit", currentUserName, calcReviewState);

  // Compute total fixtures count across all spaces
  const fixtureTotals: Record<string, { count: number; totalDU: number }> = {};
  DU_FIXTURES_META.forEach(f => {
    let count = 0;
    let totalDU = 0;
    const rate = weightOverrides[f.id] !== undefined ? weightOverrides[f.id] : (IP_DISCHARGE_UNITS[f.id]?.[headerStd] ?? 0);
    fuSpaces.forEach(s => {
      const q = s.fixtures[f.id] || 0;
      count += q;
      totalDU += q * rate;
    });
    fixtureTotals[f.id] = { count, totalDU };
  });

  return (
    <div className="flex flex-col h-full">
      {/* Top Action Bar matching Ventilation */}
      <div className="flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50 no-print">
        <span className="text-[12px] text-muted-foreground font-semibold">
          Generated: <span className="text-foreground font-mono">{today}</span>
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <TBtn onClick={() => window.print()}><Printer className="size-3.5" /> Print</TBtn>
          <TBtn primary onClick={onExportPdf}><FileText className="size-3.5" /> Export PDF</TBtn>
        </div>
      </div>

      {/* Document Paper Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
        <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">

          {/* Document Header */}
          <div className="flex justify-between items-start pb-4 border-b border-border">
            <div>
              <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                Discharge Unit &amp; Drainage Load Calculation Report
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                IPC Table E103.3 / Chapter 7 Drainage Fixture Units (DFU), Hunter's Curve Probable Peak Demand &amp; Black/Grey Water Separation
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block mt-0.5">Date: {today}</span>
            </div>
          </div>

          {/* Enclosed 3x2 Metadata Box */}
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 bg-muted/40 font-bold border-b border-border divide-x divide-border">
              <div className="p-2.5">Calculation No.:</div>
              <div className="p-2.5 font-mono text-primary font-normal">{calcNo}</div>
              <div className="p-2.5">Date:</div>
              <div className="p-2.5 font-normal">{today}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border divide-x divide-border">
              <div className="p-2.5 font-bold bg-muted/20">Project No.:</div>
              <div className="p-2.5 font-mono">{projectNo}</div>
              <div className="p-2.5 font-bold bg-muted/20">Client:</div>
              <div className="p-2.5">{clientName}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
              <div className="p-2.5 font-bold bg-muted/20">Project Name:</div>
              <div className="p-2.5">{projectName}</div>
              <div className="p-2.5 font-bold bg-muted/20">End User:</div>
              <div className="p-2.5">{endUser}</div>
            </div>
          </div>

          {/* Table 1: Project Summary & Design Parameters */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              1. Project Summary &amp; Design Parameters
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 w-12 text-center">No.</th>
                    <th className="p-2.5">Parameter Description</th>
                    <th className="p-2.5 text-center w-36">Calculated Value</th>
                    <th className="p-2.5 text-center w-20">Unit</th>
                    <th className="p-2.5">Engineering Design Basis / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                    <td className="p-2.5 font-bold">Total Connected Spaces</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{fuSpaces.length}</td>
                    <td className="p-2.5 text-center">spaces</td>
                    <td className="p-2.5 text-muted-foreground">Architectural Space Schedule</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Total Sanitary Discharge Units (D.U.)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculations.totalDU.toFixed(1)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">D.U.</td>
                    <td className="p-2.5 text-muted-foreground">IPC Table E103.3 Total Cumulative Discharge Load</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                    <td className="p-2.5 font-bold">Black Water Discharge Load</td>
                    <td className="p-2.5 text-center font-mono font-bold text-red-600 dark:text-red-400">{calculations.blackTotalDU.toFixed(1)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">D.U.</td>
                    <td className="p-2.5 text-muted-foreground">Water Closets &amp; Urinals Soil Drainage</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                    <td className="p-2.5 font-bold">Grey Water Discharge Load</td>
                    <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{calculations.greyTotalDU.toFixed(1)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">D.U.</td>
                    <td className="p-2.5 text-muted-foreground">Basins, Sinks, Showers &amp; Laundry Waste Drainage</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">5</td>
                    <td className="p-2.5 font-bold">Probable Simultaneous Peak Flow Rate</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculations.displayFlow}</td>
                    <td className="p-2.5 text-center font-mono font-bold">L/s</td>
                    <td className="p-2.5 text-muted-foreground">Hunter's Curve polynomial conversion for peak probable runoff</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">6</td>
                    <td className="p-2.5 font-bold">Governing Sizing Standard</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">IPC Table E103.3</td>
                    <td className="p-2.5 text-center">{headerStd.toUpperCase()}</td>
                    <td className="p-2.5 text-muted-foreground">International Plumbing Code (IPC) standard fixture unit ratings</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Detailed Fixture Schedule by Floor */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              2. Floor-by-Floor Fixture Units Schedule &amp; Distribution
            </h3>
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2 text-center w-10">Sr.</th>
                    <th className="p-2">Space Description</th>
                    <th className="p-2 text-center w-20">Floor</th>
                    {DU_FIXTURES_META.map(f => {
                      const shortLabel = f.id === "laundry" ? "WASHER" : f.id === "catchbasin" ? "CATCH B." : f.id === "basin" ? "BASIN" : f.id === "bath" ? "BATH" : f.short.toUpperCase();
                      return (
                        <th key={f.id} className="p-1.5 text-center font-mono text-[10.5px]" title={f.short}>
                          {shortLabel}
                        </th>
                      );
                    })}
                    <th className="p-2 text-center w-20 text-red-600 dark:text-red-400 font-bold">Black DU</th>
                    <th className="p-2 text-center w-20 text-emerald-600 dark:text-emerald-400 font-bold">Grey DU</th>
                    <th className="p-2 text-right w-20 font-bold">Total DU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.keys(floorsGrouped).map(fl => {
                    const floorItems = floorsGrouped[fl] || [];
                    if (floorItems.length === 0) return null;

                    let floorBlackDU = 0;
                    let floorGreyDU = 0;
                    let floorTotalDU = 0;

                    return (
                      <React.Fragment key={fl}>
                        <tr className="bg-slate-100 dark:bg-zinc-800/60 font-bold border-y border-border">
                          <td colSpan={3 + DU_FIXTURES_META.length + 3} className="p-2 px-3 uppercase text-foreground">
                            {fl} ({floorItems.length} spaces)
                          </td>
                        </tr>
                        {floorItems.map((s, sIdx) => {
                          const spaceBlack = calculations.spaceBlackTotals[s.id] || 0;
                          const spaceGrey = calculations.spaceGreyTotals[s.id] || 0;
                          const spaceTot = spaceBlack + spaceGrey;
                          floorBlackDU += spaceBlack;
                          floorGreyDU += spaceGrey;
                          floorTotalDU += spaceTot;

                          return (
                            <tr key={s.id} className={sIdx % 2 === 0 ? "bg-card" : "bg-slate-50/40 dark:bg-zinc-900/30"}>
                              <td className="p-2 text-center font-mono text-muted-foreground">{sIdx + 1}</td>
                              <td className="p-2 font-bold text-foreground">{s.desc}</td>
                              <td className="p-2 text-center text-muted-foreground">{s.floor || fl}</td>
                              {DU_FIXTURES_META.map(f => (
                                <td key={f.id} className="p-1.5 text-center font-mono text-[11px]">
                                  {Number(s.fixtures?.[f.id] || 0) > 0 ? (
                                    <span className="font-bold text-foreground">{s.fixtures[f.id]}</span>
                                  ) : (
                                    <span className="text-muted-foreground/30">—</span>
                                  )}
                                </td>
                              ))}
                              <td className="p-2 text-center font-mono font-bold text-red-600 dark:text-red-400">
                                {spaceBlack > 0 ? spaceBlack.toFixed(1) : "—"}
                              </td>
                              <td className="p-2 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {spaceGrey > 0 ? spaceGrey.toFixed(1) : "—"}
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-primary">
                                {spaceTot.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Floor Subtotal Row with Soft Blue Highlighting */}
                        <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                          <td colSpan={3 + DU_FIXTURES_META.length} className="p-2 px-3 text-right">
                            SUBTOTAL ({fl.toUpperCase()})
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-red-700 dark:text-red-300">
                            {floorBlackDU.toFixed(1)}
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            {floorGreyDU.toFixed(1)}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-primary">
                            {floorTotalDU.toFixed(1)} D.U.
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {/* Grand Total Row with Soft Blue Highlighting */}
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-extrabold border-y-2 border-border">
                    <td colSpan={3 + DU_FIXTURES_META.length} className="p-2.5 px-3 text-right text-xs uppercase tracking-wider">
                      TOTAL BUILDING SANITARY DISCHARGE LOAD
                    </td>
                    <td className="p-2.5 text-center font-mono text-xs font-bold text-red-700 dark:text-red-300">
                      {calculations.blackTotalDU.toFixed(1)}
                    </td>
                    <td className="p-2.5 text-center font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {calculations.greyTotalDU.toFixed(1)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-sm font-extrabold text-primary">
                      {calculations.totalDU.toFixed(1)} D.U.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3: Sanitary Fixture Types Loading Summary */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              3. Connected Sanitary Appliances &amp; Fixture Weights Breakdown
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5">Sanitary Appliance Name</th>
                    <th className="p-2.5 text-center w-28">Total Connected</th>
                    <th className="p-2.5 text-center w-28">Unit Weight</th>
                    <th className="p-2.5 text-center w-32">Waste Classification</th>
                    <th className="p-2.5 text-right w-36">Total Load (D.U.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {DU_FIXTURES_META.map(f => {
                    const info = fixtureTotals[f.id] || { count: 0, totalDU: 0 };
                    const rate = weightOverrides[f.id] !== undefined ? weightOverrides[f.id] : (IP_DISCHARGE_UNITS[f.id]?.[headerStd] ?? 0);
                    const isBlack = f.id === "wc" || f.id === "urinal";
                    return (
                      <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                        <td className="p-2.5 font-bold text-foreground">{f.short}</td>
                        <td className="p-2.5 text-center font-mono font-semibold">{info.count}</td>
                        <td className="p-2.5 text-center font-mono">{rate.toFixed(1)} D.U.</td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                            isBlack 
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" 
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {isBlack ? "Black Water (Soil)" : "Grey Water (Waste)"}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-foreground">
                          {info.totalDU.toFixed(1)} D.U.
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance Verification Banner */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                IPC Table E103.3 &amp; Chapter 7 Sanitary Compliance Verification
              </span>
              <p className="text-muted-foreground leading-relaxed">
                This calculation complies with International Plumbing Code (IPC) Table E103.3 and Chapter 7 standards for fixture discharge unit accumulation ({calculations.totalDU.toFixed(1)} D.U.) and diversity peak runoff estimation ({calculations.displayFlow}). Black water and grey water separation complies with municipal drainage pretreatment protocols.
              </p>
            </div>
          </div>

          {/* Table 4: 4-Column Professional Review & Sign-Off Block */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              4. Professional Review &amp; Sign-Off Block
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 text-left w-1/4">Approval Role</th>
                    <th className="p-2.5 text-center w-1/4">Originated By</th>
                    <th className="p-2.5 text-center w-1/4">Reviewed By</th>
                    <th className="p-2.5 text-center w-1/4">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 font-bold text-muted-foreground">Name:</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.originatedName}</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.reviewerName || "Pending Review"}</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.approverName || "Pending Approval"}</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 font-bold text-muted-foreground">Role / Status:</td>
                    <td className="p-2.5 text-center text-muted-foreground">MEP Plumbing Design Engineer</td>
                    <td className="p-2.5 text-center text-muted-foreground">Discipline Quality Review</td>
                    <td className="p-2.5 text-center text-muted-foreground">Head of Engineering / MEP QA</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-muted-foreground">Date:</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.originatedDate || today}</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.reviewerDate || "—"}</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.approverDate || "—"}</td>
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
// Intelligence Drawer Component for Discharge Unit Calculator
// ─────────────────────────────────────────────────────────────────────────────
function DischargeUnitIntelligenceDrawer({
  onClose,
  calculations,
  fuSpaces,
  headerStd,
  setActiveTab,
}: {
  onClose: () => void;
  calculations: any;
  fuSpaces: FUSpace[];
  headerStd: string;
  setActiveTab: (t: "spaces" | "report") => void;
}) {
  const flaggedCount = fuSpaces.filter((s) => s.flagged || getFUSpaceValidation(s).isFlagged).length;
  const missingFixtures = fuSpaces.filter((s) => !Object.values(s.fixtures || {}).some((v) => Number(v) > 0)).length;
  const compliancePct = fuSpaces.length > 0 ? Math.round(((fuSpaces.length - flaggedCount) / fuSpaces.length) * 100) : 100;

  // Determine suggested main stack pipe diameter based on total DU (IPC Table 710.1(2))
  const suggestedStackSize = useMemo(() => {
    const du = calculations.totalDU || 0;
    if (du <= 20) return { in: '3"', mm: 75, maxDU: 20 };
    if (du <= 160) return { in: '4"', mm: 100, maxDU: 160 };
    if (du <= 360) return { in: '5"', mm: 125, maxDU: 360 };
    if (du <= 620) return { in: '6"', mm: 150, maxDU: 620 };
    return { in: '8"', mm: 200, maxDU: 1400 };
  }, [calculations.totalDU]);

  const stdName = headerStd.replace("ipc-", "").toUpperCase();

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in font-sans">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          title="Close Intelligence"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Compliance Status */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="text-xs font-bold text-foreground">Standard Compliance Status</span>
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            {stdName} drainage validation across {fuSpaces.length} defined spaces.
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${compliancePct}%` }} />
            </div>
            <span className="font-mono text-[11px] font-bold text-foreground">{compliancePct}%</span>
          </div>
        </div>

        {/* Discharge Unit & Peak Flow Summary */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Discharge Unit Summary</span>
            </div>
            <button
              onClick={() => setActiveTab("spaces")}
              className="text-[10.5px] text-primary hover:underline font-semibold cursor-pointer"
            >
              View Spaces
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Total Discharge Units:</span>
              <span className="font-mono font-bold text-primary text-xs">{calculations.totalDU.toFixed(1)} D.U.</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Blackwater (Soil - WC/Urinal):</span>
              <span className="font-mono font-bold text-foreground">{calculations.blackTotalDU.toFixed(1)} D.U.</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Greywater (Waste):</span>
              <span className="font-mono font-bold text-foreground">{calculations.greyTotalDU.toFixed(1)} D.U.</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Peak Drainage Flow:</span>
              <span className="font-mono font-bold text-primary">{calculations.displayFlow}</span>
            </div>
            <div className="flex justify-between items-center pt-1 font-bold">
              <span className="text-foreground">Suggested Main Stack:</span>
              <span className="font-mono text-primary text-xs font-extrabold">DN{suggestedStackSize.mm} ({suggestedStackSize.in})</span>
            </div>
          </div>
        </div>

        {/* Calculation Issues & Warnings */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`size-4 ${flaggedCount > 0 || missingFixtures > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            <span className="text-xs font-bold text-foreground">Audit &amp; Flagged Items</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Flagged spaces:</span>
              <span className={`font-mono font-bold ${flaggedCount > 0 ? "text-red-500" : "text-muted-foreground"}`}>{flaggedCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Spaces with 0 fixtures:</span>
              <span className={`font-mono font-bold ${missingFixtures > 0 ? "text-amber-500" : "text-muted-foreground"}`}>{missingFixtures}</span>
            </div>
          </div>
        </div>

        {/* Standards Guidelines Reference */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 shadow-xs text-xs">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-blue-500" />
            <span className="font-bold text-foreground">Discharge Unit Engineering Guidelines</span>
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Discharge Units (D.U. / DFU) evaluate simultaneous drain runoff. Soil pipes carrying water closets require minimum DN75 (3&quot;) branch sizing regardless of total unit count.
          </p>
        </div>
      </div>
    </div>
  );
}

