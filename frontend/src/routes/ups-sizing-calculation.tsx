import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { addPdfHeader, addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  Plus, Trash2, Download, Upload, X, Gauge, FileText, Printer, FileSpreadsheet, Copy, RefreshCw,
  Filter, ArrowUpDown, Sparkles, ChevronDown, Eye, MessageSquare, Calculator, Flag, Info, Check, Boxes, Zap
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
  type LoadRow,
  computeUpsSizing
} from "@/lib/calc-ups-sizing-calculation";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min }: InlineInputProps) {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/ups-sizing-calculation", project?.id || activeProjectId);
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
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/ups-sizing-calculation", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/ups-sizing-calculation", activeProjectId || project?.id);
  const isCalcLock = useCalculationLock("/ups-sizing-calculation", activeProjectId || project?.id);
  const isApprovedLocked = isCalcLock || calcReviewState?.status === "APPROVED";

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<any>(null);

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (newComment: any) => {
    if (!commentTargetItem) return;
    const nextRows = loadRows.map((r: any) => {
      if (r.id === commentTargetItem.id) {
        return { ...r, comments: [...(r.comments || []), newComment] };
      }
      return r;
    });
    setLoadRows(nextRows);
  };
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("spaces");

  // Preview & Comment Modal States
  const [editingRow, setEditingRow] = useState<LoadRow | null>(null);
  const [previewRow, setPreviewRow] = useState<LoadRow | null>(null);
  const [commentRow, setCommentRow] = useState<LoadRow | null>(null);
  const [tempComment, setTempComment] = useState<string>("");

  // Global Sizing Factors
  const [diversityFactor, setDiversityFactor] = useState<number>(0.90);
  const [powerFactor, setPowerFactor] = useState<number>(0.80);
  const [spareCapacity, setSpareCapacity] = useState<number>(20); // 20%

  // Unit System State ("si" | "ip")
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  useEffect(() => {
    const saved = localStorage.getItem("ups_unit_system") as "si" | "ip" | null;
    if (saved === "si" || saved === "ip") {
      setUnitSystem(saved);
    }
  }, []);

  const handleUnitSystemChange = (target: "si" | "ip", shouldConvert: boolean = true) => {
    if (target === unitSystem) return;
    setUnitSystem(target);
    localStorage.setItem("ups_unit_system", target);

    if (shouldConvert) {
      const pf = powerFactor <= 0 ? 0.8 : powerFactor;
      setLoadRows(
        loadRows.map((r: LoadRow) => ({
          ...r,
          equipmentLoad:
            target === "ip"
              ? Math.round((r.equipmentLoad || 0) / pf)
              : Math.round((r.equipmentLoad || 0) * pf)
        }))
      );
    }
  };

  const initialRows: LoadRow[] = useMemo(() => [
    { id: "1", description: "Workstation Desks - Ground Floor", qtySingle: 10, qtyTwin: 20, equipmentLoad: 150, remarks: "Computers & dual monitors" },
    { id: "2", description: "Security CCTV Rack - Server Room", qtySingle: 4, qtyTwin: 4, equipmentLoad: 250, remarks: "NVR and PoE switches" },
    { id: "3", description: "Access Control Panels - Lobby", qtySingle: 2, qtyTwin: 1, equipmentLoad: 100, remarks: "Door controllers" },
    { id: "4", description: "Telecom DB Sockets - Level 1", qtySingle: 5, qtyTwin: 2, equipmentLoad: 120, remarks: "PABX rack power" }
  ], []);

  // Grid Engine Hooks
  const { currentState, pushState: setLoadRows, undo, redo } = useHistory<LoadRow>(initialRows);
  const loadRows = currentState || initialRows || [];
  const { selectedIds: selected, toggleSelection, selectAll, clearSelection } = useSelection(loadRows);
  const { copy, cut, paste } = useClipboard<LoadRow>(loadRows, selected, setLoadRows);

  // Search & Filter State
  const [query, setQuery] = useState("");
  const [filterMinLoad, setFilterMinLoad] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<"default" | "description" | "equipmentLoad" | "connectedLoad">("default");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filtered and Sorted Rows
  const filteredRows = useMemo(() => {
    let list = [...loadRows];
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          (r.remarks && r.remarks.toLowerCase().includes(q))
      );
    }
    if (filterMinLoad !== null && filterMinLoad > 0) {
      list = list.filter((r) => r.equipmentLoad >= filterMinLoad);
    }
    if (sortKey !== "default") {
      list.sort((a, b) => {
        let valA: any = a[sortKey as keyof LoadRow];
        let valB: any = b[sortKey as keyof LoadRow];

        if (sortKey === "connectedLoad") {
          const totalOutletsA = (a.qtySingle || 0) + 2 * (a.qtyTwin || 0);
          valA = totalOutletsA * (a.equipmentLoad || 0);
          const totalOutletsB = (b.qtySingle || 0) + 2 * (b.qtyTwin || 0);
          valB = totalOutletsB * (b.equipmentLoad || 0);
        }

        if (typeof valA === "string") {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [loadRows, query, filterMinLoad, sortKey, sortOrder]);

  // Sizing Calculations Engine
  const calculatedData = useMemo(() => {
    return computeUpsSizing(loadRows, diversityFactor, powerFactor, spareCapacity);
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
        remarks: ""
      }
    ]);
  };

  const handleAddRowAbove = (targetRow: LoadRow) => {
    const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
    const idx = loadRows.findIndex(r => r.id === targetRow.id);
    const newRow: LoadRow = {
      id: nextId,
      description: "New Equipment Load",
      qtySingle: 1,
      qtyTwin: 0,
      equipmentLoad: 100,
      remarks: ""
    };
    const newRows = [...loadRows];
    if (idx >= 0) newRows.splice(idx, 0, newRow);
    else newRows.push(newRow);
    setLoadRows(newRows);
    toast.success("New load row added above");
  };

  const handleAddRowBelow = (targetRow: LoadRow) => {
    const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
    const idx = loadRows.findIndex(r => r.id === targetRow.id);
    const newRow: LoadRow = {
      id: nextId,
      description: "New Equipment Load",
      qtySingle: 1,
      qtyTwin: 0,
      equipmentLoad: 100,
      remarks: ""
    };
    const newRows = [...loadRows];
    if (idx >= 0) newRows.splice(idx + 1, 0, newRow);
    else newRows.push(newRow);
    setLoadRows(newRows);
    toast.success("New load row added below");
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
        { id: "1", description: "Workstation Desks - Ground Floor", qtySingle: 10, qtyTwin: 20, equipmentLoad: 150, remarks: "Computers & dual monitors" },
        { id: "2", description: "Security CCTV Rack - Server Room", qtySingle: 4, qtyTwin: 4, equipmentLoad: 250, remarks: "NVR and PoE switches" }
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
    sheet.getRow(8).values = ["Sr. No.", "Description of Load", "Unit", "Qty Single", "Qty Twin", "Equip. Load (W)", "Connected Load (W)", "Remarks"];
    sheet.getRow(8).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };

    let currentRow = 9;
    loadRows.forEach((r, idx) => {
      const totalOutlets = (r.qtySingle || 0) + 2 * (r.qtyTwin || 0);
      const rowConnected = totalOutlets * (r.equipmentLoad || 0);
      sheet.getRow(currentRow).values = [
        idx + 1,
        r.description,
        "W",
        r.qtySingle,
        r.qtyTwin,
        r.equipmentLoad,
        rowConnected,
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

    
    const sigRow = sheet.rowCount ? sheet.rowCount + 2 : 20;
    addExcelSignatureBlock(sheet, sigRow, currentUserName, activeProjectId || "default", "ups-sizing-calculation");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "UPS_Sizing_Report.xlsx");
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");

    const startY = addPdfHeader(doc, "UPS Sizing Calculation Report", {
      calcNo: "TRV-CAL-101-R01",
      date: new Date().toLocaleDateString("en-GB"),
      projectNo: project?.code || activeProjectId || "3455",
      projectName: project?.name || "WOK",
      client: project?.client || "Client Name",
      endUser: (project as any)?.endUser || "End User",
    });

    let currentY = startY + 6;

    // Load Schedule Details Table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("1. LOAD SCHEDULE DETAILS", 14, currentY);
    currentY += 4;

    const headers = [["Sr.", "Description of Load", "Unit", "Single Qty", "Twin Qty", "Equip. Load (W)", "Connected Load (W)"]];
    let totalConnectedW = 0;
    const data: any[] = loadRows.map((r, idx) => {
      const totalOutlets = (r.qtySingle || 0) + 2 * (r.qtyTwin || 0);
      const rowConnected = totalOutlets * (r.equipmentLoad || 0);
      totalConnectedW += rowConnected;
      return [
        idx + 1,
        r.description,
        "W",
        r.qtySingle,
        r.qtyTwin,
        r.equipmentLoad,
        rowConnected.toFixed(0)
      ];
    });

    // Add TOTAL summary row
    data.push([
      "TOTAL",
      "Total Connected Load",
      "kW",
      "-",
      "-",
      "-",
      `${(totalConnectedW / 1000).toFixed(2)} kW`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: headers,
      body: data,
      theme: "grid",
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 8, textColor: [15, 23, 42] },
      didParseCell: (dataCell) => {
        if (dataCell.row.index === data.length - 1) {
          dataCell.cell.styles.fontStyle = "bold";
          dataCell.cell.styles.fillColor = [226, 232, 240];
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // Sizing Summary Results
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("2. CALCULATION SUMMARY RESULTS", 14, currentY);
    currentY += 4;

    const summaryData = [
      ["Diversity Factor", String(diversityFactor)],
      ["Power Factor", String(powerFactor)],
      ["Spare Capacity", `${spareCapacity}%`],
      ["Total Connected Load", `${calculatedData.totalConnectedKw.toFixed(2)} kW`],
      ["Total Load after Diversity", `${calculatedData.totalLoadAfterDiversityKw.toFixed(2)} kW`],
      ["Base Sized UPS Rating", `${calculatedData.upsRatingKva.toFixed(2)} kVA`],
      ["Recommended UPS Size (+Spare)", `${calculatedData.finalRecommendedKva.toFixed(2)} kVA`],
    ];

    autoTable(doc, {
      startY: currentY,
      body: summaryData,
      theme: "plain",
      styles: { fontSize: 8.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 90 },
        1: { cellWidth: 50, fontStyle: "bold" },
      }
    });

    const sigFinalY = (doc as any).lastAutoTable?.finalY || currentY + 20;
    addPdfSignatureBlock(doc, sigFinalY + 10, currentUserName, project?.id || "default", "ups-sizing-calculation");
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
        <div className="flex items-center gap-1.5 w-full">
          <InlineInput
            value={r.description}
            onCommit={(val) => handleUpdateRow(r.id, "description", val)}
            className="font-medium text-[13px] flex-1"
          />
        </div>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      width: 60,
      align: "center",
      render: () => <span className="text-muted-foreground font-mono">{unitSystem === "ip" ? "VA" : "W"}</span>
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
      header: unitSystem === "ip" ? "Equip. Load (VA)" : "Equip. Load (W)",
      width: 140,
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
      key: "connectedLoad",
      header: unitSystem === "ip" ? "Connected Load (VA)" : "Connected Load (W)",
      width: 160,
      align: "right",
      render: (r) => {
        const totalOutlets = (r.qtySingle || 0) + 2 * (r.qtyTwin || 0);
        const rowConnected = totalOutlets * (r.equipmentLoad || 0);
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
    },
    {
      key: "actions",
      header: "Actions",
      width: 75,
      align: "center",
      render: (r) => {
        // Automatic issue detection
        const missingDesc = !r.description || r.description.trim() === "";
        const noOutlets = (r.qtySingle || 0) === 0 && (r.qtyTwin || 0) === 0;
        const noLoad = (r.equipmentLoad || 0) <= 0;

        const autoReasons: string[] = [];
        if (missingDesc) autoReasons.push("Missing equipment description");
        if (noOutlets) autoReasons.push("No single/twin socket outlets specified (Qty is 0)");
        if (noLoad) autoReasons.push(`Equipment load is 0 ${unitSystem === "ip" ? "VA" : "W"}`);

        const isAutoFlagged = autoReasons.length > 0;
        const isManuallyFlagged = !!r.isFlagged;
        const isFlagged = isAutoFlagged || isManuallyFlagged;

        const flagReasonText = isAutoFlagged
          ? `⚠️ Issue: ${autoReasons.join(", ")}`
          : (r.flagReason || "Flagged for engineering review");

        return (
          <div className="flex items-center justify-center relative group">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextState = !r.isFlagged;
                handleUpdateRow(r.id, "isFlagged", nextState);
                if (nextState) {
                  toast.warning(`Flagged "${r.description || "Row"}" for review`);
                } else {
                  toast.info(`Unflagged "${r.description || "Row"}"`);
                }
              }}
              title={isFlagged ? flagReasonText : "Flag for review"}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                isFlagged
                  ? ("bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400")
                  : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              }`}
            >
              <Flag
                className={`size-4 transition-all ${
                  isFlagged
                    ? ("text-red-600 fill-red-500")
                    : "fill-none"
                }`}
              />
            </button>

            {/* Hover Tooltip Popup showing why it is flagged */}
            {isFlagged && (
              <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-xl shadow-xl pointer-events-none opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 whitespace-nowrap z-50">
                <div className="flex items-center gap-1.5">
                  <span className={"text-red-500"}>
                    {isAutoFlagged ? "⚠️" : "🚩"}
                  </span>
                  <span>{flagReasonText}</span>
                </div>
              </div>
            )}
          </div>
        );
      }
    }
  ], [loadRows, selected, unitSystem]);

  // Context Menu Renderer
  const renderRowContextMenu = (row: LoadRow) => {
    const isSelected = selected.has(row.id);
    const selectedIds = isSelected ? Array.from(selected) : [row.id];
    const targetsCount = selectedIds.length;

    return (
      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
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
              onClick={() => setEditingRow({ ...row })}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-semibold"
            >
              <Eye className="size-3.5 text-primary" /> Calculation Preview & Edit
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => {
                setCommentRow(row);
                setTempComment(row.remarks || "");
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
            >
              <MessageSquare className="size-3.5 text-blue-500" /> {row.remarks ? "Edit Comment / Remarks" : "Add Comment / Remarks"}
            </ContextMenuItem>

            <ContextMenuSeparator className="my-1 border-t border-border" />

            <ContextMenuItem
              onClick={() => handleAddRowAbove(row)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
            >
              <Plus className="size-3.5 text-emerald-500" /> Add Load Above
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => handleAddRowBelow(row)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
            >
              <Plus className="size-3.5 text-emerald-500" /> Add Load Below
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => handleDuplicateRow(row)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
            >
              <Copy className="size-3.5 text-indigo-500" /> Duplicate Load
            </ContextMenuItem>

            <ContextMenuSeparator className="my-1 border-t border-border" />

            <ContextMenuItem
              onClick={async () => {
                const ok = await confirm("Are you sure you want to delete this load?");
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
      title="UPS Sizing Calculation" 
      spaceCount={loadRows.length}
      spaceCountUnit={loadRows.length === 1 ? "load" : "loads"}
      actions={
        <UnitToggle
          unitSystem={unitSystem}
          onChange={handleUnitSystemChange}
          disabled={isEffectiveReadOnly}
          ipLabel="IP"
          siLabel="SI"
          ipDescription="Imperial (IP)"
          siDescription="Metric (SI)"
          inputDescriptions="equipment load ratings"
          conversionExample="Convert existing equipment load values between Watts (SI) and VA (IP) based on Power Factor."
        />
      }
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-3 overflow-y-auto h-full">

          {/* Card Container for Data Grid & Tabs */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} min-h-[450px] overflow-hidden mb-6`}>
            
            {/* Tabs Row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border/60 shrink-0 select-none no-print">
              <div className="flex items-center gap-3">
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
              </div>

              <span className="text-xs font-semibold text-muted-foreground">{loadRows.length} items</span>
            </div>

            {/* Sizing Schedule View */}
            {tab === "spaces" ? (
              <div className="flex-1 flex flex-col min-h-0">
                
                {/* Mockup Toolbar Header Bar */}
                <div className="flex items-center justify-between gap-2 px-3 h-10 bg-background border-b border-border/80 select-none shrink-0 no-print">
                  {/* Left Side: Filter Spaces Input, Filter Popover, Sort Popover */}
                  <div className="flex items-center gap-2">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter spaces..."
                      className="h-7 w-56 px-3 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-primary/50 focus:bg-background rounded-full text-[12px] outline-none text-foreground transition-all"
                    />

                    {/* Filter Button */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          title="Filter Loads"
                          className={`h-7 w-7 rounded-full border border-border flex items-center justify-center transition-all cursor-pointer ${
                            filterMinLoad !== null
                              ? "bg-primary/15 border-primary text-primary font-bold"
                              : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                          }`}
                        >
                          <Filter className="size-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-2.5 z-50 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-border">
                          <span className="font-semibold text-foreground">Filter Loads</span>
                          {filterMinLoad !== null && (
                            <button onClick={() => setFilterMinLoad(null)} className="text-[10px] text-primary font-semibold hover:underline">
                              Clear Filter
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10.5px] font-semibold text-muted-foreground uppercase">Min Equip Load ({unitSystem === "ip" ? "VA" : "W"})</span>
                          <input
                            type="number"
                            placeholder="e.g. 100"
                            value={filterMinLoad ?? ""}
                            onChange={(e) => setFilterMinLoad(e.target.value ? Number(e.target.value) : null)}
                            className="h-8 w-full px-2.5 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs text-foreground outline-none"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Sort Button */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          title="Sort Loads"
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
                        <span className="font-semibold text-foreground px-2 py-1 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">Sort By</span>
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
                          onClick={() => { setSortKey("equipmentLoad"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          className={`text-left px-2.5 py-1.5 rounded transition flex justify-between items-center ${sortKey === 'equipmentLoad' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'}`}
                        >
                          <span>Equip Load (W)</span>
                          {sortKey === "equipmentLoad" && <span className="text-[10px] font-mono uppercase">{sortOrder}</span>}
                        </button>
                        <button
                          onClick={() => { setSortKey("connectedLoad"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                          className={`text-left px-2.5 py-1.5 rounded transition flex justify-between items-center ${sortKey === 'connectedLoad' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-accent'}`}
                        >
                          <span>Connected Load (W)</span>
                          {sortKey === "connectedLoad" && <span className="text-[10px] font-mono uppercase">{sortOrder}</span>}
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Right Side: Import, Export, + New Space */}
                  <div className="flex items-center gap-2">
                    {/* Import Pill Button */}
                    <ImportExcelBtn columnMapping={{
                        "Description": "description",
                        "Qty (Single)": "qtySingle",
                        "Qty (Twin/Dual)": "qtyTwin",
                        "Equipment Load (W)": "equipmentLoad",
                        "Spare %": "spare",
                        "Remarks": "remarks"
                      }} onImport={handleImportExcelRows}>

                        <button className="h-7 px-3 rounded-full border border-border text-[12px] font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer transition">
                          <Upload className="size-3.5 text-muted-foreground" /> Import
                        </button>
                      
</ImportExcelBtn>

                    {/* Export PDF Button (Direct) */}
                    <button
                      onClick={handleExportPDF}
                      className="h-7 px-3 rounded-full border border-border text-[12px] font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <FileText className="size-3.5 text-muted-foreground" /> Export
                    </button>

                    {/* New Space Primary Pill Button */}
                    <button
                      onClick={handleAddRow}
                      className="bg-primary text-primary-foreground font-bold h-7 px-3.5 rounded-full text-[12px] flex items-center gap-1.5 transition hover:bg-primary/90 cursor-pointer shadow-xs"
                    >
                      <Plus className="size-3.5" /> New Space
                    </button>
                  </div>
                </div>

                {/* Sizing Constants Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/80 select-none shrink-0">
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

                  <button
                    onClick={handleReset}
                    className="text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="size-3" /> Reset Defaults
                  </button>
                </div>

                {/* Data Grid table */}
                <div className="flex-1 min-h-[350px]">
                  <DataGrid
                    rows={filteredRows}
                    columns={columns}
                    selected={selected}
                    onToggle={handleToggle}
                    onToggleAll={handleToggleAll}
                    onCommentClick={(r) => handleOpenComment(r.id, r.description)}
                    renderContextMenu={renderRowContextMenu}
                    onRowDoubleClick={(row) => setEditingRow({ ...row })}
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
                  <div className="mb-4">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">UPS Sizing Calculation Report</h1>
                  </div>

                  {/* Metadata Table Box (Matching Mockup Format) */}
                  <div className="border border-slate-900 dark:border-slate-700 text-[12px] mb-6 select-none">
                    <div className="grid grid-cols-2 divide-x divide-slate-900 dark:divide-slate-700 border-b border-slate-900 dark:border-slate-700">
                      <div className="px-3 py-1.5 flex gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 min-w-[120px]">Calculation No.:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-mono">TRV-CAL-101-R01</span>
                      </div>
                      <div className="px-3 py-1.5 flex gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 min-w-[60px]">Date:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-mono">{new Date().toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-900 dark:divide-slate-700 border-b border-slate-900 dark:border-slate-700">
                      <div className="px-3 py-1.5 flex gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 min-w-[120px]">Project No.:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-mono">{project?.code || activeProjectId || "3455"}</span>
                      </div>
                      <div className="px-3 py-1.5 flex gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 min-w-[60px]">Client:</span>
                        <span className="text-slate-800 dark:text-slate-200">{project?.client || "Client Name"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-900 dark:divide-slate-700">
                      <div className="px-3 py-1.5 flex gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 min-w-[120px]">Project Name:</span>
                        <span className="text-slate-800 dark:text-slate-200">{project?.name || "Project Title"}</span>
                      </div>
                      <div className="px-3 py-1.5 flex gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 min-w-[60px]">End User:</span>
                        <span className="text-slate-800 dark:text-slate-200">{(project as any)?.endUser || "End User"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Load schedule Table */}
                  <div className="mb-6">
                    <table className="w-full text-[11px] text-left border border-slate-900 dark:border-slate-700">
                      <thead className="bg-[#E2E8F0] dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-900 dark:border-slate-700">
                        <tr className="divide-x divide-slate-900 dark:divide-slate-700">
                          <th className="px-3 py-2 text-center w-12 font-mono">Sr. No.</th>
                          <th className="px-3 py-2">Description of Load</th>
                          <th className="px-2 py-2 text-center w-14 font-mono">Unit</th>
                          <th className="px-2 py-2 text-center">Qty Single</th>
                          <th className="px-2 py-2 text-center">Qty Twin</th>
                          <th className="px-2 py-2 text-center">{unitSystem === "ip" ? "Equip. Load (VA)" : "Equip. Load (W)"}</th>
                          <th className="px-3 py-2 text-right">{unitSystem === "ip" ? "Connected Load (VA)" : "Connected Load (W)"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 dark:divide-slate-700">
                        {loadRows.map((r, idx) => {
                          const totalOutlets = r.qtySingle + (2 * r.qtyTwin);
                          const rowConnected = totalOutlets * r.equipmentLoad;

                          return (
                            <tr key={r.id} className="divide-x divide-slate-900 dark:divide-slate-700">
                              <td className="px-3 py-1.5 text-center font-mono">{idx + 1}</td>
                              <td className="px-3 py-1.5 font-medium">{r.description}</td>
                              <td className="px-2 py-1.5 text-center text-slate-500 font-mono">{unitSystem === "ip" ? "VA" : "W"}</td>
                              <td className="px-2 py-1.5 text-center font-mono">{r.qtySingle}</td>
                              <td className="px-2 py-1.5 text-center font-mono">{r.qtyTwin}</td>
                              <td className="px-2 py-1.5 text-center font-mono">{r.equipmentLoad}</td>
                              <td className="px-3 py-1.5 text-right font-mono font-semibold">{rowConnected.toFixed(0)}</td>
                            </tr>
                          );
                        })}
                        {/* Summary Total Row */}
                        <tr className="bg-[#E2E8F0] dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 divide-x divide-slate-900 dark:divide-slate-700 border-t-2 border-slate-900 dark:border-slate-700">
                          <td className="px-3 py-2 text-center font-mono">TOTAL</td>
                          <td className="px-3 py-2">Total Connected Load ({calculatedData.totalConnectedKw.toFixed(2)} {unitSystem === "ip" ? "kVA" : "kW"})</td>
                          <td className="px-2 py-2 text-center font-mono">{unitSystem === "ip" ? "kVA" : "kW"}</td>
                          <td className="px-2 py-2 text-center font-mono">-</td>
                          <td className="px-2 py-2 text-center font-mono">-</td>
                          <td className="px-2 py-2 text-center font-mono">-</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{(calculatedData.totalConnectedKw * 1000).toFixed(0)} {unitSystem === "ip" ? "VA" : "W"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Calculation Summary Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[12px] mb-8">
                    <div className="border border-slate-900 dark:border-slate-700 p-4 rounded bg-slate-50/50 dark:bg-slate-800/20">
                      <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3 uppercase tracking-wider">Calculation Summary</h3>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between">
                          <span>Diversity Factor:</span>
                          <strong className="font-mono">{diversityFactor}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Power Factor:</span>
                          <strong className="font-mono">{powerFactor}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Spare Capacity:</span>
                          <strong className="font-mono">{spareCapacity}%</strong>
                        </div>
                        <div className="flex justify-between border-t border-slate-300 dark:border-slate-700 pt-2 mt-1">
                          <span>Total Load after Diversity:</span>
                          <strong className="font-mono">{calculatedData.totalLoadAfterDiversityKw.toFixed(2)} kW</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Base Sized UPS Rating:</span>
                          <strong className="font-mono">{calculatedData.upsRatingKva.toFixed(2)} kVA</strong>
                        </div>
                        <div className="flex justify-between border-t-2 border-slate-900 dark:border-slate-600 pt-2 mt-1 font-bold text-primary text-sm">
                          <span>Recommended UPS Size (+Spare):</span>
                          <strong className="font-mono">{calculatedData.finalRecommendedKva.toFixed(2)} kVA</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3-Tier Signature Block (Originator, Reviewer, Approver) */}
                  <div className="mt-8 border border-slate-900 dark:border-slate-700 text-[12px] overflow-hidden select-none">
                    <div className="grid grid-cols-4 bg-[#FDE8D0] dark:bg-amber-950/60 text-slate-900 dark:text-amber-100 font-bold border-b border-slate-900 dark:border-slate-700 text-center divide-x divide-slate-900 dark:divide-slate-700">
                      <div className="py-2 bg-slate-100/50 dark:bg-slate-800/50"></div>
                      <div className="py-2">Originator</div>
                      <div className="py-2">Reviewer</div>
                      <div className="py-2">Approver</div>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-slate-900 dark:divide-slate-700 border-b border-slate-900 dark:border-slate-700 text-center">
                      <div className="py-2.5 font-bold text-center bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100">Name:</div>
                      <div className="py-2.5 text-slate-800 dark:text-slate-200">{currentUserName}</div>
                      <div className="py-2.5 text-slate-400">-</div>
                      <div className="py-2.5 text-slate-400">-</div>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-slate-900 dark:divide-slate-700 text-center">
                      <div className="py-2.5 font-bold text-center bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100">Date:</div>
                      <div className="py-2.5 text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString('en-GB')}</div>
                      <div className="py-2.5 text-slate-400">-</div>
                      <div className="py-2.5 text-slate-400">-</div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Load & Live Calculations Preview Modal (Matching Busbar Tap Off / Electrical Sizing Mockup) */}
      {editingRow && typeof document !== "undefined" && createPortal(
        (() => {
          const single = editingRow.qtySingle || 0;
          const twin = editingRow.qtyTwin || 0;
          const totalOutlets = single + (2 * twin);
          const equipLoad = editingRow.equipmentLoad || 0;
          const connectedLoad = totalOutlets * equipLoad;
          const connectedKw = connectedLoad / 1000;
          const diversifiedKw = connectedKw * diversityFactor;
          const safePF = powerFactor <= 0 ? 0.8 : powerFactor;
          const upsRatingKva = diversifiedKw / safePF;
          const finalRecommendedKva = upsRatingKva * (1 + spareCapacity / 100);
          const rowIndex = loadRows.findIndex(r => r.id === editingRow.id);

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 font-sans animate-fade-in">
              <div className="bg-card border border-border rounded-3xl w-full max-w-5xl p-6 flex flex-col gap-4 shadow-2xl animate-scale-in select-none max-h-[92vh] overflow-hidden">
                
                {/* Modal Top Bar */}
                <div className="flex justify-between items-center pb-3 border-b border-border/60 shrink-0">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-lg text-foreground">Edit Equipment Load Parameters</h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold font-mono text-xs border border-primary/20">
                        Row #{rowIndex >= 0 ? rowIndex + 1 : 1}: {editingRow.description}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Configure load, outlets, equipment rating, remarks, and view live UPS sizing formula breakdown.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !editingRow.isFlagged;
                        setEditingRow({ ...editingRow, isFlagged: nextState });
                        if (nextState) toast.warning(`Flagged "${editingRow.description || "Row"}" for review`);
                        else toast.info(`Unflagged "${editingRow.description || "Row"}"`);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        editingRow.isFlagged
                          ? "bg-red-500/10 border-red-500/30 text-red-500 font-bold"
                          : "border-border/80 hover:bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Flag className={`size-3.5 ${editingRow.isFlagged ? "fill-current" : ""}`} /> {editingRow.isFlagged ? "Flagged" : "Flag"}
                    </button>
                    <div className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-xs">
                      <Info className="size-3.5" /> Calculations Preview
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingRow(null)}
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl cursor-pointer hover:bg-accent transition ml-1"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                </div>

                {/* Modal Content - 2 Columns */}
                <div className="flex gap-6 overflow-hidden flex-1 min-h-0">
                  
                  {/* Left Column: Form & Summary Cards */}
                  <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
                    
                    {/* General Parameters */}
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Boxes className="size-3.5" /> General Parameters
                      </h4>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                          Equipment / Space Load Description
                        </label>
                        <input
                          type="text"
                          value={editingRow.description}
                          onChange={(e) => setEditingRow({ ...editingRow, description: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-semibold text-foreground outline-none focus:border-primary focus:bg-background transition"
                        />
                      </div>
                    </div>

                    {/* Electrical & Outlets Parameters */}
                    <div className="flex flex-col gap-2.5">
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Zap className="size-3.5" /> Electrical & Outlet Parameters
                      </h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                            Single Socket Outlets (Qty)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editingRow.qtySingle}
                            onChange={(e) => setEditingRow({ ...editingRow, qtySingle: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-mono font-bold text-foreground outline-none focus:border-primary focus:bg-background transition"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                            Twin Socket Outlets (Qty × 2)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editingRow.qtyTwin}
                            onChange={(e) => setEditingRow({ ...editingRow, qtyTwin: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-mono font-bold text-foreground outline-none focus:border-primary focus:bg-background transition"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                            Equipment Rating ({unitSystem === "ip" ? "VA" : "W"})
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editingRow.equipmentLoad}
                            onChange={(e) => setEditingRow({ ...editingRow, equipmentLoad: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-mono font-bold text-foreground outline-none focus:border-primary focus:bg-background transition"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                            Remarks / Design Notes
                          </label>
                          <input
                            type="text"
                            value={editingRow.remarks}
                            onChange={(e) => setEditingRow({ ...editingRow, remarks: e.target.value })}
                            placeholder="e.g. Dual power supply"
                            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs text-foreground outline-none focus:border-primary focus:bg-background transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Computed Load Summary Grid */}
                    <div className="flex flex-col gap-2.5 mt-1">
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Gauge className="size-3.5" /> Computed Load Summary
                      </h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-surface-2 border border-border/70 rounded-2xl flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Connected Load (TCL)</span>
                          <strong className="text-base font-bold font-mono text-foreground">
                            {connectedKw.toFixed(2)} {unitSystem === "ip" ? "kVA" : "kW"}
                          </strong>
                          <span className="text-[10.5px] text-muted-foreground font-mono">
                            {totalOutlets} outlets × {equipLoad} {unitSystem === "ip" ? "VA" : "W"}
                          </span>
                        </div>

                        <div className="p-3 bg-surface-2 border border-border/70 rounded-2xl flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Load After Diversity</span>
                          <strong className="text-base font-bold font-mono text-foreground">
                            {diversifiedKw.toFixed(2)} {unitSystem === "ip" ? "kVA" : "kW"}
                          </strong>
                          <span className="text-[10.5px] text-muted-foreground font-mono">
                            TCL × Div ({diversityFactor})
                          </span>
                        </div>

                        <div className="p-3 bg-surface-2 border border-border/70 rounded-2xl flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">UPS Base Sizing Rating</span>
                          <strong className="text-base font-bold font-mono text-foreground">
                            {upsRatingKva.toFixed(2)} kVA
                          </strong>
                          <span className="text-[10.5px] text-muted-foreground font-mono">
                            Div Load / PF ({safePF})
                          </span>
                        </div>

                        <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Final UPS Size (+Spare %)</span>
                          <strong className="text-base font-black font-mono text-primary">
                            {finalRecommendedKva.toFixed(2)} kVA
                          </strong>
                          <span className="text-[10.5px] text-primary/80 font-mono">
                            Base + {spareCapacity}% Spare
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Formula Breakdown */}
                  <div className="w-[440px] bg-slate-100/70 dark:bg-slate-900/70 border border-border/80 rounded-2xl p-4 flex flex-col gap-3.5 overflow-y-auto shrink-0 select-none">
                    
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                        <Calculator className="size-4" /> Live Formula Breakdown
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] border border-emerald-500/20">
                        ACTIVE
                      </span>
                    </div>

                    {/* Step 1 */}
                    <div className="flex flex-col gap-1.5 text-xs">
                      <span className="font-bold text-foreground">1. TOTAL EQUIVALENT OUTLETS</span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Outlets = Single Outlets + 2 × Twin Outlets
                      </span>
                      <div className="p-3 rounded-xl bg-background border border-border font-mono text-xs flex flex-col gap-1">
                        <span className="text-muted-foreground">Outlets = {single} + 2 × {twin}</span>
                        <strong className="text-primary font-bold">Total Outlets = {totalOutlets}</strong>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex flex-col gap-1.5 text-xs">
                      <span className="font-bold text-foreground">2. TOTAL CONNECTED LOAD (TCL)</span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        TCL = Outlets × Equipment Load Rating
                      </span>
                      <div className="p-3 rounded-xl bg-background border border-border font-mono text-xs flex flex-col gap-1">
                        <span className="text-muted-foreground">TCL = {totalOutlets} × {equipLoad} {unitSystem === "ip" ? "VA" : "W"}</span>
                        <strong className="text-primary font-bold">Total TCL = {connectedKw.toFixed(2)} {unitSystem === "ip" ? "kVA" : "kW"}</strong>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex flex-col gap-1.5 text-xs">
                      <span className="font-bold text-foreground">3. MAXIMUM DIVERSITY LOAD</span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Load = TCL × Diversity Factor (Div)
                      </span>
                      <div className="p-3 rounded-xl bg-background border border-border font-mono text-xs flex flex-col gap-1">
                        <span className="text-muted-foreground">Load = {connectedKw.toFixed(2)} × {diversityFactor}</span>
                        <strong className="text-primary font-bold">Diversified Load = {diversifiedKw.toFixed(2)} {unitSystem === "ip" ? "kVA" : "kW"}</strong>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex flex-col gap-1.5 text-xs">
                      <span className="font-bold text-foreground">4. UPS SIZED RATING (BASE)</span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        UPS Rating = Diversified Load / Power Factor (PF)
                      </span>
                      <div className="p-3 rounded-xl bg-background border border-border font-mono text-xs flex flex-col gap-1">
                        <span className="text-muted-foreground">UPS Rating = {diversifiedKw.toFixed(2)} / {safePF}</span>
                        <strong className="text-primary font-bold">Base UPS Rating = {upsRatingKva.toFixed(2)} kVA</strong>
                      </div>
                    </div>

                    {/* Step 5 */}
                    <div className="flex flex-col gap-1.5 text-xs">
                      <span className="font-bold text-foreground">5. FINAL RECOMMENDED CAPACITY (+SPARE)</span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Final = Base UPS Rating × (1 + Spare % / 100)
                      </span>
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 font-mono text-xs flex flex-col gap-1">
                        <span className="text-primary/80">Final = {upsRatingKva.toFixed(2)} × (1 + {spareCapacity} / 100)</span>
                        <strong className="text-primary text-sm font-black">Final Recommended = {finalRecommendedKva.toFixed(2)} kVA</strong>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-between items-center pt-3 border-t border-border/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingRow(null)}
                    className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-accent transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoadRows(loadRows.map(r => r.id === editingRow.id ? editingRow : r));
                      toast.success(`Updated "${editingRow.description}" parameters successfully!`);
                      setEditingRow(null);
                    }}
                    className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="size-4" /> Save Changes
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Calculation Breakdown & Sizing Preview Modal */}
      {previewRow && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 font-sans animate-fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 flex flex-col gap-5 shadow-2xl animate-scale-in select-none max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Calculator className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">Calculation Preview</h3>
                  <p className="text-xs text-muted-foreground">{previewRow.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg cursor-pointer transition hover:bg-accent"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Grid Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                <span className="text-muted-foreground font-semibold">Single Outlets (N1)</span>
                <span className="text-base font-bold font-mono text-foreground">{previewRow.qtySingle || 0}</span>
              </div>
              <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                <span className="text-muted-foreground font-semibold">Twin Outlets (N2 × 2)</span>
                <span className="text-base font-bold font-mono text-foreground">{previewRow.qtyTwin || 0} ({2 * (previewRow.qtyTwin || 0)} outlets)</span>
              </div>
              <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                <span className="text-muted-foreground font-semibold">Total Equivalent Outlets</span>
                <span className="text-base font-bold font-mono text-primary">{(previewRow.qtySingle || 0) + 2 * (previewRow.qtyTwin || 0)}</span>
              </div>
              <div className="bg-surface-2 p-3 rounded-xl border border-border/50 flex flex-col gap-1">
                <span className="text-muted-foreground font-semibold">Unit Rating ({unitSystem === "ip" ? "VA" : "W"})</span>
                <span className="text-base font-bold font-mono text-foreground">{previewRow.equipmentLoad || 0} {unitSystem === "ip" ? "VA" : "W"}</span>
              </div>
            </div>

            {/* Connected Load Formula Box */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-primary uppercase tracking-wider">Connected Load Calculation</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/15 text-primary">
                  Formula: Outlets × Unit Load
                </span>
              </div>
              <div className="font-mono text-sm font-semibold text-foreground flex items-center justify-between border-t border-primary/15 pt-2 mt-1">
                <span>{`(${previewRow.qtySingle || 0} + 2 × ${previewRow.qtyTwin || 0}) × ${previewRow.equipmentLoad || 0}`}</span>
                <span className="text-lg font-bold text-primary">
                  {(((previewRow.qtySingle || 0) + 2 * (previewRow.qtyTwin || 0)) * (previewRow.equipmentLoad || 0)).toFixed(0)} {unitSystem === "ip" ? "VA" : "W"}
                </span>
              </div>
            </div>

            {/* UPS Contribution */}
            <div className="flex flex-col gap-2 border border-border/70 rounded-xl p-3 bg-card text-xs">
              <span className="font-bold text-foreground">UPS System Contribution Impact</span>
              <div className="flex justify-between text-muted-foreground border-b border-border/40 pb-1.5">
                <span>Share of Schedule Total Connected Load:</span>
                <strong className="font-mono text-foreground">
                  {(((previewRow.qtySingle || 0) + 2 * (previewRow.qtyTwin || 0)) * (previewRow.equipmentLoad || 0) > 0 && calculatedData.totalConnectedKw > 0)
                    ? (((((previewRow.qtySingle || 0) + 2 * (previewRow.qtyTwin || 0)) * (previewRow.equipmentLoad || 0)) / (calculatedData.totalConnectedKw * 1000)) * 100).toFixed(1)
                    : "0.0"}%
                </strong>
              </div>
              <div className="flex justify-between text-muted-foreground pt-0.5">
                <span>Estimated Final UPS Size Contribution (+{spareCapacity}% Spare):</span>
                <strong className="font-mono text-primary font-bold">
                  {((((previewRow.qtySingle || 0) + 2 * (previewRow.qtyTwin || 0)) * (previewRow.equipmentLoad || 0) / 1000 * diversityFactor / (powerFactor <= 0 ? 0.8 : powerFactor)) * (1 + spareCapacity / 100)).toFixed(2)} kVA
                </strong>
              </div>
            </div>

            {/* Comment / Remarks Display */}
            {previewRow.remarks && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-xs">
                <MessageSquare className="size-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-amber-600 dark:text-amber-400">Remarks / Comments</span>
                  <span className="text-muted-foreground">{previewRow.remarks}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => {
                  const r = previewRow;
                  setPreviewRow(null);
                  setCommentRow(r);
                  setTempComment(r.remarks || "");
                }}
                className="px-3 py-1.5 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-accent transition flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="size-3.5 text-blue-500" /> Edit Comment
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewRow(null);
                    setTab("report");
                  }}
                  className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="size-3.5" /> View Full Report Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewRow(null)}
                  className="px-4 py-1.5 bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add / Edit Comment Modal */}
      {commentRow && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 font-sans animate-fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl animate-scale-in select-none">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                  <MessageSquare className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Add / Edit Comment</h3>
                  <p className="text-xs text-muted-foreground">{commentRow.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCommentRow(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">Remarks / Notes</label>
              <textarea
                rows={4}
                value={tempComment}
                onChange={(e) => setTempComment(e.target.value)}
                placeholder="Enter design notes, equipment specifications, circuit tags, or comments..."
                className="w-full p-3 bg-surface-2 border border-border rounded-xl text-xs font-sans outline-none focus:border-primary focus:bg-background transition resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setCommentRow(null)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-accent transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateRow(commentRow.id, "remarks", tempComment);
                  toast.success("Remarks updated successfully!");
                  setCommentRow(null);
                }}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Save Comment
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          onSave={handleSaveComment}
          targetName={commentTargetItem.name}
          targetId={commentTargetItem.id}
          calculatorPath="/ups-sizing-calculation"
          existingComments={getMergedItemComments(commentTargetItem.id, commentTargetItem.name, (loadRows.find(r => r.id === commentTargetItem.id) as any)?.comments, "/ups-sizing-calculation", project?.id)}
        />
      )}
    </AppShell>
  );
}
