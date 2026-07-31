import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { predictOccupancyCategory, predictSpacePressure } from "@/lib/ai-occupancy";
import {
  Plus, Download, Upload, Filter, Columns3, GroupIcon, Pin,
  ChevronDown, ChevronUp, Trash2, Edit3, Copy, X, Bookmark, Wrench,
  Sparkles, AlertTriangle, CheckCircle2, Info, Gauge, FileText, Printer, FileSpreadsheet,
  FolderKanban, ArrowUpDown, GripVertical, Check, Flag, ChevronsUpDown,
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace, workspaceStore, checkIfSpaceMissingData, type Space, type SpaceStatus, type Zone, type Equipment, type ZoneInstanceAssignment } from "@/lib/workspace-store";
import { calculateVentilation } from "@/lib/ventilation-calc";
import { EditSpaceModal } from "@/components/workspace/EditSpaceModal";
import { SharedAssignmentModal } from "@/components/workspace/SharedAssignmentModal";
import { CategorySelect } from "@/components/workspace/CategorySelect";
import { getOccupancyCategories, getOccupancyData, getCategoryDisplayName } from "@/lib/ashrae-data";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";



import { DashboardPage } from "./dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MEP Calculator" },
      { name: "description", content: "System-wide calculations metrics, active warnings, and project compliance." },
    ],
  }),
  component: DashboardPage,
});

const STATUS_STYLE: Record<SpaceStatus, string> = {
  complete: "bg-success/10 text-success",
  "in-progress": "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
  draft: "bg-muted text-muted-foreground",
};

const PRESSURE_MAP: Record<string, string> = {
  "Neutral": "0",
  "Positive": "1",
  "Negative": "-1",
  "Critical": "-2",
};

const REVERSE_PRESSURE_MAP: Record<string, string> = {
  "0": "Neutral",
  "1": "Positive",
  "-1": "Negative",
  "-2": "Critical",
};

type Tab = "spaces" | "zones" | "equipment" | "report";
const TABS: { id: Tab; label: string }[] = [
  { id: "spaces", label: "Spaces" },
  { id: "zones", label: "Zones" },
  { id: "equipment", label: "Equipment" },
  { id: "report", label: "Report" },
];

