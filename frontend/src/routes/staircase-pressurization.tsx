import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { useAuth } from "@/contexts/AuthContext";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { Plus, Trash2, MessageSquare, FileSpreadsheet, FileText, Check, X, Wrench, Sparkles, Search, CheckCircle2 } from "lucide-react";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/staircase-pressurization")({
  component: StaircasePressurizationPage,
});

export type DoorTypeKey = "single_leaf_into" | "single_leaf_outwards" | "double_leaf" | "lift_landing";

export interface DoorTypeDefinition {
  key: DoorTypeKey;
  name: string;
  designLeakageRate: number;
}

export const DOOR_TYPES_CONFIG: Record<DoorTypeKey, DoorTypeDefinition> = {
  single_leaf_into: { key: "single_leaf_into", name: "Single-leaf opening into space", designLeakageRate: 0.03 },
  single_leaf_outwards: { key: "single_leaf_outwards", name: "Single-leaf opening outwards", designLeakageRate: 0.06 },
  double_leaf: { key: "double_leaf", name: "Double-leaf opening", designLeakageRate: 0.10 },
  lift_landing: { key: "lift_landing", name: "Lift landing door", designLeakageRate: 0.19 },
};

export const CALCULATION_CONSTANTS = {
  EGRESS_VELOCITY: 1.0, 
  CLOSED_DOOR_SAFETY_FACTOR: 0.25,
  FINAL_SAFETY_FACTOR: 0.10,
  DEFAULT_PRESSURE_REF_PA: 12.5,
  DEFAULT_DUCT_LENGTH_M: 68,
  GRILL_LOUVER_DROP_PA: 85,
  DUCT_PRESSURE_RATE_PA_PER_M: 1.0,
};

export interface StaircaseItem {
  id: string;
  name: string;
  doorType: DoorTypeKey;
  doorArea: number | "";
  openDoorsCount: number | "";
  closedDoorsCount: number | "";
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function calculateStaircase(item: StaircaseItem, isIp: boolean = false) {
  const activeDoor = DOOR_TYPES_CONFIG[item.doorType] || DOOR_TYPES_CONFIG.lift_landing;
  const rawArea = Number(item.doorArea) || 0;
  const doorArea = isIp ? rawArea / 10.7639 : rawArea;
  const openDoors = Number(item.openDoorsCount) || 0;
  const closedDoors = Number(item.closedDoorsCount) || 0;

  const openFlowM3s = doorArea * CALCULATION_CONSTANTS.EGRESS_VELOCITY * openDoors;
  const closedFlowM3s = activeDoor.designLeakageRate * closedDoors;
  const closedSafetyFlowM3s = closedFlowM3s * CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR;
  const subTotalM3s = openFlowM3s + closedFlowM3s + closedSafetyFlowM3s;
  const finalSafetyM3s = subTotalM3s * CALCULATION_CONSTANTS.FINAL_SAFETY_FACTOR;
  
  const totalFanCapacityM3s = subTotalM3s + finalSafetyM3s;
  const totalFanCapacityLs = Math.ceil((totalFanCapacityM3s * 1000) / 5) * 5;

  const ductLoss = CALCULATION_CONSTANTS.DEFAULT_DUCT_LENGTH_M * CALCULATION_CONSTANTS.DUCT_PRESSURE_RATE_PA_PER_M;
  const combinedDrop = ductLoss + CALCULATION_CONSTANTS.GRILL_LOUVER_DROP_PA + CALCULATION_CONSTANTS.DEFAULT_PRESSURE_REF_PA;
  const safetyDrop = combinedDrop * 0.25;
  const designPressureDropPa = Math.ceil((combinedDrop + safetyDrop) / 5) * 5;

  const reliefAreaM2 = (totalFanCapacityLs / 1000) / (0.827 * Math.sqrt(CALCULATION_CONSTANTS.DEFAULT_PRESSURE_REF_PA));

  const totalFanCapacityCfm = Math.round((totalFanCapacityM3s) * 2118.88);
  const reliefAreaSqFt = reliefAreaM2 * 10.7639;
  const designPressureDropInWg = designPressureDropPa / 249.0889;

  return {
    openFlowM3s: openFlowM3s.toFixed(3),
    openFlowLs: (openFlowM3s * 1000).toFixed(1),
    closedFlowM3s: closedFlowM3s.toFixed(3),
    closedFlowLs: (closedFlowM3s * 1000).toFixed(1),
    closedSafetyFlowM3s: closedSafetyFlowM3s.toFixed(3),
    subTotalM3s: subTotalM3s.toFixed(3),
    finalSafetyM3s: finalSafetyM3s.toFixed(3),
    totalFanCapacityM3s: totalFanCapacityM3s.toFixed(3),
    totalFanCapacityLs,
    totalFanCapacityCfm,
    ductLoss: ductLoss.toFixed(1),
    combinedDrop: combinedDrop.toFixed(1),
    safetyDrop: safetyDrop.toFixed(1),
    designPressureDropPa,
    designPressureDropInWg: designPressureDropInWg.toFixed(2),
    reliefAreaM2: reliefAreaM2.toFixed(3),
    reliefAreaSqFt: reliefAreaSqFt.toFixed(2)
  };
}

function StaircasePressurizationPage() {
  const { project, activeProjectId, isReadOnly } = useWorkspace();
  const { userData, profile } = useAuth();
  
  const isApprovedLocked = useCalculationLock("/staircase-pressurization", project?.id || activeProjectId);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const [calcReviewState] = useState<CalculationReviewState | null>(null);
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole || calcReviewState?.status === "APPROVED");

