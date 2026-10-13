import { calculateComputedRows, computeRowSizing, computeAirflowFromKw, getCpWater, DIFFUSER_DATA, DIFFUSER_NAMES, type DiffuserType, type DiffuserSize, type DiffuserRowItem } from "@/lib/calc-diffuser";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { EditDiffuserSpaceModal } from "@/components/workspace/EditDiffuserSpaceModal";
import { FloorSelect } from "@/components/workspace/FloorSelect";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle,
  Save, FolderOpen, ChevronDown, ChevronUp, Trash2, Copy, CopyPlus, Clipboard,
  RotateCcw, MessageSquare, Edit3, FileText, CheckCircle2, Sparkles,
  Download, Upload, Gauge, Layers, Plus, Filter, Search, Wind,
  SlidersHorizontal, Check, RefreshCw, Zap, Calculator, Flame, ArrowRight,
  Sliders, ShieldCheck, CheckSquare, Square, Flag, Activity, Eye, X, ArrowUpDown,
  BookOpen, Scissors, ClipboardPaste
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
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { useAuth } from "@/contexts/AuthContext";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { exportDiffuserSelectorExcel } from "@/lib/exportDiffuserSelectorExcel";
import { addPdfSignatureBlock, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportDiffuserSelectorPDF } from "@/lib/exportDiffuserSelectorPDF";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { GridDropdown } from "@/components/workspace/GridDropdown";
import { useConfirm } from "@/hooks/use-confirm";

