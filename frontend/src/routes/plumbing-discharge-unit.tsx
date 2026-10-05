import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { Trash2, Plus, FileSpreadsheet, Info, ChevronDown, ChevronUp, Save, X, Download, Flag, Search, Filter, SlidersHorizontal, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { useAuth } from "@/contexts/AuthContext";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { MessageSquare } from "lucide-react";
import { exportDischargeUnitPDF } from "@/lib/exportDischargeUnitPDF";
import {
  type FUSpace,
  getFUSpaceValidation,
  IP_DISCHARGE_UNITS,
  DU_FIXTURES_META,
  extractFloorFU,
  computePlumbingDischargeCalculations
} from "@/lib/calc-plumbing-discharge-unit";


export const Route = createFileRoute("/plumbing-discharge-unit")({
  head: () => ({
    meta: [
      { title: "Discharge Unit Calculator — MEP Calc" },
      { name: "description", content: "Water Supply Discharge Units (D.U.) sizing tool using Hunter's Curve Method." },
    ],
  }),
  component: DischargeUnitPage,
});

function DischargeUnitPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-discharge-unit", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-discharge-unit", activeProjectId || project?.id);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [headerStd, setHeaderStd] = useState<string>("total-du");
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number>>({});
  const [fuSpaces, setFuSpaces] = useState<FUSpace[]>([]);
  const [previewSpace, setPreviewSpace] = useState<FUSpace | null>(null);
  const [activeTab, setActiveTab] = useState<"spaces" | "report">("spaces");
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<any>(null);

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (newComment: any) => {
    if (!commentTargetItem) return;
    const nextSpaces = fuSpaces.map((s: any) => {
      if (String(s.id) === String(commentTargetItem.id)) {
        return { ...s, comments: [...(s.comments || []), newComment] };
      }
      return s;
    });
    setFuSpaces(nextSpaces);
  };

  // Form states
  const [newDesc, setNewDesc] = useState("");
  const [newStd, setNewStd] = useState("total-du");
  const [newFixtures, setNewFixtures] = useState<Record<string, number>>({});
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Selection states for batch update
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [bulkFloor, setBulkFloor] = useState("");

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_discharge_unit_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.unitSystem) setUnitSystem(data.unitSystem);
          if (data.headerStd) setHeaderStd(data.headerStd);
          if (data.weightOverrides) setWeightOverrides(data.weightOverrides);
          if (data.fuSpaces) setFuSpaces(data.fuSpaces);
        } else {
          // Reset to defaults
          setUnitSystem("si");
          setHeaderStd("total-du");
          setWeightOverrides({});
          setFuSpaces([
            {
              id: 1,
              desc: "1F Male Washroom",
              floor: "1F",
              std: "total-du",
              fixtures: { wc: 4, urinal: 3, basin: 4 }
            },
            {
              id: 2,
              desc: "1F Female Washroom",
              floor: "1F",
              std: "total-du",
              fixtures: { wc: 5, basin: 4 }
            }
          ]);
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load fixture unit calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        headerStd,
        weightOverrides,
        fuSpaces
      };
      localStorage.setItem(`mep_discharge_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, headerStd, weightOverrides, fuSpaces]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          unitSystem,
          headerStd,
          weightOverrides,
          fuSpaces
        };
        localStorage.setItem(`mep_discharge_unit_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Discharge Unit Calculation saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  useEffect(() => {
    const handleGlobalSave = (e: any) => {
      e.detail.handled = true;
      handleSaveCurrent();
    };
    window.addEventListener("mep-trigger-save", handleGlobalSave);
    return () => window.removeEventListener("mep-trigger-save", handleGlobalSave);
  }, [project?.id, unitSystem, headerStd, weightOverrides, fuSpaces, forceSaveToCloud]);

  // Accordion details

  const ip = unitSystem === "ip";

  const getEffectiveUnitFU = (fixtureId: string, spaceStd: string) => {
    if (spaceStd === headerStd && weightOverrides[fixtureId] !== undefined) {
      return weightOverrides[fixtureId];
    }
    return IP_DISCHARGE_UNITS[fixtureId]?.[spaceStd] ?? 0;
  };

  // Sizing Calculations
    const calculations = useMemo(() => {
    return computePlumbingDischargeCalculations(fuSpaces, headerStd, weightOverrides, ip);
  }, [fuSpaces, headerStd, weightOverrides, ip]);

  const [undoStack, setUndoStack] = useState<any[][]>([]);
  const [redoStack, setRedoStack] = useState<any[][]>([]);
  const [clipboard, setClipboard] = useState<any[]>([]);

  const pushToUndo = (currentSpaces: any[]) => {
    setUndoStack((prev) => [...prev, currentSpaces]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, fuSpaces]);
    setFuSpaces(previous);
    setUndoStack((prev) => prev.slice(0, -1));
    toast.success("Undo successful");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, fuSpaces]);
    setFuSpaces(next);
    setRedoStack((prev) => prev.slice(0, -1));
    toast.success("Redo successful");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Escape") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          setSelectedIds([]);
        }
        return;
      }

      // Undo / Redo: Ctrl+Z / Ctrl+Y
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (!isInput) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }

      // Select All: Ctrl+A
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        if (!isInput && fuSpaces.length > 0) {
          e.preventDefault();
          setSelectedIds(fuSpaces.map(s => s.id));
        }
        return;
      }

      // Copy: Ctrl+C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (!isInput && selectedIds.length > 0) {
          e.preventDefault();
          const toCopy = fuSpaces.filter(s => selectedIds.includes(s.id));
          setClipboard(toCopy);
          toast.success(`${toCopy.length} row(s) copied`);
        }
        return;
      }

      // Cut: Ctrl+X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (!isInput && selectedIds.length > 0) {
          e.preventDefault();
          const toCopy = fuSpaces.filter(s => selectedIds.includes(s.id));
          setClipboard(toCopy);
          pushToUndo(fuSpaces);
          setFuSpaces(prev => prev.filter(s => !selectedIds.includes(s.id)));
          setSelectedIds([]);
          toast.success(`${toCopy.length} row(s) cut`);
        }
        return;
      }

      // Paste: Ctrl+V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (!isInput && clipboard.length > 0) {
          e.preventDefault();
          const pasted = clipboard.map((s, idx) => ({
            ...s,
            id: Date.now() + idx + Math.floor(Math.random() * 1000),
            desc: `${s.desc} (Copy)`
          }));
          pushToUndo(fuSpaces);
          setFuSpaces(prev => [...prev, ...pasted]);
          setSelectedIds(pasted.map(p => p.id));
          toast.success(`${pasted.length} row(s) pasted`);
        }
        return;
      }
      // Save: Ctrl+S
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }

      // Delete / Backspace
      if (!isInput && (e.key === "Delete" || e.key === "Backspace")) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          pushToUndo(fuSpaces);
          setFuSpaces(prev => prev.filter(s => !selectedIds.includes(s.id)));
          setSelectedIds([]);
          toast.success(`${selectedIds.length} row(s) deleted`);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, fuSpaces, clipboard, undoStack, redoStack]);

  // Handlers
  const handleAddSpace = () => {
    setFuSpaces([...fuSpaces, {
      id: Date.now(),
      desc: "New Space",
      floor: "Floor Not Identified",
      std: "total-du",
      fixtures: {}
    }]);
  };

  const handleFixtureChange = (spaceId: number, fixtureId: string, val: number) => {
    setFuSpaces(fuSpaces.map(s => {
      if (s.id !== spaceId) return s;
      return {
        ...s,
        fixtures: {
          ...s.fixtures,
          [fixtureId]: Math.max(0, val)
        }
      };
    }));
  };

  const handleSpaceChange = (spaceId: number, field: "desc" | "std", val: any) => {
    setFuSpaces(fuSpaces.map(s => {
      if (s.id !== spaceId) return s;
      const updated = { ...s, [field]: val };
      if (field === "desc" && !s.isManualFloor) {
        updated.floor = extractFloorFU(val);
      }
      return updated;
    }));
  };

  const handleFloorRename = (oldFloor: string, newFloor: string) => {
    setFuSpaces(fuSpaces.map(s => {
      if ((s.floor || 'G') === oldFloor) {
        return { ...s, floor: newFloor, isManualFloor: true };
      }
      return s;
    }));
  };

  // Bulk actions
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(fuSpaces.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number, checked: boolean, shiftKey?: boolean) => {
    if (shiftKey && lastSelectedId !== null) {
      const lastIndex = sortedSpaces.findIndex(s => s.id === lastSelectedId);
      const currentIndex = sortedSpaces.findIndex(s => s.id === id);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const idsInRange = sortedSpaces.slice(start, end + 1).map(s => s.id);
        
        if (checked) {
          setSelectedIds(prev => Array.from(new Set([...prev, ...idsInRange])));
        } else {
          setSelectedIds(prev => prev.filter(x => !idsInRange.includes(x)));
        }
        setLastSelectedId(id);
        return;
      }
    }

    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(x => x !== id));
    }
    setLastSelectedId(id);
  };

  const handleApplyBulkFloor = () => {
    if (selectedIds.length === 0 || !bulkFloor.trim()) return;
    pushToUndo(fuSpaces);
    setFuSpaces(fuSpaces.map(s => {
      if (selectedIds.includes(s.id)) {
        return { ...s, floor: bulkFloor.trim(), isManualFloor: true };
      }
      return s;
    }));
    setSelectedIds([]);
    setBulkFloor("");
    toast.success(`Floor updated for ${selectedIds.length} space(s)`);
  };

  // PDF Export
  const handleExportPDF = async () => {
    if (fuSpaces.length === 0) {
      toast.info("No spaces to export.");
      return;
    }
    try {
      await exportDischargeUnitPDF(fuSpaces, calculations);
      toast.success("PDF report exported successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export PDF report.");
    }
  };


  // Sort spaces by floor first (ascending), then by description (ascending)
  const sortedSpaces = useMemo(() => {
    return [...fuSpaces].sort((a, b) => {
      const floorA = (a.floor || "").trim();
      const floorB = (b.floor || "").trim();
      const floorCompare = floorA.localeCompare(floorB, undefined, { numeric: true, sensitivity: "base" });
      if (floorCompare !== 0) return floorCompare;
      return (a.desc || "").localeCompare(b.desc || "", undefined, { numeric: true, sensitivity: "base" });
    });
  }, [fuSpaces]);

  return (
    <AppShell title="Discharge Unit Calculator" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full relative">
          {/* Page Header Area */}
          <div className="flex flex-col gap-3 shrink-0 select-none no-print">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground mt-0.5">Discharge Unit Calculator</h1>
                  <CalculationReviewBar 
                    projectId={project?.id}
                    calculatorPath="/plumbing-discharge-unit" 
                    calculatorTitle="Plumbing Discharge Unit"
                  />
                </div>
                <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5">
                  Calculate Discharge Units (DU), peak demand flow rates, and drainage sizing.
                </p>
              </div>
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
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/50">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setActiveTab("spaces")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "spaces" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Spaces
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "report" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sizing &amp; Report
                </button>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 animate-fade-in flex flex-col bg-background">
              {activeTab === "spaces" && (
                <div className="flex-1 flex flex-col min-h-0">
              {/* Workspace Header Toolbar Strip */}
              <div className="relative flex flex-wrap items-center justify-between px-3.5 py-2 bg-slate-50/60 dark:bg-slate-900/40 border-b border-border/60 shrink-0 select-none gap-2">
                
                {/* Left Controls: Search, Filter, Sort */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      placeholder="Filter spaces..."
                      className="h-7 w-44 sm:w-52 pl-8 pr-3 bg-background border border-border/80 focus:border-[#0A7BC7] rounded-full text-[12px] outline-none transition-all"
                    />
                  </div>
                  
                  <button className="relative inline-flex items-center justify-center h-7 w-7 rounded-full border border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-all duration-150 outline-none cursor-pointer">
                    <Filter className="size-3.5" />
                  </button>
                  
                  <button className="relative inline-flex items-center justify-center h-7 w-7 rounded-full border border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-all duration-150 outline-none cursor-pointer">
                    <SlidersHorizontal className="size-3.5" />
                  </button>
                </div>

                {/* Right Controls */}
                <div className="flex items-center justify-end gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
                  <button onClick={() => setFuSpaces([])} className="text-red-500 hover:text-red-700 text-[11px] font-bold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1.5 rounded transition-colors cursor-pointer border border-transparent hover:border-red-200">
                    <Trash2 className="size-3.5" /> Clear All Spaces
                  </button>
                  <button onClick={handleExportPDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs">
                    <FileText className="size-3.5" /> Export
                  </button>
                  <button onClick={handleAddSpace} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all cursor-pointer">
                    <Plus className="size-3.5" /> New Space
                  </button>
                </div>

                {/* Bulk actions bar overlay */}
                {selectedIds.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-between px-3.5 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{selectedIds.length} selected</span>
                      <span className="text-[#0A7BC7]/40 px-1 font-bold">·</span>
                      <button type="button" onClick={() => setSelectedIds([])} className="text-[#0A7BC7] font-semibold hover:underline cursor-pointer flex items-center gap-1.5">
                        <X className="size-3.5" />
                        Deselect All
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">Move to Floor:</span>
                        <input
                          type="text"
                          value={bulkFloor}
                          onChange={(e) => setBulkFloor(e.target.value)}
                          placeholder="e.g. Ground Floor"
                          className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded px-2 py-0.5 w-32 outline-none focus:border-blue-400"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyBulkFloor();
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleApplyBulkFloor}
                          disabled={!bulkFloor.trim()}
                          className="px-2 py-0.5 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 rounded font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                      
                      <button 
                        type="button" 
                        onClick={() => {
                          pushToUndo(fuSpaces);
                          setFuSpaces(prev => prev.filter(s => !selectedIds.includes(s.id)));
                          setSelectedIds([]);
                          toast.success(`${selectedIds.length} row(s) deleted`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60 rounded font-semibold transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col min-h-0 bg-background relative">
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60 z-10 select-none">
                        <th rowSpan={2} className="p-2 text-center w-8 border-r border-border/50">
                          <input type="checkbox" checked={selectedIds.length === fuSpaces.length && fuSpaces.length > 0} onChange={e => handleToggleSelectAll(e.target.checked)} className="size-3.5 accent-orange-500 cursor-pointer" />
                        </th>
                        <th rowSpan={2} className="p-2 text-center w-[20%] border-r border-border/50">Description</th>
                        <th rowSpan={2} className="p-2 text-center w-[12%] border-r border-border/50">Floor</th>
                        {DU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-2 text-center w-[7%] text-[11px] font-bold border-r border-border/50">{f.short}</th>
                        ))}
                        <th rowSpan={2} className="p-2 text-center w-[8%] bg-red-500/10 text-red-700 dark:text-red-400 font-bold border-r border-border/50" title="Total Black Water D.U.">BLACK DU</th>
                        <th rowSpan={2} className="p-2 text-center w-[8%] bg-green-500/10 text-green-700 dark:text-green-400 font-bold border-r border-border/50" title="Total Grey Water D.U.">GREY DU</th>
                        <th rowSpan={2} className="p-2 text-center w-8 border-r border-border/50"></th>
                      </tr>
                      <tr className="bg-muted/10 border-b border-border/40 text-[10px] text-muted-foreground uppercase tracking-wider">
                        {DU_FIXTURES_META.map(f => {
                          const currentVal = weightOverrides[f.id] !== undefined ? weightOverrides[f.id] : (IP_DISCHARGE_UNITS[f.id]?.[headerStd] ?? "");
                          return (
                            <th key={f.id} className="p-1 px-0.5 text-center font-bold bg-[#0A7BC7]/5 border-r border-border/50">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={currentVal}
                                onChange={(e) => {
                                  const val = e.target.value !== "" ? Number(e.target.value) : 0;
                                  setWeightOverrides(prev => ({ ...prev, [f.id]: val }));
                                }}
                                className="w-full text-center bg-white dark:bg-slate-950 border border-blue-300 dark:border-blue-700 rounded text-[#0A7BC7] font-extrabold text-[11.5px] py-0.5 outline-none focus:ring-2 focus:ring-[#0A7BC7]"
                                title={`Edit weight for ${f.short} (Click to change)`}
                              />
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    
                    {/* Sizing Rows */}
                    <tbody>
                      {sortedSpaces.length === 0 ? (
                        <tr>
                          <td colSpan={DU_FIXTURES_META.length + 5} className="p-8 text-center text-muted-foreground italic">No spaces added. Add one above.</td>
                        </tr>
                      ) : (
                        sortedSpaces.map(s => {
                          const validation = getFUSpaceValidation(s);
                          return (
                            <tr key={s.id} onDoubleClick={() => setPreviewSpace(s)} className="border-b border-border/40 hover:bg-slate-50/30 dark:hover:bg-slate-900/20 cursor-pointer">
                              <td className="p-2 text-center border-r border-border/50">
                                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={e => handleToggleSelect(s.id, e.target.checked, (e.nativeEvent as PointerEvent).shiftKey || (e.nativeEvent as KeyboardEvent).shiftKey)} className="size-3.5 accent-orange-500 cursor-pointer" />
                              </td>
                              <td className="p-1.5 border-r border-border/50">
                                <div className="flex items-center gap-1.5 w-full">
                                  {(() => {
                                    const itemComments = getMergedItemComments(String(s.id), s.desc, (s as any).comments, "/plumbing-discharge-unit", project?.id);
                                    return itemComments.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenComment(String(s.id), s.desc);
                                        }}
                                        title={`${itemComments.length} comment(s)/task(s) assigned`}
                                        className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
                                      >
                                        <MessageSquare className="size-3.5 fill-blue-500/20" />
                                        <span className="text-[10px] font-bold">{itemComments.length}</span>
                                      </button>
                                    ) : null;
                                  })()}
                                  <input type="text" value={s.desc} onChange={e => handleSpaceChange(s.id, "desc", e.target.value)} className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded" />
                                </div>
                              </td>
                              <td className="p-1.5 border-r border-border/50">
                                <input 
                                  type="text" 
                                  value={s.floor ?? ""} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    setFuSpaces(fuSpaces.map(x => x.id === s.id ? { ...x, floor: val, isManualFloor: true } : x));
                                  }} 
                                  className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-semibold text-muted-foreground text-center" 
                                />
                              </td>
                              {DU_FIXTURES_META.map(f => (
                                <td key={f.id} className="p-1 border-r border-border/50">
                                  <input type="number" min="0" value={s.fixtures[f.id] || ""} onChange={e => handleFixtureChange(s.id, f.id, Number(e.target.value))} className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium" />
                                </td>
                              ))}
                              <td className="p-2 text-center font-black text-red-700 dark:text-red-400 bg-red-500/5 border-r border-border/50">
                                {(calculations.spaceBlackTotals[s.id] || 0).toFixed(1)}
                              </td>
                              <td className="p-2 text-center font-black text-green-700 dark:text-green-400 bg-green-500/5 border-r border-border/50">
                                {(calculations.spaceGreyTotals[s.id] || 0).toFixed(1)}
                              </td>
                              <td className="p-2 text-center border-r border-border/50">
                                <button 
                                  title={validation.warnings.length > 0 ? validation.warnings.join("\n") : (validation.isManualFlagged ? "Flagged manually" : "Flag space")}
                                  onClick={() => setFuSpaces(fuSpaces.map(x => x.id === s.id ? { ...x, isFlagged: !x.isFlagged } : x))} 
                                  className={`p-1 rounded cursor-pointer transition-colors border-0 bg-transparent ${validation.isFlagged ? "text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/20" : "text-slate-300 hover:text-red-500"}`}>
                                  <Flag className={`size-3.5 ${validation.isFlagged ? "fill-current" : ""}`} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "report" && (
            <div className="flex-1 flex justify-center bg-slate-50/30 dark:bg-black/10 overflow-y-auto p-8">
                <div className="flex flex-col gap-6 w-full max-w-4xl">
                    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5 shadow-xs">
                      <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                        <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-sans">📊 Sizing Results</h3>
                      </div>

                      <div className="flex flex-col gap-4 font-sans text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-border/40">
                          <span className="font-semibold text-muted-foreground">Total Discharge Units</span>
                          <strong className="font-bold text-foreground font-mono text-base">{calculations.totalDU.toFixed(1)} D.U.</strong>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-border/40">
                          <span className="font-bold text-foreground uppercase tracking-wide">Probable Peak Flow</span>
                          <strong className="font-extrabold text-[#0A7BC7] text-xl font-mono">{calculations.displayFlow}</strong>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/40">
                          <span className="font-semibold text-muted-foreground">Applied Sizing standard</span>
                          <span className="font-semibold text-foreground">IPC Polynomial Method</span>
                        </div>
                      </div>

                      <div className="bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 text-[#06456F] dark:text-sky-300 rounded-xl p-4 flex gap-3 text-xs font-sans mt-2">
                        <Info className="size-5 shrink-0 text-[#0A7BC7]" />
                        <span className="leading-relaxed">The fixture values are automatically synced with downstream sizing schedules (e.g. Booster Pump, Transfer Pump, Storage Tanks).</span>
                      </div>
                    </div>

                    {/* Detailed Sizing Steps */}
                    <div className="bg-card border border-border rounded-2xl shadow-xs p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                        <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-sans">Σ Detailed Calculations</h3>
                      </div>
                      <div className="flex flex-col gap-3 text-xs font-sans">
                        {calculations.detailedSteps.length === 0 ? (
                          <span className="text-muted-foreground italic">No detailed calculations available yet. Add spaces in the calculator.</span>
                        ) : (
                          calculations.detailedSteps.map((s, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-border/50">
                              <div className="font-bold text-foreground mb-1">{s.title}</div>
                              <div className="font-mono text-muted-foreground break-all">{s.expr}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Assumptions & Basis */}
                    <div className="bg-card border border-border rounded-2xl shadow-xs p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                        <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-sans">ℹ Assumptions & Basis</h3>
                      </div>
                      <div className="text-xs font-sans text-muted-foreground flex flex-col gap-3">
                        <div className="flex gap-2.5">
                          <span className="text-[#0A7BC7] font-bold">•</span>
                          <span className="leading-relaxed">Sizing is based on the Water Supply Discharge Units (D.U.) methodology.</span>
                        </div>
                        <div className="flex gap-2.5">
                          <span className="text-[#0A7BC7] font-bold">•</span>
                          <span className="leading-relaxed">Standards options support Black Water, Grey Water, or Total D.U. loadings.</span>
                        </div>
                        <div className="flex gap-2.5">
                          <span className="text-[#0A7BC7] font-bold">•</span>
                          <span className="leading-relaxed">Probable peak flow rate conversion is derived from the Curve Fit Polynomial matching the Hunter's curve chart data up to 5,000 D.U.s.</span>
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
      {previewSpace && (
        <DischargeSpacePreviewModal 
          space={previewSpace} 
          onClose={() => setPreviewSpace(null)} 
          getEffectiveUnitFU={getEffectiveUnitFU} 
          onSave={(updated) => {
            setFuSpaces(prev => prev.map(s => s.id === updated.id ? updated : s));
            setPreviewSpace(null);
          }}
        />
      )}
    
      {/* Assign Comment Modal */}
      {commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="space"
          calculatorTitle="Discharge Unit Calculator"
          calculatorPath="/plumbing-discharge-unit"
          existingComments={getMergedItemComments(commentTargetItem.id, commentTargetItem.name, (fuSpaces.find(s => String(s.id) === commentTargetItem.id) as any)?.comments, "/plumbing-discharge-unit", project?.id)}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}



function DischargeSpacePreviewModal({ space, onClose, getEffectiveUnitFU, onSave }: { space: FUSpace, onClose: () => void, getEffectiveUnitFU: (fixtureId: string, spaceStd: string) => number, onSave: (s: FUSpace) => void }) {
  const [showPreview, setShowPreview] = useState(false);
  const [tempSpace, setTempSpace] = useState<FUSpace>({ ...space });

  const spaceStd = tempSpace.std;
  let spaceDU = 0;
  const breakdown: any[] = [];
  
  DU_FIXTURES_META.forEach(f => {
    const qty = tempSpace.fixtures[f.id] || 0;
    if (qty > 0) {
      const unitFU = getEffectiveUnitFU(f.id, spaceStd);
      const subTotal = qty * unitFU;
      spaceDU += subTotal;
      breakdown.push({ name: f.short, qty, unitFU, subTotal });
    }
  });

  const handleFixtureChange = (id: string, qty: number) => {
    setTempSpace(prev => ({ ...prev, fixtures: { ...prev.fixtures, [id]: qty } }));
  }

  const labelClass = "block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide";
  const inputClass = "w-full h-9 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 text-[13px] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className={`bg-card text-card-foreground flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden transition-all duration-300 ease-out max-h-[90vh] ${
          showPreview ? "max-w-5xl" : "max-w-2xl"
        } w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
                Edit Space Parameters
              </h2>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Configure discharge units mapping and fixture quantities.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all shadow-sm ${
                showPreview
                  ? "bg-primary text-primary-foreground hover:bg-primary/95 ring-2 ring-primary/20"
                  : "bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Info className="size-3.5" />
              Calculations Preview
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 form-scrollbar">
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                General Parameters
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClass}>Space Name</label>
                  <input type="text" value={tempSpace.desc} onChange={e => setTempSpace(p => ({...p, desc: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Floor</label>
                  <input type="text" value={tempSpace.floor} onChange={e => setTempSpace(p => ({...p, floor: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Standard</label>
                  <select value={tempSpace.std} onChange={e => setTempSpace(p => ({...p, std: e.target.value}))} className={inputClass}>
                    <option value="total-du">Total D.U.</option>
                    <option value="black-water">Black Water</option>
                    <option value="grey-water">Grey Water</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                Fixture Quantities
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {DU_FIXTURES_META.map(f => (
                  <div key={f.id}>
                    <label className={labelClass}>{f.short}</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={tempSpace.fixtures[f.id] || ""} 
                      onChange={e => handleFixtureChange(f.id, parseInt(e.target.value) || 0)} 
                      className={inputClass} 
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div
            className={`shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
              showPreview ? "w-[400px] opacity-100 p-6" : "w-0 opacity-0 p-0"
            }`}
          >
            <div className="w-[352px] space-y-5 flex flex-col h-full overflow-y-auto">
              <h3 className="text-[11px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0">
                Calculations Preview
              </h3>

              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 shadow-sm">
                  <div className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Discharge Units Breakdown
                  </div>

                  <div className="space-y-2">
                    {breakdown.length === 0 ? (
                      <div className="text-[11px] italic text-muted-foreground py-2 border-t border-black/5 dark:border-white/5">No fixtures added.</div>
                    ) : breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between items-baseline text-[12px] pt-1.5 border-t border-black/5 dark:border-white/5">
                        <span className="text-neutral-500 dark:text-neutral-400 font-medium truncate max-w-[150px]">{b.name}</span>
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <span>{b.qty} × {b.unitFU} =</span>
                          <span className="font-bold text-[13px] text-foreground w-12 text-right">{b.subTotal.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline text-[12px] pt-2 border-t-2 border-black/10 dark:border-white/10">
                      <span className="font-bold text-[#06456F] dark:text-sky-400">Total D.U.</span>
                      <span className="font-mono font-black text-[18px] text-[#0A7BC7]">
                        {spaceDU.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="px-6 h-16 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="h-10 px-5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(tempSpace)}
            className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-[12.5px] font-semibold transition-all shadow-md shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}
