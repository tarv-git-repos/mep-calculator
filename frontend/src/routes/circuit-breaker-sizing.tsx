import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Plus, Trash2, Download, Upload, Sparkles, Gauge, FileText, Printer, FileSpreadsheet, RotateCcw
} from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

interface BreakerRow {
  id: string;
  selected?: boolean;
  description: string;
  connectedLoad: number | "";
  voltage: number | "";
  phase: "Select..." | "Single Phase" | "Three Phase";
  powerFactor: number | "";
  demandFactor: number | "";
  remarks: string;
}

function CircuitBreakerSizingPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [showSummary, setShowSummary] = useState(false);

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
  const calculatedData = useMemo(() => {
    let totalConnectedKw = 0;
    let totalDesignLoadKw = 0;
    let maxDesignCurrentA = 0;

    const rowDetails = rows.map(row => {
      const load = Number(row.connectedLoad) || 0;
      const volt = Number(row.voltage) || 0;
      const pf = Number(row.powerFactor) || 0.8;
      const df = Number(row.demandFactor) || 1.0;

      const designLoad = load * df;
      let designCurrent = 0;

      if (volt > 0 && pf > 0) {
        if (row.phase === "Single Phase") {
          designCurrent = (designLoad * 1000) / (volt * pf);
        } else if (row.phase === "Three Phase") {
          designCurrent = (designLoad * 1000) / (1.7320508 * volt * pf);
        }
      }

      const recBreaker = STANDARD_BREAKER_RATINGS_A.find(r => r >= designCurrent) || STANDARD_BREAKER_RATINGS_A[STANDARD_BREAKER_RATINGS_A.length - 1];

      totalConnectedKw += load;
      totalDesignLoadKw += designLoad;
      if (designCurrent > maxDesignCurrentA) {
        maxDesignCurrentA = designCurrent;
      }

      return {
        ...row,
        designLoad,
        designCurrent,
        recBreaker
      };
    });

    const recSummaryBreaker = STANDARD_BREAKER_RATINGS_A.find(r => r >= maxDesignCurrentA) || STANDARD_BREAKER_RATINGS_A[STANDARD_BREAKER_RATINGS_A.length - 1];
    const breakerUtilization = recSummaryBreaker > 0 ? (maxDesignCurrentA / recSummaryBreaker) * 100 : 0;

    return {
      rowDetails,
      totalConnectedKw,
      totalDesignLoadKw,
      maxDesignCurrentA,
      recSummaryBreaker,
      breakerUtilization: isNaN(breakerUtilization) ? 0 : breakerUtilization,
    };
  }, [rows]);


  // Handlers
  const handleAddRow = () => {
    const newRow: BreakerRow = {
      id: Date.now().toString(),
      selected: false,
      description: `New Feeder Load`,
      connectedLoad: 10,
      voltage: 400,
      phase: "Select...",
      powerFactor: 0.8,
      demandFactor: 1,
      remarks: "",
    };
    setRows([...rows, newRow]);
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
    if (await confirm({ title: "Delete Selected", body: "Are you sure you want to delete the selected rows?" })) {
      setRows(rows.filter(r => !r.selected));
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setRows(rows.map(r => ({ ...r, selected: checked })));
  };

  const handleReset = async () => {
    if (await confirm({ title: "Reset Data", body: "This will clear all rows. Continue?" })) {
      setRows([]);
      setShowSummary(false);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ rows }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `circuit_breaker_sizing_data.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.rows) setRows(parsed.rows);
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Breaker Sizing");

    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 15;

    sheet.mergeCells("A1:D1");
    const cellA1 = sheet.getCell("A1");
    cellA1.value = "CIRCUIT BREAKER SIZING REPORT";
    cellA1.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFF" } };
    cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "333F48" } };
    cellA1.alignment = { horizontal: "center" };

    sheet.addRow([]);
    sheet.addRow(["Results Summary"]);
    sheet.getCell("A3").font = { name: "Calibri", size: 13, bold: true };
    sheet.addRow(["Total Connected Load (kW)", `${calculatedData.totalConnectedKw.toFixed(1)} kW`]);
    sheet.addRow(["Total Design Load (kW)", `${calculatedData.totalDesignLoadKw.toFixed(1)} kW`]);
    sheet.addRow(["Maximum Design Current (A)", `${calculatedData.maxDesignCurrentA.toFixed(2)} A`]);

    
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "circuit-breaker-sizing");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `circuit_breaker_sizing_report.xlsx`);
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
  };

  return (
    <AppShell>
      <div className="p-6 h-full flex flex-col bg-slate-50 dark:bg-slate-950 font-sans overflow-y-auto">
        
        {/* Header & Title */}
        <div className="flex flex-col mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Circuit Breaker Sizing <span className="text-sm font-normal text-slate-400">({rows.length} circuits)</span>
          </h1>
              
          <p className="text-xs text-muted-foreground mt-1">Preliminary circuit breaker capacity rating sizing based on connected loads, voltage, and phase parameters.</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="shrink-0 ml-auto pr-3"><CalculationReviewBar projectId={activeProjectId || (project as any)?.id || "default"} calculatorPath="/circuit-breaker-sizing" calculatorTitle="Circuit Breaker Sizing" /></div>
          <button 
            onClick={() => setActiveTab('calculator')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === 'calculator' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            Sizing Schedule
          </button>
          <button 
            onClick={() => setActiveTab('report')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === 'report' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            Report
          </button>
        </div>

        {activeTab === 'calculator' ? (
          <div className="flex flex-col gap-4">
            
            {/* Toolbar / Global Inputs */}
            <div className="flex flex-wrap items-center justify-end gap-2 mb-2">
              <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm">
                <RotateCcw className="size-3.5" /> Reset
              </button>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1 cursor-pointer transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm">
                <Upload className="size-3.5" /> Import
                <input type="file" onChange={handleImportJSON} accept=".json" className="hidden" />
              </label>
              <button onClick={handleExportJSON} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1 transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm">
                <Download className="size-3.5" /> Export
              </button>
              <button onClick={handleAddRow} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ml-2 shadow-sm">
                <Plus className="size-3.5" /> Add Row
              </button>
              {rows.some(r => r.selected) && (
                <button onClick={handleDeleteSelected} className="bg-rose-600 hover:bg-rose-700 text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm">
                  <Trash2 className="size-3.5" /> Delete
                </button>
              )}
              <button onClick={() => setShowSummary(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ml-1 shadow-sm">
                Calculate
              </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500">
                    <th className="p-3 w-10 text-center"><input type="checkbox" onChange={handleSelectAll} checked={rows.length > 0 && rows.every(r => r.selected)} className="cursor-pointer" /></th>
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
                  {calculatedData.rowDetails.map((row, idx) => (
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
                        <InlineInput 
                          value={row.description} 
                          onCommit={(val) => handleUpdateRow(row.id, "description", val)}
                          onFocus={() => handleRowFocus(row.id)}
                          placeholder="e.g. New Feeder Load"
                          className="font-medium text-slate-900 dark:text-slate-100"
                        />
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
              {rows.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No loads added. Click "Add Row" to begin sizing.
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
        ) : (
          <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto py-6">
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
        )}

      </div>
    </AppShell>
  );
}