export function VentilationModule() {
  if (import.meta.env.VITE_APP_MODE === 'kfactor') {
    return <Navigate to="/plumbing-sprinkler-kfactor" />;
  }

  const [tab, setTab] = useState<Tab>("spaces");
  const [intelOpen, setIntelOpen] = useState(false);
  const { spaces, zones, equipment, roundOffPreset, setRoundOffPreset } = useWorkspace();

  const totalArea = Math.round(spaces.reduce((sum, s) => sum + ((s.area || 0) * (s.multiplier || 1)), 0));
  const totalMinFresh = Math.round(spaces.reduce((sum, s) => sum + (s.minOA || 0), 0));
  const totalMinExtract = Math.round(spaces.reduce((sum, s) => sum + (s.minExt || 0), 0));
  
  const actualFA = spaces.reduce((sum, s) => sum + (s.freshAir || 0), 0);
  const actualEA = spaces.reduce((sum, s) => sum + (s.extractAir || 0), 0);
  const netFlow = actualFA - actualEA;
  const avgPressure = totalArea > 0 ? (netFlow / totalArea) * 5.6 : 0;

  return (
    <AppShell 
      title="Ventilation" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">HVAC &gt; VENTILATION</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Ventilation</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{spaces.length} spaces</span>
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
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Fresh air, extract, and pressure balance for every space in the project.
              </p>
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden">
            {/* Tabs Selector row */}
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

              {/* Round-off preset toggle option */}
              <div className="flex items-center gap-2.5 select-none shrink-0 bg-slate-50/40 dark:bg-zinc-900/10 border border-slate-200/40 dark:border-zinc-800/40 px-3.5 py-1 rounded-full">
                <span className="text-[10px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  ROUND-OFF:
                </span>
                <div className="flex bg-[#f1f5f9] dark:bg-zinc-800/60 p-0.5 rounded-full border border-slate-200/40 dark:border-zinc-700/40 shadow-xs">
                  {[0.5, 1, 5].map((preset) => {
                    const active = (roundOffPreset ?? 5) === preset;
                    return (
                      <button
                        key={preset}
                        onClick={() => setRoundOffPreset(preset)}
                        className={`px-3.5 py-1.5 text-[11px] font-bold rounded-full transition-all duration-150 cursor-pointer ${
                          active
                            ? "bg-white dark:bg-zinc-900 text-slate-850 dark:text-zinc-150 shadow-xs border border-slate-200/20 dark:border-zinc-800/20"
                            : "text-slate-500 dark:text-zinc-400 hover:text-slate-850 dark:hover:text-zinc-150"
                        }`}
                      >
                        {preset} L/s
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Active Tab View */}
            <div key={tab} className="flex-1 min-h-0 animate-fade-in flex flex-col">
              {tab === "spaces" && <SpacesView />}
              {tab === "zones" && <ZonesView />}
              {tab === "equipment" && <EquipmentView />}
              {tab === "report" && <ReportView />}
            </div>
          </div>
        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && <IntelligenceDrawer onClose={() => setIntelOpen(false)} setTab={setTab} />}
        </div>
      </div>
    </AppShell>
  );
}

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder }: InlineInputProps) {
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
      placeholder={placeholder}
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
      className={`bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text ${className}`}
    />
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ Spaces â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface SavedView {
  id: string;
  name: string;
  filters: {
    building: string | null;
    floor: string | null;
    zone: string | null;
    category: string | null;
    warning: boolean;
    query: string;
  };
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ Spaces â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function SpacesView() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const {
    spaces,
    zones,
    equipment,
    updateSpaces,
    addSpace,
    addZone,
    addEquipment,
    deleteSpaces,
    addSpacesBulk,
    bulkUpdateSpaces,
    mergeSpaces,
    autoZoneSpaces,
    createNewProject,
    clearWorkspace,
    copySpaces,
    cutSpaces,
    pasteSpaces,
    setWorkspaceState,
    undo,
    redo,
  } = useWorkspace();

  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedBuilding) count++;
    if (selectedFloor) count++;
    if (selectedZone) count++;
    if (selectedCategory) count++;
    return count;
  }, [selectedBuilding, selectedFloor, selectedZone, selectedCategory]);

  const handleResetFilters = () => {
    setSelectedBuilding(null);
    setSelectedFloor(null);
    setSelectedZone(null);
    setSelectedCategory(null);
  };

  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem("mep-saved-views");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [floorOrder, setFloorOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("mep-floor-order");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const allUniqueFloors = useMemo(() => {
    const vals = new Set<string>();
    spaces.forEach((s) => {
      if (s.floor) vals.add(s.floor);
    });
    return Array.from(vals).sort();
  }, [spaces]);

  const sortedFloorsForGrid = useMemo(() => {
    const ordered = floorOrder.filter((f) => allUniqueFloors.includes(f));
    const remaining = allUniqueFloors.filter((f) => !ordered.includes(f));
    return [...ordered, ...remaining];
  }, [allUniqueFloors, floorOrder]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;

    const nextList = [...sortedFloorsForGrid];
    const draggedItem = nextList[draggingIndex];
    nextList.splice(draggingIndex, 1);
    nextList.splice(index, 0, draggedItem);

    setDraggingIndex(index);
    setFloorOrder(nextList);
    localStorage.setItem("mep-floor-order", JSON.stringify(nextList));
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  const handleResetFloorOrder = () => {
    setFloorOrder([]);
    localStorage.removeItem("mep-floor-order");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
          activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true"
        );
        if (!isEditing) {
          setSelected(new Set());
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setSelected]);

  const confirm = useConfirm();
  const prompt = usePrompt();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);

  // Modal states
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectValues, setNewProjectValues] = useState({
    name: "Marina Bay Tower",
    code: "MBT-2026-117",
    client: "Marina Holdings",
  });

  // Modal states
  const [importOpen, setImportOpen] = useState(false);
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [lastClickedPendingIndex, setLastClickedPendingIndex] = useState<number | null>(null);
  const [importBulkValues, setImportBulkValues] = useState({
    level: "",
    zone: "",
    category: "",
    pressure: "",
    height: "",
    fixtures: "",
    multiplier: "",
  });

  useEffect(() => {
    if (importOpen && pendingRecords.length === 0) {
      const timer = setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [importOpen, pendingRecords.length]);

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState({
    building: "",
    floor: "",
    category: "",
    pressure: "",
    area: "",
    height: "",
    fixtures: "",
    multiplier: "",
    zone: "",
    equipment: "",
  });
  const [bulkEditFields, setBulkEditFields] = useState({
    building: false,
    floor: false,
    category: false,
    pressure: false,
    area: false,
    height: false,
    fixtures: false,
    multiplier: false,
    zone: false,
    equipment: false,
  });
  const [customParamModalSpace, setCustomParamModalSpace] = useState<Space | null>(null);
  const [restroomModalSpace, setRestroomModalSpace] = useState<Space | null>(null);

  const [assignZoneOpen, setAssignZoneOpen] = useState(false);
  const [targetZone, setTargetZone] = useState("");

  const [assignEquipOpen, setAssignEquipOpen] = useState(false);
  const [targetEquip, setTargetEquip] = useState("");

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState("");
  const [primarySpaceId, setPrimarySpaceId] = useState("");

  // Premium Autozoning State
  const [autoZoneFloorSelectOpen, setAutoZoneFloorSelectOpen] = useState(false);
  const [autoZoneAvailableFloors, setAutoZoneAvailableFloors] = useState<string[]>([]);
  const [autoZoneSelectedFloors, setAutoZoneSelectedFloors] = useState<Set<string>>(new Set());
  const [autoZoneConfirmOpen, setAutoZoneConfirmOpen] = useState(false);
  const [autoZoneSpacesToProcess, setAutoZoneSpacesToProcess] = useState<Space[]>([]);
  const [autoZoneIgnoredCount, setAutoZoneIgnoredCount] = useState(0);

  // Excel File upload parsing helper
  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          await confirm("Empty file!", {
            title: "Import Error",
            confirmText: "OK",
            hideCancel: true,
          });
          return;
        }

        // Find headers
        let headerRowIndex = -1;
        let headers: string[] = [];
        for (let r = 0; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (row && row.length > 0) {
            const rowNormalized = row.map((cell) => (cell ? String(cell).trim().toLowerCase() : ""));
            const possibleHeaders = ["level", "zone", "name", "area", "room: unbounded height", "unbounded height", "number of people", "occupants", "fixtures", "fixtures/occupancy", "occupancy"];
            const hasHeader = rowNormalized.some((cell) => possibleHeaders.includes(cell));
            if (hasHeader) {
              headerRowIndex = r;
              headers = rowNormalized;
              break;
            }
          }
        }

        if (headerRowIndex === -1) {
          await confirm("Missing header row! Excel must contain columns: Level, Zone, Name, Area.", {
            title: "Import Error",
            confirmText: "OK",
            hideCancel: true,
          });
          return;
        }

        const idxLevel = headers.indexOf("level");
        const idxZone = headers.indexOf("zone");
        const idxName = headers.indexOf("name");
        const idxArea = headers.indexOf("area");
        
        let idxHeight = headers.indexOf("room: unbounded height");
        if (idxHeight === -1) idxHeight = headers.indexOf("unbounded height");
        
        let idxPeople = headers.indexOf("number of people");
        if (idxPeople === -1) idxPeople = headers.indexOf("occupants");
        if (idxPeople === -1) idxPeople = headers.indexOf("fixtures");
        if (idxPeople === -1) idxPeople = headers.indexOf("fixtures/occupancy");
        if (idxPeople === -1) idxPeople = headers.indexOf("occupancy");

        if (idxLevel === -1 || idxName === -1 || idxArea === -1) {
          await confirm("Missing Level, Name, or Area columns.", {
            title: "Import Error",
            confirmText: "OK",
            hideCancel: true,
          });
          return;
        }

        const parsed: any[] = [];
        for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!row || row.length === 0) continue;

          const levelVal = String(row[idxLevel] || "").trim();
          const nameVal = String(row[idxName] || "").trim();
          const zoneVal = String(row[idxZone] || "").trim();

          if (!nameVal) continue;

          const rawArea = String(row[idxArea] || "").trim();
          const areaCleaned = rawArea.replace(/[^\d\.]/g, "");
          const area = parseFloat(areaCleaned) || 0;

          let height = 3.0;
          if (idxHeight !== -1) {
            const rawHeight = String(row[idxHeight] || "").trim();
            const heightCleaned = rawHeight.replace(/[^\d\.]/g, "");
            let hVal = parseFloat(heightCleaned) || 3.0;
            if (hVal > 100) hVal = hVal / 1000;
            height = Math.round(hVal * 100) / 100;
          }

          let fixtures = "";
          if (idxPeople !== -1) {
            const rawPeople = String(row[idxPeople] || "").trim();
            const peopleCleaned = rawPeople.replace(/[^\d]/g, "");
            fixtures = peopleCleaned === "" ? "" : parseInt(peopleCleaned).toString();
          }

          const zoneName = zoneVal || "Default";

          // Predict category and pressure
          const predCat = predictOccupancyCategory(nameVal);
          const predPress = predictSpacePressure(predCat.category || "");

          parsed.push({
            id: `pending-${r}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            level: levelVal,
            zone: zoneName,
            name: nameVal,
            category: predCat.category || "",
            aiDetected: !!predCat.category,
            confidence: predCat.confidence,
            pressure: predPress.pressure,
            pressureAutoDetected: predPress.autoDetected,
            area,
            height,
            fixtures,
            multiplier: 1,
          });
        }

        setPendingRecords(parsed);
        setSelectedPending(new Set(parsed.map((p) => p.id)));
      } catch (err) {
        console.error(err);
        await confirm("Failed to parse Excel file.", {
          title: "Import Error",
          confirmText: "OK",
          hideCancel: true,
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcelFile(file);
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      parseExcelFile(file);
    } else if (file) {
      await confirm("Invalid file type. Please upload an Excel sheet (.xlsx, .xls).", {
        title: "Invalid File",
        confirmText: "OK",
        hideCancel: true,
      });
    }
  };

  // Pending import bulk actions
  const handlePendingBulkApply = () => {
    setPendingRecords((prev) =>
      prev.map((rec) => {
        if (selectedPending.has(rec.id)) {
          return {
            ...rec,
            level: importBulkValues.level || rec.level,
            zone: importBulkValues.zone || rec.zone,
            category: importBulkValues.category || rec.category,
            aiDetected: importBulkValues.category ? false : rec.aiDetected,
            pressure: importBulkValues.pressure || rec.pressure,
            pressureAutoDetected: importBulkValues.pressure ? false : rec.pressureAutoDetected,
            height: importBulkValues.height ? parseFloat(importBulkValues.height) || rec.height : rec.height,
            fixtures: importBulkValues.fixtures !== "" ? importBulkValues.fixtures : rec.fixtures,
            multiplier: importBulkValues.multiplier ? parseInt(importBulkValues.multiplier) || rec.multiplier : rec.multiplier,
          };
        }
        return rec;
      })
    );
  };

  const togglePending = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelectedPending((prev) => {
      const clickedIndex = pendingRecords.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift && lastClickedPendingIndex !== null) {
        const start = Math.min(lastClickedPendingIndex, clickedIndex);
        const end = Math.max(lastClickedPendingIndex, clickedIndex);

        if (!isCtrl) {
          next.clear();
        }

        const shouldSelect = prev.has(pendingRecords[lastClickedPendingIndex]?.id || "") || true;

        for (let i = start; i <= end; i++) {
          const recId = pendingRecords[i]?.id;
          if (recId) {
            if (shouldSelect) {
              next.add(recId);
            } else {
              next.delete(recId);
            }
          }
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedPendingIndex(clickedIndex);
      } else {
        next.clear();
        next.add(id);
        setLastClickedPendingIndex(clickedIndex);
      }
      return next;
    });
  };

  // Commit Excel parsed records to workspace store
  const handleCommitImports = async () => {
    const toImport = pendingRecords.filter((rec) => selectedPending.has(rec.id));
    if (toImport.length === 0) {
      await confirm("No records selected!", {
        title: "Selection Required",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }

    // Clear existing data (removes dummy spaces, zones, and equipment)
    clearWorkspace();

    const spacesToAdd: Space[] = toImport.map((rec, index) => {
      const code = `${rec.level}-${rec.zone}-${String(index + 1).padStart(3, "0")}`;
      const parsedFixtures = (rec.fixtures !== "" && rec.fixtures !== undefined && rec.fixtures !== null)
        ? parseInt(rec.fixtures)
        : NaN;
      const data = getOccupancyData(rec.category);
      const defaultOcc = data
        ? (data.exhaustPerUnit > 0 && data.defaultDensity === 0 ? 1 : Math.ceil((rec.area * data.defaultDensity) / 100))
        : 8;
      const occupancy = !isNaN(parsedFixtures) ? parsedFixtures : defaultOcc;

      return {
        id: `sp-${Date.now()}-${index}`,
        code,
        name: rec.name,
        building: "Tower A",
        floor: rec.level,
        zone: rec.zone,
        category: rec.category,
        area: rec.area,
        occupancy,
        freshAir: 0,
        extractAir: 0,
        pressure: rec.pressure,
        equipment: "",
        status: "complete",
        height: rec.height,
        fixtures: rec.fixtures,
        multiplier: rec.multiplier,
        aiDetected: rec.aiDetected,
        pressureAutoDetected: rec.pressureAutoDetected,
      };
    });

    addSpacesBulk(spacesToAdd);
    setPendingRecords([]);
    setSelectedPending(new Set());
    setImportOpen(false);
  };

  // Helper to validate space completeness for auto-zoning (must have category, area, height, multiplier)
  const validateSpacesForAutoZoning = async (spacesToValidate: Space[]): Promise<boolean> => {
    const invalidSpaces = spacesToValidate.filter((s) => {
      const hasCategory = s.category && s.category.trim() !== "";
      const areaVal = parseFloat(String(s.area));
      const hasArea = !isNaN(areaVal) && areaVal > 0;
      const heightVal = parseFloat(String(s.height));
      const hasHeight = !isNaN(heightVal) && heightVal > 0;
      const multVal = parseFloat(String(s.multiplier));
      const hasMultiplier = !isNaN(multVal) && multVal > 0;
      
      return !hasCategory || !hasArea || !hasHeight || !hasMultiplier;
    });

    if (invalidSpaces.length > 0) {
      const spaceDetails = invalidSpaces
        .map((s) => {
          const missing = [];
          if (!s.category || s.category.trim() === "") missing.push("Category");
          const areaVal = parseFloat(String(s.area));
          if (isNaN(areaVal) || areaVal <= 0) missing.push("Area");
          const heightVal = parseFloat(String(s.height));
          if (isNaN(heightVal) || heightVal <= 0) missing.push("Height");
          const multVal = parseFloat(String(s.multiplier));
          if (isNaN(multVal) || multVal <= 0) missing.push("Multiplier");
          
          return `- ${s.name} (${s.floor || "L01"}): Missing ${missing.join(", ")}`;
        })
        .join("\n");

      await confirm(
        `Auto-zoning stopped. The following spaces must have Category, Area, Height, and Multiplier filled with valid positive values:\n\n${spaceDetails}`,
        {
          title: "Incomplete Parameters",
          confirmText: "OK",
          hideCancel: true,
        }
      );
      return false;
    }
    return true;
  };

  // Trigger auto zoning analysis on unzoned positive-pressure spaces
  const triggerAutoZoning = async (spacesToConsider?: any) => {
    // Collect unique floors in the project
    const floors = Array.from(new Set(spaces.map(s => s.floor || "L01"))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (floors.length === 0) {
      await confirm("No floors found in the project.", {
        title: "Validation Error",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }

    setAutoZoneAvailableFloors(floors);
    setAutoZoneSelectedFloors(new Set(floors)); // All selected by default
    setAutoZoneFloorSelectOpen(true);
  };

  const handleFloorSelectProceed = async () => {
    if (autoZoneSelectedFloors.size === 0) {
      await confirm("Please select at least one floor.", {
        title: "Validation Error",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }

    const selectedFloorsArr = Array.from(autoZoneSelectedFloors);

    // 1. Check for neutral/negative unzoned spaces on the selected floors
    const unzonedNegOrNeutral = spaces.filter((s) => {
      const onSelectedFloor = autoZoneSelectedFloors.has(s.floor || "L01");
      if (!onSelectedFloor) return false;
      const isUnzoned = !s.zone || s.zone.trim() === "" || s.zone.toLowerCase() === "default" || s.zone.toLowerCase() === "unzoned" || !zones.some(z => z.id === s.zone || z.name === s.zone);
      const isNotPositive = s.pressure !== "Positive";
      return isUnzoned && isNotPositive;
    });

    if (unzonedNegOrNeutral.length > 0) {
      const spaceDetails = unzonedNegOrNeutral.map(s => `- ${s.name} (${s.floor || "L01"}) [${s.pressure || "Neutral"} Pressure]`).join("\n");
      await confirm(
        `Auto-zoning stopped. The following unzoned neutral/negative spaces on the selected floor(s) must be manually zoned with a positive space:\n\n${spaceDetails}`,
        {
          title: "Validation Error",
          confirmText: "OK",
          hideCancel: true,
        }
      );
      return;
    }

    // 2. Filter to positive & unzoned spaces on selected floors
    const eligible = spaces.filter((s) => {
      const onSelectedFloor = autoZoneSelectedFloors.has(s.floor || "L01");
      if (!onSelectedFloor) return false;
      const isPositive = s.pressure === "Positive";
      const isUnzoned = !s.zone || s.zone.trim() === "" || s.zone.toLowerCase() === "default" || s.zone.toLowerCase() === "unzoned" || !zones.some(z => z.id === s.zone || z.name === s.zone);
      return isPositive && isUnzoned;
    });

    if (eligible.length === 0) {
      await confirm("No eligible positive-pressure, unzoned spaces found on the selected floor(s).", {
        title: "Validation Error",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }

    // 3. Check parameter completeness for these eligible spaces
    const valid = await validateSpacesForAutoZoning(eligible);
    if (!valid) {
      return;
    }

    // 4. Do the zoning immediately
    const nextZones = [...zones];
    const nextSpaces = spaces.map((s) => ({ ...s }));

    eligible.forEach((s) => {
      const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const baseName = `${s.name} Zone`;

      let uniqueName = baseName;
      let counter = 1;
      while (
        nextZones.some((z) => z.name.toLowerCase() === uniqueName.toLowerCase())
      ) {
        uniqueName = `${baseName} ${counter++}`;
      }

      const newZone: Zone = {
        id: zoneId,
        name: uniqueName,
        building: s.building || "Tower A",
        floor: s.floor || "L01",
        spaceCount: 1,
        area: s.area || 0,
        freshAir: 0,
        extractAir: 0,
        pressure: 0,
        equipment: [],
        pressureType: "positive",
        faAssignment: null,
        eaAssignment: null,
      };

      nextZones.push(newZone);

      const targetSpace = nextSpaces.find((sp) => sp.id === s.id);
      if (targetSpace) {
        targetSpace.zone = uniqueName;
      }
    });

    setWorkspaceState({
      spaces: nextSpaces,
      zones: nextZones,
      equipment,
    });

    // Cleanup and close
    setAutoZoneFloorSelectOpen(false);
    setAutoZoneSpacesToProcess([]);
    setAutoZoneIgnoredCount(0);
    setSelected(new Set());

    await confirm(`Successfully created ${eligible.length} zone(s) on floor(s): ${selectedFloorsArr.join(", ")}.`, {
      title: "Auto-Zoning Complete",
      confirmText: "OK",
      hideCancel: true,
    });
  };

  const handleBulkEditApply = async () => {
    const spaceIds = Array.from(selected);

    // If a zone is being assigned, validate it first
    if (bulkEditFields.zone && bulkEditValues.zone) {
      const trimmedZone = bulkEditValues.zone.trim();
      const selectedSpaces = spaces.filter((s) => spaceIds.includes(s.id));

      // Multi-floor check
      const uniqueFloors = Array.from(new Set(selectedSpaces.map((s) => s.floor || "Unassigned")));
      if (uniqueFloors.length > 1) {
        await confirm(
          `Spaces from different floors cannot be grouped into the same zone.\n\nSelected spaces belong to multiple floors: (${uniqueFloors.join(", ")}). Please select spaces from the same floor only.`,
          {
            title: "Multi-Floor Zone Error",
            confirmText: "OK",
            hideCancel: true,
          }
        );
        return;
      }

      // Existing Zone Floor Mismatch check
      const existingZone = zones.find((z) => z.name.toLowerCase() === trimmedZone.toLowerCase());
      if (existingZone && selectedSpaces[0]?.floor && existingZone.floor !== selectedSpaces[0].floor) {
        await confirm(
          `Zone "${existingZone.name}" already exists on floor ${existingZone.floor}.\n\nSpaces from ${selectedSpaces[0].floor} cannot be assigned to a zone on ${existingZone.floor}.`,
          {
            title: "Zone Floor Mismatch",
            confirmText: "OK",
            hideCancel: true,
          }
        );
        return;
      }

      const finalZoneName = existingZone?.name || trimmedZone;
      const finalSpacesInZone = spaces.map((s) => {
        if (spaceIds.includes(s.id)) {
          return { 
            ...s, 
            zone: finalZoneName,
            category: bulkEditFields.category ? bulkEditValues.category : s.category,
            area: s.area,
            pressure: bulkEditFields.pressure ? bulkEditValues.pressure : s.pressure
          };
        }
        return s;
      }).filter((s) => s.zone === finalZoneName);

      // Check Category and Area
      const missingCategoryOrArea = finalSpacesInZone.some(
        (s) => !s.category || s.category.trim() === "" || !s.area || s.area <= 0
      );
      if (missingCategoryOrArea) {
        await confirm("Cannot assign zone: Category and Area are compulsory for all spaces in the zone.", {
          title: "Validation Error",
          confirmText: "OK",
          hideCancel: true,
        });
        return;
      }

      // Check Positive pressure space
      const hasPositiveSpace = finalSpacesInZone.some((s) => s.pressure === "Positive");
      if (!hasPositiveSpace) {
        await confirm("Cannot form zone: A zone must contain at least one positive-pressure space.", {
          title: "Validation Error",
          confirmText: "OK",
          hideCancel: true,
        });
        return;
      }

      // Check if spaces are already in other zones
      const spacesAlreadyInZone = selectedSpaces.filter((s) => s.zone && s.zone.trim() !== "" && s.zone.toLowerCase() !== finalZoneName.toLowerCase());
      if (spacesAlreadyInZone.length > 0) {
        const message = spacesAlreadyInZone.length === 1
          ? `Space "${spacesAlreadyInZone[0].name}" is already assigned to zone "${spacesAlreadyInZone[0].zone}". Do you want to reassign it to zone "${finalZoneName}"?`
          : `${spacesAlreadyInZone.length} spaces are already assigned to other zones (e.g. "${spacesAlreadyInZone[0].name}" in "${spacesAlreadyInZone[0].zone}"). Do you want to reassign them to zone "${finalZoneName}"?`;
        
        const proceed = await confirm(message, {
          title: "Reassign Zone?",
          confirmText: "Reassign",
          cancelText: "Cancel",
        });
        if (!proceed) {
          return;
        }
      }

      // Create zone if it doesn't exist
      const zoneExists = zones.some((z) => z.name.toLowerCase() === trimmedZone.toLowerCase());
      if (!zoneExists) {
        const firstSpace = selectedSpaces[0];
        const building = firstSpace?.building || "Tower A";
        const floor = firstSpace?.floor || "L01";

        const newZone = {
          id: `zone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          name: trimmedZone,
          building,
          floor,
          spaceCount: 0,
          area: 0,
          freshAir: 0,
          extractAir: 0,
          pressure: 0,
          equipment: [],
          pressureType: "neutral" as const,
        };
        addZone(newZone);
      }
    }

    // If equipment is being assigned, create if it doesn't exist
    if (bulkEditFields.equipment && bulkEditValues.equipment.trim()) {
      const equipExists = equipment.some((e) => e.tag.toLowerCase() === bulkEditValues.equipment.trim().toLowerCase());
      if (!equipExists) {
        const newUnit: Equipment = {
          id: `equip-${Date.now()}`,
          tag: bulkEditValues.equipment.trim(),
          type: "AHU",
          zones: 0,
          spaces: 0,
          totalAirflow: 0,
          capacity: 1000,
          utilization: 0,
          status: "design" as const,
          zoneIds: [],
        };
        addEquipment(newUnit);
      }
    }

    const updatedSpacesList = spaces.map((s) => {
      if (spaceIds.includes(s.id)) {
        const nextSpace = { ...s };
        if (bulkEditFields.building) {
          nextSpace.building = bulkEditValues.building.trim();
        }
        if (bulkEditFields.floor) {
          nextSpace.floor = bulkEditValues.floor.trim();
        }
        if (bulkEditFields.area) {
          nextSpace.area = parseFloat(bulkEditValues.area) || 10.0;
        }
        if (bulkEditFields.category) {
          const categoryVal = bulkEditValues.category;
          nextSpace.category = categoryVal;
          nextSpace.aiDetected = false;
          
          if (categoryVal === "Other" || categoryVal === "OTHER" || categoryVal.endsWith(" (Custom)")) {
            nextSpace.category = (categoryVal === "Other" || categoryVal === "OTHER") ? "Custom (Custom)" : categoryVal;
          } else if (categoryVal) {
            const data = getOccupancyData(categoryVal);
            if (data && !nextSpace.isOccupancyCustomized) {
              const defaultOcc = (data.exhaustPerUnit > 0 && data.defaultDensity === 0)
                ? 1
                : Math.ceil((nextSpace.area * data.defaultDensity) / 100);
              nextSpace.occupancy = defaultOcc;
              nextSpace.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
            }
          } else {
            nextSpace.category = "";
          }
        } else if (bulkEditFields.area) {
          // If only area changed (and category remains active), recalculate default occupancy
          if (nextSpace.category && !nextSpace.isOccupancyCustomized) {
            const data = getOccupancyData(nextSpace.category);
            if (data) {
              const defaultOcc = (data.exhaustPerUnit > 0 && data.defaultDensity === 0)
                ? 1
                : Math.ceil((nextSpace.area * data.defaultDensity) / 100);
              nextSpace.occupancy = defaultOcc;
              nextSpace.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
            }
          }
        }
        if (bulkEditFields.pressure) {
          nextSpace.pressure = bulkEditValues.pressure;
          nextSpace.pressureAutoDetected = false;
        }
        if (bulkEditFields.height) {
          nextSpace.height = parseFloat(bulkEditValues.height) || 3.0;
        }
        if (bulkEditFields.fixtures) {
          const fixturesVal = bulkEditValues.fixtures.trim();
          nextSpace.fixtures = fixturesVal;
          
          if (nextSpace.category) {
            const data = getOccupancyData(nextSpace.category);
            if (data) {
              nextSpace.occupancy = fixturesVal === "" 
                ? Math.ceil((s.area * (data.defaultDensity || 0)) / 100) 
                : parseFloat(fixturesVal) || 0;
            } else {
              nextSpace.occupancy = fixturesVal === "" ? 0 : parseFloat(fixturesVal) || 0;
            }
          } else {
            nextSpace.occupancy = fixturesVal === "" ? 0 : parseFloat(fixturesVal) || 0;
          }
        }
        if (bulkEditFields.multiplier) {
          nextSpace.multiplier = parseInt(bulkEditValues.multiplier) || 1;
        }
        if (bulkEditFields.zone) {
          const trimmedZone = bulkEditValues.zone.trim();
          if (trimmedZone) {
            nextSpace.zone = zones.find((z) => z.name.toLowerCase() === trimmedZone.toLowerCase())?.name || trimmedZone;
          } else {
            nextSpace.zone = "";
          }
        }
        if (bulkEditFields.equipment) {
          const trimmedEquip = bulkEditValues.equipment.trim();
          if (trimmedEquip) {
            nextSpace.equipment = equipment.find((e) => e.tag.toLowerCase() === trimmedEquip.toLowerCase())?.tag || trimmedEquip;
          } else {
            nextSpace.equipment = "";
          }
        }
        return nextSpace;
      }
      return s;
    });

    const changedSpaces = updatedSpacesList.filter((s) => spaceIds.includes(s.id));
    updateSpaces(changedSpaces);
    setBulkEditOpen(false);

    if (bulkEditFields.category && bulkEditValues.category === "Rest Room / Changing Room") {
      const firstUpdated = changedSpaces[0];
      if (firstUpdated) {
        setTimeout(() => {
          setRestroomModalSpace({
            ...firstUpdated,
            restroomSubCategories: firstUpdated.restroomSubCategories || {
              toiletPrivateContinuous: 0,
              toiletPublicContinuous: 0,
              toiletPrivateDiscontinuous: 0,
              toiletPublicDiscontinuous: 0,
              showerContinuous: 0,
              showerDiscontinuous: 0,
              janitorCloset: 0,
              lockerRoom: 0,
            }
          });
        }, 50);
      }
    } else {
      setSelected(new Set());
    }
  };

  const handleAssignZoneApply = async () => {
    const trimmedZone = targetZone.trim();
    if (!trimmedZone) {
      await confirm("Please select or enter a zone name.", {
        title: "Validation Error",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }

    const selectedSpaces = spaces.filter((s) => Array.from(selected).includes(s.id));

    // 1. Multi-floor check: Spaces from different floors CANNOT form a zone
    const uniqueFloors = Array.from(new Set(selectedSpaces.map((s) => s.floor || "Unassigned")));
    if (uniqueFloors.length > 1) {
      await confirm(
        `Spaces from different floors cannot be grouped into the same zone.\n\nSelected spaces belong to multiple floors: (${uniqueFloors.join(", ")}). Please select spaces from the same floor only.`,
        {
          title: "Multi-Floor Zone Error",
          confirmText: "OK",
          hideCancel: true,
        }
      );
      return;
    }

    // 2. Category and Area are compulsory
    const missingCategoryOrArea = selectedSpaces.some(
      (s) => !s.category || s.category.trim() === "" || !s.area || s.area <= 0
    );
    if (missingCategoryOrArea) {
      await confirm("Cannot form zone: Category and Area are compulsory for all selected spaces.", {
        title: "Validation Error",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }

    // Check if the zone already exists in the zones list or among existing spaces
    const existingZone = zones.find((z) => z.name.toLowerCase() === trimmedZone.toLowerCase());
    const spaceWithZone = spaces.find((s) => s.zone && s.zone.toLowerCase() === trimmedZone.toLowerCase());
    const exists = !!existingZone || !!spaceWithZone;
    const finalZoneName = existingZone?.name || spaceWithZone?.zone || trimmedZone;

    if (exists) {
      const existingZoneFloor = existingZone?.floor || spaceWithZone?.floor;
      const currentSpaceFloor = selectedSpaces[0]?.floor;

      if (existingZoneFloor && currentSpaceFloor && existingZoneFloor !== currentSpaceFloor) {
        await confirm(
          `Zone "${finalZoneName}" already exists on floor ${existingZoneFloor}.\n\nSpaces from ${currentSpaceFloor} cannot be assigned to a zone on ${existingZoneFloor}.`,
          {
            title: "Zone Floor Mismatch",
            confirmText: "OK",
            hideCancel: true,
          }
        );
        return;
      }
    }

    // Check if spaces are already in other zones
    const spacesAlreadyInZone = selectedSpaces.filter((s) => s.zone && s.zone.trim() !== "" && s.zone.toLowerCase() !== finalZoneName.toLowerCase());
    if (spacesAlreadyInZone.length > 0) {
      const message = spacesAlreadyInZone.length === 1
        ? `Space "${spacesAlreadyInZone[0].name}" is already assigned to zone "${spacesAlreadyInZone[0].zone}". Do you want to reassign it to zone "${finalZoneName}"?`
        : `${spacesAlreadyInZone.length} spaces are already assigned to other zones (e.g. "${spacesAlreadyInZone[0].name}" in "${spacesAlreadyInZone[0].zone}"). Do you want to reassign them to zone "${finalZoneName}"?`;
      
      const proceed = await confirm(message, {
        title: "Reassign Zone?",
        confirmText: "Reassign",
        cancelText: "Cancel",
      });
      if (!proceed) {
        return;
      }
    }

    // 2. There must be at least one positive space to form a zone
    const finalSpacesInZone = spaces.map((s) => {
      if (Array.from(selected).includes(s.id)) {
        return { ...s, zone: finalZoneName };
      }
      return s;
    }).filter((s) => s.zone === finalZoneName);

    const hasPositiveSpace = finalSpacesInZone.some((s) => s.pressure === "Positive");
    if (!hasPositiveSpace) {
      await confirm("Cannot form zone: A zone must contain at least one positive-pressure space.", {
        title: "Validation Error",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }

    if (!exists) {
      // Find building and floor from selected spaces
      const firstSpace = selectedSpaces[0];
      const building = firstSpace?.building || "Tower A";
      const floor = firstSpace?.floor || "L01";

      const newZone = {
        id: `zone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        name: trimmedZone,
        building,
        floor,
        spaceCount: 0,
        area: 0,
        freshAir: 0,
        extractAir: 0,
        pressure: 0,
        equipment: [],
        pressureType: "neutral" as const,
      };
      
      addZone(newZone);
    }

    bulkUpdateSpaces(Array.from(selected), { zone: finalZoneName });
    setAssignZoneOpen(false);
    setSelected(new Set());
  };

  const handleAssignEquipApply = () => {
    bulkUpdateSpaces(Array.from(selected), { equipment: targetEquip });
    setAssignEquipOpen(false);
    setSelected(new Set());
  };

  const handleMergeSpacesApply = async () => {
    if (!mergeName) {
      await confirm("Please enter a name for the merged space.", {
        title: "Required Field",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }
    mergeSpaces(Array.from(selected), primarySpaceId, mergeName);
    setMergeOpen(false);
    setSelected(new Set());
  };

  const renderSpaceContextMenu = (row: Space) => {
    const isMulti = selected.size > 1;
    const selectedIds = selected.has(row.id) ? Array.from(selected) : [row.id];
    const targetsCount = selectedIds.length;

    return (
      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
        {isMulti ? (
          <ContextMenuItem
            onClick={() => {
              setBulkEditValues({
                building: "",
                floor: "",
                category: "",
                pressure: "",
                area: "",
                height: "",
                fixtures: "",
                multiplier: "",
                zone: "",
                equipment: "",
              });
              setBulkEditFields({
                building: false,
                floor: false,
                category: false,
                pressure: false,
                area: false,
                height: false,
                fixtures: false,
                multiplier: false,
                zone: false,
                equipment: false,
              });
              setBulkEditOpen(true);
            }}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Bulk Edit ({targetsCount} spaces)</span>
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            onClick={() => setEditingSpace(row)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Space</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        
        <ContextMenuItem
          onClick={() => {
            const clones = selectedIds.map((id, index) => {
              const targetRow = spaces.find((s) => s.id === id);
              if (!targetRow) return null;
              return {
                ...targetRow,
                id: `sp-${Date.now()}-${index}-${Math.random()}`,
                code: `${targetRow.code}-CLONE`,
                name: `${targetRow.name} (Clone)`,
              };
            }).filter(Boolean) as Space[];
            
            if (clones.length > 0) {
              addSpacesBulk(clones);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Duplicate Selected" : "Duplicate Space"}</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />
        
        <ContextMenuItem
          onClick={async () => {
            const targets = selected.has(row.id) ? Array.from(selected) : [row.id];
            const selectedSpaces = spaces.filter((s) => targets.includes(s.id));
            const missingCategoryOrArea = selectedSpaces.some(
              (s) => !s.category || s.category.trim() === "" || !s.area || s.area <= 0
            );
            if (missingCategoryOrArea) {
              await confirm("Cannot form zone: Category and Area are compulsory for all selected spaces.", {
                title: "Validation Error",
                confirmText: "OK",
                hideCancel: true,
              });
              return;
            }
            const hasPositiveSpace = selectedSpaces.some((s) => s.pressure === "Positive");
            if (!hasPositiveSpace) {
              await confirm("Cannot form zone: A zone must contain at least one positive-pressure space.", {
                title: "Validation Error",
                confirmText: "OK",
                hideCancel: true,
              });
              return;
            }
            if (!selected.has(row.id)) {
              setSelected(new Set([row.id]));
            }
            setAssignZoneOpen(true);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <GroupIcon className="size-3.5 text-muted-foreground" />
          <span>Assign Zone</span>
        </ContextMenuItem>
        
        <ContextMenuItem
          onClick={() => {
            if (!selected.has(row.id)) {
              setSelected(new Set([row.id]));
            }
            setAssignEquipOpen(true);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Plus className="size-3.5 text-muted-foreground" />
          <span>Assign Equipment</span>
        </ContextMenuItem>
        
        <ContextMenuItem
          onClick={() => {
            const targets = selected.has(row.id) ? Array.from(selected) : [row.id];
            const selectedSpaces = spaces.filter((s) => targets.includes(s.id));
            triggerAutoZoning(selectedSpaces);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Sparkles className="size-3.5 text-muted-foreground" />
          <span>Auto-Zone</span>
        </ContextMenuItem>
        
        <ContextMenuItem
          disabled={!isMulti}
          onClick={() => {
            const names = selectedIds.map(id => spaces.find(s => s.id === id)?.name).filter(Boolean);
            setMergeName((names[0] || "Merged Space") + " (Merged)");
            setPrimarySpaceId(selectedIds[0] || "");
            setMergeOpen(true);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>Merge Spaces</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />
        
        <ContextMenuItem
          onClick={async () => {
            const msg = targetsCount === 1 
              ? `Are you sure you want to delete space "${row.name}"?`
              : `Are you sure you want to delete the ${targetsCount} selected spaces?`;
            
            if (await confirm(msg)) {
              deleteSpaces(selectedIds);
              setSelected(new Set());
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

  const renderFloorGroupHeader = (floor: string) => {
    return (
      <span className="flex items-center gap-1.5 font-medium">
        <span><strong className="font-bold text-primary">{floor}</strong></span>
        <span className="text-[10px] text-muted-foreground font-normal">(Right-click or press Delete to remove)</span>
      </span>
    );
  };

  const renderFloorGroupContextMenu = (floor: string) => {
    return (
      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground">
        <ContextMenuItem
          onClick={async () => {
            const newFloor = await prompt("Enter new floor name:", floor, { title: "Rename Floor" });
            if (newFloor && newFloor.trim() !== "" && newFloor.trim() !== floor) {
              const floorSpaces = spaces.filter((s) => s.floor === floor);
              bulkUpdateSpaces(floorSpaces.map((s) => s.id), { floor: newFloor.trim() });
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Rename Floor</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />
        
        <ContextMenuItem
          onClick={async () => {
            const floorSpaces = spaces.filter((s) => s.floor === floor);
            if (floorSpaces.length > 0) {
              if (await confirm(`Are you sure you want to delete all ${floorSpaces.length} spaces on floor "${floor}"?`)) {
                deleteSpaces(floorSpaces.map((s) => s.id));
                setSelected(new Set());
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

  const handleToggleGroup = (ids: string[], select: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (select) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const uniqueBuildings = useMemo(() => {
    const vals = new Set<string>();
    spaces.forEach((s) => {
      if (s.building) vals.add(s.building);
    });
    return Array.from(vals).sort();
  }, [spaces]);

  const uniqueFloors = useMemo(() => {
    const vals = new Set<string>();
    spaces.forEach((s) => {
      if (s.floor) vals.add(s.floor);
    });
    return Array.from(vals).sort();
  }, [spaces]);

  const uniqueZones = useMemo(() => {
    const vals = new Set<string>();
    let hasUnzoned = false;
    spaces.forEach((s) => {
      if (s.zone) {
        vals.add(s.zone);
      } else {
        hasUnzoned = true;
      }
    });
    const list = Array.from(vals).sort();
    if (hasUnzoned) {
      list.push("Unzoned");
    }
    return list;
  }, [spaces]);

  const uniqueCategories = useMemo(() => {
    const vals = new Set<string>();
    let hasUnassigned = false;
    spaces.forEach((s) => {
      if (s.category) {
        vals.add(s.category);
      } else {
        hasUnassigned = true;
      }
    });
    const list = Array.from(vals).sort();
    if (hasUnassigned) {
      list.push("Unassigned");
    }
    return list;
  }, [spaces]);

  const currentFilterState = useMemo(() => ({
    building: selectedBuilding,
    floor: selectedFloor,
    zone: selectedZone,
    category: selectedCategory,
    warning: activeFilter === "warning",
    query: query,
  }), [selectedBuilding, selectedFloor, selectedZone, selectedCategory, activeFilter, query]);

  const activeViewName = useMemo(() => {
    if (
      !currentFilterState.building &&
      !currentFilterState.floor &&
      !currentFilterState.zone &&
      !currentFilterState.category &&
      !currentFilterState.warning &&
      !currentFilterState.query
    ) {
      return "All Spaces";
    }
    if (
      !currentFilterState.building &&
      !currentFilterState.floor &&
      !currentFilterState.zone &&
      !currentFilterState.category &&
      currentFilterState.warning &&
      !currentFilterState.query
    ) {
      return "Warnings Only";
    }
    const matched = savedViews.find((v) => {
      const f = v.filters;
      return (
        f.building === currentFilterState.building &&
        f.floor === currentFilterState.floor &&
        f.zone === currentFilterState.zone &&
        f.category === currentFilterState.category &&
        f.warning === currentFilterState.warning &&
        f.query === currentFilterState.query
      );
    });
    return matched ? matched.name : null;
  }, [currentFilterState, savedViews]);

  const handleApplyView = (viewFilters: SavedView["filters"]) => {
    setSelectedBuilding(viewFilters.building);
    setSelectedFloor(viewFilters.floor);
    setSelectedZone(viewFilters.zone);
    setSelectedCategory(viewFilters.category);
    setActiveFilter(viewFilters.warning ? "warning" : null);
    setQuery(viewFilters.query);
  };

  const handleSaveView = async () => {
    const viewName = await prompt("Enter a name for the current view:", "", { title: "Save View" });
    if (!viewName) return;
    const cleanName = viewName.trim();
    if (!cleanName) return;

    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name: cleanName,
      filters: {
        building: selectedBuilding,
        floor: selectedFloor,
        zone: selectedZone,
        category: selectedCategory,
        warning: activeFilter === "warning",
        query: query,
      },
    };

    const nextViews = [...savedViews, newView];
    setSavedViews(nextViews);
    localStorage.setItem("mep-saved-views", JSON.stringify(nextViews));
  };

  const handleDeleteView = (e: React.MouseEvent, viewId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const nextViews = savedViews.filter((v) => v.id !== viewId);
    setSavedViews(nextViews);
    localStorage.setItem("mep-saved-views", JSON.stringify(nextViews));
  };

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filtered = spaces.filter((s) => {
      if (activeFilter === "warning" && s.status !== "warning") return false;
      if (selectedBuilding && s.building !== selectedBuilding) return false;
      if (selectedFloor && s.floor !== selectedFloor) return false;
      if (selectedZone) {
        if (selectedZone === "Unzoned") {
          const zoneStr = (s.zone || "").trim().toLowerCase();
          if (zoneStr !== "" && zoneStr !== "unzoned" && zoneStr !== "default") return false;
        } else {
          if (s.zone !== selectedZone) return false;
        }
      }
      if (selectedCategory) {
        if (selectedCategory === "Unassigned") {
          const catStr = (s.category || "").trim();
          if (catStr !== "") return false;
        } else {
          if (s.category !== selectedCategory) return false;
        }
      }
      if (q) {
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        const codeLower = (s.code || "").toLowerCase();
        const nameLower = (s.name || "").toLowerCase();
        const zoneLower = (s.zone || "").toLowerCase();
        const categoryLower = (s.category || "").toLowerCase();
        const textToSearch = `${codeLower} ${nameLower} ${zoneLower} ${categoryLower}`;

        const allMatched = terms.every(term => {
          if (term === "locker" || term === "room") {
            return categoryLower.includes("locker") || categoryLower.includes("room") || 
                   codeLower.includes(term) || nameLower.includes(term) || zoneLower.includes(term);
          }
          return textToSearch.includes(term);
        });
        if (!allMatched) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const zoneA = (a.zone || "").trim();
      const zoneB = (b.zone || "").trim();

      const isDefaultA = !zoneA || zoneA.toLowerCase() === "default" || zoneA.toLowerCase() === "unzoned";
      const isDefaultB = !zoneB || zoneB.toLowerCase() === "default" || zoneB.toLowerCase() === "unzoned";

      if (isDefaultA && !isDefaultB) return 1;
      if (!isDefaultA && isDefaultB) return -1;

      const zoneCompare = zoneA.localeCompare(zoneB, undefined, { numeric: true, sensitivity: "base" });
      if (zoneCompare !== 0) return zoneCompare;

      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [spaces, query, activeFilter, selectedBuilding, selectedFloor, selectedZone, selectedCategory]);

  const orderedRows = useMemo(() => {
    const groups: Record<string, Space[]> = {};
    rows.forEach((s) => {
      const floor = s.floor || "Unknown";
      if (!groups[floor]) groups[floor] = [];
      groups[floor].push(s);
    });

    const sortedFloors = Object.keys(groups).sort((a, b) => {
      const idxA = sortedFloorsForGrid.indexOf(a);
      const idxB = sortedFloorsForGrid.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });

    const flat: Space[] = [];
    sortedFloors.forEach((floor) => {
      flat.push(...groups[floor]);
    });
    return flat;
  }, [rows, sortedFloorsForGrid]);

  const spaceRowClasses = useMemo(() => {
    const classes: Record<string, string> = {};
    
    let currentFloor = "";
    let currentZoneName = "";
    let globalZoneIndex = -1; // Start at -1 so first row triggers increment to 0
    
    orderedRows.forEach(s => {
      const f = s.floor || "Unknown";
      const z = (s.zone || "").trim();
      const isDef = !z || z.toLowerCase() === "default" || z.toLowerCase() === "unzoned";
      const zoneName = isDef ? "Default" : z;
      
      if (f !== currentFloor || zoneName !== currentZoneName) {
        globalZoneIndex++;
        currentFloor = f;
        currentZoneName = zoneName;
      }
      
      if (globalZoneIndex % 2 === 0) {
        classes[s.id] = "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80";
      } else {
        classes[s.id] = "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40";
      }
    });
    
    return classes;
  }, [orderedRows]);

  const getSpaceEditIds = (rId: string): string[] => {
    return selected.has(rId) ? Array.from(selected) : [rId];
  };

  const columns: Column<Space>[] = [
    { key: "name", header: "Space Name", width: 240, editable: true, render: (r) => (
      <InlineInput
        value={r.name}
        onCommit={(val) => bulkUpdateSpaces(getSpaceEditIds(r.id), { name: val.trim() || r.name })}
        className="font-medium text-[13.5px]"
      />
    ) },
    { key: "zone", header: "Zone", width: 200, mono: true, editable: true, render: (r) => {
      const matchingZone = zones.find((z) => z.id === r.zone || z.name === r.zone);
      const zoneName = matchingZone ? matchingZone.name : (r.zone || "");
      return (
        <InlineInput
          value={zoneName}
          onCommit={(val) => {
            const trimmed = val.trim();
            const editIds = getSpaceEditIds(r.id);
            const selectedSpaces = spaces.filter((s) => editIds.includes(s.id));

            if (trimmed === "") {
              bulkUpdateSpaces(editIds, { zone: "" });
              return;
            }

            // 1. Multi-floor check
            const uniqueFloors = Array.from(new Set(selectedSpaces.map((s) => s.floor || "Unassigned")));
            if (uniqueFloors.length > 1) {
              confirm(
                `Spaces from different floors cannot be grouped into the same zone.\n\nSelected spaces belong to multiple floors: (${uniqueFloors.join(", ")}). Please select spaces from the same floor only.`,
                {
                  title: "Multi-Floor Zone Error",
                  confirmText: "OK",
                  hideCancel: true,
                }
              );
              return;
            }

            // 2. Existing Zone & Floor check
            const existingZone = zones.find(
              (z) => z.id.toLowerCase() === trimmed.toLowerCase() || z.name.toLowerCase() === trimmed.toLowerCase()
            );

            if (existingZone) {
              const currentFloor = selectedSpaces[0]?.floor || "L01";
              if (existingZone.floor && existingZone.floor !== currentFloor) {
                confirm(
                  `Zone "${existingZone.name}" already exists on floor ${existingZone.floor}.\n\nSpaces from ${currentFloor} cannot be assigned to a zone on ${existingZone.floor}.`,
                  {
                    title: "Zone Floor Mismatch",
                    confirmText: "OK",
                    hideCancel: true,
                  }
                );
                return;
              }
              bulkUpdateSpaces(editIds, { zone: existingZone.name });
            } else {
              const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
              const newZone = {
                id: zoneId,
                name: trimmed,
                building: selectedSpaces[0]?.building || "Tower A",
                floor: selectedSpaces[0]?.floor || "L01",
                spaceCount: 0,
                area: 0,
                freshAir: 0,
                extractAir: 0,
                pressure: 0,
                equipment: [],
                pressureType: "neutral" as const,
                faAssignment: null,
                eaAssignment: null,
              };
              addZone(newZone);
              bulkUpdateSpaces(editIds, { zone: trimmed });
            }
          }}
          className="font-medium text-[13.5px]"
        />
      );
    } },
    { key: "category", header: "Category", width: 280, editable: true, render: (r) => {
      const isRestRoom = r.category === "Rest Room / Changing Room";
      
      const handleCategoryChange = (newVal: string) => {
        const editIds = getSpaceEditIds(r.id);
        if (newVal === "Other" || newVal === "OTHER") {
          const latestSpace = workspaceStore.getState().spaces.find(s => s.id === r.id) || r;
          const categoryName = latestSpace.category && latestSpace.category.endsWith(" (Custom)") ? latestSpace.category : "Custom (Custom)";
          bulkUpdateSpaces(editIds, { category: categoryName, aiDetected: false });
          setTimeout(() => {
            const freshSpace = workspaceStore.getState().spaces.find(s => s.id === r.id) || latestSpace;
            setCustomParamModalSpace({
              ...freshSpace,
              category: categoryName,
              customWorkflow: freshSpace.customWorkflow || "calculate",
              customPeopleOA: freshSpace.customPeopleOA || 0,
              customAreaOA: freshSpace.customAreaOA || 0,
              customExhaustPerUnit: freshSpace.customExhaustPerUnit || 0,
              customExhaustPerArea: freshSpace.customExhaustPerArea || 0,
              customAch: freshSpace.customAch || 0,
              customFreshGiven: freshSpace.customFreshGiven || 0,
              customExtTaken: freshSpace.customExtTaken || 0,
            });
          }, 50);
          return;
        }
        if (newVal === "Rest Room / Changing Room") {
          const latestSpace = workspaceStore.getState().spaces.find(s => s.id === r.id) || r;
          const spaceCopy = { ...latestSpace, category: newVal, aiDetected: false };
          if (!spaceCopy.restroomSubCategories) {
            spaceCopy.restroomSubCategories = {
              toiletPrivateContinuous: 0,
              toiletPublicContinuous: 0,
              toiletPrivateDiscontinuous: 0,
              toiletPublicDiscontinuous: 0,
              showerContinuous: 0,
              showerDiscontinuous: 0,
              janitorCloset: 0,
              lockerRoom: 0,
            };
          }
          const data = getOccupancyData(newVal);
          const updates: Partial<Space> = {
            category: newVal,
            aiDetected: false,
            restroomSubCategories: spaceCopy.restroomSubCategories
          };
          if (data && !latestSpace.isOccupancyCustomized) {
            const defaultOcc = (data.exhaustPerUnit > 0 && data.defaultDensity === 0)
              ? 1
              : Math.ceil((latestSpace.area * data.defaultDensity) / 100);
            updates.occupancy = defaultOcc;
            updates.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
          }
          bulkUpdateSpaces(editIds, updates);
          setTimeout(() => {
            const freshSpace = workspaceStore.getState().spaces.find(s => s.id === r.id) || spaceCopy;
            setRestroomModalSpace(freshSpace);
          }, 50);
          return;
        }
        const data = getOccupancyData(newVal);
        const updates: Partial<Space> = {
          category: newVal,
          aiDetected: false
        };
        if (data && !r.isOccupancyCustomized) {
          const defaultOcc = (data.exhaustPerUnit > 0 && data.defaultDensity === 0)
            ? 1
            : Math.ceil((r.area * data.defaultDensity) / 100);
          updates.occupancy = defaultOcc;
          updates.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
        }
        bulkUpdateSpaces(editIds, updates);
      };

      return (
        <span className="inline-flex items-center gap-1.5 w-full h-full" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <span
            title={r.aiDetected ? "Automatically identified" : undefined}
            className={`size-1.5 rounded-full shrink-0 ${r.aiDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`}
          />
          <div className="w-full min-w-0">
            {isRestRoom ? (
              <div className="flex items-center justify-between w-full min-w-0 pr-1">
                <CategorySelect
                  value={r.category || ""}
                  onChange={handleCategoryChange}
                  triggerClassName="pl-1 pr-2 flex-1"
                  hideChevron={true}
                />
                <button
                  type="button"
                  onClick={() => setRestroomModalSpace(r)}
                  className="flex items-center justify-center p-1 rounded hover:bg-surface-2 text-primary hover:text-primary/80 transition-colors cursor-pointer w-6 h-6 shrink-0 animate-fade-in"
                  title="Configure Rest Room subcategories"
                >
                  <Wrench className="size-3.5" />
                </button>
              </div>
            ) : (
              <CategorySelect
                value={r.category || ""}
                onChange={handleCategoryChange}
                triggerClassName="pl-1 pr-2"
              />
            )}
          </div>
        </span>
      );
    } },
    { key: "pressure", header: "Pressure", width: 80, align: "center", editable: true, render: (r) => {
      const displayVal = PRESSURE_MAP[r.pressure || "Positive"] || "1";
      return (
        <span className="inline-flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <span
            title={r.pressureAutoDetected ? "Automatically identified" : undefined}
            className={`size-1.5 rounded-full shrink-0 ml-5 ${r.pressureAutoDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`}
          />
          <select
            value={displayVal}
            onChange={(e) => {
              const newVal = REVERSE_PRESSURE_MAP[e.target.value] || "Positive";
              bulkUpdateSpaces(getSpaceEditIds(r.id), { 
                pressure: newVal, 
                pressureAutoDetected: false 
              });
            }}
            className={`font-bold rounded-full text-[11px] leading-none py-1 w-12 text-center font-mono border border-transparent cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none transition-all appearance-none ${
              r.pressure === "Positive" ? "bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" :
              r.pressure === "Negative" ? "bg-destructive/20 text-destructive dark:bg-destructive/20 dark:text-red-400" :
              r.pressure === "Critical" ? "bg-warning/20 text-warning dark:bg-warning/20 dark:text-amber-400" :
              "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <option value="1" className="bg-background text-success font-bold">+1</option>
            <option value="0" className="bg-background text-muted-foreground font-bold">0</option>
            <option value="-1" className="bg-background text-destructive font-bold">-1</option>
            <option value="-2" className="bg-background text-warning font-bold">-2</option>
          </select>
        </span>
      );
    } },

    { key: "area", header: "Area (m²)", width: 90, align: "center", mono: true, editable: true, render: (r) => (
      <InlineInput
        type="number"
        step="0.1"
        min={0}
        value={r.area}
        onCommit={(val) => {
          const num = parseFloat(val);
          if (!isNaN(num) && num >= 0) {
            bulkUpdateSpaces(getSpaceEditIds(r.id), { area: num });
          }
        }}
        className="font-mono tabular text-[13.5px] text-center"
      />
    ) },

    { key: "occupancy", header: "Occ.", width: 80, align: "center", mono: true, editable: true, render: (r) => (
      <div className="flex items-center justify-center gap-1.5 w-full h-full px-1">
        {!r.isOccupancyCustomized && (
          <span title="Default occupancy value" className="size-1.5 rounded-full bg-blue-500 shrink-0" />
        )}
        <InlineInput
          type="number"
          min={0}
          value={r.occupancy}
          onCommit={(val) => {
            const num = parseInt(val);
            if (!isNaN(num) && num >= 0) {
              const data = getOccupancyData(r.category);
              const isFixtureBased = data && data.exhaustPerUnit > 0;
              const updates: Partial<Space> = { occupancy: num, isOccupancyCustomized: true };
              if (isFixtureBased || (r.fixtures !== "" && r.fixtures !== undefined && r.fixtures !== null)) {
                updates.fixtures = num.toString();
              }
              bulkUpdateSpaces(getSpaceEditIds(r.id), updates);
            }
          }}
          className="font-mono tabular text-[13.5px] text-center min-w-0 flex-1"
        />
      </div>
    ) },

    { key: "minFresh", header: "Min Fresh\n(L/s)", width: 100, align: "center", mono: true, render: (r) => Math.round(r.minOA || 0).toLocaleString() },
    { key: "minExtract", header: "Min Extract\n(L/s)", width: 100, align: "center", mono: true, render: (r) => Math.round(r.minExt || 0).toLocaleString() },
    {
      key: "flagged",
      header: "",
      width: 36,
      align: "center",
      render: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            bulkUpdateSpaces(getSpaceEditIds(r.id), { flagged: !r.flagged });
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
          title={
            (() => {
              const isNoArea = !r.area || parseFloat(String(r.area)) === 0 || isNaN(parseFloat(String(r.area)));
              const isNoCategory = !r.category || r.category.trim() === "" || r.category.toLowerCase().includes("select category");
              if (isNoArea && isNoCategory) {
                return "Missing space area and category";
              }
              if (isNoArea) {
                return "Missing space area";
              }
              if (isNoCategory) {
                return "Missing space category";
              }
              if (r.category === "Rest Room / Changing Room") {
                const sub = r.restroomSubCategories || {};
                const sumSub = 
                  (sub.toiletPrivateContinuous || 0) +
                  (sub.toiletPublicContinuous || 0) +
                  (sub.toiletPrivateDiscontinuous || 0) +
                  (sub.toiletPublicDiscontinuous || 0) +
                  (sub.showerContinuous || 0) +
                  (sub.showerDiscontinuous || 0) +
                  (sub.janitorCloset || 0) +
                  (sub.lockerRoom || 0);
                if (sumSub === 0) {
                  return "Rest Room has no subcategories (WC, shower, janitor, locker, etc.) configured";
                }
              }
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
      )
    }
  ];


  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const toggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected((prev) => {
      const clickedIndex = orderedRows.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, clickedIndex);
        const end = Math.max(lastClickedIndex, clickedIndex);
        
        if (!isCtrl) {
          next.clear();
        }

        const shouldSelect = prev.has(orderedRows[lastClickedIndex]?.id || "") || true;

        for (let i = start; i <= end; i++) {
          const rId = orderedRows[i]?.id;
          if (rId) {
            if (shouldSelect) {
              next.add(rId);
            } else {
              next.delete(rId);
            }
          }
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedIndex(clickedIndex);
      } else {
        if (prev.has(id)) {
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
  };
  const toggleAll = () => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  };

  const handleOpenAssignZone = async () => {
    const selectedSpaces = spaces.filter((s) => Array.from(selected).includes(s.id));
    
    // Check if selected spaces span multiple floors
    const uniqueFloors = Array.from(new Set(selectedSpaces.map((s) => s.floor || "Unassigned")));
    if (uniqueFloors.length > 1) {
      await confirm(
        `Spaces from different floors cannot be grouped into the same zone.\n\nSelected spaces belong to multiple floors: (${uniqueFloors.join(", ")}). Please select spaces from the same floor only.`,
        {
          title: "Multi-Floor Zone Error",
          confirmText: "OK",
          hideCancel: true,
        }
      );
      return;
    }

    const missingCategoryOrArea = selectedSpaces.some(
      (s) => !s.category || s.category.trim() === "" || !s.area || s.area <= 0
    );
    if (missingCategoryOrArea) {
      await confirm("Cannot form zone: Category and Area are compulsory for all selected spaces.", {
        title: "Validation Error",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }
    const hasPositiveSpace = selectedSpaces.some((s) => s.pressure === "Positive");
    if (!hasPositiveSpace) {
      await confirm("Cannot form zone: A zone must contain at least one positive-pressure space.", {
        title: "Validation Error",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }
    setAssignZoneOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Deselect all selected spaces/rows
      if (e.key === "Escape") {
        if (selected.size > 0 || selectedPending.size > 0) {
          e.preventDefault();
          setSelected(new Set());
          setSelectedPending(new Set());
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

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Ctrl+A (Select All)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (importOpen && pendingRecords.length > 0) {
          setSelectedPending(new Set(pendingRecords.map((r) => r.id)));
        } else if (!importOpen && rows.length > 0) {
          setSelected(new Set(rows.map((r) => r.id)));
        }
        return;
      }

      // 2. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (importOpen && selectedPending.size > 0) {
          e.preventDefault();
          confirm(`Are you sure you want to remove the ${selectedPending.size} selected pending spaces?`).then((ok) => {
            if (ok) {
              setPendingRecords((prev) => prev.filter((r) => !selectedPending.has(r.id)));
              setSelectedPending(new Set());
            }
          });
        } else if (!importOpen && selected.size > 0) {
          e.preventDefault();
          confirm(`Are you sure you want to delete the ${selected.size} selected spaces?`).then((ok) => {
            if (ok) {
              deleteSpaces(Array.from(selected));
              setSelected(new Set());
            }
          });
        }
        return;
      }

      // 3. Copy: Ctrl+C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (!importOpen && selected.size > 0) {
          e.preventDefault();
          copySpaces(Array.from(selected));
        }
        return;
      }

      // 4. Cut: Ctrl+X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (!importOpen && selected.size > 0) {
          e.preventDefault();
          cutSpaces(Array.from(selected));
          setSelected(new Set());
        }
        return;
      }

      // 5. Paste: Ctrl+V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (!importOpen) {
          e.preventDefault();
          const pasted = pasteSpaces();
          if (pasted.length > 0) {
            setSelected(new Set(pasted.map((s) => s.id)));
          }
        }
        return;
      }

      // 6. Undo/Redo: Ctrl+Z / Ctrl+Y
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        redo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    importOpen,
    pendingRecords,
    rows,
    selected,
    selectedPending,
    deleteSpaces,
    copySpaces,
    cutSpaces,
    pasteSpaces,
    undo,
    redo,
  ]);

  const handleNewSpace = () => {
    const defaultNum = spaces.length + 1;
    const newSpace: Space = {
      id: `sp-${Date.now()}`,
      code: `T-L01-${String(defaultNum).padStart(3, "0")}`,
      name: `New Space ${defaultNum}`,
      building: "Tower A",
      floor: "L01",
      zone: "",
      category: "",
      area: 100.0,
      occupancy: 5,
      freshAir: 0,
      extractAir: 0,
      pressure: "Positive",
      equipment: "",
      status: "draft",
      height: 3.0,
      fixtures: "",
      multiplier: 1,
      aiDetected: false,
      pressureAutoDetected: false,
    };
addSpace(newSpace);
    setEditingSpace(newSpace); // Open the editor modal immediately!
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background shrink-0 flex-wrap no-print modal-blur-bg">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter spaces..."
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
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
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

              {/* Building filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Building</span>
                <select
                  value={selectedBuilding || ""}
                  onChange={(e) => setSelectedBuilding(e.target.value || null)}
                  className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                >
                  <option value="">All Buildings</option>
                  {uniqueBuildings.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Floor filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Floor</span>
                <select
                  value={selectedFloor || ""}
                  onChange={(e) => setSelectedFloor(e.target.value || null)}
                  className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                >
                  <option value="">All Floors</option>
                  {uniqueFloors.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Zone filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Zone</span>
                <select
                  value={selectedZone || ""}
                  onChange={(e) => setSelectedZone(e.target.value || null)}
                  className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                >
                  <option value="">All Zones</option>
                  {uniqueZones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>

              {/* Category filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Category</span>
                <select
                  value={selectedCategory || ""}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>{getCategoryDisplayName(c)}</option>
                  ))}
                </select>
              </div>
            </PopoverContent>
          </Popover>

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
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                  Sort
                </span>
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
                    className="text-[10px] text-primary hover:underline font-medium hover:text-primary-strong"
                  >
                    Reset
                  </button>
                )}
              </div>
              <p className="text-[10.5px] text-muted-foreground mb-3 leading-snug">
                Drag and drop floors to change their sorting order in the grid views.
              </p>
              <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-0.5 font-mori">
                {sortedFloorsForGrid.map((floor, index) => (
                  <div
                    key={floor}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-1.5 bg-surface rounded border border-border text-[11px] cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
                      draggingIndex === index
                        ? "opacity-40 border-primary bg-primary/5"
                        : "hover:bg-surface-2 hover:border-border-strong"
                    }`}
                  >
                    <GripVertical className="size-3 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-foreground uppercase truncate">{floor}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          <div className="ml-auto flex items-center gap-1">
            <TBtn onClick={() => setImportOpen(true)}><Upload className="size-3.5" /> Import</TBtn>
            <TBtn onClick={triggerAutoZoning}><Sparkles className="size-3.5 text-primary" /> Auto-Zone</TBtn>
            <TBtn primary onClick={handleNewSpace}><Plus className="size-3.5" /> New Space</TBtn>
          </div>

          {/* Bulk actions bar overlay */}
          {selected.size > 0 && (
            <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
              <span className="font-semibold">{selected.size} selected</span>
              <span className="text-primary/30">Â·</span>
              <BulkBtn icon={Edit3} onClick={() => {
                setBulkEditValues({
                  building: "",
                  floor: "",
                  category: "",
                  pressure: "",
                  area: "",
                  height: "",
                  fixtures: "",
                  multiplier: "",
                  zone: "",
                  equipment: "",
                });
                setBulkEditFields({
                  building: false,
                  floor: false,
                  category: false,
                  pressure: false,
                  area: false,
                  height: false,
                  fixtures: false,
                  multiplier: false,
                  zone: false,
                  equipment: false,
                });
                setBulkEditOpen(true);
              }}>Bulk edit</BulkBtn>
              <BulkBtn icon={GroupIcon} onClick={handleOpenAssignZone}>Assign zone</BulkBtn>
              <BulkBtn icon={Plus} onClick={() => setAssignEquipOpen(true)}>Assign equipment</BulkBtn>
              <BulkBtn icon={Sparkles} onClick={() => {
                const selectedSpacesArray = Array.from(selected).map(id => spaces.find(s => s.id === id)).filter(Boolean) as Space[];
                triggerAutoZoning(selectedSpacesArray);
              }}>Auto-Zone</BulkBtn>
              <BulkBtn icon={Copy} onClick={() => {
                const selectedIdsArray = Array.from(selected);
                const names = selectedIdsArray.map(id => spaces.find(s => s.id === id)?.name).filter(Boolean);
                setMergeName((names[0] || "Merged Space") + " (Merged)");
                setPrimarySpaceId(selectedIdsArray[0] || "");
                setMergeOpen(true);
              }}>Merge spaces</BulkBtn>
              <BulkBtn icon={Trash2} onClick={async () => {
                if (await confirm(`Are you sure you want to delete the ${selected.size} selected spaces?`)) {
                  deleteSpaces(Array.from(selected));
                  setSelected(new Set());
                }
              }}>Delete</BulkBtn>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded">
                <X className="size-3" /> Clear
              </button>
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 min-h-0 flex flex-col">
          {spaces.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-2">
              <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center animate-scale-in">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce">
                  <Upload className="size-6" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">No Spaces Loaded</h3>
                <p className="text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                  Start by importing a Revit Excel space schedule sheet or manually add spaces. The system will automatically detect occupancy categories, target zone associations, and compute required airflows.
                </p>
                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={() => setImportOpen(true)}
                    className="flex-1 bg-primary text-primary-foreground font-semibold h-9 rounded hover:bg-primary/95 transition-colors text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                  >
                    <Upload className="size-3.5" /> Import Revit Excel
                  </button>
                  <button
                    onClick={handleNewSpace}
                    className="flex-1 border border-border hover:bg-surface-2 font-semibold h-9 rounded transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="size-3.5" /> Add Space
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <DataGrid
              rows={rows}
              columns={columns}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              renderContextMenu={renderSpaceContextMenu}
              groupBy={(r) => r.floor}
              groupOrder={sortedFloorsForGrid}
              renderGroupHeader={renderFloorGroupHeader}
              renderGroupContextMenu={renderFloorGroupContextMenu}
              onToggleGroup={handleToggleGroup}
              onRowDoubleClick={(r) => setEditingSpace(r)}
              activeRowId={editingSpace?.id}
              rowClassName={(r) => spaceRowClasses[r.id] || ""}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg">
          <div>Showing <span className="text-foreground font-medium tabular">{rows.length.toLocaleString()}</span> of {spaces.length.toLocaleString()} spaces</div>
          <div className="flex items-center gap-3 tabular">
            <span>Î£ Fresh: <span className="font-mono text-foreground">{rows.reduce((a, s) => a + (s.freshAir || 0), 0).toLocaleString()} L/s</span></span>
            <span>Î£ Extract: <span className="font-mono text-foreground">{rows.reduce((a, s) => a + (s.extractAir || 0), 0).toLocaleString()} L/s</span></span>
            <span>Î£ Area: <span className="font-mono text-foreground">{rows.reduce((a, s) => a + (s.area || 0) * (s.multiplier || 1), 0).toFixed(0)} mÂ²</span></span>
          </div>
        </div>

        {/* Edit Modal overlay */}
        {editingSpace && (
          <EditSpaceModal
            space={editingSpace}
            onClose={() => setEditingSpace(null)}
            onSave={(updated) => {
              // 1. Check if zone is a new zone name
              let nextZones = [...zones];
              if (updated.zone && updated.zone !== "") {
                const zoneExists = zones.some(
                  (z) => z.id.toLowerCase() === updated.zone.toLowerCase() || z.name.toLowerCase() === updated.zone.toLowerCase()
                );
                if (!zoneExists) {
                  const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
                  const newZone = {
                    id: zoneId,
                    name: updated.zone,
                    building: updated.building || "Tower A",
                    floor: updated.floor || "L01",
                    spaceCount: 0,
                    area: 0,
                    freshAir: 0,
                    extractAir: 0,
                    pressure: 0,
                    equipment: [],
                    pressureType: "neutral" as const,
                    faAssignment: null,
                    eaAssignment: null,
                  };
                  nextZones.push(newZone);
                }
              }

              // 2. Check if equipment is a new equipment tag
              let nextEquipment = [...equipment];
              if (updated.equipment && updated.equipment !== "") {
                const equipExists = equipment.some(
                  (eq) => eq.id.toLowerCase() === updated.equipment.toLowerCase() || eq.tag.toLowerCase() === updated.equipment.toLowerCase()
                );
                if (!equipExists) {
                  const equipId = `equip-${Date.now()}`;
                  const newEquip = {
                    id: equipId,
                    tag: updated.equipment,
                    type: "Air Handling Unit",
                    zones: 0,
                    spaces: 0,
                    totalAirflow: 0,
                    capacity: 2000,
                    utilization: 0,
                    status: "design" as const,
                    mode: "Fresh Air + Extract Air" as const,
                    zoneIds: [],
                  };
                  nextEquipment.push(newEquip);
                }
              }

              // 3. Prepare updated spaces list
              let nextSpaces = spaces.map((s) => s.id === updated.id ? updated : s);

              // 4. Multiplier expansion: if updated.multiplier > 1, create clones!
              const mult = parseInt(String(updated.multiplier)) || 1;
              if (mult > 1) {
                const originalUpdated = { ...updated, multiplier: 1 };
                nextSpaces = nextSpaces.map((s) => s.id === updated.id ? originalUpdated : s);
                
                const clones: Space[] = [];
                for (let i = 1; i < mult; i++) {
                  const nextNum = Math.floor(Math.random() * 1000);
                  clones.push({
                    ...updated,
                    id: `sp-${Date.now()}-${i}-${nextNum}`,
                    code: `${updated.code}-${i}`,
                    name: `${updated.name}-${i}`,
                    multiplier: 1,
                  });
                }
                nextSpaces.push(...clones);
              }

              // 5. Balance ventilation airflows and commit state in a single operation
              const balanced = calculateVentilation(nextSpaces, nextZones, nextEquipment);
              setWorkspaceState({
                spaces: balanced.spaces,
                zones: balanced.zones,
                equipment: balanced.equipment,
              });

              setEditingSpace(null);
            }}
            availableZones={zones.map(z => z.name)}
            availableEquipment={equipment.map(e => e.tag)}
            availableFloors={allUniqueFloors}
          />
        )}

        {/* Rest Room / Changing Room Configuration Modal */}
        {restroomModalSpace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <header className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/30">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                    Rest Room / Changing Room Configuration
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Enter the quantity of each sub-category to compute total exhaust.
                  </p>
                </div>
                <button
                  onClick={() => setRestroomModalSpace(null)}
                  className="text-muted-foreground hover:text-foreground rounded p-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="size-4" />
                </button>
              </header>
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {[
                  { key: "toiletPrivateContinuous", label: "Toilet - private (continuous)", rate: "12.5 L/s per toilet" },
                  { key: "toiletPublicContinuous", label: "Toilet - public (continuous)", rate: "25.0 L/s per toilet" },
                  { key: "toiletPrivateDiscontinuous", label: "Toilet - private (discontinuous)", rate: "25.0 L/s per toilet" },
                  { key: "toiletPublicDiscontinuous", label: "Toilet - public (discontinuous)", rate: "35.0 L/s per toilet" },
                  { key: "showerContinuous", label: "Shower Rooms (continuous)", rate: "10.0 L/s per shower" },
                  { key: "showerDiscontinuous", label: "Shower Rooms (discontinuous)", rate: "25.0 L/s per shower" },
                  { key: "janitorCloset", label: "Janitor Closets, Trash Rooms, Recycling", rate: `5.0 L/s per m² (${(5.0 * (restroomModalSpace.area || 0)).toFixed(1)} L/s for ${(restroomModalSpace.area || 0)} m² restroom)` },
                  { key: "lockerRoom", label: "Locker Rooms", rate: `1.25 L/s per m² (${(1.25 * (restroomModalSpace.area || 0)).toFixed(1)} L/s for ${(restroomModalSpace.area || 0)} m² restroom)` },
                ].map((subcat) => {
                  const sub = restroomModalSpace.restroomSubCategories || {};
                  const qty = sub[subcat.key] || 0;
                  return (
                    <div key={subcat.key} className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-100/60 dark:border-zinc-900/60">
                      <div className="flex flex-col">
                        <span className="text-[12.5px] font-semibold text-slate-700 dark:text-zinc-300">
                          {subcat.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {subcat.rate}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setRestroomModalSpace((prev) => {
                              if (!prev) return null;
                              const sub = prev.restroomSubCategories || {};
                              return {
                                ...prev,
                                restroomSubCategories: {
                                  ...sub,
                                  [subcat.key]: val
                                }
                              };
                            });
                          }}
                          className="w-20 h-9 px-2 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[13px] font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-neutral-800 dark:text-neutral-200"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-6 py-4 bg-slate-50/50 dark:bg-zinc-900/30 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Total Exhaust
                  </span>
                  <span className="text-[15px] font-black text-primary">
                    {(() => {
                      const sub = restroomModalSpace.restroomSubCategories || {};
                      const areaVal = restroomModalSpace.area || 0;
                      let total = 0;
                      total += (sub.toiletPrivateContinuous || 0) * 12.5;
                      total += (sub.toiletPublicContinuous || 0) * 25.0;
                      total += (sub.toiletPrivateDiscontinuous || 0) * 25.0;
                      total += (sub.toiletPublicDiscontinuous || 0) * 35.0;
                      total += (sub.showerContinuous || 0) * 10.0;
                      total += (sub.showerDiscontinuous || 0) * 25.0;
                      total += (sub.janitorCloset || 0) * areaVal * 5.0;
                      total += (sub.lockerRoom || 0) * areaVal * 1.25;
                      return total;
                    })()}{" "}
                    L/s
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const editIds = selected.has(restroomModalSpace.id) ? Array.from(selected) : [restroomModalSpace.id];
                    const updatedSpaces = spaces.map(s => {
                      if (editIds.includes(s.id)) {
                        return {
                          ...s,
                          category: "Rest Room / Changing Room",
                          restroomSubCategories: restroomModalSpace.restroomSubCategories
                        };
                      }
                      return s;
                    });
                    updateSpaces(updatedSpaces);
                    setRestroomModalSpace(null);
                    if (selected.has(restroomModalSpace.id)) {
                      setSelected(new Set());
                    }
                  }}
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 transition cursor-pointer"
                >
                  Apply &amp; Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Category Modal for "OTHER" */}
        {customParamModalSpace && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md animate-scale-in">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="font-semibold text-[14px]">Configure Custom Parameters</h3>
                </div>
                <button 
                  onClick={() => setCustomParamModalSpace(null)} 
                  className="text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded p-0.5"
                >
                  <X className="size-4" />
                </button>
              </header>
              <div className="p-4 flex flex-col gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground mb-2 leading-relaxed">
                    Define custom calculation parameters for the category of space <span className="font-semibold text-foreground">"{customParamModalSpace.name}"</span>.
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Custom Category Name</label>
                  <input
                    type="text"
                    value={customParamModalSpace.category}
                    onChange={(e) => setCustomParamModalSpace({ ...customParamModalSpace, category: e.target.value })}
                    placeholder="e.g. Custom (Custom)"
                    className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Workflow Method</label>
                  <select
                    value={customParamModalSpace.customWorkflow || "calculate"}
                    onChange={(e) => setCustomParamModalSpace({ 
                      ...customParamModalSpace, 
                      customWorkflow: e.target.value as "calculate" | "direct" 
                    })}
                    className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer text-foreground"
                  >
                    <option value="calculate">Calculate Airflow Rates</option>
                    <option value="direct">Direct Airflow Values</option>
                  </select>
                </div>

                {customParamModalSpace.customWorkflow === "direct" ? (
                  <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">Outdoor Air (Fresh) Given (L/s)</label>
                      <input
                        type="number"
                        step="any"
                        value={customParamModalSpace.customFreshGiven ?? ""}
                        onChange={(e) => setCustomParamModalSpace({ 
                          ...customParamModalSpace, 
                          customFreshGiven: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                        })}
                        className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">Extract Air Taken (L/s)</label>
                      <input
                        type="number"
                        step="any"
                        value={customParamModalSpace.customExtTaken ?? ""}
                        onChange={(e) => setCustomParamModalSpace({ 
                          ...customParamModalSpace, 
                          customExtTaken: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                        })}
                        className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-muted-foreground font-medium mb-1">People OA (L/s/person)</label>
                        <input
                          type="number"
                          step="any"
                          value={customParamModalSpace.customPeopleOA ?? ""}
                          onChange={(e) => setCustomParamModalSpace({ 
                            ...customParamModalSpace, 
                            customPeopleOA: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                          })}
                          className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground font-medium mb-1">Area OA (L/s/mÂ²)</label>
                        <input
                          type="number"
                          step="any"
                          value={customParamModalSpace.customAreaOA ?? ""}
                          onChange={(e) => setCustomParamModalSpace({ 
                            ...customParamModalSpace, 
                            customAreaOA: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                          })}
                          className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-muted-foreground font-medium mb-1">ACH</label>
                        <input
                          type="number"
                          step="any"
                          value={customParamModalSpace.customAch ?? ""}
                          onChange={(e) => setCustomParamModalSpace({ 
                            ...customParamModalSpace, 
                            customAch: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                          })}
                          className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground font-medium mb-1">Exh / Area (L/s/mÂ²)</label>
                        <input
                          type="number"
                          step="any"
                          value={customParamModalSpace.customExhaustPerArea ?? ""}
                          onChange={(e) => setCustomParamModalSpace({ 
                            ...customParamModalSpace, 
                            customExhaustPerArea: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                          })}
                          className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground font-medium mb-1">Exh / Unit (L/s/unit)</label>
                        <input
                          type="number"
                          step="any"
                          value={customParamModalSpace.customExhaustPerUnit ?? ""}
                          onChange={(e) => setCustomParamModalSpace({ 
                            ...customParamModalSpace, 
                            customExhaustPerUnit: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                          })}
                          className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
                <button 
                  onClick={() => setCustomParamModalSpace(null)} 
                  className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    let catName = customParamModalSpace.category.trim();
                    if (!catName) {
                      catName = "Custom (Custom)";
                    } else if (!catName.endsWith(" (Custom)")) {
                      catName = `${catName} (Custom)`;
                    }

                    const finalSpaceUpdate: Space = {
                      ...customParamModalSpace,
                      category: catName,
                    };

                    updateSpaces([finalSpaceUpdate]);
                    setCustomParamModalSpace(null);
                  }} 
                  className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 shadow-sm"
                >
                  Save Parameters
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Revit Excel Import Modal */}
        {importOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div 
              className={`bg-background border border-border rounded-2xl shadow-lg w-full max-w-5xl max-h-[85vh] flex flex-col animate-scale-in ${pendingRecords.length === 0 ? "cursor-pointer" : ""}`}
              onDragOver={(e) => {
                if (pendingRecords.length === 0) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                if (pendingRecords.length === 0) {
                  handleFileDrop(e);
                }
              }}
              onClick={(e) => {
                if (pendingRecords.length === 0) {
                  const target = e.target as HTMLElement;
                  if (!target.closest("button") && !target.closest("input")) {
                    fileInputRef.current?.click();
                  }
                }
              }}
            >
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-[14px]">Import Revit Space Schedule</h3>
                <button onClick={() => setImportOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </header>
              
              <div className={`p-4 flex-1 flex flex-col gap-4 ${pendingRecords.length === 0 ? "min-h-[45vh]" : "overflow-y-auto"}`}>
                {pendingRecords.length === 0 ? (
                  <div className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center justify-center gap-3 text-center bg-surface-1 hover:bg-surface-2 transition-colors flex-1 justify-center">
                    <Upload className="size-8 text-muted-foreground animate-pulse" />
                    <div className="text-sm font-medium">Drag & drop Revit Excel export sheet here, or click to browse</div>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                    <p className="text-[11px] text-muted-foreground max-w-md mt-2">
                      Dynamic columns parser matches headers: <strong>Level</strong>, <strong>Zone</strong>, <strong>Name</strong>, <strong>Area</strong>, <strong>Room: Unbounded Height</strong>, and <strong>Number of People</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Bulk controls for pending items */}
                    <div className="bg-surface-2 border border-border rounded p-3 flex flex-wrap items-center gap-3 text-xs">
                      <div className="font-semibold text-muted-foreground">Bulk Edit ({selectedPending.size} selected):</div>
                      <input
                        type="text"
                        placeholder="Level (e.g. 1F)"
                        value={importBulkValues.level}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, level: e.target.value })}
                        className="bg-background border border-border rounded px-2 py-1 w-20 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Zone (e.g. GF-01)"
                        value={importBulkValues.zone}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, zone: e.target.value })}
                        className="bg-background border border-border rounded px-2 py-1 w-20 outline-none"
                      />
                      <select
                        value={importBulkValues.category}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, category: e.target.value })}
                        className="bg-background border border-border rounded px-2 py-1 max-w-[150px] outline-none"
                      >
                        <option value="">-- Category --</option>
                        {zones.map(z => z.name).concat(["Office space", "Conference / meeting", "Corridors", "EX. Toilet - private (continuous)"]).filter((v, i, a) => a.indexOf(v) === i).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        value={importBulkValues.pressure}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, pressure: e.target.value })}
                        className="bg-background border border-border rounded px-2 py-1 outline-none"
                      >
                        <option value="">-- Pressure --</option>
                        <option value="Neutral">Neutral</option>
                        <option value="Positive">Positive</option>
                        <option value="Negative">Negative</option>
                        <option value="Critical">Critical</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Height"
                        value={importBulkValues.height}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, height: e.target.value })}
                        className="bg-background border border-border rounded px-2 py-1 w-14 outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Fixtures"
                        value={importBulkValues.fixtures}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, fixtures: e.target.value })}
                        className="bg-background border border-border rounded px-2 py-1 w-16 outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Mult."
                        value={importBulkValues.multiplier}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, multiplier: e.target.value })}
                        className="bg-background border border-border rounded px-2 py-1 w-14 outline-none"
                      />
                      <button onClick={handlePendingBulkApply} className="bg-primary text-primary-foreground font-semibold px-3 py-1 rounded hover:bg-primary/90 transition-colors">
                        Apply Bulk
                      </button>
                    </div>

                    {/* Pending list table */}
                    <div className="border border-border rounded overflow-hidden max-h-[40vh] overflow-y-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-header-bg border-b border-border sticky top-0 font-semibold text-muted-foreground">
                          <tr>
                            <th className="p-2 w-8 text-center">
                              <input
                                type="checkbox"
                                checked={pendingRecords.length > 0 && selectedPending.size === pendingRecords.length}
                                onChange={(e) => setSelectedPending(e.target.checked ? new Set(pendingRecords.map(p => p.id)) : new Set())}
                                className="cursor-pointer"
                              />
                            </th>
                            <th className="p-2">Level</th>
                            <th className="p-2">Name</th>
                            <th className="p-2">Zone</th>
                            <th className="p-2">ASHRAE Category</th>
                            <th className="p-2">Pressure</th>
                            <th className="p-2">Area (mÂ²)</th>
                            <th className="p-2">Height (m)</th>
                            <th className="p-2">Fixtures</th>
                            <th className="p-2">Mult.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pendingRecords.map((rec) => {
                            const isSel = selectedPending.has(rec.id);
                            return (
                              <tr
                                key={rec.id}
                                onClick={(e) => togglePending(rec.id, e.shiftKey, e.ctrlKey || e.metaKey)}
                                className={`hover:bg-row-hover ${isSel ? 'bg-accent/10' : ''} cursor-default select-none`}
                              >
                                <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSel}
                                    onClick={(e) => togglePending(rec.id, e.shiftKey, true)}
                                    onChange={() => {}}
                                    className="cursor-pointer"
                                  />
                                </td>
                                <td className="p-2 font-mono">{rec.level}</td>
                                <td className="p-2 font-medium">{rec.name}</td>
                                <td className="p-2 font-mono">{rec.zone}</td>
                                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                                  <span className="inline-flex items-center gap-1.5 w-full">
                                    <span
                                      title={rec.aiDetected ? "Automatically identified" : undefined}
                                      className={`size-1.5 rounded-full shrink-0 ${rec.aiDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`}
                                    />
                                    <select
                                      value={rec.category && rec.category.endsWith(" (Custom)") ? "Other" : rec.category || ""}
                                      onChange={(e) => {
                                        const newVal = e.target.value;
                                        setPendingRecords(prev => prev.map(p => p.id === rec.id ? { ...p, category: newVal, aiDetected: false } : p));
                                      }}
                                      className="w-full bg-transparent border-0 hover:bg-surface-2 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-0.5 px-1 rounded text-foreground text-[11px] cursor-pointer truncate"
                                    >
                                      <option value="" className="text-muted-foreground italic">Select Category...</option>
                                      <option value="Other" className="bg-background text-foreground">Other</option>
                                      {getOccupancyCategories().map((c) => (
                                        <option key={c} value={c} className="bg-background text-foreground">
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </span>
                                </td>
                                <td className="p-2 font-mono" onClick={(e) => e.stopPropagation()}>
                                  <span className="inline-flex items-center gap-1.5">
                                    <span
                                      title={rec.pressureAutoDetected ? "Automatically identified" : undefined}
                                      className={`size-1.5 rounded-full shrink-0 ml-1 ${rec.pressureAutoDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`}
                                    />
                                    <select
                                      value={PRESSURE_MAP[rec.pressure || "Positive"] || "1"}
                                      onChange={(e) => {
                                        const newVal = REVERSE_PRESSURE_MAP[e.target.value] || "Positive";
                                        setPendingRecords(prev => prev.map(p => p.id === rec.id ? { ...p, pressure: newVal, pressureAutoDetected: false } : p));
                                      }}
                                      className={`font-bold rounded-full text-[11px] leading-none py-1 w-12 text-center font-mono border border-transparent cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none transition-all appearance-none ${
                                        rec.pressure === "Positive" ? "bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" :
                                        rec.pressure === "Negative" ? "bg-destructive/20 text-destructive dark:bg-destructive/20 dark:text-red-400" :
                                        rec.pressure === "Critical" ? "bg-warning/20 text-warning dark:bg-warning/20 dark:text-amber-400" :
                                        "bg-muted text-muted-foreground hover:bg-muted/80"
                                      }`}
                                    >
                                      <option value="1" className="bg-background text-success font-bold">+1</option>
                                      <option value="0" className="bg-background text-muted-foreground font-bold">0</option>
                                      <option value="-1" className="bg-background text-destructive font-bold">-1</option>
                                      <option value="-2" className="bg-background text-warning font-bold">-2</option>
                                    </select>
                                  </span>
                                </td>
                                <td className="p-2 font-mono">{rec.area.toFixed(1)}</td>
                                <td className="p-2 font-mono">{rec.height.toFixed(2)}</td>
                                <td className="p-2 font-mono">{rec.fixtures || "-"}</td>
                                <td className="p-2 font-mono">{rec.multiplier}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <footer className="px-4 py-3 border-t border-border flex items-center justify-between bg-header-bg">
                <button
                  onClick={() => { setPendingRecords([]); setSelectedPending(new Set()); }}
                  disabled={pendingRecords.length === 0}
                  className="border border-border text-muted-foreground text-xs px-3 py-1.5 rounded hover:bg-surface-2 disabled:opacity-50"
                >
                  Clear parsed
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setImportOpen(false)} className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2">
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitImports}
                    disabled={selectedPending.size === 0}
                    className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 transition-colors disabled:opacity-50"
                  >
                    Commit {selectedPending.size} Spaces
                  </button>
                </div>
              </footer>
            </div>
          </div>
        )}

        {/* Auto zoning floor selection */}
        {autoZoneFloorSelectOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-sm animate-scale-in">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="font-semibold text-[14px]">Select Floor</h3>
                </div>
                <button onClick={() => setAutoZoneFloorSelectOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </header>
              <div className="p-4 flex flex-col gap-3 text-xs">
                <p className="text-muted-foreground leading-normal">
                  Select which floor you would like to run auto-zoning for.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setAutoZoneSelectedFloors(new Set(autoZoneAvailableFloors))}
                    className="text-[10px] text-primary hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground/30">|</span>
                  <button
                    onClick={() => setAutoZoneSelectedFloors(new Set())}
                    className="text-[10px] text-primary hover:underline font-semibold"
                  >
                    Deselect All
                  </button>
                </div>
                <div className="border border-border rounded-md divide-y divide-border overflow-y-auto max-h-[30vh] bg-surface-2/40">
                  {autoZoneAvailableFloors.map((floor) => {
                    const isChecked = autoZoneSelectedFloors.has(floor);
                    return (
                      <label key={floor} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-row-hover transition-colors select-none font-sans">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const next = new Set(autoZoneSelectedFloors);
                            if (next.has(floor)) {
                              next.delete(floor);
                            } else {
                              next.add(floor);
                            }
                            setAutoZoneSelectedFloors(next);
                          }}
                          className="cursor-pointer"
                        />
                        <span className="font-medium text-foreground">{floor}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
                <button onClick={() => setAutoZoneFloorSelectOpen(false)} className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2">
                  Cancel
                </button>
                <button
                  onClick={handleFloorSelectProceed}
                  disabled={autoZoneSelectedFloors.size === 0}
                  className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 disabled:opacity-50"
                >
                  Done
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Spaces Bulk Edit Dialog */}
        {bulkEditOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl shadow-lg w-full max-w-lg animate-scale-in">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="size-4 text-primary" />
                  <h3 className="font-semibold text-[14px]">Bulk Edit {selected.size} Spaces</h3>
                </div>
                <button onClick={() => setBulkEditOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </header>
              <div className="p-4 flex flex-col gap-4 text-xs">
                <div className="bg-primary/5 border border-primary/10 rounded-md p-2.5 text-muted-foreground flex items-start gap-2 leading-normal">
                  <Info className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    Check the box next to any parameter to enable and update it across all selected spaces. Unchecked parameters will remain unchanged.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      <input
                        type="checkbox"
                        id="bulk-update-building"
                        checked={bulkEditFields.building}
                        onChange={(e) => setBulkEditFields({ ...bulkEditFields, building: e.target.checked })}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                      />
                      <label htmlFor="bulk-update-building" className="text-muted-foreground font-medium cursor-pointer">Building</label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Tower B (or blank to clear)"
                      value={bulkEditValues.building}
                      disabled={!bulkEditFields.building}
                      onChange={(e) => setBulkEditValues({ ...bulkEditValues, building: e.target.value })}
                      className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      <input
                        type="checkbox"
                        id="bulk-update-floor"
                        checked={bulkEditFields.floor}
                        onChange={(e) => setBulkEditFields({ ...bulkEditFields, floor: e.target.checked })}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                      />
                      <label htmlFor="bulk-update-floor" className="text-muted-foreground font-medium cursor-pointer">Floor</label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. L02 (or blank to clear)"
                      value={bulkEditValues.floor}
                      disabled={!bulkEditFields.floor}
                      onChange={(e) => setBulkEditValues({ ...bulkEditValues, floor: e.target.value })}
                      className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bulk-update-category"
                      checked={bulkEditFields.category}
                      onChange={(e) => setBulkEditFields({ ...bulkEditFields, category: e.target.checked })}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                    />
                    <label htmlFor="bulk-update-category" className="text-muted-foreground font-medium cursor-pointer">Category Classification</label>
                  </div>
                  {bulkEditFields.category ? (
                    <CategorySelect
                      value={bulkEditValues.category}
                      onChange={(newVal) => setBulkEditValues({ ...bulkEditValues, category: newVal })}
                      triggerClassName="w-full bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer transition-all text-foreground h-9"
                    />
                  ) : (
                    <div className="bg-surface-2 opacity-50 border border-border rounded px-2.5 py-1.5 w-full text-muted-foreground text-[13px] h-9 flex items-center select-none cursor-not-allowed">
                      -- Select Category (or blank to clear) --
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bulk-update-pressure"
                      checked={bulkEditFields.pressure}
                      onChange={(e) => setBulkEditFields({ ...bulkEditFields, pressure: e.target.checked })}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                    />
                    <label htmlFor="bulk-update-pressure" className="text-muted-foreground font-medium cursor-pointer">Pressure Mode</label>
                  </div>
                  <select
                    value={bulkEditValues.pressure}
                    disabled={!bulkEditFields.pressure}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, pressure: e.target.value })}
                    className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer transition-all text-foreground"
                  >
                    <option value="">-- Select Pressure Mode --</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Positive">Positive</option>
                    <option value="Negative">Negative</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      <input
                        type="checkbox"
                        id="bulk-update-area"
                        checked={bulkEditFields.area}
                        onChange={(e) => setBulkEditFields({ ...bulkEditFields, area: e.target.checked })}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                      />
                      <label htmlFor="bulk-update-area" className="text-muted-foreground font-medium cursor-pointer">Area (m²)</label>
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 15.0"
                      value={bulkEditValues.area}
                      disabled={!bulkEditFields.area}
                      onChange={(e) => setBulkEditValues({ ...bulkEditValues, area: e.target.value })}
                      className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all text-[13px] text-foreground"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      <input
                        type="checkbox"
                        id="bulk-update-height"
                        checked={bulkEditFields.height}
                        onChange={(e) => setBulkEditFields({ ...bulkEditFields, height: e.target.checked })}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                      />
                      <label htmlFor="bulk-update-height" className="text-muted-foreground font-medium cursor-pointer">Height (m)</label>
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 3.0"
                      value={bulkEditValues.height}
                      disabled={!bulkEditFields.height}
                      onChange={(e) => setBulkEditValues({ ...bulkEditValues, height: e.target.value })}
                      className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all text-[13px] text-foreground"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      <input
                        type="checkbox"
                        id="bulk-update-fixtures"
                        checked={bulkEditFields.fixtures}
                        onChange={(e) => setBulkEditFields({ ...bulkEditFields, fixtures: e.target.checked })}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                      />
                      <label htmlFor="bulk-update-fixtures" className="text-muted-foreground font-medium cursor-pointer">Fixtures (Occ)</label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 5 (or blank)"
                      value={bulkEditValues.fixtures}
                      disabled={!bulkEditFields.fixtures}
                      onChange={(e) => setBulkEditValues({ ...bulkEditValues, fixtures: e.target.value })}
                      className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all text-[13px] text-foreground"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      <input
                        type="checkbox"
                        id="bulk-update-multiplier"
                        checked={bulkEditFields.multiplier}
                        onChange={(e) => setBulkEditFields({ ...bulkEditFields, multiplier: e.target.checked })}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                      />
                      <label htmlFor="bulk-update-multiplier" className="text-muted-foreground font-medium cursor-pointer">Multiplier</label>
                    </div>
                    <input
                      type="number"
                      placeholder="e.g. 1"
                      value={bulkEditValues.multiplier}
                      disabled={!bulkEditFields.multiplier}
                      onChange={(e) => setBulkEditValues({ ...bulkEditValues, multiplier: e.target.value })}
                      className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all text-[13px] text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      <input
                        type="checkbox"
                        id="bulk-update-zone"
                        checked={bulkEditFields.zone}
                        onChange={(e) => setBulkEditFields({ ...bulkEditFields, zone: e.target.checked })}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                      />
                      <label htmlFor="bulk-update-zone" className="text-muted-foreground font-medium cursor-pointer">Assign Zone ID</label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Z-002 (or blank to clear)"
                      value={bulkEditValues.zone}
                      disabled={!bulkEditFields.zone}
                      onChange={(e) => setBulkEditValues({ ...bulkEditValues, zone: e.target.value })}
                      className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all"
                      list="bulk-zones-list"
                    />
                    <datalist id="bulk-zones-list">
                      {zones.map((z) => <option key={z.id} value={z.name} />)}
                    </datalist>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      <input
                        type="checkbox"
                        id="bulk-update-equipment"
                        checked={bulkEditFields.equipment}
                        onChange={(e) => setBulkEditFields({ ...bulkEditFields, equipment: e.target.checked })}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer animate-scale-in"
                      />
                      <label htmlFor="bulk-update-equipment" className="text-muted-foreground font-medium cursor-pointer">Assign Equip Tag</label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. AHU-01 (or blank to clear)"
                      value={bulkEditValues.equipment}
                      disabled={!bulkEditFields.equipment}
                      onChange={(e) => setBulkEditValues({ ...bulkEditValues, equipment: e.target.value })}
                      className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all"
                      list="bulk-equip-list"
                    />
                    <datalist id="bulk-equip-list">
                      {equipment.map((eq) => <option key={eq.id} value={eq.tag} />)}
                    </datalist>
                  </div>
                </div>
              </div>
              <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
                <button onClick={() => setBulkEditOpen(false)} className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2 animate-fade-in">
                  Cancel
                </button>
                <button onClick={handleBulkEditApply} className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 shadow-sm transition-colors">
                  Apply Updates
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Assign Zone Modal */}
        {assignZoneOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl shadow-lg w-full max-w-sm animate-scale-in">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-[14px]">Assign Zone</h3>
                <button onClick={() => setAssignZoneOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </header>
              <div className="p-4 flex flex-col gap-3 text-xs">
                <label className="block text-muted-foreground font-medium">Select or Type Zone name</label>
                <input
                  type="text"
                  placeholder="e.g. Z-003 or WC Zone"
                  value={targetZone}
                  onChange={(e) => setTargetZone(e.target.value)}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                  list="zones-list"
                />
                <datalist id="zones-list">
                  {zones.map((z) => <option key={z.id} value={z.name} />)}
                </datalist>
              </div>
              <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
                <button onClick={() => setAssignZoneOpen(false)} className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2">
                  Cancel
                </button>
                <button onClick={handleAssignZoneApply} className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95">
                  Confirm Zone
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Assign Equipment Modal */}
        {assignEquipOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl shadow-lg w-full max-w-sm animate-scale-in">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-[14px]">Assign Equipment</h3>
                <button onClick={() => setAssignEquipOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </header>
              <div className="p-4 flex flex-col gap-3 text-xs">
                <label className="block text-muted-foreground font-medium">Select or Type Equipment Tag</label>
                <input
                  type="text"
                  placeholder="e.g. AHU-02"
                  value={targetEquip}
                  onChange={(e) => setTargetEquip(e.target.value)}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                  list="equip-list"
                />
                <datalist id="equip-list">
                  {equipment.map((eq) => <option key={eq.id} value={eq.tag} />)}
                </datalist>
              </div>
              <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
                <button onClick={() => setAssignEquipOpen(false)} className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2">
                  Cancel
                </button>
                <button onClick={handleAssignEquipApply} className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95">
                  Confirm Equipment
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Merge Spaces Modal */}
        {mergeOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl shadow-lg w-full max-w-md animate-scale-in">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-[14px]">Merge Spaces</h3>
                <button onClick={() => setMergeOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </header>
              <div className="p-4 flex flex-col gap-3 text-xs">
                <p className="text-muted-foreground">
                  Merging {selected.size} spaces will combine their areas and occupancies. Select the primary space to inherit other properties from:
                </p>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1 font-semibold">Merged Space Name</label>
                  <input
                    type="text"
                    value={mergeName}
                    onChange={(e) => setMergeName(e.target.value)}
                    className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1 font-semibold">Primary Space</label>
                  <select
                    value={primarySpaceId}
                    onChange={(e) => setPrimarySpaceId(e.target.value)}
                    className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                  >
                    {Array.from(selected).map((id) => {
                      const sp = spaces.find((s) => s.id === id);
                      return (
                        <option key={id} value={id}>
                          {sp?.name || "Unnamed space"} ({sp?.code})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
                <button onClick={() => setMergeOpen(false)} className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2">
                  Cancel
                </button>
                <button onClick={handleMergeSpacesApply} className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95">
                  Merge Spaces
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* New Project Modal */}
        {newProjectOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl shadow-lg w-full max-w-sm animate-scale-in">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-[14px]">Create New Project</h3>
                <button onClick={() => setNewProjectOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </header>
              <div className="p-4 flex flex-col gap-3 text-xs">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Project Name</label>
                  <input
                    type="text"
                    value={newProjectValues.name}
                    onChange={(e) => setNewProjectValues({ ...newProjectValues, name: e.target.value })}
                    className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                    placeholder="e.g. Marina Bay Tower"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Project Code</label>
                  <input
                    type="text"
                    value={newProjectValues.code}
                    onChange={(e) => setNewProjectValues({ ...newProjectValues, code: e.target.value })}
                    className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                    placeholder="e.g. MBT-2026-117"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Client Name</label>
                  <input
                    type="text"
                    value={newProjectValues.client}
                    onChange={(e) => setNewProjectValues({ ...newProjectValues, client: e.target.value })}
                    className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                    placeholder="e.g. Marina Holdings"
                  />
                </div>
                <div className="flex gap-2 items-start mt-1 p-2 bg-primary/5 border border-primary/20 text-primary rounded">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span className="text-[10px]">
                    Warning: Creating a new project will clear all spaces, zones, and equipment in the current schedule.
                  </span>
                </div>
              </div>
              <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
                <button onClick={() => setNewProjectOpen(false)} className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    createNewProject({
                      name: newProjectValues.name,
                      code: newProjectValues.code,
                      client: newProjectValues.client,
                    });
                    setNewProjectOpen(false);
                  }}
                  className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95"
                >
                  Create Project
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>

  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <button className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11.5px] border border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground cursor-pointer">
      {label} <ChevronDown className="size-3" />
    </button>
  );
}

interface FilterDropdownProps {
  label: string;
  selectedValue: string | null;
  onSelect: (val: string | null) => void;
  options: string[];
}

function FilterDropdown({ label, selectedValue, onSelect, options }: FilterDropdownProps) {
  const active = !!selectedValue;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11.5px] border transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer ${
            active
              ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
              : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          <span>{active ? `${label}: ${selectedValue}` : label}</span>
          {active ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(null);
                }
              }}
              className="ml-1 hover:bg-primary/20 rounded-full p-0.5 cursor-pointer flex items-center justify-center shrink-0"
              title={`Clear ${label} filter`}
            >
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-3 text-muted-foreground shrink-0" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 font-mori">
        <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1 px-2">
          Filter by {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedValue || "all-options"}
          onValueChange={(val) => {
            if (val === "all-options") {
              onSelect(null);
            } else {
              onSelect(val);
            }
          }}
        >
          <DropdownMenuRadioItem
            value="all-options"
            className="text-[12px] py-1 cursor-pointer font-mori focus:bg-primary/10 focus:text-primary"
          >
            All {label}s
          </DropdownMenuRadioItem>
          {options.map((opt) => (
            <DropdownMenuRadioItem
              key={opt}
              value={opt}
              className="text-[12px] py-1 cursor-pointer font-mori focus:bg-primary/10 focus:text-primary"
            >
              {opt}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconBtn({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11.5px] border border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground cursor-pointer">
      <Icon className="size-3" /> {label}
    </button>
  );
}

function BulkBtn({ icon: Icon, children, onClick }: { icon: any; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button 
      onClick={onClick} 
      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors text-[#06456F] hover:bg-primary/10 dark:text-[#0A7BC7] dark:hover:bg-primary/20 border border-transparent hover:border-primary/20 active:bg-primary/20 dark:active:bg-primary/30 cursor-pointer"
    >
      <Icon className="size-3 shrink-0" /> {children}
    </button>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ Zones â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ZonesView() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { spaces, zones, deleteZone, addZone, equipment, assignZoneToEquipment, removeZoneFromEquipment, updateZoneInstances, addEquipment, updateEquipment, updateSpaces, updateZones, bulkUpdateSpaces, setWorkspaceState, undo, redo } = useWorkspace();
  const confirm = useConfirm();
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [customParamModalSpace, setCustomParamModalSpace] = useState<Space | null>(null);
  const [restroomModalSpace, setRestroomModalSpace] = useState<Space | null>(null);

  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set());
  const [lastClickedZoneIndex, setLastClickedZoneIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openId) {
      document.body.classList.add("modal-open-blur");
    } else {
      const activeModals = document.querySelectorAll(".fixed.z-50");
      if (activeModals.length <= 1) {
        document.body.classList.remove("modal-open-blur");
      }
    }
    return () => {
      const activeModals = document.querySelectorAll(".fixed.z-50");
      if (activeModals.length <= 1) {
        document.body.classList.remove("modal-open-blur");
      }
    };
  }, [openId]);

  const toggleZone = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelectedZones((prev) => {
      const clickedIndex = rows.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift && lastClickedZoneIndex !== null) {
        const start = Math.min(lastClickedZoneIndex, clickedIndex);
        const end = Math.max(lastClickedZoneIndex, clickedIndex);
        
        if (!isCtrl) {
          next.clear();
        }

        const shouldSelect = prev.has(rows[lastClickedZoneIndex]?.id || "") || true;

        for (let i = start; i <= end; i++) {
          const rId = rows[i]?.id;
          if (rId) {
            if (shouldSelect) {
              next.add(rId);
            } else {
              next.delete(rId);
            }
          }
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedZoneIndex(clickedIndex);
      } else {
        if (prev.has(id)) {
          next.delete(id);
          setLastClickedZoneIndex(null);
        } else {
          next.clear();
          next.add(id);
          setLastClickedZoneIndex(clickedIndex);
        }
      }
      return next;
    });
  };
  // Zone Allocation Panel state
  const [zoneAllocOpen, setZoneAllocOpen] = useState(false);
  const [allocZoneId, setAllocZoneId] = useState<string | null>(null);
  const [allocEquipId, setAllocEquipId] = useState<string | null>(null);


  // keep old wiring so context-menu "Assign Equipment" still works
  const setAssignZoneEquipOpen = (open: boolean) => {
    if (open) {
      console.log("setAssignZoneEquipOpen: selectedZones=", Array.from(selectedZones));
      if (selectedZones.size > 1) {
        setAllocZoneId(null);
        setZoneAllocOpen(true);
      } else {
        const zid = Array.from(selectedZones)[0] ?? null;
        console.log("setAssignZoneEquipOpen single zid=", zid);
        if (zid) { setAllocZoneId(zid); setZoneAllocOpen(true); }
      }
    } else { setZoneAllocOpen(false); }
  };

  const [editZoneOpen, setEditZoneOpen] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editZoneName, setEditZoneName] = useState("");

  const handleRenameZone = async () => {
    const newName = editZoneName.trim();
    if (!newName || !editingZoneId) return;
    const zone = zones.find(z => z.id === editingZoneId);
    if (!zone) return;

    if (newName.toLowerCase() !== zone.name.toLowerCase()) {
      const nameExists = zones.some(
        z => z.id !== editingZoneId && z.name.toLowerCase() === newName.toLowerCase()
      );
      if (nameExists) {
        await confirm(`Zone already exists with this name "${newName}".`, {
          title: "Zone Already Exists",
          confirmText: "OK",
          hideCancel: true,
        });
        return;
      }
    }

    // Update zone name in zones list
    const updatedZones = zones.map(z => {
      if (z.id === editingZoneId) {
        return { ...z, name: newName };
      }
      return z;
    });

    // Update space zone references
    const updatedSpaces = spaces.map(s => {
      if (s.zone === editingZoneId || s.zone === zone.name) {
        return { ...s, zone: newName };
      }
      return s;
    });

    updateZones(updatedZones);
    updateSpaces(updatedSpaces);
  };

  const handleCloseEditZone = () => {
    handleRenameZone();
    setEditZoneOpen(false);
    setEditingZoneId(null);
  };

  const handleCreateSpaceInZone = () => {
    const code = `SP-${String(spaces.length + 1).padStart(3, "0")}`;
    const newSpace: Space = {
      id: `space-${Date.now()}`,
      code,
      name: `Space ${spaces.length + 1}`,
      building: "Tower A",
      floor: "L01",
      category: "",
      area: 20,
      occupancy: 0,
      height: 3,
      fixtures: 0,
      multiplier: 1,
      zone: editZoneName, // Assign directly to this zone!
      equipment: "",
      freshAir: 0,
      extractAir: 0,
      pressure: "Neutral",
      status: "draft",
      aiDetected: false,
      pressureAutoDetected: false,
    };
    updateSpaces([...spaces, newSpace]);
  };

  const addSpaceToEditingZone = async (spaceId: string) => {
    const targetSpace = spaces.find(s => s.id === spaceId);
    if (targetSpace && targetSpace.zone && targetSpace.zone !== "Default" && targetSpace.zone !== "unzoned") {
      const isSure = await confirm(
        `This space is already assigned to "${targetSpace.zone}". Are you sure you want to move it to "${editZoneName}"?`,
        {
          title: "Reassign Space",
          confirmText: "Yes, Move Space",
          cancelText: "Cancel",
        }
      );
      if (!isSure) return;
    }

    const updated = spaces.map(s => {
      if (s.id === spaceId) {
        return { ...s, zone: editZoneName };
      }
      return s;
    });
    updateSpaces(updated);
  };

  const removeSpaceFromEditingZone = (spaceId: string) => {
    const updated = spaces.map(s => {
      if (s.id === spaceId) {
        return { ...s, zone: "Default" }; // set to unzoned
      }
      return s;
    });
    updateSpaces(updated);
  };







  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedPressure, setSelectedPressure] = useState<string | null>(null);

  const uniqueBuildings = useMemo(() => {
    const vals = new Set<string>();
    zones.forEach((z) => {
      if (z.building) vals.add(z.building);
    });
    return Array.from(vals).sort();
  }, [zones]);

  const uniqueFloors = useMemo(() => {
    const vals = new Set<string>();
    zones.forEach((z) => {
      if (z.floor) vals.add(z.floor);
    });
    return Array.from(vals).sort();
  }, [zones]);

  const uniquePressures = useMemo(() => {
    const vals = new Set<string>();
    zones.forEach((z) => {
      if (z.pressureType) {
        const formatted = z.pressureType.charAt(0).toUpperCase() + z.pressureType.slice(1);
        vals.add(formatted);
      }
    });
    return Array.from(vals).sort();
  }, [zones]);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return zones.filter((z) => {
      if (selectedBuilding && z.building !== selectedBuilding) return false;
      if (selectedFloor && z.floor !== selectedFloor) return false;
      if (selectedPressure) {
        if (z.pressureType.toLowerCase() !== selectedPressure.toLowerCase()) return false;
      }
      return !q || `${z.name} ${z.building} ${z.floor}`.toLowerCase().includes(q);
    });
  }, [zones, query, selectedBuilding, selectedFloor, selectedPressure]);

  const opened = useMemo(() => {
    if (selectedZones.size > 1) return null;
    return zones.find((z) => z.id === openId);
  }, [zones, openId, selectedZones]);
  const openedSpaces = useMemo(
    () => (opened ? spaces.filter((s) => s.zone === opened.id || s.zone === opened.name) : []),
    [spaces, opened],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditing = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.getAttribute("contenteditable") === "true"
      );
      if (isEditing) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Escape: Clear selection and close split panel
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedZones(new Set());
        setOpenId(null);
        return;
      }

      // Ctrl+A: Select all zones
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (rows.length > 0) {
          setSelectedZones(new Set(rows.map((r) => r.id)));
        }
        return;
      }

      // Delete/Backspace: dissolve selected zones
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedZones.size > 0) {
          e.preventDefault();
          confirm(`Are you sure you want to dissolve the ${selectedZones.size} selected zones?`).then((ok) => {
            if (ok) {
              selectedZones.forEach(id => deleteZone(id));
              setSelectedZones(new Set());
            }
          });
        }
        return;
      }

      // Ctrl+Z / Ctrl+Y: Undo / Redo
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        redo();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [rows, selectedZones, deleteZone, setOpenId, undo, redo]);


  const getZoneEditIds = (zId: string): string[] => {
    return selectedZones.has(zId) ? Array.from(selectedZones) : [zId];
  };

  const columns: Column<Zone>[] = [
    {
      key: "name",
      header: "Zone Name",
      width: 180,
      render: (z) => (
        <div className="flex items-center gap-1.5 font-sans font-medium">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenId(openId === z.id ? null : z.id);
              setSelectedZones(new Set([z.id]));
            }}
            title={openId === z.id ? "Collapse detailed spaces list" : "Expand detailed spaces list"}
            className="p-0.5 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <ChevronDown className={`size-3.5 transition-transform duration-200 ${openId === z.id ? "rotate-180" : ""}`} />
          </button>
          <span>{z.name}</span>
        </div>
      ),
    },
    {
      key: "floor",
      header: "Floor",
      width: 100,
      mono: true,
    },
    {
      key: "spaceCount",
      header: "Spaces",
      width: 80,
      align: "center",
      mono: true,
    },
    {
      key: "area",
      header: "Area (m²)",
      width: 100,
      align: "center",
      render: (z) => <span>{z.area.toFixed(0)}</span>,
      mono: true,
    },
    {
      key: "multiplier",
      header: "Mult.",
      width: 80,
      align: "center",
      render: (z) => (
        <div onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <InlineInput
            value={z.multiplier || 1}
            type="number"
            min={1}
            onCommit={(val) => {
              const m = Math.max(1, parseInt(val) || 1);
              const editIds = getZoneEditIds(z.id);
              const updatedZones = zones.map((zoneItem) => {
                if (editIds.includes(zoneItem.id)) {
                  const clamp = (assigns: Record<string, number> | undefined) => {
                    if (!assigns) return {};
                    const res: Record<string, number> = {};
                    let total = 0;
                    for (const [eqId, q] of Object.entries(assigns)) {
                      const left = m - total;
                      if (left <= 0) break;
                      const qClamp = Math.min(q, left);
                      res[eqId] = qClamp;
                      total += qClamp;
                    }
                    return res;
                  };

                  const faAssigns = clamp(zoneItem.faAssignments);
                  const eaAssigns = clamp(zoneItem.eaAssignments);
                  const firstFA = Object.keys(faAssigns)[0] || null;
                  const firstEA = Object.keys(eaAssigns)[0] || null;

                  return {
                    ...zoneItem,
                    multiplier: m,
                    faAssignments: faAssigns,
                    eaAssignments: eaAssigns,
                    faAssignment: firstFA,
                    eaAssignment: firstEA,
                    faAssignedQty: firstFA ? faAssigns[firstFA] : 1,
                    eaAssignedQty: firstEA ? eaAssigns[firstEA] : 1,
                  };
                }
                return zoneItem;
              });
              updateZones(updatedZones);
            }}
            className="w-12 text-center text-xs"
          />
        </div>
      ),
      mono: true,
    },
    {
      key: "assignmentRate",
      header: "Assign Rate",
      width: 100,
      align: "center",
      render: (z) => {
        const mult = z.multiplier || 1;
        const totalSlots = 2 * mult;
        let assignedCount = 0;
        if (z.instances && z.instances.length > 0) {
          for (let idx = 1; idx <= mult; idx++) {
            const inst = z.instances.find((i) => i.instanceIndex === idx);
            if (inst) {
              if (inst.faEquipId) assignedCount++;
              if (inst.eaEquipId) assignedCount++;
            }
          }
        } else {
          const faQty = z.faAssignments
            ? Object.values(z.faAssignments).reduce((a, b) => a + b, 0)
            : z.faAssignment ? (z.faAssignedQty || 1) : 0;
          const eaQty = z.eaAssignments
            ? Object.values(z.eaAssignments).reduce((a, b) => a + b, 0)
            : z.eaAssignment ? (z.eaAssignedQty || 1) : 0;
          assignedCount = faQty + eaQty;
        }
        const rate = Math.round((assignedCount / totalSlots) * 100);
        return (
          <span
            title={`${assignedCount} of ${totalSlots} assignment slots filled`}
            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full select-none cursor-help ${
              rate === 100
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : rate > 0
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                : "bg-muted text-muted-foreground/60"
            }`}
          >
            {rate}%
          </span>
        );
      },
      mono: true,
    },
    {
      key: "freshAir",
      header: "Fresh Given",
      width: 120,
      align: "center",
      render: (z) => z.faAssignment ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 tabular-nums">
          {z.freshAir.toLocaleString()} L/s
        </span>
      ) : (
        <span className="text-muted-foreground/40 font-normal tabular-nums">
          {z.freshAir.toLocaleString()} L/s
        </span>
      ),
      mono: true,
    },
    {
      key: "extractAir",
      header: "Extract Taken",
      width: 120,
      align: "center",
      render: (z) => z.eaAssignment ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 tabular-nums">
          {z.extractAir.toLocaleString()} L/s
        </span>
      ) : (
        <span className="text-muted-foreground/40 font-normal tabular-nums">
          {z.extractAir.toLocaleString()} L/s
        </span>
      ),
      mono: true,
    },
    {
      key: "equipment",
      header: "Equipment",
      width: 160,
      align: "center",
      render: (z) => {
        const list: string[] = [];
        const faAssigns = z.faAssignments ? Object.keys(z.faAssignments) : z.faAssignment ? [z.faAssignment] : [];
        const eaAssigns = z.eaAssignments ? Object.keys(z.eaAssignments) : z.eaAssignment ? [z.eaAssignment] : [];
        
        faAssigns.forEach(id => {
          const eq = equipment.find(e => e.id === id);
          if (eq && !list.includes(eq.tag)) list.push(eq.tag);
        });
        eaAssigns.forEach(id => {
          const eq = equipment.find(e => e.id === id);
          if (eq && !list.includes(eq.tag)) list.push(eq.tag);
        });
        return <span className="truncate block text-muted-foreground font-medium" title={list.join(", ")}>{list.join(", ") || "None"}</span>;
      },
      mono: true,
    },
    {
      key: "flagged",
      header: "",
      width: 36,
      align: "center",
      render: (z) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const updatedZones = zones.map((zoneItem) =>
              zoneItem.id === z.id ? { ...zoneItem, flagged: !zoneItem.flagged } : zoneItem
            );
            updateZones(updatedZones);
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
          title={
            z.freshAir === 0 && z.extractAir === 0
              ? "The zone contains spaces which don't have min fresh and extract air"
              : z.flagged
              ? "Unflag zone"
              : "Flag zone"
          }
        >
          <Flag 
            className={`size-3.5 transition-all duration-200 ${
              z.flagged 
                ? "fill-red-500 text-red-500 scale-110" 
                : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
            }`} 
          />
        </button>
      ),
    },
  ];

  const toggleAllZones = () => {
    if (selectedZones.size === rows.length) {
      setSelectedZones(new Set());
    } else {
      setSelectedZones(new Set(rows.map((r) => r.id)));
    }
  };

  const renderZoneContextMenu = (z: Zone) => (
    <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
      {selectedZones.size <= 1 && (
        <ContextMenuItem
          onClick={() => {
            setEditingZoneId(z.id);
            setEditZoneName(z.name);
            setEditZoneOpen(true);
          }}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer"
        >
          <Edit3 className="size-3.5" />
          <span>Edit Zone Spaces</span>
        </ContextMenuItem>
      )}
      <ContextMenuItem
        onClick={() => {
          const allocZone = zones.find(item => item.id === z.id);
          if (!allocZone) return;
          setAllocZoneId(z.id);
          setZoneAllocOpen(true);
        }}
        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer"
      >
        <Plus className="size-3.5" />
        <span>Manage Equipment</span>
      </ContextMenuItem>
      <ContextMenuSeparator className="h-px bg-border my-1" />
      <ContextMenuItem
        onClick={async () => {
          if (await confirm(`Are you sure you want to dissolve zone "${z.name}"?`)) {
            deleteZone(z.id);
            const next = new Set(selectedZones);
            next.delete(z.id);
            setSelectedZones(next);
          }
        }}
        className="flex items-center gap-2 px-2 py-1.5 rounded text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
      >
        <Trash2 className="size-3.5" />
        <span>Dissolve Zone</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex items-center gap-1 px-3 h-10 shrink-0 flex-wrap bg-background no-print modal-blur-bg">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter zones..."
          className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
        />
        <FilterDropdown
          label="Building"
          selectedValue={selectedBuilding}
          onSelect={setSelectedBuilding}
          options={uniqueBuildings}
        />
        <FilterDropdown
          label="Floor"
          selectedValue={selectedFloor}
          onSelect={setSelectedFloor}
          options={uniqueFloors}
        />
        <FilterDropdown
          label="Pressure"
          selectedValue={selectedPressure}
          onSelect={setSelectedPressure}
          options={uniquePressures}
        />
        <div className="ml-auto flex items-center gap-1">
          <TBtn primary onClick={() => {
            const name = `Z-${String(zones.length + 1).padStart(3, "0")}`;
            const newZone: Zone = {
              id: `zone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
              name,
              building: "Tower A",
              floor: "L01",
              spaceCount: 0,
              area: 0,
              freshAir: 0,
              extractAir: 0,
              pressure: 0,
              equipment: [],
              pressureType: "neutral",
              multiplier: 1,
              faAssignedQty: 1,
              eaAssignedQty: 1,
            };
            addZone(newZone);
          }}><Plus className="size-3.5" /> New Zone</TBtn>
        </div>

        {/* Bulk actions bar overlay for zones */}
        {selectedZones.size > 0 && (
          <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
            <span className="font-semibold">{selectedZones.size} selected</span>
            <span className="text-primary/30">Â·</span>
            <BulkBtn icon={Plus} onClick={() => setAssignZoneEquipOpen(true)}>Assign equipment</BulkBtn>
            <BulkBtn icon={Trash2} onClick={async () => {
              if (await confirm(`Are you sure you want to dissolve the ${selectedZones.size} selected zones?`)) {
                selectedZones.forEach(id => deleteZone(id));
                setSelectedZones(new Set());
              }
            }}>Dissolve Zones</BulkBtn>
            <button onClick={() => setSelectedZones(new Set())} className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded">
              <X className="size-3" /> Clear
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <DataGrid
          rows={rows}
          columns={columns}
          selected={selectedZones}
          onToggle={toggleZone}
          onToggleAll={toggleAllZones}
          renderContextMenu={renderZoneContextMenu}
          onRowDoubleClick={(z) => {
            setSelectedZones(new Set([z.id]));
            setAllocZoneId(z.id);
            setZoneAllocOpen(true);
          }}
          rowClassName={(row, index) => index % 2 === 0 ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80" : "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"}
        />
      </div>

      {opened && (() => {
        const faAssigns: [string, number][] = opened.faAssignments 
          ? Object.entries(opened.faAssignments).map(([id, q]) => [id, Number(q)])
          : opened.faAssignment 
            ? [[opened.faAssignment, opened.faAssignedQty || 1]] 
            : [];
            
        const eaAssigns: [string, number][] = opened.eaAssignments 
          ? Object.entries(opened.eaAssignments).map(([id, q]) => [id, Number(q)])
          : opened.eaAssignment 
            ? [[opened.eaAssignment, opened.eaAssignedQty || 1]] 
            : [];

        const totalFAQty = faAssigns.reduce((sum, [_, q]) => sum + q, 0);
        const totalEAQty = eaAssigns.reduce((sum, [_, q]) => sum + q, 0);
        const remainingFA = Math.max(0, (opened.multiplier || 1) - totalFAQty);
        const remainingEA = Math.max(0, (opened.multiplier || 1) - totalEAQty);

        return (
          <div 
            onClick={() => setOpenId(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/10 dark:bg-black/30 p-4 animate-fade-in"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-white/70 dark:bg-neutral-950/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full max-w-4xl max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <header className="px-6 h-[64px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/10 dark:bg-black/10 select-none">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Spaces in Zone</span>
                  <span className="font-mono font-bold text-primary text-[13px] bg-primary/10 px-2 py-0.5 rounded-lg">{opened.name}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground/60">({openedSpaces.length} spaces)</span>
                  <button 
                    onClick={() => {
                      setEditingZoneId(opened.id);
                      setEditZoneName(opened.name);
                      setEditZoneOpen(true);
                    }}
                    className="text-[11px] text-primary hover:text-primary-strong bg-primary/10 hover:bg-primary/20 px-2.5 py-0.5 rounded-full font-semibold ml-2 transition-colors duration-150 cursor-pointer"
                  >
                    Edit Zone
                  </button>
                </div>
                <button 
                  onClick={() => setOpenId(null)} 
                  className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1 rounded-full hover:bg-surface-3"
                >
                  <X className="size-4" />
                </button>
              </header>

              {/* Equipment Assignments Section */}
              <div className="flex flex-col gap-4 px-6 py-4 border-b border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/10 shrink-0">
                <div className="flex items-center justify-between select-none">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 dark:text-neutral-400">Equipment Assignments:</span>
                  <div className="flex items-center gap-2 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full px-2.5 py-1">
                    <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 select-none">Zone Multiplier:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const currentMult = opened.multiplier || 1;
                          if (currentMult > 1) {
                            const val = currentMult - 1;
                            const updatedZones = zones.map((z) => z.id === opened.id ? { ...z, multiplier: val } : z);
                            updateZones(updatedZones);
                          }
                        }}
                        className="size-4.5 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-white/20 text-foreground transition-all duration-100 cursor-pointer font-bold text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={opened.multiplier || 1}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          const updatedZones = zones.map((z) => z.id === opened.id ? { ...z, multiplier: val } : z);
                          updateZones(updatedZones);
                        }}
                        className="w-7 bg-transparent text-center border-0 outline-none text-foreground font-mono font-bold text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => {
                          const currentMult = opened.multiplier || 1;
                          const val = currentMult + 1;
                          const updatedZones = zones.map((z) => z.id === opened.id ? { ...z, multiplier: val } : z);
                          updateZones(updatedZones);
                        }}
                        className="size-4.5 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-white/20 text-foreground transition-all duration-100 cursor-pointer font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* --- Fresh Air (FA) Assignments --- */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-black/5 pb-1 dark:border-white/5">
                      <span className="text-[11.5px] font-bold text-neutral-700 dark:text-neutral-300">Fresh Air (FA) Stream</span>
                      <span className="text-[10.5px] text-muted-foreground font-mono">Assigned: {totalFAQty}/{opened.multiplier || 1}</span>
                    </div>
                    
                    <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                      {faAssigns.map(([eqId, qty]) => (
                        <div key={eqId} className="flex items-center gap-2 animate-fade-in">
                          <select
                            value={eqId}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              if (!nextVal) {
                                removeZoneFromEquipment(opened.id, eqId, "FA");
                              } else {
                                removeZoneFromEquipment(opened.id, eqId, "FA");
                                assignZoneToEquipment(opened.id, nextVal, "FA", qty);
                              }
                            }}
                            className="flex-1 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground font-semibold cursor-pointer transition-all"
                          >
                            {equipment
                              .filter(e => e.type === "MAHU" || e.type === "Air Handling Unit" || (e.type === "FAHU" && (e.mode === "Fresh Air Only" || e.mode === "Fresh Air + Extract Air")) || e.id === eqId)
                              .map(eq => (
                                <option key={eq.id} value={eq.id}>{eq.tag} ({eq.type})</option>
                              ))}
                          </select>
                          
                          {(opened.multiplier || 1) > 1 && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-muted-foreground">Qty:</span>
                              <input
                                type="number"
                                min={1}
                                max={qty + remainingFA}
                                value={qty}
                                onChange={(e) => {
                                  const val = Math.max(1, Math.min(qty + remainingFA, parseInt(e.target.value) || 1));
                                  assignZoneToEquipment(opened.id, eqId, "FA", val);
                                }}
                                className="w-12 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-1 py-1 text-[11px] text-center outline-none text-foreground font-semibold focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                              />
                            </div>
                          )}
                          
                          <button
                            onClick={() => removeZoneFromEquipment(opened.id, eqId, "FA")}
                            className="text-destructive hover:bg-destructive/10 p-1.5 rounded transition-colors cursor-pointer"
                            title="Remove assignment"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                      
                      {faAssigns.length === 0 && (
                        <div className="text-[11.5px] text-muted-foreground italic py-1">No Fresh Air unit assigned.</div>
                      )}
                    </div>
                    
                    {remainingFA > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              assignZoneToEquipment(opened.id, val, "FA", (opened.multiplier || 1) > 1 ? 1 : remainingFA);
                            }
                          }}
                          className="w-full bg-white/30 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 border border-dashed border-black/20 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all"
                        >
                          <option value="">+ Assign Fresh Air (FA) Unit...</option>
                          {equipment
                            .filter(e => e.type === "MAHU" || e.type === "Air Handling Unit" || (e.type === "FAHU" && (e.mode === "Fresh Air Only" || e.mode === "Fresh Air + Extract Air")))
                            .filter(e => !faAssigns.some(([eqId]) => eqId === e.id))
                            .map(eq => (
                              <option key={eq.id} value={eq.id}>{eq.tag} ({eq.type})</option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                  
                  {/* --- Extract Air (EA) Assignments --- */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-black/5 pb-1 dark:border-white/5">
                      <span className="text-[11.5px] font-bold text-neutral-700 dark:text-neutral-300">Extract Air (EA) Stream</span>
                      <span className="text-[10.5px] text-muted-foreground font-mono">Assigned: {totalEAQty}/{opened.multiplier || 1}</span>
                    </div>
                    
                    <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                      {eaAssigns.map(([eqId, qty]) => (
                        <div key={eqId} className="flex items-center gap-2 animate-fade-in">
                          <select
                            value={eqId}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              if (!nextVal) {
                                removeZoneFromEquipment(opened.id, eqId, "EA");
                              } else {
                                removeZoneFromEquipment(opened.id, eqId, "EA");
                                assignZoneToEquipment(opened.id, nextVal, "EA", qty);
                              }
                            }}
                            className="flex-1 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground font-semibold cursor-pointer transition-all"
                          >
                            {equipment
                              .filter(e => e.type === "Ecology" || (e.type === "FAHU" && (e.mode === "Extract Air Only" || e.mode === "Fresh Air + Extract Air")) || e.id === eqId)
                              .map(eq => (
                                <option key={eq.id} value={eq.id}>{eq.tag} ({eq.type})</option>
                              ))}
                          </select>
                          
                          {(opened.multiplier || 1) > 1 && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-muted-foreground">Qty:</span>
                              <input
                                type="number"
                                min={1}
                                max={qty + remainingEA}
                                value={qty}
                                onChange={(e) => {
                                  const val = Math.max(1, Math.min(qty + remainingEA, parseInt(e.target.value) || 1));
                                  assignZoneToEquipment(opened.id, eqId, "EA", val);
                                }}
                                className="w-12 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-1 py-1 text-[11px] text-center outline-none text-foreground font-semibold focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                              />
                            </div>
                          )}
                          
                          <button
                            onClick={() => removeZoneFromEquipment(opened.id, eqId, "EA")}
                            className="text-destructive hover:bg-destructive/10 p-1.5 rounded transition-colors cursor-pointer"
                            title="Remove assignment"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                      
                      {eaAssigns.length === 0 && (
                        <div className="text-[11.5px] text-muted-foreground italic py-1">No Extract Air unit assigned.</div>
                      )}
                    </div>
                    
                    {remainingEA > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              assignZoneToEquipment(opened.id, val, "EA", (opened.multiplier || 1) > 1 ? 1 : remainingEA);
                            }
                          }}
                          className="w-full bg-white/30 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 border border-dashed border-black/20 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all"
                        >
                          <option value="">+ Assign Extract Air (EA) Unit...</option>
                          {equipment
                            .filter(e => e.type === "Ecology" || (e.type === "FAHU" && (e.mode === "Extract Air Only" || e.mode === "Fresh Air + Extract Air")))
                            .filter(e => !eaAssigns.some(([eqId]) => eqId === e.id))
                            .map(eq => (
                              <option key={eq.id} value={eq.id}>{eq.tag} ({eq.type})</option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Scrollable Spaces Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-header-bg sticky top-0 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50 z-10 select-none">
                    <tr>
                      <th className="px-6 py-3 text-left font-bold">ID</th>
                      <th className="px-6 py-3 text-left font-bold">Name</th>
                      <th className="px-6 py-3 text-left font-bold">Category</th>
                      <th className="px-6 py-3 text-right font-bold">Area (mÂ²)</th>
                      <th className="px-6 py-3 text-right font-bold">Fresh Given</th>
                      <th className="px-6 py-3 text-right font-bold">Extract Taken</th>
                      <th className="px-6 py-3 text-center font-bold w-12">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openedSpaces.map((s) => (
                      <tr 
                        key={s.id} 
                        onDoubleClick={() => setEditingSpace(s)}
                        className="border-b border-border/40 hover:bg-row-hover/50 cursor-pointer select-none text-[12px] transition-colors animate-fade-in"
                      >
                        <td 
                          className="px-6 py-2.5 font-mono text-primary font-bold hover:underline cursor-pointer" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setEditingSpace(s); 
                          }}
                        >
                          {s.code}
                        </td>
                        <td className="px-6 py-2.5 font-semibold text-foreground">
                          <InlineInput
                            value={s.name}
                            onCommit={(val) => bulkUpdateSpaces([s.id], { name: val.trim() || s.name })}
                            className="font-semibold text-[12px]"
                          />
                        </td>
                        <td className="px-6 py-2.5 text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                            <span
                              title={s.aiDetected ? "Automatically identified" : undefined}
                              className={`size-1.5 rounded-full shrink-0 ${s.aiDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`}
                            />
                            <div className="flex items-center gap-1 w-full min-w-0">
                              <CategorySelect
                                value={s.category || ""}
                                onChange={(newVal) => {
                                  if (newVal === "Other" || newVal === "OTHER") {
                                    const latestSpace = workspaceStore.getState().spaces.find(sp => sp.id === s.id) || s;
                                    const categoryName = latestSpace.category && latestSpace.category.endsWith(" (Custom)") ? latestSpace.category : "Custom (Custom)";
                                    bulkUpdateSpaces([s.id], { category: categoryName, aiDetected: false });
                                    setTimeout(() => {
                                      const freshSpace = workspaceStore.getState().spaces.find(sp => sp.id === s.id) || latestSpace;
                                      setCustomParamModalSpace({
                                        ...freshSpace,
                                        category: categoryName,
                                        customWorkflow: freshSpace.customWorkflow || "calculate",
                                        customPeopleOA: freshSpace.customPeopleOA || 0,
                                        customAreaOA: freshSpace.customAreaOA || 0,
                                        customExhaustPerUnit: freshSpace.customExhaustPerUnit || 0,
                                        customExhaustPerArea: freshSpace.customExhaustPerArea || 0,
                                        customAch: freshSpace.customAch || 0,
                                        customFreshGiven: freshSpace.customFreshGiven || 0,
                                        customExtTaken: freshSpace.customExtTaken || 0,
                                      });
                                    }, 50);
                                    return;
                                  }
                                  if (newVal === "Rest Room / Changing Room") {
                                    const latestSpace = workspaceStore.getState().spaces.find(sp => sp.id === s.id) || s;
                                    const spaceCopy = { ...latestSpace, category: newVal, aiDetected: false };
                                    if (!spaceCopy.restroomSubCategories) {
                                      spaceCopy.restroomSubCategories = {
                                        toiletPrivateContinuous: 0,
                                        toiletPublicContinuous: 0,
                                        toiletPrivateDiscontinuous: 0,
                                        toiletPublicDiscontinuous: 0,
                                        showerContinuous: 0,
                                        showerDiscontinuous: 0,
                                        janitorCloset: 0,
                                        lockerRoom: 0,
                                      };
                                    }
                                    const data = getOccupancyData(newVal);
                                    const updates: Partial<Space> = {
                                      category: newVal,
                                      aiDetected: false,
                                      restroomSubCategories: spaceCopy.restroomSubCategories
                                    };
                                    if (data && !latestSpace.isOccupancyCustomized) {
                                      const defaultOcc = (data.exhaustPerUnit > 0 && data.defaultDensity === 0)
                                        ? 1
                                        : Math.ceil((latestSpace.area * data.defaultDensity) / 100);
                                      updates.occupancy = defaultOcc;
                                      updates.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
                                    }
                                    bulkUpdateSpaces([s.id], updates);
                                    setTimeout(() => {
                                      const freshSpace = workspaceStore.getState().spaces.find(sp => sp.id === s.id) || spaceCopy;
                                      setRestroomModalSpace(freshSpace);
                                    }, 50);
                                    return;
                                  }
                                  const data = getOccupancyData(newVal);
                                  const updates: Partial<Space> = {
                                    category: newVal,
                                    aiDetected: false
                                  };
                                  if (data && !s.isOccupancyCustomized) {
                                    const defaultOcc = (data.exhaustPerUnit > 0 && data.defaultDensity === 0)
                                      ? 1
                                      : Math.ceil((s.area * data.defaultDensity) / 100);
                                    updates.occupancy = defaultOcc;
                                    updates.fixtures = data.exhaustPerUnit > 0 ? defaultOcc.toString() : "";
                                  }
                                  bulkUpdateSpaces([s.id], updates);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (s.category === "Rest Room / Changing Room") {
                                    setRestroomModalSpace(s);
                                  } else {
                                    setCustomParamModalSpace({
                                      ...s,
                                      customWorkflow: s.customWorkflow || "calculate",
                                      customPeopleOA: s.customPeopleOA || 0,
                                      customAreaOA: s.customAreaOA || 0,
                                      customExhaustPerUnit: s.customExhaustPerUnit || 0,
                                      customExhaustPerArea: s.customExhaustPerArea || 0,
                                      customAch: s.customAch || 0,
                                      customFreshGiven: s.customFreshGiven || 0,
                                      customExtTaken: s.customExtTaken || 0,
                                    });
                                  }
                                }}
                                className={`flex items-center justify-center p-1 rounded-md hover:bg-surface-2 text-primary hover:text-primary/80 transition-colors shrink-0 cursor-pointer ${
                                  (s.category === "Rest Room / Changing Room" || (s.category && s.category.endsWith(" (Custom)")))
                                    ? "opacity-100"
                                    : "opacity-0 pointer-events-none"
                                }`}
                                title={s.category === "Rest Room / Changing Room" ? "Configure Rest Room subcategories" : "Configure Custom Parameters"}
                              >
                                <Wrench className="size-3.5" />
                              </button>
                            </div>
                          </span>
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono tabular">
                          <InlineInput
                            type="number"
                            step="0.1"
                            min={0}
                            value={s.area}
                            onCommit={(val) => {
                              const num = parseFloat(val);
                              if (!isNaN(num) && num >= 0) {
                                bulkUpdateSpaces([s.id], { area: num });
                              }
                            }}
                            className="font-mono tabular text-[12px] text-center"
                          />
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono font-semibold text-primary tabular-nums">{s.freshAir.toLocaleString()} L/s</td>
                        <td className="px-6 py-2.5 text-right font-mono font-semibold text-pink-600 dark:text-pink-400 tabular-nums">{s.extractAir.toLocaleString()} L/s</td>
                        <td className="px-6 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditingSpace(s)}
                            title="Edit Space Parameters"
                            className="p-1 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Edit3 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Footer */}
              <footer className="px-6 py-4 border-t border-black/5 dark:border-white/5 flex items-center justify-end bg-white/10 dark:bg-black/10 shrink-0">
                <button 
                  onClick={() => setOpenId(null)} 
                  className="bg-primary text-primary-foreground text-xs font-semibold px-5 py-2 rounded-xl hover:bg-primary/95 transition-all duration-150 cursor-pointer shadow-md shadow-primary/10"
                >
                  Close
                </button>
              </footer>
            </div>
          </div>
        );
      })()}
      {/* ─── Shared Assignment Modal ─── */}
      <SharedAssignmentModal
        isOpen={zoneAllocOpen}
        initialEquipmentId={allocEquipId}
        initialZoneId={selectedZones.size > 1 ? null : allocZoneId}
        initialZoneIds={selectedZones.size > 1 ? Array.from(selectedZones) : (allocZoneId ? [] : Array.from(selectedZones))}
        onClose={() => {
          setZoneAllocOpen(false);
          setAllocZoneId(null);
          setAllocEquipId(null);
        }}
      />

      {/* Edit Zone Modal */}
      {editZoneOpen && (() => {
        const zoneObj = zones.find(z => z.id === editingZoneId);
        if (!zoneObj) return null;
        
        const currentSpaces = spaces.filter(s => s.zone === zoneObj.id || s.zone === zoneObj.name);
        const otherSpaces = spaces.filter(s => s.zone !== zoneObj.id && s.zone !== zoneObj.name);
        
        return (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl shadow-lg w-full max-w-2xl animate-scale-in flex flex-col max-h-[85vh]">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-[14px]">Edit Zone: {zoneObj.name}</h3>
                <button onClick={handleCloseEditZone} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </header>
              
              <div className="p-4 flex flex-col gap-4 text-xs overflow-y-auto flex-1">
                {/* Zone Name input */}
                <div className="flex gap-2 items-end shrink-0">
                  <div className="flex-1">
                    <label className="block text-muted-foreground font-medium mb-1">Zone Name</label>
                    <input
                      type="text"
                      value={editZoneName}
                      onChange={(e) => setEditZoneName(e.target.value)}
                      className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none text-foreground font-medium"
                    />
                  </div>
                  <button 
                    onClick={handleRenameZone}
                    className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded hover:bg-primary/95 h-[32px] shrink-0"
                  >
                    Save Name
                  </button>
                </div>
                
                {/* Create blank space button */}
                <div className="flex justify-between items-center border-t border-border pt-3 shrink-0">
                  <span className="font-medium text-muted-foreground">Manage Spaces inside this Zone</span>
                  <button
                    onClick={handleCreateSpaceInZone}
                    className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2 text-foreground font-medium inline-flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    Create Blank Space
                  </button>
                </div>
                
                {/* Two Columns Layout */}
                <div className="grid grid-cols-2 gap-4 flex-1 min-h-[300px]">
                  {/* Left Column: Spaces in this Zone */}
                  <div className="border border-border rounded flex flex-col min-h-0 bg-surface-2">
                    <div className="px-3 py-2 border-b border-border bg-header-bg font-semibold text-foreground flex justify-between items-center shrink-0">
                      <span>Spaces in Zone ({currentSpaces.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
                      {currentSpaces.length === 0 ? (
                        <div className="text-muted-foreground text-center py-8">No spaces in this zone.</div>
                      ) : (
                        currentSpaces.map(s => (
                          <div key={s.id} className="flex justify-between items-center bg-background border border-border rounded p-2">
                            <div>
                              <div className="font-mono text-muted-foreground text-[10.5px]">{s.code}</div>
                              <div className="font-medium text-foreground">{s.name}</div>
                              {s.category && <div className="text-[10px] text-muted-foreground">{s.category}</div>}
                            </div>
                            <button
                              onClick={() => removeSpaceFromEditingZone(s.id)}
                              className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors"
                              title="Remove from Zone"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Right Column: Other Available Spaces */}
                  <div className="border border-border rounded flex flex-col min-h-0 bg-surface-2">
                    <div className="px-3 py-2 border-b border-border bg-header-bg font-semibold text-foreground shrink-0">
                      <span>Other Project Spaces ({otherSpaces.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
                      {otherSpaces.length === 0 ? (
                        <div className="text-muted-foreground text-center py-8">No other spaces available.</div>
                      ) : (
                        otherSpaces.map(s => (
                          <div key={s.id} className="flex justify-between items-center bg-background border border-border rounded p-2">
                            <div>
                              <div className="font-mono text-muted-foreground text-[10.5px]">{s.code}</div>
                              <div className="font-medium text-foreground">{s.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {s.zone && s.zone !== "Default" && s.zone !== "unzoned" ? `Zone: ${s.zone}` : "Unzoned"}
                              </div>
                            </div>
                            <button
                              onClick={() => addSpaceToEditingZone(s.id)}
                              className="text-success hover:bg-success/10 p-1 rounded transition-colors"
                              title="Add to Zone"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <footer className="px-4 py-3 border-t border-border flex items-center justify-end bg-header-bg shrink-0">
                <button 
                  onClick={handleCloseEditZone} 
                  className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95"
                >
                  Close
                </button>
              </footer>
            </div>
          </div>
        );
      })()}

      {/* Edit Space Modal */}
      {editingSpace && (
        <EditSpaceModal
          space={editingSpace}
          onClose={() => setEditingSpace(null)}
          onSave={(updated) => {
            // 1. Check if zone is a new zone name
            let nextZones = [...zones];
            if (updated.zone && updated.zone !== "") {
              const zoneExists = zones.some(
                (z) => z.id.toLowerCase() === updated.zone.toLowerCase() || z.name.toLowerCase() === updated.zone.toLowerCase()
              );
              if (!zoneExists) {
                const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
                const newZone = {
                  id: zoneId,
                  name: updated.zone,
                  building: updated.building || "Tower A",
                  floor: updated.floor || "L01",
                  spaceCount: 0,
                  area: 0,
                  freshAir: 0,
                  extractAir: 0,
                  pressure: 0,
                  equipment: [],
                  pressureType: "neutral" as const,
                  faAssignment: null,
                  eaAssignment: null,
                };
                nextZones.push(newZone);
              }
            }

            // 2. Check if equipment is a new equipment tag
            let nextEquipment = [...equipment];
            if (updated.equipment && updated.equipment !== "") {
              const equipExists = equipment.some(
                (eq) => eq.id.toLowerCase() === updated.equipment.toLowerCase() || eq.tag.toLowerCase() === updated.equipment.toLowerCase()
              );
              if (!equipExists) {
                const equipId = `equip-${Date.now()}`;
                const newEquip = {
                  id: equipId,
                  tag: updated.equipment,
                  type: "Air Handling Unit",
                  zones: 0,
                  spaces: 0,
                  totalAirflow: 0,
                  capacity: 2000,
                  utilization: 0,
                  status: "design" as const,
                  mode: "Fresh Air + Extract Air" as const,
                  zoneIds: [],
                };
                nextEquipment.push(newEquip);
              }
            }

            // 3. Prepare updated spaces list
            let nextSpaces = spaces.map((s) => s.id === updated.id ? updated : s);

            // 4. Multiplier expansion: if updated.multiplier > 1, create clones!
            const mult = parseInt(String(updated.multiplier)) || 1;
            if (mult > 1) {
              const originalUpdated = { ...updated, multiplier: 1 };
              nextSpaces = nextSpaces.map((s) => s.id === updated.id ? originalUpdated : s);
              
              const clones: Space[] = [];
              for (let i = 1; i < mult; i++) {
                const nextNum = Math.floor(Math.random() * 1000);
                clones.push({
                  ...updated,
                  id: `sp-${Date.now()}-${i}-${nextNum}`,
                  code: `${updated.code}-${i}`,
                  name: `${updated.name}-${i}`,
                  multiplier: 1,
                });
              }
              nextSpaces.push(...clones);
            }

            // 5. Balance ventilation airflows and commit state in a single operation
            const balanced = calculateVentilation(nextSpaces, nextZones, nextEquipment);
            setWorkspaceState({
              spaces: balanced.spaces,
              zones: balanced.zones,
              equipment: balanced.equipment,
            });

            setEditingSpace(null);
          }}
          availableZones={zones.map(z => z.name)}
          availableEquipment={equipment.map(e => e.tag)}
          availableFloors={Array.from(new Set(spaces.map((s) => s.floor).filter(Boolean)))}
        />
      )}

      {/* Rest Room / Changing Room Configuration Modal */}
      {restroomModalSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <header className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/30">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                  Rest Room / Changing Room Configuration
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enter the quantity of each sub-category to compute total exhaust.
                </p>
              </div>
              <button
                onClick={() => setRestroomModalSpace(null)}
                className="text-muted-foreground hover:text-foreground rounded p-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {[
                { key: "toiletPrivateContinuous", label: "Toilet - private (continuous)", rate: "12.5 L/s per toilet" },
                { key: "toiletPublicContinuous", label: "Toilet - public (continuous)", rate: "25.0 L/s per toilet" },
                { key: "toiletPrivateDiscontinuous", label: "Toilet - private (discontinuous)", rate: "25.0 L/s per toilet" },
                { key: "toiletPublicDiscontinuous", label: "Toilet - public (discontinuous)", rate: "35.0 L/s per toilet" },
                { key: "showerContinuous", label: "Shower Rooms (continuous)", rate: "10.0 L/s per shower" },
                { key: "showerDiscontinuous", label: "Shower Rooms (discontinuous)", rate: "25.0 L/s per shower" },
                { key: "janitorCloset", label: "Janitor Closets, Trash Rooms, Recycling", rate: `5.0 L/s per m² (${(5.0 * (restroomModalSpace.area || 0)).toFixed(1)} L/s for ${(restroomModalSpace.area || 0)} m² restroom)` },
                { key: "lockerRoom", label: "Locker Rooms", rate: `1.25 L/s per m² (${(1.25 * (restroomModalSpace.area || 0)).toFixed(1)} L/s for ${(restroomModalSpace.area || 0)} m² restroom)` },
              ].map((subcat) => {
                const sub = restroomModalSpace.restroomSubCategories || {};
                const qty = sub[subcat.key] || 0;
                return (
                  <div key={subcat.key} className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-100/60 dark:border-zinc-900/60">
                    <div className="flex flex-col">
                      <span className="text-[12.5px] font-semibold text-slate-700 dark:text-zinc-300">
                        {subcat.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {subcat.rate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={qty}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setRestroomModalSpace((prev) => {
                            if (!prev) return null;
                            const sub = prev.restroomSubCategories || {};
                            return {
                              ...prev,
                              restroomSubCategories: {
                                ...sub,
                                [subcat.key]: val
                              }
                            };
                          });
                        }}
                        className="w-20 h-9 px-2 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[13px] font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-neutral-800 dark:text-neutral-200"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 bg-slate-50/50 dark:bg-zinc-900/30 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Exhaust
                </span>
                <span className="text-[15px] font-black text-primary">
                  {(() => {
                    const sub = restroomModalSpace.restroomSubCategories || {};
                    const areaVal = restroomModalSpace.area || 0;
                    let total = 0;
                    total += (sub.toiletPrivateContinuous || 0) * 12.5;
                    total += (sub.toiletPublicContinuous || 0) * 25.0;
                    total += (sub.toiletPrivateDiscontinuous || 0) * 25.0;
                    total += (sub.toiletPublicDiscontinuous || 0) * 35.0;
                    total += (sub.showerContinuous || 0) * 10.0;
                    total += (sub.showerDiscontinuous || 0) * 25.0;
                    total += (sub.janitorCloset || 0) * areaVal * 5.0;
                    total += (sub.lockerRoom || 0) * areaVal * 1.25;
                    return total;
                  })()}{" "}
                  L/s
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updatedSpaces = spaces.map(s => s.id === restroomModalSpace.id ? restroomModalSpace : s);
                  updateSpaces(updatedSpaces);
                  setRestroomModalSpace(null);
                }}
                className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 transition cursor-pointer"
              >
                Apply &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Category Modal for "OTHER" */}
      {customParamModalSpace && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md animate-scale-in">
            <header className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="font-semibold text-[14px]">Configure Custom Parameters</h3>
              </div>
              <button 
                onClick={() => setCustomParamModalSpace(null)} 
                className="text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded p-0.5"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="p-4 flex flex-col gap-4 text-xs">
              <div>
                <div className="text-muted-foreground mb-2 leading-relaxed">
                  Define custom calculation parameters for the category of space <span className="font-semibold text-foreground">"{customParamModalSpace.name}"</span>.
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Custom Category Name</label>
                <input
                  type="text"
                  value={customParamModalSpace.category}
                  onChange={(e) => setCustomParamModalSpace({ ...customParamModalSpace, category: e.target.value })}
                  placeholder="e.g. Custom (Custom)"
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Workflow Method</label>
                <select
                  value={customParamModalSpace.customWorkflow || "calculate"}
                  onChange={(e) => setCustomParamModalSpace({ 
                    ...customParamModalSpace, 
                    customWorkflow: e.target.value as "calculate" | "direct" 
                  })}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer text-foreground"
                >
                  <option value="calculate">Calculate Airflow Rates</option>
                  <option value="direct">Direct Airflow Values</option>
                </select>
              </div>

              {customParamModalSpace.customWorkflow === "direct" ? (
                <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Outdoor Air (Fresh) Given (L/s)</label>
                    <input
                      type="number"
                      step="any"
                      value={customParamModalSpace.customFreshGiven ?? ""}
                      onChange={(e) => setCustomParamModalSpace({ 
                        ...customParamModalSpace, 
                        customFreshGiven: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                      })}
                      className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Extract Air Taken (L/s)</label>
                    <input
                      type="number"
                      step="any"
                      value={customParamModalSpace.customExtTaken ?? ""}
                      onChange={(e) => setCustomParamModalSpace({ 
                        ...customParamModalSpace, 
                        customExtTaken: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                      })}
                      className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">People OA (L/s/person)</label>
                      <input
                        type="number"
                        step="any"
                        value={customParamModalSpace.customPeopleOA ?? ""}
                        onChange={(e) => setCustomParamModalSpace({ 
                          ...customParamModalSpace, 
                          customPeopleOA: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                        })}
                        className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">Area OA (L/s/mÂ²)</label>
                      <input
                        type="number"
                        step="any"
                        value={customParamModalSpace.customAreaOA ?? ""}
                        onChange={(e) => setCustomParamModalSpace({ 
                          ...customParamModalSpace, 
                          customAreaOA: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                        })}
                        className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">ACH</label>
                      <input
                        type="number"
                        step="any"
                        value={customParamModalSpace.customAch ?? ""}
                        onChange={(e) => setCustomParamModalSpace({ 
                          ...customParamModalSpace, 
                          customAch: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                        })}
                        className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">Exh / Area (L/s/mÂ²)</label>
                      <input
                        type="number"
                        step="any"
                        value={customParamModalSpace.customExhaustPerArea ?? ""}
                        onChange={(e) => setCustomParamModalSpace({ 
                          ...customParamModalSpace, 
                          customExhaustPerArea: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                        })}
                        className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">Exh / Unit (L/s/unit)</label>
                      <input
                        type="number"
                        step="any"
                        value={customParamModalSpace.customExhaustPerUnit ?? ""}
                        onChange={(e) => setCustomParamModalSpace({ 
                          ...customParamModalSpace, 
                          customExhaustPerUnit: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 
                        })}
                        className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
              <button 
                onClick={() => setCustomParamModalSpace(null)} 
                className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  let catName = customParamModalSpace.category.trim();
                  if (!catName) {
                    catName = "Custom (Custom)";
                  } else if (!catName.endsWith(" (Custom)")) {
                    catName = `${catName} (Custom)`;
                  }

                  const finalSpaceUpdate: Space = {
                    ...customParamModalSpace,
                    category: catName,
                  };

                  updateSpaces([finalSpaceUpdate]);
                  setCustomParamModalSpace(null);
                }} 
                className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 shadow-sm"
              >
                Save Parameters
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Equipment ─────────── */
function EquipmentView() {
  const [query, setQuery] = useState("");
  const { spaces, zones, equipment, updateEquipment, deleteEquipment, setWorkspaceState, undo, redo } = useWorkspace();
  const confirm = useConfirm();

  const [sizerOpen, setSizerOpen] = useState(false);
  const [sizerEquipId, setSizerEquipId] = useState<string | null>(null);
  const [sizerShowAdd, setSizerShowAdd] = useState(false);
  const onOpenSizer = (equipId: string) => { setSizerEquipId(equipId); setSizerShowAdd(false); setSizerOpen(true); };

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedEquips, setSelectedEquips] = useState<Set<string>>(new Set());
  const [lastClickedEquipIndex, setLastClickedEquipIndex] = useState<number | null>(null);

  const toggleEquipment = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelectedEquips((prev) => {
      const clickedIndex = rows.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift && lastClickedEquipIndex !== null) {
        const start = Math.min(lastClickedEquipIndex, clickedIndex);
        const end = Math.max(lastClickedEquipIndex, clickedIndex);
        
        if (!isCtrl) {
          next.clear();
        }

        const shouldSelect = prev.has(rows[lastClickedEquipIndex]?.id || "") || true;

        for (let i = start; i <= end; i++) {
          const rId = rows[i]?.id;
          if (rId) {
            if (shouldSelect) {
              next.add(rId);
            } else {
              next.delete(rId);
            }
          }
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedEquipIndex(clickedIndex);
      } else {
        if (prev.has(id)) {
          next.delete(id);
          setLastClickedEquipIndex(null);
        } else {
          next.clear();
          next.add(id);
          setLastClickedEquipIndex(clickedIndex);
        }
      }
      return next;
    });
  };

  const getAirType = (type: string) => {
    const t = type.toLowerCase();
    if (t === "fahu") return "Fresh Air";
    if (t === "ecology" || t === "ecology unit") return "Extract Air";
    return "Fresh and Extract Air";
  };

  const columns: Column<Equipment>[] = [
    { key: "tag", header: "Equipment", width: 220, render: (r) => (
      <span className="font-semibold text-foreground text-[13px]">{r.tag}</span>
    ) },
    { key: "type", header: "Type", width: 140, render: (r) => (
      <span className="text-muted-foreground text-[12.5px]">{r.type}</span>
    ) },
    { key: "airType", header: "Air Type", width: 200, render: (r) => (
      <span className="text-muted-foreground text-[12.5px]">{getAirType(r.type)}</span>
    ) },
    { key: "zones", header: "Zones", width: 100, align: "center", render: (r) => (
      <span className="font-mono text-[12.5px]">{r.zones}</span>
    ) },
    { key: "spaces", header: "Spaces", width: 100, align: "center", render: (r) => (
      <span className="font-mono text-[12.5px]">{r.spaces}</span>
    ) },
    { key: "totalFA", header: "Fresh Load (L/s)", width: 150, align: "center", render: (r) => (
      <span className="font-mono text-[12.5px]">{(r.totalFA || 0).toLocaleString()}</span>
    ) },
    { key: "totalEA", header: "Extract Load (L/s)", width: 150, align: "center", render: (r) => (
      <span className="font-mono text-[12.5px]">{(r.totalEA || 0).toLocaleString()}</span>
    ) },
  ];

  const toggleAllEquipment = () => {
    setSelectedEquips((prev) => {
      if (prev.size === rows.length) {
        return new Set();
      } else {
        return new Set(rows.map((r) => r.id));
      }
    });
  };



  const uniqueTypes = useMemo(() => {
    const vals = new Set<string>();
    equipment.forEach((e) => {
      if (e.type) vals.add(e.type);
    });
    return Array.from(vals).sort();
  }, [equipment]);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return equipment.filter((e) => {
      if (selectedType && e.type !== selectedType) return false;
      return !q || `${e.tag} ${e.type}`.toLowerCase().includes(q);
    });
  }, [equipment, query, selectedType]);





  const handleBulkDeleteEquipment = async () => {
    const ok = await confirm(
      `Are you sure you want to delete the ${selectedEquips.size} selected equipment units?`,
      {
        title: "Delete Multiple Equipment",
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );
    if (!ok) return;

    let nextEquip = [...equipment];
    let nextZones = [...zones];
    
    selectedEquips.forEach(eqId => {
      nextEquip = nextEquip.filter(e => e.id !== eqId);
      nextZones = nextZones.map(g => {
        const FA = g.faAssignments ? { ...g.faAssignments } : {};
        const EA = g.eaAssignments ? { ...g.eaAssignments } : {};
        delete FA[eqId];
        delete EA[eqId];
        const faKeys = Object.keys(FA);
        const firstFA = faKeys[0] || null;
        const eaKeys = Object.keys(EA);
        const firstEA = eaKeys[0] || null;

        return {
          ...g,
          faAssignments: FA,
          faAssignment: firstFA,
          faAssignedQty: firstFA ? FA[firstFA] : 1,
          eaAssignments: EA,
          eaAssignment: firstEA,
          eaAssignedQty: firstEA ? EA[firstEA] : 1,
        };
      });
    });

    const balanced = calculateVentilation(spaces, nextZones, nextEquip);
    setWorkspaceState({
      spaces: balanced.spaces,
      zones: balanced.zones,
      equipment: balanced.equipment,
    });
    setSelectedEquips(new Set());
  };

  const handleEquipmentDoubleClicked = (e: Equipment) => {
    onOpenSizer(e.id);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditing = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.getAttribute("contenteditable") === "true"
      );
      if (isEditing) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Escape: Clear selection and close modals
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedEquips(new Set());
        setSizerOpen(false);
        setSizerEquipId(null);
        return;
      }

      // Ctrl+A: Select all equipment
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (rows.length > 0) {
          setSelectedEquips(new Set(rows.map((r) => r.id)));
        }
        return;
      }

      // Delete/Backspace: delete selected equipment
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEquips.size > 0) {
          e.preventDefault();
          handleBulkDeleteEquipment();
        }
        return;
      }

      // Ctrl+Z / Ctrl+Y: Undo / Redo
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        redo();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedEquips, rows, undo, redo]);

  const renderEquipmentContextMenu = (e: Equipment) => (
    <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
      <ContextMenuItem
        onClick={() => onOpenSizer(e.id)}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
      >
        <Wrench className="size-3.5" />
        <span>Manage Assignments</span>
      </ContextMenuItem>
      <ContextMenuSeparator className="h-px bg-border my-1" />
      <ContextMenuItem
        onClick={async () => {
          const ok = await confirm(
            `Are you sure you want to delete equipment "${e.tag}"?`,
            {
              title: "Delete Equipment",
              confirmText: "Delete",
              cancelText: "Cancel",
            }
          );
          if (ok) {
            deleteEquipment(e.id);
          }
        }}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
      >
        <Trash2 className="size-3.5" />
        <span>Delete Equipment</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <div className="flex flex-col h-full select-none">
      <div className="relative flex items-center gap-1 px-3 h-10 shrink-0 bg-background no-print modal-blur-bg">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter equipment..."
          className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
        />
        <FilterDropdown
          label="Type"
          selectedValue={selectedType}
          onSelect={setSelectedType}
          options={uniqueTypes}
        />
        <div className="ml-auto flex items-center gap-1">
          {selectedEquips.size === 1 && (
            <TBtn
              onClick={() => {
                const firstId = Array.from(selectedEquips)[0];
                if (firstId) onOpenSizer(firstId);
              }}
            >
              <Wrench className="size-3.5" /> Assign
            </TBtn>
          )}

          <TBtn primary onClick={() => {
            setSizerEquipId(null);
            setSizerShowAdd(true);
            setSizerOpen(true);
          }}><Plus className="size-3.5" /> New Equipment</TBtn>
        </div>

        {/* Bulk actions bar overlay for equipment */}
        {selectedEquips.size > 0 && (
          <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
            <span className="font-semibold">{selectedEquips.size} selected</span>
            <span className="text-primary/30">·</span>
            {selectedEquips.size === 1 && (
              <BulkBtn icon={Wrench} onClick={() => {
                const firstId = Array.from(selectedEquips)[0];
                if (firstId) onOpenSizer(firstId);
              }}>Assign</BulkBtn>
            )}
            <BulkBtn icon={Trash2} onClick={handleBulkDeleteEquipment}>Delete</BulkBtn>
            <button onClick={() => setSelectedEquips(new Set())} className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded">
              <X className="size-3" /> Clear
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <DataGrid
          rows={rows}
          columns={columns}
          selected={selectedEquips}
          onToggle={toggleEquipment}
          onToggleAll={toggleAllEquipment}
          renderContextMenu={renderEquipmentContextMenu}
          onRowDoubleClick={handleEquipmentDoubleClicked}
          rowClassName={(row, index) => index % 2 === 0 ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80" : "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"}
        />
      </div>
      <SharedAssignmentModal
        isOpen={sizerOpen}
        initialEquipmentId={sizerEquipId}
        initialZoneId={null}
        initialZoneIds={[]}
        initialShowAddEquip={sizerShowAdd}
        onClose={() => {
          setSizerOpen(false);
          setSizerEquipId(null);
          setSizerShowAdd(false);
        }}
      />
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ Report â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ReportView() {
  const { spaces, zones, equipment } = useWorkspace();

  const totalFresh = spaces.reduce((a, s) => a + (s.freshAir || 0), 0);
  const totalExtract = spaces.reduce((a, s) => a + (s.extractAir || 0), 0);
  const totalArea = spaces.reduce((a, s) => a + (s.area || 0) * (s.multiplier || 1), 0);
  const balance = totalFresh - totalExtract;
  const warningsCount = spaces.filter((s) => s.status === "warning").length;
  const compliance = spaces.length > 0 ? Math.round(((spaces.length - warningsCount) / spaces.length) * 100) : 100;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50">
        <span className="text-[12px] text-muted-foreground font-semibold">Generated: <span className="text-foreground font-mono">{new Date().toLocaleDateString()}</span></span>
        <div className="ml-auto flex items-center gap-1.5">
          <TBtn><Printer className="size-3.5" /> Print</TBtn>
          <TBtn><FileSpreadsheet className="size-3.5" /> Excel</TBtn>
          <TBtn primary><FileText className="size-3.5" /> Export PDF</TBtn>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 bg-slate-50/30 dark:bg-zinc-950/20">
        <div className="max-w-4xl mx-auto space-y-6">
          <ReportSection title="Project Summary">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <KPI label="Spaces" value={spaces.length.toLocaleString()} />
              <KPI label="Zones" value={zones.length} />
              <KPI label="Equipment" value={equipment.length} />
              <KPI label="Total Area" value={`${totalArea.toFixed(0)} m²`} />
            </div>
          </ReportSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReportSection title="Fresh Air Totals">
              <div className="bg-surface-2 dark:bg-zinc-800/40 p-4 rounded-2xl border border-border/80 space-y-1">
                <KVRow k="Required (min)" v={`${spaces.reduce((a, s) => a + (s.minOA || 0), 0).toLocaleString()} L/s`} />
                <KVRow k="Supplied" v={`${totalFresh.toLocaleString()} L/s`} tone="primary" />
                <KVRow k="Surplus" v={`+${(totalFresh - spaces.reduce((a, s) => a + (s.minOA || 0), 0)).toLocaleString()} L/s`} tone="success" />
              </div>
            </ReportSection>
            <ReportSection title="Extract Air Totals">
              <div className="bg-surface-2 dark:bg-zinc-800/40 p-4 rounded-2xl border border-border/80 space-y-1">
                <KVRow k="Required (min)" v={`${spaces.reduce((a, s) => a + (s.minExt || 0), 0).toLocaleString()} L/s`} />
                <KVRow k="Extracted" v={`${totalExtract.toLocaleString()} L/s`} tone="primary" />
                <KVRow k="Surplus" v={`+${(totalExtract - spaces.reduce((a, s) => a + (s.minExt || 0), 0)).toLocaleString()} L/s`} tone="success" />
              </div>
            </ReportSection>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReportSection title="Pressure Balance Summary">
              <div className="bg-surface-2 dark:bg-zinc-800/40 p-4 rounded-2xl border border-border/80 space-y-1">
                <KVRow k="Net Balance" v={`${balance > 0 ? "+" : ""}${balance.toLocaleString()} L/s`} tone={Math.abs(balance) < 500 ? "success" : "warning"} />
                <KVRow k="Positive Zones" v={zones.filter((z) => z.pressureType === "positive").length} />
                <KVRow k="Negative Zones" v={zones.filter((z) => z.pressureType === "negative").length} />
                <KVRow k="Neutral Zones" v={zones.filter((z) => z.pressureType === "neutral").length} />
              </div>
            </ReportSection>

            <ReportSection title="ASHRAE 62.1 Compliance">
              <div className="bg-surface-2 dark:bg-zinc-800/40 p-5 rounded-2xl border border-border/80 flex flex-col justify-center h-full min-h-[155px]">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[13px] font-semibold text-foreground">Compliance Rating</span>
                  <span className="font-mono tabular text-[18px] font-extrabold text-primary">{compliance}%</span>
                </div>
                <div className="w-full h-3 bg-[#e2e8f0] dark:bg-zinc-700 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-success transition-all duration-500 rounded-full" style={{ width: `${compliance}%` }} />
                </div>
                <div className="text-[12px] text-muted-foreground mt-3 font-medium">
                  {spaces.length - warningsCount} compliant spaces · {warningsCount} require attention
                </div>
              </div>
            </ReportSection>
          </div>

          <ReportSection title="Equipment Summary">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <KPI label="Operational" value={zones.length} />
              <KPI label="Warnings" value={equipment.filter((e) => e.status === "warning").length} />
              <KPI label="Avg Utilization" value={`${equipment.length > 0 ? Math.round(equipment.reduce((a, e) => a + e.utilization, 0) / equipment.length) : 0}%`} />
            </div>
          </ReportSection>
        </div>
      </div>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border/80 rounded-3xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
      <header className="px-5 h-11 flex items-center border-b border-border/50 bg-card shrink-0">
        <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500 dark:text-zinc-400">{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function KPI({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-surface-2 dark:bg-zinc-800/40 px-4 py-3.5 rounded-2xl border border-border/80 shadow-xs flex flex-col justify-between">
      <div className="text-[9.5px] uppercase tracking-wider font-extrabold text-muted-foreground">{label}</div>
      <div className="font-mono tabular text-[20px] font-bold mt-1 text-foreground">{value}</div>
    </div>
  );
}

function KVRow({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "primary" | "success" | "warning" }) {
  const color = tone === "success" ? "text-success font-semibold" : tone === "warning" ? "text-warning font-semibold" : tone === "primary" ? "text-primary font-semibold" : "text-foreground";
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0 text-[12.5px]">
      <span className="text-muted-foreground font-medium">{k}</span>
      <span className={`font-mono tabular ${color}`}>{v}</span>
    </div>
  );
}

/* ──────────────────── Intelligence Drawer ───────────────────── */
interface CollapsibleMissingSectionProps {
  label: string;
  count: number;
  itemsList: { id: string; name: string; detail: string }[];
  isOpen: boolean;
  onToggle: () => void;
}

function CollapsibleMissingSection({ label, count, itemsList, isOpen, onToggle, onItemClick }: { label: string; count: number; itemsList: { id: string; name: string; detail: string }[]; isOpen: boolean; onToggle: () => void; onItemClick: (id: string) => void }) {
  return (
    <div className="border-b border-border/40 last:border-b-0 py-1.5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[12.5px] font-medium text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none py-0.5"
      >
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          {isOpen ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
        </span>
        <span className="font-mono tabular font-semibold text-foreground/80">{count}</span>
      </button>
      
      {isOpen && count > 0 && (
        <div className="mt-1.5 max-h-36 overflow-y-auto border border-border/60 rounded-md bg-surface-2 divide-y divide-border/40 font-mono text-[10.5px] text-muted-foreground custom-scrollbar">
          {itemsList.map((item) => {
            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item.id)}
                className="block w-full px-2.5 py-1.5 hover:bg-surface-3 transition-colors text-left cursor-pointer select-none"
              >
                <div className="text-[11.5px] leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis block">
                  <span className="font-sans font-medium text-foreground/80 hover:text-primary transition-colors">
                    {item.name}
                  </span>
                  <span className="text-muted-foreground/50 text-[10px] font-mono ml-1.5">
                    ({item.detail})
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IntelligenceDrawer({ onClose, setTab }: { onClose: () => void; setTab: (t: "spaces" | "zones" | "equipment" | "report") => void }) {
  const { spaces, zones, equipment } = useWorkspace();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    unassigned: false,
    unzoned: false,
    noCategory: false,
    missingArea: false
  });

  const totalFresh = spaces.reduce((a, s) => a + (s.freshAir || 0), 0);
  const totalExtract = spaces.reduce((a, s) => a + (s.extractAir || 0), 0);
  const balance = totalFresh - totalExtract;
  const warnings = spaces.filter((s) => s.flagged).length;
  const nonCompliantCount = spaces.filter((s) => s.flagged || s.status === "warning").length;
  const draft = spaces.filter((s) => s.status === "draft").length;
  const negZones = zones.filter((z) => z.pressureType === "negative").length;

  const unassignedZones = zones.filter(z => {
    const hasEquipment = z.equipment && z.equipment.length > 0;
    const hasFA = z.faAssignment || (z.faAssignments && Object.keys(z.faAssignments).length > 0);
    const hasEA = z.eaAssignment || (z.eaAssignments && Object.keys(z.eaAssignments).length > 0);
    return !hasEquipment && !hasFA && !hasEA;
  });
  const unassignedItems = unassignedZones.map(z => ({
    id: z.id,
    name: z.name,
    detail: z.floor || "L01"
  }));

  const unzonedSpaces = spaces.filter(s => {
    const z = (s.zone || "").trim().toLowerCase();
    return !z || z === "" || z === "default" || z === "unzoned";
  });
  const unzonedItems = unzonedSpaces.map(s => {
    const hasCategory = s.category && s.category.trim() !== "" && !s.category.toLowerCase().includes("select category");
    return {
      id: s.id,
      name: hasCategory ? `${s.name} + ${s.category}` : s.name,
      detail: s.floor || "L01"
    };
  });

  const noCategorySpaces = spaces.filter(s => {
    const c = (s.category || "").trim().toLowerCase();
    return !c || c === "" || c === "select category" || c.includes("select category");
  });
  const noCategoryItems = noCategorySpaces.map(s => ({
    id: s.id,
    name: s.name,
    detail: s.floor || "L01"
  }));

  const missingAreaSpaces = spaces.filter(s => {
    const areaVal = parseFloat(String(s.area));
    return !s.area || isNaN(areaVal) || areaVal === 0;
  });
  const missingAreaItems = missingAreaSpaces.map(s => ({
    id: s.id,
    name: s.name,
    detail: s.floor || "L01"
  }));

  const handleItemClick = (id: string, isZone: boolean) => {
    setTab(isZone ? "zones" : "spaces");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("mep-scroll-to-item", { detail: { id } }));
    }, 100);
  };

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button onClick={onClose} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </header>
      <div className="flex-1 overflow-auto">
        <IntelSection icon={CheckCircle2} tone="success" title="Compliance Status">
          <div className="text-[12px] text-muted-foreground">ASHRAE 62.1 validation across {spaces.length.toLocaleString()} spaces.</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-success" style={{ width: `${spaces.length > 0 ? Math.round(((spaces.length - nonCompliantCount) / spaces.length) * 100) : 100}%` }} />
            </div>
            <span className="font-mono tabular text-[11.5px]">{spaces.length > 0 ? Math.round(((spaces.length - nonCompliantCount) / spaces.length) * 100) : 100}%</span>
          </div>
        </IntelSection>

        <IntelSection icon={Gauge} tone={Math.abs(balance) < 500 ? "success" : "warning"} title="Pressure Warnings">
          <KV k="Project balance" v={`${balance > 0 ? "+" : ""}${balance.toLocaleString()} L/s`} />
          <KV k="Negative zones" v={negZones} />
        </IntelSection>

        <IntelSection icon={AlertTriangle} tone={warnings > 0 ? "warning" : "muted"} title="Calculation Issues">
          <KV k="Spaces flagged" v={warnings} />
          <KV k="Draft spaces" v={draft} />
        </IntelSection>

        <IntelSection icon={Info} tone="muted" title="Missing Data">
          <CollapsibleMissingSection
            label="Unassigned equipment"
            count={unassignedItems.length}
            itemsList={unassignedItems}
            isOpen={openSections.unassigned}
            onToggle={() => setOpenSections(prev => ({ ...prev, unassigned: !prev.unassigned }))}
            onItemClick={(id) => handleItemClick(id, true)}
          />
          <CollapsibleMissingSection
            label="Unzoned spaces"
            count={unzonedItems.length}
            itemsList={unzonedItems}
            isOpen={openSections.unzoned}
            onToggle={() => setOpenSections(prev => ({ ...prev, unzoned: !prev.unzoned }))}
            onItemClick={(id) => handleItemClick(id, false)}
          />
          <CollapsibleMissingSection
            label="Spaces without Category"
            count={noCategoryItems.length}
            itemsList={noCategoryItems}
            isOpen={openSections.noCategory}
            onToggle={() => setOpenSections(prev => ({ ...prev, noCategory: !prev.noCategory }))}
            onItemClick={(id) => handleItemClick(id, false)}
          />
          <CollapsibleMissingSection
            label="Missing Area"
            count={missingAreaItems.length}
            itemsList={missingAreaItems}
            isOpen={openSections.missingArea}
            onToggle={() => setOpenSections(prev => ({ ...prev, missingArea: !prev.missingArea }))}
            onItemClick={(id) => handleItemClick(id, false)}
          />
        </IntelSection>

        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Reduce AHU-12 setpoint by 8% to recover 1,200 L/s headroom.</li>
            <li>Re-zone L09 corridors to balance negative pressure cluster.</li>
            <li>Consolidate 3 underutilized exhaust fans on Tower B.</li>
          </ul>
        </IntelSection>

        <IntelSection icon={Info} tone="muted" title="Engineering Notes">
          <div className="text-[12px] text-muted-foreground">No outstanding reviewer notes. Last validated 2h ago.</div>
        </IntelSection>
      </div>
    </div>
  );
}

function IntelSection({ icon: Icon, title, tone, children }: { icon: any; title: string; tone: "success" | "warning" | "primary" | "muted"; children: React.ReactNode }) {
  const color =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <section className="px-3 py-3 border-b border-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-3.5 ${color}`} />
        <h4 className="text-[11px] uppercase tracking-wider font-semibold">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px] py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular font-medium">{v}</span>
    </div>
  );
}
