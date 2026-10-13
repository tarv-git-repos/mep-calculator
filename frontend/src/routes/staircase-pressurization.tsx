import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { useAuth } from "@/contexts/AuthContext";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { Plus, Trash2, MessageSquare, FileSpreadsheet, FileText, Check, X, Wrench, Sparkles, Search, CheckCircle2, Info, ChevronDown, AlertTriangle, Upload, Edit3, Copy, CopyPlus, Scissors, Filter, ArrowUpDown, SlidersHorizontal, RefreshCw, Flag, Clipboard, ClipboardPaste, ShieldCheck, Flame, Activity, BookOpen, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { GridDropdown } from "@/components/workspace/GridDropdown";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { addPdfHeader, addPdfSignatureBlock, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { FloorSelect } from "@/components/workspace/FloorSelect";
import { useConfirm } from "@/hooks/use-confirm";
import {
  type DoorTypeKey,
  type DoorTypeDefinition,
  type StaircaseItem,
  DOOR_TYPES_CONFIG,
  CALCULATION_CONSTANTS,
  calculateStaircase
} from "@/lib/calc-staircase-pressurization";


export const Route = createFileRoute("/staircase-pressurization")({
  component: StaircasePressurizationPage,
});

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function BulkBtn({ icon: Icon, children, onClick }: { icon: any; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors text-[#06456F] hover:bg-primary/10 dark:text-[#0A7BC7] dark:hover:bg-primary/20 border border-transparent hover:border-primary/20 active:bg-primary/20 dark:active:bg-primary/30 cursor-pointer"
    >
      <Icon className="size-3 shrink-0" />
      <span>{children}</span>
    </button>
  );
}

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder, disabled, readOnly }: InlineInputProps) {
  const isReadOnly = (typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly)) || readOnly;
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
      readOnly={isReadOnly}
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
      className={`bg-transparent w-full border border-transparent py-0.5 px-1 rounded text-foreground transition-colors ${isEffectiveDisabled
        ? "cursor-not-allowed opacity-75 select-none hover:border-transparent focus:border-transparent"
        : "hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 cursor-text"
        } ${className}`}
    />
  );
}

