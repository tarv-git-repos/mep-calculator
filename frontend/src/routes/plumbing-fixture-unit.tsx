import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { 
  Trash2, Plus, FileSpreadsheet, Info, ChevronDown, ChevronUp, Save, X, Download, 
  Flag, Search, Filter, SlidersHorizontal, FileText, Sparkles, CheckCircle2, Copy, 
  Edit3, Droplets, Building2, Calculator, Layers, Globe, MessageSquare, AlertTriangle, Gauge 
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { useAuth } from "@/contexts/AuthContext";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { addPdfHeader, addPdfSignatureBlock, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuShortcut } from "@/components/ui/context-menu";
import { EditFixtureUnitRowModal } from "@/components/workspace/EditFixtureUnitRowModal";

export const Route = createFileRoute("/plumbing-fixture-unit")({
  head: () => ({
    meta: [
      { title: "Fixture Unit Calculator — MEP Calc" },
      { name: "description", content: "Water Supply Fixture Units (WSFU) sizing tool using Hunter's Curve Method and IPC/UPC standards." },
    ],
  }),
  component: FixtureUnitPage,
});

export interface FUSpace {
  id: number;
  desc: string;
  floor: string;
  std: string;
  qty?: number;
  fixtures: Record<string, number>;
  comments?: any[];
  flagged?: boolean;
  isFlagged?: boolean;
  isManualFloor?: boolean;
}

export function getFUSpaceValidation(s?: Partial<FUSpace>) {
  const warnings: string[] = [];
  if (!s) return { isFlagged: false, warnings: [], isAutoFlagged: false, isManualFlagged: false };

  const descEmpty = !s.desc || s.desc.trim() === "";
  const hasFixtures = s.fixtures && Object.values(s.fixtures).some(v => Number(v) > 0);

  if (descEmpty) warnings.push("Space description is empty");
  if (!hasFixtures) warnings.push("No fixtures specified for this space");

  const isAutoFlagged = warnings.length > 0;
  const isManualFlagged = s.flagged === true || s.isFlagged === true;
  const isFlagged = isManualFlagged || isAutoFlagged;

  return { isFlagged, warnings, isAutoFlagged, isManualFlagged };
}

export const IP_FIXTURE_UNITS: Record<string, Record<string, number>> = {
  wc: { 'ipc-total': 2.5, 'ipc-cold': 2.5, 'ipc-hot': 0, low: 1.5, med: 2.5, high: 2.5 },
  handspray: { 'ipc-total': 1.0, 'ipc-cold': 1.0, 'ipc-hot': 0, low: 1.0, med: 1.0, high: 2.0 },
  basin: { 'ipc-total': 1.0, 'ipc-cold': 0.75, 'ipc-hot': 0.75, low: 1.0, med: 1.0, high: 2.0 },
  sink: { 'ipc-total': 1.5, 'ipc-cold': 1.0, 'ipc-hot': 1.0, low: 1.5, med: 1.5, high: 5.0 },
  shower: { 'ipc-total': 2.0, 'ipc-cold': 1.5, 'ipc-hot': 1.5, low: 1.5, med: 2.0, high: 4.0 },
  washer: { 'ipc-total': 3.0, 'ipc-cold': 2.25, 'ipc-hot': 2.25, low: 2.0, med: 3.0, high: 4.0 },
  servicesink: { 'ipc-total': 3.0, 'ipc-cold': 2.25, 'ipc-hot': 2.25, low: 2.0, med: 3.0, high: 5.0 },
  hose_bibb: { 'ipc-total': 2.5, 'ipc-cold': 2.5, 'ipc-hot': 0, low: 1.5, med: 2.5, high: 5.0 },
  dishwasher: { 'ipc-total': 1.5, 'ipc-cold': 0, 'ipc-hot': 1.5, low: 1.5, med: 1.5, high: 4.0 },
  hose_bibb_1: { 'ipc-total': 1.0, 'ipc-cold': 1.0, 'ipc-hot': 0, low: 1.0, med: 1.0, high: 2.5 },
  bath: { 'ipc-total': 2.0, 'ipc-cold': 1.5, 'ipc-hot': 1.5, low: 1.4, med: 10.0, high: 12.0 },
  urinal: { 'ipc-total': 3.0, 'ipc-cold': 3.0, 'ipc-hot': 0, low: 1.0, med: 1.0, high: 1.0 }
};

export const FU_FIXTURES_META = [
  { id: 'wc', short: 'W/C' },
  { id: 'handspray', short: 'Hand Spray (Bibb)' },
  { id: 'basin', short: 'WASH BASIN' },
  { id: 'sink', short: 'Sink Kitchen' },
  { id: 'shower', short: 'Shower' },
  { id: 'washer', short: 'WASHING MACHINE' },
  { id: 'servicesink', short: 'Service Sink' },
  { id: 'hose_bibb', short: 'Hose Bibb' },
  { id: 'dishwasher', short: 'DISH WASHER' },
  { id: 'hose_bibb_1', short: 'Bib Tap' }
];

const IPC_TABLE = [
  { wsfu: 0, gpm: 0 },
  { wsfu: 1, gpm: 3 },
  { wsfu: 2, gpm: 5 },
  { wsfu: 3, gpm: 6.5 },
  { wsfu: 5, gpm: 9.4 },
  { wsfu: 10, gpm: 14.6 },
  { wsfu: 15, gpm: 17.5 },
  { wsfu: 20, gpm: 19.6 },
  { wsfu: 25, gpm: 21.5 },
  { wsfu: 30, gpm: 23.3 },
  { wsfu: 40, gpm: 26.3 },
  { wsfu: 50, gpm: 29.1 },
  { wsfu: 60, gpm: 32 },
  { wsfu: 70, gpm: 35 },
  { wsfu: 80, gpm: 38 },
  { wsfu: 90, gpm: 41 },
  { wsfu: 100, gpm: 43.5 },
  { wsfu: 120, gpm: 48 },
  { wsfu: 140, gpm: 52.5 },
  { wsfu: 160, gpm: 57 },
  { wsfu: 180, gpm: 61 },
  { wsfu: 200, gpm: 65 },
  { wsfu: 225, gpm: 70 },
  { wsfu: 250, gpm: 75 },
  { wsfu: 275, gpm: 80 },
  { wsfu: 300, gpm: 85 },
  { wsfu: 400, gpm: 105 },
  { wsfu: 500, gpm: 124 },
  { wsfu: 750, gpm: 170 },
  { wsfu: 1000, gpm: 208 },
  { wsfu: 1250, gpm: 239 },
  { wsfu: 1500, gpm: 269 },
  { wsfu: 1750, gpm: 297 },
  { wsfu: 2000, gpm: 325 },
  { wsfu: 2500, gpm: 380 },
  { wsfu: 3000, gpm: 433 },
  { wsfu: 4000, gpm: 525 },
  { wsfu: 5000, gpm: 593 }
];

export function wsfuToGPM(wsfu: number): number {
  const clamped = Math.max(0, Math.min(wsfu, 5000));
  for (let i = 0; i < IPC_TABLE.length; i++) {
    if (IPC_TABLE[i].wsfu === clamped) {
      return IPC_TABLE[i].gpm;
    }
  }
  for (let i = 0; i < IPC_TABLE.length - 1; i++) {
    const lower = IPC_TABLE[i];
    const upper = IPC_TABLE[i + 1];
    if (clamped > lower.wsfu && clamped < upper.wsfu) {
      const ratio = (clamped - lower.wsfu) / (upper.wsfu - lower.wsfu);
      return lower.gpm + ratio * (upper.gpm - lower.gpm);
    }
  }
  return 0;
}

export function wsfuToLPS(wsfu: number): number {
  return wsfuToGPM(wsfu) * 0.06309;
}

export function getRecommendedWaterPipe(totalWSFU: number): { sizeInch: string; sizeMM: number; maxGPM: number } {
  const gpm = wsfuToGPM(totalWSFU);
  if (gpm <= 9.5) return { sizeInch: "1\"", sizeMM: 25, maxGPM: 10 };
  if (gpm <= 20) return { sizeInch: "1¼\"", sizeMM: 32, maxGPM: 20 };
  if (gpm <= 35) return { sizeInch: "1½\"", sizeMM: 40, maxGPM: 35 };
  if (gpm <= 65) return { sizeInch: "2\"", sizeMM: 50, maxGPM: 65 };
  if (gpm <= 110) return { sizeInch: "2½\"", sizeMM: 65, maxGPM: 110 };
  if (gpm <= 200) return { sizeInch: "3\"", sizeMM: 80, maxGPM: 200 };
  return { sizeInch: "4\"", sizeMM: 100, maxGPM: 400 };
}

function extractFloorFU(name: string) {
  const match = name.match(/^([0-9]+[A-Za-z]*|B[0-9]*|G|LG|UG|SF|RF|M|P)[FLfli]?/i);
  return match ? match[0].toUpperCase().replace(/L$/i, 'F') : '1F';
}

function FixtureUnitPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const { user } = useAuth();
  const currentUserName = user?.name || user?.email || "Engineer";

  const calcReviewState = useCalculationReviewState("/plumbing-fixture-unit", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-fixture-unit", activeProjectId || project?.id);
  const isApprovedLocked = calcReviewState?.status === "APPROVED";

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [headerStd, setHeaderStd] = useState<string>("ipc-total");
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number>>({});
  const [fuSpaces, setFuSpaces] = useState<FUSpace[]>([]);
  const [floorSections, setFloorSections] = useState<string[]>(["1F"]);
  const [activeTab, setActiveTab] = useState<"spaces" | "report">("spaces");
  const [intelOpen, setIntelOpen] = useState(false);

  // Filtering & Sorting states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [filterFlagged, setFilterFlagged] = useState<"all" | "flagged" | "unflagged">("all");
  const [filterStd, setFilterStd] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"none" | "desc" | "floor" | "wsfu" | "qty" | "total_wsfu">("none");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [bulkFloor, setBulkFloor] = useState("");
  const [bulkStd, setBulkStd] = useState("ipc-total");

  // Modals & Editing
  const [editingSpace, setEditingSpace] = useState<FUSpace | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<any>(null);

  const importFileRef = useRef<HTMLInputElement>(null);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<FUSpace[][]>([]);
  const [redoStack, setRedoStack] = useState<FUSpace[][]>([]);
  const [clipboard, setClipboard] = useState<FUSpace[]>([]);

  const pushToUndo = (currentSpaces: FUSpace[]) => {
    setUndoStack((prev) => [...prev, currentSpaces]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || isApprovedLocked || isEffectiveReadOnly) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, fuSpaces]);
    setUndoStack((prev) => prev.slice(0, -1));
    setFuSpaces(previous);
    toast.info("Undo applied");
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || isApprovedLocked || isEffectiveReadOnly) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, fuSpaces]);
    setRedoStack((prev) => prev.slice(0, -1));
    setFuSpaces(next);
    toast.info("Redo applied");
  };

  // Load calculation state
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_fixture_unit_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.unitSystem) setUnitSystem(data.unitSystem);
          if (data.headerStd) setHeaderStd(data.headerStd);
          if (data.weightOverrides) setWeightOverrides(data.weightOverrides);
          if (data.floorSections) setFloorSections(data.floorSections);
          if (data.fuSpaces && Array.isArray(data.fuSpaces)) {
            setFuSpaces(data.fuSpaces);
          }
        } else {
          // Defaults
          setUnitSystem("si");
          setHeaderStd("ipc-total");
          setWeightOverrides({});
          setFloorSections(["1F"]);
          setFuSpaces([
            {
              id: 1,
              desc: "1F Male Washroom",
              floor: "1F",
              std: "ipc-total",
              qty: 1,
              fixtures: { wc: 4, urinal: 3, basin: 4 }
            },
            {
              id: 2,
              desc: "1F Female Washroom",
              floor: "1F",
              std: "ipc-total",
              qty: 1,
              fixtures: { wc: 5, basin: 4 }
            }
          ]);
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load fixture unit calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  // Auto-save to localStorage
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        headerStd,
        weightOverrides,
        floorSections,
        fuSpaces
      };
      localStorage.setItem(`mep_fixture_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, headerStd, weightOverrides, floorSections, fuSpaces]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          unitSystem,
          headerStd,
          weightOverrides,
          floorSections,
          fuSpaces
        };
        localStorage.setItem(`mep_fixture_unit_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Fixture Unit Calculation saved successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  useEffect(() => {
    const handleGlobalSave = (e: any) => {
      e.detail.handled = true;
      handleSaveCurrent();
    };
    window.addEventListener("mep-trigger-save", handleGlobalSave);
    return () => window.removeEventListener("mep-trigger-save", handleGlobalSave);
  }, [project?.id, unitSystem, headerStd, weightOverrides, floorSections, fuSpaces, forceSaveToCloud]);

  const ip = unitSystem === "ip";

  const getEffectiveUnitFU = (fixtureId: string, spaceStd: string = headerStd) => {
    if (weightOverrides[fixtureId] !== undefined) {
      return weightOverrides[fixtureId];
    }
    return IP_FIXTURE_UNITS[fixtureId]?.[spaceStd] ?? IP_FIXTURE_UNITS[fixtureId]?.['ipc-total'] ?? 1;
  };

  // Comprehensive Sizing Calculations
  const calculations = useMemo(() => {
    let totalWSFU = 0;
    const spaceUnitFU: Record<number, number> = {};
    const spaceTotals: Record<number, number> = {};
    const fixtureCounts: Record<string, number> = {};
    const floorTotals: Record<string, { totalWSFU: number; spaceCount: number }> = {};
    const detailedSteps: any[] = [];

    FU_FIXTURES_META.forEach(f => { fixtureCounts[f.id] = 0; });

    fuSpaces.forEach(s => {
      let unitFU = 0;
      const spaceParts: string[] = [];
      const spaceStd = s.std || headerStd;
      const spaceQty = Math.max(1, s.qty || 1);
      const floorName = s.floor || "1F";

      if (!floorTotals[floorName]) {
        floorTotals[floorName] = { totalWSFU: 0, spaceCount: 0 };
      }
      floorTotals[floorName].spaceCount += 1;

      FU_FIXTURES_META.forEach(f => {
        const count = s.fixtures[f.id] || 0;
        if (count > 0) {
          fixtureCounts[f.id] = (fixtureCounts[f.id] || 0) + (count * spaceQty);
          const weight = getEffectiveUnitFU(f.id, spaceStd);
          const subTotal = count * weight;
          unitFU += subTotal;
          spaceParts.push(`${count}×${f.short} (${subTotal.toFixed(1)} FU)`);
        }
      });

      const totalForSpace = unitFU * spaceQty;
      spaceUnitFU[s.id] = unitFU;
      spaceTotals[s.id] = totalForSpace;
      totalWSFU += totalForSpace;
      floorTotals[floorName].totalWSFU += totalForSpace;

      if (spaceParts.length > 0) {
        detailedSteps.push({
          title: `${s.desc || `Space #${s.id}`} (${floorName}) — Qty: ${spaceQty}`,
          expr: `${spaceParts.join(" + ")} = ${unitFU.toFixed(1)} Unit WSFU × ${spaceQty} = ${totalForSpace.toFixed(1)} WSFU`
        });
      }
    });

    const probablePeakFlowGPM = wsfuToGPM(totalWSFU);
    const probablePeakFlowLPS = wsfuToLPS(totalWSFU);
    const pipeRec = getRecommendedWaterPipe(totalWSFU);

    const displayFlow = ip
      ? `${probablePeakFlowGPM.toFixed(1)} GPM`
      : `${probablePeakFlowLPS.toFixed(2)} L/s`;

    const pipeSize = ip
      ? pipeRec.sizeInch
      : `DN${pipeRec.sizeMM} mm (${pipeRec.sizeInch})`;

    return {
      totalWSFU,
      probablePeakFlowGPM,
      probablePeakFlowLPS,
      displayFlow,
      pipeRec,
      pipeSize,
      spaceUnitFU,
      spaceTotals,
      fixtureCounts,
      floorTotals,
      detailedSteps
    };
  }, [fuSpaces, headerStd, weightOverrides, ip]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Escape") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          setSelectedIds([]);
        }
        return;
      }

      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (!isInput) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        if (!isInput && fuSpaces.length > 0) {
          e.preventDefault();
          setSelectedIds(fuSpaces.map(s => s.id));
        }
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (!isInput && selectedIds.length > 0) {
          e.preventDefault();
          const toCopy = fuSpaces.filter(s => selectedIds.includes(s.id));
          setClipboard(toCopy);
          toast.success(`${toCopy.length} row(s) copied`);
        }
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (!isInput && selectedIds.length > 0 && !isApprovedLocked && !isEffectiveReadOnly) {
          e.preventDefault();
          const toCopy = fuSpaces.filter(s => selectedIds.includes(s.id));
          setClipboard(toCopy);
          pushToUndo(fuSpaces);
          setFuSpaces(prev => prev.filter(s => !selectedIds.includes(s.id)));
          setSelectedIds([]);
          toast.success(`${toCopy.length} row(s) cut`);
        }
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (!isInput && clipboard.length > 0 && !isApprovedLocked && !isEffectiveReadOnly) {
          e.preventDefault();
          const pasted = clipboard.map((s, idx) => ({
            ...s,
            id: Date.now() + idx + Math.floor(Math.random() * 1000),
            desc: `${s.desc} (Copy)`
          }));
          pushToUndo(fuSpaces);
          setFuSpaces(prev => [...prev, ...pasted]);
          setSelectedIds(pasted.map(p => p.id));
          toast.success(`${pasted.length} row(s) pasted`);
        }
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }

      if (!isInput && (e.key === "Delete" || e.key === "Backspace")) {
        if (selectedIds.length > 0 && !isApprovedLocked && !isEffectiveReadOnly) {
          e.preventDefault();
          pushToUndo(fuSpaces);
          setFuSpaces(prev => prev.filter(s => !selectedIds.includes(s.id)));
          setSelectedIds([]);
          toast.success(`${selectedIds.length} row(s) deleted`);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, fuSpaces, clipboard, undoStack, redoStack, isApprovedLocked, isEffectiveReadOnly]);

  // Space Manipulation Handlers
  const handleAddSpace = () => {
    if (isApprovedLocked || isEffectiveReadOnly) {
      toast.info("Calculation is locked in Read-Only mode. Space addition is disabled.", { id: "readonly-notice" });
      return;
    }
    const targetFloor = floorSections[floorSections.length - 1] || "1F";
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    const newSpace: FUSpace = {
      id: newId,
      desc: `Space ${fuSpaces.length + 1}`,
      floor: targetFloor,
      std: headerStd,
      qty: 1,
      fixtures: { wc: 1, basin: 1 }
    };
    pushToUndo(fuSpaces);
    setFuSpaces(prev => [...prev, newSpace]);
    setSelectedIds([newId]);
    toast.success("New space added");
  };

  const handleAddNewFloorSection = () => {
    if (isApprovedLocked || isEffectiveReadOnly) return;
    const name = window.prompt("Enter new Floor Section Name (e.g. 2F, Roof, Basement):", `Level ${floorSections.length + 1}`);
    if (name && name.trim()) {
      const formatted = name.trim().toUpperCase();
      if (!floorSections.includes(formatted)) {
        setFloorSections(prev => [...prev, formatted]);
        toast.success(`Created section "${formatted}"`);
      } else {
        toast.info(`Section "${formatted}" already exists`);
      }
    }
  };

  const handleRenameFloorGroup = (oldFloor: string, newFloor: string) => {
    if (isApprovedLocked || isEffectiveReadOnly) return;
    pushToUndo(fuSpaces);
    setFloorSections(prev => prev.map(f => f === oldFloor ? newFloor : f));
    setFuSpaces(prev => prev.map(s => s.floor === oldFloor ? { ...s, floor: newFloor } : s));
    toast.success(`Renamed section "${oldFloor}" to "${newFloor}"`);
  };

  const handleDeleteFloorGroup = (floor: string) => {
    if (isApprovedLocked || isEffectiveReadOnly) return;
    const count = fuSpaces.filter(s => s.floor === floor).length;
    if (window.confirm(`Delete floor section "${floor}" and all ${count} spaces inside it?`)) {
      pushToUndo(fuSpaces);
      setFloorSections(prev => prev.filter(f => f !== floor));
      setFuSpaces(prev => prev.filter(s => s.floor !== floor));
      setSelectedIds([]);
      toast.success(`Deleted section "${floor}"`);
    }
  };

  const handleSpaceChange = (id: number, field: keyof FUSpace, val: any) => {
    if (isApprovedLocked || isEffectiveReadOnly) return;
    setFuSpaces(prev => prev.map(s => {
      if (s.id === id) {
        if (field === "floor") {
          return { ...s, [field]: val, isManualFloor: true };
        }
        return { ...s, [field]: val };
      }
      return s;
    }));
  };

  const handleFixtureChange = (spaceId: number, fixtureId: string, count: number) => {
    if (isApprovedLocked || isEffectiveReadOnly) return;
    setFuSpaces(prev => prev.map(s => {
      if (s.id === spaceId) {
        const nextFixtures = { ...s.fixtures, [fixtureId]: Math.max(0, count) };
        return { ...s, fixtures: nextFixtures };
      }
      return s;
    }));
  };

  // Filter & Search
  const filteredSpaces = useMemo(() => {
    return fuSpaces.filter(s => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (s.desc || "").toLowerCase().includes(q);
        const matchFloor = (s.floor || "").toLowerCase().includes(q);
        if (!matchDesc && !matchFloor) return false;
      }
      if (filterFloor !== "all" && (s.floor || "1F") !== filterFloor) return false;
      if (filterFlagged === "flagged" && !getFUSpaceValidation(s).isFlagged) return false;
      if (filterFlagged === "unflagged" && getFUSpaceValidation(s).isFlagged) return false;
      if (filterStd !== "all" && s.std !== filterStd) return false;
      return true;
    });
  }, [fuSpaces, searchQuery, filterFloor, filterFlagged, filterStd]);

  // Sorting
  const sortedSpaces = useMemo(() => {
    if (sortBy === "none") return filteredSpaces;
    const sorted = [...filteredSpaces];
    sorted.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      if (sortBy === "desc") {
        valA = (a.desc || "").toLowerCase();
        valB = (b.desc || "").toLowerCase();
      } else if (sortBy === "floor") {
        valA = (a.floor || "").toLowerCase();
        valB = (b.floor || "").toLowerCase();
      } else if (sortBy === "wsfu") {
        valA = calculations.spaceUnitFU[a.id] || 0;
        valB = calculations.spaceUnitFU[b.id] || 0;
      } else if (sortBy === "qty") {
        valA = a.qty || 1;
        valB = b.qty || 1;
      } else if (sortBy === "total_wsfu") {
        valA = calculations.spaceTotals[a.id] || 0;
        valB = calculations.spaceTotals[b.id] || 0;
      }
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredSpaces, sortBy, sortOrder, calculations]);

  // Group sorted spaces by floor sections
  const floorsGrouped = useMemo(() => {
    const grouped: Record<string, FUSpace[]> = {};
    const seenFloors = new Set<string>();

    floorSections.forEach(fl => {
      grouped[fl] = [];
      seenFloors.add(fl);
    });

    sortedSpaces.forEach(s => {
      const fl = s.floor || "1F";
      if (!grouped[fl]) {
        grouped[fl] = [];
        seenFloors.add(fl);
      }
      grouped[fl].push(s);
    });

    return grouped;
  }, [sortedSpaces, floorSections]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (isApprovedLocked || isEffectiveReadOnly) return;
    if (checked) {
      setSelectedIds(filteredSpaces.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number, checked: boolean, shiftKey?: boolean) => {
    if (isApprovedLocked || isEffectiveReadOnly) return;
    if (shiftKey && lastSelectedId !== null) {
      const lastIndex = sortedSpaces.findIndex(s => s.id === lastSelectedId);
      const currentIndex = sortedSpaces.findIndex(s => s.id === id);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const idsInRange = sortedSpaces.slice(start, end + 1).map(s => s.id);
        
        if (checked) {
          setSelectedIds(prev => Array.from(new Set([...prev, ...idsInRange])));
        } else {
          setSelectedIds(prev => prev.filter(x => !idsInRange.includes(x)));
        }
        setLastSelectedId(id);
        return;
      }
    }

    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(x => x !== id));
    }
    setLastSelectedId(id);
  };

  const handleBulkDuplicate = () => {
    if (isApprovedLocked || isEffectiveReadOnly || selectedIds.length === 0) return;
    const clones: FUSpace[] = [];
    fuSpaces.forEach(s => {
      if (selectedIds.includes(s.id)) {
        clones.push({
          ...s,
          id: Date.now() + Math.random(),
          desc: `${s.desc} (Copy)`
        });
      }
    });
    pushToUndo(fuSpaces);
    setFuSpaces([...fuSpaces, ...clones]);
    toast.success(`Duplicated ${clones.length} space(s)`);
  };

  const handleApplyBulkFloor = () => {
    if (isApprovedLocked || isEffectiveReadOnly || selectedIds.length === 0 || !bulkFloor.trim()) return;
    const targetFloor = bulkFloor.trim().toUpperCase();
    if (!floorSections.includes(targetFloor)) {
      setFloorSections(prev => [...prev, targetFloor]);
    }
    pushToUndo(fuSpaces);
    setFuSpaces(fuSpaces.map(s => {
      if (selectedIds.includes(s.id)) {
        return { ...s, floor: targetFloor, isManualFloor: true };
      }
      return s;
    }));
    setSelectedIds([]);
    setBulkFloor("");
    toast.success(`Floor updated for ${selectedIds.length} space(s)`);
  };

  const handleApplyBulkStd = () => {
    if (isApprovedLocked || isEffectiveReadOnly || selectedIds.length === 0) return;
    pushToUndo(fuSpaces);
    setFuSpaces(fuSpaces.map(s => {
      if (selectedIds.includes(s.id)) {
        return { ...s, std: bulkStd };
      }
      return s;
    }));
    setSelectedIds([]);
    toast.success(`Standard updated for ${selectedIds.length} space(s)`);
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  // Excel Import
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isApprovedLocked || isEffectiveReadOnly) {
      toast.info("Calculation is Approved and Locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const newSpaces: FUSpace[] = [];
        let currentFloor = "1F";
        const foundFloors = new Set<string>();

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || "").trim();
          if (!firstCell) continue;

          if (/floor|level|basement|ground|roof/i.test(firstCell) && row.length <= 3) {
            currentFloor = firstCell.toUpperCase();
            foundFloors.add(currentFloor);
            continue;
          }

          if (firstCell.toLowerCase() === "description" || firstCell.toLowerCase() === "space name" || firstCell.toLowerCase() === "sr.") continue;

          const fixtures: Record<string, number> = {};
          FU_FIXTURES_META.forEach((f, idx) => {
            const colVal = Number(row[idx + 1]);
            if (!isNaN(colVal) && colVal > 0) {
              fixtures[f.id] = colVal;
            }
          });

          const qtyColIdx = 1 + FU_FIXTURES_META.length + 1;
          const spaceQty = Number(row[qtyColIdx]) || 1;

          newSpaces.push({
            id: Date.now() + i + Math.random(),
            desc: firstCell,
            floor: currentFloor,
            std: headerStd,
            qty: Math.max(1, spaceQty),
            fixtures,
          });
        }

        if (newSpaces.length > 0) {
          pushToUndo(fuSpaces);
          setFuSpaces(prev => [...prev, ...newSpaces]);
          if (foundFloors.size > 0) {
            setFloorSections(prev => Array.from(new Set([...prev, ...Array.from(foundFloors)])));
          }
          toast.success(`Successfully imported ${newSpaces.length} space(s) from Excel!`);
        } else {
          toast.warning("No valid space rows found in the uploaded file.");
        }
      } catch (err: any) {
        console.error("Excel import error:", err);
        toast.error("Failed to parse Excel file. Please ensure it follows the standard column headers.");
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = "";
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Fixture Units Sizing");

      const activeProj: any = workspaceStore.getState()?.project || project || {};
      const projectName = activeProj.name || activeProj.projectName || "Fixture Unit Project";
      const calcNo = activeProj.calcNo || "TRV-FU-CALC-R01";
      const today = new Date().toLocaleDateString("en-GB");

      // Title Block
      sheet.mergeCells("A1:N1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = `${projectName.toUpperCase()} — WATER SUPPLY FIXTURE UNITS (WSFU) SIZING REPORT`;
      titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A7BC7" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(1).height = 28;

      sheet.addRow(["Project:", projectName, "Calc Reference:", calcNo, "Date:", today]);
      sheet.addRow(["Standard:", headerStd.toUpperCase(), "Peak Demand:", calculations.displayFlow, "Rec. Pipe:", calculations.pipeSize]);
      sheet.addRow([]);

      // Headers
      const headRow = sheet.addRow([
        "Description",
        "Floor",
        "Standard",
        ...FU_FIXTURES_META.map(f => f.short),
        "Unit WSFU",
        "Space Qty",
        "Total WSFU"
      ]);
      headRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C81" } };
      headRow.alignment = { horizontal: "center", vertical: "middle" };

      Object.keys(floorsGrouped).forEach(fl => {
        const floorSpaces = floorsGrouped[fl];
        if (floorSpaces.length === 0) return;

        const sectionRow = sheet.addRow([`FLOOR SECTION: ${fl.toUpperCase()}`]);
        sectionRow.font = { bold: true, color: { argb: "FF0A7BC7" } };
        sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F7FF" } };

        floorSpaces.forEach(s => {
          const rowData = [
            s.desc,
            s.floor || fl,
            s.std,
            ...FU_FIXTURES_META.map(f => s.fixtures[f.id] || "-"),
            calculations.spaceUnitFU[s.id] || 0,
            s.qty || 1,
            calculations.spaceTotals[s.id] || 0
          ];
          sheet.addRow(rowData);
        });
      });

      sheet.addRow([]);
      const totalRow = sheet.addRow([
        "TOTAL WSFU",
        "",
        "",
        ...FU_FIXTURES_META.map(() => ""),
        "",
        "",
        calculations.totalWSFU.toFixed(1)
      ]);
      totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A7BC7" } };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fixture_unit_sizing_${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel report exported successfully!");
    } catch (err: any) {
      console.error("Excel export error:", err);
      toast.error("Failed to export Excel file.");
    }
  };

  // PDF Export
  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const activeProj: any = workspaceStore.getState()?.project || project || {};
      const projectName = activeProj.name || activeProj.projectName || "Fixture Unit Project";

      addPdfHeader(doc, {
        projectName,
        calcTitle: "Water Supply Fixture Unit (WSFU) Sizing Report",
        calcNo: activeProj?.calcNo || "TRV-FU-CALC-R01",
        dateStr: formatDateStr(new Date().toISOString()),
        author: currentUserName
      });

      const head = [[
        "Space Description",
        "Floor",
        "Standard",
        ...FU_FIXTURES_META.map(f => f.short),
        "Unit WSFU",
        "Qty",
        "Total WSFU"
      ]];

      const body: any[] = [];
      Object.keys(floorsGrouped).forEach(fl => {
        const floorSpaces = floorsGrouped[fl];
        if (floorSpaces.length === 0) return;

        body.push([{ content: `FLOOR SECTION: ${fl.toUpperCase()}`, colSpan: head[0].length, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }]);

        floorSpaces.forEach(s => {
          const row = [
            s.desc,
            s.floor || fl,
            s.std,
            ...FU_FIXTURES_META.map(f => s.fixtures[f.id] || "-"),
            (calculations.spaceUnitFU[s.id] || 0).toFixed(1),
            s.qty || 1,
            (calculations.spaceTotals[s.id] || 0).toFixed(1),
          ];
          body.push(row);
        });
      });

      body.push([
        { content: "GRAND TOTAL WSFU", colSpan: head[0].length - 1, styles: { fontStyle: "bold", halign: "right", fillColor: [230, 240, 255] } },
        { content: `${calculations.totalWSFU.toFixed(1)} WSFU`, styles: { fontStyle: "bold", halign: "center", textColor: [10, 123, 199], fillColor: [230, 240, 255] } }
      ]);

      const runAutoTable = typeof autoTable === 'function' ? autoTable : (autoTable as any).default || (doc as any).autoTable;
      runAutoTable(doc, {
        startY: 40,
        head,
        body,
        theme: "grid",
        styles: { fontSize: 7.5, halign: "center" },
        headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" },
          1: { halign: "center" }
        },
        margin: { left: 14, right: 14 }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      const signatureDetails = getSignatureBlockDetails(
        activeProj?.id || "default", 
        "/plumbing-fixture-unit", 
        currentUserName,
        calcReviewState
      );
      
      addPdfSignatureBlock(
        doc, 
        finalY + 10, 
        signatureDetails,
        activeProj?.id || "default",
        "/plumbing-fixture-unit",
        { left: 14, right: 14 }
      );

      doc.save(`fixture_unit_report_${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
      toast.success("PDF report exported successfully!");
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(err?.message || "Failed to export PDF report.");
    }
  };

  return (
    <AppShell 
      title="Fixture Unit Calculator" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-3.5 overflow-y-auto h-full">
          
          {/* Header Bar */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-foreground">
                Fixture Unit Calculator
              </h1>
              <button
                type="button"
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar 
                projectId={project?.id || "default"} 
                calculatorPath="/plumbing-fixture-unit" 
                calculatorTitle="Plumbing Fixture Unit" 
              />
            </div>

            {/* Unit Toggle positioned in line on the right side of header */}
            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={(sys) => {
                  setUnitSystem(sys);
                  toast.success(`Switched unit system to ${sys.toUpperCase()}`);
                }}
                disabled={isApprovedLocked || isEffectiveReadOnly}
              />
            </div>
          </div>

          {/* Unified White Card Container (Matching Ventilation Layout Structure) */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : calcReviewState?.status === "REJECTED"
              ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
              : calcReviewState?.status === "REVIEWED"
              ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Row 1: Header / Main Tabs on Left + Standard Info on Right */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/50 gap-4 flex-wrap">
              <div className="flex bg-slate-100 dark:bg-slate-900/70 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setActiveTab("spaces")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "spaces"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Spaces
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "report"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Report
                </button>
              </div>

              {/* Standard Selector */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Standard Category:
                </span>
                <select
                  value={headerStd}
                  disabled={isApprovedLocked || isEffectiveReadOnly}
                  onChange={(e) => setHeaderStd(e.target.value)}
                  className={`bg-slate-100 dark:bg-slate-900 border border-border rounded-lg px-2.5 py-1 text-xs font-semibold outline-none ${
                    isApprovedLocked || isEffectiveReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <option value="ipc-total">Total WSFU (IPC / UPC)</option>
                  <option value="ipc-cold">Cold Water WSFU (IPC / UPC)</option>
                  <option value="ipc-hot">Hot Water WSFU (IPC / UPC)</option>
                  <option value="low">Low Demand (Private / Residential)</option>
                  <option value="med">Medium Demand (Commercial)</option>
                  <option value="high">High Demand (Public / Congested)</option>
                </select>
              </div>
            </div>

            {/* Row 2: Secondary Action Sub-Bar */}
            {activeTab === "spaces" && (
              <div className="relative flex items-center justify-between px-4 py-2 bg-slate-50/50 dark:bg-slate-900/30 shrink-0 select-none no-print border-b border-border/40 gap-2 flex-wrap text-xs">
                
                {/* Left Side: Filter / Search */}
                <div className="flex items-center gap-2 flex-wrap flex-1 max-w-xl">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search spaces or floors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 text-xs bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  {/* Floor Filter */}
                  <select
                    value={filterFloor}
                    onChange={(e) => setFilterFloor(e.target.value)}
                    className="h-8 px-2 bg-background border border-border rounded-lg text-xs outline-none cursor-pointer"
                  >
                    <option value="all">All Floors</option>
                    {floorSections.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>

                  {/* Flag Filter */}
                  <select
                    value={filterFlagged}
                    onChange={(e) => setFilterFlagged(e.target.value as any)}
                    className="h-8 px-2 bg-background border border-border rounded-lg text-xs outline-none cursor-pointer"
                  >
                    <option value="all">All Items</option>
                    <option value="flagged">Flagged Only</option>
                    <option value="unflagged">Unflagged</option>
                  </select>

                  {/* Sort Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="relative h-8 px-2.5 bg-background border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <SlidersHorizontal className="size-3.5 shrink-0" />
                        {sortBy !== "none" && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-xs">
                            ✓
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                      <div className="pb-1.5 border-b border-border text-xs font-semibold text-foreground">
                        Sort Options
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="none">Floor / Default Order</option>
                          <option value="desc">Description Name</option>
                          <option value="floor">Floor Name</option>
                          <option value="wsfu">Unit WSFU</option>
                          <option value="qty">Space Quantity</option>
                          <option value="total_wsfu">Total WSFU</option>
                        </select>
                      </div>

                      {sortBy !== "none" && (
                        <div className="flex items-center justify-between pt-1 border-t border-border/60">
                          <span className="text-[11px] font-semibold text-muted-foreground">Direction</span>
                          <button
                            type="button"
                            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                            className="px-2 py-0.5 text-[11px] font-bold text-primary bg-primary/10 rounded-md hover:bg-primary/20 cursor-pointer"
                          >
                            {sortOrder === "asc" ? "Ascending ↑" : "Descending ↓"}
                          </button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Right Side Actions */}
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  <input
                    type="file"
                    ref={importFileRef}
                    onChange={handleImportExcel}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  
                  <button
                    type="button"
                    disabled={isApprovedLocked || isEffectiveReadOnly}
                    onClick={() => {
                      if (isApprovedLocked || isEffectiveReadOnly) return;
                      if (window.confirm("Are you sure you want to clear all spaces in this calculation?")) {
                        pushToUndo(fuSpaces);
                        setFuSpaces([]);
                        setSelectedIds([]);
                        toast.info("Cleared all spaces");
                      }
                    }}
                    className={`text-red-500 hover:text-red-700 text-[11.5px] font-semibold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/20 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200 ${
                      isApprovedLocked || isEffectiveReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <Trash2 className="size-3.5" /> Clear All Spaces
                  </button>

                  <button
                    type="button"
                    disabled={isApprovedLocked || isEffectiveReadOnly}
                    onClick={() => {
                      if (isApprovedLocked || isEffectiveReadOnly) {
                        toast.info("Calculation is Approved and Locked in Read-Only mode.", { id: "readonly-notice" });
                        return;
                      }
                      importFileRef.current?.click();
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-background transition-all shadow-2xs ${
                      isApprovedLocked || isEffectiveReadOnly ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    }`}
                    title="Import spaces from Excel / CSV"
                  >
                    <Download className="size-3.5" /> Import
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-background hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileText className="size-3.5" /> Export
                  </button>

                  <button
                    type="button"
                    disabled={isApprovedLocked || isEffectiveReadOnly}
                    onClick={handleAddNewFloorSection}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-primary/30 bg-primary/10 text-primary transition-all shadow-2xs ${
                      isApprovedLocked || isEffectiveReadOnly ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/20 cursor-pointer"
                    }`}
                    title="Add Floor Section"
                  >
                    <Plus className="size-3.5" /> Add Floor Section
                  </button>

                  <button
                    type="button"
                    disabled={isApprovedLocked || isEffectiveReadOnly}
                    onClick={handleAddSpace}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground shadow-xs transition-all ${
                      isApprovedLocked || isEffectiveReadOnly ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90 cursor-pointer"
                    }`}
                    title="Add New Space"
                  >
                    <Plus className="size-3.5" /> New Space
                  </button>
                </div>

                {/* Bulk actions bar overlay (Matching Ventilation Schedule exactly) */}
                {!isApprovedLocked && selectedIds.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-between px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{selectedIds.length} selected</span>
                      <span className="text-primary/30">·</span>
                      <BulkBtn icon={Copy} onClick={handleBulkDuplicate}>Duplicate ({selectedIds.length})</BulkBtn>
                      
                      {/* Floor Move */}
                      <div className="flex items-center gap-1 bg-white/80 dark:bg-black/40 border border-[#06456F]/20 dark:border-[#0A7BC7]/30 rounded-md px-2 py-0.5">
                        <span className="text-[11px] text-muted-foreground font-semibold">Floor:</span>
                        <input
                          type="text"
                          value={bulkFloor}
                          onChange={(e) => setBulkFloor(e.target.value)}
                          placeholder="e.g. 2F"
                          className="w-12 text-xs font-mono font-bold bg-transparent outline-none uppercase"
                        />
                        <button
                          type="button"
                          onClick={handleApplyBulkFloor}
                          className="px-1.5 py-0.5 bg-primary text-primary-foreground text-[10.5px] font-bold rounded cursor-pointer"
                        >
                          Set
                        </button>
                      </div>

                      {/* Standard Bulk Apply */}
                      <div className="flex items-center gap-1 bg-white/80 dark:bg-black/40 border border-[#06456F]/20 dark:border-[#0A7BC7]/30 rounded-md px-2 py-0.5">
                        <select
                          value={bulkStd}
                          onChange={(e) => setBulkStd(e.target.value)}
                          className="text-xs font-semibold bg-transparent outline-none cursor-pointer"
                        >
                          <option value="ipc-total">IPC Total</option>
                          <option value="ipc-cold">IPC Cold</option>
                          <option value="ipc-hot">IPC Hot</option>
                          <option value="low">Low Demand</option>
                          <option value="med">Medium Demand</option>
                          <option value="high">High Demand</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleApplyBulkStd}
                          className="px-1.5 py-0.5 bg-primary text-primary-foreground text-[10.5px] font-bold rounded cursor-pointer"
                        >
                          Set Std
                        </button>
                      </div>

                      <BulkBtn icon={Trash2} onClick={async () => {
                        if (isApprovedLocked || isEffectiveReadOnly) return;
                        if (window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected space(s)?`)) {
                          pushToUndo(fuSpaces);
                          setFuSpaces(fuSpaces.filter(s => !selectedIds.includes(s.id)));
                          setSelectedIds([]);
                          toast.info(`Deleted ${selectedIds.length} space(s)`);
                        }
                      }}>Delete</BulkBtn>
                    </div>

                    <button onClick={() => setSelectedIds([])} className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer">
                      <X className="size-3" /> Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Tab Content Body Area */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {activeTab === "spaces" && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

                  {/* Spaces Data Grid / Table */}
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar">
                    <table className="w-full border-collapse text-left font-sans text-xs">
                      {/* Sticky Dual-Row Header */}
                      <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-border select-none shadow-xs">
                        {/* Primary Header Row */}
                        <tr className="text-muted-foreground text-[10.5px] uppercase font-bold tracking-wider border-b border-border/60">
                          <th className="p-2 w-9 text-center border-r border-border/50">
                            <input
                              type="checkbox"
                              checked={selectedIds.length === filteredSpaces.length && filteredSpaces.length > 0}
                              onChange={(e) => handleToggleSelectAll(e.target.checked)}
                              disabled={isApprovedLocked || isEffectiveReadOnly}
                              className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded"
                            />
                          </th>
                          <th className="p-2 min-w-[160px] text-foreground font-bold border-r border-border/50">Description</th>
                          <th className="p-2 w-20 text-center border-r border-border/50">Floor</th>
                          <th className="p-2 w-24 text-center border-r border-border/50">Standard</th>
                          {FU_FIXTURES_META.map(f => (
                            <th key={f.id} className="p-1.5 w-14 text-center border-r border-border/50 text-[10px] text-foreground font-bold">
                              {f.short}
                            </th>
                          ))}
                          <th className="p-2 w-16 text-center border-r border-border/50 text-primary font-bold">Unit WSFU</th>
                          <th className="p-2 w-16 text-center border-r border-border/50 text-amber-600 font-bold">Space Qty</th>
                          <th className="p-2 w-20 text-center border-r border-border/50 text-primary font-bold">Total WSFU</th>
                          <th className="p-2 w-14 text-center">Actions</th>
                        </tr>

                        {/* Interactive Weights Override Pill Row */}
                        <tr className="bg-blue-50/40 dark:bg-blue-950/20 text-[10px] border-b border-border/80">
                          <th colSpan={4} className="p-1.5 px-3 text-left font-bold text-muted-foreground border-r border-border/50">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="size-3 text-[#0A7BC7]" />
                              <span>Standard Unit Weights (Edit column to override):</span>
                              {Object.keys(weightOverrides).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setWeightOverrides({})}
                                  className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 hover:underline ml-auto"
                                >
                                  ↺ Reset All Defaults
                                </button>
                              )}
                            </div>
                          </th>
                          {FU_FIXTURES_META.map(f => {
                            const currentVal = weightOverrides[f.id] !== undefined
                              ? weightOverrides[f.id]
                              : (IP_FIXTURE_UNITS[f.id]?.[headerStd] ?? 1);
                            return (
                              <th key={f.id} className="p-1 px-0.5 text-center border-r border-border/50">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  disabled={isApprovedLocked || isEffectiveReadOnly}
                                  value={currentVal}
                                  onChange={(e) => {
                                    const val = e.target.value !== "" ? Number(e.target.value) : 0;
                                    setWeightOverrides(prev => ({ ...prev, [f.id]: val }));
                                  }}
                                  className="w-full text-center bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded text-[#0A7BC7] font-extrabold text-[11px] py-0.5 outline-none focus:ring-1 focus:ring-[#0A7BC7]"
                                  title={`Edit default weight for ${f.short}`}
                                />
                              </th>
                            );
                          })}
                          <th className="p-1 text-center font-bold text-primary border-r border-border/50 text-[10px]">UNIT</th>
                          <th className="p-1 text-center font-bold text-amber-600 border-r border-border/50 text-[10px]">× QTY</th>
                          <th className="p-1 text-center font-bold text-primary border-r border-border/50 text-[10px]">TOTAL</th>
                          <th className="p-1 text-center"></th>
                        </tr>
                      </thead>

                      {/* Floor Sections & Space Rows */}
                      {Object.keys(floorsGrouped).map((floor) => {
                        const floorSpaces = floorsGrouped[floor];
                        return (
                          <tbody key={floor} className="divide-y divide-border/50">
                            {/* Floor Section Header Banner */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <tr className="bg-slate-100/90 dark:bg-slate-900/80 border-y border-border text-foreground font-bold text-[12px] group select-none cursor-pointer">
                                  <td colSpan={FU_FIXTURES_META.length + 6} className="py-2 px-3 text-left">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <ChevronDown className="size-3.5 text-primary shrink-0" />
                                        <span className="font-extrabold text-foreground">{floor}</span>
                                        <span className="text-[10.5px] text-muted-foreground font-normal">({floorSpaces.length} space types)</span>
                                        <span className="text-[10px] text-muted-foreground/60 font-normal hidden sm:inline">(Right-click or press Delete to remove section)</span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {!isApprovedLocked && !isEffectiveReadOnly && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteFloorGroup(floor)}
                                            className="text-destructive hover:underline text-[10.5px] font-semibold px-2 py-0.5 rounded cursor-pointer border-0 bg-transparent transition-colors"
                                          >
                                            Delete Section
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50 font-sans">
                                <ContextMenuItem
                                  onClick={() => {
                                    const newName = window.prompt("Enter new floor section name:", floor);
                                    if (newName && newName.trim() && newName.trim() !== floor) {
                                      handleRenameFloorGroup(floor, newName.trim());
                                    }
                                  }}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                >
                                  <Edit3 className="size-3.5 text-muted-foreground" />
                                  <span>Rename Section</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleDeleteFloorGroup(floor)}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer text-[13px]"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>Delete Section</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Spaces on this Floor */}
                            {floorSpaces.length === 0 ? (
                              <tr>
                                <td colSpan={FU_FIXTURES_META.length + 6} className="py-4 text-center text-muted-foreground italic text-xs">
                                  No spaces in section {floor}. Click &quot;+ New Space&quot; above to add.
                                </td>
                              </tr>
                            ) : (
                              floorSpaces.map((s, sIdx) => {
                                const isSelected = selectedIds.includes(s.id);
                                const isEditing = editingSpace?.id === s.id;
                                const validation = getFUSpaceValidation(s);
                                const unitFU = calculations.spaceUnitFU[s.id] || 0;
                                const totalWSFU = calculations.spaceTotals[s.id] || 0;

                                return (
                                  <ContextMenu key={s.id}>
                                    <ContextMenuTrigger asChild>
                                      <tr
                                        id={`row-fu-${s.id}`}
                                        onClick={(e) => handleToggleSelect(s.id, !isSelected, e.shiftKey)}
                                        onDoubleClick={() => {
                                          setSelectedIds([s.id]);
                                          setEditingSpace(s);
                                        }}
                                        title="Click to select, Shift+Click for range. Double-click to open space breakdown."
                                        className={`border-b border-border/40 transition-colors cursor-pointer select-none ${
                                          isEditing
                                            ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-sm"
                                            : isSelected
                                            ? "bg-[#0A7BC7]/15 dark:bg-[#0A7BC7]/25 border-l-2 border-l-[#0A7BC7]"
                                            : validation.isFlagged
                                            ? "bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/50"
                                            : sIdx % 2 === 0
                                            ? "bg-white dark:bg-slate-950 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                            : "bg-slate-50/40 dark:bg-slate-900/20 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                        }`}
                                      >
                                        {/* Checkbox & Comment Icon */}
                                        <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex items-center justify-center gap-1.5">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => handleToggleSelect(s.id, e.target.checked)}
                                              className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded"
                                            />
                                            <span className="text-muted-foreground font-mono text-[11px]">{sIdx + 1}</span>
                                            {validation.isFlagged && (
                                              <span title="Flagged for review" className="inline-flex">
                                                <Flag className="size-3 text-amber-500 fill-amber-500" />
                                              </span>
                                            )}
                                          </div>
                                        </td>

                                        {/* Description */}
                                        <td className="py-1 px-2 border-r border-border/40">
                                          <input
                                            type="text"
                                            value={s.desc}
                                            disabled={isApprovedLocked || isEffectiveReadOnly}
                                            onChange={(e) => handleSpaceChange(s.id, "desc", e.target.value)}
                                            placeholder="Space Name / Type..."
                                            className="w-full bg-transparent border-0 outline-none text-foreground font-semibold text-xs rounded px-1 py-0.5 focus:bg-background focus:ring-1 focus:ring-primary"
                                          />
                                        </td>

                                        {/* Floor */}
                                        <td className="py-1 px-1.5 text-center border-r border-border/40 font-mono text-[11px] font-bold text-muted-foreground">
                                          {s.floor || floor}
                                        </td>

                                        {/* Standard */}
                                        <td className="py-1 px-1.5 text-center border-r border-border/40">
                                          <select
                                            value={s.std || headerStd}
                                            disabled={isApprovedLocked || isEffectiveReadOnly}
                                            onChange={(e) => handleSpaceChange(s.id, "std", e.target.value)}
                                            className="bg-transparent border-0 outline-none text-[11px] font-semibold text-foreground cursor-pointer"
                                          >
                                            <option value="ipc-total">IPC Total</option>
                                            <option value="ipc-cold">IPC Cold</option>
                                            <option value="ipc-hot">IPC Hot</option>
                                            <option value="low">Low</option>
                                            <option value="med">Med</option>
                                            <option value="high">High</option>
                                          </select>
                                        </td>

                                        {/* Fixtures counts */}
                                        {FU_FIXTURES_META.map(f => {
                                          const count = s.fixtures[f.id] || 0;
                                          return (
                                            <td key={f.id} className="py-1 px-0.5 text-center border-r border-border/40">
                                              <input
                                                type="number"
                                                min="0"
                                                disabled={isApprovedLocked || isEffectiveReadOnly}
                                                value={count > 0 ? count : ""}
                                                placeholder="-"
                                                onChange={(e) => handleFixtureChange(s.id, f.id, Number(e.target.value))}
                                                className={`w-full text-center bg-transparent border-0 outline-none font-mono text-xs py-0.5 rounded ${
                                                  count > 0 ? "font-bold text-foreground bg-primary/5" : "text-muted-foreground/40"
                                                }`}
                                              />
                                            </td>
                                          );
                                        })}

                                        {/* Unit WSFU */}
                                        <td className="py-1 px-2 text-center font-mono font-bold text-[#0A7BC7] border-r border-border/40 bg-blue-50/20 dark:bg-blue-950/10">
                                          {unitFU.toFixed(1)}
                                        </td>

                                        {/* Space Qty */}
                                        <td className="py-1 px-1 text-center border-r border-border/40">
                                          <input
                                            type="number"
                                            min="1"
                                            disabled={isApprovedLocked || isEffectiveReadOnly}
                                            value={s.qty || 1}
                                            onChange={(e) => handleSpaceChange(s.id, "qty", Math.max(1, Number(e.target.value) || 1))}
                                            className="w-12 text-center font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-amber-500"
                                          />
                                        </td>

                                        {/* Total WSFU */}
                                        <td className="py-1 px-2 text-center font-mono font-extrabold text-[#0A7BC7] border-r border-border/40 bg-blue-50/30 dark:bg-blue-950/20">
                                          {totalWSFU.toFixed(1)}
                                        </td>

                                        {/* Quick Actions */}
                                        <td className="py-1 px-1 text-center" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex items-center justify-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => setEditingSpace(s)}
                                              className="p-1 text-muted-foreground hover:text-primary hover:bg-surface-2 rounded cursor-pointer"
                                              title="Edit in Modal"
                                            >
                                              <Edit3 className="size-3.5" />
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleOpenComment(String(s.id), s.desc || `Space #${s.id}`)}
                                              className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded relative cursor-pointer"
                                              title="Comments & Tasks"
                                            >
                                              <MessageSquare className="size-3.5" />
                                              {Array.isArray(s.comments) && s.comments.length > 0 && (
                                                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
                                              )}
                                            </button>

                                            {!isApprovedLocked && !isEffectiveReadOnly && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  pushToUndo(fuSpaces);
                                                  setFuSpaces(prev => prev.filter(x => x.id !== s.id));
                                                  toast.success(`Removed space "${s.desc}"`);
                                                }}
                                                className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer"
                                                title="Delete Space"
                                              >
                                                <Trash2 className="size-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    </ContextMenuTrigger>

                                    {/* Space Right Click Context Menu */}
                                    <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50 font-sans">
                                      <ContextMenuItem
                                        onClick={() => {
                                          setSelectedIds([s.id]);
                                          setEditingSpace(s);
                                        }}
                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                      >
                                        <Edit3 className="size-3.5 text-muted-foreground" />
                                        <span>Edit Space Breakdown</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onClick={() => handleOpenComment(String(s.id), s.desc || `Space #${s.id}`)}
                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                      >
                                        <MessageSquare className="size-3.5 text-muted-foreground" />
                                        <span>Assign Comment / Task</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onClick={() => {
                                          const next = !s.flagged && !s.isFlagged;
                                          setFuSpaces(fuSpaces.map(x => x.id === s.id ? { ...x, flagged: next, isFlagged: next } : x));
                                        }}
                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                      >
                                        <Flag className={`size-3.5 ${validation.isFlagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                                        <span>{validation.isFlagged ? "Unflag Space" : "Flag for Review"}</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onClick={() => {
                                          const dup = { ...s, id: Date.now() + Math.random(), desc: `${s.desc} (Copy)` };
                                          pushToUndo(fuSpaces);
                                          setFuSpaces(prev => [...prev, dup]);
                                          toast.success(`Duplicated "${s.desc}"`);
                                        }}
                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                      >
                                        <Copy className="size-3.5 text-muted-foreground" />
                                        <span>Duplicate Space</span>
                                      </ContextMenuItem>
                                      <ContextMenuSeparator className="h-px bg-border my-1" />
                                      <ContextMenuItem
                                        disabled={isApprovedLocked || isEffectiveReadOnly}
                                        onClick={() => {
                                          if (isApprovedLocked || isEffectiveReadOnly) return;
                                          pushToUndo(fuSpaces);
                                          setFuSpaces(prev => prev.filter(x => x.id !== s.id));
                                          toast.success(`Deleted "${s.desc}"`);
                                        }}
                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer text-[13px]"
                                      >
                                        <Trash2 className="size-3.5" />
                                        <span>Delete Space</span>
                                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                );
                              })
                            )}
                          </tbody>
                        );
                      })}
                    </table>
                  </div>

                  {/* Pinned Bottom Summary Footer Strip (Attached to bottom, matching Ventilation Schedule) */}
                  <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 select-none no-print">
                    <div>
                      Showing <span className="text-foreground font-medium tabular">{filteredSpaces.length}</span> of {fuSpaces.length} spaces
                    </div>
                    <div className="flex items-center gap-3.5 tabular">
                      <span>Σ Total WSFU: <strong className="text-primary font-mono font-bold">{calculations.totalWSFU.toFixed(1)}</strong></span>
                      <span className="text-border">|</span>
                      <span>Peak Flow: <strong className="text-primary font-mono font-bold">{calculations.displayFlow}</strong></span>
                      <span className="text-border">|</span>
                      <span>Pipe Size: <strong className="text-foreground font-mono font-bold">{calculations.pipeSize}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sizing & Report Tab View */}
              {activeTab === "report" && (
                <FixtureUnitReportView
                  calculations={calculations}
                  fuSpaces={fuSpaces}
                  headerStd={headerStd}
                  unitSystem={unitSystem}
                  project={project}
                  calcReviewState={calcReviewState}
                  currentUserName={currentUserName}
                  onExportPdf={handleExportPDF}
                  onExportExcel={handleExportExcel}
                />
              )}
            </div>
          </div>
        </div>

        {/* Intelligence drawer (Collapsible right-side panel matching Ventilation) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] ml-4" : "w-0 ml-0"
          }`}
        >
          {intelOpen && (
            <FixtureUnitIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              fuSpaces={fuSpaces}
              calculations={calculations}
              unitSystem={unitSystem}
              headerStd={headerStd}
              onSelectSpace={(id) => {
                setSelectedIds([id]);
                const el = document.getElementById(`row-fu-${id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          )}
        </div>
      </div>

      {/* Edit Space Modal */}
      {editingSpace && (
        <EditFixtureUnitRowModal
          space={editingSpace}
          floorName={editingSpace.floor || "1F"}
          rowIndex={fuSpaces.findIndex(s => s.id === editingSpace.id) + 1}
          weightOverrides={weightOverrides}
          unitSystem={unitSystem}
          onSave={(updated) => {
            pushToUndo(fuSpaces);
            setFuSpaces(prev => prev.map(s => s.id === editingSpace.id ? { ...s, ...updated } : s));
            setEditingSpace(null);
            toast.success(`Updated "${updated.desc}"`);
          }}
          onClose={() => setEditingSpace(null)}
        />
      )}

      {/* Assign Comment Modal Overlay */}
      {commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="space"
          calculatorTitle="Fixture Unit Calculator"
          calculatorPath="/plumbing-fixture-unit"
          existingComments={fuSpaces.find((s) => String(s.id) === commentTargetItem.id)?.comments || []}
          onSave={(newComment) => {
            const next = fuSpaces.map(s => {
              if (String(s.id) === commentTargetItem.id) {
                const currentComments = Array.isArray(s.comments) ? s.comments : [];
                return { ...s, comments: [...currentComments, newComment] };
              }
              return s;
            });
            setFuSpaces(next);
            notifyCommentAssigned(newComment, "Fixture Unit Calculator", "/plumbing-fixture-unit", commentTargetItem.name);
          }}
        />
      )}
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Browser Preliminary Engineering Report Component
// ─────────────────────────────────────────────────────────────────────────────
function FixtureUnitReportView({
  calculations,
  fuSpaces,
  headerStd,
  unitSystem = "si",
  project,
  calcReviewState,
  currentUserName,
  onExportPdf,
  onExportExcel,
}: {
  calculations: any;
  fuSpaces: FUSpace[];
  headerStd: string;
  unitSystem?: "si" | "ip";
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  onExportPdf: () => void;
  onExportExcel: () => void;
}) {
  const sigDetails = getSignatureBlockDetails(project?.id || "default", "/plumbing-fixture-unit", currentUserName, calcReviewState);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar font-sans">
      {/* Action Header Banner */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <h2 className="text-base font-extrabold text-foreground tracking-tight">
              Water Supply Fixture Units (WSFU) Engineering Sizing Summary
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Governing standard: <strong className="text-foreground uppercase">{headerStd}</strong>. Probable demand flow determined via Hunter&apos;s Curve method.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-background hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer"
          >
            <FileText className="size-3.5" /> Export PDF Report
          </button>
        </div>
      </div>

      {/* Main KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col justify-between shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Total Cumulative Demand</span>
          <div className="text-2xl font-extrabold font-mono text-primary mt-1">
            {calculations.totalWSFU.toFixed(1)} <span className="text-xs font-sans font-bold">WSFU</span>
          </div>
          <span className="text-[10.5px] text-muted-foreground mt-2">Across {fuSpaces.length} space areas</span>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl flex flex-col justify-between shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Probable Peak Flow</span>
          <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
            {calculations.displayFlow}
          </div>
          <span className="text-[10.5px] text-muted-foreground mt-2">
            {unitSystem === "ip" ? `${calculations.probablePeakFlowLPS.toFixed(2)} L/s equivalent` : `${calculations.probablePeakFlowGPM.toFixed(1)} GPM equivalent`}
          </span>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl flex flex-col justify-between shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Recommended Supply Main</span>
          <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
            {calculations.pipeSize}
          </div>
          <span className="text-[10.5px] text-muted-foreground mt-2">Max v &le; 1.5 m/s (4.9 ft/s) velocity</span>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl flex flex-col justify-between shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Peak Fixture Driver</span>
          <div className="text-base font-extrabold text-foreground mt-1 flex items-center gap-1.5">
            <Droplets className="size-4 text-primary" />
            <span>Water Closets / W.C.</span>
          </div>
          <span className="text-[10.5px] text-muted-foreground mt-2">Flush tank / valve dominant</span>
        </div>
      </div>

      {/* Detailed Technical Tables */}
      <div className="space-y-6">
        
        {/* Floor Breakdown Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Floor-by-Floor Fixture Units Distribution
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">
              {Object.keys(calculations.floorTotals).length} Floor Levels
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-muted-foreground font-bold border-b border-border text-[10.5px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Floor Level</th>
                  <th className="py-2.5 px-3 text-center">Space Count</th>
                  <th className="py-2.5 px-3 text-right">Floor WSFU</th>
                  <th className="py-2.5 px-3 text-right">Recommended Riser Pipe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {Object.keys(calculations.floorTotals).map(floor => {
                  const data = calculations.floorTotals[floor];
                  const floorPipe = getRecommendedWaterPipe(data.totalWSFU);
                  return (
                    <tr key={floor}>
                      <td className="py-2 px-3 font-bold text-foreground">{floor}</td>
                      <td className="py-2 px-3 text-center font-mono">{data.spaceCount}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-primary">{data.totalWSFU.toFixed(1)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        {unitSystem === "ip" ? floorPipe.sizeInch : `DN${floorPipe.sizeMM} mm`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Official Sign-off & Verification Block */}
        <div className="pt-4 border-t border-border/80">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Prepared By:</span>
              <span className="font-bold text-foreground text-sm">{sigDetails.originatedName || currentUserName}</span>
              <span className="text-[11px] text-muted-foreground">Mechanical &amp; Plumbing Design Engineer</span>
              <span className="text-[10.5px] font-mono text-muted-foreground/70 mt-2">Date: {sigDetails.originatedDate || formatDateStr(new Date().toISOString())}</span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Reviewed By:</span>
              <span className="font-bold text-foreground text-sm">{sigDetails.reviewerName || "Lead MEP Engineer"}</span>
              <span className="text-[11px] text-muted-foreground">Discipline Quality Review</span>
              <span className="text-[10.5px] font-mono text-muted-foreground/70 mt-2">Date: {sigDetails.reviewerDate || "Pending Review"}</span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Approved By:</span>
              <span className="font-bold text-foreground text-sm">{sigDetails.approverName || "Project Director / Principal"}</span>
              <span className="text-[11px] text-muted-foreground">Head of Engineering / MEP QA</span>
              <span className="text-[10.5px] font-mono text-muted-foreground/70 mt-2">
                Status: <strong className={calcReviewState?.status === "APPROVED" ? "text-emerald-600" : "text-amber-600"}>
                  {calcReviewState?.status || "PRELIMINARY DRAFT"}
                </strong>
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ──────────────────── Fixture Unit Intelligence Drawer ───────────────────── */
function FixtureUnitIntelligenceDrawer({
  onClose,
  fuSpaces,
  calculations,
  unitSystem,
  headerStd,
  onSelectSpace,
}: {
  onClose: () => void;
  fuSpaces: FUSpace[];
  calculations: any;
  unitSystem: "si" | "ip";
  headerStd: string;
  onSelectSpace: (id: number) => void;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    flagged: false,
    zeroFixtures: false,
    missingDesc: false,
    highDemand: false,
  });

  const totalSpaces = fuSpaces.length;
  const flaggedSpaces = fuSpaces.filter(s => getFUSpaceValidation(s).isFlagged);
  const zeroFixtureSpaces = fuSpaces.filter(s => !s.fixtures || !Object.values(s.fixtures).some(v => Number(v) > 0));
  const missingDescSpaces = fuSpaces.filter(s => !s.desc || s.desc.trim() === "");
  const highDemandSpaces = fuSpaces.filter(s => (calculations.spaceTotals[s.id] || 0) > 30);

  const nonCompliantCount = new Set([
    ...flaggedSpaces.map(s => s.id),
    ...zeroFixtureSpaces.map(s => s.id),
    ...missingDescSpaces.map(s => s.id),
  ]).size;

  const compliancePct = totalSpaces > 0 ? Math.round(((totalSpaces - nonCompliantCount) / totalSpaces) * 100) : 100;

  const flaggedItems = flaggedSpaces.map(s => ({
    id: String(s.id),
    name: s.desc || `Space #${s.id}`,
    detail: `${s.floor || "1F"} • ${(calculations.spaceTotals[s.id] || 0).toFixed(1)} WSFU`,
  }));

  const zeroFixtureItems = zeroFixtureSpaces.map(s => ({
    id: String(s.id),
    name: s.desc || `Space #${s.id}`,
    detail: s.floor || "1F",
  }));

  const missingDescItems = missingDescSpaces.map(s => ({
    id: String(s.id),
    name: `Unnamed Space (${s.floor || "1F"})`,
    detail: `${(calculations.spaceTotals[s.id] || 0).toFixed(1)} WSFU`,
  }));

  const highDemandItems = highDemandSpaces.map(s => ({
    id: String(s.id),
    name: s.desc || `Space #${s.id}`,
    detail: `${(calculations.spaceTotals[s.id] || 0).toFixed(1)} WSFU (${s.floor || "1F"})`,
  }));

  // Dominant floor
  let dominantFloor = "1F";
  let dominantFloorWSFU = 0;
  Object.keys(calculations.floorTotals || {}).forEach(fl => {
    const fWSFU = calculations.floorTotals[fl]?.totalWSFU || 0;
    if (fWSFU > dominantFloorWSFU) {
      dominantFloorWSFU = fWSFU;
      dominantFloor = fl;
    }
  });

  const dominantFloorShare = calculations.totalWSFU > 0 ? Math.round((dominantFloorWSFU / calculations.totalWSFU) * 100) : 0;

  return (
    <div className="h-full w-[360px] flex flex-col bg-card border-l border-border animate-fade-in font-sans">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-bold tracking-tight text-foreground">Live Intelligence &amp; Audit</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 grid place-items-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Close Intelligence Panel"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto divide-y divide-border/60 custom-scrollbar">
        {/* Compliance Status */}
        <IntelSection icon={CheckCircle2} tone={compliancePct === 100 ? "success" : compliancePct > 70 ? "warning" : "muted"} title="Compliance &amp; Data Health">
          <div className="text-[12px] text-muted-foreground">
            IPC / UPC validation across {totalSpaces.toLocaleString()} spaces.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${compliancePct === 100 ? "bg-emerald-500" : compliancePct > 70 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${compliancePct}%` }}
              />
            </div>
            <span className="font-mono text-[11.5px] font-bold">{compliancePct}%</span>
          </div>
        </IntelSection>

        {/* Hydraulic Demand & Peak Flow */}
        <IntelSection icon={Gauge} tone="primary" title="Hydraulic Load &amp; Flow">
          <KV k="Total WSFU Load" v={`${calculations.totalWSFU.toFixed(1)} WSFU`} />
          <KV k="Probable Peak Flow" v={calculations.displayFlow} />
          <KV k="Rec. Main Water Pipe" v={calculations.pipeSize} />
          <KV k="Dominant Floor" v={`${dominantFloor} (${dominantFloorShare}%)`} />
        </IntelSection>

        {/* Calculation Issues & Missing Data */}
        <IntelSection icon={AlertTriangle} tone={nonCompliantCount > 0 ? "warning" : "muted"} title="Audit Warnings &amp; Missing Data">
          <CollapsibleMissingSection
            label="Flagged for review"
            count={flaggedItems.length}
            itemsList={flaggedItems}
            isOpen={openSections.flagged}
            onToggle={() => setOpenSections(prev => ({ ...prev, flagged: !prev.flagged }))}
            onItemClick={(id) => onSelectSpace(Number(id))}
          />
          <CollapsibleMissingSection
            label="Spaces with 0 fixtures"
            count={zeroFixtureItems.length}
            itemsList={zeroFixtureItems}
            isOpen={openSections.zeroFixtures}
            onToggle={() => setOpenSections(prev => ({ ...prev, zeroFixtures: !prev.zeroFixtures }))}
            onItemClick={(id) => onSelectSpace(Number(id))}
          />
          <CollapsibleMissingSection
            label="Spaces missing description"
            count={missingDescItems.length}
            itemsList={missingDescItems}
            isOpen={openSections.missingDesc}
            onToggle={() => setOpenSections(prev => ({ ...prev, missingDesc: !prev.missingDesc }))}
            onItemClick={(id) => onSelectSpace(Number(id))}
          />
          <CollapsibleMissingSection
            label="High-load spaces (>30 WSFU)"
            count={highDemandItems.length}
            itemsList={highDemandItems}
            isOpen={openSections.highDemand}
            onToggle={() => setOpenSections(prev => ({ ...prev, highDemand: !prev.highDemand }))}
            onItemClick={(id) => onSelectSpace(Number(id))}
          />
        </IntelSection>

        {/* Fixture Breakdown */}
        <IntelSection icon={Droplets} tone="primary" title="Top Fixture Breakdown">
          <div className="space-y-1.5 pt-1">
            {FU_FIXTURES_META.slice(0, 6).map(f => {
              const count = calculations.fixtureCounts[f.id] || 0;
              if (count === 0) return null;
              return (
                <div key={f.id} className="flex items-center justify-between text-[11.5px]">
                  <span className="text-muted-foreground">{f.short}</span>
                  <span className="font-mono font-bold text-foreground">{count} units</span>
                </div>
              );
            })}
          </div>
        </IntelSection>

        {/* Engineering Recommendations */}
        <IntelSection icon={Sparkles} tone="primary" title="Smart Recommendations">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4 leading-relaxed">
            {calculations.totalWSFU > 100 && (
              <li>High building demand detected ({calculations.totalWSFU.toFixed(0)} WSFU). Consider dual riser configuration to balance pressure.</li>
            )}
            <li>Hunter&apos;s Curve polynomial applied for intermittent flush valve / tank probabilities.</li>
            <li>Main water supply line sized for max velocity &le; 1.5 m/s (4.9 ft/s) to prevent hydraulic hammer.</li>
          </ul>
        </IntelSection>

        <IntelSection icon={Info} tone="muted" title="Engineering Verification">
          <div className="text-[11.5px] text-muted-foreground leading-relaxed">
            Standard: <strong>{headerStd.toUpperCase()}</strong>. Values automatically sync with downstream booster and storage sizing schedules.
          </div>
        </IntelSection>
      </div>
    </div>
  );
}

function CollapsibleMissingSection({
  label,
  count,
  itemsList,
  isOpen,
  onToggle,
  onItemClick
}: {
  label: string;
  count: number;
  itemsList: { id: string; name: string; detail: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (id: string) => void;
}) {
  return (
    <div className="border-b border-border/40 last:border-b-0 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[12.5px] font-medium text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none py-0.5"
      >
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          {isOpen ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
        </span>
        <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${count > 0 ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
          {count}
        </span>
      </button>

      {isOpen && count > 0 && (
        <div className="mt-1.5 max-h-36 overflow-y-auto border border-border/60 rounded-lg bg-slate-50 dark:bg-slate-900/60 divide-y divide-border/40 font-mono text-[10.5px] text-muted-foreground custom-scrollbar">
          {itemsList.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick(item.id)}
              className="block w-full px-2.5 py-1.5 hover:bg-primary/10 transition-colors text-left cursor-pointer select-none"
            >
              <div className="text-[11.5px] leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis block">
                <span className="font-sans font-medium text-foreground/90 hover:text-primary transition-colors">
                  {item.name}
                </span>
                <span className="text-muted-foreground/60 text-[10px] font-mono ml-1.5">
                  ({item.detail})
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IntelSection({
  icon: Icon,
  title,
  tone,
  children
}: {
  icon: any;
  title: string;
  tone: "success" | "warning" | "primary" | "muted";
  children: React.ReactNode;
}) {
  const color =
    tone === "success" ? "text-emerald-500" :
    tone === "warning" ? "text-amber-500" :
    tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <section className="px-3 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-3.5 ${color}`} />
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-foreground/80">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex items-center justify-between text-[12px] py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono font-bold text-foreground">{v}</span>
    </div>
  );
}
