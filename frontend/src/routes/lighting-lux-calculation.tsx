import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, addPdfHeader } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { useState, useMemo, useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { useConfirm } from "@/hooks/use-confirm";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { 
  Plus, Download, Trash, Copy, Trash2, X, Database, FileText, FileSpreadsheet, 
  MessageSquare, Search, Filter, ArrowUpDown, Sparkles, Check, Sun, Edit3, Layers, Flag
} from "lucide-react";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent } from "@/components/ui/context-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;

export const Route = createFileRoute("/lighting-lux-calculation")({
  head: () => ({
    meta: [
      { title: "Lighting LUX Calculation — MEP Calc" },
      { name: "description", content: "Calculate Lighting LUX requirements" },
    ],
  }),
  component: LightingLuxCalculationPage,
});

interface LuxRow {
  id: string;
  location: string;
  lightType: string;
  ipRating: string;
  length: number;
  width: number;
  height: number;
  roomIndex: number;
  area: number;
  reqLux: number;
  lumen: number;
  mf: number;
  uf: number;
  reqQty: number;
  remarks: string;
  flagged?: boolean;
  comments?: any[];
}

interface LuxPreset {
  category: string;
  spaceType: string;
  standardLux: number;
  typicalLightType: string;
  ipRating: string;
  defaultMf: number;
  defaultUf: number;
  remarks: string;
}

const CIBSE_LUX_PRESETS: LuxPreset[] = [
  { category: "Offices", spaceType: "General Office / Open Workspace", standardLux: 500, typicalLightType: "LED Panel 600x600", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.65, remarks: "CIBSE LG7 / EN 12464-1 standard" },
  { category: "Offices", spaceType: "Executive / Manager Office", standardLux: 500, typicalLightType: "LED Panel 600x600", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.6, remarks: "Task lighting recommended" },
  { category: "Offices", spaceType: "Conference / Meeting Room", standardLux: 500, typicalLightType: "LED Downlight 20W", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.55, remarks: "Dimmable controls suggested" },
  { category: "Offices", spaceType: "Drawing / CAD / Technical Office", standardLux: 750, typicalLightType: "High CRI LED Panel", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.65, remarks: "High visual accuracy required" },
  { category: "Circulation", spaceType: "Corridors & Passageways", standardLux: 150, typicalLightType: "LED Downlight 12W", ipRating: "IP20", defaultMf: 0.75, defaultUf: 0.5, remarks: "Emergency lighting route" },
  { category: "Circulation", spaceType: "Stairways & Escalators", standardLux: 150, typicalLightType: "Linear LED Surface", ipRating: "IP44", defaultMf: 0.75, defaultUf: 0.5, remarks: "Uniform step illumination" },
  { category: "Circulation", spaceType: "Entrance Hall / Reception", standardLux: 300, typicalLightType: "Architectural LED Linear", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.6, remarks: "Feature lighting" },
  { category: "Services & Support", spaceType: "Pantry & Breakroom", standardLux: 300, typicalLightType: "LED Panel 300x1200", ipRating: "IP44", defaultMf: 0.75, defaultUf: 0.6, remarks: "Moisture resistant fitting" },
  { category: "Services & Support", spaceType: "Toilets & Restrooms", standardLux: 200, typicalLightType: "IP65 Waterproof LED", ipRating: "IP65", defaultMf: 0.75, defaultUf: 0.55, remarks: "Vapor & splash proof" },
  { category: "Services & Support", spaceType: "Server / IT Equipment Room", standardLux: 500, typicalLightType: "Linear LED Batten", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.65, remarks: "High illumination for maintenance" },
  { category: "Services & Support", spaceType: "Electrical / Mechanical Plant Room", standardLux: 200, typicalLightType: "IP65 LED Batten", ipRating: "IP65", defaultMf: 0.75, defaultUf: 0.55, remarks: "Industrial heavy duty" },
  { category: "Storage & Industrial", spaceType: "General Storage / Archive", standardLux: 100, typicalLightType: "LED Batten 40W", ipRating: "IP20", defaultMf: 0.75, defaultUf: 0.5, remarks: "Low occupancy space" },
  { category: "Storage & Industrial", spaceType: "Warehouse / Highbay Racking", standardLux: 300, typicalLightType: "LED Highbay 150W", ipRating: "IP65", defaultMf: 0.75, defaultUf: 0.65, remarks: "High ceiling mounting" }
];

// Helper to validate row inputs & auto-flag issues
function getLuxRowValidation(row: LuxRow) {
  const warnings: string[] = [];
  
  if (!row.location || !row.location.trim()) {
    warnings.push("Location name empty");
  }
  if (!row.length || row.length <= 0) {
    warnings.push("Length (L) missing/zero");
  }
  if (!row.width || row.width <= 0) {
    warnings.push("Width (W) missing/zero");
  }
  if (!row.reqLux || row.reqLux <= 0) {
    warnings.push("Req Lux (LL) missing/zero");
  }
  if (!row.lumen || row.lumen <= 0) {
    warnings.push("Lumen output 0");
  }
  
  const isAutoFlagged = warnings.length > 0;
  const isManuallyFlagged = Boolean(row.flagged);
  const isFlagged = isAutoFlagged || isManuallyFlagged;

  return { isAutoFlagged, isManuallyFlagged, isFlagged, warnings };
}

