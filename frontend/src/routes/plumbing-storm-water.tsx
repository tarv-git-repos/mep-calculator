import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr, resolveLatestReviewState } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { exportStormWaterPDF } from "@/lib/exportStormWaterPDF";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "@/components/workspace/AppShell";
import {
  Download, Save, Trash2, Plus, Info, Calculator, Sparkles, Activity, FileText,
  CheckCircle2, AlertTriangle, ShieldCheck, TrendingDown, Sliders, MessageSquare,
  RotateCcw, Eye, Layers, CloudRain, X, ChevronRight, ChevronDown, Edit3, Copy, Lock,
  Scissors, ClipboardPaste, Check, Flag, Search
} from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import {
  type CatchmentRow,
  SURFACE_COEFS,
  SURFACE_LABELS,
  computeStormWaterCalculations,
  getCatchmentValidation
} from "@/lib/calc-plumbing-storm-water";

import { TBtn } from "@/components/workspace/Button";
import { dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";

export const Route = createFileRoute("/plumbing-storm-water")({
  head: () => ({
    meta: [
      { title: "Storm Water Runoff Calculation — MEP Calc" },
      { name: "description", content: "Calculate storm water runoff flow rate using the Rational Method with intelligent pipe sizing." },
    ],
  }),
  component: StormWaterPage,
});

interface EditCatchmentModalProps {
  catchment: CatchmentRow;
  isSI: boolean;
  onClose: () => void;
  onSave: (updated: CatchmentRow) => void;
}

function EditCatchmentModal({ catchment, isSI, onClose, onSave }: EditCatchmentModalProps) {
  const [name, setName] = useState(catchment.name);
  const [area, setArea] = useState<number | "">(catchment.area);
  const [surface, setSurface] = useState(catchment.surface);
  const [coef, setCoef] = useState<number | "">(catchment.coef);
  const [intensity, setIntensity] = useState<number | "">(catchment.intensity);

  const handleSurfaceChange = (newSurface: string) => {
    setSurface(newSurface);
    if (SURFACE_COEFS[newSurface] !== undefined) {
      setCoef(SURFACE_COEFS[newSurface]);
    }
  };

  const previewFlow = useMemo(() => {
    const areaNum = typeof area === "number" ? area : 0;
    const intensityNum = typeof intensity === "number" ? intensity : 0;
    const coefNum = typeof coef === "number" ? coef : 0;
    if (areaNum <= 0 || intensityNum <= 0) return 0;

    const areaSI = areaNum / (!isSI ? 10.7639 : 1);
    const intensitySI = intensityNum * (!isSI ? 25.4 : 1);
    const flowSI = (coefNum * intensitySI * areaSI) / 3600;
    return flowSI * (!isSI ? 15.85 : 1);
  }, [area, intensity, coef, isSI]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a catchment name.");
      return;
    }
    const areaNum = typeof area === "number" ? area : parseFloat(String(area)) || 0;
    const intensityNum = typeof intensity === "number" ? intensity : parseFloat(String(intensity)) || 0;
    const coefNum = typeof coef === "number" ? coef : parseFloat(String(coef)) || 0.9;

    if (areaNum <= 0) {
      toast.error("Please enter a valid area greater than 0.");
      return;
    }
    if (intensityNum <= 0) {
      toast.error("Please enter a valid rainfall intensity greater than 0.");
      return;
    }
    if (coefNum <= 0 || coefNum > 1) {
      toast.error("Runoff coefficient (C) must be between 0.05 and 1.00.");
      return;
    }

    onSave({
      ...catchment,
      name: name.trim(),
      area: areaNum,
      surface,
      coef: coefNum,
      intensity: intensityNum,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col">
        {/* Header */}
        <div className="p-4 px-6 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Edit3 className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Edit Catchment Area</h3>
              <p className="text-xs text-muted-foreground">Modify surface type, area, runoff coefficient and intensity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-foreground mb-1">Catchment / Area Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/30 outline-none"
              placeholder="e.g. Main Roof Area, Car Park Deck"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Area ({isSI ? "m²" : "ft²"})
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                value={area}
                onChange={(e) => setArea(e.target.value === "" ? "" : parseFloat(e.target.value))}
                className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary/30 outline-none"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">
                Surface Category
              </label>
              <div className="relative flex items-center">
                <select
                  value={surface}
                  onChange={(e) => handleSurfaceChange(e.target.value)}
                  className="w-full appearance-none h-9 px-3 pr-8 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/30 outline-none cursor-pointer"
                >
                  {Object.keys(SURFACE_LABELS).map((k) => (
                    <option key={k} value={k}>
                      {SURFACE_LABELS[k]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Runoff Coefficient (C)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.05"
                max="1.0"
                value={coef}
                onChange={(e) => setCoef(e.target.value === "" ? "" : parseFloat(e.target.value))}
                className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary/30 outline-none"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">Standard range: 0.20 - 0.95</span>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">
                Rainfall Intensity ({isSI ? "mm/hr" : "in/hr"})
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                value={intensity}
                onChange={(e) => setIntensity(e.target.value === "" ? "" : parseFloat(e.target.value))}
                className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary/30 outline-none"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">Local design storm intensity</span>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">Calculated Runoff Flow</span>
              <span className="text-[11px] text-muted-foreground font-mono">Q = (C × i × A) / 3600</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-[#06456F] dark:text-sky-400 font-mono">
                {previewFlow.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-muted-foreground ml-1.5">{isSI ? "L/s" : "GPM"}</span>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-surface-2 text-foreground font-semibold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Save Catchment</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
function StormWaterPage() {
  const confirm = useConfirm();
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const effectiveProjectId = activeProjectId || project?.id || "default";

  const calcReviewState = useCalculationReviewState("/plumbing-storm-water", effectiveProjectId);
  const calcEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-storm-water", effectiveProjectId);

  const isCalcLock = useCalculationLock("/plumbing-storm-water", effectiveProjectId);

  const isApprovedLocked = Boolean(isCalcLock || calcReviewState?.status === "APPROVED");

  const isEffectiveReadOnly = Boolean(
    isApprovedLocked ||
    calcEffectiveReadOnly ||
    isReadOnly ||
    (typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly))
  );

  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const isSI = unitSystem === "si";

  // Schedule state
  const [rows, setRows] = useState<CatchmentRow[]>([
    { id: "1", name: "Main Roof Area", area: 1200, surface: "concrete", coef: 0.95, intensity: 50 },
    { id: "2", name: "Pool Deck", area: 450, surface: "brick", coef: 0.85, intensity: 50 }
  ]);
  const [editingCatchment, setEditingCatchment] = useState<CatchmentRow | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<CatchmentRow[][]>([]);
  const [redoStack, setRedoStack] = useState<CatchmentRow[][]>([]);

  const pushToUndo = (currentRows: CatchmentRow[]) => {
    setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(currentRows))]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (isEffectiveReadOnly || isApprovedLocked || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(rows))]);
    setRows(previous);
    saveState(previous);
    setUndoStack(prev => prev.slice(0, -1));
    dirtyStore.set(true);
    toast.success("Undo successful");
  };

  const handleRedo = () => {
    if (isEffectiveReadOnly || isApprovedLocked || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(rows))]);
    setRows(next);
    saveState(next);
    setRedoStack(prev => prev.slice(0, -1));
    dirtyStore.set(true);
    toast.success("Redo successful");
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  // Clipboard Storage & Actions (Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D)
  const [copiedCatchments, setCopiedCatchments] = useState<CatchmentRow[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_clipboard_storm_water");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const handleCopyCatchments = (ids: string[]) => {
    const targets = rows.filter(r => ids.includes(r.id));
    if (targets.length === 0) return;
    const cloned: CatchmentRow[] = JSON.parse(JSON.stringify(targets));
    setCopiedCatchments(cloned);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("mep_clipboard_storm_water", JSON.stringify(cloned));
        const headers = ["Name", "Area", "Surface", "Runoff C", "Intensity", "Flow"];
        const tsvRows = cloned.map(r => [
          r.name,
          r.area,
          r.surface,
          r.coef,
          r.intensity,
          ((r.coef * r.intensity * r.area) / 3600).toFixed(2)
        ]);
        const tsv = [headers.join("\t"), ...tsvRows.map(tr => tr.join("\t"))].join("\n");
        navigator.clipboard?.writeText(tsv).catch(() => {});
      } catch (e) {}
    }
    toast.info(`${targets.length} catchment(s) copied to clipboard (Ctrl+C)`);
  };

  const handleCutCatchments = (ids: string[]) => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    const targets = rows.filter(r => ids.includes(r.id));
    if (targets.length === 0) return;
    pushToUndo(rows);
    handleCopyCatchments(ids);
    const updated = rows.filter(r => !ids.includes(r.id));
    setRows(updated);
    saveState(updated);
    setSelectedIds([]);
    dirtyStore.set(true);
    toast.info(`${targets.length} catchment(s) cut to clipboard (Ctrl+X)`);
  };

  const handlePasteCatchments = () => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    let source = copiedCatchments;
    if (source.length === 0 && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_clipboard_storm_water");
        if (saved) source = JSON.parse(saved);
      } catch (e) {}
    }
    if (source.length === 0) {
      toast.info("Clipboard is empty. Copy or cut catchments first (Ctrl+C).");
      return;
    }

    pushToUndo(rows);
    const pasted: CatchmentRow[] = source.map((r) => ({
      ...r,
      id: Math.random().toString(36).substring(2, 9),
      name: `${r.name.replace(/ \(Copy(-\d+)?\)$/, "")} (Copy)`,
    }));

    const updated = [...rows, ...pasted];
    setRows(updated);
    saveState(updated);
    setSelectedIds(pasted.map(p => p.id));
    dirtyStore.set(true);
    toast.success(`${pasted.length} catchment(s) pasted from clipboard (Ctrl+V)`);
  };

  const handleToggleFlag = (target: string | string[]) => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    const targetIds = Array.isArray(target)
      ? target
      : (selectedIds.includes(target) && selectedIds.length > 1 ? selectedIds : [target]);
    if (targetIds.length === 0) return;

    pushToUndo(rows);
    const anyUnflagged = targetIds.some(targetId => {
      const r = rows.find(item => item.id === targetId);
      return !getCatchmentValidation(r).isFlagged;
    });
    const nextState = anyUnflagged;
    const updated = rows.map(r => targetIds.includes(r.id) ? { ...r, flagged: nextState } : r);
    setRows(updated);
    saveState(updated);
    dirtyStore.set(true);
    toast.info(nextState ? `Flagged ${targetIds.length} catchment(s)` : `Unflagged ${targetIds.length} catchment(s)`);
  };

  const handleBulkDuplicate = (ids: string[]) => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    const targets = rows.filter(r => ids.includes(r.id));
    if (targets.length === 0) return;

    pushToUndo(rows);
    const duplicates: CatchmentRow[] = targets.map((r) => ({
      ...r,
      id: Math.random().toString(36).substring(2, 9),
      name: `${r.name} (Copy)`,
    }));

    const updated = [...rows, ...duplicates];
    setRows(updated);
    saveState(updated);
    setSelectedIds(duplicates.map(d => d.id));
    dirtyStore.set(true);
    toast.success(`Duplicated ${duplicates.length} catchment(s) (Ctrl+D)`);
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    if (ids.length === 0) return;
    const msg = ids.length === 1
      ? `Are you sure you want to delete catchment "${rows.find(r => r.id === ids[0])?.name || "selected catchment"}"?`
      : `Are you sure you want to delete the ${ids.length} selected catchment(s)?`;

    const ok = await confirm(msg, {
      title: "Delete Catchment",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(rows);
    const updated = rows.filter(r => !ids.includes(r.id));
    setRows(updated);
    saveState(updated);
    setSelectedIds([]);
    dirtyStore.set(true);
    toast.info(`Deleted ${ids.length} catchment(s)`);
  };

  // Auto-clear selection when locked
  useEffect(() => {
    if (isApprovedLocked || isEffectiveReadOnly) {
      setSelectedIds([]);
    }
  }, [isApprovedLocked, isEffectiveReadOnly]);

  const handleToggleSelect = (id: string, isShift = false, isCtrl = false) => {
    if (isApprovedLocked || isEffectiveReadOnly) return;
    if (isShift && lastSelectedId) {
      const idx1 = rows.findIndex(r => r.id === lastSelectedId);
      const idx2 = rows.findIndex(r => r.id === id);
      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        const rangeIds = rows.slice(start, end + 1).map(r => r.id);
        setSelectedIds(prev => Array.from(new Set([...prev, ...rangeIds])));
        setLastSelectedId(id);
        return;
      }
    }
    if (isCtrl) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
      setLastSelectedId(id);
      return;
    }
    setSelectedIds(prev => (prev.length === 1 && prev[0] === id ? [] : [id]));
    setLastSelectedId(id);
  };

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Modals & comments
  const [formulaModalOpen, setFormulaModalOpen] = useState<boolean>(false);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Load project state on mount or project switch
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_storm_water_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.rows) setRows(data.rows);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
      } else {
        setRows([
          { id: "1", name: "Main Roof Area", area: 1200, surface: "concrete", coef: 0.95, intensity: 50 },
          { id: "2", name: "Pool Deck", area: 450, surface: "brick", coef: 0.85, intensity: 50 }
        ]);
        setUnitSystem("si");
      }
    } catch (e) {
      console.error(e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-storm-water`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCommentsList(parsed);
      }
    } catch (e) {}
  }, [project?.id]);

  const saveState = (updatedRows = rows, updatedUnit = unitSystem) => {
    try {
      localStorage.setItem(`mep_storm_water_calc_${project?.id || "default"}`, JSON.stringify({
        rows: updatedRows,
        unitSystem: updatedUnit
      }));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { unitSystem, rows };
      localStorage.setItem(`mep_storm_water_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, rows]);

  // Keyboard Shortcuts Listener (Ctrl+A, Escape, Delete, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Deselect all selected rows
      if (e.key === "Escape") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          setSelectedIds([]);
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const activeEl = document.activeElement;
      const isModalActive = Boolean(formulaModalOpen || commentModalOpen || editingCatchment);

      // Lock Protection: Block select-all and modification shortcuts when calculation is locked/approved
      if (isApprovedLocked || isEffectiveReadOnly) {
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

      // 1. Ctrl+A / Cmd+A (Select All Catchments) when no modal is active
      if (isCmdOrCtrl && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
        if (!isModalActive) {
          const isTextInput = activeEl && (
            (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type === "text") ||
            activeEl.tagName === "TEXTAREA"
          );
          if (!isTextInput && rows.length > 0) {
            e.preventDefault();
            if (activeEl && "blur" in activeEl) {
              (activeEl as HTMLElement).blur();
            }
            setSelectedIds(rows.map(r => r.id));
            toast.info(`Selected all ${rows.length} catchment(s) (Ctrl+A)`);
            return;
          }
        }
      }

      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isInput) return;

      // 2. Undo / Redo: Ctrl+Z / Ctrl+Y
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

      // 3. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleBulkDelete(selectedIds);
        }
        return;
      }

      // 4. Ctrl+C (Copy)
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleCopyCatchments(selectedIds);
        }
        return;
      }

      // 5. Ctrl+X (Cut)
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleCutCatchments(selectedIds);
        }
        return;
      }

      // 6. Ctrl+V (Paste)
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteCatchments();
        return;
      }

      // 7. Ctrl+D (Duplicate)
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleBulkDuplicate(selectedIds);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [rows, selectedIds, undoStack, redoStack, copiedCatchments, formulaModalOpen, commentModalOpen, editingCatchment, isEffectiveReadOnly, isApprovedLocked]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-storm-water`, JSON.stringify(newList));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"));
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId;
    const targetName = commentTargetItem?.name || commentData?.targetName;
    const commentWithMeta = {
      ...commentData, targetId, targetName, spaceId: targetId, spaceName: targetName, itemId: targetId,
      targetType: "Storm Water Parameter", calculatorTitle: "Storm Water Runoff Calculation", calculatorPath: "/plumbing-storm-water",
      projectId: project?.id || "default", projectName: project?.name || "Storm Water Runoff",
    };
    const updated = [commentWithMeta, ...commentsList.filter((c) => c.id !== commentData.id)];
    saveComments(updated);
    dispatchGlobalCommentNotification(commentWithMeta, { project });
    toast.success(`Comment assigned on "${targetName}"`);
    setCommentModalOpen(false);
  };

  const isFieldHighlighted = (id: string) => {
    if (!highlightedTargetId) return false;
    const cleanHighlight = highlightedTargetId.toLowerCase().trim().replace(/^(field-|card-)/, "");
    const cleanId = id.toLowerCase().trim().replace(/^(field-|card-)/, "");
    return cleanHighlight === cleanId;
  };

  const handleNavigateToField = (targetId: string) => {
    const cleanId = targetId.toLowerCase().trim().replace(/^(field-|card-|res-)/, "");
    const el = document.getElementById(targetId) || document.getElementById(`card-${cleanId}`) || document.getElementById(cleanId);
    setHighlightedTargetId(cleanId || targetId);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2500);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const renderCommentBadge = (id: string, name: string) => {
    const clean = id.toLowerCase().trim().replace(/^(field-|card-)/, "");
    const itemComments = commentsList.filter((c) => {
      const tId = String(c.targetId || c.spaceId || c.itemId || c.id || "").toLowerCase().trim().replace(/^(field-|card-)/, "");
      return tId === clean;
    });
    if (itemComments.length === 0) return null;
    return (
      <RowCommentCornerBadge
        id={id}
        count={itemComments.length}
        onClick={() => handleOpenComment(id, name)}
        title={`${itemComments.length} comment(s)/task(s) assigned`}
      />
    );
  };

  const handleAddRow = () => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(rows);
    const newRow: CatchmentRow = {
      id: Math.random().toString(36).substring(2, 9),
      name: "",
      area: 0,
      surface: "",
      coef: 0,
      intensity: 0
    };

    const updated = [...rows, newRow];
    setRows(updated);
    saveState(updated);
    dirtyStore.set(true);
    toast.success("Catchment area added.");
  };

  const handleUpdateRow = (id: string, partial: Partial<CatchmentRow>) => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    const nextRows = rows.map((r) => (r.id === id ? { ...r, ...partial } : r));
    setRows(nextRows);
    saveState(nextRows);
    dirtyStore.set(true);
  };

  const handleDeleteRow = async (id: string) => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    const target = rows.find(r => r.id === id);
    const ok = await confirm(`Are you sure you want to delete catchment "${target?.name || "selected catchment"}"?`, {
      title: "Delete Catchment",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(rows);
    const updated = rows.filter(r => r.id !== id);
    setRows(updated);
    saveState(updated);
    setSelectedIds(prev => prev.filter(sId => sId !== id));
    dirtyStore.set(true);
    toast.info("Catchment removed.");
  };

  const handleUpdateCatchment = (updatedCatchment: CatchmentRow) => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(rows);
    const nextRows = rows.map(r => r.id === updatedCatchment.id ? updatedCatchment : r);
    setRows(nextRows);
    saveState(nextRows);
    dirtyStore.set(true);
    setEditingCatchment(null);
    toast.success(`Catchment "${updatedCatchment.name}" updated successfully.`);
  };

  const handleClearAll = async () => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    const ok = await confirm("Are you sure you want to clear all catchment areas?", {
      title: "Clear All Catchments",
      confirmText: "Clear All",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(rows);
    setRows([]);
    saveState([]);
    setSelectedIds([]);
    dirtyStore.set(true);
    toast.success("Cleared all catchment entries.");
  };

  // Calculations
  const calculatedResults = useMemo(() => {
    return computeStormWaterCalculations(rows, unitSystem);
  }, [rows, unitSystem]);

  const flaggedCount = useMemo(() => {
    return rows.filter(r => getCatchmentValidation(r).isFlagged).length;
  }, [rows]);

  const displayedItems = useMemo(() => {
    let list = calculatedResults.items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => (r.name || "").toLowerCase().includes(q) || (r.surface || "").toLowerCase().includes(q));
    }
    if (showFlaggedOnly) {
      list = list.filter(r => getCatchmentValidation(r).isFlagged);
    }
    return list;
  }, [calculatedResults.items, searchQuery, showFlaggedOnly]);

  const handleUnitSystemChange = (next: "ip" | "si") => {
    if (isEffectiveReadOnly) return;
    setUnitSystem(next);
    saveState(rows, next);
    dirtyStore.set(true);
  };

  // PDF Export matching Preliminary Cooling Load logic
  const handleExportPDF = () => {
    exportStormWaterPDF(
      calculatedResults.items,
      calculatedResults,
      unitSystem,
      {
        projectName: project?.name,
        client: (project as any)?.client,
        projectNo: project?.code || (project as any)?.projectNo,
        calcNo: (project as any)?.calcNo,
        date: formatDateStr(new Date().toISOString()),
        userName: currentUserName,
        reviewState: calcReviewState
      }
    );
  };

  const sigDetails = useMemo(() => {
    return getSignatureBlockDetails(
      effectiveProjectId,
      "/plumbing-storm-water",
      currentUserName,
      calcReviewState
    );
  }, [effectiveProjectId, currentUserName, calcReviewState]);

  return (
    <AppShell
      title="Storm Water Runoff Calculation"
      hideSubHeader={true}
      actions={
        <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
      }
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header matching Ventilation & Pump Sizing exactly */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Storm Water Runoff Calculation</h1>
              </div>
              <button
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar
                projectId={effectiveProjectId}
                calculatorPath="/plumbing-storm-water"
                calculatorTitle="Storm Water Runoff Calculation"
              />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* Main Content Card Container */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            isApprovedLocked || calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Tabs Selector row matching Pump Sizing */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Runoff Schedule
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

                {/* Formula Breakdown button placed right after the tabs on the left */}
                <TBtn
                  onClick={() => setFormulaModalOpen(true)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Action buttons on the right */}
              <div className="flex items-center gap-2">
                <TBtn onClick={handleExportPDF} title="Export Report">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column: Catchment Schedule Card */}
                    <div className="lg:col-span-7 flex flex-col gap-5">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-schedule"
                            className={`bg-card border border-border rounded-2xl shadow-xs transition-colors flex flex-col overflow-hidden ${
                              isFieldHighlighted("card-schedule")
                                ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                                : ""
                            }`}
                          >
                            {/* Card Header Toolbar matching Ventilation */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <div className="w-1.5 h-4 bg-primary rounded-full" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                  Runoff Schedule
                                  {renderCommentBadge("card-schedule", "Runoff Schedule")}
                                </h3>

                                {/* Search Filter */}
                                <div className="relative flex items-center">
                                  <Search className="size-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
                                  <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Filter catchments..."
                                    className="h-7 w-44 pl-7 pr-2.5 bg-surface-2 border border-border rounded-full text-[11.5px] outline-none focus:border-primary focus:bg-background transition-all text-foreground placeholder:text-muted-foreground"
                                  />
                                </div>

                                {/* Flagged Filter Button */}
                                <button
                                  type="button"
                                  onClick={() => setShowFlaggedOnly(prev => !prev)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11.5px] font-semibold rounded-full border transition cursor-pointer shadow-2xs ${
                                    showFlaggedOnly
                                      ? "bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-2xs"
                                      : flaggedCount > 0
                                        ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100"
                                        : "bg-surface-2 border-border text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                                  }`}
                                  title={showFlaggedOnly ? "Showing flagged catchments only. Click to show all." : `${flaggedCount} flagged catchment(s)`}
                                >
                                  <Flag className={`size-3 ${flaggedCount > 0 || showFlaggedOnly ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                                  <span>{showFlaggedOnly ? "Flagged Only" : `Flagged (${flaggedCount})`}</span>
                                </button>

                                <button
                                  disabled={isEffectiveReadOnly || isApprovedLocked}
                                  onClick={handleAddRow}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                >
                                  <Plus className="size-3.5" />
                                  <span>Add Catchment</span>
                                </button>
                                {selectedIds.length > 0 && (
                                  <div className="flex items-center gap-1.5 pl-2 border-l border-border/80 animate-fade-in">
                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10.5px] font-bold">
                                      {selectedIds.length} selected
                                    </span>
                                    <button
                                      disabled={isEffectiveReadOnly || isApprovedLocked}
                                      onClick={() => handleToggleFlag(selectedIds)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-surface-2 hover:bg-muted text-foreground transition cursor-pointer"
                                      title="Flag / Unflag Selected"
                                    >
                                      <Flag className="size-3 text-muted-foreground" />
                                      <span>Flag</span>
                                    </button>
                                    <button
                                      disabled={isEffectiveReadOnly || isApprovedLocked}
                                      onClick={() => handleBulkDuplicate(selectedIds)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-surface-2 hover:bg-muted text-foreground transition cursor-pointer"
                                      title="Duplicate Selected (Ctrl+D)"
                                    >
                                      <Copy className="size-3 text-muted-foreground" />
                                      <span>Duplicate</span>
                                    </button>
                                    <button
                                      disabled={isEffectiveReadOnly || isApprovedLocked}
                                      onClick={() => handleBulkDelete(selectedIds)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition cursor-pointer"
                                      title="Delete Selected (Del)"
                                    >
                                      <Trash2 className="size-3" />
                                      <span>Delete</span>
                                    </button>
                                    <button
                                      onClick={() => setSelectedIds([])}
                                      className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 cursor-pointer"
                                    >
                                      Deselect
                                    </button>
                                  </div>
                                )}
                              </div>
                               <div className="flex items-center gap-2" />
                            </div>

                            {/* Table Container */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-muted/40 text-muted-foreground font-bold text-[11px] tracking-wider uppercase select-none">
                                    <th className="py-2.5 px-2 text-center w-9 border-b border-border border-r border-border/60">
                                      <input
                                        type="checkbox"
                                        disabled={isApprovedLocked || isEffectiveReadOnly}
                                        checked={rows.length > 0 && selectedIds.length === rows.length && !isApprovedLocked && !isEffectiveReadOnly}
                                        ref={(el) => {
                                          if (el) el.indeterminate = selectedIds.length > 0 && selectedIds.length < rows.length && !isApprovedLocked && !isEffectiveReadOnly;
                                        }}
                                        onChange={(e) => {
                                          if (isApprovedLocked || isEffectiveReadOnly) {
                                            toast.info("Calculation is Approved & Locked. Selection is locked.", { id: "readonly-notice" });
                                            return;
                                          }
                                          if (e.target.checked) {
                                            setSelectedIds(rows.map(r => r.id));
                                            toast.info(`Selected all ${rows.length} catchment(s)`);
                                          } else {
                                            setSelectedIds([]);
                                          }
                                        }}
                                        className="size-3.5 accent-primary cursor-pointer rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                        title={isApprovedLocked || isEffectiveReadOnly ? "Calculation is locked" : "Select / Deselect All (Ctrl+A)"}
                                      />
                                    </th>
                                    <th className="py-2.5 px-2 text-center w-10 border-b border-border border-r border-border/60">No.</th>
                                    <th className="py-2.5 px-3 border-b border-border border-r border-border/60 min-w-[190px]">Catchment Name</th>
                                    <th className="py-2.5 px-3 text-right w-28 border-b border-border border-r border-border/60">Area ({isSI ? "m²" : "ft²"})</th>
                                    <th className="py-2.5 px-3 w-44 border-b border-border border-r border-border/60">Surface</th>
                                    <th className="py-2.5 px-2 text-center w-20 border-b border-border border-r border-border/60">C</th>
                                    <th className="py-2.5 px-3 text-right w-28 border-b border-border border-r border-border/60">Intensity ({isSI ? "mm/hr" : "in/hr"})</th>
                                    <th className="py-2.5 px-3 text-right w-28 border-b border-border border-r border-border/60 font-mono font-bold text-primary">Flow ({isSI ? "L/s" : "GPM"})</th>
                                    <th className="py-2.5 px-2 text-center w-20 border-b border-border">FLAG</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayedItems.map((row, index) => {
                                    const isSelected = selectedIds.includes(row.id);
                                    const validation = getCatchmentValidation(row);
                                    const isEffectivelyFlagged = validation.isFlagged;

                                    return (
                                      <ContextMenu key={row.id}>
                                        <ContextMenuTrigger asChild>
                                          <tr
                                            onClick={(e) => {
                                              if (isApprovedLocked || isEffectiveReadOnly) return;
                                              const target = e.target as HTMLElement;
                                              if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "BUTTON" || target.closest("button") || target.closest("select")) {
                                                return;
                                              }
                                              const isShift = e.shiftKey;
                                              const isCtrl = e.ctrlKey || e.metaKey;
                                              handleToggleSelect(row.id, isShift, isCtrl);
                                            }}
                                            onDoubleClick={() => {
                                              if (isEffectiveReadOnly || isApprovedLocked) {
                                                toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
                                                return;
                                              }
                                              setEditingCatchment(row);
                                            }}
                                            className={`border-b border-border/50 transition-colors cursor-pointer select-none ${
                                              isSelected
                                                ? "bg-primary/15 font-medium dark:bg-primary/20"
                                                : editingCatchment?.id === row.id
                                                  ? "bg-accent/60"
                                                  : index % 2 === 0
                                                    ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80"
                                                    : "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"
                                            }`}
                                          >
                                            {/* Checkbox */}
                                            <td className="p-1 text-center w-9 border-r border-border/40" onClick={(e) => e.stopPropagation()}>
                                              <input
                                                type="checkbox"
                                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                                checked={isSelected && !isEffectiveReadOnly && !isApprovedLocked}
                                                onChange={(e) => {
                                                  if (isEffectiveReadOnly || isApprovedLocked) return;
                                                  if (e.target.checked) {
                                                    setSelectedIds(prev => Array.from(new Set([...prev, row.id])));
                                                  } else {
                                                    setSelectedIds(prev => prev.filter(id => id !== row.id));
                                                  }
                                                  setLastSelectedId(row.id);
                                                }}
                                                className="size-3.5 accent-primary cursor-pointer rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                              />
                                            </td>

                                            {/* No. */}
                                            <td className="p-1 text-center font-mono text-[11px] text-muted-foreground border-r border-border/40 select-none">
                                              {index + 1}
                                            </td>

                                            {/* Name */}
                                            <td className="p-1 border-r border-border/40">
                                              <div className="flex items-center gap-1.5 w-full">
                                                <input
                                                  type="text"
                                                  disabled={isEffectiveReadOnly || isApprovedLocked}
                                                  value={row.name}
                                                  onChange={(e) => handleUpdateRow(row.id, { name: e.target.value })}
                                                  placeholder="Catchment name"
                                                  className="w-full bg-transparent hover:bg-background focus:bg-background border border-transparent hover:border-border/60 focus:border-primary rounded px-2 py-1 text-[13.5px] font-medium text-foreground outline-none transition-all truncate cursor-pointer focus:cursor-text disabled:cursor-not-allowed"
                                                />
                                                {renderCommentBadge(`catchment-${row.id}`, row.name)}
                                              </div>
                                            </td>

                                            {/* Area */}
                                            <td className="p-1 border-r border-border/40">
                                              <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                                value={row.area === 0 ? "" : row.area}
                                                onChange={(e) => handleUpdateRow(row.id, { area: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                                                placeholder="0.0"
                                                className="w-full bg-transparent hover:bg-background focus:bg-background border border-transparent hover:border-border/60 focus:border-primary rounded px-2 py-1 text-xs font-mono font-medium text-foreground outline-none transition-all text-right cursor-pointer focus:cursor-text disabled:cursor-not-allowed"
                                              />
                                            </td>

                                            {/* Surface */}
                                            <td className="p-1 border-r border-border/40">
                                              <div className="relative w-full flex items-center">
                                                <select
                                                  disabled={isEffectiveReadOnly || isApprovedLocked}
                                                  value={row.surface || ""}
                                                  onChange={(e) => {
                                                    const newSurface = e.target.value;
                                                    const newCoef = SURFACE_COEFS[newSurface] ?? row.coef;
                                                    handleUpdateRow(row.id, { surface: newSurface, coef: newCoef });
                                                  }}
                                                  className={`w-full appearance-none bg-transparent hover:bg-background focus:bg-background border border-transparent hover:border-border/60 focus:border-primary rounded px-2 py-1 pr-6 text-xs font-medium outline-none transition-all cursor-pointer disabled:cursor-not-allowed capitalize ${
                                                    !row.surface ? "text-muted-foreground/60 italic" : "text-foreground"
                                                  }`}
                                                >
                                                  <option value="" disabled>Select Surface...</option>
                                                  {Object.keys(SURFACE_LABELS).map((k) => (
                                                    <option key={k} value={k}>{SURFACE_LABELS[k]}</option>
                                                  ))}
                                                </select>
                                                <ChevronDown className="size-3.5 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                              </div>
                                            </td>

                                            {/* Runoff Coef C */}
                                            <td className="p-1 border-r border-border/40 text-center">
                                              <input
                                                type="number"
                                                step="0.01"
                                                min="0.05"
                                                max="1.0"
                                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                                value={row.coef === 0 ? "" : row.coef}
                                                onChange={(e) => handleUpdateRow(row.id, { coef: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                                                placeholder="0.00"
                                                className="w-full bg-transparent hover:bg-background focus:bg-background border border-transparent hover:border-border/60 focus:border-primary rounded px-1 py-1 text-xs font-mono font-bold text-center text-foreground outline-none transition-all cursor-pointer focus:cursor-text disabled:cursor-not-allowed"
                                              />
                                            </td>

                                            {/* Intensity */}
                                            <td className="p-1 border-r border-border/40">
                                              <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                                value={row.intensity === 0 ? "" : row.intensity}
                                                onChange={(e) => handleUpdateRow(row.id, { intensity: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                                                placeholder={isSI ? "50" : "2.0"}
                                                className="w-full bg-transparent hover:bg-background focus:bg-background border border-transparent hover:border-border/60 focus:border-primary rounded px-2 py-1 text-xs font-mono font-medium text-foreground outline-none transition-all text-right cursor-pointer focus:cursor-text disabled:cursor-not-allowed"
                                              />
                                            </td>

                                            {/* Flow */}
                                            <td className="p-1 border-r border-border/40 text-right px-3 font-mono font-bold text-xs text-[#0A7BC7] dark:text-[#38bdf8]">
                                              {row.flow.toFixed(2)}
                                            </td>

                                            {/* Actions / Flag */}
                                            <td className="p-1 text-center" onClick={(e) => e.stopPropagation()}>
                                              <button
                                                type="button"
                                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleFlag(row.id);
                                                }}
                                                className="p-1.5 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
                                                title={
                                                  validation.isMissing
                                                    ? (validation.reason || "Missing catchment data")
                                                    : (isEffectivelyFlagged ? "Unflag Catchment" : "Flag Catchment for review")
                                                }
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
                                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                          <ContextMenuItem
                                            disabled={isEffectiveReadOnly || isApprovedLocked}
                                            onClick={() => {
                                              const targetIds = selectedIds.includes(row.id) && selectedIds.length > 1 ? selectedIds : [row.id];
                                              handleToggleFlag(targetIds);
                                            }}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium disabled:opacity-50"
                                          >
                                            <Flag className={`size-3.5 ${row.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                                            <span>{row.flagged ? "Unflag Catchment" : "Flag Catchment"}</span>
                                          </ContextMenuItem>

                                          <ContextMenuItem
                                            onClick={() => {
                                              if (isEffectiveReadOnly || isApprovedLocked) {
                                                toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
                                                return;
                                              }
                                              setEditingCatchment(row);
                                            }}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                                          >
                                            <Edit3 className="size-3.5 text-muted-foreground" />
                                            <span>Edit Catchment</span>
                                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                                          </ContextMenuItem>

                                          <ContextMenuItem
                                            onClick={() => {
                                              const targetIds = selectedIds.includes(row.id) && selectedIds.length > 1 ? selectedIds : [row.id];
                                              handleCopyCatchments(targetIds);
                                            }}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                                          >
                                            <Copy className="size-3.5 text-muted-foreground" />
                                            <span>Copy Catchment</span>
                                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                          </ContextMenuItem>

                                          <ContextMenuItem
                                            disabled={isEffectiveReadOnly || isApprovedLocked}
                                            onClick={() => {
                                              const targetIds = selectedIds.includes(row.id) && selectedIds.length > 1 ? selectedIds : [row.id];
                                              handleCutCatchments(targetIds);
                                            }}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium disabled:opacity-50"
                                          >
                                            <Scissors className="size-3.5 text-muted-foreground" />
                                            <span>Cut Catchment</span>
                                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
                                          </ContextMenuItem>

                                          <ContextMenuItem
                                            disabled={isEffectiveReadOnly || isApprovedLocked}
                                            onClick={handlePasteCatchments}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium disabled:opacity-50"
                                          >
                                            <ClipboardPaste className="size-3.5 text-muted-foreground" />
                                            <span>Paste Catchment</span>
                                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                                          </ContextMenuItem>

                                          <ContextMenuItem
                                            disabled={isEffectiveReadOnly || isApprovedLocked}
                                            onClick={() => {
                                              const targetIds = selectedIds.includes(row.id) && selectedIds.length > 1 ? selectedIds : [row.id];
                                              handleBulkDuplicate(targetIds);
                                            }}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium disabled:opacity-50"
                                          >
                                            <Copy className="size-3.5 text-muted-foreground" />
                                            <span>Duplicate Catchment</span>
                                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
                                          </ContextMenuItem>

                                          <ContextMenuItem
                                            onClick={() => {
                                              if (isEffectiveReadOnly || isApprovedLocked) {
                                                toast.info("Workspace is in Read-Only mode. Adding comments is locked.", { id: "readonly-notice" });
                                                return;
                                              }
                                              handleOpenComment(`catchment-${row.id}`, row.name);
                                            }}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-[#0A7BC7] dark:text-sky-400 font-medium"
                                          >
                                            <MessageSquare className="size-3.5" />
                                            <span>Add Comment</span>
                                          </ContextMenuItem>

                                          <ContextMenuSeparator className="h-px bg-border my-1" />

                                          <ContextMenuItem
                                            disabled={isEffectiveReadOnly || isApprovedLocked}
                                            onClick={() => {
                                              const targetIds = selectedIds.includes(row.id) && selectedIds.length > 1 ? selectedIds : [row.id];
                                              handleBulkDelete(targetIds);
                                            }}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 text-destructive rounded cursor-pointer font-medium disabled:opacity-50"
                                          >
                                            <Trash2 className="size-3.5" />
                                            <span>Delete Catchment</span>
                                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Del</ContextMenuShortcut>
                                          </ContextMenuItem>
                                        </ContextMenuContent>
                                      </ContextMenu>
                                    );
                                  })}
                                  {calculatedResults.items.length === 0 && (
                                    <tr>
                                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                          <CloudRain className="size-8 text-muted-foreground/40" />
                                          <div>
                                            <p className="text-sm font-semibold text-foreground">No Catchment Areas Added</p>
                                            <p className="text-xs text-muted-foreground">Click "Add Catchment" or press Ctrl+V to paste catchments.</p>
                                          </div>
                                          <button
                                            onClick={handleAddRow}
                                            disabled={isEffectiveReadOnly || isApprovedLocked}
                                            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
                                          >
                                            <Plus className="size-3.5" />
                                            Add Catchment
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  {calculatedResults.items.length > 0 && (
                                    <tr className="bg-primary/5 dark:bg-primary/10 font-bold border-t-2 border-border text-foreground">
                                      <td className="py-2.5 px-2 text-center text-muted-foreground border-r border-border/40 font-mono text-xs">Σ</td>
                                      <td className="py-2.5 px-2 text-center text-muted-foreground border-r border-border/40 font-mono text-xs"></td>
                                      <td className="py-2.5 px-3 border-r border-border/40 text-xs font-bold uppercase tracking-wider">Total / Composite</td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs font-bold border-r border-border/40">{calculatedResults.totalArea.toFixed(1)}</td>
                                      <td className="py-2.5 px-3 text-muted-foreground text-xs italic border-r border-border/40">{calculatedResults.imperviousPercentage}% Impervious</td>
                                      <td className="py-2.5 px-2 text-center font-mono text-xs font-bold border-r border-border/40">{calculatedResults.avgC.toFixed(2)}</td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs text-muted-foreground border-r border-border/40">—</td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs font-extrabold text-[#0A7BC7] dark:text-[#38bdf8] border-r border-border/40">{calculatedResults.totalFlow.toFixed(2)}</td>
                                      <td className="py-2.5 px-2 text-center"></td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Bottom Status Bar matching Ventilation / Drainage */}
                            <div className="px-4 py-2 bg-card border-t border-border flex items-center justify-between text-xs text-muted-foreground shrink-0 select-none flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span>Total Catchments: <strong className="text-foreground">{rows.length}</strong></span>
                                <span className="text-border">|</span>
                                <span>Impervious: <strong className="text-foreground">{calculatedResults.imperviousPercentage}%</strong></span>
                              </div>
                              <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap">
                                <span>Total Area: <strong className="text-foreground">{calculatedResults.totalArea.toFixed(1)} {isSI ? "m²" : "ft²"}</strong></span>
                                <span className="text-border">|</span>
                                <span>Weighted C: <strong className="text-foreground">{calculatedResults.avgC.toFixed(2)}</strong></span>
                                <span className="text-border">|</span>
                                <span>Total Flow: <strong className="text-primary font-bold">{calculatedResults.totalFlow.toFixed(2)} {isSI ? "L/s" : "GPM"}</strong></span>
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={handlePasteCatchments}
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-foreground font-medium text-[13px] disabled:opacity-50"
                          >
                            <ClipboardPaste className="size-3.5 text-muted-foreground" />
                            <span>Paste Catchment</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={handleAddRow}
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-foreground font-medium text-[13px] disabled:opacity-50"
                          >
                            <Plus className="size-3.5 text-muted-foreground" />
                            <span>Add Catchment</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              setSelectedIds(rows.map(r => r.id));
                              toast.info(`Selected all ${rows.length} catchment(s)`);
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-foreground font-medium text-[13px]"
                          >
                            <Check className="size-3.5 text-muted-foreground" />
                            <span>Select All</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+A</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => {
                              if (isEffectiveReadOnly) return;
                              pushToUndo(rows);
                              setRows([
                                { id: "1", name: "Main Roof Area", area: 1200, surface: "concrete", coef: 0.95, intensity: 50 },
                                { id: "2", name: "Pool Deck", area: 450, surface: "brick", coef: 0.85, intensity: 50 }
                              ]);
                              setSelectedIds([]);
                              dirtyStore.set(true);
                              toast.success("Reset catchment schedule to default");
                            }}
                            disabled={isEffectiveReadOnly}
                            className="px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-foreground font-medium text-[13px]"
                          >
                            Reset Default
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleOpenComment("card-schedule", "Runoff Schedule")}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-[#0A7BC7] dark:text-sky-400 font-medium text-[13px]"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>

                    {/* Right Column: Sizing Results Summary Card */}
                    <div className="lg:col-span-5 flex flex-col gap-5 lg:sticky lg:top-0 self-start">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-hero-results"
                            className={`bg-card border border-border rounded-2xl p-6 shadow-md transition-colors flex flex-col gap-6 ${
                              isFieldHighlighted("card-hero-results")
                                ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                              <div className="flex items-center">
                                <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                  ⚡ Sizing Results Summary
                                </span>
                                {renderCommentBadge("card-hero-results", "Sizing Results Summary")}
                              </div>
                            </div>

                            {/* 4 COLOR STAT CARDS */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5">
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Total Runoff Flow</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {calculatedResults.totalFlow.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{isSI ? "L/s" : "GPM"}</span>
                                </div>
                              </div>

                              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5">
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Weighted Coef (C_avg)</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {calculatedResults.avgC.toFixed(2)}
                                </div>
                              </div>

                              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5">
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Total Catchment Area</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {calculatedResults.totalArea.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{isSI ? "m²" : "ft²"}</span>
                                </div>
                              </div>

                              <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5">
                                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Catchment Zones</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {rows.length} <span className="text-xs font-normal text-muted-foreground">zones</span>
                                </div>
                              </div>
                            </div>

                            {/* DETAILED METRICS TABLE */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Hourly Flow Equivalent:</span>
                                <span className="font-mono font-bold">{calculatedResults.totalFlowM3h.toFixed(1)} m³/h</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">15-Min Peak Retention Vol:</span>
                                <span className="font-mono font-bold">{isSI ? `${calculatedResults.retentionVol15m.toFixed(1)} m³` : `${(calculatedResults.retentionVol15m / 0.00378541).toFixed(0)} Gal`}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">30-Min Peak Retention Vol:</span>
                                <span className="font-mono font-bold">{isSI ? `${calculatedResults.retentionVol30m.toFixed(1)} m³` : `${(calculatedResults.retentionVol30m / 0.00378541).toFixed(0)} Gal`}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Impervious Surface Ratio:</span>
                                <span className="font-mono font-bold">{calculatedResults.imperviousPercentage}%</span>
                              </div>
                              <div className="flex justify-between py-1 font-bold text-foreground">
                                <span>Recommended Storm Pipe:</span>
                                <span className="font-mono text-[#0A7BC7]">{isSI ? `DN ${calculatedResults.recommendedPipe.dn} mm` : `${calculatedResults.recommendedPipe.nps} NPS`} (~{calculatedResults.actualVelMps.toFixed(2)} m/s)</span>
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => setFormulaModalOpen(true)}
                            className="px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-foreground font-medium text-[13px]"
                          >
                            Calculation Preview
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleOpenComment("card-hero-results", "Sizing Results Summary")}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-[#0A7BC7] dark:text-sky-400 font-medium text-[13px]"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>

                  </div>
                </div>
              ) : (
                /* Printable Report tab view matching Preliminary Cooling Load standard */
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                    
                    {/* Header */}
                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          Storm Water Runoff Calculation Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Rational Method (Q = C × i × A) Catchment &amp; Drainage Sizing Analysis
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <span className="text-[11px] text-muted-foreground block">Date: {formatDateStr(new Date().toISOString())}</span>
                        <TBtn onClick={handleExportPDF} title="Export PDF Document">
                          <FileText className="size-3.5" /> Export
                        </TBtn>
                      </div>
                    </div>

                    
                    {/* Project Metadata Header Box (Canonical 2-column x 3-row format) */}
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b border-border divide-x divide-border">
                            <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                            <td className="p-2.5 font-mono text-foreground font-medium">
                              {(project as any)?.calcNo || `TRV-CAL-SWR-${(project?.id || "0000").slice(-4).toUpperCase()}`}
                            </td>
                            <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                            <td className="p-2.5 font-mono font-medium">
                              {formatDateStr(new Date().toISOString())}
                            </td>
                          </tr>
                          <tr className="border-b border-border divide-x divide-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                            <td className="p-2.5 font-mono">
                              {project?.code || (project?.id ? project.id.slice(0, 8) : "MEP-SWR-2026")}
                            </td>
                            <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                            <td className="p-2.5">{project?.client || "-"}</td>
                          </tr>
                          <tr className="divide-x divide-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                            <td className="p-2.5">{project?.name || "Storm Water Management"}</td>
                            <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                            <td className="p-2.5">{(project as any)?.endUser || (project as any)?.location || "-"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 1: Design Parameters & Overall Summary */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        1. Design Parameters &amp; Overall Summary
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border font-sans">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left">Design Parameter Description</th>
                            <th className="border border-border p-2 text-center w-36">Value</th>
                            <th className="border border-border p-2 text-center w-24">Unit</th>
                            <th className="border border-border p-2 text-left">Standard / Code Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                            <td className="border border-border p-2 font-bold">Total Catchment Zones</td>
                            <td className="border border-border p-2 text-center font-bold">{rows.length}</td>
                            <td className="border border-border p-2 text-center">zones</td>
                            <td className="border border-border p-2 text-muted-foreground">Architectural Catchment Schedule Inventory</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">Total Catchment Area</td>
                            <td className="border border-border p-2 text-center font-bold font-mono">{calculatedResults.totalArea.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "m²" : "ft²"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Sum of Scheduled Catchment Surface Areas</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">Composite Runoff Coefficient (C_avg)</td>
                            <td className="border border-border p-2 text-center font-bold font-mono">{calculatedResults.avgC.toFixed(2)}</td>
                            <td className="border border-border p-2 text-center">-</td>
                            <td className="border border-border p-2 text-muted-foreground">Area-Weighted Runoff Imperviousness Benchmark</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">Total Peak Runoff Discharge (Q)</td>
                            <td className="border border-border p-2 text-center font-bold font-mono text-[#06456F] dark:text-sky-400">{calculatedResults.totalFlow.toFixed(2)}</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? "L/s" : "GPM"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Rational Formula: Q = (C × i × A) / 3600</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                            <td className="border border-border p-2 font-bold">Hourly Flow Equivalent</td>
                            <td className="border border-border p-2 text-center font-bold font-mono">{calculatedResults.totalFlowM3h.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">m³/h</td>
                            <td className="border border-border p-2 text-muted-foreground">Volumetric Hourly Storm Drainage Flow Rate</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">6</td>
                            <td className="border border-border p-2 font-bold">15-Min Peak Retention Volume</td>
                            <td className="border border-border p-2 text-center font-bold font-mono">{isSI ? `${calculatedResults.retentionVol15m.toFixed(1)}` : `${(calculatedResults.retentionVol15m / 0.00378541).toFixed(0)}`}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "m³" : "Gal"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Short-duration Storm Attenuation / Sump Storage</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">7</td>
                            <td className="border border-border p-2 font-bold">30-Min Peak Retention Volume</td>
                            <td className="border border-border p-2 text-center font-bold font-mono">{isSI ? `${calculatedResults.retentionVol30m.toFixed(1)}` : `${(calculatedResults.retentionVol30m / 0.00378541).toFixed(0)}`}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "m³" : "Gal"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Extended Storm Retention &amp; Attenuation Basin</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">8</td>
                            <td className="border border-border p-2 font-bold">Impervious Surface Ratio</td>
                            <td className="border border-border p-2 text-center font-bold font-mono">{calculatedResults.imperviousPercentage}</td>
                            <td className="border border-border p-2 text-center">%</td>
                            <td className="border border-border p-2 text-muted-foreground">Percentage of Catchments with Runoff Coef C ≥ 0.80</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">9</td>
                            <td className="border border-border p-2 font-bold">Recommended Storm Drain Pipe</td>
                            <td className="border border-border p-2 text-center font-bold font-mono text-[#0A7BC7] dark:text-sky-400">{isSI ? `DN ${calculatedResults.recommendedPipe.dn} mm` : `${calculatedResults.recommendedPipe.nps} NPS`}</td>
                            <td className="border border-border p-2 text-center">~{calculatedResults.actualVelMps.toFixed(2)} m/s</td>
                            <td className="border border-border p-2 text-muted-foreground">Self-cleansing gravity velocity (~1.0 - 2.5 m/s)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 2: Comprehensive Catchment Runoff Schedule */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        2. Comprehensive Catchment Runoff Schedule
                      </h3>
                      <table className="w-full text-left text-[11px] border-collapse border border-border font-sans">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left">Catchment Area Name</th>
                            <th className="border border-border p-2 text-left">Surface Classification</th>
                            <th className="border border-border p-2 text-right w-28">Area ({isSI ? "m²" : "ft²"})</th>
                            <th className="border border-border p-2 text-center w-24">Runoff (C)</th>
                            <th className="border border-border p-2 text-right w-32">Intensity ({isSI ? "mm/hr" : "in/hr"})</th>
                            <th className="border border-border p-2 text-right w-28">Flow ({isSI ? "L/s" : "GPM"})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculatedResults.items.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="border border-border p-2 text-center text-muted-foreground">{idx + 1}</td>
                              <td className="border border-border p-2 font-medium">{r.name}</td>
                              <td className="border border-border p-2 text-muted-foreground capitalize">{r.surface.replace('_', ' ')}</td>
                              <td className="border border-border p-2 text-right font-mono">{r.area.toFixed(1)}</td>
                              <td className="border border-border p-2 text-center font-bold font-mono">{r.coef.toFixed(2)}</td>
                              <td className="border border-border p-2 text-right font-mono">{r.intensity.toFixed(1)}</td>
                              <td className="border border-border p-2 text-right font-mono font-bold text-[#06456F] dark:text-sky-400">{r.flow.toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="bg-[#DAE9F8] dark:bg-sky-950/60 font-bold text-foreground border-t-2 border-border">
                            <td colSpan={3} className="border border-border p-2 font-sans">TOTAL / COMPOSITE</td>
                            <td className="border border-border p-2 text-right font-mono">{calculatedResults.totalArea.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center font-mono">{calculatedResults.avgC.toFixed(2)}</td>
                            <td className="border border-border p-2 text-right font-mono">-</td>
                            <td className="border border-border p-2 text-right font-mono text-[#06456F] dark:text-sky-400">{calculatedResults.totalFlow.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 3: Engineering Design Standards & Compliance Guidelines */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        3. Engineering Design Standards &amp; Compliance Guidelines
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left w-64">Standard / Authority Reference</th>
                            <th className="border border-border p-2 text-left">Mandatory Engineering Compliance &amp; Criteria</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                            <td className="border border-border p-2 font-bold">ASCE / WEF Manual of Practice No. FD-28</td>
                            <td className="border border-border p-2 text-muted-foreground">Rational Method peak runoff computation methodology Q = (C × i × A) / 3600 for urban civil and building site stormwater discharge analysis.</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">BS EN 752 / BS EN 12056-3</td>
                            <td className="border border-border p-2 text-muted-foreground">Gravity drainage systems outside buildings and roof drainage design with self-cleansing velocity criteria.</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">Self-Cleansing Velocity Criteria</td>
                            <td className="border border-border p-2 text-muted-foreground">Target minimum self-cleansing velocity of 1.0 m/s and maximum scour limit of 2.5 m/s to prevent sediment deposit while preserving pipe wall integrity.</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">Attenuation &amp; Storage Sizing</td>
                            <td className="border border-border p-2 text-muted-foreground">15-minute and 30-minute peak storage volumes calculated for civil soakaways, detention tanks, and municipal discharge control.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Section 4: 3-Tier Workflow Approval & Sign-Off Block */}
                    <div className="space-y-2 pt-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        4. Workflow Review &amp; Sign-Off Verification
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-[12px]">
                        <div className="grid grid-cols-4 bg-[#FFE6CC] dark:bg-amber-950/50 text-foreground font-bold border-b border-border text-center py-2">
                          <div className="border-r border-border/80">Role</div>
                          <div className="border-r border-border/80">Originator</div>
                          <div className="border-r border-border/80">Reviewer</div>
                          <div>Approver</div>
                        </div>
                        <div className="grid grid-cols-4 border-b border-border divide-x divide-border">
                          <div className="p-2.5 font-bold text-muted-foreground text-right">Designation:</div>
                          <div className="p-2.5 text-center text-foreground font-medium">Design Engineer</div>
                          <div className="p-2.5 text-center text-foreground font-medium">Sr. Design Engineer</div>
                          <div className="p-2.5 text-center text-foreground font-medium">Discipline Coordinator</div>
                        </div>
                        <div className="grid grid-cols-4 border-b border-border divide-x divide-border">
                          <div className="p-2.5 font-bold text-muted-foreground text-right">Name:</div>
                          <div className="p-2.5 text-center font-semibold text-foreground">{sigDetails.originatedName || currentUserName}</div>
                          <div className="p-2.5 text-center font-semibold text-foreground">{sigDetails.reviewerName || "-"}</div>
                          <div className="p-2.5 text-center font-semibold text-foreground">{sigDetails.approverName || "-"}</div>
                        </div>
                        <div className="grid grid-cols-4 border-b border-border divide-x divide-border">
                          <div className="p-2.5 font-bold text-muted-foreground text-right">Date:</div>
                          <div className="p-2.5 text-center text-muted-foreground">{sigDetails.originatedDate || formatDateStr(new Date().toISOString())}</div>
                          <div className="p-2.5 text-center text-muted-foreground">{sigDetails.reviewerDate || "-"}</div>
                          <div className="p-2.5 text-center text-muted-foreground">{sigDetails.approverDate || "-"}</div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-border bg-slate-50/50 dark:bg-zinc-900/40">
                          <div className="p-2.5 font-bold text-muted-foreground text-right">Status:</div>
                          <div className="p-2.5 text-center text-emerald-600 font-bold">Prepared</div>
                          <div className="p-2.5 text-center font-bold">
                            {sigDetails.reviewerName ? (
                              <span className="text-indigo-600 dark:text-indigo-400">Reviewed</span>
                            ) : (
                              <span className="text-muted-foreground font-normal">Pending Review</span>
                            )}
                          </div>
                          <div className="p-2.5 text-center font-bold">
                            {sigDetails.approverName ? (
                              <span className="text-emerald-600 dark:text-emerald-400">Approved</span>
                            ) : (
                              <span className="text-muted-foreground font-normal">Pending Approval</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Intelligence Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col"
              : "w-0"
          }`}
        >
          {intelOpen && (
            <StormWaterIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              rows={rows}
              setRows={setRows}
              calculatedResults={calculatedResults}
              unitSystem={unitSystem}
              isLocked={isEffectiveReadOnly}
              commentsList={commentsList}
              onOpenComment={handleOpenComment}
              onOpenFormula={() => setFormulaModalOpen(true)}
              onNavigateToField={handleNavigateToField}
            />
          )}
        </div>
      </div>

      {/* Mathematical Formula Breakdown Modal */}
      {formulaModalOpen && (
        <StormWaterFormulaModal onClose={() => setFormulaModalOpen(false)} />
      )}

      {/* Edit Catchment Modal */}
      {editingCatchment && (
        <EditCatchmentModal
          catchment={editingCatchment}
          isSI={isSI}
          onClose={() => setEditingCatchment(null)}
          onSave={handleUpdateCatchment}
        />
      )}

      {/* Assign Comment Modal */}
      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        onSave={handleSaveComment}
        targetItem={commentTargetItem?.name || "Parameter"}
        calculatorPath="/plumbing-storm-water"
        targetId={commentTargetItem?.id}
      />
    </AppShell>
  );
}

