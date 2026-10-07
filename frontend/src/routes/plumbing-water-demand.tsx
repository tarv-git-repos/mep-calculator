import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfHeader, addPdfSignatureBlock, formatDateStr, resolveLatestReviewState, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { Trash2, Plus, Download, Save, Info, Droplet, Building2, Layers, Globe, Sparkles, FileSpreadsheet, MessageSquare, Copy, Calculator, X, FileText, Printer, SlidersHorizontal, Check, Filter, ArrowUpDown, Search, Flag, Gauge, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuShortcut } from "@/components/ui/context-menu";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { downloadFile } from "@/lib/download";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
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
  const [showModalPreview, setShowModalPreview] = useState(true);
  const [previewTarget, setPreviewTarget] = useState<{
    type: "domestic" | "irrigation" | "summary" | "tank" | "pump" | "pool" | "fire";
    rowId?: number;
  } | null>(null);

  // Search, Filter, Sort state for toolbar
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>("");
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

  // Dynamic Column Width Adjusting State
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    select: 48,
    name: 240,
    ppl: 110,
    multiplier: 120,
    cat: 220,
    lpd: 140,
    load: 130,
    actions: 90,
    irr_select: 48,
    irr_vegType: 240,
    irr_area: 130,
    irr_rate: 130,
    irr_load: 130,
    irr_actions: 90,
  });

  const startResizing = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 120;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const minW = colKey.includes("select") ? 36 : colKey.includes("actions") ? 70 : 80;
      const newWidth = Math.max(minW, startWidth + (moveEvent.clientX - startX));
      setColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const activeFiltersCount = (selectedCatFilter ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedCatFilter("");
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
  }, [wdRows, searchQuery, selectedCatFilter, sortBy, sortOrder]);

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

      // 3. Delete / Backspace: Delete selected rows
      if (e.key === "Delete" || e.key === "Backspace") {
        if (tab === "demand" && demandSection === "domestic" && selectedWdRows.size > 0) {
          e.preventDefault();
          const count = selectedWdRows.size;
          setWdRows((prev) => prev.filter((r) => !selectedWdRows.has(r.id)));
          setSelectedWdRows(new Set());
          setLastClickedWdIndex(null);
          toast.info(`Deleted ${count} selected domestic entry(s)`);
        } else if (tab === "demand" && demandSection === "irrigation" && selectedIrrRows.size > 0) {
          e.preventDefault();
          const count = selectedIrrRows.size;
          setIrrRows((prev) => prev.filter((r) => !selectedIrrRows.has(r.id)));
          setSelectedIrrRows(new Set());
          setLastClickedIrrIndex(null);
          toast.info(`Deleted ${count} selected irrigation entry(s)`);
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
    setWdRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextState = !r.flagged;
          toast.info(nextState ? `Flagged "${r.name}" for review` : `Unflagged "${r.name}"`);
          return { ...r, flagged: nextState };
        }
        return r;
      })
    );
  };

  const handleToggleIrrFlag = (id: number) => {
    setIrrRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextState = !r.flagged;
          toast.info(nextState ? `Flagged "${r.vegType}" for review` : `Unflagged "${r.vegType}"`);
          return { ...r, flagged: nextState };
        }
        return r;
      })
    );
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
          projectNo: project?.code || project?.projectNo,
          calcNo: project?.calcNo,
          endUser: project?.endUser || project?.location,
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
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Header Bar */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                Water Demand &amp; Tank Sizer
              </h1>
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

              {/* Right Side Header Controls: Standard Dropdown */}
              <div className="flex items-center gap-2 flex-wrap">
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
              </div>
            </div>

            {/* Row 2: Action Toolbar (Search, Filter, Sort, Auto-Calculate, Import, Export, + New Entry) */}
            {tab !== "report" && (
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 dark:bg-slate-900/30 shrink-0 select-none no-print border-b border-border/50 gap-3 flex-wrap">
                {/* Left Side: Search Filter & Sort Options */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex items-center">
                    <Search className="size-3.5 absolute left-3 text-muted-foreground pointer-events-none" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter entries..."
                      className="h-8 w-48 pl-8 pr-3 bg-background border border-border rounded-full text-xs outline-none focus:border-primary transition-all"
                    />
                  </div>

                  {/* Filter Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer group overflow-visible ${
                          activeFiltersCount > 0
                            ? "bg-primary/10 border-primary/45 text-primary font-medium"
                            : "border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                        }`}
                        title="Filter entries"
                      >
                        <Filter className="size-3.5 shrink-0" />
                        {activeFiltersCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-xs">
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
                    </PopoverContent>
                  </Popover>

                  {/* Sort Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer group overflow-visible ${
                          sortBy !== "none"
                            ? "bg-primary/10 border-primary/45 text-primary font-medium"
                            : "border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                        }`}
                        title="Sort entries"
                      >
                        <ArrowUpDown className="size-3.5 shrink-0" />
                        {sortBy !== "none" && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-xs">
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
                </div>

                {/* Right Side Actions */}
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
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
                    <Download className="size-3.5" /> Import
                  </TBtn>
                  <TBtn onClick={handleExportPDF} title="Generate and Export PDF Report">
                    <FileText className="size-3.5" /> Export
                  </TBtn>
                  <TBtn
                    primary
                    disabled={isEffectiveReadOnly}
                    onClick={() => {
                      if (isEffectiveReadOnly) {
                        toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to add entries.", { id: "readonly-notice" });
                        return;
                      }
                      if (demandSection === "irrigation") setShowAddIrrModal(true);
                      else setShowAddWdModal(true);
                    }}
                  >
                    <Plus className="size-3.5" /> New Entry
                  </TBtn>
                </div>
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
                      {/* Floating Bulk Action Overlay Bar when rows selected */}
                      {selectedWdRows.size > 0 && (
                        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 h-10 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg border-b border-primary/20">
                          <div className="flex items-center gap-2">
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
                                setWdRows((prev) => prev.filter((r) => !selectedWdRows.has(r.id)));
                                setSelectedWdRows(new Set());
                                setLastClickedWdIndex(null);
                                toast.info(`Deleted ${count} selected entry(s)`);
                              }}
                            >
                              Delete
                            </BulkBtn>
                          </div>
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

                    {/* Domestic Table */}
                    <div className="overflow-x-auto overflow-y-auto w-full flex-1 min-h-0">
                      <table className="w-full border-collapse text-[12px] font-sans text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/80 text-muted-foreground uppercase text-[11px] tracking-wider font-bold select-none">
                            <th style={{ width: colWidths.select, minWidth: colWidths.select }} className="py-2 px-2 text-center relative group">
                              <input
                                type="checkbox"
                                disabled={isLocked}
                                checked={filteredAndSortedWdRows.length > 0 && selectedWdRows.size === filteredAndSortedWdRows.length && !isLocked}
                                onChange={toggleSelectAllWd}
                                className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Select All / Deselect All (Ctrl+A)"
                              />
                              <div onMouseDown={(e) => startResizing("select", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.name, minWidth: colWidths.name }} className="py-2 px-3 text-left relative group">
                              DESCRIPTION
                              <div onMouseDown={(e) => startResizing("name", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.ppl, minWidth: colWidths.ppl }} className="py-2 px-3 text-center relative group">
                              PEOPLE / UNIT
                              <div onMouseDown={(e) => startResizing("ppl", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.multiplier, minWidth: colWidths.multiplier }} className="py-2 px-3 text-center relative group">
                              SPACE MULTIPLIER
                              <div onMouseDown={(e) => startResizing("multiplier", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.cat, minWidth: colWidths.cat }} className="py-2 px-3 text-left relative group">
                              CATEGORY
                              <div onMouseDown={(e) => startResizing("cat", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.lpd, minWidth: colWidths.lpd }} className="py-2 px-3 text-right relative group">
                              PER CAPITA RATE
                              <div onMouseDown={(e) => startResizing("lpd", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.load, minWidth: colWidths.load }} className="py-2 px-3 text-right relative group">
                              DAILY LOAD
                              <div onMouseDown={(e) => startResizing("load", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.actions, minWidth: colWidths.actions }} className="py-2 px-2 text-center relative group">
                              ACTIONS
                              <div onMouseDown={(e) => startResizing("actions", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
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
                                    onClick={(e) => {
                                      if (isLocked) return;
                                      toggleWdRowSelection(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                    }}
                                    onDoubleClick={(e) => {
                                      if (isLocked) return;
                                      setSelectedWdRows(new Set([r.id]));
                                      setPreviewTarget({ type: "domestic", rowId: r.id });
                                      setPreviewModalOpen(true);
                                    }}
                                    title={isLocked ? undefined : "Click to select, Shift+Click for range, Ctrl+Click for multi-select. Double-click to open parameters & calculation breakdown."}
                                    className={`border-b border-border/40 transition-colors ${isLocked ? "cursor-default" : "cursor-pointer"} select-none ${
                                      selectedWdRows.has(r.id)
                                        ? "bg-[#0A7BC7]/15 dark:bg-[#0A7BC7]/25 border-l-2 border-l-[#0A7BC7]"
                                        : r.flagged
                                        ? "bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/50"
                                        : idx % 2 === 0
                                        ? "bg-white dark:bg-slate-950 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                        : "bg-slate-50/40 dark:bg-slate-900/20 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                    }`}
                                  >
                                    <td 
                                      style={{ width: colWidths.select, minWidth: colWidths.select }} 
                                      className="py-1.5 px-2 text-center" 
                                      onClick={(e) => e.stopPropagation()}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <div className="flex items-center justify-center gap-1.5">
                                        <input
                                          type="checkbox"
                                          disabled={isLocked}
                                          checked={selectedWdRows.has(r.id) && !isLocked}
                                          onChange={() => {
                                            if (isLocked) return;
                                            toggleWdRowSelection(r.id, false, true);
                                          }}
                                          className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-muted-foreground font-mono text-xs">{idx + 1}</span>
                                        {r.flagged && (
                                          <span title="Flagged for review" className="inline-flex">
                                            <Flag className="size-3 text-amber-500 fill-amber-500" />
                                          </span>
                                        )}
                                        {r.comments && r.comments.length > 0 && (
                                          <button
                                            type="button"
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
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-500/20 transition cursor-pointer"
                                            title={`${r.comments.length} comment(s) — Click to view`}
                                          >
                                            <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                            <span>{r.comments.length}</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td 
                                      style={{ width: colWidths.name, minWidth: colWidths.name }} 
                                      className="py-1.5 px-3 cursor-pointer"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        {r.autoDetected && (
                                          <span
                                            className="size-1.5 rounded-full bg-[#0A7BC7] shrink-0 inline-block"
                                            title="Auto-detected according to ASHRAE / DEWA standard"
                                          />
                                        )}
                                        <input
                                          type="text"
                                          value={r.name}
                                          disabled={isLocked}
                                          onClick={(e) => e.stopPropagation()}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            if (isLocked) return;
                                            setSelectedWdRows(new Set([r.id]));
                                            setPreviewTarget({ type: "domestic", rowId: r.id });
                                            setPreviewModalOpen(true);
                                          }}
                                          onChange={(e) => handleWdRowChange(r.id, "name", e.target.value)}
                                          className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-semibold text-foreground text-xs cursor-pointer focus:cursor-text"
                                        />
                                      </div>
                                    </td>
                                    <td 
                                      style={{ width: colWidths.ppl, minWidth: colWidths.ppl }} 
                                      className="py-1.5 px-3 text-center font-bold cursor-pointer"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <input
                                        type="number"
                                        value={r.ppl}
                                        disabled={isLocked}
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          if (isLocked) return;
                                          setSelectedWdRows(new Set([r.id]));
                                          setPreviewTarget({ type: "domestic", rowId: r.id });
                                          setPreviewModalOpen(true);
                                        }}
                                        onChange={(e) => handleWdRowChange(r.id, "ppl", Number(e.target.value))}
                                        className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium text-xs cursor-pointer focus:cursor-text"
                                      />
                                    </td>
                                    <td 
                                      style={{ width: colWidths.multiplier, minWidth: colWidths.multiplier }} 
                                      className="py-1.5 px-3 text-center font-bold cursor-pointer"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min={1}
                                        value={r.multiplier || 1}
                                        disabled={isLocked}
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          if (isLocked) return;
                                          setSelectedWdRows(new Set([r.id]));
                                          setPreviewTarget({ type: "domestic", rowId: r.id });
                                          setPreviewModalOpen(true);
                                        }}
                                        onChange={(e) => handleWdRowChange(r.id, "multiplier", Math.max(1, Number(e.target.value)))}
                                        className="w-14 text-center bg-transparent border border-slate-200/80 dark:border-slate-800 hover:border-[#0A7BC7] focus:border-[#0A7BC7] focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-mono text-xs font-bold outline-none cursor-pointer focus:cursor-text"
                                        title="Space multiplier / quantity of identical spaces"
                                      />
                                    </td>
                                    <td 
                                      style={{ width: colWidths.cat, minWidth: colWidths.cat }} 
                                      className="py-1.5 px-3 cursor-pointer"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <select
                                        value={r.cat}
                                        disabled={isLocked}
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          if (isLocked) return;
                                          setSelectedWdRows(new Set([r.id]));
                                          setPreviewTarget({ type: "domestic", rowId: r.id });
                                          setPreviewModalOpen(true);
                                        }}
                                        onChange={(e) => handleWdRowChange(r.id, "cat", e.target.value)}
                                        className="w-full bg-transparent border border-transparent hover:border-border/60 focus:border-[#0A7BC7] focus:bg-white dark:focus:bg-slate-950 outline-none cursor-pointer py-0.5 px-1 rounded text-xs font-medium"
                                      >
                                        {Object.keys(WD_TYPE_MAP).map((k) => (
                                          <option key={k} value={k}>
                                            {k}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td 
                                      style={{ width: colWidths.lpd, minWidth: colWidths.lpd }} 
                                      className="py-1.5 px-3 text-right font-mono font-medium cursor-pointer"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      <div className="flex items-center justify-end gap-1">
                                        <input
                                          type="number"
                                          value={ip ? Math.round(r.lpd / 3.78541) : r.lpd}
                                          disabled={isLocked}
                                          onClick={(e) => e.stopPropagation()}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            if (isLocked) return;
                                            setSelectedWdRows(new Set([r.id]));
                                            setPreviewTarget({ type: "domestic", rowId: r.id });
                                            setPreviewModalOpen(true);
                                          }}
                                          onChange={(e) => {
                                            const val = Number(e.target.value);
                                            const lpdVal = ip ? Math.round(val * 3.78541) : val;
                                            handleWdRowChange(r.id, "lpd", lpdVal);
                                          }}
                                          className="w-16 text-right bg-transparent border border-slate-200/80 dark:border-slate-800 hover:border-[#0A7BC7] focus:border-[#0A7BC7] focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-mono text-xs font-bold text-foreground outline-none transition-colors cursor-pointer focus:cursor-text"
                                          title="Click or type to edit custom per capita consumption rate"
                                        />
                                        <span className="text-[10.5px] text-muted-foreground font-semibold select-none">{ip ? "gpd" : "LPD"}</span>
                                      </div>
                                    </td>
                                    <td 
                                      style={{ width: colWidths.load, minWidth: colWidths.load }} 
                                      className="py-1.5 px-3 text-right font-mono font-bold text-xs text-[#0A7BC7] cursor-pointer"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked) return;
                                        setSelectedWdRows(new Set([r.id]));
                                        setPreviewTarget({ type: "domestic", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                    >
                                      {(ip ? Math.round((r.ppl * r.lpd * (r.multiplier || 1)) / 3.78541) : r.ppl * r.lpd * (r.multiplier || 1)).toLocaleString()} {ip ? "gal" : "L"}
                                    </td>
                                    <td style={{ width: colWidths.actions, minWidth: colWidths.actions }} className="py-1.5 px-2 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleWdFlag(r.id)}
                                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                            r.flagged
                                              ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                                              : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                          }`}
                                          title={r.flagged ? "Flagged for review" : "Flag for review"}
                                        >
                                          <Flag className={`size-3.5 ${r.flagged ? "fill-amber-500" : ""}`} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setWdRows((prev) => prev.filter((x) => x.id !== r.id));
                                            toast.success(`Deleted "${r.name}"`);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                          title="Delete entry"
                                        >
                                          <Trash2 className="size-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
                                  <ContextMenuItem
                                    onClick={() => {
                                      setPreviewTarget({ type: "domestic", rowId: r.id });
                                      setPreviewModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                  >
                                    <Calculator className="size-3.5 text-muted-foreground" />
                                    <span>Calculation Breakdown</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                                  </ContextMenuItem>
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
                                    <span>Add / View Comment</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => handleToggleWdFlag(r.id)}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                  >
                                    <Flag className={`size-3.5 ${r.flagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                                    <span>{r.flagged ? "Unflag Row" : "Flag for Review"}</span>
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
                                    onClick={() => {
                                      setWdRows((prev) => prev.filter((x) => x.id !== r.id));
                                      toast.success(`Deleted "${r.name}"`);
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
                      {/* Floating Bulk Action Overlay Bar when rows selected */}
                      {selectedIrrRows.size > 0 && (
                        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 h-10 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg border-b border-primary/20">
                          <div className="flex items-center gap-2">
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
                                setIrrRows((prev) => prev.filter((r) => !selectedIrrRows.has(r.id)));
                                setSelectedIrrRows(new Set());
                                setLastClickedIrrIndex(null);
                                toast.info(`Deleted ${count} selected irrigation entry(s)`);
                              }}
                            >
                              Delete
                            </BulkBtn>
                          </div>
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

                      <div className="overflow-x-auto overflow-y-auto w-full flex-1 min-h-0">
                        <table className="w-full border-collapse text-[12px] font-sans text-left">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/80 text-muted-foreground uppercase text-[11px] tracking-wider font-bold select-none">
                              <th style={{ width: colWidths.irr_select, minWidth: colWidths.irr_select }} className="py-2 px-2 text-center relative group">
                                <input
                                  type="checkbox"
                                  disabled={isLocked}
                                  checked={irrRows.length > 0 && selectedIrrRows.size === irrRows.length && !isLocked}
                                  onChange={toggleSelectAllIrr}
                                  className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Select All / Deselect All (Ctrl+A)"
                                />
                                <div
                                  onMouseDown={(e) => startResizing("irr_select", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_vegType, minWidth: colWidths.irr_vegType }} className="py-2 px-3 text-left relative group">
                                VEGETATION TYPE
                                <div
                                  onMouseDown={(e) => startResizing("irr_vegType", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_area, minWidth: colWidths.irr_area }} className="py-2 px-3 text-center relative group">
                                AREA ({ip ? "FT²" : "M²"})
                                <div
                                  onMouseDown={(e) => startResizing("irr_area", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_rate, minWidth: colWidths.irr_rate }} className="py-2 px-3 text-right relative group">
                                RATE
                                <div
                                  onMouseDown={(e) => startResizing("irr_rate", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_load, minWidth: colWidths.irr_load }} className="py-2 px-3 text-right relative group">
                                TOTAL LOAD
                                <div
                                  onMouseDown={(e) => startResizing("irr_load", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_actions, minWidth: colWidths.irr_actions }} className="py-2 px-2 text-center relative group">
                                ACTIONS
                                <div
                                  onMouseDown={(e) => startResizing("irr_actions", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {irrRows.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                                  No irrigation entries added. Fill in the form above to calculate plant water demand.
                                </td>
                              </tr>
                            ) : (
                              irrRows.map((r, idx) => (
                                    <ContextMenu key={r.id}>
                                      <ContextMenuTrigger asChild>
                                        <tr
                                          id={`row-${r.id}`}
                                          data-row-id={r.id}
                                          onClick={(e) => {
                                            if (isLocked) return;
                                            toggleIrrRowSelection(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                          }}
                                          onDoubleClick={(e) => {
                                            if (isLocked) return;
                                            setSelectedIrrRows(new Set([r.id]));
                                            setPreviewTarget({ type: "irrigation", rowId: r.id });
                                            setPreviewModalOpen(true);
                                          }}
                                          title={isLocked ? undefined : "Click to select, Shift+Click for range, Ctrl+Click for multi-select. Double-click to open parameters & calculation breakdown."}
                                          className={`group border-b border-border/40 transition-colors ${isLocked ? "cursor-default" : "cursor-pointer"} select-none ${
                                            selectedIrrRows.has(r.id)
                                              ? "bg-emerald-500/15 dark:bg-emerald-500/25 border-l-2 border-l-emerald-600"
                                              : r.flagged
                                              ? "bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/50"
                                              : idx % 2 === 0
                                              ? "bg-white dark:bg-slate-950 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                              : "bg-slate-50/40 dark:bg-slate-900/20 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                          }`}
                                        >
                                          <td 
                                            style={{ width: colWidths.irr_select, minWidth: colWidths.irr_select }} 
                                            className="py-1.5 px-2 text-center" 
                                            onClick={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            <div className="flex items-center justify-center gap-1.5">
                                              <input
                                                type="checkbox"
                                                disabled={isLocked}
                                                checked={selectedIrrRows.has(r.id) && !isLocked}
                                                onChange={() => {
                                                  if (isLocked) return;
                                                  toggleIrrRowSelection(r.id, false, true);
                                                }}
                                                className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                              />
                                              <span className="text-muted-foreground font-mono text-xs">{idx + 1}</span>
                                              {r.flagged && (
                                                <span title="Flagged for review" className="inline-flex">
                                                  <Flag className="size-3 text-amber-500 fill-amber-500" />
                                                </span>
                                              )}
                                              {r.comments && r.comments.length > 0 && (
                                                <button
                                                  type="button"
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
                                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-500/20 transition cursor-pointer"
                                                  title={`${r.comments.length} comment(s) — Click to view`}
                                                >
                                                  <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                                  <span>{r.comments.length}</span>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                          <td 
                                            style={{ width: colWidths.irr_vegType, minWidth: colWidths.irr_vegType }} 
                                            className="py-1.5 px-3 cursor-pointer"
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            <div className="flex items-center gap-2 w-full">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                                              <select
                                                value={r.vegType}
                                                disabled={isLocked}
                                                onClick={(e) => e.stopPropagation()}
                                                onDoubleClick={(e) => {
                                                  e.stopPropagation();
                                                  if (isLocked) return;
                                                  setSelectedIrrRows(new Set([r.id]));
                                                  setPreviewTarget({ type: "irrigation", rowId: r.id });
                                                  setPreviewModalOpen(true);
                                                }}
                                                onChange={(e) => handleIrrRowChange(r.id, "vegType", e.target.value)}
                                                className="w-full bg-transparent border border-transparent hover:border-border/60 focus:border-[#0A7BC7] focus:bg-white dark:focus:bg-slate-950 outline-none cursor-pointer py-0.5 px-1 rounded text-xs font-semibold text-foreground"
                                              >
                                                {Object.keys(IRR_TYPE_MAP).map((k) => (
                                                  <option key={k} value={k}>
                                                    {k}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          </td>
                                          <td 
                                            style={{ width: colWidths.irr_area, minWidth: colWidths.irr_area }} 
                                            className="py-1.5 px-3 text-center font-bold font-mono cursor-pointer"
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            <input
                                              type="number"
                                              value={r.area}
                                              disabled={isLocked}
                                              onClick={(e) => e.stopPropagation()}
                                              onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                if (isLocked) return;
                                                setSelectedIrrRows(new Set([r.id]));
                                                setPreviewTarget({ type: "irrigation", rowId: r.id });
                                                setPreviewModalOpen(true);
                                              }}
                                              onChange={(e) => handleIrrRowChange(r.id, "area", Number(e.target.value))}
                                              className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium text-xs cursor-pointer focus:cursor-text"
                                            />
                                          </td>
                                          <td 
                                            style={{ width: colWidths.irr_rate, minWidth: colWidths.irr_rate }} 
                                            className="py-1.5 px-3 text-right font-mono font-medium text-muted-foreground text-xs cursor-pointer"
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            {(ip ? Math.round((r.lpd / 40.7458) * 100) / 100 : r.lpd).toFixed(ip ? 3 : 1)} {ip ? "gal/ft²" : "L/m²"}
                                          </td>
                                          <td 
                                            style={{ width: colWidths.irr_load, minWidth: colWidths.irr_load }} 
                                            className="py-1.5 px-3 text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              if (isLocked) return;
                                              setSelectedIrrRows(new Set([r.id]));
                                              setPreviewTarget({ type: "irrigation", rowId: r.id });
                                              setPreviewModalOpen(true);
                                            }}
                                          >
                                            {(ip ? Math.round((r.area * r.lpd) / 3.78541) : r.area * r.lpd).toLocaleString()} {ip ? "gal" : "L"}
                                          </td>
                                          <td style={{ width: colWidths.irr_actions, minWidth: colWidths.irr_actions }} className="py-1.5 px-2 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => handleToggleIrrFlag(r.id)}
                                                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                                  r.flagged
                                                    ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40 opacity-100"
                                                    : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 opacity-0 group-hover:opacity-100"
                                                }`}
                                                title={r.flagged ? "Flagged for review" : "Flag for review"}
                                              >
                                                <Flag className={`size-3.5 ${r.flagged ? "fill-amber-500" : ""}`} />
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setIrrRows((prev) => prev.filter((x) => x.id !== r.id));
                                                  toast.success(`Deleted "${r.vegType}"`);
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                                title="Delete entry"
                                              >
                                                <Trash2 className="size-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      </ContextMenuTrigger>
                                      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
                                        <ContextMenuItem
                                          onClick={() => {
                                            setPreviewTarget({ type: "irrigation", rowId: r.id });
                                            setPreviewModalOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                        >
                                          <Calculator className="size-3.5 text-muted-foreground" />
                                          <span>Calculation Breakdown</span>
                                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                                        </ContextMenuItem>
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
                                          <span>Add / View Comment</span>
                                        </ContextMenuItem>
                                        <ContextMenuItem
                                          onClick={() => handleToggleIrrFlag(r.id)}
                                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                        >
                                          <Flag className={`size-3.5 ${r.flagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                                          <span>{r.flagged ? "Unflag Row" : "Flag for Review"}</span>
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
                                          onClick={() => {
                                            setIrrRows((prev) => prev.filter((x) => x.id !== r.id));
                                            toast.success(`Deleted "${r.vegType}"`);
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
                        <div>Showing <span className="text-foreground font-medium tabular">{irrRows.length}</span> of {irrRows.length} vegetation zones</div>
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
                          className={`bg-card border rounded-2xl p-5 flex flex-col gap-4 shadow-xs transition-colors cursor-pointer select-none ${
                            poolFlagged
                              ? "border-amber-400/80 bg-amber-50/40 dark:bg-amber-950/20"
                              : "border-border hover:border-border/80"
                          }`}
                        >
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
                                  {poolComments.length > 0 && (
                                    <span className="absolute -top-1 -right-1 size-3.5 bg-blue-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center">
                                      {poolComments.length}
                                    </span>
                                  )}
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
                      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
                        <ContextMenuItem
                          onClick={() => {
                            setPreviewTarget({ type: "pool" });
                            setPreviewModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <Calculator className="size-3.5 text-muted-foreground" />
                          <span>Calculation Breakdown</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                        </ContextMenuItem>
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
                          <span>Add / View Comment</span>
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
                                  {fireComments.length > 0 && (
                                    <span className="absolute -top-1 -right-1 size-3.5 bg-blue-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center">
                                      {fireComments.length}
                                    </span>
                                  )}
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
                      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
                        <ContextMenuItem
                          onClick={() => {
                            setPreviewTarget({ type: "fire" });
                            setPreviewModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <Calculator className="size-3.5 text-muted-foreground" />
                          <span>Calculation Breakdown</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                        </ContextMenuItem>
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
                          <span>Add / View Comment</span>
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
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-8">
                
                {/* 1. Domestic Water Storage Tank Sizing Card */}
                <div className="lg:col-span-6 space-y-5">
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        onDoubleClick={() => {
                          setPreviewTarget({ type: "tank" });
                          setPreviewModalOpen(true);
                        }}
                        title="Double-click to open storage tank sizing calculation breakdown"
                        className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm cursor-pointer select-none"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3.5 bg-primary rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                              <Building2 className="size-4 text-primary" /> 1. Storage Tank Capacity &amp; Split Sizing
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground">Storage Retention Days</label>
                            <select
                              value={storageDays}
                              onChange={(e) => setStorageDays(Number(e.target.value))}
                              className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-primary cursor-pointer"
                            >
                              <option value={1}>1 Day Storage (24 Hours — Standard)</option>
                              <option value={1.5}>1.5 Day Storage (36 Hours — Intermediate Reserve)</option>
                              <option value={2}>2 Days Storage (48 Hours — DEWA/ADDC Reserve)</option>
                              <option value={3}>3 Days Storage (72 Hours — Emergency Reserve)</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground">Target Storage Volume</label>
                            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-primary flex items-center justify-between">
                              <span>{calculations.displayTotalStorage}</span>
                              <span className="text-[10px] text-muted-foreground font-sans font-medium">({storageDays} Day Retention)</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 mt-2">
                          {/* Ground Water Break Tank */}
                          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground">
                                  Ground Water Break Tank
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-border rounded px-2 py-0.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={500}
                                    value={groundTankPct}
                                    onChange={(e) => setGroundTankPct(Number(e.target.value))}
                                    className="w-12 bg-transparent text-xs font-mono font-bold text-primary text-right outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-muted-foreground">%</span>
                                </div>
                                <span className="text-xs font-mono font-extrabold text-primary">{calculations.displayGroundTank}</span>
                              </div>
                            </div>
                            <div className="text-[11.5px] text-muted-foreground">
                              Suggested Dimensions: <strong className="text-foreground font-mono">{calculations.groundDim.l}m L × {calculations.groundDim.w}m W × {calculations.groundDim.h}m H</strong> (+ 0.3m freeboard)
                            </div>
                          </div>

                          {/* Overhead Roof Tanks Container */}
                          <div className="flex flex-col gap-2.5 pt-2 border-t border-border/60">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Building2 className="size-4 text-primary" />
                                <span className="text-xs font-bold text-foreground">
                                  Overhead Roof Tanks ({overheadTanks.length})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddOverheadTank();
                                }}
                                className="text-xs text-primary hover:text-white bg-primary/10 hover:bg-primary font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                              >
                                <Plus className="size-3.5" /> Add Overhead Tank
                              </button>
                            </div>

                            {overheadTanks.length === 0 ? (
                              <div className="p-3 bg-slate-50 dark:bg-slate-900/30 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground italic">
                                No overhead roof tanks configured. Click &quot;+ Add Overhead Tank&quot; above to add overhead roof storage tanks.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {calculations.overheadTanksCalculated.map((t) => (
                                  <div
                                    key={t.id}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col gap-2 relative group"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <input
                                        type="text"
                                        value={t.name}
                                        onChange={(e) => handleRenameOverheadTank(t.id, e.target.value)}
                                        className="bg-transparent font-bold text-xs text-foreground outline-none focus:bg-white dark:focus:bg-slate-950 px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 focus:border-primary w-full"
                                        placeholder="Overhead Tank Name"
                                      />
                                      <div className="flex items-center gap-2 shrink-0">
                                        <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-border rounded px-1.5 py-0.5">
                                          <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={t.splitPct}
                                            onChange={(e) => handleUpdateOverheadTankPct(t.id, Number(e.target.value))}
                                            className="w-10 bg-transparent text-xs font-mono font-bold text-primary text-right outline-none"
                                          />
                                          <span className="text-[10px] font-bold text-muted-foreground">%</span>
                                        </div>
                                        <span className="text-xs font-mono font-extrabold text-primary">
                                          {t.displayVol}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveOverheadTank(t.id);
                                          }}
                                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                                          title="Remove Overhead Tank"
                                        >
                                          <Trash2 className="size-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="text-[11.5px] text-muted-foreground">
                                      Suggested Dimensions: <strong className="text-foreground font-mono">{t.dim.l}m L × {t.dim.w}m W × {t.dim.h}m H</strong> (+ 0.3m freeboard)
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
                      <ContextMenuItem
                        onClick={() => {
                          setPreviewTarget({ type: "tank" });
                          setPreviewModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                      >
                        <Calculator className="size-3.5 text-muted-foreground" />
                        <span>Calculation Breakdown</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() =>
                          setCommentTarget({
                            targetId: "storage_tanks",
                            targetName: "Water Storage Tanks",
                            targetType: "Storage Tanks",
                            existingComments: [],
                          })
                        }
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add / View Comment</span>
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

                {/* 2. Domestic Peak Flow & Transfer Pump Capacity Card */}
                <div className="lg:col-span-6 space-y-5">
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        onDoubleClick={() => {
                          setPreviewTarget({ type: "pump" });
                          setPreviewModalOpen(true);
                        }}
                        title="Double-click to open transfer pump duty calculation breakdown"
                        className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm cursor-pointer select-none"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3.5 bg-primary rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                              <Sparkles className="size-4 text-primary" /> 2. Domestic Peak Flow &amp; Transfer Pump Sizing
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground">Diversity / Peak Multiplier (K)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={peakFactor}
                              onChange={(e) => setPeakFactor(Number(e.target.value))}
                              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-primary"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground">Transfer Filling Duration</label>
                            <select
                              value={fillWindowHours}
                              onChange={(e) => setFillWindowHours(Number(e.target.value))}
                              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-primary cursor-pointer"
                            >
                              <option value={1}>1 Hour Filling Window</option>
                              <option value={2}>2 Hours Filling Window (Standard)</option>
                              <option value={3}>3 Hours Filling Window</option>
                              <option value={4}>4 Hours Filling Window</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground">Calculated Peak Flow</label>
                            <div className="bg-slate-100 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-foreground">
                              {calculations.displayDomesticPeak}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground">Required Transfer Pump Flow</label>
                            <div className="bg-primary text-primary-foreground border border-primary rounded-lg px-3 py-2 text-xs font-mono font-extrabold">
                              {calculations.displayTransferPump}
                            </div>
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
                      <ContextMenuItem
                        onClick={() => {
                          setPreviewTarget({ type: "pump" });
                          setPreviewModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                      >
                        <Calculator className="size-3.5 text-muted-foreground" />
                        <span>Calculation Breakdown</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() =>
                          setCommentTarget({
                            targetId: "transfer_pumps",
                            targetName: "Transfer Pumps",
                            targetType: "Transfer Pumps",
                            existingComments: [],
                          })
                        }
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add / View Comment</span>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/10 dark:bg-black/30 p-4 animate-fade-in font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white/70 dark:bg-neutral-950/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full h-[85vh] max-h-[85vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
              showModalPreview ? "max-w-5xl" : "max-w-2xl"
            }`}
          >
            {/* Modal Header */}
            <header className="px-6 h-[72px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/10 dark:bg-black/10">
              <div className="flex flex-col justify-center min-w-0 pr-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2 className="text-[15px] font-bold text-neutral-800 dark:text-neutral-100 truncate flex items-center gap-2">
                    <Calculator className="size-4 text-primary" /> Water Demand Parameters &amp; Calculations
                  </h2>
                  <span className="px-2.5 py-0.75 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[11px] font-bold font-mono tracking-tight shrink-0 uppercase">
                    {PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name} ({unitSystem === "ip" ? "IP Imperial" : "SI Metric"})
                  </span>
                </div>
                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
                  Configure occupancy demand rates, retention reserve days, tank split allocations, and view live step-by-step calculations.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModalPreview((prev) => !prev)}
                  className={`flex items-center gap-1.5 h-9.5 px-4 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-sm ${
                    showModalPreview
                      ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95 shadow-md shadow-primary/15"
                      : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"
                  }`}
                >
                  <Info className="size-3.5" />
                  Calculations Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="size-9 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            {/* Modal Body: Left Inputs + Right Calculations Preview */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Left Side: Form Controls & Navigation */}
              <div className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto">
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
                            <th className="p-2.5 text-right">Calculated Value</th>
                            <th className="p-2.5 text-center">Unit</th>
                            <th className="p-2.5 text-left">Design Guideline / Code Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5 font-mono">
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Domestic Daily Demand</td>
                            <td className="p-2.5 text-right font-bold text-primary">{calculations.displayDomestic}</td>
                            <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">{PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name}</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Domestic Peak Flow Rate</td>
                            <td className="p-2.5 text-right font-bold text-primary">{calculations.displayDomesticPeak}</td>
                            <td className="p-2.5 text-center">{ip ? "GPM" : "L/s"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Peak Factor K = {peakFactor}</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Irrigation Daily Load</td>
                            <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{calculations.displayIrrigation}</td>
                            <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Landscaping Area Schedule ({irrRows.length} zones)</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Pool Daily Evaporation Makeup</td>
                            <td className="p-2.5 text-right font-bold text-sky-600 dark:text-sky-400">{calculations.displayPoolDemand}</td>
                            <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Evaporation Rate = {poolEvap}%/day</td>
                          </tr>
                          <tr className="bg-white/40 dark:bg-white/5 font-bold">
                            <td className="p-2.5 font-sans text-neutral-800 dark:text-neutral-100">GRAND TOTAL DAILY CONSUMPTION</td>
                            <td className="p-2.5 text-right text-base text-primary">{calculations.displayGrandTotal}</td>
                            <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                            <td className="p-2.5 font-sans text-neutral-700 dark:text-neutral-300">Combined Site Water Demand</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Total Water Storage Requirement</td>
                            <td className="p-2.5 text-right font-bold text-neutral-800 dark:text-neutral-100">{calculations.displayTotalStorage}</td>
                            <td className="p-2.5 text-center">{ip ? "gal" : "m³"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">{storageDays} Day(s) Retention Reserve</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Ground Break Tank Capacity</td>
                            <td className="p-2.5 text-right font-bold text-primary">{calculations.displayGroundTank}</td>
                            <td className="p-2.5 text-center">{ip ? "gal" : "L"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Ground Split Allocation: {calculations.groundPct}%</td>
                          </tr>
                          {calculations.overheadTanksCalculated.map((t) => (
                            <tr key={t.id}>
                              <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">{t.name} Capacity</td>
                              <td className="p-2.5 text-right font-bold text-primary">{t.displayVol}</td>
                              <td className="p-2.5 text-center">{ip ? "gal" : "L"}</td>
                              <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Roof Split Allocation: {t.sharePct.toFixed(0)}%</td>
                            </tr>
                          ))}
                          <tr className="bg-primary/10 font-bold">
                            <td className="p-2.5 font-sans text-primary">Transfer Pump Duty Flow</td>
                            <td className="p-2.5 text-right text-primary">{calculations.displayTransferPump}</td>
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
              <div
                className={`shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
                  showModalPreview ? "w-[400px] opacity-100 p-6 border-l-border" : "w-0 opacity-0 p-0 border-l-transparent"
                }`}
              >
                <div className="w-[352px] space-y-5 flex flex-col h-full overflow-y-auto">
                  <h3 className="text-[11px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0">
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
            </div>

            {/* Modal Footer */}
            <footer className="px-6 h-16 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>Changes apply live to project calculation schedule</span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="h-10 px-5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewModalOpen(false);
                    toast.success("Changes saved to schedule");
                  }}
                  className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-[12.5px] font-semibold transition-all shadow-md shadow-primary/10 active:scale-[0.98] cursor-pointer"
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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50 no-print">
        <span className="text-[12px] text-muted-foreground font-semibold">
          Generated: <span className="text-foreground font-mono">{new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <TBtn primary onClick={onExportPdf}>
            <FileText className="size-3.5" /> Export PDF
          </TBtn>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
      <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
        
        {/* Document Header */}
        <div className="flex justify-between items-start pb-4 border-b border-border">
          <div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
              Water Demand &amp; Storage Tank Sizing Calculation
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Comprehensive Water Consumption, Storage Autonomy &amp; Transfer Pumping Analysis
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Date: {new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Table 1: Design Parameters & Overall Summary */}
        <div className="space-y-2">
          <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
            1. Executive Design Parameter Summary
          </h3>
          <table className="w-full text-[12px] border-collapse border border-border font-sans">
            <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
              <tr>
                <th className="border border-border p-2 text-center w-12">No.</th>
                <th className="border border-border p-2 text-left">Executive Design Parameter Summary</th>
                <th className="border border-border p-2 text-center w-32">Value</th>
                <th className="border border-border p-2 text-center w-24">Unit</th>
                <th className="border border-border p-2 text-left">Standard / Code Reference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                <td className="border border-border p-2 font-bold">Total Occupied Spaces</td>
                <td className="border border-border p-2 text-center font-bold">{wdRows.length}</td>
                <td className="border border-border p-2 text-center">spaces</td>
                <td className="border border-border p-2 text-muted-foreground">Architectural Space Inventory</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                <td className="border border-border p-2 font-bold">Total Occupancy Headcount</td>
                <td className="border border-border p-2 text-center font-bold">{(calculations.totalPeople || 0).toLocaleString()}</td>
                <td className="border border-border p-2 text-center">people</td>
                <td className="border border-border p-2 text-muted-foreground">Scheduled Design Occupancy</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                <td className="border border-border p-2 font-bold">Domestic Daily Water Demand</td>
                <td className="border border-border p-2 text-center font-bold">
                  {(ip ? Math.round((calculations.totalWaterL || 0) / 3.78541) : Math.round(calculations.totalWaterL || 0)).toLocaleString()}
                </td>
                <td className="border border-border p-2 text-center">{ip ? "gal/day" : "L/day"}</td>
                <td className="border border-border p-2 text-muted-foreground">Governing Standard Allowance</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                <td className="border border-border p-2 font-bold">Domestic Peak Flow Rate</td>
                <td className="border border-border p-2 text-center font-bold">
                  {ip ? Math.round(calculations.peakGPM || 0).toLocaleString() : (calculations.peakLPS || 0).toFixed(2)}
                </td>
                <td className="border border-border p-2 text-center">{ip ? "GPM" : "L/s"}</td>
                <td className="border border-border p-2 text-muted-foreground">Peak Multiplier K = {peakFactor}</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                <td className="border border-border p-2 font-bold">Irrigation Daily Water Load</td>
                <td className="border border-border p-2 text-center font-bold">
                  {(ip ? Math.round((calculations.totalIrrL || 0) / 3.78541) : Math.round(calculations.totalIrrL || 0)).toLocaleString()}
                </td>
                <td className="border border-border p-2 text-center">{ip ? "gal/day" : "L/day"}</td>
                <td className="border border-border p-2 text-muted-foreground">Landscaping Vegetation Schedule</td>
              </tr>
              {poolArea && poolDepth && (
                <tr>
                  <td className="border border-border p-2 text-center text-muted-foreground">6</td>
                  <td className="border border-border p-2 font-bold">Swimming Pool Makeup Water</td>
                  <td className="border border-border p-2 text-center font-bold">
                    {(ip ? Math.round((calculations.poolDemandL || 0) / 3.78541) : Math.round(calculations.poolDemandL || 0)).toLocaleString()}
                  </td>
                  <td className="border border-border p-2 text-center">{ip ? "gal/day" : "L/day"}</td>
                  <td className="border border-border p-2 text-muted-foreground">Evaporation Loss {poolEvap}%/day + Backwash</td>
                </tr>
              )}
              {fireFlow && (
                <tr>
                  <td className="border border-border p-2 text-center text-muted-foreground">7</td>
                  <td className="border border-border p-2 font-bold">Fire Fighting Dedicated Reserve</td>
                  <td className="border border-border p-2 text-center font-bold text-red-600 dark:text-red-400">
                    {(ip ? Math.round((calculations.fireCapL || 0) / 3.78541) : Math.round(calculations.fireCapL || 0)).toLocaleString()}
                  </td>
                  <td className="border border-border p-2 text-center">{ip ? "gal" : "L"}</td>
                  <td className="border border-border p-2 text-muted-foreground">60-Min Standard Duration (NFPA 13/14)</td>
                </tr>
              )}
              <tr className="bg-[#DAE9F8] dark:bg-sky-950/60 font-bold text-foreground border-t-2 border-border">
                <td className="border border-border p-2 text-center text-muted-foreground">—</td>
                <td className="border border-border p-2">TOTAL DAILY WATER DEMAND</td>
                <td className="border border-border p-2 text-center text-pink-600 dark:text-pink-400 font-bold">
                  {(ip ? Math.round((calculations.grandTotalL || 0) / 3.78541) : Math.round(calculations.grandTotalL || 0)).toLocaleString()}
                </td>
                <td className="border border-border p-2 text-center font-bold">{ip ? "gal/day" : "L/day"}</td>
                <td className="border border-border p-2">Combined Site Daily Service Load</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">8</td>
                <td className="border border-border p-2 font-bold">Total Storage Autonomy Retention</td>
                <td className="border border-border p-2 text-center font-bold">
                  {ip ? Math.round(calculations.reqStorageGal || 0).toLocaleString() : (calculations.reqStorageM3 || 0).toFixed(2)}
                </td>
                <td className="border border-border p-2 text-center">{ip ? "gal" : "m³"}</td>
                <td className="border border-border p-2 text-muted-foreground">{storageDays} Day(s) Mandatory Storage Duration</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">9</td>
                <td className="border border-border p-2 font-bold">Ground Water Break Tank</td>
                <td className="border border-border p-2 text-center font-bold">
                  {(ip ? Math.round((calculations.groundTankL || 0) / 3.78541) : Math.round(calculations.groundTankL || 0)).toLocaleString()}
                </td>
                <td className="border border-border p-2 text-center">{ip ? "gal" : "L"}</td>
                <td className="border border-border p-2 text-muted-foreground">{calculations.groundPct}% Ground Split ({calculations.groundDim.l}m × {calculations.groundDim.w}m × {calculations.groundDim.h}m)</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">10</td>
                <td className="border border-border p-2 font-bold">Transfer Pumping Duty Flow Rate</td>
                <td className="border border-border p-2 text-center font-bold">
                  {ip ? (calculations.transferPumpGPM || 0).toFixed(1) : (calculations.transferPumpLPS || 0).toFixed(2)}
                </td>
                <td className="border border-border p-2 text-center">{ip ? "GPM" : "L/s"}</td>
                <td className="border border-border p-2 text-muted-foreground">Designed for {fillWindowHours}-Hour Roof Tank Filling Window</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 2: Water Storage Tanks & Transfer Pump Physical Sizing */}
        <div className="space-y-2">
          <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
            2. Water Storage Tanks &amp; Transfer Pump Physical Sizing
          </h3>
          <table className="w-full text-[12px] border-collapse border border-border font-sans">
            <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
              <tr>
                <th className="border border-border p-2 text-center w-12">No.</th>
                <th className="border border-border p-2 text-left">Facility / Equipment</th>
                <th className="border border-border p-2 text-left">Specification &amp; Tank Type</th>
                <th className="border border-border p-2 text-center w-24">Allocation</th>
                <th className="border border-border p-2 text-right w-28">Effective Capacity</th>
                <th className="border border-border p-2 text-center w-20">Unit</th>
                <th className="border border-border p-2 text-left">Suggested Dimensions / Operating Duty</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                <td className="border border-border p-2 font-bold">Ground Water Break Tank</td>
                <td className="border border-border p-2 text-muted-foreground">Reinforced Concrete / Sectional GRP</td>
                <td className="border border-border p-2 text-center font-mono font-bold">{calculations.groundPct}%</td>
                <td className="border border-border p-2 text-right font-mono font-bold">{calculations.displayGroundTank}</td>
                <td className="border border-border p-2 text-center font-mono">{ip ? "gal" : "L"}</td>
                <td className="border border-border p-2 font-mono text-muted-foreground">{calculations.groundDim.l}m L × {calculations.groundDim.w}m W × {calculations.groundDim.h}m H (+0.3m Freeboard)</td>
              </tr>
              {calculations.overheadTanksCalculated.map((t: any, idx: number) => (
                <tr key={t.id}>
                  <td className="border border-border p-2 text-center text-muted-foreground">{idx + 2}</td>
                  <td className="border border-border p-2 font-bold">{t.name}</td>
                  <td className="border border-border p-2 text-muted-foreground">Modular Sectional GRP / Polyethylene</td>
                  <td className="border border-border p-2 text-center font-mono font-bold">{t.sharePct.toFixed(0)}%</td>
                  <td className="border border-border p-2 text-right font-mono font-bold">{t.displayVol}</td>
                  <td className="border border-border p-2 text-center font-mono">{ip ? "gal" : "L"}</td>
                  <td className="border border-border p-2 font-mono text-muted-foreground">{t.dim.l}m L × {t.dim.w}m W × {t.dim.h}m H (+0.3m Freeboard)</td>
                </tr>
              ))}
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">{calculations.overheadTanksCalculated.length + 2}</td>
                <td className="border border-border p-2 font-bold">Roof Transfer Pump</td>
                <td className="border border-border p-2 text-muted-foreground">Vertical Multistage Booster (1W + 1S)</td>
                <td className="border border-border p-2 text-center font-mono font-bold">100% Roof</td>
                <td className="border border-border p-2 text-right font-mono font-bold text-pink-600 dark:text-pink-400">{calculations.displayTransferPump}</td>
                <td className="border border-border p-2 text-center font-mono">{ip ? "GPM" : "L/s"}</td>
                <td className="border border-border p-2 text-muted-foreground">Designed for {fillWindowHours}-Hour Roof Tank Filling Window</td>
              </tr>
              <tr className="bg-[#DAE9F8] dark:bg-sky-950/60 font-bold text-foreground border-t-2 border-border">
                <td colSpan={3} className="border border-border p-2 text-center">TOTAL STORAGE RETENTION</td>
                <td className="border border-border p-2 text-center font-mono">100%</td>
                <td className="border border-border p-2 text-right font-mono text-pink-600 dark:text-pink-400">{calculations.displayTotalStorage}</td>
                <td className="border border-border p-2 text-center">{ip ? "gal" : "m³"}</td>
                <td className="border border-border p-2 text-muted-foreground">{storageDays} Day(s) Total Autonomy Reserve</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 3: Comprehensive Space Water Demand Schedule */}
        <div className="space-y-2">
          <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
            3. Comprehensive Space Water Demand Schedule
          </h3>
          <table className="w-full text-left text-[11px] border-collapse border border-border font-sans">
            <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
              <tr>
                <th className="border border-border p-2 text-center w-12">No.</th>
                <th className="border border-border p-2 text-left">Name of Space / Description</th>
                <th className="border border-border p-2 text-center w-28">Occupancy (People)</th>
                <th className="border border-border p-2 text-center w-20">Multiplier</th>
                <th className="border border-border p-2 text-left">Type of Space / Category</th>
                <th className="border border-border p-2 text-right w-28">Rate ({ip ? "gpd" : "LPD"})</th>
                <th className="border border-border p-2 text-right w-32">Daily Demand ({ip ? "gal" : "L"})</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let sNo = 1;
                return (
                  <>
                    {Object.keys(groupedWd).sort().map((cat) => (
                      <React.Fragment key={cat}>
                        <tr className="bg-[#DCEFFB] dark:bg-blue-950/40 font-bold text-[#06456F] dark:text-blue-300">
                          <td colSpan={7} className="border border-border p-2 font-sans">Occupancy Category: {cat}</td>
                        </tr>
                        {groupedWd[cat].map((r) => {
                          const rowTotal = ip
                            ? Math.round((r.ppl * r.lpd * (r.multiplier || 1)) / 3.78541)
                            : Math.round(r.ppl * r.lpd * (r.multiplier || 1));
                          const rowRate = ip ? Math.round(r.lpd / 3.78541) : r.lpd;
                          return (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="border border-border p-2 text-center text-muted-foreground">{sNo++}</td>
                              <td className="border border-border p-2 font-medium">{r.name}</td>
                              <td className="border border-border p-2 text-center font-mono font-semibold">{r.ppl}</td>
                              <td className="border border-border p-2 text-center font-mono text-muted-foreground">×{r.multiplier || 1}</td>
                              <td className="border border-border p-2 text-muted-foreground">{r.cat}</td>
                              <td className="border border-border p-2 text-right font-mono text-muted-foreground">{rowRate}</td>
                              <td className="border border-border p-2 text-right font-mono font-bold text-foreground">{rowTotal.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    <tr className="bg-[#DAE9F8] dark:bg-sky-950/60 font-bold text-foreground border-t-2 border-border">
                      <td colSpan={2} className="border border-border p-2 font-sans">TOTAL DOMESTIC DEMAND</td>
                      <td className="border border-border p-2 text-center font-mono">{calculations.totalPeople}</td>
                      <td colSpan={3} className="border border-border p-2"></td>
                      <td className="border border-border p-2 text-right font-mono text-pink-600 dark:text-pink-400">{calculations.displayDomestic}</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* Table 4: Irrigation Landscaping Schedule */}
        <div className="space-y-2">
          <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
            4. Irrigation Landscaping Schedule
          </h3>
          <table className="w-full text-left text-[11px] border-collapse border border-border font-sans">
            <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
              <tr>
                <th className="border border-border p-2 text-center w-12">No.</th>
                <th className="border border-border p-2 text-left">Vegetation / Plant Type</th>
                <th className="border border-border p-2 text-center w-32">Landscaping Area ({ip ? "ft²" : "m²"})</th>
                <th className="border border-border p-2 text-right w-36">Unit Rate ({ip ? "gal/ft²" : "L/m²"})</th>
                <th className="border border-border p-2 text-right w-36">Daily Demand ({ip ? "gal" : "L"})</th>
                <th className="border border-border p-2 text-left">Irrigation Method / Basis</th>
              </tr>
            </thead>
            <tbody>
              {irrRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-border p-3 text-center text-muted-foreground italic">
                    No landscaping / irrigation zones configured.
                  </td>
                </tr>
              ) : (
                irrRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="border border-border p-2 text-center text-muted-foreground">{idx + 1}</td>
                    <td className="border border-border p-2 font-medium">{r.vegType}</td>
                    <td className="border border-border p-2 text-center font-mono font-semibold">{r.area}</td>
                    <td className="border border-border p-2 text-right font-mono text-muted-foreground">
                      {(ip ? Math.round((r.lpd / 40.7458) * 100) / 100 : r.lpd).toFixed(ip ? 3 : 1)}
                    </td>
                    <td className="border border-border p-2 text-right font-mono font-bold text-foreground">
                      {(ip ? Math.round((r.area * r.lpd) / 3.78541) : r.area * r.lpd).toLocaleString()}
                    </td>
                    <td className="border border-border p-2 text-muted-foreground">Automatic Drip / Spray System</td>
                  </tr>
                ))
              )}
              <tr className="bg-[#DAE9F8] dark:bg-sky-950/60 font-bold text-foreground border-t-2 border-border">
                <td colSpan={2} className="border border-border p-2 font-sans">TOTAL IRRIGATION DEMAND</td>
                <td className="border border-border p-2 text-center font-mono">
                  {irrRows.reduce((a, b) => a + (Number(b.area) || 0), 0)} {ip ? "ft²" : "m²"}
                </td>
                <td colSpan={1} className="border border-border p-2"></td>
                <td className="border border-border p-2 text-right font-mono text-pink-600 dark:text-pink-400">{calculations.displayIrrigation}</td>
                <td className="border border-border p-2 text-muted-foreground">Automated Irrigation Autonomy</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 5: Auxiliary Water Reserves (Swimming Pool & Fire Fighting) - if present */}
        {(poolArea || fireFlow) && (
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              5. Auxiliary Water Reserves (Swimming Pool &amp; Fire Fighting)
            </h3>
            <table className="w-full text-left text-[11px] border-collapse border border-border font-sans">
              <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                <tr>
                  <th className="border border-border p-2 text-center w-12">No.</th>
                  <th className="border border-border p-2 text-left">Auxiliary Facility</th>
                  <th className="border border-border p-2 text-center w-48">Design Sizing Parameters</th>
                  <th className="border border-border p-2 text-right w-36">Daily Demand / Reserve</th>
                  <th className="border border-border p-2 text-left">Engineering Sizing Standard</th>
                </tr>
              </thead>
              <tbody>
                {poolArea && poolDepth && (
                  <tr>
                    <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                    <td className="border border-border p-2 font-medium">Swimming Pool Makeup</td>
                    <td className="border border-border p-2 text-center font-mono">{poolArea} {ip ? "ft²" : "m²"} Area × {poolDepth} {ip ? "ft" : "m"} Depth</td>
                    <td className="border border-border p-2 text-right font-mono font-bold text-foreground">{calculations.displayPoolDemand}</td>
                    <td className="border border-border p-2 text-muted-foreground">Evaporation Rate {poolEvap}%/day + Filter Backwash Loss</td>
                  </tr>
                )}
                {fireFlow && (
                  <tr>
                    <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                    <td className="border border-border p-2 font-medium">Fire Fighting Dedicated Reserve</td>
                    <td className="border border-border p-2 text-center font-mono">{fireFlow} USGPM Dedicated Pump Flow</td>
                    <td className="border border-border p-2 text-right font-mono font-bold text-red-600 dark:text-red-400">{calculations.displayFireCap}</td>
                    <td className="border border-border p-2 text-muted-foreground">60-Min Standard Duration (NFPA 13/14 Life Safety)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table 6: Engineering Design Standards & Compliance Guidelines */}
        <div className="space-y-2">
          <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
            {(poolArea || fireFlow) ? "6" : "5"}. Engineering Design Standards &amp; Compliance Guidelines
          </h3>
          <table className="w-full text-[12px] border-collapse border border-border font-sans">
            <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
              <tr>
                <th className="border border-border p-2 text-center w-12">No.</th>
                <th className="border border-border p-2 text-left w-60">Standard / Authority Reference</th>
                <th className="border border-border p-2 text-left">Mandatory Engineering Compliance &amp; Criteria</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                <td className="border border-border p-2 font-bold">DEWA / Dubai Municipality Guidelines</td>
                <td className="border border-border p-2 text-muted-foreground">Mandatory domestic per capita daily consumption quotas and minimum 24-hour autonomy storage reserve for residential/commercial developments.</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                <td className="border border-border p-2 font-bold">Uniform Plumbing Code (UPC) / IPC Section 604</td>
                <td className="border border-border p-2 text-muted-foreground">Fixture unit diversity calculations, maximum transfer line fluid velocity limits (2.4 m/s), and backflow prevention isolation.</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                <td className="border border-border p-2 font-bold">BS EN 806 / CIBSE Guide G (Public Health)</td>
                <td className="border border-border p-2 text-muted-foreground">Cold water storage tank sizing methodology, dual compartment segregation, and turnover requirements to prevent water stagnation.</td>
              </tr>
              <tr>
                <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                <td className="border border-border p-2 font-bold">NFPA 13 / 14 &amp; Civil Defence Regulations</td>
                <td className="border border-border p-2 text-muted-foreground">Dedicated hydraulic fire reserve allocation baffled or isolated from domestic water suction to ensure life safety continuity.</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 7: Professional Engineering Review & Sign-Off Block */}
        <div className="space-y-2">
          <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
            {(poolArea || fireFlow) ? "7" : "6"}. Professional Engineering Review &amp; Sign-Off Block
          </h3>
          <table className="w-full text-[12px] border-collapse border border-border font-sans">
            <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
              <tr>
                <th className="border border-border p-2 text-left w-1/4">Approval Role</th>
                <th className="border border-border p-2 text-center w-1/4">Engineer Name</th>
                <th className="border border-border p-2 text-center w-1/4">Status / Role Title</th>
                <th className="border border-border p-2 text-center w-1/4">Signature / Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-2 font-bold text-foreground">Originator / Prepared By</td>
                <td className="border border-border p-2 text-center font-medium text-foreground">{sigDetails.originatedName}</td>
                <td className="border border-border p-2 text-center text-muted-foreground">MEP Design Engineer</td>
                <td className="border border-border p-2 text-center font-mono text-muted-foreground">{sigDetails.originatedDate}</td>
              </tr>
              <tr>
                <td className="border border-border p-2 font-bold text-foreground">Reviewer / Checked By</td>
                <td className="border border-border p-2 text-center font-medium text-foreground">{sigDetails.reviewerName || "Pending Review"}</td>
                <td className="border border-border p-2 text-center text-muted-foreground">Senior Plumbing Lead</td>
                <td className="border border-border p-2 text-center font-mono text-muted-foreground">{sigDetails.reviewerDate || "—"}</td>
              </tr>
              <tr>
                <td className="border border-border p-2 font-bold text-foreground">Approver / Verified By</td>
                <td className="border border-border p-2 text-center font-medium text-foreground">{sigDetails.approverName || "Pending Approval"}</td>
                <td className="border border-border p-2 text-center text-muted-foreground">Principal / MEP Director</td>
                <td className="border border-border p-2 text-center font-mono text-muted-foreground">{sigDetails.approverDate || "—"}</td>
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
          className="size-7 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
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
