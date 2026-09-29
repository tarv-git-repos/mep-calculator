import { CABLE_DATABASE, calculateConductorRows } from "@/lib/calc-conductor";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { CalculationPreviewModal, type CalculationPreviewData } from "@/components/calculator-framework/CalculationPreviewModal";
import { addPdfSignatureBlock, addPdfHeader, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { DataGrid } from "@/components/workspace/DataGrid";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent } from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import {
  Copy,
  Plus,
  Printer,
  Download,
  Upload,
  FileDown,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Trash2,
  Filter,
  ArrowUpDown,
  Flag,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = (saveAsPkg as any).saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export const Route = createFileRoute("/conductor-sizing")({
  head: () => ({
    meta: [
      { title: "Conductor Sizing — MEP Calc" },
      { name: "description", content: "Electrical conductor (cable) sizing calculations" },
    ],
  }),
  component: ConductorSizingPage,
});



interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  onFocus?: (e: any) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, onFocus, onDoubleClick }: InlineInputProps) {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => {
    const strVal = String(value);
    if (localVal !== strVal) {
      const parsedLocal = parseFloat(localVal);
      const parsedValue = parseFloat(strVal);
      if (localVal.endsWith('.') && parsedLocal === parsedValue) return;
      if (localVal === '' && parsedValue === 0) return;
      if (localVal === '-' && parsedValue === 0) return;
      setLocalVal(strVal);
    }
  }, [value, localVal]);

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
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        if (onDoubleClick) {
          onDoubleClick(e);
        }
      }}
      className={`bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text ${className}`}
    />
  );
}

function ConductorSizingPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/conductor-sizing", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/conductor-sizing", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const projectName = project?.name || "MEP Project";
  const projectId = project?.id || "default";

  const [tab, setTab] = useState<"schedule" | "report">("schedule");
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    if (shouldConvert) {
      setRows(prev => prev.map(r => ({
        ...r,
        length: r.length !== "" && r.length !== undefined
          ? newSystem === "ip"
            ? Number((Number(r.length) * 3.28084).toFixed(1))
            : Number((Number(r.length) / 3.28084).toFixed(1))
          : r.length
      })));
    }
  };
  const [globalDerating, setGlobalDerating] = useState(0.85);
  const [globalVdLimit, setGlobalVdLimit] = useState(3);
  const [globalPf, setGlobalPf] = useState(0.85);
  const [activeRowId, setActiveRowId] = useState<string>();
  const [rows, setRows] = useState<any[]>([
    {
      id: "row-1",
      description: "Main Incomer Feeder",
      connectedLoad: 75,
      voltage: 400,
      phase: "Three Phase",
      length: 45,
      material: "Copper",
      type: "XLPE",
      parallelRuns: 1,
      remarks: "Primary distribution"
    },
    {
      id: "row-2",
      description: "AHU-01 Power Supply",
      connectedLoad: 22,
      voltage: 400,
      phase: "Three Phase",
      length: 60,
      material: "Copper",
      type: "XLPE",
      parallelRuns: 1,
      remarks: "HVAC plant room"
    },
    {
      id: "row-3",
      description: "Lighting Distribution DB-L1",
      connectedLoad: 8.5,
      voltage: 230,
      phase: "Single Phase",
      length: 35,
      material: "Copper",
      type: "XLPE",
      parallelRuns: 1,
      remarks: "Floor 1 lighting"
    }
  ]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<any[][]>([]);

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMaterial, setFilterMaterial] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMinLoad, setFilterMinLoad] = useState<number | null>(null);
  const [filterFlagged, setFilterFlagged] = useState<boolean>(false);

  // Comment Modal States
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string; type: string } | null>(null);

  // Calculation Preview Popup Modal State (on double-click)
  const [previewRow, setPreviewRow] = useState<any | null>(null);

  const handleSaveComment = (newComment: any) => {
    if (!commentTarget) return;
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.id === commentTarget.id) {
          const existing = r.comments || [];
          return { ...r, comments: [...existing, newComment] };
        }
        return r;
      });
      const pId = project?.id || "default";
      try {
        localStorage.setItem(`mep_conductor_rows_${pId}`, JSON.stringify(updated));
        const calcCommentsKey = `mep_calc_comments_${pId}_/conductor-sizing`;
        const existingComments = JSON.parse(localStorage.getItem(calcCommentsKey) || '[]');
        if (!existingComments.some((c: any) => c.id === newComment.id)) {
          localStorage.setItem(calcCommentsKey, JSON.stringify([newComment, ...existingComments]));
        }
      } catch (e) {}
      return updated;
    });
    toast.success("Comment added to conductor circuit");
  };

  const getCalculationPreview = (row: any): CalculationPreviewData => {
    const isSinglePhase = row.phase === "Single Phase";
    const runs = row.parallelRuns || 1;

    return {
      title: "Conductor (Cable) Sizing Calculation",
      itemName: row.description || `Circuit ${row.srNo}`,
      itemCode: `${row.phase === "Single Phase" ? "1-Phase" : "3-Phase"} • ${row.voltage}V`,
      standardReference: "IEC 60364-5-52 / BS 7671",
      inputs: [
        { label: "Connected Load", value: row.connectedLoad || 0, unit: "kW" },
        { label: "Operating Voltage", value: row.voltage || 0, unit: "V" },
        { label: "Phase System", value: row.phase || "Three Phase" },
        { label: "Conductor Material", value: row.material || "Copper" },
        { label: "Insulation Type", value: row.type || "XLPE" },
        { label: "Route Length", value: row.length || 0, unit: "m" },
        { label: "Parallel Runs", value: runs },
        { label: "Derating Factor", value: globalDerating },
        { label: "Power Factor (cos φ)", value: globalPf },
        { label: "Max Allowable VD", value: `${globalVdLimit}%` },
      ],
      steps: [
        {
          stepNumber: 1,
          label: "Continuous Design Current (Ib)",
          formula: isSinglePhase
            ? "Ib = (P × 1000) / (V × cos φ)"
            : "Ib = (P × 1000) / (√3 × V × cos φ)",
          substitution: isSinglePhase
            ? `(${row.connectedLoad} × 1000) / (${row.voltage} × ${globalPf})`
            : `(${row.connectedLoad} × 1000) / (1.732 × ${row.voltage} × ${globalPf})`,
          result: row.designCurrent,
          unit: "A",
          status: "info",
          description: "Full-load continuous design current per phase",
        },
        {
          stepNumber: 2,
          label: "Derated Current-Carrying Capacity (Iz)",
          formula: "Iz = Base_Ampacity × Derating_Factor × Runs",
          substitution: `${row.baseAmpacity || 0} A × ${globalDerating} × ${runs}`,
          result: row.deratedAmpacity,
          unit: "A",
          status: row.deratedAmpacity >= row.designCurrent ? "pass" : "warning",
          description: "Effective ampacity after applying installation and grouping derating factors",
        },
        {
          stepNumber: 3,
          label: "Selected Conductor Cross-Section",
          formula: "Minimum standard cable size where Iz ≥ Ib",
          substitution: `${row.material} / ${row.type} core size`,
          result: row.minCableSize > 0 ? `${row.minCableSize} mm²` : "Out of Range",
          status: row.minCableSize > 0 ? "pass" : "warning",
          description: "Conductor cross-sectional area complying with IEC 60364-5-52 current capacity tables",
        },
        {
          stepNumber: 4,
          label: "Voltage Drop (ΔV)",
          formula: isSinglePhase
            ? "ΔV = 2 × (Ib/runs) × L × (R cos φ + X sin φ) / 1000"
            : "ΔV = √3 × (Ib/runs) × L × (R cos φ + X sin φ) / 1000",
          substitution: `Drop = ${row.vdV} V across ${row.length} m length`,
          result: `${row.vdPercent}%`,
          status: row.vdPercent <= globalVdLimit ? "pass" : "warning",
          description: `Calculated percentage voltage drop (Allowable Limit: ${globalVdLimit}%)`,
        },
        {
          stepNumber: 5,
          label: "Cable Utilization Ratio",
          formula: "Utilization = (Ib / Iz) × 100",
          substitution: `(${row.designCurrent} A / ${row.deratedAmpacity} A) × 100`,
          result: `${row.utilization}%`,
          status: row.utilization <= 95 ? "pass" : "warning",
          description: "Thermal loading ratio of the selected cable cross-section",
        },
      ],
      finalResultLabel: "Recommended Cable",
      finalResultValue:
        row.minCableSize > 0
          ? `${runs > 1 ? `${runs}x ` : ""}${row.minCableSize} mm² (${row.material}/${row.type})`
          : "Size Out of Range",
      complianceNote:
        row.status === "Pass"
          ? "Complies with IEC 60364-5-52 and BS 7671 voltage drop & thermal ampacity requirements."
          : row.notes || "Voltage drop or current capacity limit exceeded.",
    };
  };

  // Sorting States
  const [sortKey, setSortKey] = useState<"default" | "description" | "load" | "current" | "cableSize" | "vdPercent" | "length">("default");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterMaterial !== "all") count++;
    if (filterType !== "all") count++;
    if (filterPhase !== "all") count++;
    if (filterStatus !== "all") count++;
    if (filterMinLoad !== null) count++;
    if (filterFlagged) count++;
    return count;
  }, [filterMaterial, filterType, filterPhase, filterStatus, filterMinLoad, filterFlagged]);

  const handleResetFilters = () => {
    setFilterMaterial("all");
    setFilterType("all");
    setFilterPhase("all");
    setFilterStatus("all");
    setFilterMinLoad(null);
    setFilterFlagged(false);
  };

  const handleToggleFlag = (targetRowId?: string) => {
    const idsToToggle = targetRowId ? [targetRowId] : (selected.size > 0 ? Array.from(selected) : []);
    if (idsToToggle.length === 0) return;

    setRows((prev) => {
      const isFirstFlagged = prev.find((r) => r.id === idsToToggle[0])?.flagged;
      const nextState = !isFirstFlagged;
      return prev.map((r) => (idsToToggle.includes(r.id) ? { ...r, flagged: nextState } : r));
    });
    toast.info("Conductor flag status updated");
  };

  const pushToHistory = (newRows: any[]) => {
    setHistory([...history, newRows]);
  };

  const calculatedRows = useMemo(() => calculateConductorRows(rows, globalDerating, globalVdLimit, globalPf), [rows, globalDerating, globalVdLimit, globalPf]);

  // Filtered & Sorted Rows for Display
  const displayedRows = useMemo(() => {
    let result = [...calculatedRows];

    // 1. Text Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          String(r.description || "").toLowerCase().includes(q) ||
          String(r.remarks || "").toLowerCase().includes(q) ||
          String(r.material || "").toLowerCase().includes(q) ||
          String(r.type || "").toLowerCase().includes(q) ||
          String(r.phase || "").toLowerCase().includes(q) ||
          String(r.minCableSize || "").includes(q)
      );
    }

    // 2. Popover Filters
    if (filterMaterial !== "all") {
      result = result.filter((r) => r.material === filterMaterial);
    }
    if (filterType !== "all") {
      result = result.filter((r) => r.type === filterType);
    }
    if (filterPhase !== "all") {
      result = result.filter((r) => r.phase === filterPhase);
    }
    if (filterStatus !== "all") {
      result = result.filter((r) => r.status === filterStatus);
    }
    if (filterMinLoad !== null) {
      result = result.filter((r) => Number(r.connectedLoad || 0) >= filterMinLoad);
    }
    if (filterFlagged) {
      result = result.filter((r) => Boolean(r.flagged));
    }

    // 3. Sorting
    if (sortKey !== "default") {
      result.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;
        if (sortKey === "description") {
          valA = (a.description || "").toLowerCase();
          valB = (b.description || "").toLowerCase();
          return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (sortKey === "load") {
          valA = Number(a.connectedLoad || 0);
          valB = Number(b.connectedLoad || 0);
        } else if (sortKey === "current") {
          valA = a.designCurrent;
          valB = b.designCurrent;
        } else if (sortKey === "cableSize") {
          valA = a.minCableSize;
          valB = b.minCableSize;
        } else if (sortKey === "vdPercent") {
          valA = a.vdPercent;
          valB = b.vdPercent;
        } else if (sortKey === "length") {
          valA = Number(a.length || 0);
          valB = Number(b.length || 0);
        }
        return sortOrder === "asc" ? valA - valB : valB - valA;
      });
    }

    return result;
  }, [calculatedRows, searchQuery, filterMaterial, filterType, filterPhase, filterStatus, filterMinLoad, filterFlagged, sortKey, sortOrder]);

  const totalConnectedKw = useMemo(() => rows.reduce((acc, row) => acc + (row.connectedLoad === "" ? 0 : Number(row.connectedLoad)), 0), [rows]);
  const maxDesignCurrent = useMemo(() => calculatedRows.reduce((max, row) => Math.max(max, row.designCurrent), 0), [calculatedRows]);
  const largestCableSize = useMemo(() => calculatedRows.reduce((max, row) => Math.max(max, row.minCableSize), 0), [calculatedRows]);
  const passCount = useMemo(() => calculatedRows.filter((r) => r.status === "Pass").length, [calculatedRows]);

  const handleAddRow = () => {
    const newRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      description: `Feeder Circuit ${rows.length + 1}`,
      connectedLoad: 15,
      voltage: 400,
      phase: "Three Phase",
      length: 25,
      material: "Copper",
      type: "XLPE",
      parallelRuns: 1,
      remarks: "",
      flagged: false
    };
    setRows([...rows, newRow]);
    setActiveRowId(newRow.id);
    toast.success("New conductor segment added");
  };

  const clearSelection = () => setSelected(new Set());

  // Load saved project rows
  useEffect(() => {
    const pId = project?.id || "default";
    try {
      const saved = localStorage.getItem(`mep_conductor_rows_${pId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRows(parsed);
        }
      }
    } catch (e) {}
  }, [project?.id]);

  // Persist project rows on change
  useEffect(() => {
    if (rows && rows.length > 0) {
      const pId = project?.id || "default";
      try {
        localStorage.setItem(`mep_conductor_rows_${pId}`, JSON.stringify(rows));
      } catch (e) {}
    }
  }, [rows, project?.id]);

  // Listen to URL search params & mep-scroll-to-item events from Notification Center
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const matchedRow = rows.find(
        (r) =>
          (targetId && (r.id === targetId || String(r.srNo) === targetId)) ||
          (targetName && (r.description?.toLowerCase().includes(targetName.toLowerCase()) || targetName.toLowerCase().includes(r.description?.toLowerCase())))
      );
      if (matchedRow) {
        clearSelection();
        setSelected(new Set([matchedRow.id]));
        setActiveRowId(matchedRow.id);
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("commentTargetId") || urlParams.get("commentTargetName")) {
          setCommentTarget({
            id: matchedRow.id,
            name: matchedRow.description || `Circuit ${matchedRow.srNo}`,
            type: "Conductor Circuit",
          });
          setCommentModalOpen(true);
        }
      }
    };

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get("commentTargetId");
      const targetName = urlParams.get("commentTargetName");
      if (targetId || targetName) {
        setTimeout(() => handleScrollTarget(targetId || undefined, targetName || undefined), 300);
      }

      const onScrollEvent = (e: any) => {
        const detail = e.detail;
        if (detail) {
          handleScrollTarget(detail.id, detail.name);
        }
      };

      window.addEventListener("mep-scroll-to-item", onScrollEvent);
      return () => window.removeEventListener("mep-scroll-to-item", onScrollEvent);
    }
  }, [rows]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.size === 0) return;
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') {
          return;
        }
        setRows(prev => prev.filter(r => !selected.has(r.id)));
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const handleUpdateRow = (id: string, field: string, val: any) => {
    pushToHistory(rows);
    if (selected.size > 1 && selected.has(id)) {
      setRows(rows.map((r) => {
        if (selected.has(r.id)) {
          const updated = { ...r, [field]: val };
          if (field === "phase") updated.voltage = val === "Single Phase" ? 230 : 400;
          return updated;
        }
        return r;
      }));
    } else {
      setRows(rows.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: val };
          if (field === "phase") updated.voltage = val === "Single Phase" ? 230 : 400;
          return updated;
        }
        return r;
      }));
    }
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset all calculations to default?")) {
      setRows([]);
      setGlobalDerating(0.85);
      setGlobalVdLimit(3);
      setGlobalPf(0.85);
      clearSelection();
      setActiveRowId(undefined);
      handleResetFilters();
      setSearchQuery("");
      toast.info("Calculations reset to defaults");
    }
  };

  const handleToggle = (id: string, isShift: boolean, isCtrl: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isShift && activeRowId) {
        const currentIndex = rows.findIndex(r => r.id === id);
        const activeIndex = rows.findIndex(r => r.id === activeRowId);
        
        if (currentIndex !== -1 && activeIndex !== -1) {
          const start = Math.min(currentIndex, activeIndex);
          const end = Math.max(currentIndex, activeIndex);
          for (let i = start; i <= end; i++) {
            next.add(rows[i].id);
          }
          return next;
        }
      }
      
      if (next.has(id)) next.delete(id);
      else next.add(id);
      
      return next;
    });
    setActiveRowId(id);
  };

  const handleToggleAll = () => {
    if (selected.size === displayedRows.length && displayedRows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayedRows.map(r => r.id)));
    }
  };

  // Excel Import Handler
  const handleImportExcelRows = (importedData: any[]) => {
    if (!Array.isArray(importedData) || importedData.length === 0) {
      toast.error("No valid data found to import");
      return;
    }
    const newRows = importedData.map((d, index) => ({
      id: `row-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
      description: String(d.description || `Feeder ${rows.length + index + 1}`),
      connectedLoad: d.connectedLoad !== undefined && d.connectedLoad !== null ? Number(d.connectedLoad) || "" : "",
      voltage: d.voltage !== undefined && d.voltage !== null ? Number(d.voltage) || 400 : 400,
      phase: d.phase ? (String(d.phase).toLowerCase().includes("single") || String(d.phase).includes("1") ? "Single Phase" : "Three Phase") : "Three Phase",
      length: d.length !== undefined && d.length !== null ? Number(d.length) || "" : 20,
      material: d.material ? (String(d.material).toLowerCase().includes("al") ? "Aluminium" : "Copper") : "Copper",
      type: d.type ? (String(d.type).toUpperCase().includes("PVC") ? "PVC" : String(d.type).toUpperCase().includes("LSZH") ? "LSZH" : "XLPE") : "XLPE",
      parallelRuns: d.parallelRuns !== undefined && d.parallelRuns !== null ? Math.max(1, Number(d.parallelRuns) || 1) : 1,
      remarks: String(d.remarks || ""),
      flagged: Boolean(d.flagged)
    }));
    setRows((prev) => [...prev, ...newRows]);
    toast.success(`Imported ${newRows.length} conductor rows successfully`);
  };

  // Excel Export Handler
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Conductor Sizing");

      // Title & Header Block
      sheet.mergeCells("A1:M1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = "CONDUCTOR (CABLE) SIZING SCHEDULE";
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 30;

      // Project & Criteria Details
      sheet.getCell("A3").value = "Project:";
      sheet.getCell("B3").value = projectName;
      sheet.getCell("A4").value = "Derating Factor:";
      sheet.getCell("B4").value = globalDerating;
      sheet.getCell("D3").value = "Date:";
      sheet.getCell("E3").value = new Date().toLocaleDateString();
      sheet.getCell("D4").value = "Max VD Limit (%):";
      sheet.getCell("E4").value = `${globalVdLimit}%`;
      sheet.getCell("G3").value = "Engineer:";
      sheet.getCell("H3").value = currentUserName;
      sheet.getCell("G4").value = "Power Factor:";
      sheet.getCell("H4").value = globalPf;

      ["A3", "A4", "D3", "D4", "G3", "G4"].forEach(cellKey => {
        sheet.getCell(cellKey).font = { bold: true };
      });

      // Table Headers
      const headers = [
        "Sr. No.", "Description", "Load (kW)", "Voltage (V)", "Phase", "Length (m)",
        "Material", "Insulation", "Runs", "Ib (A)", "Sized Cable (mm²)", "Iz (A)",
        "VD (V)", "VD (%)", "Utilization (%)", "Status", "Remarks"
      ];
      sheet.getRow(6).values = headers;
      sheet.getRow(6).height = 24;

      sheet.getRow(6).eachCell((cell) => {
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "thin", color: { argb: "FF94A3B8" } },
          right: { style: "thin", color: { argb: "FF94A3B8" } }
        };
      });

      // Rows Data
      calculatedRows.forEach((row, idx) => {
        const rowNum = 7 + idx;
        const rowData = [
          row.srNo,
          row.description,
          row.connectedLoad || 0,
          row.voltage || 0,
          row.phase,
          row.length || 0,
          row.material,
          row.type,
          row.parallelRuns || 1,
          row.designCurrent,
          row.minCableSize > 0 ? `${row.minCableSize} mm²` : "Size Out of Range",
          row.deratedAmpacity,
          row.vdV,
          `${row.vdPercent}%`,
          `${row.utilization}%`,
          row.status,
          row.remarks || ""
        ];
        sheet.getRow(rowNum).values = rowData;
        sheet.getRow(rowNum).alignment = { vertical: "middle" };

        sheet.getRow(rowNum).eachCell((cell, colIdx) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
          if ([1, 3, 4, 6, 9, 10, 11, 12, 13, 14, 15, 16].includes(colIdx)) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          }
        });
      });

      // Auto width columns
      sheet.columns.forEach((column: any) => {
        column.width = 16;
      });
      sheet.getColumn(2).width = 28; // Description
      sheet.getColumn(17).width = 24; // Remarks

      const lastRowIndex = 7 + calculatedRows.length + 2;
      addExcelSignatureBlock(sheet, lastRowIndex, currentUserName, projectId, "conductor-sizing");

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `Conductor_Sizing_Schedule_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (err) {
      console.error("Failed to export Excel", err);
      toast.error("Failed to export Excel file");
    }
  };

  // PDF Export Handler matching standard MEP Calculation Report format
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("l", "mm", "a4");

      const runAutoTable = (options: any) => {
        if (typeof autoTable === "function") {
          autoTable(doc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(doc, options);
        } else if ((doc as any).autoTable) {
          (doc as any).autoTable(options);
        }
      };

      // 1. Standard Project Metadata Header Box
      const currentY = addPdfHeader(doc, "Conductor (Cable) Sizing Calculation Report", {
        calcNo: (project as any)?.calcNo || "TRV-CAL-101-R01",
        projectNo: project?.code || (project as any)?.projectNo || "P000",
        projectName: projectName,
        client: (project as any)?.client || "",
        endUser: (project as any)?.endUser || (project as any)?.location || "",
        date: formatDateStr(new Date().toISOString()),
      });

      // 2. Conductor Sizing Data Table
      const headers = [
        [
          { content: "Sr.\nNo." },
          { content: "Circuit Description" },
          { content: "Load\n(kW)" },
          { content: "Voltage\n(V)" },
          { content: "Phase" },
          { content: "Length\n(m)" },
          { content: "Material" },
          { content: "Cable Type" },
          { content: "Runs" },
          { content: "Design Current\nIb (A)" },
          { content: "Sized Cable\n(mm²)" },
          { content: "Voltage Drop\n(%)" },
          { content: "Status" }
        ]
      ];

      const tableBody: any[] = calculatedRows.map((r) => [
        r.srNo,
        r.description || `Circuit ${r.srNo}`,
        r.connectedLoad !== "" ? Number(r.connectedLoad).toFixed(2) : "-",
        r.voltage !== "" ? `${r.voltage} V` : "-",
        r.phase === "Single Phase" ? "1-Phase" : "3-Phase",
        r.length !== "" ? `${r.length}` : "-",
        r.material,
        r.type,
        r.parallelRuns || 1,
        r.designCurrent,
        r.minCableSize > 0 ? `${r.minCableSize} mm²` : "Out of Range",
        `${r.vdPercent}%`,
        r.status
      ]);

      // Add Total / Summary row
      tableBody.push([
        "",
        "TOTAL / MAX",
        totalConnectedKw.toFixed(2),
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        maxDesignCurrent.toFixed(1),
        largestCableSize ? `${largestCableSize} mm²` : "-",
        "-",
        `${passCount}/${calculatedRows.length} Pass`
      ]);

      runAutoTable({
        startY: currentY + 3,
        margin: { left: 14, right: 14 },
        head: headers,
        body: tableBody,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 }
        },
        headStyles: {
          fillColor: [217, 217, 217],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 14, halign: "center" },
          1: { cellWidth: 47, halign: "left" },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 18, halign: "center" },
          5: { cellWidth: 16, halign: "center" },
          6: { cellWidth: 18, halign: "center" },
          7: { cellWidth: 18, halign: "center" },
          8: { cellWidth: 14, halign: "center" },
          9: { cellWidth: 24, halign: "center", fontStyle: "bold" },
          10: { cellWidth: 24, halign: "center", fontStyle: "bold" },
          11: { cellWidth: 18, halign: "center" },
          12: { cellWidth: 22, halign: "center", fontStyle: "bold" },
        },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.row.index === tableBody.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [240, 240, 240];
          }
        }
      });

      const tableFinalY = (doc as any).lastAutoTable?.finalY ?? (currentY + 60);
      const pageHeight = doc.internal.pageSize.getHeight();
      let sigStartY = tableFinalY + 8;
      if (sigStartY + 30 > pageHeight - 14) {
        doc.addPage();
        sigStartY = 20;
      }

      // 3. Dynamic 3-Tier Signature Block
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || "default", "/conductor-sizing", currentUserName);

      runAutoTable({
        startY: sigStartY,
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
            { content: originatedName || "-", styles: { halign: "center" } },
            { content: reviewerName || "-", styles: { halign: "center" } },
            { content: approverName || "-", styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate || "-", styles: { halign: "center" } },
            { content: reviewerDate || "-", styles: { halign: "center" } },
            { content: approverDate || "-", styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 38, fontStyle: "bold", halign: "right" },
          1: { cellWidth: 77, halign: "center" },
          2: { cellWidth: 77, halign: "center" },
          3: { cellWidth: 77, halign: "center" }
        }
      });

      doc.save(`Conductor_Sizing_Report_${(project?.code || "P000")}_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Conductor sizing PDF exported successfully");
    } catch (err) {
      console.error("Failed to export PDF", err);
      toast.error("Failed to export PDF document");
    }
  };

  const columns = [
    {
      key: "srNo", header: "Sr. No.", width: 50, align: "center",
      render: (row: any) => {
        const itemComments = getMergedItemComments(row.id, row.description, row.comments, "/conductor-sizing", project?.id);
        return (
          <div className="flex items-center gap-1.5 w-full">
            {itemComments.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentTarget({ id: row.id, name: row.description || `Circuit ${row.srNo}`, type: "Conductor Circuit" });
                  setCommentModalOpen(true);
                }}
                title={`${itemComments.length} comment(s)/task(s) assigned`}
                className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <MessageSquare className="size-3.5 fill-blue-500/20" />
                <span className="text-[10px] font-bold">{itemComments.length}</span>
              </button>
            )}
            <InlineInput
              value={row.description}
              onCommit={(val) => handleUpdateRow(row.id, "description", val)}
              onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
              onDoubleClick={() => setPreviewRow(row)}
              className="text-[11px] font-medium flex-1 min-w-0"
            />
          </div>
        );
      }
    },
    {
      key: "connectedLoad", header: "Load (kW)", width: 95, align: "center",
      render: (row: any) => (
        <InlineInput
          type="number"
          value={row.connectedLoad}
          onCommit={(val) => handleUpdateRow(row.id, "connectedLoad", val === "" ? "" : Number(val))}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          onDoubleClick={() => setPreviewRow(row)}
          className="text-[11px] text-center font-bold font-mono"
        />
      )
    },
    {
      key: "voltage", header: "Voltage (V)", width: 90, align: "center",
      render: (row: any) => (
        <InlineInput
          type="number"
          value={row.voltage}
          onCommit={(val) => handleUpdateRow(row.id, "voltage", val === "" ? "" : Number(val))}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          onDoubleClick={() => setPreviewRow(row)}
          className="text-[11px] text-center font-medium font-mono"
        />
      )
    },
    {
      key: "phase", header: "Phase", width: 125, align: "center",
      render: (row: any) => (
        <select
          value={row.phase}
          onChange={(e) => handleUpdateRow(row.id, "phase", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => setPreviewRow(row)}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded pl-2 pr-4.5 py-0.5 text-[11px] font-semibold cursor-pointer text-foreground"
        >
          <option value="" disabled hidden>Phase</option>
          <option value="Single Phase">Single Phase</option>
          <option value="Three Phase">Three Phase</option>
        </select>
      )
    },
    {
      key: "length", header: unitSystem === "ip" ? "Length (ft)" : "Length (m)", width: 90, align: "center",
      render: (row: any) => (
        <InlineInput
          type="number"
          value={row.length}
          onCommit={(val) => handleUpdateRow(row.id, "length", val === "" ? "" : Number(val))}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          onDoubleClick={() => setPreviewRow(row)}
          className="text-[11px] text-center font-medium font-mono"
        />
      )
    },
    {
      key: "material", header: "Material", width: 110, align: "center",
      render: (row: any) => (
        <select
          value={row.material}
          onChange={(e) => handleUpdateRow(row.id, "material", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => setPreviewRow(row)}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded pl-2 pr-4.5 py-0.5 text-[11px] font-medium cursor-pointer text-foreground"
        >
          <option value="" disabled hidden>Material</option>
          <option value="Copper">Copper</option>
          <option value="Aluminium">Aluminium</option>
        </select>
      )
    },
    {
      key: "type", header: "Cable Type", width: 110, align: "center",
      render: (row: any) => (
        <select
          value={row.type}
          onChange={(e) => handleUpdateRow(row.id, "type", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => setPreviewRow(row)}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded pl-2 pr-4.5 py-0.5 text-[11px] font-medium cursor-pointer text-foreground"
        >
          <option value="" disabled hidden>Type</option>
          <option value="XLPE">XLPE</option>
          <option value="PVC">PVC</option>
          <option value="LSZH">LSZH</option>
        </select>
      )
    },
    {
      key: "parallelRuns", header: "Runs", width: 70, align: "center",
      render: (row: any) => (
        <InlineInput
          type="number"
          min={1}
          value={row.parallelRuns}
          onCommit={(val) => handleUpdateRow(row.id, "parallelRuns", val === "" ? "" : Math.max(1, Number(val)))}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          onDoubleClick={() => setPreviewRow(row)}
          className="text-[11px] text-center font-medium font-mono"
        />
      )
    },
    {
      key: "designCurrent", header: "Current (A)", width: 105, align: "center",
      render: (row: any) => (
        <div
          onDoubleClick={() => setPreviewRow(row)}
          className="text-center font-mono text-[11px] font-bold text-primary cursor-pointer"
          title="Double-click to open calculation preview"
        >
          {row.designCurrent}
        </div>
      )
    },
    {
      key: "minCableSize", header: "Sized Cable", width: 115, align: "center",
      render: (row: any) => {
        if (row.connectedLoad === "" || row.voltage === "") return <div className="text-center text-muted-foreground/60 text-[11px] font-mono">-</div>;
        return (
          <div
            onDoubleClick={() => setPreviewRow(row)}
            className={`text-center font-bold text-[11px] cursor-pointer ${row.minCableSize > 0 ? "text-emerald-600 dark:text-emerald-400 font-mono" : "text-red-500 font-sans"}`}
            title="Double-click to open calculation preview"
          >
            {row.minCableSize > 0 ? `${row.minCableSize} mm²` : "Size Out of Range"}
          </div>
        );
      }
    },
    {
      key: "remarks", header: "Remarks", width: 130,
      render: (row: any) => (
        <InlineInput
          value={row.remarks}
          onCommit={(val) => handleUpdateRow(row.id, "remarks", val)}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          onDoubleClick={() => setPreviewRow(row)}
          className="text-[11px] font-medium"
        />
      )
    },
    {
      key: "flag", header: "Flag", width: 44, align: "center",
      render: (row: any) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFlag(row.id);
            }}
            title={row.flagged ? "Unflag conductor" : "Flag conductor for review"}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer group/flag flex items-center justify-center"
          >
            <Flag
              className={`size-3.5 transition-all ${
                row.flagged
                  ? "fill-red-500 text-red-500 scale-110"
                  : "text-muted-foreground/30 hover:text-red-500/60 group-hover/flag:scale-110"
              }`}
            />
          </button>
        </div>
      )
    }
  ];

  const renderRowContextMenu = (row: any) => (
    <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
      <ContextMenuItem
        onClick={() => setPreviewRow(row)}
        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-semibold text-primary"
      >
        <Sparkles className="size-3.5" />
        <span>Calculation Preview</span>
      </ContextMenuItem>
      <ContextMenuSeparator className="my-1 border-t border-border" />
      <ContextMenuItem
        onClick={() => {
          setCommentTarget({ id: row.id, name: row.description || `Circuit ${row.srNo}`, type: "Conductor Circuit" });
          setCommentModalOpen(true);
        }}
        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
      >
        <MessageSquare className="size-3.5" />
        <span>Add Comment / Task</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleToggleFlag(row.id)} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
        <Flag className={`size-3.5 ${row.flagged ? "text-red-500 fill-red-500" : ""}`} />
        {row.flagged ? "Unflag Conductor" : "Flag Conductor"}
      </ContextMenuItem>
      <ContextMenuSeparator className="my-1 border-t border-border" />
      <ContextMenuItem onClick={() => {
        const duplicated = { ...row, id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, description: `${row.description} (Copy)` };
        setRows([...rows, duplicated]);
        setActiveRowId(duplicated.id);
        toast.success("Row duplicated");
      }} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
        <Copy className="size-3.5" /> Duplicate Row
      </ContextMenuItem>
      <ContextMenuSeparator className="my-1 border-t border-border" />
      <ContextMenuItem onClick={() => {
        if (window.confirm("Are you sure you want to delete this row?")) {
          setRows(rows.filter((r) => r.id !== row.id));
          if (activeRowId === row.id) setActiveRowId(undefined);
          toast.info("Row deleted");
        }
      }} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500 font-semibold">
        <Trash2 className="size-3.5" /> Delete Row
      </ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <AppShell title="Conductor (Cable) Sizing" hideSubHeader>
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-3 overflow-y-auto h-full">
          
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-center shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Conductor (Cable) Sizing</h1>
                <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} {rows.length === 1 ? "segment" : "segments"}</span>
              </div>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/conductor-sizing" calculatorTitle="Conductor Sizing" />
            </div>

            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitToggle}
                ipLabel="IP"
                siLabel="SI"
                ipDescription="Imperial (IP) [Feet - ft]"
                siDescription="Metric (SI) [Meters - m]"
                conversionExample={
                  unitSystem === "si"
                    ? "Convert 30 m → 98.4 ft"
                    : "Convert 98.4 ft → 30 m"
                }
                disabled={isEffectiveReadOnly}
              />
            </div>
          </div>

          {/* Main Card Container for Data Grid & Tabs matching screenshot */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} min-h-[450px] overflow-hidden mb-6`}>
            
            {/* Row 1: Tabs Header Row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border/60 shrink-0 select-none no-print">
              <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-full gap-0.5 border border-border/80">
                <button
                  onClick={() => setTab("schedule")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "schedule"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sizing Schedule
                </button>
                <button
                  onClick={() => setTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "report"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Report
                </button>
              </div>
            </div>

            {/* Tab 1: Sizing Schedule View */}
            {tab === "schedule" ? (
              <div className="flex-1 flex flex-col min-h-0">
                
                {/* Row 2: Action Toolbar Header Bar */}
                <div className="flex items-center justify-between gap-2 px-3 h-10 bg-background border-b border-border/80 select-none shrink-0 no-print">
                  
                  {/* Left Side: Filter conductors Input, Filter Popover, Sort Popover */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter conductors..."
                        className="h-7 w-56 pl-3 pr-7 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-primary/50 focus:bg-background rounded-full text-[12px] outline-none text-foreground transition-all"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Filter Button */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          title="Filter Conductors"
                          className={`h-7 w-7 rounded-full border border-border flex items-center justify-center transition-all cursor-pointer relative ${
                            activeFiltersCount > 0
                              ? "bg-primary/15 border-primary text-primary font-bold"
                              : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                          }`}
                        >
                          <Filter className="size-3.5" />
                          {activeFiltersCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-xs border border-background">
                              {activeFiltersCount}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-68 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-2.5 z-50 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-border">
                          <span className="font-semibold text-foreground text-[12px]">Filter Conductors</span>
                          {activeFiltersCount > 0 && (
                            <button onClick={handleResetFilters} className="text-[10px] text-primary font-semibold hover:underline">
                              Clear Filters
                            </button>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Material</span>
                          <select
                            value={filterMaterial}
                            onChange={(e) => setFilterMaterial(e.target.value)}
                            className="h-7 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs text-foreground outline-none cursor-pointer"
                          >
                            <option value="all">All Materials</option>
                            <option value="Copper">Copper</option>
                            <option value="Aluminium">Aluminium</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Insulation Type</span>
                          <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="h-7 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs text-foreground outline-none cursor-pointer"
                          >
                            <option value="all">All Types</option>
                            <option value="XLPE">XLPE</option>
                            <option value="PVC">PVC</option>
                            <option value="LSZH">LSZH</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Phase</span>
                          <select
                            value={filterPhase}
                            onChange={(e) => setFilterPhase(e.target.value)}
                            className="h-7 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs text-foreground outline-none cursor-pointer"
                          >
                            <option value="all">All Phases</option>
                            <option value="Single Phase">Single Phase</option>
                            <option value="Three Phase">Three Phase</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Status</span>
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="h-7 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs text-foreground outline-none cursor-pointer"
                          >
                            <option value="all">All Statuses</option>
                            <option value="Pass">Pass Only</option>
                            <option value="Warning">Warning Only</option>
                            <option value="Fail">Fail Only</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Min Connected Load (kW)</span>
                          <input
                            type="number"
                            placeholder="e.g. 20"
                            value={filterMinLoad ?? ""}
                            onChange={(e) => setFilterMinLoad(e.target.value ? Number(e.target.value) : null)}
                            className="h-7 w-full px-2.5 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs text-foreground outline-none"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                            <Flag className="size-3 text-red-500 fill-red-500" />
                            Flagged Only
                          </span>
                          <input
                            type="checkbox"
                            checked={filterFlagged}
                            onChange={(e) => setFilterFlagged(e.target.checked)}
                            className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Sort Button */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          title="Sort Conductors"
                          className={`h-7 w-7 rounded-full border border-border flex items-center justify-center transition-all cursor-pointer ${
                            sortKey !== "default"
                              ? "bg-primary/15 border-primary text-primary font-bold"
                              : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                          }`}
                        >
                          <ArrowUpDown className="size-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-56 p-2 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-1 z-50 text-xs">
                        <span className="font-semibold text-foreground px-2 py-1 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                          Sort By
                        </span>
                        <button
                          onClick={() => { setSortKey("default"); setSortOrder("asc"); }}
                          className={`text-left px-2.5 py-1.5 rounded transition ${sortKey === 'default' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'}`}
                        >
                          Default (Sr. No.)
                        </button>
                        <button
                          onClick={() => { setSortKey("description"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          className={`text-left px-2.5 py-1.5 rounded transition flex justify-between items-center ${sortKey === 'description' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'}`}
                        >
                          <span>Description</span>
                          {sortKey === "description" && <span className="text-[10px] font-mono uppercase">{sortOrder}</span>}
                        </button>
                        <button
                          onClick={() => { setSortKey("load"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          className={`text-left px-2.5 py-1.5 rounded transition flex justify-between items-center ${sortKey === 'load' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'}`}
                        >
                          <span>Connected Load</span>
                          {sortKey === "load" && <span className="text-[10px] font-mono uppercase">{sortOrder}</span>}
                        </button>
                        <button
                          onClick={() => { setSortKey("current"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          className={`text-left px-2.5 py-1.5 rounded transition flex justify-between items-center ${sortKey === 'current' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'}`}
                        >
                          <span>Design Current (A)</span>
                          {sortKey === "current" && <span className="text-[10px] font-mono uppercase">{sortOrder}</span>}
                        </button>
                        <button
                          onClick={() => { setSortKey("cableSize"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          className={`text-left px-2.5 py-1.5 rounded transition flex justify-between items-center ${sortKey === 'cableSize' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'}`}
                        >
                          <span>Sized Cable (mm²)</span>
                          {sortKey === "cableSize" && <span className="text-[10px] font-mono uppercase">{sortOrder}</span>}
                        </button>
                        <button
                          onClick={() => { setSortKey("vdPercent"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          className={`text-left px-2.5 py-1.5 rounded transition flex justify-between items-center ${sortKey === 'vdPercent' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'}`}
                        >
                          <span>Voltage Drop (%)</span>
                          {sortKey === "vdPercent" && <span className="text-[10px] font-mono uppercase">{sortOrder}</span>}
                        </button>
                        <button
                          onClick={() => { setSortKey("length"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          className={`text-left px-2.5 py-1.5 rounded transition flex justify-between items-center ${sortKey === 'length' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'}`}
                        >
                          <span>Length (m)</span>
                          {sortKey === "length" && <span className="text-[10px] font-mono uppercase">{sortOrder}</span>}
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Right Side: Import Excel, Export Dropdown, + New Space */}
                  <div className="flex items-center gap-2">
                    <ImportExcelBtn
                      columnMapping={{
                        description: ["Description", "Circuit Description", "Load Description", "Feeder", "Name"],
                        connectedLoad: ["Load (kW)", "Load", "Connected Load", "kW", "Connected Load (kW)", "Rating (kW)"],
                        voltage: ["Voltage (V)", "Voltage", "V", "Volts"],
                        phase: ["Phase", "No of Phase", "Phases"],
                        length: ["Length (m)", "Length", "Cable Length", "Run Length"],
                        material: ["Material", "Conductor Material", "Conductor"],
                        type: ["Cable Type", "Type", "Insulation", "Insulation Type"],
                        parallelRuns: ["Runs", "Parallel Runs", "No of Runs", "Parallel"],
                        remarks: ["Remarks", "Notes", "Comments"]
                      }}
                      onImport={handleImportExcelRows}
                    >
                      <button className="h-7 px-3 rounded-full border border-border text-[12px] font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer transition bg-background">
                        <Upload className="size-3.5 text-muted-foreground" /> Import Excel
                      </button>
                    </ImportExcelBtn>

                    {/* Direct Export PDF Button */}
                    <button
                      onClick={handleExportPDF}
                      title="Export to PDF"
                      className="h-7 px-3 rounded-full border border-border text-[12px] font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer transition bg-background"
                    >
                      <FileDown className="size-3.5 text-muted-foreground" /> Export
                    </button>

                    {/* New Conductor Primary Pill Button */}
                    <button
                      onClick={handleAddRow}
                      className="bg-primary text-primary-foreground font-bold h-7 px-3.5 rounded-full text-[12px] flex items-center gap-1.5 transition hover:bg-primary/90 cursor-pointer shadow-xs"
                    >
                      <Plus className="size-3.5" /> New Conductor
                    </button>
                  </div>
                </div>

                {/* Row 3: Sizing Constants Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/80 select-none shrink-0">
                  <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Derating Factor:</span>
                      <input
                        type="number"
                        step="0.05"
                        value={globalDerating}
                        onChange={(e) => setGlobalDerating(Number(e.target.value))}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">VD Limit (%):</span>
                      <input
                        type="number"
                        step="0.5"
                        value={globalVdLimit}
                        onChange={(e) => setGlobalVdLimit(Number(e.target.value))}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Power Factor:</span>
                      <input
                        type="number"
                        step="0.05"
                        value={globalPf}
                        onChange={(e) => setGlobalPf(Number(e.target.value))}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Full Width DataGrid Table */}
                <div className="flex-1 min-h-[350px] flex flex-col bg-transparent relative overflow-hidden">
                  <div className="flex-grow flex flex-col relative min-h-[350px]">
                    {displayedRows.length > 0 ? (
                      <DataGrid
                        rows={displayedRows}
                        columns={columns}
                        selected={selected}
                        onToggle={handleToggle}
                        onToggleAll={handleToggleAll}
                        onRowDoubleClick={(row) => setPreviewRow(row)}
                        renderContextMenu={renderRowContextMenu}
                      />
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-2xl bg-slate-50/20 dark:bg-slate-900/10 m-4 min-h-[350px]">
                        <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm">
                          <Plus className="size-5 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">
                          {rows.length === 0 ? "No calculation rows" : "No matching conductors found"}
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-sm mb-4">
                          {rows.length === 0
                            ? "Add a conductor row or import Excel data to start calculating."
                            : "Try clearing filters or search query to see all conductor rows."}
                        </p>
                        {rows.length === 0 ? (
                          <Button onClick={handleAddRow} className="h-8 text-xs rounded-full">
                            <Plus className="size-3.5 mr-1.5" /> Add First Conductor
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={handleResetFilters} className="h-8 text-xs rounded-full">
                            Clear Search & Filters
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Tab 2: Professional Engineering Report View */
              <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-background">
                <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
                  
                  {/* Top Action Bar */}
                  <div className="flex items-center justify-between pb-4 border-b border-border">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Conductor (Cable) Sizing Engineering Report</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Comprehensive calculations and verification summary complying with IEC 60364-5-52.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 text-xs">
                        <Printer className="size-3.5 mr-1.5" /> Print Report
                      </Button>
                      <Button size="sm" onClick={handleExportPDF} className="h-8 text-xs">
                        <Download className="size-3.5 mr-1.5" /> Download PDF
                      </Button>
                    </div>
                  </div>

                  {/* Top Overview Grid: Project Sizing Summary Card & Design Criteria Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Project Sizing Summary Card matching user UI */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm p-5 transition-all">
                      <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-2">
                        Project Sizing Summary
                      </h4>
                      <div className="space-y-3.5 text-[13px]">
                        <div className="flex flex-col border border-indigo-500/30 rounded-xl bg-indigo-500/10 dark:bg-indigo-950/30 p-3.5 shadow-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                            Largest Conductor Size
                          </span>
                          <div className="text-[26px] font-black text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono tracking-tight">
                            {largestCableSize ? `${largestCableSize} mm²` : "-"}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-background border border-border rounded-xl p-3 flex flex-col shadow-xs">
                            <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Connected Load</span>
                            <strong className="text-[15px] font-bold font-mono text-foreground mt-0.5">{totalConnectedKw.toFixed(1)} kW</strong>
                          </div>
                          <div className="bg-background border border-border rounded-xl p-3 flex flex-col shadow-xs">
                            <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Max Current</span>
                            <strong className="text-[15px] font-bold font-mono text-foreground mt-0.5">{maxDesignCurrent.toFixed(1)} A</strong>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2.5 border-t border-border text-xs text-muted-foreground">
                          <span>Compliance Status:</span>
                          <span className="font-bold font-mono text-foreground">
                            {passCount}/{calculatedRows.length} Pass
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Design & Sizing Criteria Card */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm p-5 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-2">
                          Design Criteria & Parameters
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/80 rounded-xl p-2.5">
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Derating Factor</span>
                            <span className="font-bold text-foreground font-mono text-sm">{globalDerating}</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/80 rounded-xl p-2.5">
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Max Allowable VD</span>
                            <span className="font-bold text-foreground font-mono text-sm">{globalVdLimit}%</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/80 rounded-xl p-2.5">
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Operating PF (cos φ)</span>
                            <span className="font-bold text-foreground font-mono text-sm">{globalPf}</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/80 rounded-xl p-2.5">
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Standard Code</span>
                            <span className="font-bold text-foreground text-xs">IEC 60364-5-52</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                        <span>Total Feeders Analyzed:</span>
                        <span className="font-bold font-mono text-foreground">{calculatedRows.length} Circuits</span>
                      </div>
                    </div>

                  </div>

                  {/* Complete Schedule Table */}
                  <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-border text-[11px] text-muted-foreground">
                          <th className="py-2.5 px-3 font-semibold text-center w-12">Sr.</th>
                          <th className="py-2.5 px-3 font-semibold">Description</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Load (kW)</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Voltage</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Phase</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Length (m)</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Material</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Type</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Ib (A)</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Sized Cable</th>
                          <th className="py-2.5 px-3 font-semibold text-center">VD (%)</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {calculatedRows.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition">
                            <td className="py-2.5 px-3 font-mono text-center text-muted-foreground">{r.srNo}</td>
                            <td className="py-2.5 px-3 font-medium text-foreground">
                              <div className="flex items-center gap-1.5">
                                {r.flagged && <Flag className="size-3 text-red-500 fill-red-500 shrink-0" />}
                                <span>{r.description}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-center font-bold">{r.connectedLoad || "-"}</td>
                            <td className="py-2.5 px-3 font-mono text-center">{r.voltage || "-"} V</td>
                            <td className="py-2.5 px-3 text-center">{r.phase === "Single Phase" ? "1-Phase" : "3-Phase"}</td>
                            <td className="py-2.5 px-3 font-mono text-center">{r.length || "-"}</td>
                            <td className="py-2.5 px-3 text-center">{r.material}</td>
                            <td className="py-2.5 px-3 text-center">{r.type}</td>
                            <td className="py-2.5 px-3 font-mono text-center font-bold text-primary">{r.designCurrent}</td>
                            <td className="py-2.5 px-3 font-mono text-center font-bold text-emerald-600 dark:text-emerald-400">
                              {r.minCableSize > 0 ? `${r.minCableSize} mm²` : "Out of Range"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-center">{r.vdPercent}%</td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.status === "Pass"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    : r.status === "Warning"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Engineering Sign-off Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border mt-4">
                    <div className="border border-border rounded-xl p-3 flex flex-col justify-between h-28 bg-slate-50/50 dark:bg-slate-900/30">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prepared By</span>
                        <p className="text-xs font-semibold text-foreground mt-1">{currentUserName}</p>
                      </div>
                      <div className="border-t border-dashed border-border pt-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>Signature: ________________</span>
                        <span>Date: {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="border border-border rounded-xl p-3 flex flex-col justify-between h-28 bg-slate-50/50 dark:bg-slate-900/30">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Checked By</span>
                        <p className="text-xs font-semibold text-foreground mt-1">Lead Electrical Engineer</p>
                      </div>
                      <div className="border-t border-dashed border-border pt-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>Signature: ________________</span>
                        <span>Date: ____________</span>
                      </div>
                    </div>

                    <div className="border border-border rounded-xl p-3 flex flex-col justify-between h-28 bg-slate-50/50 dark:bg-slate-900/30">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Approved By</span>
                        <p className="text-xs font-semibold text-foreground mt-1">Project Director</p>
                      </div>
                      <div className="border-t border-dashed border-border pt-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>Signature: ________________</span>
                        <span>Date: ____________</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Assign Comment & Task Modal */}
      {commentTarget && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTarget(null);
          }}
          targetId={commentTarget.id}
          targetName={commentTarget.name}
          targetType={commentTarget.type}
          calculatorTitle="Conductor Sizing"
          calculatorPath="/conductor-sizing"
          existingComments={getMergedItemComments(commentTarget.id, commentTarget.name, rows.find((r) => r.id === commentTarget.id)?.comments, "/conductor-sizing", project?.id)}
          onSave={handleSaveComment}
        />
      )}

      {/* Calculation Preview Modal on Double-click / Context Menu */}
      <CalculationPreviewModal
        isOpen={!!previewRow}
        onClose={() => setPreviewRow(null)}
        data={previewRow ? getCalculationPreview(previewRow) : null}
      />
    </AppShell>
  );
}
