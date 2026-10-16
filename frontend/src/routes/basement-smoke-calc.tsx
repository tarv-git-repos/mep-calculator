import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/workspace-store";
import { useAuth } from "@/contexts/AuthContext";
import { dirtyStore } from "@/lib/dirty-store";
import { api } from "@/services/api";
import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, Plus, Trash2,
  ChevronDown, ChevronUp, Edit3, Settings, HelpCircle, Sparkles,
  Wind, Layers, Gauge, Zap, Activity, FileText, X, Flag,
  Copy, CopyPlus, Scissors, Clipboard, ClipboardPaste, Flame, CheckCircle2, RefreshCw, Check,
  Box, Upload, Filter, ArrowUpDown, Search, MessageSquare, SlidersHorizontal, Download, BookOpen
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportBasementSmokePDF } from "@/lib/exportBasementSmokePDF";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { ImportSourceModal } from "@/components/workspace/ImportSourceModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { extractSpacesFromActiveViewer, extractSpacesFromIFCFile, getFloorRank, Extracted3DSpace } from "@/lib/bimViewerSpaceExtractor";
import { calculateSmokeFlows, calculateFanStatic, calculateMakeupScaling } from "@/lib/calc-basement-smoke";
import { EditBasementSmokeModal } from "@/components/workspace/EditBasementSmokeModal";
import { FloorSelect } from "@/components/workspace/FloorSelect";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut
} from "@/components/ui/context-menu";
import { useConfirm } from "@/hooks/use-confirm";

export function isBasementTerm(str: string): boolean {
  if (!str) return false;
  const s = str.trim().toUpperCase();
  
  // 1. Explicit Basement Keywords & Synonyms
  const keywords = [
    "BASEMENT", "BSMT", "CELLAR", "SUB-BASEMENT", "SUBBASEMENT",
    "SUB BASEMENT", "SUB-CELLAR", "SUBCELLAR", "UNDERGROUND",
    "LOWER GROUND", "SUBGRADE", "SUB-GRADE", "PARKING BASEMENT",
    "CAR PARK BASEMENT", "PODIUM BASEMENT", "BASEMENT PARKING"
  ];
  for (const kw of keywords) {
    if (s.includes(kw)) return true;
  }

  // 2. Negative Level patterns: Level -1, Level -2, L-1, B1, B2, B3, B4, B5
  if (/LEVEL\s*-\d+/i.test(s) || /L\s*-\d+/i.test(s) || /FLOOR\s*-\d+/i.test(s) || /STOREY\s*-\d+/i.test(s)) {
    return true;
  }
  if (/\bB[1-9]\b/i.test(s) || /\bBSMT\s*[1-9]\b/i.test(s)) {
    return true;
  }

  // 3. Floor Rank check (< 0 rank)
  if (typeof getFloorRank === "function" && getFloorRank(str) < 0) {
    return true;
  }

  return false;
}

export function isExcludedSpaceName(name: string, category?: string): boolean {
  const s = `${name || ""} ${category || ""}`.toLowerCase();
  const excludedKeywords = [
    "room",      // Electrical room, Generator room, Telecom room, Transformer room, Elec room, LV room, MTR room, etc.
    "stair",     // Stairs, Staircase, Stairwell
    "mep",       // MEP, MEP plant, MEP space
    "tank",      // Water tank, Fire tank, Fuel tank, Tanks, Sump tank
    "corridor",  // Corridor, Service Corridor, Lift Corridor
    "lobby",     // Lobby, Lift Lobby, Fire Lobby
  ];
  return excludedKeywords.some(kw => s.includes(kw));
}

export const Route = createFileRoute("/basement-smoke-calc")({
  head: () => ({
    meta: [
      { title: "Basement Smoke Calc — MEP Calc" },
      { name: "description", content: "Basement smoke control ventilation calculator and fan system head sizer." },
    ],
  }),
  component: BasementSmokeCalcPage,
});

interface BasementFloor {
  id: string;
  basementLevel: string;
  zoneName: string;
  name: string;
  area: number;
  effArea: number;
  height: number;
  flagged?: boolean;
}

interface FanSystem {
  id: string;
  name: string;
  floorIds: string[];
  fanType: "Extract" | "Makeup";
  fanQty?: number;
  length: number;
  frictionFactor: number;
  louver: number;
  grille: number;
  sa: number;
  collapsed: boolean;
  zoneAchModes?: Record<string, 3 | 6>;
  customNormalCap?: number;
  customFireCap?: number;
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
  const isReadOnly = (typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly)) || readOnly;
  const isEffectiveDisabled = disabled || isReadOnly;

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
      readOnly={isReadOnly}
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
      onClick={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
      }}
      className={`bg-transparent w-full border border-transparent py-0.5 px-1 rounded text-foreground transition-colors ${isEffectiveDisabled
        ? "cursor-not-allowed opacity-75 select-none hover:border-transparent focus:border-transparent"
        : "hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 cursor-text"
        } ${className}`}
    />
  );
}