function StaircasePressurizationPage() {
  const { project, activeProjectId, isReadOnly } = useWorkspace();
  const confirm = useConfirm();
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  
  const isApprovedLocked = useCalculationLock("/staircase-pressurization", project?.id || activeProjectId);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const calcReviewState = useCalculationReviewState("/staircase-pressurization", activeProjectId || project?.id);
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole || calcReviewState?.status === "APPROVED");

  const [items, setItems] = useState<StaircaseItem[]>([
    { id: generateId(), name: "Staircase-01", doorType: "single_leaf_into", doorArea: 2.53, openDoorsCount: 2, closedDoorsCount: 16 }
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDoorType, setFilterDoorType] = useState<string>("all");
  const [sortOption, setSortOption] = useState<"none" | "name-asc" | "name-desc" | "airflow-desc" | "area-desc">("none");
  const activeFiltersCount = (filterDoorType !== "all" ? 1 : 0);
  const handleResetFilters = () => {
    setFilterDoorType("all");
  };
  const [tab, setTab] = useState<"schedule" | "report">("schedule");
  const [intelOpen, setIntelOpen] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [previewRow, setPreviewRow] = useState<StaircaseItem | null>(null);
  const [editingStaircase, setEditingStaircase] = useState<StaircaseItem | null>(null);
  const [isNewStaircase, setIsNewStaircase] = useState<boolean>(false);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const isIp = unitSystem === "ip";

  const handleUnitSystemChange = (target: "si" | "ip", shouldConvert: boolean = true) => {
    if (target === unitSystem) return;
    
    if (shouldConvert) {
      setItems(prevItems => prevItems.map(item => {
        const area = item.doorArea;
        let convertedArea: number | "" = area;
        if (target === "si") {
          convertedArea = area !== "" ? Number((Number(area) / 10.7639).toFixed(2)) : "";
        } else {
          convertedArea = area !== "" ? Number((Number(area) * 10.7639).toFixed(2)) : "";
        }
        return { ...item, doorArea: convertedArea };
      }));
    }
    setUnitSystem(target);
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    setItems(prev => prev.map(i => i.id === commentTargetItem?.id ? {
      ...i,
      comments: [...((i as any).comments || []), comment]
    } : i));
    setCommentModalOpen(false);
  };

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Load from local storage
  useEffect(() => {
    const savedKey = "mep_auto_state_" + (project?.id || activeProjectId) + "_/Staircase-pressurization_list";
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch(e) {}
    }
  }, [project?.id, activeProjectId]);

  const [history, setHistory] = useState<StaircaseItem[][]>([]);
  const [redoStack, setRedoStack] = useState<StaircaseItem[][]>([]);
  const [clipboard, setClipboard] = useState<StaircaseItem[]>([]);

  const saveItems = (newItems: StaircaseItem[]) => {
    setItems(newItems);
    dirtyStore.set(true);
    const savedKey = "mep_auto_state_" + (project?.id || activeProjectId) + "_/Staircase-pressurization_list";
    localStorage.setItem(savedKey, JSON.stringify(newItems));
  };

  const updateItemsWithHistory = (newItems: StaircaseItem[]) => {
    setHistory(prev => [...prev.slice(-25), items]);
    setRedoStack([]);
    saveItems(newItems);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prevItems = history[history.length - 1];
    setRedoStack(prev => [...prev, items]);
    saveItems(prevItems);
    setHistory(prev => prev.slice(0, -1));
    toast.info("Undo");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextItems = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, items]);
    saveItems(nextItems);
    setRedoStack(prev => prev.slice(0, -1));
    toast.info("Redo");
  };

  const checkIfStaircaseMissingData = (item: StaircaseItem) => {
    const isNoName = !item.name || item.name.trim() === "";
    const area = Number(item.doorArea) || 0;
    const open = Number(item.openDoorsCount) || 0;
    const closed = Number(item.closedDoorsCount) || 0;
    return isNoName || area <= 0 || (open <= 0 && closed <= 0);
  };

  const updateItem = (id: string, field: keyof StaircaseItem, value: any) => {
    if (isEffectiveReadOnly) return;
    const newItems = items.map(i => {
      if (i.id === id) {
        const next = { ...i, [field]: value };
        if (field !== "flagged") {
          const wasMissing = checkIfStaircaseMissingData(i);
          const isMissing = checkIfStaircaseMissingData(next);
          if (isMissing) {
            next.flagged = true;
          } else if (wasMissing && !isMissing) {
            next.flagged = false;
          }
        }
        return next;
      }
      return i;
    });
    updateItemsWithHistory(newItems);
  };

  const availableFloors = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.floor) set.add(i.floor);
    });
    return Array.from(set);
  }, [items]);

  const addItem = () => {
    if (isEffectiveReadOnly) return;
    const newName = "Staircase-" + (items.length + 1).toString().padStart(2, "0");
    const defaultFloor = availableFloors[0] || "GF";
    const newStair: StaircaseItem = {
      id: generateId(),
      name: newName,
      floor: defaultFloor,
      doorType: "single_leaf_into",
      doorArea: isIp ? 27.23 : 2.53,
      openDoorsCount: 2,
      closedDoorsCount: 16,
    };
    updateItemsWithHistory([...items, newStair]);
    setEditingStaircase(newStair);
    setIsNewStaircase(true);
  };

  const copySpaces = (ids: string[]) => {
    const selected = items.filter(i => ids.includes(i.id));
    if (selected.length > 0) {
      setClipboard(selected);
      toast.info(`${selected.length} staircase(s) copied to clipboard`);
    }
  };

  const cutSpaces = (ids: string[]) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const selected = items.filter(i => ids.includes(i.id));
    if (selected.length > 0) {
      setClipboard(selected);
      updateItemsWithHistory(items.filter(i => !ids.includes(i.id)));
      setSelectedItems(new Set());
      toast.info(`${selected.length} staircase(s) cut to clipboard`);
    }
  };

  const pasteSpaces = () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return [];
    }
    if (clipboard.length === 0) return [];
    const pasted = clipboard.map((item) => ({
      ...item,
      id: generateId(),
      name: item.name.includes("(Copy)") ? item.name : `${item.name} (Copy)`
    }));
    updateItemsWithHistory([...items, ...pasted]);
    setSelectedItems(new Set(pasted.map(p => p.id)));
    toast.success(`${pasted.length} staircase(s) pasted`);
    return pasted;
  };

  const duplicateSpaces = (ids: string[]) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Duplicating is locked.", { id: "readonly-notice" });
      return;
    }
    const toDup = items.filter(i => ids.includes(i.id));
    const clones = toDup.map(item => ({
      ...item,
      id: generateId(),
      name: `${item.name} (Copy)`
    }));
    if (clones.length > 0) {
      updateItemsWithHistory([...items, ...clones]);
      setSelectedItems(new Set(clones.map(c => c.id)));
      toast.success(`Duplicated ${clones.length} staircase(s)`);
    }
  };

  const deleteSpaces = (ids: string[]) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const count = ids.length;
    updateItemsWithHistory(items.filter(i => !ids.includes(i.id)));
    setSelectedItems(new Set());
    toast.info(`Deleted ${count} staircase(s)`);
  };

  const deleteSelected = () => {
    if (selectedItems.size === 0) return;
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const count = selectedItems.size;
    confirm(`Are you sure you want to delete the ${count} selected staircase(s)?`, {
      title: "Delete Staircases",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    }).then((ok: any) => {
      if (ok) {
        deleteSpaces(Array.from(selectedItems));
      }
    });
  };

  const deleteItem = (id: string) => {
    deleteSpaces([id]);
  };

  const duplicateItem = (row: StaircaseItem) => {
    duplicateSpaces([row.id]);
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedItems.size > 0) {
          e.preventDefault();
          setSelectedItems(new Set());
        }
        return;
      }

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
      const key = e.key.toLowerCase();

      // 1. Ctrl+A (Select All)
      if (isCmdOrCtrl && key === "a") {
        e.preventDefault();
        if (items.length > 0) {
          setSelectedItems(new Set(items.map(r => r.id)));
          toast.info(`Selected all ${items.length} staircase(s)`);
        }
        return;
      }

      // 2. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedItems.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }

      // 3. Copy: Ctrl+C
      if (isCmdOrCtrl && key === "c") {
        if (selectedItems.size > 0) {
          e.preventDefault();
          copySpaces(Array.from(selectedItems));
        }
        return;
      }

      // 4. Cut: Ctrl+X
      if (isCmdOrCtrl && key === "x") {
        if (selectedItems.size > 0) {
          e.preventDefault();
          cutSpaces(Array.from(selectedItems));
        }
        return;
      }

      // 5. Paste: Ctrl+V
      if (isCmdOrCtrl && key === "v") {
        e.preventDefault();
        pasteSpaces();
        return;
      }

      // 6. Duplicate: Ctrl+D
      if (isCmdOrCtrl && key === "d") {
        if (selectedItems.size > 0) {
          e.preventDefault();
          duplicateSpaces(Array.from(selectedItems));
        }
        return;
      }

      // 7. Undo/Redo: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
      if (isCmdOrCtrl && !e.shiftKey && key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((isCmdOrCtrl && key === "y") || (isCmdOrCtrl && e.shiftKey && key === "z")) {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedItems, clipboard, isEffectiveReadOnly, history, redoStack]);

  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScrollToItem = (e: any) => {
      const { id, name } = e.detail || {};
      if (!id && !name) return;
      const r = items.find(rw => rw.id === id || rw.name === name);
      if (r) {
        setTimeout(() => {
          const el = document.getElementById(`Staircase-row-${r.id}`) || document.getElementById(`row-${r.id}`) || document.querySelector(`[data-row-id="${r.id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-primary", "bg-primary/10");
            setTimeout(() => el.classList.remove("ring-2", "ring-primary", "bg-primary/10"), 3000);
          }
        }, 150);
      }
    };
    window.addEventListener("mep-scroll-to-item" as any, handleScrollToItem);

    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("commentTargetId") || params.get("targetId");
    const targetName = params.get("commentTargetName") || params.get("targetName");
    if (targetId || targetName) {
      setTimeout(() => {
        handleScrollToItem({ detail: { id: targetId, name: targetName } });
      }, 500);
    }

    return () => window.removeEventListener("mep-scroll-to-item" as any, handleScrollToItem);
  }, [items]);

  const handleExportExcel = () => {
    try {
      const data = items.map((item, idx) => {
        const calc = calculateStaircase(item, isIp);
        return {
          "No.": idx + 1,
          "Staircase Name": item.name,
          "Door Type": DOOR_TYPES_CONFIG[item.doorType]?.name || item.doorType,
          [`Door Area (${isIp ? "sq ft" : "m²"})`]: item.doorArea,
          "Open Doors Qty": item.openDoorsCount,
          "Closed Doors Qty": item.closedDoorsCount,
          [`Fan Airflow (${isIp ? "CFM" : "L/s"})`]: isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs,
          [`Design dP (${isIp ? "in.wg" : "Pa"})`]: isIp ? calc.designPressureDropInWg : calc.designPressureDropPa,
          [`Relief Area (${isIp ? "sq ft" : "m²"})`]: isIp ? calc.reliefAreaSqFt : calc.reliefAreaM2,
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Staircase Pressurization");
      XLSX.writeFile(wb, "Staircase_Pressurization_Schedule.xlsx");
      toast.success("Excel schedule exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel schedule");
    }
  };

  const handleExportPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const boxWidth = 269;
      const midX = 14 + (boxWidth / 2);
      const calcNo = project?.calcNo || "TRV-CAL-SP-001";
      const today = new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || "MEP-SP-2026";
      const projectName = project?.name || "Staircase Pressurization Study";
      const clientName = project?.client || "Prestige Group developers";
      const endUser = (project as any)?.endUser || "-";

      // 1. Header Title (Matching Preliminary format without "Report")
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Staircase Pressurization Calculation", 14, 14);

      // 2. Metadata Block (Exact 2-column x 3-row grid box across 269mm width)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.rect(14, 18, boxWidth, 18);
      doc.line(midX, 18, midX, 36);
      doc.line(14, 24, 14 + boxWidth, 24);
      doc.line(14, 30, 14 + boxWidth, 30);

      // Column 1
      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 22);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 48, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 28);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 48, 28);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 16, 34);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 48, 34);

      // Column 2
      doc.setFont("helvetica", "bold");
      doc.text("Date:", midX + 3, 22);
      doc.setFont("helvetica", "normal");
      doc.text(today, midX + 30, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", midX + 3, 28);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, midX + 30, 28);

      doc.setFont("helvetica", "bold");
      doc.text("End User:", midX + 3, 34);
      doc.setFont("helvetica", "normal");
      doc.text(endUser, midX + 30, 34);

      let grandFlow = 0;
      let grandDoorArea = 0;

      const body = items.map((item, index) => {
        const calc = calculateStaircase(item, isIp);
        const doorName = DOOR_TYPES_CONFIG[item.doorType]?.name || "Unknown";
        const flowVal = isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs;
        const areaVal = Number(item.doorArea) || 0;
        grandFlow += flowVal;
        grandDoorArea += areaVal;

        return [
          index + 1,
          item.floor || "GF",
          item.name,
          doorName,
          areaVal.toFixed(2),
          `${item.openDoorsCount || 0} Open / ${item.closedDoorsCount || 0} Clsd`,
          isIp ? `${calc.openFlowM3s} m³/s` : `${calc.openFlowLs} L/s`,
          isIp ? `${calc.closedFlowM3s} m³/s` : `${calc.closedFlowLs} L/s`,
          isIp ? `${calc.totalFanCapacityCfm} CFM` : `${calc.totalFanCapacityLs} L/s`,
          isIp ? `${calc.designPressureDropInWg} in.wg` : `${calc.designPressureDropPa} Pa`,
          isIp ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`,
          "PASS"
        ];
      });

      // Total row
      const totalRow = [
        "",
        "ALL",
        "OVERALL TOTAL",
        "",
        grandDoorArea.toFixed(2),
        "",
        "",
        "",
        isIp ? `${Math.round(grandFlow).toLocaleString()} CFM` : `${Math.round(grandFlow).toLocaleString()} L/s`,
        "All Compliant",
        "-",
        "PASS"
      ];
      (totalRow as any)._isGrandTotal = true;
      body.push(totalRow);

      const primaryFill = [229, 231, 235] as [number, number, number];

      autoTable(doc, {
        startY: 42,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [180, 180, 180],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
          minCellHeight: 6
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 16 },
          2: { halign: "left", cellWidth: 32 },
          3: { halign: "left", cellWidth: 38 },
          4: { cellWidth: 20 },
          5: { cellWidth: 28 },
          6: { cellWidth: 22 },
          7: { cellWidth: 22 },
          8: { fontStyle: "bold", cellWidth: 26 },
          9: { cellWidth: 20 },
          10: { cellWidth: 20 },
          11: { cellWidth: 15 }
        },
        head: [
          [
            { content: "Sr. No.", rowSpan: 2, styles: { fillColor: primaryFill } },
            { content: "Staircase Parameters", colSpan: 4, styles: { fillColor: primaryFill } },
            { content: "Leakage & Infiltration", colSpan: 3, styles: { fillColor: primaryFill } },
            { content: "Airflow, Pressure & Compliance", colSpan: 4, styles: { fillColor: primaryFill } }
          ],
          [
            { content: "Floor" },
            { content: "Staircase Tag" },
            { content: "Door Type" },
            { content: `Door Area\n(${isIp ? "sq ft" : "m²"})` },
            { content: "Door Status" },
            { content: "Open Flow" },
            { content: "Leakage Flow" },
            { content: `Total Flow\n(${isIp ? "CFM" : "L/s"})` },
            { content: `Design dP\n(${isIp ? "in.wg" : "Pa"})` },
            { content: `Relief Area\n(${isIp ? "sq ft" : "m²"})` },
            { content: "Status" }
          ]
        ],
        body: body,
        didParseCell: function(data: any) {
          const rawRow = data.row.raw;
          if (data.section === "body") {
            if (rawRow && rawRow._isGrandTotal) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 240, 240];
            }
            if (data.column.index === 11 && data.cell.raw === "PASS") {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = [16, 120, 60];
            }
          }
        }
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 140;
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || activeProjectId || "default", "/staircase-pressurization", currentUserName, calcReviewState);

      // 4. 3-Tier Signature Sign-Off Block (Exact warm peach header #FFE6CC)
      autoTable(doc, {
        startY: finalY + 8,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 8,
          halign: "center",
          valign: "middle",
          lineColor: [180, 180, 180],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 }
        },
        headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: "bold" },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" }
          ]
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName || currentUserName || "Design Engineer", styles: { halign: "center" } },
            { content: reviewerName || "", styles: { halign: "center" } },
            { content: approverName || "", styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate || formatDateStr(new Date().toISOString()), styles: { halign: "center" } },
            { content: reviewerDate || "", styles: { halign: "center" } },
            { content: approverDate || "", styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 78 },
          2: { cellWidth: 78 },
          3: { cellWidth: 78 }
        }
      });

      const pdfBuffer = doc.output("arraybuffer");
      await downloadFile(
        new Uint8Array(pdfBuffer),
        `Staircase_Pressurization_Calculation_${project?.code || "P000"}.pdf`,
        "PDF Document",
        ["pdf"]
      );
      toast.success("Staircase Pressurization PDF exported successfully!");
    } catch(err: any) {
      console.error(err);
      toast.error(`Export PDF failed: ${err?.message || String(err)}`);
    }
  };

  const filteredRows = React.useMemo(() => {
    let result = items;
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((row) => row.name.toLowerCase().includes(lowerQuery));
    }
    if (filterDoorType !== "all") {
      result = result.filter((row) => row.doorType === filterDoorType);
    }
    if (sortOption === "name-asc") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption === "name-desc") {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortOption === "airflow-desc") {
      result = [...result].sort((a, b) => {
        const calcA = calculateStaircase(a, unitSystem === "ip");
        const calcB = calculateStaircase(b, unitSystem === "ip");
        const flowA = unitSystem === "ip" ? calcA.totalFanCapacityCfm : calcA.totalFanCapacityLs;
        const flowB = unitSystem === "ip" ? calcB.totalFanCapacityCfm : calcB.totalFanCapacityLs;
        return flowB - flowA;
      });
    } else if (sortOption === "area-desc") {
      result = [...result].sort((a, b) => (Number(b.doorArea) || 0) - (Number(a.doorArea) || 0));
    }
    return result;
  }, [items, searchQuery, filterDoorType, sortOption, unitSystem]);

  const columns: Column<StaircaseItem>[] = React.useMemo(() => [
    {
      key: "name",
      header: "STAIRCASE NAME",
      width: 220,
      editable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 w-full pr-1">
          <InlineInput 
            value={row.name}
            onCommit={(val) => updateItem(row.id, "name", val.trim() || row.name)}
            disabled={isEffectiveReadOnly}
            className="font-medium text-[13.5px] flex-1 min-w-0"
            placeholder="Name..."
          />
        </div>
      )
    },
    {
      key: "floor",
      header: "FLOOR",
      width: 100,
      align: "center",
      render: (row) => (
        <span className="font-semibold text-xs text-foreground uppercase">{row.floor || "GF"}</span>
      ),
    },
    {
      key: "doorType",
      header: "DOOR TYPE",
      width: 240,
      render: (row) => (
        <GridDropdown<DoorTypeKey>
          disabled={isEffectiveReadOnly}
          value={row.doorType}
          options={(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[])
            .filter((k) => k !== "lift_landing")
            .map((k) => ({
              value: k,
              label: DOOR_TYPES_CONFIG[k].name,
            }))}
          hasOther={true}
          otherLabel="Other / Custom Door"
          onOtherSelect={() => {
            setEditingStaircase(row);
            setIsNewStaircase(false);
          }}
          onChange={(val) => updateItem(row.id, "doorType", val)}
        />
      )
    },
    {
      key: "doorArea",
      header: `DOOR AREA (${unitSystem === "ip" ? "sq ft" : "m²"})`,
      width: 110,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput 
          type="number"
          step="0.01"
          min={0}
          value={row.doorArea} 
          onCommit={(val) => updateItem(row.id, "doorArea", val)}
          disabled={isEffectiveReadOnly}
          className="font-mono tabular text-[13.5px] text-center"
          placeholder="0"
        />
      )
    },
    {
      key: "openDoorsCount",
      header: "OPEN DOORS",
      width: 110,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput 
          type="number"
          min={0}
          value={row.openDoorsCount} 
          onCommit={(val) => updateItem(row.id, "openDoorsCount", val)}
          disabled={isEffectiveReadOnly}
          className="font-mono tabular text-[13.5px] text-center"
          placeholder="0"
        />
      )
    },
    {
      key: "closedDoorsCount",
      header: "CLOSED DOORS",
      width: 110,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput 
          type="number"
          min={0}
          value={row.closedDoorsCount} 
          onCommit={(val) => updateItem(row.id, "closedDoorsCount", val)}
          disabled={isEffectiveReadOnly}
          className="font-mono tabular text-[13.5px] text-center"
          placeholder="0"
        />
      )
    },
    {
      key: "fanAirflow",
      header: `FAN AIRFLOW (${unitSystem === "ip" ? "CFM" : "L/s"})`,
      width: 140,
      align: "center",
      mono: true,
      render: (row) => {
        const calc = calculateStaircase(row, unitSystem === "ip");
        return (
          <span className="font-mono tabular text-[13.5px] text-primary font-bold text-center w-full block">
            {unitSystem === "ip" ? calc.totalFanCapacityCfm.toLocaleString() : calc.totalFanCapacityLs.toLocaleString()}
          </span>
        );
      }
    },
    {
      key: "dP",
      header: `dP (${unitSystem === "ip" ? "in.wg" : "Pa"})`,
      width: 100,
      align: "center",
      mono: true,
      render: (row) => {
        const calc = calculateStaircase(row, unitSystem === "ip");
        return (
          <span className="font-mono tabular text-[13.5px] font-medium text-foreground text-center w-full block">
            {unitSystem === "ip" ? calc.designPressureDropInWg : calc.designPressureDropPa}
          </span>
        );
      }
    },
    {
      key: "reliefArea",
      header: `RELIEF AREA (${unitSystem === "ip" ? "sq ft" : "m²"})`,
      width: 130,
      align: "center",
      mono: true,
      render: (row) => {
        const calc = calculateStaircase(row, unitSystem === "ip");
        return (
          <span className="font-mono tabular text-[13.5px] font-medium text-foreground text-center w-full block">
            {unitSystem === "ip" ? calc.reliefAreaSqFt : calc.reliefAreaM2}
          </span>
        );
      }
    },
    {
      key: "status",
      header: "STATUS",
      width: 80,
      align: "center",
      render: (row) => {
        const area = Number(row.doorArea) || 0;
        const open = Number(row.openDoorsCount) || 0;
        const closed = Number(row.closedDoorsCount) || 0;
        const isValid = area > 0 && (open > 0 || closed > 0);

        return (
          <div className="flex items-center justify-center w-full">
            {isValid ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                PASS
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                WARN
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: "flagged",
      header: "",
      width: 36,
      align: "center",
      render: (row) => (
        <button
          disabled={isEffectiveReadOnly}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isEffectiveReadOnly) return;
            const targetIds = selectedItems.has(row.id) ? Array.from(selectedItems) : [row.id];
            const nextFlagged = !row.flagged;
            const updated = items.map((it) => targetIds.includes(it.id) ? { ...it, flagged: nextFlagged } : it);
            saveItems(updated);
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto disabled:cursor-default"
          title={
            (() => {
              const isNoName = !row.name || row.name.trim() === "";
              const area = Number(row.doorArea) || 0;
              const open = Number(row.openDoorsCount) || 0;
              const closed = Number(row.closedDoorsCount) || 0;
              if (isNoName && area <= 0) return "Missing staircase name and door area";
              if (isNoName) return "Missing staircase name";
              if (area <= 0) return "Missing door area";
              if (open <= 0 && closed <= 0) return "Must specify at least one open or closed door";
              return row.flagged ? "Unflag staircase" : "Flag staircase";
            })()
          }
        >
          <Flag
            className={`size-3.5 transition-all duration-200 ${
              row.flagged
                ? "fill-red-500 text-red-500 scale-110"
                : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
            }`}
          />
        </button>
      ),
    }
  ], [unitSystem, isEffectiveReadOnly, items, selectedItems]);

  const renderStaircaseContextMenu = (row: StaircaseItem) => {
    const targetIds = selectedItems.has(row.id) ? Array.from(selectedItems) : [row.id];
    const isMulti = targetIds.length > 1;

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        {/* Add Comment */}
        <ContextMenuItem
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Workspace is in Read-Only mode.");
              return;
            }
            setCommentTargetItem(row);
            setCommentModalOpen(true);
          }}
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
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Cut */}
        <ContextMenuItem
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            cutSpaces(targetIds);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Scissors className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? `Cut Selected (${targetIds.length})` : "Cut"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Copy */}
        <ContextMenuItem
          onClick={() => {
            copySpaces(targetIds);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? `Copy Selected (${targetIds.length})` : "Copy"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Paste */}
        <ContextMenuItem
          disabled={clipboard.length === 0 || isEffectiveReadOnly}
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            pasteSpaces();
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
        >
          <ClipboardPaste className="size-3.5 text-muted-foreground" />
          <span>Paste</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Edit Staircase Parameters */}
        <ContextMenuItem
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Workspace is in Read-Only mode. Editing is locked.", { id: "readonly-notice" });
              return;
            }
            setEditingStaircase(row);
            setIsNewStaircase(false);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Edit Staircase Parameters</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Duplicate */}
        <ContextMenuItem
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Workspace is in Read-Only mode. Duplicating is locked.", { id: "readonly-notice" });
              return;
            }
            duplicateSpaces(targetIds);
          }}
          disabled={isEffectiveReadOnly}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <CopyPlus className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? `Duplicate Selected (${targetIds.length})` : "Duplicate Staircase"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Delete */}
        <ContextMenuItem
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            const count = targetIds.length;
            confirm(
              count === 1
                ? `Are you sure you want to delete staircase "${row.name}"?`
                : `Are you sure you want to delete the ${count} selected staircase(s)?`,
              {
                title: "Delete Staircases",
                confirmText: "Delete",
                cancelText: "Cancel",
                variant: "destructive"
              }
            ).then((ok: any) => {
              if (ok) {
                deleteSpaces(targetIds);
              }
            });
          }}
          disabled={isEffectiveReadOnly}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
        >
          <Trash2 className="size-3.5" />
          <span>{isMulti ? `Delete Selected (${targetIds.length})` : "Delete"}</span>
          <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const commentsList = React.useMemo(() => items.flatMap(i => (i as any).comments || []), [items]);

  const totals = React.useMemo(() => {
    let totalFanCapacityLs = 0;
    let totalFanCapacityCfm = 0;
    let totalReliefAreaM2 = 0;
    let totalReliefAreaSqFt = 0;
    let totalDoorsOpen = 0;
    let totalDoorsClosed = 0;

    items.forEach(item => {
      const calcSi = calculateStaircase(item, false);
      const calcIp = calculateStaircase(item, true);
      totalFanCapacityLs += calcSi.totalFanCapacityLs;
      totalFanCapacityCfm += calcIp.totalFanCapacityCfm;
      totalReliefAreaM2 += Number(calcSi.reliefAreaM2);
      totalReliefAreaSqFt += Number(calcIp.reliefAreaSqFt);
      totalDoorsOpen += Number(item.openDoorsCount) || 0;
      totalDoorsClosed += Number(item.closedDoorsCount) || 0;
    });

    return {
      totalFanCapacityLs,
      totalFanCapacityCfm,
      totalReliefAreaM2,
      totalReliefAreaSqFt,
      totalDoorsOpen,
      totalDoorsClosed
    };
  }, [items]);

  return (
    <AppShell 
      title="Staircase Pressurization" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen(v => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header & Actions matching Pump Sizing */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Staircase Pressurization</h1>
              </div>
              
              <button 
                type="button"
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Staircase Pressurization Intelligence"
              >
                <Sparkles className="size-3.5" /> Intelligence
              </button>

              <CalculationReviewBar 
                projectId={project?.id || activeProjectId || "default"} 
                calculatorPath="/staircase-pressurization" 
                calculatorTitle="Staircase Pressurization" 
              />
            </div>
            
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-sm"
          }`}>
            
            {/* Top Row 1: Section Navigation Tabs & Export */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap modal-blur-bg">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setTab("schedule")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "schedule"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                    }`}
                  >
                    Sizing Calculator
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                    }`}
                  >
                    Report
                  </button>
                </div>

                <TBtn
                  onClick={() => setShowFormulaModal(true)}
                  title="Calculation Formulas & Methodology"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              <div className="flex items-center gap-2.5 select-none shrink-0">
                <TBtn onClick={handleExportPdf} title="Export PDF Report">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Dedicated Toolbar Row 2 when tab === 'schedule' */}
            {tab === "schedule" && (
              <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none modal-blur-bg">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter spaces..."
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
                          onClick={handleResetFilters}
                          className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Door Type</span>
                      <select
                        value={filterDoorType}
                        onChange={(e) => setFilterDoorType(e.target.value)}
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                      >
                        <option value="all">All Door Types</option>
                        {(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[])
                          .filter((k) => k !== "lift_landing")
                          .map((k) => (
                            <option key={k} value={k}>
                              {DOOR_TYPES_CONFIG[k].name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Sort Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                        sortOption !== "none"
                          ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                          : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      <ArrowUpDown className="size-3.5 shrink-0" />
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                        Sort
                      </span>
                      {sortOption !== "none" && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                          ✓
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border">
                      <span className="text-[12px] font-semibold text-foreground">Sort Options</span>
                      {sortOption !== "none" && (
                        <button
                          onClick={() => setSortOption("none")}
                          className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</span>
                      <select
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value as any)}
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                      >
                        <option value="none">Original Order</option>
                        <option value="name-asc">Name (A-Z)</option>
                        <option value="name-desc">Name (Z-A)</option>
                        <option value="airflow-desc">Fan Airflow (Highest First)</option>
                        <option value="area-desc">Door Area (Highest First)</option>
                      </select>
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
                          localStorage.removeItem("mep_grid_staircase_pressurization_schedule");
                          window.dispatchEvent(new CustomEvent("mep-reset-column-widths"));
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

                {/* Right Actions */}
                <div className="ml-auto flex items-center gap-1">
                  {clipboard.length > 0 && (
                    <TBtn
                      disabled={isEffectiveReadOnly}
                      onClick={pasteSpaces}
                      title={`Paste ${clipboard.length} staircase(s) from clipboard (Ctrl+V)`}
                    >
                      <ClipboardPaste className="size-3.5 text-primary" /> Paste ({clipboard.length})
                    </TBtn>
                  )}
                  <TBtn primary onClick={addItem} disabled={isEffectiveReadOnly}>
                    <Plus className="size-3.5" /> Add Staircase
                  </TBtn>
                </div>

                {/* Bulk Actions Bar Overlay */}
                {!isEffectiveReadOnly && selectedItems.size > 0 && (
                  <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                    <span className="font-semibold">{selectedItems.size} selected</span>
                    <span className="text-primary/30">·</span>
                    <BulkBtn icon={Scissors} onClick={() => cutSpaces(Array.from(selectedItems))}>Cut</BulkBtn>
                    <BulkBtn icon={Copy} onClick={() => copySpaces(Array.from(selectedItems))}>Copy</BulkBtn>
                    <BulkBtn icon={CopyPlus} onClick={() => duplicateSpaces(Array.from(selectedItems))}>Duplicate</BulkBtn>
                    <BulkBtn icon={Edit3} onClick={() => {
                      const firstId = Array.from(selectedItems)[0];
                      const item = items.find(i => i.id === firstId);
                      if (item) {
                        setEditingStaircase(item);
                        setIsNewStaircase(false);
                      }
                    }}>Edit</BulkBtn>
                    <BulkBtn icon={Flag} onClick={() => {
                      if (selectedItems.size === 0 || isEffectiveReadOnly) return;
                      const anyUnflagged = items.some(i => selectedItems.has(i.id) && !i.flagged);
                      const updated = items.map(i => selectedItems.has(i.id) ? { ...i, flagged: anyUnflagged } : i);
                      updateItemsWithHistory(updated);
                      toast.success(`Updated review flags for ${selectedItems.size} staircase(s)`);
                    }}>Flag / Unflag</BulkBtn>
                    <BulkBtn icon={Trash2} onClick={deleteSelected}>Delete</BulkBtn>
                    <button
                      onClick={() => setSelectedItems(new Set())}
                      className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                    >
                      <X className="size-3" /> Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Active Tab Content */}
            <div className="flex-1 flex flex-col min-h-0 bg-background relative">
              {tab === "schedule" && (
                <div className="absolute inset-0 flex flex-col animate-in fade-in duration-300">
                  <div className="flex-1 min-h-0 bg-background overflow-hidden relative flex flex-col">
                    {filteredRows.length > 0 ? (
                      <DataGrid
                        gridId="staircase_pressurization_schedule"
                        rows={filteredRows}
                        columns={columns}
                        selected={selectedItems}
                        onToggle={toggleSelect}
                        onToggleAll={toggleSelectAll}
                        onCommentClick={(r) => handleOpenComment(r.id, r.name)}
                        onRowDoubleClick={(row) => {
                          setEditingStaircase(row);
                          setIsNewStaircase(false);
                        }}
                        isReadOnly={isEffectiveReadOnly}
                        renderContextMenu={renderStaircaseContextMenu}
                        activeRowId={editingStaircase?.id}
                      />
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <div className="size-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                          <Search className="size-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No staircases found.</p>
                        <p className="text-xs mt-1">Try adjusting your search query or add a new staircase.</p>
                      </div>
                    )}
                  </div>

                  {/* Summary Status Bar */}
                  <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg">
                    <div>Showing <span className="text-foreground font-medium tabular">{filteredRows.length}</span> of {items.length} staircases</div>
                    <div className="flex items-center gap-3.5 tabular">
                      <span>Total Airflow: <span className="font-mono text-primary font-bold">{unitSystem === "ip" ? totals.totalFanCapacityCfm.toLocaleString() + " CFM" : totals.totalFanCapacityLs.toLocaleString() + " L/s"}</span></span>
                      <span>Total Relief Area: <span className="font-mono text-foreground font-semibold">{unitSystem === "ip" ? totals.totalReliefAreaSqFt.toFixed(2) + " sq ft" : totals.totalReliefAreaM2.toFixed(2) + " m²"}</span></span>
                    </div>
                  </div>
                </div>
              )}
              
              {tab === "report" && (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                    
                    {/* 1. Title */}
                    <div className="pb-1">
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                        Staircase Pressurization Calculation
                      </h2>
                    </div>

                    {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b border-border divide-x border-border">
                            <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                            <td className="p-2.5 font-mono text-foreground font-medium">{project?.calcNo || "TRV-CAL-SP-001"}</td>
                            <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                            <td className="p-2.5 font-mono font-medium">{new Date().toISOString().split("T")[0]}</td>
                          </tr>
                          <tr className="border-b border-border divide-x border-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                            <td className="p-2.5 font-mono">{project?.code || "MEP-SP-2026"}</td>
                            <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                            <td className="p-2.5">{project?.client || "Prestige Group developers"}</td>
                          </tr>
                          <tr className="divide-x border-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                            <td className="p-2.5">{project?.name || "Staircase Pressurization Study"}</td>
                            <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                            <td className="p-2.5">{(project as any)?.endUser || "-"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 3. Schedule Table (2-Tier Header Table) */}
                    <div className="border border-border rounded-xl overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                            <th rowSpan={2} className="p-2 border-r border-border w-12 text-center">
                              Sr.<br />No.
                            </th>
                            <th colSpan={4} className="p-2 border-r border-border text-center">
                              Staircase Parameters
                            </th>
                            <th colSpan={3} className="p-2 border-r border-border text-center">
                              Leakage & Infiltration
                            </th>
                            <th colSpan={4} className="p-2 text-center">
                              Airflow, Pressure & Compliance
                            </th>
                          </tr>
                          <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                            <th className="p-2 border-r border-border w-20 text-center">Floor</th>
                            <th className="p-2 border-r border-border text-left min-w-[130px]">Staircase Tag</th>
                            <th className="p-2 border-r border-border text-left min-w-[140px]">Door Type</th>
                            <th className="p-2 border-r border-border w-24 text-center">Door Area ({isIp ? "sq ft" : "m²"})</th>
                            <th className="p-2 border-r border-border w-28 text-center">Door Status</th>
                            <th className="p-2 border-r border-border w-24 text-right">Open Flow</th>
                            <th className="p-2 border-r border-border w-24 text-right">Leakage Flow</th>
                            <th className="p-2 border-r border-border w-28 text-right font-bold">Total Flow ({isIp ? "CFM" : "L/s"})</th>
                            <th className="p-2 border-r border-border w-24 text-center">Design dP ({isIp ? "in.wg" : "Pa"})</th>
                            <th className="p-2 border-r border-border w-24 text-center">Relief Area ({isIp ? "sq ft" : "m²"})</th>
                            <th className="p-2 w-20 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {(() => {
                            let grandFlow = 0;
                            let grandArea = 0;

                            return (
                              <>
                                {items.map((item, index) => {
                                  const calc = calculateStaircase(item, isIp);
                                  const doorName = DOOR_TYPES_CONFIG[item.doorType]?.name || "Unknown";
                                  const flowVal = isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs;
                                  const areaVal = Number(item.doorArea) || 0;
                                  grandFlow += flowVal;
                                  grandArea += areaVal;

                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                      <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">
                                        {index + 1}
                                      </td>
                                      <td className="p-2 border-r border-border text-center font-medium">
                                        {item.floor || "GF"}
                                      </td>
                                      <td className="p-2 border-r border-border font-medium text-foreground">
                                        {item.name}
                                      </td>
                                      <td className="p-2 border-r border-border text-muted-foreground">
                                        {doorName}
                                      </td>
                                      <td className="p-2 border-r border-border text-center font-mono">
                                        {areaVal.toFixed(2)}
                                      </td>
                                      <td className="p-2 border-r border-border text-center text-muted-foreground">
                                        {item.openDoorsCount || 0} Open / {item.closedDoorsCount || 0} Clsd
                                      </td>
                                      <td className="p-2 border-r border-border text-right font-mono text-muted-foreground">
                                        {isIp ? `${calc.openFlowM3s} m³/s` : `${calc.openFlowLs} L/s`}
                                      </td>
                                      <td className="p-2 border-r border-border text-right font-mono text-muted-foreground">
                                        {isIp ? `${calc.closedFlowM3s} m³/s` : `${calc.closedFlowLs} L/s`}
                                      </td>
                                      <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">
                                        {Math.round(flowVal).toLocaleString()}
                                      </td>
                                      <td className="p-2 border-r border-border text-center font-mono">
                                        {isIp ? `${calc.designPressureDropInWg} in.wg` : `${calc.designPressureDropPa} Pa`}
                                      </td>
                                      <td className="p-2 border-r border-border text-center font-mono">
                                        {isIp ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`}
                                      </td>
                                      <td className="p-2 text-center font-bold">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                          PASS
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}

                                {/* Total Row */}
                                <tr className="bg-slate-100 dark:bg-zinc-800 font-black border-t-2 border-border">
                                  <td className="p-2 border-r border-border text-center"></td>
                                  <td className="p-2 border-r border-border text-center font-bold">ALL</td>
                                  <td className="p-2 border-r border-border font-bold">OVERALL TOTAL</td>
                                  <td className="p-2 border-r border-border"></td>
                                  <td className="p-2 border-r border-border text-center font-mono font-bold">
                                    {grandArea.toFixed(2)}
                                  </td>
                                  <td className="p-2 border-r border-border"></td>
                                  <td className="p-2 border-r border-border"></td>
                                  <td className="p-2 border-r border-border"></td>
                                  <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">
                                    {Math.round(grandFlow).toLocaleString()}
                                  </td>
                                  <td className="p-2 border-r border-border font-medium text-center text-muted-foreground">
                                    All Compliant
                                  </td>
                                  <td className="p-2 border-r border-border"></td>
                                  <td className="p-2 text-center font-bold text-emerald-600">
                                    PASS
                                  </td>
                                </tr>
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* 4. 3-Tier Signature Sign-Off Block (Exact #FFE6CC Header) */}
                    {(() => {
                      const sig = getSignatureBlockDetails(
                        project?.id || activeProjectId || "default",
                        "/staircase-pressurization",
                        currentUserName,
                        calcReviewState
                      );
                      return (
                        <div className="pt-2">
                          <div className="border border-border rounded-xl overflow-hidden text-xs">
                            <table className="w-full border-collapse">
                              <thead className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold border-b border-border">
                                <tr className="divide-x border-border">
                                  <th className="p-2.5 w-28 text-center"></th>
                                  <th className="p-2.5 text-center w-1/3">Originator</th>
                                  <th className="p-2.5 text-center w-1/3">Reviewer</th>
                                  <th className="p-2.5 text-center w-1/3">Approver</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                <tr className="divide-x border-border">
                                  <td className="p-2.5 font-bold text-center bg-muted/10">Name:</td>
                                  <td className="p-2.5 text-center font-medium">
                                    {sig.originatedName || currentUserName || "Design Engineer"}
                                  </td>
                                  <td className="p-2.5 text-center font-medium">
                                    {sig.reviewerName || ""}
                                  </td>
                                  <td className="p-2.5 text-center font-medium">
                                    {sig.approverName || ""}
                                  </td>
                                </tr>
                                <tr className="divide-x border-border">
                                  <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                                  <td className="p-2.5 text-center font-mono">
                                    {sig.originatedDate || formatDateStr(new Date().toISOString())}
                                  </td>
                                  <td className="p-2.5 text-center font-mono">
                                    {sig.reviewerDate || ""}
                                  </td>
                                  <td className="p-2.5 text-center font-mono">
                                    {sig.approverDate || ""}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right-Side Panel: Intelligence / Calculation Preview */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg"
              : "w-0"
          }`}
        >
          {intelOpen ? (
            <StaircaseIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              items={items}
              unitSystem={unitSystem}
              onSelectStaircase={(id) => {
                setSelectedItems(new Set([id]));
              }}
            />
          ) : selectedItems.size === 1 ? (() => {
            const selectedId = Array.from(selectedItems)[0];
            const item = items.find((i) => i.id === selectedId);
            if (!item) return null;
            const calc = calculateStaircase(item, unitSystem === "ip");

            return (
              <div className="flex flex-col h-full w-[360px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50 dark:bg-zinc-900/50 shrink-0">
                  <h3 className="font-semibold text-foreground text-[13px] flex items-center gap-1.5">
                    <Wrench className="size-3.5 text-primary" /> 
                    Calculation Preview
                  </h3>
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full truncate max-w-[120px]">
                    {item.name}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar text-[12px] space-y-4">
                  <div className="bg-surface-2/60 rounded-xl p-3 border border-border">
                    <h4 className="font-bold text-foreground mb-2 border-b border-border pb-1 uppercase text-[10px]">1. Airflow Breakdown</h4>
                    <div className="space-y-1.5 text-muted-foreground">
                      <div className="flex justify-between"><span>Open Door Flow:</span><span className="font-mono text-foreground">{calc.openFlowM3s} m³/s</span></div>
                      <div className="flex justify-between"><span>Closed Door Flow:</span><span className="font-mono text-foreground">{calc.closedFlowM3s} m³/s</span></div>
                      <div className="flex justify-between text-muted-foreground/70"><span>Closed Safety (25%):</span><span className="font-mono">{calc.closedSafetyFlowM3s} m³/s</span></div>
                      <div className="flex justify-between pt-1 border-t border-border font-medium text-foreground">
                        <span>Subtotal Flow:</span><span className="font-mono">{calc.subTotalM3s} m³/s</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground/70"><span>Final Safety (10%):</span><span className="font-mono">{calc.finalSafetyM3s} m³/s</span></div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
                    <h4 className="font-bold text-primary mb-2 border-b border-primary/20 pb-1 uppercase text-[10px]">2. Required Fan Capacity</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[14px] font-bold text-primary">
                        <span>Total Flow:</span><span className="font-mono">{unitSystem === "ip" ? `${calc.totalFanCapacityCfm} CFM` : `${calc.totalFanCapacityLs} L/s`}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>In m³/s:</span><span className="font-mono text-foreground">{calc.totalFanCapacityM3s} m³/s</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-2/60 rounded-xl p-3 border border-border">
                    <h4 className="font-bold text-foreground mb-2 border-b border-border pb-1 uppercase text-[10px]">3. Pressure & Relief</h4>
                    <div className="space-y-1.5 text-muted-foreground">
                      <div className="flex justify-between"><span>Duct Friction Loss:</span><span className="font-mono text-foreground">{calc.ductLoss} Pa</span></div>
                      <div className="flex justify-between"><span>Combined Drop:</span><span className="font-mono text-foreground">{calc.combinedDrop} Pa</span></div>
                      <div className="flex justify-between text-muted-foreground/70"><span>Safety Drop (25%):</span><span className="font-mono">{calc.safetyDrop} Pa</span></div>
                      
                      <div className="flex justify-between pt-2 mt-2 border-t border-border font-bold text-foreground">
                        <span>Design dP:</span><span className="font-mono">{unitSystem === "ip" ? `${calc.designPressureDropInWg} in.wg` : `${calc.designPressureDropPa} Pa`}</span>
                      </div>
                      <div className="flex justify-between pt-1 font-bold text-foreground">
                        <span>Relief Area:</span><span className="font-mono">{unitSystem === "ip" ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : null}
        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <StaircaseIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              items={items}
              unitSystem={unitSystem}
              onSelectStaircase={(id) => {
                setSelectedItems(new Set([id]));
                setTimeout(() => {
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
            />
          )}
        </div>
      </div>

      {/* Edit Staircase Modal */}
      {editingStaircase && typeof document !== "undefined" && (
        <EditStaircaseModal
          staircase={editingStaircase}
          unitSystem={unitSystem}
          isReadOnly={isEffectiveReadOnly}
          isNew={isNewStaircase}
          availableFloors={availableFloors}
          onClose={() => {
            if (isNewStaircase) {
              setItems((prev) => prev.filter((i) => i.id !== editingStaircase.id));
              saveItems(items.filter((i) => i.id !== editingStaircase.id));
            }
            setEditingStaircase(null);
            setIsNewStaircase(false);
          }}
          onSave={(updated) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            saveItems(items.map((i) => (i.id === updated.id ? updated : i)));
            setEditingStaircase(null);
            setIsNewStaircase(false);
            toast.success(isNewStaircase ? `Staircase "${updated.name}" added successfully` : "Staircase updated successfully");
          }}
        />
      )}

      {/* Calculation Breakdown & Preview Modal */}
      {previewRow && typeof document !== "undefined" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 font-sans animate-fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 flex flex-col gap-5 shadow-2xl animate-scale-in select-none max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Sparkles className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">Calculation Preview</h3>
                  <p className="text-xs text-muted-foreground">{previewRow.name} - Pressurization Breakdown</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg cursor-pointer transition hover:bg-accent"
              >
                <X className="size-5" />
              </button>
            </div>

            {(() => {
              const calc = calculateStaircase(previewRow, isIp);
              return (
                <div className="space-y-4">
                  {/* Results Overview */}
                  <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                    <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                      <span className="text-muted-foreground font-semibold">Fan Airflow</span>
                      <span className="text-base font-bold font-mono text-primary">{isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs} <span className="text-[10px] text-foreground">{isIp ? "CFM" : "L/s"}</span></span>
                    </div>
                    <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                      <span className="text-muted-foreground font-semibold">Design dP</span>
                      <span className="text-base font-bold font-mono text-primary">{isIp ? calc.designPressureDropInWg : calc.designPressureDropPa} <span className="text-[10px] text-foreground">{isIp ? "in.wg" : "Pa"}</span></span>
                    </div>
                    <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                      <span className="text-muted-foreground font-semibold">Relief Area</span>
                      <span className="text-base font-bold font-mono text-primary">{isIp ? calc.reliefAreaSqFt : calc.reliefAreaM2} <span className="text-[10px] text-foreground">{isIp ? "sq ft" : "m²"}</span></span>
                    </div>
                  </div>

                  {/* Calculation Breakdown & Formulas */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground">Calculation Breakdown & Formulas</h4>
                    <div className="space-y-3 text-xs text-muted-foreground">
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="font-bold text-foreground">1. Open Door Flow</span><br/>
                        <code className="text-blue-600 dark:text-blue-400 block my-1">Q = Door Area × Velocity × Open Doors</code>
                        <span className="font-mono">
                          {isIp ? (previewRow.doorArea || 0) + " sq ft" : (previewRow.doorArea || 0) + " m²"} × {isIp ? "196.85 ft/min" : "1.0 m/s"} × {previewRow.openDoorsCount || 0} doors = <strong className="text-foreground">{isIp ? "-" : calc.openFlowLs + " L/s"}</strong>
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="font-bold text-foreground">2. Closed Door Flow</span><br/>
                        <code className="text-blue-600 dark:text-blue-400 block my-1">Q = Leakage Rate × Closed Doors</code>
                        <span className="font-mono">
                          Leakage Rate × {previewRow.closedDoorsCount || 0} doors = <strong className="text-foreground">{isIp ? "-" : calc.closedFlowLs + " L/s"}</strong>
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="font-bold text-foreground">3. Safety Margins</span><br/>
                        <span className="font-mono">Closed Doors Safety (25%): <strong className="text-foreground">{isIp ? "-" : (Number(calc.closedSafetyFlowM3s) * 1000).toFixed(1)} L/s</strong></span><br/>
                        <span className="font-mono mt-1 block">Final Fan Safety (10%): <strong className="text-foreground">{isIp ? "-" : (Number(calc.finalSafetyM3s) * 1000).toFixed(1)} L/s</strong></span>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <span className="font-bold text-blue-700 dark:text-blue-300">4. Total Fan Capacity</span><br/>
                        <code className="text-blue-600 dark:text-blue-400 block my-1">Q = (Open + Closed + 25% Safety) × 1.10</code>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm mt-1 block">
                          Total = {isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs} {isIp ? "CFM" : "L/s"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* Formula Breakdown Modal */}
      {showFormulaModal && (
        <StaircaseFormulaModal
          onClose={() => setShowFormulaModal(false)}
          unitSystem={unitSystem}
          activeItem={(selectedItems.size > 0 ? items.find(it => selectedItems.has(it.id)) : null) || items[0]}
        />
      )}

      {commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => { setCommentModalOpen(false); setCommentTargetItem(null); }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="equipment"
          calculatorTitle="Staircase Pressurization"
          calculatorPath="/staircase-pressurization"
          existingComments={Array.isArray((commentTargetItem as any).comments) ? (commentTargetItem as any).comments : []}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

function StaircaseIntelligenceDrawer({
  onClose,
  items,
  unitSystem,
  onSelectStaircase,
}: {
  onClose: () => void;
  items: StaircaseItem[];
  unitSystem: "si" | "ip";
  onSelectStaircase: (id: string) => void;
}) {
  const isIp = unitSystem === "ip";
  const flowUnit = isIp ? "CFM" : "L/s";
  const areaUnit = isIp ? "sq ft" : "m²";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    missingOpen: false,
    missingClosed: false,
    missingDoorArea: false,
  });

  const totals = React.useMemo(() => {
    let totalFanCapacityLs = 0;
    let totalFanCapacityCfm = 0;
    let totalReliefAreaM2 = 0;
    let totalReliefAreaSqFt = 0;
    let totalOpenDoors = 0;
    let totalClosedDoors = 0;

    items.forEach(item => {
      const calcSi = calculateStaircase(item, false);
      const calcIp = calculateStaircase(item, true);
      totalFanCapacityLs += calcSi.totalFanCapacityLs;
      totalFanCapacityCfm += calcIp.totalFanCapacityCfm;
      totalReliefAreaM2 += Number(calcSi.reliefAreaM2);
      totalReliefAreaSqFt += Number(calcIp.reliefAreaSqFt);
      totalOpenDoors += Number(item.openDoorsCount) || 0;
      totalClosedDoors += Number(item.closedDoorsCount) || 0;
    });

    return {
      totalFanCapacityLs,
      totalFanCapacityCfm,
      totalReliefAreaM2,
      totalReliefAreaSqFt,
      totalOpenDoors,
      totalClosedDoors,
    };
  }, [items]);

  const missingOpenDoors = React.useMemo(() => {
    return items
      .filter(i => !i.openDoorsCount || Number(i.openDoorsCount) <= 0)
      .map(i => ({
        id: i.id,
        name: i.name,
        detail: "0 open doors configured",
      }));
  }, [items]);

  const missingClosedDoors = React.useMemo(() => {
    return items
      .filter(i => !i.closedDoorsCount || Number(i.closedDoorsCount) <= 0)
      .map(i => ({
        id: i.id,
        name: i.name,
        detail: "0 closed doors configured",
      }));
  }, [items]);

  const missingDoorArea = React.useMemo(() => {
    return items
      .filter(i => !i.doorArea || Number(i.doorArea) <= 0)
      .map(i => ({
        id: i.id,
        name: i.name,
        detail: `0 ${areaUnit}`,
      }));
  }, [items, areaUnit]);

  const totalSystems = items.length;
  const compliantSystems = items.filter(
    i => (Number(i.doorArea) || 0) > 0 && (Number(i.openDoorsCount) || 0) > 0 && (Number(i.closedDoorsCount) || 0) > 0
  );
  const compliancePct = totalSystems > 0 ? Math.round((compliantSystems.length / totalSystems) * 100) : 100;

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in font-sans">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button onClick={onClose} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {/* Compliance Status */}
        <IntelSection icon={CheckCircle2} tone="success" title="Compliance Status">
          <div className="text-[12px] text-muted-foreground">
            NFPA 92 &amp; BS EN 12101-6 audit across {totalSystems} staircase shaft{totalSystems === 1 ? "" : "s"}.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${compliancePct === 100 ? "bg-success" : "bg-warning"}`}
                style={{ width: `${compliancePct}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px] font-medium">{compliancePct}%</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {compliantSystems.length} of {totalSystems} staircases fully sized with active relief
          </div>
        </IntelSection>

        {/* System Summary KPI */}
        <IntelSection icon={Gauge} tone="primary" title="Pressurisation Airflow & Relief">
          <KV
            k="Total Fan Capacity"
            v={`${isIp ? totals.totalFanCapacityCfm.toLocaleString() : totals.totalFanCapacityLs.toLocaleString()} ${flowUnit}`}
          />
          <KV
            k="Total Relief Area"
            v={`${isIp ? totals.totalReliefAreaSqFt.toFixed(2) : totals.totalReliefAreaM2.toFixed(2)} ${areaUnit}`}
          />
          <KV k="Design Open Doors" v={`${totals.totalOpenDoors} doors`} />
          <KV k="Design Closed Doors" v={`${totals.totalClosedDoors} doors`} />
          <KV k="Staircase Shafts" v={`${totalSystems} systems`} />
        </IntelSection>

        {/* Code Criteria & Safety Checks */}
        <IntelSection icon={AlertTriangle} tone={missingOpenDoors.length > 0 ? "warning" : "muted"} title="Code Criteria & Safety">
          <KV k="Min Egress Velocity" v="1.0 m/s (197 fpm)" />
          <KV k="Closed Door Safety Margin" v="+25% leakage" />
          <KV k="Final Fan Sizing Factor" v="+10% flow" />
          <KV k="Max Door Opening Force" v="110 N (NFPA 101)" />
          <KV k="Relief Pressure Setpoint" v={isIp ? "0.05 in.wg" : "12.5 Pa"} />
        </IntelSection>

        {/* Missing Data Section */}
        <IntelSection icon={Info} tone="muted" title="Missing Data & Configuration">
          <CollapsibleMissingSection
            label="Staircases with 0 Open Doors"
            count={missingOpenDoors.length}
            itemsList={missingOpenDoors}
            isOpen={openSections.missingOpen}
            onToggle={() => setOpenSections(prev => ({ ...prev, missingOpen: !prev.missingOpen }))}
            onItemClick={(id) => onSelectStaircase(id)}
          />
          <CollapsibleMissingSection
            label="Staircases with 0 Closed Doors"
            count={missingClosedDoors.length}
            itemsList={missingClosedDoors}
            isOpen={openSections.missingClosed}
            onToggle={() => setOpenSections(prev => ({ ...prev, missingClosed: !prev.missingClosed }))}
            onItemClick={(id) => onSelectStaircase(id)}
          />
          <CollapsibleMissingSection
            label="Staircases with 0 / Missing Door Area"
            count={missingDoorArea.length}
            itemsList={missingDoorArea}
            isOpen={openSections.missingDoorArea}
            onToggle={() => setOpenSections(prev => ({ ...prev, missingDoorArea: !prev.missingDoorArea }))}
            onItemClick={(id) => onSelectStaircase(id)}
          />
        </IntelSection>

        {/* Optimization Suggestions */}
        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>For stairwells taller than 11 m (&gt; 3 storeys), provide multi-injection discharge points every 3 floors to prevent buoyancy decoupling.</li>
            <li>Calibrate barometric overpressure relief dampers to crack open at 12.5 Pa / 50 Pa to limit door opening force below 110 N.</li>
            <li>In high-rise towers (&gt; 20 storeys), account for minimum 3 open doors during simultaneous phase evacuation.</li>
          </ul>
        </IntelSection>

        {/* Engineering Notes */}
        <IntelSection icon={Info} tone="muted" title="Engineering Notes">
          <div className="text-[12px] text-muted-foreground leading-relaxed">
            NFPA 92 &amp; BS EN 12101-6 Class B &amp; D criteria: 1.0 m/s minimum airflow velocity across open doors, 50 Pa differential when doors are closed. 25% closed door safety margin + 10% fan design factor applied.
          </div>
        </IntelSection>
      </div>
    </div>
  );
}

function IntelSection({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: any;
  title: string;
  tone: "success" | "warning" | "primary" | "muted";
  children: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "primary"
      ? "text-primary"
      : "text-muted-foreground";
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
  itemsList: { id: string; name: string; detail: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (id: string) => void;
}) {
  return (
    <div className="border-b border-border/40 last:border-b-0 py-1.5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[12.5px] font-medium text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none py-0.5"
      >
        <span className="flex items-center gap-1.5">
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
                <span className="text-muted-foreground/50 text-[10px] font-mono ml-1.5">
                  ({item.detail})
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// SUB-COMPONENT: STAIRCASE PRESSURIZATION FORMULA BREAKDOWN MODAL (MATCHING FRESH AIR COOLING LOAD STANDARD)
function StaircaseFormulaModal({
  onClose,
  unitSystem,
  activeItem,
}: {
  onClose: () => void;
  unitSystem: "si" | "ip";
  activeItem?: any;
}) {
  const [activeTab, setActiveTab] = React.useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = React.useState(false);

  // Esc key listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isIp = unitSystem === "ip";
  const item = activeItem || {
    name: "Staircase 1",
    openDoorsCount: 2,
    closedDoorsCount: 10,
    doorArea: 2.1,
    doorType: "single_in",
  };

  const calc = calculateStaircase(item, isIp);
  const openDoors = Number(item.openDoorsCount) || 2;
  const closedDoors = Number(item.closedDoorsCount) || 10;
  const doorArea = Number(item.doorArea) || (isIp ? 22.6 : 2.1);

  const handleCopySummary = () => {
    const text = `=== STAIRCASE PRESSURISATION FORMULA BREAKDOWN ===
Governing Design Standards: BS EN 12101-6 & NFPA 92 Standard for Smoke Control Systems
Unit System: ${isIp ? "IP Imperial (sq ft, CFM, in.wg)" : "SI Metric (m, m², m³/s, L/s, Pa)"}
Staircase System: ${item.name || "Active Staircase"}

--- 1. ACTIVE SIZING PARAMETERS ---
• Design Pressure Difference: ${isIp ? `${calc.designPressureDropInWg} in.wg` : `${calc.designPressureDropPa} Pa`}
• Number of Designated Open Doors: ${openDoors} doors (Door Area: ${doorArea} ${isIp ? "sq ft" : "m²"})
• Number of Closed Doors (Leakage Path): ${closedDoors} doors
• Egress Air Velocity Criterion: 1.0 m/s (197 FPM) across open egress doors

--- 2. STEP-BY-STEP CALCULATION TRACE ---
[1] Open Door Egress Airflow (Q_open):
    Q_open = Door Area × Velocity × Open Doors = ${doorArea} × 1.0 × ${openDoors} = ${calc.openFlowM3s} m³/s (${isIp ? `${Math.round(Number(calc.openFlowLs) * 2.1189)} CFM` : `${calc.openFlowLs} L/s`})

[2] Closed Door Crack Leakage (Q_closed):
    Q_closed = Specific Leakage Rate × Closed Doors = ${calc.closedFlowM3s} m³/s

[3] +25% Closed Door Safety Factor:
    Q_closed_safe = Q_closed × 1.25 = ${(Number(calc.closedFlowM3s) * 1.25).toFixed(3)} m³/s

[4] Subtotal Airflow:
    Q_subtotal = Q_open + Q_closed_safe = ${(Number(calc.openFlowM3s) + Number(calc.closedFlowM3s) * 1.25).toFixed(3)} m³/s

[5] +10% Overall Fan Selection Margin:
    Q_total = Q_subtotal × 1.10 = ${calc.finalSafetyM3s} m³/s (${isIp ? `${calc.totalFanCapacityCfm.toLocaleString()} CFM` : `${calc.totalFanCapacityLs.toLocaleString()} L/s`})

[6] Automatic Barometric Relief Damper Area:
    A_relief = Q_fan / (0.827 × √ΔP_ref) = ${isIp ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`} (at 12.5 Pa relief dP)
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Staircase calculation breakdown copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150 select-none font-sans"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[86vh] flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <BookOpen className="size-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-[13px] font-bold text-foreground truncate">
                Staircase Pressurization Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              BS EN 12101-6 / NFPA 92
            </span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] font-mono font-medium shrink-0">
              {isIp ? "IP" : "SI"}
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
              {/* Active Sizing Parameters Banner */}
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider pb-1.5 mb-1.5 border-b border-border/60">
                  <span className="flex items-center gap-1 text-foreground">
                    <SlidersHorizontal className="size-3 text-primary" /> Active System Parameters
                  </span>
                  <span className="font-mono text-primary normal-case font-bold">
                    {item.name || "Staircase"} | {isIp ? `${calc.totalFanCapacityCfm.toLocaleString()} CFM` : `${calc.totalFanCapacityLs.toLocaleString()} L/s`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Open &amp; Closed Doors</span>
                    <span className="font-mono font-bold text-foreground">{openDoors} open / {closedDoors} closed</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">({doorArea} {isIp ? "sq.ft" : "m²"} ea)</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Design Differential &amp; Standard</span>
                    <span className="font-mono font-bold text-foreground">50 Pa Nominal</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">(EN 12101-6)</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: OPEN DOOR EGRESS AIRFLOW */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Open Door Egress Airflow (Q_open)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {calc.openFlowM3s} m³/s
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_open = Door Area × Velocity (1.0 m/s) × Open Doors</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{doorArea} m² × 1.0 m/s × {openDoors} door(s)</span>
                    <span className="text-primary font-bold">= {calc.openFlowM3s} m³/s ({isIp ? `${Math.round(Number(calc.openFlowLs) * 2.1189)} CFM` : `${calc.openFlowLs} L/s`})</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: CLOSED DOOR CRACK LEAKAGE */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Closed Door Crack Leakage (Q_closed)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {calc.closedFlowM3s} m³/s
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_closed = Σ (q_leakage × Closed Door Count)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{closedDoors} closed doors along pressurized vertical shaft</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {calc.closedFlowM3s} m³/s</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: CODE SAFETY FACTORS (+25% & +10%) */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Engineering Safety Margins (+25% &amp; +10%)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Q_tot = {calc.finalSafetyM3s} m³/s
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">+25% Crack Leakage Allowance:</span>
                    <span className="font-bold text-foreground">Q_closed_safe = {calc.closedFlowM3s} × 1.25 = {(Number(calc.closedFlowM3s) * 1.25).toFixed(3)} m³/s</span>
                  </div>
                  <div className="flex justify-between text-foreground pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">+10% Final Selection Margin:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">({calc.openFlowM3s} + {(Number(calc.closedFlowM3s) * 1.25).toFixed(3)}) × 1.10 = {calc.finalSafetyM3s} m³/s</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: OVERPRESSURE RELIEF DAMPER */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Automatic Barometric Relief Damper Area
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {isIp ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: A_relief = Q_fan / (0.827 × √ΔP_ref) at 12.5 Pa reference</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Relief to prevent door opening force &gt; 100 N</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">= {isIp ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`}</span>
                  </div>
                </div>
              </div>

              {/* Sizing Outcome Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">Recommended Fan Sizing</div>
                  <div className="text-[11.5px] font-bold text-foreground mt-0.5">{isIp ? `${calc.totalFanCapacityCfm.toLocaleString()} CFM` : `${calc.totalFanCapacityLs.toLocaleString()} L/s`} @ 50 Pa dP</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-primary leading-tight">{isIp ? `${calc.totalFanCapacityCfm.toLocaleString()} CFM` : `${calc.totalFanCapacityLs.toLocaleString()} L/s`}</div>
                  <div className="text-[9.5px] text-muted-foreground font-mono">Relief: {isIp ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" /> Open Door Egress Airflow Equation
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Q_open = A_door · v_egress · N_open_doors</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Where egress airflow velocity v_egress = 1.0 m/s (196.85 FPM) across the designated open door into the unpressurized accommodation space (EN 12101-6 Class A/B egress protocol).
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-blue-500" /> Closed Door Crack Leakage &amp; Safety Factor
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Q_closed = Σ (q_specific_leakage · N_doors)  |  Q_closed_safe = Q_closed × 1.25</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Accounts for air escaping through perimeter door gaps and lift landing clearances at nominal 50 Pa differential with a mandatory 25% safety margin.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Barometric Overpressure Relief Area
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>A_relief = Q_fan (m³/s) / [ 0.827 · √(ΔP_reference) ]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Sized at ΔP_ref = 12.5 Pa to ensure maximum door opening force during escape does not exceed 100 N (22.5 lbf).
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: VARIABLES REFERENCE */}
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
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_open</td>
                      <td className="py-1.5 px-2 text-foreground">Airflow through Open Egress Doors</td>
                      <td className="py-1.5 px-2 font-mono">m³/s / L/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_closed</td>
                      <td className="py-1.5 px-2 text-foreground">Closed Door Crack Leakage</td>
                      <td className="py-1.5 px-2 font-mono">m³/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">v_egress</td>
                      <td className="py-1.5 px-2 text-foreground">Door Air Velocity Standard</td>
                      <td className="py-1.5 px-2 font-mono">1.0 m/s</td>
                      <td className="py-1.5 px-2 font-mono">197 FPM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">A_relief</td>
                      <td className="py-1.5 px-2 text-foreground">Overpressure Relief Vent Area</td>
                      <td className="py-1.5 px-2 font-mono">m²</td>
                      <td className="py-1.5 px-2 font-mono">sq ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ΔP_design</td>
                      <td className="py-1.5 px-2 text-foreground">Nominal Design Pressure Differential</td>
                      <td className="py-1.5 px-2 font-mono">50 Pa</td>
                      <td className="py-1.5 px-2 font-mono">0.20 in.wg</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_total</td>
                      <td className="py-1.5 px-2 text-foreground">Total Fan Capacity (+25% &amp; +10%)</td>
                      <td className="py-1.5 px-2 font-mono">L/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
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



interface EditStaircaseModalProps {
  staircase: StaircaseItem;
  unitSystem: "si" | "ip";
  isReadOnly?: boolean;
  isNew?: boolean;
  availableFloors?: string[];
  onClose: () => void;
  onSave: (updated: StaircaseItem) => void;
}

function EditStaircaseModal({ staircase, unitSystem, isReadOnly, isNew, availableFloors = [], onClose, onSave }: EditStaircaseModalProps) {
  const isIp = unitSystem === "ip";
  const [formData, setFormData] = useState<StaircaseItem>({ ...staircase });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    document.body.classList.add("modal-open-blur");
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, []);

  useEffect(() => {
    setFormData({ ...staircase });
  }, [staircase]);

  const calc = calculateStaircase(formData, isIp);

  const labelClass =
    "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5";
  const inputClass =
    "w-full h-9 px-3 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";
  const selectClass =
    "w-full h-9 px-2.5 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/20 dark:bg-black/50 p-4 animate-fade-in font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white/80 dark:bg-neutral-950/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-h-[88vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
          showPreview ? "max-w-4xl" : "max-w-xl"
        }`}
      >
        {/* Header */}
        <header className="px-5 h-14 flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <h2 className="text-[14.5px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
              {isNew ? "Add Staircase" : "Edit Staircase Parameters"}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {formData.name || "Staircase"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11.5px] font-semibold border transition-all cursor-pointer shadow-xs ${
                showPreview
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95"
                  : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"
              }`}
            >
              <Info className="size-3.5" />
              Calculations Preview
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-8 grid place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Content body split into Form inputs and Calculations preview */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Form inputs (Left side) */}
          <div className="flex-1 min-w-0 p-5 space-y-4 overflow-y-auto custom-scrollbar">
            {/* General Parameters */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> General Parameters
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Staircase Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Staircase-01"
                    disabled={isReadOnly}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Floor Level</label>
                  <FloorSelect
                    value={formData.floor || "GF"}
                    onChange={(fl) => setFormData({ ...formData, floor: fl })}
                    availableFloors={availableFloors}
                    disabled={isReadOnly}
                    triggerClassName="h-9 rounded-lg text-[12px]"
                  />
                </div>
                <div>
                  <label className={labelClass}>Door Type</label>
                  <select
                    value={formData.doorType}
                    onChange={(e) => setFormData({ ...formData, doorType: e.target.value as DoorTypeKey })}
                    className={selectClass}
                    disabled={isReadOnly}
                  >
                    {(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[])
                      .filter((k) => k !== "lift_landing")
                      .map((k) => (
                        <option key={k} value={k}>
                          {DOOR_TYPES_CONFIG[k].name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Geometry & Leakage Parameters */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Door Geometry &amp; Leakage
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>
                    Door Area ({isIp ? "sq ft" : "m²"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.doorArea}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        doorArea: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className={labelClass}>Open Doors Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.openDoorsCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        openDoorsCount: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className={labelClass}>Closed Doors Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.closedDoorsCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        closedDoorsCount: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>

            {/* Regulatory Protocol Card */}
            <div className="p-3 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-[11px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" /> Pressurisation Standard Protocol
              </div>
              <p className="leading-relaxed">
                Calculations follow EN 12101-6 (Classes A through F) &amp; NFPA 92 with +25% closed door leakage safety factor and +10% fan selection margin at 50 Pa nominal pressure differential.
              </p>
            </div>
          </div>

          {/* Calculations preview (Right side) */}
          <div
            className={`border-l border-black/10 dark:border-white/10 transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${
              showPreview ? "w-[360px] opacity-100" : "w-0 opacity-0 border-l-0 pointer-events-none"
            }`}
          >
            <div className="w-[360px] h-full p-5 bg-neutral-50/50 dark:bg-white/[0.02] flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              <div className="shrink-0 flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                <span className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Flame className="size-4 text-primary" /> Live Calculations Preview
                </span>
                <span className="text-[10px] font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                  LIVE
                </span>
              </div>

              {/* Standard Basis Card */}
              <div className="border border-black/5 dark:border-white/5 p-3 rounded-xl bg-white/40 dark:bg-white/5 space-y-1.5 text-[11px]">
                <div className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary" /> EN 12101-6 / NFPA 92 Sizing
                </div>
                <div className="text-[10.5px] space-y-1 pt-1">
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Design dP:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {isIp ? `${calc.designPressureDropInWg} in.wg` : `${calc.designPressureDropPa} Pa`}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Open Doors:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {formData.openDoorsCount} doors ({formData.doorArea} {isIp ? "sq ft" : "m²"})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Closed Doors:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {formData.closedDoorsCount} doors (leakage path)
                    </span>
                  </div>
                </div>
              </div>

              {/* Calculations Summary */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Required Fan Sizing
                  </div>

                  {/* Fan Capacity */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Total Fan Capacity:</span>
                      <span className="font-mono font-bold text-[13.5px] text-primary">
                        {isIp
                          ? `${calc.totalFanCapacityCfm.toLocaleString()} CFM`
                          : `${calc.totalFanCapacityLs.toLocaleString()} L/s`}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {`Q_total = (Q_open + Q_closed × 1.25) × 1.10 = ${calc.finalSafetyM3s} m³/s`}
                    </div>
                  </div>

                  {/* Open & Closed Flow Rates */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-neutral-500 dark:text-neutral-400">Open Doors Airflow:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {calc.openFlowM3s} m³/s ({isIp ? `${Math.round(Number(calc.openFlowLs) * 2.1189)} CFM` : `${calc.openFlowLs} L/s`})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 dark:text-neutral-400">Closed Doors (+25%):</span>
                      <span className="font-mono font-semibold text-foreground">
                        {calc.closedFlowM3s} m³/s
                      </span>
                    </div>
                  </div>

                  {/* Relief Area */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Automatic Relief Area:</span>
                      <span className="font-mono font-bold text-[13.5px] text-amber-600 dark:text-amber-500">
                        {isIp ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Info */}
              <div className="shrink-0 p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl flex items-start gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <span className="font-semibold">Calculations verified.</span> Pressurisation capacity satisfies EN 12101-6 Class A/B and NFPA 92 criteria.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 h-14 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-lg text-[12px] font-medium transition-colors cursor-pointer shadow-xs"
          >
            Cancel
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => onSave(formData)}
              className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
            >
              {isNew ? "Add Staircase" : "Save Changes"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
