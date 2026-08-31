import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Plus, Trash2, Download, Upload, X, Sparkles, AlertTriangle, CheckCircle2,
  Info, Gauge, FileText, Printer, FileSpreadsheet, Copy, ChevronDown, Wrench, RefreshCw, Bookmark, HelpCircle,
  Filter, ArrowUpDown, Edit3, MessageSquare
} from "lucide-react";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useWorkspace } from "@/lib/workspace-store";
import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { EditPclSpaceModal } from "@/components/workspace/EditPclSpaceModal";


export const Route = createFileRoute("/preliminary-cooling-load")({
  head: () => ({
    meta: [
      { title: "Preliminary Cooling Load — MEP Calc" },
      { name: "description", content: "Preliminary room-by-room cooling load and heat density estimation." },
    ],
  }),
  component: PreliminaryCoolingLoadPage,
});

interface PclRow {
  id: string;
  name: string;
  area: number | "";
  type: string;
  density: number; // W/m²
  dissipation: number; // Watts
  kw: number;
  tr: number;
  floor: string;
  selected?: boolean;
  comments?: any[];
}

const INFER_MAP: [string, string][] = [
  ["apartment", "Apartment - Dwelling Unit"],
  ["dwelling", "Apartment - Dwelling Unit"],
  ["bedroom", "Apartment - Dwelling Unit"],
  ["living", "Apartment - Dwelling Unit"],
  ["dining", "Apartment - Dwelling Unit"],
  ["residential", "Apartment - Dwelling Unit"],
  ["corridor", "Corridor - Residential"],
  ["lobby", "Lobby - Residential"],
  ["reception", "Lobby - Residential"],
  ["office", "Office - Cabin"],
  ["cabin", "Office - Cabin"],
  ["meeting", "Office - Meeting Room"],
  ["conference", "Office - Meeting Room"],
  ["classroom", "Classroom - Middle School"],
  ["school", "Classroom - Middle School"],
  ["university", "Classroom - Middle School"],
  ["lab", "Lab - School"],
  ["gym", "GYM"],
  ["fitness", "GYM"],
  ["spa", "SPA"],
  ["clinic", "Clinic"],
  ["medical", "Clinic"],
  ["doctor", "Clinic - Doctor Room"],
  ["treatment", "Clinic - Treatment Room"],
  ["hotel", "Lobby - Hotel"],
  ["kitchen", "Kitchen - Public"],
  ["pantry", "Kitchen - Private"],
  ["washroom", "Washroom"],
  ["toilet", "Toilet - Public"],
  ["wc", "Toilet - Public"],
  ["restroom", "Toilet - Public"],
  ["server", "Server Room"],
  ["cctv", "CCTV Room"],
  ["idf", "Typ. IDF Room"],
  ["electrical", "Typ. Electrical Room"],
  ["elec", "Typ. Electrical Room"],
  ["storage", "Storage - Dry"],
  ["store", "Storage - Dry"],
  ["caf", "Café"],
  ["restaurant", "Food & Beverage"],
  ["supermarket", "Supermarket"],
  ["retail", "Retail Shop - Mixed Building"],
  ["shop", "Retail Shop - Mixed Building"],
  ["mall", "Retail Shop - Mall"],
  ["prayer", "Male Prayer Room"],
  ["mosque", "Male Prayer Room"]
];

const SPACE_DENSITIES: Record<string, number> = {
  // Residential
  "Apartment - Dwelling Unit": 120,
  "Corridor - Residential": 60,
  "Lobby - Residential": 180,
  // Retail & F&B
  "Supermarket": 230,
  "Retail Shop - Mixed Building": 400,
  "Retail Shop - Mall": 200,
  "Food & Beverage": 2000,
  "Kitchen - Public": 600,
  "Kitchen - Private": 120,
  "Café": 140,
  // Office & Coworking
  "Office - Cabin": 120,
  "Office - Meeting Room": 120,
  "Office - Common Room": 120,
  "Coworking Space": 120,
  // Education
  "Classroom - EYFS": 140,
  "Classroom - Middle School": 140,
  "Classroom - Art": 140,
  "Classroom - High School": 150,
  "ICT Room": 180,
  "Lab - School": 180,
  "Lab - Science": 180,
  "Lobby - School": 100,
  // Wellness
  "GYM": 180,
  "SPA": 150,
  "Kids Play Area": 250,
  // Medical
  "Clinic": 250,
  "Clinic - Treatment Room": 140,
  "Clinic - Doctor Room": 140,
  "Storage - Medical": 140,
  // Hospitality
  "Lobby - Hotel": 100,
  // Utilities
  "Airlock": 120,
  "Washroom": 60,
  "Toilet - EYFS Attached": 100,
  "Toilet - Public": 100,
  "Male Prayer Room": 60,
  "Laundry / House Keeping": 150,
  "Garbage Room": 120,
  "Stairs": 100,
  "Lobby - Lift": 100,
  "Corridor - BOH/Service": 120,
  // MEP
  "MTR Room": 300,
  "LV Room": 90,
  "Server Room": 300,
  "CCTV Room": 300,
  "Typ. Electrical Room": 100,
  "Typ. IDF Room": 1500,
  "FCC Room": 120,
  "ETS Room": 120,
  "ETS Control Room": 120,
  "Chilled Water Pump Room": 120,
  "Fire Pump Room": 150,
  "ETS Pump Room": 100,
  "Boiler Room": 200,
  // Storage
  "Storage - Dry": 100,
  "Storage - IT": 1000,
  "Storage - Occupied": 120,
};

const extractFloor = (name: string): string => {
  const match = name.match(/^([0-9]|B|G|LG|UG|SF|RF|M|P)[FLfli]?/i);
  return match ? match[0].toUpperCase().replace(/L$/i, "F") : "General";
};