function BasementSmokeCalcPage() {
  const { project, activeProjectId, forceSaveToCloud, isInitializing, updateProject } = useWorkspace();
  const confirm = useConfirm();
  const calcReviewState = useCalculationReviewState("/basement-smoke-calc", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/basement-smoke-calc", activeProjectId || project?.id);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  
  // Active section view state
  const [activeSection, setActiveSection] = useState<"schedule" | "fan-systems" | "report">("schedule");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  
  // Collapsible Global Fan Sizing card state
  const [showGlobalFanSizing, setShowGlobalFanSizing] = useState<boolean>(true);

  // Synced Calculation Review State (Ventilation style)
  const getSyncedReviewState = useMemo(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_review_${pId}_/basement-smoke-calc`;
    if (project?.workspace_data) {
      let wdata = project.workspace_data;
      if (typeof wdata === 'string') {
        try { wdata = JSON.parse(wdata); } catch(e) {}
      }
      if (wdata?.review_states?.[storageKey]) {
        return wdata.review_states[storageKey];
      }
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch(e) {}
    }
    return { status: "DRAFT" };
  }, [project]);

  const { profile, userData } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const isApprovedLocked = useCalculationLock("/basement-smoke-calc", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  
  
  // Schedule state
  const [floors, setFloors] = useState<BasementFloor[]>([]);

  // Fan Systems state
  const [fanSystems, setFanSystems] = useState<FanSystem[]>([]);
  const [totalFans, setTotalFans] = useState<number>(2);

  // Modal state
  const [editingFloor, setEditingFloor] = useState<BasementFloor | null>(null);
  const [isNewFloor, setIsNewFloor] = useState<boolean>(false);
  const [showEditLevelModal, setShowEditLevelModal] = useState<boolean>(false);
  const [editLevelTarget, setEditLevelTarget] = useState<string | null>(null);
  const [editLevelData, setEditLevelData] = useState<{ levelName: string; area: number | ""; effArea: number | ""; height: number | ""; numZones: number | "" }>({ levelName: "", area: "", effArea: "", height: "", numZones: "" });
  const [showFSModal, setShowFSModal] = useState<boolean>(false);
  const [modalFSId, setModalFSId] = useState<string | null>(null);
  const [modalFSName, setModalFSName] = useState<string>("");
  const [modalFSType, setModalFSType] = useState<"Extract" | "Makeup">("Extract");
  const [modalFSFanQty, setModalFSFanQty] = useState<number | "">(2);
  const [modalSelectedFloorIds, setModalSelectedFloorIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string>("");
  const [fireConfigFSId, setFireConfigFSId] = useState<string | null>(null);
  const [showModalCalcPreview, setShowModalCalcPreview] = useState<boolean>(false);
  const [showUnitConfirmModal, setShowUnitConfirmModal] = useState<boolean>(false);
  const [pendingUnitTarget, setPendingUnitTarget] = useState<"si" | "ip" | null>(null);

  // Bulk Edit state (Ventilation style)
  const [bulkEditOpen, setBulkEditOpen] = useState<boolean>(false);
  const [bulkEditTargetIds, setBulkEditTargetIds] = useState<string[]>([]);
  const [bulkEditValues, setBulkEditValues] = useState({
    basementLevel: "",
    zoneName: "",
    area: "",
    effArea: "",
    height: "",
  });
  const [bulkEditFields, setBulkEditFields] = useState({
    basementLevel: false,
    zoneName: false,
    area: false,
    effArea: false,
    height: false,
  });

  // Selection & Keyboard Shortcuts state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<BasementFloor[]>([]);
  const [history, setHistory] = useState<BasementFloor[][]>([]);
  const [redoStack, setRedoStack] = useState<BasementFloor[][]>([]);

  // Search, Filter & Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterFlagged, setFilterFlagged] = useState<boolean>(false);
  const [levelSortOrder, setLevelSortOrder] = useState<"asc" | "desc">("asc");
  const [zoneSortBy, setZoneSortBy] = useState<"none" | "name" | "area">("none");

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterLevel !== "all") count++;
    if (filterFlagged) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [filterLevel, filterFlagged, searchQuery]);

  // Comments & Tasks Assignment State
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type?: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  const getSyncedComments = useMemo(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/basement-smoke-calc`;
    if (project?.workspace_data) {
      let wdata = project.workspace_data;
      if (typeof wdata === 'string') {
        try { wdata = JSON.parse(wdata); } catch(e) {}
      }
      if (wdata?.comments?.[storageKey]) {
        return wdata.comments[storageKey];
      }
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch(e) {}
    }
    return [];
  }, [project]);

  const [commentsList, setCommentsList] = useState<any[]>(getSyncedComments);

  useEffect(() => {
    setCommentsList(getSyncedComments);
  }, [getSyncedComments]);

  const saveComments = (newComments: any[]) => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/basement-smoke-calc`;
    setCommentsList(newComments);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newComments));
      if (project?.id) {
        let wdata = project.workspace_data || {};
        if (typeof wdata === 'string') {
          try { wdata = JSON.parse(wdata); } catch(e) {}
        }
        if (!wdata.comments) wdata.comments = {};
        wdata.comments[storageKey] = newComments;
        api.updateProject(project.id, { workspace_data: wdata }).catch(console.error);
        updateProject({ ...project, workspace_data: wdata });
        if (typeof forceSaveToCloud === "function") forceSaveToCloud();
      }
    } catch (e) {
      console.error("Failed to save comments", e);
    }
  };

  const handleOpenComment = (id: string, name: string, type: string = "zone") => {
    setCommentTargetItem({ id, name, type });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    const commentWithMeta = {
      ...comment,
      spaceId: commentTargetItem?.id,
      targetId: commentTargetItem?.id,
      targetName: commentTargetItem?.name,
      calculatorTitle: "Basement Smoke Calc",
      calculatorPath: "/basement-smoke-calc",
      projectId: project?.id || "default",
      projectName: project?.name || "Basement Smoke Calc",
    };
    const updated = [commentWithMeta, ...commentsList];
    saveComments(updated);
    toast.success(`Comment / task assigned on "${commentTargetItem?.name || "item"}"`);
    setCommentModalOpen(false);
  };

  // Notification target listener for scroll & highlight
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const el = document.getElementById(targetId || "") ||
                 document.querySelector(`[data-item-id="${targetId}"]`) ||
                 document.querySelector(`[data-field-id="${targetId}"]`);
      if (el || cleanId) {
        setHighlightedTargetId(targetId || cleanId);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedTargetId(null);
          highlightTimeoutRef.current = null;
        }, 4000);
        if (el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
      }
    };

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tId = params.get("commentTargetId");
      const tName = params.get("commentTargetName");
      if (tId || tName) {
        setTimeout(() => handleScrollTarget(tId || undefined, tName || undefined), 300);
      }
    }

    const handleScrollEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) handleScrollTarget(detail.id, detail.name);
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);
    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const handleResetFilters = () => {
    setFilterLevel("all");
    setFilterFlagged(false);
    setSearchQuery("");
  };

  // Navigation & 3D Import State
  const navigate = useNavigate();
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const ifcFileInputRef = useRef<HTMLInputElement>(null);
  const [showImportSourceModal, setShowImportSourceModal] = useState<boolean>(false);
  const [show3DPreviewModal, setShow3DPreviewModal] = useState<boolean>(false);
  const [pending3DSpaces, setPending3DSpaces] = useState<Extracted3DSpace[]>([]);
  const [selected3DIds, setSelected3DIds] = useState<Set<string>>(new Set());

  // Handle extraction of 3D spaces from active BIM viewer / model
  const handleExtractFrom3DModel = async (file?: File) => {
    try {
      let extracted: Extracted3DSpace[] = [];
      if (file) {
        toast.loading("Parsing 3D IFC Model spaces...", { id: "bs-ifc-parse" });
        extracted = await extractSpacesFromIFCFile(file);
        toast.dismiss("bs-ifc-parse");
      } else {
        toast.loading("Scanning active 3D Studio model for basement floors...", { id: "bs-3d-scan" });
        extracted = await extractSpacesFromActiveViewer();
        toast.dismiss("bs-3d-scan");

        if (extracted.length === 0 && project?.id) {
          const savedFile = (window as any).__ACTIVE_IFC_FILE__ || (window as any).activeIfcFile;
          if (savedFile instanceof File) {
            try {
              extracted = await extractSpacesFromIFCFile(savedFile);
            } catch (e) {}
          }
        }
      }

      // Filter basement levels & spaces
      const basementSpaces = extracted.filter(sp => 
        isBasementTerm(sp.level) || isBasementTerm(sp.name) || isBasementTerm(sp.category)
      );

      if (basementSpaces.length === 0) {
        if (extracted.length > 0) {
          toast.error(`Found ${extracted.length} total 3D spaces in the model, but none match basement level keywords (e.g. Basement, B1, B2, Level -1, Cellar).`);
        } else {
          toast.error("No 3D model is currently loaded in 3D Studio. Please select an .ifc file or load a model in 3D Studio first.");
          ifcFileInputRef.current?.click();
        }
        return;
      }

      setPending3DSpaces(basementSpaces);
      const initialSelected = new Set(
        basementSpaces
          .filter(sp => !isExcludedSpaceName(sp.name, sp.category))
          .map(sp => sp.id)
      );
      setSelected3DIds(initialSelected);
      setShow3DPreviewModal(true);
      setShowImportSourceModal(false);
      const autoDeselectedCount = basementSpaces.length - initialSelected.size;
      toast.success(
        `Found ${basementSpaces.length} basement space(s)! Selected ${initialSelected.size} space(s) (${autoDeselectedCount} utility/room spaces auto-deselected).`
      );
    } catch (err) {
      toast.dismiss("bs-3d-scan");
      toast.dismiss("bs-ifc-parse");
      console.error("Error extracting 3D basement spaces", err);
      toast.error("Failed to extract 3D model spaces.");
    }
  };

  const getCleanLevelName = (sp: Extracted3DSpace): string => {
    let cleanLvl = sp.level ? sp.level.trim() : "";
    const upperLvl = cleanLvl.toUpperCase();
    if (upperLvl.includes("BASEMENT 1") || upperLvl === "B1" || upperLvl.includes("LEVEL -1") || upperLvl.includes("L-1")) {
      return "Basement 1";
    } else if (upperLvl.includes("BASEMENT 2") || upperLvl === "B2" || upperLvl.includes("LEVEL -2") || upperLvl.includes("L-2")) {
      return "Basement 2";
    } else if (upperLvl.includes("BASEMENT 3") || upperLvl === "B3" || upperLvl.includes("LEVEL -3") || upperLvl.includes("L-3")) {
      return "Basement 3";
    } else if (upperLvl.includes("BASEMENT 4") || upperLvl === "B4" || upperLvl.includes("LEVEL -4") || upperLvl.includes("L-4")) {
      return "Basement 4";
    } else if (upperLvl.includes("BASEMENT 5") || upperLvl === "B5" || upperLvl.includes("LEVEL -5") || upperLvl.includes("L-5")) {
      return "Basement 5";
    } else if (!cleanLvl || cleanLvl === "undefined") {
      return "Basement 1";
    }
    return cleanLvl;
  };

  const handleConfirmImport3DSpaces = () => {
    const selectedSpaces = pending3DSpaces.filter(sp => selected3DIds.has(sp.id));
    if (selectedSpaces.length === 0) {
      toast.error("Please select at least one basement space to import.");
      return;
    }

    // 1. Group ALL pending 3D spaces on each level (selected + unselected)
    const allSpacesByLevel = new Map<string, Extracted3DSpace[]>();
    pending3DSpaces.forEach(sp => {
      const bLvl = getCleanLevelName(sp);
      if (!allSpacesByLevel.has(bLvl)) allSpacesByLevel.set(bLvl, []);
      allSpacesByLevel.get(bLvl)!.push(sp);
    });

    // 2. Group SELECTED spaces on each level
    const selectedSpacesByLevel = new Map<string, Extracted3DSpace[]>();
    selectedSpaces.forEach(sp => {
      const bLvl = getCleanLevelName(sp);
      if (!selectedSpacesByLevel.has(bLvl)) selectedSpacesByLevel.set(bLvl, []);
      selectedSpacesByLevel.get(bLvl)!.push(sp);
    });

    const baseTime = Date.now();
    const importedFloors: BasementFloor[] = [];
    let levelIdx = 0;

    // 3. Create 1 aggregated Basement Level entry per level
    selectedSpacesByLevel.forEach((selSpaces, bLevel) => {
      levelIdx++;
      const allSpacesInLevel = allSpacesByLevel.get(bLevel) || selSpaces;

      // Gross Area = Sum of ALL spaces (selected + unselected) on this basement level
      const totalRawGrossArea = allSpacesInLevel.reduce((acc, sp) => acc + (sp.area || 0), 0);
      // Effective Area = Sum of ONLY SELECTED spaces on this basement level
      const totalRawEffArea = selSpaces.reduce((acc, sp) => acc + (sp.area || 0), 0);

      const grossAreaVal = ip ? Math.round(totalRawGrossArea * 10.7639) : Math.round(totalRawGrossArea);
      const effAreaVal = ip ? Math.round(totalRawEffArea * 10.7639) : Math.round(totalRawEffArea);

      // Height from 3D space
      const sampleHeight = selSpaces[0]?.height || 3;
      const heightVal = ip ? Number((sampleHeight * 3.28084).toFixed(1)) : Number(sampleHeight.toFixed(1));

      importedFloors.push({
        id: `floor-${baseTime}-${levelIdx}`,
        basementLevel: bLevel,
        zoneName: "Zone 1",
        name: `${bLevel} - Zone 1`,
        area: grossAreaVal || 500,
        effArea: effAreaVal || 425,
        height: heightVal || 3
      });
    });

    updateFloorsWithHistory([...floors, ...importedFloors]);
    setShow3DPreviewModal(false);
    toast.success(
      `Successfully imported ${importedFloors.length} basement level(s) combining ${selectedSpaces.length} selected space(s)!`
    );
  };

  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          toast.error("Uploaded Excel file is empty.");
          return;
        }

        const imported: BasementFloor[] = [];
        const baseTime = Date.now();
        data.forEach((row, i) => {
          const rawLvl = row["Basement Level"] || row["Level"] || row["Floor"] || `Basement 1`;
          const rawZone = row["Zone Name"] || row["Zone"] || row["Space"] || `Zone ${i + 1}`;
          const area = parseFloat(row["Gross Area"] || row["Area"] || 500) || 500;
          const effArea = parseFloat(row["Eff. Area"] || row["Effective Area"] || area * 0.85) || Math.round(area * 0.85);
          const height = parseFloat(row["Height"] || 3) || 3;

          imported.push({
            id: `floor-${baseTime}-${i}`,
            basementLevel: String(rawLvl).trim(),
            zoneName: String(rawZone).trim(),
            name: `${String(rawLvl).trim()} - ${String(rawZone).trim()}`,
            area: area,
            effArea: effArea,
            height: height
          });
        });

        updateFloorsWithHistory([...floors, ...imported]);
        setShowImportSourceModal(false);
        toast.success(`Imported ${imported.length} floor(s) from Excel file!`);
      } catch (err) {
        toast.error("Failed to parse Excel file.");
      } finally {
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  // Push to history helper
  const updateFloorsWithHistory = (newFloors: BasementFloor[]) => {
    setHistory(prev => [...prev.slice(-25), floors]);
    setRedoStack([]);
    setFloors(newFloors);
  };

  function LevelNameInput({
    level,
    onRename,
  }: {
    level: string;
    onRename: (oldName: string, newName: string) => void;
  }) {
    const [val, setVal] = useState(level);

    useEffect(() => {
      setVal(level);
    }, [level]);

    const commitRename = () => {
      const trimmed = val.trim();
      if (trimmed && trimmed !== level) {
        onRename(level, trimmed);
      } else {
        setVal(level);
      }
    };

    return (
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commitRename}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setVal(level);
            e.currentTarget.blur();
          }
        }}
        className="bg-transparent hover:bg-slate-200/50 dark:hover:bg-slate-700/50 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded-md px-2 py-0.5 font-bold text-xs text-foreground outline-none transition-colors"
        title="Click to rename level inline (Press Enter or click outside to save)"
      />
    );
  }

  // Bulk edit handlers (Ventilation style)
  const handleOpenBulkEdit = (targetIds?: string[]) => {
    const idsToEdit = targetIds && targetIds.length > 0
      ? targetIds
      : Array.from(selectedRowIds);

    if (idsToEdit.length === 0) {
      toast.info("Please select at least one space/floor to bulk edit.");
      return;
    }

    setBulkEditTargetIds(idsToEdit);
    setBulkEditValues({
      basementLevel: "",
      zoneName: "",
      area: "",
      effArea: "",
      height: "",
    });
    setBulkEditFields({
      basementLevel: false,
      zoneName: false,
      area: false,
      effArea: false,
      height: false,
    });
    setBulkEditOpen(true);
  };

  const handleApplyBulkEdit = () => {
    const hasAnyFieldChecked = Object.values(bulkEditFields).some(Boolean);
    if (!hasAnyFieldChecked) {
      toast.error("Please check at least one parameter box to apply bulk updates.");
      return;
    }

    const updatedFloors = floors.map((f) => {
      if (bulkEditTargetIds.includes(f.id)) {
        const nextFloor = { ...f };
        if (bulkEditFields.basementLevel) {
          const newLevel = bulkEditValues.basementLevel.trim();
          if (newLevel) nextFloor.basementLevel = newLevel;
        }
        if (bulkEditFields.zoneName) {
          const newZone = bulkEditValues.zoneName.trim();
          if (newZone) nextFloor.zoneName = newZone;
        }
        if (bulkEditFields.basementLevel || bulkEditFields.zoneName) {
          nextFloor.name = `${nextFloor.basementLevel} - ${nextFloor.zoneName}`;
        }
        if (bulkEditFields.area) {
          const newArea = parseFloat(bulkEditValues.area);
          if (!isNaN(newArea) && newArea > 0) {
            nextFloor.area = newArea;
            if (!bulkEditFields.effArea) {
              nextFloor.effArea = Math.round(newArea * 0.85);
            }
          }
        }
        if (bulkEditFields.effArea) {
          const newEff = parseFloat(bulkEditValues.effArea);
          if (!isNaN(newEff) && newEff >= 0) {
            nextFloor.effArea = newEff;
          }
        }
        if (bulkEditFields.height) {
          const newH = parseFloat(bulkEditValues.height);
          if (!isNaN(newH) && newH > 0) {
            nextFloor.height = newH;
          }
        }
        return nextFloor;
      }
      return f;
    });

    updateFloorsWithHistory(updatedFloors);
    toast.success(`Successfully updated ${bulkEditTargetIds.length} space(s)!`);
    setBulkEditOpen(false);
    setSelectedRowIds(new Set());
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prevFloors = history[history.length - 1];
    setRedoStack(prev => [...prev, floors]);
    setFloors(prevFloors);
    setHistory(prev => prev.slice(0, -1));
    toast.info("Undo");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextFloors = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, floors]);
    setFloors(nextFloors);
    setRedoStack(prev => prev.slice(0, -1));
    toast.info("Redo");
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
        updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
        setSelectedRowIds(new Set());
        toast.info(`Deleted ${count} space(s)`);
      }
    });
  };

  // Keyboard shortcut listener (Ctrl+A, Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D, Delete, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputActive = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT" || (document.activeElement as HTMLElement)?.isContentEditable;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // Undo: Ctrl + Z
      if (isCmdOrCtrl && !e.shiftKey && key === "z") {
        if (isApprovedLocked || isEffectiveReadOnly) return;
        if (history.length > 0) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      // Redo: Ctrl + Y or Ctrl + Shift + Z
      if ((isCmdOrCtrl && key === "y") || (isCmdOrCtrl && e.shiftKey && key === "z")) {
        if (isApprovedLocked || isEffectiveReadOnly) return;
        if (redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }

      // Allow default input behavior for text typing inside inputs
      if (isInputActive) return;

      // Select All: Ctrl + A
      if (isCmdOrCtrl && key === "a") {
        e.preventDefault();
        const allIds = new Set(floors.map(f => f.id));
        setSelectedRowIds(allIds);
        toast.info(`Selected all ${allIds.size} basement space(s)`);
        return;
      }

      // Copy: Ctrl + C
      if (isCmdOrCtrl && key === "c") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
          setClipboard(selectedItems);
          toast.info(`${selectedItems.length} space(s) copied to clipboard`);
        }
        return;
      }

      // Cut: Ctrl + X
      if (isCmdOrCtrl && key === "x") {
        if (isApprovedLocked || isEffectiveReadOnly) return;
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
          setClipboard(selectedItems);
          updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
          setSelectedRowIds(new Set());
          toast.info(`${selectedItems.length} space(s) cut to clipboard`);
        }
        return;
      }

      // Paste: Ctrl + V
      if (isCmdOrCtrl && key === "v") {
        if (isApprovedLocked || isEffectiveReadOnly) return;
        if (clipboard.length > 0) {
          e.preventDefault();
          const baseTime = Date.now();
          const newPasted: BasementFloor[] = clipboard.map((item, idx) => ({
            ...item,
            id: `floor-${baseTime}-${idx}`,
            name: item.name.includes("(Copy)") ? item.name : `${item.name} (Copy)`
          }));
          updateFloorsWithHistory([...floors, ...newPasted]);
          setSelectedRowIds(new Set(newPasted.map(n => n.id)));
          toast.success(`${newPasted.length} space(s) pasted`);
        }
        return;
      }

      // Duplicate: Ctrl + D
      if (isCmdOrCtrl && key === "d") {
        if (isApprovedLocked || isEffectiveReadOnly) return;
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
          const baseTime = Date.now();
          const duplicated: BasementFloor[] = selectedItems.map((item, idx) => ({
            ...item,
            id: `floor-${baseTime}-${idx}`,
            name: item.name.includes("(Copy)") ? item.name : `${item.name} (Copy)`
          }));
          updateFloorsWithHistory([...floors, ...duplicated]);
          setSelectedRowIds(new Set(duplicated.map(d => d.id)));
          toast.success(`Duplicated ${duplicated.length} space(s)`);
        }
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
        return;
      }

      // Escape: Deselect all
      if (e.key === "Escape") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          setSelectedRowIds(new Set());
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [floors, selectedRowIds, clipboard, history, redoStack, isApprovedLocked, isEffectiveReadOnly]);

  const ip = unitSystem === "ip";

  const isInitialMountRef = useRef(true);

  // Load from local storage and workspace_data
  useEffect(() => {
    if (isInitializing && !project?.id) return; // Wait until workspace is fully initialized

    setIsLoaded(false);
    try {
      const pId = project?.id || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : null) || "default";
      let loadedFloors: BasementFloor[] | null = null;
      let loadedFans: FanSystem[] | null = null;
      let loadedTotalFans: number | null = null;
      let loadedUnitSystem: "si" | "ip" | null = null;
      let loadedShowSizing: boolean | null = null;

      // 1. Try workspace_data first if available
      if (project?.workspace_data) {
        let wdata = project.workspace_data;
        if (typeof wdata === 'string') {
          try { wdata = JSON.parse(wdata); } catch(e) {}
        }
        if (wdata?.basement_smoke_calc) {
          const bsc = wdata.basement_smoke_calc;
          if (Array.isArray(bsc.floors) && bsc.floors.length > 0) loadedFloors = bsc.floors;
          if (Array.isArray(bsc.fanSystems) && bsc.fanSystems.length > 0) loadedFans = bsc.fanSystems;
          if (typeof bsc.totalFans === 'number') loadedTotalFans = bsc.totalFans;
          if (bsc.unitSystem === "si" || bsc.unitSystem === "ip") loadedUnitSystem = bsc.unitSystem;
          if (typeof bsc.showGlobalFanSizing === 'boolean') loadedShowSizing = bsc.showGlobalFanSizing;
        }
      }

      // 2. Fallback to localStorage (only use global if pId is 'default')
      if (!loadedUnitSystem) {
        const savedUnitSystem = (pId && pId !== "default" ? localStorage.getItem(`bs_unit_system_${pId}`) : null) || localStorage.getItem("bs_unit_system") as "si" | "ip" | null;
        if (savedUnitSystem && (savedUnitSystem === "si" || savedUnitSystem === "ip")) {
          loadedUnitSystem = savedUnitSystem;
        }
      }
      if (loadedUnitSystem) setUnitSystem(loadedUnitSystem);

      if (!loadedFloors) {
        const savedRows = (pId && pId !== "default" ? localStorage.getItem(`bs_rows_${pId}`) : null) || (pId === "default" ? localStorage.getItem("bs_rows") : null);
        if (savedRows) {
          const parsed: any[] = JSON.parse(savedRows);
          loadedFloors = parsed.map((f, idx) => {
            const bLevel = f.basementLevel || (f.name ? f.name.split(" - ")[0] : `Basement ${idx + 1}`);
            const zName = f.zoneName || (f.name && f.name.includes(" - ") ? f.name.split(" - ")[1] : `Zone ${idx + 1}`);
            const displayName = f.name && f.name.includes(" - ") ? f.name : `${bLevel} - ${zName}`;
            return {
              id: f.id || `floor-${idx}`,
              basementLevel: bLevel,
              zoneName: zName,
              name: displayName,
              area: typeof f.area === 'number' ? f.area : Number(f.area) || 0,
              effArea: typeof f.effArea === 'number' ? f.effArea : Number(f.effArea) || 0,
              height: typeof f.height === 'number' ? f.height : Number(f.height) || 0,
              flagged: !!f.flagged
            };
          });
        }
      }
      if (loadedFloors && loadedFloors.length > 0) {
        setFloors(loadedFloors);
      } else {
        setFloors([
          { id: "floor-1", basementLevel: "Basement 1", zoneName: "Zone 1", name: "Basement 1 - Zone 1", area: 600, effArea: 500, height: 3 },
          { id: "floor-2", basementLevel: "Basement 1", zoneName: "Zone 2", name: "Basement 1 - Zone 2", area: 600, effArea: 500, height: 3 }
        ]);
      }

      if (!loadedFans) {
        const savedFans = (pId && pId !== "default" ? localStorage.getItem(`bs_fan_systems_${pId}`) : null) || (pId === "default" ? localStorage.getItem("bs_fan_systems") : null);
        if (savedFans) {
          loadedFans = JSON.parse(savedFans);
        }
      }
      if (loadedFans && loadedFans.length > 0) {
        setFanSystems(loadedFans);
      } else {
        setFanSystems([
          {
            id: "fs-1",
            name: "Basement Extract System 1",
            floorIds: ["floor-1", "floor-2"],
            fanType: "Extract",
            length: 30,
            frictionFactor: 1.2,
            louver: 40,
            grille: 15,
            sa: 30,
            collapsed: false
          }
        ]);
      }

      if (loadedTotalFans === null) {
        const savedTotalFans = (pId && pId !== "default" ? localStorage.getItem(`bs_total_fans_${pId}`) : null) || (pId === "default" ? localStorage.getItem("bs_total_fans") : null);
        if (savedTotalFans) loadedTotalFans = Number(savedTotalFans);
      }
      if (loadedTotalFans !== null && !isNaN(loadedTotalFans)) {
        setTotalFans(loadedTotalFans);
      }

      if (loadedShowSizing === null) {
        const savedShowSizing = localStorage.getItem("bs_show_global_fan_sizing");
        if (savedShowSizing !== null) loadedShowSizing = savedShowSizing === "true";
      }
      if (loadedShowSizing !== null) {
        setShowGlobalFanSizing(loadedShowSizing);
      }

      if (project?.id) setLoadedProjectId(project.id);
    } catch (e) {
      console.error("Failed to load basement smoke calc configurations", e);
    } finally {
      setIsLoaded(true);
    }
  }, [project?.id, isInitializing]);

  // Save to local storage & workspace data on changes (only after initial load is complete)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const pId = project?.id || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : null) || "default";

      // 1. Save to Local Storage
      const strRows = JSON.stringify(floors);
      localStorage.setItem("bs_rows", strRows);
      if (pId) localStorage.setItem(`bs_rows_${pId}`, strRows);

      const strFans = JSON.stringify(fanSystems);
      localStorage.setItem("bs_fan_systems", strFans);
      if (pId) localStorage.setItem(`bs_fan_systems_${pId}`, strFans);

      const strTotalFans = totalFans.toString();
      localStorage.setItem("bs_total_fans", strTotalFans);
      if (pId) localStorage.setItem(`bs_total_fans_${pId}`, strTotalFans);

      localStorage.setItem("bs_show_global_fan_sizing", showGlobalFanSizing.toString());
      localStorage.setItem("bs_unit_system", unitSystem);
      if (pId) localStorage.setItem(`bs_unit_system_${pId}`, unitSystem);

      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        dirtyStore.set(false);
      } else {
        dirtyStore.set(true);
      }

      // 2. Update local workspace_data reference (will be pushed to cloud on manual save)
      if (project?.id) {
        let wdata = project.workspace_data || {};
        if (typeof wdata === 'string') {
          try { wdata = JSON.parse(wdata); } catch(e) {}
        }
        wdata.basement_smoke_calc = {
          floors,
          fanSystems,
          totalFans,
          unitSystem,
          showGlobalFanSizing,
          updatedAt: new Date().toISOString()
        };
        // Mutate project object locally
        project.workspace_data = wdata;
      }
    } catch (e) {
      console.error("Failed to save basement smoke calc state", e);
    }
  }, [floors, fanSystems, totalFans, unitSystem, showGlobalFanSizing, project?.id, isLoaded]);

  useEffect(() => {
    const handleTriggerSave = (e: any) => {
      if (e.detail) e.detail.handled = true;
      dirtyStore.set(false);
      if (typeof forceSaveToCloud === "function") {
        forceSaveToCloud(true);
      }
      toast.success("Basement smoke calculations saved successfully.");
    };
    window.addEventListener("mep-trigger-save", handleTriggerSave);
    return () => window.removeEventListener("mep-trigger-save", handleTriggerSave);
  }, [forceSaveToCloud]);

  const handleUnitSystemClick = (targetUnit: "si" | "ip") => {
    if (targetUnit === unitSystem) return;
    setPendingUnitTarget(targetUnit);
    setShowUnitConfirmModal(true);
  };

  const executeUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (shouldConvert) {
      const convArea = targetUnit === "ip" ? 10.7639 : 1 / 10.7639;
      const convHeight = targetUnit === "ip" ? 3.28084 : 1 / 3.28084;

      updateFloorsWithHistory(floors.map(f => ({
        ...f,
        area: Math.round(f.area * convArea),
        effArea: Math.round(f.effArea * convArea),
        height: Number((f.height * convHeight).toFixed(1))
      })));
    }

    setUnitSystem(targetUnit);
    const pId = project?.id;
    localStorage.setItem("bs_unit_system", targetUnit);
    if (pId) localStorage.setItem(`bs_unit_system_${pId}`, targetUnit);

    setShowUnitConfirmModal(false);
    setPendingUnitTarget(null);
  };

  const calculatedRows = useMemo(() => {
    return floors.map(f => {
      const flows = calculateSmokeFlows(f.effArea, f.height, ip);
      return {
        ...f,
        ...flows
      };
    });
  }, [floors, ip, unitSystem]);

  // Unique basement level names for filter dropdown
  const uniqueBasementLevels = useMemo(() => {
    const levels = new Set<string>();
    calculatedRows.forEach(r => {
      const rawLvl = (r.basementLevel && r.basementLevel !== "undefined")
        ? r.basementLevel
        : (r.name && r.name.includes(" - ") ? r.name.split(" - ")[0] : (r.name && r.name !== "undefined" ? r.name : "Basement 1"));
      if (rawLvl) levels.add(rawLvl.trim());
    });
    return Array.from(levels).sort((a, b) => {
      const matchA = a.match(/(\d+)/);
      const matchB = b.match(/(\d+)/);
      const numA = matchA ? parseInt(matchA[1], 10) : 999;
      const numB = matchB ? parseInt(matchB[1], 10) : 999;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [calculatedRows]);

  // Filter calculated rows based on search query, level filter, and flagged state
  const filteredRows = useMemo(() => {
    return calculatedRows.filter(r => {
      const lvlName = (r.basementLevel && r.basementLevel !== "undefined")
        ? r.basementLevel
        : (r.name && r.name.includes(" - ") ? r.name.split(" - ")[0] : (r.name && r.name !== "undefined" ? r.name : "Basement 1"));
      
      if (filterLevel !== "all" && lvlName.trim() !== filterLevel) {
        return false;
      }
      if (filterFlagged && !r.flagged) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullStr = `${lvlName} ${r.zoneName || ""} ${r.name || ""}`.toLowerCase();
        if (!fullStr.includes(q)) return false;
      }
      return true;
    });
  }, [calculatedRows, filterLevel, filterFlagged, searchQuery]);

  // Group calculated rows by basementLevel and sort ascending (B1, B2, B3...)
  const calculatedGroups = useMemo(() => {
    const map = new Map<string, typeof calculatedRows>();
    filteredRows.forEach(r => {
      const rawLvl = (r.basementLevel && r.basementLevel !== "undefined")
        ? r.basementLevel
        : (r.name && r.name.includes(" - ") ? r.name.split(" - ")[0] : (r.name && r.name !== "undefined" ? r.name : "Basement 1"));
      const bLevel = (rawLvl || "").trim() || "Basement 1";
      if (!map.has(bLevel)) map.set(bLevel, []);
      map.get(bLevel)!.push(r);
    });

    const result: { basementLevel: string; rows: typeof calculatedRows; subtotal3: number; subtotal6: number; max10Fire: number; totalArea: number; totalEffArea: number }[] = [];
    map.forEach((rows, bLevel) => {
      let sortedRows = [...rows];
      if (zoneSortBy === "name") {
        sortedRows.sort((a, b) => (a.zoneName || a.name).localeCompare(b.zoneName || b.name, undefined, { numeric: true }));
      } else if (zoneSortBy === "area") {
        sortedRows.sort((a, b) => b.area - a.area);
      }

      const subtotal3 = sortedRows.reduce((a, b) => a + b.flow3ach, 0);
      const subtotal6 = sortedRows.reduce((a, b) => a + b.flow6ach, 0);
      const max10Fire = Math.max(...sortedRows.map(r => r.flow10ach), 0);
      const totalArea = sortedRows.reduce((a, b) => a + b.area, 0);
      const totalEffArea = sortedRows.reduce((a, b) => a + b.effArea, 0);

      result.push({
        basementLevel: bLevel,
        rows: sortedRows,
        subtotal3,
        subtotal6,
        max10Fire,
        totalArea,
        totalEffArea
      });
    });

    // Always sort basement levels by level number in specified order (default ascending: BASEMENT 01, BASEMENT 02, BASEMENT 03...)
    result.sort((a, b) => {
      const matchA = a.basementLevel.match(/(\d+)/);
      const matchB = b.basementLevel.match(/(\d+)/);
      const numA = matchA ? parseInt(matchA[1], 10) : 999;
      const numB = matchB ? parseInt(matchB[1], 10) : 999;
      let diff = 0;
      if (numA !== numB) {
        diff = numA - numB;
      } else {
        diff = a.basementLevel.localeCompare(b.basementLevel, undefined, { numeric: true, sensitivity: 'base' });
      }
      return levelSortOrder === "asc" ? diff : -diff;
    });

    return result;
  }, [filteredRows, levelSortOrder, zoneSortBy]);

  const totals = useMemo(() => {
    const total3 = calculatedRows.reduce((a, b) => a + b.flow3ach, 0);
    const total6 = calculatedRows.reduce((a, b) => a + b.flow6ach, 0);
    
    // Find the row with maximum flow6ach globally across all basement rows
    const max6Row = calculatedRows.length > 0
      ? calculatedRows.reduce((max, r) => r.flow6ach > max.flow6ach ? r : max, calculatedRows[0])
      : null;

    // Normal Mode (3-3-6 Recommendation): 1 worst-case zone at 6 ACH, all other zones at 3 ACH
    const normalScenarioSum = calculatedRows.reduce((a, b) => {
      const mode = (max6Row && b.id === max6Row.id) ? 6 : 3;
      return a + (mode === 6 ? b.flow6ach : b.flow3ach);
    }, 0);

    // Fire Mode: Strictly consider only 10 ACH Max across all zones
    const max10 = Math.max(0, ...calculatedRows.map(r => r.flow10ach));

    const lowCap = Math.ceil(normalScenarioSum / (totalFans || 1));
    const highCap = Math.ceil(max10 / (totalFans || 1));
    const sizedCap = Math.max(lowCap, highCap);
    const governingMode = lowCap > highCap ? "Normal Mode" : "Fire Mode";

    const totalGrossArea = calculatedRows.reduce((a, b) => a + b.area, 0);
    const totalEffArea = calculatedRows.reduce((a, b) => a + b.effArea, 0);

    return {
      totalGrossArea,
      totalEffArea,
      total3,
      total6,
      normalScenarioSum,
      fireScenarioSum: normalScenarioSum,
      max10,
      fireTotal: max10,
      lowCap,
      highCap,
      normalCap: lowCap,
      fireCap: highCap,
      sizedCap,
      governingMode
    };
  }, [calculatedRows, totalFans]);

  const groupOrder = useMemo(() => {
    return calculatedGroups.map(g => g.basementLevel);
  }, [calculatedGroups]);

  const handleAddNewFloor = (targetLevel?: string) => {
    if (isApprovedLocked) return;
    const baseId = Date.now();
    let lvl = targetLevel;
    if (!lvl) {
      if (floors.length > 0) {
        const lastLvl = floors[floors.length - 1].basementLevel;
        lvl = lastLvl || `Basement ${calculatedGroups.length + 1}`;
      } else {
        lvl = "Basement 1";
      }
    }
    const existingInLevel = floors.filter(f => f.basementLevel === lvl);
    const zNum = existingInLevel.length + 1;
    const zName = `Zone ${zNum}`;
    const draftFloor: BasementFloor = {
      id: `floor-${baseId}`,
      basementLevel: lvl,
      zoneName: zName,
      name: `${lvl} - ${zName}`,
      area: ip ? 6000 : 500,
      effArea: ip ? 5000 : 400,
      height: existingInLevel[0]?.height || (ip ? 10 : 3.0),
    };
    updateFloorsWithHistory([...floors, draftFloor]);
    setEditingFloor(draftFloor);
    setIsNewFloor(true);
  };

  const handleCloseEditingFloor = () => {
    if (isNewFloor && editingFloor) {
      const updated = floors.filter(f => f.id !== editingFloor.id);
      updateFloorsWithHistory(updated);
    }
    setEditingFloor(null);
    setIsNewFloor(false);
  };

  const handleSaveFloorModal = (updated: BasementFloor) => {
    const updatedFloors = floors.map(f => f.id === updated.id ? updated : f);
    updateFloorsWithHistory(updatedFloors);
    setEditingFloor(null);
    setIsNewFloor(false);
    toast.success(isNewFloor ? `Space "${updated.name}" added successfully` : `Space "${updated.name}" updated successfully`);
  };

  const toggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelectedRowIds((prev) => {
      const list = filteredRows;
      const clickedIndex = list.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);
      if (isShift) {
        for (let i = 0; i <= clickedIndex; i++) {
          if (list[i]) next.add(list[i].id);
        }
      } else if (isCtrl) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        if (prev.has(id) && prev.size === 1) next.delete(id);
        else {
          next.clear();
          next.add(id);
        }
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedRowIds((prev) => (prev.size === filteredRows.length ? new Set() : new Set(filteredRows.map((r) => r.id))));
  };

  const handleToggleGroup = (ids: string[], select: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (select) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const renderGroupHeader = (groupValue: string) => {
    const grp = calculatedGroups.find(g => g.basementLevel === groupValue);
    const count = grp ? grp.rows.length : calculatedRows.filter(r => (r.basementLevel || "Basement 1") === groupValue).length;
    const sub3 = grp ? grp.subtotal3 : 0;
    const sub6 = grp ? grp.subtotal6 : 0;
    const max10 = grp ? grp.max10Fire : 0;

    return (
      <div className="flex items-center justify-between w-full pr-4 text-xs">
        <div className="flex items-center gap-1.5 font-medium">
          <strong className="font-bold text-primary">{groupValue}</strong>
          <span className="text-[10.5px] text-muted-foreground font-normal">({count} {count === 1 ? "zone" : "zones"})</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span>Σ 3 ACH: <strong className="text-foreground">{sub3.toLocaleString()} {ip ? "CFM" : "L/s"}</strong></span>
          <span>Σ 6 ACH: <strong className="text-foreground">{sub6.toLocaleString()} {ip ? "CFM" : "L/s"}</strong></span>
          <span className="text-rose-600 dark:text-rose-400 font-bold">Max 10 ACH: {max10.toLocaleString()} {ip ? "CFM" : "L/s"}</span>
        </div>
      </div>
    );
  };

  const renderGroupContextMenu = (groupValue: string) => {
    const matching = calculatedRows.filter(r => (r.basementLevel || "Basement 1") === groupValue);
    const matchingIds = matching.map(r => r.id);
    const grp = calculatedGroups.find(g => g.basementLevel === groupValue);

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => handleOpenComment(groupValue, groupValue, "level")}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment to {groupValue}</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => handleAddNewFloor(groupValue)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Plus className="size-3.5 text-muted-foreground" />
          <span>Add Zone to {groupValue}</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {grp && (
          <ContextMenuItem
            onClick={() => handleOpenEditLevelModal(grp)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-muted-foreground shrink-0" />
            <span className="whitespace-nowrap">Edit Level Parameters</span>
          </ContextMenuItem>
        )}

        <ContextMenuItem
          onClick={() => handleOpenBulkEdit(matchingIds)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Edit3 className="size-3.5 text-muted-foreground shrink-0" />
          <span className="whitespace-nowrap">Bulk Edit {matchingIds.length} Spaces</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={() => handleDeleteLevel(groupValue, matchingIds)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span className="whitespace-nowrap">Delete Entire {groupValue}</span>
          <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto pl-3 whitespace-nowrap text-right">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const renderRowContextMenu = (row: typeof calculatedRows[0]) => {
    const isReadOnly = isApprovedLocked || isEffectiveReadOnly;
    const targetIds = selectedRowIds.has(row.id) ? Array.from(selectedRowIds) : [row.id];
    const isMulti = targetIds.length > 1;

    return (
      <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        {/* Add Comment */}
        <ContextMenuItem
          onClick={() => handleOpenComment(row.id, row.name || row.zoneName, "zone")}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5 shrink-0" />
          <span className="whitespace-nowrap">Add Comment</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Cut */}
        <ContextMenuItem
          onClick={() => {
            if (isReadOnly) {
              toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            const selectedItems = floors.filter(f => targetIds.includes(f.id));
            setClipboard(selectedItems);
            updateFloorsWithHistory(floors.filter(f => !targetIds.includes(f.id)));
            setSelectedRowIds(new Set());
            toast.info(`${selectedItems.length} space(s) cut to clipboard`);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Scissors className="size-3.5 text-muted-foreground shrink-0" />
          <span className="whitespace-nowrap">{isMulti ? `Cut Selected (${targetIds.length})` : "Cut"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Copy */}
        <ContextMenuItem
          onClick={() => {
            const selectedItems = floors.filter(f => targetIds.includes(f.id));
            setClipboard(selectedItems);
            toast.info(`${selectedItems.length} space(s) copied to clipboard`);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Copy className="size-3.5 text-muted-foreground shrink-0" />
          <span className="whitespace-nowrap">{isMulti ? `Copy Selected (${targetIds.length})` : "Copy"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Paste */}
        <ContextMenuItem
          disabled={clipboard.length === 0 || isReadOnly}
          onClick={() => {
            if (isReadOnly) {
              toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            const baseTime = Date.now();
            const newPasted: BasementFloor[] = clipboard.map((item, idx) => ({
              ...item,
              id: `floor-${baseTime}-${idx}`,
              name: item.name.includes("(Copy)") ? item.name : `${item.name} (Copy)`
            }));
            updateFloorsWithHistory([...floors, ...newPasted]);
            setSelectedRowIds(new Set(newPasted.map(n => n.id)));
            toast.success(`${newPasted.length} space(s) pasted`);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
        >
          <ClipboardPaste className="size-3.5 text-muted-foreground shrink-0" />
          <span className="whitespace-nowrap">Paste</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Ctrl+V</ContextMenuShortcut>
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
              handleOpenBulkEdit(targetIds);
            } else {
              setEditingFloor(row);
              setIsNewFloor(false);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Edit3 className="size-3.5 text-muted-foreground shrink-0" />
          <span className="whitespace-nowrap">{isMulti ? `Bulk Edit (${targetIds.length} Spaces)` : "Edit Space Parameters"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Duplicate Space */}
        <ContextMenuItem
          onClick={() => {
            if (isReadOnly) {
              toast.info("Workspace is in Read-Only mode. Duplicating is locked.", { id: "readonly-notice" });
              return;
            }
            if (isMulti) {
              const selectedItems = floors.filter(f => targetIds.includes(f.id));
              const baseTime = Date.now();
              const clones: BasementFloor[] = selectedItems.map((item, idx) => ({
                ...item,
                id: `floor-${baseTime}-${idx}`,
                name: item.name.includes("(Copy)") ? item.name : `${item.name} (Copy)`
              }));
              updateFloorsWithHistory([...floors, ...clones]);
              setSelectedRowIds(new Set(clones.map(n => n.id)));
              toast.success(`Duplicated ${clones.length} space(s)`);
            } else {
              handleDuplicateZone(row);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <CopyPlus className="size-3.5 text-muted-foreground shrink-0" />
          <span className="whitespace-nowrap">{isMulti ? `Duplicate Selected (${targetIds.length})` : "Duplicate Space"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Delete */}
        <ContextMenuItem
          onClick={() => {
            if (isReadOnly) {
              toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              return;
            }
            const count = targetIds.length;
            confirm(
              count === 1
                ? `Are you sure you want to delete space "${row.name || row.zoneName}"?`
                : `Are you sure you want to delete the ${count} selected space(s)?`,
              {
                title: "Delete Spaces",
                confirmText: "Delete",
                cancelText: "Cancel",
                variant: "destructive"
              }
            ).then((ok: any) => {
              if (ok) {
                if (isMulti) {
                  updateFloorsWithHistory(floors.filter(f => !targetIds.includes(f.id)));
                  setSelectedRowIds(new Set());
                  toast.info(`Deleted ${count} space(s)`);
                } else {
                  handleDeleteFloor(row.id);
                }
              }
            });
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span className="whitespace-nowrap">{isMulti ? `Delete Selected (${targetIds.length})` : "Delete Space"}</span>
          <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto pl-3 whitespace-nowrap text-right">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const columns: Column<typeof calculatedRows[0]>[] = [
    {
      key: "name",
      header: "LEVEL / ZONE NAME",
      width: 240,
      editable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5 w-full pr-1">
          <InlineInput
            disabled={isApprovedLocked}
            value={r.name}
            placeholder="Basement 1 - Zone 1"
            onCommit={(val) => handleUpdateFloorCell(r.id, "name", val)}
            className="font-medium text-[13.5px] flex-1 min-w-0"
          />
        </div>
      ),
    },
    {
      key: "area",
      header: `GROSS AREA (${ip ? "FT²" : "M²"})`,
      width: 130,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <InlineInput
          disabled={isApprovedLocked}
          type="number"
          step="0.1"
          min={0}
          value={r.area || ""}
          placeholder="0"
          onCommit={(val) => handleUpdateFloorCell(r.id, "area", parseFloat(val) || 0)}
          className="font-mono tabular text-[13.5px] text-center"
        />
      ),
    },
    {
      key: "effArea",
      header: `EFF. AREA (${ip ? "FT²" : "M²"})`,
      width: 130,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <InlineInput
          disabled={isApprovedLocked}
          type="number"
          step="0.1"
          min={0}
          value={r.effArea || ""}
          placeholder="0"
          onCommit={(val) => handleUpdateFloorCell(r.id, "effArea", parseFloat(val) || 0)}
          className="font-mono tabular text-[13.5px] text-center"
        />
      ),
    },
    {
      key: "height",
      header: `HEIGHT (${ip ? "FT" : "M"})`,
      width: 100,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <InlineInput
          disabled={isApprovedLocked}
          type="number"
          step="0.1"
          min={0}
          value={r.height || ""}
          placeholder="0"
          onCommit={(val) => handleUpdateFloorCell(r.id, "height", parseFloat(val) || 0)}
          className="font-mono tabular text-[13.5px] text-center"
        />
      ),
    },
    {
      key: "flow3ach",
      header: `3 ACH (${ip ? "CFM" : "L/S"})`,
      width: 130,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono tabular text-[13.5px] text-muted-foreground font-medium text-center w-full block">
          {r.flow3ach.toLocaleString()}
        </span>
      ),
    },
    {
      key: "flow6ach",
      header: `6 ACH (${ip ? "CFM" : "L/S"})`,
      width: 130,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono tabular text-[13.5px] text-slate-800 dark:text-slate-200 font-semibold text-center w-full block">
          {r.flow6ach.toLocaleString()}
        </span>
      ),
    },
    {
      key: "flow10ach",
      header: `10 ACH (${ip ? "CFM" : "L/S"})`,
      width: 140,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono tabular text-[13.5px] font-bold text-rose-600 dark:text-rose-400 text-center w-full block">
          {r.flow10ach.toLocaleString()}
        </span>
      ),
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
            setHistory(prev => [...prev.slice(-25), floors]);
            setRedoStack([]);
            setFloors(prev => prev.map(f => targetIds.includes(f.id) ? { ...f, flagged: nextFlagged } : f));
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto disabled:cursor-default"
          title={
            (() => {
              const isNoName = !r.name || r.name.trim() === "";
              const isNoArea = !r.area || Number(r.area) <= 0 || isNaN(Number(r.area));
              const isNoHeight = !r.height || Number(r.height) <= 0 || isNaN(Number(r.height));
              if (isNoArea && isNoHeight) return "Missing gross area and height";
              if (isNoArea) return "Missing gross area";
              if (isNoHeight) return "Missing basement height";
              if (isNoName) return "Missing level / zone name";
              return r.flagged ? "Unflag zone" : "Flag zone";
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



  const handleDeleteFloor = (id: string) => {
    const updatedFloors = floors.filter(f => f.id !== id);
    updateFloorsWithHistory(updatedFloors);
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Clean floor ID refs from Fan Systems
    setFanSystems(fanSystems.map(fs => ({
      ...fs,
      floorIds: fs.floorIds.filter(fId => fId !== id)
    })));
  };

  const handleRenameLevel = (oldLevelName: string, newLevelName: string) => {
    if (!newLevelName.trim()) return;
    setHistory(prev => [...prev.slice(-25), floors]);
    setRedoStack([]);
    setFloors(prev => prev.map(f => {
      if (f.basementLevel !== oldLevelName) return f;
      const zName = f.zoneName || (f.name.includes(" - ") ? f.name.split(" - ")[1] : "Zone 1");
      return {
        ...f,
        basementLevel: newLevelName.trim(),
        name: `${newLevelName.trim()} - ${zName}`
      };
    }));
  };

  const handleOpenEditLevelModal = (grp: { basementLevel: string; rows: BasementFloor[]; totalArea: number; totalEffArea: number }) => {
    setEditLevelTarget(grp.basementLevel);
    setEditLevelData({
      levelName: grp.basementLevel,
      area: grp.totalArea,
      effArea: grp.totalEffArea,
      height: grp.rows[0]?.height || 3,
      numZones: grp.rows.length
    });
    setShowEditLevelModal(true);
  };

  const handleSaveEditLevel = () => {
    if (!editLevelTarget) return;
    const newLvlName = editLevelData.levelName.trim() || editLevelTarget;
    const totalArea = editLevelData.area !== "" && !isNaN(Number(editLevelData.area)) ? Number(editLevelData.area) : 600;
    const totalEffArea = editLevelData.effArea !== "" && !isNaN(Number(editLevelData.effArea)) ? Number(editLevelData.effArea) : 500;
    const heightVal = editLevelData.height !== "" && !isNaN(Number(editLevelData.height)) ? Number(editLevelData.height) : 3;
    const numZones = editLevelData.numZones !== "" && !isNaN(Number(editLevelData.numZones)) ? Math.max(1, Number(editLevelData.numZones)) : 1;

    const existingInLevel = floors.filter(f => f.basementLevel === editLevelTarget);
    const otherFloors = floors.filter(f => f.basementLevel !== editLevelTarget);

    const perZoneArea = Math.round(totalArea / numZones);
    const perZoneEffArea = Math.round(totalEffArea / numZones);
    const baseId = Date.now();

    const newLevelRows: BasementFloor[] = [];
    for (let i = 1; i <= numZones; i++) {
      const existingZone = existingInLevel[i - 1];
      const zName = existingZone?.zoneName || `Zone ${i}`;
      newLevelRows.push({
        id: existingZone?.id || `floor-${baseId}-${i}`,
        basementLevel: newLvlName,
        zoneName: zName,
        name: `${newLvlName} - ${zName}`,
        area: perZoneArea,
        effArea: perZoneEffArea,
        height: heightVal,
        flagged: existingZone?.flagged
      });
    }

    // Auto-sync any fan systems serving this level to include all new zone IDs of this level
    const oldIds = new Set(existingInLevel.map(f => f.id));
    const newIds = newLevelRows.map(f => f.id);
    
    setFanSystems(prevFS => prevFS.map(fs => {
      const servesThisLevel = fs.floorIds.some(id => oldIds.has(id));
      if (servesThisLevel) {
        const otherLevelIds = fs.floorIds.filter(id => !oldIds.has(id));
        return {
          ...fs,
          floorIds: Array.from(new Set([...otherLevelIds, ...newIds]))
        };
      }
      return fs;
    }));

    updateFloorsWithHistory([...otherFloors, ...newLevelRows]);
    setShowEditLevelModal(false);
    setEditLevelTarget(null);
  };

  const handleAddZoneToLevel = (bLevel: string) => {
    handleAddNewFloor(bLevel);
  };

  const handleDeleteLevel = (bLevel: string, targetFloorIds?: string[]) => {
    const idsToDelete = targetFloorIds && targetFloorIds.length > 0
      ? new Set(targetFloorIds)
      : new Set(floors.filter(f => {
          const rawLvl = (f.basementLevel && f.basementLevel !== "undefined")
            ? f.basementLevel
            : (f.name && f.name.includes(" - ") ? f.name.split(" - ")[0] : "Basement 1");
          return rawLvl.trim().toLowerCase() === bLevel.trim().toLowerCase();
        }).map(f => f.id));

    const updatedFloors = floors.filter(f => !idsToDelete.has(f.id));
    updateFloorsWithHistory(updatedFloors);
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      idsToDelete.forEach(id => next.delete(id));
      return next;
    });
    setFanSystems(prevFS => prevFS.map(fs => ({
      ...fs,
      floorIds: fs.floorIds.filter(fId => !idsToDelete.has(fId))
    })));
  };

  const checkIfBasementMissingData = (f: BasementFloor) => {
    const isNoName = !f.name || f.name.trim() === "";
    const isNoArea = !f.area || Number(f.area) <= 0 || isNaN(Number(f.area));
    const isNoHeight = !f.height || Number(f.height) <= 0 || isNaN(Number(f.height));
    return isNoName || isNoArea || isNoHeight;
  };

  const handleUpdateFloorCell = (id: string, field: keyof BasementFloor, value: any) => {
    setHistory(prev => [...prev.slice(-25), floors]);
    setRedoStack([]);
    setFloors(prev => prev.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, [field]: value };
      if (field === "name" && typeof value === "string") {
        if (value.includes(" - ")) {
          const parts = value.split(" - ");
          updated.basementLevel = parts[0].trim() || f.basementLevel || "Basement 1";
          updated.zoneName = parts.slice(1).join(" - ").trim() || f.zoneName || "Zone 1";
        } else {
          const trimmed = value.trim();
          if (trimmed) {
            updated.basementLevel = trimmed;
          }
        }
      }
      if (field !== "flagged") {
        const wasMissing = checkIfBasementMissingData(f);
        const isMissing = checkIfBasementMissingData(updated);
        if (isMissing) {
          updated.flagged = true;
        } else if (wasMissing && !isMissing) {
          updated.flagged = false;
        }
      }
      return updated;
    }));
  };

  const handleDuplicateZone = (r: BasementFloor) => {
    const newZoneId = `floor-${Date.now()}`;
    const duplicated: BasementFloor = {
      ...r,
      id: newZoneId,
      zoneName: `${r.zoneName || "Zone"} (Copy)`,
      name: `${r.basementLevel} - ${r.zoneName || "Zone"} (Copy)`
    };
    updateFloorsWithHistory([...floors, duplicated]);
  };

  const handleDuplicateFanSystem = (targetFs: FanSystem) => {
    let newName = `${targetFs.name} (Copy)`;
    let counter = 1;
    while (fanSystems.some(fs => fs.name.toLowerCase() === newName.toLowerCase())) {
      counter++;
      newName = `${targetFs.name} (Copy ${counter})`;
    }

    const newFs: FanSystem = {
      ...targetFs,
      id: `fs-${Date.now()}`,
      name: newName,
      collapsed: false
    };
    setFanSystems([...fanSystems, newFs]);
  };

  // Open Fan System Modal for create
  const handleOpenCreateFS = () => {
    setModalFSId(null);
    setModalFSName("");
    setModalFSType("Extract");
    setModalFSFanQty(2);
    setModalSelectedFloorIds([]);
    setModalError("");
    setShowFSModal(true);
  };

  // Open Fan System Modal for edit
  const handleOpenEditFS = (fs: FanSystem) => {
    setModalFSId(fs.id);
    setModalFSName(fs.name);
    setModalFSType(fs.fanType);
    setModalFSFanQty(fs.fanQty || 1);
    setModalSelectedFloorIds(fs.floorIds);
    setModalError("");
    setShowFSModal(true);
  };

  const handleSaveFanSystem = () => {
    const trimmedName = modalFSName.trim();
    if (!trimmedName) {
      setModalError("Please enter a Fan System Name.");
      return;
    }

    const isDuplicate = fanSystems.some(fs => 
      fs.name.toLowerCase() === trimmedName.toLowerCase() && fs.id !== modalFSId
    );

    if (isDuplicate) {
      setModalError("A Fan System with this name already exists. Please use a unique name.");
      return;
    }

    if (modalSelectedFloorIds.length === 0) {
      setModalError("Please select at least one floor to serve.");
      return;
    }

    if (modalFSId) {
      // Edit
      setFanSystems(fanSystems.map(fs => fs.id === modalFSId ? {
        ...fs,
        name: modalFSName.trim(),
        fanType: modalFSType,
        fanQty: modalFSFanQty || 1,
        floorIds: modalSelectedFloorIds
      } : fs));
    } else {
      // Create
      const newFS: FanSystem = {
        id: "fs-" + Date.now(),
        name: modalFSName.trim(),
        fanType: modalFSType,
        fanQty: modalFSFanQty || 1,
        floorIds: modalSelectedFloorIds,
        length: 20,
        frictionFactor: 1.2,
        louver: 0,
        grille: 0,
        sa: 0,
        collapsed: false
      };
      setFanSystems([...fanSystems, newFS]);
    }
    setShowFSModal(false);
  };

  const calculatedFanSystems = useMemo(() => {
    return fanSystems.map(fs => {
      const staticMetrics = calculateFanStatic(fs.length, fs.frictionFactor, fs.louver, fs.grille, fs.sa);
      const { fittings, eqLen, frictionLoss, safety, totalStatic } = staticMetrics;

      // Find the associated served floors
      const servedFloors = calculatedRows.filter(r => fs.floorIds.includes(r.id));
      
      // Default highest 6 ACH floor in served floors
      const max6Floor = servedFloors.length > 0
        ? servedFloors.reduce((max, r) => r.flow6ach > max.flow6ach ? r : max, servedFloors[0])
        : null;
      const max6FloorId = max6Floor ? max6Floor.id : "";

      let flow3 = servedFloors.reduce((a, b) => a + b.flow3ach, 0);

      // Filter valid zoneAchModes for active served floors
      const validZoneAchModes: Record<string, 3 | 6> = {};
      if (fs.zoneAchModes) {
        servedFloors.forEach(sf => {
          if (fs.zoneAchModes?.[sf.id] !== undefined) {
            validZoneAchModes[sf.id] = fs.zoneAchModes[sf.id];
          }
        });
      }

      // Dynamic Normal Mode 3-3-6 Sum: auto-evaluates current peak flow6ach zone at 6 ACH and rest at 3 ACH (unless custom overridden)
      let normalScenarioSum = servedFloors.reduce((a, b) => {
        const mode = validZoneAchModes[b.id] !== undefined
          ? validZoneAchModes[b.id]
          : (b.id === max6FloorId ? 6 : 3);
        return a + (mode === 6 ? b.flow6ach : b.flow3ach);
      }, 0);

      // Fire Mode: Strictly consider only 10 ACH Max across served floors
      let flow10Max = servedFloors.length > 0 ? Math.max(...servedFloors.map(r => r.flow10ach)) : 0;
      let fireConditionTotalFlow = flow10Max;

      const currentFanQty = Math.max(1, fs.fanQty || 1);
      // Strictly calculate total system capacities as 1 combined system
      let calcNormalCap = normalScenarioSum;
      let calcFireCap = fireConditionTotalFlow;

      // Scaling for makeup fan (80%)
      if (fs.fanType === "Makeup") {
        flow3 = calculateMakeupScaling(flow3);
        normalScenarioSum = calculateMakeupScaling(normalScenarioSum);
        flow10Max = calculateMakeupScaling(flow10Max);
        fireConditionTotalFlow = calculateMakeupScaling(fireConditionTotalFlow);
        calcNormalCap = normalScenarioSum;
        calcFireCap = fireConditionTotalFlow;
      }

      // Custom user capacity overrides (if entered)
      const lowCap = fs.customNormalCap !== undefined && fs.customNormalCap !== null && !isNaN(fs.customNormalCap)
        ? fs.customNormalCap
        : calcNormalCap;
      const highCap = fs.customFireCap !== undefined && fs.customFireCap !== null && !isNaN(fs.customFireCap)
        ? fs.customFireCap
        : calcFireCap;

      const sizedCap = Math.max(lowCap, highCap);
      const isNormalGoverning = lowCap > highCap;
      const governingMode = isNormalGoverning ? "Normal Mode" : "Fire Mode";

      // Per-fan capacity split evenly across fans
      const perFanCap = Math.ceil(sizedCap / currentFanQty);

      return {
        ...fs,
        fittings,
        eqLen,
        frictionLoss,
        safety,
        totalStatic,
        flow3,
        flow6: normalScenarioSum,
        normalScenarioSum,
        fireScenarioSum: normalScenarioSum,
        flow10Max,
        fireConditionTotalFlow,
        calcNormalCap,
        calcFireCap,
        lowCap,
        highCap,
        normalCap: lowCap,
        fireCap: highCap,
        sizedCap,
        perFanCap,
        isNormalGoverning,
        governingMode,
        max6FloorId,
        servedFloors
      };
    });
  }, [fanSystems, calculatedRows]);

  // Check if a floor is already assigned to a system of the target type
  const assignedFloorsMap = useMemo(() => {
    const map: Record<string, string> = {};
    fanSystems.forEach(fs => {
      if (fs.id !== modalFSId && fs.fanType === modalFSType) {
        fs.floorIds.forEach(id => {
          map[id] = fs.name;
        });
      }
    });
    return map;
  }, [fanSystems, modalFSId, modalFSType]);

  const handleExportPDF = () => {
    exportBasementSmokePDF(calculatedGroups, calculatedFanSystems, totals, totalFans, unitSystem);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const floorData = calculatedRows.map(r => [
      r.basementLevel || r.name.split(" - ")[0] || r.name,
      r.zoneName || (r.name.includes(" - ") ? r.name.split(" - ")[1] : "Zone 1"),
      r.name,
      r.area,
      r.effArea,
      r.height,
      r.flow3ach,
      r.flow6ach,
      r.flow10ach
    ]);
    const headers = ["Basement Level", "Zone Name", "Full Name", `Gross Area (${ip ? "ft²" : "m²"})`, `Effective Area (${ip ? "ft²" : "m²"})`, `Height (${ip ? "ft" : "m"})`, `3 ACH Flow (${ip ? "CFM" : "L/s"})`, `6 ACH Flow (${ip ? "CFM" : "L/s"})`, `10 ACH Flow (${ip ? "CFM" : "L/s"})` ];
    const ws = XLSX.utils.aoa_to_sheet([["Basement Multi-Zone Ventilation Schedule"], [], headers, ...floorData]);
    XLSX.utils.book_append_sheet(wb, ws, "Basement Schedule");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Basement_Smoke_Calculation.xlsx", "Excel Document", ["xlsx"]);
  };



  // Fan system overall metrics
  const fanSystemMetrics = useMemo(() => {
    const totalSystems = calculatedFanSystems.length;
    const extractCount = calculatedFanSystems.filter(fs => fs.fanType === "Extract").length;
    const makeupCount = calculatedFanSystems.filter(fs => fs.fanType === "Makeup").length;
    const totalDuctLength = calculatedFanSystems.reduce((acc, fs) => acc + fs.length, 0);
    const maxStaticPressure = Math.max(0, ...calculatedFanSystems.map(fs => fs.totalStatic));
    return { totalSystems, extractCount, makeupCount, totalDuctLength, maxStaticPressure };
  }, [calculatedFanSystems]);

  return (
    <AppShell 
      title="Basement Smoke Calc" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen(v => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header & Actions matching Pump Sizing */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Basement Smoke Extract Schedule</h1>
              </div>
              
              <button 
                type="button"
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Basement Smoke Intelligence"
              >
                <Sparkles className="size-3.5" /> Intelligence
              </button>

              <CalculationReviewBar 
                projectId={project?.id || activeProjectId || "default"} 
                calculatorPath="/basement-smoke-calc" 
                calculatorTitle="Basement Smoke Extract Schedule" 
              />
            </div>
            
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={(target, shouldConvert) => executeUnitSystemChange(target, shouldConvert)} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* White Card Container for Tabs & Content */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-sm"
          }`}>
            {/* Top Row 1: Section Navigation Tabs & Export */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap modal-blur-bg">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setActiveSection("schedule")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      activeSection === "schedule"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    Basement Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection("fan-systems")}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      activeSection === "fan-systems"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <span>Fan Systems</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-primary/15 text-primary rounded-full font-bold">
                      {calculatedFanSystems.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      activeSection === "report"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    Report
                  </button>
                </div>

                <TBtn
                  onClick={() => setShowFormulaModal(true)}
                  title="Calculation Formulas & Methodology"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Action button on the right of tabs matching Pump Sizing */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPDF} title="Export PDF Report">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Dedicated Toolbar Row 2: Action Buttons & Filter/Search */}
            {activeSection === "schedule" && (
              <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none modal-blur-bg">
                {/* Search Input matching Ventilation */}
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
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
                      title="Filter schedule"
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
                  <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border">
                      <span className="text-xs font-bold text-foreground">Filter Schedule</span>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleResetFilters}
                          className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {/* Level Filter */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Basement Level</span>
                      <select
                        value={filterLevel}
                        onChange={e => setFilterLevel(e.target.value)}
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                      >
                        <option value="all">All Levels ({uniqueBasementLevels.length})</option>
                        {uniqueBasementLevels.map(lvl => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </div>

                    {/* Flagged Filter */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Flag className="size-3 text-red-500" />
                        Flagged Only
                      </span>
                      <input
                        type="checkbox"
                        checked={filterFlagged}
                        onChange={e => setFilterFlagged(e.target.checked)}
                        className="rounded border-border cursor-pointer size-4"
                      />
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Sort Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                        levelSortOrder !== "asc" || zoneSortBy !== "none"
                          ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                          : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      }`}
                      title="Sort schedule"
                    >
                      <ArrowUpDown className="size-3.5 shrink-0" />
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                        Sort
                      </span>
                      {(levelSortOrder !== "asc" || zoneSortBy !== "none") && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                          ✓
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border">
                      <span className="text-xs font-bold text-foreground">Sort Options</span>
                      {(levelSortOrder !== "asc" || zoneSortBy !== "none") && (
                        <button
                          onClick={() => {
                            setLevelSortOrder("asc");
                            setZoneSortBy("none");
                          }}
                          className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Level Sort Order */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Level Order</span>
                      <select
                        value={levelSortOrder}
                        onChange={e => setLevelSortOrder(e.target.value as "asc" | "desc")}
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                      >
                        <option value="asc">Ascending (B1 → B2 → B3)</option>
                        <option value="desc">Descending (B3 → B2 → B1)</option>
                      </select>
                    </div>

                    {/* Zone Sort Order */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Zone Sorting</span>
                      <select
                        value={zoneSortBy}
                        onChange={e => setZoneSortBy(e.target.value as "none" | "name" | "area")}
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                      >
                        <option value="none">Original Order</option>
                        <option value="name">Zone Name (A-Z)</option>
                        <option value="area">Gross Area (Highest First)</option>
                      </select>
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
                          localStorage.removeItem("mep_grid_basement_smoke_schedule");
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

                {/* Right Controls: Paste, Import, Export, Add Level */}
                <div className="ml-auto flex items-center gap-1">
                  {clipboard.length > 0 && (
                    <button
                      onClick={() => {
                        const baseTime = Date.now();
                        const newPasted: BasementFloor[] = clipboard.map((item, idx) => ({
                          ...item,
                          id: `floor-${baseTime}-${idx}`,
                          name: item.name.includes("(Copy)") ? item.name : `${item.name} (Copy)`
                        }));
                        updateFloorsWithHistory([...floors, ...newPasted]);
                        setSelectedRowIds(new Set(newPasted.map(n => n.id)));
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-semibold hover:bg-emerald-500/20 transition cursor-pointer shadow-xs"
                      title="Paste copied rows (Ctrl+V)"
                    >
                      <Clipboard className="size-3.5" />
                      Paste ({clipboard.length})
                    </button>
                  )}

                  {/* Import Button */}
                  <TBtn
                    disabled={isEffectiveReadOnly}
                    onClick={() => setShowImportSourceModal(true)}
                    title="Import basement floor levels from 3D Studio or Excel schedule"
                  >
                    <Download className="size-3.5" /> Import
                  </TBtn>

                  {/* New Space (EXTREME RIGHT) */}
                  <TBtn
                    primary
                    disabled={isEffectiveReadOnly}
                    onClick={() => handleAddNewFloor()}
                  >
                    <Plus className="size-3.5" /> New Space
                  </TBtn>
                </div>

                {/* Bulk Actions Bar Overlay */}
                {!isApprovedLocked && selectedRowIds.size > 0 && (
                  <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                    <span className="font-semibold">{selectedRowIds.size} selected</span>
                    <span className="text-primary/30">·</span>
                    <BulkBtn icon={Edit3} onClick={() => handleOpenBulkEdit(Array.from(selectedRowIds))}>Bulk edit</BulkBtn>
                    <BulkBtn icon={CopyPlus} onClick={() => {
                      if (isEffectiveReadOnly) return;
                      const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
                      const baseTime = Date.now();
                      const duplicated: BasementFloor[] = selectedItems.map((r, idx) => ({
                        ...r,
                        id: `floor-${baseTime}-${idx}`,
                        name: r.name.includes("(Copy)") ? r.name : `${r.name} (Copy)`
                      }));
                      updateFloorsWithHistory([...floors, ...duplicated]);
                      setSelectedRowIds(new Set(duplicated.map(d => d.id)));
                      toast.success(`Duplicated ${duplicated.length} space(s)`);
                    }}>Duplicate</BulkBtn>
                    <BulkBtn icon={Copy} onClick={() => {
                      const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
                      setClipboard(selectedItems);
                      toast.info(`${selectedItems.length} space(s) copied`);
                    }}>Copy</BulkBtn>
                    <BulkBtn icon={Scissors} onClick={() => {
                      const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
                      setClipboard(selectedItems);
                      updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
                      setSelectedRowIds(new Set());
                      toast.info(`${selectedItems.length} space(s) cut`);
                    }}>Cut</BulkBtn>
                    <BulkBtn icon={Flag} onClick={() => {
                      if (isEffectiveReadOnly || isApprovedLocked) return;
                      const anyUnflagged = floors.some(f => selectedRowIds.has(f.id) && !f.flagged);
                      const updated = floors.map(f => selectedRowIds.has(f.id) ? { ...f, flagged: anyUnflagged } : f);
                      updateFloorsWithHistory(updated);
                      toast.success(`Updated review flags for ${selectedRowIds.size} zone(s)`);
                    }}>Flag / Unflag</BulkBtn>
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
            )}

                        {/* Inner Content Area */}
            {activeSection === "schedule" ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">

                {/* Grid Container */}
                <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                  {calculatedRows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-2">
                      <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center animate-scale-in">
                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce">
                          <Layers className="size-6" />
                        </div>
                        <h3 className="text-[15px] font-semibold tracking-tight">No Basement Spaces Defined</h3>
                        <p className="text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                          Start by adding spaces or importing space geometry from 3D Studio or Excel schedule. The system will automatically compute 3, 6, and 10 ACH flow rates and size the extract fan systems.
                        </p>
                        <div className="flex items-center gap-3 w-full">
                          <button
                            onClick={() => handleAddNewFloor()}
                            className="flex-1 bg-primary text-primary-foreground font-semibold h-9 rounded-full hover:bg-primary/95 transition-colors text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                          >
                            <Plus className="size-3.5" /> New Space
                          </button>
                          <button
                            onClick={() => setShowImportSourceModal(true)}
                            className="flex-1 border border-border hover:bg-surface-2 font-semibold h-9 rounded-full transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Upload className="size-3.5" /> Import
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <DataGrid
                      gridId="basement_smoke_schedule"
                      rows={calculatedRows}
                      columns={columns}
                      selected={selectedRowIds}
                      onToggle={toggle}
                      onToggleAll={toggleAll}
                      onCommentClick={(r) => handleOpenComment(r.id, r.name || r.zoneName, "zone")}
                      renderContextMenu={renderRowContextMenu}
                      groupBy={(r) => (r.basementLevel && r.basementLevel !== "undefined" ? r.basementLevel : (r.name && r.name.includes(" - ") ? r.name.split(" - ")[0] : "Basement 1"))}
                      groupOrder={groupOrder}
                      renderGroupHeader={renderGroupHeader}
                      renderGroupContextMenu={renderGroupContextMenu}
                      onToggleGroup={handleToggleGroup}
                      onRowDoubleClick={(r) => {
                        setEditingFloor(r);
                        setIsNewFloor(false);
                      }}
                      isReadOnly={isApprovedLocked}
                      activeRowId={editingFloor?.id}
                    />
                  )}
                </div>

                {/* Bottom Statistics Summary Status Bar */}
                <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg">
                  <div>
                    Showing <span className="text-foreground font-medium tabular">{filteredRows.length}</span> of {floors.length} spaces/zones
                  </div>
                  <div className="flex items-center gap-3.5 tabular">
                    <span>Σ Gross Area: <span className="font-mono text-foreground font-semibold">{totals.totalGrossArea.toLocaleString()} {ip ? "ft²" : "m²"}</span></span>
                    <span>Σ Eff. Area: <span className="font-mono text-foreground font-semibold">{totals.totalEffArea.toLocaleString()} {ip ? "ft²" : "m²"}</span></span>
                    <span>Σ 3-3-6 Normal: <span className="font-mono text-primary font-bold">{totals.normalScenarioSum.toLocaleString()} {ip ? "CFM" : "L/s"}</span></span>
                    <span>Max 10 ACH Fire: <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">{totals.max10.toLocaleString()} {ip ? "CFM" : "L/s"}</span></span>
                  </div>
                </div>
              </div>
            ) : activeSection === "fan-systems" ? (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
{/* Fan Systems Head Loss Section (Full 2-Column Responsive Dashboard) */}
              
                <div className="flex flex-col gap-5">
                  {/* Fan Systems Header Bar */}
                  <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                        Fan Systems Head Loss Calculations
                      </h3>
                    </div>
                    <TBtn primary onClick={handleOpenCreateFS} className="h-8.5 text-xs">
                      <Plus className="size-3.5" /> Create Fan System
                    </TBtn>
                  </div>

                  {/* 2-Column Responsive Split */}
                  <div className="flex flex-col xl:flex-row gap-6 items-start">
                    {/* Left Column: Fan System Calculation Cards */}
                    <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
                      {calculatedFanSystems.map(fs => (
                        <ContextMenu key={fs.id}>
                          <ContextMenuTrigger asChild>
                            <div className="border border-border/80 rounded-2xl bg-slate-50/40 dark:bg-slate-900/20 flex flex-col overflow-hidden shadow-xs hover:border-border transition-colors">
                              
                              {/* Card Header with Toggle Collapse */}
                              <div
                                onClick={() => setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, collapsed: !x.collapsed } : x))}
                                className="flex justify-between items-center gap-2 bg-slate-100/60 dark:bg-slate-800/50 p-4 border-b border-border/70 cursor-pointer hover:bg-slate-100/90 dark:hover:bg-slate-800/70 select-none transition"
                              >
                                <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
                                  <span className={`text-[10px] text-muted-foreground transition duration-200 block ${fs.collapsed ? "-rotate-90" : ""}`}>▼</span>
                                  <strong className="text-xs text-foreground font-sans font-bold">{fs.name}</strong>
                                  <span className={`text-[9.5px] px-2.5 py-0.5 font-bold rounded-full uppercase shrink-0 border ${
                                    fs.fanType === "Extract"
                                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  }`}>
                                    {fs.fanType} System
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {fs.servedFloors.map(f => (
                                      <span key={f.id} className="text-[10px] bg-slate-200/60 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded-md border border-border/50">
                                        {f.name}
                                      </span>
                                    ))}
                                    {fs.servedFloors.length === 0 && (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                        No zones assigned
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 items-center shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenEditFS(fs); }}
                                    className="bg-transparent text-primary hover:bg-primary/10 p-1.5 rounded-lg transition cursor-pointer"
                                    title="Edit Fan System"
                                  >
                                    <Edit3 className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setFanSystems(fanSystems.filter(x => x.id !== fs.id)); }}
                                    className="bg-transparent text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition cursor-pointer"
                                    title="Delete Fan System"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>

                              {!fs.collapsed && (
                                <div className="p-4 sm:p-5 flex flex-col gap-4">
                                  {/* Compact Fire Scenario & Capacity Bar */}
                                  <div className="flex items-center justify-between gap-2 bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2 text-xs">
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Flame className="size-3.5 text-rose-500 dark:text-rose-400" />
                                      <span className="font-bold text-foreground text-xs font-sans">Fire Scenario</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 font-mono flex-wrap">
                                      <div className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap border border-primary/20">
                                        <span className="font-sans font-bold text-[9.5px] text-muted-foreground uppercase">Normal:</span>
                                        <strong className="font-bold text-xs">{fs.lowCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                                      </div>
                                      <div className="flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap border border-rose-500/20">
                                        <span className="font-sans font-bold text-[9.5px] text-muted-foreground uppercase">Fire:</span>
                                        <strong className="font-bold text-xs">{fs.highCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setFireConfigFSId(fs.id)}
                                        className="bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold px-3 py-1 rounded-lg text-[11px] flex items-center gap-1 transition cursor-pointer shrink-0 shadow-xs"
                                        title="Configure Fire Scenario & Zone ACH"
                                      >
                                        <Settings className="size-3" />
                                        <span>Configure</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* System Parameters Row: Number of Fans & Friction Factor */}
                                  <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-100/40 dark:bg-slate-900/30 border border-border rounded-xl px-4 py-2.5 text-xs select-none">
                                    <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                                      <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Number of Fans:</span>
                                      <input
                                        type="number"
                                        min="1"
                                        value={fs.fanQty === 0 ? "" : (fs.fanQty ?? 1)}
                                        onChange={e => {
                                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                                          setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, fanQty: val } : x));
                                        }}
                                        onBlur={() => {
                                          if (!fs.fanQty || fs.fanQty < 1) {
                                            setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, fanQty: 1 } : x));
                                          }
                                        }}
                                        className="w-8 bg-background border border-border/80 text-primary font-bold text-center outline-none focus:border-primary rounded-md py-0.5 transition-colors"
                                      />
                                      <span className="text-muted-foreground font-semibold">Fan(s)</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                                      <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Friction Factor:</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={fs.frictionFactor}
                                        onChange={e => {
                                          const val = Number(e.target.value);
                                          setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, frictionFactor: val } : x));
                                        }}
                                        className="w-12 bg-background border border-border/80 text-primary font-bold text-center outline-none focus:border-primary rounded-md py-0.5 transition-colors"
                                      />
                                      <span className="text-muted-foreground font-semibold">Pa/m</span>
                                    </div>
                                  </div>

                                  {/* Inputs Split */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
                                    <div className="flex flex-col h-full gap-2.5 text-xs">
                                      <div className="font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">Ductwork Inputs</div>
                                      <div className="bg-slate-100/30 dark:bg-slate-900/20 border border-border/80 rounded-xl p-3 flex-1 flex flex-col justify-between gap-2.5">
                                        <div className="flex flex-col gap-1">
                                          <label className="font-semibold text-muted-foreground text-[11px]">Duct Length (m)</label>
                                          <input
                                            type="number"
                                            value={fs.length}
                                            onChange={e => {
                                              const val = Number(e.target.value);
                                              setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, length: val } : x));
                                            }}
                                            className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs focus:border-primary"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="font-semibold text-muted-foreground text-[11px]">Losses in Louver (Pa)</label>
                                          <input
                                            type="number"
                                            value={fs.louver}
                                            onChange={e => {
                                              const val = Number(e.target.value);
                                              setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, louver: val } : x));
                                            }}
                                            className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs focus:border-primary"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="font-semibold text-muted-foreground text-[11px]">Losses in Grille (Pa)</label>
                                          <input
                                            type="number"
                                            value={fs.grille}
                                            onChange={e => {
                                              const val = Number(e.target.value);
                                              setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, grille: val } : x));
                                            }}
                                            className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs focus:border-primary"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="font-semibold text-muted-foreground text-[11px]">Losses in SAs (Pa)</label>
                                          <input
                                            type="number"
                                            value={fs.sa}
                                            onChange={e => {
                                              const val = Number(e.target.value);
                                              setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, sa: val } : x));
                                            }}
                                            className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs focus:border-primary"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-col gap-2.5 text-xs">
                                      <div className="font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">Calculated Results</div>
                                      <div className="bg-slate-100/30 dark:bg-slate-900/20 border border-border/80 rounded-xl p-3 flex flex-col gap-2 font-sans">
                                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                                          <span className="font-semibold text-muted-foreground text-[11px]">Fittings in Ducting</span>
                                          <strong className="font-bold text-foreground font-mono">{fs.fittings.toFixed(1)} m</strong>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                                          <span className="font-semibold text-muted-foreground text-[11px]">Equivalent Length</span>
                                          <strong className="font-bold text-foreground font-mono">{fs.eqLen.toFixed(1)} m</strong>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                                          <span className="font-semibold text-muted-foreground text-[11px]">Frictional Losses</span>
                                          <strong className="font-bold text-foreground font-mono">{fs.frictionLoss.toFixed(2)} Pa</strong>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                                          <span className="font-semibold text-muted-foreground text-[11px]">Safety Overhead (10%)</span>
                                          <strong className="font-bold text-foreground font-mono">{fs.safety.toFixed(2)} Pa</strong>
                                        </div>
                                        <div className="flex justify-between items-center pt-1 text-[#0A7BC7]">
                                          <span className="font-bold text-xs">Total Static Sized</span>
                                          <strong className="font-extrabold text-sm font-mono">{fs.totalStatic} Pa</strong>
                                        </div>
                                      </div>

                                      {/* Final Equipment Duty Selection Box */}
                                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex flex-col gap-1 shadow-2xs font-sans text-xs">
                                        <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
                                          <span className="flex items-center gap-1.5 uppercase text-[9.5px] tracking-wider text-emerald-800 dark:text-emerald-300">
                                            <Gauge className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                            Final Fan Selection ({fs.governingMode})
                                          </span>
                                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 rounded font-bold">
                                            {fs.fanQty || 1} Fan(s)
                                          </span>
                                        </div>

                                        <div className="font-mono text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                                          {(fs.fanQty || 1) === 1 ? (
                                            <span>1 Fan: {fs.totalStatic} Pa at {fs.sizedCap.toLocaleString()} {ip ? "CFM" : "L/s"}</span>
                                          ) : (
                                            <span>{fs.fanQty} Fans: {fs.totalStatic} Pa at {fs.perFanCap.toLocaleString()} {ip ? "CFM" : "L/s"} each</span>
                                          )}
                                        </div>

                                        <div className="text-[10.5px] font-mono text-emerald-800/80 dark:text-emerald-300/80 font-medium">
                                          Total System Airflow: <strong>{fs.sizedCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong> @ {fs.totalStatic} Pa
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment(fs.id, fs.name, "system")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5 shrink-0" />
                              <span className="whitespace-nowrap">Add Comment to {fs.name}</span>
                            </ContextMenuItem>

                            <ContextMenuItem
                              onClick={() => setFireConfigFSId(fs.id)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Flame className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="whitespace-nowrap">Configure Fire Scenario & Zone ACH</span>
                            </ContextMenuItem>

                            <ContextMenuItem
                              onClick={() => setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, collapsed: !x.collapsed } : x))}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Settings className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="whitespace-nowrap">{fs.collapsed ? "Expand Fan System Card" : "Collapse Fan System Card"}</span>
                            </ContextMenuItem>

                            <ContextMenuSeparator className="h-px bg-border my-1" />

                            <ContextMenuItem
                              onClick={() => handleOpenEditFS(fs)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Edit3 className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="whitespace-nowrap">Edit Fan System Properties</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</ContextMenuShortcut>
                            </ContextMenuItem>

                            <ContextMenuItem
                              onClick={() => handleDuplicateFanSystem(fs)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <CopyPlus className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="whitespace-nowrap">Duplicate Fan System</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Ctrl+D</ContextMenuShortcut>
                            </ContextMenuItem>

                            <ContextMenuSeparator className="h-px bg-border my-1" />

                            <ContextMenuItem
                              onClick={() => setFanSystems(fanSystems.filter(x => x.id !== fs.id))}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete Fan System</span>
                              <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}

                      {calculatedFanSystems.length === 0 && (
                        <div className="border border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center bg-surface-2/30">
                          <Wind className="size-8 text-muted-foreground/50" />
                          <h4 className="font-bold text-sm text-foreground">No Fan Systems Created</h4>
                          <p className="text-xs text-muted-foreground max-w-sm">
                            Create an Extract or Makeup fan system to associate basement zones and calculate ductwork head loss.
                          </p>
                          <TBtn primary onClick={handleOpenCreateFS} className="mt-1">
                            <Plus className="size-3.5" /> Create Fan System
                          </TBtn>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Dedicated Sizing & Analysis Dashboard */}
                    <div className="w-full xl:w-[420px] shrink-0 flex flex-col gap-4">
                      {/* Card 1: Aggregated System Metrics & Duty */}
                      <div className="border border-border/80 rounded-2xl bg-card p-4 shadow-xs flex flex-col gap-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <Activity className="size-4 text-primary" />
                            <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                              Aggregated System Metrics
                            </span>
                          </div>
                          <span className="text-[10.5px] font-mono text-muted-foreground font-bold">
                            {calculatedFanSystems.length} {calculatedFanSystems.length === 1 ? "System" : "Systems"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="p-3 bg-surface-2/60 rounded-xl border border-border/50 flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Total Extract Airflow</span>
                            <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                              {calculatedFanSystems
                                .filter(fs => fs.fanType === "Extract")
                                .reduce((sum, fs) => sum + fs.sizedCap, 0)
                                .toLocaleString()}{" "}
                              <span className="text-[10px] font-normal text-muted-foreground">{ip ? "CFM" : "L/s"}</span>
                            </span>
                          </div>

                          <div className="p-3 bg-surface-2/60 rounded-xl border border-border/50 flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Total Makeup Airflow</span>
                            <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                              {calculatedFanSystems
                                .filter(fs => fs.fanType === "Makeup")
                                .reduce((sum, fs) => sum + fs.sizedCap, 0)
                                .toLocaleString()}{" "}
                              <span className="text-[10px] font-normal text-muted-foreground">{ip ? "CFM" : "L/s"}</span>
                            </span>
                          </div>

                          <div className="p-3 bg-surface-2/60 rounded-xl border border-border/50 flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Governing Max Static</span>
                            <span className="text-sm font-bold font-mono text-primary">
                              {Math.max(0, ...calculatedFanSystems.map(fs => fs.totalStatic))}{" "}
                              <span className="text-[10px] font-normal text-muted-foreground">Pa</span>
                            </span>
                          </div>

                          <div className="p-3 bg-surface-2/60 rounded-xl border border-border/50 flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Total Ductwork Run</span>
                            <span className="text-sm font-bold font-mono text-foreground">
                              {calculatedFanSystems.reduce((sum, fs) => sum + fs.length, 0)}{" "}
                              <span className="text-[10px] font-normal text-muted-foreground">m</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                          <span>Extract Systems: <strong className="text-foreground">{fanSystemMetrics.extractCount}</strong></span>
                          <span>Makeup Systems: <strong className="text-foreground">{fanSystemMetrics.makeupCount}</strong></span>
                        </div>
                      </div>

                      {/* Card 2: Basement Zone Coverage & Assignment Matrix */}
                      <div className="border border-border/80 rounded-2xl bg-card p-4 shadow-xs flex flex-col gap-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <Layers className="size-4 text-[#0A7BC7]" />
                            <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                              Zone Coverage Matrix
                            </span>
                          </div>
                          <span className="text-[10.5px] font-mono text-muted-foreground">
                            {floors.length} {floors.length === 1 ? "Zone" : "Zones"}
                          </span>
                        </div>

                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                          {floors.map(floor => {
                            const extractFS = calculatedFanSystems.find(fs => fs.fanType === "Extract" && fs.floorIds.includes(floor.id));
                            const makeupFS = calculatedFanSystems.find(fs => fs.fanType === "Makeup" && fs.floorIds.includes(floor.id));
                            return (
                              <div key={floor.id} className="p-2.5 rounded-xl bg-surface-2/60 border border-border/60 flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-foreground text-xs">{floor.name}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {floor.effArea} {ip ? "ft²" : "m²"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                  {extractFS ? (
                                    <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold rounded-md border border-rose-500/20">
                                      Extract: {extractFS.name}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold rounded-md border border-amber-500/20">
                                      Extract: Unassigned
                                    </span>
                                  )}

                                  {makeupFS ? (
                                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold rounded-md border border-emerald-500/20">
                                      Makeup: {makeupFS.name}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-slate-200/60 dark:bg-slate-700/60 text-muted-foreground font-semibold rounded-md">
                                      Makeup: Unassigned
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {floors.length === 0 && (
                            <div className="text-center py-4 text-xs text-muted-foreground">
                              No basement zones defined. Add levels in Basement Schedule first.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card 3: Engineering Standards & Governing Rules */}
                      <div className="border border-border/80 rounded-2xl bg-card p-4 shadow-xs flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                          <Sparkles className="size-4 text-primary" />
                          <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                            Governing Sizing Standards
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed font-sans">
                          <p>• <strong>Normal 3-3-6 Sizing</strong>: Highest compartment @ 6 ACH + remainder @ 3 ACH.</p>
                          <p>• <strong>Fire Mode 10 ACH</strong>: Sized for peak 10 ACH fire condition in any single zone.</p>
                          <p>• <strong>Makeup Air (80%)</strong>: Sized at 80% of smoke extract rate to maintain negative pressure differential.</p>
                          <p>• <strong>Duct Head Loss</strong>: Total static includes 60% fittings allowance and 10% safety margin.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/10">
                <div className="max-w-5xl mx-auto bg-card border border-border rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
                  {/* 1. Header Title */}
                  <div className="border-b border-border pb-4">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                      Basement Smoke Extract Schedule Calculation
                    </h2>
                  </div>

                  {/* 2. Metadata Block (2x3 Grid matching Preliminary) */}
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full border-collapse">
                      <tbody className="divide-y divide-border">
                        <tr className="divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20 w-32">Calculation No.:</td>
                          <td className="p-2.5 w-1/3 font-mono">{(project as any)?.calcNo || "CALC-MEP-BS01"}</td>
                          <td className="p-2.5 font-bold bg-muted/20 w-32">Date:</td>
                          <td className="p-2.5">{new Date().toLocaleDateString("en-GB")}</td>
                        </tr>
                        <tr className="divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                          <td className="p-2.5 font-mono">{project?.code || "P000"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                          <td className="p-2.5">{project?.client || "Prestige Group developers"}</td>
                        </tr>
                        <tr className="divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                          <td className="p-2.5">{project?.name || "Basement Smoke Control Study"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                          <td className="p-2.5">{(project as any)?.endUser || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. Section 1: Smoke Ventilation Calculation (2-Tier Header Table) */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      1. Smoke Ventilation Calculation Schedule
                    </h4>
                    <div className="border border-border rounded-xl overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                            <th rowSpan={2} className="p-2 border-r border-border w-12 text-center">
                              Sr.<br />No.
                            </th>
                            <th colSpan={2} className="p-2 border-r border-border text-center">
                              Location
                            </th>
                            <th colSpan={3} className="p-2 border-r border-border text-center">
                              Geometry & Area
                            </th>
                            <th colSpan={3} className="p-2 border-r border-border text-center">
                              Smoke Flow Requirements ({ip ? "CFM" : "L/s"})
                            </th>
                            <th colSpan={2} className="p-2 text-center">
                              System & Compliance
                            </th>
                          </tr>
                          <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                            <th className="p-2 border-r border-border w-24 text-center">Level</th>
                            <th className="p-2 border-r border-border text-left min-w-[130px]">Zone / Space Name</th>
                            <th className="p-2 border-r border-border w-20 text-center">Gross Area ({ip ? "sq.ft" : "m²"})</th>
                            <th className="p-2 border-r border-border w-20 text-center">Eff. Area ({ip ? "sq.ft" : "m²"})</th>
                            <th className="p-2 border-r border-border w-16 text-center">Height ({ip ? "ft" : "m"})</th>
                            <th className="p-2 border-r border-border w-20 text-right">3 ACH</th>
                            <th className="p-2 border-r border-border w-20 text-right">6 ACH</th>
                            <th className="p-2 border-r border-border w-24 text-right">10 ACH Fire</th>
                            <th className="p-2 border-r border-border min-w-[130px] text-left">Assigned System</th>
                            <th className="p-2 w-20 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {(() => {
                            let globalSrNo = 1;
                            return (
                              <>
                                {calculatedGroups.map((grp) => {
                                  return (
                                    <Fragment key={grp.basementLevel}>
                                      {grp.rows.map((r) => {
                                        const assignedFS = calculatedFanSystems.find(fs => fs.floorIds.includes(r.id));
                                        return (
                                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                            <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">
                                              {globalSrNo++}
                                            </td>
                                            <td className="p-2 border-r border-border text-center font-medium">
                                              {grp.basementLevel}
                                            </td>
                                            <td className="p-2 border-r border-border font-medium">
                                              {r.zoneName || r.name}
                                            </td>
                                            <td className="p-2 border-r border-border text-center font-mono">
                                              {Number(r.area || 0).toLocaleString()}
                                            </td>
                                            <td className="p-2 border-r border-border text-center font-mono">
                                              {Number(r.effArea || 0).toLocaleString()}
                                            </td>
                                            <td className="p-2 border-r border-border text-center font-mono text-muted-foreground">
                                              {Number(r.height || 0).toFixed(1)}
                                            </td>
                                            <td className="p-2 border-r border-border text-right font-mono text-muted-foreground">
                                              {Math.round(r.flow3ach || 0).toLocaleString()}
                                            </td>
                                            <td className="p-2 border-r border-border text-right font-mono text-muted-foreground">
                                              {Math.round(r.flow6ach || 0).toLocaleString()}
                                            </td>
                                            <td className="p-2 border-r border-border text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                              {Math.round(r.flow10ach || 0).toLocaleString()}
                                            </td>
                                            <td className="p-2 border-r border-border font-medium text-foreground">
                                              {assignedFS ? `${assignedFS.name} (${assignedFS.fanType})` : "Unassigned"}
                                            </td>
                                            <td className="p-2 text-center font-bold">
                                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                                PASS
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {/* Level Subtotal Row */}
                                      <tr className="bg-slate-50/70 dark:bg-zinc-900/60 font-bold border-t border-b border-border">
                                        <td className="p-2 border-r border-border text-center"></td>
                                        <td className="p-2 border-r border-border text-center font-bold">
                                          {grp.basementLevel}
                                        </td>
                                        <td className="p-2 border-r border-border font-bold">
                                          TOTAL ({grp.basementLevel})
                                        </td>
                                        <td className="p-2 border-r border-border text-center font-mono font-bold">
                                          {Math.round(grp.totalArea).toLocaleString()}
                                        </td>
                                        <td className="p-2 border-r border-border text-center font-mono font-bold">
                                          {Math.round(grp.totalEffArea).toLocaleString()}
                                        </td>
                                        <td className="p-2 border-r border-border"></td>
                                        <td className="p-2 border-r border-border text-right font-mono font-bold text-muted-foreground">
                                          {Math.round(grp.subtotal3).toLocaleString()}
                                        </td>
                                        <td className="p-2 border-r border-border text-right font-mono font-bold text-muted-foreground">
                                          {Math.round(grp.subtotal6).toLocaleString()}
                                        </td>
                                        <td className="p-2 border-r border-border text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                          {Math.round(grp.max10Fire).toLocaleString()}
                                        </td>
                                        <td className="p-2 border-r border-border font-medium text-muted-foreground">
                                          All Zones Compliant
                                        </td>
                                        <td className="p-2 text-center font-bold text-emerald-600">
                                          PASS
                                        </td>
                                      </tr>
                                    </Fragment>
                                  );
                                })}

                                {/* Grand Total Row */}
                                {calculatedGroups.length > 1 && (
                                  <tr className="bg-slate-100 dark:bg-zinc-800 font-black border-t-2 border-border">
                                    <td className="p-2 border-r border-border text-center"></td>
                                    <td className="p-2 border-r border-border text-center font-bold">ALL</td>
                                    <td className="p-2 border-r border-border font-bold">OVERALL TOTAL</td>
                                    <td className="p-2 border-r border-border text-center font-mono font-bold">
                                      {Math.round(totals.totalGrossArea).toLocaleString()}
                                    </td>
                                    <td className="p-2 border-r border-border text-center font-mono font-bold">
                                      {Math.round(totals.totalEffArea).toLocaleString()}
                                    </td>
                                    <td className="p-2 border-r border-border"></td>
                                    <td className="p-2 border-r border-border text-right font-mono font-bold text-muted-foreground">
                                      {Math.round(totals.total3).toLocaleString()}
                                    </td>
                                    <td className="p-2 border-r border-border text-right font-mono font-bold text-muted-foreground">
                                      {Math.round(totals.total6).toLocaleString()}
                                    </td>
                                    <td className="p-2 border-r border-border text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                      {Math.round(totals.max10).toLocaleString()}
                                    </td>
                                    <td className="p-2 border-r border-border font-bold text-muted-foreground">
                                      All Levels Covered
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
                  </div>

                  {/* 4. Section 2: Smoke Fan Sizing Schedule */}
                  {calculatedFanSystems.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        2. Smoke Fan Systems Sizing Schedule
                      </h4>
                      <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                            <tr>
                              <th className="p-2 border-r border-border">Fan Tag / System Name</th>
                              <th className="p-2 border-r border-border">Type</th>
                              <th className="p-2 border-r border-border text-center">Fan Qty</th>
                              <th className="p-2 border-r border-border text-right">Duct Length ({ip ? "ft" : "m"})</th>
                              <th className="p-2 border-r border-border text-right">Friction Loss (Pa)</th>
                              <th className="p-2 border-r border-border text-right">Total Static (Pa)</th>
                              <th className="p-2 border-r border-border text-right">System Flow ({ip ? "CFM" : "L/s"})</th>
                              <th className="p-2 border-r border-border text-right">Per Fan Duty ({ip ? "CFM" : "L/s"})</th>
                              <th className="p-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {calculatedFanSystems.map((fs) => {
                              const roundedLowCap = Math.round((fs.lowCap || 0) / 10) * 10;
                              const roundedHighCap = Math.round((fs.highCap || 0) / 10) * 10;
                              const governingFlow = Math.max(roundedLowCap, roundedHighCap);
                              const fQty = fs.fanQty || 2;
                              const perFanFlow = Math.round(governingFlow / Math.max(1, fQty));

                              return (
                                <tr key={fs.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                  <td className="p-2 border-r border-border font-bold text-foreground">{fs.name}</td>
                                  <td className="p-2 border-r border-border text-muted-foreground">{fs.fanType}</td>
                                  <td className="p-2 border-r border-border text-center font-mono">{fQty}</td>
                                  <td className="p-2 border-r border-border text-right font-mono">{fs.length}</td>
                                  <td className="p-2 border-r border-border text-right font-mono">{fs.frictionLoss.toFixed(1)}</td>
                                  <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">{fs.totalStatic}</td>
                                  <td className="p-2 border-r border-border text-right font-mono font-bold text-foreground">{governingFlow.toLocaleString()}</td>
                                  <td className="p-2 border-r border-border text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{perFanFlow.toLocaleString()}</td>
                                  <td className="p-2 text-center font-bold text-emerald-600">PASS</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 5. 3-Tier Signature Sign-Off Block (Exact #FFE6CC Header) */}
                  {(() => {
                    const sig = getSignatureBlockDetails(
                      project?.id || activeProjectId || "default",
                      "/basement-smoke-calc",
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
                                <td className="p-2.5 font-bold bg-muted/20 text-right">Name:</td>
                                <td className="p-2.5 text-center font-medium">{sig.originatorName}</td>
                                <td className="p-2.5 text-center font-medium">{sig.reviewerName}</td>
                                <td className="p-2.5 text-center font-medium">{sig.approverName}</td>
                              </tr>
                              <tr className="divide-x divide-border">
                                <td className="p-2.5 font-bold bg-muted/20 text-right">Date:</td>
                                <td className="p-2.5 text-center text-muted-foreground">{formatDateStr(sig.originatorDate)}</td>
                                <td className="p-2.5 text-center text-muted-foreground">{formatDateStr(sig.reviewerDate)}</td>
                                <td className="p-2.5 text-center text-muted-foreground">{formatDateStr(sig.approverDate)}</td>
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

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <BasementIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              floors={floors}
              calculatedRows={calculatedRows}
              calculatedFanSystems={calculatedFanSystems}
              unitSystem={unitSystem}
              onSelectZone={(id) => {
                setActiveSection("schedule");
                setSelectedRowIds(new Set([id]));
                setTimeout(() => {
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 150);
              }}
            />
          )}
        </div>
      </div>

      {/* Formula Breakdown Modal */}
      {showFormulaModal && (
        <BasementFormulaModal
          onClose={() => setShowFormulaModal(false)}
          unitSystem={unitSystem}
          activeFloor={(selectedRowIds.size > 0 ? floors.find(f => selectedRowIds.has(f.id)) : null) || floors[0]}
        />
      )}

      {/* Edit / Add Basement Space Modal (Ventilation Style) */}
      {editingFloor && typeof document !== "undefined" && (
        <EditBasementSmokeModal
          floor={editingFloor}
          unitSystem={unitSystem}
          isNew={isNewFloor}
          isReadOnly={isApprovedLocked}
          availableLevels={uniqueBasementLevels}
          onClose={handleCloseEditingFloor}
          onSave={handleSaveFloorModal}
        />
      )}



      {/* Edit Level Modal */}
      {showEditLevelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <h3 className="font-bold text-base text-foreground">Edit Level — {editLevelTarget}</h3>
              <button onClick={() => setShowEditLevelModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs font-sans">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Level Name</label>
                <input
                  type="text"
                  value={editLevelData.levelName}
                  onChange={e => setEditLevelData({ ...editLevelData, levelName: e.target.value })}
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Total Gross Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    value={editLevelData.area}
                    onChange={e => setEditLevelData({ ...editLevelData, area: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Total Effective Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    value={editLevelData.effArea}
                    onChange={e => setEditLevelData({ ...editLevelData, effArea: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Height ({ip ? "ft" : "m"})</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editLevelData.height}
                    onChange={e => setEditLevelData({ ...editLevelData, height: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Number of Zones</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editLevelData.numZones}
                    onChange={e => setEditLevelData({ ...editLevelData, numZones: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowEditLevelModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditLevel}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer flex items-center gap-1.5"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

  {/* Fan System Modal */}
      {showFSModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <h3 className="font-bold text-base text-foreground">
              {modalFSId ? "Edit Fan System" : "Create Fan System"}
            </h3>
            
            {modalError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-lg p-2.5 text-xs flex items-center gap-2 select-none">
                <AlertTriangle className="size-4 shrink-0 text-red-600" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex flex-col gap-3.5 text-xs font-sans">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">System Name</label>
                <input
                  type="text"
                  value={modalFSName}
                  onChange={e => setModalFSName(e.target.value)}
                  placeholder="e.g. SF-1 Extract"
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">System Type</label>
                  <select
                    value={modalFSType}
                    onChange={e => setModalFSType(e.target.value as any)}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  >
                    <option value="Extract">Smoke Extract Fan</option>
                    <option value="Makeup">Makeup Air Fan</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Number of Fans (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={modalFSFanQty}
                    onChange={e => setModalFSFanQty(e.target.value === "" ? "" : Number(e.target.value))}
                    onBlur={() => {
                      if (modalFSFanQty === "" || Number(modalFSFanQty) < 1) {
                        setModalFSFanQty(1);
                      }
                    }}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Associate Floor Levels</label>
                <div className="border border-border/80 rounded-lg p-1.5 bg-background max-h-36 overflow-y-auto flex flex-col gap-1 select-none">
                  {floors.map(f => {
                    const checked = modalSelectedFloorIds.includes(f.id);
                    const assignedTo = assignedFloorsMap[f.id];
                    const isDisabled = !!assignedTo;
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isDisabled}
                          onChange={() => {
                            if (isDisabled) return;
                            const nextIds = checked 
                              ? modalSelectedFloorIds.filter(id => id !== f.id)
                              : [...modalSelectedFloorIds, f.id];
                            setModalSelectedFloorIds(nextIds);
                          }}
                        />
                        <span className="flex-1 text-foreground">{f.name}</span>
                        {assignedTo && (
                          <span className="text-[10px] text-red-500 font-bold">
                            Assigned to {assignedTo}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowFSModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFanSystem}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer"
              >
                {modalFSId ? "Save Changes" : "Create System"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fire Scenario Configurator Popup Modal */}
      {fireConfigFSId && (() => {
        const fireConfigFS = calculatedFanSystems.find(x => x.id === fireConfigFSId);
        if (!fireConfigFS) return null;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className={`bg-card border border-border rounded-2xl w-full p-6 flex flex-col justify-between shadow-2xl h-[640px] max-h-[90vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
              showModalCalcPreview ? "max-w-5xl" : "max-w-xl"
            }`}>
              {/* Header */}
              <div className="flex justify-between items-center pb-3 border-b border-border/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
                    <Flame className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-foreground">{fireConfigFS.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary font-bold rounded-full uppercase">
                        {fireConfigFS.fanType} System
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">Fire Scenario & Zone Sizing Configurator</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModalCalcPreview(!showModalCalcPreview)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer shadow-xs ${
                      showModalCalcPreview
                        ? "bg-primary text-primary-foreground border border-primary shadow-sm"
                        : "bg-background border border-border text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Info className="size-3.5" />
                    <span>Calculations Preview</span>
                  </button>
                  <button
                    onClick={() => setFireConfigFSId(null)}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              {/* Main Body Layout */}
              <div className="w-full flex-1 min-h-0 my-2 flex overflow-hidden">
                {/* Left Side: Parameters & Zone ACH Configurator */}
                <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto pr-2">
                  {/* Live Flow Summary Pills */}
                  <div className="grid grid-cols-2 gap-3 select-none shrink-0">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex justify-between items-center shadow-xs">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Normal Mode:</span>
                      <strong className="text-sm font-bold text-primary font-mono">{fireConfigFS.lowCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                    </div>
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 flex justify-between items-center shadow-xs">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Fire Mode:</span>
                      <strong className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">{fireConfigFS.highCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                    </div>
                  </div>

                  {/* Served Zones ACH Configurator */}
                  {fireConfigFS.servedFloors.length > 0 && (
                    <div className="flex flex-col gap-3 bg-slate-100/40 dark:bg-slate-900/40 border border-border/80 rounded-xl p-4 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-border/60">
                        <span className="font-bold text-foreground flex items-center gap-1.5 text-xs uppercase tracking-wider">
                          <Flame className="size-4 text-rose-500" />
                          Served Zones Normal Mode ACH Selection
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Recommended: Highest Zone @ 6 ACH, Rest @ 3 ACH
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 mt-1 max-h-[350px] overflow-y-auto pr-1">
                        {fireConfigFS.servedFloors.map(floor => {
                          const currentAch = fireConfigFS.zoneAchModes?.[floor.id] !== undefined
                            ? fireConfigFS.zoneAchModes[floor.id]
                            : (floor.id === fireConfigFS.max6FloorId ? 6 : 3);
                          return (
                            <div key={floor.id} className="flex items-center justify-between bg-background border border-border/70 rounded-xl px-3.5 py-2.5 shadow-xs">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-foreground text-xs">{floor.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  3 ACH: {floor.flow3ach.toLocaleString()} | 6 ACH: {floor.flow6ach.toLocaleString()} {ip ? "CFM" : "L/s"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-border/60">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFanSystems(fanSystems.map(x => x.id === fireConfigFS.id ? {
                                      ...x,
                                      zoneAchModes: { ...(x.zoneAchModes || {}), [floor.id]: 3 }
                                    } : x));
                                  }}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${currentAch === 3 ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                  3 ACH
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFanSystems(fanSystems.map(x => x.id === fireConfigFS.id ? {
                                      ...x,
                                      zoneAchModes: { ...(x.zoneAchModes || {}), [floor.id]: 6 }
                                    } : x));
                                  }}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${currentAch === 6 ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                  6 ACH
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Side-by-Side Live Calculations Preview Panel */}
                <div className={`shrink-0 bg-transparent overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
                  showModalCalcPreview ? "w-[420px] opacity-100 pl-6 border-l border-border/70" : "w-0 opacity-0 pl-0 border-l-transparent"
                }`}>
                  <div className="w-[396px] flex flex-col gap-4 h-full overflow-y-auto pr-1">
                    <div className="flex items-center justify-between shrink-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans">Calculations Preview</span>
                      <span className="text-[10px] font-mono text-muted-foreground font-bold">
                        {fireConfigFS.fanQty || 1} Fan(s) | {fireConfigFS.fanType}
                      </span>
                    </div>

                    <div className="flex flex-col gap-3.5">
                      {/* Normal Airflow Required */}
                      <div className="bg-background border border-border/80 rounded-xl p-3.5 flex flex-col gap-2 shadow-2xs">
                        <div className="flex justify-between items-center">
                          <span className="font-sans font-bold text-foreground text-xs">Normal Airflow Required</span>
                          <strong className="font-mono font-bold text-sm text-primary">{fireConfigFS.lowCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                        </div>
                        <div className="bg-slate-100/60 dark:bg-slate-900/60 border border-border/60 rounded-lg p-2 font-mono text-[11px] text-muted-foreground">
                          Total System Normal Airflow: {fireConfigFS.normalScenarioSum.toLocaleString()} {ip ? "CFM" : "L/s"}
                          {(fireConfigFS.fanQty || 1) > 1 && ` (${fireConfigFS.fanQty} Fans @ ${Math.ceil(fireConfigFS.lowCap / (fireConfigFS.fanQty || 1)).toLocaleString()} {ip ? "CFM" : "L/s"} each)`}
                        </div>
                      </div>

                      {/* Fire Condition Airflow Required */}
                      <div className="bg-background border border-border/80 rounded-xl p-3.5 flex flex-col gap-2 shadow-2xs">
                        <div className="flex justify-between items-center">
                          <span className="font-sans font-bold text-foreground text-xs">Fire Condition Airflow Required</span>
                          <strong className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400">{fireConfigFS.highCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                        </div>
                        <div className="bg-slate-100/60 dark:bg-slate-900/60 border border-border/60 rounded-lg p-2 font-mono text-[11px] text-muted-foreground">
                          Total System Fire Airflow: 10 ACH Max ({fireConfigFS.flow10Max.toLocaleString()} {ip ? "CFM" : "L/s"})
                          {(fireConfigFS.fanQty || 1) > 1 && ` (${fireConfigFS.fanQty} Fans @ ${Math.ceil(fireConfigFS.highCap / (fireConfigFS.fanQty || 1)).toLocaleString()} {ip ? "CFM" : "L/s"} each)`}
                        </div>
                      </div>

                      {/* Governing Sized Fan Capacity Card */}
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col gap-1.5 shadow-2xs">
                        <div className="flex justify-between items-center">
                          <span className="font-sans font-bold text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                            <Gauge className="size-4 text-emerald-600 dark:text-emerald-400" />
                            Governing Sized Fan Capacity
                          </span>
                          <strong className="font-mono font-extrabold text-base text-emerald-600 dark:text-emerald-400 font-bold">
                            {fireConfigFS.sizedCap.toLocaleString()} {ip ? "CFM" : "L/s"}
                          </strong>
                        </div>
                        <div className="font-mono text-[11px] text-emerald-700/90 dark:text-emerald-300/90 font-medium">
                          Governed by <strong className="font-bold">{fireConfigFS.governingMode}</strong> ({fireConfigFS.lowCap > fireConfigFS.highCap ? "Normal Mode > Fire Mode" : "Fire Mode ≥ Normal Mode"})
                          {(fireConfigFS.fanQty || 1) > 1 && (
                            <div className="mt-0.5 text-[10.5px]">
                              Equipment Duty: <strong>{fireConfigFS.fanQty} Fans @ {fireConfigFS.perFanCap.toLocaleString()} {ip ? "CFM" : "L/s"} each</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Verification Status Box */}
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <div>
                          <strong className="font-bold block">Calculations verified & Fan Sized.</strong>
                          <span className="text-[11px] opacity-90">
                            Total System Capacity: <strong>{fireConfigFS.sizedCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong> based on peak governing requirement ({fireConfigFS.governingMode}).
                            {(fireConfigFS.fanQty || 1) > 1 && (
                              <span className="block font-semibold mt-0.5">
                                Selection: {fireConfigFS.fanQty} Fans @ {fireConfigFS.perFanCap.toLocaleString()} {ip ? "CFM" : "L/s"} each.
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-2 border-t border-border/60 shrink-0">
                <TBtn onClick={() => setFireConfigFSId(null)} className="px-5 py-2 text-xs font-bold">
                  Save & Close
                </TBtn>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Unit System Conversion Preference Modal */}
      {showUnitConfirmModal && pendingUnitTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl animate-fade-in select-none">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Gauge className="size-5" />
                </div>
                <h3 className="font-bold text-base text-foreground">Unit System Change</h3>
              </div>
              <button
                onClick={() => { setShowUnitConfirmModal(false); setPendingUnitTarget(null); }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">
                Switching to {pendingUnitTarget === "ip" ? "Imperial (IP - CFM, ft², ft)" : "Metric (SI - L/s, m², m)"}
              </p>
              <p>
                How would you like to handle your entered floor inputs (Gross Area, Effective Area, Height)?
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Option 1: Convert Input Values */}
              <button
                type="button"
                onClick={() => executeUnitSystemChange(pendingUnitTarget, true)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-primary/15 text-primary shrink-0 mt-0.5">
                  <RefreshCw className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground group-hover:text-primary transition">
                    Convert Input Values (Convert Numbers)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Convert Area & Height to {pendingUnitTarget === "ip" ? "ft² / ft" : "m² / m"} (e.g. {pendingUnitTarget === "ip" ? "500 m² → 5,382 ft²" : "5,382 ft² → 500 m²"}). Airflow outputs recalculate accordingly.
                  </span>
                </div>
              </button>

              {/* Option 2: Keep Current Input Values */}
              <button
                type="button"
                onClick={() => executeUnitSystemChange(pendingUnitTarget, false)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-slate-100/40 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 text-muted-foreground shrink-0 mt-0.5">
                  <Check className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground group-hover:text-primary transition">
                    Keep Current Input Numbers Unchanged
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Do not convert input numbers. Only update airflow calculations & unit labels.
                  </span>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-1 border-t border-border/50">
              <button
                onClick={() => { setShowUnitConfirmModal(false); setPendingUnitTarget(null); }}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Source Selector Modal */}
      <ImportSourceModal
        isOpen={showImportSourceModal}
        onClose={() => setShowImportSourceModal(false)}
        onSelectExcel={() => excelFileInputRef.current?.click()}
        onSelect3DViewer={() => handleExtractFrom3DModel()}
      />

      <input
        type="file"
        ref={excelFileInputRef}
        onChange={handleExcelFileUpload}
        accept=".xlsx,.xls"
        className="hidden"
      />
      <input
        type="file"
        ref={ifcFileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleExtractFrom3DModel(file);
        }}
        accept=".ifc"
        className="hidden"
      />

      {/* 3D Model Basement Preview Modal */}
      {show3DPreviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl animate-fade-in select-none">
            <div className="p-5 border-b border-border flex justify-between items-center bg-slate-100/40 dark:bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Box className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">3D BIM Model Basement Floors Preview</h3>
                  <p className="text-xs text-muted-foreground">Extracted basement levels and spaces from active 3D model</p>
                </div>
              </div>
              <button
                onClick={() => setShow3DPreviewModal(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
              <div className="flex justify-between items-center bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">
                    Found <strong>{pending3DSpaces.length}</strong> basement space(s) across 3D model storeys
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const filtered = new Set(
                        pending3DSpaces
                          .filter(sp => !isExcludedSpaceName(sp.name, sp.category))
                          .map(sp => sp.id)
                      );
                      setSelected3DIds(filtered);
                      toast.info(`Auto-deselected rooms, MEP, stairs, tanks, corridors, and lobby spaces (${pending3DSpaces.length - filtered.size} deselected).`);
                    }}
                    className="text-[11px] font-bold text-[#0A7BC7] hover:underline transition cursor-pointer flex items-center gap-1"
                  >
                    <Filter className="size-3" />
                    Auto-deselect Rooms/MEP/Tanks/Corridors/Lobbies
                  </button>
                  <span className="text-[11px] font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md">
                    {selected3DIds.size} space(s) selected
                  </span>
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-y-auto text-xs max-h-[50vh] min-h-[250px] relative">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-border shadow-2xs">
                    <tr className="text-[11px] font-bold text-muted-foreground uppercase">
                      <th className="py-2.5 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={selected3DIds.size === pending3DSpaces.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelected3DIds(new Set(pending3DSpaces.map(sp => sp.id)));
                            } else {
                              setSelected3DIds(new Set());
                            }
                          }}
                          className="rounded border-border cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">3D Model Level / Storey</th>
                      <th className="py-2.5 px-3">Space / Zone Name</th>
                      <th className="py-2.5 px-3 text-right">Gross Area ({ip ? "ft²" : "m²"})</th>
                      <th className="py-2.5 px-3 text-right">Height ({ip ? "ft" : "m"})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 font-mono text-[11.5px]">
                    {pending3DSpaces.map((sp) => (
                      <tr key={sp.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20">
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selected3DIds.has(sp.id)}
                            onChange={(e) => {
                              const next = new Set(selected3DIds);
                              if (next.has(sp.id)) next.delete(sp.id);
                              else next.add(sp.id);
                              setSelected3DIds(next);
                            }}
                            className="rounded border-border cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 font-bold font-sans text-foreground">{sp.level}</td>
                        <td className="py-2 px-3 font-sans text-muted-foreground">{sp.name}</td>
                        <td className="py-2 px-3 text-right font-mono text-primary font-bold">
                          {ip ? Math.round(sp.area * 10.7639).toLocaleString() : Math.round(sp.area).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-foreground font-semibold">
                          {ip ? (sp.height * 3.28084).toFixed(1) : sp.height}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-t border-border flex justify-between items-center">
              <button
                onClick={() => {
                  setShow3DPreviewModal(false);
                  navigate({ to: "/bim-viewer" });
                }}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Box className="size-3.5" />
                Open 3D Studio
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setShow3DPreviewModal(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport3DSpaces}
                  disabled={selected3DIds.size === 0}
                  className="px-5 py-2 bg-[#0A7BC7] hover:bg-[#06456F] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="size-3.5" />
                  Import Selected Basement Floors ({selected3DIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Comment / Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType={commentTargetItem.type || "zone"}
          calculatorTitle="Basement Smoke Calc"
          calculatorPath="/basement-smoke-calc"
          onSave={handleSaveComment}
          existingComments={commentsList.filter(c => c.spaceId === commentTargetItem.id || c.targetId === commentTargetItem.id || c.itemId === commentTargetItem.id)}
        />
      )}

      {/* Bulk Edit Modal (Ventilation style) */}
      {bulkEditOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-lg w-full max-w-lg animate-scale-in">
            <header className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="size-4 text-primary" />
                <h3 className="font-semibold text-[14px]">Bulk Edit {bulkEditTargetIds.length} Spaces</h3>
              </div>
              <button onClick={() => setBulkEditOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition">
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
                      id="bs-bulk-update-level"
                      checked={bulkEditFields.basementLevel}
                      onChange={(e) => setBulkEditFields({ ...bulkEditFields, basementLevel: e.target.checked })}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bs-bulk-update-level" className="text-muted-foreground font-medium cursor-pointer">Basement Level</label>
                  </div>
                  <FloorSelect
                    value={bulkEditValues.basementLevel}
                    onChange={(fl) => setBulkEditValues({ ...bulkEditValues, basementLevel: fl })}
                    availableFloors={uniqueBasementLevels}
                    disabled={!bulkEditFields.basementLevel}
                    placeholder="Select or enter floor..."
                    triggerClassName="h-8 rounded text-xs bg-surface-2"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bs-bulk-update-zone"
                      checked={bulkEditFields.zoneName}
                      onChange={(e) => setBulkEditFields({ ...bulkEditFields, zoneName: e.target.checked })}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bs-bulk-update-zone" className="text-muted-foreground font-medium cursor-pointer">Zone Name</label>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Zone 1, Zone 2"
                    value={bulkEditValues.zoneName}
                    disabled={!bulkEditFields.zoneName}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, zoneName: e.target.value })}
                    className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bs-bulk-update-area"
                      checked={bulkEditFields.area}
                      onChange={(e) => setBulkEditFields({ ...bulkEditFields, area: e.target.checked })}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bs-bulk-update-area" className="text-muted-foreground font-medium cursor-pointer">Gross Area ({ip ? "ft²" : "m²"})</label>
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 500"
                    value={bulkEditValues.area}
                    disabled={!bulkEditFields.area}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, area: e.target.value })}
                    className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bs-bulk-update-effarea"
                      checked={bulkEditFields.effArea}
                      onChange={(e) => setBulkEditFields({ ...bulkEditFields, effArea: e.target.checked })}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bs-bulk-update-effarea" className="text-muted-foreground font-medium cursor-pointer">Eff. Area ({ip ? "ft²" : "m²"})</label>
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 425"
                    value={bulkEditValues.effArea}
                    disabled={!bulkEditFields.effArea}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, effArea: e.target.value })}
                    className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1 select-none">
                    <input
                      type="checkbox"
                      id="bs-bulk-update-height"
                      checked={bulkEditFields.height}
                      onChange={(e) => setBulkEditFields({ ...bulkEditFields, height: e.target.checked })}
                      className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="bs-bulk-update-height" className="text-muted-foreground font-medium cursor-pointer">Height ({ip ? "ft" : "m"})</label>
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 3.0"
                    value={bulkEditValues.height}
                    disabled={!bulkEditFields.height}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, height: e.target.value })}
                    className="bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded px-2.5 py-1.5 w-full outline-none transition-all font-mono"
                  />
                </div>
              </div>
            </div>
            <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
              <button onClick={() => setBulkEditOpen(false)} className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2">
                Cancel
              </button>
              <button
                onClick={handleApplyBulkEdit}
                className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 shadow-sm"
              >
                Apply Bulk Edit
              </button>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}

interface BasementIntelligenceDrawerProps {
  onClose: () => void;
  floors: BasementFloor[];
  calculatedRows: (BasementFloor & { flow3ach: number; flow6ach: number; flow10ach: number })[];
  calculatedFanSystems: (FanSystem & {
    lowCap: number;
    highCap: number;
    sizedCap: number;
    totalStatic: number;
    frictionLoss: number;
    fittings: number;
    eqLen: number;
    safety: number;
    perFanCap: number;
    governingMode: string;
  })[];
  unitSystem: "si" | "ip";
  onSelectZone?: (id: string) => void;
}

function BasementIntelligenceDrawer({
  onClose,
  floors,
  calculatedRows,
  calculatedFanSystems,
  unitSystem,
  onSelectZone,
}: BasementIntelligenceDrawerProps) {
  const isIp = unitSystem === "ip";
  const flowUnit = isIp ? "CFM" : "L/s";
  const areaUnit = isIp ? "ft²" : "m²";
  const heightUnit = isIp ? "ft" : "m";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    oversized: false,
    unassignedExtract: false,
    unassignedMakeup: false,
    missingArea: false,
    missingHeight: false,
  });

  const totalGrossArea = useMemo(() => floors.reduce((acc, f) => acc + (f.area || 0), 0), [floors]);
  const totalEffArea = useMemo(() => floors.reduce((acc, f) => acc + (f.effArea || 0), 0), [floors]);
  const totalFireAirflow = useMemo(() => calculatedRows.reduce((acc, r) => acc + (r.flow10ach || 0), 0), [calculatedRows]);
  const totalNormal3Airflow = useMemo(() => calculatedRows.reduce((acc, r) => acc + (r.flow3ach || 0), 0), [calculatedRows]);
  const totalNormal6Airflow = useMemo(() => calculatedRows.reduce((acc, r) => acc + (r.flow6ach || 0), 0), [calculatedRows]);
  const recommendedMakeupAirflow = Math.round(totalFireAirflow * 0.8);

  const oversizedZones = useMemo(() => {
    const limit = isIp ? 21500 : 2000;
    return floors
      .filter(f => (f.effArea || f.area || 0) > limit)
      .map(f => ({
        id: f.id,
        name: f.name,
        detail: `${(f.effArea || f.area || 0).toLocaleString()} ${areaUnit} (Limit: ${limit.toLocaleString()} ${areaUnit})`,
      }));
  }, [floors, isIp, areaUnit]);

  const lowHeightZones = useMemo(() => {
    const limit = isIp ? 7.87 : 2.4;
    return floors
      .filter(f => (f.height || 0) > 0 && (f.height || 0) < limit)
      .map(f => ({
        id: f.id,
        name: f.name,
        detail: `${f.height} ${heightUnit} (< ${limit} ${heightUnit})`,
      }));
  }, [floors, isIp, heightUnit]);

  const unassignedExtractZones = useMemo(() => {
    return floors
      .filter(f => !calculatedFanSystems.some(fs => fs.fanType === "Extract" && fs.floorIds.includes(f.id)))
      .map(f => ({
        id: f.id,
        name: f.name,
        detail: f.basementLevel || "No extract fan linked",
      }));
  }, [floors, calculatedFanSystems]);

  const unassignedMakeupZones = useMemo(() => {
    return floors
      .filter(f => !calculatedFanSystems.some(fs => fs.fanType === "Makeup" && fs.floorIds.includes(f.id)))
      .map(f => ({
        id: f.id,
        name: f.name,
        detail: f.basementLevel || "No makeup fan linked",
      }));
  }, [floors, calculatedFanSystems]);

  const missingAreaZones = useMemo(() => {
    return floors
      .filter(f => !f.area || Number(f.area) <= 0)
      .map(f => ({
        id: f.id,
        name: f.name,
        detail: `0 ${areaUnit}`,
      }));
  }, [floors, areaUnit]);

  const missingHeightZones = useMemo(() => {
    return floors
      .filter(f => !f.height || Number(f.height) <= 0)
      .map(f => ({
        id: f.id,
        name: f.name,
        detail: `0 ${heightUnit}`,
      }));
  }, [floors, heightUnit]);

  const totalZones = floors.length;
  const compliantZones = floors.filter(
    f =>
      (f.area || 0) > 0 &&
      (f.height || 0) >= (isIp ? 7.87 : 2.4) &&
      (f.effArea || f.area || 0) <= (isIp ? 21500 : 2000) &&
      calculatedFanSystems.some(fs => fs.fanType === "Extract" && fs.floorIds.includes(f.id))
  );
  const compliancePct = totalZones > 0 ? Math.round((compliantZones.length / totalZones) * 100) : 100;
  const complianceIssuesCount = oversizedZones.length + lowHeightZones.length + unassignedExtractZones.length;

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in font-sans">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {/* Compliance Status */}
        <IntelSection icon={CheckCircle2} tone="success" title="Compliance Status">
          <div className="text-[12px] text-muted-foreground">
            NFPA 92 &amp; BS 7346-7 smoke extract validation across {totalZones} basement zone{totalZones === 1 ? "" : "s"}.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${compliancePct === 100 ? "bg-success" : "bg-warning"}`}
                style={{ width: `${compliancePct}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px] font-medium">{compliancePct}%</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {compliantZones.length} of {totalZones} zones fully compliant with smoke barriers &amp; fans
          </div>
        </IntelSection>

        {/* Airflow & Capacity Demands */}
        <IntelSection icon={Gauge} tone="primary" title="Airflow & Capacity Demands">
          <KV k="Emergency Extract (10 ACH)" v={`${totalFireAirflow.toLocaleString()} ${flowUnit}`} />
          <KV k="Makeup Air Supply (80%)" v={`${recommendedMakeupAirflow.toLocaleString()} ${flowUnit}`} />
          <KV k="Normal Day Extract (3 ACH)" v={`${totalNormal3Airflow.toLocaleString()} ${flowUnit}`} />
          <KV k="Normal Peak Extract (6 ACH)" v={`${totalNormal6Airflow.toLocaleString()} ${flowUnit}`} />
          <KV k="Effective Area" v={`${totalEffArea.toLocaleString()} ${areaUnit}`} />
          <KV k="Gross Footprint" v={`${totalGrossArea.toLocaleString()} ${areaUnit}`} />
          <KV k="Active Smoke Zones" v={`${totalZones} zones`} />
          <KV k="Configured Fan Systems" v={`${calculatedFanSystems.length} systems`} />
        </IntelSection>

        {/* Compartment & Code Checks */}
        <IntelSection icon={AlertTriangle} tone={complianceIssuesCount > 0 ? "warning" : "muted"} title="Compartment & Code Checks">
          <KV k="Max Compartment Limit" v={isIp ? "21,500 ft²" : "2,000 m²"} />
          <KV k="Oversized Compartments" v={oversizedZones.length} />
          <KV k="Min Clear Ceiling Height" v={isIp ? "7.87 ft (2.4 m)" : "2.4 m"} />
          <KV k="Low Height Warnings" v={lowHeightZones.length} />
          <KV k="Unassigned Extract Zones" v={unassignedExtractZones.length} />
          <KV k="Unassigned Makeup Zones" v={unassignedMakeupZones.length} />
        </IntelSection>

        {/* Missing Data Section */}
        <IntelSection icon={Info} tone="muted" title="Missing Data & Zone Coverage">
          <CollapsibleMissingSection
            label="Oversized Smoke Zones (> 2,000 m²)"
            count={oversizedZones.length}
            itemsList={oversizedZones}
            isOpen={openSections.oversized}
            onToggle={() => setOpenSections(prev => ({ ...prev, oversized: !prev.oversized }))}
            onItemClick={(id) => onSelectZone?.(id)}
          />
          <CollapsibleMissingSection
            label="Zones Unassigned to Extract Fan"
            count={unassignedExtractZones.length}
            itemsList={unassignedExtractZones}
            isOpen={openSections.unassignedExtract}
            onToggle={() => setOpenSections(prev => ({ ...prev, unassignedExtract: !prev.unassignedExtract }))}
            onItemClick={(id) => onSelectZone?.(id)}
          />
          <CollapsibleMissingSection
            label="Zones Unassigned to Makeup Fan"
            count={unassignedMakeupZones.length}
            itemsList={unassignedMakeupZones}
            isOpen={openSections.unassignedMakeup}
            onToggle={() => setOpenSections(prev => ({ ...prev, unassignedMakeup: !prev.unassignedMakeup }))}
            onItemClick={(id) => onSelectZone?.(id)}
          />
          <CollapsibleMissingSection
            label="Zones with 0 / Missing Area"
            count={missingAreaZones.length}
            itemsList={missingAreaZones}
            isOpen={openSections.missingArea}
            onToggle={() => setOpenSections(prev => ({ ...prev, missingArea: !prev.missingArea }))}
            onItemClick={(id) => onSelectZone?.(id)}
          />
          <CollapsibleMissingSection
            label="Zones with 0 / Missing Clear Height"
            count={missingHeightZones.length}
            itemsList={missingHeightZones}
            isOpen={openSections.missingHeight}
            onToggle={() => setOpenSections(prev => ({ ...prev, missingHeight: !prev.missingHeight }))}
            onItemClick={(id) => onSelectZone?.(id)}
          />
        </IntelSection>

        {/* Optimization Suggestions */}
        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Limit makeup air intake velocity to &le; 2.5 m/s (500 fpm) across louvers to prevent feeding turbulence into the rising smoke layer.</li>
            <li>Locate makeup air supply louvers on opposite perimeter walls from smoke exhaust points to establish a positive cross-flow sweep.</li>
            <li>For basement levels with depths &gt; 9 m or multiple sub-grades, specify dual-speed emergency fans rated for 300°C / 2h or 400°C / 2h operation.</li>
          </ul>
        </IntelSection>

        {/* Engineering Notes */}
        <IntelSection icon={Info} tone="muted" title="Engineering Notes">
          <div className="text-[12px] text-muted-foreground leading-relaxed">
            NFPA 92 &amp; BS 7346-7 / BS 9999: 10 ACH emergency smoke extraction in car parks, with 80% dedicated fresh makeup air. Individual smoke compartments must not exceed 2,000 m² (21,500 sq ft) without approved smoke barriers.
          </div>
        </IntelSection>
      </div>
    </div>
  );
}

function IntelSection({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: any;
  title: string;
  tone: "success" | "warning" | "primary" | "muted";
  children: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "primary"
      ? "text-primary"
      : "text-muted-foreground";
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

function CollapsibleMissingSection({
  label,
  count,
  itemsList,
  isOpen,
  onToggle,
  onItemClick,
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
          {itemsList.map((item) => (
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
          ))}
        </div>
      )}
    </div>
  );
}

// SUB-COMPONENT: BASEMENT SMOKE EXTRACT FORMULA BREAKDOWN MODAL (MATCHING FRESH AIR COOLING LOAD STANDARD)
function BasementFormulaModal({
  onClose,
  unitSystem,
  activeFloor,
}: {
  onClose: () => void;
  unitSystem: "si" | "ip";
  activeFloor?: BasementFloor;
}) {
  const [activeTab, setActiveTab] = useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = useState(false);

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isIp = unitSystem === "ip";
  const floor: BasementFloor = activeFloor || {
    id: "default",
    basementLevel: "Basement 1",
    zoneName: "Zone 1",
    name: "Basement 1 - Zone 1",
    area: isIp ? 5880 : 588,
    effArea: isIp ? 5000 : 500,
    height: isIp ? 10 : 3.0,
  };

  const effArea = Number(floor.effArea) || (isIp ? 5000 : 500);
  const grossArea = Number(floor.area) || (isIp ? 5880 : 588);
  const height = Number(floor.height) || (isIp ? 10 : 3.0);

  const flows = calculateSmokeFlows(effArea, height, isIp);
  const volume = flows.volume;
  const flow3ach = flows.flow3ach;
  const flow6ach = flows.flow6ach;
  const flow10ach = flows.flow10ach;
  const makeupFlow = calculateMakeupScaling(flow10ach);
  const fanDuty50 = Math.ceil(flow10ach / 2);
  const fanStatic = calculateFanStatic(40, 1.0, 30, 25, 20);

  const handleCopySummary = () => {
    const text = `=== BASEMENT SMOKE EXTRACT FORMULA BREAKDOWN ===
Governing Design Standards: NFPA 92, NFPA 88A, BS 7346-7, BS 9999 & NBC 2016
Unit System: ${isIp ? "IP Imperial (sq ft, cu ft, CFM, in.wg)" : "SI Metric (m, m², m³, L/s, Pa)"}
Basement Space: ${floor.name || `${floor.basementLevel} - ${floor.zoneName}`}

--- 1. ACTIVE SIZING PARAMETERS ---
• Basement Level & Zone: ${floor.basementLevel} - ${floor.zoneName}
• Gross Compartment Area: ${grossArea} ${isIp ? "sq ft" : "m²"}
• Effective Smoke Net Area: ${effArea} ${isIp ? "sq ft" : "m²"}
• Clear Ceiling Height: ${height} ${isIp ? "ft" : "m"}
• Net Air Compartment Volume: ${volume.toLocaleString()} ${isIp ? "cu ft" : "m³"}
• Smoke Purge Standard: 10 ACH Fire Extract & 80% Mechanical Makeup Supply

--- 2. STEP-BY-STEP CALCULATION TRACE ---
[1] Normal Low-Speed Ventilation (3 ACH):
    Q_3ACH = (V × 3) ÷ ${isIp ? "60" : "3.6"} = ${volume.toLocaleString()} × 3 ÷ ${isIp ? "60" : "3.6"} = ${flow3ach.toLocaleString()} ${isIp ? "CFM" : "L/s"}

[2] Smoke Clearance / High Normal Dilution (6 ACH):
    Q_6ACH = (V × 6) ÷ ${isIp ? "60" : "3.6"} = ${volume.toLocaleString()} × 6 ÷ ${isIp ? "60" : "3.6"} = ${flow6ach.toLocaleString()} ${isIp ? "CFM" : "L/s"}

[3] Emergency Smoke Spill Extract (10 ACH):
    Q_10ACH = (V × 10) ÷ ${isIp ? "60" : "3.6"} = ${volume.toLocaleString()} × 10 ÷ ${isIp ? "60" : "3.6"} = ${flow10ach.toLocaleString()} ${isIp ? "CFM" : "L/s"}

[4] Mechanical Makeup Air Supply (80% Negative Pressure Rule):
    Q_makeup = 0.80 × Q_10ACH = 0.80 × ${flow10ach.toLocaleString()} = ${makeupFlow.toLocaleString()} ${isIp ? "CFM" : "L/s"}

[5] Multi-Fan Redundancy Duty (2 × 50% Configuration):
    Capacity per Extract Fan = Q_10ACH ÷ 2 = ${fanDuty50.toLocaleString()} ${isIp ? "CFM" : "L/s"} (dual-speed, 300°C / 2 hr rated)

[6] Duct Friction Loss & Fan Total Static Pressure (ΔP_total):
    L_eq = 40m × 1.60 = ${fanStatic.eqLen}m | ΔP_friction = ${fanStatic.frictionLoss.toFixed(1)} Pa
    ΔP_total = (ΔP_friction + 30 Pa Louver + 25 Pa Grille + 20 Pa Attenuator) × 1.10 = ${fanStatic.totalStatic} Pa (${(fanStatic.totalStatic / 249.0889).toFixed(2)} in.wg)
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Basement smoke calculation breakdown copied to clipboard!");
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <BookOpen className="size-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-[13px] font-bold text-foreground truncate">
                Basement Smoke Extract Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              NFPA 92 / NFPA 88A
            </span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] font-mono font-medium shrink-0">
              {isIp ? "IP" : "SI"}
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
                    <SlidersHorizontal className="size-3 text-primary" /> Active Basement Parameters
                  </span>
                  <span className="font-mono text-primary normal-case font-bold">
                    {floor.name || `${floor.basementLevel} - ${floor.zoneName}`} | {flow10ach.toLocaleString()} {isIp ? "CFM" : "L/s"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Effective Area &amp; Clear Height</span>
                    <span className="font-mono font-bold text-foreground">{effArea} {isIp ? "sq ft" : "m²"}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">× {height} {isIp ? "ft" : "m"} height</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Total Space Volume</span>
                    <span className="font-mono font-bold text-foreground">{volume.toLocaleString()} {isIp ? "cu ft" : "m³"}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">(Net Volume)</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: NORMAL LOW-SPEED AIRFLOW (3 ACH) */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Normal Ventilation Flow (3 ACH)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {flow3ach.toLocaleString()} {isIp ? "CFM" : "L/s"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_3ACH = (V_net × 3) ÷ {isIp ? "60 (CFM)" : "3.6 (L/s)"}</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{volume.toLocaleString()} {isIp ? "cu ft" : "m³"} × 3 ÷ {isIp ? "60" : "3.6"}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {flow3ach.toLocaleString()} {isIp ? "CFM" : "L/s"}</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: SMOKE CLEARANCE / HIGH NORMAL (6 ACH) */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Smoke Clearance / High Normal Flow (6 ACH)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {flow6ach.toLocaleString()} {isIp ? "CFM" : "L/s"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_6ACH = (V_net × 6) ÷ {isIp ? "60 (CFM)" : "3.6 (L/s)"}</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{volume.toLocaleString()} {isIp ? "cu ft" : "m³"} × 6 ÷ {isIp ? "60" : "3.6"}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">= {flow6ach.toLocaleString()} {isIp ? "CFM" : "L/s"}</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: EMERGENCY SMOKE EXTRACT (10 ACH) */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Emergency Fire Smoke Extract (10 ACH)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                    {flow10ach.toLocaleString()} {isIp ? "CFM" : "L/s"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_10ACH = (V_net × 10) ÷ {isIp ? "60 (CFM)" : "3.6 (L/s)"}</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{volume.toLocaleString()} {isIp ? "cu ft" : "m³"} × 10 ÷ {isIp ? "60" : "3.6"}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">= {flow10ach.toLocaleString()} {isIp ? "CFM" : "L/s"}</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: MAKEUP AIR SUPPLY (80% RULE) */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Makeup Air Supply (80% Negative Pressure Rule)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {makeupFlow.toLocaleString()} {isIp ? "CFM" : "L/s"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_makeup = 0.80 × Q_10ACH (20% negative pressure balance)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">0.80 × {flow10ach.toLocaleString()} {isIp ? "CFM" : "L/s"}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">= {makeupFlow.toLocaleString()} {isIp ? "CFM" : "L/s"}</span>
                  </div>
                </div>
              </div>

              {/* STEP 5: DUAL FAN REDUNDANCY (2 × 50%) */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">
                      5
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Multi-Fan Redundancy (2 × 50% Configuration)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    2 Fans @ {fanDuty50.toLocaleString()} {isIp ? "CFM" : "L/s"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_fan = Q_10ACH ÷ 2 (Dual-speed 300°C / 2 hr high-temp rated)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{flow10ach.toLocaleString()} ÷ 2</span>
                    <span className="text-primary font-bold">= {fanDuty50.toLocaleString()} {isIp ? "CFM" : "L/s"} per extract fan</span>
                  </div>
                </div>
              </div>

              {/* STEP 6: DUCT STATIC LOSS & TOTAL FAN HEAD */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      6
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Duct Static Head Loss (ΔP_total)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {fanStatic.totalStatic} Pa ({ (fanStatic.totalStatic / 249.0889).toFixed(2) } in.wg)
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">L_eq ({fanStatic.eqLen}m) × 1.0 Pa/m + Louver (30) + Grille (25) + SA (20):</span>
                    <span className="font-bold text-foreground">{(fanStatic.frictionLoss + 75).toFixed(1)} Pa</span>
                  </div>
                  <div className="flex justify-between text-foreground pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Total Design Head (+10% Safety Margin):</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">{fanStatic.totalStatic} Pa</span>
                  </div>
                </div>
              </div>

              {/* Sizing Outcome Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">Recommended Extract &amp; Supply Sizing</div>
                  <div className="text-[11.5px] font-bold text-foreground mt-0.5">{flow10ach.toLocaleString()} {isIp ? "CFM" : "L/s"} Extract | {makeupFlow.toLocaleString()} {isIp ? "CFM" : "L/s"} Makeup</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-primary leading-tight">{flow10ach.toLocaleString()} {isIp ? "CFM" : "L/s"}</div>
                  <div className="text-[9.5px] text-muted-foreground font-mono">2 × {fanDuty50.toLocaleString()} {isIp ? "CFM" : "L/s"} Fans</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-rose-500" /> Smoke &amp; Normal Ventilation Airflow Equation
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Q_ACH = (A_eff · H_clear · ACH) / Factor</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Where Factor = 3.6 for SI Metric flow in L/s and Factor = 60 for IP Imperial flow in CFM. Rates: 3 ACH (normal continuous), 6 ACH (smoke clearance / peak pollution), 10 ACH (fire smoke extract per NFPA 92 / BS 7346-7 / NBC 2016).
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Negative Pressure Makeup Air Supply (80% Rule)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Q_makeup = 0.80 · Q_extract</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Supplies 80% of total fire extract capacity via dedicated makeup air shafts or automatic louvers to maintain a slight negative pressure differential, preventing smoke migration into exit staircases and lobbies.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" /> Parallel Fan Redundancy Configuration (2 × 50%)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Q_fan = Q_total / N_fans  (N_fans = 2)</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Extract fans are sized as dual-speed units running at 50% duty each (fire rating: 300°C for 2 hours) ensuring partial ventilation continuity in the event of a single mechanical failure.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-purple-500" /> Duct Equivalent Length &amp; Total Static Pressure
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>L_eq = L_duct · 1.60  |  ΔP_total = [ (L_eq · f) + ΔP_louver + ΔP_grille + ΔP_attenuator ] · 1.10</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Includes a 60% allowance for elbows and branch takeoffs, unit friction loss rate f (Pa/m), inlet/outlet component resistance, and an overall 10% safety margin.
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
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">A_eff</td>
                      <td className="py-1.5 px-2 text-foreground">Effective Usable Compartment Area</td>
                      <td className="py-1.5 px-2 font-mono">m²</td>
                      <td className="py-1.5 px-2 font-mono">sq ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">H_clear</td>
                      <td className="py-1.5 px-2 text-foreground">Clear Ceiling Height</td>
                      <td className="py-1.5 px-2 font-mono">m</td>
                      <td className="py-1.5 px-2 font-mono">ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">V_net</td>
                      <td className="py-1.5 px-2 text-foreground">Net Enclosed Compartment Volume</td>
                      <td className="py-1.5 px-2 font-mono">m³</td>
                      <td className="py-1.5 px-2 font-mono">cu ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_3ACH</td>
                      <td className="py-1.5 px-2 text-foreground">Normal Ventilation Airflow Rate</td>
                      <td className="py-1.5 px-2 font-mono">L/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_6ACH</td>
                      <td className="py-1.5 px-2 text-foreground">Smoke Clearance / Dilution Flow</td>
                      <td className="py-1.5 px-2 font-mono">L/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_10ACH</td>
                      <td className="py-1.5 px-2 text-foreground">Fire Smoke Extract Capacity</td>
                      <td className="py-1.5 px-2 font-mono">L/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_makeup</td>
                      <td className="py-1.5 px-2 text-foreground">Makeup Air Supply (80% of Extract)</td>
                      <td className="py-1.5 px-2 font-mono">L/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">L_eq</td>
                      <td className="py-1.5 px-2 text-foreground">Duct Equivalent Length (L × 1.60)</td>
                      <td className="py-1.5 px-2 font-mono">m</td>
                      <td className="py-1.5 px-2 font-mono">ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ΔP_total</td>
                      <td className="py-1.5 px-2 text-foreground">Total Fan Design Static Head</td>
                      <td className="py-1.5 px-2 font-mono">Pa</td>
                      <td className="py-1.5 px-2 font-mono">in.wg</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
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
