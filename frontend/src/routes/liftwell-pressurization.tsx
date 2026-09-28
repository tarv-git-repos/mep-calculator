import { calculateLiftwell, DOOR_TYPES_CONFIG, CALCULATION_CONSTANTS, type LiftwellItem, type DoorTypeKey, type DoorTypeDefinition } from "@/lib/calc-liftwell";
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
import { Plus, Trash2, MessageSquare, FileSpreadsheet, FileText, Check, X, Wrench } from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";

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
  const [calcReviewState] = useState<CalculationReviewState | null>(null);
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole || calcReviewState?.status === "APPROVED");

  const [items, setItems] = useState<LiftwellItem[]>([
    { id: generateId(), name: "LIFTWELL-01", doorType: "lift_landing", doorArea: 2.76, openDoorsCount: 1, closedDoorsCount: 17 }
  ]);
  
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

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

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("LIFTWELL PRESSURIZATION CALCULATION REPORT", 14, 16);
      doc.setFontSize(10);
      doc.text("Project: " + (project?.name || "N/A"), 14, 24);

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

      autoTable(doc, {
        startY: 32,
        head: [["#", "Liftwell Name", "Door Type", `Door Area (${isIp ? "sq ft" : "m²"})`, "Open Doors", "Closed Doors", `Fan Airflow (${isIp ? "CFM" : "L/s"})`, `dP (${isIp ? "in. wg" : "Pa"})`, `Relief Area (${isIp ? "sq ft" : "m²"})`]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8, halign: "center", valign: "middle" }
      });

      doc.save("Liftwell_Pressurization_Report.pdf");
      toast.success("PDF report downloaded!");
    } catch(err) {
      toast.error("Failed to generate PDF");
    }
  };

  const isIp = unitSystem === "ip";

  return (
    <AppShell title="Liftwell Pressurization" hideSubHeader={true}>
      <div className="flex flex-col h-full bg-slate-50 select-none">
        
        {/* Bulk actions overlay */}
        {!isEffectiveReadOnly && selectedItems.size > 0 && (
          <div className="absolute top-14 left-0 right-0 h-10 flex items-center gap-2 px-4 bg-[#eef6fc] text-[12px] text-[#06456F] z-20 shadow-sm">
            <span className="font-semibold">{selectedItems.size} selected</span>
            <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#06456F]/20 rounded hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shadow-sm ml-2">
              <Trash2 className="size-3.5" /> Delete Selected
            </button>
            <button onClick={() => setSelectedItems(new Set())} className="ml-auto text-[#06456F]/70 hover:text-[#06456F] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors px-2 py-0.5 rounded">
              <X className="size-3" /> Clear Selection
            </button>
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-white border-b border-border shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Liftwell Pressurization</h1>
            </div>
            <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/liftwell-pressurization" calculatorTitle="Liftwell Pressurization" />
          </div>
          <div className="flex items-center gap-2">
            <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
            <button onClick={handleExportPdf} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full bg-[#0A7BC7] text-white hover:bg-[#0866A5] transition shadow-xs cursor-pointer">
              <FileText className="size-3.5" /> Export PDF
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden pb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 border-b border-border">
                  <tr className="text-muted-foreground font-semibold uppercase">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input 
                        type="checkbox" 
                        checked={items.length > 0 && selectedItems.size === items.length}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Liftwell Name</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Door Type</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Door Area ({isIp ? "sq ft" : "m²"})</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Open Doors</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Closed Doors</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-blue-50 text-blue-700 border-l border-blue-100">Fan Airflow ({isIp ? "CFM" : "L/s"})</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-blue-50 text-blue-700">Pressure Drop ({isIp ? "in. w.g." : "Pa"})</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-blue-50 text-blue-700">Relief Area ({isIp ? "sq ft" : "m²"})</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const calc = calculateLiftwell(item, isIp);
                    const isSelected = selectedItems.has(item.id);
                    const trClass = "border-b border-border hover:bg-slate-50 transition " + (isSelected ? "bg-blue-50/50" : "");
                    return (
                      <tr key={item.id} className={trClass}>
                        <td className="p-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5 w-full">
                            {(() => {
                              const itemComments = getMergedItemComments(item.id, item.name, (item as any).comments, "/liftwell-pressurization", project?.id);
                              return itemComments.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenComment(item.id, item.name);
                                  }}
                                  title={`${itemComments.length} comment(s)/task(s) assigned`}
                                  className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
                                >
                                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                                  <span className="text-[10px] font-bold">{itemComments.length}</span>
                                </button>
                              ) : null;
                            })()}
                            <input 
                              value={item.name} 
                              onChange={(e) => updateItem(item.id, "name", e.target.value)}
                              disabled={isEffectiveReadOnly}
                              className="w-full px-2 py-1.5 rounded border border-border focus:border-blue-500 outline-none bg-white"
                            />
                          </div>
                        </td>
                        <td className="p-2">
                          <select 
                            value={item.doorType} 
                            onChange={(e) => updateItem(item.id, "doorType", e.target.value as DoorTypeKey)}
                            disabled={isEffectiveReadOnly}
                            className="w-full px-2 py-1.5 rounded border border-border focus:border-blue-500 outline-none bg-white"
                          >
                            {(Object.keys(DOOR_TYPES_CONFIG) as DoorTypeKey[]).map(k => (
                              <option key={k} value={k}>{DOOR_TYPES_CONFIG[k].name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            value={item.doorArea} 
                            onChange={(e) => updateItem(item.id, "doorArea", e.target.value)}
                            disabled={isEffectiveReadOnly}
                            className="w-24 px-2 py-1.5 rounded border border-border focus:border-blue-500 outline-none bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            value={item.openDoorsCount} 
                            onChange={(e) => updateItem(item.id, "openDoorsCount", e.target.value)}
                            disabled={isEffectiveReadOnly}
                            className="w-20 px-2 py-1.5 rounded border border-border focus:border-blue-500 outline-none bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            value={item.closedDoorsCount} 
                            onChange={(e) => updateItem(item.id, "closedDoorsCount", e.target.value)}
                            disabled={isEffectiveReadOnly}
                            className="w-20 px-2 py-1.5 rounded border border-border focus:border-blue-500 outline-none bg-white"
                          />
                        </td>
                        <td 
                          className="p-2 bg-blue-50 border-l border-blue-100 font-semibold text-slate-800 cursor-help hover:bg-blue-100/50 transition-colors"
                          onDoubleClick={() => setShowFormulaModal(true)}
                          title="Double-click to view calculation formulas"
                        >
                          {isIp ? calc.totalFanCapacityCfm : calc.totalFanCapacityLs}
                        </td>
                        <td 
                          className="p-2 bg-blue-50 font-semibold text-slate-800 cursor-help hover:bg-blue-100/50 transition-colors"
                          onDoubleClick={() => setShowFormulaModal(true)}
                          title="Double-click to view calculation formulas"
                        >
                          {isIp ? calc.designPressureDropInWg : calc.designPressureDropPa}
                        </td>
                        <td 
                          className="p-2 bg-blue-50 font-semibold text-slate-800 cursor-help hover:bg-blue-100/50 transition-colors"
                          onDoubleClick={() => setShowFormulaModal(true)}
                          title="Double-click to view calculation formulas"
                        >
                          {isIp ? calc.reliefAreaSqFt : calc.reliefAreaM2}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="p-3 bg-slate-50 border-t border-border flex justify-start">
              <button 
                onClick={addItem}
                disabled={isEffectiveReadOnly}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition shadow-sm disabled:opacity-50"
              >
                <Plus className="size-4" /> Add Liftwell
              </button>
            </div>
            </div>
          </div>
        </div>

        {/* Calculation Preview Sidebar */}
        <div 
          className={`shrink-0 bg-white border-l border-border transition-all duration-300 ease-in-out flex flex-col ${
            selectedItems.size === 1 ? "w-[360px] opacity-100" : "w-0 opacity-0 overflow-hidden"
          }`}
        >
          {(() => {
            if (selectedItems.size !== 1) return null;
            const item = items.find(i => selectedItems.has(i.id));
            if (!item) return null;
            const calc = calculateLiftwell(item, isIp);
            
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
                        <div className="flex justify-between"><span>Open Door Flow (Q_open):</span><span className="font-mono">{calc.openFlowM3s} m³/s</span></div>
                        <div className="flex justify-between"><span>Closed Door Flow (Base):</span><span className="font-mono">{calc.closedFlowM3s} m³/s</span></div>
                        <div className="flex justify-between text-slate-400"><span>Closed Safety (25%):</span><span className="font-mono">{calc.closedSafetyFlowM3s} m³/s</span></div>
                        <div className="flex justify-between pt-1 border-t border-border border-dashed font-medium text-slate-800">
                          <span>Subtotal Flow:</span><span className="font-mono">{calc.subTotalM3s} m³/s</span>
                        </div>
                        <div className="flex justify-between text-slate-400"><span>Final Safety (10%):</span><span className="font-mono">{calc.finalSafetyM3s} m³/s</span></div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <h4 className="font-bold text-blue-800 mb-2 border-b border-blue-200 pb-1 uppercase text-[10px]">2. Required Fan Capacity</h4>
                      <div className="space-y-1.5 text-blue-900">
                        <div className="flex justify-between text-[14px] font-bold">
                          <span>Total Flow:</span><span className="font-mono">{isIp ? `${calc.totalFanCapacityCfm} CFM` : `${calc.totalFanCapacityLs} L/s`}</span>
                        </div>
                        <div className="flex justify-between text-[11px] opacity-80">
                          <span>In m³/s:</span><span className="font-mono">{calc.totalFanCapacityM3s} m³/s</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-border">
                      <h4 className="font-bold text-slate-700 mb-2 border-b border-border pb-1 uppercase text-[10px]">3. Pressure & Relief</h4>
                      <div className="space-y-1.5 text-slate-600">
                        <div className="flex justify-between"><span>Duct Friction Loss:</span><span className="font-mono">{calc.ductLoss} Pa</span></div>
                        <div className="flex justify-between"><span>Combined System Drop:</span><span className="font-mono">{calc.combinedDrop} Pa</span></div>
                        <div className="flex justify-between text-slate-400"><span>Safety Drop (25%):</span><span className="font-mono">{calc.safetyDrop} Pa</span></div>
                        
                        <div className="flex justify-between pt-2 mt-2 border-t border-border font-bold text-slate-800">
                          <span>Design Pressure Drop:</span><span className="font-mono">{isIp ? `${calc.designPressureDropInWg} in. w.g.` : `${calc.designPressureDropPa} Pa`}</span>
                        </div>
                        <div className="flex justify-between pt-1 font-bold text-slate-800">
                          <span>Relief Area:</span><span className="font-mono">{isIp ? `${calc.reliefAreaSqFt} sq ft` : `${calc.reliefAreaM2} m²`}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      
        {/* Formula Modal */}
        {showFormulaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 font-sans">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-base font-bold text-foreground">Liftwell Pressurization Formulas</h2>
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                  <span className="font-bold text-foreground">1. Open Door Air Flow</span>
                  <code className="font-mono text-[#0A7BC7] text-[11px]">
                    Q_open = Door Area × Velocity (1.0 m/s) × Number of Open Doors
                  </code>
                </div>

                <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                  <span className="font-bold text-foreground">2. Closed Door Air Flow (with 25% Safety)</span>
                  <code className="font-mono text-[#0A7BC7] text-[11px]">
                    Q_closed = Leakage Rate × Number of Closed Doors × 1.25
                  </code>
                </div>

                <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                  <span className="font-bold text-foreground">3. Total Fan Capacity (with 10% Safety)</span>
                  <code className="font-mono text-[#0A7BC7] text-[11px]">
                    Q_total = (Q_open + Q_closed) × 1.10
                  </code>
                </div>

                <div className="p-3 rounded-xl bg-muted/60 flex flex-col gap-1.5">
                  <span className="font-bold text-foreground">4. Pressure Relief Louver Area</span>
                  <code className="font-mono text-[#0A7BC7] text-[11px]">
                    A_relief = Q_fan / (0.827 × √P)
                  </code>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-[#0A7BC7] text-white font-semibold text-xs cursor-pointer hover:bg-[#0866A5] transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Comment Assignment Modal */}
        {commentTargetItem && (
          <AssignCommentModal
            isOpen={commentModalOpen}
            onClose={() => {
              setCommentModalOpen(false);
              setCommentTargetItem(null);
            }}
            targetId={commentTargetItem.id}
            targetName={commentTargetItem.name}
            targetType="equipment"
            calculatorTitle="Liftwell Pressurization"
            calculatorPath="/liftwell-pressurization"
            existingComments={getMergedItemComments(commentTargetItem.id, commentTargetItem.name, (items.find(i => i.id === commentTargetItem.id) as any)?.comments, "/liftwell-pressurization", project?.id)}
            onSave={handleSaveComment}
          />
        )}
      </div>
    </AppShell>
  );
}
