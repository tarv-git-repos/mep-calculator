import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { api } from "@/services/api";
import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, Plus, Trash2,
  ChevronDown, ChevronUp, Edit3, Settings, HelpCircle, Sparkles,
  Wind, Layers, Gauge, Zap, Activity, FileText, X, Flag,
  Copy, Scissors, Clipboard, Flame, CheckCircle2, RefreshCw, Check,
  Box, Upload, Filter, ArrowUpDown, Search, MessageSquare
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportBasementSmokePDF } from "@/lib/exportBasementSmokePDF";
import { ImportSourceModal } from "@/components/workspace/ImportSourceModal";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { extractSpacesFromActiveViewer, extractSpacesFromIFCFile, getFloorRank, Extracted3DSpace } from "@/lib/bimViewerSpaceExtractor";
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

function BasementSmokeCalcPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  
  // Active section view state
  const [activeSection, setActiveSection] = useState<"schedule" | "fan-systems">("schedule");
  
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

  const [calcReviewState, setCalcReviewState] = useState<any>(getSyncedReviewState);

  useEffect(() => {
    setCalcReviewState(getSyncedReviewState);
  }, [getSyncedReviewState]);
  
  // Schedule state
  const [floors, setFloors] = useState<BasementFloor[]>([]);
  const [newFloor, setNewFloor] = useState<{ name: string; area: number | ""; effArea: number | ""; height: number | ""; numZones: number | "" }>({ name: "", area: "", effArea: "", height: "", numZones: "" });

  // Fan Systems state
  const [fanSystems, setFanSystems] = useState<FanSystem[]>([]);
  const [totalFans, setTotalFans] = useState<number>(2);

  // Modal state
  const [showAddLevelModal, setShowAddLevelModal] = useState<boolean>(false);
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
        useWorkspace.getState().updateProject({ ...project, workspace_data: wdata });
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

  const handleUndo = () => {
    if (history.length === 0) return;
    const prevFloors = history[history.length - 1];
    setRedoStack(prev => [...prev, floors]);
    setFloors(prevFloors);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextFloors = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, floors]);
    setFloors(nextFloors);
    setRedoStack(prev => prev.slice(0, -1));
  };

  // Keyboard shortcut listener (Ctrl+A, Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+X, Ctrl+V, Delete, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputActive = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // Undo: Ctrl + Z
      if (isCmdOrCtrl && !e.shiftKey && key === "z") {
        if (history.length > 0) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      // Redo: Ctrl + Y or Ctrl + Shift + Z
      if ((isCmdOrCtrl && key === "y") || (isCmdOrCtrl && e.shiftKey && key === "z")) {
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
        return;
      }

      // Copy: Ctrl + C
      if (isCmdOrCtrl && key === "c") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
          setClipboard(selectedItems);
        }
        return;
      }

      // Cut: Ctrl + X
      if (isCmdOrCtrl && key === "x") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
          setClipboard(selectedItems);
          updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
          setSelectedRowIds(new Set());
        }
        return;
      }

      // Paste: Ctrl + V
      if (isCmdOrCtrl && key === "v") {
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
        }
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
          setSelectedRowIds(new Set());
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
  }, [floors, selectedRowIds, clipboard, history, redoStack]);

  const ip = unitSystem === "ip";

  // Load from local storage and workspace_data
  useEffect(() => {
    setIsLoaded(false);
    try {
      const pId = project?.id || "default";
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

      // 2. Fallback to localStorage
      if (!loadedUnitSystem) {
        const savedUnitSystem = (pId && localStorage.getItem(`bs_unit_system_${pId}`)) || localStorage.getItem("bs_unit_system") as "si" | "ip" | null;
        if (savedUnitSystem && (savedUnitSystem === "si" || savedUnitSystem === "ip")) {
          loadedUnitSystem = savedUnitSystem;
        }
      }
      if (loadedUnitSystem) setUnitSystem(loadedUnitSystem);

      if (!loadedFloors) {
        const savedRows = (pId && localStorage.getItem(`bs_rows_${pId}`)) || localStorage.getItem("bs_rows");
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
        const savedFans = (pId && localStorage.getItem(`bs_fan_systems_${pId}`)) || localStorage.getItem("bs_fan_systems");
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
        const savedTotalFans = (pId && localStorage.getItem(`bs_total_fans_${pId}`)) || localStorage.getItem("bs_total_fans");
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
  }, [project?.id]);

  // Save to local storage & workspace data on changes (only after initial load is complete)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const pId = project?.id || "default";

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

      dirtyStore.set(true);

      // 2. Sync to project workspace_data & cloud backend
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
        api.updateProject(project.id, { workspace_data: wdata }).catch(console.error);
        useWorkspace.getState().updateProject({ ...project, workspace_data: wdata });
        if (typeof forceSaveToCloud === "function") {
          forceSaveToCloud();
        }
      }
    } catch (e) {
      console.error("Failed to save basement smoke calc state", e);
    }
  }, [floors, fanSystems, totalFans, unitSystem, showGlobalFanSizing, project?.id, isLoaded]);

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

      setNewFloor(prev => ({
        ...prev,
        area: prev.area !== "" ? Math.round(Number(prev.area) * convArea) : "",
        effArea: prev.effArea !== "" ? Math.round(Number(prev.effArea) * convArea) : "",
        height: prev.height !== "" ? Number((Number(prev.height) * convHeight).toFixed(1)) : ""
      }));
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
      const vol = f.effArea * f.height;
      let f3 = 0, f6 = 0, f10 = 0;
      if (ip) {
        // CFM
        f3 = Math.ceil(vol * 3 / 60);
        f6 = Math.ceil(vol * 6 / 60);
        f10 = Math.ceil(vol * 10 / 60);
      } else {
        // L/s
        f3 = Math.ceil(vol * 3 / 3.6);
        f6 = Math.ceil(vol * 6 / 3.6);
        f10 = Math.ceil(vol * 10 / 3.6);
      }
      return {
        ...f,
        volume: vol,
        flow3ach: f3,
        flow6ach: f6,
        flow10ach: f10
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

    return {
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

  const handleAddFloor = () => {
    if (!newFloor.name) return;
    const bLevel = newFloor.name.trim();
    const numZ = newFloor.numZones !== "" && !isNaN(Number(newFloor.numZones)) ? Math.max(1, Number(newFloor.numZones)) : 1;
    
    const totalArea = newFloor.area !== "" && !isNaN(Number(newFloor.area)) ? Number(newFloor.area) : 600;
    const totalEffArea = newFloor.effArea !== "" && !isNaN(Number(newFloor.effArea)) ? Number(newFloor.effArea) : 500;
    const heightVal = newFloor.height !== "" && !isNaN(Number(newFloor.height)) ? Number(newFloor.height) : 3;

    const baseId = Date.now();
    const newEntries: BasementFloor[] = [];

    if (numZ === 1) {
      newEntries.push({
        id: `floor-${baseId}`,
        basementLevel: bLevel,
        zoneName: "Zone 1",
        name: bLevel.toLowerCase().includes("zone") ? bLevel : `${bLevel} - Zone 1`,
        area: totalArea,
        effArea: totalEffArea,
        height: heightVal
      });
    } else {
      const perZoneArea = Math.round(totalArea / numZ);
      const perZoneEffArea = Math.round(totalEffArea / numZ);

      for (let i = 1; i <= numZ; i++) {
        const zName = `Zone ${i}`;
        newEntries.push({
          id: `floor-${baseId}-${i}`,
          basementLevel: bLevel,
          zoneName: zName,
          name: `${bLevel} - ${zName}`,
          area: perZoneArea,
          effArea: perZoneEffArea,
          height: heightVal
        });
      }
    }

    updateFloorsWithHistory([...floors, ...newEntries]);
    setNewFloor({ name: "", area: "", effArea: "", height: "", numZones: "" });
    setShowAddLevelModal(false);
  };

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
    const existingInLevel = floors.filter(f => f.basementLevel === bLevel);
    const existingIds = new Set(existingInLevel.map(f => f.id));
    const nextNum = existingInLevel.length + 1;
    const zName = `Zone ${nextNum}`;
    const baseHeight = existingInLevel[0]?.height || 3;
    const newZoneId = `floor-${Date.now()}`;
    const newZone: BasementFloor = {
      id: newZoneId,
      basementLevel: bLevel,
      zoneName: zName,
      name: `${bLevel} - ${zName}`,
      area: 600,
      effArea: 500,
      height: baseHeight
    };
    updateFloorsWithHistory([...floors, newZone]);

    // Automatically associate new zone with fan systems serving this basement level
    setFanSystems(prevFS => prevFS.map(fs => {
      if (fs.floorIds.some(id => existingIds.has(id))) {
        return { ...fs, floorIds: [...fs.floorIds, newZoneId] };
      }
      return fs;
    }));
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
    const newFs: FanSystem = {
      ...targetFs,
      id: `fs-${Date.now()}`,
      name: `${targetFs.name} (Copy)`,
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
    if (!modalFSName.trim()) {
      setModalError("Please enter a Fan System Name.");
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
      const fittings = fs.length * 0.6;
      const eqLen = fs.length + fittings;
      const frictionLoss = eqLen * fs.frictionFactor;
      const safety = (frictionLoss + fs.louver + fs.grille + fs.sa) * 0.10;
      const totalStatic = Math.round((frictionLoss + fs.louver + fs.grille + fs.sa + safety) / 10) * 10;

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

      // Scaling for makeup fan (85%)
      if (fs.fanType === "Makeup") {
        flow3 = Math.round(flow3 * 0.85);
        normalScenarioSum = Math.round(normalScenarioSum * 0.85);
        flow10Max = Math.round(flow10Max * 0.85);
        fireConditionTotalFlow = Math.round(fireConditionTotalFlow * 0.85);
        calcNormalCap = Math.round(normalScenarioSum * 0.85);
        calcFireCap = Math.round(fireConditionTotalFlow * 0.85);
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
    <AppShell title="Basement Smoke Calc" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Basement Smoke Extract Schedule</h1>
              <CalculationReviewBar
                projectId={project?.id}
                calculatorPath="/basement-smoke-calc"
                calculatorTitle="Basement Smoke Calc"
                onReviewStateChange={setCalcReviewState}
              />
              {commentsList.length > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Active Task(s) / Comment(s)</span>
                </div>
              )}
            </div>
          </div>

          {/* Ventilation-style Outer Card Container */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Top Row 1: Section Navigation Tabs & Unit System Toggle */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-card shrink-0 select-none no-print border-b border-border/50 flex-wrap gap-3">
              {/* Rounded-full Pill Tabs (Ventilation style) */}
              <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-full border border-border/80 gap-1">
                <button
                  onClick={() => setActiveSection("schedule")}
                  className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeSection === "schedule"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Activity className="size-3.5" />
                  Basement Schedule
                </button>
                <button
                  onClick={() => setActiveSection("fan-systems")}
                  className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeSection === "fan-systems"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wind className="size-3.5" />
                  Fan Systems
                  <span className="ml-1 text-[10px] px-2 py-0.5 bg-primary/15 text-primary rounded-full font-extrabold">
                    {fanSystems.length}
                  </span>
                </button>
              </div>

              {/* Unit System Toggle Pill */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/60 p-1 rounded-full border border-border/80 text-xs font-semibold select-none">
                <button
                  type="button"
                  onClick={() => handleUnitSystemClick("ip")}
                  className={`px-3 py-0.5 rounded-full transition cursor-pointer font-bold ${
                    unitSystem === "ip"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  IP
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitSystemClick("si")}
                  className={`px-3 py-0.5 rounded-full transition cursor-pointer font-bold ${
                    unitSystem === "si"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  SI
                </button>
              </div>
            </div>

            {/* Dedicated Toolbar Row 2: Action Buttons & Filter/Search */}
            {activeSection === "schedule" && (
              <div className="flex items-center justify-between px-4 py-2 bg-card/60 shrink-0 select-none no-print border-b border-border/50 flex-wrap gap-2">
                {/* Left Controls: Search, Filter, Sort */}
                <div className="flex items-center gap-2">
                  {/* Search Input */}
                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Filter spaces..."
                      className="h-7 w-48 pl-8 pr-6 bg-slate-100 dark:bg-slate-900/60 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 text-muted-foreground hover:text-foreground text-xs cursor-pointer font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Filter Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center size-7 rounded-full border transition-all duration-150 ease-out outline-none cursor-pointer group overflow-visible ${
                          activeFiltersCount > 0
                            ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                            : "border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                        }`}
                        title="Filter schedule"
                      >
                        <Filter className="size-3.5 shrink-0" />
                        {activeFiltersCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-xs border border-background">
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
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
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
                        className={`relative inline-flex items-center justify-center size-7 rounded-full border transition-all duration-150 ease-out outline-none cursor-pointer group overflow-visible ${
                          levelSortOrder !== "asc" || zoneSortBy !== "none"
                            ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                            : "border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                        }`}
                        title="Sort schedule"
                      >
                        <ArrowUpDown className="size-3.5 shrink-0" />
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
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
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
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="none">Original Order</option>
                          <option value="name">Zone Name (A-Z)</option>
                          <option value="area">Gross Area (Highest First)</option>
                        </select>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Right Controls: Paste, Import, Export PDF, Add Level */}
                <div className="flex items-center gap-2">
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
                  <button
                    onClick={() => setShowImportSourceModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1 bg-background text-foreground border border-border rounded-full text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs"
                    title="Import basement floor levels from 3D Studio or Excel schedule"
                  >
                    <Upload className="size-3.5 text-[#0A7BC7]" />
                    Import
                  </button>

                  {/* Export PDF */}
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-1.5 px-3.5 py-1 bg-background text-foreground border border-border rounded-full text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs"
                  >
                    <FileText className="size-3.5 text-red-600" />
                    Export PDF
                  </button>

                  {/* Add Level (EXTREME RIGHT) */}
                  <button
                    onClick={() => {
                      if (!newFloor.name) {
                        const nextLevelNum = calculatedGroups.length + 1;
                        setNewFloor({ name: `B${nextLevelNum}`, area: 600, effArea: 500, height: 3, numZones: 1 });
                      }
                      setShowAddLevelModal(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-1 bg-[#0A7BC7] text-white rounded-full text-xs font-bold hover:bg-[#06456F] transition cursor-pointer shadow-xs"
                  >
                    <Plus className="size-3.5 text-white" />
                    Add Level
                  </button>
                </div>
              </div>
            )}

            {/* Inner Content Area */}
            <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto ${activeSection === "schedule" ? "p-0" : "p-5"}`}>
              {/* Basement Level Schedule Section */}
              {activeSection === "schedule" && (
                <div className="w-full flex-1 flex flex-col min-h-0">
                  {/* Floating Row Selection Toolbar */}
                  {selectedRowIds.size > 0 && (
                    <div className="m-3 flex items-center justify-between bg-primary/10 border border-primary/30 rounded-xl px-4 py-2 text-xs font-semibold text-primary animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{selectedRowIds.size} row(s) selected</span>
                        <span className="text-muted-foreground text-[11px]">(Shortcuts: Ctrl+C, Ctrl+X, Ctrl+V, Del, Esc)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
                            setClipboard(selectedItems);
                          }}
                          className="flex items-center gap-1 hover:underline font-bold cursor-pointer"
                          title="Copy (Ctrl+C)"
                        >
                          <Copy className="size-3" /> Copy
                        </button>
                        <button
                          onClick={() => {
                            const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
                            setClipboard(selectedItems);
                            updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
                            setSelectedRowIds(new Set());
                          }}
                          className="flex items-center gap-1 hover:underline font-bold cursor-pointer"
                          title="Cut (Ctrl+X)"
                        >
                          <Scissors className="size-3" /> Cut
                        </button>
                        <button
                          onClick={() => {
                            updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
                            setSelectedRowIds(new Set());
                          }}
                          className="flex items-center gap-1 hover:underline font-bold text-red-500 cursor-pointer"
                          title="Delete selected (Del)"
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                        <button
                          onClick={() => setSelectedRowIds(new Set())}
                          className="text-muted-foreground hover:text-foreground font-semibold ml-2 cursor-pointer"
                        >
                          Clear (Esc)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Grouped Table View */}
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/70 text-muted-foreground font-semibold bg-slate-100/50 dark:bg-slate-900/30">
                          <th className="py-2.5 px-2 text-center w-8">
                            <input
                              type="checkbox"
                              checked={floors.length > 0 && selectedRowIds.size === floors.length}
                              onChange={e => setSelectedRowIds(e.target.checked ? new Set(floors.map(f => f.id)) : new Set())}
                              className="rounded border-border cursor-pointer"
                              title="Select / Deselect all rows (Ctrl+A)"
                            />
                          </th>
                          <th className="py-2.5 px-3">Level / Zone Name</th>
                          <th className="py-2.5">Gross Area ({ip ? "ft²" : "m²"})</th>
                          <th className="py-2.5">Eff. Area ({ip ? "ft²" : "m²"})</th>
                          <th className="py-2.5">Height ({ip ? "ft" : "m"})</th>
                          <th className="py-2.5">3 ACH ({ip ? "CFM" : "L/s"})</th>
                          <th className="py-2.5">6 ACH ({ip ? "CFM" : "L/s"})</th>
                          <th className="py-2.5 text-primary">10 ACH ({ip ? "CFM" : "L/s"})</th>
                          <th className="py-2.5 text-center w-12">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {calculatedGroups.map((grp, grpIdx) => (
                          <Fragment key={grp.basementLevel + "-group"}>
                            {/* Basement Level Group Header */}
                            <ContextMenu key={grp.basementLevel + "-level-ctx"}>
                              <ContextMenuTrigger asChild>
                                <tr className={`font-sans group/header ${
                                  grpIdx > 0
                                    ? "border-t-2 border-slate-200 dark:border-slate-800"
                                    : ""
                                }`}>
                                  <td colSpan={9} className="py-2 px-3 font-bold text-foreground text-[12px] bg-slate-100/70 dark:bg-slate-800/60 border-y border-border/80">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-[#0A7BC7] rounded-full shrink-0"></div>
                                        <input
                                          type="text"
                                          value={grp.basementLevel}
                                          onChange={e => handleRenameLevel(grp.basementLevel, e.target.value)}
                                          className="bg-transparent hover:bg-slate-200/50 dark:hover:bg-slate-700/50 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded-md px-2 py-0.5 font-bold text-xs text-foreground outline-none transition-colors"
                                          title="Click to rename level inline"
                                        />
                                        <span className="text-[10.5px] px-2 py-0.5 bg-slate-200/60 dark:bg-slate-700/50 text-muted-foreground font-semibold rounded-full">
                                          {grp.rows.length} {grp.rows.length === 1 ? "Zone" : "Zones"}
                                        </span>
                                        {(() => {
                                          const grpComments = commentsList.filter(c => c.spaceId === grp.basementLevel || c.targetId === grp.basementLevel);
                                          if (grpComments.length === 0) return null;
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenComment(grp.basementLevel, grp.basementLevel, "level")}
                                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10.5px] hover:bg-blue-200 transition cursor-pointer"
                                              title={`${grpComments.length} comment(s)/task(s) assigned`}
                                            >
                                              <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                              <span>{grpComments.length}</span>
                                            </button>
                                          );
                                        })()}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleOpenEditLevelModal(grp)}
                                          className="p-1 px-2 bg-white dark:bg-slate-900 border border-border/80 rounded-lg text-primary hover:bg-primary/10 transition cursor-pointer shadow-2xs text-xs font-semibold flex items-center gap-1"
                                          title="Edit level parameters & zones"
                                        >
                                          <Edit3 className="size-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleAddZoneToLevel(grp.basementLevel)}
                                          className="p-1 px-2 bg-white dark:bg-slate-900 border border-border/80 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer shadow-2xs text-xs font-semibold flex items-center gap-1"
                                          title="Add new zone to this level"
                                        >
                                          <Plus className="size-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteLevel(grp.basementLevel, grp.rows.map(r => r.id))}
                                          className="p-1 px-2 bg-white dark:bg-slate-900 border border-border/80 rounded-lg text-red-500 hover:bg-red-500/10 transition cursor-pointer shadow-2xs text-xs font-semibold flex items-center gap-1"
                                          title="Delete entire level"
                                        >
                                          <Trash2 className="size-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1.5 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleOpenComment(grp.basementLevel, grp.basementLevel, "level")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <MessageSquare className="size-3.5 text-blue-600" />
                                  <span>Add Comment / Task to {grp.basementLevel}</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleOpenEditLevelModal(grp)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Edit3 className="size-3.5 text-primary" />
                                  <span>Edit {grp.basementLevel} Parameters</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => handleAddZoneToLevel(grp.basementLevel)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Plus className="size-3.5 text-emerald-600" />
                                  <span>Add Zone to {grp.basementLevel}</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleDeleteLevel(grp.basementLevel)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg cursor-pointer font-medium"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>Delete Entire {grp.basementLevel}</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Zone Rows */}
                            {grp.rows.map(r => (
                              <ContextMenu key={r.id}>
                                <ContextMenuTrigger asChild>
                                  <tr
                                    className={`transition-colors group ${
                                      selectedRowIds.has(r.id)
                                        ? "bg-primary/10 dark:bg-primary/20 border-l-2 border-l-primary"
                                        : "hover:bg-slate-50/50 dark:hover:bg-slate-900/10"
                                    }`}
                                  >
                                    <td className="py-1 px-2 text-center w-8 select-none">
                                      <input
                                        type="checkbox"
                                        checked={selectedRowIds.has(r.id)}
                                        onChange={e => {
                                          e.stopPropagation();
                                          const next = new Set(selectedRowIds);
                                          if (next.has(r.id)) next.delete(r.id);
                                          else next.add(r.id);
                                          setSelectedRowIds(next);
                                        }}
                                        className="rounded border-border cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-1 px-3 font-sans font-semibold pl-4">
                                      <input
                                        type="text"
                                        value={r.name}
                                        onChange={e => handleUpdateFloorCell(r.id, "name", e.target.value)}
                                        className="w-full bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded px-2 py-1 font-semibold text-xs text-foreground outline-none transition-colors"
                                      />
                                    </td>
                                    <td className="py-1 px-1">
                                      <input
                                        type="number"
                                        value={r.area === 0 ? "" : r.area}
                                        onChange={e => handleUpdateFloorCell(r.id, "area", e.target.value === "" ? 0 : Number(e.target.value))}
                                        className="w-24 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded px-1.5 py-1 font-mono font-semibold text-xs text-foreground outline-none transition-colors"
                                      />
                                    </td>
                                    <td className="py-1 px-1">
                                      <input
                                        type="number"
                                        value={r.effArea === 0 ? "" : r.effArea}
                                        onChange={e => handleUpdateFloorCell(r.id, "effArea", e.target.value === "" ? 0 : Number(e.target.value))}
                                        className="w-24 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded px-1.5 py-1 font-mono font-semibold text-xs text-foreground outline-none transition-colors"
                                      />
                                    </td>
                                    <td className="py-1 px-1">
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={r.height === 0 ? "" : r.height}
                                        onChange={e => handleUpdateFloorCell(r.id, "height", e.target.value === "" ? 0 : Number(e.target.value))}
                                        className="w-20 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded px-1.5 py-1 font-mono font-semibold text-xs text-foreground outline-none transition-colors"
                                      />
                                    </td>
                                    <td className="py-2.5 font-semibold text-slate-700 dark:text-slate-300">{r.flow3ach.toLocaleString()}</td>
                                    <td className="py-2.5">{r.flow6ach.toLocaleString()}</td>
                                    <td className="py-2.5 font-bold text-primary">{r.flow10ach.toLocaleString()}</td>
                                    <td className="py-1.5 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        {(() => {
                                          const rowComments = commentsList.filter(c => c.spaceId === r.id || c.targetId === r.id);
                                          if (rowComments.length === 0) return null;
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenComment(r.id, r.name, "zone")}
                                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer shrink-0"
                                              title={`${rowComments.length} comment(s)/task(s) assigned`}
                                            >
                                              <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                              <span>{rowComments.length}</span>
                                            </button>
                                          );
                                        })()}
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateFloorCell(r.id, "flagged", !r.flagged)}
                                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer group/flag flex items-center justify-center"
                                          title={r.flagged ? "Unflag zone" : "Flag zone"}
                                        >
                                          <Flag
                                            className={`size-3.5 transition-all duration-200 ${
                                              r.flagged
                                                ? "fill-red-500 text-red-500 scale-110"
                                                : "text-muted-foreground/30 hover:text-red-500/60 group-hover/flag:scale-110"
                                            }`}
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteFloor(r.id)}
                                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground/40 hover:text-red-500 transition cursor-pointer"
                                          title="Delete zone"
                                        >
                                          <Trash2 className="size-3" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1.5 text-[13px] text-popover-foreground z-50">
                                  <ContextMenuItem
                                    onClick={() => handleOpenComment(r.id, r.name, "zone")}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                  >
                                    <MessageSquare className="size-3.5 text-blue-600" />
                                    <span>Add Comment / Task to {r.name}</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator className="h-px bg-border my-1" />
                                  <ContextMenuItem
                                    onClick={() => handleDuplicateZone(r)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                  >
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    <span>Duplicate Zone</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => handleAddZoneToLevel(r.basementLevel)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                  >
                                    <Plus className="size-3.5 text-emerald-600" />
                                    <span>Add Zone to {r.basementLevel}</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator className="h-px bg-border my-1" />
                                  <ContextMenuItem
                                    onClick={() => handleUpdateFloorCell(r.id, "flagged", !r.flagged)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                  >
                                    <Flag className="size-3.5 text-red-500" />
                                    <span>{r.flagged ? "Unflag Zone" : "Flag Zone"}</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator className="h-px bg-border my-1" />
                                  <ContextMenuItem
                                    onClick={() => handleDeleteFloor(r.id)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg cursor-pointer font-medium"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>Delete Zone</span>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            ))}
                            {/* Basement Subtotal Row */}
                            <tr className="bg-slate-100/50 dark:bg-slate-900/50 font-bold border-b border-border/70 text-[11.5px]">
                              <td className="py-2.5 px-3 font-sans text-muted-foreground uppercase text-[10.5px] tracking-wider" colSpan={2}>{grp.basementLevel} Subtotal</td>
                              <td className="py-2.5 font-mono">{grp.totalArea.toLocaleString()}</td>
                              <td className="py-2.5 font-mono">{grp.totalEffArea.toLocaleString()}</td>
                              <td className="py-2.5 font-mono text-muted-foreground">-</td>
                              <td className="py-2.5 font-mono text-slate-800 dark:text-slate-200">{grp.subtotal3.toLocaleString()}</td>
                              <td className="py-2.5 font-mono text-slate-800 dark:text-slate-200">{grp.subtotal6.toLocaleString()}</td>
                              <td className="py-2.5 font-mono text-rose-600 dark:text-rose-400">
                                {grp.max10Fire.toLocaleString()}
                                <span className="ml-2 text-[9px] px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-full font-bold uppercase tracking-tight">1 Zone Fire Rate</span>
                              </td>
                              <td className="py-2.5"></td>
                            </tr>
                          </Fragment>
                        ))}
                        {calculatedGroups.length === 0 && (
                          <tr>
                            <td colSpan={9} className="py-20 px-4 text-center text-muted-foreground font-sans align-middle">
                              <div className="flex flex-col items-center justify-center gap-2 min-h-[260px]">
                                <Layers className="size-8 text-muted-foreground/40" />
                                <p className="font-bold text-sm text-foreground">No basement levels defined</p>
                                <p className="text-xs text-muted-foreground">Click "Add Level" or import directly from 3D Studio / Excel.</p>
                                <div className="mt-2 flex items-center gap-2 flex-wrap justify-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewFloor({ name: "B1", area: 600, effArea: 500, height: 3, numZones: 1 });
                                      setShowAddLevelModal(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0A7BC7] text-white rounded-xl text-xs font-semibold hover:bg-[#06456F] transition cursor-pointer shadow-xs"
                                  >
                                    <Plus className="size-3.5" />
                                    Add Level
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowImportSourceModal(true)}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-xl text-xs font-semibold hover:bg-primary/20 transition cursor-pointer shadow-xs"
                                  >
                                    <Box className="size-3.5 text-primary" />
                                    Import from 3D Studio
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

          {/* Fan Systems Head Loss Section */}
          {activeSection === "fan-systems" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Fan Systems Head Loss Calculations</h3>
                </div>
                <TBtn onClick={handleOpenCreateFS} className="h-8.5 text-xs">
                  <Plus className="size-3.5" /> Create Fan System
                </TBtn>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {calculatedFanSystems.map(fs => (
                  <ContextMenu key={fs.id}>
                    <ContextMenuTrigger asChild>
                      <div className="border border-border/75 rounded-2xl bg-slate-50/30 dark:bg-slate-900/10 flex flex-col overflow-hidden shadow-xs">
                        
                        {/* Card Header with Toggle Collapse */}
                        <div
                          onClick={() => setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, collapsed: !x.collapsed } : x))}
                          className="flex justify-between items-center gap-2 bg-slate-100/50 dark:bg-slate-800/40 p-4 border-b border-border/70 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60 select-none transition"
                        >
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <span className={`text-[10px] text-muted-foreground transition duration-200 block ${fs.collapsed ? "-rotate-90" : ""}`}>▼</span>
                            <strong className="text-xs text-foreground font-sans font-bold">{fs.name}</strong>
                            <span className="text-[9.5px] px-2 py-0.5 bg-primary/10 text-primary font-bold rounded-full uppercase shrink-0">
                              {fs.fanType} System
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {fs.servedFloors.map(f => (
                                <span key={f.id} className="text-[10px] bg-slate-200/50 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded-md">
                                  {f.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1 items-center shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenEditFS(fs); }}
                              className="bg-transparent text-primary hover:bg-primary/10 p-1.5 rounded transition cursor-pointer"
                              title="Edit Fan System"
                            >
                              <Edit3 className="size-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setFanSystems(fanSystems.filter(x => x.id !== fs.id)); }}
                              className="bg-transparent text-red-500 hover:bg-red-500/10 p-1.5 rounded transition cursor-pointer"
                              title="Delete Fan System"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        {!fs.collapsed && (
                          <div className="p-4 sm:p-5 flex flex-col gap-4">
                            {/* Compact Fire Scenario & Capacity Bar */}
                            <div className="flex items-center justify-between gap-2 bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2 text-xs">
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Flame className="size-3.5 text-rose-500 dark:text-rose-400" />
                                <span className="font-bold text-foreground text-xs font-sans">Fire Scenario</span>
                              </div>
                              
                              <div className="flex items-center gap-2 font-mono flex-wrap">
                                <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap">
                                  <span className="font-sans font-bold text-[9.5px] text-muted-foreground uppercase">Normal:</span>
                                  <strong className="font-bold text-xs">{fs.lowCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                                </div>
                                <div className="flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap">
                                  <span className="font-sans font-bold text-[9.5px] text-muted-foreground uppercase">Fire:</span>
                                  <strong className="font-bold text-xs">{fs.highCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setFireConfigFSId(fs.id)}
                                  className="bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1 transition cursor-pointer shrink-0 shadow-xs"
                                  title="Configure Fire Scenario & Zone ACH"
                                >
                                  <Settings className="size-3" />
                                  <span>Configure</span>
                                </button>
                              </div>
                            </div>

                            {/* System Parameters Row: Number of Fans & Friction Factor */}
                            <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-100/30 dark:bg-slate-900/30 border border-border rounded-xl px-4 py-2 text-xs select-none">
                              <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
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
                                  className="w-7 bg-transparent text-primary font-bold text-center outline-none focus:bg-slate-200/50 dark:focus:bg-slate-800/50 rounded transition-colors"
                                />
                                <span className="text-muted-foreground font-semibold">Fan(s)</span>
                              </div>

                              <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Friction Factor:</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={fs.frictionFactor}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, frictionFactor: val } : x));
                                  }}
                                  className="w-8 bg-transparent text-primary font-bold text-center outline-none focus:bg-slate-200/50 dark:focus:bg-slate-800/50 rounded transition-colors"
                                />
                                <span>Pa/m</span>
                              </div>
                            </div>

                            {/* Inputs Split */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
                              <div className="flex flex-col h-full gap-2.5 text-xs">
                                <div className="font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">Ductwork Inputs</div>
                                <div className="bg-slate-100/20 dark:bg-slate-900/10 border border-border rounded-xl p-3 flex-1 flex flex-col justify-between gap-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="font-semibold text-muted-foreground">Duct Length (m)</label>
                                    <input
                                      type="number"
                                      value={fs.length}
                                      onChange={e => {
                                        const val = Number(e.target.value);
                                        setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, length: val } : x));
                                      }}
                                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="font-semibold text-muted-foreground">Losses in Louver (Pa)</label>
                                    <input
                                      type="number"
                                      value={fs.louver}
                                      onChange={e => {
                                        const val = Number(e.target.value);
                                        setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, louver: val } : x));
                                      }}
                                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="font-semibold text-muted-foreground">Losses in Grille (Pa)</label>
                                    <input
                                      type="number"
                                      value={fs.grille}
                                      onChange={e => {
                                        const val = Number(e.target.value);
                                        setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, grille: val } : x));
                                      }}
                                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="font-semibold text-muted-foreground">Losses in SAs (Pa)</label>
                                    <input
                                      type="number"
                                      value={fs.sa}
                                      onChange={e => {
                                        const val = Number(e.target.value);
                                        setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, sa: val } : x));
                                      }}
                                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col gap-2.5 text-xs">
                                <div className="font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">Calculated Results</div>
                                <div className="bg-slate-100/20 dark:bg-slate-900/10 border border-border rounded-xl p-3 flex flex-col gap-2 font-sans">
                                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                                    <span className="font-semibold text-muted-foreground">Fittings in Ducting</span>
                                    <strong className="font-bold text-foreground font-mono">{fs.fittings.toFixed(1)} m</strong>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                                    <span className="font-semibold text-muted-foreground">Equivalent Length</span>
                                    <strong className="font-bold text-foreground font-mono">{fs.eqLen.toFixed(1)} m</strong>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                                    <span className="font-semibold text-muted-foreground">Frictional Losses</span>
                                    <strong className="font-bold text-foreground font-mono">{fs.frictionLoss.toFixed(2)} Pa</strong>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                                    <span className="font-semibold text-muted-foreground">Safety Overhead (10%)</span>
                                    <strong className="font-bold text-foreground font-mono">{fs.safety.toFixed(2)} Pa</strong>
                                  </div>
                                  <div className="flex justify-between items-center pt-1 text-[#0A7BC7]">
                                    <span className="font-bold">Total Static Sized</span>
                                    <strong className="font-bold text-sm font-mono">{fs.totalStatic} Pa</strong>
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
                    <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1.5 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment(fs.id, fs.name, "system")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <MessageSquare className="size-3.5 text-blue-600" />
                        <span>Add Comment / Task to {fs.name}</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => setFireConfigFSId(fs.id)}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <Flame className="size-3.5 text-rose-500" />
                        <span>Configure Fire Scenario & Zone ACH</span>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handleOpenEditFS(fs)}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <Edit3 className="size-3.5 text-primary" />
                        <span>Edit Fan System Properties</span>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, collapsed: !x.collapsed } : x))}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <Settings className="size-3.5 text-muted-foreground" />
                        <span>{fs.collapsed ? "Expand Fan System Card" : "Collapse Fan System Card"}</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleDuplicateFanSystem(fs)}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Duplicate Fan System</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => setFanSystems(fanSystems.filter(x => x.id !== fs.id))}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg cursor-pointer font-medium"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete Fan System</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

      {/* Add Level Modal */}
      {showAddLevelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <h3 className="font-bold text-base text-foreground">Add Basement Level</h3>
              <button onClick={() => setShowAddLevelModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs font-sans">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Floor / Basement Name</label>
                <input
                  type="text"
                  placeholder="e.g. B1, B2"
                  value={newFloor.name}
                  onChange={e => setNewFloor({ ...newFloor, name: e.target.value })}
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Gross Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    placeholder="600"
                    value={newFloor.area}
                    onChange={e => setNewFloor({ ...newFloor, area: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Effective Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    placeholder="500"
                    value={newFloor.effArea}
                    onChange={e => setNewFloor({ ...newFloor, effArea: e.target.value === "" ? "" : Number(e.target.value) })}
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
                    placeholder="3"
                    value={newFloor.height}
                    onChange={e => setNewFloor({ ...newFloor, height: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Number of Zones</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1"
                    value={newFloor.numZones}
                    onChange={e => setNewFloor({ ...newFloor, numZones: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowAddLevelModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFloor}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="size-3.5" /> Add Level
              </button>
            </div>
          </div>
        </div>
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
            <div className={`bg-card border border-border rounded-2xl w-full p-6 flex flex-col justify-between shadow-2xl h-[640px] max-h-[90vh] overflow-hidden ${
              showModalCalcPreview ? "max-w-5xl" : "max-w-lg"
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
                        ? "bg-[#0A7BC7] text-white border border-[#0A7BC7]"
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
              <div className={`w-full flex-1 min-h-0 my-2 ${showModalCalcPreview ? "grid grid-cols-2 gap-6 items-start" : "flex flex-col"}`}>
                {/* Left Side: Parameters & Zone ACH Configurator */}
                <div className="flex flex-col gap-4 min-w-0 h-full overflow-y-auto pr-1">
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
                {showModalCalcPreview && (
                  <div className="flex flex-col gap-4 min-w-0 h-full overflow-y-auto border-l border-border/70 pl-6">
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
                          {(fireConfigFS.fanQty || 1) > 1 && ` (${fireConfigFS.fanQty} Fans @ ${Math.ceil(fireConfigFS.lowCap / (fireConfigFS.fanQty || 1)).toLocaleString()} ${ip ? "CFM" : "L/s"} each)`}
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
                          {(fireConfigFS.fanQty || 1) > 1 && ` (${fireConfigFS.fanQty} Fans @ ${Math.ceil(fireConfigFS.highCap / (fireConfigFS.fanQty || 1)).toLocaleString()} ${ip ? "CFM" : "L/s"} each)`}
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
                )}
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
    </AppShell>
  );
}