  const [items, setItems] = useState<StaircaseItem[]>([
    { id: generateId(), name: "Staircase-01", doorType: "single_leaf_into", doorArea: 2.53, openDoorsCount: 2, closedDoorsCount: 16 }
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"schedule" | "report">("schedule");
  const [intelOpen, setIntelOpen] = useState(false);
  
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [previewRow, setPreviewRow] = useState<StaircaseItem | null>(null);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const isIp = unitSystem === "ip";

  const handleUnitSystemChange = (target: "si" | "ip", shouldConvert: boolean = true) => {
    if (target === unitSystem) return;
    
    if (shouldConvert) {
      setItems(prevItems => prevItems.map(item => {
        const area = item.doorArea;
        let convertedArea: number | "" = area;
        if (target === "si") {
          convertedArea = area !== "" ? Number((Number(area) / 10.7639).toFixed(2)) : "";
        } else {
          convertedArea = area !== "" ? Number((Number(area) * 10.7639).toFixed(2)) : "";
        }
        return { ...item, doorArea: convertedArea };
      }));
    }
    setUnitSystem(target);
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    setItems(prev => prev.map(i => i.id === commentTargetItem?.id ? {
      ...i,
      comments: [...((i as any).comments || []), comment]
    } : i));
    setCommentModalOpen(false);
  };

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Load from local storage
  useEffect(() => {
    const savedKey = "mep_auto_state_" + (project?.id || activeProjectId) + "_/Staircase-pressurization_list";
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch(e) {}
    }
  }, [project?.id, activeProjectId]);

  const saveItems = (newItems: StaircaseItem[]) => {
    setItems(newItems);
    dirtyStore.set(true);
    const savedKey = "mep_auto_state_" + (project?.id || activeProjectId) + "_/Staircase-pressurization_list";
    localStorage.setItem(savedKey, JSON.stringify(newItems));
  };

  const updateItem = (id: string, field: keyof StaircaseItem, value: any) => {
    if (isEffectiveReadOnly) return;
    const newItems = items.map(i => i.id === id ? { ...i, [field]: value } : i);
    saveItems(newItems);
  };

  const addItem = () => {
    if (isEffectiveReadOnly) return;
    const newName = "Staircase-" + (items.length + 1).toString().padStart(2, "0");
    saveItems([...items, { id: generateId(), name: newName, doorType: "single_leaf_into", doorArea: 2.53, openDoorsCount: 2, closedDoorsCount: 16 }]);
  };

  const deleteSelected = () => {
    if (isEffectiveReadOnly) return;
    saveItems(items.filter(i => !selectedItems.has(i.id)));
    setSelectedItems(new Set());
  };

  const deleteItem = (id: string) => {
    if (isEffectiveReadOnly) return;
    saveItems(items.filter(i => i.id !== id));
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditing = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA"
      );
      if (isEditing) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedItems(new Set());
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (items.length > 0) {
          setSelectedItems(new Set(items.map((r) => r.id)));
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedItems.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedItems, isEffectiveReadOnly]);

  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScrollToItem = (e: any) => {
      const { id, name } = e.detail || {};
      if (!id && !name) return;
      const r = items.find(rw => rw.id === id || rw.name === name);
      if (r) {
        setTimeout(() => {
          const el = document.getElementById(`Staircase-row-${r.id}`) || document.getElementById(`row-${r.id}`) || document.querySelector(`[data-row-id="${r.id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-primary", "bg-primary/10");
            setTimeout(() => el.classList.remove("ring-2", "ring-primary", "bg-primary/10"), 3000);
          }
        }, 150);
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
  }, [items]);

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("STAIRCASE PRESSURIZATION CALCULATION REPORT", 14, 16);
      doc.setFontSize(10);
      doc.text("Project: " + (project?.name || "N/A"), 14, 24);

      const tableData = items.map((item, index) => {
        const calc = calculateStaircase(item, isIp);
        const doorName = DOOR_TYPES_CONFIG[item.doorType]?.name || "Unknown";
        return [
          index + 1,
          item.name,
          doorName,
          item.doorArea,
          item.openDoorsCount,
          item.closedDoorsCount,
          isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs,
          isIp ? calc.designPressureDropInWg : calc.designPressureDropPa,
          isIp ? calc.reliefAreaSqFt : calc.reliefAreaM2
        ];
      });

      autoTable(doc, {
        startY: 32,
        head: [["#", "Staircase Name", "Door Type", `Door Area (${isIp ? "sq ft" : "mÂ²"})`, "Open Doors", "Closed Doors", `Fan Airflow (${isIp ? "CFM" : "L/s"})`, `dP (${isIp ? "in. wg" : "Pa"})`, `Relief Area (${isIp ? "sq ft" : "mÂ²"})`]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8, halign: "center", valign: "middle" }
      });

      doc.save("Staircase_Pressurization_Report.pdf");
      toast.success("PDF report downloaded!");
    } catch(err) {
      toast.error("Failed to generate PDF");
    }
  };

    const filteredRows = React.useMemo(() => {
    if (!searchQuery) return items;
    const lowerQuery = searchQuery.toLowerCase();
    return items.filter((row) => row.name.toLowerCase().includes(lowerQuery));
  }, [items, searchQuery]);

  const columns: Column<StaircaseItem>[] = React.useMemo(() => [
    {
      key: "name",
      header: "STAIRCASE NAME",
      width: 160,
      render: (row) => (
        <div className="flex items-center gap-1 w-full">
          <input 
            type="text"
            value={row.name}
            onChange={(e) => updateItem(row.id, "name", e.target.value)}
            disabled={isEffectiveReadOnly}
            className="bg-transparent outline-none w-full font-medium"
            placeholder="Name..."
          />
        </div>
      )
    },
    {
      key: "doorType",
      header: "DOOR TYPE",
      width: 200,
      render: (row) => (
        <select 
          value={row.doorType}
          onChange={(e) => updateItem(row.id, "doorType", e.target.value as DoorTypeKey)}
          disabled={isEffectiveReadOnly}
          className="bg-transparent outline-none w-full text-xs"
        >
          {(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[]).map(k => (
            <option key={k} value={k}>{DOOR_TYPES_CONFIG[k].name}</option>
          ))}
        </select>
      )
    },
    {
      key: "doorArea",
      header: `DOOR AREA (${unitSystem === "ip" ? "sq ft" : "mÂ²"})`,
      width: 130,
      render: (row) => (
        <input 
          type="number"
          value={row.doorArea} 
          onChange={(e) => updateItem(row.id, "doorArea", e.target.value)}
          disabled={isEffectiveReadOnly}
          className="bg-transparent outline-none w-full text-xs"
          placeholder="Area"
        />
      )
    },
    {
      key: "openDoorsCount",
      header: "OPEN DOORS",
      width: 110,
      render: (row) => (
        <input 
          type="number"
          value={row.openDoorsCount} 
          onChange={(e) => updateItem(row.id, "openDoorsCount", e.target.value)}
          disabled={isEffectiveReadOnly}
          className="bg-transparent outline-none w-full text-xs"
          placeholder="Qty"
        />
      )
    },
    {
      key: "closedDoorsCount",
      header: "CLOSED DOORS",
      width: 110,
      render: (row) => (
        <input 
          type="number"
          value={row.closedDoorsCount} 
          onChange={(e) => updateItem(row.id, "closedDoorsCount", e.target.value)}
          disabled={isEffectiveReadOnly}
          className="bg-transparent outline-none w-full text-xs"
          placeholder="Qty"
        />
      )
    },
    {
      key: "fanAirflow",
      header: `FAN AIRFLOW (${unitSystem === "ip" ? "CFM" : "L/s"})`,
      width: 140,
      render: (row) => {
        const calc = calculateStaircase(row, unitSystem === "ip");
        return <span className="text-blue-600 font-semibold cursor-pointer" onDoubleClick={() => setPreviewRow(row)}>{unitSystem === "ip" ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs}</span>;
      }
    },
    {
      key: "dP",
      header: `dP (${unitSystem === "ip" ? "in. wg" : "Pa"})`,
      width: 100,
      render: (row) => {
        const calc = calculateStaircase(row, unitSystem === "ip");
        return <span className="cursor-pointer" onDoubleClick={() => setPreviewRow(row)}>{unitSystem === "ip" ? calc.designPressureDropInWg : calc.designPressureDropPa}</span>;
      }
    },
    {
      key: "reliefArea",
      header: `RELIEF AREA (${unitSystem === "ip" ? "sq ft" : "mÂ²"})`,
      width: 130,
      render: (row) => {
        const calc = calculateStaircase(row, unitSystem === "ip");
        return <span className="cursor-pointer" onDoubleClick={() => setPreviewRow(row)}>{unitSystem === "ip" ? calc.reliefAreaSqFt : calc.reliefAreaM2}</span>;
      }
    },
    {
      key: "comments",
      header: "STATUS",
      width: 80,
      render: (row) => {
        return (
          <div className="flex items-center gap-1.5 w-full">
            {Array.isArray((row as any).comments) && (row as any).comments.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentTargetItem(row);
                  setCommentModalOpen(true);
                }}
                className="flex items-center justify-center size-5 rounded-md hover:bg-blue-100 text-blue-500 transition-colors"
                title="View/Add Comments"
              >
                <MessageSquare className="size-3.5 fill-blue-50/50" />
                <span className="text-[10px] font-bold ml-0.5">{(row as any).comments.length}</span>
              </button>
            )}
          </div>
        );
      }
    }
  ], [unitSystem, isEffectiveReadOnly, items]);

  const renderStaircaseContextMenu = (row: StaircaseItem) => (
    <ContextMenuContent className="w-48 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
      <ContextMenuItem
        onClick={() => {
          if (isEffectiveReadOnly) {
            toast.info("Workspace is in Read-Only mode.");
            return;
          }
          setCommentTargetItem(row);
          setCommentModalOpen(true);
        }}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 text-blue-600 rounded cursor-pointer"
      >
        <MessageSquare className="size-3.5" />
        <span>Add Comment</span>
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => setPreviewRow(row)}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted text-foreground rounded cursor-pointer"
      >
        <Sparkles className="size-3.5" />
        <span>Calculation Preview</span>
      </ContextMenuItem>
      <ContextMenuSeparator className="h-px bg-border my-1" />
      <ContextMenuItem
        onClick={() => {
          if (!isEffectiveReadOnly) {
            deleteItem(row.id);
          }
        }}
        disabled={isEffectiveReadOnly}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 text-destructive rounded cursor-pointer"
      >
        <Trash2 className="size-3.5" />
        <span>Delete</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <AppShell 
      title="Staircase Pressurization" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen(v => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Staircase Pressurization</h1>
                  
                </div>
                <button 
                  onClick={() => setIntelOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" /> Intelligence
                </button>
                <CalculationReviewBar 
                  projectId={project?.id || "default"} 
                  calculatorPath="/staircase-pressurization" 
                  calculatorTitle="Staircase Pressurization" 
                />
              </div>
              
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
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
            : "bg-card border border-border shadow-sm"
          }`}>
            
            {/* Tabs Selector */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setTab("schedule")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "schedule"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                  }`}
                >
                  Staircase Schedule
                </button>
                <button
                  onClick={() => setTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                  }`}
                >
                  Report
                </button>
              </div>
            </div>

            {/* Active Tab Content */}
            <div className="flex-1 flex flex-col min-h-0 bg-background relative">
              {tab === "schedule" && (
                <div className="absolute inset-0 flex flex-col animate-in fade-in duration-300">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                          placeholder="Search staircases..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-8 w-48 pl-8 pr-7 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl text-[12.5px] bg-background outline-none transition-all"
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportPdf}
                        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background hover:bg-surface-2 text-[12.5px] font-semibold text-foreground cursor-pointer shadow-xs"
                      >
                        <FileText className="size-3.5" /> Export
                      </button>
                      <button
                        onClick={addItem}
                        disabled={isEffectiveReadOnly}
                        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[12.5px] font-bold cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Plus className="size-3.5" /> Add Staircase
                      </button>
                    </div>
                  </div>
                  
                  {/* Bulk Actions overlay */}
                  {!isEffectiveReadOnly && selectedItems.size > 0 && (
                    <div className="absolute top-12 left-0 right-0 h-10 flex items-center gap-2 px-4 bg-blue-50/90 backdrop-blur-sm text-[12px] text-blue-700 z-20 border-b border-blue-100">
                      <span className="font-semibold">{selectedItems.size} selected</span>
                      <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-200 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition shadow-sm ml-2">
                        <Trash2 className="size-3.5" /> Delete Selected
                      </button>
                    </div>
                  )}

                  <div className="flex-1 min-h-0 bg-background overflow-hidden relative flex flex-col">
                    {filteredRows.length > 0 ? (
                      <DataGrid
                        rows={filteredRows}
                        columns={columns}
                        selected={selectedItems}
                        onToggle={toggleSelect}
                        onToggleAll={toggleSelectAll}
                        isReadOnly={isEffectiveReadOnly}
                        renderContextMenu={renderStaircaseContextMenu}
                        activeRowId={Array.from(selectedItems).length === 1 ? Array.from(selectedItems)[0] : undefined}
                        rowClassName={(row, index) =>
                          index % 2 === 0
                            ? "bg-[#f4f4f7]/70 hover:bg-[#ebebee]"
                            : "bg-card hover:bg-[#ebebee]"
                        }
                      />
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <div className="size-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                          <Search className="size-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No staircases found.</p>
                        <p className="text-xs mt-1">Try adjusting your search query or add a new staircase.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
                              {tab === "report" && (
                  <div className="absolute inset-0 flex flex-col animate-in fade-in duration-300 bg-[#F5F7F9] dark:bg-zinc-950 overflow-y-auto">
                    
                    {/* Floating Action Bar */}
                    <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-border shadow-sm print:hidden">
                      <div>
                        <h2 className="text-sm font-bold text-foreground">Staircase Pressurization Report</h2>
                        <p className="text-[11px] text-muted-foreground">{items.length} staircases calculated</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => window.print()} className="h-8 px-4 inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer shadow-sm transition-transform active:scale-95">
                          <FileText className="size-3.5" /> Print / Save PDF
                        </button>
                      </div>
                    </div>

                    {/* Report Content */}
                    <div className="flex-1 p-4 md:p-8">
                      <div id="report-content" className="max-w-[900px] mx-auto bg-white dark:bg-zinc-900 border border-border/50 rounded-2xl shadow-sm overflow-hidden print:shadow-none print:border-none print:max-w-none print:m-0">
                        
                        {/* Report Header */}
                        <div className="p-8 border-b border-border/50 bg-[#F8FAFC] dark:bg-zinc-900/50 print:bg-transparent">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Staircase Pressurization</h1>
                              <p className="text-sm text-slate-500 font-medium mt-1">Design Calculation Report</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Project</p>
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{project?.name || "N/A"}</p>
                            </div>
                          </div>
                          <div className="flex gap-8 text-sm">
                            <div>
                              <span className="text-slate-400 text-xs">Date</span>
                              <p className="font-semibold">{new Date().toLocaleDateString()}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-xs">Unit System</span>
                              <p className="font-semibold uppercase">{unitSystem}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-xs">Staircases</span>
                              <p className="font-semibold">{items.length}</p>
                            </div>
                          </div>
                        </div>

                        {/* Report Body */}
                        <div className="p-8 space-y-10">
                          
                          {/* Schedule Summary */}
                          <section>
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                              <div className="w-1.5 h-4 bg-primary rounded-full"></div> Executive Summary
                            </h3>
                            <div className="rounded-xl border border-border/60 overflow-hidden">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-[#F1F5F9] dark:bg-zinc-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-border/60">
                                  <tr>
                                    <th className="py-2.5 px-3">Name</th>
                                    <th className="py-2.5 px-3">Door Type</th>
                                    <th className="py-2.5 px-3 text-right">Airflow</th>
                                    <th className="py-2.5 px-3 text-right">Pressure (dP)</th>
                                    <th className="py-2.5 px-3 text-right">Relief Area</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                  {items.map((item) => {
                                    const calc = calculateStaircase(item, isIp);
                                    return (
                                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                        <td className="py-2.5 px-3 font-medium text-foreground">{item.name}</td>
                                        <td className="py-2.5 px-3 text-slate-500">{DOOR_TYPES_CONFIG[item.doorType]?.name}</td>
                                        <td className="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400">{isIp ? calc.totalFanCapacityCfm + " CFM" : calc.totalFanCapacityLs + " L/s"}</td>
                                        <td className="py-2.5 px-3 text-right font-mono">{isIp ? calc.designPressureDropInWg + " in.wg" : calc.designPressureDropPa + " Pa"}</td>
                                        <td className="py-2.5 px-3 text-right font-mono">{isIp ? calc.reliefAreaSqFt + " sq ft" : calc.reliefAreaM2 + " m²"}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </section>

                          {/* Detailed Breakdown */}
                          <section>
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                              <div className="w-1.5 h-4 bg-primary rounded-full"></div> Calculation Breakdown
                            </h3>
                            <div className="space-y-6">
                              {items.map((item, index) => {
                                const calc = calculateStaircase(item, isIp);
                                return (
                                  <div key={item.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden print:break-inside-avoid">
                                    <div className="bg-slate-50 dark:bg-zinc-800/30 px-4 py-2 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                                      <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                                        <span className="text-muted-foreground text-xs font-normal">#{index + 1}</span> {item.name}
                                      </h4>
                                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-white dark:bg-zinc-800 px-2 py-1 rounded shadow-sm border border-slate-100 dark:border-zinc-700">
                                        {DOOR_TYPES_CONFIG[item.doorType]?.name}
                                      </span>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Input: Door Area</span>
                                        <p className="font-mono text-foreground font-medium">{item.doorArea || 0} {isIp ? "sq ft" : "m²"}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Input: Doors</span>
                                        <p className="font-medium text-foreground">{item.openDoorsCount || 0} Open / {item.closedDoorsCount || 0} Closed</p>
                                      </div>
                                      <div className="space-y-1 md:col-span-2">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Result: Total Airflow</span>
                                        <p className="font-mono font-bold text-blue-600 text-sm">{isIp ? calc.totalFanCapacityCfm + " CFM" : calc.totalFanCapacityLs + " L/s"}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="px-4 pb-4">
                                      <div className="bg-slate-50/50 dark:bg-zinc-950/50 rounded-lg p-3 text-[11px] font-mono grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 border border-slate-100 dark:border-zinc-800/60">
                                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-zinc-800/60">
                                          <span className="text-slate-500">Open Door Flow:</span>
                                          <span className="text-foreground">{isIp ? "-" : calc.openFlowLs + " L/s"}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-zinc-800/60">
                                          <span className="text-slate-500">Closed Door Leakage:</span>
                                          <span className="text-foreground">{isIp ? "-" : calc.closedFlowLs + " L/s"}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-zinc-800/60">
                                          <span className="text-slate-500">Safety Margin (25%):</span>
                                          <span className="text-foreground">{isIp ? "-" : (Number(calc.closedSafetyFlowM3s) * 1000).toFixed(1) + " L/s"}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-zinc-800/60">
                                          <span className="text-slate-500">Sub-Total Flow:</span>
                                          <span className="font-bold text-slate-700 dark:text-slate-300">{isIp ? "-" : (Number(calc.subTotalM3s) * 1000).toFixed(1) + " L/s"}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-zinc-800/60">
                                          <span className="text-slate-500">Final Safety (10%):</span>
                                          <span className="text-foreground">{isIp ? "-" : (Number(calc.finalSafetyM3s) * 1000).toFixed(1) + " L/s"}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </section>

                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Right-Side Panel: Intelligence / Calculation Preview */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen || selectedItems.size === 1
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg"
              : "w-0"
          }`}
        >
          {selectedItems.size === 1 && !intelOpen ? (() => {
            const selectedId = Array.from(selectedItems)[0];
            const item = items.find((i) => i.id === selectedId);
            if (!item) return null;
            const calc = calculateStaircase(item, unitSystem === "ip");

            return (
              <div className="flex flex-col h-full w-[360px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50 shrink-0">
                  <h3 className="font-semibold text-slate-800 text-[13px] flex items-center gap-1.5">
                    <Wrench className="size-3.5 text-blue-600" /> 
                    Calculation Preview
                  </h3>
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full truncate max-w-[120px]">
                    {item.name}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar text-[12px]">
                  <div className="space-y-4">
                    <div className="bg-slate-50 rounded-lg p-3 border border-border">
                      <h4 className="font-bold text-slate-700 mb-2 border-b border-border pb-1 uppercase text-[10px]">1. Airflow Breakdown</h4>
                      <div className="space-y-1.5 text-slate-600">
                        <div className="flex justify-between"><span>Open Door Flow:</span><span className="font-mono">{calc.openFlowM3s} mÂ³/s</span></div>
                        <div className="flex justify-between"><span>Closed Door Flow:</span><span className="font-mono">{calc.closedFlowM3s} mÂ³/s</span></div>
                        <div className="flex justify-between text-slate-400"><span>Closed Safety (25%):</span><span className="font-mono">{calc.closedSafetyFlowM3s} mÂ³/s</span></div>
                        <div className="flex justify-between pt-1 border-t border-border font-medium text-slate-800">
                          <span>Subtotal Flow:</span><span className="font-mono">{calc.subTotalM3s} mÂ³/s</span>
                        </div>
                        <div className="flex justify-between text-slate-400"><span>Final Safety (10%):</span><span className="font-mono">{calc.finalSafetyM3s} mÂ³/s</span></div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <h4 className="font-bold text-blue-800 mb-2 border-b border-blue-200 pb-1 uppercase text-[10px]">2. Required Fan Capacity</h4>
                      <div className="space-y-1.5 text-blue-900">
                        <div className="flex justify-between text-[14px] font-bold">
                          <span>Total Flow:</span><span className="font-mono">{unitSystem === "ip" ? `${calc.totalFanCapacityCfm} CFM` : `${calc.totalFanCapacityLs} L/s`}</span>
                        </div>
                        <div className="flex justify-between text-[11px] opacity-80">
                          <span>In mÂ³/s:</span><span className="font-mono">{calc.totalFanCapacityM3s} mÂ³/s</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-border">
                      <h4 className="font-bold text-slate-700 mb-2 border-b border-border pb-1 uppercase text-[10px]">3. Pressure & Relief</h4>
                      <div className="space-y-1.5 text-slate-600">
                        <div className="flex justify-between"><span>Duct Friction Loss:</span><span className="font-mono">{calc.ductLoss} Pa</span></div>
                        <div className="flex justify-between"><span>Combined Drop:</span><span className="font-mono">{calc.combinedDrop} Pa</span></div>
                        <div className="flex justify-between text-slate-400"><span>Safety Drop (25%):</span><span className="font-mono">{calc.safetyDrop} Pa</span></div>
                        
                        <div className="flex justify-between pt-2 mt-2 border-t border-border font-bold text-slate-800">
                          <span>Design dP:</span><span className="font-mono">{unitSystem === "ip" ? `${calc.designPressureDropInWg} in. w.g.` : `${calc.designPressureDropPa} Pa`}</span>
                        </div>
                        <div className="flex justify-between pt-1 font-bold text-slate-800">
                          <span>Relief Area:</span><span className="font-mono">{unitSystem === "ip" ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} mÂ²`}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : intelOpen ? (
            <div className="flex flex-col h-full w-[360px] p-4 items-center justify-center text-center">
              <Sparkles className="size-8 text-primary mb-3" />
              <h3 className="font-bold text-foreground">AI Intelligence</h3>
              <p className="text-sm text-muted-foreground mt-2">Chat with your building data or ask for calculation recommendations.</p>
            </div>
          ) : null}
        </div>
      </div>

            {/* Calculation Breakdown & Preview Modal */}
      {previewRow && typeof document !== "undefined" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 font-sans animate-fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 flex flex-col gap-5 shadow-2xl animate-scale-in select-none max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Sparkles className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">Calculation Preview</h3>
                  <p className="text-xs text-muted-foreground">{previewRow.name} - Pressurization Breakdown</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg cursor-pointer transition hover:bg-accent"
              >
                <X className="size-5" />
              </button>
            </div>

            {(() => {
              const calc = calculateStaircase(previewRow, isIp);
              return (
                <div className="space-y-4">
                  {/* Results Overview */}
                  <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                    <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                      <span className="text-muted-foreground font-semibold">Fan Airflow</span>
                      <span className="text-base font-bold font-mono text-primary">{isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs} <span className="text-[10px] text-foreground">{isIp ? "CFM" : "L/s"}</span></span>
                    </div>
                    <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                      <span className="text-muted-foreground font-semibold">Design dP</span>
                      <span className="text-base font-bold font-mono text-primary">{isIp ? calc.designPressureDropInWg : calc.designPressureDropPa} <span className="text-[10px] text-foreground">{isIp ? "in.wg" : "Pa"}</span></span>
                    </div>
                    <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                      <span className="text-muted-foreground font-semibold">Relief Area</span>
                      <span className="text-base font-bold font-mono text-primary">{isIp ? calc.reliefAreaSqFt : calc.reliefAreaM2} <span className="text-[10px] text-foreground">{isIp ? "sq ft" : "m²"}</span></span>
                    </div>
                  </div>

                                    {/* Calculation Breakdown & Formulas */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground">Calculation Breakdown & Formulas</h4>
                    <div className="space-y-3 text-xs text-muted-foreground">
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="font-bold text-foreground">1. Open Door Flow</span><br/>
                        <code className="text-blue-600 dark:text-blue-400 block my-1">Q = Door Area × Velocity × Open Doors</code>
                        <span className="font-mono">
                          {isIp ? (previewRow.doorArea || 0) + " sq ft" : (previewRow.doorArea || 0) + " m²"} × {isIp ? "196.85 ft/min" : "1.0 m/s"} × {previewRow.openDoorsCount || 0} doors = <strong className="text-foreground">{isIp ? "-" : calc.openFlowLs + " L/s"}</strong>
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="font-bold text-foreground">2. Closed Door Flow</span><br/>
                        <code className="text-blue-600 dark:text-blue-400 block my-1">Q = Leakage Rate × Closed Doors</code>
                        <span className="font-mono">
                          Leakage Rate × {previewRow.closedDoorsCount || 0} doors = <strong className="text-foreground">{isIp ? "-" : calc.closedFlowLs + " L/s"}</strong>
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="font-bold text-foreground">3. Safety Margins</span><br/>
                        <span className="font-mono">Closed Doors Safety (25%): <strong className="text-foreground">{isIp ? "-" : (Number(calc.closedSafetyFlowM3s) * 1000).toFixed(1)} L/s</strong></span><br/>
                        <span className="font-mono mt-1 block">Final Fan Safety (10%): <strong className="text-foreground">{isIp ? "-" : (Number(calc.finalSafetyM3s) * 1000).toFixed(1)} L/s</strong></span>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <span className="font-bold text-blue-700 dark:text-blue-300">4. Total Fan Capacity</span><br/>
                        <code className="text-blue-600 dark:text-blue-400 block my-1">Q = (Open + Closed + 25% Safety) × 1.10</code>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm mt-1 block">
                          Total = {isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs} {isIp ? "CFM" : "L/s"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => { setCommentModalOpen(false); setCommentTargetItem(null); }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="equipment"
          calculatorTitle="Staircase Pressurization"
          calculatorPath="/staircase-pressurization"
          existingComments={Array.isArray((commentTargetItem as any).comments) ? (commentTargetItem as any).comments : []}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}
