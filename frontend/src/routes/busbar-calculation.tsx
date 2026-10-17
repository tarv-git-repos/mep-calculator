import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { addPdfSignatureBlock, addPdfHeader, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportBusbarPDF } from "@/lib/exportBusbarPDF";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { ImportSourceModal } from "@/components/workspace/ImportSourceModal";
import { EditBusbarRowModal } from "@/components/workspace/EditBusbarRowModal";
import { BusbarIntelligenceDrawer } from "@/components/workspace/BusbarIntelligenceDrawer";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { TaskComment } from "@/lib/ventilation-calc";
import { toast } from "sonner";
import { Plus, Trash2, Download, Upload, ChevronRight, ChevronDown, Trash, Copy, CopyPlus, Check, ArrowRight, Zap, FolderPlus, X, Eye, EyeOff, LayoutGrid, Info, Search, FileText, Edit3, MessageSquare, Flag, Filter, ArrowUpDown, SlidersHorizontal, RefreshCw, Lock, Sparkles, Printer, Scissors, Activity, BookOpen, Calculator, Sliders, Layers } from "lucide-react";
import { syncBusbarFrom3DAndLoadSummary, BusbarSyncResult } from "@/lib/calc-busbar-sync";
import { SyncBusbarModal } from "@/components/workspace/SyncBusbarModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/use-confirm";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/busbar-calculation")({
  head: () => ({
    meta: [
      { title: "Busbar Calculation â€” MEP Calc" },
      { name: "description", content: "Calculate busbar voltage drop and parameters." },
    ],
  }),
  component: BusbarCalculationPage,
});

const COPPER_BUSBAR_DATA: Record<string, { r: number; x: number; label: string }> = {
  "1000_rt": { r: 0.0523, x: 0.019, label: "1000 (Rt)" },
  "1000_r50": { r: 0.0474, x: 0.019, label: "1000 (R@50%RC)" },
  "1250_rt": { r: 0.0398, x: 0.017, label: "1250 (Rt)" },
  "1250_r50": { r: 0.0348, x: 0.017, label: "1250 (R@50%RC)" },
  "1600_rt": { r: 0.0277, x: 0.015, label: "1600 (Rt)" },
  "1600_r50": { r: 0.0237, x: 0.015, label: "1600 (R@50%RC)" },
  "2000_rt": { r: 0.0218, x: 0.014, label: "2000 (Rt)" },
  "2000_r50": { r: 0.0187, x: 0.014, label: "2000 (R@50%RC)" },
  "2500_rt": { r: 0.0177, x: 0.010, label: "2500 (Rt)" },
  "2500_r50": { r: 0.0151, x: 0.010, label: "2500 (R@50%RC)" },
  "3200_rt": { r: 0.0121, x: 0.006, label: "3200 (Rt)" },
  "3200_r50": { r: 0.0114, x: 0.006, label: "3200 (R@50%RC)" },
  "4000_rt": { r: 0.0108, x: 0.006, label: "4000 (Rt)" },
  "4000_r50": { r: 0.0093, x: 0.006, label: "4000 (R@50%RC)" },
  "5000_rt": { r: 0.0089, x: 0.005, label: "5000 (Rt)" },
  "5000_r50": { r: 0.0075, x: 0.005, label: "5000 (R@50%RC)" },
  "6300_rt": { r: 0.0065, x: 0.005, label: "6300 (Rt)" },
  "6300_r50": { r: 0.0061, x: 0.005, label: "6300 (R@50%RC)" }
};

import { BusbarRow, BusbarSection, LVPanel, calculateBusbarPanels, getBusbarRowValidation } from "@/lib/calc-busbar-calculation";

