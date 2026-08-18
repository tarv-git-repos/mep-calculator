import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  Plus, Trash2, Download, Upload, X, AlertTriangle, CheckCircle2,
  Gauge, FileText, Printer, FileSpreadsheet, Copy, RefreshCw
} from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useHistory, useSelection, useClipboard, useShortcuts } from "@/core/gridEngine";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";

export const Route = createFileRoute("/central-battery-sizing")({
  head: () => ({
    meta: [
      { title: "Central Battery Sizing — MEP Calc" },
      { name: "description", content: "Electrical central battery sizing calculations for emergency and exit lighting systems." },
    ],
  }),
  component: CentralBatterySizingPage,
});

interface CBSRow {
  id: string;
  description: string;
  emLightQty: number;
  emLightW: number;
  exitLightQty: number;
  exitLightW: number;
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

type Tab = "schedule" | "report";
const TABS: { id: Tab; label: string }[] = [
  { id: "schedule", label: "Sizing Schedule" },
  { id: "report", label: "Report" },
];

const STANDARD_CBS_SIZES = [
  5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 160, 200, 250, 315, 400
];

function CentralBatterySizingPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("schedule");

  // Global Constants
  const [loadingFactor, setLoadingFactor] = useState<number>(0.90);
  const [powerFactor, setPowerFactor] = useState<number>(0.80);
  const [spareCapacity, setSpareCapacity] = useState<number>(20); // 20%

  // Sizing schedule default rows
  const initialRows: CBSRow[] = useMemo(() => [
    { id: "1", description: "Ground Floor Corridor Lighting", emLightQty: 15, emLightW: 18, exitLightQty: 4, exitLightW: 8, remarks: "Safety critical path" },
    { id: "2", description: "L1 Staircase A and B Pressurized", emLightQty: 10, emLightW: 24, exitLightQty: 2, exitLightW: 8, remarks: "Escape stairs" },
    { id: "3", description: "Basement Parking Emergency Zones", emLightQty: 30, emLightW: 36, exitLightQty: 8, exitLightW: 8, remarks: "Low ceiling lighting" }
  ], []);

  // Grid Engine Hooks
  const { currentState, pushState: setRows, undo, redo } = useHistory<CBSRow>(initialRows);
  const rows = currentState || initialRows || [];
  const { selectedIds: selected, toggleSelection, selectAll, clearSelection } = useSelection(rows);
  const { copy, cut, paste } = useClipboard<CBSRow>(rows, selected, setRows);

  // Sizing Calculations Engine
  const calculatedData = useMemo(() => {
    let totalConnectedW = 0;

    rows.forEach((r) => {
      const emQty = r.emLightQty || 0;
      const emW = r.emLightW || 0;
      const exitQty = r.exitLightQty || 0;
      const exitW = r.exitLightW || 0;

      const rowConnected = (emQty * emW) + (exitQty * exitW);
      totalConnectedW += rowConnected;
    });

    const totalConnectedKw = totalConnectedW / 1000;
    
    const safeLF = loadingFactor <= 0 ? 0.9 : loadingFactor;
    const totalLoadAfterLFFactorKw = totalConnectedKw / safeLF;

    const safePF = powerFactor <= 0 ? 0.8 : powerFactor;
    const batteryRatingKva = totalLoadAfterLFFactorKw / safePF;

    const finalRecommendedKva = batteryRatingKva * (1 + spareCapacity / 100);

    // Recommend standard size
    const recStandardSize = STANDARD_CBS_SIZES.find(size => size >= finalRecommendedKva) || 400;

    return {
      totalConnectedW,
      totalConnectedKw,
      totalLoadAfterLFFactorKw,
      batteryRatingKva,
      finalRecommendedKva,
      recStandardSize
    };
  }, [rows, loadingFactor, powerFactor, spareCapacity]);

