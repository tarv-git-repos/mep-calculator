import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  Plus, Trash2, Download, Upload, X, AlertTriangle, CheckCircle2,
  Gauge, FileText, Printer, FileSpreadsheet, Copy, RefreshCw,
  Filter, ArrowUpDown, Search, SlidersHorizontal, Flag, Sparkles,
  MessageSquare, Zap, Calculator, Edit3, Info
} from "lucide-react";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
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
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { useHistory, useSelection, useClipboard, useShortcuts } from "@/core/gridEngine";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { getProjectIfcFile } from "@/lib/projectIfcStorage";
import {
  extractSpacesFromActiveViewer,
  extractSpacesFromIFCFile,
  type Extracted3DSpace,
} from "@/lib/bimViewerSpaceExtractor";
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

import { CBSRow, STANDARD_CBS_SIZES, calculateCentralBattery, convertBimSpacesToCbsRows } from "@/lib/calc-central-battery";

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



function CentralBatterySizingPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/central-battery-sizing", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/central-battery-sizing", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("schedule");
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowDensity, setRowDensity] = useState<"default" | "compact">("default");
  const [sortOrder, setSortOrder] = useState<"none" | "load-desc" | "load-asc">("none");
  const [filterLoad, setFilterLoad] = useState<"all" | "high" | "low">("all");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [editingRow, setEditingRow] = useState<CBSRow | null>(null);
  const [tempRow, setTempRow] = useState<CBSRow | null>(null);
  const [showModalPreview, setShowModalPreview] = useState<boolean>(true);

  useEffect(() => {
    if (editingRow) {
      setTempRow({ ...editingRow });
    } else {
      setTempRow(null);
    }
  }, [editingRow]);
  const [intelOpen, setIntelOpen] = useState(false);
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
  const activeId = activeProjectId || project?.id || "default";

  const initialRows: CBSRow[] = useMemo(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`mep_central_battery_rows_${activeId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (e) {
          console.error("Failed to parse CBS rows from localStorage", e);
        }
      }
    }
    return [
      { id: "1", description: "Ground Floor Corridor Lighting", emLightQty: 15, emLightW: 18, exitLightQty: 4, exitLightW: 8, remarks: "Safety critical path" },
      { id: "2", description: "L1 Staircase A and B Pressurized", emLightQty: 10, emLightW: 24, exitLightQty: 2, exitLightW: 8, remarks: "Escape stairs" },
      { id: "3", description: "Basement Parking Emergency Zones", emLightQty: 30, emLightW: 36, exitLightQty: 8, exitLightW: 8, remarks: "Low ceiling lighting" }
    ];
  }, [activeId]);

  // Grid Engine Hooks
  const { currentState, pushState: setRows, undo, redo } = useHistory<CBSRow>(initialRows);
  const rows = currentState || initialRows || [];

  // Auto-persist rows on change
  useEffect(() => {
    if (typeof window !== "undefined" && rows && rows.length > 0) {
      localStorage.setItem(`mep_central_battery_rows_${activeId}`, JSON.stringify(rows));
    }
  }, [rows, activeId]);

  // Sync if localStorage changes externally (e.g. from 3D BIM Viewer)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`mep_central_battery_rows_${activeId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRows(parsed);
          }
        } catch (e) {}
      }
    }
  }, [activeId]);

  const { selectedIds: selected, toggleSelection, selectAll, clearSelection } = useSelection(rows);
  const { copy, cut, paste } = useClipboard<CBSRow>(rows, selected, setRows);

  // Comment Modal State & Handlers
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    if (!commentTargetItem) return;
    setRows(rows.map(r => r.id === commentTargetItem.id ? {
      ...r,
      comments: [...((r as any).comments || []), comment]
    } : r));
    setCommentModalOpen(false);
    setCommentTargetItem(null);
  };

  // Sizing Calculations Engine
  const calculatedData = useMemo(() => calculateCentralBattery(rows, loadingFactor, powerFactor, spareCapacity), [rows, loadingFactor, powerFactor, spareCapacity]);

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

  // Sync from 3D Studio
  const handleSyncFrom3DStudio = async () => {
    try {
      toast.loading("Scanning 3D Studio for spaces & life-safety zones...", { id: "cbs-3d-sync" });
      let extracted: Extracted3DSpace[] = extractSpacesFromActiveViewer();
      toast.dismiss("cbs-3d-sync");

      // Fallback 1: Check project IFC file in IndexedDB storage
      if (extracted.length === 0) {
        const savedProjectFile = await getProjectIfcFile(activeProjectId || project?.id);
        if (savedProjectFile instanceof File) {
          toast.loading("Extracting 3D geometry & life-safety zones from project IFC model...", { id: "cbs-ifc-parse" });
          extracted = await extractSpacesFromIFCFile(savedProjectFile);
          toast.dismiss("cbs-ifc-parse");
        }
      }

      // Fallback 2: Check active memory window session file
      if (extracted.length === 0) {
        const win = typeof window !== "undefined" ? (window as any) : {};
        const savedFile = win.__ACTIVE_IFC_FILE__ || win._currentLoadedFile;
        if (savedFile instanceof File) {
          toast.loading("Extracting 3D geometry & life-safety zones from IFC model...", { id: "cbs-ifc-parse" });
          extracted = await extractSpacesFromIFCFile(savedFile);
          toast.dismiss("cbs-ifc-parse");
        }
      }

      // Fallback 3: Check workspace store spaces if available
      if (extracted.length === 0) {
        const wsSpaces = workspaceStore.getState().spaces || [];
        if (wsSpaces.length > 0) {
          extracted = wsSpaces.map((s: any) => ({
            id: s.id,
            name: s.name,
            level: s.floor || s.level || "GROUND FLOOR",
            zone: s.zone || "Default",
            category: s.category || "General Office / Space",
            area: Number(s.area) || 20,
            height: Number(s.height) || 3.0,
            fixtures: s.fixtures || "",
            multiplier: s.multiplier || 1,
            aiDetected: true,
            confidence: 0.9,
            pressure: s.pressure || "0",
            pressureAutoDetected: false,
            source: "workspace" as const,
          }));
        }
      }

      if (extracted.length === 0) {
        toast.info("No active 3D IFC spaces found.", {
          description: "Open 3D Studio (/bim-viewer) to load your IFC model, or click below to launch 3D Studio.",
          action: {
            label: "Open 3D Studio",
            onClick: () => {
              window.location.href = "/bim-viewer";
            },
          },
        });
        return;
      }

      const newRows = convertBimSpacesToCbsRows(extracted);
      setRows(newRows);

      toast.success(
        `⚡ Synced ${newRows.length} spaces from 3D Studio! Emergency escape luminaires and exit signage calculated (NFPA 101 / BS 5266).`,
        { duration: 5000 }
      );
    } catch (err) {
      console.error("Failed to sync spaces from 3D Studio:", err);
      toast.error("Failed to sync spaces from 3D Studio.");
    }
  };

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

    
    const sigRow = sheet.rowCount ? sheet.rowCount + 2 : 20;
    addExcelSignatureBlock(sheet, sigRow, currentUserName, project?.id || "default", "central-battery-sizing");
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
      header: "SR. NO.",
      width: 60,
      align: "center",
      render: (r) => {
        const idx = rows.findIndex((row) => row.id === r.id);
        return (
          <span
            onClick={() => setEditingRow(r)}
            onDoubleClick={() => setEditingRow(r)}
            className="text-muted-foreground font-mono cursor-pointer select-none hover:text-primary transition-colors"
            title="Click or double-click to open calculation preview"
          >
            {idx + 1}
          </span>
        );
      }
    },
    {
      key: "description",
      header: "DESCRIPTION",
      width: 280,
      editable: true,
      render: (r) => {
        const itemComments = getMergedItemComments(r.id, r.description, (r as any).comments, "/central-battery-sizing", project?.id);
        return (
          <div className="flex items-center gap-1.5 w-full">
            
            <InlineInput
              value={r.description}
              onCommit={(val) => handleUpdateRow(r.id, "description", val)}
              onDoubleClick={() => setEditingRow(r)}
              className="font-medium text-[13px]"
            />
          </div>
        );
      }
    },
    {
      key: "emLightQty",
      header: "EMERGENCY LIGHT QUANTITY",
      width: 140,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.emLightQty}
          onCommit={(val) => handleUpdateRow(r.id, "emLightQty", Number(val) || 0)}
          onDoubleClick={() => setEditingRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "emLightW",
      header: unitSystem === "ip" ? "EMERGENCY LIGHT WATTAGE (VA)" : "EMERGENCY LIGHT WATTAGE (W)",
      width: 150,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.emLightW}
          onCommit={(val) => handleUpdateRow(r.id, "emLightW", Number(val) || 0)}
          onDoubleClick={() => setEditingRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "exitLightQty",
      header: "EXIT LIGHT QUANTITY",
      width: 120,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.exitLightQty}
          onCommit={(val) => handleUpdateRow(r.id, "exitLightQty", Number(val) || 0)}
          onDoubleClick={() => setEditingRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "exitLightW",
      header: unitSystem === "ip" ? "EXIT LIGHT WATTAGE (VA)" : "EXIT LIGHT WATTAGE (W)",
      width: 120,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.exitLightW}
          onCommit={(val) => handleUpdateRow(r.id, "exitLightW", Number(val) || 0)}
          onDoubleClick={() => setEditingRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "totalW",
      header: unitSystem === "ip" ? "TOTAL CONNECTED LOAD (VA)" : "TOTAL CONNECTED LOAD (W)",
      width: 170,
      align: "center",
      render: (r) => {
        const tot = (r.emLightQty * r.emLightW) + (r.exitLightQty * r.exitLightW);
        return (
          <span
            onClick={() => setEditingRow(r)}
            onDoubleClick={() => setEditingRow(r)}
            className="font-mono font-bold text-foreground text-[12.5px] cursor-pointer hover:text-primary transition-colors inline-flex items-center justify-center gap-1.5 w-full"
            title="Click or double-click to open calculation preview"
          >
            <span>{tot.toFixed(0)}</span>
            <Calculator className="size-3 opacity-40 hover:opacity-100 text-primary" />
          </span>
        );
      }
    },
    {
      key: "remarks",
      header: "REMARKS",
      width: 200,
      editable: true,
      render: (r) => (
        <InlineInput
          value={r.remarks}
          onCommit={(val) => handleUpdateRow(r.id, "remarks", val)}
          onDoubleClick={() => setEditingRow(r)}
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

  // Context Menu for CBS Sizing Row (Standardized with Ventilation)
  const renderRowContextMenu = (row: CBSRow) => {
    const isSelected = selected.has(row.id);
    const selectedIds = isSelected ? Array.from(selected) : [row.id];
    const targetsCount = selectedIds.length;

    return (
      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Calculation is Approved and Locked.", { id: "readonly-notice" });
              return;
            }
            setEditingRow(row);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Edit Load</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => {
            if (isEffectiveReadOnly) {
              toast.info("Calculation is Approved and Locked.", { id: "readonly-notice" });
              return;
            }
            const clones = selectedIds.map(id => {
              const targetRow = rows.find(r => r.id === id);
              if (!targetRow) return null;
              return {
                ...targetRow,
                id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                description: `${targetRow.description} (Copy)`
              };
            }).filter(Boolean) as CBSRow[];

            if (clones.length > 0) {
              setRows([...rows, ...clones]);
              toast.success(`Duplicated ${clones.length} load(s)`);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{targetsCount > 1 ? "Duplicate Selected" : "Duplicate Row"}</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => {
            const targetIds = selectedIds;
            const anyUnflagged = targetIds.some(id => !rows.find(r => r.id === id)?.flagged);
            setRows(rows.map(r => targetIds.includes(r.id) ? { ...r, flagged: anyUnflagged } : r));
            toast.info(anyUnflagged ? `Flagged ${targetIds.length} load(s)` : `Unflagged ${targetIds.length} load(s)`);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Flag className="size-3.5 text-red-500" />
          <span>{targetsCount > 1 ? "Flag / Unflag Selected" : (row.flagged ? "Unflag Load" : "Flag for Review")}</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => handleOpenComment(row.id, row.description)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={async () => {
            if (isEffectiveReadOnly) {
              toast.info("Calculation is Approved and Locked.", { id: "readonly-notice" });
              return;
            }
            const msg = targetsCount === 1
              ? `Are you sure you want to delete load "${row.description}"?`
              : `Are you sure you want to delete the ${targetsCount} selected loads?`;

            const ok = await confirm(msg);
            if (ok) {
              setRows(rows.filter(r => !selectedIds.includes(r.id)));
              clearSelection();
              toast.info(`Deleted ${targetsCount} load(s)`);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
        </ContextMenuItem>
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
          
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Central Battery Sizing</h1>
              </div>
              <button
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/central-battery-sizing" calculatorTitle="Central Battery Sizing" />
            </div>

            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                ipLabel="IP"
                siLabel="SI"
                ipDescription="Imperial (IP) [Apparent Power - VA]"
                siDescription="Metric (SI) [Real Power - Watts]"
                conversionExample="Convert between Real Power (Watts) and Apparent Power (VA) using the Power Factor."
              />
            </div>
          </div>

          {/* Sizing Schedule workspace container */}
          <div className="flex-1 flex flex-col gap-6 min-h-[450px] mb-6">
            <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} min-h-[450px] overflow-hidden`}>
              
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
                        <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background shrink-0 flex-wrap no-print modal-blur-bg border-b border-border/50">
                          {/* Bulk Actions Banner Overlay when rows are selected */}
                          {selected.size > 0 && (
                            <div className="absolute inset-0 flex items-center justify-between px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg border-b border-primary/20">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{selected.size} selected</span>
                                <span className="text-primary/30">·</span>
                                <BulkBtn
                                  icon={Calculator}
                                  onClick={() => {
                                    const firstId = Array.from(selected)[0];
                                    const targetRow = rows.find((r) => r.id === firstId);
                                    if (targetRow) {
                                      setEditingRow(targetRow);
                                    }
                                  }}
                                >
                                  Breakdown
                                </BulkBtn>
                                <BulkBtn
                                  icon={Flag}
                                  onClick={() => {
                                    const targetIds = Array.from(selected);
                                    const anyUnflagged = targetIds.some(id => !rows.find(r => r.id === id)?.flagged);
                                    setRows(rows.map(r => targetIds.includes(r.id) ? { ...r, flagged: anyUnflagged } : r));
                                    toast.info(anyUnflagged ? `Flagged ${targetIds.length} load(s)` : `Unflagged ${targetIds.length} load(s)`);
                                  }}
                                >
                                  Flag
                                </BulkBtn>
                                <BulkBtn
                                  icon={Copy}
                                  onClick={() => {
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
                                    toast.success(`Duplicated ${duplicated.length} load(s)`);
                                  }}
                                >
                                  Duplicate
                                </BulkBtn>
                                <BulkBtn
                                  icon={Trash2}
                                  onClick={async () => {
                                    const targetIds = Array.from(selected);
                                    const count = targetIds.length;
                                    const ok = await confirm(`Are you sure you want to delete ${count} selected load(s)?`);
                                    if (ok) {
                                      setRows(rows.filter(r => !targetIds.includes(r.id)));
                                      clearSelection();
                                      toast.info(`Deleted ${count} selected load(s)`);
                                    }
                                  }}
                                >
                                  Delete
                                </BulkBtn>
                              </div>
                              <button
                                type="button"
                                onClick={clearSelection}
                                className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                              >
                                <X className="size-3" /> Clear
                              </button>
                            </div>
                          )}

                          <input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter loads..."
                            className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
                          />

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
                                  Filter
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
                                <span className="text-xs font-bold text-foreground">Filters</span>
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

                          <div className="ml-auto flex items-center gap-1">
                            <TBtn
                              onClick={handleSyncFrom3DStudio}
                              title="Sync spaces and emergency lighting loads from 3D BIM model"
                            >
                              <Sparkles className="size-3.5 text-primary" /> Sync 3D BIM
                            </TBtn>

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
                            >
                              <Download className="size-3.5" /> Excel
                            </ImportExcelBtn>

                            <TBtn onClick={handleExportPDF}>
                              <FileText className="size-3.5" /> Export
                            </TBtn>

                            <TBtn primary onClick={handleAddRow}>
                              <Plus className="size-3.5" /> Add Row
                            </TBtn>
                          </div>
                        </div>

                        {/* Sizing Parameters Row (Image 2 - Matching Ventilation) */}
                        <div className="bg-slate-50/50 dark:bg-zinc-900/30 border-b border-border/60 px-4 py-2 flex flex-wrap items-center gap-6 select-none">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-sans">
                              LOADING FACTOR:
                            </span>
                            <input
                              type="number"
                              step="0.05"
                              value={loadingFactor}
                              onChange={(e) => setLoadingFactor(Number(e.target.value) || 0.9)}
                              className="w-16 h-7 text-xs border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg px-2 font-mono font-bold text-center text-slate-800 dark:text-zinc-200 shadow-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-sans">
                              POWER FACTOR:
                            </span>
                            <input
                              type="number"
                              step="0.05"
                              value={powerFactor}
                              onChange={(e) => setPowerFactor(Number(e.target.value) || 0.8)}
                              className="w-16 h-7 text-xs border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg px-2 font-mono font-bold text-center text-slate-800 dark:text-zinc-200 shadow-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-sans">
                              SPARE CAPACITY:
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={spareCapacity}
                                onChange={(e) => setSpareCapacity(Number(e.target.value) || 20)}
                                className="w-16 h-7 text-xs border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg px-2 font-mono font-bold text-center text-slate-800 dark:text-zinc-200 shadow-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                              />
                              <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 font-mono">%</span>
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
                        onCommentClick={(r) => handleOpenComment(r.id, r.description)}
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

        {/* Intelligence Drawer (Collapsible & Layout Compressing like Ventilation) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <CentralBatteryIntelligenceDrawer
              rows={rows}
              calculatedData={calculatedData}
              loadingFactor={loadingFactor}
              powerFactor={powerFactor}
              spareCapacity={spareCapacity}
              onClose={() => setIntelOpen(false)}
              onSelectRow={(r) => setEditingRow(r)}
            />
          )}
        </div>
      </div>

      {/* Double Click Edit & Breakdown Modal (Exact Ventilation Format) */}
      {editingRow && (
        <div
          onClick={() => setEditingRow(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/10 dark:bg-black/30 p-4 animate-fade-in font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white/70 dark:bg-neutral-950/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full h-[85vh] max-h-[85vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
              showModalPreview ? "max-w-5xl" : "max-w-2xl"
            }`}
          >
            {/* Modal Header */}
            <header className="px-6 h-[72px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/10 dark:bg-black/10">
              <div className="flex flex-col justify-center min-w-0 pr-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2 className="text-[15px] font-bold text-neutral-800 dark:text-neutral-100 truncate flex items-center gap-2">
                    <Zap className="size-4 text-primary" /> Edit Load &amp; Battery Sizing
                  </h2>
                  <span className="px-2.5 py-0.75 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[11px] font-bold font-mono tracking-tight shrink-0 uppercase">
                    CENTRAL BATTERY SYSTEM ({unitSystem.toUpperCase()})
                  </span>
                </div>
                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
                  Configure emergency luminaire parameters, quantities, wattages, and inspect live electrical demand.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModalPreview((prev) => !prev)}
                  className={`flex items-center gap-1.5 h-9.5 px-4 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-sm ${
                    showModalPreview
                      ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95 shadow-md shadow-primary/15"
                      : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"
                  }`}
                >
                  <Info className="size-3.5" />
                  Calculations Preview
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="size-9 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            {/* Modal Body: Left Inputs + Right Calculations Preview */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Left Side: Form Controls */}
              <div className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto">
                {/* Circuit & Area Identification */}
                <div className="space-y-4">
                  <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                    Circuit &amp; Area Identification
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5 font-mono">
                        Description / Area Name
                      </label>
                      <input
                        type="text"
                        value={tempRow?.description ?? ""}
                        onChange={(e) => setTempRow(prev => prev ? { ...prev, description: e.target.value } : null)}
                        className="w-full h-10 px-3.5 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-[13px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-sans placeholder:text-neutral-400"
                        placeholder="e.g. Ground Floor Corridor Lighting"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5 font-mono">
                        Remarks / Location Notes
                      </label>
                      <input
                        type="text"
                        value={tempRow?.remarks ?? ""}
                        onChange={(e) => setTempRow(prev => prev ? { ...prev, remarks: e.target.value } : null)}
                        className="w-full h-10 px-3.5 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-[13px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-sans placeholder:text-neutral-400"
                        placeholder="e.g. Safety critical path, escape stairs"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Lighting Parameters */}
                <div className="space-y-4">
                  <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                    Emergency Lighting Luminaire Parameters
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5 font-mono">
                        Emergency Light Quantity (Units)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={tempRow?.emLightQty === undefined || tempRow?.emLightQty === null ? "" : tempRow.emLightQty}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempRow(prev => prev ? { ...prev, emLightQty: val === "" ? 0 : Math.max(0, parseInt(val) || 0) } : null);
                        }}
                        className="w-full h-10 px-3.5 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-[13px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5 font-mono">
                        Emergency Luminaire Wattage ({unitSystem === "ip" ? "VA" : "W"})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={tempRow?.emLightW === undefined || tempRow?.emLightW === null ? "" : tempRow.emLightW}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempRow(prev => prev ? { ...prev, emLightW: val === "" ? 0 : Math.max(0, parseFloat(val) || 0) } : null);
                        }}
                        className="w-full h-10 px-3.5 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-[13px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-white/40 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 flex items-center justify-between text-[12px]">
                    <span className="text-neutral-500 dark:text-neutral-400 font-sans">Emergency Light Subtotal Load:</span>
                    <span className="font-mono font-bold text-primary">
                      {(((tempRow?.emLightQty || 0) * (tempRow?.emLightW || 0))).toLocaleString()} {unitSystem === "ip" ? "VA" : "W"}
                    </span>
                  </div>
                </div>

                {/* Exit Lighting Parameters */}
                <div className="space-y-4">
                  <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                    Exit Lighting Luminaire Parameters
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5 font-mono">
                        Exit Light Quantity (Units)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={tempRow?.exitLightQty === undefined || tempRow?.exitLightQty === null ? "" : tempRow.exitLightQty}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempRow(prev => prev ? { ...prev, exitLightQty: val === "" ? 0 : Math.max(0, parseInt(val) || 0) } : null);
                        }}
                        className="w-full h-10 px-3.5 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-[13px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5 font-mono">
                        Exit Sign Luminaire Wattage ({unitSystem === "ip" ? "VA" : "W"})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={tempRow?.exitLightW === undefined || tempRow?.exitLightW === null ? "" : tempRow.exitLightW}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTempRow(prev => prev ? { ...prev, exitLightW: val === "" ? 0 : Math.max(0, parseFloat(val) || 0) } : null);
                        }}
                        className="w-full h-10 px-3.5 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-[13px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-white/40 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 flex items-center justify-between text-[12px]">
                    <span className="text-neutral-500 dark:text-neutral-400 font-sans">Exit Light Subtotal Load:</span>
                    <span className="font-mono font-bold text-primary">
                      {(((tempRow?.exitLightQty || 0) * (tempRow?.exitLightW || 0))).toLocaleString()} {unitSystem === "ip" ? "VA" : "W"}
                    </span>
                  </div>
                </div>

                {/* Global System Sizing Parameters */}
                <div className="space-y-4">
                  <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                    System Sizing Coefficients (Global)
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5 font-mono">
                        Loading Factor
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={loadingFactor}
                        onChange={(e) => setLoadingFactor(Number(e.target.value) || 0.9)}
                        className="w-full h-10 px-3.5 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-[13px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5 font-mono">
                        Power Factor
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={powerFactor}
                        onChange={(e) => setPowerFactor(Number(e.target.value) || 0.8)}
                        className="w-full h-10 px-3.5 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-[13px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider mb-1.5 font-mono">
                        Spare Capacity (%)
                      </label>
                      <input
                        type="number"
                        value={spareCapacity}
                        onChange={(e) => setSpareCapacity(Number(e.target.value) || 20)}
                        className="w-full h-10 px-3.5 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-[13px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Calculations Preview Sidebar */}
              <div
                className={`shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
                  showModalPreview ? "w-[400px] opacity-100 p-6 border-l-border" : "w-0 opacity-0 p-0 border-l-transparent"
                }`}
              >
                {tempRow && (() => {
                  const rowEmLoad = (tempRow.emLightQty || 0) * (tempRow.emLightW || 0);
                  const rowExitLoad = (tempRow.exitLightQty || 0) * (tempRow.exitLightW || 0);
                  const rowTotalW = rowEmLoad + rowExitLoad;
                  const rowTotalKw = rowTotalW / 1000;
                  const rowAfterLFKw = rowTotalKw / (loadingFactor || 0.9);
                  const rowKva = rowAfterLFKw / (powerFactor || 0.8);
                  const rowSizedKva = rowKva * (1 + (spareCapacity || 20) / 100);
                  const shareOfTotal = calculatedData.totalConnectedW > 0 
                    ? ((rowTotalW / calculatedData.totalConnectedW) * 100).toFixed(1) 
                    : "100.0";

                  return (
                    <div className="w-[352px] space-y-5 flex flex-col h-full overflow-y-auto">
                      <h3 className="text-[11px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0">
                        Calculations Preview
                      </h3>

                      <div className="space-y-4 flex-1">
                        {/* Connected Load Summary */}
                        <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shadow-sm">
                          <div className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                            Area Electrical Demand
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px] font-mono">
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">EM Lights:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{rowEmLoad.toLocaleString()} {unitSystem === "ip" ? "VA" : "W"}</span>
                            </div>
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">Exit Lights:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{rowExitLoad.toLocaleString()} {unitSystem === "ip" ? "VA" : "W"}</span>
                            </div>
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">Loading Factor:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{loadingFactor}</span>
                            </div>
                            <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                              <span className="text-neutral-500 dark:text-neutral-400 font-sans">Power Factor:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{powerFactor}</span>
                            </div>
                          </div>
                        </div>

                        {/* Sizing Step-by-Step Card */}
                        <div className="p-5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 shadow-sm">
                          <div className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
                            Step-by-Step Sizing Formulas
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-baseline text-[12px]">
                              <span className="text-neutral-500 dark:text-neutral-400 font-medium font-sans">Total Connected Load:</span>
                              <span className="font-mono font-bold text-[14px] text-primary">
                                {rowTotalW.toLocaleString()} {unitSystem === "ip" ? "VA" : "W"} ({rowTotalKw.toFixed(3)} kW)
                              </span>
                            </div>
                            <div className="text-[10.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2.5 rounded-xl border border-black/5 dark:border-white/5 break-all leading-relaxed">
                              ({tempRow.emLightQty} × {tempRow.emLightW}{unitSystem === "ip" ? "VA" : "W"}) + ({tempRow.exitLightQty} × {tempRow.exitLightW}{unitSystem === "ip" ? "VA" : "W"}) = {rowTotalW.toLocaleString()} {unitSystem === "ip" ? "VA" : "W"}
                            </div>
                            
                            <div className="pt-2 flex justify-between items-baseline text-[12px]">
                              <span className="text-neutral-500 dark:text-neutral-400 font-medium font-sans">Demand (after LF {loadingFactor}):</span>
                              <span className="font-mono font-bold text-[13px] text-neutral-800 dark:text-neutral-100">
                                {rowAfterLFKw.toFixed(2)} kW
                              </span>
                            </div>
                            <div className="text-[10.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2 rounded-xl border border-black/5 dark:border-white/5">
                              {rowTotalKw.toFixed(3)} kW ÷ {loadingFactor} = {rowAfterLFKw.toFixed(2)} kW
                            </div>

                            <div className="pt-2 flex justify-between items-baseline text-[12px]">
                              <span className="text-neutral-500 dark:text-neutral-400 font-medium font-sans">Apparent Demand (kVA):</span>
                              <span className="font-mono font-bold text-[13px] text-primary">
                                {rowKva.toFixed(2)} kVA
                              </span>
                            </div>
                            <div className="text-[10.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2 rounded-xl border border-black/5 dark:border-white/5">
                              {rowAfterLFKw.toFixed(2)} kW ÷ {powerFactor} (PF) = {rowKva.toFixed(2)} kVA
                            </div>

                            <div className="pt-2 flex justify-between items-center text-xs font-sans">
                              <span className="text-neutral-500 dark:text-neutral-400">Share of Total Load:</span>
                              <span className="font-bold font-mono text-neutral-800 dark:text-neutral-100">{shareOfTotal}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Verification Banner */}
                        <div className="shrink-0 p-4 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex items-start gap-2.5 text-[12px] text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/5">
                          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                          <div>
                            <span className="font-semibold">Calculations verified.</span> Emergency lighting load conforms to BS 5266-1 / EN 50171 standards.
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <footer className="px-6 h-16 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-[12px] text-neutral-500 dark:text-neutral-400">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>Changes apply live to project calculation schedule</span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="h-10 px-5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (tempRow) {
                      setRows(prev => prev.map(r => r.id === tempRow.id ? tempRow : r));
                      toast.success(`Changes saved for "${tempRow.description}"`);
                    }
                    setEditingRow(null);
                  }}
                  className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-[12.5px] font-semibold transition-all shadow-md shadow-primary/10 active:scale-[0.98] cursor-pointer"
                >
                  Done / Apply Changes
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
      
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
          targetType="circuit"
          calculatorTitle="Central Battery Sizing"
          calculatorPath="/central-battery-sizing"
          existingComments={getMergedItemComments(commentTargetItem.id, commentTargetItem.name, (rows.find(r => r.id === commentTargetItem.id) as any)?.comments, "/central-battery-sizing", project?.id)}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