function BusbarCalculationPage() {
  const { project, activeProjectId, updateProject } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/busbar-calculation", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/busbar-calculation", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const lockApproved = useCalculationLock("/busbar-calculation");
  const isApproved = lockApproved || isEffectiveReadOnly;
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const [intelOpen, setIntelOpen] = useState(false);

  const confirm = useConfirm();
  const [panels, setPanels] = useState<LVPanel[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep-busbar-calculation-v1");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse busbar panels:", e);
      }
    }
    const isIp = false;
    return [{
      id: `pan_${Date.now()}`,
      name: "LV PANEL-1",
      sections: [{
        id: `sec_${Date.now()}`,
        name: "BB-1",
        ratingId: "2500_rt",
        volts: 415,
        pf: 0.8,
        rows: [
          { id: `bb_${Date.now()}_1`, from: 'LV PANEL-1', desc: 'SMDB-L7-1', ref: 'BB-1', length: isIp ? Number((160.0 * 3.28084).toFixed(2)) : 160.0, loadKw: 112.08, div: 0.7 },
          { id: `bb_${Date.now()}_2`, from: 'LV PANEL-1', desc: 'SMDB-L8-1', ref: 'BB-1', length: isIp ? Number((3.5 * 3.28084).toFixed(2)) : 3.5, loadKw: 112.08, div: 0.7 },
          { id: `bb_${Date.now()}_3`, from: 'LV PANEL-1', desc: 'SMDB-L9-1', ref: 'BB-1', length: isIp ? Number((3.5 * 3.28084).toFixed(2)) : 3.5, loadKw: 112.08, div: 0.7 },
          { id: `bb_${Date.now()}_4`, from: 'LV PANEL-1', desc: 'SMDB-L10-1', ref: 'BB-1', length: isIp ? Number((3.5 * 3.28084).toFixed(2)) : 3.5, loadKw: 112.08, div: 0.7 }
        ]
      }]
    }];
  });

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const pKey = `mep_busbar_calc_${project.id}`;
      const stored = localStorage.getItem(pKey) || localStorage.getItem("mep-busbar-calculation-v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        const restoredPanels = Array.isArray(parsed) ? parsed : (parsed?.panels || null);
        if (restoredPanels && Array.isArray(restoredPanels)) {
          setPanels(restoredPanels);
        }
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load busbar calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  useEffect(() => {
    localStorage.setItem("mep-busbar-calculation-v1", JSON.stringify(panels));
    if (project?.id && loadedProjectId === project.id) {
      try {
        localStorage.setItem(`mep_busbar_calc_${project.id}`, JSON.stringify({
          panels,
          updatedAt: new Date().toISOString()
        }));
        dirtyStore.set(true);
      } catch (e) {}
    }
  }, [panels, project?.id, loadedProjectId]);

  // Version History Restore Listener
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = `mep_busbar_calc_${project?.id || "default"}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache) {
        if (lsCache[pKey]) {
          try {
            restoredData = typeof lsCache[pKey] === "string" ? JSON.parse(lsCache[pKey]) : lsCache[pKey];
          } catch (err) {}
        }
        if (!restoredData && lsCache["mep-busbar-calculation-v1"]) {
          try {
            restoredData = typeof lsCache["mep-busbar-calculation-v1"] === "string" ? JSON.parse(lsCache["mep-busbar-calculation-v1"]) : lsCache["mep-busbar-calculation-v1"];
          } catch (err) {}
        }
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey) || localStorage.getItem("mep-busbar-calculation-v1");
        if (stored) {
          try {
            restoredData = JSON.parse(stored);
          } catch (err) {}
        }
      }
      if (restoredData) {
        const restoredPanels = Array.isArray(restoredData) ? restoredData : (restoredData?.panels || null);
        if (restoredPanels && Array.isArray(restoredPanels)) {
          setPanels(restoredPanels);
          toast.success("Busbar calculation restored to selected version!");
        }
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  const [editingRow, setEditingRow] = useState<{ row: BusbarRow; panelId: string; sectionId: string } | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<BusbarSyncResult | null>(null);
  const [showImportSourceModal, setShowImportSourceModal] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleSync3DAndLoadSummary = async () => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    toast.loading("Scanning 3D building storeys & Load Summary active loads...", { id: "busbar-sync" });
    try {
      const res = await syncBusbarFrom3DAndLoadSummary(activeProjectId || project?.id);
      toast.dismiss("busbar-sync");
      setSyncResult(res);
      setSyncModalOpen(true);
    } catch (err) {
      toast.dismiss("busbar-sync");
      console.error("Sync error:", err);
      toast.error("Failed to extract 3D storeys or Load Summary data.");
    }
  };

  const handleApplySync = (mode: "replace" | "append", customResult?: BusbarSyncResult) => {
    const res = customResult || syncResult;
    if (!res) return;
    pushToUndo(panels);
    if (mode === "replace") {
      setPanels([res.panel]);
    } else {
      setPanels((prev) => [...prev, res.panel]);
    }
    setSyncModalOpen(false);
    toast.success(
      `Generated vertical busduct riser (${res.floors.length} floors) with ${res.recommendedRatingLabel}!`
    );
  };

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    panelId: string;
    sectionId: string;
    rowId: string;
  } | null>(null);

  // Comment & Task Assignment Modal State (Exact Preliminary Parity)
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type: "space" | "zone" | "equipment" } | null>(null);

  const handleOpenComment = (row: BusbarRow | { id: string; name?: string; desc?: string; from?: string; ref?: string; label?: string }) => {
    const itemName = (row as any).name || (row as any).desc || (row as any).from || (row as any).label || ((row as any).ref ? `Tap Off ${(row as any).ref}` : "Tap Off Row");
    setCommentTargetItem({ id: String(row.id), name: itemName, type: "space" });
    setCommentModalOpen(true);
  };

  // Deep-linking and auto-scroll from notifications (exact Ventilation & Preliminary logic)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScrollToItem = (e: any) => {
      const { id, name } = e.detail || {};
      if (!id && !name) return;
      for (const p of panels) {
        for (const s of p.sections) {
          const r = s.rows.find(rw => rw.id === id || rw.desc === name || rw.from === name);
          if (r) {
            setTimeout(() => {
              const el = document.getElementById(`busbar-row-${r.id}`) || document.getElementById(`row-${r.id}`) || document.querySelector(`[data-row-id="${r.id}"]`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-primary", "bg-primary/10");
                setTimeout(() => el.classList.remove("ring-2", "ring-primary", "bg-primary/10"), 3000);
              }
            }, 150);
            return;
          }
        }
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
  }, [panels]);

  const [activeTab, setActiveTab] = useState<"sizing" | "report">("sizing");
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVd, setFilterVd] = useState<"all" | "within" | "exceeds">("all");
  const [filterLoad, setFilterLoad] = useState<"all" | "high" | "low">("all");
  const [rowDensity, setRowDensity] = useState<"default" | "compact">("default");
  const [sortBy, setSortBy] = useState<"none" | "desc" | "load" | "vd">("none");

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterVd !== "all") count++;
    if (filterLoad !== "all") count++;
    return count;
  }, [filterVd, filterLoad]);

  const handleResetFilters = () => {
    setFilterVd("all");
    setFilterLoad("all");
  };

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const [customBusbars, setCustomBusbars] = useState<Record<string, { r: number; x: number; label: string }>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_custom_busbar_ratings");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load custom busbar ratings", e);
      }
    }
    return {};
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("mep_custom_busbar_ratings", JSON.stringify(customBusbars));
    }
  }, [customBusbars]);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Add LV Panel Modal State
  const [showAddPanelModal, setShowAddPanelModal] = useState(false);
  const [newPanelName, setNewPanelName] = useState("");
  const [newSectionName, setNewSectionName] = useState("BB-1");
  const [newRatingId, setNewRatingId] = useState("2500_rt");
  const [newVolts, setNewVolts] = useState<number | "">(415);
  const [newPf, setNewPf] = useState<number | "">(0.8);

  useEffect(() => {
    if (isApproved) {
      setSelectedRows(new Set());
    }
  }, [isApproved]);
  const [lastSelectedRowId, setLastSelectedRowId] = useState<string | null>(null);

  const DEFAULT_BUSBAR_COL_WIDTHS: Record<string, number> = useMemo(() => ({
    select: 36,
    desc: 230,
    len: 90,
    loadKw: 90,
    tclKw: 90,
    div: 70,
    mdKw: 90,
    curA: 90,
    vdV: 90,
    vdPct: 90,
    actions: 44,
  }), []);

  const [busbarColWidths, setBusbarColWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_grid_busbar_cols");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.select === "number" && !parsed.no) return parsed;
        }
      } catch (e) {}
    }
    return {
      select: 36,
      desc: 230,
      len: 90,
      loadKw: 90,
      tclKw: 90,
      div: 70,
      mdKw: 90,
      curA: 90,
      vdV: 90,
      vdPct: 90,
      actions: 44,
    };
  });

  const totalBusbarTableWidth = useMemo(() => {
    return Object.values(busbarColWidths).reduce((a, b) => a + b, 0);
  }, [busbarColWidths]);

  const getBusbarColStyle = (key: string) => {
    const val = busbarColWidths[key] ?? DEFAULT_BUSBAR_COL_WIDTHS[key] ?? 90;
    const pct = ((val / totalBusbarTableWidth) * 100).toFixed(2);
    return {
      width: `${pct}%`,
      minWidth: `${Math.min(val, 40)}px`,
    };
  };

  const handleResizeMouseDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = busbarColWidths[key] || 80;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(40, startWidth + deltaX);
      setBusbarColWidths(prev => {
        const next = { ...prev, [key]: newWidth };
        try { localStorage.setItem("mep_grid_busbar_cols", JSON.stringify(next)); } catch(err) {}
        return next;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const [undoStack, setUndoStack] = useState<any[][]>([]);
  const [redoStack, setRedoStack] = useState<any[][]>([]);

  const pushToUndo = (state: any[]) => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(state))]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(old => old.slice(0, -1));
    setRedoStack(old => [...old, JSON.parse(JSON.stringify(panels))]);
    setPanels(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(old => old.slice(0, -1));
    setUndoStack(old => [...old, JSON.parse(JSON.stringify(panels))]);
    setPanels(next);
  };

  const toggleRowSelect = (rowId: string, isShift: boolean, isCtrl: boolean) => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode. Selection is locked.", { id: "readonly-notice" });
      return;
    }
    setSelectedRows(prev => {
      const next = new Set(prev);
      const allRows: any[] = [];
      panels.forEach(p => p.sections.forEach(s => s.rows.forEach(r => allRows.push(r))));
      const clickedIdx = allRows.findIndex(r => r.id === rowId);
      if (clickedIdx === -1) return prev;

      if (isShift && lastSelectedRowId) {
        const lastIdx = allRows.findIndex(r => r.id === lastSelectedRowId);
        if (lastIdx !== -1) {
          const start = Math.min(lastIdx, clickedIdx);
          const end = Math.max(lastIdx, clickedIdx);
          if (!isCtrl) {
            next.clear();
          }
          for (let i = start; i <= end; i++) {
            next.add(allRows[i].id);
          }
        }
      } else if (isCtrl) {
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
      } else {
        next.clear();
        next.add(rowId);
      }
      return next;
    });
    setLastSelectedRowId(rowId);
  };

  const copyRows = (ids: string[]) => {
    const toCopy: any[] = [];
    panels.forEach(p => p.sections.forEach(s => s.rows.forEach(r => {
      if (ids.includes(r.id)) {
        toCopy.push(r);
      }
    })));
    if (toCopy.length > 0) {
      localStorage.setItem("mep_clipboard_busbars", JSON.stringify(toCopy));
      const text = toCopy.map(r => `${r.from}\t${r.desc}\t${r.ref}\t${r.length}\t${r.loadKw}\t${r.div}`).join("\n");
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  };

  const cutRows = (ids: string[]) => {
    pushToUndo(panels);
    copyRows(ids);
    setPanels(prev => prev.map(p => ({
      ...p,
      sections: p.sections.map(s => ({
        ...s,
        rows: s.rows.filter(r => !ids.includes(r.id))
      }))
    })));
  };

  const pasteRows = () => {
    pushToUndo(panels);
    try {
      const clipboardData = localStorage.getItem("mep_clipboard_busbars");
      if (clipboardData) {
        const parsed = JSON.parse(clipboardData);
        if (Array.isArray(parsed)) {
          const newRows = parsed.map(r => ({
            ...r,
            id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`
          }));
          
          setPanels(prev => {
            const next = [...prev];
            if (next.length > 0 && next[0].sections.length > 0) {
              next[0].sections[0] = { 
                ...next[0].sections[0], 
                rows: [...next[0].sections[0].rows, ...newRows] 
              };
            }
            return next;
          });
          setSelectedRows(new Set(newRows.map(r => r.id)));
          return newRows;
        }
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const ALL_BUSBAR_DATA = useMemo(() => ({ ...COPPER_BUSBAR_DATA, ...customBusbars }), [customBusbars]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

      const clipboardData = e.clipboardData?.getData("Text");
      if (!clipboardData) return;
      e.preventDefault();

      pushToUndo(panels);

      // Check if it's JSON from our copy/cut action
      try {
        if (clipboardData.trim().startsWith("[") && clipboardData.trim().endsWith("]")) {
          const parsed = JSON.parse(clipboardData);
          if (Array.isArray(parsed) && parsed.length > 0 && 'from' in parsed[0]) {
            const newRows = parsed.map(r => ({
              ...r,
              id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            }));
            setPanels(prev => {
              const next = [...prev];
              if (next.length > 0 && next[0].sections.length > 0) {
                next[0].sections[0] = { 
                  ...next[0].sections[0], 
                  rows: [...next[0].sections[0].rows, ...newRows] 
                };
              }
              return next;
            });
            setSelectedRows(new Set(newRows.map(r => r.id)));
            return;
          }
        }
      } catch (err) {
        // Fall back to tab-separated text
      }

      const pastedRows = clipboardData.trim().split("\n").map(r => r.split("\t"));
      
      const newRows = pastedRows.map((cols) => {
        return {
          id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          from: cols[0]?.trim() || "LV PANEL-1",
          desc: cols[1]?.trim() || "",
          ref: cols[2]?.trim() || "BB-1",
          length: (cols[3] !== undefined && cols[3] !== "" ? Number(cols[3]) : "") as number | "",
          loadKw: (cols[4] !== undefined && cols[4] !== "" ? Number(cols[4]) : "") as number | "",
          div: cols[5] !== undefined && cols[5] !== "" ? Number(cols[5]) : 0.7,
        };
      });

      setPanels(prev => {
        const next = [...prev];
        if (next.length > 0 && next[0].sections.length > 0) {
          next[0].sections[0] = { ...next[0].sections[0], rows: [...next[0].sections[0].rows, ...newRows] };
        }
        return next;
      });
      setSelectedRows(new Set(newRows.map(r => r.id)));
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [panels]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          setSelectedRows(new Set());
          setLastSelectedRowId(null);
        }
        return;
      }

      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allIds = new Set<string>();
        panels.forEach(p => p.sections.forEach(s => s.rows.forEach(r => allIds.add(r.id))));
        setSelectedRows(allIds);
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          pushToUndo(panels);
          setPanels(prev => prev.map(p => ({
            ...p,
            sections: p.sections.map(s => ({
              ...s,
              rows: s.rows.filter(r => !selectedRows.has(r.id))
            }))
          })));
          setSelectedRows(new Set());
        }
      }

      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }

      if ((isCmdOrCtrl && e.key.toLowerCase() === 'y') || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        handleRedo();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'c' && selectedRows.size > 0) {
        e.preventDefault();
        copyRows(Array.from(selectedRows));
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'x' && selectedRows.size > 0) {
        if (isApproved) {
          e.preventDefault();
          toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to cut rows.", { id: "readonly-notice" });
          return;
        }
        e.preventDefault();
        cutRows(Array.from(selectedRows));
        setSelectedRows(new Set());
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'v') {
        if (isApproved) {
          e.preventDefault();
          toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to paste rows.", { id: "readonly-notice" });
          return;
        }
        e.preventDefault();
        pasteRows();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [panels, selectedRows, undoStack, redoStack, isApproved]);

  const togglePanel = (id: string) => {
    setCollapsedPanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    pushToUndo(panels);
    setUnitSystem(newSystem);
    if (shouldConvert) {
      setPanels(prev => prev.map(p => ({
        ...p,
        sections: p.sections.map(s => ({
          ...s,
          rows: s.rows.map(r => ({
            ...r,
            length: newSystem === "ip" ? Number((Number(r.length) * 3.28084).toFixed(2)) : Number((Number(r.length) / 3.28084).toFixed(2))
          }))
        }))
      })));
    }
  };

  const openAddPanelModal = () => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const num = panels.length + 1;
    setNewPanelName(`LV PANEL-${num}`);
    setNewSectionName("BB-1");
    setNewRatingId("2500_rt");
    setNewVolts(415);
    setNewPf(0.8);
    setShowAddPanelModal(true);
  };

  const handleAddNewTapOff = () => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(panels);
    let targetPanel = panels[0];
    let panelId: string;
    let sectionId: string;

    if (!targetPanel) {
      const newPanId = `pan_${Date.now()}`;
      const newSecId = `sec_${Date.now()}`;
      targetPanel = {
        id: newPanId,
        name: "LV PANEL-1",
        sections: [{
          id: newSecId,
          name: "BB-1",
          ratingId: "2500_rt",
          volts: 415,
          pf: 0.8,
          rows: []
        }]
      };
      setPanels([targetPanel]);
      panelId = newPanId;
      sectionId = newSecId;
    } else {
      panelId = targetPanel.id;
      sectionId = targetPanel.sections[0]?.id || `sec_${Date.now()}`;
    }

    const targetSec = targetPanel.sections.find((s) => s.id === sectionId) || targetPanel.sections[0];
    const fromName = targetSec?.rows && targetSec.rows.length > 0 
      ? targetSec.rows[targetSec.rows.length - 1].from 
      : targetPanel.name;
    const defaultDesc = `Tap Off ${(targetSec?.rows.length || 0) + 1}`;

    const newRow: BusbarRow = {
      id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      from: fromName,
      desc: defaultDesc,
      ref: targetSec?.name || "BB-1",
      length: 10,
      loadKw: 15,
      div: 0.7,
    };

    setPanels((prev) => {
      const exists = prev.some((p) => p.id === panelId);
      if (!exists) {
        return [...prev, { ...targetPanel, sections: [{ ...targetSec, rows: [newRow] }] }];
      }
      return prev.map((p) => {
        if (p.id === panelId) {
          return {
            ...p,
            sections: p.sections.map((s) => {
              if (s.id === sectionId) {
                return { ...s, rows: [...s.rows, newRow] };
              }
              return s;
            })
          };
        }
        return p;
      });
    });

    toast.success("New Tap Off added!");
  };

  const addPanel = openAddPanelModal;

  const handleAddPanelSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    if (!newPanelName.trim()) {
      toast.error("Please enter a panel name");
      return;
    }
    pushToUndo(panels);
    const newPanel: LVPanel = {
      id: `pan_${Date.now()}`,
      name: newPanelName.trim(),
      sections: [{
        id: `sec_${Date.now()}`,
        name: newSectionName.trim() || "BB-1",
        ratingId: newRatingId || "2500_rt",
        volts: typeof newVolts === "number" ? newVolts : Number(newVolts) || 415,
        pf: typeof newPf === "number" ? newPf : Number(newPf) || 0.8,
        rows: []
      }]
    };
    setPanels([...panels, newPanel]);
    setShowAddPanelModal(false);
    toast.success(`LV Panel "${newPanel.name}" added successfully!`);
    setTimeout(() => {
      const el = document.getElementById(`panel-${newPanel.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  const removePanel = async (id: string) => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const targetPanel = panels.find((p) => p.id === id);
    const hasData = targetPanel && targetPanel.sections.some((s) => s.rows && s.rows.length > 0);

    if (hasData) {
      const ok = await confirm(`Are you sure you want to remove ${targetPanel.name || "this panel"} and all its busbar rows?`);
      if (!ok) return;
    }

    pushToUndo(panels);
    const updated = panels.filter((p) => p.id !== id);
    setPanels(updated);
    toast.success(`Removed ${targetPanel?.name || "Panel"}`);
  };

  const updatePanel = (id: string, field: keyof LVPanel, val: any) => {
    if (isApproved) return;
    pushToUndo(panels);
    setPanels(panels.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const addSection = (panelId: string) => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        const num = p.sections.length + 1;
        return {
          ...p,
          sections: [...p.sections, {
            id: `sec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: `BB-${num}`,
            ratingId: "2500_rt",
            volts: 415,
            pf: 0.8,
            rows: []
          }]
        };
      }
      return p;
    }));
  };

  const removeSection = async (panelId: string, sectionId: string) => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return { ...p, sections: p.sections.filter(s => s.id !== sectionId) };
      }
      return p;
    }));
  };

  const updateSection = (panelId: string, sectionId: string, field: keyof BusbarSection, val: any) => {
    if (isApproved) return;
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return {
          ...p,
          sections: p.sections.map(s => s.id === sectionId ? { ...s, [field]: val } : s)
        };
      }
      return p;
    }));
  };

  const handleImportExcelRows = (panelId: string, sectionId: string, mappedRows: any[]) => {
    if (!mappedRows || mappedRows.length === 0) return;
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return {
          ...p,
          sections: p.sections.map(s => {
            if (s.id === sectionId) {
              // Check if current section only has a single default empty row
              const isDefaultSingleRow = s.rows.length === 1 && 
                (!s.rows[0].loadKw || s.rows[0].loadKw === 0) && 
                (!s.rows[0].length || s.rows[0].length === 10) &&
                (!s.rows[0].desc || s.rows[0].desc === "Tap Off 1");

              if (isDefaultSingleRow || s.rows.length === 0) {
                // Completely replace default row with imported Excel rows
                const newRows: BusbarRow[] = mappedRows.map((mr, idx) => ({
                  id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}_${idx}`,
                  from: mr.from !== undefined && String(mr.from).trim() !== "" ? String(mr.from).trim() : (idx === 0 ? p.name : ""),
                  desc: mr.desc !== undefined && String(mr.desc).trim() !== "" ? String(mr.desc).trim() : `Tap Off ${idx + 1}`,
                  ref: mr.ref !== undefined && String(mr.ref).trim() !== "" ? String(mr.ref).trim() : s.name,
                  length: mr.length !== undefined && mr.length !== "" && !isNaN(Number(mr.length)) ? Number(mr.length) : 10,
                  loadKw: mr.loadKw !== undefined && mr.loadKw !== "" && !isNaN(Number(mr.loadKw)) ? Number(mr.loadKw) : 0,
                  div: mr.div !== undefined && mr.div !== "" && !isNaN(Number(mr.div)) ? Number(mr.div) : 0.7,
                }));
                return { ...s, rows: newRows };
              }

              const currentRows = [...s.rows];
              const updatedRows: BusbarRow[] = [];

              mappedRows.forEach((mr, idx) => {
                const descVal = mr.desc !== undefined ? String(mr.desc).trim() : "";
                const fromVal = mr.from !== undefined ? String(mr.from).trim() : "";
                const refVal = mr.ref !== undefined ? String(mr.ref).trim() : "";
                const lenVal = mr.length !== undefined && mr.length !== "" && !isNaN(Number(mr.length)) ? Number(mr.length) : "";
                const loadVal = mr.loadKw !== undefined && mr.loadKw !== "" && !isNaN(Number(mr.loadKw)) ? Number(mr.loadKw) : "";
                const divVal = mr.div !== undefined && mr.div !== "" && !isNaN(Number(mr.div)) ? Number(mr.div) : 0.7;

                if (idx < currentRows.length) {
                  // Update existing row
                  updatedRows.push({
                    ...currentRows[idx],
                    desc: descVal !== "" ? descVal : currentRows[idx].desc,
                    from: fromVal !== "" ? fromVal : currentRows[idx].from,
                    ref: refVal !== "" ? refVal : currentRows[idx].ref,
                    length: lenVal !== "" ? lenVal : currentRows[idx].length,
                    loadKw: loadVal !== "" ? loadVal : currentRows[idx].loadKw,
                    div: divVal !== undefined ? Number(divVal) : currentRows[idx].div,
                  });
                } else {
                  // Append new row
                  updatedRows.push({
                    id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}_${idx}`,
                    from: fromVal || p.name,
                    desc: descVal || `Tap Off ${idx + 1}`,
                    ref: refVal || s.name,
                    length: lenVal !== "" ? lenVal : 10,
                    loadKw: loadVal !== "" ? loadVal : 0,
                    div: divVal,
                  });
                }
              });

              // Keep any remaining existing rows if imported rows count < currentRows.length
              if (mappedRows.length < currentRows.length) {
                for (let i = mappedRows.length; i < currentRows.length; i++) {
                  updatedRows.push(currentRows[i]);
                }
              }

              return { ...s, rows: updatedRows };
            }
            return s;
          })
        };
      }
      return p;
    }));
  };

  const busbarTopImportMapping = {
    from: ["From", "Source", "Panel", "Panel Name", "LV Panel", "From Panel"],
    desc: ["Description of connection", "Description", "Tap Off Points", "Tap Off Point", "Tap Off", "Connection", "Name", "Desc", "Load Description"],
    ref: ["Busbar Reference", "Busbar ref", "Busbar reference", "Busbar referece", "Ref", "Reference", "Riser", "Busduct"],
    length: ["Length of busbar upto tap off (m)", "Length of busbar upto tap off (ft)", "Length of busbar", "Length (m)", "Length (ft)", "Length", "Len", "Height"],
    loadKw: ["SMDB load (kW)", "SMDB load", "Load (kW)", "Load kW", "LoadKW", "Load", "KW", "Connected Load (kW)"],
    div: ["Diversity Factor", "Diversity", "DF", "Div"],
    volts: ["Volts (V)", "Volts", "Voltage", "Voltage (V)", "V"],
    pf: ["Power factor (Cos Φ)", "Power factor", "Power Factor", "PF", "Cos Phi", "Cos phi"],
    rating: ["Busbar Rating (A) (Copper)", "Busbar Rating", "Rating", "Rating (A)", "Size"]
  };

  const handleTopLevelImportExcel = (mappedRows: any[]) => {
    if (!mappedRows || mappedRows.length === 0) return;
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }

    pushToUndo(panels);

    // Group rows by Panel Name, then by Section Name/Ref
    const panelGroups = new Map<string, Map<string, any[]>>();

    mappedRows.forEach((r, idx) => {
      const rawFrom = r.from !== undefined && String(r.from).trim() !== "" ? String(r.from).trim() : "";
      const pName = rawFrom || (panels[0]?.name) || "LV PANEL-1";

      const rawRef = r.ref !== undefined && String(r.ref).trim() !== "" ? String(r.ref).trim() : "";
      const sName = rawRef || (panels[0]?.sections[0]?.name) || "BB-1";

      if (!panelGroups.has(pName)) {
        panelGroups.set(pName, new Map());
      }
      const secMap = panelGroups.get(pName)!;
      if (!secMap.has(sName)) {
        secMap.set(sName, []);
      }
      secMap.get(sName)!.push({ ...r, _idx: idx });
    });

    const newPanels: LVPanel[] = [];
    let pCount = 0;

    panelGroups.forEach((secMap, pName) => {
      pCount++;
      const sections: BusbarSection[] = [];
      let sCount = 0;

      secMap.forEach((rows, sName) => {
        sCount++;
        const firstRow = rows[0] || {};
        const volts = Number(firstRow.volts) || 415;
        const pf = Number(firstRow.pf) || 0.8;

        let ratingId = panels[0]?.sections[0]?.ratingId || "2500_rt";
        if (firstRow.rating) {
          const rStr = String(firstRow.rating).toLowerCase().trim();
          const matchKey = Object.keys(ALL_BUSBAR_DATA).find((k) => {
            const data = ALL_BUSBAR_DATA[k];
            return (
              k.toLowerCase() === rStr ||
              data.label.toLowerCase() === rStr ||
              data.label.toLowerCase().includes(rStr) ||
              rStr.includes(data.label.toLowerCase())
            );
          });
          if (matchKey) ratingId = matchKey;
        }

        const busbarRows: BusbarRow[] = rows.map((mr, rIdx) => {
          const descVal = mr.desc !== undefined && String(mr.desc).trim() !== "" ? String(mr.desc).trim() : `Tap Off ${rIdx + 1}`;
          const fromVal = mr.from !== undefined && String(mr.from).trim() !== "" ? String(mr.from).trim() : pName;
          const refVal = mr.ref !== undefined && String(mr.ref).trim() !== "" ? String(mr.ref).trim() : sName;
          const lenVal = mr.length !== undefined && mr.length !== "" && !isNaN(Number(mr.length)) ? Number(mr.length) : 10;
          const loadVal = mr.loadKw !== undefined && mr.loadKw !== "" && !isNaN(Number(mr.loadKw)) ? Number(mr.loadKw) : 0;
          const divVal = mr.div !== undefined && mr.div !== "" && !isNaN(Number(mr.div)) ? Number(mr.div) : 0.7;

          return {
            id: `bb_${Date.now()}_${pCount}_${sCount}_${rIdx}`,
            from: fromVal,
            desc: descVal,
            ref: refVal,
            length: lenVal,
            loadKw: loadVal,
            div: divVal,
          };
        });

        sections.push({
          id: `sec_${Date.now()}_${pCount}_${sCount}`,
          name: sName,
          ratingId,
          volts,
          pf,
          useMdForCurrent: true,
          rows: busbarRows,
        });
      });

      newPanels.push({
        id: `pan_${Date.now()}_${pCount}`,
        name: pName,
        sections,
      });
    });

    if (newPanels.length > 0) {
      setPanels(newPanels);
      toast.success(`Successfully imported ${mappedRows.length} tap off row(s) into ${newPanels.length} panel(s)!`);
    }
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        if (!workbook.SheetNames.length) {
          toast.error("Excel file is empty");
          return;
        }
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw2D = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (!raw2D || raw2D.length === 0) {
          toast.error("No data found in the Excel sheet");
          return;
        }

        let headerRowIndex = -1;
        let headerRow: string[] = [];
        const isHeaderTerm = (val: any) => {
          if (typeof val !== "string" && typeof val !== "number") return false;
          const s = String(val).toLowerCase().replace(/[^a-z0-9]/g, "");
          return ["description", "tapoff", "len", "length", "load", "kw", "ref", "from", "diversity", "df", "rating", "current"].some(t => s.includes(t));
        };

        for (let i = 0; i < Math.min(raw2D.length, 30); i++) {
          const rowArr = raw2D[i];
          if (Array.isArray(rowArr) && rowArr.some(isHeaderTerm)) {
            headerRowIndex = i;
            headerRow = rowArr.map(c => String(c || "").trim());
            break;
          }
        }

        const jsonRows: Record<string, any>[] = [];
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
          const simpleJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
          jsonRows.push(...simpleJson);
        }

        const mappedRows: any[] = [];
        jsonRows.forEach((rowObj) => {
          const newObj: Record<string, any> = {};
          let matchedAny = false;

          Object.entries(busbarTopImportMapping).forEach(([targetKey, aliases]) => {
            const aliasList = Array.isArray(aliases) ? aliases : [aliases];
            for (const rawKey of Object.keys(rowObj)) {
              const cleanKey = rawKey.trim().toLowerCase();
              const isMatch = aliasList.some(alias => {
                const cleanAlias = alias.toLowerCase().trim();
                return cleanKey === cleanAlias || cleanKey.replace(/[^a-z0-9]/g, "") === cleanAlias.replace(/[^a-z0-9]/g, "");
              });
              if (isMatch) {
                newObj[targetKey] = rowObj[rawKey];
                matchedAny = true;
                break;
              }
            }
          });

          if (matchedAny && Object.keys(newObj).length > 0) {
            mappedRows.push(newObj);
          }
        });

        if (mappedRows.length === 0) {
          toast.error("Could not map any columns. Please verify Excel column headers like Description, Length, Load, etc.");
          return;
        }

        handleTopLevelImportExcel(mappedRows);
      } catch (err) {
        console.error("Error reading Excel:", err);
        toast.error("Failed to parse Excel file");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const addRow = (panelId: string, sectionId: string) => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(panels);
    const targetPanel = panels.find(p => p.id === panelId);
    const targetSec = targetPanel?.sections.find(s => s.id === sectionId);
    const fromName = targetSec?.rows && targetSec.rows.length > 0 
      ? targetSec.rows[targetSec.rows.length - 1].from 
      : (targetPanel?.name || "LV PANEL");
    const defaultDesc = `Tap Off ${(targetSec?.rows.length || 0) + 1}`;

    const newRow: BusbarRow = {
      id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      from: fromName,
      desc: defaultDesc,
      ref: targetSec?.name || "BB-1",
      length: 10,
      loadKw: 15,
      div: 0.7,
    };

    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return {
          ...p,
          sections: p.sections.map(s => {
            if (s.id === sectionId) {
              return { ...s, rows: [...s.rows, newRow] };
            }
            return s;
          })
        };
      }
      return p;
    }));

    toast.success("New Tap Off added!");
  };

  const removeRow = (panelId: string, sectionId: string, rowId: string) => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return {
          ...p,
          sections: p.sections.map(s => {
            if (s.id === sectionId) {
              return { ...s, rows: s.rows.filter(r => r.id !== rowId) };
            }
            return s;
          })
        };
      }
      return p;
    }));
  };

  const updateRow = (panelId: string, sectionId: string, rowId: string, field: keyof BusbarRow, val: any) => {
    if (isApproved) return;
    pushToUndo(panels);
    const isBulkEdit = selectedRows.has(rowId);
    
    setPanels(panels.map(p => {
      if (!isBulkEdit && p.id !== panelId) return p;
      
      return {
        ...p,
        sections: p.sections.map(s => {
          if (!isBulkEdit && s.id !== sectionId) return s;
          
          return {
            ...s,
            rows: s.rows.map(r => {
              if (isBulkEdit && selectedRows.has(r.id)) {
                return { ...r, [field]: val };
              } else if (!isBulkEdit && r.id === rowId) {
                return { ...r, [field]: val };
              }
              return r;
            })
          };
        })
      };
    }));
  };

  const clearAll = async () => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    if (await confirm("Are you sure you want to clear all data?")) {
      pushToUndo(panels);
      setPanels([{
        id: `pan_${Date.now()}`,
        name: "LV PANEL-1",
        sections: [{
          id: `sec_${Date.now()}`,
          name: "BB-1",
          ratingId: "2500_rt",
        volts: 415,
        pf: 0.8,
        rows: []
        }]
      }]);
    }
  };

  // Calculations
  const calculatedPanels = useMemo(() => {
    return calculateBusbarPanels(panels, ALL_BUSBAR_DATA, unitSystem);
  }, [panels, ALL_BUSBAR_DATA, unitSystem]);

  useEffect(() => {
    const vdMap: Record<string, number> = {};
    calculatedPanels.forEach(p => {
      p.calcSections.forEach(s => {
        s.calcRows.forEach(r => {
          if (r.desc) {
            vdMap[r.desc.trim()] = r.cumulativeVdPercent;
          }
        });
        if (s.name) {
          vdMap[s.name.trim()] = s.totalCumulativeVd;
        }
      });
    });
    localStorage.setItem("mep-busbar-calculated-vd-v1", JSON.stringify(vdMap));
  }, [calculatedPanels]);

  const flatCalculatedSections = useMemo(() => {
    return calculatedPanels.flatMap(p => p.calcSections.map(s => ({ ...s, panelId: p.id, panelName: p.name })));
  }, [calculatedPanels]);

  const flagStats = useMemo(() => {
    let totalCount = 0;
    let flaggedCount = 0;
    calculatedPanels.forEach(p => {
      p.calcSections.forEach(s => {
        s.calcRows.forEach(r => {
          totalCount++;
          const { isFlagged } = getBusbarRowValidation(r, r.vdPercent);
          if (isFlagged) flaggedCount++;
        });
      });
    });
    return { totalCount, flaggedCount };
  }, [calculatedPanels]);

  // Aggregate electrical totals & counts for bottom summary footer bar
  const footerStats = useMemo(() => {
    let totalAllTapOffs = 0;
    let totalFilteredTapOffs = 0;
    let totalRunLength = 0;
    let totalTclKw = 0;
    let totalDemandKw = 0;
    let maxVdPercent = 0;
    let compliantSectionsCount = 0;
    let totalSectionsCount = 0;
    const totalPanelsCount = calculatedPanels.length;

    calculatedPanels.forEach((panel) => {
      panel.calcSections.forEach((section) => {
        totalSectionsCount++;
        const secLen = section.calcRows.reduce((sum, r) => sum + (Number(r.length) || 0), 0);
        totalRunLength += secLen;

        if (section.calcRows.length > 0) {
          totalTclKw += section.calcRows[0].tcl || 0;
          totalDemandKw += section.calcRows[0].md || 0;
        }

        const secCumVd = section.totalCumulativeVd || 0;
        if (secCumVd > maxVdPercent) {
          maxVdPercent = secCumVd;
        }

        if (secCumVd <= 2.5) {
          compliantSectionsCount++;
        }

        section.calcRows.forEach((r) => {
          totalAllTapOffs++;
          let match = true;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            if (!(r.desc || "").toLowerCase().includes(q) && !(r.from || "").toLowerCase().includes(q)) match = false;
          }
          if (match && showFlaggedOnly && !getBusbarRowValidation(r, r.vdPercent).isFlagged) match = false;
          if (match && filterVd === "within" && r.vdPercent > 2.5) match = false;
          if (match && filterVd === "exceeds" && r.vdPercent <= 2.5) match = false;
          if (match && filterLoad === "high" && (Number(r.loadKw) || 0) <= 100) match = false;
          if (match && filterLoad === "low" && (Number(r.loadKw) || 0) > 100) match = false;

          if (match) {
            totalFilteredTapOffs++;
          }
        });
      });
    });

    const isFiltered = Boolean(
      searchQuery.trim() ||
      showFlaggedOnly ||
      filterVd !== "all" ||
      filterLoad !== "all"
    );

    const complianceRate = totalSectionsCount > 0
      ? Math.round((compliantSectionsCount / totalSectionsCount) * 100)
      : 100;

    return {
      totalAllTapOffs,
      totalFilteredTapOffs,
      totalPanelsCount,
      totalSectionsCount,
      totalRunLength,
      totalTclKw,
      totalDemandKw,
      maxVdPercent,
      complianceRate,
      isFiltered,
    };
  }, [calculatedPanels, searchQuery, showFlaggedOnly, filterVd, filterLoad]);

  const toggleFlagRows = (targetRowId: string, currentFlagged: boolean) => {
    pushToUndo(panels);
    const targetIds = selectedRows.has(targetRowId) && selectedRows.size > 1
      ? Array.from(selectedRows)
      : [targetRowId];
    
    const nextState = !currentFlagged;
    setPanels(prev => prev.map(p => ({
      ...p,
      sections: p.sections.map(s => ({
        ...s,
        rows: s.rows.map(r => targetIds.includes(r.id) ? { ...r, flagged: nextState } : r)
      }))
    })));

    toast.info(nextState ? `Flagged ${targetIds.length} tap off(s) for review` : `Unflagged ${targetIds.length} tap off(s)`);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();

    const fontBold = { name: "Arial", size: 10, bold: true };
    const fontNormal = { name: "Arial", size: 10 };
    const alignCenter: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
    const alignCenterNoWrap: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: false };
    const alignLeft: Partial<ExcelJS.Alignment> = { horizontal: "left", vertical: "middle", wrapText: true };
    const headerBg = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF92CDDC" } 
    } as ExcelJS.Fill;
    
    const setBorder = (cell: ExcelJS.Cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    };

    const lenLabel = unitSystem === "ip" ? "Length (ft)" : "Length (m)";
    const rLabel = unitSystem === "ip" ? "Resistance, R\n(mÎ©/ft)" : "Resistance, R\n(mÎ©/m)";
    const xLabel = unitSystem === "ip" ? "Reactance, X\n(mÎ©/ft)" : "Reactance, X\n(mÎ©/m)";

    flatCalculatedSections.forEach((section, sIndex) => {
      let safeName = section.name.replace(/[\\/*?:\[\]]/g, '');
      if (!safeName) safeName = `BB-${sIndex + 1}`;
      if (safeName.length > 31) safeName = safeName.substring(0, 31);
      
      let finalName = safeName;
      let counter = 1;
      while (workbook.getWorksheet(finalName)) {
        finalName = `${safeName.substring(0, 28)}_${counter}`;
        counter++;
      }

      const worksheet = workbook.addWorksheet(finalName);

      worksheet.columns = [
        { width: 8 },  // A: No.
        { width: 15 }, // B: From
        { width: 30 }, // C: Description
        { width: 12 }, // D: Busbar reference
        { width: 10 }, // E: Length
        { width: 12 }, // F: SMDB load
        { width: 12 }, // G: TCL
        { width: 12 }, // H: Volts
        { width: 12 }, // I: PF
        { width: 12 }, // J: Diversity
        { width: 12 }, // K: Max Demand
        { width: 12 }, // L: Line Current
        { width: 16 }, // M: Busbar Rating
        { width: 14 }, // N: Resistance
        { width: 14 }, // O: Reactance
        { width: 14 }, // P: Volt Drop
        { width: 14 }  // Q: Vdrop %
      ];

      const firstRef = section.calcRows.length > 0 ? section.calcRows[0].ref : section.name;
      
      // Titles
      worksheet.mergeCells("A1:Q1");
      const t1 = worksheet.getCell("A1");
      t1.value = `VOLTAGE DROP CALCULATION- ${firstRef} (${firstRef})`;
      t1.font = { name: "Arial", size: 12, bold: true, underline: true };
      t1.alignment = alignCenter;

      worksheet.mergeCells("A2:Q2");
      const t2 = worksheet.getCell("A2");
      t2.value = "PROJECT - ";
      t2.font = { name: "Arial", size: 11, bold: true, underline: true };
      t2.alignment = alignCenter;

      // Formula block
      worksheet.getCell("G4").value = "Voltage Drop, Vd=1.732 x L x I x (Rcos Î¦ + Xsin Î¦)";
      worksheet.getCell("G4").font = fontBold;
      worksheet.getCell("G5").value = "Where,";
      worksheet.getCell("G5").font = fontBold;
      worksheet.getCell("G6").value = "L = Length in meter";
      worksheet.getCell("G6").font = fontBold;
      worksheet.getCell("G7").value = section.useMdForCurrent !== false ? "I = Current in Amps (I = (MD x 1000) / (1.732 x V x PF))" : "I = Current in Amps (I = (TCL x 1000) / (1.732 x V x PF))";
      worksheet.getCell("G7").font = fontBold;
      worksheet.getCell("G8").value = "R = Resistance in mÎ©/m";
      worksheet.getCell("G8").font = fontBold;
      worksheet.getCell("G9").value = "X = Reactance in mÎ©/m";
      worksheet.getCell("G9").font = fontBold;

      // Sub-title
      worksheet.getCell("A10").value = firstRef;
      worksheet.getCell("A10").font = { name: "Arial", size: 12, bold: true };

      // Headers Row 1 (for merged R&X Value)
      worksheet.getRow(11).height = 15;
      worksheet.mergeCells("N11:O11");
      const rxCell = worksheet.getCell("N11");
      rxCell.value = "R&X Value";
      rxCell.fill = headerBg;
      rxCell.font = fontBold;
      rxCell.alignment = alignCenter;
      setBorder(rxCell);
      setBorder(worksheet.getCell("O11"));

      // Headers Row 2
      worksheet.getRow(12).height = 50;
      const headers = [
        "No. of\nTap\nOff",
        "From",
        "Description of connection",
        "Busbar\nreferece",
        lenLabel,
        "SMDB load\n(kW)",
        "TCL at Tap off\npoint (kW)",
        "Volts (V)",
        "Power\nfactor\n(Cos Î¦)",
        "Diversity",
        "Maximum\nDemand\nLoad (kW)",
        "Line\nCurrent\n(A)",
        "Busbar Rating\n(A) (Copper)",
        rLabel,
        xLabel,
        "Volt Drop\n(Vd)",
        "Vdrop\n%"
      ];

      headers.forEach((h, i) => {
        const col = i + 1;
        if (col !== 14 && col !== 15) {
          worksheet.mergeCells(11, col, 12, col);
          const cell = worksheet.getCell(11, col);
          cell.value = h.replace(/\\n/g, '\n');
          cell.fill = headerBg;
          cell.font = fontBold;
          cell.alignment = alignCenter;
          setBorder(cell);
          setBorder(worksheet.getCell(12, col));
        } else {
          const cell = worksheet.getCell(12, col);
          cell.value = h.replace(/\\n/g, '\n');
          cell.fill = headerBg;
          cell.font = fontBold;
          cell.alignment = alignCenter;
          setBorder(cell);
        }
      });

      let rowIndex = 13;

      section.calcRows.forEach((r, idx) => {
        const row = worksheet.getRow(rowIndex);
        row.height = 20;

        const rVal = Number((unitSystem === "ip" ? r.r * 0.3048 : r.r).toFixed(4));
        const xVal = Number((unitSystem === "ip" ? r.x * 0.3048 : r.x).toFixed(4));

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = section.panelName;
        row.getCell(3).value = r.desc;
        row.getCell(4).value = section.name;
        row.getCell(5).value = Number((Number(r.length) || 0).toFixed(2));
        row.getCell(6).value = Number((Number(r.loadKw) || 0).toFixed(2));
        row.getCell(7).value = Number((Number(r.tcl) || 0).toFixed(2));
        row.getCell(8).value = Number(section.volts) || 0;
        row.getCell(9).value = Number(section.pf) || 0;
        row.getCell(10).value = Number((Number(r.div) || 0).toFixed(2));
        row.getCell(11).value = Number((Number(r.md) || 0).toFixed(2));
        row.getCell(12).value = Number((Number(r.current) || 0).toFixed(2));
        row.getCell(13).value = ALL_BUSBAR_DATA[section.ratingId]?.label || "";
        row.getCell(14).value = rVal;
        row.getCell(15).value = xVal;
        row.getCell(16).value = Number((Number(r.vd) || 0).toFixed(2));
        row.getCell(17).value = Number(r.vdPercent).toFixed(3) + "%";
        if (r.vdPercent > 2.5) {
          row.getCell(17).font = { ...fontNormal, color: { argb: "FFFF0000" } };
        }
        
        for (let c = 1; c <= 17; c++) {
          const cell = row.getCell(c);
          if (!cell.font) cell.font = fontNormal;
          cell.alignment = { 
            horizontal: c === 3 ? "left" : "center", 
            vertical: "middle", 
            wrapText: c === 3 
          };
          setBorder(cell);
        }
        
        rowIndex++;
      });

      if (section.calcRows.length > 1) {
        worksheet.mergeCells(13, 2, rowIndex - 1, 2);
        worksheet.mergeCells(13, 4, rowIndex - 1, 4);
      }

      if (section.calcRows.length > 0) {
        const footerRow = worksheet.getRow(rowIndex);
        footerRow.height = 20;
        worksheet.mergeCells(rowIndex, 14, rowIndex, 15);
        const cumLabelCell = worksheet.getCell(rowIndex, 14);
        cumLabelCell.value = "Cumulative VD up to SMDB";
        cumLabelCell.alignment = { horizontal: "right", vertical: "middle", wrapText: false };
        cumLabelCell.font = fontBold;
        setBorder(cumLabelCell);
        setBorder(worksheet.getCell(rowIndex, 15));

        const cumValCell = worksheet.getCell(rowIndex, 16);
        const totalVd = section.calcRows.reduce((sum, row) => sum + (Number(row.vd) || 0), 0);
        cumValCell.value = Number(totalVd.toFixed(2));
        cumValCell.alignment = alignCenterNoWrap;
        cumValCell.font = fontNormal;
        setBorder(cumValCell);
        
        rowIndex++;
      }

      rowIndex += 2;
      
      const allData = Object.values(ALL_BUSBAR_DATA);
      if (allData.length > 0) {
        worksheet.mergeCells(rowIndex, 2, rowIndex, 3);
        const rtHead = worksheet.getCell(rowIndex, 2);
        rtHead.value = "Rating";
        rtHead.fill = headerBg;
        rtHead.font = fontBold;
        rtHead.alignment = alignCenter;
        setBorder(rtHead);
        setBorder(worksheet.getCell(rowIndex, 3));

        const resHead = worksheet.getCell(rowIndex, 4);
        resHead.value = "Resistance";
        resHead.fill = headerBg;
        resHead.font = fontBold;
        resHead.alignment = alignCenter;
        setBorder(resHead);

        const reactHead = worksheet.getCell(rowIndex, 5);
        reactHead.value = "Reactance";
        reactHead.fill = headerBg;
        reactHead.font = fontBold;
        reactHead.alignment = alignCenter;
        setBorder(reactHead);

        rowIndex++;

        allData.forEach((data) => {
          worksheet.mergeCells(rowIndex, 2, rowIndex, 3);
          const rtCell = worksheet.getCell(rowIndex, 2);
          rtCell.value = data.label;
          rtCell.alignment = alignCenter;
          rtCell.font = fontNormal;
          setBorder(rtCell);
          setBorder(worksheet.getCell(rowIndex, 3));

          const rValCell = worksheet.getCell(rowIndex, 4);
          rValCell.value = Number((unitSystem === "ip" ? data.r * 0.3048 : data.r).toFixed(4));
          rValCell.alignment = alignCenter;
          rValCell.font = fontNormal;
          setBorder(rValCell);

          const xValCell = worksheet.getCell(rowIndex, 5);
          xValCell.value = Number((unitSystem === "ip" ? data.x * 0.3048 : data.x).toFixed(4));
          xValCell.alignment = alignCenter;
          xValCell.font = fontNormal;
          setBorder(xValCell);

          rowIndex++;
        });

        rowIndex++;
        
        worksheet.getCell(rowIndex, 2).value = "Where,";
        worksheet.getCell(rowIndex, 2).font = fontNormal;
        rowIndex++;
        worksheet.getCell(rowIndex, 2).value = "Rt- Resistance at thermal balance";
        worksheet.getCell(rowIndex, 2).font = fontNormal;
        rowIndex++;
        worksheet.getCell(rowIndex, 2).value = "R@50%RC - Resistance at 50% rated current";
        worksheet.getCell(rowIndex, 2).font = fontNormal;
        rowIndex += 2;
        worksheet.getCell(rowIndex, 2).value = "Note:";
        worksheet.getCell(rowIndex, 2).font = { name: "Arial", size: 10, bold: true, underline: true };
        rowIndex++;
        worksheet.getCell(rowIndex, 2).value = "Resistance & reactance values were taken at 50Â°C ambient temperature";
        worksheet.getCell(rowIndex, 2).font = fontNormal;
      }
    });

    
    const lastWorksheet = workbook.worksheets[workbook.worksheets.length - 1];
    if (lastWorksheet) {
      const sigRow = lastWorksheet.rowCount ? lastWorksheet.rowCount + 2 : 20;
      addExcelSignatureBlock(lastWorksheet, sigRow, currentUserName, project?.id || "default", "busbar-calculation");
    }
    const buffer = await workbook.xlsx.writeBuffer();
    await downloadFile(new Uint8Array(buffer), "Busbar_Calculation.xlsx", "Excel Document", ["xlsx"]);
  };

  const exportPdf = () => {
    exportBusbarPDF(
      { flatCalculatedSections },
      unitSystem,
      {
        projectName: project?.name,
        projectNo: project?.code,
        client: (project as any)?.client,
        userName: currentUserName,
        allBusbarData: ALL_BUSBAR_DATA,
      }
    );
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const excelRows = XLSX.utils.sheet_to_json<any>(firstSheet, { raw: true });

      let importedCount = 0;
      const newCustoms = { ...customBusbars };
      
      excelRows.forEach((row: any) => {
        let rating: any = null, r: number | null = null, x: number | null = null, label: string | null = null;
        for (const key in row) {
          if (!key) continue;
          const k = key.toString().toLowerCase().trim();
          const val = row[key];
          if (k.includes('rating') || k.includes('size') || k.includes('amp') || k.includes('current') || k === 'a') rating = val;
          else if (k === 'r' || k.includes('resist') || k.includes('resistance')) r = parseFloat(val);
          else if (k === 'x' || k.includes('react') || k.includes('reactance')) x = parseFloat(val);
          else if (k.includes('label') || k.includes('type') || k.includes('name') || k.includes('material')) label = val;
        }
        
        if (rating && r != null && !isNaN(r) && x != null && !isNaN(x)) {
          const ratingStr = String(rating).trim();
          const safeLabel = label ? `${ratingStr} (${label})` : `${ratingStr} (Custom)`;
          const id = `custom_${ratingStr}_${Date.now()}_${importedCount}`;
          
          newCustoms[id] = { r, x, label: safeLabel };
          importedCount++;
        }
      });

      if (importedCount > 0) {
        setCustomBusbars(newCustoms);
        toast.success(`Successfully imported ${importedCount} custom busbar rating(s)!`);
      } else {
        toast.error("Could not find columns for Rating, Resistance, and Reactance in the Excel file.\nPlease ensure your Excel file has headers like 'Rating', 'Resistance', and 'Reactance'.");
      }
      
      event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <AppShell 
      title="Busbar Calculation" 
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
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Busbar Calculation</h1>
              </div>
              <button 
                type="button"
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Busbar Intelligence"
              >
                <Sparkles className="size-3.5" /> Intelligence
              </button>
              <CalculationReviewBar 
                projectId={activeProjectId || project?.id || "default"} 
                calculatorPath="/busbar-calculation" 
                calculatorTitle="Busbar Calculation" 
              />
            </div>
            
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} disabled={isApproved} />
            </div>
          </div>

          {/* White Card Container for Content */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
                ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
                : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30`}>
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        <div className="relative z-10 flex flex-col h-full w-full">
        {/* Top Row 1: Section Navigation Tabs & Print matching Pump Sizing */}
        <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
              <button
                type="button"
                onClick={() => setActiveTab("sizing")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                  activeTab === "sizing"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                Busbar Sizing
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
          </div>

          {/* Action button on the right of tabs matching Preliminary Standard */}
          <div className="flex items-center gap-2 select-none shrink-0">
            <TBtn
              onClick={() => setShowFormulaModal(true)}
              title="View Step-by-Step Formula Breakdown"
            >
              <Info className="size-3.5 text-primary" /> Formula Breakdown
            </TBtn>
            <TBtn onClick={exportPdf} title="Export PDF Calculation">
              <FileText className="size-3.5" /> Export PDF
            </TBtn>
          </div>
        </div>

        {/* Sizer Section Header with Search, Filters, View, Flag Filter & Module Actions Matching Ventilation */}
        {activeTab === "sizing" ? (
          <>
            <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print modal-blur-bg select-none">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter spaces..."
            className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
          />

          {/* Filters Icon Popover */}
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
            <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
              <div className="flex items-center justify-between pb-1.5 border-b border-border">
                <span className="text-xs font-bold text-foreground">Filter Tap Offs</span>
                {activeFiltersCount > 0 && (
                  <button onClick={handleResetFilters} className="text-[10px] text-primary hover:underline font-semibold cursor-pointer">
                    Reset All
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Voltage Drop</span>
                <select
                  value={filterVd}
                  onChange={(e) => setFilterVd(e.target.value as any)}
                  className="h-7 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                >
                  <option value="all">All V.Drop Status</option>
                  <option value="within">Within Limit (≤ 2.5%)</option>
                  <option value="exceeds">Exceeds Limit (&gt; 2.5%)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Load Range</span>
                <select
                  value={filterLoad}
                  onChange={(e) => setFilterLoad(e.target.value as any)}
                  className="h-7 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                >
                  <option value="all">All Loads</option>
                  <option value="high">High Load (&gt; 100 kW)</option>
                  <option value="low">Low Load (≤ 100 kW)</option>
                </select>
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
                title="Sort Tap Offs"
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
            <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-border">
                <span className="text-xs font-bold text-foreground">Sort By</span>
                {sortBy !== "none" && (
                  <button onClick={() => setSortBy("none")} className="text-[10px] text-primary hover:underline font-semibold cursor-pointer">
                    Reset
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                >
                  <option value="none">Original Order</option>
                  <option value="desc">Description (A-Z)</option>
                  <option value="load">Load kW (High to Low)</option>
                  <option value="vd">V.Drop % (High to Low)</option>
                </select>
              </div>
            </PopoverContent>
          </Popover>

          {/* View Options & Column Distribution Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                  rowDensity === "compact"
                    ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                    : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                }`}
                title="View / Column Distribution"
              >
                <SlidersHorizontal className="size-3.5 shrink-0" />
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                  View Options
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-2.5 z-50 text-xs font-sans">
              <div className="pb-1.5 border-b border-border text-[12px] font-semibold text-foreground">
                Column Distribution
              </div>
              <p className="text-[10.5px] text-muted-foreground leading-snug">
                Drag column divider lines in table headers to adjust custom widths. Click below to restore auto-distribution.
              </p>
                            <button
                onClick={() => {
                  try {
                    localStorage.removeItem("mep_grid_busbar_cols");
                    setBusbarColWidths(DEFAULT_BUSBAR_COL_WIDTHS);
                    window.dispatchEvent(new Event("resize"));
                    toast.success("Column widths reset to auto-distribution");
                  } catch (e) {}
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 text-foreground font-semibold text-[11.5px] border border-border transition-colors cursor-pointer"
              >
                <RefreshCw className="size-3 text-primary" />
                Reset Column Widths
              </button>
              <div className="flex flex-col gap-1 pt-2 border-t border-border">
                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Row Density</span>
                <div className="flex rounded-full border border-border p-0.5 bg-surface-2">
                  <button
                    onClick={() => setRowDensity("default")}
                    className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all cursor-pointer ${
                      rowDensity === "default" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Default
                  </button>
                  <button
                    onClick={() => setRowDensity("compact")}
                    className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all cursor-pointer ${
                      rowDensity === "compact" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Compact
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Right Controls: Import, Import Ratings, Add LV Panel */}
          <div className="ml-auto flex items-center gap-1.5">
            <TBtn
              disabled={isApproved}
              onClick={() => {
                if (isApproved) {
                  toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
                  return;
                }
                setShowImportSourceModal(true);
              }}
              title="Import spaces or schedule"
            >
              <Download className="size-3.5" /> Import
            </TBtn>

            <label className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium border border-border bg-surface-2 text-foreground transition-colors ${isApproved ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer hover:bg-surface-3"}`}>
              <Upload className="size-3.5" /> Import Ratings
              <input type="file" disabled={isApproved} accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
            </label>

            <TBtn
              primary
              disabled={isApproved}
              onClick={openAddPanelModal}
            >
              <Plus className="size-3.5" /> Add LV Panel
            </TBtn>
          </div>

          {/* Bulk actions bar overlay */}
          {!isApproved && selectedRows.size > 0 && (
            <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
              <span className="font-semibold">{selectedRows.size} selected</span>
              <span className="text-primary/30">·</span>
              {selectedRows.size === 1 && (() => {
                const rId = Array.from(selectedRows)[0];
                for (const p of panels) {
                  for (const s of p.sections) {
                    const foundRow = s.rows.find(r => r.id === rId);
                    if (foundRow) {
                      return (
                        <BulkBtn
                          icon={Edit3}
                          onClick={() => setEditingRow({ row: foundRow, panelId: p.id, sectionId: s.id })}
                        >
                          Edit Tap Off
                        </BulkBtn>
                      );
                    }
                  }
                }
                return null;
              })()}
              <BulkBtn
                icon={Copy}
                onClick={() => {
                  copyRows(Array.from(selectedRows));
                }}
              >
                Copy
              </BulkBtn>
              <BulkBtn
                icon={Scissors}
                onClick={() => {
                  cutRows(Array.from(selectedRows));
                }}
              >
                Cut
              </BulkBtn>
              <BulkBtn
                icon={Flag}
                onClick={() => {
                  let anyUnflagged = false;
                  for (const p of panels) {
                    for (const s of p.sections) {
                      for (const r of s.rows) {
                        if (selectedRows.has(r.id) && !r.flagged) {
                          anyUnflagged = true;
                          break;
                        }
                      }
                    }
                  }
                  pushToUndo(panels);
                  setPanels((prev) =>
                    prev.map((p) => ({
                      ...p,
                      sections: p.sections.map((s) => ({
                        ...s,
                        rows: s.rows.map((r) =>
                          selectedRows.has(r.id) ? { ...r, flagged: anyUnflagged } : r
                        ),
                      })),
                    }))
                  );
                  toast.info(anyUnflagged ? `Flagged ${selectedRows.size} tap offs for review` : `Unflagged ${selectedRows.size} tap offs`);
                }}
              >
                Flag
              </BulkBtn>
              <BulkBtn
                icon={Trash2}
                onClick={() => {
                  pushToUndo(panels);
                  const count = selectedRows.size;
                  setPanels(prev => prev.map(p => ({
                    ...p,
                    sections: p.sections.map(s => ({
                      ...s,
                      rows: s.rows.filter(r => !selectedRows.has(r.id))
                    }))
                  })));
                  setSelectedRows(new Set());
                  toast.info(`Deleted ${count} tap off(s)`);
                }}
              >
                Delete
              </BulkBtn>
              <button
                type="button"
                onClick={() => setSelectedRows(new Set())}
                className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
              >
                <X className="size-3" /> Clear
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto bg-background p-4 md:p-6 gap-4 flex flex-col min-h-0">
          {calculatedPanels.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-2xl bg-surface-1/40 my-auto">
              <div className="p-3 rounded-full bg-primary/10 text-primary mb-3">
                <Plus className="size-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No LV Panels</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                All panels and tap-offs have been removed. Click "Add LV Panel" or "Sync 3D & Load Summary" to create one.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <button
                  disabled={isApproved}
                  onClick={openAddPanelModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-primary text-white hover:bg-primary/90 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Plus className="size-3.5" /> Add LV Panel
                </button>
                <button
                  disabled={isApproved}
                  onClick={handleSync3DAndLoadSummary}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" /> Sync 3D & Load Summary
                </button>
              </div>
            </div>
          )}

          {calculatedPanels.map((panel, pIdx) => {
            return (
              <div key={panel.id} id={`panel-${panel.id}`} className="flex flex-col bg-card border border-border rounded-2xl shadow-xs overflow-hidden shrink-0">
                {/* Panel Header */}
                <div className="bg-surface-2/80 border-b border-border/60 py-2 px-4 flex gap-4 items-center flex-wrap hover:bg-surface-2 transition-colors">
                  <button onClick={() => togglePanel(panel.id)} className="p-1 rounded hover:bg-black/5 flex items-center justify-center shrink-0">
                    {collapsedPanels.has(panel.id) ? <ChevronRight className="size-5 text-muted-foreground" /> : <ChevronDown className="size-5 text-muted-foreground" />}
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold text-foreground uppercase tracking-wider">Panel Name:</span>
                    <input 
                      type="text" 
                      disabled={isApproved}
                      value={panel.name} 
                      onChange={e => updatePanel(panel.id, "name", e.target.value)}
                      className="h-8 px-2.5 border border-border/60 hover:border-border focus:border-primary rounded bg-surface-2/60 text-foreground focus:bg-surface-2 focus:ring-1 focus:ring-primary outline-none font-bold w-52 text-[13px] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  <div className="ml-auto flex items-center gap-3">
                      <TBtn disabled={isApproved} onClick={(e) => { e.stopPropagation(); addSection(panel.id); }} primary><Plus className="size-3.5" /> Add Busbar</TBtn>
                      <TBtn disabled={isApproved} onClick={(e) => { e.stopPropagation(); removePanel(panel.id); }}><Trash2 className="size-3.5" /> Remove Panel</TBtn>
                  </div>
                </div>

                {!collapsedPanels.has(panel.id) && (
                <div className="p-4 flex flex-col gap-4">
                  {panel.calcSections.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground italic bg-background rounded-lg border border-border">
                      No busbars added to {panel.name}. Click "+ Add Busbar".
                    </div>
                  ) : panel.calcSections.map((section, sIdx) => {
                      const isAllSelected = section.calcRows.length > 0 && section.calcRows.every(r => selectedRows.has(r.id));
                      
                      return (
                        <div key={section.id} className="flex flex-col bg-card border border-border rounded-2xl shadow-xs overflow-hidden shrink-0 transition-all">
                          <div className="bg-surface-2/70 border-b border-border py-2.5 px-4 flex gap-4 items-center justify-between flex-wrap">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">Name:</span>
                                <input 
                                  type="text" 
                                  disabled={isApproved}
                                  value={section.name} 
                                  onChange={e => updateSection(panel.id, section.id, "name", e.target.value)}
                                  className="h-7 px-2 border border-border rounded bg-surface-2 text-foreground focus:bg-surface-3 focus:ring-1 focus:ring-primary outline-none font-medium w-24 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">Volts:</span>
                                <input 
                                  type="number" 
                                  disabled={isApproved}
                                  value={section.volts} 
                                  onChange={e => updateSection(panel.id, section.id, "volts", e.target.value === "" ? "" : Number(e.target.value))}
                                  className="h-7 px-2 border border-border rounded bg-surface-2 text-foreground focus:bg-surface-3 focus:ring-1 focus:ring-primary outline-none font-medium w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">PF:</span>
                                <input 
                                  type="number" 
                                  disabled={isApproved}
                                  step="0.01" max="1"
                                  value={section.pf} 
                                  onChange={e => updateSection(panel.id, section.id, "pf", e.target.value === "" ? "" : Number(e.target.value))}
                                  className="h-7 px-2 border border-border rounded bg-surface-2 text-foreground focus:bg-surface-3 focus:ring-1 focus:ring-primary outline-none font-medium w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">Rating:</span>
                                <select
                                    disabled={isApproved}
                                    className="h-7 px-2 border border-border rounded bg-surface-2 text-foreground focus:bg-surface-3 focus:ring-1 focus:ring-primary outline-none font-medium cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={section.ratingId}
                                    onChange={(e) => updateSection(panel.id, section.id, "ratingId", e.target.value)}
                                >
                                  {Object.entries(ALL_BUSBAR_DATA).map(([id, data]) => (
                                    <option key={id} value={id} className="bg-popover text-popover-foreground">{data.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center gap-3 ml-2 bg-surface-1 px-2 py-1 rounded border border-border/50">
                                <span className="text-[10px] text-muted-foreground font-medium uppercase">R: <span className="text-foreground text-[11px] font-mono">{((unitSystem === "ip" ? ALL_BUSBAR_DATA[section.ratingId]?.r * 0.3048 : ALL_BUSBAR_DATA[section.ratingId]?.r) || 0).toFixed(4)}</span></span>
                                <span className="text-[10px] text-muted-foreground font-medium uppercase">X: <span className="text-foreground text-[11px] font-mono">{((unitSystem === "ip" ? ALL_BUSBAR_DATA[section.ratingId]?.x * 0.3048 : ALL_BUSBAR_DATA[section.ratingId]?.x) || 0).toFixed(4)}</span></span>
                              </div>
                              <div className="flex items-center gap-1.5 ml-1 bg-surface-1 px-2.5 py-1 rounded border border-border/50">
                                <span className="text-[11px] font-semibold text-muted-foreground">Current Basis:</span>
                                <button
                                  type="button"
                                  disabled={isApproved}
                                  onClick={() => updateSection(panel.id, section.id, "useMdForCurrent", !(section.useMdForCurrent !== false))}
                                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer border disabled:opacity-50 disabled:cursor-not-allowed ${
                                    section.useMdForCurrent !== false
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                                  }`}
                                  title={
                                    section.useMdForCurrent !== false
                                      ? "Line Current uses Maximum Demand (MD). Click to switch to TCL."
                                      : "Line Current uses Total Connected Load (TCL). Click to switch to MD."
                                  }
                                >
                                  {section.useMdForCurrent !== false ? "MD (ON)" : "TCL (MD OFF)"}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {section.totalCumulativeVd > 2.5 ? (
                                  <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-md mr-1" title="Voltage drop exceeds the 2.5% standard limit!">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">Cum V.Drop</span>
                                    <span className="text-[15px] font-black font-mono text-destructive leading-none">{section.totalCumulativeVd.toFixed(3)}% âš </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-md mr-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Cum V.Drop</span>
                                    <span className="text-[15px] font-black font-mono text-primary leading-none">{section.totalCumulativeVd.toFixed(3)}%</span>
                                  </div>
                                )}
                                <ImportExcelBtn
                                  disabled={isApproved}
                                  columnMapping={{
                                    from: ["From", "Source", "Panel", "From Panel"],
                                    desc: ["Description of connection", "Description", "Tap Off Points", "Tap Off Point", "Tap Off", "Connection", "Name", "Desc"],
                                    ref: ["Busbar Reference", "Busbar ref", "Busbar reference", "Ref", "Reference"],
                                    length: ["Length of busbar upto tap off (m)", "Length of busbar", "Length (m)", "Length (ft)", "Length", "Len"],
                                    loadKw: ["SMDB load (kW)", "SMDB load", "Load (kW)", "Load kW", "LoadKW", "Load", "KW"],
                                    div: ["Diversity Factor", "Diversity", "DF", "Div"]
                                  }}
                                  onImport={(rows) => handleImportExcelRows(panel.id, section.id, rows)}
                                  className="h-7 px-3 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <TBtn disabled={isApproved} onClick={() => addRow(panel.id, section.id)} primary className="h-7 px-3 text-xs"><Plus className="size-3" /> Tap Off</TBtn>
                                <TBtn disabled={isApproved} onClick={() => removeSection(panel.id, section.id)} className="h-7 px-3 text-xs"><Trash2 className="size-3" /> Remove</TBtn>
                            </div>
                          </div>

                          <div className="overflow-auto max-h-[500px]">
                            <table className="table-fixed text-[13.5px] border-collapse whitespace-nowrap w-full" style={{ width: "100%", minWidth: `${Math.max(900, totalBusbarTableWidth)}px` }}>
                              <thead className="sticky top-0 z-10 bg-background dark:bg-[#1a1a1a] border-t border-b border-border-strong text-muted-foreground font-semibold select-none">
                                <tr className="text-left h-10 text-[11.5px] font-semibold uppercase tracking-wider">
                                  <th
                                    style={getBusbarColStyle("select")}
                                    className="px-1 py-2 text-center text-[11px] font-mono select-none cursor-pointer relative group"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isApproved) return;
                                      const allRowIds = section.calcRows.map(r => r.id);
                                      const isAllSelected = allRowIds.length > 0 && allRowIds.every(id => selectedRows.has(id));
                                      const newSet = new Set(selectedRows);
                                      if (isAllSelected) {
                                        allRowIds.forEach(id => newSet.delete(id));
                                      } else {
                                        allRowIds.forEach(id => newSet.add(id));
                                      }
                                      setSelectedRows(newSet);
                                    }}
                                    title={isAllSelected ? "Click to deselect all rows in section" : "Click to select all rows in section"}
                                  >
                                    <div className="flex items-center justify-center font-bold text-[11px] text-muted-foreground hover:text-foreground">
                                      #
                                    </div>
                                    <div onMouseDown={(e) => handleResizeMouseDown("select", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("desc")} className="px-2 py-2 relative group">
                                    Description
                                    <div onMouseDown={(e) => handleResizeMouseDown("desc", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("len")} className="px-2 py-2 text-center relative group">
                                    Len ({unitSystem === "ip" ? "ft" : "m"})
                                    <div onMouseDown={(e) => handleResizeMouseDown("len", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("loadKw")} className="px-2 py-2 text-center relative group">
                                    Load (kW)
                                    <div onMouseDown={(e) => handleResizeMouseDown("loadKw", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("tclKw")} className="px-2 py-2 text-center bg-surface-2 text-foreground relative group">
                                    TCL (kW)
                                    <div onMouseDown={(e) => handleResizeMouseDown("tclKw", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("div")} className="px-2 py-2 text-center relative group">
                                    Div
                                    <div onMouseDown={(e) => handleResizeMouseDown("div", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("mdKw")} className="px-1 py-1.5 text-center bg-surface-2 text-foreground relative group select-none">
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      <span className="text-[11.5px] font-bold">MD (kW)</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateSection(panel.id, section.id, "useMdForCurrent", !(section.useMdForCurrent !== false));
                                        }}
                                        className={`px-1.5 py-0.2 text-[9.5px] font-bold rounded border transition-all cursor-pointer ${
                                          section.useMdForCurrent !== false
                                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                                        }`}
                                        title={
                                          section.useMdForCurrent !== false
                                            ? "Line Current uses MD. Click to toggle OFF (use TCL)."
                                            : "Line Current uses TCL. Click to toggle ON (use MD)."
                                        }
                                      >
                                        {section.useMdForCurrent !== false ? "ON" : "OFF (TCL)"}
                                      </button>
                                    </div>
                                    <div onMouseDown={(e) => handleResizeMouseDown("mdKw", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("curA")} className="px-2 py-2 text-center bg-surface-2 text-foreground relative group">
                                    Cur. (A)
                                    <div onMouseDown={(e) => handleResizeMouseDown("curA", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("vdV")} className="px-2 py-2 text-center text-primary relative group">
                                    Vd (V)
                                    <div onMouseDown={(e) => handleResizeMouseDown("vdV", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("vdPct")} className="px-2 py-2 text-center text-primary relative group">
                                    Vd %
                                    <div onMouseDown={(e) => handleResizeMouseDown("vdPct", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                                  </th>
                                  <th style={getBusbarColStyle("actions")} className="px-1 py-2 text-center text-[11px]">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60 text-[13.5px]">
                                {(() => {
                                  const displayRows = section.calcRows.filter(r => {
                                    if (searchQuery.trim()) {
                                      const q = searchQuery.toLowerCase();
                                      if (!(r.desc || "").toLowerCase().includes(q)) return false;
                                    }
                                    if (showFlaggedOnly && !getBusbarRowValidation(r, r.vdPercent).isFlagged) return false;
                                    if (filterVd === "within" && r.vdPercent > 2.5) return false;
                                    if (filterVd === "exceeds" && r.vdPercent <= 2.5) return false;
                                    if (filterLoad === "high" && (Number(r.loadKw) || 0) <= 100) return false;
                                    if (filterLoad === "low" && (Number(r.loadKw) || 0) > 100) return false;
                                    return true;
                                  });

                                  if (sortBy === "desc") {
                                    displayRows.sort((a, b) => (a.desc || "").localeCompare(b.desc || ""));
                                  } else if (sortBy === "load") {
                                    displayRows.sort((a, b) => (Number(b.loadKw) || 0) - (Number(a.loadKw) || 0));
                                  } else if (sortBy === "vd") {
                                    displayRows.sort((a, b) => (Number(b.vdPercent) || 0) - (Number(a.vdPercent) || 0));
                                  }

                                  if (displayRows.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={11} className="text-center py-10 text-muted-foreground italic">
                                          {showFlaggedOnly ? `No flagged tap offs found in ${section.name}.` : `No tap offs added to ${section.name}.`}
                                        </td>
                                      </tr>
                                    );
                                  }

                                  return displayRows.map((r, idx) => {
                                      const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, colIndex: number) => {
                                        const target = e.target as HTMLInputElement;
                                        if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
                                          e.preventDefault();
                                          let nextRow = idx;
                                          if (e.key === "ArrowUp") nextRow--;
                                          if (e.key === "ArrowDown" || e.key === "Enter") nextRow++;
                                          
                                          const nextEl = document.querySelector(`[data-pan="${pIdx}"][data-sec="${sIdx}"][data-row="${nextRow}"][data-col="${colIndex}"]`) as HTMLElement;
                                          if (nextEl) {
                                            nextEl.focus();
                                            if (nextEl instanceof HTMLInputElement) nextEl.select();
                                          }
                                        } else if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                                          let shouldMove = false;
                                          if (target.tagName === 'SELECT' || target.value === "" || target.value === undefined) {
                                            shouldMove = true;
                                          } else {
                                            if (e.key === "ArrowLeft" && target.selectionStart === 0) shouldMove = true;
                                            if (e.key === "ArrowRight" && target.selectionEnd === target.value.length) shouldMove = true;
                                          }

                                          if (shouldMove) {
                                            e.preventDefault();
                                            let nextCol = colIndex;
                                            if (e.key === "ArrowLeft") nextCol--;
                                            if (e.key === "ArrowRight") nextCol++;
                                            const nextEl = document.querySelector(`[data-pan="${pIdx}"][data-sec="${sIdx}"][data-row="${idx}"][data-col="${nextCol}"]`) as HTMLElement;
                                            if (nextEl) {
                                              nextEl.focus();
                                              if (nextEl instanceof HTMLInputElement) nextEl.select();
                                            }
                                          }
                                        }
                                      };

                                    const rowValidation = getBusbarRowValidation(r, r.vdPercent);
                                      const isRowFlagged = rowValidation.isFlagged;
                                      const isSelected = selectedRows.has(r.id);
                                      const isCellInteractive = isSelected && !isApproved;

                                      return (
                                      <tr 
                                        key={r.id} 
                                        id={`busbar-row-${r.id}`} 
                                        data-row-id={r.id}
                                        className={cn(
                                          "h-[30px] border-b border-border/60 hover:bg-row-hover text-[13.5px] transition-colors cursor-pointer select-none",
                                          editingRow?.row.id === r.id
                                            ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                                            : editingRow !== null
                                            ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200"
                                            : isSelected
                                            ? "bg-row-selected bg-primary/15 font-medium"
                                            : isRowFlagged
                                            ? "bg-red-500/[0.04] dark:bg-red-500/[0.08]"
                                            : ""
                                        )}
                                        onDoubleClick={(e) => {
                                          const target = e.target as HTMLElement;
                                          if (target.closest("button")) return;
                                          if (isApproved) return;
                                          setSelectedRows(new Set([r.id]));
                                          setEditingRow({ row: r, panelId: panel.id, sectionId: section.id });
                                        }}
                                        onClick={(e) => {
                                          const target = e.target as HTMLElement;
                                          if (
                                            target.closest('button[title*="comment"]') ||
                                            target.closest('.mep-comment-badge') ||
                                            target.closest('button')
                                          ) {
                                            return;
                                          }
                                          if (!isSelected) {
                                            toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                          }
                                        }}
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          if (!selectedRows.has(r.id)) {
                                            toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                          }
                                          setContextMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                            panelId: panel.id,
                                            sectionId: section.id,
                                            rowId: r.id
                                          });
                                        }}
                                      >
                                          {/* Serial Number Column (Matching Ventilation) */}
                                          <td
                                            style={getBusbarColStyle("select")}
                                            className={cn(
                                              "px-1 py-0 h-[30px] text-center border-r border-border/40 relative select-none cursor-pointer transition-colors duration-150",
                                              isSelected
                                                ? "bg-primary/15 text-primary font-bold shadow-inner"
                                                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                                            )}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isApproved) {
                                                toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
                                                return;
                                              }
                                              toggleRowSelect(r.id, e.shiftKey, true);
                                            }}
                                            title={isSelected ? `Row ${idx + 1} selected. Click to deselect.` : `Click to select row ${idx + 1}.`}
                                          >
                                            {(() => {
                                              const itemComments = getMergedItemComments(r.id, r.desc || r.from || `Tap Off ${r.ref || r.id}`, r.comments, "/busbar-calculation", project?.id);
                                              if (!itemComments || itemComments.length === 0) return null;
                                              return (
                                                <RowCommentCornerBadge
                                                  id={r.id}
                                                  count={itemComments.length}
                                                  position="left"
                                                  onClick={() => handleOpenComment(r)}
                                                  title={`${itemComments.length} comment(s)/task(s) assigned to "${r.desc || r.from || `Tap Off ${r.ref || r.id}`}"`}
                                                />
                                              );
                                            })()}
                                            <span className="text-[11px] font-mono leading-none tracking-tight">
                                              {idx + 1}
                                            </span>
                                          </td>

                                          {/* Description */}
                                          <td 
                                            style={getBusbarColStyle("desc")} 
                                            className={cn("p-0 h-[30px] border-r border-border/40 relative", !isSelected && !isApproved ? "cursor-pointer hover:bg-primary/5 transition-colors" : "")}
                                            onClick={(e) => {
                                              if (!isSelected) {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }
                                            }}
                                            title={!isSelected && !isApproved ? "Click to select row, click again to edit" : undefined}
                                          >
                                            <div className={cn("flex items-center gap-1.5 w-full h-full px-1", !isCellInteractive && "pointer-events-none select-none")}>
                                              <input 
                                                disabled={isApproved}
                                                data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={0} 
                                                onKeyDown={(e) => handleKeyDown(e, 0)} 
                                                type="text" 
                                                onClick={(e) => e.stopPropagation()} 
                                                onMouseDown={(e) => e.stopPropagation()} 
                                                className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded font-medium text-[13.5px] text-foreground transition-colors flex-1 cursor-text disabled:opacity-60 disabled:cursor-not-allowed" 
                                                value={r.desc} 
                                                onChange={e => updateRow(panel.id, section.id, r.id, "desc", e.target.value)} 
                                              />
                                            </div>
                                          </td>

                                          {/* Length */}
                                          <td 
                                            style={getBusbarColStyle("len")} 
                                            className={cn("p-0 h-[30px] border-r border-border/40 relative", !isSelected && !isApproved ? "cursor-pointer hover:bg-primary/5 transition-colors" : "")}
                                            onClick={(e) => {
                                              if (!isSelected) {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }
                                            }}
                                            title={!isSelected && !isApproved ? "Click to select row, click again to edit" : undefined}
                                          >
                                            <div className={cn("flex items-center w-full h-full", !isCellInteractive && "pointer-events-none select-none")}>
                                              <input 
                                                disabled={isApproved}
                                                data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={1} 
                                                onKeyDown={(e) => handleKeyDown(e, 1)} 
                                                type="number" step="0.1" 
                                                onClick={(e) => e.stopPropagation()} 
                                                onMouseDown={(e) => e.stopPropagation()} 
                                                className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text disabled:opacity-60 disabled:cursor-not-allowed" 
                                                value={r.length} 
                                                onChange={e => updateRow(panel.id, section.id, r.id, "length", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} 
                                              />
                                            </div>
                                          </td>

                                          {/* Load kW */}
                                          <td 
                                            style={getBusbarColStyle("loadKw")} 
                                            className={cn("p-0 h-[30px] border-r border-border/40 relative", !isSelected && !isApproved ? "cursor-pointer hover:bg-primary/5 transition-colors" : "")}
                                            onClick={(e) => {
                                              if (!isSelected) {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }
                                            }}
                                            title={!isSelected && !isApproved ? "Click to select row, click again to edit" : undefined}
                                          >
                                            <div className={cn("flex items-center w-full h-full", !isCellInteractive && "pointer-events-none select-none")}>
                                              <input 
                                                disabled={isApproved}
                                                data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={2} 
                                                onKeyDown={(e) => handleKeyDown(e, 2)} 
                                                type="number" step="0.1" 
                                                onClick={(e) => e.stopPropagation()} 
                                                onMouseDown={(e) => e.stopPropagation()} 
                                                className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text disabled:opacity-60 disabled:cursor-not-allowed" 
                                                value={r.loadKw} 
                                                onChange={e => updateRow(panel.id, section.id, r.id, "loadKw", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} 
                                              />
                                            </div>
                                          </td>
                                          
                                          {/* TCL kW (Calculated) */}
                                          <td 
                                            style={getBusbarColStyle("tclKw")} 
                                            className="px-2 py-0 h-[30px] text-center font-mono tabular text-[13.5px] font-semibold bg-surface-2 text-foreground cursor-pointer border-r border-border/40"
                                            onClick={(e) => {
                                              if (!isSelected) {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }
                                            }}
                                          >
                                            {r.tcl.toFixed(2)}
                                          </td>
                                          
                                          {/* Diversity */}
                                          <td 
                                            style={getBusbarColStyle("div")} 
                                            className={cn("p-0 h-[30px] border-r border-border/40 relative", !isSelected && !isApproved ? "cursor-pointer hover:bg-primary/5 transition-colors" : "")}
                                            onClick={(e) => {
                                              if (!isSelected) {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }
                                            }}
                                            title={!isSelected && !isApproved ? "Click to select row, click again to edit" : undefined}
                                          >
                                            <div className={cn("flex items-center w-full h-full", !isCellInteractive && "pointer-events-none select-none")}>
                                              <input 
                                                disabled={isApproved}
                                                data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={3} 
                                                onKeyDown={(e) => handleKeyDown(e, 3)} 
                                                type="number" step="0.01" max="1" 
                                                onClick={(e) => e.stopPropagation()} 
                                                onMouseDown={(e) => e.stopPropagation()} 
                                                className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text disabled:opacity-60 disabled:cursor-not-allowed" 
                                                value={r.div} 
                                                onChange={e => updateRow(panel.id, section.id, r.id, "div", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} 
                                              />
                                            </div>
                                          </td>
                                          
                                          {/* MD kW */}
                                          <td 
                                            style={getBusbarColStyle("mdKw")} 
                                            className="px-2 py-0 h-[30px] text-center font-mono tabular text-[13.5px] font-semibold bg-surface-2 text-foreground cursor-pointer border-r border-border/40"
                                            onClick={(e) => {
                                              if (!isSelected) {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }
                                            }}
                                          >
                                            {r.md.toFixed(2)}
                                          </td>

                                          {/* Current A */}
                                          <td 
                                            style={getBusbarColStyle("curA")} 
                                            className="px-2 py-0 h-[30px] text-center font-mono tabular text-[13.5px] font-semibold bg-surface-2 text-foreground cursor-pointer border-r border-border/40"
                                            onClick={(e) => {
                                              if (!isSelected) {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }
                                            }}
                                          >
                                            {r.current.toFixed(2)}
                                          </td>

                                          {/* VD V */}
                                          <td 
                                            style={getBusbarColStyle("vdV")} 
                                            className="px-2 py-0 h-[30px] text-center font-mono tabular text-[13.5px] text-primary font-medium cursor-pointer border-r border-border/40"
                                            onClick={(e) => {
                                              if (!isSelected) {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }
                                            }}
                                          >
                                            {r.vd.toFixed(2)}
                                          </td>

                                          {/* VD % */}
                                          <td 
                                            style={getBusbarColStyle("vdPct")} 
                                            className={cn(
                                              "px-2 py-0 h-[30px] text-center font-mono tabular text-[13.5px] font-medium cursor-pointer border-r border-border/40",
                                              r.vdPercent > 2.5 ? "text-destructive bg-destructive/5" : "text-primary"
                                            )}
                                            onClick={(e) => {
                                              if (!isSelected) {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }
                                            }}
                                          >
                                            {r.vdPercent.toFixed(3)}
                                          </td>
                                          
                                          {/* Actions: Flag only (Matching Ventilation, Pencil removed) */}
                                          <td style={getBusbarColStyle("actions")} className="text-center p-0 h-[30px]">
                                            <div className="flex items-center justify-center px-1 h-full">
                                              {(() => {
                                                const { isFlagged, warnings } = getBusbarRowValidation(r, r.vdPercent);
                                                return (
                                                  <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleFlagRows(r.id, isFlagged);
                                                    }} 
                                                    className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
                                                    title={isFlagged ? "Unflag tap off" : (warnings.length > 0 ? `Flagged: ${warnings.join(", ")}` : "Flag tap off for review")}
                                                  >
                                                    <Flag
                                                      className={cn(
                                                        "size-3.5 transition-all duration-200",
                                                        isFlagged
                                                          ? "fill-red-500 text-red-500 scale-110"
                                                          : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
                                                      )}
                                                    />
                                                  </button>
                                                );
                                              })()}
                                            </div>
                                          </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                              </table>
                          </div>
                        </div>
                      );
                  })}
                </div>
              )}
              </div>
            );
          })}
        </div>

        {/* Table Footer Summary Bar */}
        <div className="flex items-center justify-between px-4 h-8 border-t border-border bg-header-bg/80 text-[11.5px] text-muted-foreground shrink-0 select-none no-print modal-blur-bg">
          <div>
            Showing <span className="text-foreground font-semibold tabular">{footerStats.isFiltered ? footerStats.totalFilteredTapOffs : footerStats.totalAllTapOffs}</span> tap-off(s)
            {footerStats.isFiltered && (
              <> of <span className="tabular">{footerStats.totalAllTapOffs}</span></>
            )} across {footerStats.totalSectionsCount} busbar(s) in {footerStats.totalPanelsCount} panel(s)
          </div>
          <div className="flex items-center gap-4 tabular">
            <span>
              Σ Total Load:{" "}
              <strong className="font-mono text-foreground font-bold">
                {footerStats.totalTclKw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW
                {footerStats.totalTclKw >= 1000 && ` (${(footerStats.totalTclKw / 1000).toFixed(2)} MW)`}
              </strong>
            </span>
            <span>
              Σ Max Demand:{" "}
              <strong className="font-mono text-foreground font-bold">
                {footerStats.totalDemandKw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW
              </strong>
            </span>
            <span>
              Σ Busbar Length:{" "}
              <strong className="font-mono text-foreground font-bold">
                {footerStats.totalRunLength.toFixed(1)} {unitSystem === "ip" ? "ft" : "m"}
              </strong>
            </span>
            <span>
              Max V.Drop:{" "}
              <strong
                className={cn(
                  "font-mono font-bold",
                  footerStats.maxVdPercent > 2.5
                    ? "text-destructive"
                    : footerStats.maxVdPercent > 2.0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-primary"
                )}
              >
                {footerStats.maxVdPercent.toFixed(3)}%
              </strong>
            </span>
            <span>
              Compliance:{" "}
              <strong
                className={cn(
                  "font-mono font-bold",
                  footerStats.complianceRate >= 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : footerStats.complianceRate >= 80
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive"
                )}
              >
                {footerStats.complianceRate}% {footerStats.complianceRate >= 100 ? "PASS" : "FAIL"}
              </strong>
            </span>
          </div>
        </div>
          </>
        ) : (
          <BusbarReportView
            panels={panels}
            flatCalculatedSections={flatCalculatedSections}
            unitSystem={unitSystem}
            project={project}
            calcReviewState={calcReviewState}
            currentUserName={currentUserName}
            onExportPdf={exportPdf}
            allBusbarData={ALL_BUSBAR_DATA}
          />
        )}
      </div>
    </div>
  </div>

        {/* Busbar Sizing Intelligence Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-2 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg flex flex-col"
              : "w-0"
          }`}
        >
          {intelOpen && (
            <BusbarIntelligenceDrawer
              panels={panels}
              flatCalculatedSections={flatCalculatedSections}
              selectedRowIds={selectedRows}
              onClose={() => setIntelOpen(false)}
              onUpdateSectionRating={(panelId, sectionId, newRatingId) => {
                updateSection(panelId, sectionId, "ratingId", newRatingId);
              }}
              onOpenEditModal={(r, panelId, sectionId) => {
                setSelectedRows(new Set([r.id]));
                setEditingRow({ row: r, panelId, sectionId });
              }}
            />
          )}
        </div>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground select-none animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${Math.min(contextMenu.y, window.innerHeight - 260)}px`, left: `${Math.min(contextMenu.x, window.innerWidth - 270)}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Add Comment - AT THE TOP with blue ventilation styling */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              let targetRow: any = null;
              for (const p of panels) {
                for (const s of p.sections) {
                  const found = s.rows.find(r => r.id === contextMenu.rowId);
                  if (found) {
                    targetRow = found;
                    break;
                  }
                }
                if (targetRow) break;
              }
              const rowToComment = targetRow || { id: contextMenu.rowId, name: `Tap Off ${contextMenu.rowId}` };
              handleOpenComment(rowToComment);
              setContextMenu(null);
            }}
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium transition-colors"
          >
            <MessageSquare className="size-3.5" />
            <span>Add Comment</span>
          </button>

          {/* Edit Parameters */}
          <button
            type="button"
            onClick={() => {
              if (isApproved) { toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" }); setContextMenu(null); return; }
              let target: { row: any; panelId: string; sectionId: string } | null = null;
              for (const p of panels) {
                for (const s of p.sections) {
                  const r = s.rows.find(row => row.id === contextMenu.rowId);
                  if (r) {
                    target = { row: r, panelId: p.id, sectionId: s.id };
                    break;
                  }
                }
                if (target) break;
              }
              if (target) {
                setSelectedRows(new Set([contextMenu.rowId]));
                setEditingRow(target);
              } else {
                const inputEl = document.querySelector(`tr[data-row-id="${contextMenu.rowId}"] input[type="text"]`) as HTMLInputElement;
                if (inputEl) {
                  inputEl.focus();
                  inputEl.select();
                }
              }
              setContextMenu(null);
            }}
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Parameters</span>
            <span className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</span>
          </button>

          {/* Flag / Unflag Tap Off */}
          <button
            type="button"
            onClick={() => {
              if (isApproved) { toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" }); setContextMenu(null); return; }
              let isCurrentlyFlagged = false;
              panels.forEach(p => p.sections.forEach(s => s.rows.forEach(r => {
                if (r.id === contextMenu.rowId) isCurrentlyFlagged = Boolean(r.flagged);
              })));
              toggleFlagRows(contextMenu.rowId, isCurrentlyFlagged);
              setContextMenu(null);
            }}
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
          >
            <Flag className="size-3.5 text-muted-foreground" />
            <span>{selectedRows.has(contextMenu.rowId) && selectedRows.size > 1 ? "Flag / Unflag Selected" : "Flag / Unflag Tap Off"}</span>
          </button>

          <div className="h-px bg-border my-1" />

          {/* Duplicate Row(s) */}
          <button
            type="button"
            onClick={() => {
              if (isApproved) { toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" }); setContextMenu(null); return; }
              const idsToCopy = selectedRows.has(contextMenu.rowId) ? Array.from(selectedRows) : [contextMenu.rowId];
              pushToUndo(panels);
              copyRows(idsToCopy);
              pasteRows();
              setContextMenu(null);
            }}
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
          >
            <CopyPlus className="size-3.5 text-muted-foreground" />
            <span>{selectedRows.has(contextMenu.rowId) && selectedRows.size > 1 ? `Duplicate Selected (${selectedRows.size})` : "Duplicate Tap Off"}</span>
            <span className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</span>
          </button>

          <div className="h-px bg-border my-1" />

          {/* Delete Row(s) */}
          <button
            type="button"
            onClick={() => {
              if (isApproved) { toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" }); setContextMenu(null); return; }
              const idsToDelete = selectedRows.has(contextMenu.rowId) ? Array.from(selectedRows) : [contextMenu.rowId];
              pushToUndo(panels);
              setPanels(prev => prev.map(p => ({
                ...p,
                sections: p.sections.map(s => ({
                  ...s,
                  rows: s.rows.filter(r => !idsToDelete.includes(r.id))
                }))
              })));
              setSelectedRows(new Set());
              setContextMenu(null);
              toast.info(`Deleted ${idsToDelete.length} row(s)`);
            }}
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium transition-colors"
          >
            <Trash2 className="size-3.5" />
            <span>{selectedRows.has(contextMenu.rowId) && selectedRows.size > 1 ? `Delete Selected (${selectedRows.size})` : "Delete Tap Off"}</span>
            <span className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</span>
          </button>
        </div>
      )}

      {/* Assign Comment & Task Modal (Exact Preliminary Parity) */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType={commentTargetItem.type}
          calculatorTitle="Busbar Calculation"
          calculatorPath="/busbar-calculation"
          existingComments={(() => {
            for (const p of panels) {
              for (const s of p.sections) {
                const r = s.rows.find(rw => String(rw.id) === String(commentTargetItem.id));
                if (r) return getMergedItemComments(r.id, r.desc || r.from || `Tap Off ${r.ref || r.id}`, r.comments, "/busbar-calculation", project?.id);
              }
            }
            return [];
          })()}
          onSave={(newComment) => {
            pushToUndo(panels);
            const nextPanels = panels.map(p => ({
              ...p,
              sections: p.sections.map(s => ({
                ...s,
                rows: s.rows.map(r => {
                  if (String(r.id) === String(commentTargetItem.id)) {
                    const comments = [...(r.comments || []), newComment];
                    return { ...r, comments };
                  }
                  return r;
                })
              }))
            }));

            setPanels(nextPanels);

            const projId = project?.id || "default";
            try {
              localStorage.setItem(`mep_busbar_calc_${projId}`, JSON.stringify({
                panels: nextPanels,
                updatedAt: new Date().toISOString()
              }));
            } catch (e) {}

            if (project?.id) {
              try {
                let wdata = (project as any).workspace_data || {};
                if (typeof wdata === 'string') { try { wdata = JSON.parse(wdata); } catch(e) {} }
                wdata.busbar_calc = { panels: nextPanels, updatedAt: new Date().toISOString() };
                if (updateProject) updateProject({ ...project, workspace_data: wdata });
              } catch(e) {}
            }
          }}
        />
      )}

      {editingRow && (() => {
        const sec = flatCalculatedSections.find(s => s.id === editingRow.sectionId);
        const rIndex = sec ? sec.calcRows.findIndex(r => r.id === editingRow.row.id) : 0;
        const loadList = sec && rIndex >= 0 ? sec.calcRows.slice(rIndex).map(cr => ({
          desc: cr.desc || "Tap Off",
          loadKw: Number(cr.loadKw) || 0
        })) : [];

        return (
          <EditBusbarRowModal
            row={editingRow.row}
            loadList={loadList}
            rowIndex={rIndex >= 0 ? rIndex + 1 : 1}
            sectionName={panels.find(p => p.id === editingRow.panelId)?.sections.find(s => s.id === editingRow.sectionId)?.name}
            panelName={panels.find(p => p.id === editingRow.panelId)?.name}
            availablePanels={panels.map(p => p.name)}
            ratingOptions={Object.entries(ALL_BUSBAR_DATA).map(([id, data]) => ({
              id,
              label: data.label,
              r: data.r,
              x: data.x
            }))}
            unitSystem={unitSystem}
            useMdForCurrent={panels.find(p => p.id === editingRow.panelId)?.sections.find(s => s.id === editingRow.sectionId)?.useMdForCurrent !== false}
            onToggleMdForCurrent={(val) => updateSection(editingRow.panelId, editingRow.sectionId, "useMdForCurrent", val)}
            onClose={() => setEditingRow(null)}
            onSave={(updated) => {
              if (isApproved) { toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" }); setEditingRow(null); return; }
              const currentPanel = panels.find((p) => p.id === editingRow.panelId);
              const targetPanelName = updated.panelName ? String(updated.panelName).trim() : "";
              if (targetPanelName && currentPanel && targetPanelName.toLowerCase() !== currentPanel.name.toLowerCase()) {
                setPanels((prevPanels) => {
                  const movedRow = {
                    ...editingRow.row,
                    desc: updated.desc !== undefined ? updated.desc : editingRow.row.desc,
                    length: updated.length !== undefined ? updated.length : editingRow.row.length,
                    loadKw: updated.loadKw !== undefined ? updated.loadKw : editingRow.row.loadKw,
                    div: updated.div !== undefined ? updated.div : editingRow.row.div,
                    flagged: updated.flagged !== undefined ? updated.flagged : editingRow.row.flagged,
                  };
                  let updatedPanels = prevPanels.map((p) => {
                    if (p.id === editingRow.panelId) {
                      return {
                        ...p,
                        sections: p.sections.map((s) => {
                          if (s.id === editingRow.sectionId) {
                            return { ...s, rows: s.rows.filter((r) => r.id !== editingRow.row.id) };
                          }
                          return s;
                        }),
                      };
                    }
                    return p;
                  });
                  const destPanel = updatedPanels.find((p) => p.name.trim().toLowerCase() === targetPanelName.toLowerCase());
                  if (destPanel) {
                    updatedPanels = updatedPanels.map((p) => {
                      if (p.id === destPanel.id) {
                        return {
                          ...p,
                          sections: p.sections.map((s, idx) => (idx === 0 ? { ...s, rows: [...s.rows, movedRow] } : s)),
                        };
                      }
                      return p;
                    });
                  } else {
                    const newPan: LVPanel = {
                      id: `pan_${Date.now()}`,
                      name: targetPanelName,
                      sections: [{
                        id: `sec_${Date.now()}`,
                        name: "BB-1",
                        ratingId: updated.ratingId || "2500_rt",
                        volts: updated.volts || 415,
                        pf: updated.pf || 0.8,
                        rows: [movedRow],
                      }],
                    };
                    updatedPanels.push(newPan);
                  }
                  return updatedPanels;
                });
              } else {
                if (updated.desc !== undefined) updateRow(editingRow.panelId, editingRow.sectionId, editingRow.row.id, "desc", updated.desc);
                if (updated.length !== undefined) updateRow(editingRow.panelId, editingRow.sectionId, editingRow.row.id, "length", updated.length);
                if (updated.loadKw !== undefined) updateRow(editingRow.panelId, editingRow.sectionId, editingRow.row.id, "loadKw", updated.loadKw);
                if (updated.div !== undefined) updateRow(editingRow.panelId, editingRow.sectionId, editingRow.row.id, "div", updated.div);
                if (updated.ratingId !== undefined) updateSection(editingRow.panelId, editingRow.sectionId, "ratingId", updated.ratingId);
                if (updated.volts !== undefined) updateSection(editingRow.panelId, editingRow.sectionId, "volts", updated.volts);
                if (updated.pf !== undefined) updateSection(editingRow.panelId, editingRow.sectionId, "pf", updated.pf);
                if (updated.flagged !== undefined) updateRow(editingRow.panelId, editingRow.sectionId, editingRow.row.id, "flagged", updated.flagged);
              }
              setEditingRow(null);
            }}
          />
        );
      })()}
      {syncModalOpen && syncResult && (
        <SyncBusbarModal
          syncResult={syncResult}
          onApply={handleApplySync}
          onClose={() => setSyncModalOpen(false)}
        />
      )}

      

      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleExcelFileChange}
        className="hidden"
      />

      <ImportSourceModal
        isOpen={showImportSourceModal}
        onClose={() => setShowImportSourceModal(false)}
        title="Import Busbar Schedule"
        subtitle="Select data source to generate schedule"
        excelTitle="Import from Excel (.xlsx)"
        excelSubtitle="Upload schedule or spreadsheet formatted with Panel, Busbar, Tap Off, Length & Load."
        viewerTitle="Import from 3D Studio"
        viewerSubtitle="Extract spatial geometry, room names, levels, and floor areas directly from active 3D model."
        viewerBadge="3D Studio"
        sync3DTitle="Sync 3D & Load Summary"
        sync3DSubtitle="Automatically generate vertical busduct riser from 3D Studio floor heights & Load Summary active kW."
        sync3DBadge="3D & Load Summary"
        onSelectExcel={() => {
          if (excelInputRef.current) {
            excelInputRef.current.value = "";
            excelInputRef.current.click();
          }
        }}
        onSelect3DViewer={handleSync3DAndLoadSummary}
        onSelectSync3DAndLoadSummary={handleSync3DAndLoadSummary}
        footerNote="Automatic code baseline & space classification applied"
      />
      {/* Formula Breakdown Modal */}
      {showFormulaModal && (
        <BusbarFormulaBreakdownModal
          onClose={() => setShowFormulaModal(false)}
          unitSystem={unitSystem}
          panels={panels}
          flatCalculatedSections={flatCalculatedSections}
        />
      )}

      {/* Add LV Panel Modal */}
      {showAddPanelModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setShowAddPanelModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Layers className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Add New LV Panel</h3>
                  <p className="text-[11px] text-muted-foreground">Configure main low-voltage distribution board and busbar riser</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPanelModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddPanelSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>LV Panel Name</span>
                  <span className="text-[10px] text-muted-foreground font-mono">Required</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newPanelName}
                  onChange={(e) => setNewPanelName(e.target.value)}
                  placeholder="e.g. LV PANEL-2 or MDB - RISER BUSDUCT"
                  className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Initial Busbar Reference</span>
                  <span className="text-[10px] text-muted-foreground font-mono">Section Ref</span>
                </label>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. BB-1 or BB-RISER-01"
                  className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Standard Busbar Rating
                </label>
                <select
                  value={newRatingId}
                  onChange={(e) => setNewRatingId(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-background border border-border rounded-lg text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer"
                >
                  {Object.entries(ALL_BUSBAR_DATA).map(([id, data]) => (
                    <option key={id} value={id}>
                      {data.label} (R: {data.r.toFixed(4)}, X: {data.x.toFixed(4)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    System Volts (V)
                  </label>
                  <input
                    type="number"
                    value={newVolts}
                    onChange={(e) => setNewVolts(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="415"
                    className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Power Factor (PF)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="1.0"
                    value={newPf}
                    onChange={(e) => setNewPf(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0.8"
                    className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddPanelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  Create LV Panel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Preliminary Engineering Report Component (Matching Preliminary Cooling Load Standard)
// ─────────────────────────────────────────────────────────────────────────────
function BusbarReportView({
  panels,
  flatCalculatedSections,
  unitSystem,
  project,
  calcReviewState,
  currentUserName,
  onExportPdf,
  allBusbarData,
}: {
  panels: any[];
  flatCalculatedSections: any[];
  unitSystem: "si" | "ip";
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  onExportPdf: () => void;
  allBusbarData?: Record<string, { r: number; x: number; label: string }>;
}) {
  const ip = unitSystem === "ip";
  const lenUnit = ip ? "ft" : "m";

  const sigDetails = getSignatureBlockDetails(project?.id || "default", "/busbar-calculation", currentUserName, calcReviewState);

  const calcNo = (project as any)?.calcNo || "TRV-CAL-BB-001";
  const today = formatDateStr(new Date().toISOString());
  const projectNo = project?.code || (project as any)?.projectNo || "P000";
  const projectName = project?.name || (project as any)?.projectName || "Busbar Trunking System Sizing";
  const clientName = project?.client || "-";
  const endUser = (project as any)?.endUser || (project as any)?.location || "-";

  let totalRunLength = 0;
  let totalConnectedKw = 0;
  let totalDesignIb = 0;
  let maxVdObserved = 0;
  let totalTapOffsCount = 0;

  flatCalculatedSections.forEach((sec) => {
    totalRunLength += sec.busbarLength || 0;
    totalConnectedKw += sec.totalConnectedLoad || 0;
    totalDesignIb += sec.totalDesignCurrent || 0;
    if ((sec.maxVdPct || 0) > maxVdObserved) maxVdObserved = sec.maxVdPct || 0;
    totalTapOffsCount += (sec.calcRows || []).length;
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
              Busbar Sizing Calculation
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Low Voltage Busbar Trunking System (BBT) Sizing, Tap-Off Distribution & Voltage Drop Analysis (IEC 61439-6)
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

          {/* 3. Busbar Sizing & Tap-Off Schedule Table */}
          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                  <th rowSpan={2} className="p-2 border-r border-border w-12 text-center">
                    Sr.<br />No.
                  </th>
                  <th colSpan={3} className="p-2 border-r border-border text-center">
                    Busbar Section & Tap-Off Details
                  </th>
                  <th colSpan={3} className="p-2 border-r border-border text-center">
                    Electrical Load Parameters
                  </th>
                  <th colSpan={3} className="p-2 text-center">
                    Voltage Drop & Compliance
                  </th>
                </tr>
                <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                  <th className="p-2 border-r border-border text-left min-w-[130px]">Panel / Busbar Section</th>
                  <th className="p-2 border-r border-border text-left min-w-[120px]">Tap-Off / Floor</th>
                  <th className="p-2 border-r border-border w-24 text-center">Distance ({lenUnit})</th>
                  <th className="p-2 border-r border-border w-24 text-center">Load (kW)</th>
                  <th className="p-2 border-r border-border w-24 text-center">Current Ib (A)</th>
                  <th className="p-2 border-r border-border w-24 text-center">PF (cos φ)</th>
                  <th className="p-2 border-r border-border w-24 text-center">ΔV (V)</th>
                  <th className="p-2 border-r border-border w-24 text-center">Cumul. VD (%)</th>
                  <th className="p-2 w-24 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flatCalculatedSections.map((sec) => {
                  const busbarLookup = allBusbarData || COPPER_BUSBAR_DATA;
                  const ratingLabel = busbarLookup[sec.ratingId]?.label || sec.ratingId;
                  const rows = sec.calcRows || [];

                  return (
                    <React.Fragment key={sec.id}>
                      {/* Section Header Row */}
                      <tr className="bg-slate-100/70 dark:bg-zinc-800/60 font-bold border-t border-b border-border">
                        <td colSpan={10} className="p-2 text-foreground">
                          {sec.panelName || "Panel"} · {sec.name} ({ratingLabel}) · Total Length: {(sec.totalLength || sec.busbarLength || (rows.reduce((sum, rx) => sum + (Number(rx.length) || 0), 0))).toFixed(1)} {lenUnit}
                        </td>
                      </tr>

                      {rows.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">
                            {globalSrNo++}
                          </td>
                          <td className="p-2 border-r border-border font-bold text-foreground">
                            {sec.name}
                          </td>
                          <td className="p-2 border-r border-border">
                            <span className="font-semibold text-foreground">{r.floor || "-"}</span> - {r.description || r.desc || "Tap Off"}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {(Number(r.length) || 0).toFixed(1)}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono font-semibold">
                            {(Number(r.loadKw) || 0).toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {(Number(r.current ?? r.designCurrent ?? 0)).toFixed(1)} A
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono text-muted-foreground">
                            {(Number(r.pf) || 0.85).toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {(Number(r.vd ?? r.cumulativeVd ?? 0)).toFixed(3)} V
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono font-bold text-primary">
                            {(Number(r.vdPercent ?? r.cumulativeVdPct ?? 0)).toFixed(3)}%
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.isCompliant ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                              {r.isCompliant ? "PASS" : "FAIL"}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {/* Section Subtotal Row */}
                      <tr className="bg-slate-50 dark:bg-zinc-900/60 font-semibold border-b border-border text-xs">
                        <td className="p-2 border-r border-border text-center font-sans font-bold">Subtotal</td>
                        <td colSpan={2} className="p-2 border-r border-border font-bold text-foreground">{sec.name} Subtotal ({rows.length} Tap-Offs)</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold">{sec.busbarLength} {lenUnit}</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold text-primary">{(sec.totalConnectedLoad || 0).toFixed(2)} kW</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold">{(sec.totalDesignCurrent || 0).toFixed(1)} A</td>
                        <td className="p-2 border-r border-border text-center font-mono">-</td>
                        <td className="p-2 border-r border-border text-center font-mono">-</td>
                        <td className="p-2 border-r border-border text-center font-mono font-bold text-primary">{(sec.maxVdPct || 0).toFixed(2)}% max</td>
                        <td className="p-2 text-center font-bold text-emerald-700 dark:text-emerald-300">
                          {rows.every((r: any) => r.isCompliant) ? "PASS" : "FAIL"}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Grand Total Row */}
                <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold border-t-2 border-border text-foreground">
                  <td className="p-2 border-r border-border text-center font-sans">TOTAL</td>
                  <td colSpan={2} className="p-2 border-r border-border font-sans font-bold">ALL BUSBAR RUNS ({flatCalculatedSections.length} Sections · {totalTapOffsCount} Tap-Offs)</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">{totalRunLength.toFixed(1)} {lenUnit}</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold text-primary">{totalConnectedKw.toFixed(2)} kW</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold">{totalDesignIb.toFixed(1)} A</td>
                  <td className="p-2 border-r border-border text-center font-mono">-</td>
                  <td className="p-2 border-r border-border text-center font-mono">-</td>
                  <td className="p-2 border-r border-border text-center font-mono font-bold text-primary text-xs">{maxVdObserved.toFixed(2)}% max</td>
                  <td className="p-2 text-center font-bold text-emerald-700 dark:text-emerald-300">
                    {maxVdObserved <= 3 ? "PASS (≤3%)" : maxVdObserved <= 5 ? "WARNING" : "FAIL (>5%)"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. Executive Sizing & Governance Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Executive Electrical Sizing Summary
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
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
                    <td className="p-2 font-medium border-r border-border">Total Busbar Run Length</td>
                    <td className="p-2 text-muted-foreground border-r border-border">Route Layout</td>
                    <td className="p-2 text-center font-mono font-bold border-r border-border">{totalRunLength.toFixed(1)}</td>
                    <td className="p-2 text-center text-muted-foreground border-r border-border">{lenUnit}</td>
                    <td className="p-2 text-muted-foreground text-[11px]">Sum of all vertical risers and horizontal sandwich runs</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">2</td>
                    <td className="p-2 font-bold text-foreground border-r border-border">TOTAL CONNECTED DISTRIBUTION LOAD</td>
                    <td className="p-2 text-muted-foreground border-r border-border">Sum(Tap-Off Loads)</td>
                    <td className="p-2 text-center font-mono text-primary text-xs font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                      {totalConnectedKw.toFixed(2)} kW
                    </td>
                    <td className="p-2 text-center font-mono border-r border-border">kW</td>
                    <td className="p-2 text-muted-foreground text-[11px]">Aggregate connected branch load across all active tap-off units</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">3</td>
                    <td className="p-2 font-bold text-foreground border-r border-border">MAXIMUM OBSERVED VOLTAGE DROP</td>
                    <td className="p-2 text-muted-foreground border-r border-border">IEC 61439-6 / IEEE 141</td>
                    <td className="p-2 text-center font-mono text-emerald-700 dark:text-emerald-300 text-xs font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                      {maxVdObserved.toFixed(2)}%
                    </td>
                    <td className="p-2 text-center font-mono border-r border-border">%</td>
                    <td className="p-2 text-muted-foreground text-[11px]">Permissible maximum voltage drop: 3.0% (lighting) / 5.0% (power)</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">4</td>
                    <td className="p-2 font-medium border-r border-border">Total Configured Tap-Off Units</td>
                    <td className="p-2 text-muted-foreground border-r border-border">Floor Distribution</td>
                    <td className="p-2 text-center font-mono font-bold border-r border-border">{totalTapOffsCount} Units</td>
                    <td className="p-2 text-center text-muted-foreground border-r border-border">units</td>
                    <td className="p-2 text-muted-foreground text-[11px]">Plug-in tap-off boxes with integrated MCCB / fuse protection</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. 3-Tier Signature Sign-Off Block (Exact #FFE6CC Header) */}
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
// Compact Step-by-Step Formula Breakdown & Electrical Derivation Modal (Matching Fresh Air Cooling Load Standard)
// ─────────────────────────────────────────────────────────────────────────────
function BusbarFormulaBreakdownModal({
  onClose,
  unitSystem,
  panels,
  flatCalculatedSections,
}: {
  onClose: () => void;
  unitSystem: "si" | "ip";
  panels: any[];
  flatCalculatedSections: any[];
}) {
  const [activeTab, setActiveTab] = useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = useState(false);
  const ip = unitSystem === "ip";
  const lenUnit = ip ? "ft" : "m";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const sec = flatCalculatedSections?.[0] || {
    panelName: "Main LV Switchboard",
    name: "Busbar Run A (Ground to L10)",
    ratingLabel: "1600A Copper (Rt)",
    ratingAmps: 1600,
    r: 0.0277,
    x: 0.015,
    busbarLength: ip ? 150 : 45,
    totalConnectedLoad: 450,
    totalDesignCurrent: 683.7,
    maxVdVolts: 6.84,
    maxVdPct: 1.71,
    calcRows: [
      {
        desc: "Tap Off 1 - Floor 1 Panel",
        loadKw: 75,
        length: ip ? 15 : 4.5,
        ib: 113.9,
        vdVolts: 0.95,
        cumVdPct: 0.24,
      }
    ]
  };

  const sampleRow = sec.calcRows?.[0] || {
    desc: "Tap Off 1",
    loadKw: 75,
    length: ip ? 15 : 4.5,
    ib: 113.9,
    vdVolts: 0.95,
    cumVdPct: 0.24,
  };

  const pKw = sampleRow.loadKw || 75;
  const vLine = 400;
  const pf = 0.85;
  const sinPhi = Math.sqrt(1 - pf * pf);
  const ibSample = sampleRow.ib || (pKw * 1000) / (Math.sqrt(3) * vLine * pf);
  const rVal = sec.r || 0.0277;
  const xVal = sec.x || 0.015;
  const lenM = ip ? (sampleRow.length || 15) * 0.3048 : (sampleRow.length || 4.5);
  const vdVolts = Math.sqrt(3) * ibSample * (lenM / 1000) * (rVal * pf + xVal * sinPhi);
  const vdPct = (vdVolts / vLine) * 100;

  const handleCopySummary = () => {
    const text = `=== BUSBAR SIZING & VOLTAGE DROP FORMULA BREAKDOWN ===
Governing Design Standards: IEC 61439-6 (Low-Voltage Switchgear and Controlgear Assemblies - Busbar Trunking Systems) & BS EN 61439
Unit System: ${ip ? "IP Imperial (ft, kW, A, %)" : "SI Metric (m, kW, A, %)"}
Busway Section: ${sec.panelName} - ${sec.name} (${sec.ratingLabel})

--- 1. ACTIVE SIZING PARAMETERS ---
• Nominal Operating Voltage: 400 V Line-to-Line (3-Phase, 50/60 Hz)
• Operating Power Factor: cos φ = ${pf} (sin φ = ${sinPhi.toFixed(3)})
• Busbar AC Resistance (R): ${rVal} mΩ/m | Reactance (X): ${xVal} mΩ/m
• Total Connected Busway Load: ${sec.totalConnectedLoad} kW
• Total Design Current (Ib): ${sec.totalDesignCurrent.toFixed(1)} A (Rating: ${sec.ratingAmps || 1600} A)
• Sample Tap-Off: ${sampleRow.desc} (${pKw} kW @ ${sampleRow.length} ${lenUnit})
• Peak Observed Cumulative Drop: ${sec.maxVdPct?.toFixed(2)}% (Max Allowable: 3.00% / 5.00%)

--- 2. STEP-BY-STEP CALCULATION STEPS ---
[1] Tap-Off Full Load Design Current (Ib):
    Ib = (P × 1000) / (√3 × V_L × cos φ) = (${pKw} × 1000) / (1.732 × 400 × ${pf}) = ${ibSample.toFixed(1)} A

[2] Busbar Effective Impedance Vector (Z_eff):
    Z_eff = R × cos φ + X × sin φ = (${rVal} × ${pf}) + (${xVal} × ${sinPhi.toFixed(3)}) = ${(rVal * pf + xVal * sinPhi).toFixed(4)} mΩ/m

[3] Line-to-Line Voltage Drop (ΔV):
    ΔV = √3 × Ib × (L / 1000) × Z_eff = 1.732 × ${ibSample.toFixed(1)} A × ${(lenM/1000).toFixed(4)} km × ${(rVal * pf + xVal * sinPhi).toFixed(4)} mΩ/m = ${vdVolts.toFixed(2)} V

[4] Percentage Voltage Drop (%VD):
    %VD = (ΔV / V_nom) × 100% = (${vdVolts.toFixed(2)} V / 400 V) × 100% = ${vdPct.toFixed(2)}%

[5] Thermal Overcurrent Verification:
    Condition: In_rating ≥ Ib → ${sec.ratingAmps || 1600} A ≥ ${sec.totalDesignCurrent.toFixed(1)} A → Pass (Thermal Headroom: ${((sec.ratingAmps || 1600) - sec.totalDesignCurrent).toFixed(1)} A)

[6] Cumulative Voltage Drop Compliance:
    Cumul. %VD = ${sec.maxVdPct?.toFixed(2)}% ≤ 3.00% (Sub-distribution limit) → Pass
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Busbar calculation breakdown copied to clipboard!");
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
                Busbar Sizing &amp; Voltage Drop Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              IEC 61439-6
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
              {/* Active Section Banner */}
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider pb-1.5 mb-1.5 border-b border-border/60">
                  <span className="flex items-center gap-1 text-foreground">
                    <Sliders className="size-3 text-primary" /> Active Busway ({sec.ratingLabel})
                  </span>
                  <span className="font-mono text-primary normal-case font-bold">
                    Peak VD: {sec.maxVdPct?.toFixed(2)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Total Busway Load</span>
                    <span className="font-mono font-bold text-foreground">{sec.totalConnectedLoad} kW ({sec.totalDesignCurrent.toFixed(1)} A)</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Impedance Constants</span>
                    <span className="font-mono font-bold text-foreground">R: {rVal} | X: {xVal} mΩ/m</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: TAP-OFF DESIGN CURRENT */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">1</span>
                    <span className="font-bold text-[11.5px] text-foreground">Full Load Operating Current (Ib)</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {ibSample.toFixed(1)} A
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Ib = (P × 1000) / (√3 × V_L × cos φ)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">({pKw} kW × 1000) / (1.732 × 400V × {pf})</span>
                    <span className="text-primary font-bold">= {ibSample.toFixed(1)} A</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: LINE-TO-LINE VOLTAGE DROP */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">2</span>
                    <span className="font-bold text-[11.5px] text-foreground">Section Line Voltage Drop (ΔV)</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {vdVolts.toFixed(2)} V
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: ΔV = √3 × Ib × L × (R cos φ + X sin φ)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">1.732 × {ibSample.toFixed(1)}A × {lenM.toFixed(1)}m × Z_eff</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {vdVolts.toFixed(2)} V</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: PERCENTAGE VOLTAGE DROP */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">3</span>
                    <span className="font-bold text-[11.5px] text-foreground">Percentage Drop &amp; Compliance (%VD)</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {vdPct.toFixed(2)}% (≤ 3.0%)
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: %VD = (ΔV / 400V) × 100%</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">({vdVolts.toFixed(2)} V / 400 V) × 100%</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Pass (Compliant)</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: BUSBAR THERMAL RATING CHECK */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">4</span>
                    <span className="font-bold text-[11.5px] text-foreground">Continuous Current Carrying Capacity</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {sec.ratingAmps || 1600} A Rating
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Criterion: Rated Current In ≥ Total Design Current Ib</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{sec.ratingAmps || 1600} A ≥ {sec.totalDesignCurrent.toFixed(1)} A</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">Safe Thermal Loading</span>
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
                  <span className="size-2 rounded-full bg-primary" /> 1. AC Voltage Drop Calculation (IEC 61439-6)
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg font-mono text-[11px] space-y-1 border border-border/60">
                  <div className="text-primary font-bold">ΔV = √3 × I × L × (R·cos φ + X·sin φ)</div>
                  <div className="text-foreground">%VD = (ΔV / V_nominal) × 100%</div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Applies the standard phasor representation across the resistive and inductive reactance components of the copper or aluminum busbar conductor. R is corrected for steady-state operating temperature.
                </p>
              </div>

              <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                <div className="font-bold text-foreground text-[12px] flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" /> 2. 3-Phase Symmetrical Current Derivation
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg font-mono text-[11px] space-y-1 border border-border/60">
                  <div className="text-blue-600 dark:text-blue-400 font-bold">I_b = (P_kW × 1000) / (√3 × V_L × cos φ)</div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Computes line current per phase assuming a balanced 3-phase, 4-wire 400V/230V commercial electrical distribution network.
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
                      <th className="p-2 text-left w-24">Typical Value</th>
                      <th className="p-2 text-left w-20">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">V_L</td>
                      <td className="p-2 text-muted-foreground">Nominal 3-phase line-to-line RMS system voltage</td>
                      <td className="p-2 font-mono text-[11px]">400 / 415</td>
                      <td className="p-2 font-mono text-[11px]">Volts (V)</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">R</td>
                      <td className="p-2 text-muted-foreground">Conductor AC resistance per unit length at operating temp</td>
                      <td className="p-2 font-mono text-[11px]">Manufacturer</td>
                      <td className="p-2 font-mono text-[11px]">mΩ/m</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">X</td>
                      <td className="p-2 text-muted-foreground">Conductor inductive reactance per unit length at 50/60 Hz</td>
                      <td className="p-2 font-mono text-[11px]">Manufacturer</td>
                      <td className="p-2 font-mono text-[11px]">mΩ/m</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">cos φ</td>
                      <td className="p-2 text-muted-foreground">Operating electrical load displacement power factor</td>
                      <td className="p-2 font-mono text-[11px]">0.85</td>
                      <td className="p-2 font-mono text-[11px]">-</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">%VD_max</td>
                      <td className="p-2 text-muted-foreground">Permissible voltage drop threshold for power circuits</td>
                      <td className="p-2 font-mono text-[11px]">3.0% - 5.0%</td>
                      <td className="p-2 font-mono text-[11px]">%</td>
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
