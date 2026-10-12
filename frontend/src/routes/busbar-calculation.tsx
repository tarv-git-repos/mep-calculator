import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { addPdfSignatureBlock, addPdfHeader, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { EditBusbarRowModal } from "@/components/workspace/EditBusbarRowModal";
import { TBtn } from "@/components/workspace/Button";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { TaskComment } from "@/lib/ventilation-calc";
import { toast } from "sonner";
import { Plus, Trash2, Download, Upload, ChevronRight, ChevronDown, Trash, Copy, Check, ArrowRight, Zap, FolderPlus, X, Eye, EyeOff, LayoutGrid, Info, Search, FileText, Edit3, MessageSquare, Flag, Filter, SlidersHorizontal, Lock, Sparkles } from "lucide-react";
import { syncBusbarFrom3DAndLoadSummary, BusbarSyncResult } from "@/lib/calc-busbar-sync";
import { SyncBusbarModal } from "@/components/workspace/SyncBusbarModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/busbar-calculation", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/busbar-calculation", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const isApproved = useCalculationLock("/busbar-calculation");
  const currentUserName = userData?.name || profile?.name || "System Admin";

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

  const handleApplySync = (mode: "replace" | "append") => {
    if (!syncResult) return;
    pushToUndo(panels);
    if (mode === "replace") {
      setPanels([syncResult.panel]);
    } else {
      setPanels((prev) => [...prev, syncResult.panel]);
    }
    setSyncModalOpen(false);
    toast.success(
      `Generated vertical busduct riser (${syncResult.floors.length} floors) with ${syncResult.recommendedRatingLabel}!`
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

  useEffect(() => {
    if (isApproved) {
      setSelectedRows(new Set());
    }
  }, [isApproved]);
  const [lastSelectedRowId, setLastSelectedRowId] = useState<string | null>(null);

  const [busbarColWidths, setBusbarColWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_grid_busbar_cols");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      select: 32,
      no: 36,
      desc: 220,
      len: 90,
      loadKw: 90,
      tclKw: 90,
      div: 70,
      mdKw: 90,
      curA: 90,
      vdV: 90,
      vdPct: 90,
      actions: 60,
    };
  });

  const totalBusbarTableWidth = useMemo(() => {
    return Object.values(busbarColWidths).reduce((a, b) => a + b, 0);
  }, [busbarColWidths]);

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

  const addPanel = () => {
    if (isApproved) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    pushToUndo(panels);
    const num = panels.length + 1;
    setPanels([...panels, {
      id: `pan_${Date.now()}`,
      name: `LV PANEL-${num}`,
      sections: [{
        id: `sec_${Date.now()}`,
        name: `BB-1`,
        ratingId: "2500_rt",
        volts: 415,
        pf: 0.8,
        rows: []
      }]
    }]);
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
                    div: divVal !== "" ? divVal : currentRows[idx].div,
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

  const addRow = (panelId: string, sectionId: string) => {
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
              const newRow: BusbarRow = {
                id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                from: s.rows.length === 0 ? p.name : s.rows[s.rows.length - 1].from,
                desc: s.rows.length === 0 ? "SMDB-L7-1" : "",
                ref: s.name,
                length: "",
                loadKw: "",
                div: 0.7,
              };
              return { ...s, rows: [...s.rows, newRow] };
            }
            return s;
          })
        };
      }
      return p;
    }));
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
    return calculatedPanels.flatMap(p => p.calcSections.map(s => ({ ...s, panelName: p.name })));
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

    
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "busbar-calculation");
    const buffer = await workbook.xlsx.writeBuffer();
    await downloadFile(new Uint8Array(buffer), "Busbar_Calculation.xlsx", "Excel Document", ["xlsx"]);
  };

  const exportPdf = () => {
    try {
      const doc = new jsPDF("l", "mm", "a4");
      const primaryFill: [number, number, number] = [217, 217, 217];

      const runAutoTable = (options: any) => {
        if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else if (typeof (autoTable as any)?.default === 'function') {
          (autoTable as any).default(doc, options);
        } else if ((doc as any).autoTable) {
          (doc as any).autoTable(options);
        }
      };

      let lastSectionCardEndY = 50;

      if (flatCalculatedSections.length === 0) {
        const startY = addPdfHeader(doc, "Busbar Voltage Drop Calculation Report");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("No busbar sections calculated.", 14, startY + 5);
        lastSectionCardEndY = startY + 15;
      } else {
        flatCalculatedSections.forEach((section, sIndex) => {
          if (sIndex > 0) doc.addPage();
          
          const headerStartY = addPdfHeader(doc, "Busbar Voltage Drop Calculation Report");
          
          const ratingLabel = ALL_BUSBAR_DATA[section.ratingId]?.label || section.ratingId;
          const rawR = ALL_BUSBAR_DATA[section.ratingId]?.r || 0;
          const rawX = ALL_BUSBAR_DATA[section.ratingId]?.x || 0;
          const rVal = (unitSystem === "ip" ? (rawR * 0.3048) : rawR).toFixed(4);
          const xVal = (unitSystem === "ip" ? (rawX * 0.3048) : rawX).toFixed(4);
          const rUnit = unitSystem === "ip" ? "mOhm/ft" : "mOhm/m";

          // Styled Subheader Info Box
          const infoBoxStartY = headerStartY + 2;
          doc.setFillColor(245, 247, 250);
          doc.setDrawColor(200, 200, 200);
          doc.roundedRect(14, infoBoxStartY, 269, 12, 1.5, 1.5, "FD");

          doc.setFontSize(8.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(`Panel: ${section.panelName}  |  Busbar Section: ${section.name}`, 18, infoBoxStartY + 4.5);

          doc.setFontSize(8.0);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(60, 60, 60);
          const useMd = section.useMdForCurrent !== false;
          const currentBasis = useMd ? "MD" : "TCL";
          doc.text(`Selected Busbar: ${ratingLabel} (R: ${rVal} ${rUnit}, X: ${xVal} ${rUnit})  |  Voltage: ${section.volts}V  |  PF: ${section.pf}  |  Current Basis: ${currentBasis}`, 18, infoBoxStartY + 9);

          const tableData = (section.calcRows || []).map((r, idx) => {
            const row = [
              idx + 1,
              r.desc || "",
              (r.length || 0).toString(),
              (r.loadKw || 0).toString(),
              (r.tcl || 0).toFixed(2),
            ];
            if (useMd) {
              row.push((r.md || 0).toFixed(2));
            }
            row.push(
              (r.current || 0).toFixed(2),
              (r.vd || 0).toFixed(2),
              (r.vdPercent || 0).toFixed(3) + "%",
              (r.cumulativeVdPercent || 0).toFixed(3) + "%"
            );
            return row;
          });

          const totalVd = (section.calcRows || []).reduce((sum, row) => sum + (Number(row.vd) || 0), 0);
          const totalCumVd = (section as any).totalCumulativeVd ?? (section.calcRows?.[section.calcRows.length - 1]?.cumulativeVdPercent ?? 0);
          const isExceeded = totalCumVd > 2.5;

          const footData = [
            useMd ? [
              "",
              "Cumulative VD up to SMDB",
              "",
              "",
              "",
              "",
              "",
              totalVd.toFixed(2) + " V",
              Number(totalCumVd).toFixed(3) + "%",
              isExceeded ? "EXCEEDS (FAIL)" : "PASS"
            ] : [
              "",
              "Cumulative VD up to SMDB",
              "",
              "",
              "",
              totalVd.toFixed(2) + " V",
              Number(totalCumVd).toFixed(3) + "%",
              isExceeded ? "EXCEEDS (FAIL)" : "PASS"
            ]
          ];

          const lenHeader = unitSystem === "ip" ? "Len (ft)" : "Len (m)";

          // Dynamic Column Widths (Printable width: 269mm)
          const columnStyles: Record<number, any> = useMd ? {
            0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
            1: { cellWidth: 45, halign: "left", fontStyle: "bold", cellPadding: { left: 3.5, right: 1.5, top: 3.0, bottom: 3.0 } },
            2: { cellWidth: 26.5, halign: "center" },
            3: { cellWidth: 26.5, halign: "center" },
            4: { cellWidth: 26.5, halign: "center" },
            5: { cellWidth: 26.5, halign: "center" },
            6: { cellWidth: 26.5, halign: "center" },
            7: { cellWidth: 26.5, halign: "center" },
            8: { cellWidth: 26.5, halign: "center" },
            9: { cellWidth: 26.5, halign: "center" }
          } : {
            0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
            1: { cellWidth: 47, halign: "left", fontStyle: "bold", cellPadding: { left: 3.5, right: 1.5, top: 3.0, bottom: 3.0 } },
            2: { cellWidth: 30, halign: "center" },
            3: { cellWidth: 30, halign: "center" },
            4: { cellWidth: 30, halign: "center" },
            5: { cellWidth: 30, halign: "center" },
            6: { cellWidth: 30, halign: "center" },
            7: { cellWidth: 30, halign: "center" },
            8: { cellWidth: 30, halign: "center" }
          };

          const pdfHead = [
            useMd
              ? ["No.", "Description", lenHeader, "Load\n(kW)", "TCL\n(kW)", "MD\n(kW)", "Current\n(A)", "Vdrop\n(V)", "Vdrop\n%", "Cum.\n%"]
              : ["No.", "Description", lenHeader, "Load\n(kW)", "TCL\n(kW)", "Current\n(A)", "Vdrop\n(V)", "Vdrop\n%", "Cum.\n%"]
          ];

          runAutoTable({
            head: pdfHead,
            body: tableData,
            foot: footData,
            startY: infoBoxStartY + 15,
            theme: "grid",
            styles: {
              font: "helvetica",
              fontSize: 7.5,
              textColor: [0, 0, 0],
              halign: "center",
              valign: "middle",
              lineColor: [100, 100, 100],
              lineWidth: 0.1,
              cellPadding: { top: 3.0, bottom: 3.0, left: 1.5, right: 1.5 },
              minCellHeight: 8.5
            },
            headStyles: {
              fillColor: primaryFill,
              textColor: [0, 0, 0],
              fontStyle: "bold",
              fontSize: 7.5,
              halign: "center",
              valign: "middle",
              lineColor: [100, 100, 100],
              lineWidth: 0.1,
              cellPadding: { top: 3.0, bottom: 3.0, left: 1.0, right: 1.0 },
              minCellHeight: 8.5
            },
            bodyStyles: {
              fontSize: 7.5,
              textColor: [0, 0, 0],
              halign: "center",
              valign: "middle",
              lineColor: [100, 100, 100],
              lineWidth: 0.1,
              cellPadding: { top: 3.0, bottom: 3.0, left: 1.5, right: 1.5 },
              minCellHeight: 8.5
            },
            footStyles: {
              fillColor: isExceeded ? [255, 230, 230] : [240, 240, 240],
              textColor: isExceeded ? [180, 0, 0] : [0, 0, 0],
              fontStyle: "bold",
              fontSize: 7.5,
              halign: "center",
              valign: "middle",
              lineColor: [100, 100, 100],
              lineWidth: 0.1,
              minCellHeight: 8.5
            },
            columnStyles: columnStyles,
            margin: { left: 14, right: 14 }
          });

          const tableFinalY = (doc as any).lastAutoTable?.finalY || (infoBoxStartY + 35);
          const cardStartY = tableFinalY + 6;
          
          // Draw Summary & Recommendation Card (Spanning full 269mm width)
          doc.setFillColor(isExceeded ? 253 : 245, isExceeded ? 237 : 248, isExceeded ? 237 : 245);
          doc.setDrawColor(isExceeded ? 231 : 180, isExceeded ? 76 : 180, isExceeded ? 60 : 180);
          doc.roundedRect(14, cardStartY, 269, 14, 2, 2, "FD");

          doc.setFontSize(8.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(isExceeded ? 192 : 39, isExceeded ? 57 : 174, isExceeded ? 43 : 96);
          doc.text(`SELECTED / SUGGESTED BUSBAR: ${ratingLabel}`, 18, cardStartY + 5);
          
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          doc.text(`Cumulative Voltage Drop: ${Number(totalCumVd).toFixed(3)}% | Status: ${isExceeded ? 'EXCEEDS 2.5% STANDARD LIMIT (Select larger busbar rating)' : 'WITHIN 2.5% STANDARD LIMIT (PASS)'}`, 18, cardStartY + 10);

          lastSectionCardEndY = cardStartY + 14;
        });
      }
      
      const sigFinalY = Math.max(lastSectionCardEndY + 8, 75);
      
      // Add Signature Block matching Full Page Width (269mm)
      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails(project?.id || "default", "busbar-calculation", currentUserName);

      runAutoTable({
        startY: sigFinalY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        headStyles: {
          fillColor: [255, 230, 204],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
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
            { content: originatedName, styles: { halign: "center" } },
            { content: reviewerName, styles: { halign: "center" } },
            { content: approverName, styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate, styles: { halign: "center" } },
            { content: reviewerDate, styles: { halign: "center" } },
            { content: approverDate, styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 38, fontStyle: "bold", halign: "right" },
          1: { cellWidth: 77, halign: "center" },
          2: { cellWidth: 77, halign: "center" },
          3: { cellWidth: 77, halign: "center" }
        }
      });

      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), "Busbar_Calculation.pdf", "PDF Document", ["pdf"]);
      toast.success("Busbar calculation PDF exported successfully!");
    } catch (err) {
      console.error("Failed to export PDF:", err);
      toast.error("Failed to export Busbar calculation PDF.");
    }
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
      spaceCount={panels.length}
      spaceCountUnit={panels.length === 1 ? "panel" : "panels"}
      actions={
        <UnitToggle
          unitSystem={unitSystem}
          onChange={handleUnitToggle}
          disabled={isApproved}
          ipLabel="IP"
          siLabel="SI"
          ipDescription="Imperial (IP) [Feet - ft]"
          siDescription="Metric (SI) [Meters - m]"
          inputDescriptions="Busbar Run Lengths"
          conversionExample={
            unitSystem === "si"
              ? "Convert 160.0 m → 524.93 ft, 3.5 m → 11.48 ft"
              : "Convert 524.93 ft → 160.0 m, 11.48 ft → 3.5 m"
          }
        />
      }
    >
      
      <div className={`flex-1 flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30`}>
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        <div className="relative z-10 flex flex-col h-full w-full">
        {/* Sizer Section Header with Search, Filters, View, Flag Filter & Module Actions */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2 min-h-[44px] h-auto border-b border-border bg-background shrink-0 select-none gap-2 overflow-visible">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tap offs..."
                className="h-7 w-56 pl-8 pr-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition-all"
              />
            </div>

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
                    <button onClick={handleResetFilters} className="text-[10px] text-primary hover:underline font-semibold">
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
                    <option value="within">Within Limit (â‰¤ 2.5%)</option>
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
                    <option value="low">Low Load (â‰¤ 100 kW)</option>
                  </select>
                </div>
              </PopoverContent>
            </Popover>

            {/* View Icon Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                    sortBy !== "none" || rowDensity === "compact"
                      ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                      : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <SlidersHorizontal className="size-3.5 shrink-0" />
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                    View / Sort
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                <div className="pb-1.5 border-b border-border text-xs font-bold text-foreground">
                  View Options
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Row Density</span>
                  <div className="flex rounded-full border border-border p-0.5 bg-surface-2">
                    <button
                      onClick={() => setRowDensity("default")}
                      className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all ${
                        rowDensity === "default" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      Default
                    </button>
                    <button
                      onClick={() => setRowDensity("compact")}
                      className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all ${
                        rowDensity === "compact" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      Compact
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="h-7 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                  >
                    <option value="none">Original Order</option>
                    <option value="desc">Description (A-Z)</option>
                    <option value="load">Load kW (High to Low)</option>
                    <option value="vd">V.Drop % (High to Low)</option>
                  </select>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
            <button
              disabled={isApproved}
              onClick={handleSync3DAndLoadSummary}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border border-primary/30 bg-primary/10 text-primary transition-all shadow-xs ${
                isApproved
                  ? "opacity-50 cursor-not-allowed pointer-events-none"
                  : "cursor-pointer hover:bg-primary/20 hover:border-primary/50"
              }`}
              title="Automatically generate vertical busduct riser from 3D Studio floor heights & Load Summary active kW"
            >
              <Sparkles className="size-3.5" />
              <span>Sync 3D & Load Summary</span>
            </button>

            <label className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border border-border bg-surface-2 text-foreground transition-all ${isApproved ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer hover:bg-surface-3"}`}>
              <Download className="size-3.5" /> Import Ratings
              <input type="file" disabled={isApproved} accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
            </label>

            <button
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
            >
              <FileText className="size-3.5" /> Export
            </button>


            <button
              disabled={isApproved}
              onClick={addPanel}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="size-3.5" /> Add LV Panel
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-background p-4 md:p-6 gap-4 flex flex-col min-h-0">
          {calculatedPanels.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-2xl bg-surface-1/40 my-auto">
              <div className="p-3 rounded-full bg-primary/10 text-primary mb-3">
                <Plus className="size-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No LV Panels</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                All panels have been removed. Click "+ Add LV Panel" or "Sync 3D & Load Summary" to create one.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <button
                  disabled={isApproved}
                  onClick={addPanel}
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
              <div key={panel.id} className="flex flex-col bg-card border border-border rounded-2xl shadow-xs overflow-hidden shrink-0">
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
                      className="h-8 px-2 border border-border rounded bg-background focus:bg-white outline-none font-bold w-48 text-[13px] disabled:opacity-60 disabled:cursor-not-allowed"
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
                            <table className="table-fixed text-[12px] border-collapse whitespace-nowrap w-full" style={{ width: "100%", minWidth: `${Math.max(950, totalBusbarTableWidth)}px` }}>
                              <thead className="bg-header-bg sticky top-0 z-10 border-b border-border text-muted-foreground font-semibold select-none">
                                <tr className="text-left">
                                  <th style={{ width: busbarColWidths.select }} className="px-1 py-2 text-center relative group">
                                    <input 
                                      type="checkbox" 
                                      className="cursor-pointer"
                                      checked={isAllSelected}
                                      onChange={(e) => {
                                        const newSet = new Set(selectedRows);
                                        section.calcRows.forEach(r => {
                                          if (e.target.checked) newSet.add(r.id);
                                          else newSet.delete(r.id);
                                        });
                                        setSelectedRows(newSet);
                                      }}
                                    />
                                    <div onMouseDown={(e) => handleResizeMouseDown("select", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.no }} className="px-1 py-2 text-center text-[11px] relative group">
                                    No.
                                    <div onMouseDown={(e) => handleResizeMouseDown("no", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.desc }} className="px-2 py-2 relative group">
                                    Description
                                    <div onMouseDown={(e) => handleResizeMouseDown("desc", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.len }} className="px-2 py-2 text-center relative group">
                                    Len ({unitSystem === "ip" ? "ft" : "m"})
                                    <div onMouseDown={(e) => handleResizeMouseDown("len", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.loadKw }} className="px-2 py-2 text-center relative group">
                                    Load (kW)
                                    <div onMouseDown={(e) => handleResizeMouseDown("loadKw", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.tclKw }} className="px-2 py-2 text-center bg-surface-2 text-foreground relative group">
                                    TCL (kW)
                                    <div onMouseDown={(e) => handleResizeMouseDown("tclKw", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.div }} className="px-2 py-2 text-center relative group">
                                    Div
                                    <div onMouseDown={(e) => handleResizeMouseDown("div", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.mdKw }} className="px-1 py-1.5 text-center bg-surface-2 text-foreground relative group select-none">
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
                                    <div onMouseDown={(e) => handleResizeMouseDown("mdKw", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.curA }} className="px-2 py-2 text-center bg-surface-2 text-foreground relative group">
                                    Cur. (A)
                                    <div onMouseDown={(e) => handleResizeMouseDown("curA", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.vdV }} className="px-2 py-2 text-center text-primary relative group">
                                    Vd (V)
                                    <div onMouseDown={(e) => handleResizeMouseDown("vdV", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.vdPct }} className="px-2 py-2 text-center text-primary relative group">
                                    Vd %
                                    <div onMouseDown={(e) => handleResizeMouseDown("vdPct", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                                  </th>
                                  <th style={{ width: busbarColWidths.actions }} className="px-2 py-2 text-center text-[11px]">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
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
                                        <td colSpan={16} className="text-center py-10 text-muted-foreground italic">
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

                                    return (
                                    <tr 
                                      key={r.id} 
                                      id={`busbar-row-${r.id}`} 
                                      data-row-id={r.id}
                                      className={`transition-all duration-200 cursor-pointer ${rowDensity === "compact" ? "h-6 text-[11px]" : ""} ${
                                        editingRow?.row.id === r.id
                                          ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                                          : editingRow !== null
                                          ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200"
                                          : selectedRows.has(r.id)
                                          ? "bg-primary/10"
                                          : "hover:bg-surface-2"
                                      }`}
                                      onDoubleClick={() => {
                                        if (isApproved) return;
                                        setSelectedRows(new Set([r.id]));
                                        setEditingRow({ row: r, panelId: panel.id, sectionId: section.id });
                                      }}
                                      onClick={(e) => {
                                        const tagName = (e.target as HTMLElement).tagName;
                                        if (tagName === 'TD') {
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
                                        <td style={{ width: busbarColWidths.select, minWidth: busbarColWidths.select, maxWidth: busbarColWidths.select }} className="p-0 text-center">
                                           <div className="flex items-center justify-center h-full w-full">
                                             <input 
                                               type="checkbox" 
                                               disabled={isApproved}
                                               className="cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                               checked={selectedRows.has(r.id)}
                                               onChange={() => {}}
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                               }}
                                             />
                                           </div>
                                         </td>
                                         <td style={{ width: busbarColWidths.no, minWidth: busbarColWidths.no, maxWidth: busbarColWidths.no }} className="text-center text-muted-foreground font-medium px-0.5 text-[11.5px] relative">
                                           {(() => {
                                             const itemComments = getMergedItemComments(r.id, r.desc || r.from || `Tap Off ${r.ref || r.id}`, r.comments, "/busbar-calculation", project?.id);
                                             return (
                                               <RowCommentCornerBadge
                                                 id={r.id}
                                                 count={itemComments.length}
                                                 onClick={() => handleOpenComment(r)}
                                                 title={`${itemComments.length} comment(s)/task(s) assigned to "${r.desc || r.from || `Tap Off ${r.ref || r.id}`}"`}
                                               />
                                             );
                                           })()}
                                           {idx + 1}
                                         </td>
                                         <td style={{ width: busbarColWidths.desc, minWidth: busbarColWidths.desc, maxWidth: busbarColWidths.desc }} className="p-0" onDoubleClick={() => { if (isApproved) return; setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}>
                                          <div className="flex items-center gap-1.5 w-full px-1">
                                            <input 
                                              disabled={isApproved}
                                              data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={0} 
                                              onKeyDown={(e) => handleKeyDown(e, 0)} 
                                              onDoubleClick={(e) => { e.stopPropagation(); if (isApproved) return; setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}
                                              type="text" 
                                              className="w-full h-8 px-1 bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground flex-1 disabled:opacity-60 disabled:cursor-not-allowed" 
                                              value={r.desc} 
                                              onChange={e => updateRow(panel.id, section.id, r.id, "desc", e.target.value)} 
                                            />
                                          </div>
                                        </td>
                                        <td style={{ width: busbarColWidths.len, minWidth: busbarColWidths.len, maxWidth: busbarColWidths.len }} className="p-0" onDoubleClick={() => { if (isApproved) return; setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}>
                                          <input 
                                            disabled={isApproved}
                                            data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={1} 
                                            onKeyDown={(e) => handleKeyDown(e, 1)} 
                                            onDoubleClick={(e) => { e.stopPropagation(); if (isApproved) return; setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}
                                            type="number" step="0.1" 
                                            className="w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground disabled:opacity-60 disabled:cursor-not-allowed" 
                                            value={r.length} 
                                            onChange={e => updateRow(panel.id, section.id, r.id, "length", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} 
                                          />
                                        </td>
                                        <td style={{ width: busbarColWidths.loadKw, minWidth: busbarColWidths.loadKw, maxWidth: busbarColWidths.loadKw }} className="p-0" onDoubleClick={() => { if (isApproved) return; setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}>
                                          <input 
                                            disabled={isApproved}
                                            data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={2} 
                                            onKeyDown={(e) => handleKeyDown(e, 2)} 
                                            onDoubleClick={(e) => { e.stopPropagation(); if (isApproved) return; setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}
                                            type="number" step="0.1" 
                                            className="w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground disabled:opacity-60 disabled:cursor-not-allowed" 
                                            value={r.loadKw} 
                                            onChange={e => updateRow(panel.id, section.id, r.id, "loadKw", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} 
                                          />
                                        </td>
                                        
                                        <td style={{ width: busbarColWidths.tclKw, minWidth: busbarColWidths.tclKw, maxWidth: busbarColWidths.tclKw }} className="px-2 py-1 text-center font-bold bg-surface-2 text-foreground cursor-pointer" onDoubleClick={() => { if (isApproved) return; setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}>{r.tcl.toFixed(2)}</td>
                                        
                                        <td style={{ width: busbarColWidths.div, minWidth: busbarColWidths.div, maxWidth: busbarColWidths.div }} className="p-0" onDoubleClick={() => { if (isApproved) return; setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}>
                                          <input 
                                            disabled={isApproved}
                                            data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={3} 
                                            onKeyDown={(e) => handleKeyDown(e, 3)} 
                                            onDoubleClick={(e) => { e.stopPropagation(); if (isApproved) return; setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}
                                            type="number" step="0.01" max="1" 
                                            className="w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground disabled:opacity-60 disabled:cursor-not-allowed" 
                                            value={r.div} 
                                            onChange={e => updateRow(panel.id, section.id, r.id, "div", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} 
                                          />
                                        </td>
                                        
                                        <td style={{ width: busbarColWidths.mdKw, minWidth: busbarColWidths.mdKw, maxWidth: busbarColWidths.mdKw }} className="px-2 py-1 text-center font-semibold bg-surface-2 font-mono text-foreground cursor-pointer" onDoubleClick={() => { setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}>{r.md.toFixed(2)}</td>
                                        <td style={{ width: busbarColWidths.curA, minWidth: busbarColWidths.curA, maxWidth: busbarColWidths.curA }} className="px-2 py-1 text-center font-semibold bg-surface-2 font-mono text-foreground cursor-pointer" onDoubleClick={() => { setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}>{r.current.toFixed(2)}</td>
                                        <td style={{ width: busbarColWidths.vdV, minWidth: busbarColWidths.vdV, maxWidth: busbarColWidths.vdV }} className="px-2 py-1 text-center text-primary font-medium font-mono cursor-pointer" onDoubleClick={() => { setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}>{r.vd.toFixed(2)}</td>
                                        <td style={{ width: busbarColWidths.vdPct, minWidth: busbarColWidths.vdPct, maxWidth: busbarColWidths.vdPct }} className={`px-2 py-1 text-center font-mono font-medium cursor-pointer ${r.vdPercent > 2.5 ? "text-destructive bg-destructive/5" : "text-primary"}`} onDoubleClick={() => { setSelectedRows(new Set([r.id])); setEditingRow({ row: r, panelId: panel.id, sectionId: section.id }); }}>{r.vdPercent.toFixed(3)}%</td>
                                        
                                        <td style={{ width: busbarColWidths.actions, minWidth: busbarColWidths.actions, maxWidth: busbarColWidths.actions }} className="text-center p-0">
                                         <div className="flex items-center justify-center gap-1 px-1">
                                           {(() => {
                                             const { isAutoFlagged, isFlagged, warnings } = getBusbarRowValidation(r, r.vdPercent);
                                             const tooltipText = isFlagged
                                               ? warnings.length > 0
                                                 ? `Flagged for review. Warning(s): ${warnings.join(", ")}`
                                                 : "Flagged for manual review"
                                               : "Flag tap off for review";

                                             return (
                                               <button 
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   toggleFlagRows(r.id, isFlagged);
                                                 }} 
                                                 className={`p-1 rounded transition-colors cursor-pointer ${
                                                   isFlagged
                                                     ? "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/20"
                                                     : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                 }`}
                                                 title={tooltipText}
                                               >
                                                 <Flag className={`size-3.5 ${isFlagged ? "fill-red-500 text-red-500" : ""}`} />
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
      </div>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-900 border border-border rounded-xl shadow-xl py-1.5 text-xs font-bold text-foreground w-48 select-none"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10.5px] text-muted-foreground border-b border-border/60 uppercase">
            Options ({selectedRows.has(contextMenu.rowId) ? selectedRows.size : 1} selected)
          </div>
          <button
            onClick={() => {
              if (isApproved) { toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" }); setContextMenu(null); return; }
              const idsToCopy = selectedRows.has(contextMenu.rowId) ? Array.from(selectedRows) : [contextMenu.rowId];
              pushToUndo(panels);
              copyRows(idsToCopy);
              pasteRows();
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            <Copy className="size-3.5 text-[#0A7BC7]" /> Duplicate Row(s)
          </button>
          <button
            onClick={() => {
              if (isApproved) { toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" }); setContextMenu(null); return; }
              const inputEl = document.querySelector(`tr[data-row-id="${contextMenu.rowId}"] input[type="text"]`) as HTMLInputElement;
              if (inputEl) {
                inputEl.focus();
                inputEl.select();
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            <Edit3 className="size-3.5 text-amber-500" /> Edit Parameters
          </button>
          <button
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
            className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium text-blue-600 dark:text-blue-400 rounded"
          >
            <MessageSquare className="size-3.5" />
            <span>Add Comment</span>
          </button>
          <button
            onClick={() => {
              if (isApproved) { toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" }); setContextMenu(null); return; }
              let isCurrentlyFlagged = false;
              panels.forEach(p => p.sections.forEach(s => s.rows.forEach(r => {
                if (r.id === contextMenu.rowId) isCurrentlyFlagged = Boolean(r.flagged);
              })));
              toggleFlagRows(contextMenu.rowId, isCurrentlyFlagged);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium text-red-600 dark:text-red-400"
          >
            <Flag className="size-3.5" /> Flag / Unflag Row(s)
          </button>
          <div className="my-1 border-t border-border/60"></div>
          <button
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
            className="w-full px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-semibold"
          >
            <Trash2 className="size-3.5" /> Delete Row(s)
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
                let wdata = project.workspace_data || {};
                if (typeof wdata === 'string') { try { wdata = JSON.parse(wdata); } catch(e) {} }
                wdata.busbar_calc = { panels: nextPanels, updatedAt: new Date().toISOString() };
                api.updateProject(project.id, { workspace_data: wdata }).catch(console.error);
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
              if (updated.desc !== undefined) updateRow(editingRow.panelId, editingRow.sectionId, editingRow.row.id, "desc", updated.desc);
              if (updated.length !== undefined) updateRow(editingRow.panelId, editingRow.sectionId, editingRow.row.id, "length", updated.length);
              if (updated.loadKw !== undefined) updateRow(editingRow.panelId, editingRow.sectionId, editingRow.row.id, "loadKw", updated.loadKw);
              if (updated.div !== undefined) updateRow(editingRow.panelId, editingRow.sectionId, editingRow.row.id, "div", updated.div);
              if (updated.ratingId !== undefined) updateSection(editingRow.panelId, editingRow.sectionId, "ratingId", updated.ratingId);
              if (updated.volts !== undefined) updateSection(editingRow.panelId, editingRow.sectionId, "volts", updated.volts);
              if (updated.pf !== undefined) updateSection(editingRow.panelId, editingRow.sectionId, "pf", updated.pf);
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
    </AppShell>
  );
}
