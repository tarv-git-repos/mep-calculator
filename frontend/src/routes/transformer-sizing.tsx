import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { addPdfSignatureBlock, addPdfHeader } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import {
  type LoadRow,
  STANDARD_TX_RATINGS,
  computeTransformerSizing
} from "@/lib/calc-transformer-sizing";

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import {
  Plus, Trash2, Download, Upload, Sparkles, Gauge, FileText, Printer, FileSpreadsheet, RotateCcw, Filter, ArrowUpDown, Flag, Info, Calculator, Zap, Layers, Copy, MessageSquare, Edit
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

import { CalculationPreviewModal, type CalculationPreviewData } from "@/components/calculator-framework/CalculationPreviewModal";

function TransformerSizingPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/transformer-sizing", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/transformer-sizing", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [searchQuery, setSearchQuery] = useState("");
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [intelOpen, setIntelOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<LoadRow | null>(null);
  
  const [assignCommentOpen, setAssignCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string; type: string } | null>(null);

  const handleOpenComment = (id: string, name: string) => {
    setCommentTarget({ id, name: name || "Unnamed Load", type: 'load' });
    setAssignCommentOpen(true);
  };

  const renderRowContextMenu = (r: LoadRow) => (
    <ContextMenuContent className="w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-1 text-[13px] text-slate-800 dark:text-slate-200 z-50">
      <ContextMenuItem
        onClick={() => { setLoadRows(loadRows.map(row => ({ ...row, selected: row.id === r.id }))); setIntelOpen(true); }}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded cursor-pointer transition-colors"
      >
        <Edit className="size-3.5" />
        <span>Edit Parameters</span>
      </ContextMenuItem>
      
      <ContextMenuItem
        onClick={() => handleUpdateRow(r.id, "flagged", !r.flagged)}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded cursor-pointer transition-colors"
      >
        <Flag className={`size-3.5 ${r.flagged ? "fill-red-500 text-red-500" : ""}`} />
        <span>{r.flagged ? "Unflag Load" : "Flag for Review"}</span>
      </ContextMenuItem>

      <ContextMenuItem
        onClick={() => {
          setCommentTarget({ id: r.id, name: r.description || "Unnamed Load", type: 'load' });
          setAssignCommentOpen(true);
        }}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium transition-colors"
      >
        <MessageSquare className="size-3.5" />
        <span>Add Comment / Assign Task</span>
      </ContextMenuItem>

      <ContextMenuSeparator className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
      
      <ContextMenuItem
        onClick={() => {
          const newId = `load-${Date.now()}`;
          const newRow = { ...r, id: newId };
          setLoadRows(prev => [...prev, newRow]);
        }}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded cursor-pointer transition-colors"
      >
        <Copy className="size-3.5" />
        <span>Duplicate Row</span>
      </ContextMenuItem>

      <ContextMenuItem
        onClick={() => {
          setLoadRows(prev => prev.filter(row => row.id !== r.id));
        }}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded cursor-pointer text-red-600 dark:text-red-500 transition-colors"
      >
        <Trash2 className="size-3.5" />
        <span>Delete Row</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    
    if (shouldConvert) {
      setLoadRows(prev => prev.map(r => {
        const lh = Number(r.lightingHeatingKw);
        const im = Number(r.inductiveMotorKw);
        return {
          ...r,
          lightingHeatingKw: r.lightingHeatingKw === "" ? "" : (newSystem === "ip" ? Number((lh / 0.746).toFixed(2)) : Number((lh * 0.746).toFixed(2))),
          inductiveMotorKw: r.inductiveMotorKw === "" ? "" : (newSystem === "ip" ? Number((im / 0.746).toFixed(2)) : Number((im * 0.746).toFixed(2))),
        };
      }));
    }
  };

  // Global inputs matching the screenshot
  const [designParams, setDesignParams] = useState({
    spareCapacity: 20,
    deratingFactor1: 1,
    deratingFactor2: 1,
    powerFactor: 0.8,
  });

  const defaultDemoLoads: LoadRow[] = [
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
  ];

  // Table rows
  const [loadRows, setLoadRows] = useState<LoadRow[]>(() => {
    if (typeof window === "undefined") return defaultDemoLoads;
    try {
      const pId = activeProjectId || project?.id || "default";
      const saved = localStorage.getItem(`mep_transformer_loads_${pId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultDemoLoads;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pId = activeProjectId || project?.id || "default";
      const saved = localStorage.getItem(`mep_transformer_loads_${pId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLoadRows(parsed);
        }
      }
    } catch {}
  }, [activeProjectId, project?.id]);

  // Calculations
  const calculatedData = useMemo(() => {
    return computeTransformerSizing(loadRows, designParams);
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

  const getCalculationPreview = (row: LoadRow): CalculationPreviewData => {
    const calcRow = calculatedData.rowDetails.find(r => r.id === row.id);
    const unit = unitSystem === "ip" ? "HP" : "kW";
    const L = Number(row.lightingHeatingKw || 0);
    const I = Number(row.inductiveMotorKw || 0);
    const div = Number(row.diversityFactor || 1);
    const dem = Number(row.demandFactor || 1);
    
    if (!calcRow) {
      return { title: "Transformer Load Sizing", itemName: row.description || "Unnamed Load", steps: [] };
    }
    
    return {
      title: "Transformer Load Sizing",
      itemName: row.description || "Unnamed Load",
      inputs: [
        { label: "Lighting / Heating Load", value: L, unit },
        { label: "Inductive / Motor Load", value: I, unit },
        { label: "Diversity Factor", value: div },
        { label: "Demand Factor", value: dem }
      ],
      steps: [
        {
          stepNumber: 1,
          label: "Total Connected Load (TCL)",
          formula: "TCL = L/H Load + Inductive Load",
          substitution: `${L} + ${I}`,
          result: calcRow.connectedLoad.toFixed(2),
          unit
        },
        {
          stepNumber: 2,
          label: "Sub-Total (After Diversity)",
          formula: "Sub-Total = TCL × Diversity Factor",
          substitution: `${calcRow.connectedLoad.toFixed(2)} × ${div}`,
          result: (calcRow.connectedLoad * div).toFixed(2),
          unit
        },
        {
          stepNumber: 3,
          label: "Maximum Demand (MD)",
          formula: "MD = Sub-Total × Demand Factor",
          substitution: `${(calcRow.connectedLoad * div).toFixed(2)} × ${dem}`,
          result: calcRow.maxDemand.toFixed(2),
          unit,
          status: "pass"
        }
      ],
      finalResultLabel: "Maximum Demand",
      finalResultValue: calcRow.maxDemand.toFixed(2),
      finalResultUnit: unit
    };
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

    
    const sigRow = sheet.rowCount ? sheet.rowCount + 2 : 20;
    addExcelSignatureBlock(sheet, sigRow, currentUserName, activeProjectId || "default", "transformer-sizing");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `transformer_sizing_report.xlsx`);
  };

  const handlePrintPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");

    const callAutoTable = (pdfDoc: any, options: any) => {
      if (typeof autoTable === "function") {
        autoTable(pdfDoc, options);
      } else if (typeof (autoTable as any)?.default === "function") {
        (autoTable as any).default(pdfDoc, options);
      } else if (typeof pdfDoc.autoTable === "function") {
        pdfDoc.autoTable(options);
      }
    };

    let currentY = addPdfHeader(doc, "POWER TRANSFORMER SIZING REPORT", {
      calcNo: (project as any)?.calcNo || "TRV-CAL-101-R01",
      projectNo: project?.code || (project as any)?.projectNo || "P000",
      projectName: project?.name || (project as any)?.projectName || "",
      client: (project as any)?.client || "",
      endUser: (project as any)?.endUser || (project as any)?.location || "",
      date: new Date().toLocaleDateString("en-GB"),
    });

    // 2. Design Criteria Parameters
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("Design Criteria:", 14, currentY + 5);
    doc.setFont("helvetica", "normal");
    doc.text(`Spare Capacity: ${designParams.spareCapacity}%   |   Power Factor: ${designParams.powerFactor}   |   Derating Factor 1: ${designParams.deratingFactor1}   |   Derating Factor 2: ${designParams.deratingFactor2}`, 38, currentY + 5);

    // Colors
    const primaryFill = [217, 217, 217] as [number, number, number];
    const blueFill = [218, 233, 248] as [number, number, number];

    // 3. Grid Table
    const headers = [
      [
        { content: "Sr.\nNo.", rowSpan: 2, styles: { fillColor: primaryFill } },
        { content: "Load Details", rowSpan: 2, styles: { fillColor: primaryFill } },
        { content: "Connected Load", colSpan: 3, styles: { fillColor: primaryFill } },
        { content: "Demand Parameters", colSpan: 3, styles: { fillColor: blueFill } },
        { content: "Remarks", rowSpan: 2, styles: { fillColor: primaryFill } }
      ],
      [
        { content: "Light/Heat\n(kW)" },
        { content: "Induct/Motor\n(kW)" },
        { content: "Total\n(kW)" },
        { content: "Diversity\nFactor", styles: { fillColor: blueFill } },
        { content: "Demand\nFactor", styles: { fillColor: blueFill } },
        { content: "Max Demand\n(kW)", styles: { fillColor: blueFill } }
      ]
    ];

    const data: any[] = calculatedData.rowDetails.map((r, idx) => [
      idx + 1,
      r.description,
      r.lightingHeatingKw,
      r.inductiveMotorKw,
      r.connectedLoad.toFixed(2),
      r.diversityFactor,
      r.demandFactor,
      r.maxDemand.toFixed(2),
      r.remarks || "-"
    ]);

    // Total / Summary Row at the bottom of data grid
    const grandTotalRow = [
      { content: "TOTAL", colSpan: 2, styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill } },
      { content: "-", styles: { halign: "center" } },
      { content: "-", styles: { halign: "center" } },
      { content: calculatedData.totalConnectedKw.toFixed(2), styles: { fontStyle: "bold", halign: "center" } },
      { content: "-", styles: { halign: "center" } },
      { content: "-", styles: { halign: "center" } },
      { content: calculatedData.totalMaxDemandKw.toFixed(2), styles: { fontStyle: "bold", halign: "center", fillColor: blueFill } },
      { content: "-", styles: { halign: "center" } }
    ];
    data.push(grandTotalRow);

    callAutoTable(doc, {
      startY: currentY + 10,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        minCellHeight: 6
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 40, halign: "left" },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 15, halign: "center", fillColor: [240, 247, 252] },
        6: { cellWidth: 15, halign: "center", fillColor: [240, 247, 252] },
        7: { cellWidth: 20, halign: "center", fillColor: [240, 247, 252] },
        8: { cellWidth: 28, halign: "left" }
      },
      head: headers,
      body: data,
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Summary calculations
    const summaryHead = [["Calculation Summary", "Value"]];
    const summaryData = [
      ["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(1)} kW`],
      ["Total Maximum Demand", `${calculatedData.totalMaxDemandKw.toFixed(1)} kW`],
      ["Spare Load Capacity Added", `${calculatedData.totalSpareKw.toFixed(1)} kW (${designParams.spareCapacity}%)`],
      ["Required Transformer Capacity", `${calculatedData.requiredKva.toFixed(1)} kVA`],
      ["Recommended Transformer Size", `${calculatedData.recommendedKva} kVA`],
      ["Transformer Load Utilization", `${calculatedData.utilization.toFixed(1)}%`],
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: summaryHead,
      body: summaryData,
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "left",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 }
      },
      headStyles: { fillColor: primaryFill, textColor: 0, fontStyle: "bold" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 142 },
        1: { cellWidth: 40, fontStyle: "bold", textColor: [0, 51, 153], halign: "center" },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY;
    
    // Signature block
    addPdfSignatureBlock(doc, currentY, currentUserName, project?.id || "default", "transformer-sizing");
    
    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `transformer_sizing_report.pdf`, "PDF Document", ["pdf"]);
  };

  const columns: Column<any>[] = [
    { key: "index", header: "SR. NO.", width: 60, align: "center", render: (r) => <span className="font-mono text-slate-400">{loadRows.findIndex(row => row.id === r.id) + 1}</span> },
    { key: "description", header: "DESCRIPTION", width: 180, editable: true, render: (r) => {
        const itemComments = getMergedItemComments(r.id, r.description, (r as any).comments, "/transformer-sizing", project?.id);
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
              placeholder="e.g. Area 1"
              className="font-medium text-slate-900 dark:text-slate-100 min-w-0 flex-1"
            />
          </div>
        );
    }},
    { key: "lightingHeatingKw", header: `LIGHTING / HEATING LOAD (${unitSystem === "ip" ? "HP" : "kW"})`, width: 220, align: "right", editable: true, render: (r) => (
        <InlineInput 
          type="number" 
          value={r.lightingHeatingKw} 
          onCommit={(val) => handleUpdateRow(r.id, "lightingHeatingKw", val === "" ? "" : Number(val))}
          onFocus={() => handleRowFocus(r.id)}
          placeholder="eg: 20"
          className="text-slate-900 dark:text-slate-100 tabular text-right min-w-0 flex-1"
        />
    )},
    { key: "inductiveMotorKw", header: `INDUCTIVE / MOTOR LOAD (${unitSystem === "ip" ? "HP" : "kW"})`, width: 220, align: "right", editable: true, render: (r) => (
        <InlineInput 
          type="number" 
          value={r.inductiveMotorKw} 
          onCommit={(val) => handleUpdateRow(r.id, "inductiveMotorKw", val === "" ? "" : Number(val))}
          onFocus={() => handleRowFocus(r.id)}
          placeholder="eg: 10"
          className="text-slate-900 dark:text-slate-100 tabular text-right min-w-0 flex-1"
        />
    )},
    { key: "connectedLoad", header: `TOTAL CONNECTED LOAD (${unitSystem === "ip" ? "HP" : "kW"})`, width: 220, align: "right", mono: true, render: (r) => (
        <div className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/30 w-full h-full flex items-center justify-end px-3">
          {r.connectedLoad.toFixed(2)}
        </div>
    )},
    { key: "diversityFactor", header: "DIVERSITY FACTOR", width: 150, align: "right", editable: true, render: (r) => (
        <InlineInput 
          type="number" step="0.01"
          value={r.diversityFactor} 
          onCommit={(val) => handleUpdateRow(r.id, "diversityFactor", val === "" ? "" : Number(val))}
          onFocus={() => handleRowFocus(r.id)}
          placeholder="eg: 1"
          className="text-slate-900 dark:text-slate-100 tabular text-right min-w-0 flex-1"
        />
    )},
    { key: "demandFactor", header: "DEMAND FACTOR", width: 150, align: "right", editable: true, render: (r) => (
        <InlineInput 
          type="number" step="0.01"
          value={r.demandFactor} 
          onCommit={(val) => handleUpdateRow(r.id, "demandFactor", val === "" ? "" : Number(val))}
          onFocus={() => handleRowFocus(r.id)}
          placeholder="eg: 0.85"
          className="text-slate-900 dark:text-slate-100 tabular text-right min-w-0 flex-1"
        />
    )},
    { key: "maxDemand", header: `MAXIMUM DEMAND (${unitSystem === "ip" ? "HP" : "kW"})`, width: 180, align: "right", mono: true, render: (r) => (
        <div className="font-bold text-blue-700 dark:text-blue-400 bg-slate-100/50 dark:bg-slate-800/30 w-full h-full flex items-center justify-end px-3">
          {r.maxDemand.toFixed(2)}
        </div>
    )},
    { key: "remarks", header: "REMARKS", width: 250, editable: true, render: (r) => (
        <InlineInput 
          value={r.remarks} 
          onCommit={(v) => handleUpdateRow(r.id, "remarks", v)}
          onFocus={() => {}}
          placeholder="Notes..."
          className="text-slate-500 min-w-0"
        />
    )},
    { 
      key: "flagged", 
      header: "", 
      width: 40, 
      align: "center", 
      render: (r: any) => (
        <button 
          onClick={(e) => { e.stopPropagation(); handleUpdateRow(r.id, "flagged", !r.flagged); }}
          className="flex items-center justify-center w-full h-full cursor-pointer outline-none"
          title={r.flagged ? "Unflag load" : "Flag load"}
        >
          <Flag className={`size-3.5 transition-all ${r.flagged ? "fill-red-500 text-red-500" : "text-slate-300 hover:text-slate-500"}`} />
        </button>
      )
    }
  ];

  return (
    <AppShell
      title="Transformer Sizing"
      spaceCount={loadRows.length}
      spaceCountUnit={loadRows.length === 1 ? "load" : "loads"}
      actions={<UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} disabled={isEffectiveReadOnly} />}
      intelOpen={intelOpen}
      onIntelClick={() => setIntelOpen(v => !v)}
    >
      <div className="flex h-full min-h-0 bg-transparent overflow-hidden">
        <div className="flex-1 h-full flex flex-col bg-background font-sans min-w-0">
        
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-surface-2">
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
          <div className={`flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} bg-background`}>
            
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Toolbar */}
              <div className="relative flex items-center gap-1.5 px-4 h-12 shrink-0 flex-wrap no-print border-b border-border">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter loads..."
                  className="h-7 w-56 px-3 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-full text-[12px] outline-none transition-all"
                />

                <button className="flex items-center justify-center h-7 w-7 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <Filter className="size-3.5" />
                </button>
                <button className="flex items-center justify-center h-7 w-7 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <ArrowUpDown className="size-3.5" />
                </button>


                <div className="ml-auto flex items-center gap-2">

                  <label className="relative flex items-center justify-center h-7 px-3 rounded-md border border-slate-200 dark:border-slate-700 text-[12px] font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all duration-150 shadow-sm gap-1.5 group select-none outline-none">
                    <Download className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" /> Import
                    <input type="file" onChange={handleImportJSON} accept=".json" className="hidden" />
                  </label>
                  
                  <TBtn onClick={handlePrintPDF}>
                    <FileText className="size-3.5" /> Export
                  </TBtn>
                  <TBtn primary onClick={handleAddRow}>
                    <Plus className="size-3.5" /> Add Row
                  </TBtn>
                  {loadRows.some(r => r.selected) && (
                    <TBtn onClick={handleDeleteSelected} className="border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-500/50">
                      <Trash2 className="size-3.5" /> Delete
                    </TBtn>
                  )}
                </div>
              </div>

              {/* Global Inputs */}
              <div className="bg-surface-2/50 border-b border-border px-4 py-2.5 flex flex-wrap gap-4 items-center">
                <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">SPARE CAPACITY:</span>
                    <div className="relative">
                      <input 
                        type="number"
                        value={designParams.spareCapacity}
                        onChange={(e) => setDesignParams({...designParams, spareCapacity: Number(e.target.value)})}
                        className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
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
                      className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">DERATING FACTOR 2:</span>
                    <input 
                      type="number" step="0.01"
                      value={designParams.deratingFactor2}
                      onChange={(e) => setDesignParams({...designParams, deratingFactor2: Number(e.target.value)})}
                      className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">POWER FACTOR:</span>
                    <input 
                      type="number" step="0.01"
                      value={designParams.powerFactor}
                      onChange={(e) => setDesignParams({...designParams, powerFactor: Number(e.target.value)})}
                      className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 min-h-0 flex flex-col">
                {loadRows.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-2">
                    <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center">
                      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                        <Plus className="size-6" />
                      </div>
                      <h3 className="text-[15px] font-semibold tracking-tight">No Loads Added</h3>
                      <p className="text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                        Click "Add Row" to begin sizing the transformer.
                      </p>
                    </div>
                  </div>
                ) : (
                  <DataGrid 
                    rows={calculatedData.rowDetails.filter(row => row.description.toLowerCase().includes(searchQuery.toLowerCase()) || row.remarks.toLowerCase().includes(searchQuery.toLowerCase()))}
                    columns={columns}
                    selected={new Set(loadRows.filter(r => r.selected).map(r => r.id))}
                    onToggle={(id) => {
                      const row = loadRows.find(r => r.id === id);
                      if (row) handleUpdateRow(id, "selected", !row.selected);
                    }}
                    onToggleAll={() => {
                      const allSelected = loadRows.length > 0 && loadRows.every(r => r.selected);
                      setLoadRows(loadRows.map(r => ({ ...r, selected: !allSelected })));
                    }}
                    onRowDoubleClick={(row) => setPreviewRow(row)}
                    renderContextMenu={renderRowContextMenu}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto py-6">
            <div className="flex items-center justify-end gap-3 no-print border-b border-border/80 pb-4">
              <TBtn onClick={handlePrintPDF} primary><Printer className="size-3.5" /> Print PDF</TBtn>
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
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">L/H {unitSystem === "ip" ? "HP" : "kW"}</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Ind/M {unitSystem === "ip" ? "HP" : "kW"}</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Total {unitSystem === "ip" ? "HP" : "kW"}</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Div F.</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-right">Dem F.</th>
                        <th className="p-2 text-right">Max {unitSystem === "ip" ? "HP" : "kW"}</th>
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
                <h3 className="font-bold text-[13px] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">3. Calculation Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute right-3 top-3 text-blue-500/20"><Sparkles className="size-8" /></div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">Recommended Rating</span>
                    <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.recommendedKva} <span className="text-sm text-slate-500 font-sans">kVA</span></strong>
                    <span className="text-[11px] text-slate-500 mt-2 block">Min. sizing required: {calculatedData.requiredKva.toFixed(1)} kVA</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute right-3 top-3 text-slate-500/10"><Gauge className="size-8" /></div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Total Max Demand</span>
                    <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.totalMaxDemandKw.toFixed(1)} <span className="text-sm text-slate-500 font-sans">{unitSystem === "ip" ? "HP" : "kW"}</span></strong>
                    <span className="text-[11px] text-slate-500 mt-2 block">Connected Load: {calculatedData.totalConnectedKw.toFixed(1)} {unitSystem === "ip" ? "HP" : "kW"}</span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute right-3 top-3 text-slate-500/10"><FileText className="size-8" /></div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Demand With Spare</span>
                    <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.totalDemandWithSpareKw.toFixed(1)} <span className="text-sm text-slate-500 font-sans">{unitSystem === "ip" ? "HP" : "kW"}</span></strong>
                    <span className="text-[11px] text-slate-500 mt-2 block">Spare added: {calculatedData.totalSpareKw.toFixed(1)} {unitSystem === "ip" ? "HP" : "kW"}</span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Utilization</span>
                    <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{calculatedData.utilization.toFixed(1)} <span className="text-sm text-slate-500 font-sans">%</span></strong>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${calculatedData.utilization > 90 ? 'bg-rose-500' : calculatedData.utilization < 35 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(calculatedData.utilization, 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            <CalculationReviewBar projectId={activeProjectId || project?.id || "default"} calculatorPath="/transformer-sizing" calculatorTitle="Transformer Sizing" />
            </div>
          </div>
        )}
        </div>{/* Edit Row / Calculation Preview Modal */}
                {/* Intelligence Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[400px] border-l border-border bg-background shadow-lg flex flex-col" : "w-0 border-l-0"
          }`}
        >
          {intelOpen && (
            <TransformerIntelligenceDrawer
              loadRows={loadRows}
              calculatedData={calculatedData}
              handleUpdateRow={handleUpdateRow}
              unitSystem={unitSystem}
              onClose={() => setIntelOpen(false)}
            />
          )}
        </div>

      </div>

      {/* Assign Comment Modal overlay */}
      {commentTarget && (
        <AssignCommentModal
          isOpen={assignCommentOpen}
          onClose={() => {
            setAssignCommentOpen(false);
            setCommentTarget(null);
          }}
          targetId={commentTarget.id}
          targetName={commentTarget.name}
          targetType={commentTarget.type as 'load' | 'equipment'}
          route="/transformer-sizing"
        />
      )}

      {/* Calculation Preview Modal on Double-click */}
      <CalculationPreviewModal
        isOpen={!!previewRow}
        onClose={() => setPreviewRow(null)}
        data={previewRow ? getCalculationPreview(previewRow) : null}
      />

    </AppShell>
  );
}


