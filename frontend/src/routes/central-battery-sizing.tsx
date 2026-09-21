import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  Plus, Trash2, Download, Upload, X, AlertTriangle, CheckCircle2,
  Gauge, FileText, Printer, FileSpreadsheet, Copy, RefreshCw,
  Filter, ArrowUpDown, Search, SlidersHorizontal, Flag, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import {
  CalculationPreviewModal,
  type CalculationPreviewData
} from "@/components/calculator-framework/CalculationPreviewModal";

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
  flagged?: boolean;
}

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  onDoubleClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, onDoubleClick }: InlineInputProps) {
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
      onDoubleClick={(e) => {
        if (onDoubleClick) {
          onDoubleClick(e);
        }
      }}
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
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"none" | "load-desc" | "load-asc">("none");
  const [filterLoad, setFilterLoad] = useState<"all" | "high" | "low">("all");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [rowDensity, setRowDensity] = useState<"default" | "compact">("default");
  const [previewRow, setPreviewRow] = useState<CBSRow | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleUnitSystemChange = (targetUnit: "ip" | "si", shouldConvert: boolean) => {
    if (shouldConvert && targetUnit !== unitSystem) {
      // Access the current powerFactor from state. 
      // If going to IP (which we use as VA), divide W by PF.
      // If going back to SI (W), multiply VA by PF.
      setRows(rows.map(r => ({
        ...r,
        emLightW: targetUnit === "ip" ? Number((r.emLightW / powerFactor).toFixed(2)) : Number((r.emLightW * powerFactor).toFixed(2)),
        exitLightW: targetUnit === "ip" ? Number((r.exitLightW / powerFactor).toFixed(2)) : Number((r.exitLightW * powerFactor).toFixed(2))
      })));
    }
    setUnitSystem(targetUnit);
  };

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

  const handleToggleFlag = (id: string) => {
    const isTargetSelected = selected.has(id);
    const targetIds = isTargetSelected ? Array.from(selected) : [id];
    const targetRow = rows.find(r => r.id === id);
    const nextFlagged = !targetRow?.flagged;

    setRows(rows.map(r => targetIds.includes(r.id) ? { ...r, flagged: nextFlagged } : r));
    toast.info(nextFlagged ? `Flagged ${targetIds.length} load(s) for review` : `Unflagged ${targetIds.length} load(s)`);
  };

  const getCalculationPreview = (row: CBSRow): CalculationPreviewData => {
    const emQty = Number(row.emLightQty) || 0;
    const emW = Number(row.emLightW) || 0;
    const exitQty = Number(row.exitLightQty) || 0;
    const exitW = Number(row.exitLightW) || 0;
    const emTotal = emQty * emW;
    const exitTotal = exitQty * exitW;
    const rowConnectedW = emTotal + exitTotal;
    const safeLF = loadingFactor <= 0 ? 0.9 : loadingFactor;
    const rowDemandW = rowConnectedW / safeLF;
    const rowDemandKw = rowDemandW / 1000;
    const safePF = powerFactor <= 0 ? 0.8 : powerFactor;
    const rowKva = rowDemandKw / safePF;
    const rowWithSpareKva = rowKva * (1 + (spareCapacity || 0) / 100);

    const unitLbl = unitSystem === "ip" ? "VA" : "W";

    return {
      title: "Central Battery Sizing Calculation Preview",
      itemName: row.description || "Unnamed Load",
      standardReference: "BS EN 50171 / NFPA 101 / IEC 60598-2-22",
      inputs: [
        { label: "Emergency Lighting Qty", value: emQty, unit: "luminaires" },
        { label: "Emergency Light Wattage", value: emW, unit: unitLbl },
        { label: "Exit Signage Qty", value: exitQty, unit: "fixtures" },
        { label: "Exit Light Wattage", value: exitW, unit: unitLbl },
        { label: "Loading Factor (LF)", value: `${(safeLF * 100).toFixed(0)}% (${safeLF})` },
        { label: "Power Factor (cos φ)", value: safePF.toFixed(2) },
        { label: "Spare Capacity", value: `${spareCapacity}%` },
      ],
      steps: [
        {
          stepNumber: 1,
          label: "Emergency Lighting Active Load",
          formula: "P_em = N_em × P_luminaire",
          substitution: `${emQty} × ${emW} ${unitLbl}`,
          result: `${emTotal.toLocaleString()} ${unitLbl}`,
          status: "pass",
          description: "Connected emergency illumination demand along normal egress paths.",
        },
        {
          stepNumber: 2,
          label: "Exit Signage Active Load",
          formula: "P_exit = N_exit × P_exit_fixture",
          substitution: `${exitQty} × ${exitW} ${unitLbl}`,
          result: `${exitTotal.toLocaleString()} ${unitLbl}`,
          status: "pass",
          description: "Internally illuminated directional exit sign power demand.",
        },
        {
          stepNumber: 3,
          label: "Total Connected Zone Load",
          formula: "P_connected = P_em + P_exit",
          substitution: `${emTotal.toLocaleString()} + ${exitTotal.toLocaleString()}`,
          result: `${rowConnectedW.toLocaleString()} ${unitLbl} (${(rowConnectedW / 1000).toFixed(3)} k${unitLbl})`,
          status: "pass",
          description: "Gross connected active load for this emergency branch circuit.",
        },
        {
          stepNumber: 4,
          label: "Design Operating Demand (Loading Factor)",
          formula: "P_demand = P_connected / LoadingFactor",
          substitution: `${(rowConnectedW / 1000).toFixed(3)} kW / ${safeLF}`,
          result: `${rowDemandKw.toFixed(3)} kW`,
          status: "pass",
          description: `Continuous operating load using design loading factor (${safeLF}).`,
        },
        {
          stepNumber: 5,
          label: "Inverter Rating Contribution (kVA)",
          formula: "S_demand = P_demand(kW) / PowerFactor",
          substitution: `${rowDemandKw.toFixed(3)} kW / ${safePF}`,
          result: `${rowKva.toFixed(3)} kVA`,
          status: "pass",
          description: `Apparent inverter power demand taking into account circuit power factor (${safePF}).`,
        },
        {
          stepNumber: 6,
          label: "Final Sized Contribution with Spare (+Spare%)",
          formula: "S_final = S_demand × (1 + Spare / 100)",
          substitution: `${rowKva.toFixed(3)} × ${(1 + spareCapacity / 100).toFixed(2)}`,
          result: `${rowWithSpareKva.toFixed(3)} kVA`,
          status: "pass",
          description: `Allocated battery inverter capacity with ${spareCapacity}% future expansion margin.`,
        },
      ],
      finalResultLabel: "Zone Battery Capacity Sized",
      finalResultValue: rowWithSpareKva.toFixed(3),
      finalResultUnit: "kVA",
      complianceNote: "Meets autonomous emergency battery system sizing guidelines under BS 5266-1 and EN 50171 for central power supply systems (CPSS).",
    };
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
    try {
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

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        }
      };

      callAutoTable(doc, {
        startY: 56,
        head: headers,
        body: data,
        theme: "striped",
        headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
        styles: { fontSize: 8 },
      });

      let nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 60;

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

      callAutoTable(doc, {
        startY: nextY,
        body: summaryData,
        theme: "plain",
        styles: { fontSize: 8.5 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 80 },
          1: { cellWidth: 50 },
        }
      });

      const sigFinalY = (doc as any).lastAutoTable?.finalY || (nextY + 30);
      addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "central-battery-sizing");
      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), "CBS_Sizing_Report.pdf", "PDF Document", ["pdf"]);
    } catch (err: any) {
      console.error("PDF Export failed:", err);
      toast.error(`PDF Export failed: ${err?.message || "Unknown error"}`);
      if (typeof window !== "undefined") {
        window.alert(`PDF Export failed! Error: ${err?.message || String(err)}\n\nPlease take a screenshot of this and tell me what it says.`);
      }
    }
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
        return (
          <span
            onDoubleClick={() => setPreviewRow(r)}
            className="text-muted-foreground font-mono cursor-pointer select-none"
            title="Double-click to open calculation preview"
          >
            {idx + 1}
          </span>
        );
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
          onDoubleClick={() => setPreviewRow(r)}
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
          onDoubleClick={() => setPreviewRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "emLightW",
      header: unitSystem === "ip" ? "Emergency Light Wattage (VA)" : "Emergency Light Wattage (W)",
      width: 150,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.emLightW}
          onCommit={(val) => handleUpdateRow(r.id, "emLightW", Number(val) || 0)}
          onDoubleClick={() => setPreviewRow(r)}
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
          onDoubleClick={() => setPreviewRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "exitLightW",
      header: unitSystem === "ip" ? "Exit Light Wattage (VA)" : "Exit Light Wattage (W)",
      width: 140,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.exitLightW}
          onCommit={(val) => handleUpdateRow(r.id, "exitLightW", Number(val) || 0)}
          onDoubleClick={() => setPreviewRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "totalW",
      header: unitSystem === "ip" ? "Total Connected Load (VA)" : "Total Connected Load (W)",
      width: 170,
      align: "right",
      render: (r) => {
        const tot = (r.emLightQty * r.emLightW) + (r.exitLightQty * r.exitLightW);
        return (
          <span
            onDoubleClick={() => setPreviewRow(r)}
            className="font-mono font-bold text-foreground text-[12.5px] cursor-pointer"
            title="Double-click to open calculation preview"
          >
            {tot.toFixed(0)}
          </span>
        );
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
          onDoubleClick={() => setPreviewRow(r)}
          className="text-muted-foreground text-[12px]"
        />
      )
    },
    {
      key: "flagged",
      header: "",
      width: 44,
      align: "center",
      render: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleFlag(r.id);
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
          title={r.flagged ? "Flagged for engineering review (click to unflag)" : "Flag load for review"}
        >
          <Flag
            className={`size-3.5 transition-all duration-200 ${
              r.flagged
                ? "fill-red-500 text-red-500 scale-110"
                : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
            }`}
          />
        </button>
      )
    }
  ], [rows, selected, unitSystem]);

  // Context Menu for CBS Sizing Row
  const renderRowContextMenu = (row: CBSRow) => {
    const isSelected = selected.has(row.id);
    const selectedIds = isSelected ? Array.from(selected) : [row.id];
    const targetsCount = selectedIds.length;

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => setPreviewRow(row)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-primary font-medium"
        >
          <Sparkles className="size-3.5" />
          <span>Calculation Preview</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => handleToggleFlag(row.id)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Flag className={`size-3.5 ${row.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          <span>{targetsCount > 1 ? (row.flagged ? "Unflag Selected" : "Flag Selected") : (row.flagged ? "Unflag Load" : "Flag for Review")}</span>
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 border-t border-border" />
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
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500"
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
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Central Battery Sizing</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} areas</span>
                </div>
                <CalculationReviewBar calculatorPath="/central-battery-sizing" calculatorTitle="Central Battery Sizing" />
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
              <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
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
                  {(() => {
                    let renderedRows = rows.filter(row => {
                      const matchesSearch = row.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            row.remarks.toLowerCase().includes(searchQuery.toLowerCase());
                      
                      let matchesFilter = true;
                      if (filterLoad === "high") {
                        matchesFilter = ((row.emLightQty * row.emLightW) + (row.exitLightQty * row.exitLightW)) > 1000;
                      } else if (filterLoad === "low") {
                        matchesFilter = ((row.emLightQty * row.emLightW) + (row.exitLightQty * row.exitLightW)) <= 1000;
                      }

                      let matchesFlag = true;
                      if (showFlaggedOnly) {
                        matchesFlag = Boolean(row.flagged);
                      }

                      return matchesSearch && matchesFilter && matchesFlag;
                    });
                    
                    if (sortOrder === "load-desc") {
                      renderedRows.sort((a, b) => ((b.emLightQty * b.emLightW) + (b.exitLightQty * b.exitLightW)) - ((a.emLightQty * a.emLightW) + (a.exitLightQty * a.exitLightW)));
                    } else if (sortOrder === "load-asc") {
                      renderedRows.sort((a, b) => ((a.emLightQty * a.emLightW) + (a.exitLightQty * a.exitLightW)) - ((b.emLightQty * b.emLightW) + (b.exitLightQty * b.exitLightW)));
                    }

                    const activeFiltersCount = (filterLoad !== "all" ? 1 : 0) + (showFlaggedOnly ? 1 : 0);
                    
                    return (
                      <>
                        {/* Toolbar */}
                        <div className="relative flex items-center gap-1.5 px-4 h-12 shrink-0 flex-wrap no-print border-b border-border bg-background">
                          {/* Bulk Actions Banner Overlay when rows are selected */}
                          {selected.size > 0 && (
                            <div className="absolute inset-0 flex items-center justify-between px-4 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{selected.size} load(s) selected</span>
                                <button
                                  onClick={clearSelection}
                                  className="text-[11px] underline hover:opacity-80 cursor-pointer ml-1"
                                >
                                  Clear selection
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    const targetIds = Array.from(selected);
                                    const anyUnflagged = targetIds.some(id => !rows.find(r => r.id === id)?.flagged);
                                    setRows(rows.map(r => targetIds.includes(r.id) ? { ...r, flagged: anyUnflagged } : r));
                                    toast.info(anyUnflagged ? `Flagged ${targetIds.length} load(s)` : `Unflagged ${targetIds.length} load(s)`);
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md border border-[#0A7BC7]/30 bg-white dark:bg-slate-900 text-[#06456F] dark:text-[#0A7BC7] hover:bg-[#0A7BC7]/10 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                  <Flag className="size-3.5 text-red-500 fill-red-500" />
                                  <span>Flag / Unflag ({selected.size})</span>
                                </button>
                                <button
                                  onClick={async () => {
                                    const targetIds = Array.from(selected);
                                    const ok = await confirm(`Are you sure you want to delete ${targetIds.length} selected loads?`);
                                    if (ok) {
                                      setRows(rows.filter(r => !targetIds.includes(r.id)));
                                      clearSelection();
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>Delete ({selected.size})</span>
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="relative flex items-center">
                            <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
                            <input
                              ref={searchInputRef}
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Filter loads..."
                              className="h-7 w-56 pl-8 pr-3 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-full text-[12px] outline-none transition-all"
                            />
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                                  activeFiltersCount > 0
                                    ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                                    : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                                }`}
                              >
                                <Filter className="size-3.5 shrink-0" />
                                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                                  Filter Loads
                                </span>
                                {activeFiltersCount > 0 && (
                                  <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                                    {activeFiltersCount}
                                  </span>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                              <div className="flex items-center justify-between pb-1.5 border-b border-border">
                                <span className="text-xs font-bold text-foreground">Filter Loads</span>
                                {activeFiltersCount > 0 && (
                                  <button
                                    onClick={() => {
                                      setFilterLoad("all");
                                      setShowFlaggedOnly(false);
                                    }}
                                    className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                                  >
                                    Reset All
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Load Range</span>
                                <select
                                  value={filterLoad}
                                  onChange={(e) => setFilterLoad(e.target.value as any)}
                                  className="h-7 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                                >
                                  <option value="all">All Loads</option>
                                  <option value="high">High Load (&gt; 1000 W)</option>
                                  <option value="low">Low Load (≤ 1000 W)</option>
                                </select>
                              </div>

                              <div className="flex items-center justify-between pt-1.5 border-t border-border">
                                <label htmlFor="filter-cbs-flagged" className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                                  <Flag className="size-3.5 text-red-500 fill-red-500" />
                                  <span>Flagged Only</span>
                                </label>
                                <input
                                  id="filter-cbs-flagged"
                                  type="checkbox"
                                  checked={showFlaggedOnly}
                                  onChange={(e) => setShowFlaggedOnly(e.target.checked)}
                                  className="size-4 rounded accent-primary cursor-pointer"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>

                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                                  sortOrder !== "none" || rowDensity === "compact"
                                    ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                                    : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                                }`}
                              >
                                <SlidersHorizontal className="size-3.5 shrink-0" />
                                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                                  View / Sort
                                </span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                              <div className="pb-1.5 border-b border-border text-xs font-bold text-foreground">
                                View Options
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Row Density</span>
                                <div className="flex rounded-full border border-border p-0.5 bg-surface-2">
                                  <button
                                    onClick={() => setRowDensity("default")}
                                    className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all cursor-pointer ${
                                      rowDensity === "default" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    Default
                                  </button>
                                  <button
                                    onClick={() => setRowDensity("compact")}
                                    className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all cursor-pointer ${
                                      rowDensity === "compact" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    Compact
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</span>
                                <select
                                  value={sortOrder}
                                  onChange={(e) => setSortOrder(e.target.value as any)}
                                  className="h-7 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                                >
                                  <option value="none">Original Order</option>
                                  <option value="load-desc">Total Load (High to Low)</option>
                                  <option value="load-asc">Total Load (Low to High)</option>
                                </select>
                              </div>
                            </PopoverContent>
                          </Popover>

                          <div className="ml-auto flex items-center gap-2">
                            <UnitToggle
                              unitSystem={unitSystem}
                              onChange={handleUnitSystemChange}
                              ipLabel="IP"
                              siLabel="SI"
                              ipDescription="Imperial (IP) [Apparent Power - VA]"
                              siDescription="Metric (SI) [Real Power - Watts]"
                              conversionExample="Convert between Real Power (Watts) and Apparent Power (VA) using the Power Factor."
                            />
                            
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

                            <TBtn onClick={handleExportPDF}>
                              <Printer className="size-3.5" /> Export PDF
                            </TBtn>

                            <TBtn primary onClick={handleAddRow}>
                              <Plus className="size-3.5" /> Add Row
                            </TBtn>
                          </div>
                        </div>

                  {/* Global Inputs */}
                  <div className="bg-surface-2/50 border-b border-border px-4 py-2.5 flex flex-wrap gap-4 items-center">
                    <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">LOADING FACTOR:</span>
                        <input
                          type="number"
                          step="0.05"
                          value={loadingFactor}
                          onChange={(e) => setLoadingFactor(Number(e.target.value))}
                          className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">POWER FACTOR:</span>
                        <input
                          type="number"
                          step="0.05"
                          value={powerFactor}
                          onChange={(e) => setPowerFactor(Number(e.target.value))}
                          className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">SPARE CAPACITY:</span>
                        <div className="relative">
                          <input
                            type="number"
                            value={spareCapacity}
                            onChange={(e) => setSpareCapacity(Number(e.target.value))}
                            className="w-16 h-7 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded px-2 font-semibold text-center outline-none focus:border-blue-500"
                          />
                          <span className="absolute right-[-14px] top-1.5 text-[10px] text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Virtualized data grid or Empty State */}
                  <div className="flex-1 min-h-[350px] flex flex-col">
                    {renderedRows.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-2">
                        <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center">
                          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                            {showFlaggedOnly ? (
                              <Flag className="size-6 text-red-500 fill-red-500" />
                            ) : searchQuery ? (
                              <Search className="size-6" />
                            ) : (
                              <Plus className="size-6" />
                            )}
                          </div>
                          <h3 className="text-[15px] font-semibold tracking-tight">
                            {showFlaggedOnly
                              ? "No Flagged Loads Found"
                              : searchQuery
                              ? "No Results Found"
                              : "No Loads Added"}
                          </h3>
                          <p className="text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                            {showFlaggedOnly
                              ? "No loads are currently flagged for engineering review."
                              : searchQuery 
                              ? `No items match the filter "${searchQuery}". Try adjusting your search.` 
                              : 'Click "Add Row" to begin sizing your central battery system.'}
                          </p>
                          {showFlaggedOnly && (
                            <TBtn onClick={() => setShowFlaggedOnly(false)}>
                              Show All Loads
                            </TBtn>
                          )}
                          {!showFlaggedOnly && searchQuery && (
                            <TBtn onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}>
                              Clear Search
                            </TBtn>
                          )}
                        </div>
                      </div>
                    ) : (
                      <DataGrid
                        rows={renderedRows}
                        columns={columns}
                        selected={selected}
                        onToggle={handleToggle}
                        onToggleAll={handleToggleAll}
                        onRowDoubleClick={(row) => setPreviewRow(row)}
                        renderContextMenu={renderRowContextMenu}
                        rowClassName={(r) => `${r.flagged ? "bg-red-500/[0.04] dark:bg-red-500/[0.08]" : ""} ${rowDensity === "compact" ? "h-[26px] text-[11px]" : ""}`}
                      />
                    )}
                  </div>
                </>
              );
            })()}
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
                            <th className="px-2 py-2 text-center">{unitSystem === "ip" ? "EM Wattage (VA)" : "EM Wattage (W)"}</th>
                            <th className="px-2 py-2 text-center">Exit Qty</th>
                            <th className="px-2 py-2 text-center">{unitSystem === "ip" ? "Exit Wattage (VA)" : "Exit Wattage (W)"}</th>
                            <th className="px-3 py-2 text-right">{unitSystem === "ip" ? "Total Connected Load (VA)" : "Total Connected Load (W)"}</th>
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
                                <td className="px-2 py-1.5 text-center font-mono">{r.emLightW} {unitSystem === "ip" ? "VA" : "W"}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{r.exitLightQty}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{r.exitLightW} {unitSystem === "ip" ? "VA" : "W"}</td>
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

      {/* Calculation Preview Modal on Double-click */}
      <CalculationPreviewModal
        isOpen={!!previewRow}
        onClose={() => setPreviewRow(null)}
        data={previewRow ? getCalculationPreview(previewRow) : null}
      />
    </AppShell>
  );
}
