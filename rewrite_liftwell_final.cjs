const fs = require('fs');
const content = import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Plus, Trash2, FileSpreadsheet, FileText, Check, X, Wrench } from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/liftwell-pressurization")({
  component: LiftwellPressurizationPage,
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

export interface LiftwellItem {
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

function calculateLiftwell(item: LiftwellItem) {
  const activeDoor = DOOR_TYPES_CONFIG[item.doorType] || DOOR_TYPES_CONFIG.lift_landing;
  const doorArea = Number(item.doorArea) || 0;
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

  return {
    openFlowLs: (openFlowM3s * 1000).toFixed(1),
    closedFlowLs: (closedFlowM3s * 1000).toFixed(1),
    totalFanCapacityLs,
    designPressureDropPa,
    reliefAreaM2: reliefAreaM2.toFixed(3)
  };
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

  const handleExportExcel = async () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["LIFTWELL PRESSURIZATION CALCULATION REPORT"],
        ["Standard: BS EN 12101-6 Table A.3 & NFPA 92"],
        [],
        ["Name", "Door Type", "Door Area (m²)", "Open Doors", "Closed Doors", "Required Fan Airflow (L/s)", "Pressure Drop (Pa)", "Relief Area (m²)"]
      ];

      items.forEach(item => {
        const calc = calculateLiftwell(item);
        const doorName = DOOR_TYPES_CONFIG[item.doorType]?.name || "Unknown";
        wsData.push([
          item.name,
          doorName,
          String(item.doorArea),
          String(item.openDoorsCount),
          String(item.closedDoorsCount),
          String(calc.totalFanCapacityLs),
          String(calc.designPressureDropPa),
          String(calc.reliefAreaM2)
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Liftwell Calc");
      const buffer = await wb.xlsx.writeBuffer();
      downloadFile(new Blob([buffer]), "Liftwell_Pressurization_Report.xlsx");
      toast.success("Excel report downloaded!");
    } catch (err) {
      toast.error("Failed to export Excel");
    }
  };

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("LIFTWELL PRESSURIZATION CALCULATION REPORT", 14, 16);
      doc.setFontSize(10);
      doc.text("Project: " + (project?.name || "N/A"), 14, 24);

      const tableData = items.map((item, index) => {
        const calc = calculateLiftwell(item);
        const doorName = DOOR_TYPES_CONFIG[item.doorType]?.name || "Unknown";
        return [
          index + 1,
          item.name,
          doorName,
          item.doorArea,
          item.openDoorsCount,
          item.closedDoorsCount,
          calc.totalFanCapacityLs,
          calc.designPressureDropPa,
          calc.reliefAreaM2
        ];
      });

      autoTable(doc, {
        startY: 32,
        head: [["#", "Liftwell Name", "Door Type", "Door Area (m²)", "Open Doors", "Closed Doors", "Fan Airflow (L/s)", "dP (Pa)", "Relief Area (m²)"]],
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
          <div>
            <h1 className="text-xl font-bold text-slate-900">Liftwell Pressurization</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Horizontal Data Entry (Multiple Liftwells)</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100 transition shadow-sm">
              <FileSpreadsheet className="size-4" /> Export Excel
            </button>
            <button onClick={handleExportPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 rounded hover:bg-rose-100 transition shadow-sm">
              <FileText className="size-4" /> Export PDF
            </button>
            <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/liftwell-pressurization" calculatorTitle="Liftwell Pressurization" />
          </div>
        </div>

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
                    <th className="py-2.5 px-3 whitespace-nowrap">Door Area (m²)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Open Doors</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Closed Doors</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-blue-50 text-blue-700 border-l border-blue-100">Fan Airflow (L/s)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-blue-50 text-blue-700">Pressure Drop (Pa)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-blue-50 text-blue-700">Relief Area (m²)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const calc = calculateLiftwell(item);
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
                          <input 
                            value={item.name} 
                            onChange={(e) => updateItem(item.id, "name", e.target.value)}
                            disabled={isEffectiveReadOnly}
                            className="w-full px-2 py-1.5 rounded border border-border focus:border-blue-500 outline-none bg-white"
                          />
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
                        <td className="p-2 bg-blue-50 border-l border-blue-100 font-semibold text-slate-800">
                          {calc.totalFanCapacityLs}
                        </td>
                        <td className="p-2 bg-blue-50 font-semibold text-slate-800">
                          {calc.designPressureDropPa}
                        </td>
                        <td className="p-2 bg-blue-50 font-semibold text-slate-800">
                          {calc.reliefAreaM2}
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
    </AppShell>
  );
}
\;

fs.writeFileSync('frontend/src/routes/liftwell-pressurization.tsx', content, 'utf8');