function TransformerIntelligenceDrawer({
  loadRows,
  calculatedData,
  handleUpdateRow,
  unitSystem,
  onClose
}: any) {
  const selectedRows = loadRows.filter((r: any) => r.selected);
  
  if (selectedRows.length !== 1) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
        <div className="p-4 border-b border-border bg-background flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles size-4 text-blue-500"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>
            <h3 className="font-semibold text-sm tracking-tight">Intelligence &amp; Parameters</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x size-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-sm text-slate-500">Select exactly one load row to view its live calculations and edit parameters.</p>
        </div>
      </div>
    );
  }

  const row = selectedRows[0];
  const calcRow = calculatedData.rowDetails.find((r: any) => r.id === row.id);
  if (!calcRow) return null;
  const unit = unitSystem === "ip" ? "HP" : "kW";

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles size-4 text-blue-500"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>
          <h3 className="font-semibold text-sm tracking-tight">Intelligence &amp; Parameters</h3>
        </div>
        <button onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x size-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* EDIT FORM */}
        <div>
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            Edit Parameters
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Load Description</label>
              <input
                type="text"
                value={row.description}
                onChange={(e) => handleUpdateRow(row.id, "description", e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:border-blue-500 outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">L/H Load ({unit})</label>
                <input
                  type="number"
                  value={row.lightingHeatingKw}
                  onChange={(e) => handleUpdateRow(row.id, "lightingHeatingKw", e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Ind. Load ({unit})</label>
                <input
                  type="number"
                  value={row.inductiveMotorKw}
                  onChange={(e) => handleUpdateRow(row.id, "inductiveMotorKw", e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Diversity F.</label>
                <input
                  type="number"
                  value={row.diversityFactor}
                  onChange={(e) => handleUpdateRow(row.id, "diversityFactor", e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Demand F.</label>
                <input
                  type="number"
                  value={row.demandFactor}
                  onChange={(e) => handleUpdateRow(row.id, "demandFactor", e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* LIVE FORMULA */}
        <div>
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 pt-4 border-t border-border">
            Live Formula Breakdown
          </h4>
          <div className="space-y-4">
            {/* Step 1 */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-border">
              <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">1. Total Connected Load (TCL)</h5>
              <div className="bg-background rounded p-2 text-xs font-mono border border-border mb-2">
                {Number(row.lightingHeatingKw || 0).toFixed(2)} + {Number(row.inductiveMotorKw || 0).toFixed(2)}
              </div>
              <div className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                TCL = {calcRow.connectedLoad.toFixed(2)} {unit}
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-border">
              <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">2. Sub-Total (After Div.)</h5>
              <div className="bg-background rounded p-2 text-xs font-mono border border-border mb-2">
                {calcRow.connectedLoad.toFixed(2)} &times; {row.diversityFactor || 1}
              </div>
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                Sub = {(calcRow.connectedLoad * Number(row.diversityFactor || 1)).toFixed(2)} {unit}
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-border">
              <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">3. Max Demand (MD)</h5>
              <div className="bg-background rounded p-2 text-xs font-mono border border-border mb-2">
                {(calcRow.connectedLoad * Number(row.diversityFactor || 1)).toFixed(2)} &times; {row.demandFactor || 1}
              </div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                MD = {calcRow.maxDemand.toFixed(2)} {unit}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

