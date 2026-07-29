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

export const Route = createFileRoute("/transformer-sizing")({
  head: () => ({
    meta: [
      { title: "Transformer Sizing — MEP Calc" },
      { name: "description", content: "Determine power transformer size based on connected loads, demand/diversity factors, and deratings." },
    ],
  }),
  component: TransformerSizingPage,
});

interface LoadRow {
  id: string;
  selected?: boolean;
  description: string;
  lightingHeatingKw: number | "";
  inductiveMotorKw: number | "";
  diversityFactor: number | "";
  demandFactor: number | "";
  remarks: string;
}

const STANDARD_TX_RATINGS = [
  25, 50, 75, 100, 160, 200, 250, 315, 400, 500, 630, 750, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000
];

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

function TransformerSizingPage() {
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [showSummary, setShowSummary] = useState(false);

  // Global inputs matching the screenshot
  const [designParams, setDesignParams] = useState({
    spareCapacity: 20,
    deratingFactor1: 1,
    deratingFactor2: 1,
    powerFactor: 0.8,
  });

  // Table rows
  const [loadRows, setLoadRows] = useState<LoadRow[]>([
    {
      id: "1",
      selected: false,
      description: "General Lighting",
      lightingHeatingKw: 45,
      inductiveMotorKw: 0,
      diversityFactor: 0.9,
      demandFactor: 0.8,
      remarks: "Main lobby & corridors"
    },
    {
      id: "2",
      selected: false,
      description: "Chiller Unit CH-01",
      lightingHeatingKw: 0,
      inductiveMotorKw: 150,
      diversityFactor: 1.0,
      demandFactor: 0.85,
      remarks: "Primary AC plant"
    }
  ]);

  // Calculations
  const calculatedData = useMemo(() => {
    let totalConnectedKw = 0;
    let totalMaxDemandKw = 0;

    const rowDetails = loadRows.map(row => {
      const lh = Number(row.lightingHeatingKw) || 0;
      const im = Number(row.inductiveMotorKw) || 0;
      const div = Number(row.diversityFactor) || 1.0;
      const dem = Number(row.demandFactor) || 1.0;

      const connectedLoad = lh + im;
      const maxDemand = connectedLoad * dem * div;

      totalConnectedKw += connectedLoad;
      totalMaxDemandKw += maxDemand;

      return {
        ...row,
        connectedLoad,
        maxDemand
      };
    });

    const spareMult = 1 + (Number(designParams.spareCapacity) || 0) / 100;
    const derating1 = Number(designParams.deratingFactor1) || 1.0;
    const derating2 = Number(designParams.deratingFactor2) || 1.0;
    const pf = Number(designParams.powerFactor) || 0.8;

    const totalDemandWithSpareKw = totalMaxDemandKw * spareMult;
    
    // Final Design power (kVA)
    const requiredKvaVal = totalDemandWithSpareKw / (pf * derating1 * derating2);
    const requiredKva = isNaN(requiredKvaVal) || !isFinite(requiredKvaVal) ? 0 : requiredKvaVal;

    const recommendedKva = STANDARD_TX_RATINGS.find(r => r >= requiredKva) || STANDARD_TX_RATINGS[STANDARD_TX_RATINGS.length - 1];

    const utilization = recommendedKva > 0 ? (requiredKva / recommendedKva) * 100 : 0;

    return {
      rowDetails,
      totalConnectedKw,
      totalMaxDemandKw,
      totalDemandWithSpareKw,
      requiredKva,
      recommendedKva,
      utilization: isNaN(utilization) ? 0 : utilization,
      totalSpareKw: totalMaxDemandKw * (designParams.spareCapacity / 100),
    };
  }, [loadRows, designParams]);


  // Handlers
  const handleAddRow = () => {
    const newRow: LoadRow = {
      id: Date.now().toString(),
      selected: false,
      description: `Load ${loadRows.length + 1}`,
      lightingHeatingKw: "",
      inductiveMotorKw: "",
      diversityFactor: 1,
      demandFactor: 1,
      remarks: "",
    };
    setLoadRows([...loadRows, newRow]);
  };

  const handleUpdateRow = (id: string, field: keyof LoadRow, val: any) => {
    setLoadRows(prev => {
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
      // Escape: Deselect All Rows
      if (e.key === 'Escape') {
        setLoadRows(prev => prev.map(r => ({ ...r, selected: false })));
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // Ignore if typing inside an input field
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      // Ctrl+A: Select All Rows
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setLoadRows(prev => prev.map(r => ({ ...r, selected: true })));
      }
      
      // Delete/Backspace: Delete Selected Rows
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setLoadRows(prev => prev.filter(r => !r.selected));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRowFocus = (id: string) => {
    setLoadRows(prev => {
      const isSelected = prev.find(r => r.id === id)?.selected;
      // If clicking an unselected row, deselect all others and select this one
      if (!isSelected) {
        return prev.map(r => r.id === id ? { ...r, selected: true } : { ...r, selected: false });
      }
      // If clicking an already selected row, leave selection as-is for bulk editing
      return prev;
    });
  };

  const handleDeleteSelected = async () => {
    if (await confirm({ title: "Delete Selected", body: "Are you sure you want to delete the selected rows?" })) {
      setLoadRows(loadRows.filter(r => !r.selected));
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setLoadRows(loadRows.map(r => ({ ...r, selected: checked })));
  };

  const handleReset = async () => {
    if (await confirm({ title: "Reset Data", body: "This will clear all rows. Continue?" })) {
      setLoadRows([]);
      setDesignParams({
        spareCapacity: 20,
        deratingFactor1: 1,
        deratingFactor2: 1,
        powerFactor: 0.8,
      });
      setShowSummary(false);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ designParams, loadRows }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `transformer_sizing_data.json`);
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
        if (parsed.designParams) setDesignParams(parsed.designParams);
        if (parsed.loadRows) setLoadRows(parsed.loadRows);
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // clear input
    e.target.value = '';
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transformer Sizing");

    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 20;

    sheet.mergeCells("A1:D1");
    const cellA1 = sheet.getCell("A1");
    cellA1.value = "TRANSFORMER SIZING REPORT";
    cellA1.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFF" } };
    cellA1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "333F48" } };
    cellA1.alignment = { horizontal: "center" };

    sheet.addRow([]);
    sheet.addRow(["Parameters"]);
    sheet.getCell("A3").font = { name: "Calibri", size: 13, bold: true };
    sheet.addRow(["Spare Capacity (%)", designParams.spareCapacity]);
    sheet.addRow(["Power Factor", designParams.powerFactor]);
    sheet.addRow(["Derating Factor 1", designParams.deratingFactor1]);
    sheet.addRow(["Derating Factor 2", designParams.deratingFactor2]);

    sheet.addRow([]);
    sheet.addRow(["Results Summary"]);
    sheet.getCell("A9").font = { name: "Calibri", size: 13, bold: true };
    sheet.addRow(["Total Connected Load (kW)", `${calculatedData.totalConnectedKw.toFixed(1)} kW`]);
    sheet.addRow(["Total Maximum Demand (kW)", `${calculatedData.totalMaxDemandKw.toFixed(1)} kW`]);
    sheet.addRow(["Required Transformer capacity (kVA)", `${calculatedData.requiredKva.toFixed(1)} kVA`]);
    sheet.addRow(["Recommended Transformer Rating (kVA)", `${calculatedData.recommendedKva} kVA`]);
    sheet.addRow(["Transformer Utilization (%)", `${calculatedData.utilization.toFixed(1)}%`]);

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `transformer_sizing_report.xlsx`);
  };

  const handlePrintPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("POWER TRANSFORMER SIZING REPORT", 40, 50);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 68);

    doc.setDrawColor(200);
    doc.line(40, 75, 780, 75);

    // Parameters
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("1. Sizing Parameters", 40, 95);

    const paramData = [
      ["Spare Capacity", `${designParams.spareCapacity} %`, "Power Factor", `${designParams.powerFactor}`],
      ["Derating Factor 1", `${designParams.deratingFactor1}`, "Derating Factor 2", `${designParams.deratingFactor2}`],
    ];

    autoTable(doc, {
      startY: 105,
      head: [],
      body: paramData,
      theme: "plain",
      styles: { fontSize: 9.5, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 120 },
        1: { cellWidth: 170 },
        2: { fontStyle: "bold", cellWidth: 120 },
        3: { cellWidth: 170 },
      },
    });

    // Load Schedule
    doc.setFont("helvetica", "bold");
    doc.text("2. Connected Load Schedule", 40, (doc as any).lastAutoTable.finalY + 25);

    const loadHead = [["Description", "Light/Heat kW", "Induct/Motor kW", "Total kW", "Diversity", "Demand F.", "Max Demand kW"]];
    const loadBody = calculatedData.rowDetails.map(r => [
      r.description,
      r.lightingHeatingKw,
      r.inductiveMotorKw,
      r.connectedLoad.toFixed(2),
      r.diversityFactor,
      r.demandFactor,
      r.maxDemand.toFixed(2)
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 35,
      head: loadHead,
      body: loadBody,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [51, 63, 72] },
    });

    // Summary calculations
    doc.setFont("helvetica", "bold");
    doc.text("3. Calculations Summary", 40, (doc as any).lastAutoTable.finalY + 25);

    const summaryData = [
      ["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(1)} kW`],
      ["Total Maximum Demand", `${calculatedData.totalMaxDemandKw.toFixed(1)} kW`],
      ["Spare Load Capacity Added", `${calculatedData.totalSpareKw.toFixed(1)} kW (${designParams.spareCapacity}%)`],
      ["Required Transformer capacity", `${calculatedData.requiredKva.toFixed(1)} kVA`],
      ["Recommended Transformer Size", `${calculatedData.recommendedKva} kVA`],
      ["Transformer Load utilization", `${calculatedData.utilization.toFixed(1)}%`],
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

    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `transformer_sizing_report.pdf`, "PDF Document", ["pdf"]);
  };

  return (
    <AppShell>
      <div className="p-6 h-full flex flex-col bg-slate-50 dark:bg-slate-950 font-sans overflow-y-auto">
        
        {/* Header & Title */}
        <div className="flex flex-col mb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Electrical &gt; Transformer Sizing</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Transformer Sizing <span className="text-sm font-normal text-slate-400">({loadRows.length} loads)</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Preliminary transformer capacity (kVA) sizing based on connected loads, diversity, and ambient deratings.</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-3">
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
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap gap-4 items-center justify-between">
              
              <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">SPARE CAPACITY:</span>
                  <div className="relative">
                    <input 
                      type="number"
                      value={designParams.spareCapacity}
                      onChange={(e) => setDesignParams({...designParams, spareCapacity: Number(e.target.value)})}
                      className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-transparent rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-[-14px] top-1.5 text-[10px] text-slate-500">%</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">DERATING FACTOR 1:</span>
                  <input 
                    type="number" step="0.01"
                    value={designParams.deratingFactor1}
                    onChange={(e) => setDesignParams({...designParams, deratingFactor1: Number(e.target.value)})}
                    className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-transparent rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">DERATING FACTOR 2:</span>
                  <input 
                    type="number" step="0.01"
                    value={designParams.deratingFactor2}
                    onChange={(e) => setDesignParams({...designParams, deratingFactor2: Number(e.target.value)})}
                    className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-transparent rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">POWER FACTOR:</span>
                  <input 
                    type="number" step="0.01"
                    value={designParams.powerFactor}
                    onChange={(e) => setDesignParams({...designParams, powerFactor: Number(e.target.value)})}
                    className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-transparent rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 transition-colors">
                  <RotateCcw className="size-3.5" /> Reset
                </button>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 cursor-pointer transition-colors">
                  <Upload className="size-3.5" /> Import
                  <input type="file" onChange={handleImportJSON} accept=".json" className="hidden" />
                </label>
                <button onClick={handleExportJSON} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 transition-colors">
                  <Download className="size-3.5" /> Export
                </button>
                <button onClick={handleAddRow} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ml-2 shadow-sm">
                  <Plus className="size-3.5" /> Add Row
                </button>
                {loadRows.some(r => r.selected) && (
                  <button onClick={handleDeleteSelected} className="bg-rose-600 hover:bg-rose-700 text-white rounded-md px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm">
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                )}
                <button onClick={() => setShowSummary(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ml-1 shadow-sm">
                  Calculate
                </button>
              </div>

            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500 font-bold">
                    <th className="p-3 w-10 text-center"><input type="checkbox" onChange={handleSelectAll} checked={loadRows.length > 0 && loadRows.every(r => r.selected)} className="cursor-pointer" /></th>
                    <th className="p-3 w-16 text-center">Sr. No.</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 w-32">Lighting / Heating Load (kW)</th>
                    <th className="p-3 w-32">Inductive / Motor Load (kW)</th>
                    <th className="p-3 w-32 bg-slate-100/50 dark:bg-slate-800/50">Total Connected Load (kW)</th>
                    <th className="p-3 w-28">Diversity Factor</th>
                    <th className="p-3 w-28">Demand Factor</th>
                    <th className="p-3 w-32 bg-slate-100/50 dark:bg-slate-800/50">Maximum Demand (kW)</th>
                    <th className="p-3 w-40">Remarks</th>
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
                          placeholder="e.g. Area 1"
                          className="font-medium text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-2">
                        <InlineInput 
                          type="number" 
                          value={row.lightingHeatingKw} 
                          onCommit={(val) => handleUpdateRow(row.id, "lightingHeatingKw", val === "" ? "" : Number(val))}
                          onFocus={() => handleRowFocus(row.id)}
                          placeholder="eg: 20"
                          className="text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-2">
                        <InlineInput 
                          type="number" 
                          value={row.inductiveMotorKw} 
                          onCommit={(val) => handleUpdateRow(row.id, "inductiveMotorKw", val === "" ? "" : Number(val))}
                          onFocus={() => handleRowFocus(row.id)}
                          placeholder="eg: 10"
                          className="text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/30">
                        {row.connectedLoad.toFixed(2)}
                      </td>
                      <td className="p-2">
                        <InlineInput 
                          type="number" step="0.01"
                          value={row.diversityFactor} 
                          onCommit={(val) => handleUpdateRow(row.id, "diversityFactor", val === "" ? "" : Number(val))}
                          onFocus={() => handleRowFocus(row.id)}
                          placeholder="eg: 1"
                          className="text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-2">
                        <InlineInput 
                          type="number" step="0.01"
                          value={row.demandFactor} 
                          onCommit={(val) => handleUpdateRow(row.id, "demandFactor", val === "" ? "" : Number(val))}
                          onFocus={() => handleRowFocus(row.id)}
                          placeholder="eg: 0.85"
                          className="text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-3 font-bold text-blue-700 dark:text-blue-400 bg-slate-100/50 dark:bg-slate-800/30">
                        {row.maxDemand.toFixed(2)}
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
              {loadRows.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No loads added. Click "Add Row" to begin sizing.
                </div>
              )}
            </div>

            {/* Results Summary */}
            {showSummary && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-blue-500/20"><Sparkles className="size-8" /></div>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">Recommended Rating</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.recommendedKva} <span className="text-sm text-slate-500 font-sans">kVA</span></strong>
                  <span className="text-[11px] text-slate-500 mt-2 block">Min. sizing required: {calculatedData.requiredKva.toFixed(1)} kVA</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-slate-500/10"><Gauge className="size-8" /></div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Total Max Demand</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.totalMaxDemandKw.toFixed(1)} <span className="text-sm text-slate-500 font-sans">kW</span></strong>
                  <span className="text-[11px] text-slate-500 mt-2 block">Connected Load: {calculatedData.totalConnectedKw.toFixed(1)} kW</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-slate-500/10"><FileText className="size-8" /></div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Demand With Spare</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.totalDemandWithSpareKw.toFixed(1)} <span className="text-sm text-slate-500 font-sans">kW</span></strong>
                  <span className="text-[11px] text-slate-500 mt-2 block">Spare added: {calculatedData.totalSpareKw.toFixed(1)} kW</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Utilization</span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.utilization.toFixed(1)} <span className="text-sm text-slate-500 font-sans">%</span></strong>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${calculatedData.utilization > 90 ? 'bg-rose-500' : calculatedData.utilization < 35 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(calculatedData.utilization, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto py-6">
            <div className="flex items-center justify-end gap-3 no-print border-b border-border/80 pb-4">
              <TBtn onClick={handlePrintPDF} primary><Printer className="size-3.5" /> Print PDF</TBtn>
              <TBtn onClick={handleExportExcel}><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm">
              <div className="border-b-2 border-slate-800 dark:border-slate-700 pb-5 mb-6 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">TRANSFORMER SIZING REPORT</h1>
                  <p className="text-[12px] text-slate-500 font-mono mt-1">Sizing Calculation Summary</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block mt-0.5">Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1 mb-3">1. Design Parameters</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div><span className="text-slate-500 block">Spare Capacity:</span><span className="font-semibold">{designParams.spareCapacity}%</span></div>
                  <div><span className="text-slate-500 block">Power Factor:</span><span className="font-semibold">{designParams.powerFactor}</span></div>
                  <div><span className="text-slate-500 block">Derating Factor 1:</span><span className="font-semibold">{designParams.deratingFactor1}</span></div>
                  <div><span className="text-slate-500 block">Derating Factor 2:</span><span className="font-semibold">{designParams.deratingFactor2}</span></div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1 mb-3">2. Load Schedule</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border border-collapse border-slate-200 dark:border-slate-700">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">Description</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">L/H kW</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Ind/M kW</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Total kW</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Div F.</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Dem F.</th>
                        <th className="p-2 text-right">Max kW</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono">
                      {calculatedData.rowDetails.map(r => (
                        <tr key={r.id}>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-sans">{r.description}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">{r.lightingHeatingKw}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">{r.inductiveMotorKw}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">{r.connectedLoad.toFixed(2)}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">{r.diversityFactor}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">{r.demandFactor}</td>
                          <td className="p-2 text-right font-bold">{r.maxDemand.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1 mb-3">3. Calculation Summary</h3>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 text-xs">
                  <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <div><span className="text-slate-500">Total Connected Load:</span><strong className="block font-mono mt-0.5">{calculatedData.totalConnectedKw.toFixed(1)} kW</strong></div>
                    <div><span className="text-slate-500">Total Maximum Demand:</span><strong className="block font-mono mt-0.5">{calculatedData.totalMaxDemandKw.toFixed(1)} kW</strong></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div><span className="text-slate-500">Required capacity:</span><strong className="block font-mono mt-0.5 text-blue-600">{calculatedData.requiredKva.toFixed(1)} kVA</strong></div>
                    <div><span className="text-slate-500">Recommended rating:</span><strong className="block font-mono mt-0.5 text-blue-600">{calculatedData.recommendedKva} kVA</strong></div>
                    <div><span className="text-slate-500">Utilization:</span><strong className="block font-mono mt-0.5">{calculatedData.utilization.toFixed(1)}%</strong></div>
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
