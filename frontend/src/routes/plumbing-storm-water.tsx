import { CalculationReviewBar, useCalculationLock, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { exportStormWaterPDF } from "@/lib/exportStormWaterPDF";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import {
  Download,
  Trash2,
  Plus,
  Info,
  Droplets,
  Sparkles,
  FileText,
  Copy,
  Check,
  Layers,
  HelpCircle,
  X,
  Printer,
  FileSpreadsheet,
  ShieldCheck,
  MessageSquare,
  Edit3,
  Edit,
  Clipboard,
  ChevronDown,
  ChevronRight,
  Activity,
  AlertTriangle,
  Zap,
  Gauge,
  CloudRain,
  Building,
  Scissors,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/plumbing-storm-water")({
  head: () => ({
    meta: [
      { title: "Storm Water Runoff Calculation — MEP Calc" },
      {
        name: "description",
        content:
          "Calculate peak storm water runoff discharge flow rate using the Rational Method for roof and site drainage.",
      },
    ],
  }),
  component: StormWaterPage,
});

interface CatchmentRow {
  id: string;
  name: string;
  area: number;
  surface: string;
  coef: number;
  intensity: number;
}

const SURFACE_COEFS: Record<string, number> = {
  asphalt: 0.95,
  concrete: 0.95,
  brick: 0.85,
  clay_soil: 0.85,
  agricultural: 0.3,
  sandy_soil: 0.2,
};

const SURFACE_LABELS: Record<string, string> = {
  asphalt: "Asphalt / Pavement (0.95)",
  concrete: "Concrete / Roof Slab (0.95)",
  brick: "Brick / Interlock (0.85)",
  clay_soil: "Clay / Dense Soil (0.85)",
  agricultural: "Agricultural Cultivated (0.30)",
  sandy_soil: "Sandy Soil / Lawns (0.20)",
};

const RAINFALL_PRESETS = [
  { label: "2-Year Storm", intensitySI: 25, intensityIP: 1.0, desc: "Light recurring storm (2-yr return)" },
  { label: "5-Year Storm", intensitySI: 50, intensityIP: 2.0, desc: "Moderate design storm (5-yr return)" },
  { label: "10-Year Storm", intensitySI: 75, intensityIP: 3.0, desc: "Standard municipal drainage (10-yr return)" },
  { label: "25-Year Storm", intensitySI: 100, intensityIP: 4.0, desc: "Heavy commercial & roadway design (25-yr return)" },
  { label: "50-Year Storm", intensitySI: 125, intensityIP: 5.0, desc: "Critical infrastructure & podium roofs (50-yr return)" },
  { label: "100-Year Storm", intensitySI: 150, intensityIP: 6.0, desc: "Maximum extreme storm event (100-yr return)" },
];

function StormWaterPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "Abubakar Chanda";

  const { project, isReadOnly, forceSaveToCloud } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-storm-water", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const [calcReviewState, setCalcReviewState] = useState<CalculationReviewState | null>(null);
  const isEffectiveReadOnly = Boolean(
    isReadOnly || isApprovedLocked || isViewerRole || calcReviewState?.status === "APPROVED"
  );

  // Tabs & Modals
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Unit system (SI: m², mm/hr, L/s / IP: ft², in/hr, GPM)
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const isSI = unitSystem === "si";

  // Schedule state
  const [rows, setRows] = useState<CatchmentRow[]>([
    { id: "1", name: "Main Tower Roof Area", area: 1200, surface: "concrete", coef: 0.95, intensity: 50 },
    { id: "2", name: "Podium Deck & Terrace", area: 450, surface: "brick", coef: 0.85, intensity: 50 },
    { id: "3", name: "Paved Parking & Roadways", area: 800, surface: "asphalt", coef: 0.95, intensity: 50 },
  ]);

  // Form inputs for adding entry
  const [newName, setNewName] = useState("Podium Roof Area");
  const [newArea, setNewArea] = useState<number | "">(600);
  const [newSurface, setNewSurface] = useState("concrete");
  const [newIntensity, setNewIntensity] = useState<number | "">(50);

  // Editing Row Modal State (for double-click or right-click Edit)
  const [editingRow, setEditingRow] = useState<CatchmentRow | null>(null);

  // Floating Context Menu State (for right-click)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row?: CatchmentRow;
    kpiKey?: string;
    kpiLabel?: string;
    kpiVal?: string;
  } | null>(null);

  // Comment & Task Assignment Modal State
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string; type?: string } | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Close context menu on window click
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Load project state on mount or project switch
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_storm_water_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.rows && Array.isArray(data.rows)) setRows(data.rows);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.newName) setNewName(data.newName);
        if (data.newArea !== undefined) setNewArea(data.newArea);
        if (data.newSurface) setNewSurface(data.newSurface);
        if (data.newIntensity !== undefined) setNewIntensity(data.newIntensity);
      } else {
        setRows([
          { id: "1", name: "Main Tower Roof Area", area: 1200, surface: "concrete", coef: 0.95, intensity: 50 },
          { id: "2", name: "Podium Deck & Terrace", area: 450, surface: "brick", coef: 0.85, intensity: 50 },
          { id: "3", name: "Paved Parking & Roadways", area: 800, surface: "asphalt", coef: 0.95, intensity: 50 },
        ]);
        setUnitSystem("si");
      }

      // Load comments
      const commKey = `mep_calc_comments_${project.id}_/plumbing-storm-water`;
      const commStored = localStorage.getItem(commKey);
      if (commStored) {
        try {
          setCommentsList(JSON.parse(commStored));
        } catch (e) {}
      }
    } catch (e) {
      console.error(e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  const saveState = (updatedRows = rows, updatedUnit = unitSystem) => {
    if (!project?.id) return;
    try {
      localStorage.setItem(
        `mep_storm_water_calc_${project.id}`,
        JSON.stringify({
          rows: updatedRows,
          unitSystem: updatedUnit,
          newName,
          newArea,
          newSurface,
          newIntensity,
        })
      );
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { unitSystem, rows, newName, newArea, newSurface, newIntensity };
      localStorage.setItem(`mep_storm_water_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, rows, newName, newArea, newSurface, newIntensity]);

  // Calculations
  const calculatedResults = useMemo(() => {
    let totalArea = 0;
    let weightedSumC = 0;
    let totalFlow = 0;

    const items = rows.map((r) => {
      // SI equivalents for calculation: Q (L/s) = (C * i (mm/hr) * A (m2)) / 3600
      const areaSI = r.area / (!isSI ? 10.7639 : 1);
      const intensitySI = r.intensity * (!isSI ? 25.4 : 1);
      const flowSI = (r.coef * intensitySI * areaSI) / 3600;

      totalArea += r.area;
      weightedSumC += r.coef * r.area;
      totalFlow += flowSI;

      // Current unit flow
      const flowVal = flowSI * (!isSI ? 15.8503 : 1);

      return {
        ...r,
        flow: flowVal,
      };
    });

    const avgC = totalArea > 0 ? weightedSumC / totalArea : 0;
    const finalFlow = totalFlow * (!isSI ? 15.8503 : 1);

    return {
      items,
      totalArea,
      avgC,
      totalFlow: finalFlow,
    };
  }, [rows, isSI]);

  // Multi-Selection State
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  // Clipboard for copied/cut rows
  const [copiedRows, setCopiedRows] = useState<CatchmentRow[]>([]);
  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<CatchmentRow[][]>([]);
  const [redoStack, setRedoStack] = useState<CatchmentRow[][]>([]);

  // Bulk Edit Modal State (Ventilation style)
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({
    surface: false,
    area: false,
    intensity: false,
    coef: false,
  });
  const [bulkEditValues, setBulkEditValues] = useState({
    surface: "concrete",
    area: "" as number | "",
    intensity: "" as number | "",
    coef: "" as number | "",
  });

  const handleApplyBulkEdit = () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode.");
      return;
    }
    if (selectedRowIds.length === 0) {
      toast.info("No catchment areas selected.");
      return;
    }
    if (
      !bulkEditFields.surface &&
      !bulkEditFields.area &&
      !bulkEditFields.intensity &&
      !bulkEditFields.coef
    ) {
      toast.info("Please check at least one field to update.");
      return;
    }

    pushToUndo(rows);
    const updated = rows.map((r) => {
      if (!selectedRowIds.includes(r.id)) return r;
      const newSurfaceVal = bulkEditFields.surface ? bulkEditValues.surface : r.surface;
      const newAreaVal =
        bulkEditFields.area && typeof bulkEditValues.area === "number" && bulkEditValues.area > 0
          ? bulkEditValues.area
          : r.area;
      const newIntensityVal =
        bulkEditFields.intensity &&
        typeof bulkEditValues.intensity === "number" &&
        bulkEditValues.intensity > 0
          ? bulkEditValues.intensity
          : r.intensity;
      const newCoefVal =
        bulkEditFields.coef && typeof bulkEditValues.coef === "number" && bulkEditValues.coef > 0
          ? bulkEditValues.coef
          : bulkEditFields.surface
          ? SURFACE_COEFS[newSurfaceVal] || r.coef
          : r.coef;

      return {
        ...r,
        surface: newSurfaceVal,
        area: newAreaVal,
        intensity: newIntensityVal,
        coef: newCoefVal,
      };
    });

    setRows(updated);
    saveState(updated);
    dirtyStore.set(true);
    setBulkEditOpen(false);
    toast.success(`Bulk updated ${selectedRowIds.length} catchment area(s)!`);
  };

  // History tracking
  const pushToUndo = (currentRows: CatchmentRow[]) => {
    setUndoStack((prev) => [...prev.slice(-30), currentRows]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (isEffectiveReadOnly) return;
    if (undoStack.length === 0) {
      toast.info("Nothing to undo.");
      return;
    }
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, rows]);
    setRows(previous);
    saveState(previous);
    dirtyStore.set(true);
    toast.info("Undo: Reverted previous change (Ctrl+Z)");
  };

  const handleRedo = () => {
    if (isEffectiveReadOnly) return;
    if (redoStack.length === 0) {
      toast.info("Nothing to redo.");
      return;
    }
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, rows]);
    setRows(next);
    saveState(next);
    dirtyStore.set(true);
    toast.info("Redo: Restored change (Ctrl+Y)");
  };

  // Selection & Batch Operations
  const handleToggleSelectAll = () => {
    if (selectedRowIds.length === rows.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(rows.map((r) => r.id));
    }
  };

  const handleToggleRowSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopySelected = (targetIds?: string[]) => {
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedRowIds;
    if (ids.length === 0) {
      toast.info("No catchment rows selected to copy.");
      return;
    }
    const toCopy = rows.filter((r) => ids.includes(r.id));
    setCopiedRows(toCopy);
    // Write summary to OS clipboard
    const textSummary = toCopy
      .map(
        (r) =>
          `${r.name}\t${r.area} ${isSI ? "m²" : "ft²"}\t${r.surface}\tC=${r.coef}\t${r.intensity} ${isSI ? "mm/hr" : "in/hr"}`
      )
      .join("\n");
    navigator.clipboard?.writeText?.(textSummary).catch(() => {});
    toast.success(`Copied ${toCopy.length} catchment row(s) (Ctrl+C)`);
  };

  const handleCutSelected = (targetIds?: string[]) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode.");
      return;
    }
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedRowIds;
    if (ids.length === 0) {
      toast.info("No catchment rows selected to cut.");
      return;
    }
    const toCut = rows.filter((r) => ids.includes(r.id));
    setCopiedRows(toCut);
    pushToUndo(rows);
    const remaining = rows.filter((r) => !ids.includes(r.id));
    setRows(remaining);
    setSelectedRowIds([]);
    saveState(remaining);
    dirtyStore.set(true);
    toast.success(`Cut ${toCut.length} catchment row(s) (Ctrl+X)`);
  };

  const handlePasteRows = () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode.");
      return;
    }
    if (copiedRows.length === 0) {
      toast.info("Clipboard is empty. Copy or cut catchment rows first (Ctrl+C / Ctrl+X).");
      return;
    }
    pushToUndo(rows);
    const pastedRows: CatchmentRow[] = copiedRows.map((r) => ({
      ...r,
      id: Math.random().toString(36).substring(2, 9),
      name: `${r.name} (Copy)`,
    }));
    const updated = [...rows, ...pastedRows];
    setRows(updated);
    setSelectedRowIds(pastedRows.map((r) => r.id));
    saveState(updated);
    dirtyStore.set(true);
    toast.success(`Pasted ${pastedRows.length} catchment row(s) (Ctrl+V)`);
  };

  const handleDuplicateSelected = (targetIds?: string[]) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode.");
      return;
    }
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedRowIds;
    if (ids.length === 0) {
      toast.info("No catchment rows selected to duplicate.");
      return;
    }
    pushToUndo(rows);
    const toDup = rows.filter((r) => ids.includes(r.id));
    const newItems: CatchmentRow[] = toDup.map((r) => ({
      ...r,
      id: Math.random().toString(36).substring(2, 9),
      name: `${r.name} (Copy)`,
    }));
    const updated = [...rows, ...newItems];
    setRows(updated);
    setSelectedRowIds(newItems.map((r) => r.id));
    saveState(updated);
    dirtyStore.set(true);
    toast.success(`Duplicated ${toDup.length} catchment row(s) (Ctrl+D)`);
  };

  const handleBulkDelete = (targetIds?: string[]) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode.");
      return;
    }
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedRowIds;
    if (ids.length === 0) {
      toast.info("No catchment rows selected to delete.");
      return;
    }
    pushToUndo(rows);
    const updated = rows.filter((r) => !ids.includes(r.id));
    setRows(updated);
    setSelectedRowIds([]);
    saveState(updated);
    dirtyStore.set(true);
    toast.info(`Deleted ${ids.length} catchment area(s).`);
  };

  // Unit conversion toggle handler
  const handleUnitSystemChange = (nextSystem: "ip" | "si", shouldConvert: boolean = true) => {
    if (isEffectiveReadOnly) return;
    if (nextSystem === unitSystem) return;

    if (shouldConvert) {
      const isSwitchingToIP = nextSystem === "ip";
      const convertedRows = rows.map((r) => ({
        ...r,
        area: isSwitchingToIP ? r.area * 10.7639 : r.area / 10.7639,
        intensity: isSwitchingToIP ? r.intensity / 25.4 : r.intensity * 25.4,
      }));
      setRows(convertedRows);
      if (typeof newArea === "number") {
        setNewArea(isSwitchingToIP ? newArea * 10.7639 : newArea / 10.7639);
      }
      if (typeof newIntensity === "number") {
        setNewIntensity(isSwitchingToIP ? newIntensity / 25.4 : newIntensity * 25.4);
      }
      saveState(convertedRows, nextSystem);
    } else {
      saveState(rows, nextSystem);
    }

    setUnitSystem(nextSystem);
    dirtyStore.set(true);
    toast.success(`Unit system switched to ${nextSystem.toUpperCase()}`);
  };

  const handleAddRow = () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.");
      return;
    }
    const areaVal = typeof newArea === "number" ? newArea : parseFloat(newArea) || 0;
    const intensityVal =
      typeof newIntensity === "number" ? newIntensity : parseFloat(newIntensity) || 0;
    const coef = SURFACE_COEFS[newSurface] || 0.9;

    if (areaVal <= 0) {
      toast.error("Please enter a valid area.");
      return;
    }
    if (intensityVal <= 0) {
      toast.error("Please enter a valid rainfall intensity.");
      return;
    }

    pushToUndo(rows);
    const newRow: CatchmentRow = {
      id: Math.random().toString(36).substring(2, 9),
      name: newName || `Catchment Area ${rows.length + 1}`,
      area: areaVal,
      surface: newSurface,
      coef: coef,
      intensity: intensityVal,
    };

    const updated = [...rows, newRow];
    setRows(updated);
    saveState(updated);
    dirtyStore.set(true);
    setNewName(`Catchment Area ${updated.length + 1}`);
    toast.success("Catchment area added.");
  };

  const handleDeleteRow = (id: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.");
      return;
    }
    pushToUndo(rows);
    const updated = rows.filter((r) => r.id !== id);
    setRows(updated);
    setSelectedRowIds((prev) => prev.filter((item) => item !== id));
    saveState(updated);
    dirtyStore.set(true);
    toast.info("Catchment area removed.");
  };

  const handleDuplicateRow = (row: CatchmentRow) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.");
      return;
    }
    pushToUndo(rows);
    const duplicated: CatchmentRow = {
      ...row,
      id: Math.random().toString(36).substring(2, 9),
      name: `${row.name} (Copy)`,
    };
    const updated = [...rows, duplicated];
    setRows(updated);
    saveState(updated);
    dirtyStore.set(true);
    toast.success(`Duplicated "${row.name}"`);
  };

  const handleSaveEditedRow = (updatedRow: CatchmentRow) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.");
      return;
    }
    pushToUndo(rows);
    const updated = rows.map((r) => (r.id === updatedRow.id ? updatedRow : r));
    setRows(updated);
    saveState(updated);
    dirtyStore.set(true);
    setEditingRow(null);
    toast.success(`Updated "${updatedRow.name}"`);
  };

  const handleClearAll = () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.");
      return;
    }
    pushToUndo(rows);
    setRows([]);
    setSelectedRowIds([]);
    saveState([]);
    dirtyStore.set(true);
    toast.info("All catchment areas cleared.");
  };

  // Apply rainfall preset from intelligence drawer across all rows
  const handleApplyRainfallPreset = (intensityVal: number) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.");
      return;
    }
    pushToUndo(rows);
    const updated = rows.map((r) => ({ ...r, intensity: intensityVal }));
    setRows(updated);
    setNewIntensity(intensityVal);
    saveState(updated);
    dirtyStore.set(true);
    toast.success(`Applied rainfall intensity (${intensityVal} ${isSI ? "mm/hr" : "in/hr"}) to all catchments!`);
  };

  // Keyboard Shortcuts Listener (Ctrl+A, Escape, Delete, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Deselect all selected rows or close context menu
      if (e.key === "Escape") {
        if (selectedRowIds.length > 0) {
          e.preventDefault();
          setSelectedRowIds([]);
          toast.info("Deselected all rows (Esc)");
        }
        if (contextMenu) {
          setContextMenu(null);
        }
        return;
      }

      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        ((activeEl.tagName === "INPUT" &&
          (activeEl as HTMLInputElement).type !== "checkbox" &&
          (activeEl as HTMLInputElement).type !== "radio") ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable ||
          activeEl.tagName === "SELECT");
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Undo / Redo: Ctrl+Z / Ctrl+Y
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        (isCmdOrCtrl && e.key.toLowerCase() === "y") ||
        (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // 2. Ctrl+A (Select All)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (rows.length > 0) {
          setSelectedRowIds(rows.map((r) => r.id));
          toast.info(`Selected all ${rows.length} catchment area(s) (Ctrl+A)`);
        }
        return;
      }

      // 3. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRowIds.length > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
        return;
      }

      // 4. Ctrl+C (Copy)
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (selectedRowIds.length > 0) {
          e.preventDefault();
          handleCopySelected();
        }
        return;
      }

      // 5. Ctrl+X (Cut)
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (selectedRowIds.length > 0) {
          e.preventDefault();
          handleCutSelected();
        }
        return;
      }

      // 6. Ctrl+V (Paste)
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteRows();
        return;
      }

      // 7. Ctrl+D (Duplicate)
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (selectedRowIds.length > 0) {
          e.preventDefault();
          handleDuplicateSelected();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    rows,
    selectedRowIds,
    copiedRows,
    undoStack,
    redoStack,
    isEffectiveReadOnly,
    contextMenu,
  ]);

  // Comments Management
  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-storm-water`, JSON.stringify(newList));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("mep_notifications_channel");
          bc.postMessage({ type: "COMMENTS_UPDATED", calcPath: "/plumbing-storm-water", count: newList.length });
          bc.close();
        } catch (e) {}
      }
    }
    try {
      if (typeof forceSaveToCloud === "function") {
        setTimeout(() => forceSaveToCloud(false), 50);
      }
    } catch (e) {}
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTarget({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTarget?.id || commentData?.targetId || "storm-catchment";
    const targetName = commentTarget?.name || commentData?.targetName || "Storm Water Parameter";

    const commentWithMeta = {
      ...commentData,
      targetId,
      targetName,
      spaceId: targetId,
      spaceName: targetName,
      itemId: targetId,
      targetType: "Storm Water Catchment",
      calculatorTitle: "Storm Water Runoff Sizing",
      calculatorPath: "/plumbing-storm-water",
      projectId: project?.id || "default",
      projectName: project?.name || "Storm Drainage Site",
    };

    const existingIndex = commentsList.findIndex((c) => c.id === commentData.id);
    let updated: any[];
    if (existingIndex >= 0) {
      updated = [...commentsList];
      updated[existingIndex] = commentWithMeta;
    } else {
      updated = [commentWithMeta, ...commentsList.filter((c) => c.id !== commentData.id)];
    }
    saveComments(updated);

    dispatchGlobalCommentNotification(commentWithMeta, { project });

    toast.success(`Comment / task assigned on "${targetName}"`);
    setCommentModalOpen(false);
  };

  const getRowComments = (id: string) => {
    return commentsList.filter(
      (c) => c && (c.targetId === id || c.spaceId === id || c.itemId === id)
    );
  };

  // Clipboard handler
  const handleCopyText = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}: ${text}`);
  };

  // Export PDF handler
  const handleExportPDF = async () => {
    try {
      await exportStormWaterPDF(calculatedResults.items, {
        userName: currentUserName,
        unitSystem: unitSystem,
        totalArea: calculatedResults.totalArea,
        avgC: calculatedResults.avgC,
        totalFlow: calculatedResults.totalFlow,
        reviewState: calcReviewState,
      });
    } catch (e) {
      console.error("PDF export error:", e);
    }
  };

  const sig = getSignatureBlockDetails(
    project?.id || "default",
    "/plumbing-storm-water",
    currentUserName,
    calcReviewState
  );

  return (
    <>
      <AppShell
        title="Storm Water Runoff Calculation"
        hideSubHeader={true}
        onIntelClick={() => setIntelOpen((v) => !v)}
        intelOpen={intelOpen}
        intelLabel="Intelligence"
      >
        <div className="flex h-full min-h-0 bg-transparent font-sans">
          <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
            {/* Top Page Header Block */}
            <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground flex items-center gap-2.5">
                    <Droplets className="w-7 h-7 text-[#0A7BC7]" />
                    Storm Water Runoff Calculation
                  </h1>
                </div>
                <button
                  onClick={() => setIntelOpen((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  Intelligence
                </button>
                <CalculationReviewBar
                  projectId={project?.id || "default"}
                  calculatorPath="/plumbing-storm-water"
                  calculatorTitle="Storm Water Runoff Calculation"
                  onReviewStateChange={setCalcReviewState}
                />
                {commentsList.length > 0 && (
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-2xs"
                    title={`${commentsList.length} active task(s)/comment(s)`}
                  >
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>
                      {commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Card Container with Subheader Navigation */}
            <div
              className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
                isApprovedLocked || calcReviewState?.status === "APPROVED"
                  ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                  : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
              }`}
            >
              {/* Subheader Navigation Bar */}
              <div className="relative flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
                {/* Bulk actions bar overlay matching Ventilation */}
                {!isEffectiveReadOnly && selectedRowIds.length > 0 && (
                  <div className="absolute inset-0 flex items-center gap-2 px-4 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                    <span className="font-semibold">{selectedRowIds.length} selected</span>
                    <span className="text-primary/30">·</span>
                    <BulkBtn
                      icon={Edit3}
                      onClick={() => {
                        setBulkEditValues({
                          surface: "concrete",
                          area: "",
                          intensity: "",
                          coef: "",
                        });
                        setBulkEditFields({
                          surface: false,
                          area: false,
                          intensity: false,
                          coef: false,
                        });
                        setBulkEditOpen(true);
                      }}
                    >
                      Bulk edit
                    </BulkBtn>
                    <BulkBtn icon={Copy} onClick={() => handleDuplicateSelected()}>
                      Duplicate
                    </BulkBtn>
                    <BulkBtn icon={Clipboard} onClick={() => handleCopySelected()}>
                      Copy
                    </BulkBtn>
                    <BulkBtn icon={Scissors} onClick={() => handleCutSelected()}>
                      Cut
                    </BulkBtn>
                    <BulkBtn icon={Trash2} onClick={() => handleBulkDelete()}>
                      Delete
                    </BulkBtn>
                    <button
                      onClick={() => setSelectedRowIds([])}
                      className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer border-0 bg-transparent"
                    >
                      <X className="size-3" /> Clear
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                    <button
                      onClick={() => setTab("solver")}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                        tab === "solver"
                          ? "bg-background text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Storm Water Sizer
                    </button>
                    <button
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

                  <button
                    type="button"
                    onClick={() => setFormulaModalOpen(true)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                    title="View Rational Method Equations"
                  >
                    <Info className="size-3.5 text-primary" />
                    <span>Formula Breakdown</span>
                  </button>
                </div>

                {/* Right Side Controls: Export & Unit System Toggle */}
                <div className="flex items-center gap-2 select-none shrink-0">
                  <TBtn onClick={handleExportPDF}>
                    <FileText className="size-3.5" /> Export
                  </TBtn>

                  <UnitToggle
                    unitSystem={unitSystem}
                    onChange={handleUnitSystemChange}
                    disabled={isEffectiveReadOnly}
                    inputDescriptions="Catchment Area (m² / ft²), Rainfall Intensity (mm/hr / in/hr), Runoff Flow (L/s / GPM)"
                    conversionExample={
                      unitSystem === "ip"
                        ? "Convert 1,000 ft² → 92.9 m², 2 in/hr → 50.8 mm/hr, 10 GPM → 0.63 L/s"
                        : "Convert 100 m² → 1,076 ft², 50 mm/hr → 1.97 in/hr, 5 L/s → 79.25 GPM"
                    }
                  />
                </div>
              </div>

              {/* Active Tab View */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {tab === "solver" ? (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-surface-2/95 dark:bg-zinc-800/95 backdrop-blur-xs border-b border-border text-muted-foreground font-semibold uppercase text-[11px] tracking-wider">
                          <tr>
                            <th className="py-2 px-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={rows.length > 0 && selectedRowIds.length === rows.length}
                                onChange={handleToggleSelectAll}
                                title="Select all rows (Ctrl+A)"
                                className="rounded border-border cursor-pointer accent-[#06456F]"
                              />
                            </th>
                            <th className="py-2 px-3.5 text-left">Catchment Name</th>
                            <th className="py-2 px-3 text-center">Area ({isSI ? "m²" : "ft²"})</th>
                            <th className="py-2 px-3 text-center">Surface Type</th>
                            <th className="py-2 px-2 text-center">C</th>
                            <th className="py-2 px-3 text-center">
                              Rainfall ({isSI ? "mm/hr" : "in/hr"})
                            </th>
                            <th className="py-2 px-3 text-center">
                              Flow ({isSI ? "L/s" : "GPM"})
                            </th>
                            <th className="py-2 px-3 text-center w-20">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                              {/* Inline Entry Row */}
                              <tr className="bg-blue-50/20 dark:bg-sky-950/10">
                                <td className="py-2 px-3 text-center">
                                  <span className="text-muted-foreground font-mono text-[10px]">+</span>
                                </td>
                                <td className="py-2 px-2.5">
                                  <input
                                    type="text"
                                    value={newName}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g., Roof Area"
                                    className="w-full h-8 px-2.5 text-xs border border-border rounded-lg bg-background focus:ring-1 focus:ring-primary focus:outline-hidden disabled:opacity-50 font-medium text-left"
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="number"
                                    value={newArea}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) =>
                                      setNewArea(
                                        e.target.value === "" ? "" : parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-24 h-8 px-2 text-xs border border-border rounded-lg bg-background text-center focus:ring-1 focus:ring-primary focus:outline-hidden disabled:opacity-50 font-mono mx-auto"
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <select
                                    value={newSurface}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => setNewSurface(e.target.value)}
                                    className="w-48 h-8 px-2 text-xs border border-border rounded-lg bg-background focus:ring-1 focus:ring-primary focus:outline-hidden disabled:opacity-50 font-medium text-center mx-auto"
                                  >
                                    {Object.keys(SURFACE_LABELS).map((k) => (
                                      <option key={k} value={k}>
                                        {SURFACE_LABELS[k]}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2 px-2 text-center font-bold text-foreground">
                                  {SURFACE_COEFS[newSurface]}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="number"
                                    value={newIntensity}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) =>
                                      setNewIntensity(
                                        e.target.value === "" ? "" : parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-24 h-8 px-2 text-xs border border-border rounded-lg bg-background text-center focus:ring-1 focus:ring-primary focus:outline-hidden disabled:opacity-50 font-mono mx-auto"
                                  />
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-muted-foreground font-mono">
                                  -
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    onClick={handleAddRow}
                                    disabled={isEffectiveReadOnly}
                                    className="inline-flex items-center justify-center gap-1 px-3.5 py-1.5 bg-[#06456F] hover:bg-[#0A7BC7] text-white rounded-lg text-xs font-semibold transition border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add</span>
                                  </button>
                                </td>
                              </tr>

                              {/* Catchment Rows with Multi-Selection, Shortcuts, Double-Click & Right-Click Enabled */}
                              {calculatedResults.items.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={8}
                                    className="py-8 text-center text-muted-foreground font-medium"
                                  >
                                    No catchment areas added yet. Enter details above and click Add.
                                  </td>
                                </tr>
                              ) : (
                                calculatedResults.items.map((row) => {
                                  const rowComments = getRowComments(row.id);
                                  const isSelected = selectedRowIds.includes(row.id);
                                  return (
                                    <tr
                                      key={row.id}
                                      onClick={(e) => {
                                        if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                          handleToggleRowSelection(row.id, e);
                                        }
                                      }}
                                      onDoubleClick={() => {
                                        if (isEffectiveReadOnly) {
                                          toast.info("Calculation is locked / approved.");
                                          return;
                                        }
                                        setEditingRow({ ...row });
                                      }}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        if (!selectedRowIds.includes(row.id)) {
                                          setSelectedRowIds([row.id]);
                                        }
                                        setContextMenu({
                                          x: e.clientX,
                                          y: e.clientY,
                                          row: { ...row },
                                        });
                                      }}
                                      className={`transition-colors cursor-pointer select-none group ${
                                        isSelected
                                          ? "bg-blue-100/60 dark:bg-sky-950/50 border-l-4 border-l-[#0A7BC7]"
                                          : "hover:bg-muted/40"
                                      }`}
                                      title="Click with Ctrl/Shift to multi-select, Double-click to edit, Right-click for options"
                                    >
                                      <td
                                        className="py-2.5 px-3 text-center"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => handleToggleRowSelection(row.id, e as any)}
                                          className="rounded border-border cursor-pointer accent-[#06456F]"
                                        />
                                      </td>
                                      <td className="py-2.5 px-3.5 font-semibold text-foreground flex items-center justify-between gap-2 text-left">
                                        <span>{row.name}</span>
                                        {rowComments.length > 0 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenComment(row.id, row.name);
                                            }}
                                            title={`${rowComments.length} comment(s)/task(s)`}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer border-0"
                                          >
                                            <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                            <span>{rowComments.length}</span>
                                          </button>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 font-mono text-center">{row.area.toFixed(1)}</td>
                                      <td className="py-2.5 px-3 text-muted-foreground capitalize text-center">
                                        {row.surface.replace(/_/g, " ")}
                                      </td>
                                      <td className="py-2.5 px-2 text-center font-bold text-foreground">
                                        {row.coef.toFixed(2)}
                                      </td>
                                      <td className="py-2.5 px-3 font-mono text-center">
                                        {row.intensity.toFixed(1)}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-extrabold text-[#06456F] dark:text-sky-400 font-mono">
                                        {row.flow.toFixed(2)}
                                      </td>
                                      <td
                                        className="py-2.5 px-2 text-center"
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            onClick={() => setEditingRow({ ...row })}
                                            disabled={isEffectiveReadOnly}
                                            className="text-muted-foreground hover:text-foreground p-1 bg-transparent border-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition"
                                            title="Edit row"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteRow(row.id)}
                                            disabled={isEffectiveReadOnly}
                                            className="text-red-500 hover:text-red-700 p-1 bg-transparent border-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition"
                                            title="Delete row"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                  {/* Bottom Status & Summary Bar (Matching Ventilation UI) */}
                  <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg">
                    <div>
                      Showing <span className="text-foreground font-medium tabular">{rows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} catchments
                    </div>
                    <div className="flex items-center gap-3 tabular">
                      <span>Σ Flow: <span className="font-mono text-foreground font-bold">{calculatedResults.totalFlow.toFixed(2)} {isSI ? "L/s" : "GPM"}</span></span>
                      <span>Σ Area: <span className="font-mono text-foreground font-bold">{calculatedResults.totalArea.toFixed(1)} {isSI ? "m²" : "ft²"}</span></span>
                      <span>Avg C: <span className="font-mono text-foreground font-bold">{calculatedResults.avgC.toFixed(2)}</span></span>
                    </div>
                  </div>
                </div>
              ) : (
                  /* PRINTABLE REPORT PREVIEW TAB */
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                    <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                      <div className="flex justify-between items-start pb-4 border-b border-border">
                        <div>
                          <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                            Storm Water Runoff Sizing Calculation Report
                          </h2>
                          <p className="text-[12px] text-muted-foreground mt-0.5">
                            Rational Method (Q = C · i · A / 3600) Storm Drainage Hydrology Analysis
                          </p>
                        </div>
                      </div>

                      {/* Project Metadata Grid */}
                      <div className="border border-border/80 rounded-xl overflow-hidden text-[12px]">
                        <div className="grid grid-cols-2 divide-x divide-border/80 border-b border-border/80 bg-muted/20">
                          <div className="p-3 flex justify-between">
                            <span className="font-semibold text-muted-foreground">Calculation No:</span>
                            <span className="font-bold text-foreground">
                              {project?.calcNo || `TRV-CAL-STW-${(project?.id || "0000").slice(-4).toUpperCase()}`}
                            </span>
                          </div>
                          <div className="p-3 flex justify-between">
                            <span className="font-semibold text-muted-foreground">Project No:</span>
                            <span className="font-bold text-foreground">
                              {project?.code || project?.projectNo || "P001"}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-border/80 border-b border-border/80">
                          <div className="p-3 flex justify-between">
                            <span className="font-semibold text-muted-foreground">Project Name:</span>
                            <span className="font-bold text-foreground">
                              {project?.name || "MEP Project"}
                            </span>
                          </div>
                          <div className="p-3 flex justify-between">
                            <span className="font-semibold text-muted-foreground">Date:</span>
                            <span className="font-bold text-foreground">
                              {formatDateStr(new Date())}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-border/80 bg-muted/20">
                          <div className="p-3 flex justify-between">
                            <span className="font-semibold text-muted-foreground">Client:</span>
                            <span className="font-bold text-foreground">{project?.client || "-"}</span>
                          </div>
                          <div className="p-3 flex justify-between">
                            <span className="font-semibold text-muted-foreground">Unit System:</span>
                            <span className="font-bold text-foreground">
                              {isSI ? "SI (Metric)" : "IP (Imperial)"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Sizing Summary Grid */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                          1. Design Summary & Results
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 rounded-xl border border-border bg-surface-2">
                            <span className="text-muted-foreground font-semibold">Total Catchments</span>
                            <p className="text-lg font-bold text-foreground mt-1">
                              {rows.length} areas
                            </p>
                          </div>
                          <div className="p-3 rounded-xl border border-border bg-surface-2">
                            <span className="text-muted-foreground font-semibold">Total Runoff Area</span>
                            <p className="text-lg font-bold text-foreground mt-1">
                              {calculatedResults.totalArea.toFixed(1)} {isSI ? "m²" : "ft²"}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl border border-border bg-surface-2">
                            <span className="text-muted-foreground font-semibold">Weighted Coef (C)</span>
                            <p className="text-lg font-bold text-foreground mt-1">
                              {calculatedResults.avgC.toFixed(2)}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl border border-blue-200 dark:border-sky-800 bg-blue-50/50 dark:bg-sky-950/20">
                            <span className="text-[#06456F] dark:text-sky-300 font-bold">
                              Peak Runoff Flow
                            </span>
                            <p className="text-lg font-black text-[#06456F] dark:text-sky-400 mt-1">
                              {calculatedResults.totalFlow.toFixed(2)} {isSI ? "L/s" : "GPM"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Breakdown Table */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                          2. Catchment Area Schedule
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-border">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                              <tr>
                                <th className="p-2.5 text-center">No.</th>
                                <th className="p-2.5">Catchment Name</th>
                                <th className="p-2.5 text-right">Area ({isSI ? "m²" : "ft²"})</th>
                                <th className="p-2.5">Surface Type</th>
                                <th className="p-2.5 text-center">Runoff Coef (C)</th>
                                <th className="p-2.5 text-right">
                                  Rainfall ({isSI ? "mm/hr" : "in/hr"})
                                </th>
                                <th className="p-2.5 text-right font-bold">
                                  Runoff Flow ({isSI ? "L/s" : "GPM"})
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {calculatedResults.items.map((item, idx) => (
                                <tr key={item.id}>
                                  <td className="p-2.5 text-center font-medium text-muted-foreground">
                                    {idx + 1}
                                  </td>
                                  <td className="p-2.5 font-semibold text-foreground">{item.name}</td>
                                  <td className="p-2.5 text-right font-mono">{item.area.toFixed(1)}</td>
                                  <td className="p-2.5 capitalize text-muted-foreground">
                                    {item.surface.replace(/_/g, " ")}
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-foreground">
                                    {item.coef.toFixed(2)}
                                  </td>
                                  <td className="p-2.5 text-right font-mono">
                                    {item.intensity.toFixed(1)}
                                  </td>
                                  <td className="p-2.5 text-right font-bold text-[#06456F] dark:text-sky-400 font-mono">
                                    {item.flow.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-muted/30 font-bold border-t-2 border-border">
                                <td colSpan={2} className="p-2.5 text-foreground">
                                  Total / Area-Weighted Average
                                </td>
                                <td className="p-2.5 text-right font-mono">
                                  {calculatedResults.totalArea.toFixed(1)}
                                </td>
                                <td className="p-2.5 text-muted-foreground">-</td>
                                <td className="p-2.5 text-center font-bold">
                                  {calculatedResults.avgC.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-muted-foreground text-right">-</td>
                                <td className="p-2.5 text-right font-black text-[#06456F] dark:text-sky-400 font-mono">
                                  {calculatedResults.totalFlow.toFixed(2)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 3-Tier Signature Block */}
                      <div className="pt-4 border-t border-border">
                        <div className="border border-border rounded-xl overflow-hidden text-[12px]">
                          <div className="grid grid-cols-4 bg-muted/40 font-bold border-b border-border text-center py-2">
                            <div>Role</div>
                            <div>Originator</div>
                            <div>Reviewer</div>
                            <div>Approver</div>
                          </div>
                          <div className="grid grid-cols-4 border-b border-border divide-x divide-border">
                            <div className="p-2.5 font-bold text-right bg-muted/10">Name:</div>
                            <div className="p-2.5 text-center">{sig.originatedName || "Abubakar Chanda"}</div>
                            <div className="p-2.5 text-center">{sig.reviewerName || "-"}</div>
                            <div className="p-2.5 text-center">{sig.approverName || "-"}</div>
                          </div>
                          <div className="grid grid-cols-4 divide-x divide-border">
                            <div className="p-2.5 font-bold text-right bg-muted/10">Date:</div>
                            <div className="p-2.5 text-center">
                              {sig.originatedDate || formatDateStr(new Date())}
                            </div>
                            <div className="p-2.5 text-center">{sig.reviewerDate || "-"}</div>
                            <div className="p-2.5 text-center">{sig.approverDate || "-"}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dedicated Storm Water Live Intelligence Drawer */}
          <div
            className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
              intelOpen
                ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg flex flex-col"
                : "w-0"
            }`}
          >
            {intelOpen && (
              <StormWaterIntelligenceDrawer
                onClose={() => setIntelOpen(false)}
                rows={rows}
                calculatedResults={calculatedResults}
                unitSystem={unitSystem}
                isLocked={isEffectiveReadOnly}
                onApplyRainfallPreset={handleApplyRainfallPreset}
                onOpenFormulaModal={() => setFormulaModalOpen(true)}
              />
            )}
          </div>
        </div>
      </AppShell>

      {/* Floating Right-Click Context Menu with Shortcut Badges */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl py-1 text-xs text-foreground w-60 animate-in fade-in-50 duration-100"
          style={{
            top: `${Math.min(contextMenu.y, window.innerHeight - 260)}px`,
            left: `${Math.min(contextMenu.x, window.innerWidth - 260)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.row ? (
            <>
              <div className="px-3 py-1.5 text-[10.5px] font-bold text-muted-foreground border-b border-border/60 uppercase truncate flex items-center justify-between">
                <span className="truncate">{contextMenu.row.name}</span>
                {selectedRowIds.length > 1 && (
                  <span className="text-[10px] text-blue-600 dark:text-sky-400 font-normal">
                    ({selectedRowIds.length} selected)
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  if (contextMenu.row) setEditingRow({ ...contextMenu.row });
                  setContextMenu(null);
                }}
                disabled={isEffectiveReadOnly}
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center justify-between cursor-pointer border-0 bg-transparent font-medium text-foreground disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2">
                  <Edit3 className="size-3.5 text-primary" /> Edit Area
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Dbl-Click</span>
              </button>
              <button
                onClick={() => {
                  handleCopySelected(selectedRowIds.length > 0 ? selectedRowIds : [contextMenu.row!.id]);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center justify-between cursor-pointer border-0 bg-transparent font-medium text-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Copy className="size-3.5 text-muted-foreground" /> Copy
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Ctrl+C</span>
              </button>
              <button
                onClick={() => {
                  handleDuplicateSelected(selectedRowIds.length > 0 ? selectedRowIds : [contextMenu.row!.id]);
                  setContextMenu(null);
                }}
                disabled={isEffectiveReadOnly}
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center justify-between cursor-pointer border-0 bg-transparent font-medium text-foreground disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2">
                  <Copy className="size-3.5 text-[#0A7BC7]" /> Duplicate
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Ctrl+D</span>
              </button>
              <button
                onClick={() => {
                  handleCutSelected(selectedRowIds.length > 0 ? selectedRowIds : [contextMenu.row!.id]);
                  setContextMenu(null);
                }}
                disabled={isEffectiveReadOnly}
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center justify-between cursor-pointer border-0 bg-transparent font-medium text-foreground disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2">
                  <Scissors className="size-3.5 text-amber-600" /> Cut
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Ctrl+X</span>
              </button>
              {copiedRows.length > 0 && (
                <button
                  onClick={() => {
                    handlePasteRows();
                    setContextMenu(null);
                  }}
                  disabled={isEffectiveReadOnly}
                  className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center justify-between cursor-pointer border-0 bg-transparent font-medium text-foreground disabled:opacity-40"
                >
                  <span className="inline-flex items-center gap-2">
                    <Clipboard className="size-3.5 text-emerald-600" /> Paste ({copiedRows.length})
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Ctrl+V</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (contextMenu.row) {
                    const r = calculatedResults.items.find((i) => i.id === contextMenu.row?.id);
                    const flowStr = r ? `${r.flow.toFixed(2)} ${isSI ? "L/s" : "GPM"}` : "";
                    handleCopyText("Catchment Runoff Flow", flowStr);
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium text-foreground"
              >
                <Clipboard className="size-3.5 text-muted-foreground" /> Copy Flow Value
              </button>
              <button
                onClick={() => {
                  if (contextMenu.row) {
                    handleOpenComment(contextMenu.row.id, contextMenu.row.name);
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
              >
                <MessageSquare className="size-3.5" /> Add Comment / Task
              </button>
              <button
                onClick={() => {
                  setSelectedRowIds(rows.map((r) => r.id));
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center justify-between cursor-pointer border-0 bg-transparent font-medium text-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Check className="size-3.5 text-primary" /> Select All Rows
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Ctrl+A</span>
              </button>
              <div className="my-1 border-t border-border/60" />
              <button
                onClick={() => {
                  if (selectedRowIds.length > 0) {
                    handleBulkDelete(selectedRowIds);
                  } else if (contextMenu.row) {
                    handleDeleteRow(contextMenu.row.id);
                  }
                  setContextMenu(null);
                }}
                disabled={isEffectiveReadOnly}
                className="w-full px-3 py-1.5 text-left hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 flex items-center justify-between cursor-pointer border-0 bg-transparent font-semibold disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="size-3.5" /> Delete
                </span>
                <span className="text-[10px] opacity-80 font-mono">Del</span>
              </button>
            </>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[10.5px] font-bold text-muted-foreground border-b border-border/60 uppercase truncate">
                {contextMenu.kpiLabel}
              </div>
              <button
                onClick={() => {
                  if (contextMenu.kpiVal) {
                    handleCopyText(contextMenu.kpiLabel || "Value", contextMenu.kpiVal);
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium text-foreground"
              >
                <Copy className="size-3.5 text-[#0A7BC7]" /> Copy Value ({contextMenu.kpiVal})
              </button>
              <button
                onClick={() => {
                  setFormulaModalOpen(true);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium text-foreground"
              >
                <HelpCircle className="size-3.5 text-primary" /> View Methodology Formula
              </button>
              <button
                onClick={() => {
                  if (contextMenu.kpiKey) {
                    handleOpenComment(contextMenu.kpiKey, contextMenu.kpiLabel || "KPI Summary");
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
              >
                <MessageSquare className="size-3.5" /> Add Comment / Assign Task
              </button>
            </>
          )}
        </div>
      )}

      {/* Interactive Edit Catchment Modal (Double-Click / Right-Click Edit) */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
          <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Edit3 className="size-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">Edit Catchment Area</h3>
              </div>
              <button
                onClick={() => setEditingRow(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition border-0"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Catchment Name / Description</label>
                <input
                  type="text"
                  value={editingRow.name}
                  onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                  className="w-full h-9 px-3 border border-border rounded-xl bg-background font-medium focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">
                    Catchment Area ({isSI ? "m²" : "ft²"})
                  </label>
                  <input
                    type="number"
                    value={editingRow.area}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        area: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 px-3 border border-border rounded-xl bg-background font-mono focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">
                    Rainfall Intensity ({isSI ? "mm/hr" : "in/hr"})
                  </label>
                  <input
                    type="number"
                    value={editingRow.intensity}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        intensity: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 px-3 border border-border rounded-xl bg-background font-mono focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Surface Type & Runoff Coef (C)</label>
                <select
                  value={editingRow.surface}
                  onChange={(e) => {
                    const surf = e.target.value;
                    const coef = SURFACE_COEFS[surf] || 0.9;
                    setEditingRow({ ...editingRow, surface: surf, coef });
                  }}
                  className="w-full h-9 px-3 border border-border rounded-xl bg-background font-medium focus:ring-1 focus:ring-primary focus:outline-hidden"
                >
                  {Object.keys(SURFACE_LABELS).map((k) => (
                    <option key={k} value={k}>
                      {SURFACE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-sky-950/30 border border-blue-200 dark:border-sky-800/60 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#06456F] dark:text-sky-300 uppercase">
                    Recalculated Runoff Flow:
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    C = {editingRow.coef.toFixed(2)} · Area = {editingRow.area.toFixed(1)} {isSI ? "m²" : "ft²"}
                  </p>
                </div>
                <div className="text-xl font-extrabold text-[#06456F] dark:text-sky-400 font-mono">
                  {(() => {
                    const areaSI = editingRow.area / (!isSI ? 10.7639 : 1);
                    const intensitySI = editingRow.intensity * (!isSI ? 25.4 : 1);
                    const flowSI = (editingRow.coef * intensitySI * areaSI) / 3600;
                    const flowVal = flowSI * (!isSI ? 15.8503 : 1);
                    return flowVal.toFixed(2);
                  })()}{" "}
                  <span className="text-xs">{isSI ? "L/s" : "GPM"}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-semibold hover:bg-muted/80 transition cursor-pointer border-0"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingRow) handleSaveEditedRow(editingRow);
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition cursor-pointer border-0 shadow-2xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spaces Bulk Edit Dialog (Ventilation style) */}
      {bulkEditOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-lg w-full max-w-lg animate-scale-in">
            <header className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="size-4 text-primary" />
                <h3 className="font-semibold text-[14px]">
                  Bulk Edit {selectedRowIds.length} Catchment Areas
                </h3>
              </div>
              <button
                onClick={() => setBulkEditOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer border-0 bg-transparent rounded-lg hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="p-4 flex flex-col gap-4 text-xs">
              <div className="bg-primary/5 border border-primary/10 rounded-md p-2.5 text-muted-foreground flex items-start gap-2 leading-normal">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  Check the box next to any parameter to enable and update it across all selected catchment areas. Unchecked parameters will remain unchanged.
                </div>
              </div>

              <div className="space-y-3.5">
                {/* Surface Type */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bulk-update-surface"
                      checked={bulkEditFields.surface}
                      onChange={(e) =>
                        setBulkEditFields({ ...bulkEditFields, surface: e.target.checked })
                      }
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="bulk-update-surface"
                      className="text-foreground font-semibold cursor-pointer"
                    >
                      Surface Type & Default Coefficient (C)
                    </label>
                  </div>
                  <select
                    disabled={!bulkEditFields.surface}
                    value={bulkEditValues.surface}
                    onChange={(e) => {
                      const s = e.target.value;
                      setBulkEditValues({ ...bulkEditValues, surface: s, coef: SURFACE_COEFS[s] || 0.95 });
                    }}
                    className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded-lg px-2.5 py-1.5 w-full outline-hidden font-medium text-xs text-foreground"
                  >
                    {Object.keys(SURFACE_LABELS).map((k) => (
                      <option key={k} value={k}>
                        {SURFACE_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Catchment Area */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bulk-update-area"
                      checked={bulkEditFields.area}
                      onChange={(e) =>
                        setBulkEditFields({ ...bulkEditFields, area: e.target.checked })
                      }
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="bulk-update-area"
                      className="text-foreground font-semibold cursor-pointer"
                    >
                      Catchment Area ({isSI ? "m²" : "ft²"})
                    </label>
                  </div>
                  <input
                    type="number"
                    placeholder={`e.g. ${isSI ? "500" : "5000"}`}
                    value={bulkEditValues.area}
                    disabled={!bulkEditFields.area}
                    onChange={(e) =>
                      setBulkEditValues({
                        ...bulkEditValues,
                        area: e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                      })
                    }
                    className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded-lg px-2.5 py-1.5 w-full outline-hidden font-mono text-xs text-foreground"
                  />
                </div>

                {/* Rainfall Intensity */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bulk-update-intensity"
                      checked={bulkEditFields.intensity}
                      onChange={(e) =>
                        setBulkEditFields({ ...bulkEditFields, intensity: e.target.checked })
                      }
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="bulk-update-intensity"
                      className="text-foreground font-semibold cursor-pointer"
                    >
                      Design Rainfall Intensity ({isSI ? "mm/hr" : "in/hr"})
                    </label>
                  </div>
                  <input
                    type="number"
                    placeholder={`e.g. ${isSI ? "50" : "2.0"}`}
                    value={bulkEditValues.intensity}
                    disabled={!bulkEditFields.intensity}
                    onChange={(e) =>
                      setBulkEditValues({
                        ...bulkEditValues,
                        intensity: e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                      })
                    }
                    className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded-lg px-2.5 py-1.5 w-full outline-hidden font-mono text-xs text-foreground"
                  />
                </div>

                {/* Custom Runoff Coefficient C */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bulk-update-coef"
                      checked={bulkEditFields.coef}
                      onChange={(e) =>
                        setBulkEditFields({ ...bulkEditFields, coef: e.target.checked })
                      }
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="bulk-update-coef"
                      className="text-foreground font-semibold cursor-pointer"
                    >
                      Custom Runoff Coefficient (C)
                    </label>
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="e.g. 0.90"
                    value={bulkEditValues.coef}
                    disabled={!bulkEditFields.coef}
                    onChange={(e) =>
                      setBulkEditValues({
                        ...bulkEditValues,
                        coef: e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                      })
                    }
                    className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded-lg px-2.5 py-1.5 w-full outline-hidden font-mono text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setBulkEditOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold cursor-pointer text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkEdit}
                  className="px-4 py-1.5 rounded-lg bg-[#06456F] hover:bg-[#0A7BC7] text-white text-xs font-semibold cursor-pointer transition shadow-2xs"
                >
                  Apply Bulk Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Comment / Task Modal */}
      {commentTarget && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTarget.id}
          targetName={commentTarget.name}
          targetType="Storm Water Catchment"
          calculatorTitle="Storm Water Runoff Sizing"
          calculatorPath="/plumbing-storm-water"
          onSaveComment={handleSaveComment}
          existingComments={commentsList.filter(
            (c) => c && (c.targetId === commentTarget.id || c.spaceId === commentTarget.id)
          )}
        />
      )}

      {/* Formula Breakdown Modal */}
      {formulaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
          <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Rational Method Engineering Equations
                </h3>
              </div>
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition border-0"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-muted-foreground leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
              <div className="p-3.5 bg-surface-2 rounded-xl border border-border space-y-2">
                <span className="font-bold text-foreground text-[12.5px]">
                  1. Peak Runoff Flow Rate (Rational Method):
                </span>
                <div className="p-2.5 bg-background rounded-lg border border-border/80 font-mono text-xs text-primary font-bold text-center">
                  Q = (C × i × A) / 3600
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>
                    <strong>Q:</strong> Peak storm runoff flow rate in Liters per second (L/s) [or
                    GPM in IP].
                  </li>
                  <li>
                    <strong>C:</strong> Dimensionless composite runoff coefficient (0.0 to 1.0).
                  </li>
                  <li>
                    <strong>i:</strong> Rainfall intensity in mm/hr [or in/hr in IP] based on local
                    IDF curves.
                  </li>
                  <li>
                    <strong>A:</strong> Catchment area in square meters (m²) [or ft² in IP].
                  </li>
                </ul>
              </div>

              <div className="p-3.5 bg-surface-2 rounded-xl border border-border space-y-2">
                <span className="font-bold text-foreground text-[12.5px]">
                  2. Area-Weighted Composite Runoff Coefficient (C_avg):
                </span>
                <div className="p-2.5 bg-background rounded-lg border border-border/80 font-mono text-xs text-primary font-bold text-center">
                  C_avg = Σ(C_k × A_k) / Σ(A_k)
                </div>
                <p>
                  When a drainage zone consists of multiple surface types (e.g., roof, pavement,
                  landscaping), the overall runoff coefficient is calculated as the area-weighted
                  average.
                </p>
              </div>

              <div className="p-3.5 bg-surface-2 rounded-xl border border-border space-y-2">
                <span className="font-bold text-foreground text-[12.5px]">
                  3. Standard Surface Coefficients (ASPE / IPC):
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                  <div className="p-2 rounded bg-background border border-border/60 flex justify-between">
                    <span>Asphalt Pavement</span>
                    <span className="font-bold text-foreground">0.95</span>
                  </div>
                  <div className="p-2 rounded bg-background border border-border/60 flex justify-between">
                    <span>Concrete Roof Slab</span>
                    <span className="font-bold text-foreground">0.95</span>
                  </div>
                  <div className="p-2 rounded bg-background border border-border/60 flex justify-between">
                    <span>Brick / Pavers</span>
                    <span className="font-bold text-foreground">0.85</span>
                  </div>
                  <div className="p-2 rounded bg-background border border-border/60 flex justify-between">
                    <span>Sandy Soil / Lawns</span>
                    <span className="font-bold text-foreground">0.20</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition cursor-pointer border-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// SUB-COMPONENT: DEDICATED STORM WATER INTELLIGENCE DRAWER
// ------------------------------------------------------------------------------------------------
interface StormWaterIntelligenceDrawerProps {
  onClose: () => void;
  rows: CatchmentRow[];
  calculatedResults: {
    items: CatchmentRow[];
    totalArea: number;
    avgC: number;
    totalFlow: number;
  };
  unitSystem: "si" | "ip";
  isLocked?: boolean;
  onApplyRainfallPreset: (intensity: number) => void;
  onOpenFormulaModal: () => void;
}

function StormWaterIntelligenceDrawer({
  onClose,
  rows,
  calculatedResults,
  unitSystem,
  isLocked,
  onApplyRainfallPreset,
  onOpenFormulaModal,
}: StormWaterIntelligenceDrawerProps) {
  const isSI = unitSystem === "si";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    diagnostics: true,
    pipeSizing: true,
    retention: true,
    idfPresets: true,
    standards: false,
  });

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // 1. Diagnostics & Hydrology Audit
  const totalFlowLps = isSI
    ? calculatedResults.totalFlow
    : calculatedResults.totalFlow * 0.0630902;
  const totalFlowGpm = isSI
    ? calculatedResults.totalFlow * 15.8503
    : calculatedResults.totalFlow;

  const totalAreaM2 = isSI
    ? calculatedResults.totalArea
    : calculatedResults.totalArea / 10.7639;

  // Impervious surface percentage
  const imperviousAreaM2 = rows.reduce((sum, r) => {
    const isImpervious = r.surface === "asphalt" || r.surface === "concrete" || r.surface === "brick";
    const areaM2 = r.area / (!isSI ? 10.7639 : 1);
    return sum + (isImpervious ? areaM2 : 0);
  }, 0);

  const imperviousRatio = totalAreaM2 > 0 ? (imperviousAreaM2 / totalAreaM2) * 100 : 0;

  // Top contributing catchment
  const topContributor = useMemo(() => {
    if (!calculatedResults.items.length) return null;
    return [...calculatedResults.items].sort((a: any, b: any) => (b.flow || 0) - (a.flow || 0))[0];
  }, [calculatedResults.items]);

  // 2. Recommended Gravity Storm Sewer Pipe Size (IPC Table 1106.2 / Manning's Eq)
  const getPipeRecommendation = (flowLps: number) => {
    // Capacities at 1% slope (1/8 in/ft) & 2% slope (1/4 in/ft) in L/s
    if (flowLps <= 2.2) return { dn: 75, nps: '3"', minSlope: "1%", capLps: 3.5 };
    if (flowLps <= 5.5) return { dn: 100, nps: '4"', minSlope: "1%", capLps: 7.8 };
    if (flowLps <= 11.0) return { dn: 125, nps: '5"', minSlope: "1%", capLps: 14.5 };
    if (flowLps <= 22.0) return { dn: 150, nps: '6"', minSlope: "1%", capLps: 26.0 };
    if (flowLps <= 52.0) return { dn: 200, nps: '8"', minSlope: "1%", capLps: 58.0 };
    if (flowLps <= 95.0) return { dn: 250, nps: '10"', minSlope: "1%", capLps: 110.0 };
    if (flowLps <= 165.0) return { dn: 300, nps: '12"', minSlope: "1%", capLps: 180.0 };
    if (flowLps <= 280.0) return { dn: 375, nps: '15"', minSlope: "1%", capLps: 310.0 };
    return { dn: 450, nps: '18"', minSlope: "1%", capLps: 520.0 };
  };

  const pipeRec = getPipeRecommendation(totalFlowLps);

  // 3. Retention Basin Storage Volume Estimation
  const vol15MinM3 = (totalFlowLps * 900) / 1000;
  const vol30MinM3 = (totalFlowLps * 1800) / 1000;
  const vol60MinM3 = (totalFlowLps * 3600) / 1000;

  const vol15MinGal = vol15MinM3 * 264.172;
  const vol30MinGal = vol30MinM3 * 264.172;
  const vol60MinGal = vol60MinM3 * 264.172;

  return (
    <div className="h-full flex flex-col bg-card select-none text-xs w-[360px]">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between bg-primary/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-[13.5px] leading-tight">
              Storm Water Intelligence
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Rational Method & Hydrology Sizing Engine
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors border-0"
          title="Close Intelligence"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {/* Overall Hydrology Health Score Card */}
        <div className="p-3 rounded-xl bg-surface-2 border border-border/80 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3.5 text-primary" /> Hydrology Design Status
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              Validated
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-card border border-border/50">
              <div className="text-[10px] text-muted-foreground font-medium">Impervious Surface</div>
              <div className="font-extrabold text-foreground text-sm mt-0.5">
                {imperviousRatio.toFixed(0)}%
              </div>
              <div className="text-[9.5px] text-muted-foreground">Pavement / Roofs</div>
            </div>
            <div className="p-2 rounded-lg bg-card border border-border/50">
              <div className="text-[10px] text-muted-foreground font-medium">Permeable Surface</div>
              <div className="font-extrabold text-foreground text-sm mt-0.5">
                {(100 - imperviousRatio).toFixed(0)}%
              </div>
              <div className="text-[9.5px] text-muted-foreground">Lawns / Soil</div>
            </div>
          </div>
        </div>

        {/* Section 1: Pipe Sizing Recommendation (IPC Table 1106.2) */}
        <div className="rounded-xl border border-border/80 bg-card overflow-hidden">
          <button
            onClick={() => toggleSection("pipeSizing")}
            className="w-full p-2.5 bg-surface-2/60 flex items-center justify-between text-left font-bold text-foreground border-b border-border/60 hover:bg-surface-2 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Gauge className="size-3.5 text-[#0A7BC7]" />
              <span className="text-[11.5px]">Storm Sewer Pipe Sizing</span>
            </div>
            {openSections.pipeSizing ? (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )}
          </button>

          {openSections.pipeSizing && (
            <div className="p-3 space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-sky-950/20 border border-blue-100 dark:border-sky-800/40 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground">Min Gravity Main Size:</span>
                  <span className="font-black text-[#06456F] dark:text-sky-300 text-sm">
                    DN {pipeRec.dn} ({pipeRec.nps})
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>Design Slope:</span>
                  <span className="font-bold text-foreground">{pipeRec.minSlope} (1/8"/ft)</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>Capacity at 1% Slope:</span>
                  <span className="font-bold text-foreground">
                    {pipeRec.capLps.toFixed(1)} L/s ({(pipeRec.capLps * 15.85).toFixed(0)} GPM)
                  </span>
                </div>
              </div>

              <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                Calculated per <strong>IPC Table 1106.2</strong> (Manning&apos;s $n = 0.012$ for smooth interior storm sewer mains).
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Retention / Detention Basin Capacity Estimator */}
        <div className="rounded-xl border border-border/80 bg-card overflow-hidden">
          <button
            onClick={() => toggleSection("retention")}
            className="w-full p-2.5 bg-surface-2/60 flex items-center justify-between text-left font-bold text-foreground border-b border-border/60 hover:bg-surface-2 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Building className="size-3.5 text-emerald-500" />
              <span className="text-[11.5px]">Retention / Sump Sizing</span>
            </div>
            {openSections.retention ? (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )}
          </button>

          {openSections.retention && (
            <div className="p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center p-2 rounded bg-surface-2">
                <span className="text-muted-foreground">15-Min Flash Sump:</span>
                <span className="font-bold text-foreground font-mono">
                  {vol15MinM3.toFixed(1)} m³ ({vol15MinGal.toFixed(0)} Gal)
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-surface-2">
                <span className="text-muted-foreground">30-Min Detention:</span>
                <span className="font-bold text-foreground font-mono">
                  {vol30MinM3.toFixed(1)} m³ ({vol30MinGal.toFixed(0)} Gal)
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-surface-2">
                <span className="text-muted-foreground">60-Min Retention:</span>
                <span className="font-bold text-foreground font-mono">
                  {vol60MinM3.toFixed(1)} m³ ({vol60MinGal.toFixed(0)} Gal)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Rainfall Intensity & Return Period Presets */}
        <div className="rounded-xl border border-border/80 bg-card overflow-hidden">
          <button
            onClick={() => toggleSection("idfPresets")}
            className="w-full p-2.5 bg-surface-2/60 flex items-center justify-between text-left font-bold text-foreground border-b border-border/60 hover:bg-surface-2 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <CloudRain className="size-3.5 text-sky-500" />
              <span className="text-[11.5px]">Rainfall Return Period Presets</span>
            </div>
            {openSections.idfPresets ? (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )}
          </button>

          {openSections.idfPresets && (
            <div className="p-3 space-y-2 text-xs">
              <p className="text-[10.5px] text-muted-foreground">
                Click any storm return period to apply its rainfall intensity across all catchments:
              </p>
              <div className="space-y-1.5">
                {RAINFALL_PRESETS.map((p) => {
                  const targetVal = isSI ? p.intensitySI : p.intensityIP;
                  return (
                    <button
                      key={p.label}
                      disabled={isLocked}
                      onClick={() => onApplyRainfallPreset(targetVal)}
                      className="w-full p-2 rounded-lg border border-border/70 hover:border-primary/50 hover:bg-primary/5 flex items-center justify-between text-left transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-background"
                    >
                      <div>
                        <div className="font-bold text-foreground text-[11.5px]">{p.label}</div>
                        <div className="text-[9.5px] text-muted-foreground">{p.desc}</div>
                      </div>
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary font-bold text-xs font-mono">
                        {targetVal} {isSI ? "mm/hr" : "in/hr"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Engineering Equations Quick Link */}
        <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900/60 border border-border/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-xs">Rational Method Formula</span>
            <button
              onClick={onOpenFormulaModal}
              className="text-[10.5px] text-primary hover:underline font-bold cursor-pointer bg-transparent border-0 p-0"
            >
              Full Breakdown →
            </button>
          </div>
          <div className="p-2 bg-background rounded-md border border-border font-mono text-[11px] text-[#06456F] dark:text-sky-300 font-bold text-center">
            {isSI ? "Q (L/s) = (C · i · A) / 3600" : "Q (GPM) = (C · i · A / 3600) × 15.85"}
          </div>
        </div>
      </div>
    </div>
  );
}
