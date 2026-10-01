import { calculateLiftwell, DOOR_TYPES_CONFIG, CALCULATION_CONSTANTS, type LiftwellItem, type DoorTypeKey, type DoorTypeDefinition } from "@/lib/calc-liftwell";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { useAuth } from "@/contexts/AuthContext";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { Plus, Trash2, MessageSquare, FileSpreadsheet, FileText, Check, X, Wrench, Sparkles, Search, CheckCircle2, Info, ChevronDown, AlertTriangle, Edit3, Copy, Scissors } from "lucide-react";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { addPdfHeader, addPdfSignatureBlock } from "@/lib/pdfHelpers";

export const Route = createFileRoute("/liftwell-pressurization")({
  component: LiftwellPressurizationPage,
});

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function LiftwellPressurizationPage() {
  const { project, activeProjectId, isReadOnly } = useWorkspace();
  const { userData, profile } = useAuth();
  
  const isApprovedLocked = useCalculationLock("/liftwell-pressurization", project?.id || activeProjectId);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const calcReviewState = useCalculationReviewState("/liftwell-pressurization", activeProjectId || project?.id);
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole || calcReviewState?.status === "APPROVED");

  const [items, setItems] = useState<LiftwellItem[]>([
    { id: generateId(), name: "LIFTWELL-01", doorType: "lift_landing", doorArea: 2.76, openDoorsCount: 1, closedDoorsCount: 17 }
  ]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"schedule" | "report">("schedule");
  const [intelOpen, setIntelOpen] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [previewRow, setPreviewRow] = useState<LiftwellItem | null>(null);
  const [editingLiftwell, setEditingLiftwell] = useState<LiftwellItem | null>(null);

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
    const savedKey = "mep_auto_state_" + (project?.id || activeProjectId) + "_/liftwell-pressurization_list";
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch(e) {}
    }
  }, [project?.id, activeProjectId]);

  const saveItems = (newItems: LiftwellItem[]) => {
    setItems(newItems);
    dirtyStore.set(true);
    const savedKey = "mep_auto_state_" + (project?.id || activeProjectId) + "_/liftwell-pressurization_list";
    localStorage.setItem(savedKey, JSON.stringify(newItems));
  };

  const updateItem = (id: string, field: keyof LiftwellItem, value: any) => {
    if (isEffectiveReadOnly) return;
    const newItems = items.map(i => i.id === id ? { ...i, [field]: value } : i);
    saveItems(newItems);
  };

  const addItem = () => {
    if (isEffectiveReadOnly) return;
    const newName = "LIFTWELL-" + (items.length + 1).toString().padStart(2, "0");
    saveItems([...items, { id: generateId(), name: newName, doorType: "lift_landing", doorArea: 2.76, openDoorsCount: 1, closedDoorsCount: 17 }]);
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
          const el = document.getElementById(`liftwell-row-${r.id}`) || document.getElementById(`row-${r.id}`) || document.querySelector(`[data-row-id="${r.id}"]`);
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

  const handleExportExcel = () => {
    try {
      const data = items.map((item, idx) => {
        const calc = calculateLiftwell(item, isIp);
        return {
          "No.": idx + 1,
          "Liftwell Name": item.name,
          "Door Type": DOOR_TYPES_CONFIG[item.doorType]?.name || item.doorType,
          [`Door Area (${isIp ? "sq ft" : "m²"})`]: item.doorArea,
          "Open Doors Qty": item.openDoorsCount,
          "Closed Doors Qty": item.closedDoorsCount,
          [`Fan Airflow (${isIp ? "CFM" : "L/s"})`]: isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs,
          [`Design dP (${isIp ? "in.wg" : "Pa"})`]: isIp ? calc.designPressureDropInWg : calc.designPressureDropPa,
          [`Relief Area (${isIp ? "sq ft" : "m²"})`]: isIp ? calc.reliefAreaSqFt : calc.reliefAreaM2,
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Liftwell Pressurization");
      XLSX.writeFile(wb, "Liftwell_Pressurization_Schedule.xlsx");
      toast.success("Excel schedule exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel schedule");
    }
  };

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      
      const startY = addPdfHeader(doc, "Liftwell Pressurization Calculation Report");

      const tableData = items.map((item, index) => {
        const calc = calculateLiftwell(item, isIp);
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

      const primaryFill = [217, 217, 217] as [number, number, number];

      autoTable(doc, {
        startY: startY,
        head: [["#", "Liftwell Name", "Door Type", `Door Area (${isIp ? "sq ft" : "m²"})`, "Open Doors", "Closed Doors", `Fan Airflow (${isIp ? "CFM" : "L/s"})`, `dP (${isIp ? "in.wg" : "Pa"})`, `Relief Area (${isIp ? "sq ft" : "m²"})`]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8, halign: "center", valign: "middle", lineColor: [100, 100, 100], lineWidth: 0.1 },
        headStyles: { fillColor: primaryFill, textColor: 0, fontStyle: 'bold' },
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 150;
      let userName = "System Admin";
      if (typeof window !== "undefined") {
        try {
          const profileStr = localStorage.getItem('mep_calculator_user_data') || localStorage.getItem('mep_profile') || localStorage.getItem('mep_user_data');
          if (profileStr) {
            const profile = JSON.parse(profileStr);
            userName = profile.name || profile.user?.name || profile.userData?.name || "System Admin";
          }
        } catch(e) {}
      }
      addPdfSignatureBlock(doc, finalY, userName, project?.id, "/liftwell-pressurization");

      doc.save("Liftwell_Pressurization_Report.pdf");
      toast.success("PDF report downloaded!");
    } catch(err) {
      toast.error("Failed to generate PDF");
    }
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery) return items;
    const lowerQuery = searchQuery.toLowerCase();
    return items.filter((row) => row.name.toLowerCase().includes(lowerQuery));
  }, [items, searchQuery]);

  const columns: Column<LiftwellItem>[] = useMemo(() => [
    {
      key: "name",
      header: "LIFTWELL NAME",
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
      width: 230,
      render: (row) => (
        <div className="relative flex items-center w-full">
          <select 
            value={row.doorType}
            onChange={(e) => updateItem(row.id, "doorType", e.target.value as DoorTypeKey)}
            disabled={isEffectiveReadOnly}
            className="w-full appearance-none bg-surface-2 border border-border/70 rounded-md py-1 pl-2.5 pr-7 text-xs font-semibold text-foreground outline-none focus:border-primary cursor-pointer disabled:opacity-60 transition"
          >
            {(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[]).map(k => (
              <option key={k} value={k}>{DOOR_TYPES_CONFIG[k].name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
      )
    },
    {
      key: "doorArea",
      header: `DOOR AREA (${unitSystem === "ip" ? "sq ft" : "m²"})`,
      width: 130,
      render: (row) => (
        <input 
          type="number"
          value={row.doorArea} 
          onChange={(e) => updateItem(row.id, "doorArea", e.target.value)}
          disabled={isEffectiveReadOnly}
          className="bg-transparent outline-none w-full text-xs font-medium"
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
          className="bg-transparent outline-none w-full text-xs font-medium"
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
          className="bg-transparent outline-none w-full text-xs font-medium"
          placeholder="Qty"
        />
      )
    },
    {
      key: "fanAirflow",
      header: `FAN AIRFLOW (${unitSystem === "ip" ? "CFM" : "L/s"})`,
      width: 140,
      render: (row) => {
        const calc = calculateLiftwell(row, unitSystem === "ip");
        return <span className="text-primary font-bold cursor-pointer" onDoubleClick={() => setPreviewRow(row)}>{unitSystem === "ip" ? calc.totalFanCapacityCfm.toLocaleString() : calc.totalFanCapacityLs.toLocaleString()}</span>;
      }
    },
    {
      key: "dP",
      header: `dP (${unitSystem === "ip" ? "in.wg" : "Pa"})`,
      width: 100,
      render: (row) => {
        const calc = calculateLiftwell(row, unitSystem === "ip");
        return <span className="cursor-pointer font-mono font-medium" onDoubleClick={() => setPreviewRow(row)}>{unitSystem === "ip" ? calc.designPressureDropInWg : calc.designPressureDropPa}</span>;
      }
    },
    {
      key: "reliefArea",
      header: `RELIEF AREA (${unitSystem === "ip" ? "sq ft" : "m²"})`,
      width: 130,
      render: (row) => {
        const calc = calculateLiftwell(row, unitSystem === "ip");
        return <span className="cursor-pointer font-mono font-medium" onDoubleClick={() => setPreviewRow(row)}>{unitSystem === "ip" ? calc.reliefAreaSqFt : calc.reliefAreaM2}</span>;
      }
    },
    {
      key: "status",
      header: "STATUS",
      width: 90,
      render: (row) => {
        const area = Number(row.doorArea) || 0;
        const open = Number(row.openDoorsCount) || 0;
        const closed = Number(row.closedDoorsCount) || 0;
        const isValid = area > 0 && (open > 0 || closed > 0);
        const hasComments = Array.isArray((row as any).comments) && (row as any).comments.length > 0;

        return (
          <div className="flex items-center gap-1.5 w-full">
            {isValid ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                PASS
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                WARN
              </span>
            )}
            {hasComments && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentTargetItem(row);
                  setCommentModalOpen(true);
                }}
                className="flex items-center justify-center size-5 rounded-md hover:bg-blue-100 text-blue-500 transition-colors cursor-pointer"
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

  const renderLiftwellContextMenu = (row: LiftwellItem) => (
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

  const commentsList = useMemo(() => items.flatMap(i => (i as any).comments || []), [items]);

  const totals = useMemo(() => {
    let totalFanCapacityLs = 0;
    let totalFanCapacityCfm = 0;
    let totalReliefAreaM2 = 0;
    let totalReliefAreaSqFt = 0;
    let totalDoorsOpen = 0;
    let totalDoorsClosed = 0;

    items.forEach(item => {
      const calcSi = calculateLiftwell(item, false);
      const calcIp = calculateLiftwell(item, true);
      totalFanCapacityLs += calcSi.totalFanCapacityLs;
      totalFanCapacityCfm += calcIp.totalFanCapacityCfm;
      totalReliefAreaM2 += Number(calcSi.reliefAreaM2);
      totalReliefAreaSqFt += Number(calcIp.reliefAreaSqFt);
      totalDoorsOpen += Number(item.openDoorsCount) || 0;
      totalDoorsClosed += Number(item.closedDoorsCount) || 0;
    });

    return {
      totalFanCapacityLs,
      totalFanCapacityCfm,
      totalReliefAreaM2,
      totalReliefAreaSqFt,
      totalDoorsOpen,
      totalDoorsClosed
    };
  }, [items]);

  return (
    <AppShell 
      title="Liftwell Pressurization" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen(v => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header & Actions */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Liftwell Pressurization</h1>
              </div>
              
              <button 
                type="button"
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Liftwell Pressurization Intelligence"
              >
                <Sparkles className="size-3.5" /> Intelligence
              </button>

              <CalculationReviewBar 
                projectId={project?.id || activeProjectId || "default"} 
                calculatorPath="/liftwell-pressurization" 
                calculatorTitle="Liftwell Pressurization" 
              />

              {commentsList.length > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Active {commentsList.length === 1 ? "Comment/Task" : "Comments/Tasks"}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
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
            
            {/* Top Row 1: Section Navigation Tabs & Export */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setTab("schedule")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "schedule"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                    }`}
                  >
                    Liftwell Schedule
                  </button>
                  <button
                    type="button"
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

                <TBtn
                  onClick={() => setShowFormulaModal(true)}
                  title="Calculation Formulas & Methodology"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              <div className="flex items-center gap-2.5 select-none shrink-0">
                <TBtn onClick={handleExportPdf} title="Export PDF Report">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Dedicated Toolbar Row 2 when tab === 'schedule' */}
            {tab === "schedule" && (
              <div className="flex items-center justify-between px-4 py-2 bg-card/60 shrink-0 select-none no-print border-b border-border/50 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search liftwells..."
                      className="h-7 w-48 pl-8 pr-6 bg-slate-100 dark:bg-slate-900/60 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-2 text-muted-foreground hover:text-foreground">
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <TBtn primary onClick={addItem} disabled={isEffectiveReadOnly}>
                    <Plus className="size-3.5" /> Add Liftwell
                  </TBtn>
                </div>
              </div>
            )}

            {/* Active Tab Content */}
            <div className="flex-1 flex flex-col min-h-0 bg-background relative">
              {tab === "schedule" && (
                <div className="absolute inset-0 flex flex-col animate-in fade-in duration-300">
                  {/* Floating Bulk Action Overlay Bar when rows selected */}
                  {!isEffectiveReadOnly && selectedItems.size > 0 && (
                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 h-10 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg border-b border-primary/20">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{selectedItems.size} selected</span>
                        <span className="text-primary/30">·</span>
                        <button
                          onClick={() => {
                            const firstId = Array.from(selectedItems)[0];
                            const item = items.find(i => i.id === firstId);
                            if (item) setEditingLiftwell(item);
                          }}
                          className="flex items-center gap-1 hover:underline font-bold cursor-pointer"
                          title="Edit selected liftwell"
                        >
                          <Edit3 className="size-3" /> Edit
                        </button>
                        <button
                          onClick={deleteSelected}
                          className="flex items-center gap-1 hover:underline font-bold text-red-500 cursor-pointer"
                          title="Delete selected liftwells"
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                      </div>
                      <button
                        onClick={() => setSelectedItems(new Set())}
                        className="text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 px-2 py-0.5 rounded cursor-pointer"
                      >
                        <X className="size-3" /> Clear
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
                        onRowDoubleClick={(row) => setEditingLiftwell(row)}
                        isReadOnly={isEffectiveReadOnly}
                        renderContextMenu={renderLiftwellContextMenu}
                        activeRowId={editingLiftwell?.id}
                        rowClassName={(row, index) =>
                          index % 2 === 0
                            ? "bg-[#f4f4f7]/70 hover:bg-[#ebebee] dark:bg-zinc-900/30 dark:hover:bg-zinc-800/50"
                            : "bg-card hover:bg-[#ebebee] dark:hover:bg-zinc-800/50"
                        }
                      />
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <div className="size-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                          <Search className="size-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No liftwells found.</p>
                        <p className="text-xs mt-1">Try adjusting your search query or add a new liftwell.</p>
                      </div>
                    )}
                  </div>

                  {/* Summary Status Bar */}
                  <div className="flex items-center justify-between px-4 py-2 bg-card/80 border-t border-border/80 text-xs text-muted-foreground shrink-0 select-none flex-wrap gap-2">
                    <span>Showing {filteredRows.length} of {items.length} liftwells</span>
                    <div className="flex items-center gap-4 font-medium">
                      <span>Total Airflow: <strong className="text-foreground">{unitSystem === "ip" ? totals.totalFanCapacityCfm.toLocaleString() + " CFM" : totals.totalFanCapacityLs.toLocaleString() + " L/s"}</strong></span>
                      <span>Total Relief Area: <strong className="text-foreground">{unitSystem === "ip" ? totals.totalReliefAreaSqFt.toFixed(2) + " sq ft" : totals.totalReliefAreaM2.toFixed(2) + " m²"}</strong></span>
                    </div>
                  </div>
                </div>
              )}
              
              {tab === "report" && (
                <div className="absolute inset-0 flex flex-col animate-in fade-in duration-300 bg-[#F5F7F9] dark:bg-zinc-950 overflow-y-auto">
                  
                  {/* Floating Action Bar */}
                  <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-border shadow-sm print:hidden">
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Liftwell Pressurization Report</h2>
                      <p className="text-[11px] text-muted-foreground">{items.length} liftwells calculated</p>
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
                            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Liftwell Pressurization</h1>
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
                            <span className="text-slate-400 text-xs">Liftwells</span>
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
                                  const calc = calculateLiftwell(item, isIp);
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
                              const calc = calculateLiftwell(item, isIp);
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
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg"
              : "w-0"
          }`}
        >
          {intelOpen ? (
            <LiftwellIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              items={items}
              unitSystem={unitSystem}
              onSelectLiftwell={(id) => {
                setSelectedItems(new Set([id]));
              }}
            />
          ) : selectedItems.size === 1 ? (() => {
            const selectedId = Array.from(selectedItems)[0];
            const item = items.find((i) => i.id === selectedId);
            if (!item) return null;
            const calc = calculateLiftwell(item, unitSystem === "ip");

            return (
              <div className="flex flex-col h-full w-[360px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50 dark:bg-zinc-900/50 shrink-0">
                  <h3 className="font-semibold text-foreground text-[13px] flex items-center gap-1.5">
                    <Wrench className="size-3.5 text-primary" /> 
                    Calculation Preview
                  </h3>
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full truncate max-w-[120px]">
                    {item.name}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar text-[12px] space-y-4">
                  <div className="bg-surface-2/60 rounded-xl p-3 border border-border">
                    <h4 className="font-bold text-foreground mb-2 border-b border-border pb-1 uppercase text-[10px]">1. Airflow Breakdown</h4>
                    <div className="space-y-1.5 text-muted-foreground">
                      <div className="flex justify-between"><span>Open Door Flow:</span><span className="font-mono text-foreground">{calc.openFlowM3s} m³/s</span></div>
                      <div className="flex justify-between"><span>Closed Door Flow:</span><span className="font-mono text-foreground">{calc.closedFlowM3s} m³/s</span></div>
                      <div className="flex justify-between text-muted-foreground/70"><span>Closed Safety (25%):</span><span className="font-mono">{calc.closedSafetyFlowM3s} m³/s</span></div>
                      <div className="flex justify-between pt-1 border-t border-border font-medium text-foreground">
                        <span>Subtotal Flow:</span><span className="font-mono">{calc.subTotalM3s} m³/s</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground/70"><span>Final Safety (10%):</span><span className="font-mono">{calc.finalSafetyM3s} m³/s</span></div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
                    <h4 className="font-bold text-primary mb-2 border-b border-primary/20 pb-1 uppercase text-[10px]">2. Required Fan Capacity</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[14px] font-bold text-primary">
                        <span>Total Flow:</span><span className="font-mono">{unitSystem === "ip" ? `${calc.totalFanCapacityCfm} CFM` : `${calc.totalFanCapacityLs} L/s`}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>In m³/s:</span><span className="font-mono text-foreground">{calc.totalFanCapacityM3s} m³/s</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-2/60 rounded-xl p-3 border border-border">
                    <h4 className="font-bold text-foreground mb-2 border-b border-border pb-1 uppercase text-[10px]">3. Pressure & Relief</h4>
                    <div className="space-y-1.5 text-muted-foreground">
                      <div className="flex justify-between"><span>Duct Friction Loss:</span><span className="font-mono text-foreground">{calc.ductLoss} Pa</span></div>
                      <div className="flex justify-between"><span>Combined Drop:</span><span className="font-mono text-foreground">{calc.combinedDrop} Pa</span></div>
                      <div className="flex justify-between text-muted-foreground/70"><span>Safety Drop (25%):</span><span className="font-mono">{calc.safetyDrop} Pa</span></div>
                      
                      <div className="flex justify-between pt-2 mt-2 border-t border-border font-bold text-foreground">
                        <span>Design dP:</span><span className="font-mono">{unitSystem === "ip" ? `${calc.designPressureDropInWg} in.wg` : `${calc.designPressureDropPa} Pa`}</span>
                      </div>
                      <div className="flex justify-between pt-1 font-bold text-foreground">
                        <span>Relief Area:</span><span className="font-mono">{unitSystem === "ip" ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : null}
        </div>
      </div>

      {/* Edit Liftwell Modal */}
      {editingLiftwell && typeof document !== "undefined" && (
        <EditLiftwellModal
          liftwell={editingLiftwell}
          unitSystem={unitSystem}
          isReadOnly={isEffectiveReadOnly}
          onClose={() => setEditingLiftwell(null)}
          onSave={(updated) => {
            setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
            saveItems(items.map(i => i.id === updated.id ? updated : i));
            setEditingLiftwell(null);
            toast.success("Liftwell updated successfully");
          }}
        />
      )}

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
              const calc = calculateLiftwell(previewRow, isIp);
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
                        <span className="font-mono">Closed Doors Safety (25%): <strong className="text-foreground">{isIp ? "-" : (Number(calc.closedSafetyFlowM3s) * 1000).toFixed(1) + " L/s"}</strong></span><br/>
                        <span className="font-mono mt-1 block">Final Fan Safety (10%): <strong className="text-foreground">{isIp ? "-" : (Number(calc.finalSafetyM3s) * 1000).toFixed(1) + " L/s"}</strong></span>
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

      {/* Formula Breakdown Modal */}
      {showFormulaModal && (
        <LiftwellFormulaModal
          onClose={() => setShowFormulaModal(false)}
          unitSystem={unitSystem}
        />
      )}

      {commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => { setCommentModalOpen(false); setCommentTargetItem(null); }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="equipment"
          calculatorTitle="Liftwell Pressurization"
          calculatorPath="/liftwell-pressurization"
          existingComments={Array.isArray((commentTargetItem as any).comments) ? (commentTargetItem as any).comments : []}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

function LiftwellIntelligenceDrawer({
  onClose,
  items,
  unitSystem,
  onSelectLiftwell,
}: {
  onClose: () => void;
  items: LiftwellItem[];
  unitSystem: "si" | "ip";
  onSelectLiftwell: (id: string) => void;
}) {
  const isIp = unitSystem === "ip";

  const totals = useMemo(() => {
    let totalFanCapacityLs = 0;
    let totalFanCapacityCfm = 0;
    let totalReliefAreaM2 = 0;
    let totalReliefAreaSqFt = 0;
    let totalOpenDoors = 0;
    let totalClosedDoors = 0;

    items.forEach(item => {
      const calcSi = calculateLiftwell(item, false);
      const calcIp = calculateLiftwell(item, true);
      totalFanCapacityLs += calcSi.totalFanCapacityLs;
      totalFanCapacityCfm += calcIp.totalFanCapacityCfm;
      totalReliefAreaM2 += Number(calcSi.reliefAreaM2);
      totalReliefAreaSqFt += Number(calcIp.reliefAreaSqFt);
      totalOpenDoors += Number(item.openDoorsCount) || 0;
      totalClosedDoors += Number(item.closedDoorsCount) || 0;
    });

    return {
      totalFanCapacityLs,
      totalFanCapacityCfm,
      totalReliefAreaM2,
      totalReliefAreaSqFt,
      totalOpenDoors,
      totalClosedDoors,
    };
  }, [items]);

  const allCompliant = items.length > 0 && items.every(i => (Number(i.doorArea) || 0) > 0 && (Number(i.openDoorsCount) || 0) > 0);

  return (
    <div className="h-full w-[360px] flex flex-col font-sans select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Liftwell Intelligence</h3>
            <p className="text-[10px] text-muted-foreground">NFPA 92 &amp; BS EN 12101-6 Code Audit</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-7 rounded-lg hover:bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {/* Compliance Gauge Card */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Standard Compliance</span>
            <span className={`font-mono font-bold text-xs ${allCompliant ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {allCompliant ? "100% Compliant" : "Review Needed"}
            </span>
          </div>
          <div className="h-2 w-full bg-border/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${allCompliant ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: allCompliant ? "100%" : "70%" }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {allCompliant 
              ? "All active liftwells comply with standard egress velocity, leakage rates, and safety allowances."
              : "Ensure all liftwells have valid door areas and open/closed door counts."}
          </p>
        </div>

        {/* System Summary KPI Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-surface-2 rounded-xl border border-border/60 flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase">Total Airflow</span>
            <span className="text-base font-bold font-mono text-primary">
              {isIp ? totals.totalFanCapacityCfm.toLocaleString() : totals.totalFanCapacityLs.toLocaleString()}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">{isIp ? "CFM" : "L/s"}</span>
            </span>
          </div>

          <div className="p-3 bg-surface-2 rounded-xl border border-border/60 flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase">Total Relief Area</span>
            <span className="text-base font-bold font-mono text-primary">
              {isIp ? totals.totalReliefAreaSqFt.toFixed(2) : totals.totalReliefAreaM2.toFixed(2)}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">{isIp ? "sq ft" : "m²"}</span>
            </span>
          </div>

          <div className="p-3 bg-surface-2 rounded-xl border border-border/60 flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase">Open Doors</span>
            <span className="text-base font-bold font-mono text-foreground">
              {totals.totalOpenDoors} <span className="text-[10px] font-normal text-muted-foreground">doors</span>
            </span>
          </div>

          <div className="p-3 bg-surface-2 rounded-xl border border-border/60 flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase">Closed Doors</span>
            <span className="text-base font-bold font-mono text-foreground">
              {totals.totalClosedDoors} <span className="text-[10px] font-normal text-muted-foreground">doors</span>
            </span>
          </div>
        </div>

        {/* Liftwell System Breakdown */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Liftwell Systems ({items.length})</span>
          </div>

          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {items.map(lift => {
              const calc = calculateLiftwell(lift, isIp);
              return (
                <div
                  key={lift.id}
                  onClick={() => onSelectLiftwell(lift.id)}
                  className="p-2.5 rounded-xl bg-surface-2/60 hover:bg-surface-2 border border-border/70 flex flex-col gap-1 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-xs">{lift.name}</span>
                    <span className="text-primary font-mono font-bold text-xs">
                      {isIp ? calc.totalFanCapacityCfm.toLocaleString() + " CFM" : calc.totalFanCapacityLs.toLocaleString() + " L/s"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{DOOR_TYPES_CONFIG[lift.doorType]?.name || lift.doorType}</span>
                    <span>Relief: {isIp ? calc.reliefAreaSqFt + " sq ft" : calc.reliefAreaM2 + " m²"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Engineering Code Rules */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Governing Engineering Codes</span>
          </div>
          <div className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
            <p>• <strong>NFPA 92 / BS EN 12101-6</strong>: Min airflow velocity of 1.0 m/s (196.85 ft/min) across open lift landings.</p>
            <p>• <strong>Lift Landing Leakage</strong>: Design crack leakage rate of 0.19 m³/s per closed lift landing door.</p>
            <p>• <strong>Safety Factors</strong>: 25% safety margin on closed door leakage + 10% design safety factor on final fan volume.</p>
            <p>• <strong>Overpressure Relief</strong>: Sized for {isIp ? "0.05 in.wg (12.5 Pa)" : "12.5 Pa"} differential across barometric dampers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiftwellFormulaModal({
  onClose,
  unitSystem,
}: {
  onClose: () => void;
  unitSystem: "si" | "ip";
}) {
  const isIp = unitSystem === "ip";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 flex flex-col gap-4 shadow-2xl animate-scale-in max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-2.5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Info className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Liftwell Pressurization Calculation Methodology</h3>
              <span className="text-xs text-muted-foreground">Engineering Standards NFPA 92 &amp; BS EN 12101-6</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 text-xs">
          {/* 1. Open Door Flow */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <div className="size-2 rounded-full bg-[#0A7BC7]" />
              <span>1. Open Door Airflow (Q_open)</span>
            </div>
            <div className="bg-background border border-border/60 rounded-lg p-2.5 font-mono text-[11.5px] text-primary font-semibold">
              Q_open = Door Area × Egress Velocity × Number of Open Doors
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Standard egress airflow velocity v = 1.0 m/s (196.85 ft/min) across designated open lift landing doors into unpressurized space.
            </p>
          </div>

          {/* 2. Closed Door Leakage Flow */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <div className="size-2 rounded-full bg-[#0A7BC7]" />
              <span>2. Closed Door Crack Leakage (Q_closed)</span>
            </div>
            <div className="bg-background border border-border/60 rounded-lg p-2.5 font-mono text-[11.5px] text-primary font-semibold">
              Q_closed = Specific Leakage Rate × Number of Closed Doors
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground mt-1">
              <div>• Lift landing door: 0.19 m³/s/door</div>
              <div>• Double-leaf opening: 0.10 m³/s/door</div>
              <div>• Single-leaf outwards: 0.06 m³/s/door</div>
              <div>• Single-leaf into space: 0.03 m³/s/door</div>
            </div>
          </div>

          {/* 3. Safety Factors */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <div className="size-2 rounded-full bg-[#0A7BC7]" />
              <span>3. Engineering Safety Margins (+25% &amp; +10%)</span>
            </div>
            <div className="bg-background border border-border/60 rounded-lg p-2.5 font-mono text-[11.5px] text-foreground space-y-1">
              <div>Q_closed_safe = Q_closed × 1.25 (25% closed door safety margin)</div>
              <div>Subtotal = Q_open + Q_closed_safe</div>
              <div className="text-primary font-bold">Total Fan Capacity = Subtotal × 1.10 (10% final safety margin)</div>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Final calculated fan capacity is rounded up to the nearest multiple of 5 L/s (or converted to CFM).
            </p>
          </div>

          {/* 4. Overpressure Relief Sizing */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <div className="size-2 rounded-full bg-[#0A7BC7]" />
              <span>4. Barometric Overpressure Relief Vent Area (A_relief)</span>
            </div>
            <div className="bg-background border border-border/60 rounded-lg p-2.5 font-mono text-[11.5px] text-primary font-semibold">
              A_relief = Q_fan (m³/s) ÷ (0.827 × √(ΔP_ref))
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Where ΔP_ref = 12.5 Pa reference pressure differential across the relief damper to prevent excessive opening resistance on lift landing doors.
            </p>
          </div>

          {/* 5. Pressure Drop Sizing */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <div className="size-2 rounded-full bg-[#0A7BC7]" />
              <span>5. Design Total Static Pressure Drop (ΔP_total)</span>
            </div>
            <div className="bg-background border border-border/60 rounded-lg p-2.5 font-mono text-[11.5px] text-foreground">
              ΔP_total = (Duct Loss + Louvers/Grilles + 12.5 Pa Reference) × 1.25 Safety Margin
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border/60">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}


interface EditLiftwellModalProps {
  liftwell: LiftwellItem;
  unitSystem: "si" | "ip";
  isReadOnly: boolean;
  onClose: () => void;
  onSave: (updated: LiftwellItem) => void;
}

function EditLiftwellModal({ liftwell, unitSystem, isReadOnly, onClose, onSave }: EditLiftwellModalProps) {
  const isIp = unitSystem === "ip";
  const [formData, setFormData] = useState<LiftwellItem>({ ...liftwell });

  const calc = calculateLiftwell(formData, isIp);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 font-sans animate-fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 flex flex-col gap-5 shadow-2xl animate-scale-in select-none max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Wrench className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Edit Liftwell</h3>
              <p className="text-xs text-muted-foreground">{formData.name} &bull; Pressurization Parameters &amp; Calculations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg cursor-pointer transition hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Live Calculation Results Overview */}
        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 flex flex-col gap-1">
            <span className="text-muted-foreground font-semibold text-[11px]">Fan Airflow</span>
            <span className="text-base font-extrabold font-mono text-primary">
              {isIp ? calc.totalFanCapacityCfm.toLocaleString() : calc.totalFanCapacityLs.toLocaleString()}{" "}
              <span className="text-[10px] font-normal text-muted-foreground">{isIp ? "CFM" : "L/s"}</span>
            </span>
          </div>
          <div className="bg-surface-2 p-3 rounded-xl border border-border flex flex-col gap-1">
            <span className="text-muted-foreground font-semibold text-[11px]">Design dP</span>
            <span className="text-base font-bold font-mono text-foreground">
              {isIp ? calc.designPressureDropInWg : calc.designPressureDropPa}{" "}
              <span className="text-[10px] font-normal text-muted-foreground">{isIp ? "in.wg" : "Pa"}</span>
            </span>
          </div>
          <div className="bg-surface-2 p-3 rounded-xl border border-border flex flex-col gap-1">
            <span className="text-muted-foreground font-semibold text-[11px]">Relief Area</span>
            <span className="text-base font-bold font-mono text-foreground">
              {isIp ? calc.reliefAreaSqFt : calc.reliefAreaM2}{" "}
              <span className="text-[10px] font-normal text-muted-foreground">{isIp ? "sq ft" : "m²"}</span>
            </span>
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">Liftwell Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                disabled={isReadOnly}
                className="w-full h-8 px-3 rounded-lg border border-border bg-surface-1 focus:border-primary outline-none text-xs font-medium"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">Door Type</label>
              <select
                value={formData.doorType}
                onChange={e => setFormData({ ...formData, doorType: e.target.value as DoorTypeKey })}
                disabled={isReadOnly}
                className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface-1 focus:border-primary outline-none text-xs font-semibold cursor-pointer"
              >
                {(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[]).map(k => (
                  <option key={k} value={k}>{DOOR_TYPES_CONFIG[k].name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">Door Area ({isIp ? "sq ft" : "m²"})</label>
              <input
                type="number"
                step="any"
                value={formData.doorArea}
                onChange={e => setFormData({ ...formData, doorArea: e.target.value === "" ? "" : Number(e.target.value) })}
                disabled={isReadOnly}
                className="w-full h-8 px-3 rounded-lg border border-border bg-surface-1 focus:border-primary outline-none text-xs font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">Open Doors Qty</label>
              <input
                type="number"
                value={formData.openDoorsCount}
                onChange={e => setFormData({ ...formData, openDoorsCount: e.target.value === "" ? "" : Number(e.target.value) })}
                disabled={isReadOnly}
                className="w-full h-8 px-3 rounded-lg border border-border bg-surface-1 focus:border-primary outline-none text-xs font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">Closed Doors Qty</label>
              <input
                type="number"
                value={formData.closedDoorsCount}
                onChange={e => setFormData({ ...formData, closedDoorsCount: e.target.value === "" ? "" : Number(e.target.value) })}
                disabled={isReadOnly}
                className="w-full h-8 px-3 rounded-lg border border-border bg-surface-1 focus:border-primary outline-none text-xs font-medium"
              />
            </div>
          </div>

          {/* Breakdown Summary Box */}
          <div className="bg-surface-2/60 rounded-xl p-3 border border-border/80 space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Open Door Flow:</span>
              <span className="font-mono text-foreground">{calc.openFlowM3s} m³/s ({isIp ? calc.openFlowCfm + " CFM" : calc.openFlowLs + " L/s"})</span>
            </div>
            <div className="flex justify-between">
              <span>Closed Door Flow + 25% Safety:</span>
              <span className="font-mono text-foreground">{calc.closedFlowM3s} m³/s</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border font-medium text-foreground">
              <span>Total Sizing Safety (10%):</span>
              <span className="font-mono text-primary">{calc.finalSafetyM3s} m³/s</span>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-accent transition cursor-pointer"
            >
              Cancel
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Save Changes
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