// Helper to compute calculated fields
function computeRowOutputs(row: LuxRow): LuxRow {
  const L = row.length || 0;
  const W = row.width || 0;
  const H = row.height || 0; // Mounting Height
  
  const area = L * W;
  let roomIndex = 0;
  if (H > 0 && (L + W) > 0) {
    roomIndex = (L * W) / (H * (L + W));
  }

  const LL = row.reqLux || 0;
  const lumen = row.lumen || 0;
  const mf = row.mf || 0;
  const uf = row.uf || 0;
  
  let reqQty = 0;
  if (lumen > 0 && mf > 0 && uf > 0) {
    reqQty = Math.ceil((LL * area) / (lumen * mf * uf));
  }

  return {
    ...row,
    area: parseFloat(area.toFixed(2)),
    roomIndex: parseFloat(roomIndex.toFixed(2)),
    reqQty: reqQty
  };
}

const DEFAULT_ROWS: LuxRow[] = [];

// Helper to push history state
function pushToHistory(
  current: LuxRow[], 
  history: LuxRow[][], 
  setHistory: React.Dispatch<React.SetStateAction<LuxRow[][]>>,
  setRedoStack?: React.Dispatch<React.SetStateAction<LuxRow[][]>>
) {
  const next = [...history, current].slice(-50); // Keep last 50 states
  setHistory(next);
  if (setRedoStack) {
    setRedoStack([]);
  }
}

function LightingLuxCalculationPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const confirm = useConfirm();

  const [rows, setRows] = useState<LuxRow[]>(DEFAULT_ROWS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeRowId, setActiveRowId] = useState<string | undefined>();
  const [history, setHistory] = useState<LuxRow[][]>([]);
  const [redoStack, setRedoStack] = useState<LuxRow[][]>([]);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [assignCommentOpen, setAssignCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string; type: 'space' | 'zone' | 'equipment' } | null>(null);

  // Search, Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterIpRating, setFilterIpRating] = useState<string>("all");
  const [filterMinLux, setFilterMinLux] = useState<number | null>(null);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<string>("default");

  // Presets Modal State
  const [autoLuxModalOpen, setAutoLuxModalOpen] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");

  useEffect(() => {
    if (!project?.id) return;
    try {
      const saved = localStorage.getItem(`mep_lux_calc_${project.id}`);
      if (saved) {
        setRows(JSON.parse(saved));
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error(e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      localStorage.setItem(`mep_lux_calc_${project.id}`, JSON.stringify(rows));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, rows]);

  // Helper to update a row
  const updateRow = (id: string, updates: Partial<LuxRow>) => {
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    // If the edited row is currently selected, and multiple are selected, apply to all
    const targetIds = (selected.has(id) && selected.size > 1) ? selected : new Set([id]);

    setRows(prev => prev.map(r => {
      if (!targetIds.has(r.id)) return r;
      const updated = { ...r, ...updates };
      return computeRowOutputs(updated);
    }));
  };

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const handleToggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isShift && lastSelectedId) {
        const lastIdx = rows.findIndex(r => r.id === lastSelectedId);
        const currentIdx = rows.findIndex(r => r.id === id);
        if (lastIdx !== -1 && currentIdx !== -1) {
          if (!isCtrl) next.clear();
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          for (let i = start; i <= end; i++) {
            next.add(rows[i].id);
          }
        }
      } else if (next.has(id)) {
        if (!isCtrl && !isShift && next.size > 1) {
          next.clear();
          next.add(id);
        } else {
          next.delete(id);
        }
      } else {
        if (!isCtrl && !isShift) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
    setActiveRowId(id);
  };

  const handleToggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map(r => r.id)));
    }
  };

  const addRow = () => {
    const newId = `lux_${Math.random().toString(36).slice(2, 9)}`;
    const newRow: LuxRow = {
      id: newId,
      location: "",
      lightType: "",
      ipRating: "IP20",
      length: 0,
      width: 0,
      height: 2.8,
      roomIndex: 0,
      area: 0,
      reqLux: 500,
      lumen: 3200,
      mf: 0.8,
      uf: 0.6,
      reqQty: 0,
      remarks: ""
    };
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, computeRowOutputs(newRow)]);
    setSelected(new Set([newId]));
    setActiveRowId(newId);
  };

  const loadDummyData = () => {
    const dummy: LuxRow[] = [
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Manager Office", lightType: "LED Panel 600x600", ipRating: "IP20", length: 5, width: 4, height: 2.8, roomIndex: 0, area: 0, reqLux: 500, lumen: 3200, mf: 0.8, uf: 0.6, reqQty: 0, remarks: "Task lighting required" },
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Open Workspace", lightType: "Linear LED Surface", ipRating: "IP20", length: 15, width: 10, height: 3.2, roomIndex: 0, area: 0, reqLux: 400, lumen: 4500, mf: 0.75, uf: 0.65, reqQty: 0, remarks: "" },
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Meeting Room A", lightType: "LED Downlight 20W", ipRating: "IP44", length: 6, width: 4.5, height: 2.7, roomIndex: 0, area: 0, reqLux: 500, lumen: 2000, mf: 0.8, uf: 0.55, reqQty: 0, remarks: "Dimmable" },
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Corridor", lightType: "LED Downlight 12W", ipRating: "IP20", length: 20, width: 2, height: 2.5, roomIndex: 0, area: 0, reqLux: 150, lumen: 1200, mf: 0.7, uf: 0.5, reqQty: 0, remarks: "" },
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Pantry", lightType: "LED Panel 300x1200", ipRating: "IP44", length: 4, width: 3, height: 2.6, roomIndex: 0, area: 0, reqLux: 300, lumen: 2800, mf: 0.75, uf: 0.6, reqQty: 0, remarks: "" }
    ];
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, ...dummy.map(computeRowOutputs)]);
    toast.success("Sample spaces loaded into calculation grid.");
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (await confirm(`Are you sure you want to delete ${selected.size} selected row(s)?`)) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
      setActiveRowId(undefined);
      toast.success(`${selected.size} space(s) deleted.`);
    }
  };

  const duplicateSelected = () => {
    if (selected.size === 0) return;
    pushToHistory(rows, history, setHistory, setRedoStack);
    const duplicated: LuxRow[] = [];
    rows.forEach(r => {
      if (selected.has(r.id)) {
        duplicated.push({
          ...r,
          id: `lux_dup_${Math.random().toString(36).slice(2, 9)}`,
          location: `${r.location} (Copy)`
        });
      }
    });
    setRows(prev => [...prev, ...duplicated]);
    toast.success(`${duplicated.length} space(s) duplicated.`);
  };

  const applyPresetToSpace = (preset: LuxPreset, applyToSelectedOnly: boolean = false) => {
    pushToHistory(rows, history, setHistory, setRedoStack);

    if (applyToSelectedOnly && selected.size > 0) {
      setRows(prev => prev.map(r => {
        if (selected.has(r.id)) {
          return computeRowOutputs({
            ...r,
            lightType: preset.typicalLightType,
            ipRating: preset.ipRating,
            reqLux: preset.standardLux,
            mf: preset.defaultMf,
            uf: preset.defaultUf,
            remarks: preset.remarks || r.remarks
          });
        }
        return r;
      }));
      toast.success(`Applied ${preset.standardLux} lx preset to ${selected.size} selected space(s).`);
    } else {
      const newId = `lux_${Math.random().toString(36).slice(2, 9)}`;
      const newRow: LuxRow = {
        id: newId,
        location: preset.spaceType,
        lightType: preset.typicalLightType,
        ipRating: preset.ipRating,
        length: 6,
        width: 4,
        height: 2.8,
        roomIndex: 0,
        area: 0,
        reqLux: preset.standardLux,
        lumen: 3200,
        mf: preset.defaultMf,
        uf: preset.defaultUf,
        reqQty: 0,
        remarks: preset.remarks
      };
      setRows(prev => [...prev, computeRowOutputs(newRow)]);
      setSelected(new Set([newId]));
      setActiveRowId(newId);
      toast.success(`Added new space with ${preset.standardLux} lx standard requirement.`);
    }
  };

  // Keyboard Navigation & Bulk Actions
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

      // Spreadsheet Arrow Key Navigation
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
        setSelected(new Set(rows.map(r => r.id)));
      }

      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (history.length > 0) {
          const prev = history[history.length - 1];
          setHistory(h => h.slice(0, h.length - 1));
          setRedoStack(r => [...r, rows]);
          setRows(prev);
        }
      }

      if (isCmdOrCtrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        if (redoStack.length > 0) {
          const nextState = redoStack[redoStack.length - 1];
          setRedoStack(r => r.slice(0, r.length - 1));
          setHistory(h => [...h, rows]);
          setRows(nextState);
        }
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        pushToHistory(rows, history, setHistory, setRedoStack);
        setRows(prev => prev.filter(r => !selected.has(r.id)));
        setSelected(new Set());
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_lux", JSON.stringify(toCopy));
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "x" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_lux", JSON.stringify(toCopy));
        pushToHistory(rows, history, setHistory, setRedoStack);
        setRows(prev => prev.filter(r => !selected.has(r.id)));
        setSelected(new Set());
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        try {
          const clip = localStorage.getItem("mep_clipboard_lux");
          if (clip) {
            const parsed = JSON.parse(clip) as LuxRow[];
            const pasted = parsed.map((item, i) => ({
              ...item,
              id: `lux_paste_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`,
              location: `${item.location} (Copy)`
            }));
            pushToHistory(rows, history, setHistory, setRedoStack);
            setRows(prev => [...prev, ...pasted]);
          }
        } catch (err) {}
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, history]);

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newRows: LuxRow[] = mappedRows.map((mr, idx) => ({
      id: `lux_import_${Date.now()}_${idx}`,
      location: mr.location || "",
      lightType: mr.lightType || "",
      ipRating: mr.ipRating || "IP20",
      length: Number(mr.length) || 0,
      width: Number(mr.width) || 0,
      height: Number(mr.height) || 2.8,
      roomIndex: 0,
      area: 0,
      reqLux: Number(mr.reqLux) || 500,
      lumen: Number(mr.lumen) || 3200,
      mf: Number(mr.mf) || 0.8,
      uf: Number(mr.uf) || 0.6,
      reqQty: 0,
      remarks: mr.remarks || ""
    }));
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, ...newRows.map(computeRowOutputs)]);
    toast.success(`Successfully imported ${newRows.length} rows from Excel.`);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Lighting Lux Calc");

    const projectCode = project?.code || "DEFAULT";
    const projectName = project?.name || "Untitled Project";

    // Project Info Block (Rows 1-3)
    worksheet.mergeCells("A1:I1");
    worksheet.mergeCells("J1:O1");
    worksheet.getCell("A1").value = "Calculation No: CEC-EED-PXXX-101   Rev. No:";
    worksheet.getCell("J1").value = "Date :";

    worksheet.mergeCells("A2:I2");
    worksheet.mergeCells("J2:O2");
    worksheet.getCell("A2").value = `Project No : ${projectCode}`;
    worksheet.getCell("J2").value = "Client :";

    worksheet.mergeCells("A3:I3");
    worksheet.mergeCells("J3:O3");
    worksheet.getCell("A3").value = `Project Name : ${projectName}`;
    worksheet.getCell("J3").value = "End User :";

    for (let r = 1; r <= 3; r++) {
      const row = worksheet.getRow(r);
      row.height = 22;
      for (let c = 1; c <= 15; c++) {
        const cell = worksheet.getCell(r, c);
        cell.font = { bold: true, name: "Arial", size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } }
        };
      }
    }

    const headers = [
      "Sr. No.", "Location", "Type of Light", "IP RATING", 
      "Length (L)\nmtr.", "Width (W)\nmtr.", "Height (H)\nmtr.", 
      "Room Index\n(RI)", "Area (A)m²", "Req.Lux\nLevel (LL)", 
      "Lumen", "Maintenance\nFactor (M.F)", "Utility Factor\n(U.F)", 
      "Req. Light\nQTY.", "Remarks"
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 35;
    
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" }
      };
      cell.font = { bold: true, name: "Arial", size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } }
      };
    });

    rows.forEach((r, i) => {
      const row = worksheet.addRow([
        i + 1,
        r.location,
        r.lightType,
        r.ipRating,
        r.length,
        r.width,
        r.height,
        r.roomIndex,
        r.area,
        r.reqLux,
        r.lumen,
        r.mf,
        r.uf,
        r.reqQty,
        r.remarks
      ]);

      row.eachCell((cell) => {
        cell.font = { name: "Arial", size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } }
        };
      });
    });

    let currentRow = worksheet.rowCount + 1;

    for (let r = 0; r < 3; r++) {
      const rIdx = currentRow + r;
      worksheet.getRow(rIdx).height = 20;
      for (let c = 1; c <= 15; c++) {
        worksheet.getCell(rIdx, c).border = {
          left: c === 1 ? { style: "thin", color: { argb: "000000" } } : undefined,
          right: c === 15 ? { style: "thin", color: { argb: "000000" } } : undefined,
          top: r === 0 ? { style: "thin", color: { argb: "000000" } } : undefined,
          bottom: r === 2 ? { style: "thin", color: { argb: "000000" } } : undefined
        };
      }
      worksheet.mergeCells(rIdx, 1, rIdx, 15);
    }
    
    worksheet.getCell(currentRow, 1).value = "  Reference: 1. Architectural Drawings";
    worksheet.getCell(currentRow + 1, 1).value = "                    2. DBR / CIBSE Code for Lighting";
    worksheet.getCell(currentRow + 2, 1).value = "                    3. Light Fitting / Lamp Photometric Data";
    
    for (let r = 0; r < 3; r++) {
       const cell = worksheet.getCell(currentRow + r, 1);
       cell.font = { name: "Arial", size: 9, bold: true };
       cell.alignment = { horizontal: "left", vertical: "middle" };
    }

    currentRow += 3;

    worksheet.getRow(currentRow).height = 25;
    const orangeFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFCD5B4" }
    } as ExcelJS.Fill;

    for(let c = 1; c <= 15; c++) {
        const cell = worksheet.getCell(currentRow, c);
        cell.fill = orangeFill;
        cell.border = {
            top: { style: "thin", color: { argb: "000000" } }, 
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } }, 
            right: { style: "thin", color: { argb: "000000" } }
        };
    }
    
    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    worksheet.mergeCells(currentRow, 4, currentRow, 7);
    worksheet.mergeCells(currentRow, 8, currentRow, 11);
    worksheet.mergeCells(currentRow, 12, currentRow, 15);

    const sigCol4 = worksheet.getCell(currentRow, 4);
    sigCol4.value = "Originator";
    const sigCol8 = worksheet.getCell(currentRow, 8);
    sigCol8.value = "Reviewer";
    const sigCol12 = worksheet.getCell(currentRow, 12);
    sigCol12.value = "Approver";

    [sigCol4, sigCol8, sigCol12].forEach(cell => {
      cell.font = { bold: true, name: "Arial", size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    currentRow += 1;

    const labels = ["Name:", "Signature:", "Date:"];
    labels.forEach((label) => {
      worksheet.getRow(currentRow).height = 25;
      
      for(let c = 1; c <= 15; c++) {
          worksheet.getCell(currentRow, c).border = {
              top: { style: "thin", color: { argb: "000000" } }, 
              left: { style: "thin", color: { argb: "000000" } },
              bottom: { style: "thin", color: { argb: "000000" } }, 
              right: { style: "thin", color: { argb: "000000" } }
          };
      }

      worksheet.mergeCells(currentRow, 1, currentRow, 3);
      worksheet.mergeCells(currentRow, 4, currentRow, 7);
      worksheet.mergeCells(currentRow, 8, currentRow, 11);
      worksheet.mergeCells(currentRow, 12, currentRow, 15);

      const cellA = worksheet.getCell(currentRow, 1);
      cellA.value = `  ${label}`;
      cellA.font = { name: "Arial", size: 10, bold: true };
      cellA.alignment = { horizontal: "left", vertical: "middle" };

      currentRow += 1;
    });

    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 25;
    worksheet.getColumn(3).width = 20;
    worksheet.getColumn(4).width = 12;
    worksheet.getColumn(5).width = 12;
    worksheet.getColumn(6).width = 12;
    worksheet.getColumn(7).width = 12;
    worksheet.getColumn(8).width = 12;
    worksheet.getColumn(9).width = 12;
    worksheet.getColumn(10).width = 12;
    worksheet.getColumn(11).width = 12;
    worksheet.getColumn(12).width = 14;
    worksheet.getColumn(13).width = 14;
    worksheet.getColumn(14).width = 12;
    worksheet.getColumn(15).width = 25;

    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "lighting-lux-calculation");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `LUX_Calculation_${projectCode}.xlsx`);
    toast.success("Exported Excel calculation report.");
  };

  const exportPdf = () => {
    const doc = new jsPDF("p", "mm", "a4");

    const projectCode = project?.code || "DEFAULT";
    const projectName = project?.name || "Untitled Project";

    const startY = addPdfHeader(doc, "LIGHTING LUX CALCULATION REPORT", {
      calcNo: "CEC-EED-PXXX-101",
      projectNo: projectCode,
      projectName: projectName,
    });

    const headers = [
      ["Sr.", "Location", "Type of Light", "IP Rating", "L(m)", "W(m)", "H(m)", "R.I", "Area(m²)", "Req. Lux", "Lumen", "M.F", "U.F", "Req. Qty", "Remarks"]
    ];

    const data = rows.map((r, i) => [
      i + 1,
      r.location || "-",
      r.lightType || "-",
      r.ipRating || "-",
      r.length || 0,
      r.width || 0,
      r.height || 0,
      r.roomIndex || 0,
      r.area || 0,
      r.reqLux || 0,
      r.lumen || 0,
      r.mf || 0,
      r.uf || 0,
      r.reqQty || 0,
      r.remarks || ""
    ]);

    autoTable(doc, {
      startY: startY + 4,
      head: headers,
      body: data,
      theme: "grid",
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
        halign: "center",
        valign: "middle"
      },
      bodyStyles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle"
      },
      styles: {
        cellPadding: 2,
        overflow: "linebreak"
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 20, halign: "left" },
        2: { cellWidth: 20, halign: "left" },
        3: { cellWidth: 12 },
        4: { cellWidth: 10 },
        5: { cellWidth: 10 },
        6: { cellWidth: 10 },
        7: { cellWidth: 10 },
        8: { cellWidth: 12 },
        9: { cellWidth: 12 },
        10: { cellWidth: 12 },
        11: { cellWidth: 10 },
        12: { cellWidth: 10 },
        13: { cellWidth: 12, fontStyle: "bold" },
        14: { cellWidth: 16, halign: "left" }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 150;

    addPdfSignatureBlock(doc, finalY + 5, currentUserName, project?.id || "default", "lighting-lux-calculation");

    doc.save(`LUX_Calculation_${projectCode}.pdf`);
    toast.success("Exported PDF calculation report.");
  };

  // Filtered & Sorted Rows computation
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.lightType && r.lightType.toLowerCase().includes(q)) ||
        (r.ipRating && r.ipRating.toLowerCase().includes(q)) ||
        (r.remarks && r.remarks.toLowerCase().includes(q))
      );
    }

    if (filterIpRating !== "all") {
      result = result.filter(r => (r.ipRating || "").toUpperCase() === filterIpRating.toUpperCase());
    }

    if (filterMinLux !== null && filterMinLux > 0) {
      result = result.filter(r => (r.reqLux || 0) >= filterMinLux);
    }

    if (filterFlaggedOnly) {
      result = result.filter(r => getLuxRowValidation(r).isFlagged);
    }

    if (sortKey === "location-asc") {
      result.sort((a, b) => (a.location || "").localeCompare(b.location || ""));
    } else if (sortKey === "location-desc") {
      result.sort((a, b) => (b.location || "").localeCompare(a.location || ""));
    } else if (sortKey === "area-desc") {
      result.sort((a, b) => (b.area || 0) - (a.area || 0));
    } else if (sortKey === "reqLux-desc") {
      result.sort((a, b) => (b.reqLux || 0) - (a.reqLux || 0));
    } else if (sortKey === "reqQty-desc") {
      result.sort((a, b) => (b.reqQty || 0) - (a.reqQty || 0));
    }

    return result;
  }, [rows, searchQuery, filterIpRating, filterMinLux, filterFlaggedOnly, sortKey]);

  const activeFiltersCount = (filterIpRating !== "all" ? 1 : 0) + (filterMinLux !== null ? 1 : 0) + (filterFlaggedOnly ? 1 : 0);

  const filteredPresets = useMemo(() => {
    if (!presetSearch.trim()) return CIBSE_LUX_PRESETS;
    const q = presetSearch.toLowerCase();
    return CIBSE_LUX_PRESETS.filter(p => 
      p.spaceType.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.typicalLightType.toLowerCase().includes(q) ||
      p.remarks.toLowerCase().includes(q)
    );
  }, [presetSearch]);

  const columns: Column<LuxRow>[] = useMemo(() => [
    {
      key: "id",
      header: "Sr. No.",
      width: 70,
      align: "center",
      render: (row) => {
        const index = rows.findIndex(r => r.id === row.id) + 1;
        return <span className="text-muted-foreground">{index}</span>;
      }
    },
    {
      key: "location",
      header: "Location",
      width: 160,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.location}
            onChange={(e) => updateRow(row.id, { location: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5 font-medium"
            autoComplete="off"
            placeholder="Space / Room Name"
            data-row-idx={rowIdx}
            data-col-idx={1}
          />
        );
      }
    },
    {
      key: "lightType",
      header: "Type of Light",
      width: 160,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.lightType}
            onChange={(e) => updateRow(row.id, { lightType: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
            autoComplete="off"
            placeholder="e.g. LED Panel"
            data-row-idx={rowIdx}
            data-col-idx={2}
          />
        );
      }
    },
    {
      key: "ipRating",
      header: "IP Rating",
      width: 100,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.ipRating}
            onChange={(e) => updateRow(row.id, { ipRating: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5 text-center"
            autoComplete="off"
            placeholder="IP20"
            data-row-idx={rowIdx}
            data-col-idx={3}
          />
        );
      }
    },
    {
      key: "length",
      header: "Length (L) m",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.length === 0 ? "" : row.length}
            onChange={(e) => updateRow(row.id, { length: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={4}
          />
        );
      }
    },
    {
      key: "width",
      header: "Width (W) m",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.width === 0 ? "" : row.width}
            onChange={(e) => updateRow(row.id, { width: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={5}
          />
        );
      }
    },
    {
      key: "height",
      header: "Height (H) m",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.height === 0 ? "" : row.height}
            onChange={(e) => updateRow(row.id, { height: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={6}
          />
        );
      }
    },
    {
      key: "roomIndex",
      header: "Room Index (RI)",
      width: 110,
      align: "right",
      render: (row) => <span className="text-blue-600 dark:text-blue-400 font-medium px-2">{row.roomIndex}</span>
    },
    {
      key: "area",
      header: "Area (m²)",
      width: 100,
      align: "right",
      render: (row) => <span className="font-medium px-2">{row.area}</span>
    },
    {
      key: "reqLux",
      header: "Req. Lux (LL)",
      width: 110,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.reqLux === 0 ? "" : row.reqLux}
            onChange={(e) => updateRow(row.id, { reqLux: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right font-medium text-amber-600 dark:text-amber-500 focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={9}
          />
        );
      }
    },
    {
      key: "lumen",
      header: "Lumen",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.lumen === 0 ? "" : row.lumen}
            onChange={(e) => updateRow(row.id, { lumen: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={10}
          />
        );
      }
    },
    {
      key: "mf",
      header: "M.F",
      width: 80,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.05"
            value={row.mf === 0 ? "" : row.mf}
            onChange={(e) => updateRow(row.id, { mf: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={11}
          />
        );
      }
    },
    {
      key: "uf",
      header: "U.F",
      width: 80,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.05"
            value={row.uf === 0 ? "" : row.uf}
            onChange={(e) => updateRow(row.id, { uf: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={12}
          />
        );
      }
    },
    {
      key: "reqQty",
      header: "Req. QTY",
      width: 90,
      align: "center",
      render: (row) => (
        <div className="h-full w-full flex items-center justify-center bg-green-500/10 text-green-700 dark:text-green-400 font-bold border-x border-green-500/20">
          {row.reqQty}
        </div>
      )
    },
    {
      key: "remarks",
      header: "Remarks",
      width: 200,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.remarks}
            onChange={(e) => updateRow(row.id, { remarks: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
            autoComplete="off"
            data-row-idx={rowIdx}
            data-col-idx={14}
          />
        );
      }
    },
    {
      key: "flagged",
      header: "Flag",
      width: 60,
      align: "center",
      render: (row) => {
        const { isAutoFlagged, isFlagged, warnings } = getLuxRowValidation(row);
        const tooltipText = isFlagged
          ? (isAutoFlagged ? `⚠️ Issue: ${warnings.join(", ")}` : "Flagged for engineering review")
          : "Flag space for review";

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const targetIds = (selected.has(row.id) && selected.size > 1) ? selected : new Set([row.id]);
              const nextFlag = !row.flagged;
              setRows(prev => prev.map(r => targetIds.has(r.id) ? { ...r, flagged: nextFlag } : r));
              if (nextFlag) toast.warning(`Flagged ${targetIds.size} space(s) for review`);
              else toast.info(`Unflagged ${targetIds.size} space(s)`);
            }}
            title={tooltipText}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              isFlagged
                ? (isAutoFlagged ? "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400" : "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400")
                : "text-muted-foreground/30 hover:text-foreground hover:bg-surface-2"
            }`}
          >
            <Flag className={`size-3.5 transition-all ${isFlagged ? "fill-current" : ""}`} />
          </button>
        );
      }
    }
  ], [rows]);

  const renderContextMenu = (row: LuxRow) => {
    return (
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={addRow}>
          <Plus className="size-4 mr-2" /> Add Space Row
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          if (selected.size > 0) duplicateSelected();
          else {
            const newRow = { ...row, id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: `${row.location} (Copy)` };
            pushToHistory(rows, history, setHistory, setRedoStack);
            setRows(prev => {
              const idx = prev.findIndex(r => r.id === row.id);
              const next = [...prev];
              next.splice(idx + 1, 0, computeRowOutputs(newRow));
              return next;
            });
          }
        }}>
          <Copy className="size-4 mr-2" /> Duplicate Row
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            if (row) {
              setCommentTarget({
                id: row.id,
                name: row.location || `Space Row ${rows.findIndex(r => r.id === row.id) + 1}`,
                type: 'space'
              });
              setAssignCommentOpen(true);
            }
          }}
          className="text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-4 mr-2" /> Add comment
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            const targetIds = (selected.has(row.id) && selected.size > 1) ? selected : new Set([row.id]);
            const nextFlag = !row.flagged;
            setRows(prev => prev.map(r => targetIds.has(r.id) ? { ...r, flagged: nextFlag } : r));
            if (nextFlag) toast.warning(`Flagged ${targetIds.size} space(s) for review`);
            else toast.info(`Unflagged ${targetIds.size} space(s)`);
          }}
          className="text-amber-600 dark:text-amber-400 font-medium"
        >
          <Flag className={`size-4 mr-2 ${getLuxRowValidation(row).isFlagged ? "fill-red-500 text-red-500" : ""}`} />
          {getLuxRowValidation(row).isFlagged ? "Unflag Space" : "Flag Space for Review"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => {
          if (selected.size > 0) deleteSelected();
          else {
            pushToHistory(rows, history, setHistory, setRedoStack);
            setRows(prev => prev.filter(r => r.id !== row.id));
            setSelected(prev => {
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
          }
        }} className="text-red-600 dark:text-red-400 focus:text-red-600">
          <Trash className="size-4 mr-2" /> Delete Row
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  return (
    <AppShell 
      title="Lighting LUX Calculation" 
      subtitle="Design and calculate lighting levels for different spaces"
    >
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        
        <div className="relative z-10 flex flex-col h-full w-full">
          
          {/* Action Toolbar Matching Space Management Layout */}
          <div className="relative flex items-center justify-between gap-2 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none">
            
            {/* Left Controls: Filter spaces search, Filter Popover, Sort Popover */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter spaces..."
                  className="h-7 w-56 pl-8 pr-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none text-foreground transition-all"
                />
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>

              {/* Filter Button & Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer ${
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
                <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border">
                    <span className="text-[12px] font-semibold text-foreground">Filter Spaces</span>
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={() => { setFilterIpRating("all"); setFilterMinLux(null); setFilterFlaggedOnly(false); }}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">IP Rating</span>
                    <select
                      value={filterIpRating}
                      onChange={(e) => setFilterIpRating(e.target.value)}
                      className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer text-foreground"
                    >
                      <option value="all">All IP Ratings</option>
                      <option value="IP20">IP20</option>
                      <option value="IP44">IP44</option>
                      <option value="IP65">IP65</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Min Required Lux (lx)</span>
                    <input
                      type="number"
                      placeholder="e.g. 300"
                      value={filterMinLux ?? ""}
                      onChange={(e) => setFilterMinLux(e.target.value ? Number(e.target.value) : null)}
                      className="h-8 w-full px-2.5 bg-surface-2 border border-border rounded-lg text-xs text-foreground outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1 pt-1.5 border-t border-border/60">
                    <label className="flex items-center gap-2 text-[11.5px] font-semibold text-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterFlaggedOnly}
                        onChange={(e) => setFilterFlaggedOnly(e.target.checked)}
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

              {/* Sort Button & Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer ${
                      sortKey !== "default"
                        ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                        : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                    title="Sort Spaces"
                  >
                    <ArrowUpDown className="size-3.5 shrink-0" />
                    {sortKey !== "default" && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                        ✓
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans z-50 text-xs">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-border">
                    <span className="text-[11.5px] font-semibold text-foreground">Sort Spaces</span>
                    {sortKey !== "default" && (
                      <button
                        onClick={() => setSortKey("default")}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setSortKey(sortKey === "location-asc" ? "default" : "location-asc")}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] transition-colors ${
                        sortKey === "location-asc" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>Location (A to Z)</span>
                      {sortKey === "location-asc" && <Check className="size-3.5" />}
                    </button>
                    <button
                      onClick={() => setSortKey(sortKey === "area-desc" ? "default" : "area-desc")}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] transition-colors ${
                        sortKey === "area-desc" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>Area (Largest First)</span>
                      {sortKey === "area-desc" && <Check className="size-3.5" />}
                    </button>
                    <button
                      onClick={() => setSortKey(sortKey === "reqLux-desc" ? "default" : "reqLux-desc")}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] transition-colors ${
                        sortKey === "reqLux-desc" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>Req. Lux (Highest First)</span>
                      {sortKey === "reqLux-desc" && <Check className="size-3.5" />}
                    </button>
                    <button
                      onClick={() => setSortKey(sortKey === "reqQty-desc" ? "default" : "reqQty-desc")}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] transition-colors ${
                        sortKey === "reqQty-desc" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>Req. Qty (Highest First)</span>
                      {sortKey === "reqQty-desc" && <Check className="size-3.5" />}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              <button 
                onClick={loadDummyData}
                className="flex items-center gap-1 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-full text-[11.5px] font-medium transition-colors ml-1"
                title="Load sample space data"
              >
                <Database className="size-3" /> Sample Data
              </button>
            </div>

            {/* Right Controls: Import, Export PDF, + New Space */}
            <div className="flex items-center gap-2">
              <ImportExcelBtn
                columnMapping={{
                  "Location": "location",
                  "Type of Light Fitting": "lightType",
                  "IP Rating": "ipRating",
                  "Length (L)": "length",
                  "Width (W)": "width",
                  "Height (H)": "height",
                  "Required Lux Level": "reqLux",
                  "Light Lumen": "lumen",
                  "MF": "mf",
                  "UF": "uf"
                }}
                onImport={handleImportExcelRows}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border border-border bg-background hover:bg-surface-2 text-foreground transition-all cursor-pointer shadow-2xs"
              />

              <button
                onClick={exportPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border border-border bg-background hover:bg-surface-2 text-foreground transition-all cursor-pointer shadow-2xs"
              >
                <FileText className="size-3.5" /> Export
              </button>

              <button
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-4 py-1 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="size-3.5" /> New Space
              </button>
            </div>

            {/* Floating Bulk Actions Overlay Bar */}
            {selected.size > 0 && (
              <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print backdrop-blur-md animate-in fade-in-50">
                <span className="font-semibold">{selected.size} space(s) selected</span>
                <span className="text-primary/30">•</span>
                <button
                  onClick={duplicateSelected}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/70 dark:bg-black/50 hover:bg-white dark:hover:bg-black/80 transition text-xs font-medium cursor-pointer shadow-2xs"
                >
                  <Copy className="size-3.5" /> Duplicate
                </button>
                <button
                  onClick={() => {
                    const anyUnflagged = rows.some(r => selected.has(r.id) && !r.flagged);
                    setRows(prev => prev.map(r => selected.has(r.id) ? { ...r, flagged: anyUnflagged } : r));
                    if (anyUnflagged) toast.warning(`Flagged ${selected.size} space(s) for review`);
                    else toast.info(`Unflagged ${selected.size} space(s)`);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/70 dark:bg-black/50 hover:bg-white dark:hover:bg-black/80 transition text-xs font-medium cursor-pointer shadow-2xs"
                >
                  <Flag className="size-3.5 text-red-500 fill-red-500" /> Flag / Unflag
                </button>
                <button
                  onClick={deleteSelected}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition text-xs font-medium cursor-pointer"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-xs font-medium cursor-pointer"
                >
                  <X className="size-3.5" /> Deselect All
                </button>
              </div>
            )}
          </div>


          
          {/* Main Grid Area */}
          <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
            {filteredAndSortedRows.length > 0 ? (
              <>
                <DataGrid
                  rows={filteredAndSortedRows}
                  columns={columns}
                  selected={selected}
                  onToggle={handleToggle}
                  onToggleAll={handleToggleAll}
                  renderContextMenu={renderContextMenu}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm">
                  <Plus className="size-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {rows.length === 0 ? "No calculation spaces added" : "No spaces match your filters"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  {rows.length === 0 
                    ? "Add a space row or use Auto-Zone to quickly load standard CIBSE/EN illuminance values." 
                    : "Try adjusting your search query or clear the active IP rating/Lux filters."}
                </p>
                <div className="flex items-center gap-2">
                  {rows.length === 0 ? (
                    <>
                      <button 
                        onClick={addRow}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-[12.5px] font-medium shadow-sm transition-all"
                      >
                        <Plus className="size-4" /> Add New Space
                      </button>
                      <button 
                        onClick={() => setAutoLuxModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-[12.5px] font-semibold transition-all"
                      >
                        <Sparkles className="size-4" /> Auto-Zone Presets
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => { setSearchQuery(""); setFilterIpRating("all"); setFilterMinLux(null); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-surface-2 hover:bg-surface-3 text-foreground rounded-full text-[12.5px] font-medium border border-border transition-all"
                    >
                      Clear Search & Filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* Auto-Lux / Standard Space Presets Modal */}
      {autoLuxModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in-50 zoom-in-95">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Sparkles className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Standard Space Lux Recommendations</h3>
                  <p className="text-[11px] text-muted-foreground">CIBSE Code for Lighting & EN 12464-1 Illuminance Standards</p>
                </div>
              </div>
              <button
                onClick={() => setAutoLuxModalOpen(false)}
                className="p-1 rounded-full hover:bg-border/60 text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Preset Filter Search */}
            <div className="p-3 border-b border-border bg-background flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search standard space (e.g. Office, Corridor, Toilet, Warehouse)..."
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Preset List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredPresets.map((preset, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <div className="flex flex-col gap-0.5 max-w-[62%]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                        {preset.category}
                      </span>
                      <span className="text-xs font-semibold text-foreground">{preset.spaceType}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Fitting: {preset.typicalLightType} ({preset.ipRating}) • M.F: {preset.defaultMf} • U.F: {preset.defaultUf}
                    </p>
                    {preset.remarks && <p className="text-[10.5px] text-amber-600 dark:text-amber-400 font-medium">{preset.remarks}</p>}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{preset.standardLux} lx</span>
                      <p className="text-[10px] text-muted-foreground">Standard Target</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => applyPresetToSpace(preset, false)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-2xs cursor-pointer"
                      >
                        + Add Space
                      </button>
                      {selected.size > 0 && (
                        <button
                          onClick={() => applyPresetToSpace(preset, true)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-full border border-border hover:bg-surface-2 transition cursor-pointer"
                          title={`Apply ${preset.standardLux} lx to ${selected.size} selected row(s)`}
                        >
                          Apply Selected ({selected.size})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-border bg-surface-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Click <b>+ Add Space</b> to insert a pre-configured space into your calculation.</span>
              <button
                onClick={() => setAutoLuxModalOpen(false)}
                className="px-3 py-1 bg-background border border-border rounded-md text-foreground font-medium hover:bg-surface-2 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Comment Modal Overlay */}
      {commentTarget && (
        <AssignCommentModal
          isOpen={assignCommentOpen}
          onClose={() => {
            setAssignCommentOpen(false);
            setCommentTarget(null);
          }}
          targetId={commentTarget.id}
          targetName={commentTarget.name}
          targetType={commentTarget.type}
          onSave={(newComment) => {
            pushToHistory(rows, history, setHistory, setRedoStack);
            setRows(prev => {
              const updated = prev.map(r => {
                if (r.id === commentTarget.id) {
                  const comments = [...(r.comments || []), newComment];
                  return { ...r, comments };
                }
                return r;
              });
              if (project?.id) {
                try {
                  localStorage.setItem(`mep_lux_calc_${project.id}`, JSON.stringify(updated));
                } catch(e) {}
              }
              return updated;
            });
            toast.success(`Comment assigned on "${commentTarget.name}"`);
            notifyCommentAssigned({
              comment: newComment,
              targetId: commentTarget.id,
              targetName: commentTarget.name,
              targetType: commentTarget.type || "Lux Space",
              calculatorTitle: "Lighting LUX Calculation",
              calculatorPath: "/lighting-lux-calculation",
              project,
              currentUserName: userData?.name || profile?.name,
              currentUserId: userData?.id || profile?.id
            }).catch(console.error);
          }}
        />
      )}
    </AppShell>
  );
}