  // Validation Rules
  const validations = useMemo(() => {
    const logs: { type: "warning" | "danger"; msg: string }[] = [];

    // Quantity checks
    const zeroQty = rows.some(r => r.emLightQty < 0 || r.exitLightQty < 0);
    const missingQty = rows.some(r => r.emLightQty === 0 && r.exitLightQty === 0);
    
    // Wattage checks
    const missingW = rows.some(r => r.emLightQty > 0 && r.emLightW <= 0) || rows.some(r => r.exitLightQty > 0 && r.exitLightW <= 0);

    if (missingQty) {
      logs.push({
        type: "warning",
        msg: "One or more loads have zero emergency and exit lighting quantities."
      });
    }

    if (zeroQty) {
      logs.push({
        type: "danger",
        msg: "Lighting quantity cannot be negative."
      });
    }

    if (missingW) {
      logs.push({
        type: "warning",
        msg: "Wattage is missing for one or more active lighting fixtures."
      });
    }

    // Loading factor checks
    if (loadingFactor <= 0) {
      logs.push({
        type: "danger",
        msg: "Loading factor cannot be zero or negative."
      });
    } else if (loadingFactor > 1.0) {
      logs.push({
        type: "warning",
        msg: "Loading factor is greater than 1.0. Typically, loading should be 1.0 or less."
      });
    }

    // Power factor checks
    if (powerFactor <= 0) {
      logs.push({
        type: "danger",
        msg: "Power factor cannot be zero."
      });
    } else if (powerFactor > 1.0 || powerFactor < 0) {
      logs.push({
        type: "danger",
        msg: "Power factor must be between 0.0 and 1.0."
      });
    }

    // Spare checks
    if (spareCapacity < 0) {
      logs.push({
        type: "warning",
        msg: "Spare capacity is negative. Consider adding safety margins."
      });
    }

    return logs;
  }, [rows, loadingFactor, powerFactor, spareCapacity]);

  // CRUD Sizing schedule actions
  const handleAddRow = () => {
    const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
    setRows([
      ...rows,
      {
        id: nextId,
        description: "New Escape Light Area",
        emLightQty: 5,
        emLightW: 18,
        exitLightQty: 1,
        exitLightW: 8,
        remarks: ""
      }
    ]);
  };

  const handleDuplicateRow = (row: CBSRow) => {
    const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
    setRows([
      ...rows,
      {
        ...row,
        id: nextId,
        description: `${row.description} (Copy)`
      }
    ]);
  };

