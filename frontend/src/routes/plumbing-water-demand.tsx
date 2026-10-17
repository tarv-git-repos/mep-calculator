import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfHeader, addPdfSignatureBlock, formatDateStr, resolveLatestReviewState, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { Trash2, Plus, Download, Upload, Save, Info, Droplet, Building2, Layers, Globe, Sparkles, FileSpreadsheet, MessageSquare, Copy, Calculator, X, FileText, Printer, SlidersHorizontal, Check, Filter, ArrowUpDown, Search, Flag, Gauge, Activity, BookOpen, Sliders, RefreshCw, RotateCcw, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuShortcut } from "@/components/ui/context-menu";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { downloadFile } from "@/lib/download";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { exportWaterDemandPDF } from "@/lib/exportWaterDemandPDF";
import {
  type OverheadTank,
  type WDRow,
  type IrrRow,
  WD_TYPE_MAP,
  IRR_TYPE_MAP,
  PRESET_STANDARDS,
  type AutoDetectResult,
  detectAshraeOccupancy,
  type Tab,
  computeWaterDemandCalculations
} from "@/lib/calc-plumbing-water-demand";

export function getWdRowValidation(r: WDRow) {
  const isNoName = !r.name || r.name.trim() === "";
  const isNoPeople = !r.ppl || Number(r.ppl) <= 0 || isNaN(Number(r.ppl));
  const isNoCategory = !r.cat || r.cat.trim() === "" || r.cat.toLowerCase().includes("select category");
  const isNoRate = !r.lpd || Number(r.lpd) <= 0 || isNaN(Number(r.lpd));
  const dailyDemand = (Number(r.ppl) || 0) * (Number(r.lpd) || 0) * (Number(r.multiplier) || 1);
  const isZeroDemand = dailyDemand <= 0;
  const isFlagged = Boolean(r.flagged || isNoName || isNoPeople || isNoCategory || isNoRate || isZeroDemand);
  return {
    isFlagged,
    isNoName,
    isNoPeople,
    isNoCategory,
    isNoRate,
    isZeroDemand,
    isManual: Boolean(r.flagged),
  };
}

export function getIrrRowValidation(r: IrrRow) {
  const isNoArea = !r.area || Number(r.area) <= 0 || isNaN(Number(r.area));
  const isNoVegType = !r.vegType || r.vegType.trim() === "" || r.vegType.toLowerCase().includes("select");
  const isNoRate = !r.lpd || Number(r.lpd) <= 0 || isNaN(Number(r.lpd));
  const dailyDemand = (Number(r.area) || 0) * (Number(r.lpd) || 0);
  const isZeroDemand = dailyDemand <= 0;
  const isFlagged = Boolean(r.flagged || isNoArea || isNoVegType || isNoRate || isZeroDemand);
  return {
    isFlagged,
    isNoArea,
    isNoVegType,
    isNoRate,
    isZeroDemand,
    isManual: Boolean(r.flagged),
  };
}

export const Route = createFileRoute("/plumbing-water-demand")({
  head: () => ({
    meta: [
      { title: "Water Demand & Tank Sizing Calculator — MEP Calc" },
      { name: "description", content: "Comprehensive water demand sizing tool for domestic, irrigation, swimming pool, fire fighting, and storage tank capacities." },
    ],
  }),
  component: WaterDemandPage,
});

