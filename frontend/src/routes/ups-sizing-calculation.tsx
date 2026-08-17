import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  Plus, Trash2, Download, Upload, X, Gauge, FileText, Printer, FileSpreadsheet, Copy, RefreshCw
} from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

import { useHistory, useSelection, useClipboard, useShortcuts } from "@/core/gridEngine";

export const Route = createFileRoute("/ups-sizing-calculation")({
  head: () => ({
    meta: [
      { title: "UPS Sizing Calculation — MEP Calc" },
      { name: "description", content: "Simple UPS capacity sizing calculator based on connected socket load schedule and diversity." },
    ],
  }),
  component: UpsSizingCalculationPage,
});

interface LoadRow {
  id: string;
  description: string;
  qtySingle: number;
  qtyTwin: number;
  equipmentLoad: number; // Watts
  spare: number; // Row spare %
  remarks: string;
}

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min }: InlineInputProps) {
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
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text ${className}`}
    />
  );
}

type Tab = "spaces" | "report";
const TABS: { id: Tab; label: string }[] = [
  { id: "spaces", label: "Sizing Schedule" },
  { id: "report", label: "Report" },
];

function UpsSizingCalculationPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("spaces");

  // Global Sizing Factors
  const [diversityFactor, setDiversityFactor] = useState<number>(0.90);
  const [powerFactor, setPowerFactor] = useState<number>(0.80);
  const [spareCapacity, setSpareCapacity] = useState<number>(20); // 20%

  const initialRows: LoadRow[] = useMemo(() => [
    { id: "1", description: "Workstation Desks - Ground Floor", qtySingle: 10, qtyTwin: 20, equipmentLoad: 150, spare: 10, remarks: "Computers & dual monitors" },
    { id: "2", description: "Security CCTV Rack - Server Room", qtySingle: 4, qtyTwin: 4, equipmentLoad: 250, spare: 15, remarks: "NVR and PoE switches" },
    { id: "3", description: "Access Control Panels - Lobby", qtySingle: 2, qtyTwin: 1, equipmentLoad: 100, spare: 0, remarks: "Door controllers" },
    { id: "4", description: "Telecom DB Sockets - Level 1", qtySingle: 5, qtyTwin: 2, equipmentLoad: 120, spare: 10, remarks: "PABX rack power" }
  ], []);

  // Grid Engine Hooks
  const { currentState, pushState: setLoadRows, undo, redo } = useHistory<LoadRow>(initialRows);
  const loadRows = currentState || initialRows || [];
  const { selectedIds: selected, toggleSelection, selectAll, clearSelection } = useSelection(loadRows);
  const { copy, cut, paste } = useClipboard<LoadRow>(loadRows, selected, setLoadRows);

  // Sizing Calculations Engine
  const calculatedData = useMemo(() => {
    let totalConnectedW = 0;

    loadRows.forEach((r) => {
      const single = r.qtySingle || 0;
      const twin = r.qtyTwin || 0;
      const load = r.equipmentLoad || 0;
      const rowSpare = r.spare || 0;

      // Connected Load = (Qty Single + 2 * Qty Twin) * Equipment Load * (1 + Spare / 100)
      const totalOutlets = single + (2 * twin);
      const rowConnected = totalOutlets * load * (1 + rowSpare / 100);

      totalConnectedW += rowConnected;
    });

    const totalConnectedKw = totalConnectedW / 1000;
    const totalLoadAfterDiversityKw = totalConnectedKw * diversityFactor;
    
    const safePF = powerFactor <= 0 ? 0.8 : powerFactor;
    const upsRatingKva = totalLoadAfterDiversityKw / safePF;

    const finalRecommendedKva = upsRatingKva * (1 + spareCapacity / 100);

    return {
      totalConnectedKw,
      totalLoadAfterDiversityKw,
      upsRatingKva,
      finalRecommendedKva
    };
  }, [loadRows, diversityFactor, powerFactor, spareCapacity]);

  // Schedule Actions
  const handleAddRow = () => {
    const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
    setLoadRows([
      ...loadRows,
      {
        id: nextId,
        description: "New Equipment Load",
        qtySingle: 1,
        qtyTwin: 0,
        equipmentLoad: 100,
        spare: 10,
        remarks: ""
      }
    ]);
  };

  const handleDuplicateRow = (row: LoadRow) => {
    const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
    setLoadRows([
      ...loadRows,
      {
        ...row,
        id: nextId,
        description: `${row.description} (Copy)`
      }
    ]);
  };

  const handleDeleteRow = (id: string) => {
    setLoadRows(loadRows.filter(r => r.id !== id));
    clearSelection();
  };

  const handleUpdateRow = (id: string, field: keyof LoadRow, val: any) => {
    const isBulkEdit = selected.has(id);
    setLoadRows(loadRows.map(r => 
      (r.id === id || (isBulkEdit && selected.has(r.id))) ? { ...r, [field]: val } : r
    ));
  };

  const handleReset = async () => {
    const ok = await confirm("Are you sure you want to reset all calculations to defaults?");
    if (ok) {
      setLoadRows([
        { id: "1", description: "Workstation Desks - Ground Floor", qtySingle: 10, qtyTwin: 20, equipmentLoad: 150, spare: 10, remarks: "Computers & dual monitors" },
        { id: "2", description: "Security CCTV Rack - Server Room", qtySingle: 4, qtyTwin: 4, equipmentLoad: 250, spare: 15, remarks: "NVR and PoE switches" }
      ]);
      setDiversityFactor(0.90);
      setPowerFactor(0.80);
      setSpareCapacity(20);
      clearSelection();
    }
  };

  const handleToggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    toggleSelection(id, !!isCtrl, !!isShift);
  };

  const handleToggleAll = () => {
    if (selected.size === loadRows.length) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newRows: LoadRow[] = mappedRows.map((mr, idx) => ({
      id: `ups_${Date.now()}_${idx}`,
      description: mr.description || `Imported Load ${idx + 1}`,
      qtySingle: Number(mr.qtySingle) || 0,
      qtyTwin: Number(mr.qtyTwin) || 0,
      equipmentLoad: Number(mr.equipmentLoad) || 0,
      spare: Number(mr.spare) || 0,
      remarks: mr.remarks || "",
    }));
    setLoadRows([...loadRows, ...newRows]);
  };

  // Excel Export
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("UPS Sizing");

    // Title row
    sheet.mergeCells("A1:H1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "UPS SIZING CALCULATION SHEET";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 36;

    sheet.getCell("A3").value = "Diversity Factor:";
    sheet.getCell("B3").value = diversityFactor;
    sheet.getCell("A4").value = "Power Factor:";
    sheet.getCell("B4").value = powerFactor;
    sheet.getCell("A5").value = "Spare Capacity:";
    sheet.getCell("B5").value = `${spareCapacity}%`;

    sheet.getColumn("A").width = 24;
    sheet.getColumn("B").width = 30;

    // Load schedule headers
    sheet.getRow(8).values = ["Sr. No.", "Description of Load", "Unit", "Qty Single", "Qty Twin", "Equip. Load (W)", "Spare (%)", "Remarks"];
    sheet.getRow(8).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };

    let currentRow = 9;
    loadRows.forEach((r, idx) => {
      sheet.getRow(currentRow).values = [
        idx + 1,
        r.description,
        "W",
        r.qtySingle,
        r.qtyTwin,
        r.equipmentLoad,
        r.spare,
        r.remarks
      ];
      currentRow++;
    });

    currentRow += 2;
    sheet.getCell(`A${currentRow}`).value = "CALCULATION RESULTS";
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 11 };
    currentRow++;

    const results = [
      ["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(2)} kW`],
      ["Total Load after Diversity", `${calculatedData.totalLoadAfterDiversityKw.toFixed(2)} kW`],
      ["UPS Rating (kVA)", `${calculatedData.upsRatingKva.toFixed(2)} kVA`],
      ["UPS Rating including Spare Capacity (kVA)", `${calculatedData.finalRecommendedKva.toFixed(2)} kVA`]
    ];

    results.forEach(([lbl, val]) => {
      sheet.getCell(`A${currentRow}`).value = lbl;
      sheet.getCell(`B${currentRow}`).value = val;
      sheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "UPS_Sizing_Report.xlsx");
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");

    // Header strip
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 25, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("UPS SIZING CALCULATION REPORT", 14, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 18);

    // Sizing factors
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("SIZING COEFFICIENTS", 14, 34);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Diversity Factor: ${diversityFactor}`, 14, 40);
    doc.text(`Power Factor: ${powerFactor}`, 14, 45);
    doc.text(`Spare Capacity: ${spareCapacity}%`, 14, 50);

    // Table Header & Rows
    doc.setFont("helvetica", "bold");
    doc.text("LOAD SCHEDULE DETAILS", 14, 60);

    const headers = [["Sr.", "Description of Load", "Unit", "Single Qty", "Twin Qty", "Equip. Load (W)", "Spare (%)", "Remarks"]];
    const data = loadRows.map((r, idx) => [
      idx + 1,
      r.description,
      "W",
      r.qtySingle,
      r.qtyTwin,
      r.equipmentLoad,
      `${r.spare}%`,
      r.remarks
    ]);

    autoTable(doc, {
      startY: 64,
      head: headers,
      body: data,
      theme: "striped",
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
      styles: { fontSize: 8 },
    });

    let nextY = (doc as any).lastAutoTable.finalY + 10;

    // Sizing Summary
    doc.setFont("helvetica", "bold");
    doc.text("CALCULATION SUMMARY RESULTS", 14, nextY);
    nextY += 4;

    const summaryData = [
      ["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(2)} kW`],
      ["Total Load after Diversity", `${calculatedData.totalLoadAfterDiversityKw.toFixed(2)} kW`],
      ["Sized UPS Rating", `${calculatedData.upsRatingKva.toFixed(2)} kVA`],
      ["Sized UPS Rating (+Spare)", `${calculatedData.finalRecommendedKva.toFixed(2)} kVA`],
    ];

    autoTable(doc, {
      startY: nextY,
      body: summaryData,
      theme: "plain",
      styles: { fontSize: 8.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 80 },
        1: { cellWidth: 50 },
      }
    });

    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), "UPS_Sizing_Report.pdf", "PDF Document", ["pdf"]);
  };

  // DataGrid columns setup
  const columns: Column<LoadRow>[] = useMemo(() => [
    {
      key: "index",
      header: "Sr. No.",
      width: 60,
      align: "center",
      render: (r) => {
        const idx = loadRows.findIndex((row) => row.id === r.id);
        return <span className="text-muted-foreground font-mono">{idx + 1}</span>;
      }
    },
    {
      key: "description",
      header: "Description of Load",
      width: 320,
      editable: true,
      render: (r) => (
        <InlineInput
          value={r.description}
          onCommit={(val) => handleUpdateRow(r.id, "description", val)}
          className="font-medium text-[13px]"
        />
      )
    },
    {
      key: "unit",
      header: "Unit",
      width: 60,
      align: "center",
      render: () => <span className="text-muted-foreground font-mono">W</span>
    },
    {
      key: "qtySingle",
      header: "Qty Single",
      width: 90,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.qtySingle}
          onCommit={(val) => handleUpdateRow(r.id, "qtySingle", Number(val) || 0)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "qtyTwin",
      header: "Qty Twin",
      width: 90,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.qtyTwin}
          onCommit={(val) => handleUpdateRow(r.id, "qtyTwin", Number(val) || 0)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "equipmentLoad",
      header: "Equip. Load (W)",
      width: 130,
      align: "right",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.equipmentLoad}
          onCommit={(val) => handleUpdateRow(r.id, "equipmentLoad", Number(val) || 0)}
          className="font-mono text-right text-primary font-bold text-[12.5px]"
        />
      )
    },
    {
      key: "spare",
      header: "Spare (%)",
      width: 90,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.spare}
          onCommit={(val) => handleUpdateRow(r.id, "spare", Number(val) || 0)}
          className="font-mono text-center text-slate-500 text-[12.5px]"
        />
      )
    },
    {
      key: "connectedLoad",
      header: "Connected Load (W)",
      width: 150,
      align: "right",
      render: (r) => {
        const totalOutlets = r.qtySingle + (2 * r.qtyTwin);
        const rowConnected = totalOutlets * r.equipmentLoad * (1 + r.spare / 100);
        return <span className="font-mono font-bold text-foreground text-[12.5px]">{rowConnected.toFixed(0)}</span>;
      }
    },
    {
      key: "remarks",
      header: "Remarks",
      width: 200,
      editable: true,
      render: (r) => (
        <InlineInput
          value={r.remarks}
          onCommit={(val) => handleUpdateRow(r.id, "remarks", val)}
          className="text-muted-foreground text-[12px]"
        />
      )
    }
  ], [loadRows, selected]);

  // Context Menu Renderer
  const renderRowContextMenu = (row: LoadRow) => {
    const isSelected = selected.has(row.id);
    const selectedIds = isSelected ? Array.from(selected) : [row.id];
    const targetsCount = selectedIds.length;

    return (
      <ContextMenuContent className="w-48 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        {targetsCount > 1 ? (
          <ContextMenuItem
            onClick={async () => {
              const ok = await confirm(`Are you sure you want to delete ${targetsCount} selected rows?`);
              if (ok) {
                setLoadRows(loadRows.filter(r => !selectedIds.includes(r.id)));
                clearSelection();
              }
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500 font-semibold"
          >
            <Trash2 className="size-3.5" /> Delete Selected ({targetsCount})
          </ContextMenuItem>
        ) : (
          <>
            <ContextMenuItem
              onClick={() => handleDuplicateRow(row)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
            >
              <Copy className="size-3.5" /> Duplicate Load
            </ContextMenuItem>
            <ContextMenuSeparator className="my-1 border-t border-border" />
            <ContextMenuItem
              onClick={async () => {
                const ok = await confirm("Are you sure you want to delete this row?");
                if (ok) {
                  handleDeleteRow(row.id);
                }
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500 font-semibold"
            >
              <Trash2 className="size-3.5" /> Delete Load
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    );
  };

  // Keyboard Shortcuts via Core gridEngine
  useShortcuts({
    onUndo: undo,
    onRedo: redo,
    onCopy: copy,
    onCut: cut,
    onPaste: paste,
    onSelectAll: selectAll,
    onClearSelection: clearSelection,
    onDelete: () => {
      if (selected.size === 0) return;
      setLoadRows(loadRows.filter(r => !selected.has(r.id)));
      clearSelection();
    },
    onDuplicate: () => {
      if (selected.size === 0) return;
      const duplicated: LoadRow[] = [];
      loadRows.forEach(r => {
        if (selected.has(r.id)) {
          duplicated.push({
            ...r,
            id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            description: `${r.description} (Copy)`
          });
        }
      });
      setLoadRows([...loadRows, ...duplicated]);
    },
    onNewRow: handleAddRow,
    onPrint: handleExportPDF,
    onExportPdf: handleExportPDF
  });

  // Robust Escape key listener matching Ventilation Calculator
  useEffect(() => {
    const handleEscapeKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
          activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true"
        );
        if (!isEditing) {
          clearSelection();
        }
      }
    };
    window.addEventListener("keydown", handleEscapeKeyDown);
    return () => {
      window.removeEventListener("keydown", handleEscapeKeyDown);
    };
  }, [clearSelection]);

  return (
    <AppShell 
      title="UPS Sizing" 
      hideSubHeader={true}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6">
          
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">ELECTRICAL &gt; UPS SIZING</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">UPS Sizing</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{loadRows.length} items</span>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Simplified preliminary electrical capacity sizing based on socket load schedule.
              </p>
            </div>
          </div>

          {/* Card Container for Data Grid & Tabs */}
          <div className="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden mb-6">
            
            {/* Tabs Row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border/60 shrink-0 select-none no-print">
              <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-full gap-0.5 border border-border/80">
                {TABS.map((t) => {
                  const active = t.id === tab;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                        active
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {tab === "spaces" && (
                <div className="flex items-center gap-2">
                  <TBtn onClick={handleReset}><RefreshCw className="size-3.5 mr-1" /> Reset</TBtn>
                  <ImportExcelBtn
                    columnMapping={{
                      "Description": "description",
                      "Qty (Single)": "qtySingle",
                      "Qty (Twin/Dual)": "qtyTwin",
                      "Equipment Load (W)": "equipmentLoad",
                      "Spare %": "spare",
                      "Remarks": "remarks"
                    }}
                    onImport={handleImportExcelRows}
                  />
                  <TBtn onClick={handleExportPDF}><Download className="size-3.5 mr-1 text-rose-600 dark:text-rose-400" /> Export PDF</TBtn>
                  <TBtn primary onClick={handleExportPDF}><Printer className="size-3.5" /> Print Report</TBtn>
                </div>
              )}
            </div>

            {/* Sizing Schedule View */}
            {tab === "spaces" ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Constants and File Upload Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/80 select-none shrink-0">
                  
                  {/* Sizing Constants */}
                  <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Diversity Factor:</span>
                      <input
                        type="number"
                        step="0.05"
                        value={diversityFactor}
                        onChange={(e) => setDiversityFactor(Number(e.target.value))}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Power Factor:</span>
                      <input
                        type="number"
                        step="0.05"
                        value={powerFactor}
                        onChange={(e) => setPowerFactor(Number(e.target.value))}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Spare Capacity:</span>
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={spareCapacity}
                          onChange={(e) => setSpareCapacity(Number(e.target.value))}
                          className="w-16 bg-background border border-border rounded-l px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none border-r-0"
                        />
                        <span className="bg-slate-100 dark:bg-slate-800 border border-border border-l-0 rounded-r px-2.5 py-1 font-bold text-slate-500 font-mono text-xs">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Excel import & Add Row */}
                  <div className="flex items-center gap-2">
                    <ImportExcelBtn
                      columnMapping={{
                        "Description": "description",
                        "Qty (Single)": "qtySingle",
                        "Qty (Twin/Dual)": "qtyTwin",
                        "Equipment Load (W)": "equipmentLoad",
                        "Spare %": "spare",
                        "Remarks": "remarks"
                      }}
                      onImport={handleImportExcelRows}
                    />
                    <button
                      onClick={handleAddRow}
                      className="bg-primary text-primary-foreground font-bold px-3.5 py-1.5 rounded-lg text-[11.5px] flex items-center gap-1.5 transition hover:bg-primary/95 cursor-pointer shadow-xs"
                    >
                      <Plus className="size-3.5" /> Add Row
                    </button>
                  </div>
                </div>

                {/* Data Grid table */}
                <div className="flex-1 min-h-[350px]">
                  <DataGrid
                    rows={loadRows}
                    columns={columns}
                    selected={selected}
                    onToggle={handleToggle}
                    onToggleAll={handleToggleAll}
                    renderContextMenu={renderRowContextMenu}
                  />
                </div>
              </div>
            ) : (
              /* Report View Tab */
              <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950 p-8 flex flex-col items-center gap-6 print:bg-white print:p-0">
                
                {/* Results Dashboard Grid */}
                <div className="w-full max-w-[210mm] grid grid-cols-2 md:grid-cols-4 gap-4 select-none no-print">
                  {/* Connected Load */}
                  <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                    <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Connected Load</span>
                    <div className="mt-2.5">
                      <strong className="text-lg font-bold font-mono text-foreground block">
                        {calculatedData.totalConnectedKw.toFixed(2)} kW
                      </strong>
                    </div>
                  </div>

                  {/* Load after Diversity */}
                  <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                    <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Load after Diversity</span>
                    <div className="mt-2.5">
                      <strong className="text-lg font-bold font-mono text-foreground block">
                        {calculatedData.totalLoadAfterDiversityKw.toFixed(2)} kW
                      </strong>
                    </div>
                  </div>

                  {/* Base UPS Rating */}
                  <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                    <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">UPS Rating</span>
                    <div className="mt-2.5">
                      <strong className="text-lg font-bold font-mono text-foreground block">
                        {calculatedData.upsRatingKva.toFixed(2)} kVA
                      </strong>
                    </div>
                  </div>

                  {/* Recommended Capacity */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex flex-col justify-between shadow-md relative overflow-hidden">
                    <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">With Spare Capacity</span>
                    <div className="mt-2">
                      <strong className="text-lg font-black font-mono tracking-tight text-white block">
                        {calculatedData.finalRecommendedKva.toFixed(2)} kVA
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Printable Report Page Card */}
                <div className="w-[210mm] min-h-[297mm] bg-white dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800/60 rounded-xl p-10 shadow-lg text-slate-800 dark:text-slate-200 print:border-none print:shadow-none print:rounded-none print:p-0">
                  
                  {/* Title Header */}
                  <div className="border-b-2 border-slate-900 dark:border-slate-700 pb-5 mb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">UPS Sizing Calculation Report</h1>
                        <p className="text-[11px] text-muted-foreground mt-1">Preliminary electrical capacity sizing sheet</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded bg-slate-900 text-white dark:bg-slate-800 text-xs font-bold font-mono">
                          {calculatedData.finalRecommendedKva.toFixed(2)} kVA Recommended
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sizing coefficients */}
                  <div className="grid grid-cols-3 gap-6 text-[12px] mb-8 pb-6 border-b border-border/80">
                    <div>
                      <h4 className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5">Sizing coefficients</h4>
                      <p><strong>Diversity Factor:</strong> {diversityFactor}</p>
                      <p><strong>Power Factor:</strong> {powerFactor}</p>
                      <p><strong>Spare Capacity:</strong> {spareCapacity}%</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p><strong>Generated Date:</strong> {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Load schedule Table */}
                  <div className="mb-8">
                    <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">1. Connected Load Schedule</h3>
                    <table className="w-full text-[11px] text-left border border-slate-200 dark:border-slate-800">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[9px] tracking-wider">
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="px-3 py-2 text-center w-12 font-mono">Sr.</th>
                          <th className="px-3 py-2">Description of Load</th>
                          <th className="px-2 py-2 text-center w-16">Unit</th>
                          <th className="px-2 py-2 text-center">Qty Single</th>
                          <th className="px-2 py-2 text-center">Qty Twin</th>
                          <th className="px-2 py-2 text-center">Equip. Load</th>
                          <th className="px-2 py-2 text-center">Spare</th>
                          <th className="px-3 py-2 text-right">Connected Load (W)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {loadRows.map((r, idx) => {
                          const totalOutlets = r.qtySingle + (2 * r.qtyTwin);
                          const rowConnected = totalOutlets * r.equipmentLoad * (1 + r.spare / 100);

                          return (
                            <tr key={r.id}>
                              <td className="px-3 py-1.5 text-center font-mono">{idx + 1}</td>
                              <td className="px-3 py-1.5 font-medium">{r.description}</td>
                              <td className="px-2 py-1.5 text-center text-slate-400 font-mono">W</td>
                              <td className="px-2 py-1.5 text-center font-mono">{r.qtySingle}</td>
                              <td className="px-2 py-1.5 text-center font-mono">{r.qtyTwin}</td>
                              <td className="px-2 py-1.5 text-center font-mono">{r.equipmentLoad}</td>
                              <td className="px-2 py-1.5 text-center font-mono">{r.spare}%</td>
                              <td className="px-3 py-1.5 text-right font-mono font-semibold">{rowConnected.toFixed(0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Calculations Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[12px] mb-8">
                    <div>
                      <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">2. Calculation Summary</h3>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/10">
                        <div className="flex justify-between">
                          <span>Total Connected load:</span>
                          <strong className="font-mono">{calculatedData.totalConnectedKw.toFixed(2)} kW</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Load after Diversity:</span>
                          <strong className="font-mono">{calculatedData.totalLoadAfterDiversityKw.toFixed(2)} kW</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>UPS Sized Rating (Base):</span>
                          <strong className="font-mono">{calculatedData.upsRatingKva.toFixed(2)} kVA</strong>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-1 font-semibold text-primary">
                          <span>Final UPS Size (+Spare):</span>
                          <strong className="font-mono text-sm">{calculatedData.finalRecommendedKva.toFixed(2)} kVA</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Engineer signoff strip */}
                  <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end text-[11px] text-muted-foreground select-none">
                    <div>
                      <p>Designed By: ___________________________</p>
                      <p className="mt-2">Checked By: ___________________________</p>
                    </div>
                    <div className="text-right">
                      <p>Calculation Engine Ver: 4.0.0 (Simple)</p>
                      <p className="mt-1">© MEP Calculator, All Rights Reserved</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