  const handleDeleteRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
    clearSelection();
  };

  const handleUpdateRow = (id: string, field: keyof CBSRow, val: any) => {
    const isBulkEdit = selected.has(id);
    setRows(rows.map(r => 
      (r.id === id || (isBulkEdit && selected.has(r.id))) ? { ...r, [field]: val } : r
    ));
  };

  const handleReset = async () => {
    const ok = await confirm("Are you sure you want to reset all calculations to defaults?");
    if (ok) {
      setRows([
        { id: "1", description: "Ground Floor Corridor Lighting", emLightQty: 15, emLightW: 18, exitLightQty: 4, exitLightW: 8, remarks: "Safety critical path" },
        { id: "2", description: "L1 Staircase A and B Pressurized", emLightQty: 10, emLightW: 24, exitLightQty: 2, exitLightW: 8, remarks: "Escape stairs" }
      ]);
      setLoadingFactor(0.90);
      setPowerFactor(0.80);
      setSpareCapacity(20);
      clearSelection();
    }
  };

  const handleToggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    toggleSelection(id, !!isCtrl, !!isShift);
  };

  const handleToggleAll = () => {
    if (selected.size === rows.length) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  // PDF Exporter
  const handleExportPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");

    // Header strip
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 25, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("CENTRAL BATTERY SYSTEM SIZING REPORT", 14, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 18);

    // Sizing factors
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("DESIGN CRITERIA", 14, 34);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Loading Factor: ${loadingFactor} | Power Factor: ${powerFactor} | Spare Capacity: ${spareCapacity}%`, 14, 40);

    // Table Header & Rows
    doc.setFont("helvetica", "bold");
    doc.text("EMERGENCY & EXIT LIGHTING LOAD SCHEDULE", 14, 52);

    const headers = [["Sr.", "Description", "Unit", "EM Qty", "EM W", "Exit Qty", "Exit W", "Total (W)", "Remarks"]];
    const data = rows.map((r, idx) => [
      idx + 1,
      r.description,
      "W",
      r.emLightQty,
      r.emLightW,
      r.exitLightQty,
      r.exitLightW,
      (r.emLightQty * r.emLightW) + (r.exitLightQty * r.exitLightW),
      r.remarks
    ]);

    autoTable(doc, {
      startY: 56,
      head: headers,
      body: data,
      theme: "striped",
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
      styles: { fontSize: 8 },
    });

    let nextY = (doc as any).lastAutoTable.finalY + 10;

    // Sizing Summary
    doc.setFont("helvetica", "bold");
    doc.text("CALCULATION RESULTS", 14, nextY);
    nextY += 4;

    const summaryData = [
      ["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(2)} kW`],
      ["Total Load after Loading Factor", `${calculatedData.totalLoadAfterLFFactorKw.toFixed(2)} kW`],
      ["Central Battery Rating", `${calculatedData.batteryRatingKva.toFixed(2)} kVA`],
      ["Final Sized Rating (+Spare)", `${calculatedData.finalRecommendedKva.toFixed(2)} kVA`],
      ["Recommended Standard Size", `${calculatedData.recStandardSize} kVA`],
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

    
    const sigFinalY = (doc as any).lastAutoTable?.finalY || 40;
    addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "central-battery-sizing");
    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), "CBS_Sizing_Report.pdf", "PDF Document", ["pdf"]);
  };

  // Excel Exporter
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Central Battery");

    sheet.mergeCells("A1:H1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "CENTRAL BATTERY SYSTEM SIZING REPORT";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 36;

    sheet.getCell("A3").value = "Loading Factor:";
    sheet.getCell("B3").value = loadingFactor;
    sheet.getCell("A4").value = "Power Factor:";
    sheet.getCell("B4").value = powerFactor;
    sheet.getCell("A5").value = "Spare Capacity:";
    sheet.getCell("B5").value = `${spareCapacity}%`;

    sheet.getColumn("A").width = 24;
    sheet.getColumn("B").width = 30;

    // Load schedule headers
    sheet.getRow(8).values = ["Sr. No.", "Description", "Unit", "EM Light Qty", "EM Light Wattage", "Exit Light Qty", "Exit Light Wattage", "Total Connected Load (W)", "Remarks"];
    sheet.getRow(8).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };

    let currentRow = 9;
    rows.forEach((r, idx) => {
      const tot = (r.emLightQty * r.emLightW) + (r.exitLightQty * r.exitLightW);
      sheet.getRow(currentRow).values = [
        idx + 1,
        r.description,
        "W",
        r.emLightQty,
        r.emLightW,
        r.exitLightQty,
        r.exitLightW,
        tot,
        r.remarks
      ];
      currentRow++;
    });

    currentRow += 2;
    sheet.getCell(`A${currentRow}`).value = "SIZING SUMMARY CALCULATIONS";
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 11 };
    currentRow++;

    const results = [
      ["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(2)} kW`],
      ["Total Load after Loading Factor", `${calculatedData.totalLoadAfterLFFactorKw.toFixed(2)} kW`],
      ["Central Battery Rating", `${calculatedData.batteryRatingKva.toFixed(2)} kVA`],
      ["Final Sized Rating (+Spare)", `${calculatedData.finalRecommendedKva.toFixed(2)} kVA`],
      ["Recommended Standard CBS Size", `${calculatedData.recStandardSize} kVA`]
    ];

    results.forEach(([lbl, val]) => {
      sheet.getCell(`A${currentRow}`).value = lbl;
      sheet.getCell(`B${currentRow}`).value = val;
      sheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
    });

    
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "central-battery-sizing");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "CBS_Sizing_Report.xlsx");
  };

  // Excel Importer
  const handleImportExcelRows = (mappedRows: any[]) => {
    const newRows: CBSRow[] = mappedRows.map((mr, idx) => ({
      id: `imported-${idx}-${Date.now()}`,
      description: mr.description || `Imported Load ${idx + 1}`,
      emLightQty: Number(mr.emLightQty) || 0,
      emLightW: Number(mr.emLightW) || 0,
      exitLightQty: Number(mr.exitLightQty) || 0,
      exitLightW: Number(mr.exitLightW) || 0,
      remarks: mr.remarks || ""
    }));

    if (newRows.length > 0) {
      setRows([...rows, ...newRows]);
    }
  };

  // DataGrid columns setup
  const columns: Column<CBSRow>[] = useMemo(() => [
    {
      key: "index",
      header: "Sr. No.",
      width: 60,
      align: "center",
      render: (r) => {
        const idx = rows.findIndex((row) => row.id === r.id);
        return <span className="text-muted-foreground font-mono">{idx + 1}</span>;
      }
    },
    {
      key: "description",
      header: "Description",
      width: 280,
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
      key: "emLightQty",
      header: "Emergency Light Quantity",
      width: 140,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.emLightQty}
          onCommit={(val) => handleUpdateRow(r.id, "emLightQty", Number(val) || 0)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "emLightW",
      header: "Emergency Light Wattage (W)",
      width: 150,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.emLightW}
          onCommit={(val) => handleUpdateRow(r.id, "emLightW", Number(val) || 0)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "exitLightQty",
      header: "Exit Light Quantity",
      width: 120,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.exitLightQty}
          onCommit={(val) => handleUpdateRow(r.id, "exitLightQty", Number(val) || 0)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "exitLightW",
      header: "Exit Light Wattage (W)",
      width: 140,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.exitLightW}
          onCommit={(val) => handleUpdateRow(r.id, "exitLightW", Number(val) || 0)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "totalW",
      header: "Total Connected Load (W)",
      width: 170,
      align: "right",
      render: (r) => {
        const tot = (r.emLightQty * r.emLightW) + (r.exitLightQty * r.exitLightW);
        return <span className="font-mono font-bold text-foreground text-[12.5px]">{tot.toFixed(0)}</span>;
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
  ], [rows, selected]);

  // Context Menu for CBS Sizing Row
  const renderRowContextMenu = (row: CBSRow) => {
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
                setRows(rows.filter(r => !selectedIds.includes(r.id)));
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
              <Copy className="size-3.5" /> Duplicate Row
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
              <Trash2 className="size-3.5" /> Delete Row
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
      setRows(rows.filter(r => !selected.has(r.id)));
      clearSelection();
    },
    onDuplicate: () => {
      if (selected.size === 0) return;
      const duplicated: CBSRow[] = [];
      rows.forEach(r => {
        if (selected.has(r.id)) {
          duplicated.push({
            ...r,
            id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            description: `${r.description} (Copy)`
          });
        }
      });
      setRows([...rows, ...duplicated]);
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
      title="Central Battery Sizing" 
      hideSubHeader={true}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6">
          
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">ELECTRICAL &gt; CENTRAL BATTERY SIZING</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Central Battery Sizing</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} areas</span>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Preliminary Central Battery System capacity sizing based on escape and exit lighting schedule.
              </p>
            </div>
          </div>

          {/* Sizing Schedule workspace container */}
          <div className="flex-1 flex flex-col gap-6 min-h-[450px] mb-6">
            <div className="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden">
              
              {/* Tab Selector row */}
              <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  {TABS.map((t) => {
                    const active = t.id === tab;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                          active
                            ? "bg-background text-foreground shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Tab View with smooth transition wrapper */}
              <div className="flex-1 relative min-h-0 overflow-hidden">
                
                {/* Schedule Tab view */}
                <div 
                  className={`absolute inset-0 flex flex-col min-h-0 transition-all duration-350 ease-in-out ${
                    tab === "schedule"
                      ? "opacity-100 translate-x-0 pointer-events-auto"
                      : "opacity-0 -translate-x-4 pointer-events-none"
                  }`}
                >
                  {/* Constants and File Upload Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/80 select-none shrink-0">
                    
                    {/* Sizing Constants inputs */}
                    <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Loading Factor:</span>
                        <input
                          type="number"
                          step="0.05"
                          value={loadingFactor}
                          onChange={(e) => setLoadingFactor(Number(e.target.value))}
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

                    {/* Actions button group */}
                    <div className="flex items-center gap-1.5">
                      <TBtn onClick={handleReset}><RefreshCw className="size-3.5" /> Reset</TBtn>
                      <ImportExcelBtn
                        columnMapping={{
                          "Description": "description",
                          "Load Name": "description",
                          "Emergency Light Quantity": "emLightQty",
                          "EM Qty": "emLightQty",
                          "Emergency Light Wattage (W)": "emLightW",
                          "EM W": "emLightW",
                          "Exit Light Quantity": "exitLightQty",
                          "Exit Qty": "exitLightQty",
                          "Exit Light Wattage (W)": "exitLightW",
                          "Exit W": "exitLightW",
                          "Remarks": "remarks"
                        }}
                        onImport={handleImportExcelRows}
                      />
                      <TBtn primary onClick={handleAddRow}><Plus className="size-3.5" /> Add Row</TBtn>
                      <TBtn
                        primary
                        onClick={() => setTab("report")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all duration-200 transform hover:scale-102 active:scale-98"
                      >
                        <Gauge className="size-3.5" /> Calculate
                      </TBtn>
                    </div>
                  </div>

                  {/* Virtualized data grid */}
                  <div className="flex-1 min-h-[350px]">
                    <DataGrid
                      rows={rows}
                      columns={columns}
                      selected={selected}
                      onToggle={handleToggle}
                      onToggleAll={handleToggleAll}
                      renderContextMenu={renderRowContextMenu}
                    />
                  </div>
                </div>

                {/* Report Tab view */}
                <div 
                  className={`absolute inset-0 overflow-y-auto bg-slate-100 dark:bg-slate-950 p-8 flex flex-col items-center gap-6 print:bg-white print:p-0 transition-all duration-350 ease-in-out ${
                    tab === "report"
                      ? "opacity-100 translate-x-0 pointer-events-auto"
                      : "opacity-0 translate-x-4 pointer-events-none"
                  }`}
                >
                  
                  {/* Ventilation style report action bar */}
                  <div className="w-full max-w-[210mm] flex items-center justify-between px-3 h-10 shrink-0 select-none no-print bg-white dark:bg-slate-900 border border-border rounded-xl shadow-xs">
                    <span className="text-[12px] text-muted-foreground font-sans">
                      Generated: <span className="text-foreground font-mono">{new Date().toLocaleDateString()}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <TBtn onClick={handleExportPDF}><Printer className="size-3.5" /> Print</TBtn>
                      <TBtn primary onClick={handleExportPDF}><FileText className="size-3.5" /> Export PDF</TBtn>
                    </div>
                  </div>

                  {/* Results Panel cards */}
                  <div className="w-full max-w-[210mm] grid grid-cols-2 md:grid-cols-5 gap-4 select-none no-print">
                    
                    {/* Total Connected Load */}
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Connected Load</span>
                      <div className="mt-2.5">
                        <strong className="text-[15px] font-bold font-mono text-foreground block">
                          {calculatedData.totalConnectedKw.toFixed(2)} kW
                        </strong>
                      </div>
                    </div>

                    {/* Total Load after Loading Factor */}
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">After Loading Factor</span>
                      <div className="mt-2.5">
                        <strong className="text-[15px] font-bold font-mono text-foreground block">
                          {calculatedData.totalLoadAfterLFFactorKw.toFixed(2)} kW
                        </strong>
                      </div>
                    </div>

                    {/* Central Battery Rating */}
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">CBS Rating</span>
                      <div className="mt-2.5">
                        <strong className="text-[15px] font-bold font-mono text-foreground block">
                          {calculatedData.batteryRatingKva.toFixed(2)} kVA
                        </strong>
                      </div>
                    </div>

                    {/* Final size including spare */}
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Sized Rating</span>
                      <div className="mt-2.5">
                        <strong className="text-[15px] font-bold font-mono text-foreground block">
                          {calculatedData.finalRecommendedKva.toFixed(2)} kVA
                        </strong>
                      </div>
                    </div>

                    {/* Selected Standard Size */}
                    <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex flex-col justify-between shadow-md relative overflow-hidden">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Standard CBS Size</span>
                      <div className="mt-2">
                        <strong className="text-[16px] font-black font-mono tracking-tight text-white block">
                          {calculatedData.recStandardSize} kVA
                        </strong>
                      </div>
                    </div>

                  </div>

                  {/* Printable report sheet paper */}
                  <div className="w-[210mm] min-h-[297mm] bg-white dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800/60 rounded-xl p-10 shadow-lg text-slate-800 dark:text-slate-200 print:border-none print:shadow-none print:rounded-none print:p-0">
                    
                    {/* Header title block */}
                    <div className="border-b-2 border-slate-900 dark:border-slate-700 pb-5 mb-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase font-sans">Central Battery Sizing Report</h1>
                          <p className="text-[11px] text-muted-foreground mt-1">Preliminary electrical capacity sizing sheet</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded bg-slate-900 text-white dark:bg-slate-800 text-xs font-bold font-mono">
                            {calculatedData.recStandardSize} kVA Recommended
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sizing coefficients */}
                    <div className="grid grid-cols-2 gap-6 text-[12px] mb-8 pb-6 border-b border-border/80">
                      <div>
                        <h4 className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5">Sizing coefficients</h4>
                        <p><strong>Loading Factor:</strong> {loadingFactor}</p>
                        <p><strong>Power Factor:</strong> {powerFactor}</p>
                        <p><strong>Spare Capacity:</strong> {spareCapacity}%</p>
                      </div>
                      <div className="text-right">
                        <p><strong>Generated Date:</strong> {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Lighting schedule */}
                    <div className="mb-8">
                      <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">1. Connected Emergency & Exit Lighting Schedule</h3>
                      <table className="w-full text-[11px] text-left border border-slate-200 dark:border-slate-800">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[9px] tracking-wider">
                          <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th className="px-3 py-2 text-center w-12 font-mono">Sr.</th>
                            <th className="px-3 py-2">Description</th>
                            <th className="px-2 py-2 text-center">EM Qty</th>
                            <th className="px-2 py-2 text-center">EM Wattage</th>
                            <th className="px-2 py-2 text-center">Exit Qty</th>
                            <th className="px-2 py-2 text-center">Exit Wattage</th>
                            <th className="px-3 py-2 text-right">Total Connected Load (W)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {rows.map((r, idx) => {
                            const tot = (r.emLightQty * r.emLightW) + (r.exitLightQty * r.exitLightW);

                            return (
                              <tr key={r.id}>
                                <td className="px-3 py-1.5 text-center font-mono">{idx + 1}</td>
                                <td className="px-3 py-1.5 font-medium">{r.description}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{r.emLightQty}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{r.emLightW} W</td>
                                <td className="px-2 py-1.5 text-center font-mono">{r.exitLightQty}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{r.exitLightW} W</td>
                                <td className="px-3 py-1.5 text-right font-mono font-semibold">{tot.toFixed(0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Calculations Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[12px] mb-8 border-b border-border/80 pb-6">
                      <div>
                        <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">2. Calculation Summary</h3>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/10">
                          <div className="flex justify-between">
                            <span>Total Connected load:</span>
                            <strong className="font-mono">{calculatedData.totalConnectedKw.toFixed(2)} kW</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Load after Loading Factor:</span>
                            <strong className="font-mono">{calculatedData.totalLoadAfterLFFactorKw.toFixed(2)} kW</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Central Battery Rating:</span>
                            <strong className="font-mono">{calculatedData.batteryRatingKva.toFixed(2)} kVA</strong>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-1 font-semibold text-primary">
                            <span>Final CBS Rating (+Spare):</span>
                            <strong className="font-mono text-sm">{calculatedData.finalRecommendedKva.toFixed(2)} kVA</strong>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">3. Sizing Constants</h3>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/10">
                          <div className="flex justify-between">
                            <span>Loading Factor:</span>
                            <strong className="font-mono">{loadingFactor}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Power Factor:</span>
                            <strong className="font-mono">{powerFactor}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Spare Capacity Margin:</span>
                            <strong className="font-mono">{spareCapacity}%</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Engineering Sizing Equations - Collapsible Reference inside report */}
                    <div className="mb-8 border-b border-border/80 pb-6">
                      <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">4. Applicable Sizing Formulae</h3>
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div>
                          <p className="font-semibold font-sans text-foreground">Connected Load Calculation:</p>
                          <span className="text-primary">Connected Load = (EM Qty * EM Watts) + (Exit Qty * Exit Watts)</span>
                        </div>
                        <div>
                          <p className="font-semibold font-sans text-foreground">Load after Loading Factor:</p>
                          <span className="text-primary">Load_after_LF = Connected Load / Loading Factor</span>
                        </div>
                        <div className="mt-2">
                          <p className="font-semibold font-sans text-foreground">Central Battery Rating (kVA):</p>
                          <span className="text-primary">Battery Rating = Load_after_LF / Power Factor</span>
                        </div>
                        <div className="mt-2">
                          <p className="font-semibold font-sans text-foreground">Final CBS Sized Rating:</p>
                          <span className="text-primary">Final Rating = Battery Rating * (1 + Spare Capacity / 100)</span>
                        </div>
                      </div>
                    </div>

                    {/* Validations warnings in report */}
                    {validations.length > 0 && (
                      <div className="mb-8 border-b border-border/80 pb-6">
                        <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3 text-red-500">5. Sizing Validations & Warnings</h3>
                        <div className="flex flex-col gap-2">
                          {validations.map((v, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="size-3.5" />
                              <span>{v.msg}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Engineer signoff strip */}
                    <div className="mt-16 pt-8 flex justify-between items-end text-[11px] text-muted-foreground select-none">
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

              </div>

            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