function WaterDemandPage() {
  const confirm = useConfirm();
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-water-demand", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-water-demand", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const currentUserId = userData?.id || profile?.id || "user_id";
  const isApprovedLocked = useCalculationLock("/plumbing-water-demand", project?.id);
  const isLocked = isEffectiveReadOnly || isApprovedLocked;
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  type DemandSection = "domestic" | "irrigation" | "pool" | "fire";
  const [tab, setTab] = useState<Tab>("demand");
  const [demandSection, setDemandSection] = useState<DemandSection>("domestic");
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [showUnitConfirmModal, setShowUnitConfirmModal] = useState<boolean>(false);
  const [showAddWdModal, setShowAddWdModal] = useState<boolean>(false);
  const [showAddIrrModal, setShowAddIrrModal] = useState<boolean>(false);
  const [pendingUnitTarget, setPendingUnitTarget] = useState<"si" | "ip" | null>(null);
  const [presetStandard, setPresetStandard] = useState<string>("dewa");
  const [intelOpen, setIntelOpen] = useState(false);

  const handleUnitSystemClick = (targetUnit: "si" | "ip") => {
    if (targetUnit === unitSystem) return;
    setPendingUnitTarget(targetUnit);
    setShowUnitConfirmModal(true);
  };

  const executeUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (shouldConvert) {
      const convArea = targetUnit === "ip" ? 10.7639 : 1 / 10.7639;
      const convDepth = targetUnit === "ip" ? 3.28084 : 1 / 3.28084;

      setIrrRows((prev) =>
        prev.map((r) => ({
          ...r,
          area: Math.max(1, Math.round(r.area * convArea)),
        }))
      );

      if (poolArea !== "") {
        setPoolArea(Math.max(1, Math.round(Number(poolArea) * convArea)));
      }
      if (poolDepth !== "") {
        setPoolDepth(Number((Number(poolDepth) * convDepth).toFixed(1)));
      }
    }

    setUnitSystem(targetUnit);
    setShowUnitConfirmModal(false);
    setPendingUnitTarget(null);
    toast.success(`Unit system switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"}`);
  };

  // Storage Tank & Transfer Pump Settings
  const [storageDays, setStorageDays] = useState<number>(1);
  const [groundTankPct, setGroundTankPct] = useState<number>(100);
  const [overheadTanks, setOverheadTanks] = useState<OverheadTank[]>([
    { id: 1, name: "Overhead Roof Tank 1", splitPct: 40 },
  ]);
  const [peakFactor, setPeakFactor] = useState<number>(2.5);
  const [fillWindowHours, setFillWindowHours] = useState<number>(2);

  const handleAddOverheadTank = () => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const newId = Date.now();
    setOverheadTanks((prev) => [
      ...prev,
      { id: newId, name: `Overhead Roof Tank ${prev.length + 1}`, splitPct: prev.length === 0 ? 40 : 20 },
    ]);
  };

  const handleRemoveOverheadTank = (id: number) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    setOverheadTanks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleRenameOverheadTank = (id: number, name: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    setOverheadTanks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t))
    );
  };

  const handleUpdateOverheadTankPct = (id: number, splitPct: number) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    setOverheadTanks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, splitPct: Math.max(0, Math.min(100, splitPct)) } : t))
    );
  };

  // Domestic state
  const [wdRows, setWdRows] = useState<WDRow[]>([]);
  const [newWdName, setNewWdName] = useState("");
  const [newWdPeople, setNewWdPeople] = useState<number | "">("");
  const [newWdCat, setNewWdCat] = useState("");
  const [newWdCustomLpd, setNewWdCustomLpd] = useState<number | "">("");
  const [newWdMultiplier, setNewWdMultiplier] = useState<number | "">(1);
  const [newWdAutoDetected, setNewWdAutoDetected] = useState<boolean>(false);

  // Irrigation state
  const [irrRows, setIrrRows] = useState<IrrRow[]>([]);
  const [newIrrArea, setNewIrrArea] = useState<number | "">("");
  const [newIrrVegType, setNewIrrVegType] = useState("");

  // Pool state
  const [poolArea, setPoolArea] = useState<number | "">("");
  const [poolDepth, setPoolDepth] = useState<number | "">("");
  const [poolEvap, setPoolEvap] = useState<number>(10);
  const [poolComments, setPoolComments] = useState<any[]>([]);
  const [poolFlagged, setPoolFlagged] = useState<boolean>(false);

  // Fire state
  const [fireFlow, setFireFlow] = useState<number | "">("");
  const [fireComments, setFireComments] = useState<any[]>([]);
  const [fireFlagged, setFireFlagged] = useState<boolean>(false);

  // Comment Modal Target State
  const [commentTarget, setCommentTarget] = useState<{
    targetId: string;
    targetName: string;
    targetType: string;
    rowId?: number;
    isIrrigation?: boolean;
    isPool?: boolean;
    isFire?: boolean;
    existingComments?: any[];
  } | null>(null);

  // Double-Click Calculation Breakdown Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showModalPreview, setShowModalPreview] = useState(true);
  const [previewTarget, setPreviewTarget] = useState<{
    type: "domestic" | "irrigation" | "summary" | "tank" | "pump" | "pool" | "fire";
    rowId?: number;
  } | null>(null);

  // Search, Filter, Sort state for toolbar
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>("");
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"name" | "ppl" | "lpd" | "load" | "none">("none");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const importFileRef = useRef<HTMLInputElement>(null);

  // Multi-selection state (Ctrl+Click, Shift+Click, Ctrl+A, Esc)
  const [selectedWdRows, setSelectedWdRows] = useState<Set<number>>(new Set());
  const [lastClickedWdIndex, setLastClickedWdIndex] = useState<number | null>(null);

  const [selectedIrrRows, setSelectedIrrRows] = useState<Set<number>>(new Set());
  const [lastClickedIrrIndex, setLastClickedIrrIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isLocked) {
      setSelectedWdRows(new Set());
      setSelectedIrrRows(new Set());
      setLastClickedWdIndex(null);
      setLastClickedIrrIndex(null);
    }
  }, [isLocked]);

  useEffect(() => {
    if (previewModalOpen) {
      document.body.classList.add("modal-open-blur");
      return () => {
        document.body.classList.remove("modal-open-blur");
      };
    }
  }, [previewModalOpen]);

  const DEFAULT_WD_COL_WIDTHS: Record<string, number> = useMemo(() => ({
    select: 36,
    name: 240,
    ppl: 110,
    multiplier: 120,
    cat: 240,
    lpd: 150,
    load: 140,
    actions: 36,
    irr_select: 36,
    irr_vegType: 240,
    irr_area: 130,
    irr_rate: 130,
    irr_load: 140,
    irr_actions: 36,
  }), []);

  // Dynamic Column Width Adjusting State
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_grid_water_demand");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            const sanitized = { ...DEFAULT_WD_COL_WIDTHS, ...parsed };
            // Auto-heal any squashed column widths from localStorage
            Object.keys(DEFAULT_WD_COL_WIDTHS).forEach((k) => {
              if (k !== "select" && k !== "actions" && k !== "irr_select" && k !== "irr_actions") {
                if (!sanitized[k] || sanitized[k] < 80) {
                  sanitized[k] = DEFAULT_WD_COL_WIDTHS[k];
                }
              }
            });
            return sanitized;
          }
        }
      } catch (e) {}
    }
    return DEFAULT_WD_COL_WIDTHS;
  });

  const totalWdTableWidth = useMemo(() => {
    return (
      (colWidths.select || 36) +
      (colWidths.name || 240) +
      (colWidths.ppl || 110) +
      (colWidths.multiplier || 120) +
      (colWidths.cat || 240) +
      (colWidths.lpd || 150) +
      (colWidths.load || 140) +
      (colWidths.actions || 36)
    );
  }, [colWidths]);

  const totalIrrTableWidth = useMemo(() => {
    return (
      (colWidths.irr_select || 36) +
      (colWidths.irr_vegType || 240) +
      (colWidths.irr_area || 130) +
      (colWidths.irr_rate || 130) +
      (colWidths.irr_load || 140) +
      (colWidths.irr_actions || 36)
    );
  }, [colWidths]);

  const getWdColStyle = (key: string): React.CSSProperties => {
    if (key === "select" || key === "actions") {
      return { width: "36px", minWidth: "36px", maxWidth: "36px" };
    }
    const val = colWidths[key] ?? DEFAULT_WD_COL_WIDTHS[key] ?? 120;
    const totalDataWidth =
      (colWidths.name || 240) +
      (colWidths.ppl || 110) +
      (colWidths.multiplier || 120) +
      (colWidths.cat || 240) +
      (colWidths.lpd || 150) +
      (colWidths.load || 140);
    const pct = ((val / totalDataWidth) * 100).toFixed(2);
    return {
      width: `calc((100% - 72px) * ${pct} / 100)`,
    };
  };

  const getIrrColStyle = (key: string): React.CSSProperties => {
    if (key === "irr_select" || key === "irr_actions") {
      return { width: "36px", minWidth: "36px", maxWidth: "36px" };
    }
    const val = colWidths[key] ?? DEFAULT_WD_COL_WIDTHS[key] ?? 120;
    const totalDataWidth =
      (colWidths.irr_vegType || 240) +
      (colWidths.irr_area || 130) +
      (colWidths.irr_rate || 130) +
      (colWidths.irr_load || 140);
    const pct = ((val / totalDataWidth) * 100).toFixed(2);
    return {
      width: `calc((100% - 72px) * ${pct} / 100)`,
    };
  };

  const startResizing = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 120;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const minW = colKey.includes("select") ? 36 : colKey.includes("actions") ? 36 : 80;
      const newWidth = Math.max(minW, startWidth + (moveEvent.clientX - startX));
      setColWidths((prev) => {
        const next = { ...prev, [colKey]: newWidth };
        try { localStorage.setItem("mep_grid_water_demand", JSON.stringify(next)); } catch(err) {}
        return next;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const activeFiltersCount = (selectedCatFilter ? 1 : 0) + (filterFlaggedOnly ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedCatFilter("");
    setFilterFlaggedOnly(false);
    setSearchQuery("");
  };

  const handleResetSort = () => {
    setSortBy("none");
    setSortOrder("asc");
  };

  const handleQuickAddWd = () => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const newId = Date.now();
    const newEntry: WDRow = {
      id: newId,
      name: `New Water Entry ${wdRows.length + 1}`,
      ppl: 50,
      cat: "Offices",
      lpd: 60,
      autoDetected: false,
      comments: [],
    };
    setWdRows((prev) => [...prev, newEntry]);
    dirtyStore.set(true);
    toast.success(`Created "New Water Entry ${wdRows.length + 1}"`);
  };

  const handleImportExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          toast.error("The uploaded Excel file is empty.");
          return;
        }

        let headerIdx = -1;
        let descCol = 0, pplCol = 1, catCol = 2, lpdCol = 3;

        for (let r = 0; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (Array.isArray(row) && row.length > 0) {
            const rowStr = row.map((c) => String(c || "").toLowerCase());
            if (rowStr.some((c) => c.includes("desc") || c.includes("name") || c.includes("room") || c.includes("people") || c.includes("unit"))) {
              headerIdx = r;
              rowStr.forEach((cell, idx) => {
                if (cell.includes("desc") || cell.includes("name") || cell.includes("room") || cell.includes("title")) descCol = idx;
                else if (cell.includes("people") || cell.includes("unit") || cell.includes("count") || cell.includes("ppl") || cell.includes("occ")) pplCol = idx;
                else if (cell.includes("cat") || cell.includes("type") || cell.includes("use")) catCol = idx;
                else if (cell.includes("lpd") || cell.includes("gpd") || cell.includes("rate") || cell.includes("per capita")) lpdCol = idx;
              });
              break;
            }
          }
        }

        const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
        const imported: WDRow[] = [];

        for (let r = startRow; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!Array.isArray(row) || row.length === 0) continue;
          const nameVal = String(row[descCol] || row[0] || "").trim();
          if (!nameVal) continue;
          const pplVal = Number(row[pplCol] || row[1]) || 1;
          const catVal = String(row[catCol] || row[2] || "").trim();
          const matchedCat = Object.keys(WD_TYPE_MAP).find((k) => k.toLowerCase() === catVal.toLowerCase()) || "Offices";
          const defaultLpd = WD_TYPE_MAP[matchedCat] || 60;
          const lpdVal = Number(row[lpdCol] || row[3]) || defaultLpd;

          imported.push({
            id: Date.now() + r + Math.floor(Math.random() * 1000),
            name: nameVal,
            ppl: pplVal,
            cat: matchedCat,
            lpd: lpdVal,
            autoDetected: false,
            comments: [],
          });
        }

        if (imported.length > 0) {
          setWdRows((prev) => [...prev, ...imported]);
          dirtyStore.set(true);
          toast.success(`Successfully imported ${imported.length} entries from "${file.name}"!`);
        } else {
          toast.error("No valid water demand entries found in the file.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv sheet.");
      } finally {
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredAndSortedWdRows = useMemo(() => {
    let list = [...wdRows];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q));
    }
    if (selectedCatFilter) {
      list = list.filter((r) => r.cat === selectedCatFilter);
    }
    if (filterFlaggedOnly) {
      list = list.filter((r) => getWdRowValidation(r).isFlagged);
    }
    if (sortBy !== "none") {
      list.sort((a, b) => {
        let valA: any = a.name;
        let valB: any = b.name;
        if (sortBy === "ppl") {
          valA = a.ppl;
          valB = b.ppl;
        } else if (sortBy === "lpd") {
          valA = a.lpd;
          valB = b.lpd;
        } else if (sortBy === "load") {
          valA = a.ppl * a.lpd;
          valB = b.ppl * b.lpd;
        }
        if (typeof valA === "number" && typeof valB === "number") {
          return sortOrder === "asc" ? valA - valB : valB - valA;
        }
        return sortOrder === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return list;
  }, [wdRows, searchQuery, selectedCatFilter, filterFlaggedOnly, sortBy, sortOrder]);

  const filteredAndSortedIrrRows = useMemo(() => {
    let list = [...irrRows];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => r.vegType.toLowerCase().includes(q));
    }
    if (filterFlaggedOnly) {
      list = list.filter((r) => getIrrRowValidation(r).isFlagged);
    }
    return list;
  }, [irrRows, searchQuery, filterFlaggedOnly]);

  // Domestic selection handlers
  const toggleWdRowSelection = (id: number, isShift?: boolean, isCtrl?: boolean) => {
    if (isLocked) return;
    setSelectedWdRows((prev) => {
      const list = filteredAndSortedWdRows;
      const clickedIndex = list.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift) {
        const pivotIndex = lastClickedWdIndex !== null ? lastClickedWdIndex : 0;
        const start = Math.min(pivotIndex, clickedIndex);
        const end = Math.max(pivotIndex, clickedIndex);

        if (!isCtrl) {
          next.clear();
        }

        for (let i = start; i <= end; i++) {
          if (list[i]) next.add(list[i].id);
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedWdIndex(clickedIndex);
      } else {
        if (next.has(id) && next.size === 1) {
          next.delete(id);
        } else {
          next.clear();
          next.add(id);
        }
        setLastClickedWdIndex(clickedIndex);
      }

      return next;
    });
  };

  const toggleSelectAllWd = () => {
    if (isLocked) {
      toast.info("Calculation is Approved & Locked. Selection is locked.", { id: "readonly-notice" });
      return;
    }
    if (selectedWdRows.size === filteredAndSortedWdRows.length && filteredAndSortedWdRows.length > 0) {
      setSelectedWdRows(new Set());
    } else {
      setSelectedWdRows(new Set(filteredAndSortedWdRows.map((r) => r.id)));
    }
  };

  // Irrigation selection handlers
  const toggleIrrRowSelection = (id: number, isShift?: boolean, isCtrl?: boolean) => {
    if (isLocked) return;
    setSelectedIrrRows((prev) => {
      const list = irrRows;
      const clickedIndex = list.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift) {
        const pivotIndex = lastClickedIrrIndex !== null ? lastClickedIrrIndex : 0;
        const start = Math.min(pivotIndex, clickedIndex);
        const end = Math.max(pivotIndex, clickedIndex);

        if (!isCtrl) {
          next.clear();
        }

        for (let i = start; i <= end; i++) {
          if (list[i]) next.add(list[i].id);
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedIrrIndex(clickedIndex);
      } else {
        if (next.has(id) && next.size === 1) {
          next.delete(id);
        } else {
          next.clear();
          next.add(id);
        }
        setLastClickedIrrIndex(clickedIndex);
      }

      return next;
    });
  };

  const toggleSelectAllIrr = () => {
    if (isLocked) {
      toast.info("Calculation is Approved & Locked. Selection is locked.", { id: "readonly-notice" });
      return;
    }
    if (selectedIrrRows.size === irrRows.length && irrRows.length > 0) {
      setSelectedIrrRows(new Set());
    } else {
      setSelectedIrrRows(new Set(irrRows.map((r) => r.id)));
    }
  };

  // Keydown shortcuts for Ctrl+A, Escape, Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Escape key: clear selection
      if (e.key === "Escape") {
        if (selectedWdRows.size > 0 || selectedIrrRows.size > 0) {
          e.preventDefault();
          setSelectedWdRows(new Set());
          setSelectedIrrRows(new Set());
          setLastClickedWdIndex(null);
          setLastClickedIrrIndex(null);
          toast.info("Cleared selection");
        }
        return;
      }

      // Skip shortcut keys if focused inside a text input / select box
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

      if (isLocked) {
        if (isCmdOrCtrl && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
          e.preventDefault();
          toast.info("Calculation is Approved & Locked. Selection is locked.", { id: "readonly-notice" });
          return;
        }
        if (
          ["Delete", "Backspace"].includes(e.key) ||
          (isCmdOrCtrl && ["x", "v", "d", "z", "y"].includes(e.key.toLowerCase()))
        ) {
          e.preventDefault();
          toast.info("Calculation is Approved & Locked. Modifications are locked.", { id: "readonly-notice" });
          return;
        }
      }

      // 2. Ctrl+A / Cmd+A: Select All rows
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (tab === "demand" && demandSection === "domestic") {
          if (filteredAndSortedWdRows.length > 0) {
            setSelectedWdRows(new Set(filteredAndSortedWdRows.map((r) => r.id)));
            toast.info(`Selected all ${filteredAndSortedWdRows.length} domestic entry(s)`);
          }
        } else if (tab === "demand" && demandSection === "irrigation") {
          if (irrRows.length > 0) {
            setSelectedIrrRows(new Set(irrRows.map((r) => r.id)));
            toast.info(`Selected all ${irrRows.length} irrigation entry(s)`);
          }
        }
        return;
      }

      // 3. Delete / Backspace: Delete selected rows (with ventilation-style confirmation)
      if (e.key === "Delete" || e.key === "Backspace") {
        if (tab === "demand" && demandSection === "domestic" && selectedWdRows.size > 0) {
          e.preventDefault();
          const count = selectedWdRows.size;
          const firstRow = wdRows.find((r) => selectedWdRows.has(r.id));
          const msg = count === 1 && firstRow
            ? `Are you sure you want to delete space "${firstRow.name}"?`
            : `Are you sure you want to delete the ${count} selected spaces?`;

          confirm(msg, {
            title: count === 1 ? "Delete Space" : "Delete Spaces",
            confirmText: "Delete",
            cancelText: "Cancel",
            variant: "destructive",
          }).then((ok: any) => {
            if (ok) {
              setWdRows((prev) => prev.filter((r) => !selectedWdRows.has(r.id)));
              setSelectedWdRows(new Set());
              setLastClickedWdIndex(null);
              toast.info(`Deleted ${count} space(s)`);
            }
          });
        } else if (tab === "demand" && demandSection === "irrigation" && selectedIrrRows.size > 0) {
          e.preventDefault();
          const count = selectedIrrRows.size;
          const firstRow = irrRows.find((r) => selectedIrrRows.has(r.id));
          const msg = count === 1 && firstRow
            ? `Are you sure you want to delete zone "${firstRow.vegType}"?`
            : `Are you sure you want to delete the ${count} selected zones?`;

          confirm(msg, {
            title: count === 1 ? "Delete Zone" : "Delete Zones",
            confirmText: "Delete",
            cancelText: "Cancel",
            variant: "destructive",
          }).then((ok: any) => {
            if (ok) {
              setIrrRows((prev) => prev.filter((r) => !selectedIrrRows.has(r.id)));
              setSelectedIrrRows(new Set());
              setLastClickedIrrIndex(null);
              toast.info(`Deleted ${count} zone(s)`);
            }
          });
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedWdRows, selectedIrrRows, filteredAndSortedWdRows, irrRows, tab, demandSection, isLocked]);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_water_demand_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.presetStandard) setPresetStandard(data.presetStandard);
        if (data.storageDays !== undefined) setStorageDays(data.storageDays);
        if (data.groundTankPct !== undefined) setGroundTankPct(data.groundTankPct);
        if (data.overheadTanks) setOverheadTanks(data.overheadTanks);
        if (data.peakFactor !== undefined) setPeakFactor(data.peakFactor);
        if (data.fillWindowHours !== undefined) setFillWindowHours(data.fillWindowHours);
        if (data.wdRows) setWdRows(data.wdRows);
        if (data.irrRows) setIrrRows(data.irrRows);
        if (data.colWidths) setColWidths(data.colWidths);
        if (data.poolArea !== undefined) setPoolArea(data.poolArea);
        if (data.poolDepth !== undefined) setPoolDepth(data.poolDepth);
        if (data.poolEvap !== undefined) setPoolEvap(data.poolEvap);
        if (data.poolComments) setPoolComments(data.poolComments);
        if (data.poolFlagged !== undefined) setPoolFlagged(data.poolFlagged);
        if (data.fireFlow !== undefined) setFireFlow(data.fireFlow);
        if (data.fireComments) setFireComments(data.fireComments);
        if (data.fireFlagged !== undefined) setFireFlagged(data.fireFlagged);
      } else {
        // Reset to defaults
        setUnitSystem("si");
        setPresetStandard("dewa");
        setStorageDays(1);
        setGroundTankPct(100);
        setOverheadTanks([{ id: 1, name: "Overhead Roof Tank 1", splitPct: 40 }]);
        setPeakFactor(2.5);
        setFillWindowHours(2);
        setWdRows([
          { id: 1, name: "Apartment Block A", ppl: 150, cat: "Residential buildings (flat)", lpd: 300, autoDetected: true, comments: [] },
          { id: 2, name: "Ground Floor Offices", ppl: 45, cat: "Offices", lpd: 60, autoDetected: true, comments: [] },
        ]);
        setIrrRows([
          { id: 1, area: 120, vegType: "Lawn with pop-up sprays", lpd: 10, comments: [] },
          { id: 2, area: 15, vegType: "Palm Trees", lpd: 150, comments: [] },
        ]);
        setPoolArea("");
        setPoolDepth("");
        setPoolEvap(10);
        setPoolComments([]);
        setPoolFlagged(false);
        setFireFlow("");
        setFireComments([]);
        setFireFlagged(false);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load water demand calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        presetStandard,
        storageDays,
        groundTankPct,
        overheadTanks,
        peakFactor,
        fillWindowHours,
        wdRows,
        newWdName,
        newWdPeople,
        newWdCat,
        irrRows,
        newIrrArea,
        newIrrVegType,
        poolArea,
        poolDepth,
        poolEvap,
        poolComments,
        poolFlagged,
        fireFlow,
        fireComments,
        fireFlagged,
        colWidths,
      };
      localStorage.setItem(`mep_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [
    project?.id,
    loadedProjectId,
    unitSystem,
    presetStandard,
    storageDays,
    groundTankPct,
    overheadTanks,
    peakFactor,
    fillWindowHours,
    wdRows,
    newWdName,
    newWdPeople,
    newWdCat,
    irrRows,
    newIrrArea,
    newIrrVegType,
    poolArea,
    poolDepth,
    poolEvap,
    poolComments,
    poolFlagged,
    fireFlow,
    fireComments,
    fireFlagged,
    colWidths,
  ]);

  const handleSaveCurrent = () => {
    try {
      const dataToSave = {
        unitSystem,
        presetStandard,
        storageDays,
        groundTankPct,
        overheadTanks,
        peakFactor,
        fillWindowHours,
        wdRows,
        irrRows,
        poolArea,
        poolDepth,
        poolEvap,
        fireFlow,
        colWidths,
      };
      localStorage.setItem(`mep_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      if (forceSaveToCloud) forceSaveToCloud();
      toast.success("Water Demand Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const ip = unitSystem === "ip";

  const calculations = useMemo(() => {
    return computeWaterDemandCalculations(
      wdRows, irrRows, poolArea, poolDepth, poolEvap, fireFlow,
      storageDays, groundTankPct, overheadTanks, peakFactor, fillWindowHours, ip
    );
  }, [wdRows, irrRows, poolArea, poolDepth, poolEvap, fireFlow, storageDays, groundTankPct, overheadTanks, peakFactor, fillWindowHours, ip]);

  // Domestic Handlers
  const handleAddWd = () => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      setShowAddWdModal(false);
      return;
    }
    if (!newWdName.trim()) {
      toast.error("Please enter a description for the space");
      return;
    }
    const cat = newWdCat || "Offices";
    let lpd = 0;
    if (cat === "Custom Rate / Category") {
      const userVal = newWdCustomLpd !== "" ? Number(newWdCustomLpd) : 100;
      lpd = unitSystem === "ip" ? Math.round(userVal * 3.78541) : userVal;
    } else {
      const baseLpd = WD_TYPE_MAP[cat] || 60;
      const mult = PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0;
      lpd = Math.round(baseLpd * mult);
    }

    const multVal = newWdMultiplier !== "" && Number(newWdMultiplier) > 0 ? Number(newWdMultiplier) : 1;
    const pplVal = newWdPeople !== "" ? Math.max(0, Number(newWdPeople)) : 1;

    setWdRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newWdName.trim(),
        ppl: pplVal,
        cat: cat,
        lpd,
        multiplier: multVal,
        autoDetected: newWdAutoDetected,
        comments: [],
      },
    ]);
    toast.success(`Added "${newWdName.trim()}"`);
    setNewWdName("");
    setNewWdPeople("");
    setNewWdCat("");
    setNewWdCustomLpd("");
    setNewWdMultiplier(1);
    setNewWdAutoDetected(false);
    setShowAddWdModal(false);
  };

  // Irrigation Handlers
  const handleAddIrr = () => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      setShowAddIrrModal(false);
      return;
    }
    const areaVal = Number(newIrrArea);
    if (!areaVal || areaVal <= 0) {
      toast.error("Please enter a valid landscape area");
      return;
    }
    const vegType = newIrrVegType || "Lawn with pop-up sprays";
    const lpd = IRR_TYPE_MAP[vegType] || 10;

    setIrrRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        area: areaVal,
        vegType,
        lpd,
        comments: [],
      },
    ]);
    toast.success(`Added "${vegType}" (${areaVal} ${unitSystem === "ip" ? "ft²" : "m²"})`);
    setNewIrrArea("");
    setNewIrrVegType("");
    setShowAddIrrModal(false);
  };

  const handleWdRowChange = (id: number, field: "name" | "ppl" | "cat" | "lpd" | "multiplier", val: any) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    setWdRows(
      wdRows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: val };
        if (field === "name") {
          const detected = detectAshraeOccupancy(val);
          if (detected) {
            updated.ppl = detected.people;
            if (detected.cat) {
              updated.cat = detected.cat;
              const baseLpd = WD_TYPE_MAP[detected.cat] || 0;
              const mult = PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0;
              updated.lpd = Math.round(baseLpd * mult);
            }
            updated.autoDetected = true;
          }
        } else if (field === "cat" && val !== "Custom Rate / Category") {
          const baseLpd = WD_TYPE_MAP[val] || 0;
          const mult = PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0;
          updated.lpd = Math.round(baseLpd * mult);
        }
        return updated;
      })
    );
  };

  const handleIrrRowChange = (id: number, field: "area" | "vegType", val: any) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    setIrrRows(
      irrRows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: val };
        if (field === "vegType") {
          updated.lpd = IRR_TYPE_MAP[val] || 0;
        }
        return updated;
      })
    );
  };

  // Save comment to row & dispatch notifications
  const handleSaveRowComment = async (comment: any) => {
    if (!commentTarget) return;
    const { rowId, isIrrigation, isPool, isFire, targetName, targetType } = commentTarget;

    const enrichedComment = {
      ...comment,
      calculatorTitle: "Water Demand Calculator",
      calculatorPath: "/plumbing-water-demand",
      targetId: String(rowId || (isPool ? "swimming_pool" : isFire ? "fire_fighting" : "water_demand")),
      targetName,
      targetType,
      projectId: project?.id || "default",
      projectName: project?.name || "MEP Calculator Project",
    };

    if (isPool) {
      setPoolComments((prev) => [enrichedComment, ...prev]);
    } else if (isFire) {
      setFireComments((prev) => [enrichedComment, ...prev]);
    } else if (isIrrigation) {
      setIrrRows((prev) =>
        prev.map((r) => {
          if (r.id === rowId) {
            const nextComments = [enrichedComment, ...(r.comments || [])];
            return { ...r, comments: nextComments };
          }
          return r;
        })
      );
    } else {
      setWdRows((prev) =>
        prev.map((r) => {
          if (r.id === rowId) {
            const nextComments = [enrichedComment, ...(r.comments || [])];
            return { ...r, comments: nextComments };
          }
          return r;
        })
      );
    }

    dispatchGlobalCommentNotification(enrichedComment, {
      project,
      currentUserName,
      currentUserId,
    });

    toast.success("Task comment added & notification dispatched to selected users!");
    setCommentTarget(null);
  };

  const handleToggleWdFlag = (id: number) => {
    const isTargetSelected = selectedWdRows.has(id);
    const targetIds = isTargetSelected && selectedWdRows.size > 1 ? Array.from(selectedWdRows) : [id];
    const targetRow = wdRows.find((r) => r.id === id);
    const nextState = !targetRow?.flagged;

    setWdRows((prev) =>
      prev.map((r) => (targetIds.includes(r.id) ? { ...r, flagged: nextState } : r))
    );
    toast.info(nextState ? `Flagged ${targetIds.length} space(s) for review` : `Unflagged ${targetIds.length} space(s)`);
  };

  const handleToggleIrrFlag = (id: number) => {
    const isTargetSelected = selectedIrrRows.has(id);
    const targetIds = isTargetSelected && selectedIrrRows.size > 1 ? Array.from(selectedIrrRows) : [id];
    const targetRow = irrRows.find((r) => r.id === id);
    const nextState = !targetRow?.flagged;

    setIrrRows((prev) =>
      prev.map((r) => (targetIds.includes(r.id) ? { ...r, flagged: nextState } : r))
    );
    toast.info(nextState ? `Flagged ${targetIds.length} zone(s) for review` : `Unflagged ${targetIds.length} zone(s)`);
  };

  // PDF Exporter (Matching Ventilation & Preliminary Cooling Load Standard)
  const handleExportPDF = async () => {
    try {
      await exportWaterDemandPDF({
        calculations,
        wdRows,
        irrRows,
        poolArea,
        poolDepth,
        poolEvap,
        fireFlow,
        storageDays,
        groundTankPct,
        overheadTanks,
        fillWindowHours,
        peakFactor,
        unitSystem,
        presetStandard,
        meta: {
          projectName: project?.name,
          client: project?.client,
          projectNo: project?.code || (project as any)?.projectNo,
          calcNo: (project as any)?.calcNo,
          endUser: (project as any)?.endUser || (project as any)?.location,
          date: formatDateStr(new Date().toISOString()),
          userName: currentUserName,
          reviewState: calcReviewState,
        },
      });
    } catch (e) {
      console.error("PDF Export error:", e);
      toast.error("Failed to generate PDF report.");
    }
  };

  return (
    <AppShell title="Water Demand & Tank Sizer" hideSubHeader={true} onIntelClick={() => setIntelOpen((v) => !v)} intelOpen={intelOpen}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          {/* Header Bar */}
          <div className="flex justify-between items-center shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                  Water Demand &amp; Tank Sizer
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
                title="Toggle Water Demand Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-water-demand" calculatorTitle="Water Demand & Tank Sizer" />
            </div>

            {/* Right Side Header Controls: Unit System Toggle */}
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={executeUnitSystemChange} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* Unified White Card Container (Matching Ventilation Layout Structure) */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"}`}>
            {/* Row 1: Header / Main Tabs on Left + Standard Selector on Right */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/50 gap-4 flex-wrap">
              <div className="flex items-center gap-2 select-none shrink-0 flex-wrap">
                <div className="flex bg-slate-100 dark:bg-slate-900/70 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setTab("demand")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "demand"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Demand Sizing
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab("tanks")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "tanks"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Storage &amp; Pumps
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report
                  </button>
                </div>

                {/* Formula Breakdown button placed on left side right after tabs */}
                <TBtn
                  onClick={() => setShowFormulaModal(true)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Right Side Header Controls: Standard Dropdown and Export */}
              <div className="flex items-center gap-2 select-none shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-1 px-3 rounded-full border border-border/80 text-xs font-semibold select-none">
                  <Globe className="size-3.5 text-primary shrink-0" />
                  <label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Standard:</label>
                  <select
                    value={presetStandard}
                    onChange={(e) => setPresetStandard(e.target.value)}
                    className="bg-background border border-border/60 rounded-full px-2.5 py-0.5 text-xs font-bold text-foreground outline-none focus:border-primary shadow-2xs cursor-pointer h-7"
                    title={PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.desc}
                  >
                    {Object.keys(PRESET_STANDARDS).map((key) => (
                      <option key={key} value={key}>
                        {PRESET_STANDARDS[key as keyof typeof PRESET_STANDARDS].name}
                      </option>
                    ))}
                  </select>
                </div>
                <TBtn onClick={handleExportPDF} title="Export PDF Calculation">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Row 2: Action Toolbar (Search, Filter, Sort, View Options, Auto-Calculate, Import, Export, + New Entry Matching Ventilation) */}
            {tab === "demand" && (
              <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print modal-blur-bg select-none">
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
                      title="Filter entries"
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
                      <span className="text-xs font-semibold text-foreground">Filters</span>
                      {activeFiltersCount > 0 && (
                        <button onClick={handleResetFilters} className="text-[10px] text-primary hover:underline font-semibold cursor-pointer">
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Occupancy Category</span>
                      <select
                        value={selectedCatFilter}
                        onChange={(e) => setSelectedCatFilter(e.target.value)}
                        className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                      >
                        <option value="">All Categories</option>
                        {Object.keys(WD_TYPE_MAP).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                      <span className="text-[11.5px] font-medium text-foreground">Flagged spaces only</span>
                      <input
                        type="checkbox"
                        checked={filterFlaggedOnly}
                        onChange={(e) => setFilterFlaggedOnly(e.target.checked)}
                        className="size-4 rounded accent-primary cursor-pointer"
                      />
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Sort Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                        sortBy !== "none"
                          ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                          : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      }`}
                      title="Sort entries"
                    >
                      <ArrowUpDown className="size-3.5 shrink-0" />
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                        Sort
                      </span>
                      {sortBy !== "none" && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                          ✓
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border">
                      <span className="text-xs font-semibold text-foreground">Sort Options</span>
                      {sortBy !== "none" && (
                        <button onClick={handleResetSort} className="text-[10px] text-primary hover:underline font-semibold cursor-pointer">
                          Reset Sort
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                      >
                        <option value="none">Default Order</option>
                        <option value="name">Description Name</option>
                        <option value="ppl">People / Units Count</option>
                        <option value="lpd">Per Capita Rate (LPD)</option>
                        <option value="load">Daily Water Load</option>
                      </select>
                    </div>
                    {sortBy !== "none" && (
                      <div className="flex items-center justify-between pt-1 border-t border-border/60">
                        <span className="text-[11px] font-semibold text-muted-foreground">Order</span>
                        <button
                          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                          className="px-2 py-1 text-[11px] font-bold text-primary bg-primary/10 rounded-md hover:bg-primary/20 cursor-pointer"
                        >
                          {sortOrder === "asc" ? "Ascending ↑" : "Descending ↓"}
                        </button>
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
                          localStorage.removeItem("mep_grid_water_demand");
                          setColWidths(DEFAULT_WD_COL_WIDTHS);
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

                {/* Right Side Actions */}
                <div className="ml-auto flex items-center gap-1">
                  <input
                    type="file"
                    ref={importFileRef}
                    onChange={handleImportExcelFile}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <TBtn
                    disabled={isEffectiveReadOnly}
                    onClick={() => {
                      if (isEffectiveReadOnly) {
                        toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to auto-calculate.", { id: "readonly-notice" });
                        return;
                      }
                      setPreviewTarget({ type: "summary" });
                      setPreviewModalOpen(true);
                    }}
                  >
                    <Sparkles className="size-3.5 text-primary" /> Auto-Calculate
                  </TBtn>
                  <TBtn
                    disabled={isEffectiveReadOnly}
                    onClick={() => {
                      if (isEffectiveReadOnly) {
                        toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to import entries.", { id: "readonly-notice" });
                        return;
                      }
                      importFileRef.current?.click();
                    }}
                  >
                    <Upload className="size-3.5" /> Import
                  </TBtn>
                  <TBtn
                    primary
                    disabled={isEffectiveReadOnly}
                    onClick={() => {
                      if (isEffectiveReadOnly) {
                        toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to add entries.", { id: "readonly-notice" });
                        return;
                      }
                      if (demandSection === "irrigation") {
                        const newId = Date.now();
                        const areaVal = 100;
                        const vegType = "Lawn with pop-up sprays";
                        const lpd = IRR_TYPE_MAP[vegType] || 10;
                        const newRow = { id: newId, area: areaVal, vegType, lpd, comments: [] };
                        setIrrRows((prev) => [...prev, newRow]);
                        setPreviewTarget({ type: "irrigation", rowId: newId });
                        setPreviewModalOpen(true);
                        toast.success("New Irrigation Zone added! Edit details in popup.");
                      } else {
                        const newId = Date.now();
                        const nextNum = wdRows.length + 1;
                        const cat = "Offices";
                        const baseLpd = WD_TYPE_MAP[cat] || 60;
                        const mult = PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0;
                        const lpd = Math.round(baseLpd * mult);
                        const newRow = {
                          id: newId,
                          name: `Space ${nextNum}`,
                          ppl: 10,
                          cat,
                          lpd,
                          multiplier: 1,
                          autoDetected: false,
                          comments: [],
                        };
                        setWdRows((prev) => [...prev, newRow]);
                        setPreviewTarget({ type: "domestic", rowId: newId });
                        setPreviewModalOpen(true);
                        toast.success("New Domestic Space added! Edit details in popup.");
                      }
                    }}
                  >
                    <Plus className="size-3.5" /> New Entry
                  </TBtn>
                </div>

                {/* Bulk actions bar overlay */}
                {demandSection === "domestic" && selectedWdRows.size > 0 && (
                  <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                    <span className="font-semibold">{selectedWdRows.size} selected</span>
                    <span className="text-primary/30">·</span>
                    <BulkBtn
                      icon={Calculator}
                      onClick={() => {
                        const firstId = Array.from(selectedWdRows)[0];
                        const row = wdRows.find((r) => r.id === firstId);
                        if (row) {
                          setPreviewTarget({ type: "domestic", rowId: row.id });
                          setPreviewModalOpen(true);
                        }
                      }}
                    >
                      Breakdown
                    </BulkBtn>
                    <BulkBtn
                      icon={Flag}
                      onClick={() => {
                        setWdRows((prev) =>
                          prev.map((r) =>
                            selectedWdRows.has(r.id) ? { ...r, flagged: !r.flagged } : r
                          )
                        );
                        toast.info(`Updated flag status for ${selectedWdRows.size} entry(s)`);
                      }}
                    >
                      Flag
                    </BulkBtn>
                    <BulkBtn
                      icon={Copy}
                      onClick={() => {
                        const clones = wdRows
                          .filter((r) => selectedWdRows.has(r.id))
                          .map((r, i) => ({
                            ...r,
                            id: Date.now() + i,
                            name: `${r.name} (Copy)`,
                          }));
                        setWdRows((prev) => [...prev, ...clones]);
                        toast.success(`Duplicated ${clones.length} space(s)`);
                      }}
                    >
                      Duplicate
                    </BulkBtn>
                    <BulkBtn
                      icon={Trash2}
                      onClick={() => {
                        const count = selectedWdRows.size;
                        const firstRow = wdRows.find((r) => selectedWdRows.has(r.id));
                        const msg = count === 1 && firstRow
                          ? `Are you sure you want to delete space "${firstRow.name}"?`
                          : `Are you sure you want to delete the ${count} selected spaces?`;

                        confirm(msg, {
                          title: count === 1 ? "Delete Space" : "Delete Spaces",
                          confirmText: "Delete",
                          cancelText: "Cancel",
                          variant: "destructive",
                        }).then((ok: any) => {
                          if (ok) {
                            setWdRows((prev) => prev.filter((r) => !selectedWdRows.has(r.id)));
                            setSelectedWdRows(new Set());
                            setLastClickedWdIndex(null);
                            toast.info(`Deleted ${count} space(s)`);
                          }
                        });
                      }}
                    >
                      Delete
                    </BulkBtn>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWdRows(new Set());
                        setLastClickedWdIndex(null);
                      }}
                      className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                    >
                      <X className="size-3" /> Clear
                    </button>
                  </div>
                )}

                {demandSection === "irrigation" && selectedIrrRows.size > 0 && (
                  <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                    <span className="font-semibold">{selectedIrrRows.size} selected</span>
                    <span className="text-primary/30">·</span>
                    <BulkBtn
                      icon={Calculator}
                      onClick={() => {
                        const firstId = Array.from(selectedIrrRows)[0];
                        const row = irrRows.find((r) => r.id === firstId);
                        if (row) {
                          setPreviewTarget({ type: "irrigation", rowId: row.id });
                          setPreviewModalOpen(true);
                        }
                      }}
                    >
                      Breakdown
                    </BulkBtn>
                    <BulkBtn
                      icon={Flag}
                      onClick={() => {
                        setIrrRows((prev) =>
                          prev.map((r) =>
                            selectedIrrRows.has(r.id) ? { ...r, flagged: !r.flagged } : r
                          )
                        );
                        toast.info(`Updated flag status for ${selectedIrrRows.size} irrigation entry(s)`);
                      }}
                    >
                      Flag
                    </BulkBtn>
                    <BulkBtn
                      icon={Copy}
                      onClick={() => {
                        const clones = irrRows
                          .filter((r) => selectedIrrRows.has(r.id))
                          .map((r, i) => ({
                            ...r,
                            id: Date.now() + i,
                            vegType: `${r.vegType} (Copy)`,
                          }));
                        setIrrRows((prev) => [...prev, ...clones]);
                        toast.success(`Duplicated ${clones.length} irrigation zone(s)`);
                      }}
                    >
                      Duplicate
                    </BulkBtn>
                    <BulkBtn
                      icon={Trash2}
                      onClick={() => {
                        const count = selectedIrrRows.size;
                        const firstRow = irrRows.find((r) => selectedIrrRows.has(r.id));
                        const msg = count === 1 && firstRow
                          ? `Are you sure you want to delete zone "${firstRow.vegType}"?`
                          : `Are you sure you want to delete the ${count} selected zones?`;

                        confirm(msg, {
                          title: count === 1 ? "Delete Zone" : "Delete Zones",
                          confirmText: "Delete",
                          cancelText: "Cancel",
                          variant: "destructive",
                        }).then((ok: any) => {
                          if (ok) {
                            setIrrRows((prev) => prev.filter((r) => !selectedIrrRows.has(r.id)));
                            setSelectedIrrRows(new Set());
                            setLastClickedIrrIndex(null);
                            toast.info(`Deleted ${count} zone(s)`);
                          }
                        });
                      }}
                    >
                      Delete
                    </BulkBtn>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIrrRows(new Set());
                        setLastClickedIrrIndex(null);
                      }}
                      className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                    >
                      <X className="size-3" /> Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Category Sub-Tabs Row (Domestic, Irrigation, Pool, Fire) */}
            {tab === "demand" && (
              <div className="px-4 py-2 bg-slate-100/40 dark:bg-slate-900/20 shrink-0 select-none no-print border-b border-border/50">
                <div className="flex bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-full gap-1 border border-border/60 overflow-x-auto w-fit">
                  <button
                    type="button"
                    onClick={() => setDemandSection("domestic")}
                    className={`px-3.5 py-1 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 rounded-full ${
                      demandSection === "domestic"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground font-semibold"
                    }`}
                  >
                    <Building2 className={`size-3.5 ${demandSection === "domestic" ? "text-[#0A7BC7]" : "text-slate-500"}`} />
                    Domestic Water Demand
                    <span
                      className={`ml-0.5 px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                        demandSection === "domestic"
                          ? "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          : "bg-slate-200/40 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {wdRows.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemandSection("irrigation")}
                    className={`px-3.5 py-1 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 rounded-full ${
                      demandSection === "irrigation"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground font-semibold"
                    }`}
                  >
                    <Globe className="size-3.5 text-emerald-500" />
                    Irrigation Water Demand
                    <span
                      className={`ml-0.5 px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                        demandSection === "irrigation"
                          ? "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          : "bg-slate-200/40 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {irrRows.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemandSection("pool")}
                    className={`px-3.5 py-1 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 rounded-full ${
                      demandSection === "pool"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground font-semibold"
                    }`}
                  >
                    <Droplet className="size-3.5 text-sky-500" />
                    Swimming Pool Makeup
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemandSection("fire")}
                    className={`px-3.5 py-1 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 rounded-full ${
                      demandSection === "fire"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground font-semibold"
                    }`}
                  >
                    <Flag className="size-3.5 text-red-500" />
                    Fire Fighting Reserve Sizing
                  </button>
                </div>
              </div>
            )}

            {/* Row 3: Tab Content Body Area */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* 1. Domestic Water Demand Schedule */}
              {tab === "demand" && (
                <>
                  {demandSection === "domestic" && (
                    <div className="flex flex-col gap-0 flex-1 min-h-0 relative">
                    {/* Domestic Table */}
                    <div className="overflow-x-hidden overflow-y-auto w-full flex-1 min-h-0 custom-scrollbar">
                      <table className="w-full table-fixed border-collapse text-[13.5px] font-sans text-left">
                        <thead>
                          <tr className="bg-background dark:bg-[#1a1a1a] border-t border-b border-border-strong text-muted-foreground uppercase text-[11.5px] tracking-wider font-semibold select-none h-10">
                            <th style={getWdColStyle("select")} className="py-0 px-0 text-center relative group w-9 min-w-[36px] border-r border-border/60">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isLocked) {
                                    toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
                                    return;
                                  }
                                  toggleSelectAllWd();
                                }}
                                disabled={isLocked}
                                title={filteredAndSortedWdRows.length > 0 && selectedWdRows.size === filteredAndSortedWdRows.length ? "Deselect all rows" : "Select all rows"}
                                className="h-full w-full flex items-center justify-center text-[11px] font-mono font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed group/head-idx"
                              >
                                <span className={filteredAndSortedWdRows.length > 0 && selectedWdRows.size === filteredAndSortedWdRows.length ? "text-primary font-bold" : ""}>#</span>
                              </button>
                            </th>
                            <th style={getWdColStyle("name")} className="py-2 px-3 text-left relative group border-r border-border/60">
                              DESCRIPTION
                            </th>
                            <th style={getWdColStyle("ppl")} className="py-2 px-3 text-center relative group border-r border-border/60">
                              PEOPLE / UNIT
                            </th>
                            <th style={getWdColStyle("multiplier")} className="py-2 px-3 text-center relative group border-r border-border/60">
                              SPACE MULTIPLIER
                            </th>
                            <th style={getWdColStyle("cat")} className="py-2 px-3 text-left relative group border-r border-border/60">
                              CATEGORY
                            </th>
                            <th style={getWdColStyle("lpd")} className="py-2 px-3 text-center relative group border-r border-border/60">
                              PER CAPITA RATE ({ip ? "GPD" : "LPD"})
                            </th>
                            <th style={getWdColStyle("load")} className="py-2 px-3 text-center relative group border-r border-border/60">
                              DAILY LOAD ({ip ? "GAL/DAY" : "L/DAY"})
                            </th>
                            <th style={getWdColStyle("actions")} className="py-0 px-0 text-center relative group w-9 min-w-[36px]">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAndSortedWdRows.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-muted-foreground italic">
                                {wdRows.length === 0
                                  ? "No domestic entries added. Fill in the form above or click Import to populate."
                                  : "No domestic entries match the active search/filter criteria."}
                              </td>
                            </tr>
                          ) : (
                            filteredAndSortedWdRows.map((r, idx) => (
                              <ContextMenu key={r.id}>
                                <ContextMenuTrigger asChild>
                                  <tr
                                    id={`row-${r.id}`}
                                    data-row-id={r.id}
                                    onMouseDownCapture={(e) => {
                                      if (isLocked) return;
                                      const target = e.target as HTMLElement;
                                      if (target.closest('.group\\/row-cell') || target.closest('button')) return;
                                      const isInputTarget = target.tagName === "INPUT" || target.tagName === "SELECT" || Boolean(target.closest("input, select"));
                                      if (!selectedWdRows.has(r.id)) {
                                        if (isInputTarget) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }
                                        toggleWdRowSelection(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                      }
                                    }}
                                    onClickCapture={(e) => {
                                      if (isLocked) return;
                                      const target = e.target as HTMLElement;
                                      if (target.closest('.group\\/row-cell') || target.closest('button')) return;
                                      const isInputTarget = target.tagName === "INPUT" || target.tagName === "SELECT" || Boolean(target.closest("input, select"));
                                      if (!selectedWdRows.has(r.id) && isInputTarget) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }
                                    }}
                                    onClick={(e) => {
                                      if (isLocked) return;
                                      const target = e.target as HTMLElement;
                                      if (target.closest('.group\\/row-cell') || target.closest('button')) return;
                                      if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                        toggleWdRowSelection(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                      }
                                    }}
                                    onDoubleClick={(e) => {
                                      if (isLocked) return;
                                      setSelectedWdRows(new Set([r.id]));
                                      setPreviewTarget({ type: "domestic", rowId: r.id });
                                      setPreviewModalOpen(true);
                                    }}
                                    title={isLocked ? undefined : "Click to select, click again to edit, Shift+Click for range. Double-click for calculation breakdown."}
                                    className={`group h-[30px] border-b border-border/40 hover:bg-muted/30 dark:hover:bg-white/[0.03] text-[13.5px] transition-colors ${isLocked ? "cursor-default" : "cursor-pointer"} select-none ${
                                      previewModalOpen && previewTarget?.type === "domestic" && previewTarget?.rowId === r.id
                                        ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                                        : previewModalOpen
                                        ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200"
                                        : selectedWdRows.has(r.id)
                                        ? "bg-row-selected bg-primary/15 text-primary font-medium border-l-2 border-l-primary"
                                        : "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80"
                                    }`}
                                  >
                                    <td 
                                      style={getWdColStyle("select")} 
                                      className={`px-1 h-[30px] flex items-center justify-center border-r border-border/40 relative group/row-cell select-none cursor-pointer transition-colors duration-150 ${
                                        selectedWdRows.has(r.id)
                                          ? "bg-primary/15 text-primary font-bold shadow-inner"
                                          : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        toggleWdRowSelection(r.id, e.shiftKey, true);
                                      }}
                                      title={selectedWdRows.has(r.id) ? `Row ${idx + 1} selected. Click to deselect.` : `Click to select row ${idx + 1}.`}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <RowCommentCornerBadge
                                        id={r.id}
                                        count={r.comments?.length}
                                        onClick={() =>
                                          setCommentTarget({
                                            targetId: String(r.id),
                                            targetName: r.name,
                                            targetType: "Domestic Water Load",
                                            rowId: r.id,
                                            isIrrigation: false,
                                            existingComments: r.comments || [],
                                          })
                                        }
                                      />
                                      <span className="text-[11px] font-mono leading-none tracking-tight">
                                        {idx + 1}
                                      </span>
                                    </td>
                                    <td 
                                      style={getWdColStyle("name")} 
                                      className={`py-0 px-2 h-[30px] border-r border-border/40 ${
                                        !selectedWdRows.has(r.id)
                                          ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors"
                                          : "group/cell cursor-text"
                                      }`}
                                      title={!selectedWdRows.has(r.id) ? "Click to select row, click again to edit" : undefined}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <div className={`flex items-center gap-2 w-full h-full min-w-0 ${!selectedWdRows.has(r.id) ? "pointer-events-none select-none" : "pointer-events-auto"}`}>
                                        <input
                                          type="text"
                                          value={r.name}
                                          disabled={isLocked}
                                          onChange={(e) => handleWdRowChange(r.id, "name", e.target.value)}
                                          onDoubleClick={(e) => e.stopPropagation()}
                                          className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded font-medium text-[13.5px] text-foreground transition-colors"
                                        />
                                      </div>
                                    </td>
                                    <td 
                                      style={getWdColStyle("ppl")} 
                                      className={`py-0 px-2 h-[30px] text-center font-mono tabular text-[13.5px] border-r border-border/40 ${
                                        !selectedWdRows.has(r.id)
                                          ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors"
                                          : "group/cell cursor-text"
                                      }`}
                                      title={!selectedWdRows.has(r.id) ? "Click to select row, click again to edit" : undefined}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <div className={`w-full h-full flex items-center justify-center gap-1.5 min-w-0 ${!selectedWdRows.has(r.id) ? "pointer-events-none select-none" : "pointer-events-auto"}`}>
                                        {r.autoDetected && (
                                          <span
                                            className="size-1.5 rounded-full bg-blue-500 shrink-0 inline-block"
                                            title="Auto-detected occupancy benchmark according to ASHRAE / DEWA standard"
                                          />
                                        )}
                                        <input
                                          type="number"
                                          value={r.ppl}
                                          disabled={isLocked}
                                          onChange={(e) => handleWdRowChange(r.id, "ppl", Number(e.target.value))}
                                          onDoubleClick={(e) => e.stopPropagation()}
                                          className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                      </div>
                                    </td>
                                    <td 
                                      style={getWdColStyle("multiplier")} 
                                      className={`py-0 px-2 h-[30px] text-center font-mono tabular text-[13.5px] border-r border-border/40 ${
                                        !selectedWdRows.has(r.id)
                                          ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors"
                                          : "group/cell cursor-text"
                                      }`}
                                      title={!selectedWdRows.has(r.id) ? "Click to select row, click again to edit" : undefined}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <div className={`w-full h-full flex items-center justify-center min-w-0 ${!selectedWdRows.has(r.id) ? "pointer-events-none select-none" : "pointer-events-auto"}`}>
                                        <input
                                          type="number"
                                          min={1}
                                          value={r.multiplier || 1}
                                          disabled={isLocked}
                                          onChange={(e) => handleWdRowChange(r.id, "multiplier", Math.max(1, Number(e.target.value)))}
                                          onDoubleClick={(e) => e.stopPropagation()}
                                          className="w-14 bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] font-bold text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          title="Space multiplier / quantity of identical spaces"
                                        />
                                      </div>
                                    </td>
                                    <td 
                                      style={getWdColStyle("cat")} 
                                      className={`py-0 px-2 h-[30px] border-r border-border/40 ${
                                        !selectedWdRows.has(r.id)
                                          ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors"
                                          : "group/cell cursor-pointer"
                                      }`}
                                      title={!selectedWdRows.has(r.id) ? "Click to select row, click again to edit" : undefined}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <div className={`relative w-full h-full flex items-center min-w-0 ${!selectedWdRows.has(r.id) ? "pointer-events-none select-none" : "pointer-events-auto"}`}>
                                        <select
                                          value={r.cat}
                                          disabled={isLocked}
                                          onChange={(e) => handleWdRowChange(r.id, "cat", e.target.value)}
                                          className="w-full bg-transparent border border-transparent hover:bg-surface-2 hover:border-muted-foreground/20 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-0.5 pl-1 pr-5 rounded text-[13px] font-medium transition-all cursor-pointer text-foreground appearance-none truncate"
                                        >
                                          <option value="" disabled hidden>Select Category...</option>
                                          <option value="Custom Rate / Category">Other (Custom Rate)</option>
                                          {Object.keys(WD_TYPE_MAP).filter(k => k !== "Custom Rate / Category").map((k) => (
                                            <option key={k} value={k}>
                                              {k}
                                            </option>
                                          ))}
                                          {r.cat && !WD_TYPE_MAP[r.cat] && r.cat !== "Custom Rate / Category" && (
                                            <option value={r.cat}>{r.cat}</option>
                                          )}
                                        </select>
                                      </div>
                                    </td>
                                    <td 
                                      style={getWdColStyle("lpd")} 
                                      className={`py-0 px-2 h-[30px] text-center font-mono tabular text-[13.5px] border-r border-border/40 ${
                                        !selectedWdRows.has(r.id)
                                          ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors"
                                          : "group/cell cursor-text"
                                      }`}
                                      title={!selectedWdRows.has(r.id) ? "Click to select row, click again to edit" : undefined}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <div className={`flex items-center justify-center w-full h-full min-w-0 ${!selectedWdRows.has(r.id) ? "pointer-events-none select-none" : "pointer-events-auto"}`}>
                                        <input
                                          type="number"
                                          value={ip ? Math.round(r.lpd / 3.78541) : r.lpd}
                                          disabled={isLocked}
                                          onChange={(e) => {
                                            const val = Number(e.target.value);
                                            const lpdVal = ip ? Math.round(val * 3.78541) : val;
                                            handleWdRowChange(r.id, "lpd", lpdVal);
                                          }}
                                          onDoubleClick={(e) => e.stopPropagation()}
                                          className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] font-bold text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          title="Per capita consumption rate"
                                        />
                                      </div>
                                    </td>
                                    <td 
                                      style={getWdColStyle("load")} 
                                      className="py-0 px-2 h-[30px] text-center font-mono tabular text-[13.5px] font-semibold text-foreground cursor-pointer border-r border-border/40"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      {(ip ? Math.round((r.ppl * r.lpd * (r.multiplier || 1)) / 3.78541) : r.ppl * r.lpd * (r.multiplier || 1)).toLocaleString()}
                                    </td>
                                    <td style={getWdColStyle("actions")} className="py-0 px-1 h-[30px] text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                      {(() => {
                                        const val = getWdRowValidation(r);
                                        return (
                                          <TooltipProvider delayDuration={150}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleWdFlag(r.id);
                                                  }}
                                                  className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
                                                >
                                                  <Flag
                                                    className={`size-3.5 transition-all duration-200 ${
                                                      val.isFlagged
                                                        ? "fill-red-500 text-red-500 scale-110"
                                                        : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
                                                    }`}
                                                  />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent
                                                side="left"
                                                align="center"
                                                className="max-w-[280px] p-2.5 text-left bg-zinc-900 text-white dark:bg-zinc-800 border border-zinc-700 shadow-xl rounded-xl z-50 animate-in fade-in zoom-in-95 pointer-events-none text-xs"
                                              >
                                                {val.isNoPeople && val.isNoCategory ? (
                                                  <div className="text-[11.5px]">Missing occupancy headcount and space category</div>
                                                ) : val.isNoPeople ? (
                                                  <div className="text-[11.5px]">Missing occupancy headcount (People / Unit must be &gt; 0)</div>
                                                ) : val.isNoCategory ? (
                                                  <div className="text-[11.5px]">Missing space category</div>
                                                ) : val.isNoName ? (
                                                  <div className="text-[11.5px]">Missing space description</div>
                                                ) : val.isNoRate ? (
                                                  <div className="text-[11.5px]">Missing water consumption rate (LPD / GPD)</div>
                                                ) : val.isZeroDemand ? (
                                                  <div className="text-[11.5px]">Daily water demand is 0</div>
                                                ) : val.isManual ? (
                                                  <div className="text-[11.5px]">Flagged space (Click to unflag)</div>
                                                ) : (
                                                  <div className="text-[11.5px]">Click to flag space for manual review</div>
                                                )}
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      })()}
                                    </td>
                                  </tr>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                  {/* Add Comment - AT THE TOP with blue ventilation styling */}
                                  <ContextMenuItem
                                    onClick={() =>
                                      setCommentTarget({
                                        targetId: String(r.id),
                                        targetName: r.name,
                                        targetType: "Domestic Water Load",
                                        rowId: r.id,
                                        isIrrigation: false,
                                        existingComments: r.comments || [],
                                      })
                                    }
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                  >
                                    <MessageSquare className="size-3.5" />
                                    <span>Add Comment</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => {
                                      setPreviewTarget({ type: "domestic", rowId: r.id });
                                      setPreviewModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                                  >
                                    <Calculator className="size-3.5 text-muted-foreground" />
                                    <span>Calculation Breakdown</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</ContextMenuShortcut>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => handleToggleWdFlag(r.id)}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                  >
                                    <Flag className={`size-3.5 ${r.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                                    <span>{r.flagged ? "Unflag Space" : "Flag Space"}</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => {
                                      const dup = { ...r, id: Date.now(), name: `${r.name} (Copy)` };
                                      setWdRows((prev) => [...prev, dup]);
                                      toast.success(`Duplicated "${r.name}"`);
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                  >
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    <span>Duplicate Row</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator className="h-px bg-border my-1" />
                                  <ContextMenuItem
                                    onClick={async () => {
                                      const ok = await confirm(`Are you sure you want to delete space "${r.name}"?`, {
                                        title: "Delete Space",
                                        confirmText: "Delete",
                                        cancelText: "Cancel",
                                        variant: "destructive",
                                      });
                                      if (ok) {
                                        setWdRows((prev) => prev.filter((x) => x.id !== r.id));
                                        toast.info(`Deleted "${r.name}"`);
                                      }
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>Delete Row</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Summary Footer Bar (Matching Ventilation Schedule) */}
                    <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 select-none no-print">
                      <div>Showing <span className="text-foreground font-medium tabular">{filteredAndSortedWdRows.length}</span> of {wdRows.length} spaces</div>
                      <div className="flex items-center gap-4 tabular">
                        <span>Total Occupancy: <strong className="text-foreground font-mono font-bold">{(calculations.totalPeople || 0).toLocaleString()}</strong> People</span>
                        <span>Total Daily Load: <strong className="text-primary font-mono font-bold text-xs">{calculations.displayDomestic}</strong></span>
                      </div>
                    </div>
                  </div>
                )}

                  {/* 2. Irrigation Water Demand Schedule */}
                  {demandSection === "irrigation" && (
                    <div className="flex flex-col gap-0 flex-1 min-h-0 relative">
                      <div className="overflow-x-hidden overflow-y-auto w-full flex-1 min-h-0 custom-scrollbar">
                        <table className="w-full table-fixed border-collapse text-[13.5px] font-sans text-left">
                          <thead>
                            <tr className="bg-background dark:bg-[#1a1a1a] border-t border-b border-border-strong text-muted-foreground uppercase text-[11.5px] tracking-wider font-semibold select-none h-10">
                              <th style={getIrrColStyle("irr_select")} className="py-0 px-0 text-center relative group w-9 min-w-[36px] border-r border-border/60">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isLocked) {
                                      toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
                                      return;
                                    }
                                    toggleSelectAllIrr();
                                  }}
                                  disabled={isLocked}
                                  title={irrRows.length > 0 && selectedIrrRows.size === irrRows.length ? "Deselect all rows" : "Select all rows"}
                                  className="h-full w-full flex items-center justify-center text-[11px] font-mono font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed group/head-idx"
                                >
                                  <span className={irrRows.length > 0 && selectedIrrRows.size === irrRows.length ? "text-primary font-bold" : ""}>#</span>
                                </button>
                              </th>
                              <th style={getIrrColStyle("irr_vegType")} className="py-2 px-3 text-left relative group border-r border-border/60">
                                VEGETATION TYPE
                              </th>
                              <th style={getIrrColStyle("irr_area")} className="py-2 px-3 text-center relative group border-r border-border/60">
                                AREA ({ip ? "FT²" : "M²"})
                              </th>
                              <th style={getIrrColStyle("irr_rate")} className="py-2 px-3 text-center relative group border-r border-border/60">
                                RATE ({ip ? "GAL/FT²" : "L/M²"})
                              </th>
                              <th style={getIrrColStyle("irr_load")} className="py-2 px-3 text-center relative group border-r border-border/60">
                                TOTAL LOAD ({ip ? "GAL/DAY" : "L/DAY"})
                              </th>
                              <th style={getIrrColStyle("irr_actions")} className="py-0 px-0 text-center relative group w-9 min-w-[36px]">
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAndSortedIrrRows.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                                  {irrRows.length === 0
                                    ? "No irrigation entries added. Fill in the form above to calculate plant water demand."
                                    : "No irrigation entries match the active search/filter criteria."}
                                </td>
                              </tr>
                            ) : (
                              filteredAndSortedIrrRows.map((r, idx) => (
                                    <ContextMenu key={r.id}>
                                      <ContextMenuTrigger asChild>
                                        <tr
                                          id={`row-${r.id}`}
                                          data-row-id={r.id}
                                          onMouseDownCapture={(e) => {
                                            if (isLocked) return;
                                            const target = e.target as HTMLElement;
                                            if (target.closest('.group\\/row-cell') || target.closest('button')) return;
                                            const isInputTarget = target.tagName === "INPUT" || target.tagName === "SELECT" || Boolean(target.closest("input, select"));
                                            if (!selectedIrrRows.has(r.id)) {
                                              if (isInputTarget) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                              }
                                              toggleIrrRowSelection(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                            }
                                          }}
                                          onClickCapture={(e) => {
                                            if (isLocked) return;
                                            const target = e.target as HTMLElement;
                                            if (target.closest('.group\\/row-cell') || target.closest('button')) return;
                                            const isInputTarget = target.tagName === "INPUT" || target.tagName === "SELECT" || Boolean(target.closest("input, select"));
                                            if (!selectedIrrRows.has(r.id) && isInputTarget) {
                                              e.preventDefault();
                                              e.stopPropagation();
                                            }
                                          }}
                                          onClick={(e) => {
                                            if (isLocked) return;
                                            const target = e.target as HTMLElement;
                                            if (target.closest('.group\\/row-cell') || target.closest('button')) return;
                                            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                              toggleIrrRowSelection(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                            }
                                          }}
                                          onDoubleClick={(e) => {
                                            if (isLocked) return;
                                            setSelectedIrrRows(new Set([r.id]));
                                            setPreviewTarget({ type: "irrigation", rowId: r.id });
                                            setPreviewModalOpen(true);
                                          }}
                                          title={isLocked ? undefined : "Click to select, click again to edit, Shift+Click for range. Double-click for calculation breakdown."}
                                          className={`group h-[30px] border-b border-border/40 hover:bg-muted/30 dark:hover:bg-white/[0.03] text-[13.5px] transition-colors ${isLocked ? "cursor-default" : "cursor-pointer"} select-none ${
                                            previewModalOpen && previewTarget?.type === "irrigation" && previewTarget?.rowId === r.id
                                              ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                                              : previewModalOpen
                                              ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200"
                                              : selectedIrrRows.has(r.id)
                                              ? "bg-row-selected bg-primary/15 text-primary font-medium border-l-2 border-l-primary"
                                              : "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80"
                                          }`}
                                        >
                                          <td 
                                            style={getIrrColStyle("irr_select")} 
                                            className={`px-1 h-[30px] flex items-center justify-center border-r border-border/40 relative group/row-cell select-none cursor-pointer transition-colors duration-150 ${
                                              selectedIrrRows.has(r.id)
                                                ? "bg-primary/15 text-primary font-bold shadow-inner"
                                                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                                            }`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              toggleIrrRowSelection(r.id, e.shiftKey, true);
                                            }}
                                            title={selectedIrrRows.has(r.id) ? `Zone ${idx + 1} selected. Click to deselect.` : `Click to select zone ${idx + 1}.`}
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            <RowCommentCornerBadge
                                              id={r.id}
                                              count={r.comments?.length}
                                              onClick={() =>
                                                setCommentTarget({
                                                  targetId: String(r.id),
                                                  targetName: r.vegType,
                                                  targetType: "Irrigation Plant Area",
                                                  rowId: r.id,
                                                  isIrrigation: true,
                                                  existingComments: r.comments || [],
                                                })
                                              }
                                            />
                                            <span className="text-[11px] font-mono leading-none tracking-tight">
                                              {idx + 1}
                                            </span>
                                          </td>
                                          <td 
                                            style={getIrrColStyle("irr_vegType")} 
                                            className={`py-0 px-2 h-[30px] font-medium text-[13.5px] ${
                                              !selectedIrrRows.has(r.id)
                                                ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors"
                                                : "group/cell cursor-pointer"
                                            }`}
                                            title={!selectedIrrRows.has(r.id) ? "Click to select row, click again to edit" : undefined}
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            <div className={`flex items-center gap-2 w-full h-full min-w-0 ${!selectedIrrRows.has(r.id) ? "pointer-events-none select-none" : "pointer-events-auto"}`}>
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                                              <div className="relative w-full flex items-center min-w-0">
                                                <select
                                                  value={r.vegType}
                                                  disabled={isLocked}
                                                  onChange={(e) => handleIrrRowChange(r.id, "vegType", e.target.value)}
                                                  className="w-full bg-transparent border border-transparent hover:bg-surface-2 hover:border-muted-foreground/20 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-0.5 pl-1 pr-5 rounded text-[13px] font-medium text-foreground transition-all cursor-pointer appearance-none truncate"
                                                >
                                                  <option value="" disabled hidden>Select Vegetation Type...</option>
                                                  <option value="Custom Vegetation">Other (Custom Vegetation)</option>
                                                  {Object.keys(IRR_TYPE_MAP).map((k) => (
                                                    <option key={k} value={k}>
                                                      {k}
                                                    </option>
                                                  ))}
                                                  {r.vegType && !IRR_TYPE_MAP[r.vegType] && r.vegType !== "Custom Vegetation" && (
                                                    <option value={r.vegType}>{r.vegType}</option>
                                                  )}
                                                </select>
                                              </div>
                                            </div>
                                          </td>
                                          <td 
                                            style={getIrrColStyle("irr_area")} 
                                            className={`py-0 px-2 h-[30px] text-center font-mono tabular text-[13.5px] ${
                                              !selectedIrrRows.has(r.id)
                                                ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors"
                                                : "group/cell cursor-text"
                                            }`}
                                            title={!selectedIrrRows.has(r.id) ? "Click to select row, click again to edit" : undefined}
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            <div className={`w-full h-full flex items-center justify-center min-w-0 ${!selectedIrrRows.has(r.id) ? "pointer-events-none select-none" : "pointer-events-auto"}`}>
                                              <input
                                                type="number"
                                                value={r.area}
                                                disabled={isLocked}
                                                onDoubleClick={(e) => e.stopPropagation()}
                                                onChange={(e) => handleIrrRowChange(r.id, "area", Number(e.target.value))}
                                                className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                                              />
                                            </div>
                                          </td>
                                          <td style={getIrrColStyle("irr_rate")} className="py-1.5 px-3 text-center font-mono tabular font-medium text-foreground text-[13.5px] cursor-pointer border-r border-border/40"
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            {(ip ? Math.round((r.lpd / 40.7458) * 100) / 100 : r.lpd).toFixed(ip ? 3 : 1)}
                                          </td>
                                          <td style={getIrrColStyle("irr_load")} className="py-0 px-2 h-[30px] text-center font-mono tabular text-[13.5px] font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer border-r border-border/40"
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            {(ip ? Math.round((r.area * r.lpd) / 3.78541) : r.area * r.lpd).toLocaleString()}
                                          </td>
                                          <td style={getIrrColStyle("irr_actions")} className="py-0 px-1 h-[30px] text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                            {(() => {
                                              const val = getIrrRowValidation(r);
                                              return (
                                                <TooltipProvider delayDuration={150}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleToggleIrrFlag(r.id);
                                                        }}
                                                        className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
                                                      >
                                                        <Flag
                                                          className={`size-3.5 transition-all duration-200 ${
                                                            val.isFlagged
                                                              ? "fill-red-500 text-red-500 scale-110"
                                                              : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
                                                          }`}
                                                        />
                                                      </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                      side="left"
                                                      align="center"
                                                      className="max-w-[280px] p-2.5 text-left bg-zinc-900 text-white dark:bg-zinc-800 border border-zinc-700 shadow-xl rounded-xl z-50 animate-in fade-in zoom-in-95 pointer-events-none text-xs"
                                                    >
                                                      {val.isNoArea && val.isNoVegType ? (
                                                        <div className="text-[11.5px]">Missing zone area and vegetation type</div>
                                                      ) : val.isNoArea ? (
                                                        <div className="text-[11.5px]">Missing zone area (Area must be &gt; 0)</div>
                                                      ) : val.isNoVegType ? (
                                                        <div className="text-[11.5px]">Missing vegetation type</div>
                                                      ) : val.isNoRate ? (
                                                        <div className="text-[11.5px]">Missing irrigation consumption rate</div>
                                                      ) : val.isZeroDemand ? (
                                                        <div className="text-[11.5px]">Daily irrigation demand is 0</div>
                                                      ) : val.isManual ? (
                                                        <div className="text-[11.5px]">Flagged zone (Click to unflag)</div>
                                                      ) : (
                                                        <div className="text-[11.5px]">Click to flag zone for manual review</div>
                                                      )}
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              );
                                            })()}
                                          </td>
                                        </tr>
                                      </ContextMenuTrigger>
                                      <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                        {/* Add Comment - AT THE TOP with blue ventilation styling */}
                                        <ContextMenuItem
                                          onClick={() =>
                                            setCommentTarget({
                                              targetId: String(r.id),
                                              targetName: r.vegType,
                                              targetType: "Irrigation Plant Area",
                                              rowId: r.id,
                                              isIrrigation: true,
                                              existingComments: r.comments || [],
                                            })
                                          }
                                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                        >
                                          <MessageSquare className="size-3.5" />
                                          <span>Add Comment</span>
                                        </ContextMenuItem>
                                        <ContextMenuItem
                                          onClick={() => {
                                            setPreviewTarget({ type: "irrigation", rowId: r.id });
                                            setPreviewModalOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                                        >
                                          <Calculator className="size-3.5 text-muted-foreground" />
                                          <span>Calculation Breakdown</span>
                                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</ContextMenuShortcut>
                                        </ContextMenuItem>
                                        <ContextMenuItem
                                          onClick={() => handleToggleIrrFlag(r.id)}
                                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                        >
                                          <Flag className={`size-3.5 ${r.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                                          <span>{r.flagged ? "Unflag Zone" : "Flag Zone"}</span>
                                        </ContextMenuItem>
                                        <ContextMenuItem
                                          onClick={() => {
                                            const dup = { ...r, id: Date.now() };
                                            setIrrRows((prev) => [...prev, dup]);
                                            toast.success(`Duplicated "${r.vegType}"`);
                                          }}
                                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                        >
                                          <Copy className="size-3.5 text-muted-foreground" />
                                          <span>Duplicate Row</span>
                                        </ContextMenuItem>
                                        <ContextMenuSeparator className="h-px bg-border my-1" />
                                        <ContextMenuItem
                                          onClick={async () => {
                                            const ok = await confirm(`Are you sure you want to delete zone "${r.vegType}"?`, {
                                              title: "Delete Zone",
                                              confirmText: "Delete",
                                              cancelText: "Cancel",
                                              variant: "destructive",
                                            });
                                            if (ok) {
                                              setIrrRows((prev) => prev.filter((x) => x.id !== r.id));
                                              toast.info(`Deleted "${r.vegType}"`);
                                            }
                                          }}
                                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
                                        >
                                          <Trash2 className="size-3.5" />
                                          <span>Delete Row</span>
                                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                                        </ContextMenuItem>
                                      </ContextMenuContent>
                                    </ContextMenu>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Table Summary Footer Bar */}
                      <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 select-none no-print">
                        <div>Showing <span className="text-foreground font-medium tabular">{filteredAndSortedIrrRows.length}</span> of {irrRows.length} vegetation zones</div>
                        <div className="flex items-center gap-4 tabular">
                          <span>Total Area: <strong className="text-foreground font-mono font-bold">{irrRows.reduce((a, b) => a + (b.area || 0), 0).toLocaleString()} {ip ? "ft²" : "m²"}</strong></span>
                          <span>Total Daily Load: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">{calculations.displayIrrigation}</strong></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {(demandSection === "pool" || demandSection === "fire") && (
                    <div className="p-4 md:p-6 overflow-y-auto flex-1 min-h-0 flex flex-col gap-6 w-full custom-scrollbar">
                      {/* Pool Card */}
                      {demandSection === "pool" && (
                        <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          onDoubleClick={() => {
                            setPreviewTarget({ type: "pool" });
                            setPreviewModalOpen(true);
                          }}
                          title="Double-click to open swimming pool makeup calculation breakdown"
                          className={`bg-card border rounded-2xl p-5 flex flex-col gap-4 shadow-xs transition-colors cursor-pointer select-none relative overflow-hidden ${
                            poolFlagged
                              ? "border-amber-400/80 bg-amber-50/40 dark:bg-amber-950/20"
                              : "border-border hover:border-border/80"
                          }`}
                        >
                          {poolComments.length > 0 && (
                            <RowCommentCornerBadge
                              count={poolComments.length}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCommentTarget({
                                  targetId: "swimming_pool",
                                  targetName: "Swimming Pool Makeup",
                                  targetType: "Swimming Pool",
                                  isPool: true,
                                  existingComments: poolComments,
                                });
                              }}
                            />
                          )}
                          <div className="flex items-center justify-between pb-2 border-b border-border/60">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                                🏊 Swimming Pool Makeup
                                {poolFlagged && (
                                  <span title="Flagged for review" className="inline-flex">
                                    <Flag className="size-3 text-amber-500 fill-amber-500" />
                                  </span>
                                )}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1" onDoubleClick={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentTarget({
                                      targetId: "swimming_pool",
                                      targetName: "Swimming Pool Makeup",
                                      targetType: "Swimming Pool",
                                      isPool: true,
                                      existingComments: poolComments,
                                    })
                                  }
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors relative cursor-pointer"
                                  title="Add comment & assign task for Swimming Pool"
                                >
                                  <MessageSquare className="size-3.5" />
                                  
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextState = !poolFlagged;
                                    setPoolFlagged(nextState);
                                    toast.info(nextState ? "Flagged Swimming Pool for review" : "Unflagged Swimming Pool");
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    poolFlagged
                                      ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                                      : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  }`}
                                  title={poolFlagged ? "Flagged for review" : "Flag for review"}
                                >
                                  <Flag className={`size-3.5 ${poolFlagged ? "fill-amber-500" : ""}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 text-xs font-sans">
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Pool Surface Area ({ip ? "ft²" : "m²"})</label>
                              <input
                                type="number"
                                placeholder="e.g. 80"
                                value={poolArea}
                                onChange={(e) => setPoolArea(e.target.value !== "" ? Number(e.target.value) : "")}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Average Depth ({ip ? "ft" : "m"})</label>
                              <input
                                type="number"
                                placeholder="e.g. 1.5"
                                value={poolDepth}
                                onChange={(e) => setPoolDepth(e.target.value !== "" ? Number(e.target.value) : "")}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Evaporation Rate (%/day)</label>
                              <input
                                type="number"
                                value={poolEvap}
                                onChange={(e) => setPoolEvap(Number(e.target.value))}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                              />
                            </div>

                            {poolArea && poolDepth && (
                              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl mt-1 flex justify-between items-center">
                                <span className="text-xs font-bold text-blue-800 dark:text-blue-300">Daily Pool Makeup:</span>
                                <strong className="text-sm font-extrabold font-mono text-[#0A7BC7]">{calculations.displayPoolDemand}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
                        <ContextMenuItem
                          onClick={() =>
                            setCommentTarget({
                              targetId: "swimming_pool",
                              targetName: "Swimming Pool Makeup",
                              targetType: "Swimming Pool",
                              isPool: true,
                              existingComments: poolComments,
                            })
                          }
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            setPreviewTarget({ type: "pool" });
                            setPreviewModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                        >
                          <Calculator className="size-3.5 text-muted-foreground" />
                          <span>Calculation Breakdown</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            const nextState = !poolFlagged;
                            setPoolFlagged(nextState);
                            toast.info(nextState ? "Flagged Swimming Pool for review" : "Unflagged Swimming Pool");
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <Flag className={`size-3.5 ${poolFlagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                          <span>{poolFlagged ? "Unflag Item" : "Flag for Review"}</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                    )}

                    {/* Fire Card */}
                    {demandSection === "fire" && (
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                        <div
                          onDoubleClick={() => {
                            setPreviewTarget({ type: "fire" });
                            setPreviewModalOpen(true);
                          }}
                          title="Double-click to open fire reserve calculation breakdown"
                          className={`bg-card border rounded-2xl p-5 flex flex-col gap-4 shadow-xs transition-colors cursor-pointer select-none ${
                            fireFlagged
                              ? "border-amber-400/80 bg-amber-50/40 dark:bg-amber-950/20"
                              : "border-border hover:border-border/80"
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-border/60">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-3.5 bg-red-600 rounded-full"></div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                                🔥 Fire Fighting Reserve Sizing
                                {fireFlagged && (
                                  <span title="Flagged for review" className="inline-flex">
                                    <Flag className="size-3 text-amber-500 fill-amber-500" />
                                  </span>
                                )}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1" onDoubleClick={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentTarget({
                                      targetId: "fire_fighting",
                                      targetName: "Fire Fighting Reserve Sizing",
                                      targetType: "Fire Fighting Reserve",
                                      isFire: true,
                                      existingComments: fireComments,
                                    })
                                  }
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors relative cursor-pointer"
                                  title="Add comment & assign task for Fire Fighting"
                                >
                                  <MessageSquare className="size-3.5" />
                                  
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextState = !fireFlagged;
                                    setFireFlagged(nextState);
                                    toast.info(nextState ? "Flagged Fire Fighting Reserve for review" : "Unflagged Fire Fighting Reserve");
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    fireFlagged
                                      ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                                      : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  }`}
                                  title={fireFlagged ? "Flagged for review" : "Flag for review"}
                                >
                                  <Flag className={`size-3.5 ${fireFlagged ? "fill-amber-500" : ""}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 text-xs font-sans">
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Fire Pump Flow Rate (USGPM)</label>
                              <input
                                type="number"
                                placeholder="e.g. 500"
                                value={fireFlow}
                                onChange={(e) => setFireFlow(e.target.value !== "" ? Number(e.target.value) : "")}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Standard Fire Reserve Duration</label>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 text-muted-foreground border border-border rounded-lg px-3 py-2 font-bold select-none cursor-not-allowed">
                                60 Minutes (Standard fixed NFPA duration)
                              </div>
                            </div>

                            {fireFlow && (
                              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl mt-1 flex justify-between items-center">
                                <span className="text-xs font-bold text-red-800 dark:text-red-300">Reserve Fire Tank:</span>
                                <strong className="text-sm font-extrabold font-mono text-red-600 dark:text-red-400">{calculations.displayFireCap}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
                        <ContextMenuItem
                          onClick={() =>
                            setCommentTarget({
                              targetId: "fire_fighting",
                              targetName: "Fire Fighting Reserve Sizing",
                              targetType: "Fire Fighting Reserve",
                              isFire: true,
                              existingComments: fireComments,
                            })
                          }
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            setPreviewTarget({ type: "fire" });
                            setPreviewModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                        >
                          <Calculator className="size-3.5 text-muted-foreground" />
                          <span>Calculation Breakdown</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          onClick={() => {
                            const nextState = !fireFlagged;
                            setFireFlagged(nextState);
                            toast.info(nextState ? "Flagged Fire Fighting Reserve for review" : "Unflagged Fire Fighting Reserve");
                          }}
                        >
                          <Flag className={`size-3.5 ${fireFlagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                          <span>{fireFlagged ? "Unflag Item" : "Flag for Review"}</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                      </ContextMenu>
                      )}
                    </div>
                  )}
            </>
          )}

          {/* -------------------- TAB 2: STORAGE & PUMPS -------------------- */}
          {tab === "tanks" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-8">
                {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        📥 Sizing Parameters
                      </span>
                    </div>

                    {/* STORAGE RETENTION */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div className="relative p-3 rounded-xl border bg-slate-50/50 dark:bg-zinc-800/40 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
                          <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
                            Storage Retention Days
                          </label>
                          <select
                            disabled={isEffectiveReadOnly}
                            value={storageDays}
                            onChange={(e) => {
                              setStorageDays(Number(e.target.value));
                              dirtyStore.set(true);
                            }}
                            className="w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-[#0A7BC7] cursor-pointer"
                          >
                            <option value={1}>1 Day Storage (24 Hours — Standard)</option>
                            <option value={1.5}>1.5 Day Storage (36 Hours — Intermediate Reserve)</option>
                            <option value={2}>2 Days Storage (48 Hours — DEWA/ADDC Reserve)</option>
                            <option value={3}>3 Days Storage (72 Hours — Emergency Reserve)</option>
                          </select>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          disabled={isEffectiveReadOnly}
                          onClick={() => {
                            if (isEffectiveReadOnly) return;
                            setStorageDays(1);
                            dirtyStore.set(true);
                            toast.success("Storage retention reset to standard (1 Day)");
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <RotateCcw className="size-3.5 text-muted-foreground" />
                          <span>Reset to 1 Day</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => {
                            setPreviewTarget({ type: "tank" });
                            setPreviewModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                        >
                          <Calculator className="size-3.5 text-primary" />
                          <span>Calculation Breakdown</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* GROUND WATER BREAK TANK */}
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Ground Water Break Tank
                        </span>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-slate-50/70 dark:bg-zinc-800/50 border-slate-200/80 dark:border-zinc-700">
                          <span className="text-[11px] font-medium text-slate-500">Allocation:</span>
                          <input
                            type="number"
                            min={0}
                            max={500}
                            disabled={isEffectiveReadOnly}
                            value={groundTankPct}
                            onChange={(e) => {
                              setGroundTankPct(Number(e.target.value));
                              dirtyStore.set(true);
                            }}
                            className="w-12 bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-100 font-bold font-mono text-center border border-slate-200 dark:border-zinc-700 rounded px-1 py-0.5 outline-none focus:border-primary text-xs"
                          />
                          <span className="text-[10.5px] text-slate-400">%</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border bg-slate-50/50 dark:bg-zinc-800/40 border-slate-200/80 dark:border-zinc-800 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-zinc-400 font-medium">Break Tank Volume:</span>
                          <span className="font-mono font-bold text-primary">{calculations.displayGroundTank}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-slate-200/40 dark:border-zinc-800/60">
                          <span>Suggested Dimensions:</span>
                          <span className="font-mono text-foreground font-semibold">
                            {calculations.groundDim.l}m L × {calculations.groundDim.w}m W × {calculations.groundDim.h}m H <span className="text-[10px] text-muted-foreground">(+ 0.3m freeboard)</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* OVERHEAD ROOF TANKS */}
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Overhead Roof Tanks ({overheadTanks.length})
                        </span>
                        {!isEffectiveReadOnly && (
                          <button
                            type="button"
                            onClick={handleAddOverheadTank}
                            className="text-[10.5px] font-bold text-[#0A7BC7] hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="size-3" /> Add Overhead Tank
                          </button>
                        )}
                      </div>

                      {overheadTanks.length === 0 ? (
                        <div className="p-3 bg-slate-50/50 dark:bg-zinc-800/20 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl text-center text-xs text-muted-foreground italic">
                          No overhead roof tanks configured. Click &quot;Add Overhead Tank&quot; above to add overhead storage.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {calculations.overheadTanksCalculated.map((t) => (
                            <div
                              key={t.id}
                              className="p-3 bg-slate-50/50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 rounded-xl flex flex-col gap-2 hover:border-slate-300 dark:hover:border-zinc-700 transition-all text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  type="text"
                                  disabled={isEffectiveReadOnly}
                                  value={t.name}
                                  onChange={(e) => handleRenameOverheadTank(t.id, e.target.value)}
                                  className="bg-transparent font-bold text-xs text-foreground outline-none focus:bg-white dark:focus:bg-zinc-900 px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-primary flex-1"
                                  placeholder="Overhead Tank Name"
                                />
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      disabled={isEffectiveReadOnly}
                                      value={t.splitPct}
                                      onChange={(e) => handleUpdateOverheadTankPct(t.id, Number(e.target.value))}
                                      className="w-10 bg-transparent text-xs font-mono font-bold text-primary text-center outline-none"
                                    />
                                    <span className="text-[10px] font-bold text-muted-foreground">%</span>
                                  </div>
                                  <span className="text-xs font-mono font-extrabold text-primary">
                                    {t.displayVol}
                                  </span>
                                  {!isEffectiveReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOverheadTank(t.id)}
                                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                                      title="Remove Overhead Tank"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-zinc-800/60">
                                <span>Suggested Dimensions:</span>
                                <span className="font-mono text-foreground font-semibold">
                                  {t.dim.l}m L × {t.dim.w}m W × {t.dim.h}m H <span className="text-[10px] text-muted-foreground">(+ 0.3m freeboard)</span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* PEAK FLOW & TRANSFER PUMP PARAMETERS */}
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Domestic Peak Flow &amp; Transfer Pump Sizing
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="relative p-3 rounded-xl border bg-slate-50/50 dark:bg-zinc-800/40 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
                          <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                            Diversity / Peak Multiplier (K)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            disabled={isEffectiveReadOnly}
                            value={peakFactor}
                            onChange={(e) => {
                              setPeakFactor(Number(e.target.value));
                              dirtyStore.set(true);
                            }}
                            className="w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono text-xs font-bold text-foreground focus:outline-none focus:border-[#0A7BC7]"
                          />
                        </div>

                        <div className="relative p-3 rounded-xl border bg-slate-50/50 dark:bg-zinc-800/40 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
                          <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                            Transfer Filling Duration
                          </label>
                          <select
                            disabled={isEffectiveReadOnly}
                            value={fillWindowHours}
                            onChange={(e) => {
                              setFillWindowHours(Number(e.target.value));
                              dirtyStore.set(true);
                            }}
                            className="w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono text-xs font-bold text-foreground focus:outline-none focus:border-[#0A7BC7] cursor-pointer"
                          >
                            <option value={1}>1 Hour Filling Window</option>
                            <option value={2}>2 Hours Filling Window (Standard)</option>
                            <option value={3}>3 Hours Filling Window</option>
                            <option value={4}>4 Hours Filling Window</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) */}
                <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                  {/* PRIMARY RESULTS CARD */}
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        ⚡ Sizing Results Summary
                      </span>
                    </div>

                    {/* DISPLAY STAT CARDS (4 CARDS MATCHING PUMP SIZING) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Card 1: Target Storage (Blue) */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            onDoubleClick={() => {
                              setPreviewTarget({ type: "tank" });
                              setPreviewModalOpen(true);
                            }}
                            className="relative bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 transition-all hover:border-blue-300 dark:hover:border-blue-700 cursor-context-menu"
                          >
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Target Storage</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {ip ? Math.round(calculations.reqStorageGal).toLocaleString() : Math.round(calculations.reqStorageL).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{ip ? "gal" : "L"}</span>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => {
                              setPreviewTarget({ type: "tank" });
                              setPreviewModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                          >
                            <Calculator className="size-3.5 text-primary" />
                            <span>Calculation Preview</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Formula</ContextMenuShortcut>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Card 2: Ground Break Tank (Amber) */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            onDoubleClick={() => {
                              setPreviewTarget({ type: "tank" });
                              setPreviewModalOpen(true);
                            }}
                            className="relative bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 transition-all hover:border-amber-300 dark:hover:border-amber-700 cursor-context-menu"
                          >
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Ground Tank</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {ip ? Math.round(calculations.groundTankL / 3.78541).toLocaleString() : Math.round(calculations.groundTankL).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{ip ? "gal" : "L"}</span>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => {
                              setPreviewTarget({ type: "tank" });
                              setPreviewModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                          >
                            <Calculator className="size-3.5 text-primary" />
                            <span>Calculation Preview</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Formula</ContextMenuShortcut>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Card 3: Domestic Peak Flow (Emerald) */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            onDoubleClick={() => {
                              setPreviewTarget({ type: "pump" });
                              setPreviewModalOpen(true);
                            }}
                            className="relative bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 transition-all hover:border-emerald-300 dark:hover:border-emerald-700 cursor-context-menu"
                          >
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Calculated Peak Flow</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {ip ? Math.round(calculations.peakGPM).toLocaleString() : calculations.peakLPS.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{ip ? "GPM" : "L/s"}</span>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => {
                              setPreviewTarget({ type: "pump" });
                              setPreviewModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                          >
                            <Calculator className="size-3.5 text-primary" />
                            <span>Calculation Preview</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Formula</ContextMenuShortcut>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Card 4: Required Transfer Flow (Purple) */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            onDoubleClick={() => {
                              setPreviewTarget({ type: "pump" });
                              setPreviewModalOpen(true);
                            }}
                            className="relative bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 transition-all hover:border-purple-300 dark:hover:border-purple-700 cursor-context-menu"
                          >
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Transfer Pump Flow</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {ip ? calculations.transferPumpGPM.toFixed(1) : calculations.transferPumpLPS.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{ip ? "GPM" : "L/s"}</span>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => {
                              setPreviewTarget({ type: "pump" });
                              setPreviewModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                          >
                            <Calculator className="size-3.5 text-primary" />
                            <span>Calculation Preview</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Formula</ContextMenuShortcut>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>

                    {/* DETAILED METRICS TABLE */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div className="relative bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs transition-all hover:border-slate-300 dark:hover:border-zinc-700 cursor-context-menu">
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Total Daily Water Demand:</span>
                            <span className="font-mono font-bold">{calculations.displayGrandTotal}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Storage Retention Period:</span>
                            <span className="font-mono font-bold">{storageDays} Day{storageDays > 1 ? "s" : ""} ({storageDays * 24} Hours)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Suggested Ground Tank Dimensions:</span>
                            <span className="font-mono font-bold">{calculations.groundDim.l}m L × {calculations.groundDim.w}m W × {calculations.groundDim.h}m H (+0.3m freeboard)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Overhead Roof Storage Tanks:</span>
                            <span className="font-mono font-bold">
                              {overheadTanks.length > 0
                                ? `${overheadTanks.reduce((s, t) => s + t.splitPct, 0)}% Total (${calculations.overheadTanksCalculated.map(t => `${t.name}: ${t.displayVol}`).join(", ")})`
                                : "None configured"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Domestic Peak Diversity Multiplier:</span>
                            <span className="font-mono font-bold">K = {peakFactor}</span>
                          </div>
                          <div className="flex justify-between py-1 font-bold text-foreground">
                            <span>Estimated Transfer Pump Flow:</span>
                            <span className="font-mono text-[#0A7BC7] font-bold">
                              {calculations.displayTransferPump}
                            </span>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => {
                            setPreviewTarget({ type: "pump" });
                            setPreviewModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                        >
                          <Calculator className="size-3.5 text-primary" />
                          <span>Calculation Preview</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Formula</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={handleExportPDF}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                        >
                          <FileText className="size-3.5" />
                          <span>Export PDF Report</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -------------------- TAB 3: REPORT -------------------- */}
          {tab === "report" && (
            <WaterDemandReportView
              calculations={calculations}
              wdRows={wdRows}
              irrRows={irrRows}
              poolArea={poolArea}
              poolDepth={poolDepth}
              poolEvap={poolEvap}
              fireFlow={fireFlow}
              storageDays={storageDays}
              groundTankPct={groundTankPct}
              overheadTanks={overheadTanks}
              fillWindowHours={fillWindowHours}
              peakFactor={peakFactor}
              unitSystem={unitSystem}
              presetStandard={presetStandard}
              project={project}
              calcReviewState={calcReviewState}
              currentUserName={currentUserName}
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
        <WaterDemandIntelligenceDrawer
          onClose={() => setIntelOpen(false)}
          calculations={calculations}
          wdRows={wdRows}
          irrRows={irrRows}
          poolArea={poolArea}
          poolDepth={poolDepth}
          fireFlow={fireFlow}
          storageDays={storageDays}
          groundTankPct={groundTankPct}
          overheadTanks={overheadTanks}
          fillWindowHours={fillWindowHours}
          unitSystem={unitSystem}
          presetStandard={presetStandard}
          setTab={setTab}
          setDemandSection={setDemandSection}
        />
      )}
    </div>
  </div>

      {/* Double-Click Calculation Breakdown & Edit Preview Modal */}
      {previewModalOpen && previewTarget && (
        <div
          onClick={() => setPreviewModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/20 dark:bg-black/50 p-4 animate-fade-in font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white/80 dark:bg-neutral-950/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-h-[88vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
              showModalPreview ? "max-w-4xl" : "max-w-xl"
            }`}
          >
            {/* Modal Header */}
            <header className="px-5 h-14 flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <h2 className="text-[14.5px] font-bold text-neutral-800 dark:text-neutral-100 truncate flex items-center gap-2">
                  <Calculator className="size-4 text-primary" /> Water Demand Parameters &amp; Calculations
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0 uppercase">
                  {PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name} ({unitSystem === "ip" ? "IP" : "SI"})
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModalPreview((prev) => !prev)}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11.5px] font-semibold border transition-all cursor-pointer shadow-xs ${
                    showModalPreview
                      ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95"
                      : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"
                  }`}
                >
                  <Info className="size-3.5" />
                  Calculations Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="size-8 grid place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            {/* Modal Body: Left Inputs + Right Calculations Preview */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Left Side: Form Controls & Navigation */}
              <div className="flex-1 min-w-0 p-5 space-y-4 overflow-y-auto custom-scrollbar">
                {/* Navigation Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-white/40 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto">
                  <button
                    onClick={() => setPreviewTarget({ type: "summary" })}
                    className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-[12px] ${
                      previewTarget.type === "summary"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    Executive Summary
                  </button>
                  <button
                    onClick={() => setPreviewTarget({ type: "domestic", rowId: wdRows[0]?.id })}
                    className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-[12px] ${
                      previewTarget.type === "domestic"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    Domestic Schedule ({wdRows.length})
                  </button>
                  <button
                    onClick={() => setPreviewTarget({ type: "tank" })}
                    className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-[12px] ${
                      previewTarget.type === "tank"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    Storage Tanks
                  </button>
                  <button
                    onClick={() => setPreviewTarget({ type: "pump" })}
                    className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-[12px] ${
                      previewTarget.type === "pump"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    Transfer Pumps
                  </button>
                  <button
                    onClick={() => setPreviewTarget({ type: "irrigation", rowId: irrRows[0]?.id })}
                    className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-[12px] ${
                      previewTarget.type === "irrigation"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    Irrigation ({irrRows.length})
                  </button>
                </div>

                {/* Section Content */}
                {previewTarget.type === "domestic" && (() => {
                  const selectedRow = wdRows.find((x) => x.id === previewTarget.rowId) || wdRows[0];
                  if (!selectedRow) return <div className="text-center py-6 text-muted-foreground">No domestic entries added.</div>;

                  return (
                    <div className="space-y-6">
                      {/* Entry Selector */}
                      <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl flex items-center justify-between shadow-xs">
                        <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                          Select Domestic Entry:
                        </label>
                        <select
                          value={selectedRow.id}
                          onChange={(e) => setPreviewTarget({ type: "domestic", rowId: Number(e.target.value) })}
                          className="h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
                        >
                          {wdRows.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} — ({r.ppl} ppl, {r.cat})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* General Parameters */}
                      <div className="space-y-4">
                        <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2 flex items-center gap-1.5">
                          <SlidersHorizontal className="size-3.5" /> General Parameters Controls
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                              Description
                            </label>
                            <input
                              type="text"
                              value={selectedRow.name}
                              onChange={(e) => handleWdRowChange(selectedRow.id, "name", e.target.value)}
                              className="w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-medium text-neutral-800 dark:text-neutral-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                              No. of People / Units
                            </label>
                            <input
                              type="number"
                              value={selectedRow.ppl}
                              onChange={(e) => handleWdRowChange(selectedRow.id, "ppl", Number(e.target.value))}
                              className="w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-bold font-mono text-neutral-800 dark:text-neutral-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                              Occupancy Category
                            </label>
                            <select
                              value={selectedRow.cat}
                              onChange={(e) => handleWdRowChange(selectedRow.id, "cat", e.target.value)}
                              className="w-full h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
                            >
                              {Object.keys(WD_TYPE_MAP).map((k) => (
                                <option key={k} value={k}>
                                  {k}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {previewTarget.type === "irrigation" && (() => {
                  const selectedRow = irrRows.find((x) => x.id === previewTarget.rowId) || irrRows[0];
                  if (!selectedRow) return <div className="text-center py-6 text-muted-foreground">No irrigation entries added.</div>;

                  return (
                    <div className="space-y-6">
                      <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl flex items-center justify-between shadow-xs">
                        <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                          Select Plant Zone:
                        </label>
                        <select
                          value={selectedRow.id}
                          onChange={(e) => setPreviewTarget({ type: "irrigation", rowId: Number(e.target.value) })}
                          className="h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
                        >
                          {irrRows.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.vegType} — ({r.area} {ip ? "ft²" : "m²"})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2 flex items-center gap-1.5">
                          <SlidersHorizontal className="size-3.5" /> Irrigation Parameters Controls
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                              Vegetation / Plant Type
                            </label>
                            <select
                              value={selectedRow.vegType}
                              onChange={(e) => handleIrrRowChange(selectedRow.id, "vegType", e.target.value)}
                              className="w-full h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
                            >
                              {Object.keys(IRR_TYPE_MAP).map((k) => (
                                <option key={k} value={k}>
                                  {k} — {IRR_TYPE_MAP[k]} L/m²
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                              Area ({ip ? "ft²" : "m²"})
                            </label>
                            <input
                              type="number"
                              value={selectedRow.area}
                              onChange={(e) => handleIrrRowChange(selectedRow.id, "area", Number(e.target.value))}
                              className="w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-bold font-mono text-neutral-800 dark:text-neutral-100"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {previewTarget.type === "tank" && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2 flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-primary" /> Storage Capacity &amp; Tank Split Controls
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                            Storage Retention Days
                          </label>
                          <select
                            value={storageDays}
                            onChange={(e) => setStorageDays(Number(e.target.value))}
                            className="w-full h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-bold text-neutral-800 dark:text-neutral-100 cursor-pointer"
                          >
                            <option value={1}>1 Day Storage (24 Hours — Standard)</option>
                            <option value={1.5}>1.5 Day Storage (36 Hours — Intermediate Reserve)</option>
                            <option value={2}>2 Days Storage (48 Hours — DEWA/ADDC Reserve)</option>
                            <option value={3}>3 Days Storage (72 Hours — Emergency Reserve)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                            Total Storage Volume Required
                          </label>
                          <div className="h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[12.5px] font-mono font-bold text-primary flex items-center justify-between">
                            <span>{calculations.displayTotalStorage}</span>
                            <span className="text-[10.5px] font-sans text-neutral-500">({calculations.groundPct}% Ground / {calculations.totalOverheadPct}% Roof)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {previewTarget.type === "pump" && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2 flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-primary" /> Peak Flow &amp; Transfer Pump Duty Parameters
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                            Diversity / Peak Multiplier (K)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={peakFactor}
                            onChange={(e) => setPeakFactor(Number(e.target.value))}
                            className="w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-bold font-mono text-neutral-800 dark:text-neutral-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                            Roof Tank Filling Window
                          </label>
                          <select
                            value={fillWindowHours}
                            onChange={(e) => setFillWindowHours(Number(e.target.value))}
                            className="w-full h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none font-bold text-neutral-800 dark:text-neutral-100 cursor-pointer"
                          >
                            <option value={1}>1 Hour Filling Window</option>
                            <option value={2}>2 Hours Filling Window (Standard)</option>
                            <option value={3}>3 Hours Filling Window</option>
                            <option value={4}>4 Hours Filling Window</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(previewTarget.type === "summary" || previewTarget.type === "pool" || previewTarget.type === "fire") && (
                  <div className="space-y-4">
                    <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                      Executive Calculation Summary &amp; Load Breakdown
                    </h3>
                    <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-neutral-900 text-white font-semibold">
                            <th className="p-2.5 text-left">Parameter</th>
                            <th className="p-2.5 text-center">Calculated Value</th>
                            <th className="p-2.5 text-center">Unit</th>
                            <th className="p-2.5 text-left">Design Guideline / Code Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5 font-mono">
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Domestic Daily Demand</td>
                            <td className="p-2.5 text-center font-bold text-primary">{calculations.displayDomestic}</td>
                            <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">{PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name}</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Domestic Peak Flow Rate</td>
                            <td className="p-2.5 text-center font-bold text-primary">{calculations.displayDomesticPeak}</td>
                            <td className="p-2.5 text-center">{ip ? "GPM" : "L/s"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Peak Factor K = {peakFactor}</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Irrigation Daily Load</td>
                            <td className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{calculations.displayIrrigation}</td>
                            <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Landscaping Area Schedule ({irrRows.length} zones)</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Pool Daily Evaporation Makeup</td>
                            <td className="p-2.5 text-center font-bold text-sky-600 dark:text-sky-400">{calculations.displayPoolDemand}</td>
                            <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Evaporation Rate = {poolEvap}%/day</td>
                          </tr>
                          <tr className="bg-white/40 dark:bg-white/5 font-bold">
                            <td className="p-2.5 font-sans text-neutral-800 dark:text-neutral-100">GRAND TOTAL DAILY CONSUMPTION</td>
                            <td className="p-2.5 text-center text-base text-primary">{calculations.displayGrandTotal}</td>
                            <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                            <td className="p-2.5 font-sans text-neutral-700 dark:text-neutral-300">Combined Site Water Demand</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Total Water Storage Requirement</td>
                            <td className="p-2.5 text-center font-bold text-neutral-800 dark:text-neutral-100">{calculations.displayTotalStorage}</td>
                            <td className="p-2.5 text-center">{ip ? "gal" : "m³"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">{storageDays} Day(s) Retention Reserve</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Ground Break Tank Capacity</td>
                            <td className="p-2.5 text-center font-bold text-primary">{calculations.displayGroundTank}</td>
                            <td className="p-2.5 text-center">{ip ? "gal" : "L"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Ground Split Allocation: {calculations.groundPct}%</td>
                          </tr>
                          {calculations.overheadTanksCalculated.map((t) => (
                            <tr key={t.id}>
                              <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">{t.name} Capacity</td>
                              <td className="p-2.5 text-center font-bold text-primary">{t.displayVol}</td>
                              <td className="p-2.5 text-center">{ip ? "gal" : "L"}</td>
                              <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Roof Split Allocation: {t.sharePct.toFixed(0)}%</td>
                            </tr>
                          ))}
                          <tr className="bg-primary/10 font-bold">
                            <td className="p-2.5 font-sans text-primary">Transfer Pump Duty Flow</td>
                            <td className="p-2.5 text-center text-primary">{calculations.displayTransferPump}</td>
                            <td className="p-2.5 text-center text-primary">{ip ? "GPM" : "L/s"}</td>
                            <td className="p-2.5 font-sans text-primary">{fillWindowHours}-Hour Roof Tank Filling Window</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side: Calculations Preview Sidebar (Matching Ventilation) */}
              {showModalPreview && (
                <div className="w-[360px] border-l border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.015] p-5 space-y-4 overflow-y-auto custom-scrollbar shrink-0 animate-fade-in flex flex-col">
                  <div className="space-y-4 flex flex-col flex-1">
                    <h3 className="text-[10.5px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0">
                      Calculations Preview
                    </h3>

                  {/* Domestic Calculations Card */}
                  {previewTarget.type === "domestic" && (() => {
                    const selectedRow = wdRows.find((x) => x.id === previewTarget.rowId) || wdRows[0];
                    if (!selectedRow) return null;
                    const rowLPD = selectedRow.lpd;
                    const rowTotalL = selectedRow.ppl * rowLPD;
                    const pctShare = calculations.totalWaterL > 0 ? ((rowTotalL / calculations.totalWaterL) * 100).toFixed(1) : "0";

                    return (
                      <div className="space-y-4 flex-1">
                        <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shadow-sm">
                          <div className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                            Occupancy Demand Standard
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px] font-mono">
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">Base Rate:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{WD_TYPE_MAP[selectedRow.cat] || 0} LPD</span>
                            </div>
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">Multiplier:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0}×</span>
                            </div>
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">Per Capita:</span>
                              <span className="font-semibold text-primary">{rowLPD} LPD</span>
                            </div>
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">Units:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{selectedRow.ppl} ppl</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 shadow-sm">
                          <div className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
                            Daily Domestic Load Formula
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-baseline text-[12px]">
                              <span className="text-neutral-500 dark:text-neutral-400 font-medium font-sans">Calculated Daily Load:</span>
                              <span className="font-mono font-bold text-[14px] text-primary">
                                {rowTotalL.toLocaleString()} L/day
                              </span>
                            </div>
                            <div className="text-[10.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2.5 rounded-xl border border-black/5 dark:border-white/5 break-all leading-relaxed">
                              {selectedRow.ppl} People × {rowLPD} LPD = {rowTotalL.toLocaleString()} L/day ({Math.round(rowTotalL / 3.78541).toLocaleString()} gal/day)
                            </div>
                            <div className="pt-2 flex justify-between items-center text-xs font-sans">
                              <span className="text-neutral-500 dark:text-neutral-400">Domestic Share:</span>
                              <span className="font-bold font-mono text-neutral-800 dark:text-neutral-100">{pctShare}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 p-4 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex items-start gap-2.5 text-[12px] text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/5">
                          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                          <div>
                            <span className="font-semibold">Calculations verified.</span> Space demand conforms to {PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name}.
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Irrigation Calculations Card */}
                  {previewTarget.type === "irrigation" && (() => {
                    const selectedRow = irrRows.find((x) => x.id === previewTarget.rowId) || irrRows[0];
                    if (!selectedRow) return null;
                    const rowLPD = selectedRow.lpd;
                    const rowTotalL = selectedRow.area * rowLPD;
                    const pctShare = calculations.totalIrrL > 0 ? ((rowTotalL / calculations.totalIrrL) * 100).toFixed(1) : "0";

                    return (
                      <div className="space-y-4 flex-1">
                        <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shadow-sm">
                          <div className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                            Plant Irrigation Standard Rate
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px] font-mono">
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">Water Rate:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{rowLPD} L/m²</span>
                            </div>
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">Area:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{selectedRow.area} m²</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 shadow-sm">
                          <div className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
                            Irrigation Volume Formula
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-baseline text-[12px]">
                              <span className="text-neutral-500 dark:text-neutral-400 font-medium font-sans">Daily Irrigation Volume:</span>
                              <span className="font-mono font-bold text-[14px] text-emerald-600 dark:text-emerald-400">
                                {rowTotalL.toLocaleString()} L/day
                              </span>
                            </div>
                            <div className="text-[10.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2.5 rounded-xl border border-black/5 dark:border-white/5 break-all leading-relaxed">
                              {selectedRow.area} m² × {rowLPD} L/m² = {rowTotalL.toLocaleString()} L/day ({Math.round(rowTotalL / 3.78541).toLocaleString()} gal/day)
                            </div>
                            <div className="pt-2 flex justify-between items-center text-xs font-sans">
                              <span className="text-neutral-500 dark:text-neutral-400">Irrigation Share:</span>
                              <span className="font-bold font-mono text-neutral-800 dark:text-neutral-100">{pctShare}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 p-4 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex items-start gap-2.5 text-[12px] text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/5">
                          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                          <div>
                            <span className="font-semibold">Calculations verified.</span> Landscaping irrigation demand correctly scheduled.
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Storage Tank Calculations Card */}
                  {previewTarget.type === "tank" && (
                    <div className="space-y-4 flex-1">
                      <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shadow-sm">
                        <div className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                          Storage Sizing Summary
                        </div>
                        <div className="space-y-2 text-[12px] font-mono">
                          <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 font-sans">Retention Reserve:</span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{storageDays} Day(s)</span>
                          </div>
                          <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 font-sans">Ground Tank ({calculations.groundPct}%):</span>
                            <span className="font-semibold text-primary">{calculations.displayGroundTank}</span>
                          </div>
                          {calculations.overheadTanksCalculated.map((t) => (
                            <div key={t.id} className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">{t.name} ({t.sharePct.toFixed(0)}%):</span>
                              <span className="font-semibold text-primary">{t.displayVol}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shadow-sm">
                        <div className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
                          Total Storage Volume Formula
                        </div>
                        <div className="text-[10.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2.5 rounded-xl border border-black/5 dark:border-white/5 break-all leading-relaxed">
                          Grand Daily Demand ({calculations.displayGrandTotal}) × {storageDays} Day(s) = {calculations.displayTotalStorage}
                        </div>
                      </div>

                      <div className="shrink-0 p-4 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex items-start gap-2.5 text-[12px] text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/5">
                        <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                        <div>
                          <span className="font-semibold">Calculations verified.</span> Tank physical dimensions include 0.3m freeboard allowance.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transfer Pump Calculations Card */}
                  {previewTarget.type === "pump" && (
                    <div className="space-y-4 flex-1">
                      <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shadow-sm">
                        <div className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                          Hydraulic Pump Duty Summary
                        </div>
                        <div className="space-y-2 text-[12px] font-mono">
                          <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 font-sans">Peak Diversity (K):</span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{peakFactor}</span>
                          </div>
                          <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 font-sans">Peak Domestic Flow:</span>
                            <span className="font-semibold text-primary">{calculations.displayDomesticPeak}</span>
                          </div>
                          <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 font-sans">Filling Window:</span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{fillWindowHours} Hours</span>
                          </div>
                          <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 font-sans">Transfer Pump Duty:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{calculations.displayTransferPump}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 p-4 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex items-start gap-2.5 text-[12px] text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/5">
                        <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                        <div>
                          <span className="font-semibold">Calculations verified.</span> Pump flow rates sized for simultaneous roof refill.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary / Other Calculations Card */}
                  {(previewTarget.type === "summary" || previewTarget.type === "pool" || previewTarget.type === "fire") && (
                    <div className="space-y-4 flex-1">
                      <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shadow-sm">
                        <div className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                          Grand Total Consumption
                        </div>
                        <div className="space-y-2 text-[12px] font-mono">
                          <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 font-sans">Domestic Demand:</span>
                            <span className="font-semibold text-primary">{calculations.displayDomestic}</span>
                          </div>
                          <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 font-sans">Irrigation Load:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{calculations.displayIrrigation}</span>
                          </div>
                          <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 font-sans">Pool Makeup:</span>
                            <span className="font-semibold text-sky-600 dark:text-sky-400">{calculations.displayPoolDemand}</span>
                          </div>
                          <div className="flex justify-between pt-1 font-bold text-[13px]">
                            <span className="text-neutral-800 dark:text-neutral-100 font-sans">Grand Total:</span>
                            <span className="text-primary">{calculations.displayGrandTotal}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 p-4 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex items-start gap-2.5 text-[12px] text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/5">
                        <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                        <div>
                          <span className="font-semibold">Calculations verified.</span> Complete site water balance integrated.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

            {/* Modal Footer */}
            <footer className="px-5 h-14 border-t border-black/5 dark:border-white/5 bg-white/20 dark:bg-black/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>Changes apply live to project calculation schedule</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="px-4 h-9 rounded-lg text-xs font-semibold border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewModalOpen(false);
                    toast.success("Changes saved to schedule");
                  }}
                  className="px-4.5 h-9 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-md shadow-primary/20 cursor-pointer"
                >
                  Done / Apply Changes
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Row Comment Modal */}
      {commentTarget && (
        <AssignCommentModal
          isOpen={Boolean(commentTarget)}
          onClose={() => setCommentTarget(null)}
          targetId={commentTarget.targetId}
          targetName={commentTarget.targetName}
          targetType={commentTarget.targetType}
          calculatorTitle="Water Demand Calculator"
          calculatorPath="/plumbing-water-demand"
          existingComments={commentTarget.existingComments}
          onSave={handleSaveRowComment}
        />
      )}

      {/* Unit System Change Confirmation Modal */}
      {showUnitConfirmModal && pendingUnitTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl animate-fade-in select-none">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0A7BC7]/10 rounded-xl text-[#0A7BC7]">
                  <Gauge className="size-5" />
                </div>
                <h3 className="font-bold text-base text-foreground">Unit System Change</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowUnitConfirmModal(false); setPendingUnitTarget(null); }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">
                Switching to {pendingUnitTarget === "ip" ? "Imperial (IP - GPD, ft², ft)" : "Metric (SI - LPD, m², m)"}
              </p>
              <p>
                How would you like to handle your existing area and depth inputs (Irrigation Areas, Pool Area, Pool Depth)?
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Option 1: Convert Input Values */}
              <button
                type="button"
                onClick={() => executeUnitSystemChange(pendingUnitTarget, true)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-[#0A7BC7]/30 bg-[#0A7BC7]/5 hover:bg-[#0A7BC7]/10 transition cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-[#0A7BC7]/15 text-[#0A7BC7] shrink-0 mt-0.5">
                  <RefreshCw className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground group-hover:text-[#0A7BC7] transition">
                    Convert Input Values (Convert Numbers)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Convert Areas &amp; Depths to {pendingUnitTarget === "ip" ? "ft² / ft" : "m² / m"} (e.g. {pendingUnitTarget === "ip" ? "100 m² → 1,076 ft²" : "1,076 ft² → 100 m²"}). Water loads recalculate accordingly.
                  </span>
                </div>
              </button>

              {/* Option 2: Keep Current Input Values */}
              <button
                type="button"
                onClick={() => executeUnitSystemChange(pendingUnitTarget, false)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-slate-100/40 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 text-muted-foreground shrink-0 mt-0.5">
                  <Check className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground transition">
                    Switch Units Only (Keep Numbers)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Keep your numerical inputs as-is and only change display labels to {pendingUnitTarget === "ip" ? "IP (gpd/gal)" : "SI (lpd/L)"}.
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 border-t border-border/60 flex justify-end">
              <button
                type="button"
                onClick={() => { setShowUnitConfirmModal(false); setPendingUnitTarget(null); }}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Domestic Water Entry Modal Popup */}
      {showAddWdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0A7BC7]/10 rounded-xl text-[#0A7BC7]">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Add Domestic Water Entry</h3>
                  <p className="text-xs text-muted-foreground">Add a new space occupancy entry to the water demand schedule</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWdModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">Description / Space Name</label>
                  {newWdAutoDetected && (
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                      <span className="size-2 rounded-full bg-blue-500 inline-block animate-pulse" />
                      Auto-detected standard
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Rest Room / Changing Room, 1BHK, Office, Classroom, Clinic"
                  value={newWdName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewWdName(val);
                    const detected = detectAshraeOccupancy(val);
                    if (detected && detected.cat && WD_TYPE_MAP[detected.cat] !== undefined) {
                      setNewWdPeople(detected.people);
                      setNewWdCat(detected.cat);
                      setNewWdAutoDetected(true);
                    } else {
                      setNewWdAutoDetected(false);
                    }
                  }}
                  className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">No. of People / Units</label>
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    value={newWdPeople}
                    onChange={(e) => setNewWdPeople(e.target.value !== "" ? Number(e.target.value) : "")}
                    className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Space Multiplier (Qty)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="e.g. 1"
                    value={newWdMultiplier}
                    onChange={(e) => setNewWdMultiplier(e.target.value !== "" ? Math.max(1, Number(e.target.value)) : "")}
                    className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Occupancy Category</label>
                <select
                  value={newWdCat}
                  onChange={(e) => setNewWdCat(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                >
                  <option value="">— Select Category —</option>
                  <optgroup label="Residential">
                    <option value="Residential buildings (flat)">Residential buildings (flat) — 300 LPD</option>
                    <option value="Villas">Villas — 350 LPD</option>
                    <option value="Mixed used residential">Mixed used residential — 350 LPD</option>
                    <option value="Labour accommodation">Labour accommodation — 150 LPD</option>
                  </optgroup>
                  <optgroup label="Office & Commercial">
                    <option value="Offices">Offices — 60 LPD</option>
                    <option value="Headquarters">Headquarters — 80 LPD</option>
                    <option value="Commercial buildings">Commercial buildings — 100 LPD</option>
                    <option value="Mixed used commercial">Mixed used commercial — 80 LPD</option>
                    <option value="Logistic, academic & business center">Logistic & business center — 75 LPD</option>
                  </optgroup>
                  <optgroup label="Retail & Leisure">
                    <option value="Local plaza / retail / town center">Local plaza / retail — 82 LPD</option>
                    <option value="Shops">Shops — 60 LPD</option>
                    <option value="Club house / recreation">Club house / recreation — 100 LPD</option>
                    <option value="Entertainment & leisure / theater">Leisure / theater — 60 LPD</option>
                    <option value="Theatre">Theatre — 50 LPD</option>
                    <option value="Events">Events — 50 LPD</option>
                    <option value="Guardhouse">Guardhouse — 75 LPD</option>
                  </optgroup>
                  <optgroup label="Hospitality & Dining">
                    <option value="Hotels (per guest)">Hotels (per guest) — 300 LPD</option>
                    <option value="Hotels (per employee)">Hotels (per employee) — 80 LPD</option>
                    <option value="Restaurant (per meal)">Restaurant (per meal) — 15 LPD</option>
                    <option value="Visitors">Visitors — 40 LPD</option>
                  </optgroup>
                  <optgroup label="Education">
                    <option value="Schools / university">Schools / university — 60 LPD</option>
                    <option value="Nursery / child care centre">Nursery / child care centre — 70 LPD</option>
                  </optgroup>
                  <optgroup label="Healthcare & Medical">
                    <option value="Medical (per bed)">Medical (per bed) — 450 LPD</option>
                    <option value="Day clinic (per medical practitioner) incl. visitors">Day clinic (per practitioner) — 450 LPD</option>
                    <option value="Laboratory">Laboratory — 80 LPD</option>
                  </optgroup>
                  <optgroup label="Industrial & Workshops">
                    <option value="Industrial (workshops / machinery / warehouse)">Industrial (workshops / warehouse) — 80 LPD</option>
                    <option value="Manufacturing / mineral">Manufacturing / mineral — 80 LPD</option>
                  </optgroup>
                  <optgroup label="Public & Assembly">
                    <option value="Mosques">Mosques — 60 LPD</option>
                    <option value="Public amenities">Public amenities — 50 LPD</option>
                  </optgroup>
                  <optgroup label="Custom / Override">
                    <option value="Custom Rate / Category">✨ Custom Rate / Custom Category...</option>
                  </optgroup>
                </select>
              </div>

              {newWdCat === "Custom Rate / Category" && (
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Custom Per Capita Rate ({ip ? "gpd" : "LPD"})</label>
                  <input
                    type="number"
                    placeholder={ip ? "e.g. 30 gpd" : "e.g. 100 LPD"}
                    value={newWdCustomLpd}
                    onChange={(e) => setNewWdCustomLpd(e.target.value !== "" ? Number(e.target.value) : "")}
                    className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddWdModal(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isEffectiveReadOnly}
                onClick={handleAddWd}
                className="px-4 py-2 bg-[#0A7BC7] hover:bg-[#0863a0] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="size-4" /> Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Irrigation Plant Area Modal Popup */}
      {showAddIrrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0A7BC7]/10 rounded-xl text-[#0A7BC7]">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Add Irrigation Plant Area</h3>
                  <p className="text-xs text-muted-foreground">Add a landscape area to the irrigation schedule</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddIrrModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Area ({ip ? "ft²" : "m²"})</label>
                <input
                  type="number"
                  placeholder="e.g. 100"
                  value={newIrrArea}
                  onChange={(e) => setNewIrrArea(e.target.value !== "" ? Number(e.target.value) : "")}
                  className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Vegetation Type</label>
                <select
                  value={newIrrVegType}
                  onChange={(e) => setNewIrrVegType(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                >
                  <option value="">— Select Plant Type —</option>
                  {Object.keys(IRR_TYPE_MAP).map((k) => (
                    <option key={k} value={k}>
                      {k} — {IRR_TYPE_MAP[k]} L/m²
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddIrrModal(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isEffectiveReadOnly}
                onClick={handleAddIrr}
                className="px-4 py-2 bg-[#0A7BC7] hover:bg-[#0863a0] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="size-4" /> Add Plant Area
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Formula Breakdown Modal */}
      {showFormulaModal && (
        <WaterDemandFormulaBreakdownModal
          onClose={() => setShowFormulaModal(false)}
          unitSystem={unitSystem}
          calculations={calculations}
          wdRows={wdRows}
          irrRows={irrRows}
          poolArea={poolArea}
          poolDepth={poolDepth}
          fireFlow={fireFlow}
          storageDays={storageDays}
          presetStandard={presetStandard}
        />
      )}
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Browser Preliminary Engineering Report Component (Matching Preliminary Cooling Load Standard)
// ─────────────────────────────────────────────────────────────────────────────
function WaterDemandReportView({
  calculations,
  wdRows,
  irrRows,
  poolArea,
  poolDepth,
  poolEvap,
  fireFlow,
  storageDays,
  groundTankPct,
  overheadTanks,
  fillWindowHours,
  peakFactor,
  unitSystem,
  presetStandard,
  project,
  calcReviewState,
  currentUserName,
  onExportPdf,
}: {
  calculations: any;
  wdRows: WDRow[];
  irrRows: IrrRow[];
  poolArea: number | "";
  poolDepth: number | "";
  poolEvap: number;
  fireFlow: number | "";
  storageDays: number;
  groundTankPct: number;
  overheadTanks: OverheadTank[];
  fillWindowHours: number;
  peakFactor: number;
  unitSystem: "si" | "ip";
  presetStandard: string;
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  onExportPdf: () => void;
}) {
  const ip = unitSystem === "ip";
  const sigDetails = getSignatureBlockDetails(project?.id || "default", "/plumbing-water-demand", currentUserName, calcReviewState);

  // Group domestic rows by occupancy category
  const groupedWd: Record<string, WDRow[]> = {};
  wdRows.forEach((r) => {
    const cat = r.cat || "General";
    if (!groupedWd[cat]) groupedWd[cat] = [];
    groupedWd[cat].push(r);
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
      <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
        
        {/* 1. Title */}
        <div className="pb-1">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Water Demand &amp; Storage Tank Sizing Calculation
          </h2>
        </div>

        {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
        <div className="border border-border rounded-xl overflow-hidden text-xs">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-border divide-x divide-border">
                <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                <td className="p-2.5 font-mono text-foreground font-medium">{(project as any)?.calcNo || "CALC-PLUM-WD01"}</td>
                <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                <td className="p-2.5 font-mono font-medium">{formatDateStr(new Date().toISOString())}</td>
              </tr>
              <tr className="border-b border-border divide-x divide-border">
                <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                <td className="p-2.5 font-mono">{project?.code || (project as any)?.projectNo || "MEP-P001"}</td>
                <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                <td className="p-2.5">{project?.client || "Prestige Group developers"}</td>
              </tr>
              <tr className="divide-x divide-border">
                <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                <td className="p-2.5">{project?.name || "Water Demand & Storage Tank Sizing"}</td>
                <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                <td className="p-2.5">{(project as any)?.endUser || "Building Authority"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. Table 1: Design Parameters & Overall Summary */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            1. Executive Design Parameter Summary
          </h3>
          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                  <th className="p-2 border-r border-border text-center w-12">No.</th>
                  <th className="p-2 border-r border-border text-left">Executive Design Parameter Summary</th>
                  <th className="p-2 border-r border-border text-center w-32">Value</th>
                  <th className="p-2 border-r border-border text-center w-24">Unit</th>
                  <th className="p-2 text-left">Standard / Code Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">1</td>
                  <td className="p-2 border-r border-border font-bold">Total Occupied Spaces</td>
                  <td className="p-2 border-r border-border text-center font-bold font-mono">{wdRows.length}</td>
                  <td className="p-2 border-r border-border text-center">spaces</td>
                  <td className="p-2 text-muted-foreground">Architectural Space Inventory</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">2</td>
                  <td className="p-2 border-r border-border font-bold">Total Occupancy Headcount</td>
                  <td className="p-2 border-r border-border text-center font-bold font-mono">{(calculations.totalPeople || 0).toLocaleString()}</td>
                  <td className="p-2 border-r border-border text-center">people</td>
                  <td className="p-2 text-muted-foreground">Scheduled Design Occupancy</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">3</td>
                  <td className="p-2 border-r border-border font-bold">Domestic Daily Water Demand</td>
                  <td className="p-2 border-r border-border text-center font-bold font-mono">
                    {(ip ? Math.round((calculations.totalWaterL || 0) / 3.78541) : Math.round(calculations.totalWaterL || 0)).toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-border text-center">{ip ? "gal/day" : "L/day"}</td>
                  <td className="p-2 text-muted-foreground">Governing Standard Allowance</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">4</td>
                  <td className="p-2 border-r border-border font-bold">Domestic Peak Flow Rate</td>
                  <td className="p-2 border-r border-border text-center font-bold font-mono">
                    {ip ? Math.round(calculations.peakGPM || 0).toLocaleString() : (calculations.peakLPS || 0).toFixed(2)}
                  </td>
                  <td className="p-2 border-r border-border text-center">{ip ? "GPM" : "L/s"}</td>
                  <td className="p-2 text-muted-foreground">Peak Multiplier K = {peakFactor}</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">5</td>
                  <td className="p-2 border-r border-border font-bold">Irrigation Daily Water Load</td>
                  <td className="p-2 border-r border-border text-center font-bold font-mono">
                    {(ip ? Math.round((calculations.totalIrrL || 0) / 3.78541) : Math.round(calculations.totalIrrL || 0)).toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-border text-center">{ip ? "gal/day" : "L/day"}</td>
                  <td className="p-2 text-muted-foreground">Landscaping Vegetation Schedule</td>
                </tr>
                {poolArea && poolDepth && (
                  <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">6</td>
                    <td className="p-2 border-r border-border font-bold">Swimming Pool Makeup Water</td>
                    <td className="p-2 border-r border-border text-center font-bold font-mono">
                      {(ip ? Math.round((calculations.poolDemandL || 0) / 3.78541) : Math.round(calculations.poolDemandL || 0)).toLocaleString()}
                    </td>
                    <td className="p-2 border-r border-border text-center">{ip ? "gal/day" : "L/day"}</td>
                    <td className="p-2 text-muted-foreground">Evaporation Loss {poolEvap}%/day + Backwash</td>
                  </tr>
                )}
                {fireFlow && (
                  <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">7</td>
                    <td className="p-2 border-r border-border font-bold">Fire Fighting Dedicated Reserve</td>
                    <td className="p-2 border-r border-border text-center font-bold font-mono text-red-600 dark:text-red-400">
                      {(ip ? Math.round((calculations.fireCapL || 0) / 3.78541) : Math.round(calculations.fireCapL || 0)).toLocaleString()}
                    </td>
                    <td className="p-2 border-r border-border text-center">{ip ? "gal" : "L"}</td>
                    <td className="p-2 text-muted-foreground">60-Min Standard Duration (NFPA 13/14)</td>
                  </tr>
                )}
                <tr className="bg-slate-50/70 dark:bg-zinc-900/60 font-bold border-t-2 border-b border-border">
                  <td className="p-2 border-r border-border text-center text-muted-foreground">—</td>
                  <td className="p-2 border-r border-border font-bold">TOTAL DAILY WATER DEMAND</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold bg-sky-100/70 dark:bg-sky-900/30 text-foreground">
                    {(ip ? Math.round((calculations.grandTotalL || 0) / 3.78541) : Math.round(calculations.grandTotalL || 0)).toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-border text-center font-bold">{ip ? "gal/day" : "L/day"}</td>
                  <td className="p-2 text-muted-foreground">Combined Site Daily Service Load</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">8</td>
                  <td className="p-2 border-r border-border font-bold">Total Storage Autonomy Retention</td>
                  <td className="p-2 border-r border-border text-center font-bold font-mono">
                    {ip ? Math.round(calculations.reqStorageGal || 0).toLocaleString() : (calculations.reqStorageM3 || 0).toFixed(2)}
                  </td>
                  <td className="p-2 border-r border-border text-center">{ip ? "gal" : "m³"}</td>
                  <td className="p-2 text-muted-foreground">{storageDays} Day(s) Mandatory Storage Duration</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">9</td>
                  <td className="p-2 border-r border-border font-bold">Ground Water Break Tank</td>
                  <td className="p-2 border-r border-border text-center font-bold font-mono">
                    {(ip ? Math.round((calculations.groundTankL || 0) / 3.78541) : Math.round(calculations.groundTankL || 0)).toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-border text-center">{ip ? "gal" : "L"}</td>
                  <td className="p-2 text-muted-foreground">{calculations.groundPct}% Ground Split ({calculations.groundDim.l}m × {calculations.groundDim.w}m × {calculations.groundDim.h}m)</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">10</td>
                  <td className="p-2 border-r border-border font-bold">Transfer Pumping Duty Flow Rate</td>
                  <td className="p-2 border-r border-border text-center font-bold font-mono">
                    {ip ? (calculations.transferPumpGPM || 0).toFixed(1) : (calculations.transferPumpLPS || 0).toFixed(2)}
                  </td>
                  <td className="p-2 border-r border-border text-center">{ip ? "GPM" : "L/s"}</td>
                  <td className="p-2 text-muted-foreground">Designed for {fillWindowHours}-Hour Roof Tank Filling Window</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Table 2: Water Storage Tanks & Transfer Pump Physical Sizing */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            2. Water Storage Tanks &amp; Transfer Pump Physical Sizing
          </h3>
          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                  <th className="p-2 border-r border-border text-center w-12">No.</th>
                  <th className="p-2 border-r border-border text-left">Facility / Equipment</th>
                  <th className="p-2 border-r border-border text-left">Specification &amp; Tank Type</th>
                  <th className="p-2 border-r border-border text-center w-24">Allocation</th>
                  <th className="p-2 border-r border-border text-center w-28">Effective Capacity</th>
                  <th className="p-2 border-r border-border text-center w-20">Unit</th>
                  <th className="p-2 text-left">Suggested Dimensions / Operating Duty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">1</td>
                  <td className="p-2 border-r border-border font-bold">Ground Water Break Tank</td>
                  <td className="p-2 border-r border-border text-muted-foreground">Reinforced Concrete / Sectional GRP</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">{calculations.groundPct}%</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">{calculations.displayGroundTank}</td>
                  <td className="p-2 border-r border-border text-center font-mono">{ip ? "gal" : "L"}</td>
                  <td className="p-2 font-mono text-muted-foreground">{calculations.groundDim.l}m L × {calculations.groundDim.w}m W × {calculations.groundDim.h}m H (+0.3m Freeboard)</td>
                </tr>
                {calculations.overheadTanksCalculated.map((t: any, idx: number) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">{idx + 2}</td>
                    <td className="p-2 border-r border-border font-bold">{t.name}</td>
                    <td className="p-2 border-r border-border text-muted-foreground">Modular Sectional GRP / Polyethylene</td>
                    <td className="p-2 border-r border-border text-center font-mono font-bold">{t.sharePct.toFixed(0)}%</td>
                    <td className="p-2 border-r border-border text-center font-mono font-bold">{t.displayVol}</td>
                    <td className="p-2 border-r border-border text-center font-mono">{ip ? "gal" : "L"}</td>
                    <td className="p-2 font-mono text-muted-foreground">{t.dim.l}m L × {t.dim.w}m W × {t.dim.h}m H (+0.3m Freeboard)</td>
                  </tr>
                ))}
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">{calculations.overheadTanksCalculated.length + 2}</td>
                  <td className="p-2 border-r border-border font-bold">Roof Transfer Pump</td>
                  <td className="p-2 border-r border-border text-muted-foreground">Vertical Multistage Booster (1W + 1S)</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">100% Roof</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold text-sky-600 dark:text-sky-400">{calculations.displayTransferPump}</td>
                  <td className="p-2 border-r border-border text-center font-mono">{ip ? "GPM" : "L/s"}</td>
                  <td className="p-2 text-muted-foreground">Designed for {fillWindowHours}-Hour Roof Tank Filling Window</td>
                </tr>
                <tr className="bg-slate-50/70 dark:bg-zinc-900/60 font-bold border-t-2 border-b border-border">
                  <td colSpan={3} className="p-2 border-r border-border text-center font-bold">TOTAL STORAGE RETENTION</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">100%</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold bg-sky-100/70 dark:bg-sky-900/30 text-foreground">{calculations.displayTotalStorage}</td>
                  <td className="p-2 border-r border-border text-center font-bold">{ip ? "gal" : "m³"}</td>
                  <td className="p-2 text-muted-foreground">{storageDays} Day(s) Total Autonomy Reserve</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Table 3: Comprehensive Space Water Demand Schedule */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            3. Comprehensive Space Water Demand Schedule
          </h3>
          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                  <th className="p-2 border-r border-border text-center w-12">No.</th>
                  <th className="p-2 border-r border-border text-left">Name of Space / Description</th>
                  <th className="p-2 border-r border-border text-center w-28">Occupancy (People)</th>
                  <th className="p-2 border-r border-border text-center w-20">Multiplier</th>
                  <th className="p-2 border-r border-border text-left">Type of Space / Category</th>
                  <th className="p-2 border-r border-border text-center w-28">Rate ({ip ? "gpd" : "LPD"})</th>
                  <th className="p-2 text-center w-32">Daily Demand ({ip ? "gal" : "L"})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(() => {
                  let sNo = 1;
                  return (
                    <>
                      {Object.keys(groupedWd).sort().map((cat) => (
                        <React.Fragment key={cat}>
                          <tr className="bg-slate-100/80 dark:bg-zinc-800/60 font-bold text-foreground">
                            <td colSpan={7} className="p-2 border-r border-border">Occupancy Category: {cat}</td>
                          </tr>
                          {groupedWd[cat].map((r) => {
                            const rowTotal = ip
                              ? Math.round((r.ppl * r.lpd * (r.multiplier || 1)) / 3.78541)
                              : Math.round(r.ppl * r.lpd * (r.multiplier || 1));
                            const rowRate = ip ? Math.round(r.lpd / 3.78541) : r.lpd;
                            return (
                              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">{sNo++}</td>
                                <td className="p-2 border-r border-border font-medium">{r.name}</td>
                                <td className="p-2 border-r border-border text-center font-mono font-semibold">{r.ppl}</td>
                                <td className="p-2 border-r border-border text-center font-mono text-muted-foreground">×{r.multiplier || 1}</td>
                                <td className="p-2 border-r border-border text-muted-foreground">{r.cat}</td>
                                <td className="p-2 border-r border-border text-center font-mono text-muted-foreground">{rowRate}</td>
                                <td className="p-2 text-center font-mono font-bold text-foreground">{rowTotal.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                      <tr className="bg-slate-50/70 dark:bg-zinc-900/60 font-bold border-t-2 border-b border-border">
                        <td colSpan={2} className="p-2 border-r border-border font-bold">TOTAL DOMESTIC DEMAND</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold">{calculations.totalPeople}</td>
                        <td colSpan={3} className="p-2 border-r border-border"></td>
                        <td className="p-2 text-center font-mono font-bold bg-sky-100/70 dark:bg-sky-900/30 text-foreground">{calculations.displayDomestic}</td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. Table 4: Irrigation Landscaping Schedule */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            4. Irrigation Landscaping Schedule
          </h3>
          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                  <th className="p-2 border-r border-border text-center w-12">No.</th>
                  <th className="p-2 border-r border-border text-left">Vegetation / Plant Type</th>
                  <th className="p-2 border-r border-border text-center w-32">Landscaping Area ({ip ? "ft²" : "m²"})</th>
                  <th className="p-2 border-r border-border text-center w-36">Unit Rate ({ip ? "gal/ft²" : "L/m²"})</th>
                  <th className="p-2 border-r border-border text-center w-36">Daily Demand ({ip ? "gal" : "L"})</th>
                  <th className="p-2 text-left">Irrigation Method / Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {irrRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-3 text-center text-muted-foreground italic">
                      No landscaping / irrigation zones configured.
                    </td>
                  </tr>
                ) : (
                  irrRows.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                      <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="p-2 border-r border-border font-medium">{r.vegType}</td>
                      <td className="p-2 border-r border-border text-center font-mono font-semibold">{r.area}</td>
                      <td className="p-2 border-r border-border text-center font-mono text-muted-foreground">
                        {(ip ? Math.round((r.lpd / 40.7458) * 100) / 100 : r.lpd).toFixed(ip ? 3 : 1)}
                      </td>
                      <td className="p-2 border-r border-border text-center font-mono font-bold text-foreground">
                        {(ip ? Math.round((r.area * r.lpd) / 3.78541) : r.area * r.lpd).toLocaleString()}
                      </td>
                      <td className="p-2 text-muted-foreground">Automatic Drip / Spray System</td>
                    </tr>
                  ))
                )}
                <tr className="bg-slate-50/70 dark:bg-zinc-900/60 font-bold border-t-2 border-b border-border">
                  <td colSpan={2} className="p-2 border-r border-border font-bold">TOTAL IRRIGATION DEMAND</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">
                    {irrRows.reduce((a, b) => a + (Number(b.area) || 0), 0)} {ip ? "ft²" : "m²"}
                  </td>
                  <td colSpan={1} className="p-2 border-r border-border"></td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold bg-sky-100/70 dark:bg-sky-900/30 text-foreground">{calculations.displayIrrigation}</td>
                  <td className="p-2 text-muted-foreground">Automated Irrigation Autonomy</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 7. Table 5: Auxiliary Water Reserves (Swimming Pool & Fire Fighting) - if present */}
        {(poolArea || fireFlow) && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              5. Auxiliary Water Reserves (Swimming Pool &amp; Fire Fighting)
            </h3>
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2 border-r border-border text-center w-12">No.</th>
                    <th className="p-2 border-r border-border text-left">Auxiliary Facility</th>
                    <th className="p-2 border-r border-border text-center w-48">Design Sizing Parameters</th>
                    <th className="p-2 border-r border-border text-center w-36">Daily Demand / Reserve</th>
                    <th className="p-2 text-left">Engineering Sizing Standard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {poolArea && poolDepth && (
                    <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                      <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">1</td>
                      <td className="p-2 border-r border-border font-medium">Swimming Pool Makeup</td>
                      <td className="p-2 border-r border-border text-center font-mono">{poolArea} {ip ? "ft²" : "m²"} Area × {poolDepth} {ip ? "ft" : "m"} Depth</td>
                      <td className="p-2 border-r border-border text-center font-mono font-bold text-foreground">{calculations.displayPoolDemand}</td>
                      <td className="p-2 text-muted-foreground">Evaporation Rate {poolEvap}%/day + Filter Backwash Loss</td>
                    </tr>
                  )}
                  {fireFlow && (
                    <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                      <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">2</td>
                      <td className="p-2 border-r border-border font-medium">Fire Fighting Dedicated Reserve</td>
                      <td className="p-2 border-r border-border text-center font-mono">{fireFlow} USGPM Dedicated Pump Flow</td>
                      <td className="p-2 border-r border-border text-center font-mono font-bold text-red-600 dark:text-red-400">{calculations.displayFireCap}</td>
                      <td className="p-2 text-muted-foreground">60-Min Standard Duration (NFPA 13/14 Life Safety)</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. 3-Tier Signature Sign-Off Block matching Preliminary */}
        <div className="pt-2">
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <table className="w-full border-collapse">
              <thead className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                <tr className="divide-x divide-border">
                  <th className="p-2.5 w-28 text-center bg-card"></th>
                  <th className="p-2.5 text-center w-1/3">Originator</th>
                  <th className="p-2.5 text-center w-1/3">Reviewer</th>
                  <th className="p-2.5 text-center w-1/3">Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="divide-x divide-border">
                  <td className="p-2.5 font-bold text-center bg-muted/10">Name:</td>
                  <td className="p-2.5 text-center font-medium">
                    {sigDetails.originatedName || currentUserName || "Abubakar Chanda"}
                  </td>
                  <td className="p-2.5 text-center font-medium">
                    {sigDetails.reviewerName || ""}
                  </td>
                  <td className="p-2.5 text-center font-medium">
                    {sigDetails.approverName || ""}
                  </td>
                </tr>
                <tr className="divide-x divide-border">
                  <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                  <td className="p-2.5 text-center font-mono">
                    {sigDetails.originatedDate || formatDateStr(new Date().toISOString())}
                  </td>
                  <td className="p-2.5 text-center font-mono">
                    {sigDetails.reviewerDate || ""}
                  </td>
                  <td className="p-2.5 text-center font-mono">
                    {sigDetails.approverDate || ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Drawer Component for Water Demand & Tank Sizer
// ─────────────────────────────────────────────────────────────────────────────
function WaterDemandIntelligenceDrawer({
  onClose,
  calculations,
  wdRows,
  irrRows,
  poolArea,
  poolDepth,
  fireFlow,
  storageDays,
  groundTankPct,
  overheadTanks,
  fillWindowHours,
  unitSystem,
  presetStandard,
  setTab,
  setDemandSection,
}: {
  onClose: () => void;
  calculations: any;
  wdRows: WDRow[];
  irrRows: IrrRow[];
  poolArea: number | "";
  poolDepth: number | "";
  fireFlow: number | "";
  storageDays: number;
  groundTankPct: number;
  overheadTanks: OverheadTank[];
  fillWindowHours: number;
  unitSystem: "si" | "ip";
  presetStandard: string;
  setTab: (t: "demand" | "tanks" | "report") => void;
  setDemandSection: (s: "domestic" | "irrigation" | "pool" | "fire") => void;
}) {
  const ip = unitSystem === "ip";
  const flaggedWd = wdRows.filter((r) => r.flagged).length;
  const flaggedIrr = irrRows.filter((r) => r.flagged).length;
  const totalEntries = wdRows.length + irrRows.length;
  const flaggedTotal = flaggedWd + flaggedIrr;
  const compliancePct = totalEntries > 0 ? Math.round(((totalEntries - flaggedTotal) / totalEntries) * 100) : 100;

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in font-sans">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Close Intelligence Drawer"
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
            {PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name} validation across {totalEntries} entries.
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${compliancePct}%` }} />
            </div>
            <span className="font-mono text-[11px] font-bold text-foreground">{compliancePct}%</span>
          </div>
        </div>

        {/* Demand Breakdown KPI */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplet className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Demand Summary</span>
            </div>
            <button
              onClick={() => { setTab("demand"); setDemandSection("domestic"); }}
              className="text-[10.5px] text-primary hover:underline font-semibold cursor-pointer"
            >
              View Schedule
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Domestic Load:</span>
              <span className="font-mono font-bold text-foreground">{calculations.displayDomestic}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Domestic Peak Flow:</span>
              <span className="font-mono font-bold text-primary">{calculations.displayDomesticPeak}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Irrigation Load:</span>
              <span className="font-mono font-bold text-foreground">{calculations.displayIrrigation}</span>
            </div>
            {poolArea && poolDepth && (
              <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Pool Makeup:</span>
                <span className="font-mono font-bold text-foreground">{calculations.displayPoolDemand}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 font-bold">
              <span className="text-primary">Grand Total Daily:</span>
              <span className="font-mono text-primary text-xs font-extrabold">{calculations.displayGrandTotal}</span>
            </div>
          </div>
        </div>

        {/* Storage & Pump Capacity */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Storage &amp; Pumps</span>
            </div>
            <button
              onClick={() => setTab("tanks")}
              className="text-[10.5px] text-primary hover:underline font-semibold cursor-pointer"
            >
              Configure
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Storage Autonomy:</span>
              <span className="font-mono font-bold text-foreground">{storageDays} Day(s)</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Total Usable Storage:</span>
              <span className="font-mono font-bold text-foreground">{calculations.displayTotalStorage}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Ground Break Tank:</span>
              <span className="font-mono font-bold text-foreground">{calculations.displayGroundTank}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Overhead Roof Tanks:</span>
              <span className="font-mono font-bold text-foreground">{calculations.displayRoofTank} ({overheadTanks.length} tank)</span>
            </div>
            <div className="flex justify-between items-center pt-1 font-bold">
              <span className="text-primary">Transfer Pump Flow:</span>
              <span className="font-mono text-primary text-xs font-extrabold">{calculations.displayTransferPump}</span>
            </div>
          </div>
        </div>

        {/* Calculation Issues & Warnings */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`size-4 ${flaggedTotal > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            <span className="text-xs font-bold text-foreground">Audit &amp; Flagged Items</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Flagged domestic spaces:</span>
              <span className={`font-mono font-bold ${flaggedWd > 0 ? "text-amber-500" : "text-muted-foreground"}`}>{flaggedWd}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Flagged irrigation zones:</span>
              <span className={`font-mono font-bold ${flaggedIrr > 0 ? "text-amber-500" : "text-muted-foreground"}`}>{flaggedIrr}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact Step-by-Step Formula Breakdown & Hydraulic Sizing Modal (Matching Fresh Air Cooling Load Standard)
// ─────────────────────────────────────────────────────────────────────────────
function WaterDemandFormulaBreakdownModal({
  onClose,
  unitSystem,
  calculations,
  wdRows,
  irrRows,
  poolArea,
  poolDepth,
  fireFlow,
  storageDays,
  presetStandard,
}: {
  onClose: () => void;
  unitSystem: "si" | "ip";
  calculations: any;
  wdRows: WDRow[];
  irrRows: IrrRow[];
  poolArea: number | "";
  poolDepth: number | "";
  fireFlow: number | "";
  storageDays: number;
  presetStandard: string;
}) {
  const [activeTab, setActiveTab] = useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = useState(false);
  const ip = unitSystem === "ip";
  const volUnit = ip ? "gal" : "L";
  const m3OrGal = ip ? "gal" : "m³";
  const flowUnit = ip ? "GPM" : "m³/h";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const sampleRow = wdRows[0] || {
    name: "Standard Residential / Commercial Space",
    ppl: 50,
    lpd: 135,
    cat: "Residential buildings (flat)",
    multiplier: 1,
  };

  const ppl = sampleRow.ppl || 50;
  const rateLpd = ip ? Math.round((sampleRow.lpd || 135) / 3.78541) : (sampleRow.lpd || 135);
  const sampleDemand = ip ? Math.round((ppl * (sampleRow.lpd || 135)) / 3.78541) : ppl * (sampleRow.lpd || 135);

  const totalDomestic = calculations.displayDomestic || "0 L/day";
  const totalIrrigation = calculations.displayIrrigation || "0 L/day";
  const totalWater = calculations.displayTotalWater || "0 L/day";
  const tankTotalVol = calculations.displayTotalTankVol || "0 m³";
  const pumpRate = calculations.displayTransferPumpRate || "0 m³/h";

  const handleCopySummary = () => {
    const text = `=== WATER DEMAND & STORAGE TANK SIZING FORMULA BREAKDOWN ===
Governing Design Standards: IPC (International Plumbing Code), BS EN 806 & NBC 2016
Design Standard Preset: ${PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name || "Standard Baseline"}
Unit System: ${ip ? "IP Imperial (US Gallons, GPD, GPM)" : "SI Metric (Liters, LPD, m³, m³/h)"}

--- 1. ACTIVE SIZING PARAMETERS ---
• Sample Space: ${sampleRow.name} (${sampleRow.cat})
• Population / Units: ${ppl} Persons @ ${rateLpd} ${volUnit}/person/day = ${sampleDemand.toLocaleString()} ${volUnit}/day
• Total Daily Domestic Demand: ${totalDomestic}
• Total Daily Landscape Irrigation Demand: ${totalIrrigation}
• Gross Building Daily Water Demand: ${totalWater}
• Storage Retention Period: ${storageDays} Day(s) Reserve Autonomy
• Recommended Total Storage Reservoir: ${tankTotalVol}
• Transfer Pump Flow Duty: ${pumpRate}

--- 2. STEP-BY-STEP CALCULATION STEPS ---
[1] Occupant Domestic Consumption:
    Q_domestic = ∑ (Persons × Per_Capita_LPD × Multiplier) = ${totalDomestic}

[2] Landscape Irrigation Requirement:
    Q_irrigation = ∑ (Plant_Area × Evapotranspiration_Rate) = ${totalIrrigation}

[3] Swimming Pool Evaporative Makeup (if applicable):
    Q_pool = Pool_Surface_Area × Mean_Depth × 0.02 Evaporation_Rate

[4] Gross Daily Consumption:
    Q_total = Q_domestic + Q_irrigation + Q_pool = ${totalWater}

[5] Domestic Storage Reservoir Volume (UG Tank + OH Tank):
    V_storage = Q_total × Retention_Days × 1.15 (15% Freeboard/Ullage) = ${tankTotalVol}

[6] Dedicated Fire Reserve Compartment:
    V_fire = ${calculations.displayFireDemand || "150,000 L / 40,000 gal (Dedicated uncompromised suction)"}

[7] Transfer Pump Sizing:
    Q_pump = V_overhead_tank / Refill_Window_Hours = ${pumpRate}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Water demand calculation breakdown copied to clipboard!");
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
                Water Demand &amp; Tank Sizing Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              IPC / BS EN 806
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
                    Standard: {presetStandard}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Design Allowance</span>
                    <span className="font-mono font-bold text-foreground">{ppl} Persons @ {rateLpd} {volUnit}/day</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Total Building Demand</span>
                    <span className="font-mono font-bold text-foreground">{totalWater}</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: DOMESTIC WATER DEMAND */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">1</span>
                    <span className="font-bold text-[11.5px] text-foreground">Occupant Domestic Demand</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {sampleDemand.toLocaleString()} {volUnit}/day
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_domestic = Persons × Per_Capita_LPD</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{ppl} Persons × {rateLpd} {volUnit}/day</span>
                    <span className="text-primary font-bold">= {sampleDemand.toLocaleString()} {volUnit}/day</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: LANDSCAPE IRRIGATION DEMAND */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">2</span>
                    <span className="font-bold text-[11.5px] text-foreground">Landscape Irrigation Requirement</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {totalIrrigation}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_irrigation = ∑ (Plant_Area × Water_Allowance)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{irrRows.length} Irrigation Zones</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {totalIrrigation}</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: STORAGE RESERVOIR CAPACITY */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">3</span>
                    <span className="font-bold text-[11.5px] text-foreground">Storage Reservoir Autonomy ({storageDays} Days)</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {tankTotalVol}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: V_tank = (Daily_Water × Days_Storage) × 1.15 Freeboard</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{totalWater} × {storageDays} day(s)</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">= {tankTotalVol}</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: TRANSFER PUMP FLOW RATE */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">4</span>
                    <span className="font-bold text-[11.5px] text-foreground">Roof Transfer Pump Sizing</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {pumpRate}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_pump = Overhead_Tank_Vol / Refill_Window_Hours</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Standard 2-Hour Tank Refill Cycle</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">= {pumpRate}</span>
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
                  <span className="size-2 rounded-full bg-primary" /> 1. Domestic Water Demand (Fixture Unit &amp; Per-Capita)
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg font-mono text-[11px] space-y-1 border border-border/60">
                  <div className="text-primary font-bold">Q_domestic = ∑ (N_occupants × Rate_LPD × Multiplier)</div>
                  <div className="text-foreground">Q_total = Q_domestic + Q_irrigation + Q_pool</div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Per-capita daily water allowance is derived from BS EN 806, IPC, and NBC 2016 occupancy benchmarks (e.g. 135-200 LPD for residential, 45-60 LPD for commercial offices).
                </p>
              </div>

              <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                <div className="font-bold text-foreground text-[12px] flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" /> 2. Reservoir Storage Volume &amp; Distribution
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg font-mono text-[11px] space-y-1 border border-border/60">
                  <div className="text-blue-600 dark:text-blue-400 font-bold">V_storage = Q_total × Days_Retention × 1.15 (Freeboard)</div>
                  <div className="text-foreground">V_underground = V_storage × 67% | V_overhead = V_storage × 33%</div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The standard architectural convention distributes 2/3 of total domestic storage in the underground water reservoir and 1/3 in roof overhead tanks for gravity feed.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: VARIABLES REFERENCE */}
          {activeTab === "variables" && (
            <div className="space-y-2">
              <div className="border border-border rounded-xl overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <tr className="divide-x divide-border">
                      <th className="p-2 text-left w-24">Symbol</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left w-24">Code Basis</th>
                      <th className="p-2 text-left w-20">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">N_ppl</td>
                      <td className="p-2 text-muted-foreground">Count of permanent or transient occupants</td>
                      <td className="p-2 font-mono text-[11px]">Architectural</td>
                      <td className="p-2 font-mono text-[11px]">Persons</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">LPD</td>
                      <td className="p-2 text-muted-foreground">Daily per-capita water consumption allowance</td>
                      <td className="p-2 font-mono text-[11px]">IPC / BS EN 806</td>
                      <td className="p-2 font-mono text-[11px]">{volUnit}/person/day</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">Q_total</td>
                      <td className="p-2 text-muted-foreground">Gross combined daily water demand of facility</td>
                      <td className="p-2 font-mono text-[11px]">Calculated</td>
                      <td className="p-2 font-mono text-[11px]">{volUnit}/day</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">Retention</td>
                      <td className="p-2 text-muted-foreground">Emergency reserve autonomy without municipal refill</td>
                      <td className="p-2 font-mono text-[11px]">1.0 - 2.0 Days</td>
                      <td className="p-2 font-mono text-[11px]">Days</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">Q_pump</td>
                      <td className="p-2 text-muted-foreground">Water transfer pump rated delivery discharge flow</td>
                      <td className="p-2 font-mono text-[11px]">Hydraulic</td>
                      <td className="p-2 font-mono text-[11px]">{flowUnit}</td>
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
