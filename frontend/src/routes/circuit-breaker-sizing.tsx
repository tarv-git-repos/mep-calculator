import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  Plus, Trash2, Download, Upload, Sparkles, Gauge, FileText, Printer, FileSpreadsheet, RotateCcw, Filter, ArrowUpDown, Copy, X, Check, MessageSquare, Search, SlidersHorizontal, Flag
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { STANDARD_BREAKER_RATINGS_A } from "@/core/standards/breakers";
import { CalculationPreviewModal, type CalculationPreviewData, type CalculationStep } from "@/components/calculator-framework/CalculationPreviewModal";

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
  onFocus?: (e: any) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder, onFocus, onDoubleClick }: InlineInputProps) {
  const [localVal, setLocalVal] = useState(String(value));

  // Sync local state when external value changes
  useMemo(() => {
    const strVal = String(value);
    if (localVal !== strVal) {
      const parsedLocal = parseFloat(localVal);
      const parsedValue = parseFloat(strVal);
      // Don't overwrite if user is typing a decimal or a negative sign
      if (localVal.endsWith('.') && parsedLocal === parsedValue) return;
      if (localVal === '' && parsedValue === 0) return;
      if (localVal === '-' && parsedValue === 0) return;
      
      setLocalVal(strVal);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
    onCommit(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type={type}
      step={step}
      min={min}
      value={localVal}
      onChange={handleChange}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        if (onDoubleClick) {
          onDoubleClick(e);
        }
      }}
      className={`bg-transparent w-full border border-transparent hover:border-border/60 focus:border-primary px-1.5 py-0.5 outline-none text-xs transition-colors cursor-text ${className}`}
    />
  );
}

export const Route = createFileRoute("/circuit-breaker-sizing")({
  head: () => ({
    meta: [
      { title: "Circuit Breaker Sizing — MEP Calc" },
      { name: "description", content: "Preliminary circuit breaker capacity rating sizing based on connected loads, voltage, and phase parameters." },
    ],
  }),
  component: CircuitBreakerSizingPage,
});

import { BreakerRow, calculateCircuitBreakers } from "@/lib/calc-circuit-breaker";

function CircuitBreakerSizingPage() {
  const { project, activeProjectId, isReadOnly } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/circuit-breaker-sizing", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/circuit-breaker-sizing", activeProjectId || project?.id);
  const isApprovedLocked = useCalculationLock("/circuit-breaker-sizing", project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();

  
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    setRows(prev => prev.map(r => r.id === commentTargetItem?.id ? {
      ...r,
      comments: [...((r as any).comments || []), comment]
    } : r));
    setCommentModalOpen(false);
    toast.success("Comment saved");
  };

  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");

  const [previewRow, setPreviewRow] = useState<any | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPhase, setFilterPhase] = useState<"all" | "Single Phase" | "Three Phase">("all");
  const [filterMinLoad, setFilterMinLoad] = useState<number | null>(null);
  const [filterMinCurrent, setFilterMinCurrent] = useState<number | null>(null);
  const [filterSelectedOnly, setFilterSelectedOnly] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [sortKey, setSortKey] = useState<"default" | "description" | "connectedLoad" | "voltage" | "designCurrent" | "recBreaker">("default");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unit System State (SI = kW / Metric, IP = HP / Imperial)
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    if (shouldConvert) {
      setRows(prev => prev.map(r => {
        if (r.connectedLoad === "" || r.connectedLoad === undefined) return r;
        const load = Number(r.connectedLoad);
        if (isNaN(load)) return r;
        return {
          ...r,
          connectedLoad: newSystem === "ip" ? Number((load / 0.746).toFixed(2)) : Number((load * 0.746).toFixed(2)),
        };
      }));
      toast.success(`Converted units to ${newSystem.toUpperCase()}`);
    } else {
      toast.success(`Switched unit system to ${newSystem.toUpperCase()}`);
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterPhase !== "all") count++;
    if (filterMinLoad !== null) count++;
    if (filterMinCurrent !== null) count++;
    if (filterSelectedOnly) count++;
    if (filterFlagged) count++;
    return count;
  }, [filterPhase, filterMinLoad, filterMinCurrent, filterSelectedOnly, filterFlagged]);

  const handleResetFilters = () => {
    setFilterPhase("all");
    setFilterMinLoad(null);
    setFilterMinCurrent(null);
    setFilterSelectedOnly(false);
    setFilterFlagged(false);
  };

  // Table rows matching screenshot
  const [rows, setRows] = useState<BreakerRow[]>([
    {
      id: "1",
      selected: true,
      flagged: false,
      description: "New Feeder Load",
      connectedLoad: 10,
      voltage: 400,
      phase: "Select...",
      powerFactor: 0.8,
      demandFactor: 1,
      remarks: ""
    }
  ]);

  // Calculations
  const calculatedData = useMemo(() => {
    if (unitSystem === "ip") {
      // In IP system, connectedLoad is entered in HP. Convert to kW (1 HP = 0.746 kW) for current calculation
      const kwRows: BreakerRow[] = rows.map(r => ({
        ...r,
        connectedLoad: r.connectedLoad === "" ? "" : Number((Number(r.connectedLoad) * 0.746).toFixed(3))
      }));
      const res = calculateCircuitBreakers(kwRows);
      return {
        ...res,
        rowDetails: res.rowDetails.map((rd, i) => ({
          ...rd,
          connectedLoad: rows[i]?.connectedLoad ?? rd.connectedLoad,
        })),
      };
    }
    return calculateCircuitBreakers(rows);
  }, [rows, unitSystem]);

  const activePreviewRow = useMemo(() => {
    if (!previewRow) return null;
    return calculatedData.rowDetails.find(r => r.id === previewRow.id) || previewRow;
  }, [previewRow, calculatedData.rowDetails]);

  const getCalculationPreview = (row: any): CalculationPreviewData => {
    const isIP = unitSystem === "ip";
    const rawLoad = Number(row.connectedLoad) || 0;
    const loadKw = isIP ? Number((rawLoad * 0.746).toFixed(3)) : rawLoad;
    const volt = Number(row.voltage) || 0;
    const pf = Number(row.powerFactor) || 0.8;
    const df = Number(row.demandFactor) || 1.0;
    const isSinglePhase = row.phase === "Single Phase";
    const isThreePhase = row.phase === "Three Phase";
    const designLoadKw = Number(row.designLoad ?? (loadKw * df));
    const designCurrent = Number(row.designCurrent ?? 0);
    const recBreaker = Number(row.recBreaker ?? 0);
    const utilization = recBreaker > 0 ? (designCurrent / recBreaker) * 100 : 0;

    const steps: CalculationStep[] = [];

    // Step 1: Design Load Calculation
    if (isIP) {
      steps.push({
        stepNumber: 1,
        label: "Design Load & Unit Conversion (HP to kW)",
        formula: "P_design (kW) = Connected_Load (HP) × 0.746 × Demand_Factor",
        substitution: `${rawLoad} HP × 0.746 × ${df}`,
        result: designLoadKw.toFixed(2),
        unit: "kW",
        status: "info",
        description: "Horsepower (HP) converted to kW equivalent (1 HP = 0.746 kW) and multiplied by the circuit Demand Factor.",
      });
    } else {
      steps.push({
        stepNumber: 1,
        label: "Design Operating Load (P_design)",
        formula: "P_design = Connected_Load × Demand_Factor",
        substitution: `${rawLoad} kW × ${df}`,
        result: designLoadKw.toFixed(2),
        unit: "kW",
        status: "info",
        description: "Effective continuous operating load calculated after applying the circuit demand factor.",
      });
    }

    // Step 2: Full-Load Operating Current (Ib)
    if (isSinglePhase) {
      steps.push({
        stepNumber: 2,
        label: "Continuous Design Current (Ib) - Single Phase",
        formula: "Ib = (P_design × 1000) / (V × cos φ)",
        substitution: `(${designLoadKw.toFixed(2)} × 1000) / (${volt || 230} × ${pf})`,
        result: designCurrent.toFixed(2),
        unit: "A",
        status: "info",
        description: "Calculated continuous design current for a single-phase (1P) 2-wire AC branch circuit.",
      });
    } else if (isThreePhase) {
      steps.push({
        stepNumber: 2,
        label: "Continuous Design Current (Ib) - Three Phase",
        formula: "Ib = (P_design × 1000) / (√3 × V × cos φ)",
        substitution: `(${designLoadKw.toFixed(2)} × 1000) / (1.732 × ${volt || 400} × ${pf})`,
        result: designCurrent.toFixed(2),
        unit: "A",
        status: "info",
        description: "Calculated balanced continuous design current for a three-phase (3P) 3/4-wire AC branch circuit.",
      });
    } else {
      steps.push({
        stepNumber: 2,
        label: "Continuous Design Current (Ib)",
        formula: "Select Single Phase or Three Phase in circuit row",
        substitution: "Phase not specified",
        result: designCurrent.toFixed(2),
        unit: "A",
        status: "warning",
        description: "Please specify either Single Phase or Three Phase to complete current determination.",
      });
    }

    // Step 3: Recommended Standard Circuit Breaker (In)
    steps.push({
      stepNumber: 3,
      label: "Standard Circuit Breaker Rating (In)",
      formula: "In ≥ Ib (Selected from Standard Ratings Curve)",
      substitution: `Standard rating ≥ ${designCurrent.toFixed(2)} A`,
      result: recBreaker,
      unit: "A",
      status: recBreaker >= designCurrent ? "pass" : "warning",
      description: "Next standard industrial frame rating selected in accordance with IEC 60947-2 / BS EN 60898 / NEC.",
    });

    // Step 4: Circuit Breaker Loading & Utilization
    steps.push({
      stepNumber: 4,
      label: "Breaker Continuous Loading Ratio",
      formula: "Utilization = (Ib / In) × 100%",
      substitution: `(${designCurrent.toFixed(2)} A / ${recBreaker} A) × 100`,
      result: `${utilization.toFixed(1)}%`,
      unit: "%",
      status: utilization <= 80 ? "pass" : utilization <= 100 ? "info" : "warning",
      description: utilization <= 80 
        ? "Within recommended 80% continuous branch circuit breaker loading threshold (NEC Art. 210)."
        : utilization <= 100
        ? "Within 100% rated frame capacity under non-continuous operating conditions."
        : "Overloaded breaker rating; select a larger frame rating.",
    });

    return {
      title: "Circuit Breaker Sizing Calculation Preview",
      itemName: row.description || `Circuit ${row.id}`,
      itemCode: `${row.phase === "Single Phase" ? "1-Phase (1P)" : row.phase === "Three Phase" ? "3-Phase (3P)" : "Phase Unspecified"} • ${row.voltage || 0}V`,
      standardReference: "IEC 60947-2 / IEC 60898 / NEC Art. 210 & 430",
      inputs: [
        { label: "Connected Load", value: rawLoad, unit: isIP ? "HP" : "kW" },
        ...(isIP ? [{ label: "Converted Load", value: `${loadKw.toFixed(2)} kW`, unit: "" }] : []),
        { label: "Operating Voltage", value: volt, unit: "V" },
        { label: "Phase System", value: row.phase || "Unspecified" },
        { label: "Power Factor (cos φ)", value: pf },
        { label: "Demand Factor (DF)", value: df },
      ],
      steps,
      finalResultLabel: "Recommended Breaker Rating",
      finalResultValue: `${recBreaker} A`,
      finalResultUnit: row.phase === "Single Phase" ? "1P / 2P" : "3P / 4P",
      complianceNote: `Standard ${recBreaker} A rated breaker provides continuous thermal & magnetic overcurrent protection for ${designCurrent.toFixed(2)} A design current.`
    };
  };


  // Filtered & Sorted Rows for Display
  const displayedRows = useMemo(() => {
    let list = [...calculatedData.rowDetails];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        r.description.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q) ||
        String(r.voltage).includes(q) ||
        String(r.connectedLoad).includes(q) ||
        String(r.recBreaker).includes(q)
      );
    }

    if (filterPhase !== "all") {
      list = list.filter(r => r.phase === filterPhase);
    }

    if (filterMinLoad !== null) {
      list = list.filter(r => (Number(r.connectedLoad) || 0) >= filterMinLoad);
    }

    if (filterMinCurrent !== null) {
      list = list.filter(r => r.designCurrent >= filterMinCurrent);
    }

    if (filterSelectedOnly) {
      list = list.filter(r => r.selected);
    }

    if (filterFlagged) {
      list = list.filter(r => Boolean(r.flagged));
    }

    if (sortKey !== "default") {
      list.sort((a, b) => {
        let valA: any = a[sortKey];
        let valB: any = b[sortKey];
        if (sortKey === "connectedLoad" || sortKey === "voltage" || sortKey === "designCurrent" || sortKey === "recBreaker") {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else {
          valA = String(valA || "").toLowerCase();
          valB = String(valB || "").toLowerCase();
        }
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [calculatedData.rowDetails, searchQuery, filterPhase, filterMinLoad, filterMinCurrent, filterSelectedOnly, filterFlagged, sortKey, sortDirection]);

  const handleToggleFlag = (targetRowId?: string) => {
    const isSelected = rows.find(r => r.id === targetRowId)?.selected;
    const selectedRows = rows.filter(r => r.selected);
    const targetIds = targetRowId
      ? (isSelected && selectedRows.length > 1 ? selectedRows.map(r => r.id) : [targetRowId])
      : rows.filter(r => r.selected).map(r => r.id);

    if (targetIds.length === 0) return;

    const targetRow = rows.find(r => r.id === targetIds[0]);
    const nextFlagged = !targetRow?.flagged;

    setRows(prev => prev.map(r => targetIds.includes(r.id) ? { ...r, flagged: nextFlagged } : r));
    toast.info(nextFlagged ? `Flagged ${targetIds.length} circuit(s) for review` : `Unflagged ${targetIds.length} circuit(s)`);
  };

  // DataGrid Column Definitions matching standard application design
  const columns: Column<any>[] = useMemo(() => [
    {
      key: "index",
      header: "SR.",
      width: 55,
      align: "center",
      render: (r) => (
        <span 
          onDoubleClick={() => setPreviewRow(r)}
          className="font-mono text-muted-foreground text-xs cursor-pointer select-none hover:text-primary transition-colors"
          title="Double-click to open calculation preview"
        >
          {rows.findIndex(row => row.id === r.id) + 1}
        </span>
      )
    },
    {
      key: "description",
      header: "DESCRIPTION",
      width: 240,
      editable: true,
      render: (r) => {
        const itemComments = getMergedItemComments(r.id, r.description, (r as any).comments, "/circuit-breaker-sizing", project?.id);
        return (
          <div className="flex items-center gap-1.5 w-full">
            {itemComments.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenComment(r.id, r.description);
                }}
                title={`${itemComments.length} comment(s)/task(s) assigned`}
                className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <MessageSquare className="size-3.5 fill-blue-500/20" />
                <span className="text-[10px] font-bold">{itemComments.length}</span>
              </button>
            )}
            <InlineInput 
              value={r.description} 
              onCommit={(val) => handleUpdateRow(r.id, "description", val)}
              onFocus={() => handleRowFocus(r.id)}
              onDoubleClick={() => setPreviewRow(r)}
              placeholder="e.g. Feeder Load"
              className="font-medium text-foreground text-xs min-w-0 flex-1"
            />
          </div>
        );
      }
    },
    {
      key: "connectedLoad",
      header: `CONNECTED LOAD (${unitSystem === "ip" ? "HP" : "kW"})`,
      width: 175,
      align: "right",
      editable: true,
      render: (r) => (
        <InlineInput 
          type="number" 
          step="0.1"
          value={r.connectedLoad} 
          onCommit={(val) => handleUpdateRow(r.id, "connectedLoad", val === "" ? "" : Number(val))}
          onFocus={() => handleRowFocus(r.id)}
          placeholder="10"
          className="text-foreground tabular text-right text-xs min-w-0 flex-1"
        />
      )
    },
    {
      key: "voltage",
      header: "VOLTAGE (V)",
      width: 110,
      align: "right",
      editable: true,
      render: (r) => (
        <InlineInput 
          type="number" 
          value={r.voltage} 
          onCommit={(val) => handleUpdateRow(r.id, "voltage", val === "" ? "" : Number(val))}
          onFocus={() => handleRowFocus(r.id)}
          placeholder="400"
          className="text-foreground tabular text-right text-xs min-w-0 flex-1"
        />
      )
    },
    {
      key: "phase",
      header: "PHASE",
      width: 140,
      align: "center",
      editable: true,
      render: (r) => (
        <select 
          value={r.phase} 
          onChange={(e) => handleUpdateRow(r.id, "phase", e.target.value as any)}
          onFocus={() => handleRowFocus(r.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-full bg-transparent border border-transparent hover:border-border/60 focus:border-primary rounded px-1 text-xs outline-none text-foreground cursor-pointer"
        >
          <option value="Select...">Select...</option>
          <option value="Single Phase">Single Phase (1P)</option>
          <option value="Three Phase">Three Phase (3P)</option>
        </select>
      )
    },
    {
      key: "powerFactor",
      header: "POWER FACTOR",
      width: 125,
      align: "right",
      editable: true,
      render: (r) => (
        <InlineInput 
          type="number" 
          step="0.01"
          value={r.powerFactor} 
          onCommit={(val) => handleUpdateRow(r.id, "powerFactor", val === "" ? "" : Number(val))}
          onFocus={() => handleRowFocus(r.id)}
          placeholder="0.80"
          className="text-foreground tabular text-right text-xs min-w-0 flex-1"
        />
      )
    },
    {
      key: "demandFactor",
      header: "DEMAND FACTOR",
      width: 125,
      align: "right",
      editable: true,
      render: (r) => (
        <InlineInput 
          type="number" 
          step="0.01"
          value={r.demandFactor} 
          onCommit={(val) => handleUpdateRow(r.id, "demandFactor", val === "" ? "" : Number(val))}
          onFocus={() => handleRowFocus(r.id)}
          placeholder="1.00"
          className="text-foreground tabular text-right text-xs min-w-0 flex-1"
        />
      )
    },
    {
      key: "designCurrent",
      header: "DESIGN CURRENT (A)",
      width: 155,
      align: "right",
      mono: true,
      render: (r) => (
        <span 
          onDoubleClick={() => setPreviewRow(r)}
          className="font-mono font-medium text-foreground text-xs tabular-nums cursor-pointer hover:text-primary transition-colors"
          title="Double-click to open calculation preview"
        >
          {r.designCurrent.toFixed(2)} A
        </span>
      )
    },
    {
      key: "recBreaker",
      header: "RECOMMENDED BREAKER (A)",
      width: 195,
      align: "right",
      mono: true,
      render: (r) => (
        <span 
          onDoubleClick={() => setPreviewRow(r)}
          className="font-mono font-bold text-primary text-xs tabular-nums cursor-pointer hover:underline"
          title="Double-click to open calculation preview"
        >
          {r.recBreaker} A
        </span>
      )
    },
    {
      key: "remarks",
      header: "REMARKS",
      width: 180,
      editable: true,
      render: (r) => (
        <InlineInput 
          value={r.remarks} 
          onCommit={(val) => handleUpdateRow(r.id, "remarks", val)}
          onFocus={() => handleRowFocus(r.id)}
          placeholder="Notes..."
          className="text-muted-foreground text-xs min-w-0 flex-1"
        />
      )
    },
    {
      key: "flagged",
      header: "FLAG",
      width: 50,
      align: "center",
      render: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleFlag(r.id);
          }}
          title={r.flagged ? "Flagged for engineering review (click to unflag)" : "Flag circuit for review"}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-center group/flag mx-auto"
        >
          <Flag
            className={`size-3.5 transition-transform ${
              r.flagged
                ? "text-red-500 fill-red-500 scale-110"
                : "text-muted-foreground/30 hover:text-red-500/60 group-hover/flag:scale-110"
            }`}
          />
        </button>
      )
    }
  ], [rows, unitSystem, project?.id]);

  // Handlers
  const handleAddRow = () => {
    const newRow: BreakerRow = {
      id: Date.now().toString(),
      selected: false,
      flagged: false,
      description: `New Feeder Load ${rows.length + 1}`,
      connectedLoad: 10,
      voltage: 400,
      phase: "Three Phase",
      powerFactor: 0.8,
      demandFactor: 1,
      remarks: "",
    };
    setRows(prev => [...prev, newRow]);
    toast.success("New circuit added");
  };

  const handleDuplicateSelected = () => {
    const selectedRows = rows.filter(r => r.selected);
    if (selectedRows.length === 0) return;
    const duplicated = selectedRows.map(r => ({
      ...r,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      description: `${r.description} (Copy)`,
      selected: false,
      flagged: Boolean(r.flagged),
    }));
    setRows(prev => [...prev, ...duplicated]);
    toast.success(`Duplicated ${duplicated.length} circuit(s)`);
  };

  const handleUpdateRow = (id: string, field: keyof BreakerRow, val: any) => {
    setRows(prev => {
      const isSelected = prev.find(r => r.id === id)?.selected;
      return prev.map(r => {
        if (isSelected && r.selected) {
          return { ...r, [field]: val };
        } else if (r.id === id) {
          return { ...r, [field]: val };
        }
        return r;
      });
    });
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRows(prev => prev.map(r => ({ ...r, selected: false })));
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setRows(prev => prev.map(r => ({ ...r, selected: true })));
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setRows(prev => prev.filter(r => !r.selected));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRowFocus = (id: string) => {
    setRows(prev => {
      const isSelected = prev.find(r => r.id === id)?.selected;
      if (!isSelected) {
        return prev.map(r => r.id === id ? { ...r, selected: true } : { ...r, selected: false });
      }
      return prev;
    });
  };

  const handleDeleteSelected = async () => {
    const selectedCount = rows.filter(r => r.selected).length;
    if (selectedCount === 0) return;
    if (await confirm({ title: "Delete Selected", body: `Are you sure you want to delete ${selectedCount} selected circuit(s)?` })) {
      setRows(prev => prev.filter(r => !r.selected));
      toast.success(`Deleted ${selectedCount} circuit(s)`);
    }
  };

  const handleDuplicateRow = (row: BreakerRow) => {
    const newRow: BreakerRow = {
      ...row,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      description: `${row.description} (Copy)`,
      selected: false,
      flagged: Boolean(row.flagged),
    };
    setRows(prev => [...prev, newRow]);
    toast.success("Circuit duplicated");
  };

  const handleDeleteRow = async (id: string) => {
    if (await confirm({ title: "Delete Circuit", body: "Are you sure you want to delete this circuit?" })) {
      setRows(prev => prev.filter(r => r.id !== id));
      toast.info("Circuit deleted");
    }
  };

  const renderRowContextMenu = (row: any) => {
    const isSelected = rows.find(r => r.id === row.id)?.selected;
    const selectedRows = rows.filter(r => r.selected);
    const hasMultipleSelected = isSelected && selectedRows.length > 1;

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => setPreviewRow(row)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-semibold text-primary"
        >
          <Sparkles className="size-3.5 text-primary" />
          <span>Calculation Preview</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 border-t border-border" />

        <ContextMenuItem
          onClick={() => handleOpenComment(row.id, row.description)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5 text-blue-500" />
          <span>Add Comment</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => handleToggleFlag(row.id)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Flag className={`size-3.5 ${row.flagged ? "text-red-500 fill-red-500" : ""}`} />
          <span>{hasMultipleSelected ? (row.flagged ? `Unflag Selected (${selectedRows.length})` : `Flag Selected (${selectedRows.length})`) : (row.flagged ? "Unflag Circuit" : "Flag Circuit")}</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 border-t border-border" />

        <ContextMenuItem
          disabled={isEffectiveReadOnly}
          onClick={() => {
            if (hasMultipleSelected) {
              handleDuplicateSelected();
            } else {
              handleDuplicateRow(row);
            }
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          <Copy className="size-3.5" />
          <span>{hasMultipleSelected ? `Duplicate Selected (${selectedRows.length})` : "Duplicate Circuit"}</span>
        </ContextMenuItem>

        <ContextMenuItem
          disabled={isEffectiveReadOnly}
          onClick={handleAddRow}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus className="size-3.5" />
          <span>New Circuit</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 border-t border-border" />

        <ContextMenuItem
          disabled={isEffectiveReadOnly}
          onClick={() => {
            if (hasMultipleSelected) {
              handleDeleteSelected();
            } else {
              handleDeleteRow(row.id);
            }
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500 font-medium disabled:opacity-50 disabled:pointer-events-none"
        >
          <Trash2 className="size-3.5 text-red-500" />
          <span>{hasMultipleSelected ? `Delete Selected (${selectedRows.length})` : "Delete Circuit"}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const visibleIds = new Set(displayedRows.map(r => r.id));
    setRows(prev => prev.map(r => visibleIds.has(r.id) ? { ...r, selected: checked } : r));
  };

  const handleReset = async () => {
    if (await confirm({ title: "Reset Data", body: "This will clear all circuits. Continue?" })) {
      setRows([]);
      toast.info("All circuits cleared");
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ rows }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `circuit_breaker_sizing_data.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("JSON data exported!");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.rows && Array.isArray(parsed.rows)) {
          setRows(parsed.rows);
          toast.success(`Imported ${parsed.rows.length} circuit(s) successfully!`);
        } else {
          toast.error("Invalid JSON format. Expected { rows: [...] }");
        }
      } catch (err) {
        toast.error("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const excelColumnMapping = {
    description: ["Description", "Circuit Description", "Load Description", "Desc", "Circuit", "Space"],
    connectedLoad: ["Connected Load (kW)", "Connected Load (HP)", "Connected Load", "Load (kW)", "Load (HP)", "kW", "HP", "Load", "Watt"],
    voltage: ["Voltage (V)", "Voltage", "Volts", "V"],
    phase: ["Phase", "Phases", "Phase Type"],
    powerFactor: ["Power Factor", "PF", "P.F."],
    demandFactor: ["Demand Factor", "DF", "D.F."],
    remarks: ["Remarks", "Remark", "Notes", "Comments"],
  };

  const handleImportExcelRows = (imported: any[]) => {
    if (!imported || imported.length === 0) return;
    const newRows: BreakerRow[] = imported.map((r, i) => {
      let phaseVal: "Single Phase" | "Three Phase" = "Three Phase";
      if (r.phase) {
        const pStr = String(r.phase).toLowerCase();
        if (pStr.includes("1") || pStr.includes("single")) phaseVal = "Single Phase";
      } else if (r.voltage && Number(r.voltage) <= 240) {
        phaseVal = "Single Phase";
      }

      return {
        id: `imported-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        description: r.description || `Circuit ${rows.length + i + 1}`,
        connectedLoad: r.connectedLoad !== undefined && r.connectedLoad !== "" ? Number(r.connectedLoad) : 10,
        voltage: r.voltage !== undefined && r.voltage !== "" ? Number(r.voltage) : (phaseVal === "Single Phase" ? 230 : 400),
        phase: phaseVal,
        powerFactor: r.powerFactor !== undefined && r.powerFactor !== "" ? Number(r.powerFactor) : 0.8,
        demandFactor: r.demandFactor !== undefined && r.demandFactor !== "" ? Number(r.demandFactor) : 1.0,
        remarks: r.remarks || "",
        selected: false,
        flagged: false,
      };
    });
    setRows(prev => [...prev, ...newRows]);
    toast.success(`Imported ${newRows.length} circuit(s) successfully!`);
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Breaker Sizing");

      const loadHeader = unitSystem === "ip" ? "Connected Load (HP)" : "Connected Load (kW)";
      sheet.columns = [
        { header: "Sr.", key: "sr", width: 8 },
        { header: "Description", key: "desc", width: 28 },
        { header: loadHeader, key: "load", width: 22 },
        { header: "Voltage (V)", key: "volt", width: 14 },
        { header: "Phase", key: "phase", width: 16 },
        { header: "Power Factor", key: "pf", width: 14 },
        { header: "Demand Factor", key: "df", width: 14 },
        { header: "Design Current (A)", key: "current", width: 18 },
        { header: "Recommended Breaker (A)", key: "breaker", width: 24 },
        { header: "Remarks", key: "remarks", width: 24 },
      ];

      // Insert title row
      sheet.spliceRows(1, 0, ["CIRCUIT BREAKER SIZING REPORT"]);
      sheet.mergeCells("A1:J1");
      const cellA1 = sheet.getCell("A1");
      cellA1.value = "CIRCUIT BREAKER SIZING REPORT";
      cellA1.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFF" } };
      cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "333F48" } };
      cellA1.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 32;

      // Table Header Row styling
      const headerRow = sheet.getRow(2);
      headerRow.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 24;

      calculatedData.rowDetails.forEach((r, idx) => {
        sheet.addRow({
          sr: idx + 1,
          desc: r.description,
          load: r.connectedLoad !== "" ? Number(r.connectedLoad) : 0,
          volt: r.voltage !== "" ? Number(r.voltage) : 0,
          phase: r.phase,
          pf: r.powerFactor !== "" ? Number(r.powerFactor) : 0.8,
          df: r.demandFactor !== "" ? Number(r.demandFactor) : 1,
          current: Number(r.designCurrent.toFixed(2)),
          breaker: `${r.recBreaker} A`,
          remarks: r.remarks,
        });
      });

      sheet.addRow([]);
      const summaryTitle = sheet.addRow(["Results Summary"]);
      summaryTitle.font = { name: "Calibri", size: 12, bold: true };
      sheet.addRow([
        unitSystem === "ip" ? "Total Connected Load (HP)" : "Total Connected Load (kW)",
        unitSystem === "ip"
          ? `${(calculatedData.totalConnectedKw / 0.746).toFixed(1)} HP (${calculatedData.totalConnectedKw.toFixed(1)} kW)`
          : `${calculatedData.totalConnectedKw.toFixed(1)} kW`
      ]);
      sheet.addRow([
        unitSystem === "ip" ? "Total Design Load (HP)" : "Total Design Load (kW)",
        unitSystem === "ip"
          ? `${(calculatedData.totalDesignLoadKw / 0.746).toFixed(1)} HP (${calculatedData.totalDesignLoadKw.toFixed(1)} kW)`
          : `${calculatedData.totalDesignLoadKw.toFixed(1)} kW`
      ]);
      sheet.addRow(["Maximum Design Current (A)", `${calculatedData.maxDesignCurrentA.toFixed(2)} A`]);

      const sigRow = sheet.rowCount ? sheet.rowCount + 2 : 20;
      addExcelSignatureBlock(sheet, sigRow, currentUserName, project?.id || "default", "circuit-breaker-sizing");
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `circuit_breaker_sizing_report.xlsx`);
      toast.success("Excel report exported successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export Excel report.");
    }
  };

  const handlePrintPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("CIRCUIT BREAKER SIZING REPORT", 40, 50);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 68);

    doc.setDrawColor(200);
    doc.line(40, 75, 780, 75);

    // Load Schedule
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("1. Circuit Breaker Sizing Schedule", 40, 95);

    const loadHead = [[
      "Description",
      unitSystem === "ip" ? "Load (HP)" : "Load (kW)",
      "Volts",
      "Phase",
      "PF",
      "DF",
      "Current (A)",
      "Breaker Rating (A)",
      "Remarks"
    ]];
    const loadBody = calculatedData.rowDetails.map(r => [
      r.description,
      r.connectedLoad !== "" ? `${r.connectedLoad} ${unitSystem === "ip" ? "HP" : "kW"}` : "-",
      r.voltage,
      r.phase,
      r.powerFactor,
      r.demandFactor,
      r.designCurrent.toFixed(2),
      `${r.recBreaker} A`,
      r.remarks
    ]);

    autoTable(doc, {
      startY: 105,
      head: loadHead,
      body: loadBody,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [51, 63, 72] },
    });

    // Summary calculations
    doc.setFont("helvetica", "bold");
    doc.text("2. Summary", 40, (doc as any).lastAutoTable.finalY + 25);

    const summaryData = [
      [
        "Total Connected Load",
        unitSystem === "ip"
          ? `${(calculatedData.totalConnectedKw / 0.746).toFixed(1)} HP (${calculatedData.totalConnectedKw.toFixed(1)} kW)`
          : `${calculatedData.totalConnectedKw.toFixed(1)} kW`
      ],
      [
        "Total Design Load",
        unitSystem === "ip"
          ? `${(calculatedData.totalDesignLoadKw / 0.746).toFixed(1)} HP (${calculatedData.totalDesignLoadKw.toFixed(1)} kW)`
          : `${calculatedData.totalDesignLoadKw.toFixed(1)} kW`
      ],
      ["Peak Design Current", `${calculatedData.maxDesignCurrentA.toFixed(2)} A`],
    ];

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 35,
      head: [],
      body: summaryData,
      theme: "striped",
      styles: { fontSize: 9.5, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 220 },
        1: { cellWidth: 280 },
      },
    });

    
    const sigFinalY = (doc as any).lastAutoTable?.finalY || 40;
    addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "circuit-breaker-sizing");
    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `circuit_breaker_sizing_report.pdf`, "PDF Document", ["pdf"]);
    toast.success("PDF report exported successfully!");
  };

  return (
    <AppShell
      title="Circuit Breaker Sizing"
      subtitle="Preliminary circuit breaker capacity rating sizing based on connected loads, voltage, and phase parameters"
      actions={<UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} disabled={isEffectiveReadOnly} />}
    >
      {/* Main Card Container with 3-State Status Highlight */}
      <div className={`flex-1 flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ${
          calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        } h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30`}>
          <div className="relative z-10 flex flex-col h-full w-full">
            {/* Sections Navigation (Tabs) */}
            <div className="px-4 py-2 border-b border-border/60 bg-surface-1/50 shrink-0 select-none flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-full gap-1 border border-border/60 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("calculator")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      activeTab === "calculator"
                        ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Breaker Sizing
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("report")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      activeTab === "report"
                        ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sizing &amp; Report
                  </button>
                </div>
              </div>
            </div>

            {activeTab === "calculator" ? (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Filter & Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2 min-h-[44px] h-auto border-b border-border bg-background shrink-0 select-none gap-2 overflow-visible relative">
                  {/* Left Side: Filter circuits input, Filter popover, Sort popover */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter circuits..."
                        className="h-7 w-full sm:w-56 pl-8 pr-3 bg-surface-2 text-foreground border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition-all placeholder:text-muted-foreground"
                      />
                    </div>

                    {/* Filter Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                            activeFiltersCount > 0
                              ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                              : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                          }`}
                          title="Filter Circuits"
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
                      <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-border">
                          <span className="text-[12px] font-semibold text-foreground">Filter Circuits</span>
                          {activeFiltersCount > 0 && (
                            <button
                              onClick={handleResetFilters}
                              className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        {/* Phase filter */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Phase</span>
                          <select
                            value={filterPhase}
                            onChange={(e) => setFilterPhase(e.target.value as any)}
                            className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-[12px] outline-none cursor-pointer text-foreground"
                          >
                            <option value="all">All Phases</option>
                            <option value="Single Phase">Single Phase (1P)</option>
                            <option value="Three Phase">Three Phase (3P)</option>
                          </select>
                        </div>

                        {/* Min Connected Load filter */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Min Load ({unitSystem === "ip" ? "HP" : "kW"})</span>
                          <input
                            type="number"
                            placeholder="e.g. 5"
                            value={filterMinLoad ?? ""}
                            onChange={(e) => setFilterMinLoad(e.target.value ? Number(e.target.value) : null)}
                            className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none text-foreground"
                          />
                        </div>

                        {/* Min Current filter */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Min Current (A)</span>
                          <input
                            type="number"
                            placeholder="e.g. 16"
                            value={filterMinCurrent ?? ""}
                            onChange={(e) => setFilterMinCurrent(e.target.value ? Number(e.target.value) : null)}
                            className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none text-foreground"
                          />
                        </div>

                        {/* Flagged Only */}
                        <label className="flex items-center justify-between pt-1 border-t border-border/60 text-[11.5px] font-medium text-foreground cursor-pointer select-none">
                          <span className="flex items-center gap-1.5">
                            <Flag className="size-3 text-red-500 fill-red-500" />
                            <span>Flagged circuits only</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={filterFlagged}
                            onChange={(e) => setFilterFlagged(e.target.checked)}
                            className="rounded border-gray-300 text-primary size-3.5 focus:ring-primary cursor-pointer"
                          />
                        </label>

                        {/* Selected Only */}
                        <label className="flex items-center justify-between pt-1 border-t border-border/60 text-[11.5px] font-medium text-foreground cursor-pointer select-none">
                          <span>Selected circuits only</span>
                          <input
                            type="checkbox"
                            checked={filterSelectedOnly}
                            onChange={(e) => setFilterSelectedOnly(e.target.checked)}
                            className="rounded border-gray-300 text-primary size-3.5 focus:ring-primary cursor-pointer"
                          />
                        </label>
                      </PopoverContent>
                    </Popover>

                    {/* View / Sort Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                            sortKey !== "default"
                              ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                              : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                          }`}
                          title="View / Sort"
                        >
                          <SlidersHorizontal className="size-3.5 shrink-0" />
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                            View / Sort
                          </span>
                          {sortKey !== "default" && (
                            <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                              ✓
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-border">
                          <span className="text-[12px] font-semibold text-foreground">Sort Circuits</span>
                          {sortKey !== "default" && (
                            <button
                              onClick={() => { setSortKey("default"); setSortDirection("asc"); }}
                              className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort Field</span>
                          <select
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value as any)}
                            className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-[12px] outline-none cursor-pointer text-foreground"
                          >
                            <option value="default">Default (Sr. No.)</option>
                            <option value="description">Description</option>
                            <option value="connectedLoad">Connected Load ({unitSystem === "ip" ? "HP" : "kW"})</option>
                            <option value="voltage">Voltage (V)</option>
                            <option value="designCurrent">Design Current (A)</option>
                            <option value="recBreaker">Breaker Rating (A)</option>
                          </select>
                        </div>

                        {sortKey !== "default" && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Direction</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSortDirection("asc")}
                                className={`flex-1 py-1 px-2 rounded text-[11.5px] border cursor-pointer ${sortDirection === "asc" ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-slate-100 dark:bg-slate-900 text-foreground border-border"}`}
                              >
                                Ascending
                              </button>
                              <button
                                type="button"
                                onClick={() => setSortDirection("desc")}
                                className={`flex-1 py-1 px-2 rounded text-[11.5px] border cursor-pointer ${sortDirection === "desc" ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-slate-100 dark:bg-slate-900 text-foreground border-border"}`}
                              >
                                Descending
                              </button>
                            </div>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Right Side: Import Excel, Export PDF, New Row */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                    <ImportExcelBtn
                      columnMapping={excelColumnMapping}
                      onImport={handleImportExcelRows}
                    />

                    <button
                      onClick={handlePrintPDF}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                    >
                      <FileText className="size-3.5" /> Export PDF
                    </button>

                    <button
                      onClick={handleAddRow}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all cursor-pointer"
                    >
                      <Plus className="size-3.5" /> New Row
                    </button>
                  </div>

                  {/* Bulk Actions Overlay Bar */}
                  {!isEffectiveReadOnly && rows.some(r => r.selected) && (
                    <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] rounded-none z-20 no-print">
                      <span className="font-semibold">{rows.filter(r => r.selected).length} selected</span>
                      <span className="text-primary/30">·</span>
                      <BulkBtn icon={Copy} onClick={handleDuplicateSelected}>
                        Duplicate
                      </BulkBtn>
                      <BulkBtn icon={Flag} onClick={() => handleToggleFlag()}>
                        Flag / Unflag
                      </BulkBtn>
                      <BulkBtn icon={Trash2} onClick={handleDeleteSelected}>
                        Delete
                      </BulkBtn>
                      <BulkBtn icon={RotateCcw} onClick={handleReset}>
                        Reset All
                      </BulkBtn>
                      <button
                        onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: false })))}
                        className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                      >
                        <X className="size-3" /> Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Data Grid Area */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  {displayedRows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground text-xs gap-2">
                      <Filter className="size-6 text-muted-foreground/40 mb-1" />
                      <span className="font-semibold text-foreground">
                        {rows.length === 0
                          ? 'No circuits added. Click "+ New Row" to begin sizing.'
                          : filterFlagged
                          ? "No flagged circuits found for review."
                          : "No matching circuits found for current filter."}
                      </span>
                      {rows.length > 0 && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            handleResetFilters();
                          }}
                          className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                        >
                          Clear search & filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <DataGrid
                      rows={displayedRows}
                      columns={columns}
                      selected={new Set(rows.filter(r => r.selected).map(r => r.id))}
                      onToggle={(id) => {
                        const row = rows.find(r => r.id === id);
                        if (row) handleUpdateRow(id, "selected", !row.selected);
                      }}
                      onToggleAll={() => {
                        const allSelected = rows.length > 0 && displayedRows.every(r => r.selected);
                        const visibleIds = new Set(displayedRows.map(r => r.id));
                        setRows(prev => prev.map(r => visibleIds.has(r.id) ? { ...r, selected: !allSelected } : r));
                      }}
                      onRowDoubleClick={(row) => setPreviewRow(row)}
                      rowClassName={(r) => r.flagged ? "bg-red-500/[0.04] dark:bg-red-500/[0.08]" : ""}
                      gridId="circuit-breaker-sizing"
                      isReadOnly={isEffectiveReadOnly}
                      renderContextMenu={renderRowContextMenu}
                    />
                  )}
                </div>
              </div>
      ) : (
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto py-2">
            <div className="flex items-center justify-end gap-3 no-print border-b border-border/80 pb-4">
              <button
                onClick={handlePrintPDF}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
              >
                <FileText className="size-3.5" /> Export PDF
              </button>
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm">
              <div className="border-b-2 border-slate-800 dark:border-slate-700 pb-5 mb-6 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">CIRCUIT BREAKER SIZING REPORT</h1>
                  <p className="text-[12px] text-slate-500 font-mono mt-1">Preliminary electrical branch circuit sizing analysis</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block mt-0.5">Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              {/* Sizing & Report KPI Summary Cards */}
              <div className={`grid grid-cols-1 ${rows.some(r => r.flagged) ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4 mb-6`}>
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-2xs relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-slate-500/10"><FileText className="size-8" /></div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Total Connected Load</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">
                    {unitSystem === "ip" ? (calculatedData.totalConnectedKw / 0.746).toFixed(1) : calculatedData.totalConnectedKw.toFixed(1)}{" "}
                    <span className="text-sm text-slate-500 font-sans">{unitSystem === "ip" ? "HP" : "kW"}</span>
                  </strong>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-2xs relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-slate-500/10"><Gauge className="size-8" /></div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Total Design Load</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">
                    {unitSystem === "ip" ? (calculatedData.totalDesignLoadKw / 0.746).toFixed(1) : calculatedData.totalDesignLoadKw.toFixed(1)}{" "}
                    <span className="text-sm text-slate-500 font-sans">{unitSystem === "ip" ? "HP" : "kW"}</span>
                  </strong>
                </div>

                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-4 shadow-2xs relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-blue-500/20"><Sparkles className="size-8" /></div>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">Peak Design Current</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.maxDesignCurrentA.toFixed(2)} <span className="text-sm text-slate-500 font-sans">A</span></strong>
                </div>

                {rows.some(r => r.flagged) && (
                  <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4 shadow-2xs relative overflow-hidden">
                    <div className="absolute right-3 top-3 text-red-500/20"><Flag className="size-8" /></div>
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest block mb-1">Flagged For Review</span>
                    <strong className="text-2xl font-black text-red-600 dark:text-red-400 block font-mono">
                      {rows.filter(r => r.flagged).length} <span className="text-sm font-sans font-normal text-slate-500">circuit(s)</span>
                    </strong>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1 mb-3">1. Connected Electrical Load & Current Sizing Schedule</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border border-collapse border-slate-200 dark:border-slate-700">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[9px]">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">Sr.</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">Description</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Connected ({unitSystem === "ip" ? "HP" : "kW"})</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">Volts</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">Phase</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">PF</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">DF</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Current (A)</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Breaker Rating</th>
                        <th className="p-2 text-center w-12">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono">
                      {calculatedData.rowDetails.map((r, idx) => (
                        <tr 
                          key={r.id}
                          onDoubleClick={() => setPreviewRow(r)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                          title="Double-click to view calculation preview"
                        >
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-sans">{r.description}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">{r.connectedLoad !== "" ? Number(r.connectedLoad).toFixed(1) : "-"} {unitSystem === "ip" ? "HP" : "kW"}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{r.voltage !== "" ? r.voltage : "-"} V</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{r.phase === 'Three Phase' ? '3P' : r.phase === 'Single Phase' ? '1P' : '-'}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{r.powerFactor !== "" ? r.powerFactor : "-"}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{r.demandFactor !== "" ? r.demandFactor : "-"}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right font-bold">{r.designCurrent.toFixed(2)} A</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right font-bold">{r.recBreaker} A</td>
                          <td className="p-2 text-center">
                            {r.flagged ? (
                              <span title="Flagged circuit for review" className="inline-flex items-center justify-center">
                                <Flag className="size-3 text-red-500 fill-red-500" />
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30 text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 pb-6 border-b border-border/80">
                <div>
                  <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">2. Sizing Summary Calculations</h3>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 text-xs flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Connected load:</span>
                      <strong className="font-mono">{unitSystem === "ip" ? (calculatedData.totalConnectedKw / 0.746).toFixed(1) : calculatedData.totalConnectedKw.toFixed(1)} {unitSystem === "ip" ? "HP" : "kW"}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Design load:</span>
                      <strong className="font-mono">{unitSystem === "ip" ? (calculatedData.totalDesignLoadKw / 0.746).toFixed(1) : calculatedData.totalDesignLoadKw.toFixed(1)} {unitSystem === "ip" ? "HP" : "kW"}</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 mt-1 font-semibold text-primary">
                      <span>Peak Design Current:</span>
                      <strong className="font-mono text-sm">{calculatedData.maxDesignCurrentA.toFixed(2)} A</strong>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">3. Applicable Sizing Formulae</h3>
                  <div className="grid grid-cols-1 gap-3 text-[11px] font-mono bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div>
                      <p className="font-semibold font-sans text-slate-700 dark:text-slate-300">Design load ({unitSystem === "ip" ? "HP" : "kW"}):</p>
                      <span className="text-blue-600 dark:text-blue-400">Design Load = Connected Load * Demand Factor</span>
                    </div>
                    <div>
                      <p className="font-semibold font-sans text-slate-700 dark:text-slate-300">Single Phase Current (A):</p>
                      <span className="text-blue-600 dark:text-blue-400">Current = (Design Load * 1000) / (Voltage * PF)</span>
                    </div>
                    <div>
                      <p className="font-semibold font-sans text-slate-700 dark:text-slate-300">Three Phase Current (A):</p>
                      <span className="text-blue-600 dark:text-blue-400">Current = (Design Load * 1000) / (sqrt(3) * Voltage * PF)</span>
                    </div>
                    <div>
                      <p className="font-semibold font-sans text-slate-700 dark:text-slate-300">Standard Selection:</p>
                      <span className="text-blue-600 dark:text-blue-400">Breaker Rating = Next higher standard rating &gt;= Current</span>
                    </div>
                  </div>
                </div>
              </div>

              </div>
            </div>
          </div>
        )}

          </div>
        </div>
    
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
          targetType="breaker"
          calculatorTitle="Circuit Breaker Sizing"
          calculatorPath="/circuit-breaker-sizing"
          existingComments={getMergedItemComments(commentTargetItem.id, commentTargetItem.name, (rows.find(r => r.id === commentTargetItem.id) as any)?.comments, "/circuit-breaker-sizing", project?.id)}
          onSave={handleSaveComment}
        />
      )}

      {/* Calculation Preview Modal */}
      <CalculationPreviewModal
        isOpen={Boolean(previewRow)}
        onClose={() => setPreviewRow(null)}
        data={activePreviewRow ? getCalculationPreview(activePreviewRow) : null}
      />
    </AppShell>
  );
}
