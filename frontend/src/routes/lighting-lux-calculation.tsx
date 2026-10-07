import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, addPdfHeader } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { useState, useMemo, useEffect, useRef } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { useConfirm } from "@/hooks/use-confirm";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { 
  Plus, Download, Trash, Copy, Trash2, X, FileText, FileSpreadsheet, 
  MessageSquare, Search, Filter, ArrowUpDown, Sparkles, Check, Sun, Edit3, Layers, Flag,
  Box, HelpCircle, Info, CheckCircle2, AlertTriangle, ArrowRight
} from "lucide-react";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { ImportSourceModal } from "@/components/workspace/ImportSourceModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent } from "@/components/ui/context-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { 
  type LuxRow, type LuxPreset, CIBSE_LUX_PRESETS, getLuxRowValidation, 
  computeRowOutputs, getCalculationPreview, convertBimSpaceToLuxRow 
} from "@/lib/calc-lighting-lux";
import { extractSpacesFromActiveViewer, extractSpacesFromIFCFile, type Extracted3DSpace } from "@/lib/bimViewerSpaceExtractor";
import { getProjectIfcFile } from "@/lib/projectIfcStorage";
import { DialuxSimulationModal, type ProjectSpaceItem } from "@/components/workspace/DialuxSimulationModal";
import { CalculationPreviewModal, type CalculationPreviewData, type CalculationStep } from "@/components/calculator-framework/CalculationPreviewModal";
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
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/lighting-lux-calculation", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/lighting-lux-calculation", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const isApprovedLocked = useCalculationLock("/lighting-lux-calculation", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const confirm = useConfirm();

  const [rows, setRows] = useState<LuxRow[]>(DEFAULT_ROWS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    if (shouldConvert) {
      setRows(prev => prev.map(r => {
        const isToIp = newSystem === "ip";
        const factor = isToIp ? 3.28084 : (1 / 3.28084);
        const luxFactor = isToIp ? (1 / 10.7639) : 10.7639;
        const updated: LuxRow = {
          ...r,
          length: r.length ? Number((r.length * factor).toFixed(2)) : r.length,
          width: r.width ? Number((r.width * factor).toFixed(2)) : r.width,
          height: r.height ? Number((r.height * factor).toFixed(2)) : r.height,
          reqLux: r.reqLux ? Math.round(r.reqLux * luxFactor) : r.reqLux,
        };
        return computeRowOutputs(updated);
      }));
    }
  };
  const [activeRowId, setActiveRowId] = useState<string | undefined>();
  const [history, setHistory] = useState<LuxRow[][]>([]);
  const [redoStack, setRedoStack] = useState<LuxRow[][]>([]);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [assignCommentOpen, setAssignCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string; type: 'space' | 'zone' | 'equipment' } | null>(null);
  const [previewRow, setPreviewRow] = useState<LuxRow | null>(null);
  const activePreviewRow = previewRow ? (rows.find(r => r.id === previewRow.id) || previewRow) : null;

  // Search, Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterIpRating, setFilterIpRating] = useState<string>("all");
  const [filterMinLux, setFilterMinLux] = useState<number | null>(null);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<string>("default");

  // Presets Modal State
  const [autoLuxModalOpen, setAutoLuxModalOpen] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");

  // DIALux evo 3D Simulation Modal State
  const [dialuxModalRow, setDialuxModalRow] = useState<LuxRow | null>(null);

  // Active IFC Model File Name (from BIM Viewer session, local storage, or project metadata)
  const activeIfcFileName = useMemo(() => {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("mep_active_bim_filename");
      if (stored && stored.trim()) return stored;
    }
    const win = typeof window !== "undefined" ? (window as any) : {};
    const winFile = win.__ACTIVE_IFC_FILE__ || win._currentLoadedFile;
    if (winFile?.name) return winFile.name;
    if (project?.name || project?.code) return `${project.name || project.code}.ifc`;
    return "Project_Building_Structure.ifc";
  }, [project]);

  // Convert current table rows to ProjectSpaceItem[] for DIALux evo multi-space navigation & full structure calculations
  const dialuxSpaces = useMemo<ProjectSpaceItem[]>(() => {
    return rows.map((r, idx) => ({
      id: r.id,
      name: r.location || `Space ${idx + 1}`,
      level: r.level || "Ground Floor",
      length: Number(r.length) || 5,
      width: Number(r.width) || 4,
      height: Number(r.height) || 2.8,
      targetLux: Number(r.reqLux) || 500,
      area: Number(r.area) || ((Number(r.length) || 5) * (Number(r.width) || 4)),
      initialQuantity: Number(r.reqQty) || 4,
      lightType: r.lightType || "LED Panel 600x600",
      mf: Number(r.mf) || 0.8,
      uf: Number(r.uf) || 0.6,
    }));
  }, [rows]);

  // 3-Source Automation & BIM IFC Integration States
  const ifcFileInputRef = useRef<HTMLInputElement>(null);
  const [showImportSourceModal, setShowImportSourceModal] = useState<boolean>(false);
  const [showSourcesInfoModal, setShowSourcesInfoModal] = useState<boolean>(false);

  const handleSyncFrom3DStudio = async (): Promise<boolean> => {
    try {
      toast.loading("Scanning 3D Studio for spaces & luminaires...", { id: "lux-3d-sync" });
      let extracted: Extracted3DSpace[] = extractSpacesFromActiveViewer();
      toast.dismiss("lux-3d-sync");

      // Fallback 1: Check project IFC file in IndexedDB storage
      if (extracted.length === 0) {
        const savedProjectFile = await getProjectIfcFile(activeProjectId || project?.id);
        if (savedProjectFile instanceof File) {
          toast.loading("Extracting 3D geometry & luminaires from project IFC model...", { id: "lux-ifc-parse" });
          extracted = await extractSpacesFromIFCFile(savedProjectFile);
          toast.dismiss("lux-ifc-parse");
        }
      }

      // Fallback 2: Check active memory window session file
      if (extracted.length === 0) {
        const win = typeof window !== "undefined" ? (window as any) : {};
        const savedFile = win.__ACTIVE_IFC_FILE__ || win._currentLoadedFile;
        if (savedFile instanceof File) {
          toast.loading("Extracting 3D geometry & luminaires from IFC model...", { id: "lux-ifc-parse" });
          extracted = await extractSpacesFromIFCFile(savedFile);
          toast.dismiss("lux-ifc-parse");
        }
      }

      if (extracted.length === 0) {
        setShowImportSourceModal(true);
        return false;
      }

      const newRows: LuxRow[] = extracted.map((sp, idx) => convertBimSpaceToLuxRow(sp, idx));
      
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(newRows);
      setSelected(new Set());
      setActiveRowId(undefined);

      toast.success(
        `✨ Synced ${newRows.length} spaces from 3D Studio! 13 columns generated from 3D Geometry + CIBSE Standards + Real-Time Engine.`,
        { duration: 5000 }
      );
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync spaces from 3D Studio.");
      return false;
    }
  };

  const handleIFCFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading(`Extracting 3D geometry & luminaires from "${file.name}"...`, { id: "lux-ifc-upload" });
      const extracted = await extractSpacesFromIFCFile(file);
      toast.dismiss("lux-ifc-upload");

      if (extracted.length === 0) {
        toast.error("No valid IFCSPACE elements found in the uploaded IFC file.");
        return;
      }

      const newRows: LuxRow[] = extracted.map((sp, idx) => convertBimSpaceToLuxRow(sp, idx));
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(newRows);
      setSelected(new Set());
      setActiveRowId(undefined);

      toast.success(
        `✨ Successfully imported ${newRows.length} spaces from "${file.name}" with full 3-Source automation!`
      );
    } catch (err) {
      toast.dismiss("lux-ifc-upload");
      console.error("IFC upload failed:", err);
      toast.error("Failed to parse IFC file.");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  useEffect(() => {
    if (!project?.id) return;
    try {
      const saved = localStorage.getItem(`mep_lux_calc_${project.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Auto-heal shifted columns or literal "undefined" remarks
          const sanitized = parsed.map((r, idx) => {
            let row = { ...r };
            if (row.remarks === "undefined" || !row.remarks) {
              row.remarks = "";
            }
            // Detect shifted columns (e.g. location empty and width is 2.8 and height is 500)
            if ((!row.location || row.location.trim() === "") && (row.width === 2.8 || row.height === 500)) {
              row.location = `Space ${idx + 1}`;
              row.lightType = row.lightType || "LED Panel 600x600";
              row.length = Number(row.length) > 0 ? Number(row.length) : 5;
              row.width = Number(row.width) > 0 && row.width !== 2.8 ? Number(row.width) : 4;
              row.height = 2.8;
              row.reqLux = 500;
              row.lumen = 3200;
              row.mf = 0.8;
              row.uf = 0.6;
            }
            if (!row.location || row.location.trim() === "") {
              row.location = `Space ${idx + 1}`;
            }
            if (!row.lightType || row.lightType.trim() === "") {
              row.lightType = "LED Panel 600x600";
            }
            return computeRowOutputs(row);
          });
          setRows(sanitized);
        }
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

    const isIp = unitSystem === "ip";
    const luxFactor = isIp ? (1 / 10.7639) : 1;
    const targetLux = isIp ? Math.round(preset.standardLux * luxFactor) : preset.standardLux;

    if (applyToSelectedOnly && selected.size > 0) {
      setRows(prev => prev.map(r => {
        if (selected.has(r.id)) {
          return computeRowOutputs({
            ...r,
            lightType: preset.typicalLightType,
            ipRating: preset.ipRating,
            reqLux: targetLux,
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
      const factor = isIp ? 3.28084 : 1;
      const newRow: LuxRow = {
        id: newId,
        location: preset.spaceType,
        lightType: preset.typicalLightType,
        ipRating: preset.ipRating,
        length: Number((6 * factor).toFixed(2)),
        width: Number((4 * factor).toFixed(2)),
        height: Number((2.8 * factor).toFixed(2)),
        roomIndex: 0,
        area: 0,
        reqLux: targetLux,
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
    const newRows: LuxRow[] = mappedRows.map((mr, idx) => {
      const cleanRemarks = String(mr.remarks || "").replace(/^undefined$/i, "").trim();
      const loc = String(mr.location || "").trim() || `Space ${rows.length + idx + 1}`;
      const light = String(mr.lightType || "").trim() || "LED Panel 600x600";
      return computeRowOutputs({
        id: `lux_import_${Date.now()}_${idx}`,
        location: loc,
        lightType: light,
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
        remarks: cleanRemarks
      });
    });
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, ...newRows]);
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
      result = result.filter(r => !!r.flagged);
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

  const handleOpenCommentModal = (row: LuxRow) => {
    setCommentTarget({
      id: row.id,
      name: row.location || `Space Row ${rows.findIndex(r => r.id === row.id) + 1}`,
      type: 'space'
    });
    setAssignCommentOpen(true);
  };

  const handleToggleFlag = (targetRowId?: string) => {
    const isSelected = targetRowId ? selected.has(targetRowId) : false;
    const targetIds = targetRowId
      ? (isSelected && selected.size > 1 ? Array.from(selected) : [targetRowId])
      : Array.from(selected);

    if (targetIds.length === 0) return;

    const firstRow = rows.find(r => r.id === targetIds[0]);
    const nextFlagged = !firstRow?.flagged;

    setRows(prev => prev.map(r => targetIds.includes(r.id) ? { ...r, flagged: nextFlagged } : r));
    toast.info(nextFlagged ? `Flagged ${targetIds.length} space(s) for review` : `Unflagged ${targetIds.length} space(s)`);
  };

  const columns: Column<LuxRow>[] = useMemo(() => [
    {
      key: "id",
      header: "Sr. No.",
      width: 50,
      align: "center",
      render: (row) => {
        const index = rows.findIndex(r => r.id === row.id) + 1;
        return (
          <span 
            onDoubleClick={() => setPreviewRow(row)} 
            className="text-muted-foreground cursor-pointer select-none hover:text-primary transition-colors font-mono text-xs"
            title="Double-click to open calculation preview"
          >
            {index}
          </span>
        );
      }
    },
    {
      key: "location",
      header: "Location",
      width: 155,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        const itemComments = getMergedItemComments(row.id, row.location, (row as any).comments, "/lighting-lux-calculation", project?.id);
        return (
          <div className="flex items-center gap-1.5 w-full min-w-0 h-full px-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDialuxModalRow(row);
              }}
              title="Launch DIALux evo 3D Photometric Simulation (False-Color Heatmap & Uniformity)"
              className="p-1 rounded hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 transition shrink-0 cursor-pointer"
            >
              <Sun className="size-3.5" />
            </button>
            {itemComments.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenCommentModal(row);
                }}
                title={`${itemComments.length} comment(s)/task(s) assigned`}
                className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <MessageSquare className="size-3.5 fill-blue-500/20" />
                <span className="text-[10px] font-bold">{itemComments.length}</span>
              </button>
            )}
            <input 
              value={row.location}
              onChange={(e) => updateRow(row.id, { location: e.target.value })}
              className="w-full min-w-0 h-full bg-transparent border-none outline-none px-1 focus:bg-primary/5 font-medium"
              autoComplete="off"
              placeholder="Space / Room Name"
              data-row-idx={rowIdx}
              data-col-idx={1}
            />
          </div>
        );
      }
    },
    {
      key: "lightType",
      header: "Type of Light",
      width: 130,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.lightType}
            onChange={(e) => updateRow(row.id, { lightType: e.target.value })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
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
      width: 75,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.ipRating}
            onChange={(e) => updateRow(row.id, { ipRating: e.target.value })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-1 focus:bg-primary/5 text-center"
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
      header: unitSystem === "ip" ? "Length (L) ft" : "Length (L) m",
      width: 75,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.length === 0 ? "" : row.length}
            onChange={(e) => updateRow(row.id, { length: parseFloat(e.target.value) || 0 })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={4}
          />
        );
      }
    },
    {
      key: "width",
      header: unitSystem === "ip" ? "Width (W) ft" : "Width (W) m",
      width: 75,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.width === 0 ? "" : row.width}
            onChange={(e) => updateRow(row.id, { width: parseFloat(e.target.value) || 0 })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={5}
          />
        );
      }
    },
    {
      key: "height",
      header: unitSystem === "ip" ? "Height (H) ft" : "Height (H) m",
      width: 75,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.height === 0 ? "" : row.height}
            onChange={(e) => updateRow(row.id, { height: parseFloat(e.target.value) || 0 })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={6}
          />
        );
      }
    },
    {
      key: "roomIndex",
      header: "Room Index\n(RI)",
      width: 75,
      align: "right",
      render: (row) => (
        <span 
          onDoubleClick={() => setPreviewRow(row)}
          className="text-blue-600 dark:text-blue-400 font-medium px-2 cursor-pointer hover:underline"
          title="Double-click to open calculation preview"
        >
          {row.roomIndex}
        </span>
      )
    },
    {
      key: "area",
      header: unitSystem === "ip" ? "Area (sq ft)" : "Area (m²)",
      width: 75,
      align: "right",
      render: (row) => (
        <span 
          onDoubleClick={() => setPreviewRow(row)}
          className="font-medium px-2 cursor-pointer hover:text-primary transition-colors"
          title="Double-click to open calculation preview"
        >
          {row.area}
        </span>
      )
    },
    {
      key: "reqLux",
      header: unitSystem === "ip" ? "Req. Illum\n(fc)" : "Req. Lux\n(LL)",
      width: 80,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.reqLux === 0 ? "" : row.reqLux}
            onChange={(e) => updateRow(row.id, { reqLux: parseFloat(e.target.value) || 0 })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-2 text-right font-medium text-amber-600 dark:text-amber-500 focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={9}
          />
        );
      }
    },
    {
      key: "lumen",
      header: "Lumen",
      width: 75,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.lumen === 0 ? "" : row.lumen}
            onChange={(e) => updateRow(row.id, { lumen: parseFloat(e.target.value) || 0 })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={10}
          />
        );
      }
    },
    {
      key: "mf",
      header: "M.F",
      width: 55,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.05"
            value={row.mf === 0 ? "" : row.mf}
            onChange={(e) => updateRow(row.id, { mf: parseFloat(e.target.value) || 0 })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-1 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={11}
          />
        );
      }
    },
    {
      key: "uf",
      header: "U.F",
      width: 55,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.05"
            value={row.uf === 0 ? "" : row.uf}
            onChange={(e) => updateRow(row.id, { uf: parseFloat(e.target.value) || 0 })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-1 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={12}
          />
        );
      }
    },
    {
      key: "reqQty",
      header: "Req. QTY",
      width: 75,
      align: "center",
      render: (row) => (
        <div 
          onDoubleClick={() => setPreviewRow(row)}
          className="h-full w-full flex items-center justify-center bg-green-500/10 text-green-700 dark:text-green-400 font-bold border-x border-green-500/20 cursor-pointer hover:bg-green-500/20 transition-colors"
          title="Double-click to open calculation preview"
        >
          {row.reqQty}
        </div>
      )
    },
    {
      key: "remarks",
      header: "Remarks",
      width: 130,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.remarks}
            onChange={(e) => updateRow(row.id, { remarks: e.target.value })}
            className="w-full min-w-0 h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
            autoComplete="off"
            data-row-idx={rowIdx}
            data-col-idx={14}
          />
        );
      }
    },
    {
      key: "flagged",
      header: "FLAG",
      width: 50,
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFlag(row.id);
            }}
            title={row.flagged ? "Flagged for engineering review (click to unflag)" : "Flag space for review"}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-center group/flag mx-auto"
          >
            <Flag
              className={`size-3.5 transition-transform ${
                row.flagged
                  ? "text-red-500 fill-red-500 scale-110"
                  : "text-muted-foreground/30 hover:text-red-500/60 group-hover/flag:scale-110"
              }`}
            />
          </button>
        </div>
      )
    }
  ], [rows, unitSystem, selected]);

  const renderContextMenu = (row: LuxRow) => {
    return (
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onClick={() => setPreviewRow(row)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-semibold text-primary"
        >
          <Sparkles className="size-3.5 text-primary" />
          <span>Calculation Preview</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => setDialuxModalRow(row)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-semibold text-indigo-400"
        >
          <Sun className="size-3.5 text-indigo-400" />
          <span>DIALux 3D Simulation</span>
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 border-t border-border" />
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
          onClick={() => handleToggleFlag(row.id)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Flag className={`size-3.5 ${row.flagged ? "text-red-500 fill-red-500" : ""}`} />
          <span className={row.flagged ? "text-red-600 dark:text-red-400 font-medium" : ""}>
            {selected.size > 1 && selected.has(row.id)
              ? (row.flagged ? `Unflag Selected (${selected.size})` : `Flag Selected (${selected.size})`)
              : (row.flagged ? "Unflag Space" : "Flag Space for Review")}
          </span>
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
      hideSubHeader={true}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">

          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-center shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Lighting LUX Calculation</h1>
                <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} {rows.length === 1 ? "space" : "spaces"}</span>
              </div>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/lighting-lux-calculation" calculatorTitle="Lighting LUX Calculation" />
            </div>

            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitToggle}
                ipLabel="IP"
                siLabel="SI"
                ipDescription="Imperial (IP) [Feet - ft, Foot-Candles - fc]"
                siDescription="Metric (SI) [Meters - m, Lux - lx]"
                conversionExample={
                  unitSystem === "si"
                    ? "Convert 500 Lux → 46.5 fc, 5 m → 16.4 ft"
                    : "Convert 46.5 fc → 500 Lux, 16.4 ft → 5 m"
                }
                disabled={isEffectiveReadOnly}
              />
            </div>
          </div>

          <div className={`flex-1 flex flex-col min-h-[450px] mb-6 overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
                ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
                : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30`}>
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
            </div>

            {/* Right Controls: 3 Sources, Sync 3D Studio, Import, Export PDF, + New Space */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={ifcFileInputRef}
                accept=".ifc"
                onChange={handleIFCFileUpload}
                className="hidden"
              />

              <button
                onClick={() => setShowSourcesInfoModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 transition-all cursor-pointer shadow-2xs"
                title="View the 3 Sources Behind Automation (3D Geometry + CIBSE + Real-Time Engine)"
              >
                <Sparkles className="size-3.5 text-purple-500" />
                <span className="hidden sm:inline">3 Sources</span>
              </button>

              <button
                onClick={handleSyncFrom3DStudio}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-all cursor-pointer shadow-2xs"
                title="Sync 13 columns automatically from 3D Studio IFC model"
              >
                <Box className="size-3.5" />
                <span>Sync 3D Studio</span>
              </button>

              <button
                onClick={async () => {
                  const targetRow = rows.find(r => selected.has(r.id)) || rows[0];
                  if (targetRow) {
                    setDialuxModalRow(targetRow);
                  } else {
                    const synced = await handleSyncFrom3DStudio();
                    if (!synced) {
                      const defaultRow: LuxRow = {
                        id: "lux_default",
                        location: "General Office",
                        lightType: "LED Panel 600x600",
                        ipRating: "IP20",
                        length: 6,
                        width: 4.5,
                        height: 2.8,
                        roomIndex: 1.5,
                        area: 27,
                        reqLux: 500,
                        lumen: 3200,
                        mf: 0.8,
                        uf: 0.6,
                        reqQty: 6,
                        remarks: "CIBSE LG7 / EN 12464-1 Standard",
                      };
                      setDialuxModalRow(defaultRow);
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-all cursor-pointer shadow-2xs"
                title="Open DIALux evo 3D Photometric Simulation (False-Color Heatmap, Isolux, U0 Uniformity)"
              >
                <Sun className="size-3.5 text-indigo-400" />
                <span>DIALux 3D Sim</span>
              </button>

              <ImportExcelBtn
                columnMapping={{
                  location: [
                    "Location", "Location Name", "Space", "Space Name", "Room", "Room Name",
                    "Description", "Area Name", "Name", "Zone", "Level / Space"
                  ],
                  lightType: [
                    "Type of Light", "Type of Light Fitting", "Light Type", "Luminaire",
                    "Fitting Type", "Fixture Type", "Lamp Type"
                  ],
                  ipRating: [
                    "IP Rating", "IP", "Ingress Protection", "Rating"
                  ],
                  length: [
                    "Length (L) mtr.", "Length (L) m", "Length (L)", "Length", "L (m)", "L(m)", "L"
                  ],
                  width: [
                    "Width (W) mtr.", "Width (W) m", "Width (W)", "Width", "W (m)", "W(m)", "W"
                  ],
                  height: [
                    "Height (H) mtr.", "Height (H) m", "Height (H)", "Height", "H (m)", "H(m)", "H", "Ceiling Height"
                  ],
                  reqLux: [
                    "Req.Lux Level (LL)", "Req. Lux Level", "Required Lux Level", "Req Lux", "Req. Lux",
                    "Required Lux", "Target Lux", "Lux Level", "Illuminance", "LL"
                  ],
                  lumen: [
                    "Lumen", "Light Lumen", "Lamp Lumen", "Lumens", "Output Lumen", "lm"
                  ],
                  mf: [
                    "Maintenance Factor (M.F)", "Maintenance Factor", "M.F", "MF", "Maintenance Factor (MF)"
                  ],
                  uf: [
                    "Utility Factor (U.F)", "Utility Factor", "Utilization Factor", "U.F", "UF"
                  ],
                  remarks: [
                    "Remarks", "Remark", "Notes", "Note", "Comments", "Comment"
                  ]
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
                  onClick={() => handleToggleFlag()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/70 dark:bg-black/50 hover:bg-white dark:hover:bg-black/80 transition text-xs font-medium cursor-pointer shadow-2xs text-red-600 dark:text-red-400"
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
                  gridId="lighting-lux-calc"
                  rows={filteredAndSortedRows}
                  columns={columns}
                  selected={selected}
                  onToggle={handleToggle}
                  onToggleAll={handleToggleAll}
                  onRowDoubleClick={(row) => setPreviewRow(row)}
                  rowClassName={(r) => r.flagged ? "bg-red-500/[0.04] dark:bg-red-500/[0.08]" : ""}
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
          calculatorTitle="Lighting LUX Calculation"
          calculatorPath="/lighting-lux-calculation"
          existingComments={getMergedItemComments(
            commentTarget.id,
            commentTarget.name,
            (rows.find(r => r.id === commentTarget.id) as any)?.comments,
            "/lighting-lux-calculation",
            project?.id
          )}
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

      {/* Step-by-Step Calculation Preview Modal */}
      <CalculationPreviewModal
        isOpen={Boolean(previewRow)}
        onClose={() => setPreviewRow(null)}
        data={activePreviewRow ? getCalculationPreview(activePreviewRow, unitSystem) : null}
      />

      {/* DIALux evo 3D Photometric Simulation Modal */}
      <DialuxSimulationModal
        isOpen={Boolean(dialuxModalRow)}
        onClose={() => setDialuxModalRow(null)}
        initialSpaceId={dialuxModalRow?.id}
        roomName={dialuxModalRow?.location || "Room"}
        length={dialuxModalRow?.length || 5}
        width={dialuxModalRow?.width || 4}
        height={dialuxModalRow?.height || 2.8}
        targetLux={dialuxModalRow?.reqLux || 500}
        initialQuantity={dialuxModalRow?.reqQty}
        mf={dialuxModalRow?.mf || 0.8}
        spaces={dialuxSpaces}
        ifcFileName={activeIfcFileName}
        projectName={project?.name || "MEP Project"}
        projectCode={project?.code || "PRJ-001"}
        userName={currentUserName}
        onApplyResults={(res) => {
          const targetId = res.spaceId || dialuxModalRow?.id;
          if (targetId) {
            updateRow(targetId, {
              reqQty: res.quantity,
              lightType: res.lightType,
              remarks: `DIALux 3D Sim: ${res.quantity} fixtures (${res.rows}x${res.cols}) - Achieved: ${res.achievedLux} lx, U0: ${res.uniformityU0}`,
            });
            if (dialuxModalRow && dialuxModalRow.id === targetId) {
              setDialuxModalRow((prev) => prev ? {
                ...prev,
                reqQty: res.quantity,
                lightType: res.lightType,
                remarks: `DIALux 3D Sim: ${res.quantity} fixtures (${res.rows}x${res.cols}) - Achieved: ${res.achievedLux} lx, U0: ${res.uniformityU0}`,
              } : null);
            }
          }
        }}
        onApplyAllProjectResults={(allResults) => {
          pushToHistory(rows, history, setHistory, setRedoStack);
          setRows((prev) => {
            const lookup = new Map(allResults.map((item) => [item.spaceId, item]));
            return prev.map((row) => {
              const match = lookup.get(row.id);
              if (match) {
                return {
                  ...row,
                  reqQty: match.quantity,
                  lightType: match.lightType,
                  remarks: `DIALux evo 3D Sim: ${match.quantity} fixtures (${match.rows}x${match.cols}) - ${match.achievedLux} lx, U0: ${match.uniformityU0}`,
                };
              }
              return row;
            });
          });
          toast.success(`✨ Successfully applied DIALux evo 3D results to all ${allResults.length} spaces!`);
        }}
      />

      {/* Import Source Modal (Excel / 3D Studio) */}
      <ImportSourceModal
        isOpen={showImportSourceModal}
        onClose={() => setShowImportSourceModal(false)}
        onSelectExcel={() => {
          document.querySelector<HTMLInputElement>('input[type="file"][accept*=".xlsx"]')?.click();
        }}
        onSelect3DViewer={handleSyncFrom3DStudio}
      />

      {/* 3 Sources Architecture Modal */}
      {showSourcesInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div 
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-1/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-foreground tracking-tight">The 3 Sources Behind the Automation</h2>
                  <p className="text-xs text-muted-foreground">The 13 columns are automatically generated from 3 distinct engineering sources</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSourcesInfoModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content: 3 Sources Cards */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Source 1: 3D IFC GEOMETRY */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.04] p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
                    <span className="flex items-center justify-center size-6 rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs">1</span>
                    <div>
                      <h3 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider">3D IFC GEOMETRY</h3>
                      <span className="text-[10px] text-muted-foreground">(Extracted by 3D Studio)</span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-xs">
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-blue-500"></span>
                      <span>Location (Space Name)</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-blue-500"></span>
                      <span>Length (L)</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-blue-500"></span>
                      <span>Width (W)</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-blue-500"></span>
                      <span>Height (H)</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-blue-500"></span>
                      <span>Area (m²)</span>
                    </li>
                  </ul>
                  <div className="mt-auto pt-2 border-t border-blue-500/15 text-[11px] text-muted-foreground">
                    Parsed from <code>IfcSpace</code> boundaries, base quantities, and coordinate geometry.
                  </div>
                </div>

                {/* Source 2: AI & CIBSE STANDARDS */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-amber-500/20">
                    <span className="flex items-center justify-center size-6 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs">2</span>
                    <div>
                      <h3 className="font-bold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">AI & CIBSE STANDARDS</h3>
                      <span className="text-[10px] text-muted-foreground">(Built-in MEP Presets)</span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-xs">
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-amber-500"></span>
                      <span>Type of Light</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-amber-500"></span>
                      <span>IP Rating</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-amber-500"></span>
                      <span>Req. Lux (LL)</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-amber-500"></span>
                      <span>Lumen Output</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-amber-500"></span>
                      <span>Maintenance Factor (MF)</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-amber-500"></span>
                      <span>Utilization Factor (UF)</span>
                    </li>
                  </ul>
                  <div className="mt-auto pt-2 border-t border-amber-500/15 text-[11px] text-muted-foreground">
                    Matched from room semantics using CIBSE Code for Lighting / EN 12464-1 standards.
                  </div>
                </div>

                {/* Source 3: REAL-TIME ENGINE */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20">
                    <span className="flex items-center justify-center size-6 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs">3</span>
                    <div>
                      <h3 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">REAL-TIME ENGINE</h3>
                      <span className="text-[10px] text-muted-foreground">(Automated Formulas)</span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-xs">
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      <span>Room Index (RI)</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      <span>Required Qty (Nos.)</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      <span>Actual Lux (Achieved)</span>
                    </li>
                    <li className="flex items-center gap-2 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      <span>Flag / Remarks</span>
                    </li>
                  </ul>
                  <div className="mt-auto pt-2 border-t border-emerald-500/15 text-[11px] text-muted-foreground">
                    Formula: N = ⌈ (LL × A) / (Lumen × MF × UF) ⌉. Auto-flags under-lit spaces in red.
                  </div>
                </div>
              </div>

              {/* 3D Fixture Audit & Flagging Notice */}
              <div className="rounded-xl border border-border bg-surface-2 p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                  <Info className="size-4" />
                </div>
                <div className="text-xs space-y-1">
                  <h4 className="font-semibold text-foreground">3D Fixture Comparison & Auto-Flagging</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    When importing an IFC model with <code>IfcLightFixture</code> elements, the engine compares installed fixtures against calculated required quantities. Under-lit spaces are automatically tagged with a <b>Red Flag</b> and a deficit warning in Remarks.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border bg-surface-1/50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">13 Columns • 3 Sources • 1-Click Sync</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowSourcesInfoModal(false);
                    handleSyncFrom3DStudio();
                  }}
                  className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Box className="size-3.5" />
                  Sync from 3D Studio Now
                </button>
                <button
                  onClick={() => setShowSourcesInfoModal(false)}
                  className="px-3 py-1.5 border border-border text-foreground text-xs font-medium rounded-lg hover:bg-surface-2 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
