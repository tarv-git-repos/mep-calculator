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
import {
  Plus, Trash2, Download, Upload, Sparkles, Gauge, FileText, Printer, FileSpreadsheet, RotateCcw, Filter, ArrowUpDown, Copy, X, Check, MessageSquare, Search, SlidersHorizontal, PanelRightClose, PanelRightOpen
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
  onFocus?: (e: any) => void;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder, onFocus }: InlineInputProps) {
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
      onDoubleClick={(e) => e.stopPropagation()}
      className={`bg-transparent w-full border border-transparent hover:border-slate-200 focus:border-blue-500 px-1 py-1 outline-none transition-colors cursor-text ${className}`}
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
  const [showSummary, setShowSummary] = useState(true);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPhase, setFilterPhase] = useState<"all" | "Single Phase" | "Three Phase">("all");
  const [filterMinLoad, setFilterMinLoad] = useState<number | null>(null);
  const [filterMinCurrent, setFilterMinCurrent] = useState<number | null>(null);
  const [filterSelectedOnly, setFilterSelectedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<"default" | "description" | "connectedLoad" | "voltage" | "designCurrent" | "recBreaker">("default");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterPhase !== "all") count++;
    if (filterMinLoad !== null) count++;
    if (filterMinCurrent !== null) count++;
    if (filterSelectedOnly) count++;
    return count;
  }, [filterPhase, filterMinLoad, filterMinCurrent, filterSelectedOnly]);

  const handleResetFilters = () => {
    setFilterPhase("all");
    setFilterMinLoad(null);
    setFilterMinCurrent(null);
    setFilterSelectedOnly(false);
  };

  // Table rows matching screenshot
  const [rows, setRows] = useState<BreakerRow[]>([
    {
      id: "1",
      selected: true,
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
  const calculatedData = useMemo(() => calculateCircuitBreakers(rows), [rows]);


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
  }, [calculatedData.rowDetails, searchQuery, filterPhase, filterMinLoad, filterMinCurrent, filterSelectedOnly, sortKey, sortDirection]);

  // Handlers
  const handleAddRow = () => {
    const newRow: BreakerRow = {
      id: Date.now().toString(),
      selected: false,
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
      selected: false
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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const visibleIds = new Set(displayedRows.map(r => r.id));
    setRows(prev => prev.map(r => visibleIds.has(r.id) ? { ...r, selected: checked } : r));
  };

  const handleReset = async () => {
    if (await confirm({ title: "Reset Data", body: "This will clear all circuits. Continue?" })) {
      setRows([]);
      setShowSummary(false);
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
    connectedLoad: ["Connected Load (kW)", "Connected Load", "Load (kW)", "kW", "Load", "Watt"],
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
      };
    });
    setRows(prev => [...prev, ...newRows]);
    toast.success(`Imported ${newRows.length} circuit(s) successfully!`);
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Breaker Sizing");

      sheet.columns = [
        { header: "Sr.", key: "sr", width: 8 },
        { header: "Description", key: "desc", width: 28 },
        { header: "Connected Load (kW)", key: "load", width: 22 },
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
      sheet.addRow(["Total Connected Load (kW)", `${calculatedData.totalConnectedKw.toFixed(1)} kW`]);
      sheet.addRow(["Total Design Load (kW)", `${calculatedData.totalDesignLoadKw.toFixed(1)} kW`]);
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

    const loadHead = [["Description", "Load kW", "Volts", "Phase", "PF", "DF", "Current (A)", "Breaker Rating (A)", "Remarks"]];
    const loadBody = calculatedData.rowDetails.map(r => [
      r.description,
      r.connectedLoad,
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
      ["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(1)} kW`],
      ["Total Design Load", `${calculatedData.totalDesignLoadKw.toFixed(1)} kW`],
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
    >
      <div className="p-6 h-full flex flex-col bg-slate-50 dark:bg-slate-950 font-sans overflow-y-auto">
        
        {/* Header & Title */}
        <div className="flex flex-col mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Circuit Breaker Sizing <span className="text-sm font-normal text-slate-400">({rows.length} circuits)</span>
          </h1>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/circuit-breaker-sizing" calculatorTitle="Circuit Breaker Sizing" />
          <p className="text-xs text-muted-foreground mt-1">Preliminary circuit breaker capacity rating sizing based on connected loads, voltage, and phase parameters.</p>
        </div>

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
                          <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Min Load (kW)</span>
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

                        {/* Selected Only */}
                        <label className="flex items-center gap-2 pt-1 border-t border-border/60 text-[11.5px] font-medium text-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={filterSelectedOnly}
                            onChange={(e) => setFilterSelectedOnly(e.target.checked)}
                            className="rounded border-gray-300 text-primary size-3.5 focus:ring-primary cursor-pointer"
                          />
                          <span>Selected circuits only</span>
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
                            <option value="connectedLoad">Connected Load (kW)</option>
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

                  {/* Right Side: Import Excel, Hide Results, Export PDF, New Row */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                    <ImportExcelBtn
                      columnMapping={excelColumnMapping}
                      onImport={handleImportExcelRows}
                    />

                    <button
                      type="button"
                      onClick={() => setShowSummary((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border transition-all cursor-pointer shadow-2xs ${
                        showSummary
                          ? "border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                          : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                      title={showSummary ? "Hide Results Panel" : "Show Results Panel"}
                    >
                      {showSummary ? (
                        <>
                          <PanelRightClose className="size-3.5" />
                          <span className="hidden sm:inline">Hide Results</span>
                        </>
                      ) : (
                        <>
                          <PanelRightOpen className="size-3.5" />
                          <span>Show Results</span>
                        </>
                      )}
                    </button>

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

                {/* Main Content Area: Table and Summary Cards */}
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 gap-4">
                  {/* Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500">
                    <th className="p-3 w-10 text-center"><input type="checkbox" onChange={handleSelectAll} checked={displayedRows.length > 0 && displayedRows.every(r => r.selected)} className="cursor-pointer" /></th>
                    <th className="p-3 w-16 text-center">Sr. No.</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 w-32">Connected Load (kW)</th>
                    <th className="p-3 w-24">Voltage (V)</th>
                    <th className="p-3 w-32">Phase</th>
                    <th className="p-3 w-28">Power Factor</th>
                    <th className="p-3 w-28">Demand Factor</th>
                    <th className="p-3 w-32">Design Current (A)</th>
                    <th className="p-3 w-40">Recommended Breaker Rating (A)</th>
                    <th className="p-3 w-32">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {displayedRows.map((row, idx) => (
                    <tr 
                      key={row.id} 
                      onClick={() => handleUpdateRow(row.id, "selected", !row.selected)}
                      className={`cursor-pointer ${row.selected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'}`}
                    >
                      <td className="p-3 text-center border-r border-transparent">
                        <input type="checkbox" checked={!!row.selected} onChange={(e) => handleUpdateRow(row.id, 'selected', e.target.checked)} onClick={(e) => e.stopPropagation()} className="cursor-pointer" />
                      </td>
                      <td className="p-3 font-mono text-slate-400 text-center">{idx + 1}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5 w-full">
                          {(() => {
                            const itemComments = getMergedItemComments(row.id, row.description, (row as any).comments, "/circuit-breaker-sizing", project?.id);
                            return itemComments.length > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenComment(row.id, row.description);
                                }}
                                title={`${itemComments.length} comment(s)/task(s) assigned`}
                                className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
                              >
                                <MessageSquare className="size-3.5 fill-blue-500/20" />
                                <span className="text-[10px] font-bold">{itemComments.length}</span>
                              </button>
                            ) : null;
                          })()}
                          <InlineInput 
                            value={row.description} 
                            onCommit={(val) => handleUpdateRow(row.id, "description", val)}
                            onFocus={() => handleRowFocus(row.id)}
                            placeholder="e.g. New Feeder Load"
                            className="font-medium text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs font-mono">eg:</span>
                          <InlineInput 
                            type="number" 
                            value={row.connectedLoad} 
                            onCommit={(val) => handleUpdateRow(row.id, "connectedLoad", val === "" ? "" : Number(val))}
                            onFocus={() => handleRowFocus(row.id)}
                            className="text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs font-mono">eg:</span>
                          <InlineInput 
                            type="number" 
                            value={row.voltage} 
                            onCommit={(val) => handleUpdateRow(row.id, "voltage", val === "" ? "" : Number(val))}
                            onFocus={() => handleRowFocus(row.id)}
                            className="text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        <select 
                          value={row.phase} 
                          onChange={(e) => handleUpdateRow(row.id, "phase", e.target.value as any)}
                          onFocus={() => handleRowFocus(row.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none text-slate-900 dark:text-slate-100 focus:border-blue-500"
                        >
                          <option value="Select...">Select...</option>
                          <option value="Single Phase">Single Phase</option>
                          <option value="Three Phase">Three Phase</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs font-mono">eg:</span>
                          <InlineInput 
                            type="number" step="0.01"
                            value={row.powerFactor} 
                            onCommit={(val) => handleUpdateRow(row.id, "powerFactor", val === "" ? "" : Number(val))}
                            onFocus={() => handleRowFocus(row.id)}
                            className="text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs font-mono">eg:</span>
                          <InlineInput 
                            type="number" step="0.01"
                            value={row.demandFactor} 
                            onCommit={(val) => handleUpdateRow(row.id, "demandFactor", val === "" ? "" : Number(val))}
                            onFocus={() => handleRowFocus(row.id)}
                            className="text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                        {row.designCurrent.toFixed(2)}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {row.recBreaker} A
                      </td>
                      <td className="p-2">
                        <InlineInput 
                          value={row.remarks} 
                          onCommit={(val) => handleUpdateRow(row.id, "remarks", val)}
                          onFocus={() => handleRowFocus(row.id)}
                          placeholder="Notes..."
                          className="text-slate-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayedRows.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Filter className="size-6 text-slate-300 dark:text-slate-600 mb-1" />
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {rows.length === 0
                      ? 'No circuits added. Click "New Space" to begin sizing.'
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
              )}
            </div>

            {/* Results Summary */}
            {showSummary && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-slate-500/10"><FileText className="size-8" /></div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Total Connected Load</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.totalConnectedKw.toFixed(1)} <span className="text-sm text-slate-500 font-sans">kW</span></strong>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-slate-500/10"><Gauge className="size-8" /></div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Total Design Load</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.totalDesignLoadKw.toFixed(1)} <span className="text-sm text-slate-500 font-sans">kW</span></strong>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-blue-500/20"><Sparkles className="size-8" /></div>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">Peak Design Current</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.maxDesignCurrentA.toFixed(2)} <span className="text-sm text-slate-500 font-sans">A</span></strong>
                </div>
              </div>
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

              <div className="mb-6">
                <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1 mb-3">1. Connected Electrical Load & Current Sizing Schedule</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border border-collapse border-slate-200 dark:border-slate-700">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[9px]">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">Sr.</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">Description</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Connected (kW)</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">Volts</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">Phase</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">PF</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">DF</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Current (A)</th>
                        <th className="p-2 text-right">Breaker Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono">
                      {calculatedData.rowDetails.map((r, idx) => (
                        <tr key={r.id}>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-sans">{r.description}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">{r.connectedLoad !== "" ? Number(r.connectedLoad).toFixed(1) : "-"} kW</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{r.voltage !== "" ? r.voltage : "-"} V</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{r.phase === 'Three Phase' ? '3P' : r.phase === 'Single Phase' ? '1P' : '-'}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{r.powerFactor !== "" ? r.powerFactor : "-"}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{r.demandFactor !== "" ? r.demandFactor : "-"}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right font-bold">{r.designCurrent.toFixed(2)} A</td>
                          <td className="p-2 text-right font-bold">{r.recBreaker} A</td>
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
                      <strong className="font-mono">{calculatedData.totalConnectedKw.toFixed(1)} kW</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Design load:</span>
                      <strong className="font-mono">{calculatedData.totalDesignLoadKw.toFixed(1)} kW</strong>
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
                      <p className="font-semibold font-sans text-slate-700 dark:text-slate-300">Design load (kW):</p>
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
    </AppShell>
  );
}
