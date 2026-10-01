import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { TBtn } from "@/components/workspace/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Download, Trash, Copy, Trash2, X, Settings, FolderPlus, HelpCircle, Database, Search, Filter, SlidersHorizontal, FileText, FileSpreadsheet, Flag, Edit3, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle, Sparkles } from "lucide-react";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent, ContextMenuShortcut } from "@/components/ui/context-menu";
import { CalculationPreviewModal, type CalculationPreviewData, type CalculationStep } from "@/components/calculator-framework/CalculationPreviewModal";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import { useElectricalNetworkStore, calculateCircuitLoad } from "@/store/electrical-network";

export const Route = createFileRoute("/cable-voltage-drop")({
  head: () => ({
    meta: [
      { title: "Cable Voltage Drop — MEP Calc" },
      { name: "description", content: "Electrical cable voltage drop calculations" },
    ],
  }),
  component: CableVoltageDropPage,
});

export interface CableVDRow {
  id: string;
  groupName: string;
  from: string;
  description: string;
  load: number; // KW
  voltage: number;
  pf: number;
  lineCurrent: number; // calculated
  runs: number;
  size: string;
  currentPerCable: number; // calculated
  length: number;
  mvAm: number;
  vd: number; // calculated
  vdPercent: number; // calculated
  cumulativeVd: number; // calculated (Parent VD + vdPercent)
  isLinked?: boolean;
  flagged?: boolean;
}

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  onFocus?: (e: any) => void;
  onDoubleClick?: (e: any) => void;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder, disabled, onFocus, onDoubleClick }: InlineInputProps) {
  const isGlobalReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly || (window as any).__mep_approved_readonly);
  const isInputDisabled = Boolean(disabled || isGlobalReadOnly);
  const [localVal, setLocalVal] = useState(String(value ?? ""));

  useEffect(() => {
    const strVal = String(value ?? "");
    if (localVal !== strVal) {
      const parsedLocal = parseFloat(localVal);
      const parsedValue = parseFloat(strVal);
      if (localVal.endsWith('.') && parsedLocal === parsedValue) return;
      if (localVal === '' && parsedValue === 0) return;
      if (localVal === '-' && parsedValue === 0) return;
      setLocalVal(strVal);
    }
  }, [value, localVal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isInputDisabled) return;
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
      placeholder={placeholder}
      disabled={isInputDisabled}
      value={localVal}
      onChange={handleChange}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        if (onDoubleClick) {
          onDoubleClick(e);
        }
      }}
      className={`bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    />
  );
}

const CABLE_CATALOGUE: Record<string, number> = {
  "4c 16": 2.5,
  "4c 25": 1.65,
  "4c 35": 1.15,
  "4c 50": 0.87,
  "4c 70": 0.60,
  "4c 95": 0.43,
  "4c 120": 0.35,
  "4c 150": 0.29,
  "4c 185": 0.24,
  "4c 240": 0.19,
  "4c 300": 0.16,
  "1c 16": 2.5,
  "1c 25": 1.65,
  "1c 35": 1.15,
  "1c 50": 0.87,
  "1c 70": 0.60,
  "1c 95": 0.43,
  "1c 120": 0.35,
  "1c 150": 0.29,
  "1c 185": 0.24,
  "1c 240": 0.19,
  "1c 300": 0.16,
  "1c 400": 0.13,
  "1c 500": 0.11,
  "1c 630": 0.09
};

const normalizeString = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const computeAllRows = (
  rows: CableVDRow[],
  unitSystem: "si" | "ip" = "si",
  parentVdMap: Record<string, number> = {}
): CableVDRow[] => {
  let busbarVdMap: Record<string, number> = {};
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("mep-busbar-calculated-vd-v1");
      if (saved) busbarVdMap = JSON.parse(saved);
    } catch (e) {}
  }

  const computedVdMap = new Map<string, number>();

  return rows.map((row) => {
    const groupName = row.groupName || "Main Feeders";
    let parentVd = parentVdMap[groupName] !== undefined ? parentVdMap[groupName] : 0;

    const fromNorm = normalizeString(row.from);
    if (fromNorm) {
      if (computedVdMap.has(fromNorm)) {
        // Can inherit if needed
      } else {
        for (const key of Object.keys(busbarVdMap)) {
          if (normalizeString(key) === fromNorm && parentVdMap[groupName] === undefined) {
            parentVd = busbarVdMap[key];
            break;
          }
        }
      }
    }

    const V = row.voltage || 400; // prevent div/0
    const PF = row.pf || 0.8;
    const Runs = row.runs || 1;

    // Line Current (A) = (Load * 1000) / (1.732 * Voltage * PF)
    const lineCurrent = (row.load * 1000) / (1.732 * V * PF);
    
    // Line Current Per cable (A) = Line Current / No. of cable Runs
    const currentPerCable = lineCurrent / Runs;

    // VOLTAGE DROP (V) = (mV/A/m * Current Per Cable * Length) / 1000
    const lengthInMeters = unitSystem === "ip" ? ((row.length || 0) * 0.3048) : (row.length || 0);
    const vd = (row.mvAm * currentPerCable * lengthInMeters) / 1000;

    // VOLTAGE DROP %V = (VD / Voltage) * 100
    const vdPercent = (vd / V) * 100;

    // Cumulative VD = Group Parent VD + Cable VD%
    const cumulativeVd = parentVd + vdPercent;

    if (row.description) {
      computedVdMap.set(normalizeString(row.description), cumulativeVd);
    }

    return {
      ...row,
      groupName,
      lineCurrent: Number(lineCurrent.toFixed(2)),
      currentPerCable: Number(currentPerCable.toFixed(2)),
      vd: Number(vd.toFixed(2)),
      vdPercent: Number(vdPercent.toFixed(2)),
      cumulativeVd: Number(cumulativeVd.toFixed(2))
    };
  });
};

const pushToHistory = (
  currentRows: CableVDRow[],
  history: CableVDRow[][],
  setHistory: (h: CableVDRow[][]) => void,
  setRedoStack?: (r: CableVDRow[][]) => void
) => {
  setHistory([...history, [...currentRows]]);
  if (setRedoStack) setRedoStack([]);
};

const DEFAULT_INITIAL_ROWS: CableVDRow[] = [
  {
    id: "vd_init_1",
    groupName: "GROUND FLOOR",
    from: "MDB-MAIN",
    description: "SMDB-1 (GROUND FLOOR MAIN)",
    load: 45,
    voltage: 400,
    pf: 0.85,
    lineCurrent: 76.47,
    runs: 1,
    size: "4c 35",
    currentPerCable: 76.47,
    length: 45,
    mvAm: 1.15,
    vd: 3.96,
    vdPercent: 0.99,
    cumulativeVd: 0.99,
    isLinked: false,
    flagged: false,
  },
  {
    id: "vd_init_2",
    groupName: "GROUND FLOOR",
    from: "SMDB-1",
    description: "DB-LIGHTING (GROUND FLOOR)",
    load: 15,
    voltage: 400,
    pf: 0.9,
    lineCurrent: 24.06,
    runs: 1,
    size: "4c 16",
    currentPerCable: 24.06,
    length: 30,
    mvAm: 2.5,
    vd: 1.8,
    vdPercent: 0.45,
    cumulativeVd: 1.44,
    isLinked: false,
    flagged: false,
  },
  {
    id: "vd_init_3",
    groupName: "GROUND FLOOR",
    from: "SMDB-1",
    description: "CHILLER FEEDER 01",
    load: 120,
    voltage: 400,
    pf: 0.82,
    lineCurrent: 211.08,
    runs: 2,
    size: "4c 120",
    currentPerCable: 105.54,
    length: 60,
    mvAm: 0.35,
    vd: 2.22,
    vdPercent: 0.55,
    cumulativeVd: 1.54,
    isLinked: false,
    flagged: false,
  },
  {
    id: "vd_init_4",
    groupName: "FIRST FLOOR",
    from: "MDB-MAIN",
    description: "SMDB-2 (FIRST FLOOR)",
    load: 55,
    voltage: 400,
    pf: 0.85,
    lineCurrent: 93.46,
    runs: 1,
    size: "4c 50",
    currentPerCable: 93.46,
    length: 50,
    mvAm: 0.87,
    vd: 4.07,
    vdPercent: 1.02,
    cumulativeVd: 1.02,
    isLinked: false,
    flagged: false,
  },
  {
    id: "vd_init_5",
    groupName: "FIRST FLOOR",
    from: "SMDB-2",
    description: "AHU-01 SUPPLY FAN",
    load: 30,
    voltage: 400,
    pf: 0.85,
    lineCurrent: 50.98,
    runs: 1,
    size: "4c 25",
    currentPerCable: 50.98,
    length: 35,
    mvAm: 1.65,
    vd: 2.94,
    vdPercent: 0.74,
    cumulativeVd: 1.76,
    isLinked: false,
    flagged: false,
  },
];

function CableVoltageDropPage() {
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/cable-voltage-drop", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/cable-voltage-drop", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const isApprovedLocked = useCalculationLock("/cable-voltage-drop", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const confirm = useConfirm();
  const prompt = usePrompt();

  const boards = useElectricalNetworkStore(state => state.boards);
  const setBoards = useElectricalNetworkStore(state => state.setBoards);
  const updateCircuit = useElectricalNetworkStore(state => state.updateCircuit);

  const storageKey = `mep_cable_vd_rows_${activeProjectId || project?.id || "default"}`;
  const parentVdStorageKey = `mep_cable_vd_group_parent_${activeProjectId || project?.id || "default"}`;

  const [groupParentVdMap, setGroupParentVdMap] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(parentVdStorageKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return { "GROUND FLOOR": 0, "FIRST FLOOR": 0 };
  });

  const [rows, setRows] = useState<CableVDRow[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            let currentGroup = "Main Feeders";
            const migrated: CableVDRow[] = [];
            parsed.forEach((r: any) => {
              if (r.isGroup) {
                currentGroup = r.description || r.from || "Main Feeders";
              } else {
                migrated.push({
                  ...r,
                  groupName: r.groupName || currentGroup,
                  flagged: Boolean(r.flagged),
                });
              }
            });
            if (migrated.length > 0) {
              return computeAllRows(migrated, "si", {});
            }
          }
        }
      } catch (e) {}
    }
    return computeAllRows(DEFAULT_INITIAL_ROWS, "si", { "GROUND FLOOR": 0, "FIRST FLOOR": 0 });
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeRowId, setActiveRowId] = useState<string>();
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const [history, setHistory] = useState<CableVDRow[][]>([]);
  const [redoStack, setRedoStack] = useState<CableVDRow[][]>([]);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [previewRow, setPreviewRow] = useState<CableVDRow | null>(null);

  const getCalculationPreview = (row: CableVDRow): CalculationPreviewData => {
    const isIP = unitSystem === "ip";
    const V = row.voltage || 400;
    const PF = row.pf || 0.8;
    const runs = row.runs || 1;
    const lengthMeters = isIP ? (Number(row.length) || 0) * 0.3048 : (Number(row.length) || 0);
    const lengthDisplay = `${row.length} ${isIP ? "ft" : "m"}`;
    const parentVd = groupParentVdMap[row.groupName || "Main Feeders"] || 0;
    const vdPercent = row.vdPercent || 0;
    const cumulativeVd = row.cumulativeVd || Number((parentVd + vdPercent).toFixed(2));

    const isSafe = vdPercent <= 2.5;
    const isWarn = vdPercent > 2.5 && vdPercent <= 5.0;
    const isCumulativeSafe = cumulativeVd <= 5.0;

    const steps: CalculationStep[] = [
      {
        stepNumber: 1,
        label: "Continuous Design Line Current (Ib)",
        formula: "Ib = (Load (kW) × 1000) / (√3 × Voltage (V) × Power Factor)",
        substitution: `(${row.load} × 1000) / (1.732 × ${V} × ${PF})`,
        result: row.lineCurrent.toFixed(2),
        unit: "A",
        status: "info",
        description: "Balanced 3-phase full-load continuous line current.",
      },
      {
        stepNumber: 2,
        label: "Current Per Parallel Cable Run (I_cable)",
        formula: "I_cable = Ib / Number of Parallel Cable Runs",
        substitution: `${row.lineCurrent.toFixed(2)} A / ${runs}`,
        result: row.currentPerCable.toFixed(2),
        unit: "A",
        status: "info",
        description: `Current carried per cable conductor with ${runs} parallel run${runs > 1 ? "s" : ""}.`,
      },
      {
        stepNumber: 3,
        label: "Cable Route Length & Conversion",
        formula: isIP ? "Length (m) = Length (ft) × 0.3048" : "Length (m) = Metric Route Length",
        substitution: isIP ? `${row.length} ft × 0.3048` : `${row.length} m`,
        result: lengthMeters.toFixed(2),
        unit: "m",
        status: "info",
        description: `Conductor length utilized for voltage drop calculation (${lengthDisplay}).`,
      },
      {
        stepNumber: 4,
        label: "Voltage Drop in Volts (ΔV)",
        formula: "ΔV (V) = (mV/A/m × I_cable × Length (m)) / 1000",
        substitution: `(${row.mvAm} × ${row.currentPerCable.toFixed(2)} × ${lengthMeters.toFixed(2)}) / 1000`,
        result: row.vd.toFixed(2),
        unit: "V",
        status: "info",
        description: `Line-to-line voltage loss across the cable run using catalogue impedance (${row.mvAm} mV/A/m for ${row.size || "selected cable"}).`,
      },
      {
        stepNumber: 5,
        label: "Branch Circuit Voltage Drop Percentage (ΔV%)",
        formula: "ΔV (%) = (ΔV / Voltage) × 100",
        substitution: `(${row.vd.toFixed(2)} V / ${V} V) × 100`,
        result: `${vdPercent.toFixed(2)}%`,
        unit: "%",
        status: isSafe ? "pass" : isWarn ? "warning" : "warning",
        description: `Permissible branch drop: recommended ≤ 2.5% for sub-feeders (Status: ${isSafe ? "Safe / Compliant" : isWarn ? "Acceptable / Warning" : "Critical / High"}).`,
      },
      {
        stepNumber: 6,
        label: "Cumulative Voltage Drop Upto DB (Cumulative %V)",
        formula: "Cumulative %V = Parent / Source VD% + Branch Cable VD%",
        substitution: `${parentVd.toFixed(2)}% (Source: ${row.groupName}) + ${vdPercent.toFixed(2)}%`,
        result: `${cumulativeVd.toFixed(2)}%`,
        unit: "%",
        status: isCumulativeSafe ? "pass" : "warning",
        description: `Overall voltage drop from upstream source to final board (Allowable limit: ≤ 5.0% per IEC 60364-5-52 / BS 7671 / DEWA).`,
      },
    ];

    return {
      title: "Cable Voltage Drop Calculation",
      itemName: row.description || `Feeder from ${row.from || "Source"}`,
      itemCode: `${row.groupName} • ${row.size || "Selected Cable"} • ${runs > 1 ? `${runs}x ` : ""}${row.size}`,
      standardReference: "IEC 60364-5-52 / BS 7671 / DEWA Regulations",
      inputs: [
        { label: "Feeder Group", value: row.groupName || "Main Feeders" },
        { label: "Fed From", value: row.from || "Main Switchboard" },
        { label: "Connected Load", value: row.load, unit: "kW" },
        { label: "System Voltage", value: V, unit: "V" },
        { label: "Power Factor (cos φ)", value: PF },
        { label: "Number of Runs", value: runs },
        { label: "Cable Size", value: row.size || "Standard Core" },
        { label: "Route Length", value: row.length, unit: isIP ? "ft" : "m" },
        { label: "Unit Drop (mV/A/m)", value: row.mvAm, unit: "mV/A/m" },
        { label: "Source Parent VD%", value: parentVd.toFixed(2), unit: "%" },
      ],
      steps,
      finalResultLabel: "Cumulative Voltage Drop",
      finalResultValue: `${cumulativeVd.toFixed(2)}%`,
      finalResultUnit: isCumulativeSafe ? "(COMPLIANT ≤ 5%)" : "(LIMIT EXCEEDED > 5%)",
      complianceNote: isCumulativeSafe
        ? `Voltage drop complies with IEC 60364-5-52 and BS 7671 maximum 5% cumulative threshold.`
        : `Voltage drop exceeds the recommended 5.0% threshold. Consider increasing cable size or adding parallel runs.`,
    };
  };

  // Save to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && rows.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(rows));
      } catch (e) {}
    }
  }, [rows, storageKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(parentVdStorageKey, JSON.stringify(groupParentVdMap));
      } catch (e) {}
    }
  }, [groupParentVdMap, parentVdStorageKey]);

  // Search, Filter & View/Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVdStatus, setFilterVdStatus] = useState<"all" | "safe" | "warning" | "critical">("all");
  const [filterCableType, setFilterCableType] = useState<"all" | "4c" | "1c">("all");
  const [filterLinkedOnly, setFilterLinkedOnly] = useState(false);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"none" | "vd-desc" | "vd-asc" | "load-desc" | "len-desc" | "desc-asc" | "group-asc">("none");
  const [rowDensity, setRowDensity] = useState<"default" | "compact">("default");

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterVdStatus !== "all") count++;
    if (filterCableType !== "all") count++;
    if (filterLinkedOnly) count++;
    if (filterFlaggedOnly) count++;
    return count;
  }, [filterVdStatus, filterCableType, filterLinkedOnly, filterFlaggedOnly]);

  const handleResetFilters = () => {
    setFilterVdStatus("all");
    setFilterCableType("all");
    setFilterLinkedOnly(false);
    setFilterFlaggedOnly(false);
  };

  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.groupName || "Main Feeders"));
    return Array.from(set);
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.from && r.from.toLowerCase().includes(q)) ||
        (r.size && r.size.toLowerCase().includes(q)) ||
        (r.groupName && r.groupName.toLowerCase().includes(q))
      );
    }

    if (filterVdStatus !== "all") {
      result = result.filter(r => {
        const pct = r.vdPercent || 0;
        if (filterVdStatus === "safe") return pct <= 2.5;
        if (filterVdStatus === "warning") return pct > 2.5 && pct <= 5.0;
        if (filterVdStatus === "critical") return pct > 5.0;
        return true;
      });
    }

    if (filterCableType !== "all") {
      result = result.filter(r => {
        const s = (r.size || "").toLowerCase();
        if (filterCableType === "4c") return s.includes("4c");
        if (filterCableType === "1c") return s.includes("1c");
        return true;
      });
    }

    if (filterLinkedOnly) {
      result = result.filter(r => r.isLinked);
    }

    if (filterFlaggedOnly) {
      result = result.filter(r => r.flagged);
    }

    if (sortOrder !== "none") {
      result.sort((a, b) => {
        if (sortOrder === "vd-desc") return (b.vdPercent || 0) - (a.vdPercent || 0);
        if (sortOrder === "vd-asc") return (a.vdPercent || 0) - (b.vdPercent || 0);
        if (sortOrder === "load-desc") return (b.load || 0) - (a.load || 0);
        if (sortOrder === "len-desc") return (b.length || 0) - (a.length || 0);
        if (sortOrder === "desc-asc") return (a.description || "").localeCompare(b.description || "");
        if (sortOrder === "group-asc") return (a.groupName || "").localeCompare(b.groupName || "");
        return 0;
      });
    }

    return result;
  }, [rows, searchQuery, filterVdStatus, filterCableType, filterLinkedOnly, filterFlaggedOnly, sortOrder]);

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    pushToHistory(rows, history, setHistory, setRedoStack);
    setUnitSystem(newSystem);
    if (shouldConvert) {
      setRows(prev => computeAllRows(prev.map(r => {
        const currentLen = Number(r.length) || 0;
        return {
          ...r,
          length: newSystem === "ip"
            ? Number((currentLen * 3.28084).toFixed(1))
            : Number((currentLen / 3.28084).toFixed(1)),
        };
      }), newSystem, groupParentVdMap));
      toast.success(`Converted units to ${newSystem.toUpperCase()}`);
    } else {
      setRows(prev => computeAllRows(prev, newSystem, groupParentVdMap));
      toast.success(`Switched unit system to ${newSystem.toUpperCase()}`);
    }
  };

  const syncToLoadSchedule = (updatedRow: CableVDRow, updates: Partial<CableVDRow>) => {
    if (!updatedRow.isLinked || (!updates.size && updates.length === undefined && updates.runs === undefined)) return;
    
    const fromNorm = normalizeString(updatedRow.from);
    const descNorm = normalizeString(updatedRow.description);
    const parentBoard = boards.find(b => normalizeString(b.name) === fromNorm);
    
    if (parentBoard) {
       const circuit = parentBoard.circuits.find(c => {
          const cDesc = c.desc || c.roomArea || "";
          return normalizeString(cDesc) === descNorm;
       });
       if (circuit) {
          if (updates.size !== undefined) {
             const field = circuit.wire !== undefined ? "wire" : "wireEcc";
             updateCircuit(parentBoard.id, circuit.id, field, updates.size);
          }
          if (updates.length !== undefined) {
             updateCircuit(parentBoard.id, circuit.id, "len", updates.length.toString());
          }
          if (updates.runs !== undefined) {
             updateCircuit(parentBoard.id, circuit.id, "qty", updates.runs);
          }
       }
    }
  };

  const updateRow = (id: string, updates: Partial<CableVDRow>) => {
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    let newRows = [...rows];
    
    if (selected.has(id) && selected.size > 1) {
      newRows = newRows.map(row => {
        if (selected.has(row.id)) {
          const updatedRow = { ...row, ...updates };
          if (updates.size !== undefined) {
             const normalizedSize = updates.size.toLowerCase().trim();
             if (CABLE_CATALOGUE[normalizedSize] !== undefined) {
                updatedRow.mvAm = CABLE_CATALOGUE[normalizedSize];
             }
          }
          syncToLoadSchedule(updatedRow, updates);
          return updatedRow;
        }
        return row;
      });
    } else {
      newRows = newRows.map(row => {
        if (row.id === id) {
          const updatedRow = { ...row, ...updates };
          
          if (updates.description !== undefined || updates.from !== undefined) {
            if (updatedRow.from && updatedRow.description) {
              const fromNorm = normalizeString(updatedRow.from);
              const descNorm = normalizeString(updatedRow.description);
              
              const parentBoard = boards.find(b => normalizeString(b.name) === fromNorm);
              if (parentBoard) {
                const circuit = parentBoard.circuits.find(c => {
                    const cDesc = c.desc || c.roomArea || "";
                    return normalizeString(cDesc) === descNorm;
                });
                if (circuit) {
                  updatedRow.isLinked = true;
                  const loadW = circuit.loadW !== undefined ? circuit.loadW : calculateCircuitLoad(circuit);
                  if (loadW) updatedRow.load = Number((loadW / 1000).toFixed(2));
                  if (circuit.qty) updatedRow.runs = Number(circuit.qty);
                  if (circuit.wire || circuit.wireEcc) updatedRow.size = circuit.wire || circuit.wireEcc;
                  if (circuit.len) updatedRow.length = Number(circuit.len);
                  
                  const size = circuit.wire || circuit.wireEcc || "";
                  const normalizedSize = size.toLowerCase().trim();
                  if (CABLE_CATALOGUE[normalizedSize] !== undefined) {
                     updatedRow.mvAm = CABLE_CATALOGUE[normalizedSize];
                  }
                } else {
                  updatedRow.isLinked = false;
                }
              } else {
                updatedRow.isLinked = false;
              }
            } else {
               updatedRow.isLinked = false;
            }
          }
          
          if (updates.size !== undefined) {
             const normalizedSize = updates.size.toLowerCase().trim();
             if (CABLE_CATALOGUE[normalizedSize] !== undefined) {
                updatedRow.mvAm = CABLE_CATALOGUE[normalizedSize];
             }
          }
          
          syncToLoadSchedule(updatedRow, updates);
          return updatedRow;
        }
        return row;
      });
    }
    
    setRows(computeAllRows(newRows, unitSystem, groupParentVdMap));
  };

  const handleUpdateGroupParentVd = (groupName: string, val: number) => {
    const updatedMap = { ...groupParentVdMap, [groupName]: val };
    setGroupParentVdMap(updatedMap);
    setRows(prev => computeAllRows(prev, unitSystem, updatedMap));
  };

  const handleToggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected((prev) => {
      const clickedIndex = filteredRows.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;
      const next = new Set(prev);
      if (isShift) {
        const pivotIndex = lastClickedIndex !== null ? lastClickedIndex : 0;
        const start = Math.min(pivotIndex, clickedIndex);
        const end = Math.max(pivotIndex, clickedIndex);
        if (!isCtrl) next.clear();
        for (let i = start; i <= end; i++) {
          const rId = filteredRows[i]?.id;
          if (rId) next.add(rId);
        }
      } else if (isCtrl) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setLastClickedIndex(clickedIndex);
      } else {
        if (prev.has(id) && prev.size === 1) {
          next.delete(id);
          setLastClickedIndex(null);
        } else {
          next.clear();
          next.add(id);
          setLastClickedIndex(clickedIndex);
        }
      }
      return next;
    });
    setActiveRowId(id);
  };

  const handleToggleAll = () => {
    if (selected.size === filteredRows.length && filteredRows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRows.map(r => r.id)));
    }
  };

  const handleToggleGroup = (ids: string[], select: boolean) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (select) {
        ids.forEach(id => next.add(id));
      } else {
        ids.forEach(id => next.delete(id));
      }
      return next;
    });
  };

  const addRowToGroup = (targetGroupName?: string) => {
    const group = targetGroupName || (activeRowId ? rows.find(r => r.id === activeRowId)?.groupName : undefined) || uniqueGroups[0] || "Main Feeders";
    const newId = `vd_${Math.random().toString(36).slice(2, 9)}`;
    const newRow: CableVDRow = {
      id: newId,
      groupName: group,
      from: "",
      description: "",
      load: 0,
      voltage: 400,
      pf: 0.8,
      lineCurrent: 0,
      runs: 1,
      size: "4c 35",
      currentPerCable: 0,
      length: unitSystem === "ip" ? 30 : 10,
      mvAm: 1.15,
      vd: 0,
      vdPercent: 0,
      cumulativeVd: 0,
      isLinked: false,
      flagged: false,
    };
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => computeAllRows([...prev, newRow], unitSystem, groupParentVdMap));
    setSelected(new Set([newId]));
    setActiveRowId(newId);
  };

  const handleAddGroup = async () => {
    const newGroupName = await prompt("Enter new group name (e.g. 'GROUND FLOOR', 'ROOF CHILLERS'):", `FEEDER GROUP ${uniqueGroups.length + 1}`, {
      title: "Add New Feeder Group",
    });
    if (!newGroupName || !newGroupName.trim()) return;
    const trimmed = newGroupName.trim();
    addRowToGroup(trimmed);
    toast.success(`Created group "${trimmed}"`);
  };

  const renameGroup = async (oldName: string) => {
    const newName = await prompt("Enter new group name:", oldName, { title: "Rename Feeder Group" });
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();

    pushToHistory(rows, history, setHistory, setRedoStack);
    const updatedParentVdMap = { ...groupParentVdMap };
    if (updatedParentVdMap[oldName] !== undefined) {
      updatedParentVdMap[trimmed] = updatedParentVdMap[oldName];
      delete updatedParentVdMap[oldName];
      setGroupParentVdMap(updatedParentVdMap);
    }
    const updatedRows = rows.map(r => {
      if ((r.groupName || "Main Feeders") === oldName) {
        return { ...r, groupName: trimmed };
      }
      return r;
    });
    setRows(computeAllRows(updatedRows, unitSystem, updatedParentVdMap));
    toast.success(`Renamed group to "${trimmed}"`);
  };

  const deleteGroup = async (groupName: string) => {
    const groupRows = rows.filter(r => (r.groupName || "Main Feeders") === groupName);
    if (groupRows.length === 0) return;
    if (await confirm(`Are you sure you want to delete group "${groupName}" and its ${groupRows.length} cable(s)?`)) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      const remaining = rows.filter(r => (r.groupName || "Main Feeders") !== groupName);
      setRows(computeAllRows(remaining, unitSystem, groupParentVdMap));
      setSelected(new Set());
      toast.success(`Deleted group "${groupName}"`);
    }
  };

  const loadDummyData = () => {
    // 1. Inject Sample Load Schedule Data
    const sampleMDB: any = {
      id: "board-sample-mdb",
      name: "MDB-MAIN",
      type: "MDB",
      phaseType: "3-Phase",
      fedFrom: "DEWA",
      incomer: { rating: "1600A", sptp: "4P", faultKa: "50", cableSize: "300", eccSize: "150", inc1: "", inc2: "", meterType: "None" },
      circuits: [
        {
          id: "c-1", cirNo: 1, desc: "SMDB-1", qty: 1, loadW: 45000, phase: "R", df: 1, mcb: "100", faultKa: "36", wire: "4c 35", type: "XLPE", ecc: "16", len: "45", ph1Mtr: "", ph3Mtr: "", ctMtr: "", remarks: ""
        },
        {
          id: "c-2", cirNo: 2, desc: "CHILLER-1", qty: 2, loadW: 120000, phase: "Y", df: 1, mcb: "250", faultKa: "36", wire: "4c 120", type: "XLPE", ecc: "70", len: "60", ph1Mtr: "", ph3Mtr: "", ctMtr: "", remarks: ""
        }
      ]
    };
    
    if (!boards.find(b => b.name === "MDB-MAIN")) {
      setBoards([...boards, sampleMDB]);
    }

    // 2. Inject Sample Busbar Data
    const sampleBusbarCalc = {
      "lv panel 01": 0.42,
      "bb 1": 0.42,
      "smdb 1": 0.25
    };
    localStorage.setItem("mep-busbar-calculated-vd-v1", JSON.stringify(sampleBusbarCalc));

    // 3. Set Sample Rows
    pushToHistory(rows, history, setHistory, setRedoStack);
    const demoParentVd = { "GROUND FLOOR": 0.42, "FIRST FLOOR": 0.42 };
    setGroupParentVdMap(demoParentVd);
    setRows(computeAllRows(DEFAULT_INITIAL_ROWS, unitSystem, demoParentVd));
    toast.success("Loaded sample feeder groups & calculations!");
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (await confirm(`Are you sure you want to delete ${selected.size} selected cable(s)?`)) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(prev => computeAllRows(prev.filter(r => !selected.has(r.id)), unitSystem, groupParentVdMap));
      setSelected(new Set());
      setActiveRowId(undefined);
    }
  };

  const duplicateSelected = () => {
    if (selected.size === 0) return;
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    const duplicated: CableVDRow[] = [];
    rows.forEach(r => {
      if (selected.has(r.id)) {
        duplicated.push({
          ...r,
          id: `vd_dup_${Math.random().toString(36).slice(2, 9)}`,
          description: `${r.description} (Copy)`
        });
      }
    });
    setRows(prev => computeAllRows([...prev, ...duplicated], unitSystem, groupParentVdMap));
    toast.success(`Duplicated ${selected.size} cable(s)`);
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Enter" && activeEl.tagName === "INPUT") {
        activeEl.blur();
        return;
      }

      if (e.key === "Escape") {
        activeEl?.blur();
        if (selected.size > 0) {
          e.preventDefault();
          setSelected(new Set());
          setActiveRowId(undefined);
        }
        return;
      }

      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable
      );
      if (isInput) return;

      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(rows.map(r => r.id)));
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        deleteSelected();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (history.length > 0) {
          const previous = history[history.length - 1];
          setRedoStack(prev => [...prev, rows]);
          setRows(previous);
          setHistory(prev => prev.slice(0, -1));
        }
      }

      if (isCmdOrCtrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        if (redoStack.length > 0) {
          const next = redoStack[redoStack.length - 1];
          setHistory(prev => [...prev, rows]);
          setRows(next);
          setRedoStack(prev => prev.slice(0, -1));
        }
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selected.size > 0) {
        e.preventDefault();
        const selectedRows = rows.filter(r => selected.has(r.id));
        navigator.clipboard.writeText(JSON.stringify(selectedRows));
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0) {
              pushToHistory(rows, history, setHistory, setRedoStack);
              const newRows = parsed.map(r => ({
                ...r,
                id: `vd_paste_${Math.random().toString(36).slice(2, 9)}`
              }));
              setRows(prev => computeAllRows([...prev, ...newRows], unitSystem, groupParentVdMap));
            }
          } catch (err) {
            console.error("Failed to paste", err);
          }
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, history, redoStack, activeRowId, groupParentVdMap, unitSystem]);

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newRows: CableVDRow[] = mappedRows.map((mr, idx) => ({
      id: `vd_import_${Date.now()}_${idx}`,
      groupName: mr.groupName || mr.group || mr.floor || "Imported Feeder Group",
      from: mr.from || "",
      description: mr.description || mr.loadRef || `Imported Cable ${idx + 1}`,
      length: Number(mr.length) || 15,
      load: Number(mr.loadKw || mr.load) || 10,
      voltage: Number(mr.voltage) || 400,
      pf: Number(mr.powerFactor || mr.pf) || 0.8,
      runs: Number(mr.runs || mr.qty) || 1,
      size: mr.size || mr.cableType || "4c 35",
      mvAm: Number(mr.mvAm) || 1.15,
      lineCurrent: 0,
      currentPerCable: 0,
      vd: 0,
      vdPercent: 0,
      cumulativeVd: 0,
      flagged: false,
    }));
    
    setRows(prev => computeAllRows([...prev, ...newRows], unitSystem, groupParentVdMap));
    toast.success(`Imported ${newRows.length} cable(s)`);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Cable VD");

    sheet.columns = [
      { width: 8 },  // S.No
      { width: 16 }, // From
      { width: 34 }, // Description
      { width: 14 }, // Load
      { width: 13 }, // Voltage
      { width: 10 }, // PF
      { width: 15 }, // Line Current
      { width: 10 }, // Runs
      { width: 15 }, // Size
      { width: 16 }, // Current/Cable
      { width: 14 }, // Length
      { width: 12 }, // mV/A/m
      { width: 16 }, // VD (V)
      { width: 16 }, // VD %
      { width: 22 }, // Cumulative %
    ];

    const titleRow = sheet.addRow([`Calculation No: CEC-EED-PXXX-209  Rev. No: 0`, "", "", "", "", "", "Date       :"]);
    titleRow.font = { bold: true };
    const projectRow = sheet.addRow([`Project No      : ${project?.id || ""}`, "", "", "", "", "", "Client     :"]);
    projectRow.font = { bold: true };
    const nameRow = sheet.addRow([`Project Name : ${project?.name || ""}`, "", "", "", "", "", "End User :"]);
    nameRow.font = { bold: true };

    sheet.mergeCells("A1:F1");
    sheet.mergeCells("A2:F2");
    sheet.mergeCells("A3:F3");
    
    const headerTitle = sheet.addRow(["CABLE VOLTAGE DROP CALCULATIONS"]);
    headerTitle.font = { bold: true, size: 14 };
    sheet.mergeCells(4, 1, 4, 15);
    headerTitle.alignment = { horizontal: 'center' };
    
    sheet.addRow([]);

    const header1 = sheet.addRow([
      "Item", "From", "Description of Connection", "Total Load (kW)",
      "Voltage (V)", "Power Factor (Cos Φ)", "Line Current (A)", "No. of Runs",
      "Cable Size", "A / Cable", unitSystem === "ip" ? "Length (ft)" : "Length (m)", "mV/A/m",
      "VD (V)", "VD (%)", "Cumulative VD %"
    ]);

    header1.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    sheet.getRow(6).height = 36;

    uniqueGroups.forEach((groupName) => {
      const groupRows = rows.filter(r => (r.groupName || "Main Feeders") === groupName);
      if (groupRows.length === 0) return;
      const parentVd = groupParentVdMap[groupName] || 0;

      const xlGroupRow = sheet.addRow([
        "", "", `FEEDER GROUP: ${groupName.toUpperCase()}`, "", "", "", "", "", "", "", "", "", "", "Parent %:", parentVd
      ]);
      xlGroupRow.font = { bold: true, color: { argb: 'FF06456F' } };
      xlGroupRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      sheet.mergeCells(xlGroupRow.number, 3, xlGroupRow.number, 13);

      let itemCounter = 1;
      groupRows.forEach((row) => {
        const xlRow = sheet.addRow([
          itemCounter++,
          row.from,
          row.description,
          row.load,
          row.voltage,
          row.pf,
          row.lineCurrent,
          row.runs,
          row.size,
          row.currentPerCable,
          row.length,
          row.mvAm,
          row.vd,
          row.vdPercent,
          row.cumulativeVd
        ]);
        xlRow.eachCell((cell, colNumber) => {
          if (colNumber > 3 && colNumber < 16) cell.alignment = { horizontal: 'center' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      });
    });
    
    const sigRow = sheet.rowCount ? sheet.rowCount + 2 : 20;
    addExcelSignatureBlock(sheet, sigRow, currentUserName, project?.id || "default", "cable-voltage-drop");
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "Cable_Voltage_Drop_Calculations.xlsx");
    toast.success("Exported Cable Voltage Drop calculation sheet!");
  };

  // Group Header Renderer (Matches ventilation.tsx & media_1790747266187.png)
  const renderFeederGroupHeader = (groupName: string) => {
    const parentVd = groupParentVdMap[groupName] || 0;
    return (
      <div className="flex items-center justify-between w-full pr-3 font-medium">
        <span className="flex items-center gap-1.5">
          <strong className="font-bold text-primary uppercase">{groupName}</strong>
          <span className="text-[10px] text-muted-foreground font-normal">(Right-click or press Delete to remove)</span>
        </span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Parent VD:</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={parentVd}
            disabled={isEffectiveReadOnly}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              handleUpdateGroupParentVd(groupName, val);
            }}
            className="h-5 w-16 px-1.5 text-xs font-mono font-bold bg-background border border-border rounded text-center text-primary focus:border-primary focus:outline-none"
            title="Incoming Source Voltage Drop % for this group"
          />
          <span className="text-[10px] text-muted-foreground font-mono">%</span>
        </div>
      </div>
    );
  };

  const renderFeederGroupContextMenu = (groupName: string) => {
    return (
      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
        <ContextMenuItem
          onClick={() => renameGroup(groupName)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Rename Group</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => addRowToGroup(groupName)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Plus className="size-3.5 text-muted-foreground" />
          <span>Add Cable to Group</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={() => deleteGroup(groupName)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Group</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  // Columns definition (styled like media_1790747266187.png)
  const columns = useMemo<Column<CableVDRow>[]>(() => [
    {
      key: "from",
      header: "FROM",
      width: 110,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          className="w-full text-left font-mono tabular text-[13px]"
          value={row.from}
          placeholder="e.g. MDB-1"
          onCommit={(val) => updateRow(row.id, { from: val })}
          onFocus={() => { if (!selected.has(row.id)) setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          onDoubleClick={() => setPreviewRow(row)}
        />
      ),
    },
    {
      key: "description",
      header: "DESCRIPTION",
      width: 230,
      editable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 w-full cursor-pointer" onDoubleClick={() => setPreviewRow(row)}>
          <span className="size-1.5 rounded-full bg-blue-500 shrink-0 ml-1" />
          <InlineInput
            disabled={isEffectiveReadOnly}
            className="w-full text-left text-[13px] font-medium"
            value={row.description}
            placeholder="e.g. SMDB-1"
            onCommit={(val) => updateRow(row.id, { description: val })}
            onFocus={() => { if (!selected.has(row.id)) setSelected(new Set([row.id])); setActiveRowId(row.id); }}
            onDoubleClick={() => setPreviewRow(row)}
          />
          {row.isLinked && (
            <div className="shrink-0 mr-1 text-emerald-500" title="Linked to Load Schedule">
              <Database size={13} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "load",
      header: "LOAD (KW)",
      width: 85,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          step="0.1"
          min={0}
          className="w-full text-center font-mono tabular text-[13px]"
          value={row.load}
          onCommit={(val) => updateRow(row.id, { load: parseFloat(val) || 0 })}
          onFocus={() => { if (!selected.has(row.id)) setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          onDoubleClick={() => setPreviewRow(row)}
        />
      ),
    },
    {
      key: "voltage",
      header: "VOLTS (V)",
      width: 80,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          min={1}
          className="w-full text-center font-mono tabular text-[13px]"
          value={row.voltage}
          onCommit={(val) => updateRow(row.id, { voltage: parseFloat(val) || 400 })}
          onFocus={() => { if (!selected.has(row.id)) setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          onDoubleClick={() => setPreviewRow(row)}
        />
      ),
    },
    {
      key: "pf",
      header: "PF",
      width: 60,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          step="0.01"
          min={0.1}
          max={1}
          className="w-full text-center font-mono tabular text-[13px]"
          value={row.pf}
          onCommit={(val) => updateRow(row.id, { pf: parseFloat(val) || 0.8 })}
          onFocus={() => { if (!selected.has(row.id)) setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          onDoubleClick={() => setPreviewRow(row)}
        />
      ),
    },
    {
      key: "lineCurrent",
      header: "LINE (A)",
      width: 80,
      align: "center",
      mono: true,
      render: (row) => (
        <span 
          onDoubleClick={() => setPreviewRow(row)}
          className="font-mono tabular text-[13px] text-muted-foreground w-full block text-center cursor-pointer hover:text-foreground"
          title="Double-click to view calculation preview"
        >
          {row.lineCurrent}
        </span>
      ),
    },
    {
      key: "runs",
      header: "RUNS",
      width: 60,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          min={1}
          className="w-full text-center font-mono tabular text-[13px]"
          value={row.runs}
          onCommit={(val) => updateRow(row.id, { runs: parseInt(val) || 1 })}
          onFocus={() => { if (!selected.has(row.id)) setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          onDoubleClick={() => setPreviewRow(row)}
        />
      ),
    },
    {
      key: "size",
      header: "CABLE SIZE",
      width: 105,
      align: "center",
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          className="w-full text-center font-mono tabular text-[13px]"
          value={row.size}
          placeholder="e.g. 4c 35"
          onCommit={(val) => updateRow(row.id, { size: val })}
          onFocus={() => { if (!selected.has(row.id)) setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          onDoubleClick={() => setPreviewRow(row)}
        />
      ),
    },
    {
      key: "currentPerCable",
      header: "A / CABLE",
      width: 80,
      align: "center",
      mono: true,
      render: (row) => (
        <span 
          onDoubleClick={() => setPreviewRow(row)}
          className="font-mono tabular text-[13px] text-muted-foreground w-full block text-center cursor-pointer hover:text-foreground"
          title="Double-click to view calculation preview"
        >
          {row.currentPerCable}
        </span>
      ),
    },
    {
      key: "length",
      header: unitSystem === "ip" ? "LEN (FT)" : "LEN (M)",
      width: 80,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          step="0.5"
          min={0}
          className="w-full text-center font-mono tabular text-[13px]"
          value={row.length}
          onCommit={(val) => updateRow(row.id, { length: parseFloat(val) || 0 })}
          onFocus={() => { if (!selected.has(row.id)) setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          onDoubleClick={() => setPreviewRow(row)}
        />
      ),
    },
    {
      key: "mvAm",
      header: "MV/A/M",
      width: 75,
      align: "center",
      mono: true,
      editable: true,
      render: (row) => (
        <InlineInput
          disabled={isEffectiveReadOnly}
          type="number"
          step="0.01"
          min={0}
          className="w-full text-center font-mono tabular text-[13px]"
          value={row.mvAm}
          onCommit={(val) => updateRow(row.id, { mvAm: parseFloat(val) || 0 })}
          onFocus={() => { if (!selected.has(row.id)) setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          onDoubleClick={() => setPreviewRow(row)}
        />
      ),
    },
    {
      key: "vd",
      header: "VD (V)",
      width: 75,
      align: "center",
      mono: true,
      render: (row) => (
        <span 
          onDoubleClick={() => setPreviewRow(row)}
          className="font-mono tabular text-[13px] font-semibold text-foreground w-full block text-center cursor-pointer hover:text-primary"
          title="Double-click to view calculation preview"
        >
          {row.vd}
        </span>
      ),
    },
    {
      key: "vdPercent",
      header: "VD (%)",
      width: 95,
      align: "center",
      render: (row) => {
        const pct = row.vdPercent || 0;
        const isSafe = pct <= 2.5;
        const isWarn = pct > 2.5 && pct <= 5.0;

        const badgeClass = isSafe
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
          : isWarn
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20"
          : "bg-destructive/15 text-destructive dark:text-red-400 border-destructive/20";
          
        const dotClass = isSafe
          ? "bg-emerald-500"
          : isWarn
          ? "bg-amber-500"
          : "bg-red-500";

        return (
          <span 
            onDoubleClick={() => setPreviewRow(row)}
            className="inline-flex items-center justify-center gap-1.5 w-full cursor-pointer group"
            title="Double-click to view calculation preview"
          >
            <span className={`size-1.5 rounded-full shrink-0 ${dotClass}`} />
            <span className={`font-bold rounded-full text-[11px] leading-none py-1 px-2 text-center font-mono border group-hover:scale-105 transition-transform ${badgeClass}`}>
              {pct.toFixed(2)}%
            </span>
          </span>
        );
      },
    },
    {
      key: "cumulativeVd",
      header: "CUMUL. %V",
      width: 90,
      align: "center",
      mono: true,
      render: (row) => {
        const cum = row.cumulativeVd || 0;
        const isOver = cum > 5.0;
        return (
          <span 
            onDoubleClick={() => setPreviewRow(row)}
            className={`font-mono font-bold text-[12.5px] tabular w-full block text-center cursor-pointer hover:underline ${isOver ? "text-destructive" : "text-primary"}`}
            title="Double-click to view calculation preview"
          >
            {cum.toFixed(2)}%
          </span>
        );
      },
    },
    {
      key: "flagged",
      header: "",
      width: 36,
      align: "center",
      render: (row) => (
        <button
          type="button"
          disabled={isEffectiveReadOnly}
          onClick={(e) => {
            e.stopPropagation();
            updateRow(row.id, { flagged: !row.flagged });
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
          title={row.flagged ? "Unflag cable" : "Flag cable"}
        >
          <Flag
            className={`size-3.5 transition-all duration-200 ${
              row.flagged
                ? "fill-red-500 text-red-500 scale-110"
                : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
            }`}
          />
        </button>
      ),
    },
  ], [rows, selected, unitSystem, isEffectiveReadOnly]);

  // Statistics for Footer Bar
  const totalLoadKw = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.load) || 0), 0), [rows]);
  const totalLength = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.length) || 0), 0), [rows]);
  const maxVd = useMemo(() => rows.reduce((max, r) => Math.max(max, Number(r.vdPercent) || 0), 0), [rows]);
  const safeCount = useMemo(() => rows.filter(r => (r.vdPercent || 0) <= 2.5).length, [rows]);
  const warnCount = useMemo(() => rows.filter(r => (r.vdPercent || 0) > 2.5 && (r.vdPercent || 0) <= 5.0).length, [rows]);
  const critCount = useMemo(() => rows.filter(r => (r.vdPercent || 0) > 5.0).length, [rows]);
  const flaggedCount = useMemo(() => rows.filter(r => r.flagged).length, [rows]);

  return (
    <AppShell 
      title="Cable Voltage Drop Calculations" 
      actions={
        <UnitToggle
          unitSystem={unitSystem}
          onChange={handleUnitToggle}
          disabled={isEffectiveReadOnly}
          ipLabel="IP"
          siLabel="SI"
          ipDescription="Imperial (IP) [Feet - ft]"
          siDescription="Metric (SI) [Meters - m]"
          inputDescriptions="Cable Run Lengths"
          conversionExample={
            unitSystem === "si"
              ? "Convert 30 m → 98.4 ft"
              : "Convert 98.4 ft → 30 m"
          }
        />
      }
    >
      <div className={`flex-1 flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30`}>
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Top Filter & Action Toolbar (Matches ventilation toolbar & image) */}
          <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2 min-h-[44px] h-auto border-b border-border bg-background shrink-0 select-none gap-2 overflow-visible">
            {/* Left: Search input, Filter button, View/Sort button */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter cables..."
                  className="h-7 w-56 pl-8 pr-3 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-full text-[12px] outline-none transition-all"
                />
              </div>

              {/* Filter Icon Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                      activeFiltersCount > 0
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-surface-2 hover:text-foreground"
                    }`}
                    title="Filters"
                  >
                    <Filter className="size-3.5 transition-transform duration-150 group-hover:scale-105" />
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-75">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filter Cables</span>
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={handleResetFilters}
                        className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Reset all
                      </button>
                    )}
                  </div>

                  {/* Filter by VD status */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Voltage Drop Status</span>
                    <div className="grid grid-cols-2 gap-1 bg-surface-2 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setFilterVdStatus("all")}
                        className={`py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          filterVdStatus === "all" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterVdStatus("safe")}
                        className={`py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          filterVdStatus === "safe" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Safe (≤ 2.5%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterVdStatus("warning")}
                        className={`py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          filterVdStatus === "warning" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Warn (2.5-5%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterVdStatus("critical")}
                        className={`py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          filterVdStatus === "critical" ? "bg-rose-500/20 text-rose-700 dark:text-rose-400 font-semibold" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Critical (&gt; 5%)
                      </button>
                    </div>
                  </div>

                  {/* Filter by cable core */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Cable Type</span>
                    <div className="grid grid-cols-3 gap-1 bg-surface-2 p-1 rounded-lg">
                      {(["all", "4c", "1c"] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFilterCableType(type)}
                          className={`py-1 text-[11px] font-medium rounded-md transition-all uppercase cursor-pointer ${
                            filterCableType === type ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Flagged and linked toggles */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t">
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterFlaggedOnly}
                        onChange={(e) => setFilterFlaggedOnly(e.target.checked)}
                        className="rounded accent-primary size-3.5"
                      />
                      <Flag className="size-3 text-red-500 fill-red-500" />
                      <span>Flagged cables only</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterLinkedOnly}
                        onChange={(e) => setFilterLinkedOnly(e.target.checked)}
                        className="rounded accent-primary size-3.5"
                      />
                      <Database className="size-3 text-emerald-500" />
                      <span>Linked to Load Schedule only</span>
                    </label>
                  </div>
                </PopoverContent>
              </Popover>

              {/* View & Sort Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="relative inline-flex items-center justify-center h-7 w-7 rounded-full border border-transparent hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group"
                    title="View & Sort"
                  >
                    <SlidersHorizontal className="size-3.5 transition-transform duration-150 group-hover:scale-105" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-3 flex flex-col gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">View &amp; Sort Options</span>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Row Density</span>
                    <div className="flex items-center bg-surface-2 p-0.5 rounded-full border border-border">
                      <button
                        type="button"
                        onClick={() => setRowDensity("default")}
                        className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all cursor-pointer ${
                          rowDensity === "default" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Default
                      </button>
                      <button
                        type="button"
                        onClick={() => setRowDensity("compact")}
                        className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all cursor-pointer ${
                          rowDensity === "compact" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
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
                      className="h-7 w-full px-2 bg-surface-2 text-foreground border border-border rounded-lg text-xs outline-none cursor-pointer"
                    >
                      <option value="none">Original Order</option>
                      <option value="vd-desc">Voltage Drop % (High to Low)</option>
                      <option value="vd-asc">Voltage Drop % (Low to High)</option>
                      <option value="load-desc">Load kW (High to Low)</option>
                      <option value="len-desc">Length (Longest First)</option>
                      <option value="desc-asc">Description (A-Z)</option>
                      <option value="group-asc">Group Name (A-Z)</option>
                    </select>
                  </div>
                </PopoverContent>
              </Popover>

              {selected.size > 0 && (
                <TBtn 
                  onClick={deleteSelected} 
                  className="border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-500/50"
                >
                  <Trash2 className="size-3.5" /> Delete ({selected.size})
                </TBtn>
              )}
            </div>

            {/* Right: Import Excel, Export, Add Group, Add Row */}
            <div className="flex items-center gap-2">
              <ImportExcelBtn
                columnMapping={{
                  "Group": "groupName",
                  "Floor": "groupName",
                  "Feeder Group": "groupName",
                  "From": "from",
                  "Description": "description",
                  "Load Ref": "description",
                  "To": "description",
                  "Load (kW)": "load",
                  "Load": "load",
                  "Voltage": "voltage",
                  "PF": "pf",
                  "Power Factor": "pf",
                  "Runs": "runs",
                  "Cable Size": "size",
                  "Size": "size",
                  "Length (m)": "length",
                  "Length (ft)": "length",
                  "Length": "length",
                  "mV/A/m": "mvAm"
                }}
                onImport={handleImportExcelRows}
              />

              <TBtn onClick={exportExcel}>
                <FileText className="size-3.5" /> Export
              </TBtn>

              <TBtn onClick={handleAddGroup}>
                <FolderPlus className="size-3.5" /> Add Group
              </TBtn>

              <TBtn primary onClick={() => addRowToGroup()}>
                <Plus className="size-3.5" /> Add Row
              </TBtn>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            <div className="flex-1 flex flex-col bg-background overflow-hidden">
              {rows.length > 0 ? (
                filteredRows.length > 0 ? (
                  <DataGrid
                    rows={filteredRows}
                    columns={columns}
                    selected={selected}
                    onToggle={handleToggle}
                    onToggleAll={handleToggleAll}
                    groupBy={(r) => r.groupName || "Main Feeders"}
                    groupOrder={uniqueGroups}
                    renderGroupHeader={renderFeederGroupHeader}
                    renderGroupContextMenu={renderFeederGroupContextMenu}
                    onToggleGroup={handleToggleGroup}
                    onRowDoubleClick={(row) => setPreviewRow(row)}
                    activeRowId={previewRow?.id || activeRowId}
                    rowClassName={(r) => r.flagged ? "bg-red-500/5 hover:bg-red-500/10" : ""}
                    renderContextMenu={(row) => (
                      <ContextMenuContent className="w-56">
                        <ContextMenuItem onClick={() => setPreviewRow(row)} className="font-semibold text-primary">
                          <Sparkles className="size-4 mr-2 text-primary" /> View Calculation Preview
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => addRowToGroup(row.groupName)}>
                          <Plus className="size-4 mr-2" /> Add Cable to this Group
                        </ContextMenuItem>
                        <ContextMenuItem onClick={handleAddGroup}>
                          <FolderPlus className="size-4 mr-2" /> Add New Group
                        </ContextMenuItem>
                        <ContextMenuItem onClick={duplicateSelected} disabled={selected.size === 0}>
                          <Copy className="size-4 mr-2" /> Duplicate Selected
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem 
                          onClick={() => updateRow(row.id, { flagged: !row.flagged })}
                        >
                          <Flag className={`size-4 mr-2 ${row.flagged ? "fill-red-500 text-red-500" : ""}`} /> 
                          {row.flagged ? "Unflag Cable" : "Flag Cable"}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem 
                          onClick={deleteSelected} 
                          disabled={selected.size === 0}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                        >
                          <Trash className="size-4 mr-2" /> Delete Selected
                        </ContextMenuItem>
                      </ContextMenuContent>
                    )}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-3 border border-border shadow-xs">
                      <Search className="size-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">No matching cables found</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mb-4">
                      Try adjusting your search query or reset your active filters.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        handleResetFilters();
                      }}
                      className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-xs font-semibold transition-all cursor-pointer"
                    >
                      Reset Search &amp; Filters
                    </button>
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-xs">
                    <Plus className="size-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">No cable VD rows</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mb-4">
                    Add a group or load sample data to begin calculating your cable voltage drops.
                  </p>
                  <button 
                    onClick={handleAddGroup}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[13px] font-medium shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="size-4" /> Add First Group
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Summary Footer Bar (Matches ventilation.tsx & media_1790747266187.png) */}
            <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg select-none">
              <div>
                Showing <span className="text-foreground font-medium tabular">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} cables
              </div>
              <div className="flex items-center gap-3 sm:gap-4 tabular text-[11px]">
                <span>Σ Load: <span className="font-mono text-foreground font-medium">{totalLoadKw.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW</span></span>
                <span>Σ Length: <span className="font-mono text-foreground font-medium">{totalLength.toLocaleString(undefined, { maximumFractionDigits: 0 })} {unitSystem === "ip" ? "ft" : "m"}</span></span>
                <span>Max VD: <span className={`font-mono font-bold ${maxVd > 5 ? "text-rose-600 dark:text-rose-400" : maxVd > 4 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>{maxVd.toFixed(2)}%</span></span>
                <span className="hidden md:inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 inline-block" /> {safeCount} Safe
                  <span className="size-1.5 rounded-full bg-amber-500 inline-block ml-1" /> {warnCount} Warn
                  {critCount > 0 && (
                    <>
                      <span className="size-1.5 rounded-full bg-rose-500 inline-block ml-1" />
                      <span className="text-rose-600 dark:text-rose-400 font-bold">{critCount} Critical</span>
                    </>
                  )}
                </span>
                {flaggedCount > 0 && (
                  <span className="text-rose-500 font-semibold flex items-center gap-1">
                    <Flag className="size-3 fill-rose-500 text-rose-500" /> {flaggedCount} Flagged
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calculation Preview Modal (Triggered on Double-Click) */}
      <CalculationPreviewModal
        isOpen={Boolean(previewRow)}
        onClose={() => setPreviewRow(null)}
        data={previewRow ? getCalculationPreview(previewRow) : null}
      />
    </AppShell>
  );
}
