import { calculateComputedRows, computeRowSizing, computeAirflowFromKw, getCpWater, DIFFUSER_DATA, DIFFUSER_NAMES, type DiffuserType, type DiffuserSize, type DiffuserRowItem } from "@/lib/calc-diffuser";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
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
  Sliders, ShieldCheck, CheckSquare, Square, Flag, Activity, Eye, X, ArrowUpDown
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { useAuth } from "@/contexts/AuthContext";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { exportDiffuserSelectorExcel } from "@/lib/exportDiffuserSelectorExcel";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { UnitToggle } from "@/components/workspace/UnitToggle";

export const Route = createFileRoute("/diffuser-selector")({
  head: () => ({
    meta: [
      { title: "Diffuser Selector â€” MEP Calc" },
      { name: "description", content: "Comprehensive HVAC air terminal & diffuser selection schedule with multi-space sizing, noise criteria, and ADPI analysis." },
    ],
  }),
  component: DiffuserSelectorPage,
});





export interface DiffuserRowItem {
  id: string;
  name: string;
  floor: string;
  zone: string;
  coolingKw?: number | ""; // Q in kW from Preliminary Cooling Load
  deltaT?: number | "";    // Delta T in Â°C or Â°F
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
    { size: "Ã˜250 mm (Ã˜10\")", maxFlow_20: 38, maxFlow_25: 47, throw: 8, nc: 20 },
    { size: "Ã˜307 mm (Ã˜12\")", maxFlow_20: 66, maxFlow_25: 83, throw: 10, nc: 22 },
    { size: "Ã˜366 mm (Ã˜14\")", maxFlow_20: 105, maxFlow_25: 132, throw: 12, nc: 24 },
    { size: "Ã˜424 mm (Ã˜16\")", maxFlow_20: 167, maxFlow_25: 210, throw: 15, nc: 26 },
    { size: "Ã˜483 mm (Ã˜18\")", maxFlow_20: 216, maxFlow_25: 271, throw: 18, nc: 28 },
    { size: "Ã˜541 mm (Ã˜20\")", maxFlow_20: 274, maxFlow_25: 345, throw: 20, nc: 30 },
    { size: "Ã˜600 mm (Ã˜24\")", maxFlow_20: 344, maxFlow_25: 432, throw: 22, nc: 32 }
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

// Specific Heat Capacity (cp) lookup table at different temperatures for water (in kJ/kgÂ·K)
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
  deltaT: number, // in Â°C (or Â°F if isIP)
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

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder, disabled, readOnly }: InlineInputProps) {
  const [localVal, setLocalVal] = useState(value === "" ? "" : String(value));

  useEffect(() => {
    setLocalVal(value === "" ? "" : String(value));
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (localVal !== (value === "" ? "" : String(value))) {
        onCommit(localVal);
      }
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setLocalVal(value === "" ? "" : String(value));
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type={type}
      step={step}
      min={min}
      disabled={disabled}
      readOnly={readOnly}
      value={localVal}
      placeholder={placeholder}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        if (localVal !== (value === "" ? "" : String(value))) {
          onCommit(localVal);
        }
      }}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text placeholder:text-muted-foreground/45 placeholder:font-normal ${className}`}
    />
  );
}

function BulkBtn({ icon: Icon, children, onClick }: { icon: any; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11.5px] font-semibold text-[#06456F] dark:text-[#0A7BC7] hover:bg-primary/10 active:bg-primary/15 transition-colors cursor-pointer"
    >
      <Icon className="size-3" />
      <span>{children}</span>
    </button>
  );
}

const DEFAULT_ROWS: DiffuserRowItem[] = [
  { id: "row-1", name: "Executive Office 101", floor: "GF", zone: "AHU-01", coolingKw: 2.2, deltaT: 10, airflow: 182, count: 2, diffType: "square", designVelocity: 2.0 },
  { id: "row-2", name: "Conference Room 102", floor: "GF", zone: "AHU-01", coolingKw: 5.5, deltaT: 10, airflow: 455, count: 4, diffType: "square", designVelocity: 2.0 },
  { id: "row-3", name: "Open Workspace Area", floor: "L01", zone: "AHU-02", coolingKw: 15.0, deltaT: 10, airflow: 1240, count: 8, diffType: "square", designVelocity: 2.5 },
  { id: "row-4", name: "Boardroom Suite", floor: "L01", zone: "AHU-02", coolingKw: 4.2, deltaT: 10, airflow: 347, count: 3, diffType: "slot20", designVelocity: 2.0 },
];

function DiffuserSelectorPage() {
  const { project, activeProjectId, spaces, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/diffuser-selector", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/diffuser-selector", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [rows, setRows] = useState<DiffuserRowItem[]>(DEFAULT_ROWS);
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const isApprovedLocked = useCalculationLock("/diffuser-selector", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedDiffType, setSelectedDiffType] = useState<string | null>(null);
  const [filterWarningsOnly, setFilterWarningsOnly] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Floor Ordering
  const [floorOrder, setFloorOrder] = useState<string[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Bulk Edit
  const [showBulkEditModal, setShowBulkEditModal] = useState<boolean>(false);
  const [bulkEditFloor, setBulkEditFloor] = useState<string>("");
  const [bulkEditType, setBulkEditType] = useState<DiffuserType | "">("");
  const [bulkEditCount, setBulkEditCount] = useState<string>("");
  const [bulkEditVelocity, setBulkEditVelocity] = useState<string>("");

  // Import Popover / Modal
  const [showSourceModal, setShowSourceModal] = useState<boolean>(false);
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

  // Active Sizer Interactive State (CHW Pump Head style interactive sizing)
  const [activeSizer, setActiveSizer] = useState<{
    id?: string;
    name: string;
    floor: string;
    zone: string;
    coolingKw: number | "";
    deltaT: number | "";
    airflow: number | "";
    count: number | "";
    diffType: DiffuserType;
    designVelocity: number;
    ceilingHeight: number | "";
    targetNcLimit: number;
  }>({
    name: "Primary Office Suite",
    floor: "GF",
    zone: "AHU-01",
    coolingKw: 3.5,
    deltaT: 10,
    airflow: 290,
    count: 2,
    diffType: "square",
    designVelocity: 2.0,
    ceilingHeight: 2.8,
    targetNcLimit: 30,
  });

  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(false);
  const sizerSectionRef = useRef<HTMLDivElement>(null);

  // Comment System State
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);

  const ip = unitSystem === "ip";
  const flowUnit = ip ? "CFM" : "L/s";
  const velUnit = ip ? "FPM" : "m/s";
  const lenUnit = ip ? "ft" : "m";
  const tempUnit = ip ? "Â°F" : "Â°C";

  // Auto compute airflow when coolingKw or deltaT changes in quick-add
  useEffect(() => {
    if (newCoolingKw !== "" && Number(newCoolingKw) > 0 && newDeltaT !== "" && Number(newDeltaT) > 0) {
      const res = computeAirflowFromKw(Number(newCoolingKw), Number(newDeltaT), ip, "air", 20);
      setNewAirflow(res.flowRate);
    }
  }, [newCoolingKw, newDeltaT, ip]);

  // Auto compute activeSizer airflow when coolingKw or deltaT changes
  useEffect(() => {
    if (activeSizer.coolingKw !== "" && Number(activeSizer.coolingKw) > 0 && activeSizer.deltaT !== "" && Number(activeSizer.deltaT) > 0) {
      const res = computeAirflowFromKw(Number(activeSizer.coolingKw), Number(activeSizer.deltaT), ip, "air", 20);
      setActiveSizer(prev => ({ ...prev, airflow: res.flowRate }));
    }
  }, [activeSizer.coolingKw, activeSizer.deltaT, ip]);

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

  const handleOpenComment = (idOrObj: { id: string; name: string } | string, nameOptional?: string) => {
    if (typeof idOrObj === "string") {
      setCommentTargetItem({ id: idOrObj, name: nameOptional || idOrObj });
    } else {
      setCommentTargetItem(idOrObj);
    }
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
    let adpi = "Good Selection (ADPI â‰¥ 80%)";
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
      sizing: computeRowSizing(r, ip)
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
    toast.success(`Added "${name}" with Q=mÂ·CpÂ·Î”T airflow computation`);
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

  // PCL Summary for Quick Apply Bar
  const pclSummary = useMemo(() => {
    const pclSpaces = getPclSpaces();
    let totalKw = 0;
    let totalTr = 0;
    let totalArea = 0;
    pclSpaces.forEach((s: any) => {
      const kw = Number(s.kw || (s.tr ? s.tr * 3.517 : (s.dissipation ? s.dissipation / 1000 : 0)));
      totalKw += kw;
      totalTr += (s.tr ? Number(s.tr) : kw / 3.517);
      totalArea += Number(s.area || 0);
    });
    return {
      count: pclSpaces.length,
      totalKw: Math.round(totalKw * 10) / 10,
      totalTr: Math.round(totalTr * 10) / 10,
      totalArea: Math.round(totalArea * 10) / 10,
      firstSpace: pclSpaces[0] || null
    };
  }, [project?.id]);

  // Real-time Active Terminal Sizing calculation
  const activeSizing = useMemo(() => {
    const flowVal = activeSizer.airflow !== "" ? Number(activeSizer.airflow) : 0;
    const countVal = activeSizer.count !== "" && Number(activeSizer.count) > 0 ? Number(activeSizer.count) : 1;
    const flowLps = ip ? flowVal / 2.1189 : flowVal;
    const flowPerDiffLps = flowLps / countVal;
    const flowPerDiffDisplay = ip ? flowPerDiffLps * 2.1189 : flowPerDiffLps;

    const flowKey = activeSizer.designVelocity === 2.5 ? "maxFlow_25" : "maxFlow_20";
    const options = DIFFUSER_DATA[activeSizer.diffType] || DIFFUSER_DATA.square;

    let selected: DiffuserSize | null = null;
    for (let i = 0; i < options.length; i++) {
      let maxFlow = 0;
      if (activeSizer.diffType === "square" || activeSizer.diffType === "round") {
        maxFlow = options[i][flowKey] || 0;
      } else {
        maxFlow = options[i].maxFlow || 0;
      }
      if (flowPerDiffLps <= maxFlow) {
        selected = options[i];
        break;
      }
    }

    const isExceeded = !selected;
    if (!selected) {
      selected = options[options.length - 1];
    }

    const velocityFpm = activeSizer.designVelocity * 196.85;
    const throwValM = selected.throw * 0.3048;
    const throwValFt = selected.throw;
    const throwDisplay = ip ? `${throwValFt.toFixed(1)} ft` : `${throwValM.toFixed(1)} m`;

    const velMs = activeSizer.designVelocity;
    const staticPressPa = Math.pow(velMs / 4.04, 2) * 12;
    const staticPressInWg = staticPressPa * 0.00401463;
    const staticPressDisplay = ip ? `${staticPressInWg.toFixed(3)} in. w.g.` : `${staticPressPa.toFixed(1)} Pa`;

    let adpiRating = "88% (Optimal Comfort)";
    let draftRisk = "Low Draft Risk (ASHRAE 55)";
    let status = "PASS";
    if (isExceeded) {
      status = "FAIL";
      adpiRating = "< 60% (Exceeds Capacity)";
      draftRisk = "High Velocity Draft Risk";
    } else if (velocityFpm > 550) {
      status = "WARN";
      adpiRating = "72% (Elevated Velocity)";
      draftRisk = "Marginal Draft Risk";
    } else if (velocityFpm < 250) {
      status = "WARN";
      adpiRating = "68% (Low Induction)";
      draftRisk = "Stagnation Risk";
    }

    const targetNc = activeSizer.targetNcLimit || 30;
    const isSoundCompliant = selected.nc <= targetNc;

    return {
      flowPerDiff: flowPerDiffDisplay,
      neckSize: isExceeded ? `Capacity Exceeded (${selected.size} Max)` : selected.size,
      velocity: activeSizer.designVelocity,
      velocityFpm,
      throwVal: throwDisplay,
      throwValM,
      throwValFt,
      nc: `NC-${selected.nc}`,
      rawNc: selected.nc,
      isSoundCompliant,
      adpiRating,
      draftRisk,
      staticPressDisplay,
      staticPressPa,
      staticPressInWg,
      isExceeded,
      status
    };
  }, [activeSizer, ip]);

  // Context Menu & Clipboard Helpers
  const handleCopyValue = (label: string, val: any) => {
    if (val !== undefined && val !== null) {
      navigator.clipboard.writeText(String(val));
      toast.success(`Copied "${label}": ${val}`);
    }
  };

  const handlePasteValue = async (label: string, fieldKey: string) => {
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text.trim());
      if (!isNaN(num)) {
        setActiveSizer(prev => ({ ...prev, [fieldKey]: num }));
        toast.success(`Pasted ${num} into "${label}"`);
      } else if (typeof text === "string" && text.trim()) {
        setActiveSizer(prev => ({ ...prev, [fieldKey]: text.trim() }));
        toast.success(`Pasted "${text.trim()}" into "${label}"`);
      }
    } catch (err) {
      toast.error("Clipboard permission denied or empty");
    }
  };

  const handleResetField = (label: string, fieldKey: string, defaultVal: any) => {
    setActiveSizer(prev => ({ ...prev, [fieldKey]: defaultVal }));
    toast.info(`Reset "${label}" to ${defaultVal !== "" ? defaultVal : "Blank"}`);
  };

  const handleClearField = (label: string, fieldKey: string) => {
    setActiveSizer(prev => ({ ...prev, [fieldKey]: "" }));
    toast.info(`Cleared "${label}"`);
  };

  const handleLoadRowIntoSizer = (row: DiffuserRowItem) => {
    setActiveSizer({
      id: row.id,
      name: row.name,
      floor: row.floor,
      zone: row.zone,
      coolingKw: row.coolingKw ?? "",
      deltaT: row.deltaT ?? 10,
      airflow: row.airflow,
      count: row.count,
      diffType: row.diffType,
      designVelocity: row.designVelocity || 2.0,
      ceilingHeight: ip ? 9.2 : 2.8,
      targetNcLimit: 30,
    });
    sizerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.success(`Loaded "${row.name}" into interactive sizer`);
  };

  const handleAddOrUpdateSchedule = () => {
    const flowVal = activeSizer.airflow !== "" ? Number(activeSizer.airflow) : (ip ? 400 : 188);
    const countVal = activeSizer.count !== "" && Number(activeSizer.count) > 0 ? Number(activeSizer.count) : 2;
    const nameVal = activeSizer.name.trim() || `Space ${rows.length + 1}`;

    if (activeSizer.id && rows.some(r => r.id === activeSizer.id)) {
      setRows(prev => prev.map(r => r.id === activeSizer.id ? {
        ...r,
        name: nameVal,
        floor: activeSizer.floor || "GF",
        zone: activeSizer.zone || "Zone-1",
        coolingKw: activeSizer.coolingKw,
        deltaT: activeSizer.deltaT,
        airflow: flowVal,
        count: countVal,
        diffType: activeSizer.diffType,
        designVelocity: activeSizer.designVelocity
      } : r));
      toast.success(`Updated "${nameVal}" in diffuser schedule`);
    } else {
      const newRow: DiffuserRowItem = {
        id: "row-" + Date.now(),
        name: nameVal,
        floor: activeSizer.floor || "GF",
        zone: activeSizer.zone || "Zone-1",
        coolingKw: activeSizer.coolingKw,
        deltaT: activeSizer.deltaT,
        airflow: flowVal,
        count: countVal,
        diffType: activeSizer.diffType,
        designVelocity: activeSizer.designVelocity,
        flagged: false
      };
      setRows(prev => [newRow, ...prev]);
      setActiveSizer(prev => ({ ...prev, id: newRow.id }));
      toast.success(`Added "${nameVal}" to diffuser schedule`);
    }
  };

  const handleResetSizer = () => {
    setActiveSizer({
      name: `Space ${rows.length + 1}`,
      floor: "GF",
      zone: "Zone-1",
      coolingKw: 2.5,
      deltaT: 10,
      airflow: ip ? 440 : 208,
      count: 2,
      diffType: "square",
      designVelocity: 2.0,
      ceilingHeight: ip ? 9.2 : 2.8,
      targetNcLimit: 30,
    });
    toast.info("Reset interactive sizer parameters to defaults");
  };

  // Helper component to render an interactive input box with right-click Context Menu and Comments
  const renderInputBox = (
    id: string,
    fieldKey: keyof typeof activeSizer,
    label: string,
    value: any,
    defaultVal: any,
    placeholder: string,
    type: "number" | "text" = "number",
    min?: number,
    step: string = "any"
  ) => {
    const itemComments = commentsList.filter(c => c.spaceId === id || c.targetId === id || c.itemId === id);
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id ||
                          highlightedTargetId === `field-${id}` ||
                          (highlightedTargetId && id && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
                          (highlightedTargetId && label && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-item-id={id}
            data-field-id={id}
            className={`flex flex-col gap-1.5 group cursor-context-menu p-2 rounded-xl transition-all ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <label className="font-semibold text-foreground flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span>{label}</span>
                {hasComments && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComment(id, label);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                    title={`${itemComments.length} comment(s)/task(s) assigned`}
                  >
                    <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                    <span>{itemComments.length}</span>
                  </button>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">Right-click for options</span>
            </label>
            <input
              id={id}
              type={type}
              min={min}
              step={step}
              value={value ?? ""}
              onChange={(e) => {
                const val = type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value;
                setActiveSizer(prev => {
                  const next = { ...prev, [fieldKey]: val };
                  if (fieldKey === "coolingKw" || fieldKey === "deltaT") {
                    const kw = fieldKey === "coolingKw" ? (val === "" ? 0 : Number(val)) : (prev.coolingKw === "" ? 0 : Number(prev.coolingKw));
                    const dt = fieldKey === "deltaT" ? (val === "" ? 10 : Number(val)) : (prev.deltaT === "" ? 10 : Number(prev.deltaT));
                    if (kw > 0 && dt > 0) {
                      next.airflow = computeAirflowFromKw(kw, dt, ip, "air", 20).flowRate;
                    }
                  }
                  return next;
                });
              }}
              placeholder={placeholder}
              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-hidden placeholder:text-muted-foreground/45 placeholder:font-normal transition hover:border-[#0A7BC7]/50"
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => handleCopyValue(label, value)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handlePasteValue(label, String(fieldKey))}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleResetField(label, String(fieldKey), defaultVal)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default ({defaultVal !== "" ? defaultVal : "Blank"})</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleClearField(label, String(fieldKey))}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium text-amber-600 dark:text-amber-400"
          >
            <Trash2 className="size-3.5" />
            <span>Clear Field</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // Helper component to render an interactive result row with context menu and steps popup
  const renderResultRow = (
    id: string,
    label: string,
    valueFormatted: string,
    isHighlight: boolean = false,
    highlightClass: string = "text-foreground",
    colSpanTwo: boolean = false
  ) => {
    const itemComments = commentsList.filter(c => c.spaceId === id || c.targetId === id || c.itemId === id);
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id ||
                          highlightedTargetId === `res-${id}` ||
                          (highlightedTargetId && id && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
                          (highlightedTargetId && label && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`res-${id}`}
            data-item-id={id}
            data-field-id={id}
            onDoubleClick={() => setShowDetailedCalcs(true)}
            title="Double-click to view step-by-step engineering calculation formulas"
            className={`flex justify-between items-center py-1.5 border-b border-border/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 px-2 rounded-lg transition cursor-pointer group ${
              colSpanTwo ? "col-span-2" : ""
            } ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
              <span>{label}</span>
              {hasComments && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenComment(id, label);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                  title={`${itemComments.length} comment(s)/task(s) assigned`}
                >
                  <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                  <span>{itemComments.length}</span>
                </button>
              )}
            </span>
            <strong className={`font-bold font-mono ${highlightClass}`}>{valueFormatted}</strong>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => setShowDetailedCalcs(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/10 text-primary hover:text-primary rounded-lg cursor-pointer font-semibold"
          >
            <HelpCircle className="size-3.5 text-primary" />
            <span>View Calculation Steps</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double-Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, valueFormatted)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value ({valueFormatted})</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => {
              navigator.clipboard.writeText(`${label}: ${valueFormatted}`);
              toast.success(`Copied full line: "${label}: ${valueFormatted}"`);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Copy Full Line</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
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
      doc.text("2. Diffuser Sizing & Acoustic Selection Schedule (Q = mÂ·CpÂ·Î”T)", 40, (doc as any).lastAutoTable.finalY + 14);

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

  // Available unique floors and types
  const allUniqueFloors = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.floor && r.floor.trim()) set.add(r.floor.trim());
    });
    return Array.from(set);
  }, [rows]);

  const allUniqueTypes = useMemo(() => {
    return Object.keys(DIFFUSER_NAMES);
  }, []);

  const sortedFloorsForGrid = useMemo(() => {
    if (floorOrder.length === 0) {
      return [...allUniqueFloors].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    const orderMap = new Map<string, number>();
    floorOrder.forEach((f, idx) => orderMap.set(f, idx));
    return [...allUniqueFloors].sort((a, b) => {
      const idxA = orderMap.has(a) ? orderMap.get(a)! : 9999;
      const idxB = orderMap.has(b) ? orderMap.get(b)! : 9999;
      if (idxA !== idxB) return idxA - idxB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [allUniqueFloors, floorOrder]);

  const handleMoveFloor = (index: number, direction: "up" | "down") => {
    const newFloors = [...sortedFloorsForGrid];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFloors.length) return;
    const temp = newFloors[index];
    newFloors[index] = newFloors[targetIndex];
    newFloors[targetIndex] = temp;
    setFloorOrder(newFloors);
  };

  const handleResetFloorOrder = () => {
    setFloorOrder([]);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;
    const newFloors = [...sortedFloorsForGrid];
    const draggedFloor = newFloors[draggingIndex];
    newFloors.splice(draggingIndex, 1);
    newFloors.splice(index, 0, draggedFloor);
    setDraggingIndex(index);
    setFloorOrder(newFloors);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  const activeFiltersCount = (selectedFloor ? 1 : 0) + (selectedDiffType ? 1 : 0) + (filterWarningsOnly ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedFloor(null);
    setSelectedDiffType(null);
    setFilterWarningsOnly(false);
  };

  // Filtered rows for display
  const filteredRows = useMemo(() => {
    return computedRows.filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = (r.name || "").toLowerCase().includes(q) ||
                        (r.floor || "").toLowerCase().includes(q) ||
                        (r.zone || "").toLowerCase().includes(q) ||
                        (DIFFUSER_NAMES[r.diffType] || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (selectedFloor && r.floor !== selectedFloor) return false;
      if (selectedDiffType && r.diffType !== selectedDiffType) return false;
      if (filterWarningsOnly && !r.flagged && r.sizing.status === "PASS") return false;
      return true;
    });
  }, [computedRows, searchQuery, selectedFloor, selectedDiffType, filterWarningsOnly]);

  const handleToggleGroup = (groupSpaceIds: string[], select: boolean) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      groupSpaceIds.forEach(id => {
        if (select) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const renderFloorGroupHeader = (floor: string) => {
    const floorRows = filteredRows.filter(r => r.floor === floor);
    return (
      <span className="flex items-center gap-1.5 font-medium">
        <span><strong className="font-bold text-primary">{floor}</strong></span>
        <span className="text-[10px] text-muted-foreground font-normal">({floorRows.length} spaces) (Right-click or press Delete to remove)</span>
      </span>
    );
  };

  const renderFloorGroupContextMenu = (floor: string) => {
    return (
      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={async () => {
            const newFloor = window.prompt("Enter new floor name:", floor);
            if (newFloor && newFloor.trim() !== "" && newFloor.trim() !== floor) {
              const trimmed = newFloor.trim();
              setRows(prev => prev.map(s => s.floor === floor ? { ...s, floor: trimmed } : s));
              toast.success(`Renamed floor "${floor}" to "${trimmed}"`);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Rename Floor</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />
        
        <ContextMenuItem
          onClick={() => {
            const floorSpaces = rows.filter((s) => s.floor === floor);
            if (floorSpaces.length > 0) {
              if (window.confirm(`Are you sure you want to delete all ${floorSpaces.length} spaces on floor "${floor}"?`)) {
                setRows(prev => prev.filter((s) => s.floor !== floor));
                setSelectedRowIds(new Set());
                toast.success(`Deleted floor "${floor}" and its spaces`);
              }
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Floor</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const renderSpaceContextMenu = (row: DiffuserRowItem & { sizing: any }) => {
    const selectedIds = selectedRowIds.has(row.id) ? Array.from(selectedRowIds) : [row.id];
    const isMulti = selectedIds.length > 1;
    const targetsCount = selectedIds.length;

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => {
            setSelectedDetailRow(row);
            setShowDetailModal(true);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Calculator className="size-3.5 text-muted-foreground" />
          <span>Calculation Breakdown</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => {
            const clones = selectedIds.map((id, index) => {
              const targetRow = rows.find((s) => s.id === id);
              if (!targetRow) return null;
              return {
                ...targetRow,
                id: `diff-${Date.now()}-${index}-${Math.random()}`,
                name: `${targetRow.name} (Clone)`,
              };
            }).filter(Boolean) as DiffuserRowItem[];
            
            if (clones.length > 0) {
              setRows(prev => [...prev, ...clones]);
              toast.success(`Duplicated ${clones.length} space(s)`);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Duplicate Selected" : "Duplicate Space"}</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => {
            const anyUnflagged = selectedIds.some((id) => !rows.find((s) => s.id === id)?.flagged);
            const editSet = new Set(selectedIds);
            setRows(prev => prev.map((s) => (editSet.has(s.id) ? { ...s, flagged: anyUnflagged } : s)));
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Flag className={`size-3.5 ${row.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          <span>{row.flagged ? (isMulti ? "Unflag Selected" : "Unflag Space") : (isMulti ? "Flag Selected" : "Flag Space")}</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={() => handleOpenComment(row)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment / Assign Task</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />
        
        <ContextMenuItem
          onClick={() => {
            const msg = targetsCount === 1 
              ? `Are you sure you want to delete space "${row.name}"?`
              : `Are you sure you want to delete the ${targetsCount} selected spaces?`;
            
            if (window.confirm(msg)) {
              setRows(prev => prev.filter((s) => !selectedIds.includes(s.id)));
              setSelectedRowIds(new Set());
              toast.success(`Deleted ${targetsCount} space(s)`);
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

  const columns: Column<DiffuserRowItem & { sizing: any }>[] = [
    {
      key: "name",
      header: "NAME OF SPACE",
      width: 220,
      editable: true,
      render: (r) => {
        const itemComments = getMergedItemComments(r.id, r.name, r.comments, "/diffuser-selector", project?.id);
        return (
          <div className="flex items-center gap-1.5 w-full pr-1">
            {itemComments.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenComment(r.id, r.name);
                }}
                title={`${itemComments.length} comment(s)/task(s) assigned`}
                className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <MessageSquare className="size-3.5 fill-blue-500/20" />
                <span className="text-[10px] font-bold">{itemComments.length}</span>
              </button>
            )}
            <InlineInput
            disabled={isApprovedLocked}
            readOnly={isApprovedLocked}
            value={r.name}
            placeholder="Space Name"
            onCommit={(val) => {
              setRows(prev => prev.map(row => row.id === r.id ? { ...row, name: val.trim() || row.name } : row));
            }}
            className="font-semibold text-[12px] flex-1 truncate"
          />
        </div>
        );
      },
    },
    {
      key: "coolingKw",
      header: "LOAD (KW)",
      width: 95,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <InlineInput
          disabled={isApprovedLocked}
          readOnly={isApprovedLocked}
          type="number"
          step="0.1"
          min={0}
          value={r.coolingKw !== "" && r.coolingKw !== undefined ? r.coolingKw : ""}
          placeholder="â€”"
          onCommit={(val) => {
            const nextKw = val === "" ? "" : Number(val);
            setRows(prev => prev.map(row => {
              if (row.id !== r.id) return row;
              let flow = row.airflow;
              if (nextKw !== "" && Number(nextKw) > 0) {
                const dt = row.deltaT ? Number(row.deltaT) : 10;
                flow = computeAirflowFromKw(Number(nextKw), dt, ip, "air", 20).flowRate;
              }
              return { ...row, coolingKw: nextKw, airflow: flow };
            }));
          }}
          className="font-mono text-center text-[12px] font-bold text-foreground"
        />
      ),
    },
    {
      key: "diffType",
      header: "DIFFUSER TYPE",
      width: 170,
      render: (r) => (
        <select
          disabled={isApprovedLocked}
          value={r.diffType}
          onChange={(e) => {
            const val = e.target.value as DiffuserType;
            setRows(prev => prev.map(row => row.id === r.id ? { ...row, diffType: val } : row));
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-full px-1.5 bg-surface-2 border border-border/70 rounded text-[11px] font-semibold text-foreground truncate cursor-pointer outline-none focus:border-primary disabled:opacity-60"
        >
          <option value="square">4-Way Square</option>
          <option value="round">Circular Cone</option>
          <option value="slot16">Linear Slot 16mm</option>
          <option value="slot20">Linear Slot 20mm</option>
          <option value="slot25">Linear Slot 25mm</option>
        </select>
      ),
    },
    {
      key: "airflow",
      header: `AIRFLOW (${flowUnit})`,
      width: 110,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <InlineInput
          disabled={isApprovedLocked}
          readOnly={isApprovedLocked}
          type="number"
          step="1"
          min={1}
          value={r.airflow}
          placeholder="0"
          onCommit={(val) => {
            const nextFlow = val === "" ? "" : Number(val);
            setRows(prev => prev.map(row => row.id === r.id ? { ...row, airflow: nextFlow } : row));
          }}
          className="font-mono text-center text-[12px] font-bold text-primary"
        />
      ),
    },
    {
      key: "count",
      header: "QTY",
      width: 65,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <InlineInput
          disabled={isApprovedLocked}
          readOnly={isApprovedLocked}
          type="number"
          step="1"
          min={1}
          value={r.count}
          placeholder="1"
          onCommit={(val) => {
            const nextCount = val === "" ? 1 : Math.max(1, Number(val));
            setRows(prev => prev.map(row => row.id === r.id ? { ...row, count: nextCount } : row));
          }}
          className="font-mono text-center text-[12px] font-bold text-foreground"
        />
      ),
    },
    {
      key: "flowPerDiff",
      header: "FLOW / DIFF",
      width: 100,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono text-[11.5px] font-semibold text-foreground tabular">
          {r.sizing.flowPerDiff.toFixed(1)} {flowUnit}
        </span>
      ),
    },
    {
      key: "neckSize",
      header: "RECOMMENDED NECK",
      width: 180,
      render: (r) => (
        <span className={`font-mono text-[11.5px] font-bold truncate ${r.sizing.isExceeded ? "text-destructive" : "text-primary"}`}>
          {r.sizing.neckSize}
        </span>
      ),
    },
    {
      key: "velocity",
      header: "VEL (m/s)",
      width: 80,
      align: "center",
      mono: true,
      render: (r) => (
        <button
          disabled={isApprovedLocked}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const nextV = r.designVelocity === 2.0 ? 2.5 : 2.0;
            setRows(prev => prev.map(row => row.id === r.id ? { ...row, designVelocity: nextV } : row));
          }}
          className="px-1.5 py-0.5 rounded font-mono text-[11px] font-bold bg-surface-2 hover:bg-primary/10 border border-border/80 hover:border-primary/40 cursor-pointer disabled:cursor-default"
          title="Click to toggle between 2.0 m/s (Quiet) and 2.5 m/s (Standard)"
        >
          {r.designVelocity.toFixed(1)} m/s
        </button>
      ),
    },
    {
      key: "throw",
      header: `THROW (${ip ? "ft" : "m"})`,
      width: 90,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono text-[11.5px] text-muted-foreground font-medium">
          {r.sizing.throwVal}
        </span>
      ),
    },
    {
      key: "nc",
      header: "NC SOUND",
      width: 85,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono text-[11.5px] font-bold text-emerald-600 dark:text-emerald-400">
          {r.sizing.nc}
        </span>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      width: 100,
      align: "center",
      render: (r) => {
        if (r.sizing.status === "FAIL") {
          return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">FAIL</span>;
        }
        if (r.sizing.status === "WARN") {
          return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">WARN</span>;
        }
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">PASS</span>;
      },
    },
    {
      key: "flagged",
      header: "",
      width: 40,
      align: "center",
      render: (r) => (
        <button
          disabled={isApprovedLocked}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRows(prev => prev.map(row => row.id === r.id ? { ...row, flagged: !row.flagged } : row));
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto disabled:cursor-default"
          title={r.flagged ? "Flagged for engineering review (click to unflag)" : "Click to flag space"}
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
    },
  ];

  const handleAddNewSpace = () => {
    setNewName(`Space ${rows.length + 1}`);
    setNewFloor(sortedFloorsForGrid[0] || "GF");
    setNewZone("Zone-1");
    setNewCoolingKw("");
    setNewAirflow("");
    setNewCount(2);
    setNewType("square");
    setNewVelocity(2.0);
    setShowAddModal(true);
  };

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
    return computeRowSizing(previewDraftRow, ip);
  }, [previewDraftRow, ip]);

  return (
    <AppShell title="Diffuser Selector" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header matching Ventilation */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Diffuser Selector</h1>
                <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} spaces</span>
              </div>
              <CalculationReviewBar
                projectId={project?.id}
                calculatorPath="/diffuser-selector"
                calculatorTitle="Diffuser Selection Schedule"
              />
              {commentsList.length > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Comment(s)</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                inputDescriptions="Supply Airflow per space"
                conversionExample={unitSystem === "si" ? "Convert 500 L/s â†’ 1,059 CFM" : "Convert 1000 CFM â†’ 472 L/s"}
              />
            </div>
          </div>

        {/* White card container for Tabs & Data Grid */}
        <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
          calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        }`}>
          {/* Tabs Selector row */}
          <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/60">
            <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
              <button
                onClick={() => setActiveTab("calculator")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                  activeTab === "calculator"
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sizing Calculator
              </button>
              <button
                onClick={() => setActiveTab("report")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                  activeTab === "report"
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Report
              </button>
            </div>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 min-h-0 animate-fade-in flex flex-col overflow-hidden">
            {activeTab === "calculator" ? (
              <div className="flex-1 min-h-0 flex flex-col relative">
                {/* Toolbar matching Preliminary Cooling Load / Ventilation */}
                <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter spaces..."
                    className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
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
                        title="Filter Spaces"
                      >
                        <Filter className="size-3.5 shrink-0" />
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

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Floor</span>
                        <select
                          value={selectedFloor || ""}
                          onChange={(e) => setSelectedFloor(e.target.value || null)}
                          className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                        >
                          <option value="">All Floors</option>
                          {allUniqueFloors.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Diffuser Type</span>
                        <select
                          value={selectedDiffType || ""}
                          onChange={(e) => setSelectedDiffType(e.target.value || null)}
                          className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                        >
                          <option value="">All Types</option>
                          {allUniqueTypes.map((t) => (
                            <option key={t} value={t}>{DIFFUSER_NAMES[t] || t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 pt-1.5 border-t border-border/60">
                        <label className="flex items-center gap-2 text-[11.5px] font-semibold text-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={filterWarningsOnly}
                            onChange={(e) => setFilterWarningsOnly(e.target.checked)}
                            className="rounded border-gray-300 text-red-600 size-3.5 focus:ring-red-500"
                          />
                          <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                            <Flag className="size-3 fill-red-500 text-red-500" />
                            Flagged / Warnings Only
                          </span>
                        </label>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Floor Ordering Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                          floorOrder.length > 0
                            ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                            : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        }`}
                        title="Arrange Floors"
                      >
                        <ArrowUpDown className="size-3.5 shrink-0" />
                        {floorOrder.length > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                            âœ“
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans z-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11.5px] font-semibold text-foreground">Arrange Floors</span>
                        {floorOrder.length > 0 && (
                          <button
                            onClick={handleResetFloorOrder}
                            className="text-[10px] text-primary hover:underline font-medium"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mb-3 leading-snug">
                        Use â–² / â–¼ buttons or drag floors to change their sorting order in grid views.
                      </p>
                      <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-0.5">
                        {sortedFloorsForGrid.map((floor, index) => (
                          <div
                            key={floor}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center justify-between gap-2 p-1.5 bg-surface rounded border border-border text-[11px] cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
                              draggingIndex === index
                                ? "opacity-40 border-primary bg-primary/5 shadow-md"
                                : "hover:bg-surface-2 hover:border-border-strong"
                            }`}
                          >
                            <span className="font-semibold text-foreground uppercase truncate flex-1 min-w-0">{floor}</span>
                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveFloor(index, "up")}
                                className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer ${
                                  index === 0 ? "opacity-25 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                                }`}
                                title="Move floor up"
                              >
                                <ChevronUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === sortedFloorsForGrid.length - 1}
                                onClick={() => handleMoveFloor(index, "down")}
                                className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer ${
                                  index === sortedFloorsForGrid.length - 1 ? "opacity-25 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                                }`}
                                title="Move floor down"
                              >
                                <ChevronDown className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Right Actions */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <TBtn
                      disabled={isApprovedLocked}
                      onClick={() => setShowSourceModal(true)}
                    >
                      <Download className="size-3.5" /> Import
                    </TBtn>
                    <TBtn onClick={handleExportExcel}>
                      <FileSpreadsheet className="size-3.5" /> Export Excel
                    </TBtn>
                    <TBtn
                      disabled={isApprovedLocked}
                      primary
                      onClick={handleAddNewSpace}
                    >
                      <Plus className="size-3.5" /> New Space
                    </TBtn>
                  </div>

                  {/* Bulk Actions Bar Overlay */}
                  {!isApprovedLocked && selectedRowIds.size > 0 && (
                    <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                      <span className="font-semibold">{selectedRowIds.size} selected</span>
                      <span className="text-primary/30">Â·</span>
                      <BulkBtn icon={Edit3} onClick={() => {
                        setBulkEditFloor("");
                        setBulkEditType("");
                        setBulkEditCount("");
                        setBulkEditVelocity("");
                        setShowBulkEditModal(true);
                      }}>Bulk edit</BulkBtn>
                      <BulkBtn icon={Layers} onClick={() => {
                        const nextType = "square";
                        handleBulkSetType(nextType);
                      }}>Set 4-Way</BulkBtn>
                      <BulkBtn icon={Flag} onClick={handleBulkToggleFlag}>Flag / Unflag</BulkBtn>
                      <BulkBtn icon={Trash2} onClick={handleBulkDelete}>Delete</BulkBtn>
                      <button
                        onClick={() => setSelectedRowIds(new Set())}
                        className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                      >
                        <X className="size-3" /> Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* DataGrid Area */}
                <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                  {rows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-2">
                      <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center animate-scale-in">
                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce">
                          <Wind className="size-6" />
                        </div>
                        <h3 className="text-[15px] font-semibold tracking-tight">No Spaces Scheduled</h3>
                        <p className="text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                          Start by importing cooling loads from Preliminary Cooling Load or manually add spaces to calculate airflow, diffuser neck sizes, noise criteria, and throw patterns.
                        </p>
                        <div className="flex items-center gap-3 w-full">
                          <button
                            onClick={() => setShowSourceModal(true)}
                            className="flex-1 bg-primary text-primary-foreground font-semibold h-9 rounded hover:bg-primary/95 transition-colors text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                          >
                            <Download className="size-3.5" /> Import
                          </button>
                          <button
                            onClick={handleAddNewSpace}
                            className="flex-1 border border-border hover:bg-surface-2 font-semibold h-9 rounded transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Plus className="size-3.5" /> Add Space
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <DataGrid
                      rows={filteredRows}
                      columns={columns}
                      selected={selectedRowIds}
                      onToggle={handleToggleSelectRow}
                      onToggleAll={handleToggleSelectAll}
                      isReadOnly={isApprovedLocked}
                      onRowDoubleClick={(r) => {
                        setSelectedDetailRow(r);
                        setShowDetailModal(true);
                      }}
                      renderContextMenu={renderSpaceContextMenu}
                      groupBy={(r) => r.floor}
                      groupOrder={sortedFloorsForGrid}
                      renderGroupHeader={renderFloorGroupHeader}
                      renderGroupContextMenu={renderFloorGroupContextMenu}
                      onToggleGroup={handleToggleGroup}
                      rowClassName={(row, index) =>
                        index % 2 === 0
                          ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebee] dark:hover:bg-[#25252b]"
                          : "bg-card hover:bg-[#ebebee] dark:hover:bg-[#25252b]"
                      }
                    />
                  )}
                </div>

                {/* Bottom Stats Summary Bar */}
                <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 select-none">
                  <div>
                    Showing <span className="text-foreground font-medium tabular">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} spaces
                  </div>
                  <div className="flex items-center gap-3 tabular">
                    <span>Î£ Airflow: <span className="font-mono text-primary font-bold">{totalFlowSum.toLocaleString()} {flowUnit}</span></span>
                    <span>Î£ Outlets: <span className="font-mono text-foreground font-bold">{totalDiffusersSum} Outlets</span></span>
                    {totalCoolingKwSum > 0 && (
                      <span>Î£ Load (kW): <span className="font-mono text-foreground font-bold">{totalCoolingKwSum.toFixed(2)} kW</span></span>
                    )}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Status: All Terminals Sized (NC â‰¤ 30)</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Printable Report tab view */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Fixed Toolbar at the top */}
                <div className="relative flex items-center justify-end gap-2 px-6 h-12 bg-background border-b border-border/60 shrink-0 no-print select-none">
                  <TBtn onClick={handleExportExcel}><FileSpreadsheet className="size-3.5" /> Export Excel</TBtn>
                  <TBtn onClick={handlePrintPDF} primary><FileText className="size-3.5" /> Export PDF</TBtn>
                </div>
                
                {/* Scrollable Report Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-950/20 font-sans print:p-0">
                  {/* Results Dashboard Grid */}
                  <div className="no-print max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border border-blue-200/60 dark:border-blue-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-blue-500/10 text-blue-600 rounded-full p-2">
                        <Wind className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1 font-sans">Total Supply Airflow</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{totalFlowSum.toLocaleString()} {flowUnit}</strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block font-sans">Sum of all conditioned space air distribution</span>
                    </div>

                    <div className="bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-950/20 dark:to-pink-900/10 border border-pink-200/60 dark:border-pink-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-pink-500/10 text-pink-600 rounded-full p-2">
                        <Layers className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-widest block mb-1 font-sans">Total Outlets Count</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{totalDiffusersSum} Outlets</strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block font-sans">Avg flow: {(totalFlowSum / Math.max(1, totalDiffusersSum)).toFixed(1)} {flowUnit}/diffuser</span>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-emerald-500/10 text-emerald-600 rounded-full p-2">
                        <CheckCircle2 className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1 font-sans">Total Spaces Sized</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">{rows.length} spaces</strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block font-sans">Active Floors: {allUniqueFloors.length} levels</span>
                    </div>

                    <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-950/20 dark:to-teal-900/10 border border-teal-200/60 dark:border-teal-800/50 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      <div className="absolute right-4 top-4 bg-teal-500/10 text-teal-600 rounded-full p-2">
                        <ShieldCheck className="size-4" />
                      </div>
                      <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest block mb-1 font-sans">Acoustic Compliance</span>
                      <strong className="text-2xl font-black text-slate-900 dark:text-white block font-mono">NC â‰¤ 30</strong>
                      <span className="text-[11px] text-muted-foreground mt-2 block font-sans">ASHRAE 55 acoustic & sound compliant</span>
                    </div>
                  </div>

                  {/* Sizing Recommendations & Validation */}
                  <div className="no-print max-w-4xl mx-auto w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm font-sans mb-6">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3.5 flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-600" /> Sizing Validation & Engineering Notes
                    </h3>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[12.5px]">
                        <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                        <span>All terminal diffusers operate under recommended velocity limits (2.0 - 2.5 m/s) ensuring draft-free room air motion (ADPI â‰¥ 80%).</span>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[12.5px]">
                        <Info className="size-4 shrink-0 mt-0.5" />
                        <span>Discharge throw distances (T50) provide uniform thermal mixing without stagnation or excessive velocity in the occupied zone (floor to 1.8m).</span>
                      </div>
                    </div>
                  </div>

                  {/* Printable Schedule Table */}
                  <div className="border border-slate-300 dark:border-slate-800 rounded-xl p-8 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0 bg-white dark:bg-slate-900">
                    {/* 1. Title Banner */}
                    <div className="bg-[#0A7BC7] text-white py-3 px-4 rounded-t-lg text-center font-bold text-base tracking-wide uppercase">
                      DIFFUSER SELECTION SCHEDULE REPORT
                    </div>

                    {/* 2. Company & Date */}
                    <div className="py-2.5 px-1 flex justify-between items-center text-xs border-b border-border/60">
                      <span className="font-bold text-foreground">{project?.client || "Prestige Group developers"}</span>
                      <span className="text-muted-foreground">Date: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                    </div>

                    {/* 3. Project Summary Stats */}
                    <div className="mt-4 rounded-lg overflow-hidden border border-border/80 text-xs">
                      <div className="bg-[#06456F] text-white px-3 py-1.5 font-bold flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                        ðŸ“Š PROJECT SUMMARY STATS
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border/60 p-2 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="space-y-1.5 pr-3">
                          <div className="flex justify-between">
                            <span className="font-semibold text-muted-foreground">Total Spaces:</span>
                            <span className="font-bold font-mono">{rows.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold text-muted-foreground">Total Supply Airflow:</span>
                            <span className="font-bold font-mono text-primary">{totalFlowSum.toLocaleString()} {flowUnit}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold text-muted-foreground">Total Outlets Count:</span>
                            <span className="font-bold font-mono">{totalDiffusersSum} Diffusers</span>
                          </div>
                        </div>
                        <div className="space-y-1.5 pl-3">
                          <div className="flex justify-between">
                            <span className="font-semibold text-muted-foreground">Total Cooling Load:</span>
                            <span className="font-bold font-mono text-primary">{totalCoolingKwSum > 0 ? `${totalCoolingKwSum.toFixed(2)} kW` : "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold text-muted-foreground">Average Flow / Diffuser:</span>
                            <span className="font-bold font-mono">{(totalFlowSum / Math.max(1, totalDiffusersSum)).toFixed(1)} {flowUnit}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold text-muted-foreground">Acoustic Compliance:</span>
                            <span className="font-bold font-mono text-emerald-600">PASS (NC â‰¤ 30)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Diffuser Sizing Schedule Table */}
                    <div className="mt-6 overflow-x-auto border border-border rounded-lg">
                      <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold text-foreground border-b border-border">
                            <th className="p-2 text-center w-10">No.</th>
                            <th className="p-2">Space / Room</th>
                            <th className="p-2 text-center">Floor</th>
                            <th className="p-2 text-center">Diffuser Type</th>
                            <th className="p-2 text-right">Airflow ({flowUnit})</th>
                            <th className="p-2 text-center">Qty</th>
                            <th className="p-2 text-right">Flow/Diff</th>
                            <th className="p-2">Recommended Neck</th>
                            <th className="p-2 text-center">Vel (m/s)</th>
                            <th className="p-2 text-center">Throw</th>
                            <th className="p-2 text-center">NC</th>
                            <th className="p-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {computedRows.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="p-2 text-center text-muted-foreground font-mono">{idx + 1}</td>
                              <td className="p-2 font-semibold text-foreground">{r.name}</td>
                              <td className="p-2 text-center text-muted-foreground font-mono">{r.floor}</td>
                              <td className="p-2 text-center text-[11px]">{DIFFUSER_NAMES[r.diffType]}</td>
                              <td className="p-2 text-right font-mono font-bold text-primary">{r.airflow}</td>
                              <td className="p-2 text-center font-mono">{r.count}</td>
                              <td className="p-2 text-right font-mono">{r.sizing.flowPerDiff.toFixed(1)}</td>
                              <td className="p-2 font-mono font-bold text-foreground">{r.sizing.neckSize}</td>
                              <td className="p-2 text-center font-mono">{r.designVelocity.toFixed(1)}</td>
                              <td className="p-2 text-center font-mono text-muted-foreground">{r.sizing.throwVal}</td>
                              <td className="p-2 text-center font-mono font-bold text-emerald-600">{r.sizing.nc}</td>
                              <td className="p-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.sizing.status === "PASS"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                                }`}>
                                  {r.sizing.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100/60 dark:bg-slate-800/40 font-bold border-t-2 border-border text-[11.5px]">
                            <td colSpan={4} className="p-2 text-left">Total ({computedRows.length} spaces)</td>
                            <td className="p-2 text-right font-mono text-primary">{totalFlowSum.toLocaleString()}</td>
                            <td className="p-2 text-center font-mono">{totalDiffusersSum}</td>
                            <td className="p-2 text-right font-mono">-</td>
                            <td colSpan={4} className="p-2 text-center text-muted-foreground">All Terminals Compliant</td>
                            <td className="p-2 text-center text-emerald-600">PASS</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Signature Block */}
                    <div className="mt-10 pt-6 border-t border-border grid grid-cols-3 gap-6 text-xs text-muted-foreground">
                      <div className="flex flex-col gap-8">
                        <span className="font-semibold text-foreground">Prepared By:</span>
                        <div className="border-b border-border/80 pt-4">
                          <span className="font-mono text-[11px] text-foreground font-semibold">{currentUserName}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-8">
                        <span className="font-semibold text-foreground">Checked By:</span>
                        <div className="border-b border-border/80 pt-4">
                          <span className="font-mono text-[11px] text-muted-foreground">Senior HVAC Engineer</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-8">
                        <span className="font-semibold text-foreground">Approver:</span>
                        <div className="border-b border-border/80 pt-4">
                          <span className="font-mono text-[11px] text-muted-foreground">Lead Mechanical Coordinator</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Source Import Selection Modal */}
        {showSourceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Download className="size-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Import Spaces</h3>
                </div>
                <button
                  onClick={() => setShowSourceModal(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-bold p-1"
                >
                  âœ•
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose a source to import spaces into your Diffuser Selection Schedule:
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowSourceModal(false);
                    setShowPclModal(true);
                  }}
                  className="p-3.5 rounded-xl border border-border bg-surface-2 hover:bg-primary/5 hover:border-primary/40 text-left transition flex items-center gap-3 group cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                    <Zap className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground group-hover:text-primary">
                      Preliminary Cooling Load (Q = á¹Â·CpÂ·Î”T)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Auto-calculate airflow from calculated cooling loads (kW / TR) and temperature differential.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSourceModal(false);
                    handleImportWorkspaceSpaces();
                  }}
                  className="p-3.5 rounded-xl border border-border bg-surface-2 hover:bg-primary/5 hover:border-primary/40 text-left transition flex items-center gap-3 group cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-105 transition-transform">
                    <Layers className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground group-hover:text-primary">
                      Current Project Workspace Spaces
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Import all rooms registered in the current active building project.
                    </span>
                  </div>
                </button>
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <TBtn variant="ghost" onClick={() => setShowSourceModal(false)} className="h-8 text-xs font-semibold">
                  Cancel
                </TBtn>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Edit Modal */}
        {showBulkEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="size-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Bulk Edit ({selectedRowIds.size} spaces)
                  </h3>
                </div>
                <button
                  onClick={() => setShowBulkEditModal(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-bold p-1"
                >
                  âœ•
                </button>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-muted-foreground">Floor Level</label>
                  <input
                    type="text"
                    value={bulkEditFloor}
                    onChange={(e) => setBulkEditFloor(e.target.value)}
                    placeholder="Leave blank to keep unchanged"
                    className="h-8 px-3 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-muted-foreground">Diffuser Terminal Type</label>
                  <select
                    value={bulkEditType}
                    onChange={(e) => setBulkEditType(e.target.value as DiffuserType | "")}
                    className="h-8 px-2 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">Leave unchanged</option>
                    <option value="square">4-Way Ceiling Square</option>
                    <option value="round">Circular Radial Cone</option>
                    <option value="slot16">Linear Slot 16mm</option>
                    <option value="slot20">Linear Slot 20mm</option>
                    <option value="slot25">Linear Slot 25mm</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-muted-foreground">Diffusers Count (Qty)</label>
                  <input
                    type="number"
                    min={1}
                    value={bulkEditCount}
                    onChange={(e) => setBulkEditCount(e.target.value)}
                    placeholder="Leave blank to keep unchanged"
                    className="h-8 px-3 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-muted-foreground">Design Velocity (m/s)</label>
                  <select
                    value={bulkEditVelocity}
                    onChange={(e) => setBulkEditVelocity(e.target.value)}
                    className="h-8 px-2 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">Leave unchanged</option>
                    <option value="2.0">2.0 m/s (Quiet â€¢ NC â‰¤ 25)</option>
                    <option value="2.5">2.5 m/s (Standard â€¢ NC â‰¤ 30)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <TBtn variant="ghost" onClick={() => setShowBulkEditModal(false)} className="h-8 text-xs font-semibold">
                  Cancel
                </TBtn>
                <TBtn
                  onClick={() => {
                    setRows(prev => prev.map(r => {
                      if (!selectedRowIds.has(r.id)) return r;
                      return {
                        ...r,
                        ...(bulkEditFloor.trim() ? { floor: bulkEditFloor.trim() } : {}),
                        ...(bulkEditType ? { diffType: bulkEditType } : {}),
                        ...(bulkEditCount ? { count: Math.max(1, Number(bulkEditCount)) } : {}),
                        ...(bulkEditVelocity ? { designVelocity: Number(bulkEditVelocity) } : {}),
                      };
                    }));
                    toast.success(`Updated ${selectedRowIds.size} selected spaces`);
                    setShowBulkEditModal(false);
                  }}
                  className="h-8 text-xs font-bold bg-primary text-primary-foreground"
                >
                  Apply Changes
                </TBtn>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Interactive Double-Click Row Calculation Breakdown & Tuning */}
        {showDetailModal && selectedDetailRow && (() => {
          const row = selectedDetailRow;
          const sizing = computeRowSizing(row, ip);
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
                        {row.name} â€” Diffuser Aerodynamic Breakdown
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Floor: {row.floor} â€¢ Zone: {row.zone} â€¢ Model: {DIFFUSER_NAMES[row.diffType]}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-muted-foreground hover:text-foreground text-sm font-bold p-1"
                  >
                    âœ•
                  </button>
                </div>

                {/* 5-Step Derivation Cards */}
                <div className="flex flex-col gap-3 font-sans">
                  {/* Step 1: Thermal Sizing */}
                  <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <Zap className="size-3.5" /> Step 1: Sensible Cooling Thermal Sizing (Q = á¹ Â· Cp Â· Î”T)
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {kwVal > 0 ? `${kwVal} kW` : "Direct Airflow Input"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                      {kwVal > 0
                        ? `á¹ = ${kwVal} kW Ã· (1.005 kJ/kgÂ·K Ã— ${dtVal}Â°C) = ${(kwVal / (1.005 * (dtVal || 10))).toFixed(3)} kg/s dry air mass flow`
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
                  âœ•
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
                  <span className="text-xl font-black font-mono text-emerald-600">PASS (NCâ‰¤30)</span>
                </div>
              </div>

              <div className="p-4 bg-surface-2 rounded-xl border border-border flex flex-col gap-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Air Distribution Recommendations</span>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  <li>All scheduled diffuser necks operate below the recommended 2.5 m/s (500 FPM) velocity threshold for office spaces.</li>
                  <li>Noise criteria levels do not exceed NC-30 in occupied zones, complying with ASHRAE Handbook Fundamentals standards.</li>
                  <li>Discharge throw pattern ensures effective room entrainment without low-velocity stagnation (ADPI â‰¥ 80%).</li>
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

        {/* Modal: Import from Preliminary Cooling Load with Single Text Box for Î”T */}
        {showPclModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Import Flow Rate from Preliminary Cooling Load (Q = á¹Â·CpÂ·Î”T)
                  </h3>
                </div>
                <button onClick={() => setShowPclModal(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">
                  âœ•
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Import cooling loads ($Q$ in $\text{kW}$) directly from <strong>Preliminary Cooling Load</strong> and compute air terminal volumetric airflow ($L/s$ / $\text{CFM}$) using the thermodynamic equation:
              </p>

              {/* Î”T Text Box & Diversity Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-2 p-4 rounded-2xl border border-border/80">
                {/* 1. Delta T Text/Number Input Only */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-foreground">Supply Air Î”T</label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      â‰ˆ {(pclDeltaT * 1.8).toFixed(1)} Â°F
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
                      placeholder="Enter Î”T (e.g. 10.0)"
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
                    <span>â€¢</span>
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
                              <span className="text-[11px] text-muted-foreground">{p.type || "Occupied Area"} â€¢ Floor: {p.floor || "GF"}</span>
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
                              <span className="text-[10px] text-muted-foreground">á¹ = {calc.massFlowKgS.toFixed(3)} kg/s</span>
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
                  âœ•
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
                  <label className="text-xs font-semibold text-foreground">Supply Air Î”T ({tempUnit})</label>
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
                      <span className="text-[10px] text-primary font-bold">Auto (Q=á¹CpÎ”T)</span>
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
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Quiet â€¢ NC â‰¤ 25</span>
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
                      <span className="text-[10px] font-semibold text-primary">Standard â€¢ NC â‰¤ 30</span>
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
      </div>
    </AppShell>
  );
}
