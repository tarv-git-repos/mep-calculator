import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { addPdfHeader, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { toast } from "sonner";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { api } from "@/services/api";
import { CalculationPreviewModal, type CalculationPreviewData } from "@/components/calculator-framework";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  Plus, Trash2, Download, Upload, X, AlertTriangle, CheckCircle2,
  FileText, Printer, FileSpreadsheet, Copy, RefreshCw, Filter, ArrowUpDown, Search,
  Sparkles, MessageSquare, Flag
} from "lucide-react";
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
import { UnitToggle } from "@/components/workspace/UnitToggle";

export const Route = createFileRoute("/short-circuit-calculations")({
  head: () => ({
    meta: [
      { title: "Short Circuit Current Calculation — MEP Calc" },
      { name: "description", content: "IEC 60909 prospective short circuit current analysis for electrical power networks." },
    ],
  }),
  component: ShortCircuitCalculationsPage,
});

interface CableRow {
  id: string;
  description: string;
  length: number;
  runs: number;
  size: number; // mm²
  voltage: number; // V
  material: "Copper" | "Aluminium";
  remarks: string;
  flagged?: boolean;
  comments?: any[];
}

interface RowDetail {
  id: string;
  segmentR: number;
  segmentX: number;
  segmentZ: number;
  runningSumR: number;
  runningSumX: number;
  runningSumZ: number;
  isc: number;
}

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  disabled?: boolean;
  onDoubleClick?: () => void;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, disabled = false, onDoubleClick }: InlineInputProps) {
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
      disabled={disabled}
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={onDoubleClick}
      className={`bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text ${className}`}
    />
  );
}

type Tab = "schedule" | "report";
const TABS: { id: Tab; label: string }[] = [
  { id: "schedule", label: "Sizing Schedule" },
  { id: "report", label: "Report" },
];

const IEC_CABLE_SIZES = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630
];

const STANDARD_REACTANCE_LOOKUP = (size: number): number => {
  if (size <= 16) return 0.10; // ohms/km
  if (size <= 95) return 0.09;
  if (size <= 300) return 0.08;
  return 0.075;
};

function ShortCircuitCalculationsPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/short-circuit-calculations", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/short-circuit-calculations", activeProjectId || project?.id);
  const isCalcLock = useCalculationLock("/short-circuit-calculations", activeProjectId || project?.id);
  const isApprovedLocked = isCalcLock || calcReviewState?.status === "APPROVED";

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<any>(null);
  const [previewRow, setPreviewRow] = useState<CableRow | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);

  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (newComment: any) => {
    if (!commentTargetItem) return;
    const updatedComment = {
      ...newComment,
      targetId: commentTargetItem.id,
      targetName: commentTargetItem.name,
      targetType: "cable-segment",
      calculatorTitle: "Short Circuit Calculator",
      calculatorPath: "/short-circuit-calculations",
      projectId: project?.id || "default",
      projectName: project?.name || "Short Circuit Analysis",
    };

    const nextRows = rows.map((r: any) => {
      if (r.id === commentTargetItem.id) {
        return { ...r, comments: [...(r.comments || []), updatedComment] };
      }
      return r;
    });
    setRows(nextRows);

    // Sync to localStorage
    if (project?.id) {
      try {
        localStorage.setItem(`short_circuit_rows_${project.id}`, JSON.stringify({
          rows: nextRows,
          sourceFaultLevel,
          nominalVoltage,
          sourceXrRatio,
          unitSystem,
          updatedAt: new Date().toISOString()
        }));
      } catch (e) {}
    }

    // Dispatch real-time events for notification center
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notification_received", { detail: updatedComment }));
      window.dispatchEvent(new CustomEvent("mep-notification-added", { detail: updatedComment }));
      window.dispatchEvent(new Event("storage"));
    }

    notifyCommentAssigned({
      comment: updatedComment,
      targetId: commentTargetItem.id,
      targetName: commentTargetItem.name,
      targetType: "cable-segment",
      calculatorTitle: "Short Circuit Calculator",
      calculatorPath: "/short-circuit-calculations",
      project,
      currentUserName,
      currentUserId: userData?.id || profile?.id
    }).catch(console.error);

    toast.success(`Comment / task assigned on "${commentTargetItem.name}"`);
    setCommentModalOpen(false);
  };

  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("schedule");

  // Unit System state
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    if (shouldConvert) {
      setRows(rows.map(r => ({
        ...r,
        length: newSystem === "ip"
          ? Number(((r.length || 0) * 3.28084).toFixed(1))
          : Number(((r.length || 0) / 3.28084).toFixed(1))
      })));
    }
  };

  // Sizing Constants / Source parameters
  const [sourceFaultLevel, setSourceFaultLevel] = useState<number>(25); // kA
  const [nominalVoltage, setNominalVoltage] = useState<number>(400); // V
  const [sourceXrRatio, setSourceXrRatio] = useState<number>(10); // X/R ratio

  // Sizing default rows
  const initialRows: CableRow[] = useMemo(() => [
    { id: "1", description: "Main Feeder Cable", length: 45, runs: 2, size: 240, voltage: 400, material: "Copper", remarks: "Incomer from Transformer", flagged: true },
    { id: "2", description: "Submain Feeder to DB-1", length: 65, runs: 1, size: 95, voltage: 400, material: "Copper", remarks: "L1 DB supply" },
    { id: "3", description: "DB-1 final submain link", length: 30, runs: 1, size: 16, voltage: 400, material: "Copper", remarks: "Critical load supply" }
  ], []);

  // Grid Engine Hooks & Rows State
  const [rows, setRowsState] = useState<CableRow[]>(initialRows);
  const historyRef = useRef<CableRow[][]>([initialRows]);
  const historyIndexRef = useRef(0);

  const setRows = useCallback((action: CableRow[] | ((prev: CableRow[]) => CableRow[])) => {
    setRowsState((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(next);
      historyIndexRef.current = historyRef.current.length - 1;
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      setRowsState(historyRef.current[historyIndexRef.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      setRowsState(historyRef.current[historyIndexRef.current]);
    }
  }, []);

  const { selectedIds: selected, toggleSelection, selectAll, clearSelection } = useSelection(rows);
  const { copy, cut, paste } = useClipboard<CableRow>(rows, selected, setRows);

  // Sizing Calculations Engine
  const calculatedData = useMemo(() => {
    // 1. Source Impedance calculation (in Ohms)
    const vLL = nominalVoltage || 400;
    const iScSource = sourceFaultLevel || 25;
    const xr = sourceXrRatio || 10;

    // Z_source = V_LL / (sqrt(3) * I_sc_source * 1000)
    const zSource = vLL / (Math.sqrt(3) * iScSource * 1000);
    const angle = Math.atan(xr);
    const rSource = zSource * Math.cos(angle);
    const xSource = zSource * Math.sin(angle);

    let totalCableLength = 0;
    let totalR = 0; // ohms
    let totalX = 0; // ohms

    let currentSumR = rSource;
    let currentSumX = xSource;

    const rowDetails: RowDetail[] = rows.map((r) => {
      const L_input = r.length || 0;
      // Convert feet to meters if in IP mode for standard IEC 60909 calculation formulas
      const L = unitSystem === "ip" ? L_input * 0.3048 : L_input;
      const N = r.runs || 1;
      const A = r.size || 1.5;
      const V = r.voltage || 400;

      // Resistivity at 20Â°C: Cu = 0.01724, Al = 0.0282
      const rho20 = r.material === "Copper" ? 0.01724 : 0.0282;
      const alpha = r.material === "Copper" ? 0.00393 : 0.00403;
      // rho at temperature 70Â°C
      const rho70 = rho20 * (1 + alpha * 50);

      // Resistance (Ohms) = (rho70 * L) / (A * N)
      const segmentR = (rho70 * L) / (A * N);
      
      // Reactance (Ohms) = (X_std * L) / (1000 * N)
      const xStd = STANDARD_REACTANCE_LOOKUP(A);
      const segmentX = (xStd * L) / (1000 * N);

      const segmentZ = Math.sqrt(Math.pow(segmentR, 2) + Math.pow(segmentX, 2));

      totalCableLength += L_input;
      totalR += segmentR;
      totalX += segmentX;

      currentSumR += segmentR;
      currentSumX += segmentX;

      const runningZ = Math.sqrt(Math.pow(currentSumR, 2) + Math.pow(currentSumX, 2));

      // prospective short circuit current
      const isc = runningZ > 0 ? V / (Math.sqrt(3) * runningZ * 1000) : 0;

      return {
        id: r.id,
        segmentR,
        segmentX,
        segmentZ,
        runningSumR: currentSumR,
        runningSumX: currentSumX,
        runningSumZ: runningZ,
        isc
      };
    });

    const totalZ = Math.sqrt(Math.pow(totalR, 2) + Math.pow(totalX, 2));
    const finalIsc = rowDetails.length > 0 ? rowDetails[rowDetails.length - 1].isc : iScSource;

    return {
      rSource,
      xSource,
      zSource,
      totalCableLength,
      totalR,
      totalX,
      totalZ,
      finalIsc,
      rowDetails,
      rowDetailsMap: new Map<string, RowDetail>(rowDetails.map((d): [string, RowDetail] => [d.id, d]))
    };
  }, [rows, sourceFaultLevel, nominalVoltage, sourceXrRatio, unitSystem]);

  // State persistence per project
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`short_circuit_rows_${project.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
            setRows(parsed.rows);
          }
          if (parsed.sourceFaultLevel) setSourceFaultLevel(parsed.sourceFaultLevel);
          if (parsed.nominalVoltage) setNominalVoltage(parsed.nominalVoltage);
          if (parsed.sourceXrRatio) setSourceXrRatio(parsed.sourceXrRatio);
          if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        }
      } catch (e) {}
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && rows.length > 0) {
      try {
        localStorage.setItem(`short_circuit_rows_${project.id}`, JSON.stringify({
          rows,
          sourceFaultLevel,
          nominalVoltage,
          sourceXrRatio,
          unitSystem,
          updatedAt: new Date().toISOString()
        }));
      } catch (e) {}
    }
  }, [project?.id, rows, sourceFaultLevel, nominalVoltage, sourceXrRatio, unitSystem]);

  // URL query parameter listener for comment notifications
  useEffect(() => {
    const handleScrollToItem = (e: any) => {
      const { id } = e.detail || {};
      if (id) {
        setHighlightedTargetId(id);
        setTab("schedule");
        setTimeout(() => {
          const el = document.getElementById(`row-${id}`) || document.querySelector(`[data-row-id="${id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-primary", "animate-pulse");
            setTimeout(() => {
              el.classList.remove("ring-2", "ring-primary", "animate-pulse");
            }, 3000);
          }
        }, 200);
      }
    };

    window.addEventListener("mep-scroll-to-item" as any, handleScrollToItem);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("commentTargetId") || params.get("targetId");
      const targetName = params.get("commentTargetName") || params.get("targetName");
      if (targetId || targetName) {
        setTimeout(() => {
          handleScrollToItem({ detail: { id: targetId, name: targetName } });
        }, 400);
      }
    }

    return () => {
      window.removeEventListener("mep-scroll-to-item" as any, handleScrollToItem);
    };
  }, [rows]);

  const getCalculationPreview = (row: CableRow): CalculationPreviewData => {
    const isIP = unitSystem === "ip";
    const L_input = row.length || 0;
    const L = isIP ? L_input * 0.3048 : L_input;
    const N = row.runs || 1;
    const A = row.size || 1.5;
    const V = row.voltage || nominalVoltage || 400;

    const rho20 = row.material === "Copper" ? 0.01724 : 0.0282;
    const alpha = row.material === "Copper" ? 0.00393 : 0.00403;
    const rho70 = rho20 * (1 + alpha * 50);

    const segmentR = (rho70 * L) / (A * N);
    const xStd = STANDARD_REACTANCE_LOOKUP(A);
    const segmentX = (xStd * L) / (1000 * N);
    const segmentZ = Math.sqrt(Math.pow(segmentR, 2) + Math.pow(segmentX, 2));

    const details = calculatedData.rowDetailsMap?.get(row.id) || {
      segmentR,
      segmentX,
      segmentZ,
      runningSumR: segmentR + calculatedData.rSource,
      runningSumX: segmentX + calculatedData.xSource,
      runningSumZ: Math.sqrt(Math.pow(segmentR + calculatedData.rSource, 2) + Math.pow(segmentX + calculatedData.xSource, 2)),
      isc: 0
    };

    const isSafe = details.isc <= 50;
    const isHighFault = details.isc > 50;

    return {
      title: "Short Circuit Calculation Preview (IEC 60909)",
      itemName: row.description || `Cable Segment`,
      itemCode: `${row.material} • ${row.size} mm² • ${row.runs} Run(s) • ${row.length} ${isIP ? "ft" : "m"}`,
      standardReference: "IEC 60909-0 / BS 7671 Short-Circuit Analysis",
      inputs: [
        { label: "Cable Description", value: row.description || "Segment" },
        { label: "Conductor Material", value: row.material },
        { label: "Cable Size", value: row.size, unit: "mm²" },
        { label: "Parallel Runs", value: row.runs },
        { label: "Length", value: row.length, unit: isIP ? "ft" : "m" },
        { label: "Nominal Voltage (Vn)", value: V, unit: "V" },
        { label: "Source Fault Level", value: sourceFaultLevel, unit: "kA" },
        { label: "Source X/R Ratio", value: sourceXrRatio },
        { label: "Source Impedance (Zs)", value: calculatedData.zSource.toFixed(5), unit: "Ω" },
      ],
      steps: [
        {
          stepNumber: 1,
          label: "Source Baseline Impedance (Zs)",
          formula: "Zs = Vn / (√3 × Isc_source × 1000)",
          substitution: `${V} V / (1.732 × ${sourceFaultLevel} kA × 1000)`,
          result: calculatedData.zSource.toFixed(5),
          unit: "Ω",
          status: "info",
          description: `Upstream network grid impedance (Rs = ${calculatedData.rSource.toFixed(5)} Ω, Xs = ${calculatedData.xSource.toFixed(5)} Ω with X/R = ${sourceXrRatio}).`
        },
        {
          stepNumber: 2,
          label: "Conductor Operating Resistance (R)",
          formula: "R = (ρ70 × L) / (A × N)",
          substitution: `(${rho70.toFixed(5)} × ${L.toFixed(1)} m) / (${A} mm² × ${N})`,
          result: details.segmentR.toFixed(5),
          unit: "Ω",
          status: "info",
          description: `Conductor resistance at 70°C for ${row.material} with ${N} parallel run(s).`
        },
        {
          stepNumber: 3,
          label: "Conductor Inductive Reactance (X)",
          formula: "X = (X_std × L) / (1000 × N)",
          substitution: `(${xStd} Ω/km × ${L.toFixed(1)} m) / (1000 × ${N})`,
          result: details.segmentX.toFixed(5),
          unit: "Ω",
          status: "info",
          description: `Standard line reactance for ${A} mm² cable spacing.`
        },
        {
          stepNumber: 4,
          label: "Cable Segment AC Impedance (Zseg)",
          formula: "Zseg = √(R² + X²)",
          substitution: `√(${details.segmentR.toFixed(5)}² + ${details.segmentX.toFixed(5)}²)`,
          result: details.segmentZ.toFixed(5),
          unit: "Ω",
          status: "info",
          description: `Individual AC impedance for this feeder section.`
        },
        {
          stepNumber: 5,
          label: "Cumulative Network Cascade Impedance (ΣZ)",
          formula: "ΣZ = √((Rs + ΣR_cables)² + (Xs + ΣX_cables)²)",
          substitution: `√(${details.runningSumR.toFixed(5)}² + ${details.runningSumX.toFixed(5)}²)`,
          result: details.runningSumZ.toFixed(5),
          unit: "Ω",
          status: "info",
          description: `Total cascading loop impedance from transformer/source to this fault point.`
        },
        {
          stepNumber: 6,
          label: "Prospective Symmetrical Fault Current (Isc)",
          formula: "Isc = Vn / (√3 × ΣZ × 1000)",
          substitution: `${V} V / (1.732 × ${details.runningSumZ.toFixed(5)} Ω × 1000)`,
          result: details.isc.toFixed(3),
          unit: "kA",
          status: isSafe ? "pass" : "warning",
          description: isHighFault
            ? `Fault current exceeds 50 kA. Ensure downstream switchboards and breakers are rated for at least ${Math.ceil(details.isc)} kA (Icu/Ics).`
            : `Fault current is within standard distribution switchgear rating.`
        }
      ],
      finalResultLabel: "Prospective Short Circuit Current (Isc)",
      finalResultValue: `${details.isc.toFixed(3)} kA`,
      finalResultUnit: isHighFault ? "(High Fault Level - Verify Breaking Capacity)" : "(Standard Breaking Capacity)",
      complianceNote: `Calculated prospective fault level at ${row.description} per IEC 60909 standard.`
    };
  };

  // Validation Rules
  const validations = useMemo(() => {
    const logs: { type: "warning" | "danger"; msg: string }[] = [];

    // Table rows validations
    const zeroLength = rows.some(r => r.length <= 0);
    const zeroRuns = rows.some(r => r.runs <= 0);
    const zeroSize = rows.some(r => r.size <= 0);
    const zeroVoltage = rows.some(r => r.voltage <= 0);

    if (zeroLength) {
      logs.push({
        type: "warning",
        msg: "One or more cables have length of zero or blank."
      });
    }

    if (zeroRuns) {
      logs.push({
        type: "danger",
        msg: "Number of parallel runs must be 1 or greater."
      });
    }

    if (zeroSize) {
      logs.push({
        type: "danger",
        msg: "Cable size must be a valid cross-sectional area (mmÂ²)."
      });
    }

    if (zeroVoltage) {
      logs.push({
        type: "danger",
        msg: "Voltage rating must be greater than zero."
      });
    }

    // Source constants validations
    if (sourceFaultLevel <= 0) {
      logs.push({
        type: "danger",
        msg: "Source short circuit fault level must be greater than zero."
      });
    }

    if (nominalVoltage <= 0) {
      logs.push({
        type: "danger",
        msg: "Nominal voltage must be greater than zero."
      });
    }

    if (sourceXrRatio <= 0) {
      logs.push({
        type: "warning",
        msg: "Source X/R ratio is zero or negative. Sizing calculations might be slightly skewed."
      });
    }

    // Fault current warnings
    if (calculatedData.finalIsc > 100) {
      logs.push({
        type: "warning",
        msg: "Calculated fault current exceeds 100 kA. Ensure switchgear rating compliance."
      });
    } else if (calculatedData.finalIsc < 0.1) {
      logs.push({
        type: "warning",
        msg: "Calculated fault current is unusually low (less than 100 A)."
      });
    }

    return logs;
  }, [rows, sourceFaultLevel, nominalVoltage, sourceXrRatio, calculatedData]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMaterial, setFilterMaterial] = useState<"all" | "Copper" | "Aluminium">("all");
  const [filterSize, setFilterSize] = useState<string>("all");
  const [filterVoltage, setFilterVoltage] = useState<string>("all");
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"none" | "description" | "length-desc" | "length-asc" | "size-desc" | "isc-desc">("none");

  const flaggedCount = useMemo(() => rows.filter(r => r.flagged).length, [rows]);

  const activeFiltersCount = (filterMaterial !== "all" ? 1 : 0) + 
                             (filterSize !== "all" ? 1 : 0) + 
                             (filterVoltage !== "all" ? 1 : 0) +
                             (filterFlaggedOnly ? 1 : 0);

  const handleResetFilters = () => {
    setFilterMaterial("all");
    setFilterSize("all");
    setFilterVoltage("all");
    setFilterFlaggedOnly(false);
  };

  const uniqueSizes = useMemo(() => {
    const set = new Set<number>();
    rows.forEach(r => { if (r.size) set.add(r.size); });
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  const uniqueVoltages = useMemo(() => {
    const set = new Set<number>();
    rows.forEach(r => { if (r.voltage) set.add(r.voltage); });
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.material && r.material.toLowerCase().includes(q)) ||
        (r.remarks && r.remarks.toLowerCase().includes(q)) ||
        String(r.size).includes(q) ||
        String(r.length).includes(q) ||
        String(r.voltage).includes(q)
      );
    }

    if (filterMaterial !== "all") {
      result = result.filter(r => r.material === filterMaterial);
    }

    if (filterSize !== "all") {
      result = result.filter(r => String(r.size) === filterSize);
    }

    if (filterVoltage !== "all") {
      result = result.filter(r => String(r.voltage) === filterVoltage);
    }

    if (filterFlaggedOnly) {
      result = result.filter(r => r.flagged);
    }

    if (sortBy !== "none") {
      result = [...result].sort((a, b) => {
        if (sortBy === "description") return (a.description || "").localeCompare(b.description || "");
        if (sortBy === "length-desc") return (b.length || 0) - (a.length || 0);
        if (sortBy === "length-asc") return (a.length || 0) - (b.length || 0);
        if (sortBy === "size-desc") return (b.size || 0) - (a.size || 0);
        if (sortBy === "isc-desc") {
          const iscA = calculatedData.rowDetailsMap?.get(a.id)?.isc || 0;
          const iscB = calculatedData.rowDetailsMap?.get(b.id)?.isc || 0;
          return iscB - iscA;
        }
        return 0;
      });
    }

    return result;
  }, [rows, searchQuery, filterMaterial, filterSize, filterVoltage, filterFlaggedOnly, sortBy, calculatedData]);

  // CRUD Sizing actions
  const handleAddRow = () => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Adding rows is disabled.", { id: "readonly-notice" });
      return;
    }

    // Clear any active filters that would hide the newly created row
    if (filterFlaggedOnly) setFilterFlaggedOnly(false);
    if (searchQuery) setSearchQuery("");
    if (filterMaterial !== "all") setFilterMaterial("all");
    if (filterSize !== "all") setFilterSize("all");
    if (filterVoltage !== "all") setFilterVoltage("all");

    const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
    const newRow: CableRow = {
      id: nextId,
      description: `Cable Section ${rows.length + 1}`,
      length: unitSystem === "ip" ? 100 : 30,
      runs: 1,
      size: 95,
      voltage: nominalVoltage || 400,
      material: "Copper",
      remarks: "",
      flagged: false
    };
    setRows(prev => [...prev, newRow]);
    toast.success("New cable section added");
  };

  const handleDuplicateRow = (row: CableRow) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Duplicating rows is disabled.", { id: "readonly-notice" });
      return;
    }
    const nextId = "row-" + Date.now() + Math.random().toString(36).substr(2, 5);
    setRows(prev => [
      ...prev,
      {
        ...row,
        id: nextId,
        description: `${row.description} (Copy)`
      }
    ]);
    toast.success("Row duplicated");
  };

  const handleDeleteRow = (id: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Deleting rows is disabled.", { id: "readonly-notice" });
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
    clearSelection();
    toast.success("Row deleted");
  };

  const handleUpdateRow = (id: string, field: keyof CableRow, val: any) => {
    const isBulkEdit = selected.has(id);
    setRows(rows.map(r => 
      (r.id === id || (isBulkEdit && selected.has(r.id))) ? { ...r, [field]: val } : r
    ));
  };

  const handleToggleFlag = (targetRowId?: string) => {
    const isSelected = targetRowId ? selected.has(targetRowId) : false;
    const selectedIds = Array.from(selected);
    const targetIds = targetRowId
      ? (isSelected && selectedIds.length > 1 ? selectedIds : [targetRowId])
      : selectedIds;

    if (targetIds.length === 0) return;

    const firstRow = rows.find(r => r.id === targetIds[0]);
    const nextFlagged = !firstRow?.flagged;

    setRows(rows.map(r => targetIds.includes(r.id) ? { ...r, flagged: nextFlagged } : r));
    toast.info(nextFlagged ? `Flagged ${targetIds.length} cable(s) for review` : `Unflagged ${targetIds.length} cable(s)`);
  };

  const handleReset = async () => {
    const ok = await confirm("Are you sure you want to reset all calculations to defaults?");
    if (ok) {
      setRows([
        { id: "1", description: "Main Feeder Cable", length: 45, runs: 2, size: 240, voltage: 400, material: "Copper", remarks: "Incomer from Transformer" },
        { id: "2", description: "Submain Feeder to DB-1", length: 65, runs: 1, size: 95, voltage: 400, material: "Copper", remarks: "L1 DB supply" }
      ]);
      setSourceFaultLevel(25);
      setNominalVoltage(400);
      setSourceXrRatio(10);
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

  // Excel Importer
  const handleImportExcelRows = (mappedRows: any[]) => {
    const newRows: CableRow[] = mappedRows.map((mr, idx) => {
      const mat = String(mr.material || "").toLowerCase().includes("al") ? "Aluminium" : "Copper";
      return {
        id: `imported-${idx}-${Date.now()}`,
        description: mr.description || `Imported Segment ${idx + 1}`,
        length: Number(mr.length) || 30,
        runs: Number(mr.runs) || 1,
        size: Number(mr.size) || 95,
        voltage: Number(mr.voltage) || 400,
        material: mat,
        remarks: mr.remarks || ""
      };
    });

    if (newRows.length > 0) {
      setRows([...rows, ...newRows]);
    }
  };

  // Excel Exporter
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Short Circuit");

    sheet.mergeCells("A1:H1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "PROSPECTIVE SHORT CIRCUIT CURRENT REPORT";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 36;

    sheet.getCell("A3").value = "Source Fault Level (kA):";
    sheet.getCell("B3").value = sourceFaultLevel;
    sheet.getCell("A4").value = "Nominal Voltage (V):";
    sheet.getCell("B4").value = nominalVoltage;
    sheet.getCell("A5").value = "Source X/R Ratio:";
    sheet.getCell("B5").value = sourceXrRatio;

    sheet.getColumn("A").width = 24;
    sheet.getColumn("B").width = 30;

    // Table headers
    sheet.getRow(8).values = ["Sr. No.", "Description", "Length (m)", "Runs", "Size (mmÂ²)", "Voltage (V)", "Material", "Resistance (Î©)", "Impedance (Î©)", "Running Î£R", "Running Î£X", "Isc (kA)", "Remarks"];
    sheet.getRow(8).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };

    let currentRow = 9;
    rows.forEach((r, idx) => {
      const details = calculatedData.rowDetails[idx] || { segmentR: 0, segmentZ: 0, runningSumR: 0, runningSumX: 0, isc: 0 };
      sheet.getRow(currentRow).values = [
        idx + 1,
        r.description,
        r.length,
        r.runs,
        r.size,
        r.voltage,
        r.material,
        details.segmentR.toFixed(5),
        details.segmentZ.toFixed(5),
        details.runningSumR.toFixed(5),
        details.runningSumX.toFixed(5),
        details.isc.toFixed(3),
        r.remarks
      ];
      currentRow++;
    });

    currentRow += 2;
    sheet.getCell(`A${currentRow}`).value = "SIZING SUMMARY RESULTS";
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 11 };
    currentRow++;

    const results = [
      ["Total Cable Length", `${calculatedData.totalCableLength.toFixed(1)} m`],
      ["Total Resistance", `${calculatedData.totalR.toFixed(5)} Î©`],
      ["Total Reactance", `${calculatedData.totalX.toFixed(5)} Î©`],
      ["Total Impedance", `${calculatedData.totalZ.toFixed(5)} Î©`],
      ["Final Short Circuit Current", `${calculatedData.finalIsc.toFixed(3)} kA`]
    ];

    results.forEach(([lbl, val]) => {
      sheet.getCell(`A${currentRow}`).value = lbl;
      sheet.getCell(`B${currentRow}`).value = val;
      sheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
    });

    
    const sigRow = sheet.rowCount ? sheet.rowCount + 2 : 20;
    addExcelSignatureBlock(sheet, sigRow, currentUserName, activeProjectId || "default", "short-circuit-calculations");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "Short_Circuit_Report.xlsx");
  };

  // PDF Exporter
  const handleExportPDF = async () => {
    try {
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

      // 1. Company Standard Metadata Header Box
      addPdfHeader(doc, "Short Circuit Calculation Report", {
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
      doc.text("Design Criteria:", 14, 40.5);
      doc.setFont("helvetica", "normal");
      doc.text(`Source Fault Level: ${sourceFaultLevel} kA   |   Nominal Voltage: ${nominalVoltage} V   |   Source X/R: ${sourceXrRatio}`, 38, 40.5);

      // Colors
      const primaryFill = [217, 217, 217] as [number, number, number]; // Gray for standard headers
      const blueFill = [218, 233, 248] as [number, number, number]; // Light blue for fault current column

      // 3. Grid Table
      const headers = [
        [
          { content: "Sr.\nNo.", rowSpan: 2, styles: { fillColor: primaryFill } },
          { content: "Cable Run Parameters", colSpan: 5, styles: { fillColor: primaryFill } },
          { content: "Impedance Parameters", colSpan: 3, styles: { fillColor: primaryFill } },
          { content: "Short Circuit Level", colSpan: 2, styles: { fillColor: blueFill } }
        ],
        [
          { content: "Description" },
          { content: `Length\n(${unitSystem === "ip" ? "ft" : "m"})` },
          { content: "Runs" },
          { content: "Size\n(mmÂ²)" },
          { content: "Material" },
          { content: "Resistance\nR (mÎ©)" },
          { content: "Reactance\nX (mÎ©)" },
          { content: "Impedance\nZ (mÎ©)" },
          { content: "Running\nÎ£Z (mÎ©)" },
          { content: "Fault Current\nIsc (kA)", styles: { fillColor: blueFill } }
        ]
      ];

      const data: any[] = rows.map((r, idx) => {
        const d = calculatedData.rowDetails[idx] || { segmentR: 0, segmentX: 0, segmentZ: 0, runningSumZ: 0, isc: 0 };
        return [
          idx + 1,
          r.description || `Cable Feeder ${idx + 1}`,
          `${r.length || 0} ${unitSystem === "ip" ? "ft" : "m"}`,
          r.runs || 1,
          `${r.size || 0} mmÂ²`,
          r.material || "Copper",
          (d.segmentR * 1000).toFixed(2),
          (d.segmentX * 1000).toFixed(2),
          (d.segmentZ * 1000).toFixed(2),
          (d.runningSumZ * 1000).toFixed(2),
          d.isc.toFixed(3)
        ];
      });

      // Total / Summary Row at the bottom of data grid
      const grandTotalRow = [
        { content: "TOTAL", colSpan: 2, styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill } },
        { content: `${calculatedData.totalCableLength.toFixed(1)} ${unitSystem === "ip" ? "ft" : "m"}`, styles: { fontStyle: "bold", halign: "center" } },
        { content: "-", styles: { halign: "center" } },
        { content: "-", styles: { halign: "center" } },
        { content: "-", styles: { halign: "center" } },
        { content: (calculatedData.totalR * 1000).toFixed(2), styles: { fontStyle: "bold", halign: "right" } },
        { content: (calculatedData.totalX * 1000).toFixed(2), styles: { fontStyle: "bold", halign: "right" } },
        { content: (calculatedData.totalZ * 1000).toFixed(2), styles: { fontStyle: "bold", halign: "right" } },
        { content: (calculatedData.totalZ * 1000).toFixed(2), styles: { fontStyle: "bold", halign: "right" } },
        { content: calculatedData.finalIsc.toFixed(3), styles: { fontStyle: "bold", halign: "right", fillColor: blueFill } }
      ];
      (grandTotalRow as any)._isGrandTotal = true;
      data.push(grandTotalRow);

      callAutoTable(doc, {
        startY: 44,
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
          0: { cellWidth: 9, halign: "center" },
          1: { cellWidth: 31, halign: "left" },
          2: { cellWidth: 13, halign: "center" },
          3: { cellWidth: 9, halign: "center" },
          4: { cellWidth: 13, halign: "center" },
          5: { cellWidth: 15, halign: "center" },
          6: { cellWidth: 18, halign: "right" },
          7: { cellWidth: 18, halign: "right" },
          8: { cellWidth: 18, halign: "right" },
          9: { cellWidth: 18, halign: "right" },
          10: { cellWidth: 20, halign: "right", fillColor: [240, 247, 252] }
        },
        head: headers,
        body: data,
        didParseCell: function(data: any) {
          const rawRow = data.row.raw;
          if (data.section === "body") {
            const isTotalRow = rawRow && rawRow._isGrandTotal;
            if (isTotalRow) {
              data.cell.styles.fontStyle = "bold";
            } else if (data.column.index === 10) {
              data.cell.styles.fillColor = [242, 248, 253];
            }
          }
        }
      });

      // 4. Standard Signature Approval Block
      const finalY = (doc as any).lastAutoTable?.finalY ?? 150;
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || "default", "/short-circuit-calculations", currentUserName || "");

      callAutoTable(doc, {
        startY: finalY + 8,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 8,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 }
        },
        headStyles: {
          fillColor: [255, 230, 204],
          textColor: 0,
          fontStyle: "bold"
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
            { content: originatedName, styles: { halign: "center" } },
            { content: reviewerName, styles: { halign: "center" } },
            { content: approverName, styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate, styles: { halign: "center" } },
            { content: reviewerDate, styles: { halign: "center" } },
            { content: approverDate, styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 }
        }
      });

      const pdfBuffer = doc.output("arraybuffer");
      await downloadFile(
        new Uint8Array(pdfBuffer),
        `Short_Circuit_Report_${project?.code || "P000"}.pdf`,
        "PDF Document",
        ["pdf"]
      );
      toast.success("Short circuit calculation PDF exported successfully!");
    } catch (error: any) {
      console.error("handleExportPDF error:", error);
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
  };

  // DataGrid columns setup
  const columns: Column<CableRow>[] = useMemo(() => [
    {
      key: "index",
      header: "Sr. No.",
      width: 60,
      align: "center",
      render: (r) => {
        const idx = rows.findIndex((row) => row.id === r.id);
        return (
          <span 
            className="text-muted-foreground font-mono cursor-pointer select-none" 
            onDoubleClick={() => setPreviewRow(r)}
          >
            {idx + 1}
          </span>
        );
      }
    },
    {
      key: "description",
      header: "Description",
      width: 180,
      editable: true,
      render: (r) => {
        const itemComments = getMergedItemComments(r.id, r.description, (r as any).comments, "/short-circuit-calculations", project?.id);
        return (
          <div 
            className="flex items-center gap-1.5 w-full cursor-pointer"
            onDoubleClick={() => setPreviewRow(r)}
          >
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
              onDoubleClick={() => setPreviewRow(r)}
              className="font-medium text-[13px] flex-1"
            />
          </div>
        );
      }
    },
    {
      key: "length",
      header: unitSystem === "ip" ? "Length (ft)" : "Length (m)",
      width: 85,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.length}
          onCommit={(val) => handleUpdateRow(r.id, "length", Number(val) || 0)}
          onDoubleClick={() => setPreviewRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "runs",
      header: "Runs",
      width: 65,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.runs}
          onCommit={(val) => handleUpdateRow(r.id, "runs", Number(val) || 1)}
          onDoubleClick={() => setPreviewRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "size",
      header: "Size (mm²)",
      width: 90,
      align: "center",
      render: (r) => (
        <div onDoubleClick={() => setPreviewRow(r)} className="w-full flex justify-center cursor-pointer">
          <select
            value={r.size}
            onChange={(e) => handleUpdateRow(r.id, "size", Number(e.target.value))}
            className="bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none py-0.5 px-1 rounded text-foreground text-center font-mono text-[12.5px] cursor-pointer"
          >
            {IEC_CABLE_SIZES.map((sz) => (
              <option key={sz} value={sz} className="bg-popover text-foreground">
                {sz}
              </option>
            ))}
          </select>
        </div>
      )
    },
    {
      key: "voltage",
      header: "Voltage (V)",
      width: 80,
      align: "center",
      editable: true,
      render: (r) => (
        <InlineInput
          type="number"
          value={r.voltage}
          onCommit={(val) => handleUpdateRow(r.id, "voltage", Number(val) || 400)}
          onDoubleClick={() => setPreviewRow(r)}
          className="font-mono text-center text-[12.5px]"
        />
      )
    },
    {
      key: "material",
      header: "Material",
      width: 85,
      align: "center",
      render: (r) => (
        <div onDoubleClick={() => setPreviewRow(r)} className="w-full flex justify-center cursor-pointer">
          <select
            value={r.material}
            onChange={(e) => handleUpdateRow(r.id, "material", e.target.value as "Copper" | "Aluminium")}
            className="bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none py-0.5 px-1 rounded text-foreground text-center font-semibold text-[12.5px] cursor-pointer"
          >
            <option value="Copper" className="bg-popover text-foreground">Copper</option>
            <option value="Aluminium" className="bg-popover text-foreground">Aluminium</option>
          </select>
        </div>
      )
    },
    {
      key: "resistance",
      header: "R (Ω)",
      width: 90,
      align: "right",
      render: (r) => {
        const details = calculatedData.rowDetailsMap?.get(r.id) || { segmentR: 0 };
        return (
          <span 
            className="font-mono text-muted-foreground text-[12.5px] cursor-pointer"
            onDoubleClick={() => setPreviewRow(r)}
          >
            {(details.segmentR || 0).toFixed(5)}
          </span>
        );
      }
    },
    {
      key: "impedance",
      header: "Z (Ω)",
      width: 90,
      align: "right",
      render: (r) => {
        const details = calculatedData.rowDetailsMap?.get(r.id) || { segmentZ: 0 };
        return (
          <span 
            className="font-mono text-muted-foreground text-[12.5px] cursor-pointer"
            onDoubleClick={() => setPreviewRow(r)}
          >
            {(details.segmentZ || 0).toFixed(5)}
          </span>
        );
      }
    },
    {
      key: "runningSumR",
      header: "Running ΣR",
      width: 85,
      align: "right",
      render: (r) => {
        const details = calculatedData.rowDetailsMap?.get(r.id) || { runningSumR: 0 };
        return (
          <span 
            className="font-mono text-muted-foreground text-[12.5px] cursor-pointer"
            onDoubleClick={() => setPreviewRow(r)}
          >
            {(details.runningSumR || 0).toFixed(5)}
          </span>
        );
      }
    },
    {
      key: "runningSumX",
      header: "Running ΣX",
      width: 85,
      align: "right",
      render: (r) => {
        const details = calculatedData.rowDetailsMap?.get(r.id) || { runningSumX: 0 };
        return (
          <span 
            className="font-mono text-muted-foreground text-[12.5px] cursor-pointer"
            onDoubleClick={() => setPreviewRow(r)}
          >
            {(details.runningSumX || 0).toFixed(5)}
          </span>
        );
      }
    },
    {
      key: "isc",
      header: "Isc (kA)",
      width: 100,
      align: "right",
      render: (r) => {
        const details = calculatedData.rowDetailsMap?.get(r.id) || { isc: 0 };
        return (
          <span 
            className="font-mono font-bold text-foreground text-[12.5px] cursor-pointer"
            onDoubleClick={() => setPreviewRow(r)}
          >
            {(details.isc || 0).toFixed(3)}
          </span>
        );
      }
    },
    {
      key: "remarks",
      header: "Remarks",
      width: 120,
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
      width: 36,
      align: "center",
      render: (r) => (
        <button
          type="button"
          disabled={isEffectiveReadOnly}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleFlag(r.id);
          }}
          title={r.flagged ? "Flagged for engineering review (click to unflag)" : "Flag cable for review"}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
        >
          <Flag
            className={`size-3.5 transition-all duration-200 ${
              r.flagged
                ? "fill-red-500 text-red-500 scale-110"
                : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
            }`}
          />
        </button>
      ),
    }
  ], [rows, calculatedData, selected, unitSystem, project?.id, isEffectiveReadOnly]);

  // Context Menu Renderer
  const renderRowContextMenu = (row: CableRow) => {
    const isSelected = selected.has(row.id);
    const selectedIds = isSelected ? Array.from(selected) : [row.id];
    const targetsCount = selectedIds.length;

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => setPreviewRow(row)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-semibold text-primary"
        >
          <Sparkles className="size-4 text-primary" /> View Calculation Preview
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => handleOpenComment(row.id, row.description)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <MessageSquare className="size-4 text-muted-foreground" /> Add Comment
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 border-t border-border" />
        <ContextMenuItem
          onClick={() => handleToggleFlag(row.id)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Flag className={`size-3.5 ${row.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          <span>{row.flagged ? "Unflag Cable" : "Flag Cable"}</span>
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 border-t border-border" />
        {targetsCount > 1 ? (
          <>
            <ContextMenuItem
              onClick={() => handleToggleFlag()}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
            >
              <Flag className="size-3.5 text-red-500" />
              <span>Toggle Flag Selected ({targetsCount})</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const duplicated: CableRow[] = [];
                rows.forEach(r => {
                  if (selectedIds.includes(r.id)) {
                    duplicated.push({
                      ...r,
                      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      description: `${r.description} (Copy)`
                    });
                  }
                });
                setRows([...rows, ...duplicated]);
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
            >
              <Copy className="size-3.5 text-muted-foreground" /> Duplicate Selected ({targetsCount})
            </ContextMenuItem>
            <ContextMenuSeparator className="my-1 border-t border-border" />
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
          </>
        ) : (
          <>
            <ContextMenuItem
              onClick={() => handleDuplicateRow(row)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
            >
              <Copy className="size-3.5 text-muted-foreground" /> Duplicate Row
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
      const duplicated: CableRow[] = [];
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
      title="Short Circuit Sizing" 
      hideSubHeader={true}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-center shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Short Circuit Calculator</h1>
                <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} {rows.length === 1 ? "segment" : "segments"}</span>
                {flaggedCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <Flag className="size-3 fill-rose-500 text-rose-500" /> {flaggedCount} flagged
                  </span>
                )}
              </div>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/short-circuit-calculations" calculatorTitle="Short Circuit Calculator" />
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
                  {/* Sizing Constants inputs bar */}
                  <div className="flex flex-wrap items-center gap-6 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/50 border-b border-border/80 text-xs font-semibold select-none shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Source Fault Level:</span>
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={sourceFaultLevel}
                          onChange={(e) => setSourceFaultLevel(Number(e.target.value))}
                          className="w-16 bg-background border border-border rounded-l px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none border-r-0"
                        />
                        <span className="bg-slate-100 dark:bg-slate-800 border border-border border-l-0 rounded-r px-2 py-1 font-bold text-slate-500 font-mono text-xs">kA</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Nominal Voltage:</span>
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={nominalVoltage}
                          onChange={(e) => setNominalVoltage(Number(e.target.value))}
                          className="w-16 bg-background border border-border rounded-l px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none border-r-0"
                        />
                        <span className="bg-slate-100 dark:bg-slate-800 border border-border border-l-0 rounded-r px-2 py-1 font-bold text-slate-500 font-mono text-xs">V</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Source X/R Ratio:</span>
                      <input
                        type="number"
                        value={sourceXrRatio}
                        onChange={(e) => setSourceXrRatio(Number(e.target.value))}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  {/* Standard Toolbar matching Ventilation & Preliminary Cooling Load */}
                  <div className="relative flex items-center justify-between px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap select-none no-print gap-2">
                    {/* Left: Search, Filter, Sort */}
                    <div className="flex items-center gap-1.5">
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter cables..."
                        className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition-all"
                      />

                      {/* Filter Popover */}
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
                        <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                          <div className="flex items-center justify-between pb-1.5 border-b border-border">
                            <span className="text-[12px] font-semibold text-foreground">Filters</span>
                            {activeFiltersCount > 0 && (
                              <button
                                onClick={handleResetFilters}
                                className="text-[10px] text-primary hover:underline font-semibold"
                              >
                                Clear All
                              </button>
                            )}
                          </div>

                          {/* Material Filter */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Material</span>
                            <select
                              value={filterMaterial}
                              onChange={(e) => setFilterMaterial(e.target.value as any)}
                              className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                            >
                              <option value="all">All Materials</option>
                              <option value="Copper">Copper</option>
                              <option value="Aluminium">Aluminium</option>
                            </select>
                          </div>

                          {/* Cable Size Filter */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Cable Size</span>
                            <select
                              value={filterSize}
                              onChange={(e) => setFilterSize(e.target.value)}
                              className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                            >
                              <option value="all">All Sizes</option>
                              {uniqueSizes.map((s) => (
                                <option key={s} value={String(s)}>{s} mmÂ²</option>
                              ))}
                            </select>
                          </div>

                          {/* Voltage Filter */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Voltage</span>
                            <select
                              value={filterVoltage}
                              onChange={(e) => setFilterVoltage(e.target.value)}
                              className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                            >
                              <option value="all">All Voltages</option>
                              {uniqueVoltages.map((v) => (
                                <option key={v} value={String(v)}>{v} V</option>
                              ))}
                            </select>
                          </div>

                          {/* Flagged cables filter */}
                          <div className="pt-2 border-t border-border">
                            <label className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover:bg-surface-2 text-[12px] font-medium text-foreground select-none">
                              <input
                                type="checkbox"
                                checked={filterFlaggedOnly}
                                onChange={(e) => setFilterFlaggedOnly(e.target.checked)}
                                className="rounded border-border text-primary focus:ring-0 size-3.5 cursor-pointer"
                              />
                              <Flag className="size-3.5 text-red-500 fill-red-500" />
                              <span>Flagged cables only</span>
                            </label>
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Sort Popover */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                              sortBy !== "none"
                                ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                                : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                            }`}
                          >
                            <ArrowUpDown className="size-3.5 shrink-0" />
                            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                              Sort
                            </span>
                            {sortBy !== "none" && (
                              <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                                ✓
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                          <div className="flex items-center justify-between pb-1.5 border-b border-border">
                            <span className="text-[12px] font-semibold text-foreground">Sort Options</span>
                            {sortBy !== "none" && (
                              <button
                                onClick={() => setSortBy("none")}
                                className="text-[10px] text-primary hover:underline font-semibold"
                              >
                                Reset
                              </button>
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Order By</span>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as any)}
                              className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                            >
                              <option value="none">Default (Run Sequence)</option>
                              <option value="description">Description (A-Z)</option>
                              <option value="length-desc">Length (Longest First)</option>
                              <option value="length-asc">Length (Shortest First)</option>
                              <option value="size-desc">Cable Size (Largest First)</option>
                              <option value="isc-desc">Fault Current (Highest First)</option>
                            </select>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selected.size > 0 && (
                        <>
                          <TBtn
                            onClick={() => handleToggleFlag()}
                          >
                            <Flag className="size-3.5 text-red-500" /> Flag Selected ({selected.size})
                          </TBtn>
                          <TBtn 
                            onClick={() => {
                              const duplicated: CableRow[] = [];
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
                            }}
                          >
                            <Copy className="size-3.5" /> Duplicate Selected ({selected.size})
                          </TBtn>
                          <TBtn
                            onClick={async () => {
                              const ok = await confirm(`Are you sure you want to delete ${selected.size} selected rows?`);
                              if (ok) {
                                setRows(rows.filter(r => !selected.has(r.id)));
                                clearSelection();
                              }
                            }}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="size-3.5" /> Delete Selected ({selected.size})
                          </TBtn>
                        </>
                      )}
                      <ImportExcelBtn
                        columnMapping={{
                          "Description": "description",
                          "Cable Length (m)": "length",
                          "Length (m)": "length",
                          "Cable Length (ft)": "length",
                          "Length (ft)": "length",
                          "Length": "length",
                          "Number of Parallel Runs": "runs",
                          "Runs": "runs",
                          "Cable Size (mm²)": "size",
                          "Size": "size",
                          "Voltage (V)": "voltage",
                          "Voltage": "voltage",
                          "Cable Material": "material",
                          "Material": "material",
                          "Remarks": "remarks"
                        }}
                        onImport={handleImportExcelRows}
                      />
                      <TBtn onClick={handleExportPDF}><FileText className="size-3.5" /> Export</TBtn>
                      <TBtn primary onClick={handleAddRow}><Plus className="size-3.5" /> Add Row</TBtn>
                    </div>
                  </div>

                  {/* Virtualized data grid */}
                  <div className="flex-1 min-h-[350px]">
                    <DataGrid
                      rows={filteredRows}
                      columns={columns}
                      selected={selected}
                      onToggle={handleToggle}
                      onToggleAll={handleToggleAll}
                      renderContextMenu={renderRowContextMenu}
                      onRowDoubleClick={(row) => setPreviewRow(row)}
                      activeRowId={previewRow?.id}
                      rowClassName={(r) => 
                        r.id === highlightedTargetId 
                          ? "bg-primary/10 ring-1 ring-primary" 
                          : r.flagged 
                          ? "bg-red-500/[0.04] dark:bg-red-500/[0.08]" 
                          : ""
                      }
                      isReadOnly={isEffectiveReadOnly}
                    />
                  </div>

                  {/* Bottom Summary Footer Bar matching Cable Voltage Drop & Ventilation */}
                  <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg select-none">
                    <div>
                      Showing <span className="text-foreground font-medium tabular">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} cables
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 tabular text-[11px]">
                      <span>Σ Length: <span className="font-mono text-foreground font-medium">{calculatedData.totalCableLength.toFixed(1)} {unitSystem === "ip" ? "ft" : "m"}</span></span>
                      <span>Total Z: <span className="font-mono text-foreground font-medium">{calculatedData.totalZ.toFixed(5)} Ω</span></span>
                      <span>Final Isc: <span className={`font-mono font-bold ${calculatedData.finalIsc > 50 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{calculatedData.finalIsc.toFixed(3)} kA</span></span>
                      {flaggedCount > 0 && (
                        <span className="text-rose-500 font-semibold flex items-center gap-1">
                          <Flag className="size-3 fill-rose-500 text-rose-500" /> {flaggedCount} Flagged
                        </span>
                      )}
                    </div>
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
                      <TBtn primary onClick={handleExportPDF}><FileText className="size-3.5" /> Export</TBtn>
                    </div>
                  </div>

                  {/* Results Panel cards */}
                  <div className="w-full max-w-[210mm] grid grid-cols-2 md:grid-cols-5 gap-4 select-none no-print">
                    
                    {/* Total Cable Length */}
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Total Length</span>
                      <div className="mt-2.5">
                        <strong className="text-[15px] font-bold font-mono text-foreground block">
                          {calculatedData.totalCableLength.toFixed(1)} m
                        </strong>
                      </div>
                    </div>

                    {/* Total Resistance */}
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Total Resistance</span>
                      <div className="mt-2.5">
                        <strong className="text-[15px] font-bold font-mono text-foreground block">
                          {calculatedData.totalR.toFixed(5)} Î©
                        </strong>
                      </div>
                    </div>

                    {/* Total Reactance */}
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Total Reactance</span>
                      <div className="mt-2.5">
                        <strong className="text-[15px] font-bold font-mono text-foreground block">
                          {calculatedData.totalX.toFixed(5)} Î©
                        </strong>
                      </div>
                    </div>

                    {/* Total Impedance */}
                    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Total Impedance</span>
                      <div className="mt-2.5">
                        <strong className="text-[15px] font-bold font-mono text-foreground block">
                          {calculatedData.totalZ.toFixed(5)} Î©
                        </strong>
                      </div>
                    </div>

                    {/* Final Short Circuit Current */}
                    <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex flex-col justify-between shadow-md relative overflow-hidden">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Final Isc (kA)</span>
                      <div className="mt-2">
                        <strong className="text-[16px] font-black font-mono tracking-tight text-white block">
                          {calculatedData.finalIsc.toFixed(3)} kA
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
                          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase font-sans">Short Circuit Calculation Report</h1>
                          <p className="text-[11px] text-muted-foreground mt-1">Preliminary electrical short circuit current analysis sheet</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded bg-slate-900 text-white dark:bg-slate-800 text-xs font-bold font-mono">
                            {calculatedData.finalIsc.toFixed(3)} kA Final Fault
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sizing coefficients */}
                    <div className="grid grid-cols-2 gap-6 text-[12px] mb-8 pb-6 border-b border-border/80">
                      <div>
                        <h4 className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5">Source Parameters</h4>
                        <p><strong>Utility Fault Level:</strong> {sourceFaultLevel} kA</p>
                        <p><strong>Nominal Voltage:</strong> {nominalVoltage} V</p>
                        <p><strong>Source X/R Ratio:</strong> {sourceXrRatio}</p>
                      </div>
                      <div className="text-right">
                        <p><strong>Generated Date:</strong> {new Date().toLocaleDateString()}</p>
                        <p className="mt-1"><strong>Standards Reference:</strong> IEC 60909</p>
                      </div>
                    </div>

                    {/* Cable schedule */}
                    <div className="mb-8 font-sans">
                      <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">1. Connected Cable Runs & Impedance Schedule</h3>
                      <table className="w-full text-[10.5px] text-left border border-slate-200 dark:border-slate-800">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[9px] tracking-wider">
                          <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th className="px-2 py-2 text-center w-10 font-mono">Sr.</th>
                            <th className="px-2 py-2">Description</th>
                            <th className="px-2 py-2 text-center">Length</th>
                            <th className="px-2 py-2 text-center">Runs</th>
                            <th className="px-2 py-2 text-center">Size</th>
                            <th className="px-2 py-2 text-center">Material</th>
                            <th className="px-2 py-2 text-right">R (Î©)</th>
                            <th className="px-2 py-2 text-right">Z (Î©)</th>
                            <th className="px-2 py-2 text-right">Running Î£Z</th>
                            <th className="px-2 py-2 text-right">Isc (kA)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {rows.map((r, idx) => {
                            const details = calculatedData.rowDetails[idx] || { segmentR: 0, segmentZ: 0, runningSumZ: 0, isc: 0 };
                            return (
                              <tr 
                                key={r.id} 
                                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                onDoubleClick={() => setPreviewRow(r)}
                                title="Double-click to view detailed calculation breakdown"
                              >
                                <td className="px-2 py-1.5 text-center font-mono">{idx + 1}</td>
                                <td className="px-2 py-1.5 font-medium">{r.description}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{r.length} {unitSystem === "ip" ? "ft" : "m"}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{r.runs}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{r.size} mm²</td>
                                <td className="px-2 py-1.5 text-center">{r.material}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{details.segmentR.toFixed(5)}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{details.segmentZ.toFixed(5)}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{details.runningSumZ.toFixed(5)}</td>
                                <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white">{details.isc.toFixed(3)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Calculations Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[12px] mb-8 border-b border-border/80 pb-6">
                      <div>
                        <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">2. Sizing Summary Results</h3>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/10">
                          <div className="flex justify-between">
                            <span>Total Cable Length:</span>
                            <strong className="font-mono">{calculatedData.totalCableLength.toFixed(1)} {unitSystem === "ip" ? "ft" : "m"}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Cascade Resistance:</span>
                            <strong className="font-mono">{calculatedData.totalR.toFixed(5)} Ω</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Cascade Reactance:</span>
                            <strong className="font-mono">{calculatedData.totalX.toFixed(5)} Ω</strong>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-1 font-semibold text-primary">
                            <span>Final Short Circuit Current:</span>
                            <strong className="font-mono text-sm">{calculatedData.finalIsc.toFixed(3)} kA</strong>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">3. Source Baseline Impedance</h3>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/10">
                          <div className="flex justify-between">
                            <span>Source R:</span>
                            <strong className="font-mono">{calculatedData.rSource.toFixed(6)} Ω</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Source X:</span>
                            <strong className="font-mono">{calculatedData.xSource.toFixed(6)} Ω</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Source Impedance (Zs):</span>
                            <strong className="font-mono">{calculatedData.zSource.toFixed(6)} Ω</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Engineering Sizing Equations - Collapsible Reference inside report */}
                    <div className="mb-8 border-b border-border/80 pb-6">
                      <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-3">4. Applicable Sizing Formulae</h3>
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div>
                          <p className="font-semibold font-sans text-foreground">Conductor Resistance:</p>
                          <span className="text-primary">R = (rho_T * L) / (Size * Runs)</span>
                        </div>
                        <div>
                          <p className="font-semibold font-sans text-foreground">Running Impedance Cascade:</p>
                          <span className="text-primary">Running ΣZ = sqrt((ΣR_cables + R_s)^2 + (ΣX_cables + X_s)^2)</span>
                        </div>
                        <div className="mt-2">
                          <p className="font-semibold font-sans text-foreground">Conductor Reactance:</p>
                          <span className="text-primary">X = (X_std * L) / (1000 * Runs)</span>
                        </div>
                        <div className="mt-2">
                          <p className="font-semibold font-sans text-foreground">Short Circuit Current (kA):</p>
                          <span className="text-primary">Isc = V / (sqrt(3) * Running ΣZ * 1000)</span>
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
      {commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          onSave={handleSaveComment}
          targetName={commentTargetItem.name}
          targetId={commentTargetItem.id}
          targetType="cable-segment"
          calculatorTitle="Short Circuit Calculator"
          calculatorPath="/short-circuit-calculations"
          existingComments={getMergedItemComments(commentTargetItem.id, commentTargetItem.name, (rows.find(r => r.id === commentTargetItem.id) as any)?.comments, "/short-circuit-calculations", project?.id)}
        />
      )}

      {/* Calculation Preview Modal (IEC 60909 Breakdown on Double-Click) */}
      <CalculationPreviewModal
        isOpen={Boolean(previewRow)}
        onClose={() => setPreviewRow(null)}
        data={previewRow ? getCalculationPreview(previewRow) : null}
      />
    </AppShell>
  );
}