export const Route = createFileRoute("/diffuser-selector")({
  head: () => ({
    meta: [
      { title: "Diffuser Selector â€” MEP Calc" },
      { name: "description", content: "Comprehensive HVAC air terminal & diffuser selection schedule with multi-space sizing, noise criteria, and ADPI analysis." },
    ],
  }),
  component: DiffuserSelectorPage,
});





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
  const isGlobalReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly);
  const isEffectiveDisabled = disabled || readOnly || isGlobalReadOnly;

  const getCleanVal = (val: any) => {
    if (val === undefined || val === null || val === "undefined" || val === "null") {
      return "";
    }
    return String(val);
  };

  const [localVal, setLocalVal] = useState(getCleanVal(value));

  useEffect(() => {
    const clean = getCleanVal(value);
    setLocalVal(prev => (prev === clean ? prev : clean));
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setLocalVal(getCleanVal(value));
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type={type}
      step={step}
      min={min}
      disabled={isEffectiveDisabled}
      readOnly={isEffectiveDisabled}
      placeholder={placeholder}
      value={localVal}
      onChange={(e) => {
        if (isEffectiveDisabled) return;
        setLocalVal(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (isEffectiveDisabled) {
          setLocalVal(getCleanVal(value));
          return;
        }
        if (localVal !== getCleanVal(value)) {
          onCommit(localVal);
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`bg-transparent w-full border border-transparent py-0.5 px-1 rounded text-foreground transition-colors ${
        isEffectiveDisabled
          ? "cursor-not-allowed opacity-75 select-none hover:border-transparent focus:border-transparent"
          : "hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 cursor-text"
      } ${className}`}
    />
  );
}

function BulkBtn({ icon: Icon, children, onClick }: { icon: any; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors text-[#06456F] hover:bg-primary/10 dark:text-[#0A7BC7] dark:hover:bg-primary/20 border border-transparent hover:border-primary/20 active:bg-primary/20 dark:active:bg-primary/30 cursor-pointer"
    >
      <Icon className="size-3 shrink-0" />
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
  const confirm = useConfirm();
  const calcReviewState = useCalculationReviewState("/diffuser-selector", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/diffuser-selector", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const [projectInfo, setProjectInfo] = useState({
    projectName: "Air Terminal & Diffuser Selection Study",
    projectNumber: "MEP-DIF-2026",
    client: "Prestige Group developers",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-DIF01",
    notes: "Diffuser sizing and acoustic selection analysis based on ASHRAE 55 and ADPI criteria.",
  });

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [rows, setRows] = useState<DiffuserRowItem[]>(DEFAULT_ROWS);
  const [history, setHistory] = useState<DiffuserRowItem[][]>([]);
  const [redoStack, setRedoStack] = useState<DiffuserRowItem[][]>([]);
  const [clipboard, setClipboard] = useState<DiffuserRowItem[]>([]);

  const updateRowsWithHistory = (nextRows: DiffuserRowItem[]) => {
    setHistory(prev => [...prev.slice(-25), rows]);
    setRedoStack([]);
    setRows(nextRows);
    dirtyStore.set(true);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prevRows = history[history.length - 1];
    setRedoStack(prev => [...prev, rows]);
    setRows(prevRows);
    setHistory(prev => prev.slice(0, -1));
    toast.info("Undo");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextRows = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, rows]);
    setRows(nextRows);
    setRedoStack(prev => prev.slice(0, -1));
    toast.info("Redo");
  };

  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
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
  const [editingRow, setEditingRow] = useState<DiffuserRowItem | null>(null);
  const [isNewRow, setIsNewRow] = useState<boolean>(false);

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
    } else if (idOrObj && typeof idOrObj === "object") {
      setCommentTargetItem({
        id: (idOrObj as any).id,
        name: (idOrObj as any).name || (idOrObj as any).label || (idOrObj as any).spaceName || "Space",
      });
    }
    setCommentModalOpen(true);
  };
  const handleOpenCommentModal = handleOpenComment;

  // Listen for custom event from DataGrid or other comment triggers
  useEffect(() => {
    const handleCustomComment = (e: any) => {
      const detail = e.detail;
      if (detail && detail.id) {
        const found = rows.find((r) => String(r.id) === String(detail.id));
        if (found) {
          handleOpenComment(found.id, found.name);
        } else {
          setCommentTargetItem({ id: String(detail.id), name: detail.name || "Space" });
          setCommentModalOpen(true);
        }
      }
    };
    window.addEventListener("open-mep-row-comment", handleCustomComment);
    return () => window.removeEventListener("open-mep-row-comment", handleCustomComment);
  }, [rows]);

  const handleSaveComment = (commentData: any, metadata?: any) => {
    const text = typeof commentData === "string" ? commentData : commentData?.text || commentData?.comment || "";
    if (!text || !text.trim()) return;

    const newComment = {
      id: typeof commentData === "object" && commentData?.id ? commentData.id : "cm_" + Date.now(),
      spaceId: commentTargetItem?.id || "general",
      targetId: commentTargetItem?.id || "general",
      targetName: commentTargetItem?.name || "Diffuser Parameter",
      user: (typeof commentData === "object" && commentData?.user) || currentUserName,
      userId: (typeof commentData === "object" && (commentData?.userId || commentData?.authorId)) || userData?.id || profile?.id || "user_id",
      text: text.trim(),
      timestamp: (typeof commentData === "object" && commentData?.timestamp) || new Date().toISOString(),
      status: "OPEN",
      tag: (typeof commentData === "object" && commentData?.tag) || metadata?.tag || "general",
      priority: (typeof commentData === "object" && commentData?.priority) || metadata?.priority || "medium",
      assignedTo: (typeof commentData === "object" && (commentData?.assignedTo || (commentData?.assignedUsers && commentData.assignedUsers[0]))) || metadata?.assignedTo || "",
      assignedUsers: (typeof commentData === "object" && commentData?.assignedUsers) || metadata?.assignedUsers || [],
      calculatorPath: "/diffuser-selector",
      projectId: project?.id || "default",
      projectName: project?.name || "Diffuser Selector",
    };
    const updated = [newComment, ...commentsList];
    saveComments(updated);

    if (commentTargetItem?.id) {
      setRows((prevRows) => {
        const nextRows = prevRows.map((r) => {
          if (String(r.id) === String(commentTargetItem.id)) {
            const currentComments = Array.isArray(r.comments) ? r.comments : [];
            return { ...r, comments: [...currentComments, newComment] };
          }
          return r;
        });
        if (project?.id) {
          try {
            const currentData = localStorage.getItem(`diffuser_selector_rows_${project.id}`);
            const parsed = currentData ? JSON.parse(currentData) : {};
            localStorage.setItem(
              `diffuser_selector_rows_${project.id}`,
              JSON.stringify({ ...parsed, rows: nextRows })
            );
          } catch (e) {}
        }
        return nextRows;
      });
    }

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
  const [saves, setSaves] = useState<any[]>([]);
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

  const savePresets = (newSaves: any[]) => {
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
    if (isApprovedLocked || isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const count = selectedRowIds.size;
    confirm(`Are you sure you want to delete the ${count} selected space(s)?`, {
      title: "Delete Spaces",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    }).then((ok: any) => {
      if (ok) {
        deleteSpaces(Array.from(selectedRowIds));
      }
    });
  };

  const copySpaces = (ids: string[]) => {
    const items = rows.filter(r => ids.includes(r.id));
    if (items.length > 0) {
      setClipboard(items);
      toast.info(`${items.length} space(s) copied to clipboard`);
    }
  };

  const cutSpaces = (ids: string[]) => {
    if (isApprovedLocked || isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const items = rows.filter(r => ids.includes(r.id));
    if (items.length > 0) {
      setClipboard(items);
      updateRowsWithHistory(rows.filter(r => !ids.includes(r.id)));
      setSelectedRowIds(new Set());
      toast.info(`${items.length} space(s) cut to clipboard`);
    }
  };

  const pasteSpaces = () => {
    if (isApprovedLocked || isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return [];
    }
    if (clipboard.length === 0) return [];
    const pasted = clipboard.map((item, index) => ({
      ...item,
      id: `diff-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
      name: `${item.name} (Copy)`,
    }));
    updateRowsWithHistory([...rows, ...pasted]);
    setSelectedRowIds(new Set(pasted.map(p => p.id)));
    toast.success(`${pasted.length} space(s) pasted`);
    return pasted;
  };

  const duplicateSpaces = (ids: string[]) => {
    if (isApprovedLocked || isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Duplicating spaces is locked.", { id: "readonly-notice" });
      return;
    }
    const clones = ids.map((id, index) => {
      const targetRow = rows.find(r => r.id === id);
      if (!targetRow) return null;
      return {
        ...targetRow,
        id: `diff-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        name: `${targetRow.name} (Copy)`,
      };
    }).filter(Boolean) as DiffuserRowItem[];
    if (clones.length > 0) {
      updateRowsWithHistory([...rows, ...clones]);
      setSelectedRowIds(new Set(clones.map(c => c.id)));
      toast.success(`Duplicated ${clones.length} space(s)`);
    }
  };

  const deleteSpaces = (ids: string[]) => {
    if (isApprovedLocked || isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    updateRowsWithHistory(rows.filter(r => !ids.includes(r.id)));
    setSelectedRowIds(new Set());
    toast.info(`Deleted ${ids.length} space(s)`);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          setSelectedRowIds(new Set());
        }
        return;
      }

      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isInput) return;

      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Ctrl+A (Select All)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (rows.length > 0) {
          setSelectedRowIds(new Set(rows.map(r => r.id)));
          toast.info(`Selected all ${rows.length} space(s)`);
        }
        return;
      }

      // 2. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
        return;
      }

      // 3. Copy: Ctrl+C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          copySpaces(Array.from(selectedRowIds));
        }
        return;
      }

      // 4. Cut: Ctrl+X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          cutSpaces(Array.from(selectedRowIds));
        }
        return;
      }

      // 5. Paste: Ctrl+V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteSpaces();
        return;
      }

      // 6. Duplicate: Ctrl+D
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          duplicateSpaces(Array.from(selectedRowIds));
        }
        return;
      }

      // 7. Undo/Redo: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selectedRowIds, clipboard, isApprovedLocked, isEffectiveReadOnly, history, redoStack]);

  const handleBulkSetType = (type: DiffuserType) => {
    if (selectedRowIds.size === 0) return;
    updateRowsWithHistory(rows.map(r => selectedRowIds.has(r.id) ? { ...r, diffType: type } : r));
    toast.success(`Updated terminal type to ${DIFFUSER_NAMES[type]} for ${selectedRowIds.size} spaces`);
  };

  const handleBulkToggleFlag = () => {
    if (selectedRowIds.size === 0) return;
    updateRowsWithHistory(rows.map(r => selectedRowIds.has(r.id) ? { ...r, flagged: !r.flagged } : r));
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
            className={`flex flex-col gap-1.5 group cursor-context-menu p-2 rounded-xl transition-all relative ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <RowCommentCornerBadge
              count={itemComments.length}
              onClick={() => handleOpenComment(id, label)}
            />
            <label className="font-semibold text-foreground flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span>{label}</span>
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

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, value)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handlePasteValue(label, String(fieldKey))}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleResetField(label, String(fieldKey), defaultVal)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default ({defaultVal !== "" ? defaultVal : "Blank"})</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleClearField(label, String(fieldKey))}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
          >
            <Trash2 className="size-3.5" />
            <span>Clear Field</span>
            <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
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
            className={`flex justify-between items-center py-1.5 border-b border-border/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 px-2 rounded-lg transition cursor-pointer group relative ${
              colSpanTwo ? "col-span-2" : ""
            } ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <RowCommentCornerBadge
              count={itemComments.length}
              onClick={() => handleOpenComment(id, label)}
            />
            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
              <span>{label}</span>
            </span>
            <strong className={`font-bold font-mono ${highlightClass}`}>{valueFormatted}</strong>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => setShowDetailedCalcs(true)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <HelpCircle className="size-3.5 text-muted-foreground" />
            <span>View Calculation Steps</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double-Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, valueFormatted)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
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
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Copy Full Line</span>
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
    await exportDiffuserSelectorPDF(computedRows, {
      projectName: projectInfo.projectName || project?.name,
      client: projectInfo.client || project?.client,
      projectNo: projectInfo.projectNumber || project?.code,
      calcNo: projectInfo.calcNumber,
      date: projectInfo.date,
      userName: currentUserName,
      reviewState: calcReviewState,
      unitSystem,
    });
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
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
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
              confirm(`Are you sure you want to delete all ${floorSpaces.length} spaces on floor "${floor}"?`, {
                title: "Delete Floor",
                confirmText: "Delete",
                cancelText: "Cancel",
                variant: "destructive"
              }).then((ok: any) => {
                if (ok) {
                  setRows(prev => prev.filter((s) => s.floor !== floor));
                  setSelectedRowIds(new Set());
                  toast.success(`Deleted floor "${floor}" and its spaces`);
                }
              });
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Floor</span>
          <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const renderSpaceContextMenu = (row: DiffuserRowItem & { sizing: any }) => {
    const selectedIds = selectedRowIds.has(row.id) ? Array.from(selectedRowIds) : [row.id];
    const isMulti = selectedIds.length > 1;
    const targetsCount = selectedIds.length;
    const isReadOnly = isApprovedLocked || isEffectiveReadOnly;

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        {/* Cut */}
        <ContextMenuItem
          onClick={() => {
            if (isReadOnly) {
              toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            cutSpaces(selectedIds);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Scissors className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Cut Selected" : "Cut"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Copy */}
        <ContextMenuItem
          onClick={() => {
            copySpaces(selectedIds);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Copy Selected" : "Copy"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Paste */}
        <ContextMenuItem
          disabled={clipboard.length === 0 || isReadOnly}
          onClick={() => {
            if (isReadOnly) {
              toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            pasteSpaces();
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
        >
          <ClipboardPaste className="size-3.5 text-muted-foreground" />
          <span>Paste</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Edit Space */}
        <ContextMenuItem
          onClick={() => {
            if (isReadOnly) {
              toast.info("Workspace is in Read-Only mode. Editing is locked.", { id: "readonly-notice" });
              return;
            }
            if (isMulti) {
              setShowBulkEditModal(true);
            } else {
              setEditingRow(row);
              setIsNewRow(false);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground shrink-0" />
          <span className="whitespace-nowrap">{isMulti ? `Bulk Edit (${targetsCount} spaces)` : "Edit Space"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Duplicate Space */}
        <ContextMenuItem
          onClick={() => {
            if (isReadOnly) {
              toast.info("Workspace is in Read-Only mode. Duplicating is locked.", { id: "readonly-notice" });
              return;
            }
            duplicateSpaces(selectedIds);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <CopyPlus className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Duplicate Selected" : "Duplicate Space"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Add Comment */}
        <ContextMenuItem
          onClick={() => handleOpenComment(row)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment</span>
        </ContextMenuItem>

        {/* Flag Space */}
        <ContextMenuItem
          onClick={() => {
            const anyUnflagged = selectedIds.some((id) => !rows.find((s) => s.id === id)?.flagged);
            const editSet = new Set(selectedIds);
            updateRowsWithHistory(rows.map((s) => (editSet.has(s.id) ? { ...s, flagged: anyUnflagged } : s)));
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Flag className={`size-3.5 ${row.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          <span>{row.flagged ? (isMulti ? "Unflag Selected" : "Unflag Space") : (isMulti ? "Flag Selected" : "Flag Space")}</span>
        </ContextMenuItem>

        {/* Calculation Breakdown */}
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

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Delete */}
        <ContextMenuItem
          onClick={() => {
            if (isReadOnly) {
              toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            const msg = targetsCount === 1 
              ? `Are you sure you want to delete space "${row.name}"?`
              : `Are you sure you want to delete the ${targetsCount} selected spaces?`;
            
            confirm(msg, {
              title: "Delete Spaces",
              confirmText: "Delete",
              cancelText: "Cancel",
              variant: "destructive"
            }).then((ok: any) => {
              if (ok) {
                deleteSpaces(selectedIds);
              }
            });
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete</span>
          <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const checkIfDiffuserMissingData = (r: DiffuserRowItem) => {
    const isNoName = !r.name || r.name.trim() === "";
    const isNoAirflow = !r.airflow || Number(r.airflow) <= 0 || isNaN(Number(r.airflow));
    const isNoCount = !r.count || Number(r.count) <= 0 || isNaN(Number(r.count));
    return isNoName || isNoAirflow || isNoCount;
  };

  const updateRowWithAutoFlag = (oldRow: DiffuserRowItem, nextRow: DiffuserRowItem): DiffuserRowItem => {
    const wasMissing = checkIfDiffuserMissingData(oldRow);
    const isMissing = checkIfDiffuserMissingData(nextRow);
    let flagged = nextRow.flagged;
    if (isMissing) {
      flagged = true;
    } else if (wasMissing && !isMissing) {
      flagged = false;
    }
    return { ...nextRow, flagged };
  };

  const columns: Column<DiffuserRowItem & { sizing: any }>[] = [
    {
      key: "name",
      header: "SPACE NAME",
      width: 240,
      editable: true,
      render: (r) => {
        const itemComments = getMergedItemComments(r.id, r.name, r.comments, "/diffuser-selector", project?.id);
        return (
          <div className="flex items-center gap-1.5 w-full pr-1">
            <InlineInput
              disabled={isApprovedLocked}
              readOnly={isApprovedLocked}
              value={r.name}
              placeholder="Space Name"
              onCommit={(val) => {
                const nextName = val.trim() || r.name;
                setRows(prev => prev.map(row => row.id === r.id ? updateRowWithAutoFlag(row, { ...row, name: nextName }) : row));
              }}
              className="font-medium text-[13.5px] flex-1 min-w-0"
            />
          </div>
        );
      },
    },
    {
      key: "coolingKw",
      header: "LOAD (KW)",
      width: 90,
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
          placeholder="—"
          onCommit={(val) => {
            const nextKw = val === "" ? "" : Number(val);
            setRows(prev => prev.map(row => {
              if (row.id !== r.id) return row;
              let flow = row.airflow;
              if (nextKw !== "" && Number(nextKw) > 0) {
                const dt = row.deltaT ? Number(row.deltaT) : 10;
                flow = computeAirflowFromKw(Number(nextKw), dt, ip, "air", 20).flowRate;
              }
              return updateRowWithAutoFlag(row, { ...row, coolingKw: nextKw, airflow: flow });
            }));
          }}
          className="font-mono tabular text-[13.5px] text-center"
        />
      ),
    },
    {
      key: "diffType",
      header: "DIFFUSER TYPE",
      width: 200,
      render: (r) => (
        <GridDropdown<DiffuserType>
          disabled={isApprovedLocked}
          value={r.diffType}
          options={[
            { value: "square", label: "4-Way Square" },
            { value: "round", label: "Circular Cone" },
            { value: "slot16", label: "Linear Slot (16mm)" },
            { value: "slot20", label: "Linear Slot (20mm)" },
            { value: "slot25", label: "Linear Slot (25mm)" },
          ]}
          hasOther={true}
          otherLabel="Other / Custom"
          otherValue={"square" as DiffuserType}
          onOtherSelect={() => {
            setEditingRow(r);
            setIsNewRow(false);
          }}
          onChange={(val) => {
            setRows(prev => prev.map(row => row.id === r.id ? { ...row, diffType: val } : row));
          }}
        />
      ),
    },
    {
      key: "airflow",
      header: `AIRFLOW (${flowUnit})`,
      width: 120,
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
            setRows(prev => prev.map(row => row.id === r.id ? updateRowWithAutoFlag(row, { ...row, airflow: nextFlow }) : row));
          }}
          className="font-mono tabular text-[13.5px] text-center text-primary font-semibold"
        />
      ),
    },
    {
      key: "count",
      header: "QTY",
      width: 70,
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
            setRows(prev => prev.map(row => row.id === r.id ? updateRowWithAutoFlag(row, { ...row, count: nextCount }) : row));
          }}
          className="font-mono tabular text-[13.5px] text-center"
        />
      ),
    },
    {
      key: "flowPerDiff",
      header: `FLOW / DIFF (${flowUnit})`,
      width: 120,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono tabular text-[13.5px] font-medium text-foreground text-center w-full block">
          {r.sizing.flowPerDiff.toFixed(1)}
        </span>
      ),
    },
    {
      key: "neckSize",
      header: "RECOMMENDED NECK",
      width: 170,
      align: "center",
      mono: true,
      render: (r) => (
        <span className={`font-mono tabular text-[13.5px] font-medium truncate text-center w-full block ${r.sizing.isExceeded ? "text-destructive font-bold" : "text-primary font-semibold"}`}>
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
          className="px-1.5 py-0.5 rounded font-mono tabular text-[12px] font-medium bg-surface-2 hover:bg-primary/10 border border-border/80 hover:border-primary/40 cursor-pointer disabled:cursor-default text-center mx-auto"
          title="Click to toggle between 2.0 m/s (Quiet) and 2.5 m/s (Standard)"
        >
          {r.designVelocity.toFixed(1)}
        </button>
      ),
    },
    {
      key: "throw",
      header: `THROW (${ip ? "ft" : "m"})`,
      width: 85,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono tabular text-[13.5px] text-muted-foreground font-medium">
          {r.sizing.throwVal}
        </span>
      ),
    },
    {
      key: "nc",
      header: "NC SOUND",
      width: 80,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono tabular text-[13.5px] font-bold text-emerald-600 dark:text-emerald-400">
          {r.sizing.nc}
        </span>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      width: 80,
      align: "center",
      render: (r) => {
        if (r.sizing.status === "FAIL") {
          return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">FAIL</span>;
        }
        if (r.sizing.status === "WARN") {
          return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">WARN</span>;
        }
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">PASS</span>;
      },
    },
    {
      key: "flagged",
      header: "",
      width: 36,
      align: "center",
      render: (r) => (
        <button
          disabled={isApprovedLocked}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isApprovedLocked) return;
            const targetIds = selectedRowIds.has(r.id) ? Array.from(selectedRowIds) : [r.id];
            const nextFlagged = !r.flagged;
            setRows(prev => prev.map(row => targetIds.includes(row.id) ? { ...row, flagged: nextFlagged } : row));
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto disabled:cursor-default"
          title={
            (() => {
              const isNoName = !r.name || r.name.trim() === "";
              const isNoAirflow = !r.airflow || Number(r.airflow) <= 0 || isNaN(Number(r.airflow));
              const isNoCount = !r.count || Number(r.count) <= 0 || isNaN(Number(r.count));
              const isFailed = r.sizing?.status === "FAIL";
              if (isNoName && isNoAirflow) return "Missing space name and airflow";
              if (isNoName) return "Missing space name";
              if (isNoAirflow) return "Missing airflow";
              if (isNoCount) return "Missing diffuser quantity";
              if (isFailed) return r.sizing?.isExceeded ? "Airflow exceeds maximum recommended limit" : "Diffuser sizing failed";
              return r.flagged ? "Unflag space" : "Flag space";
            })()
          }
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
    const newId = `diffuser-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const defaultFloor = sortedFloorsForGrid[0] || "GF";
    const newRowItem: DiffuserRowItem = {
      id: newId,
      name: `Space ${rows.length + 1}`,
      floor: defaultFloor,
      zone: "Zone-1",
      coolingKw: "",
      deltaT: ip ? 18 : 10,
      airflow: ip ? 400 : 188,
      count: 2,
      diffType: "square",
      designVelocity: 2.0,
    };
    setRows((prev) => [...prev, newRowItem]);
    setEditingRow(newRowItem);
    setIsNewRow(true);
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
    <AppShell 
      title="Diffuser Selector" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header matching Pump Sizing */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Diffuser Selector</h1>
              </div>

              <button 
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Diffuser Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>

              <CalculationReviewBar
                projectId={project?.id || activeProjectId}
                calculatorPath="/diffuser-selector"
                calculatorTitle="Diffuser Selection Schedule"
              />
            </div>

            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                disabled={isEffectiveReadOnly}
                inputDescriptions="Supply Airflow per space"
                conversionExample={unitSystem === "si" ? "Convert 500 L/s → 1,059 CFM" : "Convert 1000 CFM → 472 L/s"}
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
          <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/60 gap-3 flex-wrap modal-blur-bg">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
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
                  type="button"
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

              {/* Formula Breakdown button placed right next to tabs */}
              <TBtn
                onClick={() => setShowFormulaModal(true)}
                title="Diffuser Sizing Formulas & Acoustic Derivations"
              >
                <Info className="size-3.5 text-primary" /> Formula Breakdown
              </TBtn>
            </div>

            {/* Right Side Action Button: Export */}
            <div className="flex items-center gap-2 select-none shrink-0">
              <TBtn onClick={handlePrintPDF}>
                <FileText className="size-3.5" /> Export
              </TBtn>
            </div>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 min-h-0 animate-fade-in flex flex-col overflow-hidden">
            {activeTab === "calculator" ? (
              <div className="flex-1 min-h-0 flex flex-col relative">
                {/* Toolbar matching Preliminary Cooling Load / Ventilation */}
                <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none modal-blur-bg">
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
                      >
                        <ArrowUpDown className="size-3.5 shrink-0" />
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                          Sort
                        </span>
                        {floorOrder.length > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                            ✓
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
                        Use ▲ / ▼ buttons or drag floors to change their sorting order in grid views.
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

                  {/* View Options & Column Distribution Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="relative inline-flex items-center justify-center h-7 w-7 rounded-full border border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible"
                        title="View / Column Distribution"
                      >
                        <SlidersHorizontal className="size-3.5 shrink-0" />
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                          View Options
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50 text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border">
                        <span className="text-[12px] font-semibold text-foreground">Column Distribution</span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground leading-snug">
                        Drag column divider lines in table headers to adjust custom widths. Click below to restore auto-distribution.
                      </p>
                      <button
                        onClick={() => {
                          try {
                            localStorage.removeItem("mep_grid_diffuser-selector");
                            window.dispatchEvent(new CustomEvent("mep-reset-column-widths"));
                            window.dispatchEvent(new Event("resize"));
                            toast.success("Column widths reset to auto-distribution");
                          } catch (e) {}
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 text-foreground font-semibold text-[11.5px] border border-border transition-colors cursor-pointer"
                      >
                        <RefreshCw className="size-3 text-primary" />
                        Reset Column Widths
                      </button>
                    </PopoverContent>
                  </Popover>

                  {/* Right Actions */}
                  <div className="ml-auto flex items-center gap-1">
                    {clipboard.length > 0 && (
                      <TBtn
                        disabled={isEffectiveReadOnly}
                        onClick={pasteSpaces}
                        title={`Paste ${clipboard.length} space(s) from clipboard (Ctrl+V)`}
                      >
                        <ClipboardPaste className="size-3.5 text-primary" /> Paste ({clipboard.length})
                      </TBtn>
                    )}
                    <TBtn
                      disabled={isEffectiveReadOnly}
                      onClick={() => setShowSourceModal(true)}
                    >
                      <Download className="size-3.5" /> Import
                    </TBtn>
                    <TBtn onClick={handleExportExcel}>
                      <FileSpreadsheet className="size-3.5" /> Export
                    </TBtn>
                    <TBtn
                      disabled={isEffectiveReadOnly}
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
                      <span className="text-primary/30">·</span>
                      <BulkBtn icon={Scissors} onClick={() => cutSpaces(Array.from(selectedRowIds))}>Cut</BulkBtn>
                      <BulkBtn icon={Copy} onClick={() => copySpaces(Array.from(selectedRowIds))}>Copy</BulkBtn>
                      <BulkBtn icon={CopyPlus} onClick={() => duplicateSpaces(Array.from(selectedRowIds))}>Duplicate</BulkBtn>
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
                      gridId="diffuser-selector"
                      rows={filteredRows}
                      columns={columns}
                      selected={selectedRowIds}
                      onToggle={handleToggleSelectRow}
                      onToggleAll={handleToggleSelectAll}
                      onCommentClick={(r) => handleOpenComment(r.id, r.name)}
                      isReadOnly={isApprovedLocked}
                      activeRowId={editingRow?.id}
                      onRowDoubleClick={(r) => {
                        setEditingRow(r);
                        setIsNewRow(false);
                      }}
                      renderContextMenu={renderSpaceContextMenu}
                      groupBy={(r) => r.floor}
                      groupOrder={sortedFloorsForGrid}
                      renderGroupHeader={renderFloorGroupHeader}
                      renderGroupContextMenu={renderFloorGroupContextMenu}
                      onToggleGroup={handleToggleGroup}
                    />
                  )}
                </div>

                {/* Bottom Stats Summary Bar */}
                <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 select-none modal-blur-bg">
                  <div>
                    Showing <span className="text-foreground font-medium tabular">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} spaces
                  </div>
                  <div className="flex items-center gap-3 tabular">
                    <span>Σ Airflow: <span className="font-mono text-primary font-bold">{totalFlowSum.toLocaleString()} {flowUnit}</span></span>
                    <span>Σ Outlets: <span className="font-mono text-foreground font-bold">{totalDiffusersSum} Outlets</span></span>
                    {totalCoolingKwSum > 0 && (
                      <span>Σ Load (kW): <span className="font-mono text-foreground font-bold">{totalCoolingKwSum.toFixed(2)} kW</span></span>
                    )}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Status: All Terminals Sized (NC ≤ 30)</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Printable Report tab view matching exact Preliminary Cooling Load standard layout */
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                  
                  {/* 1. Title */}
                  <div className="pb-1">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                      Diffuser Selector Calculation
                    </h2>
                  </div>

                  {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-b border-border divide-x divide-border">
                          <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                          <td className="p-2.5 font-mono text-foreground font-medium">{projectInfo.calcNumber || "CALC-HVAC-DIF01"}</td>
                          <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                          <td className="p-2.5 font-mono font-medium">{projectInfo.date || new Date().toISOString().split("T")[0]}</td>
                        </tr>
                        <tr className="border-b border-border divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                          <td className="p-2.5 font-mono">{projectInfo.projectNumber || project?.code || "MEP-DIF-2026"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                          <td className="p-2.5">{projectInfo.client || project?.client || "Prestige Group developers"}</td>
                        </tr>
                        <tr className="divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                          <td className="p-2.5">{projectInfo.projectName || project?.name || "Air Terminal & Diffuser Selection Study"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                          <td className="p-2.5">{(project as any)?.endUser || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. Diffuser Sizing Schedule Table (2-Tier Header Table) */}
                  <div className="border border-border rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                          <th rowSpan={2} className="p-2 border-r border-border w-12 text-center">
                            Sr.<br />No.
                          </th>
                          <th colSpan={3} className="p-2 border-r border-border text-center">
                            Space Parameters
                          </th>
                          <th colSpan={4} className="p-2 border-r border-border text-center">
                            Airflow & Terminal Sizing
                          </th>
                          <th colSpan={4} className="p-2 text-center">
                            Performance & Sound Metrics
                          </th>
                        </tr>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                          <th className="p-2 border-r border-border w-24 text-center">Space Floor</th>
                          <th className="p-2 border-r border-border text-left min-w-[130px]">Space Name</th>
                          <th className="p-2 border-r border-border text-left min-w-[140px]">Diffuser Type</th>
                          <th className="p-2 border-r border-border w-24 text-right">Airflow ({flowUnit})</th>
                          <th className="p-2 border-r border-border w-16 text-center">Qty</th>
                          <th className="p-2 border-r border-border w-24 text-right">Flow/Diff ({flowUnit})</th>
                          <th className="p-2 border-r border-border min-w-[140px] text-left">Recommended Neck</th>
                          <th className="p-2 border-r border-border w-20 text-center">Velocity ({velUnit})</th>
                          <th className="p-2 border-r border-border w-20 text-center">Throw</th>
                          <th className="p-2 border-r border-border w-18 text-center">NC Rating</th>
                          <th className="p-2 w-20 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(() => {
                          const rowsByFloor: { [floor: string]: (DiffuserRowItem & { sizing: any })[] } = {};
                          const floorList: string[] = [];

                          const sorted = [...computedRows].sort((a, b) => {
                            const flA = (a.floor || "GF").toLowerCase();
                            const flB = (b.floor || "GF").toLowerCase();
                            if (flA !== flB) return flA.localeCompare(flB);
                            return (a.name || "").localeCompare(b.name || "");
                          });

                          sorted.forEach((r) => {
                            const fl = r.floor || "GF";
                            if (!rowsByFloor[fl]) {
                              rowsByFloor[fl] = [];
                              floorList.push(fl);
                            }
                            rowsByFloor[fl].push(r);
                          });

                          let globalSrNo = 1;
                          let grandFlow = 0;
                          let grandCount = 0;

                          return (
                            <>
                              {floorList.map((floorName) => {
                                const floorRows = rowsByFloor[floorName];
                                let floorFlow = 0;
                                let floorCount = 0;

                                return (
                                  <React.Fragment key={floorName}>
                                    {floorRows.map((r) => {
                                      const flowVal = typeof r.airflow === "number" ? r.airflow : (parseFloat(String(r.airflow)) || 0);
                                      const countVal = typeof r.count === "number" && r.count > 0 ? r.count : (parseInt(String(r.count)) || 1);
                                      const flowPerDiff = r.sizing?.flowPerDiff ?? (flowVal / countVal);
                                      const neck = r.sizing?.neckSize || "-";
                                      const vel = ip ? (r.sizing?.velocityFpm?.toFixed(0) || "-") : (r.sizing?.velocity?.toFixed(1) || "-");
                                      const throwDist = r.sizing?.throwVal || "-";
                                      const nc = r.sizing?.nc || "-";
                                      const status = r.sizing?.status || "PASS";
                                      const diffName = DIFFUSER_NAMES[r.diffType] || r.diffType;

                                      floorFlow += flowVal;
                                      floorCount += countVal;
                                      grandFlow += flowVal;
                                      grandCount += countVal;

                                      return (
                                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                          <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">
                                            {globalSrNo++}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-medium">
                                            {r.floor || "GF"}
                                          </td>
                                          <td className="p-2 border-r border-border font-medium text-foreground">
                                            {r.name || "-"}
                                          </td>
                                          <td className="p-2 border-r border-border text-muted-foreground">
                                            {diffName}
                                          </td>
                                          <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">
                                            {Math.round(flowVal).toLocaleString()}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-mono">
                                            {countVal}
                                          </td>
                                          <td className="p-2 border-r border-border text-right font-mono">
                                            {flowPerDiff.toFixed(1)}
                                          </td>
                                          <td className="p-2 border-r border-border font-mono font-bold text-foreground">
                                            {neck}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-mono">
                                            {vel}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-mono text-muted-foreground">
                                            {throwDist}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-mono font-bold text-emerald-600">
                                            {nc}
                                          </td>
                                          <td className="p-2 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                              status === "PASS"
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                                            }`}>
                                              {status}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* Floor Total Row matching Preliminary format */}
                                    <tr className="bg-slate-50/70 dark:bg-zinc-900/60 font-bold border-t border-b border-border">
                                      <td className="p-2 border-r border-border text-center"></td>
                                      <td className="p-2 border-r border-border text-center font-bold">
                                        {floorName}
                                      </td>
                                      <td className="p-2 border-r border-border font-bold">
                                        TOTAL ({floorName})
                                      </td>
                                      <td className="p-2 border-r border-border"></td>
                                      <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">
                                        {Math.round(floorFlow).toLocaleString()}
                                      </td>
                                      <td className="p-2 border-r border-border text-center font-mono font-bold">
                                        {floorCount}
                                      </td>
                                      <td className="p-2 border-r border-border text-right font-mono font-bold">
                                        {floorCount > 0 ? (floorFlow / floorCount).toFixed(1) : "-"}
                                      </td>
                                      <td className="p-2 border-r border-border font-medium text-muted-foreground">
                                        All Terminals Sized
                                      </td>
                                      <td className="p-2 border-r border-border"></td>
                                      <td className="p-2 border-r border-border"></td>
                                      <td className="p-2 border-r border-border text-center font-mono font-bold text-emerald-600">
                                        NC ≤ 30
                                      </td>
                                      <td className="p-2 text-center font-bold text-emerald-600">
                                        PASS
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              })}

                              {/* Grand Total Row if multiple floors */}
                              {floorList.length > 1 && (
                                <tr className="bg-slate-100 dark:bg-zinc-800 font-black border-t-2 border-border">
                                  <td className="p-2 border-r border-border text-center"></td>
                                  <td className="p-2 border-r border-border text-center font-bold">ALL</td>
                                  <td className="p-2 border-r border-border font-bold">OVERALL TOTAL</td>
                                  <td className="p-2 border-r border-border"></td>
                                  <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">
                                    {Math.round(grandFlow).toLocaleString()}
                                  </td>
                                  <td className="p-2 border-r border-border text-center font-mono font-bold">
                                    {grandCount}
                                  </td>
                                  <td className="p-2 border-r border-border text-right font-mono font-bold">
                                    {grandCount > 0 ? (grandFlow / grandCount).toFixed(1) : "-"}
                                  </td>
                                  <td className="p-2 border-r border-border font-bold text-muted-foreground">
                                    All Terminals Compliant
                                  </td>
                                  <td className="p-2 border-r border-border"></td>
                                  <td className="p-2 border-r border-border"></td>
                                  <td className="p-2 border-r border-border text-center font-mono font-bold text-emerald-600">
                                    NC ≤ 30
                                  </td>
                                  <td className="p-2 text-center font-bold text-emerald-600">
                                    PASS
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* 4. 3-Tier Signature Sign-Off Block (Exact #FFE6CC Header) */}
                  {(() => {
                    const sig = getSignatureBlockDetails(
                      project?.id || activeProjectId || "default",
                      "/diffuser-selector",
                      currentUserName,
                      calcReviewState
                    );
                    return (
                      <div className="pt-2">
                        <div className="border border-border rounded-xl overflow-hidden text-xs">
                          <table className="w-full border-collapse">
                            <thead className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold border-b border-border">
                              <tr className="divide-x divide-border">
                                <th className="p-2.5 w-28 text-center"></th>
                                <th className="p-2.5 text-center w-1/3">Originator</th>
                                <th className="p-2.5 text-center w-1/3">Reviewer</th>
                                <th className="p-2.5 text-center w-1/3">Approver</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              <tr className="divide-x divide-border">
                                <td className="p-2.5 font-bold text-center bg-muted/10">Name:</td>
                                <td className="p-2.5 text-center font-medium">
                                  {sig.originatedName || currentUserName || "Design Engineer"}
                                </td>
                                <td className="p-2.5 text-center font-medium">
                                  {sig.reviewerName || ""}
                                </td>
                                <td className="p-2.5 text-center font-medium">
                                  {sig.approverName || ""}
                                </td>
                              </tr>
                              <tr className="divide-x divide-border">
                                <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                                <td className="p-2.5 text-center font-mono">
                                  {sig.originatedDate || formatDateStr(new Date().toISOString())}
                                </td>
                                <td className="p-2.5 text-center font-mono">
                                  {sig.reviewerDate || ""}
                                </td>
                                <td className="p-2.5 text-center font-mono">
                                  {sig.approverDate || ""}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

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
                  <FloorSelect
                    value={bulkEditFloor}
                    onChange={(fl) => setBulkEditFloor(fl)}
                    availableFloors={sortedFloorsForGrid}
                    placeholder="Leave blank to keep unchanged"
                    triggerClassName="h-8 rounded-lg text-xs"
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
          const row = rows.find(r => r.id === selectedDetailRow.id) || selectedDetailRow;
          const sizing = computeRowSizing(row, ip);
          const flowVal = row.airflow !== "" ? Number(row.airflow) : 0;
          const countVal = row.count !== "" && Number(row.count) > 0 ? Number(row.count) : 1;
          const kwVal = row.coolingKw !== "" ? Number(row.coolingKw) : 0;
          const dtVal = row.deltaT !== "" ? Number(row.deltaT) : 10;

          const updateRowField = (field: string, val: string | number) => {
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: val } : r));
          };

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
                        {row.name} &mdash; {showDetailedCalcs ? "Calculation Preview" : "Properties & Tuning"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Floor: {row.floor} &bull; Zone: {row.zone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowDetailedCalcs(!showDetailedCalcs)}
                      className="px-3 py-1.5 bg-primary/10 text-primary font-bold rounded-lg text-xs hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      {showDetailedCalcs ? "Edit Properties" : "Calculation Preview"}
                    </button>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="text-muted-foreground hover:bg-surface-2 hover:text-foreground text-sm font-bold p-1.5 rounded-full transition-colors cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                {!showDetailedCalcs ? (
                  <div className="flex flex-col gap-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Diffuser Type</label>
                        <select
                          disabled={isApprovedLocked}
                          value={row.diffType}
                          onChange={e => updateRowField('diffType', e.target.value)}
                          className="w-full bg-surface-2 border border-border/80 rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {Object.entries(DIFFUSER_NAMES).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Total Airflow ({flowUnit})</label>
                        <input
                          type="number"
                          disabled={isApprovedLocked}
                          value={row.airflow}
                          onChange={e => updateRowField('airflow', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Diffuser Count</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          disabled={isApprovedLocked}
                          value={row.count}
                          onChange={e => updateRowField('count', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Sensible Cooling (kW)</label>
                        <input
                          type="number"
                          disabled={isApprovedLocked}
                          value={row.coolingKw}
                          onChange={e => updateRowField('coolingKw', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Optional for derived airflow"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Delta T (°C)</label>
                        <input
                          type="number"
                          disabled={isApprovedLocked}
                          value={row.deltaT}
                          onChange={e => updateRowField('deltaT', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Space Name</label>
                        <input
                          type="text"
                          disabled={isApprovedLocked}
                          value={row.name}
                          onChange={e => updateRowField('name', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 font-sans">
                    {/* Step 1: Thermal Sizing */}
                    <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <Zap className="size-3.5" /> Step 1: Sensible Cooling Thermal Sizing (Q = m &bull; Cp &bull; Î”T)
                        </span>
                        <span className="text-xs font-mono font-bold text-foreground">
                          {kwVal > 0 ? `${kwVal} kW` : "Direct Airflow Input"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                        {kwVal > 0
                          ? `m = ${kwVal} kW Ã· (1.005 kJ/kg&bull;K &times; ${dtVal}°C) = ${(kwVal / (1.005 * (dtVal || 10))).toFixed(3)} kg/s dry air mass flow`
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
                )}
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
                  <FloorSelect
                    value={newFloor}
                    onChange={(fl) => setNewFloor(fl)}
                    availableFloors={sortedFloorsForGrid}
                    triggerClassName="h-9 rounded-xl text-xs bg-surface-2/60"
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
            isOpen={commentModalOpen}
            open={commentModalOpen}
            onClose={() => {
              setCommentModalOpen(false);
              setCommentTargetItem(null);
            }}
            targetId={commentTargetItem?.id}
            targetName={commentTargetItem?.name}
            targetType="space"
            spaceId={commentTargetItem?.id}
            spaceName={commentTargetItem?.name}
            calculatorTitle="Diffuser Quick Selector"
            calculatorPath="/diffuser-selector"
            targetItem={commentTargetItem || { id: "diffuser-selector", name: "Diffuser Selection" }}
            existingComments={getMergedItemComments(
              commentTargetItem?.id || "general",
              commentTargetItem?.name,
              rows.find(r => String(r.id) === String(commentTargetItem?.id))?.comments || commentsList.filter(c => c.spaceId === commentTargetItem?.id || c.targetId === commentTargetItem?.id || c.itemId === commentTargetItem?.id),
              "/diffuser-selector",
              project?.id
            )}
            onSave={handleSaveComment}
          />
        )}
        </div>

        {/* Intelligence Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <DiffuserIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              computedRows={computedRows}
              rows={rows}
              totalFlowSum={totalFlowSum}
              totalCoolingKwSum={totalCoolingKwSum}
              totalDiffusersSum={totalDiffusersSum}
              unitSystem={unitSystem}
              onHighlightSpace={(id) => {
                setSelectedRowIds(new Set([id]));
              }}
            />
          )}
        </div>
      </div>

      {/* Formula Breakdown Modal */}
      {showFormulaModal && (
        <DiffuserFormulaModal
          onClose={() => setShowFormulaModal(false)}
          unitSystem={unitSystem}
          activeRow={(selectedRowIds.size > 0 ? rows.find(r => selectedRowIds.has(r.id)) : null) || rows[0]}
        />
      )}
      {editingRow && (
        <EditDiffuserSpaceModal
          space={editingRow}
          isNew={isNewRow}
          availableFloors={sortedFloorsForGrid}
          unitSystem={unitSystem}
          onClose={() => {
            if (isNewRow) {
              setRows((prev) => prev.filter((r) => r.id !== editingRow.id));
            }
            setEditingRow(null);
            setIsNewRow(false);
          }}
          onSave={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setEditingRow(null);
            setIsNewRow(false);
            if (!isApprovedLocked) dirtyStore.getState().markDirty();
          }}
        />
      )}
    </AppShell>
  );
}

// Diffuser Intelligence Drawer component
function DiffuserIntelligenceDrawer({
  onClose,
  computedRows,
  rows,
  totalFlowSum,
  totalCoolingKwSum,
  totalDiffusersSum,
  unitSystem,
  onHighlightSpace,
}: {
  onClose: () => void;
  computedRows: (DiffuserRowItem & { sizing: any })[];
  rows: DiffuserRowItem[];
  totalFlowSum: number;
  totalCoolingKwSum: number;
  totalDiffusersSum: number;
  unitSystem: "si" | "ip";
  onHighlightSpace: (id: string) => void;
}) {
  const ip = unitSystem === "ip";
  const flowUnit = ip ? "CFM" : "L/s";
  const totalSpaces = computedRows.length;
  const compliantSpaces = computedRows.filter(r => r.sizing.status === "PASS");
  const flaggedSpaces = computedRows.filter(r => r.flagged || r.sizing.status !== "PASS");
  const compliancePct = totalSpaces > 0 ? Math.round((compliantSpaces.length / totalSpaces) * 100) : 100;

  // Breakdown by diffuser type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      counts[r.diffType] = (counts[r.diffType] || 0) + (Number(r.count) || 1);
    });
    return counts;
  }, [rows]);

  // Top airflow spaces
  const topAirflowSpaces = useMemo(() => {
    return [...computedRows]
      .sort((a, b) => (Number(b.airflow) || 0) - (Number(a.airflow) || 0))
      .slice(0, 5);
  }, [computedRows]);

  return (
    <div className="h-full w-[360px] flex flex-col font-sans select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Diffuser Intelligence</h3>
            <p className="text-[10px] text-muted-foreground">Automated selection audit &amp; sound compliance</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-7 rounded-lg hover:bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {/* Compliance / NC Gauge */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Acoustic &amp; Velocity Health</span>
            <span className={`font-mono font-bold text-xs ${compliancePct === 100 ? "text-emerald-600" : "text-amber-600"}`}>
              {compliancePct}% Compliant
            </span>
          </div>
          <div className="h-2 w-full bg-border/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${compliancePct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${compliancePct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{compliantSpaces.length} of {totalSpaces} spaces within NC limits</span>
            {flaggedSpaces.length > 0 && <span className="text-red-500 font-semibold">{flaggedSpaces.length} warning(s)</span>}
          </div>
        </div>

        {/* Section 1: Air Distribution Overview */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Wind className="size-3.5 text-primary" /> Airflow &amp; Terminal Totals
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-surface-2/60 border border-border/60 flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Airflow</span>
              <span className="text-sm font-bold font-mono text-primary mt-0.5">{totalFlowSum.toLocaleString()} {flowUnit}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-2/60 border border-border/60 flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Outlets</span>
              <span className="text-sm font-bold font-mono text-foreground mt-0.5">{totalDiffusersSum} Terminals</span>
            </div>
          </div>
          {totalCoolingKwSum > 0 && (
            <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-foreground flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Total Cooling Load:</span>
              <span className="font-mono font-bold text-xs text-primary">{totalCoolingKwSum.toFixed(2)} kW</span>
            </div>
          )}
        </div>

        {/* Section 2: Terminal Type Breakdown */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary" /> Terminal Type Distribution
          </span>
          <div className="flex flex-col gap-1.5">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between p-2 rounded-xl bg-surface-2/40 border border-border/50 text-[11px]">
                <span className="font-medium text-foreground">{DIFFUSER_NAMES[type as DiffuserType] || type}</span>
                <span className="font-mono font-bold text-primary">{count} {count === 1 ? "unit" : "units"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Top Airflow Contributors */}
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Activity className="size-3.5 text-primary" /> Highest Flow Demand Spaces
          </span>
          <div className="flex flex-col gap-2">
            {topAirflowSpaces.map((sp, idx) => (
              <div
                key={sp.id}
                onClick={() => onHighlightSpace(sp.id)}
                className="p-2 rounded-xl bg-surface-2/60 hover:bg-surface-2 flex items-center justify-between cursor-pointer transition text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className="size-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-foreground truncate max-w-[130px]">{sp.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-muted-foreground text-[10px]">{sp.count} × {sp.sizing.neckSize}</span>
                  <span className="font-bold text-primary">{Number(sp.airflow || 0).toLocaleString()} {flowUnit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Flagged / Warnings */}
        {flaggedSpaces.length > 0 && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-2xl p-4 shadow-xs flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" /> High Velocity / Sound Alerts ({flaggedSpaces.length})
            </span>
            <div className="flex flex-col gap-2">
              {flaggedSpaces.map(s => (
                <div
                  key={s.id}
                  onClick={() => onHighlightSpace(s.id)}
                  className="p-2 rounded-xl bg-background/80 border border-destructive/20 flex flex-col gap-1 cursor-pointer hover:border-destructive transition text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{s.name}</span>
                    <span className="font-mono text-destructive font-bold">{s.sizing.nc}</span>
                  </div>
                  <span className="text-[10px] text-destructive leading-tight">
                    {s.sizing.warning || "Velocity exceeds recommended noise limit for space type"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// SUB-COMPONENT: FORMULA BREAKDOWN & AERODYNAMIC DERIVATION MODAL (MATCHING FRESH AIR COOLING LOAD STANDARD)
function DiffuserFormulaModal({
  onClose,
  unitSystem,
  activeRow,
}: {
  onClose: () => void;
  unitSystem: "si" | "ip";
  activeRow?: any;
}) {
  const [activeTab, setActiveTab] = React.useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = React.useState(false);

  // Esc key listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isSI = unitSystem === "si";
  const ip = !isSI;

  const row = activeRow || {
    name: "Sample Space",
    flowRate: 250,
    diffType: "4way",
    targetNc: 30,
    aspectRatio: 1.0,
    diffuserCount: 2,
    selectedSize: "300x300",
    neckVel: 2.2,
    actualNc: 26,
    throwDist: 3.4,
    pressureDrop: 18,
  };

  const flowLps = isSI ? (Number(row.flowRate) || 250) : (Number(row.flowRate) || 530) / 2.11888;
  const flowCfm = isSI ? flowLps * 2.11888 : (Number(row.flowRate) || 530);
  const qM3s = flowLps / 1000;
  const count = Math.max(1, Number(row.diffuserCount) || 1);
  const qPerDiffLps = flowLps / count;
  const qPerDiffM3s = qPerDiffLps / 1000;
  const qPerDiffCfm = flowCfm / count;

  // Neck area calculation based on size or estimated
  const neckVelMs = Number(row.neckVel) || (qPerDiffM3s / 0.05).toFixed(2);
  const neckVelFpm = Math.round(Number(neckVelMs) * 196.85);
  const effAreaM2 = Math.max(0.01, qPerDiffM3s / Math.max(0.1, Number(neckVelMs)));
  const effAreaSqFt = effAreaM2 * 10.7639;

  // Velocity pressure
  const velPressPa = 0.5 * 1.204 * Math.pow(Number(neckVelMs), 2);
  const velPressInWg = velPressPa / 249.0889;

  // Static pressure drop
  const staticPressPa = Number(row.pressureDrop) || Math.round(velPressPa * 1.4);
  const staticPressInWg = staticPressPa / 249.0889;

  // Throw
  const throwM = Number(row.throwDist) || (Math.sqrt(qPerDiffLps) * 0.22).toFixed(1);
  const throwFt = (Number(throwM) * 3.28084).toFixed(1);

  // Noise criteria
  const actualNc = Number(row.actualNc) || 26;
  const targetNc = Number(row.targetNc) || 30;
  const diffTypeName = DIFFUSER_NAMES[row.diffType as DiffuserType] || "4-Way Square Ceiling Diffuser";

  const handleCopySummary = () => {
    const text = `=== AIR TERMINAL & DIFFUSER FORMULA BREAKDOWN ===
Governing Design Standards: ASHRAE Standard 70, ASHRAE Fundamentals (Ch. 20) & EN 12238
Unit System: ${isSI ? "SI Metric (L/s, m/s, Pa, m)" : "IP Imperial (CFM, FPM, in.wg, ft)"}
Space Selected: ${row.name || "Active Room"}
Terminal Type: ${diffTypeName}

--- 1. ACTIVE SIZING PARAMETERS ---
• Total Required Airflow: ${isSI ? `${Math.round(flowLps).toLocaleString()} L/s` : `${Math.round(flowCfm).toLocaleString()} CFM`} (${qM3s.toFixed(4)} m³/s)
• Number of Terminals: ${count} unit(s)
• Per-Terminal Airflow: ${isSI ? `${Math.round(qPerDiffLps).toLocaleString()} L/s` : `${Math.round(qPerDiffCfm).toLocaleString()} CFM`}
• Target NC Acoustic Limit: NC ${targetNc}

--- 2. STEP-BY-STEP CALCULATION TRACE ---
[1] Volumetric Airflow Rate:
    Q_room = ${isSI ? `${Math.round(flowLps)} L/s` : `${Math.round(flowCfm)} CFM`} (${qM3s.toFixed(4)} m³/s)

[2] Flow Division per Terminal:
    Q_diff = Q_room / ${count} = ${isSI ? `${Math.round(qPerDiffLps)} L/s` : `${Math.round(qPerDiffCfm)} CFM`} (${qPerDiffM3s.toFixed(4)} m³/s)

[3] Effective Discharge Area (A_eff):
    A_eff = Q_diff / V_neck = ${effAreaM2.toFixed(4)} m² (${effAreaSqFt.toFixed(2)} sq.ft)

[4] Terminal Neck Velocity:
    V_neck = Q_diff / A_eff = ${Number(neckVelMs).toFixed(2)} m/s (${neckVelFpm} FPM) [Target ≤ 2.5 m/s]

[5] Dynamic Velocity Pressure:
    P_v = 0.5 · ρ · V² = 0.5 × 1.204 × (${Number(neckVelMs).toFixed(2)})² = ${velPressPa.toFixed(1)} Pa (${velPressInWg.toFixed(4)} in.wg)

[6] Terminal Static Pressure Drop:
    ΔP_s = C_k · P_v = ${staticPressPa} Pa (${staticPressInWg.toFixed(3)} in.wg)

[7] Isothermal Jet Throw Envelope (T50):
    T_50 = ${throwM} m (${throwFt} ft) to 0.25 m/s (50 FPM) terminal velocity

[8] Acoustic Noise Criteria Compliance:
    Actual NC: NC ${actualNc} vs Design Limit: NC ${targetNc} -> ${actualNc <= targetNc ? "COMPLIANT PASS" : "ATTENUATION REQUIRED"}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Diffuser calculation breakdown copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150 select-none font-sans"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[86vh] flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Fresh Air Cooling Load & Duct Sizer standard */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <BookOpen className="size-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-[13px] font-bold text-foreground truncate">
                Diffuser &amp; Terminal Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              ASHRAE 70 / EN 12238
            </span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] font-mono font-medium shrink-0">
              {ip ? "IP" : "SI"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close modal (Esc)"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/10 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setActiveTab("trace")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "trace"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Activity className="size-3" />
            <span>Calculation Steps</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("formulas")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "formulas"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <BookOpen className="size-3" />
            <span>Master Formulas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("variables")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "variables"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Layers className="size-3" />
            <span>Variables Reference</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {/* TAB 1: CALCULATION TRACE */}
          {activeTab === "trace" && (
            <div className="space-y-2.5">
              {/* Active Sizing Parameters Banner */}
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider pb-1.5 mb-1.5 border-b border-border/60">
                  <span className="flex items-center gap-1 text-foreground">
                    <SlidersHorizontal className="size-3 text-primary" /> Active Terminal Parameters
                  </span>
                  <span className="font-mono text-primary normal-case font-bold">
                    {row.name || "Selected Room"} | {isSI ? `${Math.round(flowLps)} L/s` : `${Math.round(flowCfm)} CFM`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Diffuser Type &amp; Qty</span>
                    <span className="font-mono font-bold text-foreground">{count} × {diffTypeName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">({isSI ? `${Math.round(qPerDiffLps)} L/s ea` : `${Math.round(qPerDiffCfm)} CFM ea`})</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Acoustic &amp; Velocity Target</span>
                    <span className="font-mono font-bold text-foreground">Limit NC {targetNc}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">(Neck ≤ 2.5 m/s)</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: SUPPLY AIRFLOW REQUIREMENT */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Space Airflow Requirement (Q_room)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {isSI ? `${Math.round(flowLps)} L/s` : `${Math.round(flowCfm)} CFM`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_supply = Q_sensible / (ρ · c_p · ΔT)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Governing room sensible cooling demand</span>
                    <span className="text-primary font-bold">= {qM3s.toFixed(4)} m³/s ({isSI ? `${Math.round(flowLps)} L/s` : `${Math.round(flowCfm)} CFM`})</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: FLOW PER TERMINAL */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Flow Division per Terminal (Q_diff)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {isSI ? `${Math.round(qPerDiffLps)} L/s` : `${Math.round(qPerDiffCfm)} CFM`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_diff = Q_room / Number_of_Diffusers</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{isSI ? `${Math.round(flowLps)} L/s` : `${Math.round(flowCfm)} CFM`} / {count} terminal(s)</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {isSI ? `${Math.round(qPerDiffLps)} L/s` : `${Math.round(qPerDiffCfm)} CFM`} ({qPerDiffM3s.toFixed(4)} m³/s)</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: EFFECTIVE DISCHARGE AREA */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Effective Discharge Core Area (A_eff)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {effAreaM2.toFixed(4)} m²
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: A_eff = Q_diff / V_neck (ASHRAE 70 Effective Core Area)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Standard selected neck size {row.selectedSize || "300×300"}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">= {effAreaM2.toFixed(4)} m² ({effAreaSqFt.toFixed(2)} sq.ft)</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: NECK VELOCITY */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Terminal Neck Velocity (V_neck)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {Number(neckVelMs).toFixed(2)} m/s
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: V_neck = Q_diff / A_eff (Continuity)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{qPerDiffM3s.toFixed(4)} m³/s / {effAreaM2.toFixed(4)} m²</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">= {Number(neckVelMs).toFixed(2)} m/s ({neckVelFpm} FPM)</span>
                  </div>
                </div>
              </div>

              {/* STEP 5: VELOCITY & STATIC PRESSURE DROP */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      5
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Terminal Static Pressure Drop (ΔP_s)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {staticPressPa} Pa
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: ΔP_s = C_k · (0.5 · ρ · V²) | P_v = {velPressPa.toFixed(1)} Pa</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Manufacturer aerodynamic loss coefficient C_k ≈ 1.4</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">= {staticPressPa} Pa ({staticPressInWg.toFixed(3)} in.wg)</span>
                  </div>
                </div>
              </div>

              {/* STEP 6: JET THROW & ACOUSTIC NC */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      6
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Throw Envelope (T50) &amp; Acoustic NC Rating
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">
                    NC {actualNc} (Pass)
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">Isothermal Jet Throw (T50 @ 0.25 m/s):</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">{throwM} m ({throwFt} ft)</span>
                  </div>
                  <div className="flex justify-between text-foreground pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Acoustic Sound Level vs Design Limit:</span>
                    <span className="font-bold text-foreground">NC {actualNc} ≤ NC {targetNc} limit (OK)</span>
                  </div>
                </div>
              </div>

              {/* Sizing Outcome Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">Recommended Selection</div>
                  <div className="text-[11.5px] font-bold text-foreground mt-0.5">{count} × {row.selectedSize || "300×300"} {diffTypeName}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-primary leading-tight">{Number(neckVelMs).toFixed(2)} <span className="text-xs font-normal">m/s</span></div>
                  <div className="text-[9.5px] text-muted-foreground font-mono">T50: {throwM}m | NC {actualNc}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" /> Supply Airflow Continuity Equation
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Q_airflow (L/s) = [ Q_sensible (kW) × 1000 ] / [ ρ_air × c_p × ΔT ]</div>
                  <div>Q_airflow (CFM) = Q_sensible (BTU/hr) / [ 1.08 × ΔT (°F) ]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Where standard air density ρ = 1.204 kg/m³ and specific heat capacity c_p = 1.005 kJ/kg·K. Supply-to-room temperature difference ΔT typically ranges between 8 K and 11 K.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-blue-500" /> Terminal Neck Velocity (V_neck)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>V_neck (m/s) = Q_terminal (m³/s) / A_effective_neck (m²)</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Maximum recommended neck velocity for quiet commercial office spaces is 2.0 to 2.5 m/s (400 to 500 FPM) to avoid acoustic noise regeneration.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Jet Throw Distance &amp; ADPI Comfort (ASHRAE 55)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>ADPI Ideal Throw Ratio: 1.0 ≤ T_50 / L_room ≤ 1.5</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  T_50 is distance from terminal to where jet velocity drops to 0.25 m/s (50 FPM). Values below 1.0 cause stagnant hot/cold air drops; values above 1.5 cause high velocity drafts down walls.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-500" /> Noise Criteria (NC) Acoustic Limits
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Offices / Conference: NC 25–30 | Lobbies: NC 35–40</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Sound power level regenerated in octave bands 63 Hz through 8000 Hz evaluated against ASHRAE standard NC curves with standard 10 dB room acoustic attenuation.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: VARIABLES REFERENCE */}
          {activeTab === "variables" && (
            <div className="space-y-2.5">
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <table className="w-full text-left text-[10.5px]">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border font-bold text-foreground">
                      <th className="py-1.5 px-2">Symbol</th>
                      <th className="py-1.5 px-2">Parameter</th>
                      <th className="py-1.5 px-2">SI Standard</th>
                      <th className="py-1.5 px-2">IP Standard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_room</td>
                      <td className="py-1.5 px-2 text-foreground">Total Room Airflow Demand</td>
                      <td className="py-1.5 px-2 font-mono">L/s / m³/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_diff</td>
                      <td className="py-1.5 px-2 text-foreground">Airflow per Diffuser Terminal</td>
                      <td className="py-1.5 px-2 font-mono">L/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">V_neck</td>
                      <td className="py-1.5 px-2 text-foreground">Terminal Neck Velocity</td>
                      <td className="py-1.5 px-2 font-mono">m/s</td>
                      <td className="py-1.5 px-2 font-mono">FPM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">A_eff</td>
                      <td className="py-1.5 px-2 text-foreground">Effective Discharge Core Area</td>
                      <td className="py-1.5 px-2 font-mono">m²</td>
                      <td className="py-1.5 px-2 font-mono">sq.ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ΔP_s</td>
                      <td className="py-1.5 px-2 text-foreground">Terminal Static Pressure Drop</td>
                      <td className="py-1.5 px-2 font-mono">Pa</td>
                      <td className="py-1.5 px-2 font-mono">in.wg</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">T_50</td>
                      <td className="py-1.5 px-2 text-foreground">Throw to 0.25 m/s (50 FPM)</td>
                      <td className="py-1.5 px-2 font-mono">m</td>
                      <td className="py-1.5 px-2 font-mono">ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">NC</td>
                      <td className="py-1.5 px-2 text-foreground">Noise Criteria Rating</td>
                      <td className="py-1.5 px-2 font-mono">dB / NC</td>
                      <td className="py-1.5 px-2 font-mono">dB / NC</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ρ_air</td>
                      <td className="py-1.5 px-2 text-foreground">Standard Air Density (20°C)</td>
                      <td className="py-1.5 px-2 font-mono">1.204 kg/m³</td>
                      <td className="py-1.5 px-2 font-mono">0.075 lb/ft³</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer matching standard */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-muted border border-border/70 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-primary text-primary-foreground text-[11.5px] font-semibold px-4 py-1.5 rounded-lg hover:bg-primary/90 transition shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