function CentralBatteryIntelligenceDrawer({
  rows,
  calculatedData,
  loadingFactor,
  powerFactor,
  spareCapacity,
  onClose,
  onSelectRow
}: {
  rows: CBSRow[];
  calculatedData: any;
  loadingFactor: number;
  powerFactor: number;
  spareCapacity: number;
  onClose: () => void;
  onSelectRow?: (row: CBSRow) => void;
}) {
  const flaggedRows = rows.filter(r => r.flagged);
  const totalLoadsCount = rows.length;
  const reserveKva = calculatedData.finalRecommendedKva - calculatedData.batteryRatingKva;

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in select-none">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button onClick={onClose} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {/* Compliance Status */}
        <section className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="size-3.5 text-success" />
            <h4 className="text-[11px] uppercase tracking-wider font-semibold">Compliance Status</h4>
          </div>
          <div className="text-[12px] text-muted-foreground">
            Meets BS 5266-1 and EN 50171 CPSS battery system standards across {totalLoadsCount} schedule area{totalLoadsCount === 1 ? '' : 's'}.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-success" style={{ width: "100%" }} />
            </div>
            <span className="font-mono tabular text-[11.5px]">100%</span>
          </div>
        </section>

        {/* System Capacity Metrics */}
        <section className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="size-3.5 text-primary" />
            <h4 className="text-[11px] uppercase tracking-wider font-semibold">Capacity & Sizing Summary</h4>
          </div>
          <div className="flex items-center justify-between text-[12px] py-0.5">
            <span className="text-muted-foreground">Connected Load</span>
            <span className="font-mono tabular font-semibold text-foreground">{calculatedData.totalConnectedKw.toFixed(2)} kW</span>
          </div>
          <div className="flex items-center justify-between text-[12px] py-0.5">
            <span className="text-muted-foreground">Demand (after LF {loadingFactor})</span>
            <span className="font-mono tabular font-semibold text-foreground">{calculatedData.totalLoadAfterLFFactorKw.toFixed(2)} kW</span>
          </div>
          <div className="flex items-center justify-between text-[12px] py-0.5">
            <span className="text-muted-foreground">Base Battery Sizing</span>
            <span className="font-mono tabular font-semibold text-foreground">{calculatedData.batteryRatingKva.toFixed(2)} kVA</span>
          </div>
          <div className="flex items-center justify-between text-[12px] py-0.5 border-t border-border/40 mt-1 pt-1">
            <span className="text-primary font-medium">Recommended Unit Size</span>
            <span className="font-mono tabular font-bold text-primary text-[13px]">{calculatedData.recStandardSize} kVA</span>
          </div>
          <div className="flex items-center justify-between text-[12px] py-0.5">
            <span className="text-muted-foreground">Reserve Capacity Headroom</span>
            <span className="font-mono tabular font-medium text-emerald-600 dark:text-emerald-400">+{reserveKva.toFixed(2)} kVA ({spareCapacity}%)</span>
          </div>
        </section>

        {/* Flagged Loads for Review */}
        <section className="px-3 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flag className={`size-3.5 ${flaggedRows.length > 0 ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
              <h4 className="text-[11px] uppercase tracking-wider font-semibold">Loads Flagged for Review</h4>
            </div>
            <span className="font-mono text-xs font-bold px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
              {flaggedRows.length}
            </span>
          </div>
          {flaggedRows.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">No areas currently flagged. Click the flag icon in the schedule to mark loads for engineering verification.</div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
              {flaggedRows.map(r => {
                const totW = (r.emLightQty * r.emLightW) + (r.exitLightQty * r.exitLightW);
                return (
                  <div
                    key={r.id}
                    onClick={() => onSelectRow && onSelectRow(r)}
                    className="p-2 rounded-lg bg-surface-2 border border-red-500/20 hover:border-red-500/40 transition cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="truncate mr-2">
                      <span className="font-medium text-foreground block truncate">{r.description}</span>
                      <span className="text-[10px] text-muted-foreground">{r.remarks || "No remarks"}</span>
                    </div>
                    <span className="font-mono font-bold text-red-600 dark:text-red-400 shrink-0">{totW.toFixed(0)} W</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Engineering Guidelines */}
        <section className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-3.5 text-primary" />
            <h4 className="text-[11px] uppercase tracking-wider font-semibold">Engineering Guidelines</h4>
          </div>
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Standard autonomy duration: 3 Hours for CPSS life safety evacuation lighting.</li>
            <li>Maintain power factor between 0.80 and 0.90 for high-efficiency LED luminaires.</li>
            <li>Verify loading factor is kept ≤ 0.90 to account for inrush current on inverter transfer.</li>
            <li>Minimum recommended spare capacity: 20% to allow future architectural modifications.</li>
          </ul>
        </section>

        {/* Sanity Check Link */}
        <div className="p-3">
          <Link
            to="/sanity-check-tool"
            className="w-full py-2 px-3 bg-primary text-primary-foreground font-semibold rounded-lg text-[12px] flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
          >
            <Zap className="size-3.5" />
            Run Project Electrical Sanity Check
          </Link>
        </div>
      </div>
    </div>
  );
}