// ==========================================
// STORM WATER INTELLIGENCE DRAWER COMPONENT
// ==========================================

interface StormWaterIntelligenceDrawerProps {
  onClose: () => void;
  rows: CatchmentRow[];
  setRows: (r: CatchmentRow[]) => void;
  calculatedResults: any;
  unitSystem: "si" | "ip";
  isLocked: boolean;
  commentsList: any[];
  onOpenComment: (id: string, name: string) => void;
  onOpenFormula: () => void;
  onNavigateToField: (targetId: string) => void;
}

function StormWaterIntelligenceDrawer({
  onClose,
  rows,
  setRows,
  calculatedResults,
  unitSystem,
  isLocked,
  commentsList,
  onOpenComment,
  onOpenFormula,
  onNavigateToField,
}: StormWaterIntelligenceDrawerProps) {
  const isSI = unitSystem === "si";

  // Compliance Checks
  const isPipeSized = calculatedResults.recommendedPipe?.dn >= 100;
  const isVelocityOk = calculatedResults.actualVelMps >= 0.8 && calculatedResults.actualVelMps <= 2.8;
  const isRunoffCoefRealistic = calculatedResults.avgC >= 0.2 && calculatedResults.avgC <= 0.98;
  const hasCatchments = rows.length > 0;

  const checks = [isPipeSized, isVelocityOk, isRunoffCoefRealistic, hasCatchments];
  const passedCount = checks.filter(Boolean).length;
  const complianceScore = Math.round((passedCount / checks.length) * 100);

  // Diagnostics & Warnings
  const auditWarnings = useMemo(() => {
    const warnings: { title: string; desc: string; type: "warning" | "info" | "pass" }[] = [];

    if (calculatedResults.avgC > 0.85) {
      warnings.push({
        title: "High Runoff Potential",
        desc: `Composite coefficient (${calculatedResults.avgC.toFixed(2)}) indicates highly impervious surfaces. On-site attenuation tank or detention pond is recommended.`,
        type: "warning",
      });
    } else {
      warnings.push({
        title: "Moderate Infiltration Rate",
        desc: `Composite coefficient (${calculatedResults.avgC.toFixed(2)}) incorporates pervious ground buffering.`,
        type: "pass",
      });
    }

    if (calculatedResults.actualVelMps < 0.8 && calculatedResults.totalFlowSI > 0) {
      warnings.push({
        title: "Low Pipe Velocity Alert",
        desc: `Discharge velocity (${calculatedResults.actualVelMps.toFixed(2)} m/s) is under 0.8 m/s self-cleansing threshold. Consider reducing pipe size or increasing slope.`,
        type: "warning",
      });
    } else if (calculatedResults.actualVelMps > 2.5) {
      warnings.push({
        title: "High Velocity Scour Risk",
        desc: `Discharge velocity (${calculatedResults.actualVelMps.toFixed(2)} m/s) exceeds 2.5 m/s. Install energy dissipator at storm outfall.`,
        type: "warning",
      });
    } else {
      warnings.push({
        title: "Optimal Self-Cleansing Velocity",
        desc: `Pipe velocity is optimal for solids transport without pipe scouring.`,
        type: "pass",
      });
    }

    return warnings;
  }, [calculatedResults]);

  // Rainwater Harvesting Analytics
  const harvestingAnalytics = useMemo(() => {
    const annualRainfallMm = 750; // standard average mm/yr
    const runoffHarvestM3 = (calculatedResults.totalArea * (annualRainfallMm / 1000) * calculatedResults.avgC * 0.85);
    const costPerM3 = 2.20; // $2.20 / m³ municipal water
    const annualSavings = runoffHarvestM3 * costPerM3;

    return {
      annualRainfallMm,
      annualHarvestM3: Math.round(runoffHarvestM3),
      annualSavings: Math.round(annualSavings),
    };
  }, [calculatedResults.totalArea, calculatedResults.avgC]);

  // 1-Click Engineering Presets
  const presets = [
    {
      id: "commercial-plaza",
      name: "Commercial Plaza & Parking Deck",
      category: "Commercial Mixed-Use",
      desc: "1200m² Concrete Roof, 800m² Asphalt Parking, 300m² Brick Pavers, 50 mm/hr intensity.",
      apply: () => {
        setRows([
          { id: "1", name: "Main Tower Roof", area: 1200, surface: "concrete", coef: 0.95, intensity: 50 },
          { id: "2", name: "Asphalt Parking Lot", area: 800, surface: "asphalt", coef: 0.95, intensity: 50 },
          { id: "3", name: "Pedestrian Brick Plaza", area: 300, surface: "brick", coef: 0.85, intensity: 50 },
          { id: "4", name: "Perimeter Landscaping", area: 200, surface: "sandy_soil", coef: 0.20, intensity: 50 },
        ]);
        dirtyStore.set(true);
        toast.success("Applied Commercial Plaza Preset!");
      }
    },
    {
      id: "residential-villa",
      name: "Residential Villa & Garden",
      category: "Residential Low-Rise",
      desc: "350m² Villa Roof, 150m² Driveway, 400m² Lawn & Garden, 45 mm/hr intensity.",
      apply: () => {
        setRows([
          { id: "1", name: "Villa Roof & Terraces", area: 350, surface: "concrete", coef: 0.95, intensity: 45 },
          { id: "2", name: "Concrete Driveway", area: 150, surface: "concrete", coef: 0.95, intensity: 45 },
          { id: "3", name: "Lawn & Garden Beds", area: 400, surface: "clay_soil", coef: 0.85, intensity: 45 },
        ]);
        dirtyStore.set(true);
        toast.success("Applied Residential Villa Preset!");
      }
    },
    {
      id: "industrial-warehouse",
      name: "Industrial Warehouse Facility",
      category: "Industrial Logistics",
      desc: "3500m² Metal Sheet Roof, 2500m² Heavy Concrete Yard, 60 mm/hr intensity.",
      apply: () => {
        setRows([
          { id: "1", name: "Warehouse Metal Roof", area: 3500, surface: "concrete", coef: 0.95, intensity: 60 },
          { id: "2", name: "Truck Loading Apron", area: 2500, surface: "concrete", coef: 0.95, intensity: 60 },
        ]);
        dirtyStore.set(true);
        toast.success("Applied Industrial Warehouse Preset!");
      }
    },
    {
      id: "sports-complex",
      name: "Sports Complex & Pavilion",
      category: "Recreational Park",
      desc: "500m² Pavilion Roof, 600m² Pavers, 4000m² Athletic Turf, 40 mm/hr intensity.",
      apply: () => {
        setRows([
          { id: "1", name: "Clubhouse Pavilion", area: 500, surface: "concrete", coef: 0.95, intensity: 40 },
          { id: "2", name: "Porous Brick Pathways", area: 600, surface: "brick", coef: 0.85, intensity: 40 },
          { id: "3", name: "Athletic Playing Turf", area: 4000, surface: "agricultural", coef: 0.30, intensity: 40 },
        ]);
        dirtyStore.set(true);
        toast.success("Applied Sports Complex Preset!");
      }
    },
  ];

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in select-none">
      {/* Header matching Ventilation and Pump Sizing */}
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {/* Drawer Scrollable Content */}
      <div className="flex-1 overflow-auto">
        {/* Compliance Status Section */}
        <IntelSection icon={CheckCircle2} tone={complianceScore >= 80 ? "success" : "warning"} title="Compliance Status">
          <div className="text-[12px] text-muted-foreground">
            Rational Method verification per ASCE, BS EN 752 &amp; IPC Table 1106.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${complianceScore >= 80 ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${complianceScore}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px] font-semibold">{complianceScore}%</span>
          </div>
        </IntelSection>

        {/* Hydraulic & Storm Pipe Sizing Audit */}
        <IntelSection icon={Activity} tone="primary" title="Storm Pipe & Hydraulic Audit">
          <div className="p-2.5 rounded-xl border border-primary/20 bg-primary/5 text-foreground flex flex-col gap-1 mb-2.5">
            <div className="flex items-center justify-between font-semibold text-[11.5px]">
              <span>Recommended Storm Drain</span>
              <span className="font-mono font-bold text-primary text-[12.5px]">
                {isSI ? `DN ${calculatedResults.recommendedPipe.dn} mm` : `${calculatedResults.recommendedPipe.nps} NPS`}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Calculated velocity is <strong className="text-foreground">{calculatedResults.actualVelMps.toFixed(2)} m/s</strong> (recommended 1.0–2.5 m/s prevents silting).
            </p>
          </div>
          <KV
            k="Total Runoff Peak Flow"
            v={`${calculatedResults.totalFlow.toFixed(2)} ${isSI ? "L/s" : "GPM"} (${calculatedResults.totalFlowM3h.toFixed(1)} m³/h)`}
          />
          <KV
            k="Weighted Runoff (C_avg)"
            v={calculatedResults.avgC.toFixed(2)}
          />
          <KV
            k="Total Drainage Area"
            v={`${calculatedResults.totalArea.toFixed(1)} ${isSI ? "m²" : "ft²"}`}
          />
        </IntelSection>

        {/* Retention & Attenuation Sizing */}
        <IntelSection icon={Layers} tone="primary" title="Retention & Attenuation Sizing">
          <KV
            k="15-Minute Peak Volume"
            v={isSI ? `${calculatedResults.retentionVol15m.toFixed(1)} m³` : `${(calculatedResults.retentionVol15m / 0.00378541).toFixed(0)} Gal`}
          />
          <KV
            k="30-Minute Peak Volume"
            v={isSI ? `${calculatedResults.retentionVol30m.toFixed(1)} m³` : `${(calculatedResults.retentionVol30m / 0.00378541).toFixed(0)} Gal`}
          />
          <KV
            k="Impervious Surface Split"
            v={`${calculatedResults.imperviousPercentage}% / ${100 - calculatedResults.imperviousPercentage}%`}
          />
        </IntelSection>

        {/* Engineering Diagnostics & Warnings */}
        <IntelSection
          icon={auditWarnings.some(w => w.type === "warning") ? AlertTriangle : ShieldCheck}
          tone={auditWarnings.some(w => w.type === "warning") ? "warning" : "success"}
          title="Engineering Diagnostics"
        >
          <div className="space-y-2 mt-1">
            {auditWarnings.map((w, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                  w.type === "warning"
                    ? "border-amber-500/25 bg-amber-500/5 text-amber-900 dark:text-amber-200"
                    : w.type === "info"
                    ? "border-blue-500/25 bg-blue-500/5 text-blue-900 dark:text-blue-200"
                    : "border-emerald-500/20 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
                }`}
              >
                {w.type === "warning" ? (
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                ) : w.type === "info" ? (
                  <Info className="size-4 shrink-0 mt-0.5 text-blue-500" />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[11.5px] leading-tight">{w.title}</div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">{w.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </IntelSection>

        {/* 1-Click Engineering Presets */}
        <IntelSection icon={Sliders} tone="primary" title="1-Click Engineering Presets">
          <div className="space-y-2 mt-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                disabled={isLocked}
                onClick={preset.apply}
                className="w-full text-left p-2.5 rounded-xl border border-border hover:border-primary/40 bg-surface-2/50 hover:bg-surface-2 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11.5px] text-foreground group-hover:text-primary transition-colors">
                    {preset.name}
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    {preset.category}
                  </span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-1 leading-snug">
                  {preset.desc}
                </p>
              </button>
            ))}
          </div>
        </IntelSection>

        {/* Active Comments & Assigned Tasks */}
        {commentsList && commentsList.length > 0 && (
          <IntelSection icon={MessageSquare} tone="muted" title="Active Comments & Tasks">
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar mt-1">
              {commentsList.map((c, idx) => (
                <div
                  key={c.id || idx}
                  onClick={() => {
                    const target = c.targetId || c.spaceId || c.itemId;
                    if (target) onNavigateToField(target);
                  }}
                  className="p-2 rounded-lg bg-surface-2 border border-border/70 hover:border-primary/50 transition cursor-pointer text-xs group"
                >
                  <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground mb-0.5">
                    <span className="text-foreground group-hover:text-primary transition-colors font-semibold">
                      {c.targetName || c.spaceName || "Catchment"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{c.authorName || "Engineer"}</span>
                  </div>
                  <p className="text-[11px] text-foreground/90 line-clamp-2 leading-relaxed">{c.text}</p>
                </div>
              ))}
            </div>
          </IntelSection>
        )}

        {/* Rainwater Harvesting Analytics */}
        <IntelSection icon={TrendingDown} tone="success" title="Rainwater Harvesting Yield">
          <KV k="Est. Annual Rainfall" v={`${harvestingAnalytics.annualRainfallMm} mm/yr`} />
          <KV k="Harvestable Yield (@ 85%)" v={`~${harvestingAnalytics.annualHarvestM3.toLocaleString()} m³/yr`} />
          <KV k="Potential Utility Savings" v={`~$${harvestingAnalytics.annualSavings.toLocaleString()}/yr`} />
        </IntelSection>

        {/* Optimization Suggestions */}
        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Install an on-site attenuation storage tank to throttle peak discharge into the public sewer.</li>
            <li>Incorporate permeable interlocking pavers or gravel infiltration trenches (SUDS).</li>
            <li>Provide hydrodynamic oil &amp; grit separators to capture sediment before discharge.</li>
          </ul>
        </IntelSection>

        {/* Engineering Notes & Derivations */}
        <IntelSection icon={Info} tone="muted" title="Engineering Notes">
          <div className="text-[12px] text-muted-foreground mb-2.5">
            Sized per Rational Method equation Q = C × i × A / 3600 (SI units) and Manning's storm pipe formula.
          </div>
          <button
            type="button"
            onClick={onOpenFormula}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-sm cursor-pointer"
          >
            <Eye className="size-3.5" />
            <span>View Step-by-Step Derivations</span>
          </button>
        </IntelSection>
      </div>
    </div>
  );
}

// ==========================================
// FORMULA BREAKDOWN MODAL COMPONENT
// ==========================================

function StormWaterFormulaModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Rational Method Mathematical Derivation</h3>
              <p className="text-xs text-muted-foreground">Standardized storm water runoff hydraulic equations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground font-mono">
          
          <div className="space-y-3">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary text-sm">1. RATIONAL METHOD PEAK RUNOFF FLOW (Q)</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl space-y-1.5">
              <p className="font-bold text-foreground">In SI Units:</p>
              <p className="text-primary font-bold text-sm">Q = (C × i × A) / 3600</p>
              <p className="text-muted-foreground text-[11px]">Where:</p>
              <ul className="list-disc pl-5 text-muted-foreground text-[11px] space-y-1">
                <li><strong>Q</strong> = Peak runoff rate (L/s)</li>
                <li><strong>C</strong> = Dimensionless runoff coefficient (0.20 to 0.95)</li>
                <li><strong>i</strong> = Rainfall intensity for design return period (mm/hr)</li>
                <li><strong>A</strong> = Catchment surface area (m²)</li>
                <li><strong>3600</strong> = Unit conversion factor (3600 s/hr)</li>
              </ul>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 mt-2">
              <p className="font-bold text-foreground">In IP / US Customary Units:</p>
              <p className="text-primary font-bold text-sm">Q = C × i × A</p>
              <p className="text-muted-foreground text-[11px]">Where Q is in cfs (converted to GPM by multiplying by 448.83), i is in in/hr, and A is in acres.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary text-sm">2. COMPOSITE WEIGHTED RUNOFF COEFFICIENT (C_avg)</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl space-y-1.5">
              <p className="text-primary font-bold text-sm">C_avg = Σ(C_k × A_k) / Σ(A_k)</p>
              <p className="text-muted-foreground text-[11px]">
                Accounts for mixed catchment areas (e.g. roofs, asphalt parking, interlocking brick, and pervious landscaped grounds).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary text-sm">3. DISCHARGE PIPE SIZING (CONTINUITY & VELOCITY)</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl space-y-1.5">
              <p className="text-primary font-bold text-sm">D = √ [ (4 × Q_m3s) / (π × V_target) ]</p>
              <p className="text-muted-foreground text-[11px]">
                Target design velocity V_target is 1.5 m/s (5.0 ft/s) to ensure self-cleansing velocity (&gt; 0.8 m/s) without pipe wall scour (&lt; 2.5 m/s).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary text-sm">4. RETENTION & ATTENUATION STORAGE</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl space-y-1.5">
              <p className="text-primary font-bold text-sm">V_storage = Q_runoff × t_storm - Q_allowable × t_storm</p>
              <p className="text-muted-foreground text-[11px]">
                Provides on-site attenuation buffering for 15-minute and 30-minute peak storm runoff surges before discharging to municipal drainage.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function IntelSection({ icon: Icon, title, tone, children }: { icon: any; title: string; tone: "success" | "warning" | "primary" | "muted"; children: React.ReactNode }) {
  const color =
    tone === "success" ? "text-emerald-500" :
      tone === "warning" ? "text-amber-500" :
        tone === "primary" ? "text-primary" : "text-muted-foreground";
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
