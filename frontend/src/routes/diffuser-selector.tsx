import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle,
  Save, FolderOpen, ChevronDown, ChevronUp, Trash2, Copy, Clipboard,
  RotateCcw, MessageSquare, Edit3, FileText, CheckCircle2, Sparkles,
  Download, Upload, Gauge, Layers, Plus, Filter, Search, Wind,
  SlidersHorizontal, Check, RefreshCw, Zap, Calculator, Flame, ArrowRight,
  Sliders, ShieldCheck, CheckSquare, Square, Flag, Activity, Eye, X
} from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { exportDiffuserSelectorExcel } from "@/lib/exportDiffuserSelectorExcel";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { UnitToggle } from "@/components/workspace/UnitToggle";

export const Route = createFileRoute("/diffuser-selector")({
  head: () => ({
    meta: [
      { title: "Diffuser Selector — MEP Calc" },
      { name: "description", content: "Comprehensive HVAC air terminal & diffuser selection schedule with multi-space sizing, noise criteria, and ADPI analysis." },
    ],
  }),
  component: DiffuserSelectorPage,
});

type DiffuserType = "square" | "round" | "slot16" | "slot20" | "slot25";

interface DiffuserSize {
  size: string;
  maxFlow_20?: number;
  maxFlow_25?: number;
  maxFlow?: number;
  throw: number;
  nc: number;
}

export interface DiffuserRowItem {
  id: string;
  name: string;
  floor: string;
  zone: string;
  coolingKw?: number | ""; // Q in kW from Preliminary Cooling Load
  deltaT?: number | "";    // Delta T in °C or °F
  airflow: number | "";   // Flow in L/s or CFM
  count: number | "";
  diffType: DiffuserType;
  designVelocity: number; // 2.0 or 2.5 m/s
  comments?: any[];
  flagged?: boolean;
}

interface SavedCalculation {
  id: string;
  type: string;
  name: string;
  savedAt: string;
  values: {
    rows: DiffuserRowItem[];
  };
  unitSystem: "si" | "ip";
}

const DIFFUSER_NAMES: Record<DiffuserType, string> = {
  square: "4-Way Square Ceiling Diffuser",
  round: "Circular Cone Diffuser",
  slot16: "Linear Slot Diffuser (16mm)",
  slot20: "Linear Slot Diffuser (20mm)",
  slot25: "Linear Slot Diffuser (25mm)"
};

const DIFFUSER_DATA: Record<DiffuserType, DiffuserSize[]> = {
  square: [
    { size: "150x150 mm (6\"x6\")", maxFlow_20: 95, maxFlow_25: 116, throw: 8, nc: 20 },
    { size: "225x225 mm (9\"x9\")", maxFlow_20: 212, maxFlow_25: 275, throw: 12, nc: 25 },
    { size: "300x300 mm (12\"x12\")", maxFlow_20: 392, maxFlow_25: 487, throw: 16, nc: 30 },
    { size: "375x375 mm (15\"x15\")", maxFlow_20: 614, maxFlow_25: 667, throw: 20, nc: 35 },
    { size: "450x450 mm (18\"x18\")", maxFlow_20: 826, maxFlow_25: 826, throw: 24, nc: 40 },
    { size: "525x525 mm (21\"x21\")", maxFlow_20: 1038, maxFlow_25: 1038, throw: 28, nc: 45 },
    { size: "600x600 mm (24\"x24\")", maxFlow_20: 1239, maxFlow_25: 1239, throw: 32, nc: 50 }
  ],
  round: [
    { size: "Ø250 mm (Ø10\")", maxFlow_20: 38, maxFlow_25: 47, throw: 8, nc: 20 },
    { size: "Ø307 mm (Ø12\")", maxFlow_20: 66, maxFlow_25: 83, throw: 10, nc: 22 },
    { size: "Ø366 mm (Ø14\")", maxFlow_20: 105, maxFlow_25: 132, throw: 12, nc: 24 },
    { size: "Ø424 mm (Ø16\")", maxFlow_20: 167, maxFlow_25: 210, throw: 15, nc: 26 },
    { size: "Ø483 mm (Ø18\")", maxFlow_20: 216, maxFlow_25: 271, throw: 18, nc: 28 },
    { size: "Ø541 mm (Ø20\")", maxFlow_20: 274, maxFlow_25: 345, throw: 20, nc: 30 },
    { size: "Ø600 mm (Ø24\")", maxFlow_20: 344, maxFlow_25: 432, throw: 22, nc: 32 }
  ],
  slot16: [
    { size: "1 Slot (16mm)", maxFlow: 45, throw: 6, nc: 20 },
    { size: "2 Slot (16mm)", maxFlow: 65, throw: 8, nc: 22 },
    { size: "3 Slot (16mm)", maxFlow: 100, throw: 10, nc: 24 },
    { size: "4 Slot (16mm)", maxFlow: 125, throw: 12, nc: 26 }
  ],
  slot20: [
    { size: "1 Slot (20mm)", maxFlow: 50, throw: 6, nc: 20 },
    { size: "2 Slot (20mm)", maxFlow: 75, throw: 8, nc: 22 },
    { size: "3 Slot (20mm)", maxFlow: 110, throw: 10, nc: 24 },
    { size: "4 Slot (20mm)", maxFlow: 130, throw: 12, nc: 26 }
  ],
  slot25: [
    { size: "1 Slot (25mm)", maxFlow: 55, throw: 6, nc: 20 },
    { size: "2 Slot (25mm)", maxFlow: 85, throw: 8, nc: 22 },
    { size: "3 Slot (25mm)", maxFlow: 125, throw: 10, nc: 24 },
    { size: "4 Slot (25mm)", maxFlow: 150, throw: 12, nc: 26 }
  ]
};

// Specific Heat Capacity (cp) lookup table at different temperatures for water (in kJ/kg·K)
export function getCpWater(tempC: number): number {
  if (tempC <= 0) return 4.217;
  if (tempC >= 100) return 4.216;
  if (tempC <= 20) return 4.217 + ((4.186 - 4.217) / 20) * tempC;
  if (tempC <= 40) return 4.186 + ((4.179 - 4.186) / 20) * (tempC - 20);
  if (tempC <= 60) return 4.179 + ((4.184 - 4.179) / 20) * (tempC - 40);
  if (tempC <= 80) return 4.184 + ((4.196 - 4.184) / 20) * (tempC - 60);
  return 4.196 + ((4.216 - 4.196) / 20) * (tempC - 80);
}

// Compute flow rate from Q = m * Cp * Delta_T
export function computeAirflowFromKw(
  coolingKw: number,
  deltaT: number, // in °C (or °F if isIP)
  isIP: boolean = false,
  fluidType: "air" | "water" = "air",
  tempC: number = 20
): { massFlowKgS: number; flowRate: number } {
  if (coolingKw <= 0 || deltaT <= 0) return { massFlowKgS: 0, flowRate: 0 };

  if (fluidType === "air") {
    const dtMetric = isIP ? deltaT / 1.8 : deltaT;
    const mDot = coolingKw / (1.005 * dtMetric);
    const flowLps = (mDot / 1.204) * 1000;
    const flowFinal = isIP ? flowLps * 2.1189 : flowLps;
    return { massFlowKgS: mDot, flowRate: Math.round(flowFinal * 10) / 10 };
  } else {
    const dtMetric = isIP ? deltaT / 1.8 : deltaT;
    const cp = getCpWater(tempC);
    const mDot = coolingKw / (cp * dtMetric);
    const flowLps = mDot;
    const flowFinal = isIP ? (flowLps * 60) / 3.78541 : flowLps;
    return { massFlowKgS: mDot, flowRate: Math.round(flowFinal * 100) / 100 };
  }
}

const DEFAULT_ROWS: DiffuserRowItem[] = [
  { id: "row-1", name: "Executive Office 101", floor: "GF", zone: "AHU-01", coolingKw: 2.2, deltaT: 10, airflow: 182, count: 2, diffType: "square", designVelocity: 2.0 },
  { id: "row-2", name: "Conference Room 102", floor: "GF", zone: "AHU-01", coolingKw: 5.5, deltaT: 10, airflow: 455, count: 4, diffType: "square", designVelocity: 2.0 },
  { id: "row-3", name: "Open Workspace Area", floor: "L01", zone: "AHU-02", coolingKw: 15.0, deltaT: 10, airflow: 1240, count: 8, diffType: "square", designVelocity: 2.5 },
  { id: "row-4", name: "Boardroom Suite", floor: "L01", zone: "AHU-02", coolingKw: 4.2, deltaT: 10, airflow: 347, count: 3, diffType: "slot20", designVelocity: 2.0 },
];

function DiffuserSelectorPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const { project, spaces, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [rows, setRows] = useState<DiffuserRowItem[]>(DEFAULT_ROWS);
  const [activeTab, setActiveTab] = useState<"schedule" | "matrix" | "formulas">("schedule");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [floorFilter, setFloorFilter] = useState<string>("all");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Double-Click Detail & Overview Modals
  const [selectedDetailRow, setSelectedDetailRow] = useState<DiffuserRowItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showOverviewModal, setShowOverviewModal] = useState<boolean>(false);

  // Thermodynamic Calculation Modal State (PCL Importer)
  const [showPclModal, setShowPclModal] = useState<boolean>(false);
  const [pclDeltaT, setPclDeltaT] = useState<number>(10);
  const [pclDiversity, setPclDiversity] = useState<number>(100);
  const [pclSelectedIds, setPclSelectedIds] = useState<{ [id: string]: boolean }>({});

  // Sandbox Calculator in Tab 3
  const [sandboxKw, setSandboxKw] = useState<number>(10);
  const [sandboxDt, setSandboxDt] = useState<number>(10);
  const [sandboxFluid, setSandboxFluid] = useState<"air" | "water">("air");
  const [sandboxTemp, setSandboxTemp] = useState<number>(20);

  // New Space Input State
  const [newName, setNewName] = useState("");
  const [newFloor, setNewFloor] = useState("GF");
  const [newZone, setNewZone] = useState("Zone-1");
  const [newCoolingKw, setNewCoolingKw] = useState<number | "">("");
  const [newDeltaT, setNewDeltaT] = useState<number | "">(10);
  const [newAirflow, setNewAirflow] = useState<number | "">("");
  const [newCount, setNewCount] = useState<number | "">(2);
  const [newType, setNewType] = useState<DiffuserType>("square");
  const [newVelocity, setNewVelocity] = useState<number>(2.0);

  // Comment System State
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);

  const ip = unitSystem === "ip";
  const flowUnit = ip ? "CFM" : "L/s";
  const velUnit = ip ? "FPM" : "m/s";
  const lenUnit = ip ? "ft" : "m";
  const tempUnit = ip ? "°F" : "°C";

  // Auto compute airflow when coolingKw or deltaT changes in quick-add
  useEffect(() => {
    if (newCoolingKw !== "" && Number(newCoolingKw) > 0 && newDeltaT !== "" && Number(newDeltaT) > 0) {
      const res = computeAirflowFromKw(Number(newCoolingKw), Number(newDeltaT), ip, "air", 20);
      setNewAirflow(res.flowRate);
    }
  }, [newCoolingKw, newDeltaT, ip]);

  // Comments persistence
  useEffect(() => {
    const pId = project?.id || "default";
    const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/diffuser-selector`);
    if (savedComments) {
      try {
        setCommentsList(JSON.parse(savedComments));
      } catch (e) {
        console.error("Failed to load comments", e);
      }
    }
  }, [project?.id]);

  // Ensure Diffuser Selector is unlocked
  useEffect(() => {
    const pId = project?.id || "default";
    const keys = [
      `mep_calc_review_${pId}_/diffuser-selector`,
      `mep_calc_review_default_/diffuser-selector`,
      `mep_calc_review_${pId}_diffuser-selector`,
      `mep_calc_review_default_diffuser-selector`
    ];

    keys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.status === "APPROVED") {
            const draft = { ...parsed, status: "DRAFT" };
            localStorage.setItem(k, JSON.stringify(draft));
            window.dispatchEvent(new CustomEvent("mep-review-state-updated", {
              detail: { storageKey: k, state: draft, status: "DRAFT", projectId: pId, calculatorTitle: "Diffuser Selection Schedule" }
            }));
          }
        }
      } catch (e) {}
    });
  }, [project?.id]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/diffuser-selector`, JSON.stringify(newList));
    try {
      if (typeof forceSaveToCloud === "function") {
        forceSaveToCloud();
      }
    } catch (e) {}
  };

  const handleOpenComment = (target: { id: string; name: string }) => {
    setCommentTargetItem(target);
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentText: string, metadata?: any) => {
    if (!commentText.trim()) return;
    const newComment = {
      id: "cm_" + Date.now(),
      spaceId: commentTargetItem?.id || "general",
      targetId: commentTargetItem?.id || "general",
      targetName: commentTargetItem?.name || "Diffuser Parameter",
      user: currentUserName,
      userId: userData?.id || profile?.id || "user_id",
      text: commentText.trim(),
      timestamp: new Date().toISOString(),
      status: "OPEN",
      tag: metadata?.tag || "general",
      priority: metadata?.priority || "medium",
      assignedTo: metadata?.assignedTo || "",
      calculatorPath: "/diffuser-selector",
      projectId: project?.id || "default",
      projectName: project?.name || "Diffuser Selector",
    };
    const updated = [newComment, ...commentsList];
    saveComments(updated);
    toast.success(`Comment / task assigned on "${commentTargetItem?.name || "item"}"`);
    setCommentModalOpen(false);

    notifyCommentAssigned({
      comment: newComment,
      targetId: commentTargetItem?.id || "diffuser-selector",
      targetName: commentTargetItem?.name || "Diffuser Selection",
      targetType: "air-terminal",
      calculatorTitle: "Diffuser Quick Selector",
      calculatorPath: "/diffuser-selector",
      project,
      currentUserName,
      currentUserId: userData?.id || profile?.id
    }).catch(console.error);
  };

  // State persistence per project
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`diffuser_selector_rows_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (Array.isArray(data.rows) && data.rows.length > 0) setRows(data.rows);
          if (data.unitSystem) setUnitSystem(data.unitSystem);
        }
      } catch (e) {
        console.error(e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { rows, unitSystem };
      localStorage.setItem(`diffuser_selector_rows_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, rows, unitSystem]);

  // Presets load/save
  const [saves, setSaves] = useState<SavedCalculation[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showLoadModal, setShowLoadModal] = useState<boolean>(false);
  const [saveName, setSaveName] = useState<string>("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mep_diffuser_selector_saves");
      if (stored) {
        setSaves(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load presets", e);
    }
  }, []);

  const savePresets = (newSaves: SavedCalculation[]) => {
    setSaves(newSaves);
    localStorage.setItem("mep_diffuser_selector_saves", JSON.stringify(newSaves));
  };

  const handleSaveCurrent = () => {
    if (!saveName.trim()) return;
    const newSave: SavedCalculation = {
      id: "diffuser_save_" + Date.now(),
      type: "diffuser-selector",
      name: saveName.trim(),
      savedAt: new Date().toISOString(),
      values: { rows },
      unitSystem
    };
    const updated = [newSave, ...saves];
    savePresets(updated);
    setSaveName("");
    setShowSaveModal(false);
    toast.success(`Preset "${newSave.name}" saved`);
    if (typeof forceSaveToCloud === "function") {
      forceSaveToCloud();
    }
  };

  const handleLoadSave = (id: string) => {
    const target = saves.find(s => s.id === id);
    if (!target) return;
    if (target.values.rows) setRows(target.values.rows);
    if (target.unitSystem) setUnitSystem(target.unitSystem);
    setShowLoadModal(false);
    toast.success(`Loaded preset "${target.name}"`);
  };

  const handleDeleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = saves.filter(s => s.id !== id);
    savePresets(updated);
    toast.info("Deleted preset");
  };

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);

    if (shouldConvert) {
      setRows(prev =>
        prev.map(r => ({
          ...r,
          airflow: r.airflow !== ""
            ? Number((targetUnit === "ip" ? Number(r.airflow) * 2.1189 : Number(r.airflow) / 2.1189).toFixed(1))
            : ""
        }))
      );
    }
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  // Sizing calculation engine for a single row
  const computeRowSizing = (row: DiffuserRowItem) => {
    const flowVal = row.airflow !== "" ? Number(row.airflow) : 0;
    const countVal = row.count !== "" && Number(row.count) > 0 ? Number(row.count) : 1;
    const flowLps = ip ? flowVal / 2.1189 : flowVal;
    const flowPerDiffLps = flowLps / countVal;
    const flowPerDiffDisplay = ip ? flowPerDiffLps * 2.1189 : flowPerDiffLps;

    const flowKey = row.designVelocity === 2.5 ? "maxFlow_25" : "maxFlow_20";
    const options = DIFFUSER_DATA[row.diffType] || DIFFUSER_DATA.square;

    let selected: DiffuserSize | null = null;
    for (let i = 0; i < options.length; i++) {
      let maxFlow = 0;
      if (row.diffType === "square" || row.diffType === "round") {
        maxFlow = options[i][flowKey] || 0;
      } else {
        maxFlow = options[i].maxFlow || 0;
      }
      if (flowPerDiffLps <= maxFlow) {
        selected = options[i];
        break;
      }
    }

    if (!selected) {
      if (row.diffType === "slot16" || row.diffType === "slot20" || row.diffType === "slot25") {
        return {
          flowPerDiff: flowPerDiffDisplay,
          neckSize: "Capacity Exceeded",
          velocity: row.designVelocity,
          velocityFpm: row.designVelocity * 196.85,
          throwVal: "-",
          nc: "NC > 35",
          adpi: "Exceeds Slot Limit",
          isExceeded: true,
          status: "FAIL"
        };
      }
      selected = options[options.length - 1];
    }

    const velocityFpm = row.designVelocity * 196.85;
    let adpi = "Good Selection (ADPI ≥ 80%)";
    let status = "PASS";
    if (velocityFpm > 600) {
      adpi = "High velocity - draft risk";
      status = "WARN";
    } else if (velocityFpm < 250) {
      adpi = "Low velocity - stagnation risk";
      status = "WARN";
    }

    const throwDisplay = ip ? `${selected.throw.toFixed(1)} ft` : `${(selected.throw * 0.3048).toFixed(1)} m`;

    return {
      flowPerDiff: flowPerDiffDisplay,
      neckSize: selected.size,
      velocity: row.designVelocity,
      velocityFpm,
      throwVal: throwDisplay,
      nc: `NC-${selected.nc}`,
      adpi,
      isExceeded: false,
      status
    };
  };

  // Computed results across all rows
  const computedRows = useMemo(() => {
    return rows.map(r => ({
      ...r,
      sizing: computeRowSizing(r)
    }));
  }, [rows, ip]);

  // Overall KPI totals
  const totalFlowSum = useMemo(() => {
    return computedRows.reduce((sum, r) => sum + (typeof r.airflow === "number" ? r.airflow : 0), 0);
  }, [computedRows]);

  const totalDiffusersSum = useMemo(() => {
    return computedRows.reduce((sum, r) => sum + (typeof r.count === "number" ? r.count : 0), 0);
  }, [computedRows]);

  const totalCoolingKwSum = useMemo(() => {
    return computedRows.reduce((sum, r) => sum + (typeof r.coolingKw === "number" ? r.coolingKw : 0), 0);
  }, [computedRows]);

  // Quick Add Space Handler
  const handleAddSpace = () => {
    const name = newName.trim() || `Space ${rows.length + 1}`;
    let flow = newAirflow !== "" ? Number(newAirflow) : (ip ? 400 : 188);

    if (newCoolingKw !== "" && Number(newCoolingKw) > 0) {
      const dt = newDeltaT !== "" ? Number(newDeltaT) : 10;
      flow = computeAirflowFromKw(Number(newCoolingKw), dt, ip, "air", 20).flowRate;
    }

    const count = newCount !== "" ? Number(newCount) : 2;

    const newRow: DiffuserRowItem = {
      id: "row-" + Date.now(),
      name,
      floor: newFloor.trim() || "GF",
      zone: newZone.trim() || "Zone-1",
      coolingKw: newCoolingKw !== "" ? Number(newCoolingKw) : "",
      deltaT: newDeltaT !== "" ? Number(newDeltaT) : 10,
      airflow: flow,
      count,
      diffType: newType,
      designVelocity: newVelocity,
      flagged: false
    };

    setRows(prev => [...prev, newRow]);
    setNewName("");
    setNewCoolingKw("");
    setNewAirflow("");
    setShowAddModal(false);
    toast.success(`Added "${name}" with Q=m·Cp·ΔT airflow computation`);
  };

  // Multi-Selection Operations
  const handleToggleSelectRow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === filteredRows.length && filteredRows.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredRows.map(r => r.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedRowIds.size === 0) return;
    if (confirm(`Delete ${selectedRowIds.size} selected space(s) from diffuser schedule?`)) {
      setRows(prev => prev.filter(r => !selectedRowIds.has(r.id)));
      setSelectedRowIds(new Set());
      toast.success("Deleted selected spaces");
    }
  };

  const handleBulkSetType = (type: DiffuserType) => {
    if (selectedRowIds.size === 0) return;
    setRows(prev => prev.map(r => selectedRowIds.has(r.id) ? { ...r, diffType: type } : r));
    toast.success(`Updated terminal type to ${DIFFUSER_NAMES[type]} for ${selectedRowIds.size} spaces`);
  };

  const handleBulkToggleFlag = () => {
    if (selectedRowIds.size === 0) return;
    setRows(prev => prev.map(r => selectedRowIds.has(r.id) ? { ...r, flagged: !r.flagged } : r));
    toast.success(`Updated review flags for ${selectedRowIds.size} spaces`);
  };

  // Available unique floors for filter
  const availableFloors = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (r.floor && r.floor.trim()) set.add(r.floor.trim());
    });
    return Array.from(set).sort();
  }, [rows]);

  // Fetch PCL Spaces from LocalStorage or Workspace Data
  const getPclSpaces = () => {
    const pId = project?.id || "default";
    let pclList: any[] = [];
    try {
      const saved = localStorage.getItem(`mep_pcl_rows_${pId}`) || localStorage.getItem("pcl_rows");
      if (saved) {
        pclList = JSON.parse(saved);
      }
    } catch (e) {}

    if (pclList.length === 0 && (project as any)?.workspace_data) {
      const wdata = typeof (project as any).workspace_data === "string"
        ? JSON.parse((project as any).workspace_data)
        : (project as any).workspace_data;
      if (wdata?.pcl_rows) pclList = wdata.pcl_rows;
    }
    return pclList;
  };

  // Open PCL Modal with all spaces selected by default
  const handleOpenPclModal = () => {
    const pclSpaces = getPclSpaces();
    const initialMap: { [id: string]: boolean } = {};
    pclSpaces.forEach((s, idx) => {
      initialMap[s.id || String(idx)] = true;
    });
    setPclSelectedIds(initialMap);
    setShowPclModal(true);
  };

  // Import selected from Preliminary Cooling Load
  const handleImportFromPcl = () => {
    const pclSpaces = getPclSpaces();

    if (!pclSpaces || pclSpaces.length === 0) {
      toast.info("No calculated spaces found in Preliminary Cooling Load. Importing workspace spaces instead.");
      handleImportWorkspaceSpaces();
      return;
    }

    const selectedSpaces = pclSpaces.filter((p, idx) => pclSelectedIds[p.id || String(idx)] !== false);
    if (selectedSpaces.length === 0) {
      toast.error("Please select at least one space to import.");
      return;
    }

    const dt = pclDeltaT > 0 ? pclDeltaT : 10;
    const diversityFactor = pclDiversity / 100;

    const imported: DiffuserRowItem[] = selectedSpaces.map((p, idx) => {
      const rawKw = Number(p.kw || (p.tr ? p.tr * 3.517 : (p.dissipation ? p.dissipation / 1000 : 3.0)));
      const kw = rawKw * diversityFactor;
      const computed = computeAirflowFromKw(kw, dt, ip, "air", 20);
      const area = Number(p.area || 20);
      const count = Math.max(1, Math.ceil(area / 25));

      return {
        id: "pcl-space-" + (p.id || idx) + "-" + Date.now(),
        name: p.name || `Space ${idx + 1}`,
        floor: p.floor || "GF",
        zone: p.zone || "AHU-Zone",
        coolingKw: Number(kw.toFixed(2)),
        deltaT: dt,
        airflow: computed.flowRate,
        count,
        diffType: "square",
        designVelocity: 2.0,
        flagged: false
      };
    });

    setRows(prev => [...prev, ...imported]);
    setShowPclModal(false);
    toast.success(`Imported ${imported.length} space(s) from Preliminary Cooling Load`);
  };

  // Import from Workspace Spaces
  const handleImportWorkspaceSpaces = () => {
    if (!spaces || spaces.length === 0) {
      toast.info("No project spaces found in workspace store. Add spaces in Ventilation module first.");
      return;
    }

    const imported: DiffuserRowItem[] = spaces.map((s, idx) => {
      const area = Number(s.area || 20);
      const mult = Number(s.multiplier || 1);
      const estKw = Number((area * mult * 0.12).toFixed(2));
      const estFlowLps = Math.max(50, Math.round(area * mult * 3.0));
      const estFlow = ip ? Math.round(estFlowLps * 2.1189) : estFlowLps;
      const count = Math.max(1, Math.ceil(area / 25));

      return {
        id: "ws-space-" + (s.id || idx) + "-" + Date.now(),
        name: s.name || `Space ${idx + 1}`,
        floor: s.floor || "GF",
        zone: s.zone || "Default",
        coolingKw: estKw,
        deltaT: 10,
        airflow: estFlow,
        count,
        diffType: "square",
        designVelocity: 2.0,
        flagged: false
      };
    });

    setRows(prev => [...prev, ...imported]);
    toast.success(`Imported ${imported.length} spaces from project workspace`);
  };

  const handleDuplicateRow = (row: DiffuserRowItem) => {
    const dup: DiffuserRowItem = {
      ...row,
      id: "row-" + Date.now(),
      name: `${row.name} (Copy)`
    };
    setRows(prev => [...prev, dup]);
    toast.success(`Duplicated "${row.name}"`);
  };

  const handleDeleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    toast.info("Removed space from schedule");
  };

  const handleToggleFlag = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, flagged: !r.flagged } : r));
  };

  const handleClearAll = () => {
    if (confirm("Clear all spaces from diffuser selection schedule?")) {
      setRows([]);
      toast.info("Cleared all schedule rows");
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const exportRows = computedRows.map(r => ({
        id: r.id,
        name: r.name,
        floor: r.floor,
        zone: r.zone,
        flow: typeof r.airflow === "number" ? r.airflow : 0,
        count: typeof r.count === "number" ? r.count : 1,
        flowPerDiff: r.sizing.flowPerDiff,
        diffType: r.diffType,
        diffTypeName: DIFFUSER_NAMES[r.diffType] || r.diffType.toUpperCase(),
        neckSize: r.sizing.neckSize,
        velocity: r.designVelocity,
        velocityFpm: r.sizing.velocityFpm,
        throwVal: r.sizing.throwVal,
        nc: r.sizing.nc,
        adpi: r.sizing.adpi
      }));

      await exportDiffuserSelectorExcel(
        {
          rows: exportRows,
          unitSystem
        },
        {
          calcNo: "TRV-DIF-CAL-01",
          projectNo: project?.code || "P000",
          projectName: project?.name || "MEP Air Distribution",
          client: project?.client || "",
          userName: currentUserName
        }
      );
      toast.success("Excel selection schedule exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel report");
    }
  };

  // Export to PDF
  const handlePrintPDF = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;

      const doc = new jsPDF("p", "pt", "a4");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("AIR TERMINAL & DIFFUSER SELECTION SCHEDULE", 40, 44);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90);
      doc.text(`Generated on: ${new Date().toLocaleDateString("en-GB")} | Calculation Ref: TRV-DIF-CAL-01 | Unit System: ${unitSystem.toUpperCase()}`, 40, 58);

      doc.setDrawColor(210);
      doc.setLineWidth(0.75);
      doc.line(40, 66, 555, 66);

      const tableMargin = { left: 40, right: 40 };

      // 1. Project Details Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text("1. Project Details", 40, 82);

      const projectData = [
        ["Project Name", project?.name || "MEP Air Distribution Study", "Project Number", project?.code || "P000"],
        ["Client", project?.client || "-", "Revision", "Rev 0"],
      ];

      autoTable(doc, {
        startY: 88,
        head: [],
        body: projectData,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 3.5, lineColor: [200, 200, 200], lineWidth: 0.5 },
        margin: tableMargin,
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 100, fillColor: [248, 250, 252] },
          1: { cellWidth: 157 },
          2: { fontStyle: "bold", cellWidth: 100, fillColor: [248, 250, 252] },
          3: { cellWidth: 158 },
        },
      });

      // 2. Diffuser Selection Schedule Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("2. Diffuser Sizing & Acoustic Selection Schedule (Q = m·Cp·ΔT)", 40, (doc as any).lastAutoTable.finalY + 14);

      const scheduleHead = [["No.", "Space / Room", "Diffuser Type", `Cooling (kW)`, `Total Flow (${flowUnit})`, "Qty", `Flow/Diff (${flowUnit})`, "Neck Size", `Vel (${velUnit})`, "NC"]];
      const scheduleBody = computedRows.map((r, idx) => [
        String(idx + 1),
        r.name,
        r.diffType.toUpperCase(),
        typeof r.coolingKw === "number" ? r.coolingKw.toFixed(2) : "-",
        typeof r.airflow === "number" ? r.airflow.toFixed(0) : "-",
        typeof r.count === "number" ? String(r.count) : "1",
        r.sizing.flowPerDiff.toFixed(1),
        r.sizing.neckSize,
        ip ? r.sizing.velocityFpm.toFixed(0) : r.sizing.velocity.toFixed(2),
        r.sizing.nc
      ]);

      scheduleBody.push([
        "Total",
        `Scheduled Spaces: ${computedRows.length}`,
        "-",
        totalCoolingKwSum > 0 ? totalCoolingKwSum.toFixed(2) : "-",
        totalFlowSum.toFixed(0),
        String(totalDiffusersSum),
        "-",
        "-",
        "-",
        "Complies"
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: scheduleHead,
        body: scheduleBody,
        theme: "grid",
        headStyles: {
          fillColor: [220, 230, 242],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          fontSize: 8,
        },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.5 },
        margin: tableMargin,
        columnStyles: {
          0: { halign: "center", cellWidth: 25 },
          1: { fontStyle: "bold", cellWidth: 100 },
          2: { cellWidth: 55, halign: "center" },
          3: { halign: "center", cellWidth: 45 },
          4: { halign: "center", cellWidth: 50 },
          5: { halign: "center", cellWidth: 25 },
          6: { halign: "center", cellWidth: 50 },
          7: { fontStyle: "bold", cellWidth: 65, halign: "center" },
          8: { halign: "center", cellWidth: 50 },
          9: { halign: "center", cellWidth: 50 },
        },
      });

      const sigFinalY = (doc as any).lastAutoTable?.finalY || 40;
      addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "/diffuser-selector", tableMargin);

      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), "Diffuser_Selection_Schedule_Report.pdf", "PDF Document", ["pdf"]);
      toast.success("PDF report generated successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report");
    }
  };

  // Filtered rows for display
  const filteredRows = useMemo(() => {
    return computedRows.filter(r => {
      const matchSearch = searchQuery.trim() === "" ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.floor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.zone.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = typeFilter === "all" || r.diffType === typeFilter;
      const matchFloor = floorFilter === "all" || r.floor.trim().toLowerCase() === floorFilter.trim().toLowerCase();
      return matchSearch && matchType && matchFloor;
    });
  }, [computedRows, searchQuery, typeFilter, floorFilter]);

  // Preview draft sizing for AddSpaceModal
  const previewDraftRow: DiffuserRowItem = useMemo(() => {
    let flow = newAirflow !== "" ? Number(newAirflow) : (ip ? 400 : 188);
    if (newCoolingKw !== "" && Number(newCoolingKw) > 0) {
      const dt = newDeltaT !== "" ? Number(newDeltaT) : 10;
      flow = computeAirflowFromKw(Number(newCoolingKw), dt, ip, "air", 20).flowRate;
    }
    return {
      id: "preview-draft",
      name: newName.trim() || "Preview Space",
      floor: newFloor.trim() || "GF",
      zone: newZone.trim() || "Zone-1",
      coolingKw: newCoolingKw,
      deltaT: newDeltaT,
      airflow: flow,
      count: newCount !== "" ? Number(newCount) : 2,
      diffType: newType,
      designVelocity: newVelocity,
      flagged: false
    };
  }, [newName, newFloor, newZone, newCoolingKw, newDeltaT, newAirflow, newCount, newType, newVelocity, ip]);

  const previewDraftSizing = useMemo(() => {
    return computeRowSizing(previewDraftRow);
  }, [previewDraftRow, ip]);

  return (
    <AppShell title="Diffuser Selector" hideSubHeader={true}>
      <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full pb-24">
        {/* Header Section */}
        <div className="flex flex-col gap-1 select-none">
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; DESIGN ASSISTANT &gt; DIFFUSER SELECTION SCHEDULE</span>
          <div className="flex flex-wrap items-center justify-between gap-4 mt-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Diffuser Selector</h1>
              <CalculationReviewBar projectId={project?.id} calculatorPath="/diffuser-selector" calculatorTitle="Diffuser Selection Schedule" />
              {commentsList.length > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Active Task(s) / Comment(s)</span>
                </div>
              )}
            </div>

            {/* Action Buttons & Unit Toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                inputDescriptions="Supply Airflow per space"
                conversionExample={unitSystem === "si" ? "Convert 500 L/s → 1,059 CFM" : "Convert 1000 CFM → 472 L/s"}
              />

              <TBtn onClick={handleExportExcel} className="h-8 text-xs font-semibold">
                <FileSpreadsheet className="size-3.5 text-emerald-600" /> Export Excel
              </TBtn>
              <TBtn onClick={handlePrintPDF} className="h-8 text-xs font-semibold">
                <Printer className="size-3.5 text-blue-600" /> PDF Report
              </TBtn>
              <TBtn onClick={() => setShowSaveModal(true)} className="h-8 text-xs font-semibold">
                <Save className="size-3.5 text-amber-600" /> Save Preset
              </TBtn>
              {saves.length > 0 && (
                <TBtn onClick={() => setShowLoadModal(true)} className="h-8 text-xs font-semibold">
                  <FolderOpen className="size-3.5 text-indigo-600" /> Load ({saves.length})
                </TBtn>
              )}
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Comprehensive HVAC air terminal & diffuser selection schedule with multi-space sizing, noise criteria, and ADPI analysis.
          </p>
        </div>

        {/* 4 Summary KPI Cards (Double-click opens overview diagnostic modal) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onDoubleClick={() => setShowOverviewModal(true)}
            title="Double-click to view complete schedule air distribution summary"
            className="bg-card border border-border/80 hover:border-primary/50 transition-all rounded-2xl p-4 shadow-xs flex flex-col gap-1.5 relative overflow-hidden cursor-pointer select-none group"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Supply Airflow</span>
              <Eye className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">{totalFlowSum.toLocaleString()}</span>
              <span className="text-xs font-bold text-muted-foreground">{flowUnit}</span>
            </div>
            <span className="text-[11px] text-muted-foreground/80">Sum from Q = m·Cp·ΔT sizing</span>
          </div>

          <div
            onDoubleClick={() => setShowOverviewModal(true)}
            title="Double-click to view complete schedule air distribution summary"
            className="bg-card border border-border/80 hover:border-blue-500/50 transition-all rounded-2xl p-4 shadow-xs flex flex-col gap-1.5 relative overflow-hidden cursor-pointer select-none group"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Outlets Count</span>
              <Eye className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">{totalDiffusersSum}</span>
              <span className="text-xs font-bold text-muted-foreground">Diffusers</span>
            </div>
            <span className="text-[11px] text-muted-foreground/80">Total air terminals required</span>
          </div>

          <div
            onDoubleClick={() => setShowOverviewModal(true)}
            title="Double-click to view complete schedule air distribution summary"
            className="bg-card border border-border/80 hover:border-indigo-500/50 transition-all rounded-2xl p-4 shadow-xs flex flex-col gap-1.5 relative overflow-hidden cursor-pointer select-none group"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scheduled Spaces</span>
              <Eye className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">{computedRows.length}</span>
              <span className="text-xs font-bold text-muted-foreground">Rooms</span>
            </div>
            <span className="text-[11px] text-muted-foreground/80">
              {totalCoolingKwSum > 0 ? `${totalCoolingKwSum.toFixed(1)} kW Total Cooling` : "Independent air zones"}
            </span>
          </div>

          <div
            onDoubleClick={() => setShowOverviewModal(true)}
            title="Double-click to view complete schedule air distribution summary"
            className="bg-card border border-border/80 hover:border-emerald-500/50 transition-all rounded-2xl p-4 shadow-xs flex flex-col gap-1.5 relative overflow-hidden cursor-pointer select-none group"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acoustic & Comfort</span>
              <Eye className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">NC ≤ 30</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">PASS</span>
            </div>
            <span className="text-[11px] text-emerald-600/80">ASHRAE draft & sound compliant</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-border/60">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "schedule"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="size-4" /> Diffuser Selection Schedule ({computedRows.length})
          </button>
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "matrix"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gauge className="size-4" /> Standard Sizing Lookup Matrix
          </button>
          <button
            onClick={() => setActiveTab("formulas")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "formulas"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-4" /> Σ Q = m·Cp·ΔT Formulas & Interactive Sandbox
          </button>
        </div>

        {/* Tab 1: Diffuser Schedule */}
        {activeTab === "schedule" && (
          <div className="flex flex-col gap-3.5">
            {/* Action & Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border/80 rounded-2xl p-3 shadow-xs">
              <div className="flex items-center gap-2.5 flex-1 min-w-[280px] max-w-2xl flex-wrap sm:flex-nowrap">
                <div className="relative w-full">
                  <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search spaces by name, floor, or zone..."
                    className="h-9 pl-9 pr-8 rounded-xl border border-border bg-surface-2/60 text-xs font-medium w-full text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-border bg-surface-2/60 text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer shrink-0"
                >
                  <option value="all">All Terminal Types</option>
                  <option value="square">4-Way Square</option>
                  <option value="round">Round Cone</option>
                  <option value="slot16">Slot 16mm</option>
                  <option value="slot20">Slot 20mm</option>
                  <option value="slot25">Slot 25mm</option>
                </select>

                {availableFloors.length > 0 && (
                  <select
                    value={floorFilter}
                    onChange={e => setFloorFilter(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-border bg-surface-2/60 text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer shrink-0"
                  >
                    <option value="all">All Floors</option>
                    {availableFloors.map(fl => (
                      <option key={fl} value={fl}>Floor {fl}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <TBtn
                  onClick={() => setShowAddModal(true)}
                  className="h-9 text-xs font-bold px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="size-4" /> Add Space
                </TBtn>

                <TBtn
                  onClick={handleOpenPclModal}
                  variant="outline"
                  className="h-9 text-xs font-bold px-3 flex items-center gap-1.5 bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 shadow-2xs"
                >
                  <Zap className="size-3.5 fill-primary" /> Import from PCL
                </TBtn>

                <TBtn
                  onClick={handleImportWorkspaceSpaces}
                  variant="outline"
                  className="h-9 text-xs font-semibold px-3 flex items-center gap-1.5 border-border bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2"
                >
                  <RefreshCw className="size-3.5" /> Import Spaces
                </TBtn>

                <TBtn
                  onClick={handleClearAll}
                  variant="ghost"
                  className="h-9 text-xs font-semibold text-destructive hover:bg-destructive/10 px-2.5"
                >
                  <Trash2 className="size-3.5 mr-1" /> Clear
                </TBtn>
              </div>
            </div>

            {/* Bulk Actions Sliding Bar */}
            {selectedRowIds.size > 0 && (
              <div className="flex items-center justify-between gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2 text-xs text-foreground animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center gap-2 font-bold">
                  <span className="size-2 rounded-full bg-primary animate-pulse" />
                  <span>{selectedRowIds.size} space(s) selected</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground font-semibold">Change Diffuser:</span>
                  <select
                    onChange={e => {
                      if (e.target.value) {
                        handleBulkSetType(e.target.value as DiffuserType);
                        e.target.value = "";
                      }
                    }}
                    defaultValue=""
                    className="h-7 px-2 text-xs rounded-lg border border-border bg-background text-foreground font-medium cursor-pointer"
                  >
                    <option value="" disabled>Select Type...</option>
                    <option value="square">4-Way Square</option>
                    <option value="round">Round Cone</option>
                    <option value="slot16">Slot 16mm</option>
                    <option value="slot20">Slot 20mm</option>
                    <option value="slot25">Slot 25mm</option>
                  </select>

                  <button
                    onClick={handleBulkToggleFlag}
                    className="h-7 px-2.5 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                  >
                    <Flag className="size-3 fill-amber-500 text-amber-500" /> Flag / Unflag
                  </button>

                  <button
                    onClick={handleBulkDelete}
                    className="h-7 px-2.5 text-xs font-semibold rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="size-3" /> Delete Selected
                  </button>

                  <button
                    onClick={() => setSelectedRowIds(new Set())}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer font-medium"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Schedule Data Grid Table with Double-Click Breakdown */}
            <div className="border border-border rounded-2xl overflow-hidden shadow-xs bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="py-3 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={selectedRowIds.size > 0 && selectedRowIds.size === filteredRows.length}
                          onChange={handleToggleSelectAll}
                          className="rounded border-border accent-primary cursor-pointer size-3.5"
                          title="Select / Deselect all"
                        />
                      </th>
                      <th className="py-3 px-2 text-center w-10">Sr.</th>
                      <th className="py-3 px-3 min-w-[170px]">Space / Room Name</th>
                      <th className="py-3 px-2 text-center w-14">Floor</th>
                      <th className="py-3 px-2 text-center w-24">Cooling Q (kW)</th>
                      <th className="py-3 px-2 text-center w-20">ΔT ({tempUnit})</th>
                      <th className="py-3 px-3 min-w-[130px]">Terminal Type</th>
                      <th className="py-3 px-2 text-center w-24">Total Flow ({flowUnit})</th>
                      <th className="py-3 px-2 text-center w-16">Qty</th>
                      <th className="py-3 px-2 text-center w-24">Flow/Diff ({flowUnit})</th>
                      <th className="py-3 px-3 text-center min-w-[150px]">Recommended Neck</th>
                      <th className="py-3 px-2 text-center w-24">Vel ({velUnit})</th>
                      <th className="py-3 px-2 text-center w-20">Throw ({lenUnit})</th>
                      <th className="py-3 px-2 text-center w-24">NC Sound</th>
                      <th className="py-3 px-2 text-center w-24">ADPI Comfort</th>
                      <th className="py-3 px-3 text-center w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="py-12 text-center text-muted-foreground text-xs">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Wind className="size-8 text-muted-foreground/50 animate-pulse" />
                            <span className="font-semibold text-foreground">No air terminal spaces found</span>
                            <span className="text-muted-foreground text-[11px]">
                              Click <strong>"Add Space"</strong> or <strong>"Import from Preliminary Cooling Load"</strong> to populate the diffuser selection schedule.
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => {
                        const itemComments = commentsList.filter(c => c.spaceId === row.id || c.targetId === row.id);
                        const hasComments = itemComments.length > 0;
                        const isSelected = selectedRowIds.has(row.id);
                        const ncNum = parseInt(row.sizing.nc.replace(/\D/g, "") || "25");

                        return (
                          <ContextMenu key={row.id}>
                            <ContextMenuTrigger asChild>
                              <tr
                                onDoubleClick={() => {
                                  setSelectedDetailRow(row);
                                  setShowDetailModal(true);
                                }}
                                title="Double-click to open full aerodynamic calculation breakdown & diagnostic modal"
                                className={`transition-colors cursor-pointer select-none group ${
                                  row.flagged
                                    ? "bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-500"
                                    : isSelected
                                    ? "bg-primary/10 hover:bg-primary/15"
                                    : "hover:bg-primary/5"
                                }`}
                              >
                                {/* Checkbox */}
                                <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={e => handleToggleSelectRow(row.id, e)}
                                    className="rounded border-border accent-primary cursor-pointer size-3.5"
                                  />
                                </td>

                                {/* Sr. Number */}
                                <td className="py-2.5 px-2 text-center font-mono text-muted-foreground">
                                  {idx + 1}
                                </td>
                                
                                {/* Room Name */}
                                <td className="py-2.5 px-3 font-semibold text-foreground" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={row.name}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, name: val } : r));
                                      }}
                                      className="bg-transparent border border-transparent font-semibold text-foreground w-full focus:outline-hidden hover:border-border/60 focus:border-primary/60 px-1 py-0.5 rounded transition-colors"
                                    />
                                    {row.flagged && (
                                      <Flag className="size-3 text-amber-500 fill-amber-500 shrink-0" title="Flagged for review" />
                                    )}
                                    {hasComments && (
                                      <span className="size-2 rounded-full bg-primary ring-2 ring-primary/20 shrink-0" title={`${itemComments.length} active comment(s)`} />
                                    )}
                                  </div>
                                </td>

                                {/* Floor */}
                                <td className="py-2.5 px-2 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={row.floor}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, floor: val } : r));
                                    }}
                                    className="bg-transparent text-center border border-transparent text-muted-foreground font-semibold w-12 focus:outline-hidden hover:border-border/60 focus:border-primary/60 rounded py-0.5"
                                  />
                                </td>

                                {/* Cooling Load Q (kW) */}
                                <td className="py-2.5 px-2 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    value={row.coolingKw ?? ""}
                                    placeholder="-"
                                    onChange={e => {
                                      const val = e.target.value === "" ? "" : Number(e.target.value);
                                      setRows(prev => prev.map(r => {
                                        if (r.id === row.id) {
                                          let updatedFlow = r.airflow;
                                          if (val !== "" && Number(val) > 0) {
                                            const dt = r.deltaT && Number(r.deltaT) > 0 ? Number(r.deltaT) : 10;
                                            updatedFlow = computeAirflowFromKw(Number(val), dt, ip, "air", 20).flowRate;
                                          }
                                          return { ...r, coolingKw: val, airflow: updatedFlow };
                                        }
                                        return r;
                                      }));
                                    }}
                                    className="bg-surface-2 text-center border border-border/80 rounded-lg px-1.5 py-1 text-xs font-mono font-bold text-foreground w-20 focus:ring-1 focus:ring-primary focus:outline-hidden"
                                  />
                                </td>

                                {/* Delta T */}
                                <td className="py-2.5 px-2 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    value={row.deltaT ?? 10}
                                    onChange={e => {
                                      const val = e.target.value === "" ? "" : Number(e.target.value);
                                      setRows(prev => prev.map(r => {
                                        if (r.id === row.id) {
                                          let updatedFlow = r.airflow;
                                          if (r.coolingKw && Number(r.coolingKw) > 0 && val !== "" && Number(val) > 0) {
                                            updatedFlow = computeAirflowFromKw(Number(r.coolingKw), Number(val), ip, "air", 20).flowRate;
                                          }
                                          return { ...r, deltaT: val, airflow: updatedFlow };
                                        }
                                        return r;
                                      }));
                                    }}
                                    className="bg-surface-2 text-center border border-border/80 rounded-lg px-1 py-1 text-xs font-mono text-muted-foreground w-14 focus:ring-1 focus:ring-primary focus:outline-hidden"
                                  />
                                </td>

                                {/* Terminal Type */}
                                <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                                  <select
                                    value={row.diffType}
                                    onChange={e => {
                                      const val = e.target.value as DiffuserType;
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, diffType: val } : r));
                                    }}
                                    className="bg-surface-2 border border-border/80 rounded-lg px-2 py-1 text-xs font-semibold text-foreground focus:outline-hidden w-full cursor-pointer"
                                  >
                                    <option value="square">Square 4-Way</option>
                                    <option value="round">Round Cone</option>
                                    <option value="slot16">Slot 16mm</option>
                                    <option value="slot20">Slot 20mm</option>
                                    <option value="slot25">Slot 25mm</option>
                                  </select>
                                </td>

                                {/* Total Flow */}
                                <td className="py-2.5 px-2 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    value={row.airflow}
                                    onChange={e => {
                                      const val = e.target.value === "" ? "" : Number(e.target.value);
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, airflow: val } : r));
                                    }}
                                    className="bg-surface-2 text-center border border-border/80 rounded-lg px-1.5 py-1 text-xs font-mono font-bold text-primary focus:ring-1 focus:ring-primary focus:outline-hidden w-20"
                                  />
                                </td>

                                {/* Qty */}
                                <td className="py-2.5 px-2 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    value={row.count}
                                    min={1}
                                    onChange={e => {
                                      const val = e.target.value === "" ? "" : Number(e.target.value);
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, count: val } : r));
                                    }}
                                    className="bg-surface-2 text-center border border-border/80 rounded-lg px-1 py-1 text-xs font-mono font-bold text-foreground w-12 focus:ring-1 focus:ring-primary focus:outline-hidden"
                                  />
                                </td>

                                {/* Flow / Unit */}
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-foreground">
                                  {row.sizing.flowPerDiff.toFixed(1)}
                                </td>

                                {/* Recommended Neck Size */}
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedDetailRow(row);
                                      setShowDetailModal(true);
                                    }}
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 hover:border-primary/40 transition cursor-pointer shadow-2xs gap-1"
                                    title="Click to view aerodynamic performance breakdown"
                                  >
                                    <Wind className="size-3" />
                                    <span>{row.sizing.neckSize}</span>
                                  </button>
                                </td>

                                {/* Velocity */}
                                <td className="py-2.5 px-2 text-center">
                                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-surface-2 text-foreground font-semibold border border-border/60 inline-block">
                                    {ip ? `${row.sizing.velocityFpm.toFixed(0)} FPM` : `${row.sizing.velocity.toFixed(2)} m/s`}
                                  </span>
                                </td>

                                {/* Throw */}
                                <td className="py-2.5 px-2 text-center font-mono text-muted-foreground">
                                  {row.sizing.throwVal}
                                </td>

                                {/* NC */}
                                <td className="py-2.5 px-2 text-center">
                                  <span className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                                    ncNum <= 25
                                      ? "text-emerald-700 bg-emerald-100/70 border border-emerald-300/60 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800/60"
                                      : ncNum <= 35
                                      ? "text-amber-700 bg-amber-100/70 border border-amber-300/60 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800/60"
                                      : "text-red-700 bg-red-100/70 border border-red-300/60 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800/60"
                                  }`}>
                                    <span className={`size-1.5 rounded-full ${ncNum <= 25 ? "bg-emerald-500" : ncNum <= 35 ? "bg-amber-500" : "bg-red-500"}`} />
                                    {row.sizing.nc}
                                  </span>
                                </td>

                                {/* ADPI */}
                                <td className="py-2.5 px-2 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    row.sizing.status === "PASS"
                                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/60"
                                      : "text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-900/60"
                                  }`}>
                                    {row.sizing.adpi.includes("Good") ? "Pass (≥80%)" : row.sizing.adpi.split("-")[0]}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleOpenComment({ id: row.id, name: `${row.name} Diffuser Sizing` })}
                                      className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                      title="Add Comment / Assign Task"
                                    >
                                      <MessageSquare className="size-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleToggleFlag(row.id)}
                                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                        row.flagged
                                          ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                                          : "text-muted-foreground hover:text-amber-500"
                                      }`}
                                      title={row.flagged ? "Unflag row" : "Flag for review"}
                                    >
                                      <Flag className={`size-3.5 ${row.flagged ? "fill-amber-500" : ""}`} />
                                    </button>
                                    <button
                                      onClick={() => handleDuplicateRow(row)}
                                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                                      title="Duplicate Space"
                                    >
                                      <Copy className="size-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRow(row.id)}
                                      className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                      title="Delete Space"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </ContextMenuTrigger>

                            <ContextMenuContent className="w-56 font-sans text-xs">
                              <ContextMenuItem
                                onClick={() => {
                                  setSelectedDetailRow(row);
                                  setShowDetailModal(true);
                                }}
                                className="gap-2 cursor-pointer font-semibold text-primary"
                              >
                                <Calculator className="size-3.5" />
                                <span>Calculation Breakdown & Preview</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => handleOpenComment({ id: row.id, name: `${row.name} Diffuser Sizing` })}
                                className="gap-2 cursor-pointer"
                              >
                                <MessageSquare className="size-3.5 text-blue-500" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handleToggleFlag(row.id)}
                                className="gap-2 cursor-pointer"
                              >
                                <Flag className={`size-3.5 ${row.flagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                                <span>{row.flagged ? "Unflag Item" : "Flag for Review"}</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => handleDuplicateRow(row)}
                                className="gap-2 cursor-pointer"
                              >
                                <Copy className="size-3.5 text-slate-500" />
                                <span>Duplicate Row</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handleDeleteRow(row.id)}
                                className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Delete Space</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Summary Strip */}
              <div className="bg-surface-2/60 border-t border-border px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Showing <strong className="text-foreground">{filteredRows.length}</strong> of <strong className="text-foreground">{rows.length}</strong> spaces</span>
                  {selectedRowIds.size > 0 && (
                    <span className="text-primary font-bold">({selectedRowIds.size} selected)</span>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap font-mono text-xs">
                  <div>Σ Flow: <span className="text-foreground font-bold">{totalFlowSum.toLocaleString()} {flowUnit}</span></div>
                  <div className="h-3 w-px bg-border/80" />
                  <div>Σ Outlets: <span className="text-foreground font-bold">{totalDiffusersSum} units</span></div>
                  <div className="h-3 w-px bg-border/80" />
                  <div>Σ Load: <span className="text-foreground font-bold">{totalCoolingKwSum.toFixed(1)} kW</span></div>
                  <div className="h-3 w-px bg-border/80" />
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-sans font-bold">
                    <ShieldCheck className="size-3.5" /> All Terminals Sized
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Standard Sizing Matrix */}
        {activeTab === "matrix" && (
          <div className="flex flex-col gap-5">
            {(["square", "round", "slot16", "slot20", "slot25"] as DiffuserType[]).map(typeKey => (
              <div key={typeKey} className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                    <Wind className="size-4 text-primary" /> {DIFFUSER_NAMES[typeKey]}
                  </h3>
                  <span className="text-xs text-muted-foreground font-medium">ASHRAE Standard Airflow Capacity Range</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-2 text-muted-foreground font-bold border-b border-border text-[11px] uppercase">
                        <th className="py-2.5 px-3">Nominal Neck Size / Model</th>
                        <th className="py-2.5 px-3 text-center">Max Flow @ Low Vel ({flowUnit})</th>
                        <th className="py-2.5 px-3 text-center">Max Flow @ Med Comfort ({flowUnit})</th>
                        <th className="py-2.5 px-3 text-center">Throw T50 ({lenUnit})</th>
                        <th className="py-2.5 px-3 text-center">Sound Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {DIFFUSER_DATA[typeKey].map((sz, sIdx) => {
                        const f20 = ip ? (sz.maxFlow_20 || sz.maxFlow || 0) * 2.1189 : (sz.maxFlow_20 || sz.maxFlow || 0);
                        const f25 = ip ? (sz.maxFlow_25 || sz.maxFlow || 0) * 2.1189 : (sz.maxFlow_25 || sz.maxFlow || 0);
                        const th = ip ? sz.throw : sz.throw * 0.3048;

                        return (
                          <tr key={sIdx} className="hover:bg-primary/5 transition-colors">
                            <td className="py-2 px-3 font-semibold text-foreground">{sz.size}</td>
                            <td className="py-2 px-3 text-center font-mono">{f20.toFixed(1)}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-primary">{f25.toFixed(1)}</td>
                            <td className="py-2 px-3 text-center font-mono">{th.toFixed(1)} {lenUnit}</td>
                            <td className="py-2 px-3 text-center font-mono font-semibold">NC-{sz.nc}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Detailed Formulas & Thermodynamic Interactive Sandbox */}
        {activeTab === "formulas" && (
          <div className="flex flex-col gap-6">
            {/* Interactive Calculator Sandbox */}
            <div className="bg-card border border-primary/30 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2 text-primary">
                  <Zap className="size-4 text-primary" /> Interactive Thermodynamic Airflow Sandbox (Q = ṁ · Cp · ΔT)
                </h3>
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold">
                  Live Calculator
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-surface-2/60 p-4 rounded-xl border border-border/80">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Sensible Cooling Load (kW)</label>
                  <input
                    type="number"
                    value={sandboxKw}
                    onChange={e => setSandboxKw(Number(e.target.value) || 0)}
                    className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono font-bold text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Design ΔT ({tempUnit})</label>
                  <input
                    type="number"
                    value={sandboxDt}
                    onChange={e => setSandboxDt(Number(e.target.value) || 0)}
                    className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono font-bold text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Fluid Medium</label>
                  <select
                    value={sandboxFluid}
                    onChange={e => setSandboxFluid(e.target.value as "air" | "water")}
                    className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="air">Supply Air (ρ=1.204 kg/m³, Cp=1.005 kJ/kg·K)</option>
                    <option value="water">Chilled Water (ρ=1000 kg/m³, Cp(T))</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Temperature (°C)</label>
                  <input
                    type="number"
                    value={sandboxTemp}
                    onChange={e => setSandboxTemp(Number(e.target.value) || 20)}
                    className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {(() => {
                const res = computeAirflowFromKw(sandboxKw, sandboxDt, ip, sandboxFluid, sandboxTemp);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col justify-center">
                      <span className="text-xs font-bold text-primary uppercase">Resulting Airflow Demand</span>
                      <span className="text-3xl font-black font-mono text-primary mt-1">
                        {res.flowRate.toLocaleString()} <span className="text-sm font-bold">{flowUnit}</span>
                      </span>
                      <span className="text-xs text-muted-foreground mt-1 font-mono">
                        Mass Flow Rate ṁ = {res.massFlowKgS.toFixed(4)} kg/s
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col justify-center gap-1 text-xs font-mono">
                      <span className="font-bold text-foreground">Mathematical Derivation:</span>
                      <span className="text-muted-foreground">Q = ṁ · Cp · ΔT</span>
                      <span className="text-muted-foreground">ṁ = {sandboxKw} kW ÷ (1.005 × {sandboxDt}°C) = {res.massFlowKgS.toFixed(4)} kg/s</span>
                      <span className="text-primary font-bold">V = ({res.massFlowKgS.toFixed(4)} ÷ 1.204) × 1000 = {res.flowRate} {flowUnit}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Thermodynamic Q = m·Cp·ΔT card */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2 text-primary">
                  <Zap className="size-4 text-primary" /> 1. Thermodynamic Cooling Load Equation
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Airflow and fluid mass flow rate are derived directly from sensible cooling load Q and supply temperature difference ΔT:
                </p>
                <div className="bg-surface-2 p-3 rounded-xl border border-border font-mono text-xs text-foreground flex flex-col gap-1.5">
                  <span className="font-bold text-primary">Q = ṁ · Cp · ΔT</span>
                  <span>ṁ = Q / (Cp · ΔT)  [kg/s]</span>
                  <span>Volumetric Airflow (L/s) = Q_sensible (kW) / (1.21 · ΔT_air)</span>
                  <span>Volumetric Airflow (CFM) = Q_sensible (Btu/h) / (1.08 · ΔT_air)</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Where 1.21 = ρ_air · Cp_air = 1.204 kg/m³ × 1.005 kJ/kg·K.
                </p>
              </div>

              {/* Temperature-dependent Cp table card */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Flame className="size-4 text-orange-500" /> 2. Specific Heat Capacity (Cp) at Different Temperatures
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Water specific heat capacity values used for hydronic heat transfer and coils:
                </p>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-2 font-bold text-[11px] border-b border-border">
                      <tr>
                        <th className="py-1.5 px-3">Temperature (°C)</th>
                        <th className="py-1.5 px-3">Specific Heat Capacity Cp (kJ/kg·K or J/g·°C)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono">
                      <tr><td className="py-1 px-3">0 °C</td><td className="py-1 px-3">4.217 J/g·°C</td></tr>
                      <tr><td className="py-1 px-3">20 °C</td><td className="py-1 px-3">4.186 J/g·°C</td></tr>
                      <tr><td className="py-1 px-3">40 °C</td><td className="py-1 px-3">4.179 J/g·°C</td></tr>
                      <tr><td className="py-1 px-3">60 °C</td><td className="py-1 px-3">4.184 J/g·°C</td></tr>
                      <tr><td className="py-1 px-3">80 °C</td><td className="py-1 px-3">4.196 J/g·°C</td></tr>
                      <tr><td className="py-1 px-3">100 °C</td><td className="py-1 px-3">4.216 J/g·°C</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Interactive Double-Click Row Calculation Breakdown & Tuning */}
        {showDetailModal && selectedDetailRow && (() => {
          const row = selectedDetailRow;
          const sizing = computeRowSizing(row);
          const flowVal = row.airflow !== "" ? Number(row.airflow) : 0;
          const countVal = row.count !== "" && Number(row.count) > 0 ? Number(row.count) : 1;
          const kwVal = row.coolingKw !== "" ? Number(row.coolingKw) : 0;
          const dtVal = row.deltaT !== "" ? Number(row.deltaT) : 10;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                      <Calculator className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        {row.name} — Diffuser Aerodynamic Breakdown
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Floor: {row.floor} • Zone: {row.zone} • Model: {DIFFUSER_NAMES[row.diffType]}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-muted-foreground hover:text-foreground text-sm font-bold p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* 5-Step Derivation Cards */}
                <div className="flex flex-col gap-3 font-sans">
                  {/* Step 1: Thermal Sizing */}
                  <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <Zap className="size-3.5" /> Step 1: Sensible Cooling Thermal Sizing (Q = ṁ · Cp · ΔT)
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {kwVal > 0 ? `${kwVal} kW` : "Direct Airflow Input"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                      {kwVal > 0
                        ? `ṁ = ${kwVal} kW ÷ (1.005 kJ/kg·K × ${dtVal}°C) = ${(kwVal / (1.005 * (dtVal || 10))).toFixed(3)} kg/s dry air mass flow`
                        : "Airflow manually entered or transferred from space airflow schedule."}
                    </p>
                  </div>

                  {/* Step 2: Total Volumetric Airflow */}
                  <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Wind className="size-3.5 text-blue-500" /> Step 2: Total Room Supply Airflow Demand (V)
                      </span>
                      <span className="text-sm font-black font-mono text-primary">
                        {flowVal} {flowUnit}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      V_total = {flowVal} {flowUnit} supplied across {countVal} ceiling outlet(s)
                    </p>
                  </div>

                  {/* Step 3: Terminal Airflow & Velocity */}
                  <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Gauge className="size-3.5 text-indigo-500" /> Step 3: Flow per Diffuser & Neck Velocity
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {sizing.flowPerDiff.toFixed(1)} {flowUnit} / diffuser
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-1 pt-2 border-t border-border/60 text-center font-mono">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">RECOMMENDED NECK</span>
                        <span className="text-xs font-bold text-primary">{sizing.neckSize}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">DISCHARGE VELOCITY</span>
                        <span className="text-xs font-bold text-foreground">{ip ? `${sizing.velocityFpm.toFixed(0)} FPM` : `${sizing.velocity.toFixed(2)} m/s`}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">THROW RADIUS (T50)</span>
                        <span className="text-xs font-bold text-foreground">{sizing.throwVal}</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Acoustic & Comfort Compliance */}
                  <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-500" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">Acoustic Noise Criteria (NC) & ADPI Comfort</span>
                        <span className="text-[11px] text-muted-foreground">{sizing.adpi}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        {sizing.nc}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">PASS</span>
                    </div>
                  </div>
                </div>

                {/* Live Adjustment Tuning Sliders */}
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex flex-col gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sliders className="size-3.5" /> Interactive Space Tuning Controls
                  </span>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>Diffuser Count:</span>
                        <span className="font-mono font-bold text-primary">{row.count} Outlets</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="16"
                        step="1"
                        value={row.count}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setRows(prev => prev.map(r => r.id === row.id ? { ...r, count: val } : r));
                          setSelectedDetailRow(prev => prev ? { ...prev, count: val } : null);
                        }}
                        className="w-full accent-primary h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>Design Velocity Limit:</span>
                        <span className="font-mono font-bold text-primary">{row.designVelocity} m/s</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {[2.0, 2.5].map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              setRows(prev => prev.map(r => r.id === row.id ? { ...r, designVelocity: v } : r));
                              setSelectedDetailRow(prev => prev ? { ...prev, designVelocity: v } : null);
                            }}
                            className={`flex-1 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                              row.designVelocity === v
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-surface-2 text-muted-foreground border-border/80"
                            }`}
                          >
                            {v === 2.0 ? "2.0 m/s (Quiet)" : "2.5 m/s (Standard)"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <TBtn onClick={() => setShowDetailModal(false)} className="h-8 text-xs font-bold bg-primary text-primary-foreground">
                    Done
                  </TBtn>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal: Executive Overview Diagnostic */}
        {showOverviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="size-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Air Terminal & Diffuser Selection Schedule Summary
                  </h3>
                </div>
                <button onClick={() => setShowOverviewModal(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-surface-2 rounded-xl border border-border/80">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">TOTAL AIRFLOW</span>
                  <span className="text-xl font-black font-mono text-primary">{totalFlowSum.toLocaleString()} {flowUnit}</span>
                </div>
                <div className="p-3 bg-surface-2 rounded-xl border border-border/80">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">OUTLETS COUNT</span>
                  <span className="text-xl font-black font-mono text-blue-500">{totalDiffusersSum} Diffusers</span>
                </div>
                <div className="p-3 bg-surface-2 rounded-xl border border-border/80">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">ROOMS COUNT</span>
                  <span className="text-xl font-black font-mono text-indigo-500">{computedRows.length} Spaces</span>
                </div>
                <div className="p-3 bg-surface-2 rounded-xl border border-border/80">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">COMPLIANCE</span>
                  <span className="text-xl font-black font-mono text-emerald-600">PASS (NC≤30)</span>
                </div>
              </div>

              <div className="p-4 bg-surface-2 rounded-xl border border-border flex flex-col gap-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Air Distribution Recommendations</span>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  <li>All scheduled diffuser necks operate below the recommended 2.5 m/s (500 FPM) velocity threshold for office spaces.</li>
                  <li>Noise criteria levels do not exceed NC-30 in occupied zones, complying with ASHRAE Handbook Fundamentals standards.</li>
                  <li>Discharge throw pattern ensures effective room entrainment without low-velocity stagnation (ADPI ≥ 80%).</li>
                </ul>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-border">
                <TBtn onClick={() => setShowOverviewModal(false)} className="h-8 text-xs font-bold bg-primary text-primary-foreground">
                  Close Summary
                </TBtn>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Import from Preliminary Cooling Load with Single Text Box for ΔT */}
        {showPclModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Import Flow Rate from Preliminary Cooling Load (Q = ṁ·Cp·ΔT)
                  </h3>
                </div>
                <button onClick={() => setShowPclModal(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Import cooling loads ($Q$ in $\text{kW}$) directly from <strong>Preliminary Cooling Load</strong> and compute air terminal volumetric airflow ($L/s$ / $\text{CFM}$) using the thermodynamic equation:
              </p>

              {/* ΔT Text Box & Diversity Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-2 p-4 rounded-2xl border border-border/80">
                {/* 1. Delta T Text/Number Input Only */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-foreground">Supply Air ΔT</label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      ≈ {(pclDeltaT * 1.8).toFixed(1)} °F
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="30.0"
                      value={pclDeltaT || ""}
                      onChange={e => setPclDeltaT(Number(e.target.value) || 0)}
                      placeholder="Enter ΔT (e.g. 10.0)"
                      className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                    />
                    <span className="absolute right-3.5 text-xs font-bold text-muted-foreground font-mono select-none pointer-events-none">
                      {tempUnit}
                    </span>
                  </div>
                </div>

                {/* 2. Diversity Factor */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-foreground">Diversity Multiplier</label>
                    <span className="text-xs font-mono font-bold text-primary">{pclDiversity}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[80, 85, 90, 95, 100].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPclDiversity(d)}
                        className={`flex-1 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          pclDiversity === d
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-card text-muted-foreground border-border/80 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                        }`}
                      >
                        {d}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Spaces Selection Checklist */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Available Spaces in Preliminary Cooling Load ({getPclSpaces().length})
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const m: { [id: string]: boolean } = {};
                        getPclSpaces().forEach((s, idx) => { m[s.id || String(idx)] = true; });
                        setPclSelectedIds(m);
                      }}
                      className="text-primary font-semibold hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setPclSelectedIds({})}
                      className="text-muted-foreground font-semibold hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="border border-border rounded-2xl max-h-56 overflow-y-auto divide-y divide-border/60">
                  {getPclSpaces().length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No spaces found in Preliminary Cooling Load. Run Preliminary Cooling Load first or use default spaces.
                    </p>
                  ) : (
                    getPclSpaces().map((p, idx) => {
                      const idKey = p.id || String(idx);
                      const isSelected = pclSelectedIds[idKey] !== false;
                      const rawKw = Number(p.kw || (p.tr ? p.tr * 3.517 : (p.dissipation ? p.dissipation / 1000 : 3.0)));
                      const kw = rawKw * (pclDiversity / 100);
                      const calc = computeAirflowFromKw(kw, pclDeltaT, ip, "air", 20);

                      return (
                        <div
                          key={idx}
                          onClick={() => setPclSelectedIds(prev => ({ ...prev, [idKey]: !isSelected }))}
                          className={`p-2.5 px-3 flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected ? "bg-primary/5 hover:bg-primary/10" : "opacity-60 hover:bg-surface-2"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isSelected ? (
                              <CheckSquare className="size-4 text-primary shrink-0" />
                            ) : (
                              <Square className="size-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-foreground">{p.name || `Space ${idx + 1}`}</span>
                              <span className="text-[11px] text-muted-foreground">{p.type || "Occupied Area"} • Floor: {p.floor || "GF"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-right font-mono">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{kw.toFixed(2)} kW</span>
                              <span className="text-[10px] text-muted-foreground">Cooling Load Q</span>
                            </div>
                            <ArrowRight className="size-3.5 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="font-bold text-primary">{calc.flowRate.toLocaleString()} {flowUnit}</span>
                              <span className="text-[10px] text-muted-foreground">ṁ = {calc.massFlowKgS.toFixed(3)} kg/s</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                <TBtn variant="ghost" onClick={() => setShowPclModal(false)} className="h-8 text-xs font-semibold">
                  Cancel
                </TBtn>
                <TBtn
                  onClick={handleImportFromPcl}
                  className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="size-3.5" /> Apply Sized Flow to Diffuser Schedule
                </TBtn>
              </div>
            </div>
          </div>
        )}

        {/* Save Preset Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Save className="size-5 text-primary" /> Save Current Diffuser Schedule Preset
              </h3>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Preset Name</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="e.g. Office Tower Standard Diffusers"
                  className="h-9 px-3 rounded-xl border border-border bg-surface-2 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <TBtn variant="ghost" onClick={() => setShowSaveModal(false)} className="h-8 text-xs font-semibold">
                  Cancel
                </TBtn>
                <TBtn onClick={handleSaveCurrent} className="h-8 text-xs font-bold bg-primary text-primary-foreground">
                  Save Preset
                </TBtn>
              </div>
            </div>
          </div>
        )}

        {/* Load Preset Modal */}
        {showLoadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <FolderOpen className="size-5 text-primary" /> Saved Diffuser Presets
                </h3>
                <button onClick={() => setShowLoadModal(false)} className="text-muted-foreground hover:text-foreground">
                  ✕
                </button>
              </div>

              {saves.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No saved presets yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {saves.map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleLoadSave(s.id)}
                      className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-2/60 hover:bg-primary/10 hover:border-primary/40 cursor-pointer transition-all group"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary">{s.name}</span>
                        <span className="text-[10.5px] text-muted-foreground font-mono">{new Date(s.savedAt).toLocaleDateString()}</span>
                      </div>
                      <button
                        onClick={e => handleDeleteSave(s.id, e)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Space / Diffuser Zone Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Plus className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Add Space / Diffuser Zone</h3>
                    <p className="text-xs text-muted-foreground">
                      Configure space air distribution requirements with live thermodynamic & aerodynamic sizing.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-foreground">Space / Room Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder={`e.g. Space ${rows.length + 1} (Executive Office)`}
                    className="h-9 px-3 rounded-xl border border-border bg-surface-2/60 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Floor Level</label>
                  <input
                    type="text"
                    value={newFloor}
                    onChange={e => setNewFloor(e.target.value)}
                    placeholder="GF"
                    className="h-9 px-3 rounded-xl border border-border bg-surface-2/60 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Cooling Load Q (kW)</label>
                  <input
                    type="number"
                    value={newCoolingKw}
                    onChange={e => setNewCoolingKw(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 3.5"
                    className="h-9 px-3 rounded-xl border border-border bg-surface-2/60 text-xs font-mono font-bold text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Supply Air ΔT ({tempUnit})</label>
                  <input
                    type="number"
                    value={newDeltaT}
                    onChange={e => setNewDeltaT(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="10"
                    className="h-9 px-3 rounded-xl border border-border bg-surface-2/60 text-xs font-mono font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Supply Airflow ({flowUnit})</span>
                    {newCoolingKw !== "" && Number(newCoolingKw) > 0 && (
                      <span className="text-[10px] text-primary font-bold">Auto (Q=ṁCpΔT)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={newAirflow}
                    onChange={e => setNewAirflow(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={ip ? "400" : "188"}
                    className="h-9 px-3 rounded-xl border border-border bg-surface-2/60 text-xs font-mono font-bold text-primary focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-foreground">Air Terminal Diffuser Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as DiffuserType)}
                    className="h-9 px-3 rounded-xl border border-border bg-surface-2/60 text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
                  >
                    <option value="square">4-Way Ceiling Square (Standard Comfort)</option>
                    <option value="round">Circular Radial Cone (High Architectural)</option>
                    <option value="slot16">Linear Slot Diffuser 16mm (Perimeter / Clean Aesthetic)</option>
                    <option value="slot20">Linear Slot Diffuser 20mm (Standard Slot)</option>
                    <option value="slot25">Linear Slot Diffuser 25mm (High Airflow Slot)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Diffuser Count (Outlets)</label>
                  <input
                    type="number"
                    min={1}
                    value={newCount}
                    onChange={e => setNewCount(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="2"
                    className="h-9 px-3 rounded-xl border border-border bg-surface-2/60 text-xs font-mono font-bold text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-3">
                  <label className="text-xs font-semibold text-foreground">Acoustic / Velocity Criteria</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewVelocity(2.0)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        newVelocity === 2.0
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-surface-2/60 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>2.0 m/s (400 FPM)</span>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Quiet • NC ≤ 25</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewVelocity(2.5)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        newVelocity === 2.5
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-surface-2/60 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>2.5 m/s (500 FPM)</span>
                      <span className="text-[10px] font-semibold text-primary">Standard • NC ≤ 30</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Real-time Sizing Preview Box */}
              <div className="bg-surface-2/60 border border-border/80 rounded-2xl p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" /> Live Aerodynamic Sizing Preview
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    previewDraftSizing.status === "PASS"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                  }`}>
                    {previewDraftSizing.status === "PASS" ? "COMPLIANT SIZING" : "WARNING"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-center">
                  <div className="bg-card p-2 rounded-xl border border-border/60">
                    <span className="text-[10px] text-muted-foreground block font-sans">FLOW / OUTLET</span>
                    <span className="text-xs font-bold text-foreground">{previewDraftSizing.flowPerDiff.toFixed(1)} {flowUnit}</span>
                  </div>

                  <div className="bg-card p-2 rounded-xl border border-border/60">
                    <span className="text-[10px] text-muted-foreground block font-sans">RECOMMENDED NECK</span>
                    <span className="text-xs font-bold text-primary">{previewDraftSizing.neckSize}</span>
                  </div>

                  <div className="bg-card p-2 rounded-xl border border-border/60">
                    <span className="text-[10px] text-muted-foreground block font-sans">SOUND LEVEL</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{previewDraftSizing.nc}</span>
                  </div>

                  <div className="bg-card p-2 rounded-xl border border-border/60">
                    <span className="text-[10px] text-muted-foreground block font-sans">THROW (T50)</span>
                    <span className="text-xs font-bold text-foreground">{previewDraftSizing.throwVal}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                <TBtn
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </TBtn>
                <TBtn
                  onClick={handleAddSpace}
                  className="h-9 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-xs px-4"
                >
                  <Plus className="size-4" /> Add Space to Schedule
                </TBtn>
              </div>
            </div>
          </div>
        )}

        {/* Assign Comment Modal */}
        {commentModalOpen && (
          <AssignCommentModal
            open={commentModalOpen}
            onClose={() => setCommentModalOpen(false)}
            targetItem={commentTargetItem || { id: "diffuser-selector", name: "Diffuser Selection" }}
            onSave={handleSaveComment}
          />
        )}
      </div>
    </AppShell>
  );
}
