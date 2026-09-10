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
  SlidersHorizontal, Check, RefreshCw, Zap, Calculator, Flame, ArrowRight
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
    { size: "Ø363 mm (Ø14\")", maxFlow_20: 104, maxFlow_25: 130, throw: 12, nc: 24 },
    { size: "Ø419 mm (Ø16\")", maxFlow_20: 149, maxFlow_25: 186, throw: 14, nc: 26 },
    { size: "Ø478 mm (Ø19\")", maxFlow_20: 203, maxFlow_25: 252, throw: 16, nc: 28 },
    { size: "Ø534 mm (Ø21\")", maxFlow_20: 264, maxFlow_25: 330, throw: 18, nc: 30 },
    { size: "Ø598 mm (Ø24\")", maxFlow_20: 335, maxFlow_25: 418, throw: 20, nc: 32 },
    { size: "Ø653 mm (Ø26\")", maxFlow_20: 401, maxFlow_25: 519, throw: 22, nc: 34 },
    { size: "Ø704 mm (Ø28\")", maxFlow_20: 479, maxFlow_25: 625, throw: 24, nc: 36 },
    { size: "Ø756 mm (Ø30\")", maxFlow_20: 590, maxFlow_25: 741, throw: 26, nc: 38 }
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
    // Air properties: rho = 1.204 kg/m³, Cp = 1.005 kJ/kg·K
    // Q (kW) = m_dot (kg/s) * 1.005 * Delta_T (°C)
    // m_dot = Q / (1.005 * Delta_T)
    // Flow (L/s) = (m_dot / 1.204) * 1000 = Q / (1.21 * Delta_T)
    const dtMetric = isIP ? deltaT / 1.8 : deltaT;
    const mDot = coolingKw / (1.005 * dtMetric);
    const flowLps = (mDot / 1.204) * 1000;
    const flowFinal = isIP ? flowLps * 2.1189 : flowLps;
    return { massFlowKgS: mDot, flowRate: Math.round(flowFinal * 10) / 10 };
  } else {
    // Water / Hydronic: Q (kW) = m_dot * Cp_water * Delta_T
    const dtMetric = isIP ? deltaT / 1.8 : deltaT;
    const cp = getCpWater(tempC);
    const mDot = coolingKw / (cp * dtMetric); // kg/s
    const flowLps = mDot; // since water density is ~1 kg/L
    const flowFinal = isIP ? flowLps * 15.8503 : flowLps;
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

  // Thermodynamic Calculation Modal State
  const [showPclModal, setShowPclModal] = useState<boolean>(false);
  const [calcFluidType, setCalcFluidType] = useState<"air" | "water">("air");
  const [calcDeltaT, setCalcDeltaT] = useState<number>(10);
  const [calcWaterTemp, setCalcWaterTemp] = useState<number>(20);

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
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      // Convert flow values
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
          isExceeded: true
        };
      }
      selected = options[options.length - 1];
    }

    const velocityFpm = row.designVelocity * 196.85;
    let adpi = "Good Selection";
    if (velocityFpm > 600) adpi = "High velocity - draft risk";
    else if (velocityFpm < 300) adpi = "Low velocity";

    const throwDisplay = ip ? `${selected.throw.toFixed(1)} ft` : `${(selected.throw * 0.3048).toFixed(1)} m`;

    return {
      flowPerDiff: flowPerDiffDisplay,
      neckSize: selected.size,
      velocity: row.designVelocity,
      velocityFpm,
      throwVal: throwDisplay,
      nc: `NC-${selected.nc}`,
      adpi,
      isExceeded: false
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
      designVelocity: newVelocity
    };

    setRows(prev => [...prev, newRow]);
    setNewName("");
    setNewCoolingKw("");
    setNewAirflow("");
    toast.success(`Added "${name}" with Q=m·Cp·ΔT airflow computation`);
  };

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

  // Import from Preliminary Cooling Load with Q = m·Cp·ΔT
  const handleImportFromPcl = () => {
    const pclSpaces = getPclSpaces();

    if (!pclSpaces || pclSpaces.length === 0) {
      toast.info("No calculated spaces found in Preliminary Cooling Load. Sizing using space area baseline instead.");
      handleImportWorkspaceSpaces();
      return;
    }

    const imported: DiffuserRowItem[] = pclSpaces.map((p, idx) => {
      const kw = Number(p.kw || (p.tr ? p.tr * 3.517 : (p.dissipation ? p.dissipation / 1000 : 3.0)));
      const dt = calcDeltaT > 0 ? calcDeltaT : 10;
      const computed = computeAirflowFromKw(kw, dt, ip, calcFluidType, calcWaterTemp);
      const area = Number(p.area || 20);
      const count = Math.max(1, Math.ceil(area / 25));

      return {
        id: "pcl-space-" + (p.id || idx) + "-" + Date.now(),
        name: p.name || `Space ${idx + 1}`,
        floor: p.floor || "GF",
        zone: "AHU-Zone",
        coolingKw: Number(kw.toFixed(2)),
        deltaT: dt,
        airflow: computed.flowRate,
        count,
        diffType: "square",
        designVelocity: 2.0
      };
    });

    setRows(prev => [...prev, ...imported]);
    setShowPclModal(false);
    toast.success(`Imported ${imported.length} spaces from Preliminary Cooling Load using Q=m·Cp·ΔT`);
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
      const estKw = Number((area * mult * 0.12).toFixed(2)); // ~120 W/m² standard cooling density
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
        designVelocity: 2.0
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

      // Total row
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
      return matchSearch && matchType;
    });
  }, [computedRows, searchQuery, typeFilter]);

  return (
    <AppShell>
      <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full pb-24">
        {/* Header Breadcrumb & Review Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>HVAC</span>
              <span>&gt;</span>
              <span>AIR DISTRIBUTION</span>
              <span>&gt;</span>
              <span className="text-primary font-bold">DIFFUSER SELECTION SCHEDULE</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Wind className="size-6 text-primary" /> Diffuser Quick Selector & Sizing Schedule
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <UnitToggle
              unitSystem={unitSystem}
              onChange={handleUnitSystemChange}
              inputDescriptions="Supply Airflow per space"
              conversionExample={unitSystem === "si" ? "Convert 500 L/s → 1,059 CFM" : "Convert 1000 CFM → 472 L/s"}
            />

            <CalculationReviewBar
              calculatorTitle="Diffuser Selection Schedule"
              calculatorPath="/diffuser-selector"
              commentsCount={commentsList.length}
            />

            {/* Presets Manager */}
            <div className="flex items-center gap-1 bg-surface-2/60 border border-border/80 rounded-xl p-1">
              <TBtn
                onClick={() => setShowSaveModal(true)}
                className="h-8 text-xs font-semibold px-2.5 flex items-center gap-1.5"
                variant="ghost"
              >
                <Save className="size-3.5" /> Save
              </TBtn>
              <TBtn
                onClick={() => setShowLoadModal(true)}
                className="h-8 text-xs font-semibold px-2.5 flex items-center gap-1.5"
                variant="ghost"
              >
                <FolderOpen className="size-3.5" /> Presets ({saves.length})
              </TBtn>
            </div>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col gap-1.5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Supply Airflow</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">{totalFlowSum.toLocaleString()}</span>
              <span className="text-xs font-bold text-muted-foreground">{flowUnit}</span>
            </div>
            <span className="text-[11px] text-muted-foreground/80">Sum from Q = m·Cp·ΔT sizing</span>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col gap-1.5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Outlets Count</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">{totalDiffusersSum}</span>
              <span className="text-xs font-bold text-muted-foreground">Diffusers</span>
            </div>
            <span className="text-[11px] text-muted-foreground/80">Total air terminals required</span>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col gap-1.5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scheduled Spaces</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">{computedRows.length}</span>
              <span className="text-xs font-bold text-muted-foreground">Rooms</span>
            </div>
            <span className="text-[11px] text-muted-foreground/80">
              {totalCoolingKwSum > 0 ? `${totalCoolingKwSum.toFixed(1)} kW Total Cooling` : "Independent air zones"}
            </span>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col gap-1.5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acoustic & Comfort</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">NC ≤ 30</span>
              <span className="text-xs font-bold text-emerald-600">PASS</span>
            </div>
            <span className="text-[11px] text-emerald-600/80">ASHRAE draft & sound compliant</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-border/60">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "schedule"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="size-4" /> Diffuser Selection Schedule ({computedRows.length})
          </button>
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "matrix"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gauge className="size-4" /> Standard Sizing Lookup Matrix
          </button>
          <button
            onClick={() => setActiveTab("formulas")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "formulas"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-4" /> Σ Q = m·Cp·ΔT Formulas & Cp(T) Lookup
          </button>
        </div>

        {/* Tab 1: Diffuser Schedule */}
        {activeTab === "schedule" && (
          <div className="flex flex-col gap-4">
            {/* Quick Add Space Form Card with Q=m·Cp·ΔT */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Plus className="size-4 text-primary" /> Quick Add Space / Diffuser Zone (with Q = m·Cp·ΔT)
                </span>
                <div className="flex items-center gap-2">
                  <TBtn
                    onClick={() => setShowPclModal(true)}
                    variant="outline"
                    className="h-7 text-xs font-bold px-2.5 flex items-center gap-1.5 bg-primary/10 border-primary text-primary hover:bg-primary/20 shadow-xs"
                  >
                    <Zap className="size-3.5 fill-primary" /> Import from Preliminary Cooling Load
                  </TBtn>
                  <TBtn
                    onClick={handleImportWorkspaceSpaces}
                    variant="outline"
                    className="h-7 text-xs font-semibold px-2.5 flex items-center gap-1.5 border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
                  >
                    <RefreshCw className="size-3" /> Import Project Spaces
                  </TBtn>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-[11px] font-semibold text-muted-foreground">Space / Room Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Meeting Room 201"
                    className="h-8 px-2.5 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Floor</label>
                  <input
                    type="text"
                    value={newFloor}
                    onChange={e => setNewFloor(e.target.value)}
                    placeholder="GF"
                    className="h-8 px-2.5 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Cooling Load Q (kW)</label>
                  <input
                    type="number"
                    value={newCoolingKw}
                    onChange={e => setNewCoolingKw(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 3.5"
                    className="h-8 px-2.5 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">ΔT ({tempUnit})</label>
                  <input
                    type="number"
                    value={newDeltaT}
                    onChange={e => setNewDeltaT(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="10"
                    className="h-8 px-2.5 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Airflow ({flowUnit})</label>
                  <input
                    type="number"
                    value={newAirflow}
                    onChange={e => setNewAirflow(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={ip ? "400" : "188"}
                    className="h-8 px-2.5 rounded-lg border border-border bg-surface-2 text-xs font-mono font-bold text-primary focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Diffuser Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as DiffuserType)}
                    className="h-8 px-2 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  >
                    <option value="square">4-Way Square</option>
                    <option value="round">Round Cone</option>
                    <option value="slot16">Slot 16mm</option>
                    <option value="slot20">Slot 20mm</option>
                    <option value="slot25">Slot 25mm</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <TBtn
                    onClick={handleAddSpace}
                    className="h-8 w-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="size-3.5" /> Add Space
                  </TBtn>
                </div>
              </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-2/40 border border-border/60 rounded-xl p-2.5">
              <div className="flex items-center gap-2.5 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search spaces by name, floor, or zone..."
                    className="h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs font-medium w-full text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-hidden"
                >
                  <option value="all">All Diffuser Types</option>
                  <option value="square">4-Way Square</option>
                  <option value="round">Round Cone</option>
                  <option value="slot16">Slot 16mm</option>
                  <option value="slot20">Slot 20mm</option>
                  <option value="slot25">Slot 25mm</option>
                </select>

                <TBtn
                  onClick={handleClearAll}
                  variant="ghost"
                  className="h-8 text-xs font-semibold text-destructive hover:bg-destructive/10 px-2.5"
                >
                  <Trash2 className="size-3.5 mr-1" /> Clear All
                </TBtn>
              </div>
            </div>

            {/* Schedule Data Grid Table */}
            <div className="border border-border rounded-2xl overflow-hidden shadow-xs bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="py-3 px-3 text-center w-12">Sr.</th>
                      <th className="py-3 px-3 min-w-[150px]">Space / Room Name</th>
                      <th className="py-3 px-3 text-center w-14">Floor</th>
                      <th className="py-3 px-3 text-center w-24">Cooling Q (kW)</th>
                      <th className="py-3 px-3 text-center w-20">ΔT ({tempUnit})</th>
                      <th className="py-3 px-3 min-w-[130px]">Terminal Type</th>
                      <th className="py-3 px-3 text-center w-24">Total Flow ({flowUnit})</th>
                      <th className="py-3 px-3 text-center w-16">Qty</th>
                      <th className="py-3 px-3 text-center w-24">Flow/Diff ({flowUnit})</th>
                      <th className="py-3 px-3 text-center min-w-[140px]">Recommended Neck</th>
                      <th className="py-3 px-3 text-center w-20">Vel ({velUnit})</th>
                      <th className="py-3 px-3 text-center w-20">Throw ({lenUnit})</th>
                      <th className="py-3 px-3 text-center w-16">NC</th>
                      <th className="py-3 px-3 text-center w-20">ADPI</th>
                      <th className="py-3 px-3 text-center w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="py-8 text-center text-muted-foreground text-xs">
                          No space entries found. Click <strong>"Import from Preliminary Cooling Load"</strong> or <strong>"Add Space"</strong> to begin sizing.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => {
                        const itemComments = commentsList.filter(c => c.spaceId === row.id || c.targetId === row.id);
                        const hasComments = itemComments.length > 0;

                        return (
                          <ContextMenu key={row.id}>
                            <ContextMenuTrigger asChild>
                              <tr className="hover:bg-primary/5 transition-colors group">
                                <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                                
                                {/* Room Name */}
                                <td className="py-2.5 px-3 font-semibold text-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={row.name}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, name: val } : r));
                                      }}
                                      className="bg-transparent border-0 font-semibold text-foreground w-full focus:outline-hidden hover:bg-surface-2/60 px-1 py-0.5 rounded"
                                    />
                                    {hasComments && (
                                      <span className="size-2 rounded-full bg-primary ring-2 ring-primary/20 shrink-0" title={`${itemComments.length} active comment(s)`} />
                                    )}
                                  </div>
                                </td>

                                {/* Floor */}
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="text"
                                    value={row.floor}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, floor: val } : r));
                                    }}
                                    className="bg-transparent text-center border-0 text-muted-foreground w-10 focus:outline-hidden hover:bg-surface-2/60 rounded"
                                  />
                                </td>

                                {/* Cooling Load Q (kW) */}
                                <td className="py-2.5 px-3 text-center">
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
                                    className="bg-surface-2 text-center border border-border/80 rounded-md px-1.5 py-1 text-xs font-mono font-medium text-foreground w-20 focus:ring-1 focus:ring-primary focus:outline-hidden"
                                  />
                                </td>

                                {/* Delta T */}
                                <td className="py-2.5 px-3 text-center">
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
                                    className="bg-surface-2 text-center border border-border/80 rounded-md px-1 py-1 text-xs font-mono text-muted-foreground w-14 focus:ring-1 focus:ring-primary focus:outline-hidden"
                                  />
                                </td>

                                {/* Terminal Type */}
                                <td className="py-2.5 px-3">
                                  <select
                                    value={row.diffType}
                                    onChange={e => {
                                      const val = e.target.value as DiffuserType;
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, diffType: val } : r));
                                    }}
                                    className="bg-surface-2 border border-border/80 rounded-md px-1.5 py-1 text-xs font-medium text-foreground focus:outline-hidden w-full"
                                  >
                                    <option value="square">Square 4-Way</option>
                                    <option value="round">Round Cone</option>
                                    <option value="slot16">Slot 16mm</option>
                                    <option value="slot20">Slot 20mm</option>
                                    <option value="slot25">Slot 25mm</option>
                                  </select>
                                </td>

                                {/* Total Flow */}
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="number"
                                    value={row.airflow}
                                    onChange={e => {
                                      const val = e.target.value === "" ? "" : Number(e.target.value);
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, airflow: val } : r));
                                    }}
                                    className="bg-surface-2 text-center border border-border/80 rounded-md px-1.5 py-1 text-xs font-mono font-bold text-foreground w-20 focus:ring-1 focus:ring-primary focus:outline-hidden"
                                  />
                                </td>

                                {/* Qty */}
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="number"
                                    value={row.count}
                                    min={1}
                                    onChange={e => {
                                      const val = e.target.value === "" ? "" : Number(e.target.value);
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, count: val } : r));
                                    }}
                                    className="bg-surface-2 text-center border border-border/80 rounded-md px-1 py-1 text-xs font-mono font-bold text-foreground w-12 focus:ring-1 focus:ring-primary focus:outline-hidden"
                                  />
                                </td>

                                {/* Flow / Unit */}
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-foreground">
                                  {row.sizing.flowPerDiff.toFixed(1)}
                                </td>

                                {/* Recommended Neck Size */}
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                    {row.sizing.neckSize}
                                  </span>
                                </td>

                                {/* Velocity */}
                                <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                                  {ip ? row.sizing.velocityFpm.toFixed(0) : row.sizing.velocity.toFixed(2)}
                                </td>

                                {/* Throw */}
                                <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                                  {row.sizing.throwVal}
                                </td>

                                {/* NC */}
                                <td className="py-2.5 px-3 text-center">
                                  <span className="font-mono text-xs font-bold text-foreground">
                                    {row.sizing.nc}
                                  </span>
                                </td>

                                {/* ADPI */}
                                <td className="py-2.5 px-3 text-center">
                                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    {row.sizing.adpi}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleOpenComment({ id: row.id, name: `${row.name} Diffuser Sizing` })}
                                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                      title="Add Comment / Assign Task"
                                    >
                                      <MessageSquare className="size-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDuplicateRow(row)}
                                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                                      title="Duplicate Space"
                                    >
                                      <Copy className="size-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRow(row.id)}
                                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      title="Delete Space"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover/95 backdrop-blur-md border-border shadow-xl rounded-xl">
                              <ContextMenuItem onClick={() => handleOpenComment({ id: row.id, name: `${row.name} Diffuser Sizing` })} className="gap-2 cursor-pointer font-semibold text-primary">
                                <MessageSquare className="size-4 text-primary" /> Add Comment / Assign Task
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => handleDuplicateRow(row)} className="gap-2 cursor-pointer">
                                <Copy className="size-4" /> Duplicate Space Row
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleDeleteRow(row.id)} className="gap-2 cursor-pointer text-destructive">
                                <Trash2 className="size-4" /> Delete Space Row
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })
                    )}
                  </tbody>
                  {computedRows.length > 0 && (
                    <tfoot>
                      <tr className="bg-surface-2/80 font-bold border-t-2 border-border text-foreground">
                        <td colSpan={3} className="py-3 px-3 text-right">
                          Total Scheduled Outlets & Flow:
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-xs font-bold text-foreground">
                          {totalCoolingKwSum > 0 ? `${totalCoolingKwSum.toFixed(1)} kW` : "-"}
                        </td>
                        <td className="py-3 px-3 text-center text-muted-foreground">-</td>
                        <td className="py-3 px-3 text-center text-muted-foreground">-</td>
                        <td className="py-3 px-3 text-center font-mono text-primary text-sm font-black">
                          {totalFlowSum.toLocaleString()} {flowUnit}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-blue-600 text-sm font-black">
                          {totalDiffusersSum}
                        </td>
                        <td colSpan={7} className="py-3 px-3 text-muted-foreground font-normal text-xs">
                          {computedRows.length} spaces sized & verified
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
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

        {/* Tab 3: Detailed Formulas & Thermodynamic Cp Lookup */}
        {activeTab === "formulas" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Thermodynamic Q = m·Cp·ΔT card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 text-primary">
                <Zap className="size-4 text-primary" /> 1. Thermodynamic Cooling Load Equation (Q = ṁ · Cp · ΔT)
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
        )}

        {/* Modal: Import from Preliminary Cooling Load with Q = m·Cp·ΔT */}
        {showPclModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Import Cooling Load & Calculate Flow Rate (Q = ṁ·Cp·ΔT)
                  </h3>
                </div>
                <button onClick={() => setShowPclModal(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Fetch cooling loads ($Q$ in $\text{kW}$) directly from <strong>Preliminary Cooling Load</strong> calculation and auto-compute required airflow ($L/s$ / $\text{CFM}$) using the thermodynamic equation:
              </p>

              {/* Parameter Settings */}
              <div className="grid grid-cols-3 gap-3 bg-surface-2 p-3.5 rounded-xl border border-border/80">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Medium / Fluid</label>
                  <select
                    value={calcFluidType}
                    onChange={e => setCalcFluidType(e.target.value as "air" | "water")}
                    className="h-8 px-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:outline-hidden"
                  >
                    <option value="air">Supply Air (Airflow)</option>
                    <option value="water">Chilled Water (Hydronic)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Design ΔT ({tempUnit})</label>
                  <input
                    type="number"
                    value={calcDeltaT}
                    onChange={e => setCalcDeltaT(Number(e.target.value) || 10)}
                    className="h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-mono font-bold text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Operating Fluid Temp</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={calcWaterTemp}
                      onChange={e => setCalcWaterTemp(Number(e.target.value) || 20)}
                      className="h-8 px-2 rounded-lg border border-border bg-card text-xs font-mono w-16 text-foreground focus:outline-hidden"
                    />
                    <span className="text-[10.5px] text-muted-foreground font-mono">
                      Cp={getCpWater(calcWaterTemp).toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Spaces Preview List */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Available Spaces in Preliminary Cooling Load ({getPclSpaces().length})
                </span>
                <div className="border border-border rounded-xl max-h-56 overflow-y-auto divide-y divide-border/60">
                  {getPclSpaces().length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No spaces found in Preliminary Cooling Load. Run Preliminary Cooling Load first or use default spaces.
                    </p>
                  ) : (
                    getPclSpaces().map((p, idx) => {
                      const kw = Number(p.kw || (p.tr ? p.tr * 3.517 : (p.dissipation ? p.dissipation / 1000 : 3.0)));
                      const calc = computeAirflowFromKw(kw, calcDeltaT, ip, calcFluidType, calcWaterTemp);

                      return (
                        <div key={idx} className="p-2.5 px-3 flex items-center justify-between text-xs hover:bg-surface-2/60">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-foreground">{p.name || `Space ${idx + 1}`}</span>
                            <span className="text-[11px] text-muted-foreground">{p.type || "Occupied Area"} • Floor: {p.floor || "GF"}</span>
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
                  className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
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