const inferTypeFromName = (name: string): string => {
  const q = name.toLowerCase().trim();
  for (const item of INFER_MAP) {
    if (q.includes(item[0])) return item[1];
  }
  return "";
};

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder }: InlineInputProps) {
  const [localVal, setLocalVal] = useState(value === "" ? "" : String(value));

  useEffect(() => {
    setLocalVal(value === "" ? "" : String(value));
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setLocalVal(value === "" ? "" : String(value));
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type={type}
      step={step}
      min={min}
      value={localVal}
      placeholder={placeholder}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        if (localVal !== (value === "" ? "" : String(value))) {
          onCommit(localVal);
        }
      }}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text placeholder:text-muted-foreground/45 placeholder:font-normal ${className}`}
    />
  );
}

function PreliminaryCoolingLoadPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();
  const prompt = usePrompt();
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();

  // State loaded from localStorage to keep 100% database compatibility
  const [projectInfo, setProjectInfo] = useState({
    projectName: "Preliminary Cooling Load Estimation",
    projectNumber: "MEP-PCL-2026",
    client: "Prestige Group developers",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-PCL01",
    notes: "Preliminary room-by-room cooling load analysis based on standard target heat dissipation densities.",
  });

  const [rows, setRows] = useState<PclRow[]>([]);
  const [editingSpace, setEditingSpace] = useState<PclRow | null>(null);
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);

  // Advanced selection, filter, sort and clipboard states
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<PclRow[]>([]);

  // Floor ordering state matching Ventilation
  const [floorOrder, setFloorOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("pcl-floor-order");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Bulk Edit Modal state
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState({
    floor: "",
    type: "",
    area: "",
  });
  const [bulkEditFields, setBulkEditFields] = useState({
    floor: false,
    type: false,
    area: false,
  });

  // Revit Excel / JSON Import Modal state
  const [importOpen, setImportOpen] = useState(false);
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [lastClickedPendingIndex, setLastClickedPendingIndex] = useState<number | null>(null);
  const [importBulkValues, setImportBulkValues] = useState({
    floor: "",
    type: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comment & Task Assignment Modal State
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type: "space" | "zone" | "equipment" } | null>(null);

  const handleOpenComment = (row: PclRow) => {
    setCommentTargetItem({ id: row.id, name: row.name, type: "space" });
    setCommentModalOpen(true);
  };

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pcl_rows");
      if (saved) {
        setRows(JSON.parse(saved));
      } else {
        // Populate default values
        const defaults: PclRow[] = [
          { id: "1", name: "G-01 Main Office Lobby", area: 85, type: "Lobby - Residential", density: 180, dissipation: 15300, kw: 15.3, tr: 15.3 / 3.517, floor: "GF" },
          { id: "2", name: "1F-02 Executive Office Cabin", area: 24, type: "Office - Cabin", density: 120, dissipation: 2880, kw: 2.88, tr: 2.88 / 3.517, floor: "1F" },
          { id: "3", name: "1F-03 Main Meeting Room", area: 45, type: "Office - Meeting Room", density: 120, dissipation: 5400, kw: 5.4, tr: 5.4 / 3.517, floor: "1F" },
          { id: "4", name: "B-01 Electrical Room", area: 35, type: "Typ. Electrical Room", density: 100, dissipation: 3500, kw: 3.5, tr: 3.5 / 3.517, floor: "BF" },
          { id: "5", name: "B-02 Server Room", area: 25, type: "Server Room", density: 300, dissipation: 7500, kw: 7.5, tr: 7.5 / 3.517, floor: "BF" },
        ];
        setRows(defaults);
      }
      
      const savedInfo = localStorage.getItem("pcl_project_info");
      if (savedInfo) {
        setProjectInfo(JSON.parse(savedInfo));
      }
    } catch (e) {
      console.error("Failed to load preliminary cooling load data", e);
    }
  }, []);

  // Auto-save useEffect
  useEffect(() => {
    localStorage.setItem("pcl_rows", JSON.stringify(rows));
    localStorage.setItem("pcl_rowCount", rows.length.toString());
    localStorage.setItem("pcl_project_info", JSON.stringify(projectInfo));
    // We do NOT call forceSaveToCloud here to avoid spamming the backend on every keystroke,
    // unless required, but the prompt says "In the manual save function... add forceSaveToCloud".
    // Wait, since this file doesn't have a manual save function, we can just let the global save handler (if any) handle it,
    // or we could add a debounced save. But leaving it as pure localStorage auto-save per the instructions for generic keys.
  }, [rows, projectInfo]);

  // Save to local storage and sync on rows change
  const saveRows = (newRows: PclRow[]) => {
    setRows(newRows);
    try {
      // Trigger PlumbingZoneLinker sync
      if (typeof (window as any).PlumbingZoneLinker?.syncFromPCL === "function") {
        (window as any).PlumbingZoneLinker.syncFromPCL();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Sizing Calculations
  const calculatedData = useMemo(() => {
    let totalArea = 0;
    let totalW = 0;

    rows.forEach(r => {
      const a = r.area !== "" ? Number(r.area) : 0;
      totalArea += a;
      totalW += r.dissipation;
    });

    const totalKw = totalW / 1000;
    const totalTr = totalKw / 3.517;
    const avgDensity = totalArea > 0 ? totalW / totalArea : 0;

    return {
      totalArea,
      totalKw,
      totalTr,
      avgDensity
    };
  }, [rows]);

  // Validation Warnings
  const validationLogs = useMemo(() => {
    const logs: { type: "success" | "warning" | "danger" | "info"; msg: string }[] = [];

    if (calculatedData.avgDensity > 300) {
      logs.push({
        type: "warning",
        msg: `High average heat load density detected (${calculatedData.avgDensity.toFixed(1)} W/m²). Ensure high air-change rates to prevent local hotspots.`,
      });
    } else {
      logs.push({
        type: "success",
        msg: `Average load density is in standard range (${calculatedData.avgDensity.toFixed(1)} W/m²).`,
      });
    }

    const highDensityRow = rows.find(r => r.density > 1000);
    if (highDensityRow) {
      logs.push({
        type: "danger",
        msg: `Space '${highDensityRow.name}' has extremely high load density (${highDensityRow.density} W/m²). Verify ventilation and spot cooling layouts.`,
      });
    }

    return logs;
  }, [calculatedData, rows]);

  // Filter & Sorting Logic
  const allUniqueFloors = useMemo(() => {
    const vals = new Set<string>();
    rows.forEach((r) => {
      if (r.floor) vals.add(r.floor);
    });
    return Array.from(vals).sort();
  }, [rows]);

  const allUniqueTypes = useMemo(() => {
    const vals = new Set<string>();
    rows.forEach((r) => {
      if (r.type) vals.add(r.type);
    });
    return Array.from(vals).sort();
  }, [rows]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedFloor) count++;
    if (selectedType) count++;
    return count;
  }, [selectedFloor, selectedType]);

  const handleResetFilters = () => {
    setSelectedFloor(null);
    setSelectedType(null);
  };

  const sortedFloorsForGrid = useMemo(() => {
    const ordered = floorOrder.filter((f) => allUniqueFloors.includes(f));
    const remaining = allUniqueFloors.filter((f) => !ordered.includes(f));
    return [...ordered, ...remaining];
  }, [allUniqueFloors, floorOrder]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;

    const nextList = [...sortedFloorsForGrid];
    const draggedItem = nextList[draggingIndex];
    nextList.splice(draggingIndex, 1);
    nextList.splice(index, 0, draggedItem);

    setDraggingIndex(index);
    setFloorOrder(nextList);
    localStorage.setItem("pcl-floor-order", JSON.stringify(nextList));
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  const handleResetFloorOrder = () => {
    setFloorOrder([]);
    localStorage.removeItem("pcl-floor-order");
  };

  const filteredRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return rows.filter((s) => {
      if (selectedFloor && s.floor !== selectedFloor) return false;
      if (selectedType && s.type !== selectedType) return false;
      if (q && !`${s.name} ${s.floor} ${s.type}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, selectedFloor, selectedType]);

  const orderedRows = useMemo(() => {
    const groups: Record<string, PclRow[]> = {};
    filteredRows.forEach((s) => {
      const floor = s.floor || "General";
      if (!groups[floor]) groups[floor] = [];
      groups[floor].push(s);
    });

    const sortedFloors = Object.keys(groups).sort((a, b) => {
      const idxA = sortedFloorsForGrid.indexOf(a);
      const idxB = sortedFloorsForGrid.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });

    const flat: PclRow[] = [];
    sortedFloors.forEach((floor) => {
      flat.push(...groups[floor]);
    });
    return flat;
  }, [filteredRows, sortedFloorsForGrid]);

  // Keyboard Shortcuts Hook matching Ventilation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Deselect all selected spaces/rows
      if (e.key === "Escape") {
        if (selected.size > 0 || selectedPending.size > 0) {
          e.preventDefault();
          setSelected(new Set());
          setSelectedPending(new Set());
          setLastClickedIndex(null);
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

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Ctrl+A (Select All)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (importOpen && pendingRecords.length > 0) {
          setSelectedPending(new Set(pendingRecords.map((r) => r.id)));
        } else if (!importOpen && filteredRows.length > 0) {
          setSelected(new Set(filteredRows.map((r) => r.id)));
        }
        return;
      }

      // 2. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (importOpen && selectedPending.size > 0) {
          e.preventDefault();
          confirm(`Are you sure you want to remove the ${selectedPending.size} selected pending spaces?`).then((ok) => {
            if (ok) {
              setPendingRecords((prev) => prev.filter((r) => !selectedPending.has(r.id)));
              setSelectedPending(new Set());
            }
          });
        } else if (!importOpen && selected.size > 0) {
          e.preventDefault();
          confirm(`Are you sure you want to delete the ${selected.size} selected spaces?`).then((ok) => {
            if (ok) {
              const selectedIds = Array.from(selected);
              saveRows(rows.filter((s) => !selectedIds.includes(s.id)));
              setSelected(new Set());
            }
          });
        }
        return;
      }

      // 3. Copy: Ctrl+C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (!importOpen && selected.size > 0) {
          e.preventDefault();
          const selectedRows = rows.filter((r) => selected.has(r.id));
          setClipboard(selectedRows);
        }
        return;
      }

      // 4. Cut: Ctrl+X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (!importOpen && selected.size > 0) {
          e.preventDefault();
          const selectedRows = rows.filter((r) => selected.has(r.id));
          setClipboard(selectedRows);
          saveRows(rows.filter((r) => !selected.has(r.id)));
          setSelected(new Set());
        }
        return;
      }

      // 5. Paste: Ctrl+V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (!importOpen && clipboard.length > 0) {
          e.preventDefault();
          const pasted = clipboard.map((r, idx) => ({
            ...r,
            id: `pcl-${Date.now()}-${idx}-${Math.random()}`,
            name: `${r.name} (Copy)`
          }));
          saveRows([...rows, ...pasted]);
          setSelected(new Set(pasted.map((s) => s.id)));
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [importOpen, pendingRecords, filteredRows, selected, selectedPending, rows, clipboard]);

  // DataGrid callbacks
  const toggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected((prev) => {
      const clickedIndex = orderedRows.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, clickedIndex);
        const end = Math.max(lastClickedIndex, clickedIndex);
        
        if (!isCtrl) {
          next.clear();
        }

        const shouldSelect = prev.has(orderedRows[lastClickedIndex]?.id || "") || true;

        for (let i = start; i <= end; i++) {
          const rId = orderedRows[i]?.id;
          if (rId) {
            if (shouldSelect) {
              next.add(rId);
            } else {
              next.delete(rId);
            }
          }
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedIndex(clickedIndex);
      } else {
        if (prev.has(id)) {
          next.delete(id);
          setLastClickedIndex(null);
        } else {
          next.clear();
          next.add(id);
          setLastClickedIndex(clickedIndex);
        }
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === filteredRows.length ? new Set() : new Set(filteredRows.map((r) => r.id))));
  };

  const handleToggleGroup = (ids: string[], select: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (select) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  // Table operations
  const handleAddNewSpace = () => {
    const defaultNum = rows.length + 1;
    const defaultName = `GF-Space ${defaultNum}`;
    const defaultType = "";
    const density = 0;
    const floor = extractFloor(defaultName);

    const newRow: PclRow = {
      id: `pcl-${Date.now()}`,
      name: defaultName,
      area: "",
      type: defaultType,
      density,
      dissipation: 0,
      kw: 0,
      tr: 0,
      floor,
    };

    saveRows([...rows, newRow]);
  };

  const handleDeleteSelected = async () => {
    const selectedIds = Array.from(selected);
    if (selectedIds.length === 0) {
      alert("Please select at least one space to delete.");
      return;
    }
    if (await confirm(`Are you sure you want to remove ${selectedIds.length} selected spaces?`)) {
      saveRows(rows.filter((r) => !selectedIds.includes(r.id)));
      setSelected(new Set());
    }
  };

  const handleClearAll = async () => {
    if (await confirm("Are you sure you want to remove all spaces from the schedule? This action cannot be undone.")) {
      saveRows([]);
      setSelected(new Set());
    }
  };

  // Excel / JSON Operations
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ projectInfo, rows }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_pcl_estimation.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.rows) saveRows(parsed.rows);
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          alert("Empty file!");
          return;
        }

        // Find headers
        let headerRowIndex = -1;
        let headers: string[] = [];
        for (let r = 0; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (row && row.length > 0) {
            const rowNormalized = row.map((cell) => (cell ? String(cell).trim().toLowerCase() : ""));
            const possibleHeaders = ["level", "floor", "name", "space name", "area"];
            const hasHeader = rowNormalized.some((cell) => possibleHeaders.includes(cell));
            if (hasHeader) {
              headerRowIndex = r;
              headers = rowNormalized;
              break;
            }
          }
        }

        if (headerRowIndex === -1) {
          alert("Missing header row! Excel must contain columns: Level/Floor, Name, Area.");
          return;
        }

        let idxLevel = headers.indexOf("level");
        if (idxLevel === -1) idxLevel = headers.indexOf("floor");
        
        let idxName = headers.indexOf("name");
        if (idxName === -1) idxName = headers.indexOf("space name");
        
        const idxArea = headers.indexOf("area");

        if ((idxLevel === -1 && idxName === -1) || idxArea === -1) {
          alert("Missing Level/Floor, Name, or Area columns.");
          return;
        }

        const parsed: any[] = [];
        for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!row || row.length === 0) continue;

          const levelVal = idxLevel !== -1 ? String(row[idxLevel] || "").trim() : "";
          const nameVal = idxName !== -1 ? String(row[idxName] || "").trim() : "";

          if (!nameVal && !levelVal) continue;

          const rawArea = String(row[idxArea] || "").trim();
          const areaCleaned = rawArea.replace(/[^\d\.]/g, "");
          const area = parseFloat(areaCleaned) || 0;

          const inferredType = inferTypeFromName(nameVal) || "Apartment - Dwelling Unit";
          const density = SPACE_DENSITIES[inferredType] || 120;
          const floor = levelVal || extractFloor(nameVal) || "GF";

          parsed.push({
            id: `pending-${r}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            floor,
            name: nameVal || `Space ${r}`,
            type: inferredType,
            density,
            area,
            kw: (area * density) / 1000,
            tr: ((area * density) / 1000) / 3.517,
          });
        }

        setPendingRecords(parsed);
        setSelectedPending(new Set(parsed.map((p) => p.id)));
      } catch (err) {
        console.error(err);
        alert("Failed to parse Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcelFile(file);
  };

  const togglePendingRow = (id: string, isShift?: boolean) => {
    setSelectedPending((prev) => {
      const clickedIndex = pendingRecords.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift && lastClickedPendingIndex !== null) {
        const start = Math.min(lastClickedPendingIndex, clickedIndex);
        const end = Math.max(lastClickedPendingIndex, clickedIndex);

        const shouldSelect = prev.has(pendingRecords[lastClickedPendingIndex]?.id || "") || true;

        for (let i = start; i <= end; i++) {
          const rId = pendingRecords[i]?.id;
          if (rId) {
            if (shouldSelect) {
              next.add(rId);
            } else {
              next.delete(rId);
            }
          }
        }
      } else {
        if (prev.has(id)) {
          next.delete(id);
          setLastClickedPendingIndex(null);
        } else {
          next.add(id);
          setLastClickedPendingIndex(clickedIndex);
        }
      }
      return next;
    });
  };

  const handleCommitImport = () => {
    const importList = pendingRecords.filter((r) => selectedPending.has(r.id));
    if (importList.length === 0) {
      alert("No spaces selected for import.");
      return;
    }

    const nextRows = [...rows];
    importList.forEach((r, idx) => {
      nextRows.push({
        id: `pcl-${Date.now()}-${idx}-${Math.random()}`,
        name: r.name,
        area: r.area,
        type: r.type,
        density: r.density,
        dissipation: r.area * r.density,
        kw: r.kw,
        tr: r.tr,
        floor: r.floor,
      });
    });

    saveRows(nextRows);
    setImportOpen(false);
    setPendingRecords([]);
    setSelectedPending(new Set());
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Cooling Load");

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 14;
    sheet.getColumn(4).width = 28;
    sheet.getColumn(5).width = 20;
    sheet.getColumn(6).width = 22;
    sheet.getColumn(7).width = 15;

    sheet.mergeCells("A1:G1");
    const cellA1 = sheet.getCell("A1");
    cellA1.value = "PRELIMINARY COOLING LOAD REPORT";
    cellA1.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
    cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0A7BC7" } };
    cellA1.alignment = { horizontal: "center", vertical: "middle" };

    sheet.addRow([]);
    sheet.addRow(["Consistent Engineering Consultants", "", "", "", "", "Date: " + projectInfo.date]);
    sheet.addRow([]);

    sheet.addRow(["📊 PROJECT SUMMARY STATS"]);
    sheet.getRow(5).getCell(1).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFF" } };
    sheet.getRow(5).getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "06456F" } };
    sheet.mergeCells("A5:G5");

    sheet.addRow(["Total Spaces:", rows.length, "", "Total Load (TR):", "", Number(calculatedData.totalTr.toFixed(2))]);
    sheet.addRow(["Total Floor Area (m²):", Number(calculatedData.totalArea.toFixed(1)), "", "Total Load (kW):", "", Number(calculatedData.totalKw.toFixed(2))]);
    sheet.addRow(["Average Load Density (W/m²):", Number(calculatedData.avgDensity.toFixed(1))]);

    sheet.addRow([]);
    sheet.addRow(["❄️ COOLING LOAD SCHEDULE"]);
    sheet.getRow(10).getCell(1).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFF" } };
    sheet.getRow(10).getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "06456F" } };
    sheet.mergeCells("A10:G10");

    sheet.addRow(["S.No", "Name of Space", "Area (m²)", "Type of Space", "Heat Density (W/m²)", "Cooling Load (kW)", "Load (TR)"]);
    const headerRow = sheet.getRow(11);
    headerRow.eachCell((cell) => {
      cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0A7BC7" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    const grouped: Record<string, PclRow[]> = {};
    rows.forEach(row => {
      if (!grouped[row.floor]) grouped[row.floor] = [];
      grouped[row.floor].push(row);
    });

    let sNo = 1;
    Object.keys(grouped).sort().forEach(floor => {
      const floorHeaderRow = sheet.addRow(["📍 Floor: " + floor]);
      sheet.mergeCells(`A${floorHeaderRow.number}:G${floorHeaderRow.number}`);
      floorHeaderRow.getCell(1).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "06456F" } };
      floorHeaderRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCEFFB" } };

      grouped[floor].forEach(r => {
        const dataRow = sheet.addRow([
          sNo++,
          r.name,
          r.area,
          r.type,
          r.density,
          Number(r.kw.toFixed(2)),
          Number(r.tr.toFixed(2))
        ]);
        dataRow.eachCell((cell) => {
          cell.font = { name: "Segoe UI", size: 10 };
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });
      });
    });

    const totalRow = sheet.addRow(["TOTAL", "", Number(calculatedData.totalArea.toFixed(1)), "", Number(calculatedData.avgDensity.toFixed(1)), Number(calculatedData.totalKw.toFixed(2)), Number(calculatedData.totalTr.toFixed(2))]);
    sheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
    totalRow.eachCell((cell) => {
      cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "06456F" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCEFFB" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "double", color: { argb: "06456F" } }, left: { style: "thin" }, right: { style: "thin" } };
    });

    
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "preliminary-cooling-load");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${projectInfo.projectName.replace(/\s+/g, "_")}_report.xlsx`);
  };

  const handlePrintPDF = () => {
    const doc = new jsPDF("p", "pt", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PRELIMINARY COOLING LOAD REPORT", 40, 50);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${projectInfo.date} | Consultant: ${projectInfo.consultant} | Standard: ASHRAE`, 40, 68);

    doc.setDrawColor(10, 123, 199);
    doc.line(40, 75, 550, 75);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("1. Project & Sizing Details", 40, 95);

    const projectData = [
      ["Project Name", projectInfo.projectName, "Project Number", projectInfo.projectNumber],
      ["Consultant", projectInfo.consultant, "Client", projectInfo.client],
      ["Revision", projectInfo.revision, "Calculation Ref", projectInfo.calcNumber],
    ];

    autoTable(doc, {
      startY: 105,
      head: [],
      body: projectData,
      theme: "plain",
      styles: { fontSize: 9.5, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 90 },
        1: { cellWidth: 170 },
        2: { fontStyle: "bold", cellWidth: 90 },
        3: { cellWidth: 170 },
      },
    });

    doc.setFont("helvetica", "bold");
    doc.text("2. Room Sizing Schedule", 40, (doc as any).lastAutoTable.finalY + 25);

    const grouped: Record<string, PclRow[]> = {};
    rows.forEach(row => {
      if (!grouped[row.floor]) grouped[row.floor] = [];
      grouped[row.floor].push(row);
    });

    const loadHead = [["S.No", "Space Name", "Area (m²)", "Space Type", "Density (W/m²)", "kW", "TR"]];
    const loadBody: any[] = [];
    let sNo = 1;

    Object.keys(grouped).sort().forEach(floor => {
      loadBody.push([{ content: `📍 Floor: ${floor}`, colSpan: 7, styles: { fillColor: [220, 239, 251], textColor: [6, 69, 111], fontStyle: "bold" } }]);
      grouped[floor].forEach(r => {
        loadBody.push([
          sNo++,
          r.name,
          r.area,
          r.type,
          r.density,
          r.kw.toFixed(2),
          r.tr.toFixed(2)
        ]);
      });
    });

    loadBody.push([
      { content: "TOTAL", colSpan: 2, styles: { fillColor: [220, 239, 251], textColor: [6, 69, 111], fontStyle: "bold" } },
      { content: calculatedData.totalArea.toFixed(1), styles: { fillColor: [220, 239, 251], textColor: [6, 69, 111], fontStyle: "bold" } },
      { content: "", styles: { fillColor: [220, 239, 251] } },
      { content: calculatedData.avgDensity.toFixed(1), styles: { fillColor: [220, 239, 251], textColor: [6, 69, 111], fontStyle: "bold" } },
      { content: calculatedData.totalKw.toFixed(2), styles: { fillColor: [220, 239, 251], textColor: [6, 69, 111], fontStyle: "bold" } },
      { content: calculatedData.totalTr.toFixed(2), styles: { fillColor: [220, 239, 251], textColor: [6, 69, 111], fontStyle: "bold" } }
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 35,
      head: loadHead,
      body: loadBody,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [10, 123, 199] },
    });

    
    const sigFinalY = (doc as any).lastAutoTable?.finalY || 40;
    addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "preliminary-cooling-load");
    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);
  };

  // Bulk Edit Callback
  const handleBulkEditSave = () => {
    const selectedIds = Array.from(selected);
    const updated = rows.map((r) => {
      if (selectedIds.includes(r.id)) {
        const nextRow = { ...r };
        if (bulkEditFields.floor) {
          nextRow.floor = bulkEditValues.floor.trim() || r.floor;
        }
        if (bulkEditFields.type) {
          nextRow.type = bulkEditValues.type;
          nextRow.density = SPACE_DENSITIES[bulkEditValues.type] || 120;
        }
        if (bulkEditFields.area) {
          nextRow.area = parseFloat(bulkEditValues.area) || r.area;
        }
        const numArea = nextRow.area !== "" ? Number(nextRow.area) : 0;
        nextRow.dissipation = numArea * nextRow.density;
        nextRow.kw = nextRow.dissipation / 1000;
        nextRow.tr = nextRow.kw / 3.517;
        return nextRow;
      }
      return r;
    });
    saveRows(updated);
    setBulkEditOpen(false);
    setSelected(new Set());
  };

  // DataGrid Column definitions for PCL
  const columns: Column<PclRow>[] = [
    {
      key: "name",
      header: "Name of Space",
      width: 240,
      editable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5 w-full">
          {Array.isArray(r.comments) && r.comments.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenComment(r);
              }}
              title={`${r.comments.length} comment(s)/task(s) assigned to space "${r.name}"`}
              className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer"
            >
              <MessageSquare className="size-3.5 fill-blue-500/20" />
            </button>
          )}
          <InlineInput
            value={r.name}
            onCommit={(newName) => {
              const floor = extractFloor(newName);
              const defaultType = inferTypeFromName(newName) || r.type;
              const density = SPACE_DENSITIES[defaultType] || 120;
              const numArea = r.area !== "" ? Number(r.area) : 0;
              const dissipation = numArea * density;
              const kw = dissipation / 1000;
              const tr = kw / 3.517;

              saveRows(rows.map(row => row.id === r.id ? {
                ...row,
                name: newName,
                floor,
                type: defaultType,
                density,
                dissipation,
                kw,
                tr
              } : row));
            }}
            className="font-normal text-[13px] font-sans flex-1 min-w-0"
          />
        </div>
      ),
    },
    {
      key: "area",
      header: "Area (m²)",
      width: 90,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          min={1}
          value={r.area}
          placeholder="20"
          onCommit={(newAreaStr) => {
            const nextArea = newAreaStr === "" ? "" : Number(newAreaStr);
            const numArea = nextArea !== "" ? Number(nextArea) : 0;
            const dissipation = numArea * r.density;
            const kw = dissipation / 1000;
            const tr = kw / 3.517;

            saveRows(rows.map(row => row.id === r.id ? {
              ...row,
              area: nextArea,
              dissipation,
              kw,
              tr
            } : row));
          }}
          className="font-mono text-center text-[13px]"
        />
      ),
    },
    {
      key: "type",
      header: "Type of Space",
      width: 260,
      editable: true,
      render: (r) => (
        <select
          value={r.type || ""}
          onChange={(e) => {
            const nextType = e.target.value;
            const density = SPACE_DENSITIES[nextType] || 0;
            const numArea = r.area !== "" ? Number(r.area) : 0;
            const dissipation = numArea * density;
            const kw = dissipation / 1000;
            const tr = kw / 3.517;

            saveRows(rows.map(row => row.id === r.id ? {
              ...row,
              type: nextType,
              density,
              dissipation,
              kw,
              tr
            } : row));
          }}
          className={`w-full bg-transparent border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-muted-foreground/20 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-0.5 px-1 rounded text-[12.5px] cursor-pointer font-sans ${!r.type ? "text-muted-foreground/45" : "text-foreground font-medium"}`}
        >
          <option value="" disabled className="text-muted-foreground">Select</option>
          {Object.keys(SPACE_DENSITIES).map(k => (
            <option key={k} value={k} className="bg-background text-foreground text-xs font-normal">
              {k} ({SPACE_DENSITIES[k]} W/m²)
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "density",
      header: "Density",
      width: 100,
      align: "right",
      mono: true,
      render: (r) => r.type ? `${r.density} W/m²` : <span className="text-muted-foreground/45 font-mono font-normal">120 W/m²</span>,
    },
    {
      key: "kw",
      header: "Load (kW)",
      width: 90,
      align: "right",
      mono: true,
      render: (r) => r.area === "" ? (
        <span className="text-muted-foreground/45 font-mono font-normal">{((20 * (r.density || 120)) / 1000).toFixed(2)} kW</span>
      ) : `${r.kw.toFixed(2)} kW`,
    },
    {
      key: "tr",
      header: "Load (TR)",
      width: 90,
      align: "right",
      mono: true,
      render: (r) => r.area === "" ? (
        <span className="text-muted-foreground/45 font-mono font-normal">{(((20 * (r.density || 120)) / 1000) / 3.517).toFixed(2)} TR</span>
      ) : `${r.tr.toFixed(2)} TR`,
    },
  ];

  const renderSpaceContextMenu = (row: PclRow) => {
    const selectedIds = selected.has(row.id) ? Array.from(selected) : [row.id];
    const isMulti = selectedIds.length > 1;
    const targetsCount = selectedIds.length;

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => {
            const clones = selectedIds.map((id, index) => {
              const targetRow = rows.find((s) => s.id === id);
              if (!targetRow) return null;
              return {
                ...targetRow,
                id: `pcl-${Date.now()}-${index}-${Math.random()}`,
                name: `${targetRow.name} (Clone)`,
              };
            }).filter(Boolean) as PclRow[];
            
            if (clones.length > 0) {
              saveRows([...rows, ...clones]);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Duplicate Selected" : "Duplicate Space"}</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={() => handleOpenComment(row)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment / Assign Task</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />
        
        <ContextMenuItem
          onClick={async () => {
            const msg = targetsCount === 1 
              ? `Are you sure you want to delete space "${row.name}"?`
              : `Are you sure you want to delete the ${targetsCount} selected spaces?`;
            
            if (await confirm(msg)) {
              saveRows(rows.filter((s) => !selectedIds.includes(s.id)));
              setSelected(new Set());
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const renderFloorGroupHeader = (floor: string) => {
    const floorRows = filteredRows.filter(r => r.floor === floor);
    return (
      <span className="flex items-center gap-1.5 font-medium">
        <span><strong className="font-bold text-primary">{floor}</strong></span>
        <span className="text-[10px] text-muted-foreground font-normal">({floorRows.length} spaces) (Right-click or press Delete to remove)</span>
      </span>
    );
  };

  const renderFloorGroupContextMenu = (floor: string) => {
    return (
      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={async () => {
            const newFloor = await prompt("Enter new floor name:", floor, { title: "Rename Floor" });
            if (newFloor && newFloor.trim() !== "" && newFloor.trim() !== floor) {
              const trimmed = newFloor.trim();
              saveRows(rows.map(s => s.floor === floor ? { ...s, floor: trimmed } : s));
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Rename Floor</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />
        
        <ContextMenuItem
          onClick={async () => {
            const floorSpaces = rows.filter((s) => s.floor === floor);
            if (floorSpaces.length > 0) {
              if (await confirm(`Are you sure you want to delete all ${floorSpaces.length} spaces on floor "${floor}"?`)) {
                saveRows(rows.filter((s) => s.floor !== floor));
                setSelected(new Set());
              }
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Floor</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  return (
    <AppShell title="Preliminary Cooling Load" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          <CalculationReviewBar
            projectId={activeProjectId || project?.id || "default"}
            calculatorPath="/preliminary-cooling-load"
            calculatorTitle="Preliminary Cooling Load"
          />
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print px-6">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; PRELIMINARY COOLING LOAD</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Preliminary Cooling Load</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} spaces</span>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Preliminary room-by-room cooling load and heat density sizer schedule.
              </p>
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className="mx-6 mb-6 bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden">
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/60">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setActiveTab("calculator")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "calculator"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sizing Calculator
                </button>
                <button
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Printable Report
                </button>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 animate-fade-in flex flex-col">
              {activeTab === "calculator" ? (
                <div className="flex-1 min-h-0 flex flex-col relative">
                    
                    {/* Toolbar matching Ventilation */}
                    <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter spaces..."
                        className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
                      />

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
                                className="text-[10px] text-primary hover:underline font-semibold"
                              >
                                Clear All
                              </button>
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Floor</span>
                            <select
                              value={selectedFloor || ""}
                              onChange={(e) => setSelectedFloor(e.target.value || null)}
                              className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                            >
                              <option value="">All Floors</option>
                              {allUniqueFloors.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Space Type</span>
                            <select
                              value={selectedType || ""}
                              onChange={(e) => setSelectedType(e.target.value || null)}
                              className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                            >
                              <option value="">All Space Types</option>
                              {allUniqueTypes.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                              floorOrder.length > 0
                                ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                                : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                            }`}
                          >
                            <ArrowUpDown className="size-3.5 shrink-0" />
                            {floorOrder.length > 0 && (
                              <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                                ✓
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans z-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11.5px] font-semibold text-foreground">Arrange Floors</span>
                            {floorOrder.length > 0 && (
                              <button
                                onClick={handleResetFloorOrder}
                                className="text-[10px] text-primary hover:underline font-medium"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          <p className="text-[10.5px] text-muted-foreground mb-3 leading-snug">
                            Drag and drop floors to change their sorting order in the grid views.
                          </p>
                          <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-0.5">
                            {sortedFloorsForGrid.map((floor, index) => (
                              <div
                                key={floor}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center gap-2 p-1.5 bg-surface rounded border border-border text-[11px] cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
                                  draggingIndex === index
                                    ? "opacity-40 border-primary bg-primary/5"
                                    : "hover:bg-surface-2 hover:border-border-strong"
                                }`}
                              >
                                <span className="font-semibold text-foreground uppercase truncate">{floor}</span>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      
                      <div className="ml-auto flex items-center gap-1">
                        <TBtn onClick={() => setImportOpen(true)}><Upload className="size-3.5" /> Import</TBtn>
                        <TBtn primary onClick={handleAddNewSpace}><Plus className="size-3.5" /> New Space</TBtn>
                      </div>

                      {/* Bulk actions bar overlay */}
                      {selected.size > 0 && (
                        <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print">
                          <span className="font-semibold">{selected.size} selected</span>
                          <span className="text-primary/30">·</span>
                          <BulkBtn icon={Edit3} onClick={() => {
                            setBulkEditValues({
                              floor: "",
                              type: "",
                              area: "",
                            });
                            setBulkEditFields({
                              floor: false,
                              type: false,
                              area: false,
                            });
                            setBulkEditOpen(true);
                          }}>Bulk edit</BulkBtn>
                          <BulkBtn icon={Trash2} onClick={handleDeleteSelected}>Delete</BulkBtn>
                          <button onClick={() => setSelected(new Set())} className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded">
                            <X className="size-3" /> Clear
                          </button>
                        </div>
                      )}
                    </div>

                    {/* DataGrid container */}
                    <div className="flex-1 min-h-0 relative flex flex-col">
                      {rows.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-2">
                          <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center animate-scale-in">
                            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce">
                              <Upload className="size-6" />
                            </div>
                            <h3 className="text-[15px] font-semibold tracking-tight">No Spaces Loaded</h3>
                            <p className="text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                              Start by importing a Revit Excel space schedule sheet or manually add spaces. The system will automatically detect space classifications, apply heat dissipation densities, and compute cooling load metrics.
                            </p>
                            <div className="flex items-center gap-3 w-full">
                              <button
                                onClick={() => setImportOpen(true)}
                                className="flex-1 bg-primary text-primary-foreground font-semibold h-9 rounded hover:bg-primary/95 transition-colors text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                              >
                                <Upload className="size-3.5" /> Import Revit Excel
                              </button>
                              <button
                                onClick={handleAddNewSpace}
                                className="flex-1 border border-border hover:bg-surface-2 font-semibold h-9 rounded transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Plus className="size-3.5" /> + Add Space
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <DataGrid
                          rows={rows}
                          columns={columns}
                          selected={selected}
                          onToggle={toggle}
                          onToggleAll={toggleAll}
                          onRowDoubleClick={(r) => setEditingSpace(r)}
                          renderContextMenu={renderSpaceContextMenu}
                          groupBy={(r) => r.floor}
                          groupOrder={sortedFloorsForGrid}
                          renderGroupHeader={renderFloorGroupHeader}
                          renderGroupContextMenu={renderFloorGroupContextMenu}
                          onToggleGroup={handleToggleGroup}
                        />
                      )}
                      {editingSpace && (
                        <EditPclSpaceModal
                          space={editingSpace}
                          onClose={() => setEditingSpace(null)}
                          onSave={(updated) => {
                            saveRows(rows.map((r) => r.id === updated.id ? updated : r));
                            setEditingSpace(null);
                          }}
                          availableFloors={sortedFloorsForGrid}
                          spaceDensities={SPACE_DENSITIES}
                        />
                      )}
                    </div>

                    {/* Bottom stats summary bar */}
                    <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 select-none">
                      <div>Showing <span className="text-foreground font-medium tabular">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} spaces</div>
                      <div className="flex items-center gap-3 tabular">
                        <span>Σ Area: <span className="font-mono text-foreground font-bold">{calculatedData.totalArea.toFixed(1)} m²</span></span>
                        <span>Avg Heat Density: <span className="font-mono text-foreground font-bold">{calculatedData.avgDensity.toFixed(1)} W/m²</span></span>
                        <span>Σ Load (kW): <span className="font-mono text-primary font-bold">{calculatedData.totalKw.toFixed(2)} kW</span></span>
                        <span>Σ Load (TR): <span className="font-mono text-pink-600 font-bold">{calculatedData.totalTr.toFixed(2)} TR</span></span>
                      </div>
                    </div>

                </div>
              ) : (
                /* Printable Report tab view */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Fixed Toolbar at the top */}
                  <div className="relative flex items-center justify-end gap-3 px-6 h-12 bg-background border-b border-border/60 shrink-0 no-print select-none">
                    <TBtn onClick={handlePrintPDF} primary><Printer className="size-3.5" /> Print / Export PDF</TBtn>
                  </div>
                  
                  {/* Scrollable Report Content */}
                  <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-950/20 font-sans print:p-0">

                  {/* Results Dashboard Grid */}
                  <div className="no-print max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border border-blue-200/60 dark:border-blue-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-blue-500/10 text-blue-600 rounded-full p-2">
                        <Sparkles className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1 font-sans">Total Cooling Load (TR)</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.totalTr.toFixed(2)} TR</strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block font-sans">Total Load in kW: {calculatedData.totalKw.toFixed(2)} kW</span>
                    </div>

                    <div className="bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-950/20 dark:to-pink-900/10 border border-pink-200/60 dark:border-pink-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-pink-500/10 text-pink-600 rounded-full p-2">
                        <Gauge className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-widest block mb-1 font-sans">Average Load Density</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.avgDensity.toFixed(1)} W/m²</strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block font-sans">Total Area Sized: {calculatedData.totalArea.toFixed(1)} m²</span>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-emerald-500/10 text-emerald-600 rounded-full p-2">
                        <CheckCircle2 className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1 font-sans">Total Spaces Sized</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{rows.length} spaces</strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block font-sans">Active Floors: {new Set(rows.map(r => r.floor)).size} levels</span>
                    </div>

                    <div className={`bg-gradient-to-br border rounded-2xl p-5 shadow-xs relative overflow-hidden ${
                      calculatedData.avgDensity > 300 
                        ? "from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200/60 dark:border-amber-800/50"
                        : "from-teal-50 to-teal-100/50 dark:from-teal-950/20 dark:to-teal-900/10 border-teal-200/60 dark:border-teal-800/50"
                    }`}>
                      <div className="absolute right-4 top-4 text-muted-foreground rounded-full p-2">
                        <AlertTriangle className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest block mb-1 font-sans">Design Density Status</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">
                        {calculatedData.avgDensity > 300 ? "High Load" : "Standard"}
                      </strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block font-sans">
                        {calculatedData.avgDensity > 300 ? "Requires mechanical ventilation review" : "Optimal cooling density range"}
                      </span>
                    </div>

                  </div>

                  {/* Sizing Validation Warnings Panel */}
                  {validationLogs.length > 0 && (
                    <div className="no-print max-w-4xl mx-auto w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm font-sans">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3.5 flex items-center gap-2">
                        <AlertTriangle className="size-4 text-amber-500" /> Sizing Validation Warnings
                      </h3>
                      <div className="flex flex-col gap-2">
                        {validationLogs.map((log, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-[12.5px] ${
                              log.type === "danger"
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
                                : log.type === "warning"
                                  ? "bg-sky-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                                  : log.type === "success"
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                    : "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400"
                            }`}
                          >
                            {log.type === "danger" || log.type === "warning" ? (
                              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                            ) : log.type === "success" ? (
                              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                            ) : (
                              <Info className="size-4 shrink-0 mt-0.5" />
                            )}
                            <span>{log.msg}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border border-slate-300 dark:border-slate-800 rounded-xl p-8 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0">
                    
                    {/* Report Header */}
                    <div className="border-b-2 border-slate-800 pb-5 mb-6 flex justify-between items-start font-sans">
                      <div>
                        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">PRELIMINARY COOLING LOAD REPORT</h1>
                        <p className="text-[12px] text-muted-foreground font-mono mt-1 font-sans">Preliminary Cooling Load and Heat Density analysis grouped by floor level</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[13px] font-bold text-primary font-mono block">MEP CALCULATION SUITE</span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5 font-sans">Date: {projectInfo.date}</span>
                      </div>
                    </div>

                    {/* 1. Project Info */}
                    <div className="mb-6 font-sans">
                      <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3">1. Project Details</h3>
                      <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                        <div>
                          <span className="text-muted-foreground block">Project Name:</span>
                          <span className="font-semibold">{projectInfo.projectName}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Project Number:</span>
                          <span className="font-semibold">{projectInfo.projectNumber}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Consultant / Engineer:</span>
                          <span className="font-semibold">{projectInfo.consultant}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Client Name:</span>
                          <span className="font-semibold">{projectInfo.client}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground block">Calculation Notes:</span>
                          <span className="italic text-muted-foreground block mt-0.5">{projectInfo.notes}</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Connected load table grouped by floor */}
                    <div className="mb-6 page-break font-sans">
                      <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 pb-1 mb-3">2. Sizing Details</h3>
                      
                      {(() => {
                        const grouped: Record<string, PclRow[]> = {};
                        rows.forEach(row => {
                          if (!grouped[row.floor]) grouped[row.floor] = [];
                          grouped[row.floor].push(row);
                        });

                        let sNo = 1;

                        return (
                          <table className="w-full text-left text-[11px] border border-collapse border-slate-200 font-sans">
                            <thead>
                              <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-200">
                                <th className="p-2 border-r border-slate-200">S.No</th>
                                <th className="p-2 border-r border-slate-200">Space Name</th>
                                <th className="p-2 text-right border-r border-slate-200">Area (m²)</th>
                                <th className="p-2 border-r border-slate-200">Space Type</th>
                                <th className="p-2 text-right border-r border-slate-200">Density (W/m²)</th>
                                <th className="p-2 text-right border-r border-slate-200">kW</th>
                                <th className="p-2 text-right">TR</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-mono">
                              {Object.keys(grouped).sort().map(floor => (
                                <tr key={floor}>
                                  <td colSpan={7} className="p-0">
                                    <table className="w-full border-collapse">
                                      <tbody>
                                        <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                                          <td colSpan={7} className="p-2 font-sans">📍 Floor: {floor}</td>
                                        </tr>
                                        {grouped[floor].map(r => (
                                          <tr key={r.id}>
                                            <td className="p-2 border-r border-slate-200 w-12">{sNo++}</td>
                                            <td className="p-2 border-r border-slate-200 font-sans">{r.name}</td>
                                            <td className="p-2 text-right border-r border-slate-200 w-16">{r.area}</td>
                                            <td className="p-2 border-r border-slate-200 font-sans">{r.type}</td>
                                            <td className="p-2 text-right border-r border-slate-200 w-24">{r.density}</td>
                                            <td className="p-2 text-right border-r border-slate-200 w-24 font-bold">{r.kw.toFixed(2)}</td>
                                            <td className="p-2 text-right w-20 font-bold text-primary">{r.tr.toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-blue-50 font-bold text-blue-950">
                                <td colSpan={2} className="p-2 border-r border-slate-200 font-sans">TOTAL</td>
                                <td className="p-2 text-right border-r border-slate-200">{calculatedData.totalArea.toFixed(1)}</td>
                                <td className="p-2 border-r border-slate-200 font-sans"></td>
                                <td className="p-2 text-right border-r border-slate-200">{calculatedData.avgDensity.toFixed(1)}</td>
                                <td className="p-2 text-right border-r border-slate-200">{calculatedData.totalKw.toFixed(2)}</td>
                                <td className="p-2 text-right text-primary">{calculatedData.totalTr.toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        );
                      })()}

                    </div>

                    {/* Engineering sign off footer */}
                    <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[11px] text-muted-foreground font-sans">
                      <div>
                        <p className="font-semibold uppercase tracking-wider text-slate-800 mb-6 font-sans">Prepared By:</p>
                        <div className="border-b border-slate-300 w-48 mb-1"></div>
                        <p className="font-sans">Consulting HVAC Engineer</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold uppercase tracking-wider text-slate-800 mb-6 font-sans">Reviewed & Approved By:</p>
                        <div className="border-b border-slate-300 w-48 ml-auto mb-1"></div>
                        <p className="font-sans">Lead MEP Principal Engineer</p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal Overlay */}
      {importOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden font-sans">
            <header className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="size-5 text-primary animate-bounce" />
                <h3 className="font-bold text-[15px]">Import Space Schedule (Excel / JSON)</h3>
              </div>
              <button
                onClick={() => {
                  setImportOpen(false);
                  setPendingRecords([]);
                }}
                className="text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded-md p-1"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
              {pendingRecords.length === 0 ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) parseExcelFile(file);
                  }}
                  className="flex-1 min-h-[300px] border-2 border-dashed border-border hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/10 cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <Upload className="size-8" />
                  </div>
                  <span className="font-semibold text-sm">Drag & drop your Excel space schedule here</span>
                  <span className="text-xs text-muted-foreground mt-1">or click to browse files from your computer</span>
                  <span className="text-[10px] text-muted-foreground mt-4 font-mono">Supports Revit Space Schedules with columns: Level/Floor, Name, Area</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx,.xls,.json"
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[400px]">
                  
                  {/* Left: Pending rows table */}
                  <div className="flex-1 flex flex-col border border-border rounded-xl bg-card overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-b border-border flex items-center justify-between text-xs font-semibold">
                      <span>Previewing {pendingRecords.length} parsed spaces</span>
                      <span>{selectedPending.size} selected</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[350px]">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-border text-[10.5px] font-bold text-muted-foreground uppercase">
                            <th className="p-3 text-center w-10">
                              <input
                                type="checkbox"
                                checked={selectedPending.size === pendingRecords.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPending(new Set(pendingRecords.map(p => p.id)));
                                  } else {
                                    setSelectedPending(new Set());
                                  }
                                }}
                                className="rounded border-gray-300 text-primary size-3.5 cursor-pointer"
                              />
                            </th>
                            <th className="p-3">Level</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Area (m²)</th>
                            <th className="p-3">Space Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-medium">
                          {pendingRecords.map((r, index) => (
                            <tr
                              key={r.id}
                              onClick={(e) => togglePendingRow(r.id, e.shiftKey)}
                              className={`hover:bg-slate-50/40 dark:hover:bg-slate-900/10 cursor-pointer transition-colors ${
                                selectedPending.has(r.id) ? "bg-primary/5" : ""
                              }`}
                            >
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedPending.has(r.id)}
                                  onChange={() => togglePendingRow(r.id)}
                                  className="rounded border-gray-300 text-primary size-3.5 cursor-pointer"
                                />
                              </td>
                              <td className="p-3 font-mono text-[11px] uppercase">{r.floor}</td>
                              <td className="p-3 text-foreground">{r.name}</td>
                              <td className="p-3 font-mono">{r.area.toFixed(1)}</td>
                              <td className="p-3 font-sans truncate max-w-[150px]">{r.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: Bulk Editor Panel for Import */}
                  <div className="w-full lg:w-72 border border-border rounded-xl bg-card p-4 flex flex-col gap-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Bulk Parameters Config
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Apply parameters to the {selectedPending.size} selected pending spaces before committing them.
                    </p>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Override Floor</label>
                      <input
                        type="text"
                        value={importBulkValues.floor}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, floor: e.target.value })}
                        placeholder="e.g. L01"
                        className="h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Set Space Type</label>
                      <select
                        value={importBulkValues.type}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, type: e.target.value })}
                        className="h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary cursor-pointer"
                      >
                        <option value="">Choose space type...</option>
                        {Object.keys(SPACE_DENSITIES).map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        if (selectedPending.size === 0) {
                          alert("Select pending spaces first.");
                          return;
                        }
                        const updated = pendingRecords.map((r) => {
                          if (selectedPending.has(r.id)) {
                            const next = { ...r };
                            if (importBulkValues.floor) next.floor = importBulkValues.floor.trim();
                            if (importBulkValues.type) {
                              next.type = importBulkValues.type;
                              next.density = SPACE_DENSITIES[importBulkValues.type] || 120;
                              next.kw = (next.area * next.density) / 1000;
                              next.tr = next.kw / 3.517;
                            }
                            return next;
                          }
                          return r;
                        });
                        setPendingRecords(updated);
                      }}
                      className="w-full bg-primary/10 hover:bg-primary/20 text-primary font-bold h-8.5 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Apply Parameters
                    </button>
                  </div>

                </div>
              )}
            </div>

            {pendingRecords.length > 0 && (
              <footer className="px-6 py-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between shrink-0 font-sans text-xs">
                <button
                  onClick={() => {
                    setPendingRecords([]);
                    setSelectedPending(new Set());
                  }}
                  className="h-9 px-4 border border-border rounded-lg hover:bg-surface-2 font-semibold text-foreground transition-all cursor-pointer"
                >
                  Clear Preview
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportOpen(false)}
                    className="h-9 px-4 border border-border rounded-lg hover:bg-surface-2 font-semibold text-foreground transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitImport}
                    className="h-9 px-5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Import {selectedPending.size} Spaces
                  </button>
                </div>
              </footer>
            )}
          </div>
        </div>
      )}

      {/* Bulk Edit Modal Overlay */}
      {bulkEditOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md animate-scale-in font-sans">
            <header className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-[14px]">Bulk Edit Parameters</h3>
              <button
                onClick={() => setBulkEditOpen(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded-md p-1"
              >
                <X className="size-4" />
              </button>
            </header>
            
            <div className="p-5 flex flex-col gap-4 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Modify attributes for the {selected.size} selected spaces. Check the fields you want to update.
              </p>

              {/* Floor Field */}
              <div className="flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5">
                <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkEditFields.floor}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, floor: e.target.checked })}
                    className="rounded border-gray-300 text-primary size-3.5"
                  />
                  <span>Floor Level</span>
                </label>
                {bulkEditFields.floor && (
                  <input
                    type="text"
                    value={bulkEditValues.floor}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, floor: e.target.value })}
                    placeholder="e.g. 1F, GF"
                    className="h-8 px-2.5 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary mt-1"
                  />
                )}
              </div>

              {/* Space Type Field */}
              <div className="flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5">
                <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkEditFields.type}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, type: e.target.checked })}
                    className="rounded border-gray-300 text-primary size-3.5"
                  />
                  <span>Space Type / Heat Density</span>
                </label>
                {bulkEditFields.type && (
                  <select
                    value={bulkEditValues.type}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, type: e.target.value })}
                    className="h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary cursor-pointer mt-1"
                  >
                    <option value="" disabled>Select Space Type...</option>
                    {Object.keys(SPACE_DENSITIES).map(k => (
                      <option key={k} value={k}>{k} ({SPACE_DENSITIES[k]} W/m²)</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Area Field */}
              <div className="flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5">
                <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkEditFields.area}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, area: e.target.checked })}
                    className="rounded border-gray-300 text-primary size-3.5"
                  />
                  <span>Area (m²)</span>
                </label>
                {bulkEditFields.area && (
                  <input
                    type="number"
                    value={bulkEditValues.area}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, area: e.target.value })}
                    placeholder="e.g. 50"
                    className="h-8 px-2.5 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary mt-1"
                  />
                )}
              </div>
            </div>

            <footer className="px-5 py-3.5 border-t border-border bg-slate-50/50 dark:bg-slate-900/10 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setBulkEditOpen(false)}
                className="h-8 px-4 border border-border rounded-lg hover:bg-surface-2 text-xs font-semibold text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEditSave}
                className="h-8 px-4 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold rounded-lg shadow cursor-pointer"
              >
                Apply Changes
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Assign Comment & Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType={commentTargetItem.type}
          onSave={async (comment) => {
            try {
              const currentUserName = userData?.name || profile?.name || "Design Engineer";
              const userIds = comment.assignedUsers || [];

              // Attach comment to row state so visual comment badge appears
              saveRows(rows.map(r => r.id === commentTargetItem.id ? {
                ...r,
                comments: [...(r.comments || []), comment]
              } : r));

              if (userIds.length > 0) {
                for (const uId of userIds) {
                  try {
                    await api.sendNotification({
                      recipientId: uId,
                      title: `New Task Assigned on ${commentTargetItem.name}`,
                      message: `${currentUserName} assigned a task on space ${commentTargetItem.name}: "${comment.text}"`,
                      link: `/preliminary-cooling-load?commentTargetType=${commentTargetItem.type}&commentTargetId=${commentTargetItem.id}&commentTargetName=${encodeURIComponent(commentTargetItem.name)}`,
                      metadata: {
                        id: comment.id,
                        projectId: activeProjectId || project?.id,
                        calculatorPath: "/preliminary-cooling-load",
                        targetId: commentTargetItem.id,
                        targetName: commentTargetItem.name,
                        targetType: commentTargetItem.type,
                        authorName: currentUserName,
                        text: comment.text,
                        createdAt: comment.timestamp,
                      }
                    });
                  } catch(e) {
                    console.error("Failed to send notification to user", uId, e);
                  }
                }
                toast.success(`Task comment assigned to ${userIds.length} selected team member(s)!`);
              } else {
                toast.success(`Task comment recorded for space ${commentTargetItem.name}`);
              }
            } catch(e) {
              toast.success(`Task comment added for ${commentTargetItem.name}`);
            }
            setCommentModalOpen(false);
          }}
        />
      )}
    </AppShell>
  );
}

interface BulkBtnProps {
  icon: any;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function BulkBtn({ icon: Icon, onClick, children, disabled }: BulkBtnProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold text-slate-800 dark:text-slate-200 select-none shadow-xs transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}
