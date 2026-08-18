import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Plus, Download, Upload, Filter, Trash2, Edit3, Copy, X, Sparkles,
  AlertTriangle, CheckCircle2, Info, FileText, Printer, FileSpreadsheet,
  ArrowUpDown, ChevronRight, ChevronDown, RefreshCw, Play, Settings, Search,
  HelpCircle, Share2, Clipboard, Undo, Redo,
  Activity, Droplet
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace } from "@/lib/workspace-store";
import { useConfirm } from "@/hooks/use-confirm";
import { dirtyStore } from "@/lib/dirty-store";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

export const Route = createFileRoute("/plumbing-sprinkler-kfactor")({
  head: () => ({
    meta: [
      { title: "Sprinkler K-Factor — MEP Calc" },
      { name: "description", content: "NFPA 13 Sprinkler K-Factor calculations, flow rates, operating pressures, and design schedules." },
    ],
  }),
  component: SprinklerKFactorPage,
});

interface SprinklerRow {
  id: string;
  label: string;
  kFactor: number;
  solveFor: "Q" | "P";
  pressure: number;
  flow: number;
  coverage: number;
  hazard: string;
  notes?: string;
}

const STANDARD_K_FACTORS = [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];

interface KFactorDetail {
  orifice: string;
  thread: string;
  desc: string;
  sizeRatio: number;
}

function getKFactorDetail(k: number | "", isSI: boolean): KFactorDetail {
  if (k === "") {
    return { orifice: "—", thread: "—", desc: "Custom K-factor", sizeRatio: 0.55 };
  }
  const kVal = Number(k);
  const ipK = isSI ? kVal / 14.28 : kVal;
  
  if (ipK <= 3.0) {
    return {
      orifice: isSI ? "9.5 mm" : '3/8"',
      thread: isSI ? "15 mm (1/2\" NPT)" : '1/2" NPT',
      desc: "Residential / Small Orifice",
      sizeRatio: 0.35
    };
  }
  if (ipK <= 4.8) {
    return {
      orifice: isSI ? "11.0 mm" : '7/16"',
      thread: isSI ? "15 mm (1/2\" NPT)" : '1/2" NPT',
      desc: "Residential / Light Hazard",
      sizeRatio: 0.45
    };
  }
  if (ipK <= 6.0) {
    return {
      orifice: isSI ? "12.7 mm" : '1/2"',
      thread: isSI ? "15 mm (1/2\" NPT)" : '1/2" NPT',
      desc: "Standard Spray Sprinkler",
      sizeRatio: 0.55
    };
  }
  if (ipK <= 9.0) {
    return {
      orifice: isSI ? "13.5 mm" : '17/32"',
      thread: isSI ? "20 mm (3/4\" NPT)" : '3/4" NPT',
      desc: "Large Orifice / Extra Hazard",
      sizeRatio: 0.65
    };
  }
  if (ipK <= 12.0) {
    return {
      orifice: isSI ? "15.9 mm" : '5/8"',
      thread: isSI ? "20 mm (3/4\" NPT)" : '3/4" NPT',
      desc: "ESFR / Storage Sprinkler",
      sizeRatio: 0.75
    };
  }
  if (ipK <= 15.0) {
    return {
      orifice: isSI ? "19.0 mm" : '3/4"',
      thread: isSI ? "20 mm (3/4\" NPT)" : '3/4" NPT',
      desc: "ESFR / High Flow Storage",
      sizeRatio: 0.85
    };
  }
  return {
    orifice: isSI ? "20.0 - 25.4 mm" : '25/32" to 1.0"',
    thread: isSI ? "20 - 25 mm (3/4\" or 1\" NPT)" : '3/4" or 1" NPT',
    desc: "Ultra Large Orifice / ESFR Deluge",
    sizeRatio: 0.95
  };
}

interface BulbRating {
  color: string;
  tempF: string;
  tempC: string;
  classification: string;
  hex: string;
  bgHex: string;
  textHex: string;
}

const BULB_RATINGS: BulbRating[] = [
  { color: "orange", tempF: "135°F", tempC: "57°C", classification: "Ordinary", hex: "#f97316", bgHex: "bg-[#0A7BC7]/10", textHex: "text-[#0A7BC7]" },
  { color: "red", tempF: "155°F", tempC: "68°C", classification: "Ordinary", hex: "#ef4444", bgHex: "bg-red-500/10", textHex: "text-red-500" },
  { color: "yellow", tempF: "175°F", tempC: "79°C", classification: "Intermediate", hex: "#eab308", bgHex: "bg-yellow-500/10", textHex: "text-yellow-500" },
  { color: "green", tempF: "200°F", tempC: "93°C", classification: "Intermediate", hex: "#22c55e", bgHex: "bg-green-500/10", textHex: "text-green-500" },
  { color: "blue", tempF: "286°F", tempC: "141°C", classification: "High", hex: "#3b82f6", bgHex: "bg-blue-500/10", textHex: "text-blue-500" },
  { color: "mauve", tempF: "360°F", tempC: "182°C", classification: "Extra High", hex: "#a855f7", bgHex: "bg-purple-500/10", textHex: "text-purple-500" },
  { color: "black", tempF: "500°F", tempC: "260°C", classification: "Ultra High", hex: "#18181b", bgHex: "bg-zinc-500/10", textHex: "text-zinc-700 dark:text-zinc-300" },
];

const HAZARD_LIMITS: Record<string, number> = {
  "Light Hazard": 225,
  "Ordinary Hazard Gp 1": 130,
  "Ordinary Hazard Gp 2": 130,
  "Extra Hazard Gp 1": 100,
  "Extra Hazard Gp 2": 100,
};

const DEFAULT_ROWS: SprinklerRow[] = [
  {
    id: "sprink_1",
    label: "Office Room 101 - Pendent",
    kFactor: 5.6,
    solveFor: "Q",
    pressure: 15.0,
    flow: 21.69,
    coverage: 130,
    hazard: "Ordinary Hazard Gp 1",
    notes: "Standard office coverage"
  },
  {
    id: "sprink_2",
    label: "Reception Area - Pendent",
    kFactor: 5.6,
    solveFor: "Q",
    pressure: 12.0,
    flow: 19.40,
    coverage: 130,
    hazard: "Ordinary Hazard Gp 1",
    notes: ""
  },
  {
    id: "sprink_3",
    label: "Server Room - Upright",
    kFactor: 8.0,
    solveFor: "Q",
    pressure: 20.0,
    flow: 35.78,
    coverage: 90,
    hazard: "Extra Hazard Gp 1",
    notes: "High density area"
  },
  {
    id: "sprink_4",
    label: "Storage Closet - Sidewall",
    kFactor: 4.2,
    solveFor: "Q",
    pressure: 10.0,
    flow: 13.28,
    coverage: 100,
    hazard: "Light Hazard",
    notes: "Small storage"
  }
];

// Helper to compute row flow/pressure
function computeRowOutputs(row: SprinklerRow): SprinklerRow {
  const K = row.kFactor || 5.6;
  if (row.solveFor === "Q") {
    const P = Math.max(0, row.pressure);
    const Q = K * Math.sqrt(P);
    return { ...row, flow: parseFloat(Q.toFixed(2)) };
  } else {
    const Q = Math.max(0, row.flow);
    const P = Math.pow(Q / K, 2);
    return { ...row, pressure: parseFloat(P.toFixed(2)) };
  }
}

function SprinklerKFactorPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const confirm = useConfirm();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Tabs
  const [tab, setTab] = useState<"solver" | "schedule" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");

  const handleUnitToggle = (newSystem: "si" | "ip") => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    
    // Convert rows in table
    setRows(prevRows => prevRows.map(row => {
      let k = row.kFactor;
      let p = row.pressure;
      let q = row.flow;
      let cov = row.coverage;
      
      if (newSystem === "si") {
        k = parseFloat((k * 14.28).toFixed(1));
        p = parseFloat((p / 14.5038).toFixed(2));
        q = parseFloat((q * 3.78541).toFixed(2));
        cov = parseFloat((cov / 10.7639).toFixed(1));
      } else {
        k = parseFloat((k / 14.28).toFixed(1));
        p = parseFloat((p * 14.5038).toFixed(2));
        q = parseFloat((q / 3.78541).toFixed(2));
        cov = parseFloat((cov * 10.7639).toFixed(1));
      }
      
      return {
        ...row,
        kFactor: k,
        pressure: p,
        flow: q,
        coverage: cov
      };
    }));

    // Convert Quick Solver states
    if (newSystem === "si") {
      setSolverK(prev => prev === "" ? "" : parseFloat((prev * 14.28).toFixed(1)));
      setSolverKnownVal(prev => {
        const numericPrev = prev === "" ? 0 : prev;
        if (solverSolveFor === "Q") {
          return parseFloat((numericPrev / 14.5038).toFixed(2));
        } else {
          return parseFloat((numericPrev * 3.78541).toFixed(2));
        }
      });
    } else {
      setSolverK(prev => prev === "" ? "" : parseFloat((prev / 14.28).toFixed(1)));
      setSolverKnownVal(prev => {
        const numericPrev = prev === "" ? 0 : prev;
        if (solverSolveFor === "Q") {
          return parseFloat((numericPrev * 14.5038).toFixed(2));
        } else {
          return parseFloat((numericPrev / 3.78541).toFixed(2));
        }
      });
    }
  };

  // Quick Solver State
  const [solverK, setSolverK] = useState<number | "">(5.6);
  const [solverSolveFor, setSolverSolveFor] = useState<"Q" | "P">("Q");
  const [solverKnownVal, setSolverKnownVal] = useState<number | "">(30.0);
  const [isCustomK, setIsCustomK] = useState(false);
  const [selectedBulbColor, setSelectedBulbColor] = useState<string>("red");

  // Grid/Schedule State
  const [rows, setRows] = useState<SprinklerRow[]>(() => {
    try {
      const stored = localStorage.getItem(`mep_sprinklers_${project.id}`);
      return stored ? JSON.parse(stored) : DEFAULT_ROWS;
    } catch {
      return DEFAULT_ROWS;
    }
  });

  // Load data when active project changes
  useEffect(() => {
    if (project?.id) {
      const stored = localStorage.getItem(`mep_sprinklers_${project.id}`);
      if (stored) {
        try {
          setRows(JSON.parse(stored));
        } catch {
          setRows(DEFAULT_ROWS);
        }
      } else {
        setRows(DEFAULT_ROWS);
      }
      setUndoStack([]);
      setRedoStack([]);
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hazardFilter, setHazardFilter] = useState("All");
  const [kFilter, setKFilter] = useState("All");

  // History Stack (Local Undo/Redo)
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const pushToUndo = (newRows: SprinklerRow[]) => {
    setUndoStack(prev => [...prev.slice(-49), JSON.stringify(rows)]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, JSON.stringify(rows)]);
    const parsed = JSON.parse(previous);
    setRows(parsed);
    localStorage.setItem(`mep_sprinklers_${project.id}`, previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, JSON.stringify(rows)]);
    const parsed = JSON.parse(next);
    setRows(parsed);
    localStorage.setItem(`mep_sprinklers_${project.id}`, next);
  };

  // Sync to localstorage
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      localStorage.setItem(`mep_sprinklers_${project.id}`, JSON.stringify(rows));
      dirtyStore.set(true);
    }
  }, [rows, project?.id, loadedProjectId]);

  // Keyboard shortcuts handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.getAttribute("contenteditable") === "true"
      );
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Selection: Ctrl + A
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (tab === "schedule") {
          setSelected(new Set(rows.map(r => r.id)));
        }
      }

      // History: Ctrl + Z / Ctrl + Y / Ctrl + Shift + Z
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        handleRedo();
      }

      // Delete / Backspace key
      if ((e.key === "Delete" || e.key === "Backspace") && tab === "schedule" && selected.size > 0) {
        e.preventDefault();
        confirmDeleteSelected();
      }

      // Escape key
      if (e.key === "Escape") {
        e.preventDefault();
        setSelected(new Set());
        setLastSelectedId(null);
      }

      // Clipboard: Copy (Ctrl + C)
      if (isCmdOrCtrl && e.key.toLowerCase() === "c" && tab === "schedule" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_sprinklers", JSON.stringify(toCopy));
      }

      // Clipboard: Cut (Ctrl + X)
      if (isCmdOrCtrl && e.key.toLowerCase() === "x" && tab === "schedule" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_sprinklers", JSON.stringify(toCopy));
        pushToUndo(rows);
        setRows(prev => prev.filter(r => !selected.has(r.id)));
        setSelected(new Set());
      }

      // Clipboard: Paste (Ctrl + V)
      if (isCmdOrCtrl && e.key.toLowerCase() === "v" && tab === "schedule") {
        e.preventDefault();
        try {
          const clipboardData = localStorage.getItem("mep_clipboard_sprinklers");
          if (clipboardData) {
            const parsed = JSON.parse(clipboardData) as SprinklerRow[];
            const pasted = parsed.map((item, idx) => ({
              ...item,
              id: `sprink_paste_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
              label: `${item.label} (Copy)`
            }));
            pushToUndo(rows);
            setRows(prev => [...prev, ...pasted]);
          }
        } catch (err) {
          console.error("Paste failed:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, tab, undoStack, redoStack]);

  // Quick Solver Math
  const solverResult = useMemo(() => {
    const isSI = unitSystem === "si";
    const knownValNum = solverKnownVal === "" ? 0 : solverKnownVal;
    const kFactorNum = solverK === "" ? 0 : solverK;
    if (solverSolveFor === "Q") {
      const flow = kFactorNum * Math.sqrt(Math.max(0, knownValNum));
      return {
        val: parseFloat(flow.toFixed(2)),
        unit: isSI ? "L/min" : "GPM",
        label: "Discharge Flow (Q)",
        formula: `Q = K \u00d7 \u221aP = ${kFactorNum} \u00d7 \u221a${knownValNum} = ${flow.toFixed(2)} ${isSI ? "L/min" : "GPM"}`,
        pressure: knownValNum
      };
    } else {
      const press = Math.pow(Math.max(0, knownValNum) / (kFactorNum || 1), 2);
      return {
        val: parseFloat(press.toFixed(2)),
        unit: isSI ? "bar" : "psi",
        label: "Required Pressure (P)",
        formula: `P = (Q / K)\u00b2 = (${knownValNum} / ${kFactorNum || 1})\u00b2 = ${press.toFixed(2)} ${isSI ? "bar" : "psi"}`,
        pressure: press
      };
    }
  }, [solverK, solverSolveFor, solverKnownVal, unitSystem]);

  // SVG Chart points calculation
  const chartSvg = useMemo(() => {
    const isSI = unitSystem === "si";
    const xMax = isSI ? 7.0 : 100;
    const pts: [number, number][] = [];
    const kFactorNum = solverK === "" ? 0 : solverK;
    for (let p = 0; p <= xMax; p += xMax / 50) {
      pts.push([p, kFactorNum * Math.sqrt(p)]);
    }
    const markP = solverResult.pressure;
    const markQ = solverSolveFor === "Q" ? solverResult.val : (solverKnownVal === "" ? 0 : solverKnownVal);

    // SVG Drawing boundaries
    const W = 500;
    const H = 240;
    const PL = 50;
    const PR = 20;
    const PT = 30;
    const PB = 40;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const xMin = 0;
    const yMin = 0;
    const yMax = Math.max(...pts.map(p => p[1])) * 1.15 || 10;

    const sx = (v: number) => PL + (v - xMin) / (xMax - xMin) * CW;
    const sy = (v: number) => PT + CH - (v - yMin) / (yMax - yMin) * CH;

    const pathD = pts
      .map((p, i) => (i === 0 ? `M${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}` : `L${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`))
      .join(" ");

    const fillD = `${pathD} L${sx(xMax).toFixed(1)},${(PT + CH).toFixed(1)} L${PL},${(PT + CH).toFixed(1)} Z`;

    const markX = sx(markP);
    const markY = sy(markQ);

    return {
      W, H, PL, PR, PT, PB, CW, CH, sx, sy, pathD, fillD, markX, markY, markP, markQ, yMax, xMax
    };
  }, [solverK, solverResult, solverSolveFor, solverKnownVal, unitSystem]);

  const kDetails = useMemo(() => getKFactorDetail(solverK, unitSystem === "si"), [solverK, unitSystem]);

  // Aggregate stats from the grid
  const aggregateMetrics = useMemo(() => {
    let totalFlow = 0;
    let maxPressure = 0;
    let maxDens = 0.15; // default density trigger

    rows.forEach(r => {
      totalFlow += r.flow || 0;
      if (r.pressure > maxPressure) {
        maxPressure = r.pressure;
      }
      if (r.hazard.includes("Extra")) {
        maxDens = 0.30;
      } else if (r.hazard.includes("Ordinary Gp 2")) {
        maxDens = 0.20;
      }
    });

    // NFPA 13 hose allowance
    let hoseAllowance = unitSystem === "si" ? 946 : 250;
    if (maxPressure <= 0) {
      hoseAllowance = 0;
    } else if (maxDens <= 0.10) {
      hoseAllowance = unitSystem === "si" ? 378 : 100;
    } else if (maxDens <= 0.20) {
      hoseAllowance = unitSystem === "si" ? 946 : 250;
    } else {
      hoseAllowance = unitSystem === "si" ? 1893 : 500;
    }

    const systemDemand = totalFlow + hoseAllowance;

    return {
      totalFlow,
      maxPressure,
      hoseAllowance,
      systemDemand
    };
  }, [rows, unitSystem]);

  const reportBreakdowns = useMemo(() => {
    const kCounts: Record<string, number> = {};
    const hazardCounts: Record<string, number> = {};
    const totalRows = rows.length;

    rows.forEach(r => {
      const kKey = `K-${r.kFactor.toFixed(1)}`;
      kCounts[kKey] = (kCounts[kKey] || 0) + 1;
      hazardCounts[r.hazard] = (hazardCounts[r.hazard] || 0) + 1;
    });

    return {
      kCounts,
      hazardCounts,
      totalRows
    };
  }, [rows]);

  // Grid editing helpers
  const updateRow = (id: string, field: keyof SprinklerRow, val: any) => {
    pushToUndo(rows);
    setRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        let updated = { ...row, [field]: val };
        // Recalculate
        updated = computeRowOutputs(updated);
        return updated;
      })
    );
  };

  const addSprinkler = () => {
    pushToUndo(rows);
    const newSprink: SprinklerRow = {
      id: `sprink_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      label: `Sprinkler ${rows.length + 1}`,
      kFactor: 5.6,
      solveFor: "Q",
      pressure: 15.0,
      flow: 21.69,
      coverage: 130,
      hazard: "Ordinary Hazard Gp 1",
      notes: ""
    };
    setRows(prev => [...prev, newSprink]);
  };

  const duplicateSelected = () => {
    if (selected.size === 0) return;
    pushToUndo(rows);
    const duplicated: SprinklerRow[] = [];
    rows.forEach(r => {
      if (selected.has(r.id)) {
        duplicated.push({
          ...r,
          id: `sprink_dup_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          label: `${r.label} (Clone)`
        });
      }
    });
    setRows(prev => [...prev, ...duplicated]);
  };

  const confirmDeleteSelected = async () => {
    const proceed = await confirm(`Are you sure you want to delete ${selected.size} selected sprinkler(s)?`);
    if (proceed) {
      pushToUndo(rows);
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
    }
  };

  // Grid context menu builder
  const renderSprinklerContextMenu = (row: SprinklerRow) => {
    const isMulti = selected.size > 1;
    const targetIds = selected.has(row.id) ? Array.from(selected) : [row.id];

    return (
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={() => {
            // Focus label cell or toggle
            setSelected(new Set([row.id]));
          }}
          className="flex items-center gap-2 cursor-pointer text-foreground"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Edit Sprinkler</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            pushToUndo(rows);
            const dupList: SprinklerRow[] = [];
            rows.forEach(item => {
              if (targetIds.includes(item.id)) {
                dupList.push({
                  ...item,
                  id: `sprink_ctx_dup_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                  label: `${item.label} (Duplicate)`
                });
              }
            });
            setRows(prev => [...prev, ...dupList]);
          }}
          className="flex items-center gap-2 cursor-pointer text-foreground"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>Duplicate</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={async () => {
            const proceed = await confirm(`Delete the ${targetIds.length} selected sprinkler(s)?`);
            if (proceed) {
              pushToUndo(rows);
              setRows(prev => prev.filter(r => !targetIds.includes(r.id)));
              setSelected(new Set());
            }
          }}
          className="flex items-center gap-2 text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive font-medium"
        >
          <Trash2 className="size-3.5" />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  // File import/export handling
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet) as any[];

        const imported: SprinklerRow[] = json.map((row, idx) => {
          const k = parseFloat(row["K-Factor"] || row["kFactor"] || row["K"] || 5.6) || 5.6;
          const haz = row["Hazard"] || row["hazard"] || "Ordinary Hazard Gp 1";
          const cov = parseFloat(row["Coverage"] || row["coverage"] || row["Area"] || 130) || 130;
          const press = parseFloat(row["Pressure"] || row["pressure"] || row["P"] || 15) || 15;
          const fl = parseFloat(row["Flow"] || row["flow"] || row["Q"] || 21.69) || 21.69;
          const solve = row["Solve For"] || row["solveFor"] || "Q";

          let newRow: SprinklerRow = {
            id: `sprink_imp_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
            label: row["Label"] || row["label"] || row["Location"] || `Imported Sprinkler ${idx + 1}`,
            kFactor: k,
            solveFor: solve === "Pressure" || solve === "P" ? "P" : "Q",
            pressure: press,
            flow: fl,
            coverage: cov,
            hazard: haz,
            notes: row["Notes"] || row["notes"] || "",
          };
          newRow = computeRowOutputs(newRow);
          return newRow;
        });

        pushToUndo(rows);
        setRows(prev => [...prev, ...imported]);
      } catch (err) {
        alert("Failed to parse file. Make sure it has valid Excel/CSV headings.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const exportExcel = () => {
    const data = rows.map((r, idx) => ({
      "S.No": idx + 1,
      "Label / Location": r.label,
      "K-Factor (GPM/vpsi)": r.kFactor,
      "Solve For": r.solveFor === "Q" ? "Flow (Q)" : "Pressure (P)",
      "Operating Pressure (psi)": r.pressure.toFixed(2),
      "Flow Rate (GPM)": r.flow.toFixed(2),
      "Coverage Area (sq ft)": r.coverage,
      "Hazard Classification": r.hazard,
      "Notes": r.notes || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sprinkler Schedule");
    const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), `Sprinkler_KFactor_Report_${project.code}.xlsx`, "Excel Document", ["xlsx"]);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(220, 76, 52); // Orange-Red fire theme color
    doc.text("Sprinkler K-Factor & Water Demand Report", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Project Name: ${project.name}`, 14, 28);
    doc.text(`Project Number: ${project.code}`, 14, 34);
    doc.text(`Client Reference: ${project.client}`, 14, 40);

    // Summary Metrics Cards
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text("Design Water Demand Summary:", 14, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total Sprinkler Flow Rate: ${aggregateMetrics.totalFlow.toFixed(2)} GPM`, 14, 57);
    doc.text(`Max Sprinkler Operating Pressure: ${aggregateMetrics.maxPressure.toFixed(2)} psi`, 14, 63);
    doc.text(`Hose Stream Allowance (NFPA 13): ${aggregateMetrics.hoseAllowance} GPM`, 14, 69);
    doc.text(`Total System Water Demand: ${aggregateMetrics.systemDemand.toFixed(2)} GPM`, 14, 75);

    const tableData = rows.map((r, idx) => [
      idx + 1,
      r.label,
      `K-${r.kFactor.toFixed(1)}`,
      r.solveFor === "Q" ? "Flow (Q)" : "Pressure (P)",
      r.pressure.toFixed(1),
      r.flow.toFixed(2),
      r.coverage.toString(),
      r.hazard,
      r.pressure < 7 ? "Low Press Violation" : "Complied"
    ]);

    autoTable(doc, {
      startY: 83,
      head: [["S.No", "Location / Label", "K-Factor", "Sizing Mode", "Pressure (psi)", "Flow (GPM)", "Coverage (ft²)", "Hazard Class", "Status"]],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [220, 76, 52], halign: "left" }
    });

    
    const finalY = (doc as any).lastAutoTable?.finalY || 40;
    addPdfSignatureBlock(doc, finalY, currentUserName, project?.id || "default", "plumbing-sprinkler-kfactor");
    const pdfBuffer = doc.output("arraybuffer");
    downloadFile(new Uint8Array(pdfBuffer), `Sprinkler_KFactor_Report_${project.code}.pdf`, "PDF Document", ["pdf"]);
  };

  // AI intelligence optimizations
  const warningsList = useMemo(() => {
    const list: { id: string; type: "critical" | "warning"; title: string; desc: string; fixable: boolean; action?: () => void }[] = [];
    rows.forEach((r, idx) => {
      if (r.pressure < 7) {
        list.push({
          id: `w_press_${r.id}`,
          type: "critical",
          title: `Low Pressure on ${r.label}`,
          desc: `Calculated pressure is ${r.pressure.toFixed(2)} psi, which is below the NFPA 13 minimum 7.0 psi.`,
          fixable: true,
          action: () => {
            pushToUndo(rows);
            setRows(prev => prev.map(item => item.id === r.id ? computeRowOutputs({ ...item, pressure: 7.0, solveFor: "Q" }) : item));
          }
        });
      }

      let limit = 130;
      if (r.hazard.startsWith("Light")) limit = 225;
      else if (r.hazard.startsWith("Extra")) limit = 100;
      if (r.coverage > limit) {
        list.push({
          id: `w_cov_${r.id}`,
          type: "warning",
          title: `Over-coverage on ${r.label}`,
          desc: `Coverage area is ${r.coverage} ft², exceeding the standard limit of ${limit} ft² for ${r.hazard}.`,
          fixable: false
        });
      }

      // Check if high pressure can be optimized by K-factor resize
      if (r.pressure > 35 && r.kFactor < 11.2) {
        const nextKIdx = STANDARD_K_FACTORS.indexOf(r.kFactor) + 1;
        const nextK = STANDARD_K_FACTORS[nextKIdx] || r.kFactor;
        const newP = Math.pow(r.flow / nextK, 2);
        list.push({
          id: `w_opt_${r.id}`,
          type: "warning",
          title: `Optimize K-Factor on ${r.label}`,
          desc: `Required pressure is high (${r.pressure.toFixed(1)} psi). Changing K-${r.kFactor} to K-${nextK} reduces required pressure to ${newP.toFixed(1)} psi.`,
          fixable: true,
          action: () => {
            pushToUndo(rows);
            setRows(prev => prev.map(item => item.id === r.id ? computeRowOutputs({ ...item, kFactor: nextK, solveFor: "P" }) : item));
          }
        });
      }
    });
    return list;
  }, [rows]);

  const handleFixAllPressures = () => {
    pushToUndo(rows);
    setRows(prev =>
      prev.map(r => {
        if (r.pressure < 7) {
          return computeRowOutputs({ ...r, pressure: 7.0, solveFor: "Q" });
        }
        return r;
      })
    );
  };

  const handleOptimizeAllKFactors = () => {
    pushToUndo(rows);
    setRows(prev =>
      prev.map(r => {
        if (r.pressure > 35 && r.kFactor < 11.2) {
          const nextKIdx = STANDARD_K_FACTORS.indexOf(r.kFactor) + 1;
          const nextK = STANDARD_K_FACTORS[nextKIdx] || r.kFactor;
          return computeRowOutputs({ ...r, kFactor: nextK, solveFor: "P" });
        }
        return r;
      })
    );
  };

  // Filter rows for grid display
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchHazard = hazardFilter === "All" || r.hazard === hazardFilter;
      const matchK = kFilter === "All" || r.kFactor === parseFloat(kFilter);
      return matchSearch && matchHazard && matchK;
    });
  }, [rows, searchQuery, hazardFilter, kFilter]);

  // Inline inputs
  interface InlineInputProps {
    value: string | number;
    onCommit: (val: string) => void;
    className?: string;
    type?: "text" | "number";
    step?: string;
    min?: number;
    disabled?: boolean;
  }

  function InlineInput({ value, onCommit, className = "", type = "text", step, min, disabled = false }: InlineInputProps) {
    const [localVal, setLocalVal] = useState(String(value));

    useEffect(() => {
      setLocalVal(String(value));
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        setLocalVal(String(value));
        e.currentTarget.blur();
      }
    };

    return (
      <input
        type={type}
        step={step}
        min={min}
        disabled={disabled}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => {
          if (localVal !== String(value)) {
            onCommit(localVal);
          }
        }}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-foreground transition-all cursor-text disabled:opacity-40 outline-none ${className}`}
      />
    );
  }

  // Define Columns
  const columns = useMemo<Column<SprinklerRow>[]>(() => [
    {
      key: "label",
      header: "Sprinkler Label / Location",
      width: 200,
      render: (row) => (
        <InlineInput
          value={row.label}
          onCommit={(val) => updateRow(row.id, "label", val)}
          className="text-[13px]"
        />
      )
    },
    {
      key: "kFactor",
      header: "K-Factor",
      width: 110,
      render: (row) => {
        const isSI = unitSystem === "si";
        return (
          <select
            value={row.kFactor}
            onChange={(e) => updateRow(row.id, "kFactor", parseFloat(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-[13px] text-foreground font-medium transition-all outline-none cursor-pointer"
          >
            {isSI ? (
              <>
                <option value="40.0">K-40 (Res)</option>
                <option value="60.0">K-60</option>
                <option value="80.0">K-80 (Std)</option>
                <option value="115.0">K-115</option>
                <option value="160.0">K-160 (ESFR)</option>
                <option value="200.0">K-200</option>
                <option value="242.0">K-242</option>
                <option value="282.0">K-282</option>
                <option value="320.0">K-320</option>
                <option value="360.0">K-360</option>
                <option value="400.0">K-400</option>
              </>
            ) : (
              <>
                <option value="2.8">K-2.8 (Res)</option>
                <option value="4.2">K-4.2</option>
                <option value="5.6">K-5.6 (Std)</option>
                <option value="8.0">K-8.0</option>
                <option value="11.2">K-11.2 (ESFR)</option>
                <option value="14.0">K-14.0</option>
                <option value="16.8">K-16.8</option>
                <option value="19.6">K-19.6</option>
                <option value="22.4">K-22.4</option>
                <option value="25.2">K-25.2</option>
                <option value="28.0">K-28.0</option>
              </>
            )}
            {!(isSI ? [40, 60, 80, 115, 160, 200, 242, 282, 320, 360, 400] : [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0]).includes(row.kFactor) && (
              <option value={row.kFactor}>Custom: K-{row.kFactor.toFixed(1)}</option>
            )}
          </select>
        );
      }
    },
    {
      key: "solveFor",
      header: "Sizing Target",
      width: 100,
      render: (row) => (
        <select
          value={row.solveFor}
          onChange={(e) => updateRow(row.id, "solveFor", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-[13px] text-foreground font-medium transition-all outline-none cursor-pointer"
        >
          <option value="Q">Flow (Q)</option>
          <option value="P">Pressure (P)</option>
        </select>
      )
    },
    {
      key: "pressure",
      header: `Pressure (${unitSystem === "si" ? "bar" : "psi"})`,
      width: 100,
      render: (row) => {
        const isCalculated = row.solveFor === "P";
        return isCalculated ? (
          <span className="font-mono text-muted-foreground/70 font-semibold px-2">{row.pressure.toFixed(2)}</span>
        ) : (
          <InlineInput
            type="number"
            step={unitSystem === "si" ? "0.05" : "0.5"}
            min={0}
            value={row.pressure}
            onCommit={(val) => updateRow(row.id, "pressure", parseFloat(val) || 0)}
            className="font-mono text-[13px]"
          />
        );
      }
    },
    {
      key: "flow",
      header: `Flow Rate (${unitSystem === "si" ? "L/min" : "GPM"})`,
      width: 110,
      render: (row) => {
        const isCalculated = row.solveFor === "Q";
        return isCalculated ? (
          <span className="font-mono text-muted-foreground/70 font-semibold px-2">{row.flow.toFixed(1)}</span>
        ) : (
          <InlineInput
            type="number"
            step="1"
            min={0}
            value={row.flow}
            onCommit={(val) => updateRow(row.id, "flow", parseFloat(val) || 0)}
            className="font-mono text-[13px]"
          />
        );
      }
    },
    {
      key: "coverage",
      header: `Coverage (${unitSystem === "si" ? "m²" : "ft²"})`,
      width: 100,
      render: (row) => (
        <InlineInput
          type="number"
          min={0}
          value={row.coverage}
          onCommit={(val) => updateRow(row.id, "coverage", parseFloat(val) || 0)}
          className="font-mono text-[13px]"
        />
      )
    },
    {
      key: "hazard",
      header: "Hazard Classification",
      width: 180,
      render: (row) => (
        <select
          value={row.hazard}
          onChange={(e) => updateRow(row.id, "hazard", e.target.value)}
          className="bg-transparent w-full border border-transparent hover:border-border hover:bg-surface-2 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl px-1.5 py-1 text-[13px] text-foreground font-medium transition-all outline-none cursor-pointer"
        >
          <option value="Light Hazard">Light Hazard</option>
          <option value="Ordinary Hazard Gp 1">Ordinary Gp 1</option>
          <option value="Ordinary Hazard Gp 2">Ordinary Gp 2</option>
          <option value="Extra Hazard Gp 1">Extra Gp 1</option>
          <option value="Extra Hazard Gp 2">Extra Gp 2</option>
        </select>
      )
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      render: (row) => {
        const isLowPressure = row.pressure < (unitSystem === "si" ? 0.48 : 7.0);
        const baseLimit = HAZARD_LIMITS[row.hazard] || 130;
        const limit = unitSystem === "si" ? parseFloat((baseLimit / 10.7639).toFixed(1)) : baseLimit;
        const isOverCoverage = row.coverage > limit;

        if (isLowPressure) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mr-1.5" />
              Low Press
            </span>
          );
        }
        if (isOverCoverage) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-warning/15 text-warning border border-warning/20 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 mr-1.5" />
              Over Area
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-success/10 text-success border border-success/20 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0 mr-1.5" />
            Complied
          </span>
        );
      }
    }
  ], [rows, unitSystem]);

  const toggleSelect = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isShift && lastSelectedId) {
        const lastIdx = filteredRows.findIndex(r => r.id === lastSelectedId);
        const currentIdx = filteredRows.findIndex(r => r.id === id);
        if (lastIdx !== -1 && currentIdx !== -1) {
          if (!isCtrl) {
            next.clear();
          }
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          for (let i = start; i <= end; i++) {
            next.add(filteredRows[i].id);
          }
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        if (!isCtrl && !isShift) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
  };

  const toggleSelectAll = () => {
    setSelected(prev => {
      if (prev.size === rows.length) {
        return new Set();
      } else {
        return new Set(rows.map(r => r.id));
      }
    });
  };

  const actions = (
    <div className="flex items-center gap-1.5">
      {undoStack.length > 0 && (
        <button
          onClick={handleUndo}
          title="Undo (Ctrl+Z)"
          className="size-7 grid place-items-center rounded-xl border border-border bg-background hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Undo className="size-3.5" />
        </button>
      )}
      {redoStack.length > 0 && (
        <button
          onClick={handleRedo}
          title="Redo (Ctrl+Y)"
          className="size-7 grid place-items-center rounded-xl border border-border bg-background hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Redo className="size-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <AppShell 
      title="Sprinkler K-Factor"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-6">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">FIRE FIGHTING &gt; SPRINKLER K-FACTOR</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sprinkler K-Factor</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">NFPA 13 discharge calculations</span>
                </div>
                <button 
                  onClick={() => setIntelOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  Intelligence
                </button>
              </div>
            </div>
            
            {/* Actions / Export buttons on the right */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex rounded-full border border-border p-0.5 bg-surface-2 shrink-0">
                <button
                  onClick={() => handleUnitToggle("si")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "si" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  SI
                </button>
                <button
                  onClick={() => handleUnitToggle("ip")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    unitSystem === "ip" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  IP
                </button>
              </div>
              {actions}
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className="bg-card border border-border rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden mx-6 mb-6">
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setTab("solver")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "solver"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Quick Solver
                </button>
                <button
                  onClick={() => setTab("schedule")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "schedule"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sprinkler Schedule
                </button>
                <button
                  onClick={() => setTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Report Summary
                </button>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {/* Quick Solver Tab */}
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="flex flex-col md:flex-row h-full divide-y md:divide-y-0 divide-border">
                    <div className="flex-1 min-w-0 p-6 flex flex-col gap-6" style={{ zoom: 1.1 }}>
                    {/* Overview box */}
                    <div className="flex gap-3.5 p-4 bg-background border border-border rounded-3xl shadow-xs transition-all hover:border-primary/30">
                    <Info className="size-4.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[13.5px] font-bold text-foreground">Sprinkler Sizing Equation</h4>
                      <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                        {"Calculate discharge flow rate based on nozzle pressure and standard K-factor coefficient ($Q = K\\sqrt{P}$), or determine required operating pressure to deliver target fire load."}
                      </p>
                    </div>
                  </div>

                  {/* Sizing inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3 transition-all hover:border-primary/30">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sizing Variable</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSolverSolveFor("Q");
                            setSolverKnownVal(30.0);
                          }}
                          className={`flex-1 py-2 px-4 rounded-xl text-[13px] font-bold border text-center transition-all cursor-pointer shadow-xs ${
                            solverSolveFor === "Q"
                              ? "bg-primary text-primary-foreground border-primary shadow-primary/10 font-bold"
                              : "border-border hover:bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          Solve Flow (Q)
                        </button>
                        <button
                          onClick={() => {
                            setSolverSolveFor("P");
                            setSolverKnownVal(20.0);
                          }}
                          className={`flex-1 py-2 px-4 rounded-xl text-[13px] font-bold border text-center transition-all cursor-pointer shadow-xs ${
                            solverSolveFor === "P"
                              ? "bg-primary text-primary-foreground border-primary shadow-primary/10 font-bold"
                              : "border-border hover:bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          Solve Pressure (P)
                        </button>
                      </div>
                    </div>
                    <div className="border border-border rounded-3xl p-4 bg-background shadow-sm flex flex-col gap-3 transition-all hover:border-primary/30">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">K-Factor Coefficient</label>
                      <div className="flex gap-2">
                        <select
                          value={isCustomK ? "custom" : solverK}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setIsCustomK(true);
                            } else {
                              setIsCustomK(false);
                              setSolverK(parseFloat(e.target.value));
                            }
                          }}
                          className="flex-1 h-10 px-3 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl bg-background text-[13px] outline-none font-bold cursor-pointer transition-all shadow-sm"
                        >
                          {unitSystem === "si" ? (
                            <>
                              <option value="40.0">K-40.0 - Residential</option>
                              <option value="60.0">K-60.0 - Small Orifice</option>
                              <option value="80.0">K-80.0 - Standard Spray</option>
                              <option value="115.0">K-115.0 - Large Orifice</option>
                              <option value="160.0">K-160.0 - ESFR / Storage</option>
                              <option value="200.0">K-200.0 - Early Suppression</option>
                              <option value="242.0">K-242.0 - Ultra Large</option>
                              <option value="282.0">K-282.0 - Heavy Storage</option>
                              <option value="320.0">K-320.0 - High Flow</option>
                              <option value="360.0">K-360.0 - Deluge System</option>
                              <option value="400.0">K-400.0 - High Density Deluge</option>
                            </>
                          ) : (
                            <>
                              <option value="2.8">K-2.8 - Residential</option>
                              <option value="4.2">K-4.2 - Small Orifice</option>
                              <option value="5.6">K-5.6 - Standard Spray</option>
                              <option value="8.0">K-8.0 - Large Orifice</option>
                              <option value="11.2">K-11.2 - ESFR / Storage</option>
                              <option value="14.0">K-14.0 - Early Suppression</option>
                              <option value="16.8">K-16.8 - Ultra Large</option>
                              <option value="19.6">K-19.6 - Heavy Storage</option>
                              <option value="22.4">K-22.4 - High Flow</option>
                              <option value="25.2">K-25.2 - Deluge System</option>
                              <option value="28.0">K-28.0 - High Density Deluge</option>
                            </>
                          )}
                          <option value="custom">Custom K-Factor...</option>
                        </select>
                        {isCustomK && (
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={solverK}
                            onChange={(e) => setSolverK(e.target.value === "" ? "" : parseFloat(e.target.value) || 5.6)}
                            className="w-24 h-10 px-3 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl bg-background text-[13px] font-mono font-bold outline-none shadow-sm"
                            placeholder="e.g. 5.8"
                          />
                        )}
                      </div>
                      

                    </div>
                  </div>

                  {/* Input Parameter Card */}
                  <div className="border border-border rounded-3xl p-5 bg-background shadow-sm flex flex-col gap-3.5 transition-all hover:border-primary/30">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {solverSolveFor === "Q" ? "Known Operating Pressure" : "Known Discharge Flow"}
                      </label>
                      <div className="relative flex items-center mt-1 select-none">
                        <input
                          type="number"
                          value={solverKnownVal}
                          step={solverSolveFor === "Q" ? (unitSystem === "si" ? "0.05" : "0.5") : "1"}
                          min={0}
                          onChange={(e) => setSolverKnownVal(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                          className="w-full h-11 pl-4 pr-20 bg-surface-2 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl text-lg font-bold font-mono outline-none text-foreground transition-all focus:bg-background"
                          placeholder="Enter value..."
                        />
                        <div className="absolute right-3 px-2.5 py-1 bg-background border border-border rounded-xl text-[11px] font-bold font-mono text-muted-foreground uppercase shadow-xs">
                          {solverSolveFor === "Q" ? (unitSystem === "si" ? "bar" : "psi") : (unitSystem === "si" ? "L/min" : "GPM")}
                        </div>
                      </div>
                      


                      <p className="text-[11px] text-muted-foreground leading-normal mt-1.5">
                        {solverSolveFor === "Q" 
                          ? `Specify sprinkler operating pressure. NFPA 13 requires a minimum of ${unitSystem === "si" ? "0.48 bar" : "7.0 psi"}.`
                          : "Specify sprinkler discharge flow rate."
                        }
                      </p>
                    </div>
                  </div>

                  {/* Quick Results Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-3xl p-5 bg-gradient-to-br from-background to-surface-2 shadow-sm flex flex-col justify-between min-h-[140px] transition-all hover:border-primary/30">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Calculated Variable</span>
                        <div className="flex items-baseline mt-2 gap-1.5">
                          <span className="text-[36px] font-extrabold tracking-tight font-mono text-primary leading-none">
                            {solverResult.val}
                          </span>
                          <span className="text-[14px] font-bold text-muted-foreground uppercase">{solverResult.unit}</span>
                        </div>
                      </div>
                      <div className="border-t border-border pt-3 mt-4 text-[12px] font-mono text-muted-foreground">
                        {solverResult.label}
                      </div>
                    </div>

                    <div className="border border-border rounded-3xl p-5 bg-gradient-to-br from-background to-surface-2 shadow-sm flex flex-col justify-between min-h-[140px] transition-all hover:border-primary/30">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sizing Formula</span>
                        <div className="text-[16px] font-bold text-foreground font-mono mt-3 leading-relaxed">
                          {solverResult.formula}
                        </div>
                      </div>
                      <div className="border-t border-border pt-3 mt-4 text-[12px] text-muted-foreground flex justify-between">
                        <span>Standard K: <span className="font-semibold">{solverK}</span></span>
                        <span>Unit System: <span className="font-semibold">{unitSystem === "si" ? "SI" : "IP"}</span></span>
                      </div>
                    </div>
                  </div>

                  {/* NFPA compliance checks */}
                  {solverResult.pressure < (unitSystem === "si" ? 0.48 : 7.0) && (
                    <div className="border border-destructive/25 bg-destructive/5 text-destructive rounded-3xl p-4 flex gap-3 items-start shadow-xs">
                      <AlertTriangle className="size-4.5 shrink-0 mt-0.5 text-destructive animate-pulse" />
                      <div>
                        <h4 className="text-[13px] font-bold text-destructive">NFPA 13 Code Violation</h4>
                        <p className="text-[12px] text-destructive/80 mt-1 leading-relaxed">
                          Pressure ({solverResult.pressure.toFixed(2)} {unitSystem === "si" ? "bar" : "psi"}) is below the minimum required {unitSystem === "si" ? "0.48 bar" : "7.0 psi"} limit. The sprinkler spray pattern will not disperse adequately to suppress fires. Increase K-factor or pressure.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* SVG Chart Panel */}
                <div className="w-[380px] shrink-0 p-6 bg-surface-2/45 flex flex-col gap-4 border-l border-border h-full overflow-y-auto">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Performance Curve</span>
                  <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3 transition-all hover:border-primary/30">
                    <p className="text-[13.5px] font-bold text-foreground leading-snug">Flow vs Pressure Curve (K={solverK})</p>
                    <div className="w-full relative select-none mt-2">
                      <svg viewBox={`0 0 ${chartSvg.W} ${chartSvg.H}`} className="w-full h-auto block font-sans">
                        {/* Title & axes labels */}
                        <text x={chartSvg.PL + chartSvg.CW / 2} y="15" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--muted)">Q = K \u00d7 \u221aP</text>
                        <text x={chartSvg.PL + chartSvg.CW / 2} y={chartSvg.H - 5} textAnchor="middle" fontSize="9" fill="var(--muted)">{`Pressure P (${unitSystem === "si" ? "bar" : "psi"})`}</text>
                        <text transform="rotate(-90)" x={-(chartSvg.PT + chartSvg.CH / 2)} y="13" textAnchor="middle" fontSize="9" fill="var(--muted)">{`Flow Q (${unitSystem === "si" ? "L/min" : "GPM"})`}</text>

                        {/* X Grid ticks */}
                        {(unitSystem === "si" ? [0, 1.5, 3.0, 4.5, 6.0, 7.0] : [0, 25, 50, 75, 100]).map(val => {
                          const x = chartSvg.sx(val);
                          return (
                            <g key={val}>
                              <line x1={x} y1={chartSvg.PT + chartSvg.CH} x2={x} y2={chartSvg.PT + chartSvg.CH + 4} stroke="var(--border)" strokeWidth="1" />
                              <text x={x} y={chartSvg.PT + chartSvg.CH + 14} textAnchor="middle" fontSize="8.5" fill="var(--muted)" fontFamily="var(--mono)">{val}</text>
                            </g>
                          );
                        })}

                        {/* Y Grid ticks */}
                        {[0, 0.25, 0.5, 0.75, 1.0].map(ratio => {
                          const val = ratio * chartSvg.yMax;
                          const y = chartSvg.sy(val);
                          return (
                            <g key={ratio}>
                              <line x1={chartSvg.PL} y1={y} x2={chartSvg.W - chartSvg.PR} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                              <text x={chartSvg.PL - 5} y={y + 3} textAnchor="end" fontSize="8.5" fill="var(--muted)" fontFamily="var(--mono)">{val.toFixed(0)}</text>
                            </g>
                          );
                        })}

                        {/* X & Y Axis bars */}
                        <line x1={chartSvg.PL} y1={chartSvg.PT} x2={chartSvg.PL} y2={chartSvg.PT + chartSvg.CH} stroke="var(--border-strong)" strokeWidth="1" />
                        <line x1={chartSvg.PL} y1={chartSvg.PT + chartSvg.CH} x2={chartSvg.W - chartSvg.PR} y2={chartSvg.PT + chartSvg.CH} stroke="var(--border-strong)" strokeWidth="1" />

                        {/* Curve shading */}
                        <path d={chartSvg.fillD} fill="var(--red)" opacity="0.06" />

                        {/* Line Curve */}
                        <path d={chartSvg.pathD} fill="none" stroke="var(--red)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

                        {/* Operating point indicator */}
                        <line x1={chartSvg.markX} y1={chartSvg.markY} x2={chartSvg.markX} y2={chartSvg.PT + chartSvg.CH} stroke="var(--red)" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                        <line x1={chartSvg.PL} y1={chartSvg.markY} x2={chartSvg.markX} y2={chartSvg.markY} stroke="var(--red)" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                        <circle cx={chartSvg.markX} cy={chartSvg.markY} r="5" fill="var(--red)" stroke="var(--card)" strokeWidth="1.5" />
                        <text
                          x={chartSvg.markX > chartSvg.W * 0.7 ? chartSvg.markX - 8 : chartSvg.markX + 8}
                          y={chartSvg.markY - 6}
                          textAnchor={chartSvg.markX > chartSvg.W * 0.7 ? "end" : "start"}
                          fontSize="9.5"
                          fill="var(--red)"
                          fontWeight="700"
                          fontFamily="var(--mono)"
                        >
                          {chartSvg.markQ.toFixed(1)} {unitSystem === "si" ? "L/m" : "GPM"}
                        </text>
                      </svg>
                    </div>
                  </div>

                  {/* Dynamic Orifice & Thread Spec Card */}
                  <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-4 transition-all hover:border-primary/30">
                    <p className="text-[13.5px] font-bold text-foreground leading-snug">Orifice & Thread Spec</p>
                    <div className="flex gap-4 items-center">
                      {/* Sprinkler Head SVG Visualizer */}
                      <div className="w-24 h-28 shrink-0 bg-surface/50 border border-border rounded-xl flex items-center justify-center p-2 relative overflow-hidden select-none">
                        <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-sm">
                          {/* Deflector at the top */}
                          <path d="M 25 15 L 75 15 L 75 20 L 25 20 Z" fill="#b45309" stroke="#78350f" strokeWidth="1" />
                          <path d="M 30 15 L 30 10 M 38 15 L 38 10 M 46 15 L 46 10 M 54 15 L 54 10 M 62 15 L 62 10 M 70 15 L 70 10" stroke="#78350f" strokeWidth="1.5" />
                          
                          {/* Frame Arms */}
                          <path d="M 32 95 C 15 75, 15 45, 45 20" fill="none" stroke="#71717a" strokeWidth="3" strokeLinecap="round" />
                          <path d="M 68 95 C 85 75, 85 45, 55 20" fill="none" stroke="#71717a" strokeWidth="3" strokeLinecap="round" />
                          
                          {/* Base / Nozzle body */}
                          <path d="M 32 95 L 68 95 L 68 115 L 32 115 Z" fill="#b45309" stroke="#78350f" strokeWidth="1" />
                          {/* Thread lines */}
                          <line x1="35" y1="102" x2="65" y2="102" stroke="#78350f" strokeWidth="1" />
                          <line x1="35" y1="107" x2="65" y2="107" stroke="#78350f" strokeWidth="1" />
                          <line x1="35" y1="112" x2="65" y2="112" stroke="#78350f" strokeWidth="1" />

                          {/* Dynamic Nozzle Orifice/Throat Water Channel */}
                          <rect 
                            x={50 - 15 * kDetails.sizeRatio} 
                            y="92" 
                            width={30 * kDetails.sizeRatio} 
                            height="10" 
                            fill="#3b82f6" 
                            opacity="0.85" 
                            rx="1"
                          />
                          <line 
                            x1={50 - 15 * kDetails.sizeRatio} 
                            y1="92" 
                            x2={50 - 15 * kDetails.sizeRatio} 
                            y2="102" 
                            stroke="#1d4ed8" 
                            strokeWidth="1" 
                          />
                          <line 
                            x1={50 + 15 * kDetails.sizeRatio} 
                            y1="92" 
                            x2={50 + 15 * kDetails.sizeRatio} 
                            y2="102" 
                            stroke="#1d4ed8" 
                            strokeWidth="1" 
                          />

                          {/* Orifice Label Overlay (Water Jet symbol) */}
                          <path d="M 45 92 Q 50 82 55 92" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.7" />

                          {/* Metal plug seat */}
                          <rect x="42" y="86" width="16" height="6" rx="1" fill="#71717a" stroke="#3f3f46" strokeWidth="1" />

                          {/* Glass Bulb rating bound to selectedBulbColor state */}
                          {(() => {
                            const activeRating = BULB_RATINGS.find(b => b.color === selectedBulbColor) || BULB_RATINGS[1];
                            return (
                              <g>
                                {/* Glass Bulb body */}
                                <rect 
                                  x="46" 
                                  y="38" 
                                  width="8" 
                                  height="48" 
                                  rx="4" 
                                  fill={activeRating.hex} 
                                  stroke="#3f3f46" 
                                  strokeWidth="1" 
                                />
                                {/* Glass shine overlay */}
                                <rect 
                                  x="47.5" 
                                  y="41" 
                                  width="2" 
                                  height="24" 
                                  rx="1" 
                                  fill="#ffffff" 
                                  opacity="0.65" 
                                />
                                {/* Small bulb liquid bubble */}
                                <circle 
                                  cx="50" 
                                  cy="74" 
                                  r="2" 
                                  fill="#ffffff" 
                                  opacity="0.8" 
                                />
                              </g>
                            );
                          })()}

                          {/* Metal yoke/compression screw at top */}
                          <path d="M 47 20 L 53 20 L 50 26 Z" fill="#71717a" stroke="#3f3f46" strokeWidth="1" />
                        </svg>
                      </div>

                      {/* Detail Metrics */}
                      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                        <div className="flex justify-between items-baseline border-b border-border pb-1">
                          <span className="text-[11px] text-muted-foreground uppercase font-bold">K-Factor</span>
                          <span className="text-[14px] font-extrabold font-mono text-primary">K-{solverK || "0.0"}</span>
                        </div>
                        <div className="flex justify-between items-baseline border-b border-border pb-1">
                          <span className="text-[11px] text-muted-foreground uppercase font-bold">Nominal Orifice</span>
                          <span className="text-[12.5px] font-bold text-foreground font-mono truncate">{kDetails.orifice}</span>
                        </div>
                        <div className="flex justify-between items-baseline border-b border-border pb-1">
                          <span className="text-[11px] text-muted-foreground uppercase font-bold">Thread Connection</span>
                          <span className="text-[12.5px] font-bold text-foreground font-mono truncate">{kDetails.thread}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-snug italic mt-1 truncate">
                          {kDetails.desc}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NFPA 13 Temperature Ratings Card */}
                  <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3.5 transition-all hover:border-primary/30">
                    <div>
                      <p className="text-[13.5px] font-bold text-foreground leading-snug">Bulb Temperature Ratings</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Click a bulb to preview rating in the sprinkler head</p>
                    </div>

                    {/* Bulb Color selector grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {BULB_RATINGS.map((rating) => {
                        const isSelected = selectedBulbColor === rating.color;
                        return (
                          <button
                            key={rating.color}
                            onClick={() => setSelectedBulbColor(rating.color)}
                            title={`${rating.color.toUpperCase()} - ${rating.tempF} (${rating.classification})`}
                            className={`h-9 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border cursor-pointer ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                                : "border-border hover:bg-surface-2 bg-background"
                            }`}
                          >
                            {/* Visual representation of the bulb capsule */}
                            <div 
                              className="w-2.5 h-5 rounded-full border border-black/10 relative overflow-hidden" 
                              style={{ backgroundColor: rating.hex }}
                            >
                              <div className="absolute top-0.5 left-0.5 w-0.5 h-2.5 bg-white/40 rounded-full" />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Details of the selected bulb rating */}
                    {(() => {
                      const rating = BULB_RATINGS.find(b => b.color === selectedBulbColor) || BULB_RATINGS[1];
                      return (
                        <div className="p-3 rounded-2xl border border-border/60 bg-surface-2/40 flex flex-col gap-1.5 transition-all">
                          <div className="flex justify-between items-baseline">
                            <span className="text-[12px] font-bold capitalize flex items-center gap-1.5">
                              <span 
                                className="w-2 h-2 rounded-full inline-block" 
                                style={{ backgroundColor: rating.hex }} 
                              />
                              {rating.color} Glass Bulb
                            </span>
                            <span className="text-[10.5px] font-bold text-muted-foreground uppercase">{rating.classification}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-1 border-t border-border/40 pt-2 text-[12px] font-medium text-foreground">
                            <div>
                              <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">Temp Rating</span>
                              <span className="font-mono font-bold text-primary">{rating.tempF} <span className="text-[10px] font-semibold text-muted-foreground">({rating.tempC})</span></span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">Max Ceiling Temp</span>
                              <span className="font-mono font-bold">
                                {rating.color === "orange" || rating.color === "red" ? "100°F (38°C)" :
                                 rating.color === "yellow" || rating.color === "green" ? "150°F (66°C)" :
                                 rating.color === "blue" ? "225°F (107°C)" :
                                 rating.color === "mauve" ? "300°F (149°C)" : "475°F (246°C)"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* Sprinkler Schedule Tab */}
            {tab === "schedule" && (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {/* Summary metrics header grid */}
                <div className="grid grid-cols-4 gap-4 p-4 border-b border-border bg-surface-2/10 shrink-0">
                  <div className="border border-border rounded-3xl p-3 bg-background shadow-xs flex flex-col justify-between hover:border-primary/20 transition-all">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sprinklers Sized</span>
                    <div className="text-[20px] font-extrabold font-mono text-foreground mt-1">{rows.length} heads</div>
                  </div>
                  
                  <div className="border border-border rounded-3xl p-3 bg-background shadow-xs flex flex-col justify-between hover:border-primary/20 transition-all">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Max Node Pressure</span>
                    <div className="text-[20px] font-extrabold font-mono text-primary mt-1">
                      {aggregateMetrics.maxPressure.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">{unitSystem === "si" ? "bar" : "psi"}</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-3 bg-background shadow-xs flex flex-col justify-between hover:border-primary/20 transition-all">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sprinkler Discharge</span>
                    <div className="text-[20px] font-extrabold font-mono text-primary mt-1">
                      {aggregateMetrics.totalFlow.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">{unitSystem === "si" ? "L/min" : "GPM"}</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-3 bg-background shadow-xs flex flex-col justify-between hover:border-primary/20 transition-all">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Water Demand</span>
                    <div className="text-[20px] font-extrabold font-mono text-red-500 mt-1">
                      {aggregateMetrics.systemDemand.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">{unitSystem === "si" ? "L/min" : "GPM"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-background select-none shrink-0 gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        placeholder="Search sprinklers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 w-56 pl-8 pr-7 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl text-[12.5px] bg-background outline-none transition-all"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Hazard Category Filter */}
                    <select
                      value={hazardFilter}
                      onChange={(e) => setHazardFilter(e.target.value)}
                      className="h-8 px-3 border border-border focus:border-primary rounded-xl text-[12.5px] bg-background text-foreground outline-none cursor-pointer font-medium transition-all shadow-xs"
                    >
                      <option value="All">All Hazards</option>
                      <option value="Light Hazard">Light Hazard</option>
                      <option value="Ordinary Hazard Gp 1">Ordinary Gp 1</option>
                      <option value="Ordinary Hazard Gp 2">Ordinary Gp 2</option>
                      <option value="Extra Hazard Gp 1">Extra Gp 1</option>
                      <option value="Extra Hazard Gp 2">Extra Gp 2</option>
                    </select>

                    {/* K-factor Filter */}
                    <select
                      value={kFilter}
                      onChange={(e) => setKFilter(e.target.value)}
                      className="h-8 px-3 border border-border focus:border-primary rounded-xl text-[12.5px] bg-background text-foreground outline-none cursor-pointer font-medium transition-all shadow-xs"
                    >
                      <option value="All">All K-Factors</option>
                      {STANDARD_K_FACTORS.map(k => (
                        <option key={k} value={k}>K-{k.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleImportClick}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer transition-all shadow-xs"
                    >
                      <Upload className="size-3.5 text-muted-foreground" /> Import Excel
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImportFile}
                      style={{ display: "none" }}
                      accept=".xlsx,.xls,.csv"
                    />

                    <TBtn primary onClick={addSprinkler} className="h-8 px-3.5 text-[12.5px] rounded-xl">
                      <Plus className="size-4" /> Add Sprinkler
                    </TBtn>
                  </div>
                </div>

                {/* DataGrid Area */}
                <div className="flex-1 min-h-0 bg-background overflow-hidden relative flex flex-col">
                  {filteredRows.length > 0 ? (
                    <DataGrid
                      rows={filteredRows}
                      columns={columns}
                      selected={selected}
                      onToggle={toggleSelect}
                      onToggleAll={toggleSelectAll}
                      renderContextMenu={renderSprinklerContextMenu}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                      <HelpCircle className="size-8 text-muted-foreground/50" />
                      <span className="text-[13px]">No sprinklers found in schedule. Click 'Add Sprinkler' to begin.</span>
                    </div>
                  )}

                  {/* Floating Bulk Actions Bar */}
                  {selected.size > 0 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border border-border rounded-full py-2 px-4 shadow-xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
                      <span className="text-[12px] font-bold border-r border-border pr-3 text-foreground">
                        {selected.size} selected
                      </span>
                      <button
                        onClick={duplicateSelected}
                        className="inline-flex items-center gap-1.5 px-3 py-1 hover:bg-muted rounded-full text-[12px] font-semibold transition-all cursor-pointer text-foreground"
                      >
                        <Copy className="size-3.5 text-muted-foreground" /> Duplicate
                      </button>
                      <button
                        onClick={confirmDeleteSelected}
                        className="inline-flex items-center gap-1.5 px-3 py-1 hover:bg-destructive/10 rounded-full text-[12px] font-bold text-destructive transition-all cursor-pointer"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </button>
                      <button
                        onClick={() => setSelected(new Set())}
                        className="inline-flex items-center gap-1.5 px-3 py-1 hover:bg-muted rounded-full text-[12px] font-semibold text-muted-foreground transition-all cursor-pointer"
                      >
                        <X className="size-3.5" /> Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Clean Footer Bar */}
                <div className="flex items-center justify-between px-4 h-9 border-t border-border bg-header-bg text-[11.5px] text-muted-foreground shrink-0 select-none font-medium">
                  <div>
                    Showing <span className="text-foreground font-bold tabular">{filteredRows.length}</span> of {rows.length} sprinklers
                  </div>
                  <div className="text-muted-foreground italic text-[11px]">
                    Right-click row for context menu operations
                  </div>
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {tab === "report" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6 w-full">
                {/* Toolbar */}
                <div className="flex justify-between items-center pb-4 border-b border-border">
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground">Sizing Report Summary</h3>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5">Review system compliance and download reports.</p>
                  </div>
                  <div className="flex items-center gap-2 no-print print:hidden">
                    <button
                      onClick={exportPdf}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer"
                    >
                      <FileText className="size-3.5 text-destructive" /> Export PDF
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[12.5px] font-semibold border border-border bg-background hover:bg-surface-2 text-foreground cursor-pointer"
                    >
                      <Printer className="size-3.5 text-muted-foreground" /> Print Report
                    </button>
                  </div>
                </div>

                {/* Aggregate Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                      <Search className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Sprinklers Sized</span>
                      <div className="text-[20px] font-extrabold font-mono text-foreground mt-0.5">{rows.length} heads</div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">Active nodes in project</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                      <Activity className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Max Node Pressure</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {aggregateMetrics.maxPressure.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">{unitSystem === "si" ? "bar" : "psi"}</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">Highest node pressure</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-sky-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Droplet className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Sprinkler Discharge</span>
                      <div className="text-[20px] font-extrabold font-mono text-primary mt-0.5">
                        {aggregateMetrics.totalFlow.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">{unitSystem === "si" ? "L/min" : "GPM"}</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">Sum of sprinkler flows</span>
                    </div>
                  </div>

                  <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all">
                    <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <Settings className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Water Demand</span>
                      <div className="text-[20px] font-extrabold font-mono text-red-500 mt-0.5">
                        {aggregateMetrics.systemDemand.toFixed(1)} <span className="text-[11px] font-normal text-muted-foreground">{unitSystem === "si" ? "L/min" : "GPM"}</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground mt-0.5 block">With hose stream allowance</span>
                    </div>
                  </div>
                </div>

                {/* Two Column Layout: Table (left) and Breakdowns + Audit (right) */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  
                  {/* Left Column: Sizing Grid Preview Table */}
                  <div className="flex-1 min-w-0 w-full border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-2/15 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-foreground">Sprinkler Sizing Grid Preview</span>
                      <span className="text-[11px] text-muted-foreground font-mono">{rows.length} Sized Nodes</span>
                    </div>
                    <div className="overflow-x-auto w-full">
                      <table className="w-full border-collapse text-[12.5px] text-left">
                        <thead>
                          <tr className="border-b border-border bg-surface/50 font-bold text-muted-foreground text-[11px] uppercase tracking-wider">
                            <th className="p-3 w-16 text-center">S.No</th>
                            <th className="p-3">Label / Location</th>
                            <th className="p-3">K-Factor</th>
                            <th className="p-3">Sizing Mode</th>
                            <th className="p-3 text-right">Pressure ({unitSystem === "si" ? "bar" : "psi"})</th>
                            <th className="p-3 text-right">Flow ({unitSystem === "si" ? "L/min" : "GPM"})</th>
                            <th className="p-3 text-right">Coverage ({unitSystem === "si" ? "m²" : "ft²"})</th>
                            <th className="p-3">Hazard</th>
                            <th className="p-3 w-28 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium text-foreground">
                          {rows.map((r, idx) => {
                            const isLowPressure = r.pressure < (unitSystem === "si" ? 0.48 : 7.0);
                            const baseLimit = HAZARD_LIMITS[r.hazard] || 130;
                            const limit = unitSystem === "si" ? parseFloat((baseLimit / 10.7639).toFixed(1)) : baseLimit;
                            const isOverCoverage = r.coverage > limit;

                            return (
                              <tr key={r.id} className="hover:bg-surface/30 transition-colors">
                                <td className="p-3 text-muted-foreground text-center font-mono">{idx + 1}</td>
                                <td className="p-3 text-foreground font-semibold">{r.label}</td>
                                <td className="p-3 font-mono">K-{r.kFactor.toFixed(1)}</td>
                                <td className="p-3">
                                  <span className="px-1.5 py-0.5 rounded-xl text-[11px] font-bold bg-muted text-muted-foreground">
                                    {r.solveFor === "Q" ? "Flow (Q)" : "Pressure (P)"}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-foreground">{r.pressure.toFixed(2)}</td>
                                <td className="p-3 text-right font-mono font-bold text-foreground">{r.flow.toFixed(2)}</td>
                                <td className="p-3 text-right font-mono text-muted-foreground">{r.coverage}</td>
                                <td className="p-3 text-muted-foreground text-[12px]">{r.hazard}</td>
                                <td className="p-3 text-center">
                                  {isLowPressure ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wide">
                                      <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mr-1.5" />
                                      Low Press
                                    </span>
                                  ) : isOverCoverage ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold bg-warning/15 text-warning border border-warning/20 uppercase tracking-wide">
                                      <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 mr-1.5" />
                                      Over Area
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-[10.5px] font-bold bg-success/10 text-success border border-success/20 uppercase tracking-wide">
                                      <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0 mr-1.5" />
                                      Complied
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Audits & Breakdowns */}
                  <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-4">
                    
                    {/* Compliance Auditor Card */}
                    {(() => {
                      const hasErrors = rows.some(r => r.pressure < (unitSystem === "si" ? 0.48 : 7.0));
                      return hasErrors ? (
                        <div className="border border-destructive/20 bg-destructive/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                          <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <h4 className="text-[13px] font-bold text-destructive">NFPA 13 Warnings</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                              Hydraulic violations detected in layout grid. Sized pressures must exceed the code limit of {unitSystem === "si" ? "0.48 bar" : "7.0 psi"}.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-success/20 bg-success/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                          <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[13px] font-bold text-success">NFPA 13 Sizing Audit</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                              System demand fully complies. All node calculations are within NFPA 13 pressure and coverage limits.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Classification breakdown card */}
                    <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-4">
                      <p className="text-[13px] font-bold text-foreground leading-snug">Design Classification</p>
                      
                      <div className="flex flex-col gap-3.5">
                        {Object.entries(reportBreakdowns.hazardCounts).map(([hazardName, count]) => {
                          const percentage = reportBreakdowns.totalRows > 0 ? (count / reportBreakdowns.totalRows) * 100 : 0;
                          return (
                            <div key={hazardName} className="flex flex-col gap-1.5 text-[12px]">
                              <div className="flex justify-between font-medium">
                                <span className="text-muted-foreground truncate pr-2">{hazardName}</span>
                                <span className="text-foreground font-mono font-bold">{count} ({percentage.toFixed(0)}%)</span>
                              </div>
                              <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* K-factor breakdown card */}
                    <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-4">
                      <p className="text-[13px] font-bold text-foreground leading-snug">Orifice / K-Factor Ratios</p>
                      
                      <div className="flex flex-col gap-3.5">
                        {Object.entries(reportBreakdowns.kCounts).map(([kValue, count]) => {
                          const percentage = reportBreakdowns.totalRows > 0 ? (count / reportBreakdowns.totalRows) * 100 : 0;
                          return (
                            <div key={kValue} className="flex flex-col gap-1.5 text-[12px]">
                              <div className="flex justify-between font-medium">
                                <span className="text-muted-foreground truncate">{kValue} Coefficient</span>
                                <span className="text-foreground font-mono font-bold">{count} ({percentage.toFixed(0)}%)</span>
                              </div>
                              <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/80 rounded-full" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Intelligence Side Drawer */}
        <div
          className={`shrink-0 bg-background overflow-hidden transition-[width] duration-300 ease-out select-none no-print print:hidden ${
            intelOpen ? "w-[360px] border-l border-border" : "w-0"
          }`}
        >
          {intelOpen && (
            <div className="w-[360px] h-full flex flex-col min-h-0 bg-background font-sans">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-header-bg shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4.5 text-primary" />
                  <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Live Intelligence</h3>
                </div>
                <button onClick={() => setIntelOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {/* Formula Guideline */}
                <div className="border border-border rounded-3xl p-3.5 bg-background shadow-xs">
                  <h4 className="text-[12.5px] font-bold text-foreground">Equations Guidance</h4>
                  <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                    NFPA 13 formulas calculate standard discharge:
                  </p>
                  <ul className="text-[11px] text-muted-foreground mt-2 list-disc pl-4 flex flex-col gap-1 font-mono">
                    <li>Flow: Q = K \u00d7 \u221aP</li>
                    <li>Pressure: P = (Q / K)\u00b2</li>
                  </ul>
                </div>

                {/* Optimizations Actions */}
                <div className="border border-border rounded-3xl p-3.5 bg-background shadow-xs flex flex-col gap-3">
                  <h4 className="text-[12.5px] font-bold text-foreground">AI Quick Optimizers</h4>
                  <p className="text-[11.5px] text-muted-foreground leading-normal">
                    Batch-fix spacing guidelines or K-factor sizes to optimize hydraulic efficiency.
                  </p>
                  <div className="flex flex-col gap-2 mt-1">
                    <button
                      onClick={handleFixAllPressures}
                      className="w-full py-1.5 px-3 rounded-xl text-[11.5px] font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-center transition-all cursor-pointer"
                    >
                      Fix All Low Pressures (Set to 7 psi)
                    </button>
                    <button
                      onClick={handleOptimizeAllKFactors}
                      className="w-full py-1.5 px-3 rounded-xl text-[11.5px] font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-center transition-all cursor-pointer"
                    >
                      Optimize Large Pressures (&gt;35 psi)
                    </button>
                  </div>
                </div>

                {/* Dynamic Warnings Checklist */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Warnings & Fixes</span>
                  {warningsList.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {warningsList.map((warn, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-2xl border text-[12px] flex gap-3 shadow-xs ${
                            warn.type === "critical"
                              ? "border-destructive/20 bg-destructive/5 text-foreground"
                              : "border-warning/20 bg-warning/5 text-foreground"
                          }`}
                        >
                          <AlertTriangle className={`size-4 shrink-0 mt-0.5 ${warn.type === "critical" ? "text-destructive" : "text-warning"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold">{warn.title}</div>
                            <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">{warn.desc}</div>
                            {warn.fixable && warn.action && (
                              <button
                                onClick={warn.action}
                                className="mt-2 text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="size-3" /> Auto-Fix Issue
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-border/80 rounded-3xl p-4 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-8 bg-surface-2/10">
                      <CheckCircle2 className="size-8 text-success" />
                      <span className="text-[12px] font-semibold text-foreground">Sizing Complies!</span>
                      <span className="text-[11px] text-muted-foreground">All pressures and areas are within NFPA limits.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
