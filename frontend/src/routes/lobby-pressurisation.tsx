import { CalculationReviewBar, CalculationStatusBanner, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/workspace-store";
import { useAuth } from "@/contexts/AuthContext";
import { dirtyStore } from "@/lib/dirty-store";
import { api } from "@/services/api";
import React, { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import {
  AlertTriangle, Info, Printer, Plus, Trash2,
  ChevronDown, ChevronUp, Edit3, Settings, HelpCircle, Sparkles,
  Wind, Layers, Gauge, Zap, Activity, FileText, X, Flag,
  Copy, Scissors, Clipboard, Flame, CheckCircle2, RefreshCw, Check,
  Box, Upload, Filter, ArrowUpDown, Search, MessageSquare, ShieldCheck,
  Building2, LayoutGrid, SplitSquareVertical, Eye
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportLobbyPressurisationPDF } from "@/lib/exportLobbyPressurisationPDF";
import { ImportSourceModal } from "@/components/workspace/ImportSourceModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { extractSpacesFromActiveViewer, extractSpacesFromIFCFile, getFloorRank, Extracted3DSpace } from "@/lib/bimViewerSpaceExtractor";
import {
  type LobbyFloor,
  type FanSystem,
  type CalculatedLobbyFloor,
  type LobbyGroup,
  type LobbyTotals,
  type CalculatedLobbyFanSystem,
  computeLobbyFloors,
  computeLobbyGroups,
  computeLobbyTotals,
  computeLobbyFanSystems
} from "@/lib/calc-lobby-pressurisation";
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

export const Route = createFileRoute("/lobby-pressurisation")({
  head: () => ({
    meta: [
      { title: "Lobby Pressurisation — MEP Calc" },
      { name: "description", content: "Lobby Pressurisation ventilation calculator and fan system head sizer." },
    ],
  }),
  component: LobbyPressurisationPage,
});


function LobbyPressurisationPage() {
  const { project, activeProjectId, forceSaveToCloud, isInitializing, updateProject } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/lobby-pressurisation", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/lobby-pressurisation", activeProjectId || project?.id);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  
  // Active section view state
  const [activeSection, setActiveSection] = useState<"schedule" | "fan-systems">("schedule");
  
  // Grouping mode: by 'zone' (same-same zones across levels) or by 'level' (floor-by-floor)
  const [groupByMode, setGroupByMode] = useState<"zone" | "level">("zone");

  // Collapsible Global Fan Sizing card state
  const [showGlobalFanSizing, setShowGlobalFanSizing] = useState<boolean>(true);

  // Synced Calculation Review State (Ventilation style)
  const getSyncedReviewState = useMemo(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_review_${pId}_/lobby-pressurisation`;
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
  const isApprovedLocked = useCalculationLock("/lobby-pressurisation", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  
  
  // Schedule state
  const [floors, setFloors] = useState<LobbyFloor[]>([]);
  const [newFloor, setNewFloor] = useState<{ name: string; zone: string; area: number | ""; height: number | ""; numZones: number | "" }>({ name: "", zone: "", area: "", height: "", numZones: "" });

  // Fan Systems state
  const [fanSystems, setFanSystems] = useState<FanSystem[]>([]);
  const [totalFans, setTotalFans] = useState<number>(2);

  // Modal state
  const [showAddLevelModal, setShowAddLevelModal] = useState<boolean>(false);
  const [showEditLevelModal, setShowEditLevelModal] = useState<boolean>(false);
  const [editLevelTarget, setEditLevelTarget] = useState<string | null>(null);
  const [editLevelData, setEditLevelData] = useState<{ levelName: string; area: number | ""; height: number | ""; numZones: number | "" }>({ levelName: "", area: "", height: "", numZones: "" });
  
  const [showFSModal, setShowFSModal] = useState<boolean>(false);
  const [modalFSId, setModalFSId] = useState<string | null>(null);
  const [modalFSName, setModalFSName] = useState<string>("");
  const [fsSpaceSelectMode, setFsSpaceSelectMode] = useState<"zone" | "level" | "space">("zone");
  const [modalFSType, setModalFSType] = useState<"Extract" | "Makeup" | "Pressurisation">("Pressurisation");
  const [modalFSFanQty, setModalFSFanQty] = useState<number | "">(2);
  const [modalSelectedFloorIds, setModalSelectedFloorIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string>("");
  const [showUnitConfirmModal, setShowUnitConfirmModal] = useState<boolean>(false);
  const [pendingUnitTarget, setPendingUnitTarget] = useState<"si" | "ip" | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [inspectFS, setInspectFS] = useState<CalculatedLobbyFanSystem | null>(null);

  // Bulk Edit state (Ventilation style)
  const [bulkEditOpen, setBulkEditOpen] = useState<boolean>(false);
  const [bulkEditTargetIds, setBulkEditTargetIds] = useState<string[]>([]);
  const [bulkEditValues, setBulkEditValues] = useState({
    basementLevel: "",
    zoneName: "",
    area: "",
    height: "",
  });
  const [bulkEditFields, setBulkEditFields] = useState({
    basementLevel: false,
    zoneName: false,
    area: false,
    height: false,
  });

  // Selection & Keyboard Shortcuts state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<LobbyFloor[]>([]);
  const [history, setHistory] = useState<LobbyFloor[][]>([]);
  const [redoStack, setRedoStack] = useState<LobbyFloor[][]>([]);

  // Search, Filter & Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterZone, setFilterZone] = useState<string>("all");
  const [filterFlagged, setFilterFlagged] = useState<boolean>(false);
  const [levelSortOrder, setLevelSortOrder] = useState<"asc" | "desc">("asc");
  const [zoneSortBy, setZoneSortBy] = useState<"none" | "name" | "area">("none");

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterLevel !== "all") count++;
    if (filterZone !== "all") count++;
    if (filterFlagged) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [filterLevel, filterZone, filterFlagged, searchQuery]);

  // Comments & Tasks Assignment State
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type?: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  const getSyncedComments = useMemo(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/lobby-pressurisation`;
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
    const storageKey = `mep_calc_comments_${pId}_/lobby-pressurisation`;
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
      calculatorTitle: "Lobby Pressurisation",
      calculatorPath: "/lobby-pressurisation",
      projectId: project?.id || "default",
      projectName: project?.name || "Lobby Pressurisation",
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
    setFilterZone("all");
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

  const handleExtractFrom3DModel = async (file?: File) => {
    try {
      let extracted: Extracted3DSpace[] = [];
      if (file) {
        toast.loading("Parsing 3D IFC Model spaces...", { id: "lp-ifc-parse" });
        extracted = await extractSpacesFromIFCFile(file);
        toast.dismiss("lp-ifc-parse");
      } else {
        toast.loading("Scanning active 3D Studio model for lobby spaces...", { id: "lp-3d-scan" });
        extracted = await extractSpacesFromActiveViewer();
        toast.dismiss("lp-3d-scan");

        if (extracted.length === 0 && project?.id) {
          const savedFile = (window as any).__ACTIVE_IFC_FILE__ || (window as any).activeIfcFile;
          if (savedFile instanceof File) {
            try {
              extracted = await extractSpacesFromIFCFile(savedFile);
            } catch (e) {}
          }
        }
      }

      if (extracted.length === 0) {
        toast.error("No 3D model is currently loaded. Please select an .ifc file or load a model first.");
        ifcFileInputRef.current?.click();
        return;
      }

      setPending3DSpaces(extracted);
      const initialSelected = new Set(extracted.map(sp => sp.id));
      setSelected3DIds(initialSelected);
      setShow3DPreviewModal(true);
      setShowImportSourceModal(false);
      toast.success(`Found ${extracted.length} space(s) in 3D model.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to extract spaces from 3D model.");
    }
  };

  const handleApply3DImport = () => {
    const selected = pending3DSpaces.filter(sp => selected3DIds.has(sp.id));
    if (selected.length === 0) {
      toast.error("Please select at least one space to import.");
      return;
    }

    const baseTime = Date.now();
    const importedFloors: LobbyFloor[] = selected.map((sp, idx) => {
      const grossAreaVal = Math.round(sp.grossFloorArea || (sp.volume ? sp.volume / 3 : 50));
      const heightVal = Number((sp.height || 3).toFixed(1));
      const lvl = sp.storey || `Level ${idx + 1}`;
      const zn = sp.name || `Lift Lobby ${idx + 1}`;
      return {
        id: `floor-${baseTime}-${idx}`,
        basementLevel: lvl,
        zoneName: zn,
        name: `${lvl} - ${zn}`,
        area: grossAreaVal || 350,
        height: heightVal || 3
      };
    });

    updateFloorsWithHistory([...floors, ...importedFloors]);
    setShow3DPreviewModal(false);
    toast.success(`Successfully imported ${importedFloors.length} lobby space(s)!`);
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

        const imported: LobbyFloor[] = [];
        const baseTime = Date.now();
        data.forEach((row, i) => {
          const rawLvl = row["Level"] || row["Floor"] || row["Basement Level"] || `Level 1`;
          const rawZone = row["Zone Name"] || row["Zone"] || row["Space"] || row["Lobby Name"] || `Lift Lobby 1`;
          const area = parseFloat(row["Gross Area"] || row["Area"] || 350) || 350;
          const height = parseFloat(row["Height"] || 3) || 3;

          imported.push({
            id: `floor-${baseTime}-${i}`,
            basementLevel: String(rawLvl).trim(),
            zoneName: String(rawZone).trim(),
            name: `${String(rawLvl).trim()} - ${String(rawZone).trim()}`,
            area: area,
            height: height
          });
        });

        updateFloorsWithHistory([...floors, ...imported]);
        setShowImportSourceModal(false);
        toast.success(`Imported ${imported.length} lobby space(s) from Excel!`);
      } catch (err) {
        toast.error("Failed to parse Excel file.");
      } finally {
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  // Push to history helper
  const updateFloorsWithHistory = (newFloors: LobbyFloor[]) => {
    setHistory(prev => [...prev.slice(-25), floors]);
    setRedoStack([]);
    setFloors(newFloors);
  };

  // Bulk edit handlers (Ventilation style)
  const handleOpenBulkEdit = (targetIds?: string[]) => {
    const idsToEdit = targetIds && targetIds.length > 0
      ? targetIds
      : Array.from(selectedRowIds);

    if (idsToEdit.length === 0) {
      toast.info("Please select at least one space to bulk edit.");
      return;
    }

    setBulkEditTargetIds(idsToEdit);
    setBulkEditValues({
      basementLevel: "",
      zoneName: "",
      area: "",
      height: "",
    });
    setBulkEditFields({
      basementLevel: false,
      zoneName: false,
      area: false,
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
          const newPasted: LobbyFloor[] = clipboard.map((item, idx) => ({
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

  const isInitialMountRef = useRef(true);

  // Load from local storage and workspace_data
  useEffect(() => {
    if (isInitializing && !project?.id) return;

    setIsLoaded(false);
    try {
      const pId = project?.id || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : null) || "default";
      let loadedFloors: LobbyFloor[] | null = null;
      let loadedFans: FanSystem[] | null = null;
      let loadedTotalFans: number | null = null;
      let loadedUnitSystem: "si" | "ip" | null = null;
      let loadedGroupBy: "zone" | "level" | null = null;
      let loadedShowSizing: boolean | null = null;

      if (project?.workspace_data) {
        let wdata = project.workspace_data;
        if (typeof wdata === 'string') {
          try { wdata = JSON.parse(wdata); } catch(e) {}
        }
        if (wdata?.lobby_pressurisation) {
          const bsc = wdata.lobby_pressurisation;
          if (Array.isArray(bsc.floors) && bsc.floors.length > 0) loadedFloors = bsc.floors;
          if (Array.isArray(bsc.fanSystems) && bsc.fanSystems.length > 0) loadedFans = bsc.fanSystems;
          if (typeof bsc.totalFans === 'number') loadedTotalFans = bsc.totalFans;
          if (bsc.unitSystem === "si" || bsc.unitSystem === "ip") loadedUnitSystem = bsc.unitSystem;
          if (bsc.groupByMode === "zone" || bsc.groupByMode === "level") loadedGroupBy = bsc.groupByMode;
          if (typeof bsc.showGlobalFanSizing === 'boolean') loadedShowSizing = bsc.showGlobalFanSizing;
        }
      }

      if (!loadedUnitSystem) {
        const savedUnitSystem = (pId && pId !== "default" ? localStorage.getItem(`lp_unit_system_${pId}`) : null) || localStorage.getItem("lp_unit_system") as "si" | "ip" | null;
        if (savedUnitSystem && (savedUnitSystem === "si" || savedUnitSystem === "ip")) {
          loadedUnitSystem = savedUnitSystem;
        }
      }
      if (loadedUnitSystem) setUnitSystem(loadedUnitSystem);
      if (loadedGroupBy) setGroupByMode(loadedGroupBy);

      if (!loadedFloors) {
        const savedRows = (pId && pId !== "default" ? localStorage.getItem(`lp_rows_${pId}`) : null) || (pId === "default" ? localStorage.getItem("lp_rows") : null);
        if (savedRows) {
          const parsed: any[] = JSON.parse(savedRows);
          loadedFloors = parsed.map((f, idx) => {
            const bLevel = f.basementLevel || (f.name ? f.name.split(" - ")[0] : `Level ${idx + 1}`);
            const zName = f.zoneName || (f.name && f.name.includes(" - ") ? f.name.split(" - ")[1] : `Lift Lobby ${idx + 1}`);
            const displayName = f.name && f.name.includes(" - ") ? f.name : `${bLevel} - ${zName}`;
            return {
              id: f.id || `floor-${idx}`,
              basementLevel: bLevel,
              zoneName: zName,
              name: displayName,
              area: typeof f.area === 'number' ? f.area : Number(f.area) || 0,
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
          { id: "floor-1", basementLevel: "Level 1", zoneName: "Lift Lobby 1", name: "Level 1 - Lift Lobby 1", area: 350, height: 3 },
          { id: "floor-2", basementLevel: "Level 2", zoneName: "Lift Lobby 1", name: "Level 2 - Lift Lobby 1", area: 350, height: 3 },
          { id: "floor-3", basementLevel: "Level 3", zoneName: "Lift Lobby 1", name: "Level 3 - Lift Lobby 1", area: 350, height: 3 },
          { id: "floor-4", basementLevel: "Level 1", zoneName: "Service Lobby", name: "Level 1 - Service Lobby", area: 250, height: 3 },
          { id: "floor-5", basementLevel: "Level 2", zoneName: "Service Lobby", name: "Level 2 - Service Lobby", area: 250, height: 3 },
          { id: "floor-6", basementLevel: "Level 3", zoneName: "Service Lobby", name: "Level 3 - Service Lobby", area: 250, height: 3 }
        ]);
      }

      if (!loadedFans) {
        const savedFans = (pId && pId !== "default" ? localStorage.getItem(`lp_fan_systems_${pId}`) : null) || (pId === "default" ? localStorage.getItem("lp_fan_systems") : null);
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
            name: "Lift Lobby Pressurisation System 1",
            floorIds: ["floor-1", "floor-2", "floor-3"],
            fanType: "Pressurisation",
            fanQty: 2,
            length: 35,
            frictionFactor: 1.2,
            louver: 40,
            grille: 15,
            sa: 30,
            collapsed: false
          },
          {
            id: "fs-2",
            name: "Service Lobby Pressurisation System 1",
            floorIds: ["floor-4", "floor-5", "floor-6"],
            fanType: "Pressurisation",
            fanQty: 2,
            length: 30,
            frictionFactor: 1.2,
            louver: 35,
            grille: 15,
            sa: 25,
            collapsed: false
          }
        ]);
      }

      if (loadedTotalFans === null) {
        const savedTotalFans = (pId && pId !== "default" ? localStorage.getItem(`lp_total_fans_${pId}`) : null) || (pId === "default" ? localStorage.getItem("lp_total_fans") : null);
        if (savedTotalFans) loadedTotalFans = Number(savedTotalFans);
      }
      if (loadedTotalFans !== null && !isNaN(loadedTotalFans)) {
        setTotalFans(loadedTotalFans);
      }

      if (loadedShowSizing === null) {
        const savedShowSizing = localStorage.getItem("lp_show_global_fan_sizing");
        if (savedShowSizing !== null) loadedShowSizing = savedShowSizing === "true";
      }
      if (loadedShowSizing !== null) {
        setShowGlobalFanSizing(loadedShowSizing);
      }

      if (project?.id) setLoadedProjectId(project.id);
    } catch (e) {
      console.error("Failed to load lobby pressurisation calc configurations", e);
    } finally {
      setIsLoaded(true);
    }
  }, [project?.id, isInitializing]);

  // Save to local storage & workspace data on changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const pId = project?.id || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : null) || "default";

      const strRows = JSON.stringify(floors);
      localStorage.setItem("lp_rows", strRows);
      if (pId) localStorage.setItem(`lp_rows_${pId}`, strRows);

      const strFans = JSON.stringify(fanSystems);
      localStorage.setItem("lp_fan_systems", strFans);
      if (pId) localStorage.setItem(`lp_fan_systems_${pId}`, strFans);

      const strTotalFans = totalFans.toString();
      localStorage.setItem("lp_total_fans", strTotalFans);
      if (pId) localStorage.setItem(`lp_total_fans_${pId}`, strTotalFans);

      localStorage.setItem("lp_show_global_fan_sizing", showGlobalFanSizing.toString());
      localStorage.setItem("lp_unit_system", unitSystem);
      if (pId) localStorage.setItem(`lp_unit_system_${pId}`, unitSystem);

      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        dirtyStore.set(false);
      } else {
        dirtyStore.set(true);
      }

      if (project?.id) {
        let wdata = project.workspace_data || {};
        if (typeof wdata === 'string') {
          try { wdata = JSON.parse(wdata); } catch(e) {}
        }
        wdata.lobby_pressurisation = {
          floors,
          fanSystems,
          totalFans,
          unitSystem,
          groupByMode,
          showGlobalFanSizing,
          updatedAt: new Date().toISOString()
        };
        project.workspace_data = wdata;
      }
    } catch (e) {
      console.error("Failed to save Lobby Pressurisation state", e);
    }
  }, [floors, fanSystems, totalFans, unitSystem, groupByMode, showGlobalFanSizing, project?.id, isLoaded]);

  useEffect(() => {
    const handleTriggerSave = (e: any) => {
      if (e.detail) e.detail.handled = true;
      dirtyStore.set(false);
      if (typeof forceSaveToCloud === "function") {
        forceSaveToCloud(true);
      }
      toast.success("Lobby Pressurisation calculations saved successfully.");
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
        height: Number((f.height * convHeight).toFixed(1))
      })));

      setNewFloor(prev => ({
        ...prev,
        area: prev.area !== "" ? Math.round(Number(prev.area) * convArea) : "",
        height: prev.height !== "" ? Number((Number(prev.height) * convHeight).toFixed(1)) : ""
      }));
    }

    setUnitSystem(targetUnit);
    const pId = project?.id;
    localStorage.setItem("lp_unit_system", targetUnit);
    if (pId) localStorage.setItem(`lp_unit_system_${pId}`, targetUnit);

    setShowUnitConfirmModal(false);
    setPendingUnitTarget(null);
  };

  // Calculated Rows strictly based on 6 ACH
  const calculatedRows = useMemo(() => {
    return computeLobbyFloors(floors, ip);
  }, [floors, ip, unitSystem]);

  // Unique level and zone names for filter dropdowns
  const uniqueLevels = useMemo(() => {
    const levels = new Set<string>();
    calculatedRows.forEach(r => {
      const lvl = (r.basementLevel || "Level 1").trim();
      if (lvl) levels.add(lvl);
    });
    return Array.from(levels).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [calculatedRows]);

  const uniqueZones = useMemo(() => {
    const zones = new Set<string>();
    calculatedRows.forEach(r => {
      const z = (r.zoneName || "Lift Lobby 1").trim();
      if (z) zones.add(z);
    });
    return Array.from(zones).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [calculatedRows]);

  // Filter calculated rows based on search query, filters, and flagged state
  const filteredRows = useMemo(() => {
    return calculatedRows.filter(r => {
      const lvlName = (r.basementLevel || "Level 1").trim();
      const zName = (r.zoneName || "Lift Lobby 1").trim();
      
      if (filterLevel !== "all" && lvlName !== filterLevel) {
        return false;
      }
      if (filterZone !== "all" && zName !== filterZone) {
        return false;
      }
      if (filterFlagged && !r.flagged) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullStr = `${lvlName} ${zName} ${r.name || ""}`.toLowerCase();
        if (!fullStr.includes(q)) return false;
      }
      return true;
    });
  }, [calculatedRows, filterLevel, filterZone, filterFlagged, searchQuery]);

  // Grouped calculated rows: Supports both 'zone' (same-same zones across floors) and 'level' (floor-by-floor)
  const calculatedGroups = useMemo(() => {
    return computeLobbyGroups(filteredRows as CalculatedLobbyFloor[], groupByMode, zoneSortBy, levelSortOrder);
  }, [filteredRows, groupByMode, levelSortOrder, zoneSortBy]);

  // Overall Global Totals (Strictly 6 ACH)
  const totals = useMemo(() => {
    return computeLobbyTotals(calculatedRows, totalFans);
  }, [calculatedRows, totalFans]);

  const groupOrder = useMemo(() => {
    return calculatedGroups.map(g => g.groupName);
  }, [calculatedGroups]);

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
    const grpComments = getMergedItemComments(groupValue, groupValue, commentsList, "/lobby-pressurisation", project?.id);
    const grp = calculatedGroups.find(g => g.groupName === groupValue);
    const count = grp ? grp.rows.length : calculatedRows.filter(r => (groupByMode === "zone" ? r.zoneName : r.basementLevel) === groupValue).length;
    const subArea = grp ? grp.totalArea : 0;
    const subVol = grp ? grp.totalVolume : 0;
    const sub6 = grp ? grp.subtotal6 : 0;

    return (
      <div className="flex items-center justify-between w-full pr-4 text-xs">
        <div className="flex items-center gap-1.5 font-medium">
          <strong className="font-bold text-primary">{groupValue}</strong>
          <span className="text-[10.5px] text-muted-foreground font-normal">({count} {count === 1 ? "space" : "spaces"})</span>
          {grpComments.length > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[9.5px]">
              <MessageSquare className="size-2.5 fill-blue-500/20" />
              <span>{grpComments.length}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3.5 font-mono text-[11px] text-muted-foreground">
          <span>Σ Area: <strong className="text-foreground">{subArea.toLocaleString()} {ip ? "ft²" : "m²"}</strong></span>
          <span>Σ Vol: <strong className="text-foreground">{subVol.toLocaleString()} {ip ? "ft³" : "m³"}</strong></span>
          <span>Total 6 ACH: <strong className="text-primary font-bold">{sub6.toLocaleString()} {ip ? "CFM" : "L/s"}</strong></span>
        </div>
      </div>
    );
  };

  const renderGroupContextMenu = (groupValue: string) => {
    const grp = calculatedGroups.find(g => g.groupName === groupValue);
    const matching = grp ? grp.rows : calculatedRows.filter(r => (groupByMode === "zone" ? r.zoneName : r.basementLevel) === groupValue);
    const matchingIds = matching.map(r => r.id);

    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1.5 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => handleOpenComment(groupValue, groupValue, "level")}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
        >
          <MessageSquare className="size-3.5 text-blue-600" />
          <span>Add Comment to {groupValue}</span>
        </ContextMenuItem>
        <ContextMenuSeparator className="h-px bg-border my-1" />
        <ContextMenuItem
          onClick={() => handleOpenBulkEdit(matchingIds)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
        >
          <Edit3 className="size-3.5 text-primary" />
          <span>Bulk Edit {matchingIds.length} Spaces</span>
        </ContextMenuItem>
        {grp && (
          <ContextMenuItem
            onClick={() => handleOpenEditLevelModal(grp)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-primary" />
            <span>Edit Group Parameters</span>
          </ContextMenuItem>
        )}
        <ContextMenuSeparator className="h-px bg-border my-1" />
        <ContextMenuItem
          onClick={() => handleAddZoneToLevel(groupValue)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
        >
          <Plus className="size-3.5 text-emerald-600" />
          <span>Add Space to {groupValue}</span>
        </ContextMenuItem>
        <ContextMenuSeparator className="h-px bg-border my-1" />
        <ContextMenuItem
          onClick={() => handleDeleteLevel(groupValue, matchingIds)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg cursor-pointer font-medium"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Entire {groupValue}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const renderRowContextMenu = (row: typeof calculatedRows[0]) => {
    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1.5 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => handleOpenComment(row.id, row.name || row.zoneName, "space")}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
        >
          <MessageSquare className="size-3.5 text-blue-600" />
          <span>Add Comment to {row.name || row.zoneName}</span>
        </ContextMenuItem>
        <ContextMenuSeparator className="h-px bg-border my-1" />
        <ContextMenuItem
          onClick={() => handleOpenBulkEdit([row.id])}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
        >
          <Edit3 className="size-3.5 text-primary" />
          <span>Bulk Edit Space</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => handleDuplicateZone(row)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>Duplicate Space</span>
        </ContextMenuItem>
        <ContextMenuSeparator className="h-px bg-border my-1" />
        <ContextMenuItem
          onClick={() => handleDeleteFloor(row.id)}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg cursor-pointer font-medium"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Space</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const columns: Column<typeof calculatedRows[0]>[] = [
    {
      key: "basementLevel",
      header: "LEVEL / FLOOR",
      width: 140,
      editable: true,
      render: (r) => (
        <input
          disabled={isApprovedLocked}
          type="text"
          value={r.basementLevel}
          onChange={(e) => handleUpdateFloorCell(r.id, "basementLevel", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="h-6 px-1.5 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-background focus:border-border rounded border border-transparent text-xs font-medium text-foreground outline-none w-full"
          placeholder="Level 1"
        />
      ),
    },
    {
      key: "zoneName",
      header: "ZONE",
      width: 160,
      editable: true,
      render: (r) => {
        const itemComments = getMergedItemComments(r.id, r.zoneName || r.name, commentsList, "/lobby-pressurisation", project?.id);
        return (
          <div className="flex items-center gap-1.5 w-full">
            {itemComments.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenComment(r.id, r.zoneName || r.name, "space");
                }}
                title={`${itemComments.length} comment(s)/task(s) assigned`}
                className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <MessageSquare className="size-3.5 fill-blue-500/20" />
                <span className="text-[10px] font-bold">{`${itemComments.length}`}</span>
              </button>
            )}
            <input
              disabled={isApprovedLocked}
              type="text"
              value={r.zoneName}
              onChange={(e) => handleUpdateFloorCell(r.id, "zoneName", e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="h-6 px-1.5 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-background focus:border-border rounded border border-transparent text-xs font-medium text-foreground outline-none w-full"
              placeholder="Lift Lobby 1"
            />
          </div>
        );
      },
    },
    {
      key: "area",
      header: `AREA (${ip ? "FT²" : "M²"})`,
      width: 110,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <input
          disabled={isApprovedLocked}
          type="number"
          value={r.area || ""}
          onChange={(e) => handleUpdateFloorCell(r.id, "area", parseFloat(e.target.value) || 0)}
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-full text-center px-1 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-background focus:border-border rounded border border-transparent text-xs font-mono font-semibold text-foreground outline-none"
          placeholder="0"
        />
      ),
    },
    {
      key: "height",
      header: `HEIGHT (${ip ? "FT" : "M"})`,
      width: 90,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <input
          disabled={isApprovedLocked}
          type="number"
          step="0.1"
          value={r.height || ""}
          onChange={(e) => handleUpdateFloorCell(r.id, "height", parseFloat(e.target.value) || 0)}
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-full text-center px-1 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-background focus:border-border rounded border border-transparent text-xs font-mono font-semibold text-foreground outline-none"
          placeholder="0"
        />
      ),
    },
    {
      key: "volume",
      header: `VOLUME (${ip ? "FT³" : "M³"})`,
      width: 110,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground font-medium">
          {r.volume.toLocaleString()}
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
        <span className="font-mono text-xs text-primary font-bold">
          {r.flow6ach.toLocaleString()}
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
            handleUpdateFloorCell(r.id, "flagged", !r.flagged);
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

  const handleAddFloor = () => {
    if (!newFloor.name && !newFloor.zone) return;
    const lvlName = newFloor.name.trim() || "Level 1";
    const zName = newFloor.zone.trim() || "Lift Lobby 1";
    const numZ = newFloor.numZones !== "" && !isNaN(Number(newFloor.numZones)) ? Math.max(1, Number(newFloor.numZones)) : 1;
    
    const totalArea = newFloor.area !== "" && !isNaN(Number(newFloor.area)) ? Number(newFloor.area) : 350;
    const heightVal = newFloor.height !== "" && !isNaN(Number(newFloor.height)) ? Number(newFloor.height) : 3;

    const baseId = Date.now();
    const newEntries: LobbyFloor[] = [];

    if (numZ === 1) {
      newEntries.push({
        id: `floor-${baseId}`,
        basementLevel: lvlName,
        zoneName: zName,
        name: `${lvlName} - ${zName}`,
        area: totalArea,
        height: heightVal
      });
    } else {
      const perZoneArea = Math.round(totalArea / numZ);

      for (let i = 1; i <= numZ; i++) {
        const fullZoneName = numZ > 1 && !zName.includes(`${i}`) ? `${zName} ${i}` : zName;
        newEntries.push({
          id: `floor-${baseId}-${i}`,
          basementLevel: lvlName,
          zoneName: fullZoneName,
          name: `${lvlName} - ${fullZoneName}`,
          area: perZoneArea,
          height: heightVal
        });
      }
    }

    updateFloorsWithHistory([...floors, ...newEntries]);
    setNewFloor({ name: "", zone: "", area: "", height: "", numZones: "" });
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
    setFanSystems(fanSystems.map(fs => ({
      ...fs,
      floorIds: fs.floorIds.filter(fId => fId !== id)
    })));
  };

  const handleDeleteLevel = (groupName: string, rowIds?: string[]) => {
    const idsToDelete = rowIds || floors.filter(f => (groupByMode === "zone" ? f.zoneName : f.basementLevel) === groupName).map(f => f.id);
    const updatedFloors = floors.filter(f => !idsToDelete.includes(f.id));
    updateFloorsWithHistory(updatedFloors);
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      idsToDelete.forEach(id => next.delete(id));
      return next;
    });
    setFanSystems(fanSystems.map(fs => ({
      ...fs,
      floorIds: fs.floorIds.filter(fId => !idsToDelete.includes(fId))
    })));
    toast.success(`Deleted entire group "${groupName}"`);
  };

  const handleOpenEditLevelModal = (grp: typeof calculatedGroups[0]) => {
    setEditLevelTarget(grp.groupName);
    setEditLevelData({
      levelName: grp.groupName,
      area: grp.totalArea,
      height: grp.rows[0]?.height || 3,
      numZones: grp.rows.length
    });
    setShowEditLevelModal(true);
  };

  const handleSaveEditLevel = () => {
    if (!editLevelTarget) return;
    const newLvlName = editLevelData.levelName.trim() || editLevelTarget;
    const totalArea = editLevelData.area !== "" && !isNaN(Number(editLevelData.area)) ? Number(editLevelData.area) : 350;
    const heightVal = editLevelData.height !== "" && !isNaN(Number(editLevelData.height)) ? Number(editLevelData.height) : 3;
    const numZones = editLevelData.numZones !== "" && !isNaN(Number(editLevelData.numZones)) ? Math.max(1, Number(editLevelData.numZones)) : 1;

    const updated = floors.map(f => {
      const match = groupByMode === "zone" ? f.zoneName === editLevelTarget : f.basementLevel === editLevelTarget;
      if (!match) return f;
      const nextZ = groupByMode === "zone" ? newLvlName : f.zoneName;
      const nextL = groupByMode === "level" ? newLvlName : f.basementLevel;
      const perZoneArea = Math.round(totalArea / numZones);

      return {
        ...f,
        zoneName: nextZ,
        basementLevel: nextL,
        name: `${nextL} - ${nextZ}`,
        area: perZoneArea,
        height: heightVal
      };
    });

    updateFloorsWithHistory(updated);
    setShowEditLevelModal(false);
    toast.success(`Updated group "${editLevelTarget}"`);
  };

  const handleAddZoneToLevel = (groupName: string) => {
    const isZoneGroup = groupByMode === "zone";
    const existing = floors.filter(f => (isZoneGroup ? f.zoneName : f.basementLevel) === groupName);
    const sample = existing[0];
    
    let newLevelName = isZoneGroup ? `Level ${existing.length + 1}` : groupName;
    let newZoneName = isZoneGroup ? groupName : `Lift Lobby ${existing.length + 1}`;

    const newF: LobbyFloor = {
      id: `floor-${Date.now()}`,
      basementLevel: newLevelName,
      zoneName: newZoneName,
      name: `${newLevelName} - ${newZoneName}`,
      area: sample?.area || 350,
      height: sample?.height || 3
    };

    updateFloorsWithHistory([...floors, newF]);
    toast.success(`Added new space to ${groupName}`);
  };

  const handleUpdateFloorCell = (id: string, field: keyof LobbyFloor, val: any) => {
    const updated = floors.map(f => {
      if (f.id === id) {
        const next = { ...f, [field]: val };
        if (field === "basementLevel" || field === "zoneName") {
          next.name = `${next.basementLevel} - ${next.zoneName}`;
        }
        return next;
      }
      return f;
    });
    updateFloorsWithHistory(updated);
  };

  const handleDuplicateZone = (r: LobbyFloor) => {
    const duplicated: LobbyFloor = {
      ...r,
      id: `floor-${Date.now()}`,
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
    setFsSpaceSelectMode("zone");
    setModalFSType("Pressurisation");
    setModalFSFanQty(2);
    setModalSelectedFloorIds([]);
    setModalError("");
    setShowFSModal(true);
  };

  // Open Fan System Modal for edit
  const handleOpenEditFS = (fs: FanSystem) => {
    setModalFSId(fs.id);
    setModalFSName(fs.name);
    setFsSpaceSelectMode("zone");
    setModalFSType(fs.fanType);
    setModalFSFanQty(fs.fanQty || 1);
    setModalSelectedFloorIds(fs.floorIds);
    setModalError("");
    setShowFSModal(true);
  };

  const handleSaveFSModal = () => {
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
      setModalError("Please select at least one space to serve.");
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
    return computeLobbyFanSystems(fanSystems, calculatedRows);
  }, [fanSystems, calculatedRows]);

  const assignedFloorsMap = useMemo(() => {
    const map: Record<string, string> = {};
    fanSystems.forEach(fs => {
      if (modalFSId && fs.id === modalFSId) return;
      fs.floorIds.forEach(fId => {
        map[fId] = fs.name;
      });
    });
    return map;
  }, [fanSystems, modalFSId]);

  const handleExportPDF = () => {
    exportLobbyPressurisationPDF(calculatedGroups, calculatedFanSystems, totals, totalFans, unitSystem);
  };

  return (
    <AppShell 
      title="Lobby Pressurisation" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Page Header & Actions */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Lobby Pressurisation</h1>
              </div>
              
              <button 
                type="button"
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Lobby Pressurisation Intelligence"
              >
                <Sparkles className="size-3.5" /> Intelligence
              </button>

              <CalculationReviewBar 
                projectId={project?.id || activeProjectId || "default"} 
                calculatorPath="/lobby-pressurisation" 
                calculatorTitle="Lobby Pressurisation" 
              />

              {commentsList.length > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Active {commentsList.length === 1 ? "Comment/Task" : "Comments/Tasks"}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={executeUnitSystemChange}
                disabled={isApprovedLocked}
                inputDescriptions="Area, Height, Flow Rate"
                conversionExample={unitSystem === "si" ? "Convert 350 m² → 3,767 sq ft, 3m → 9.8 ft, 1,750 L/s → 3,708 CFM" : "Convert 3,767 sq ft → 350 m², 9.8 ft → 3m, 3,708 CFM → 1,750 L/s"}
              />
            </div>
          </div>

          {/* Review / Approval Status Banner */}
          <CalculationStatusBanner
            projectId={project?.id || activeProjectId || "default"}
            calculatorPath="/lobby-pressurisation"
            calculatorTitle="Lobby Pressurisation"
          />

          {/* Ventilation-style Outer Card Container */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                  ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                  : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Top Row 1: Section Navigation Tabs, Group By & Export */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Rounded-full Pill Tabs */}
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setActiveSection("schedule")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      activeSection === "schedule"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Lobby Schedule (6 ACH)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection("fan-systems")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                      activeSection === "fan-systems"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Fan Systems</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-primary/15 text-primary rounded-full font-extrabold">
                      {fanSystems.length}
                    </span>
                  </button>
                </div>

                {/* Formula Breakdown button placed right next to tabs */}
                <TBtn
                  onClick={() => setShowFormulaModal(true)}
                  title="Calculation Formulas & Methodology"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Right Side: Group By Pill */}
              <div className="flex items-center gap-2.5 select-none shrink-0">
                {activeSection === "schedule" && (
                  <div className="flex items-center bg-surface-2 p-1 rounded-full border border-border/80 text-xs font-semibold select-none">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase px-2">Group By:</span>
                    <button
                      type="button"
                      onClick={() => setGroupByMode("zone")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition cursor-pointer text-xs font-semibold ${
                        groupByMode === "zone"
                          ? "bg-background text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Group matching zone names across all floors together"
                    >
                      <LayoutGrid className="size-3" />
                      Same Zone
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupByMode("level")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition cursor-pointer text-xs font-semibold ${
                        groupByMode === "level"
                          ? "bg-background text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Group floor by floor"
                    >
                      <SplitSquareVertical className="size-3" />
                      Level / Floor
                    </button>
                  </div>
                )}
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
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Level / Floor</span>
                        <select
                          value={filterLevel}
                          onChange={e => setFilterLevel(e.target.value)}
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="all">All Levels ({uniqueLevels.length})</option>
                          {uniqueLevels.map(lvl => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                          ))}
                        </select>
                      </div>

                      {/* Zone Filter */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Lobby Zone</span>
                        <select
                          value={filterZone}
                          onChange={e => setFilterZone(e.target.value)}
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="all">All Zones ({uniqueZones.length})</option>
                          {uniqueZones.map(z => (
                            <option key={z} value={z}>{z}</option>
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
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Group Order</span>
                        <select
                          value={levelSortOrder}
                          onChange={e => setLevelSortOrder(e.target.value as "asc" | "desc")}
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="asc">Ascending (1 → 9 / A → Z)</option>
                          <option value="desc">Descending (9 → 1 / Z → A)</option>
                        </select>
                      </div>

                      {/* Zone Sort Order */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Space Sorting</span>
                        <select
                          value={zoneSortBy}
                          onChange={e => setZoneSortBy(e.target.value as "none" | "name" | "area")}
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="none">Original Order</option>
                          <option value="name">Name (A-Z)</option>
                          <option value="area">Gross Area (Highest First)</option>
                        </select>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Right Controls: Paste, Import, PDF, Add Level */}
                <div className="flex items-center gap-2">
                  {clipboard.length > 0 && (
                    <button
                      onClick={() => {
                        const baseTime = Date.now();
                        const newPasted: LobbyFloor[] = clipboard.map((item, idx) => ({
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
                    onClick={() => setShowImportSourceModal(true)}
                    title="Import lobby floor levels from 3D Studio or Excel schedule"
                  >
                    <Upload className="size-3.5" /> Import
                  </TBtn>

                  {/* PDF Export Button */}
                  <TBtn
                    onClick={handleExportPDF}
                    title="Generate and Export PDF Calculation Report"
                  >
                    <FileText className="size-3.5" /> Export
                  </TBtn>

                  {/* Add Level / Zone (EXTREME RIGHT) */}
                  <TBtn
                    primary
                    onClick={() => {
                      setNewFloor({
                        name: `Level ${uniqueLevels.length + 1}`,
                        zone: `Lift Lobby ${uniqueZones.length + 1}`,
                        area: 350,
                        height: 3,
                        numZones: 1
                      });
                      setShowAddLevelModal(true);
                    }}
                  >
                    <Plus className="size-3.5" /> Add Level / Zone
                  </TBtn>
                </div>
              </div>
            )}

                        {/* Main Content Area */}
            {activeSection === "schedule" ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {/* Floating Bulk Action Overlay Bar when rows selected */}
                {!isApprovedLocked && selectedRowIds.size > 0 && (
                  <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 h-10 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{selectedRowIds.size} row(s) selected</span>
                      <span className="text-primary/30">·</span>
                      <button
                        onClick={() => handleOpenBulkEdit(Array.from(selectedRowIds))}
                        className="flex items-center gap-1 hover:underline font-bold cursor-pointer"
                        title="Bulk Edit selected spaces"
                      >
                        <Edit3 className="size-3" /> Bulk Edit ({selectedRowIds.size})
                      </button>
                      <button
                        onClick={() => {
                          const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
                          setClipboard(selectedItems);
                          toast.info(`${selectedItems.length} space(s) copied`);
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
                          toast.info(`${selectedItems.length} space(s) cut`);
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
                          toast.info(`Deleted ${selectedRowIds.size} space(s)`);
                        }}
                        className="flex items-center gap-1 hover:underline font-bold text-red-500 cursor-pointer"
                        title="Delete selected (Del)"
                      >
                        <Trash2 className="size-3" /> Delete
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedRowIds(new Set())}
                      className="text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 px-2 py-0.5 rounded cursor-pointer"
                    >
                      <X className="size-3" /> Clear (Esc)
                    </button>
                  </div>
                )}

                {/* Grid Container (Full Width) */}
                <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                  {calculatedRows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-2">
                      <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center animate-scale-in">
                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce">
                          <Layers className="size-6" />
                        </div>
                        <h3 className="text-[15px] font-semibold tracking-tight">No Lobby Spaces Defined</h3>
                        <p className="text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                          Start by adding lobby spaces or importing floor levels from 3D Studio or Excel schedule. The system will automatically compute 6 ACH airflow rates and size the pressurisation fan systems.
                        </p>
                        <div className="flex items-center gap-3 w-full">
                          <button
                            onClick={() => {
                              setNewFloor({ name: "Level 1", zone: "Lift Lobby 1", area: 350, height: 3, numZones: 1 });
                              setShowAddLevelModal(true);
                            }}
                            className="flex-1 bg-primary text-primary-foreground font-semibold h-9 rounded-full hover:bg-primary/95 transition-colors text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                          >
                            <Plus className="size-3.5" /> Add Space
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
                      rows={calculatedRows}
                      columns={columns}
                      selected={selectedRowIds}
                      onToggle={toggle}
                      onToggleAll={toggleAll}
                      renderContextMenu={renderRowContextMenu}
                      groupBy={(r) => (groupByMode === "zone" ? ((r.zoneName || "Lift Lobby 1").trim() || "Lift Lobby 1") : ((r.basementLevel || "Level 1").trim() || "Level 1"))}
                      groupOrder={groupOrder}
                      renderGroupHeader={renderGroupHeader}
                      renderGroupContextMenu={renderGroupContextMenu}
                      onToggleGroup={handleToggleGroup}
                      onRowDoubleClick={(r) => handleOpenBulkEdit([r.id])}
                      isReadOnly={isApprovedLocked}
                      gridId="lobby_pressurisation_schedule"
                    />
                  )}
                </div>

                {/* Bottom Statistics Summary Status Bar */}
                <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 no-print modal-blur-bg">
                  <div>
                    Showing <span className="text-foreground font-medium tabular">{filteredRows.length}</span> of {floors.length} spaces
                  </div>
                  <div className="flex items-center gap-3.5 tabular">
                    <span>Σ Area: <span className="font-mono text-foreground font-semibold">{totals.totalArea.toLocaleString()} {ip ? "ft²" : "m²"}</span></span>
                    <span>Σ Volume: <span className="font-mono text-foreground font-semibold">{totals.totalVolume.toLocaleString()} {ip ? "ft³" : "m³"}</span></span>
                    <span>Σ 6 ACH Airflow: <span className="font-mono text-primary font-bold">{totals.total6.toLocaleString()} {ip ? "CFM" : "L/s"}</span></span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
{/* Fan Systems Head Loss Section */}
              
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Lobby Pressurisation Fan Systems</h3>
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
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setInspectFS(fs as any); }}
                                  className="bg-primary/10 hover:bg-primary/20 text-primary p-1.5 rounded transition cursor-pointer"
                                  title="View Fan System Calculation Formulas & Steps (Eye)"
                                >
                                  <Eye className="size-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDuplicateFanSystem(fs); }}
                                  className="bg-transparent text-muted-foreground hover:bg-slate-200/50 dark:hover:bg-slate-700/50 p-1.5 rounded transition cursor-pointer"
                                  title="Duplicate Fan System"
                                >
                                  <Copy className="size-3.5" />
                                </button>
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
                                {/* Compact 6 ACH Flow Required Bar (Strictly IP or SI) */}
                                <div className="flex items-center justify-between gap-2 bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2 text-xs">
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <ShieldCheck className="size-3.5 text-[#0A7BC7]" />
                                    <span className="font-bold text-foreground text-xs font-sans">Required Airflow (6 ACH)</span>
                                    <button
                                      type="button"
                                      onClick={() => setShowFormulaModal(true)}
                                      className="text-muted-foreground hover:text-primary transition cursor-pointer p-0.5 rounded"
                                      title="Click to view fan sizing & 6 ACH formula"
                                    >
                                      <Info className="size-3 text-[#0A7BC7]" />
                                    </button>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 font-mono flex-wrap">
                                    <div className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-0.5 rounded-md text-[11px] whitespace-nowrap">
                                      <span className="font-sans font-bold text-[9.5px] text-muted-foreground uppercase">Total 6 ACH:</span>
                                      <strong className="font-bold text-xs">{fs.totalFlow6.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                                    </div>
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
                                    <span>{ip ? "in.wg/100ft" : "Pa/m"}</span>
                                  </div>
                                </div>

                                {/* Inputs Split */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
                                  <div className="flex flex-col h-full gap-2.5 text-xs">
                                    <div className="font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">Ductwork Inputs</div>
                                    <div className="bg-slate-100/20 dark:bg-slate-900/10 border border-border rounded-xl p-3 flex-1 flex flex-col justify-between gap-2">
                                      <div className="flex flex-col gap-1">
                                        <label className="font-semibold text-muted-foreground">Duct Length ({ip ? "ft" : "m"})</label>
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
                                        <label className="font-semibold text-muted-foreground">Losses in Louver ({ip ? "in.wg" : "Pa"})</label>
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
                                        <label className="font-semibold text-muted-foreground">Losses in Grille ({ip ? "in.wg" : "Pa"})</label>
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
                                        <label className="font-semibold text-muted-foreground">Losses in SAs ({ip ? "in.wg" : "Pa"})</label>
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

                                  <div className="flex flex-col h-full gap-2.5 text-xs">
                                    <div className="flex items-center justify-between font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">
                                      <span>Head Loss Summary</span>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setInspectFS(fs as any); }}
                                        className="flex items-center gap-1 text-[10px] text-primary hover:underline font-semibold cursor-pointer lowercase first-letter:uppercase"
                                        title="View Calculation Formulas"
                                      >
                                        <Eye className="size-3" /> Formula
                                      </button>
                                    </div>
                                    <div className="bg-slate-100/20 dark:bg-slate-900/10 border border-border rounded-xl p-3 flex-1 flex flex-col justify-between gap-1.5">
                                      <div className="flex justify-between items-center text-muted-foreground">
                                        <span>Fittings (60%):</span>
                                        <span className="font-mono">{fs.fittings.toFixed(1)} {ip ? "ft" : "m"}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-muted-foreground">
                                        <span>Eq. Length:</span>
                                        <span className="font-mono">{fs.eqLen.toFixed(1)} {ip ? "ft" : "m"}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-muted-foreground">
                                        <span>Friction Loss:</span>
                                        <span className="font-mono">{fs.frictionLoss.toFixed(1)} {ip ? "in.wg" : "Pa"}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-muted-foreground">
                                        <span>Safety (10%):</span>
                                        <span className="font-mono">{fs.safety.toFixed(1)} {ip ? "in.wg" : "Pa"}</span>
                                      </div>
                                      <div className="flex justify-between items-center border-t border-border/80 pt-2 font-bold text-foreground">
                                        <span>Total Static:</span>
                                        <span className="font-mono text-primary text-sm font-extrabold">{fs.totalStatic} {ip ? "in.wg" : "Pa"}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Results Footer */}
                                <div className="flex justify-between items-center gap-3 bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 rounded-xl p-3 text-xs flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <ShieldCheck className="size-4 text-[#0A7BC7]" />
                                    <span className="font-bold text-foreground">Total Fan Capacity:</span>
                                    <span className="font-mono font-bold text-primary">{fs.totalFlow6.toLocaleString()} {ip ? "CFM" : "L/s"}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-muted-foreground">Per Fan ({fs.fanQty || 1} Qty):</span>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{fs.perFanCap.toLocaleString()} {ip ? "CFM" : "L/s"}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48 bg-popover border border-border rounded-xl shadow-xl p-1.5 text-xs text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleDuplicateFanSystem(fs)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Duplicate System</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleOpenEditFS(fs)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <Edit3 className="size-3.5 text-primary" />
                            <span>Edit System</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => setFanSystems(fanSystems.filter(x => x.id !== fs.id))}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg cursor-pointer font-medium"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Delete System</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}

                    {fanSystems.length === 0 && (
                      <div className="col-span-full border border-dashed border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
                        <Wind className="size-10 text-muted-foreground/40" />
                        <h4 className="font-bold text-sm text-foreground">No Fan Systems Created</h4>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          Create dedicated pressurisation fan systems to size duct head loss and associate floor spaces.
                        </p>
                        <TBtn onClick={handleOpenCreateFS} className="mt-2 text-xs">
                          <Plus className="size-3.5" /> Create Fan System
                        </TBtn>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
      
{/* Add Level Modal */}
      {showAddLevelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <h3 className="font-bold text-base text-foreground">Add Lobby Space / Level</h3>
              <button onClick={() => setShowAddLevelModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Floor / Level</label>
                  <input
                    type="text"
                    placeholder="e.g. Level 1, Basement 1"
                    value={newFloor.name}
                    onChange={e => setNewFloor({ ...newFloor, name: e.target.value })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Lobby Zone Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Lift Lobby 1"
                    value={newFloor.zone}
                    onChange={e => setNewFloor({ ...newFloor, zone: e.target.value })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Gross Area ({ip ? "ft²" : "m²"})</label>
                <input
                  type="number"
                  placeholder="350"
                  value={newFloor.area}
                  onChange={e => setNewFloor({ ...newFloor, area: e.target.value === "" ? "" : Number(e.target.value) })}
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
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
                <Plus className="size-3.5" /> Add Space
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
              <h3 className="font-bold text-base text-foreground">Edit Group — {editLevelTarget}</h3>
              <button onClick={() => setShowEditLevelModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs font-sans">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Group Name</label>
                <input
                  type="text"
                  value={editLevelData.levelName}
                  onChange={e => setEditLevelData({ ...editLevelData, levelName: e.target.value })}
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Total Gross Area ({ip ? "ft²" : "m²"})</label>
                <input
                  type="number"
                  value={editLevelData.area}
                  onChange={e => setEditLevelData({ ...editLevelData, area: e.target.value === "" ? "" : Number(e.target.value) })}
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
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
                  <label className="font-semibold text-foreground">Number of Spaces</label>
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

      {/* Fan System Modal with Zone / Level / Space Batch Selection */}
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
                  placeholder="e.g. Lift Lobby Pressurisation 1"
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
                    <option value="Pressurisation">Pressurisation Fan</option>
                    <option value="Extract">Extract Fan</option>
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

              {/* Associate Lobby Spaces with Mode Tabs */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">Associate Lobby Spaces</label>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg border border-border text-[11px] font-semibold select-none">
                    <button
                      type="button"
                      onClick={() => setFsSpaceSelectMode("zone")}
                      className={`px-2.5 py-0.5 rounded-md transition cursor-pointer font-bold ${
                        fsSpaceSelectMode === "zone"
                          ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      By Zone
                    </button>
                    <button
                      type="button"
                      onClick={() => setFsSpaceSelectMode("level")}
                      className={`px-2.5 py-0.5 rounded-md transition cursor-pointer font-bold ${
                        fsSpaceSelectMode === "level"
                          ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      By Level
                    </button>
                    <button
                      type="button"
                      onClick={() => setFsSpaceSelectMode("space")}
                      className={`px-2.5 py-0.5 rounded-md transition cursor-pointer font-bold ${
                        fsSpaceSelectMode === "space"
                          ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Individual
                    </button>
                  </div>
                </div>

                {/* By Zone Mode */}
                {fsSpaceSelectMode === "zone" && (
                  <div className="border border-border/80 rounded-lg p-1.5 bg-background max-h-44 overflow-y-auto flex flex-col gap-1 select-none">
                    {uniqueZones.map(zName => {
                      const zoneFloors = floors.filter(f => (f.zoneName || "").trim() === zName.trim());
                      const allSelected = zoneFloors.length > 0 && zoneFloors.every(f => modalSelectedFloorIds.includes(f.id));
                      const someSelected = zoneFloors.some(f => modalSelectedFloorIds.includes(f.id));

                      return (
                        <label
                          key={zName}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer border border-transparent hover:border-border/50 transition"
                        >
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => {
                              if (el) el.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={() => {
                              const zoneFloorIds = zoneFloors.map(f => f.id);
                              if (allSelected) {
                                setModalSelectedFloorIds(modalSelectedFloorIds.filter(id => !zoneFloorIds.includes(id)));
                              } else {
                                const merged = Array.from(new Set([...modalSelectedFloorIds, ...zoneFloorIds]));
                                setModalSelectedFloorIds(merged);
                              }
                            }}
                            className="rounded border-border cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground truncate">{zName}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold shrink-0">
                              {zoneFloors.length} Level(s) ({zoneFloors.map(f => f.basementLevel).join(", ")})
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* By Level Mode */}
                {fsSpaceSelectMode === "level" && (
                  <div className="border border-border/80 rounded-lg p-1.5 bg-background max-h-44 overflow-y-auto flex flex-col gap-1 select-none">
                    {uniqueLevels.map(lvlName => {
                      const levelFloors = floors.filter(f => (f.basementLevel || "").trim() === lvlName.trim());
                      const allSelected = levelFloors.length > 0 && levelFloors.every(f => modalSelectedFloorIds.includes(f.id));
                      const someSelected = levelFloors.some(f => modalSelectedFloorIds.includes(f.id));

                      return (
                        <label
                          key={lvlName}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer border border-transparent hover:border-border/50 transition"
                        >
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => {
                              if (el) el.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={() => {
                              const levelFloorIds = levelFloors.map(f => f.id);
                              if (allSelected) {
                                setModalSelectedFloorIds(modalSelectedFloorIds.filter(id => !levelFloorIds.includes(id)));
                              } else {
                                const merged = Array.from(new Set([...modalSelectedFloorIds, ...levelFloorIds]));
                                setModalSelectedFloorIds(merged);
                              }
                            }}
                            className="rounded border-border cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground truncate">{lvlName}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold shrink-0">
                              {levelFloors.length} Zone(s) ({levelFloors.map(f => f.zoneName).join(", ")})
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Individual Mode */}
                {fsSpaceSelectMode === "space" && (
                  <div className="border border-border/80 rounded-lg p-1.5 bg-background max-h-44 overflow-y-auto flex flex-col gap-1 select-none">
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
                )}

                <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
                  <span>Selected: <strong className="text-primary">{modalSelectedFloorIds.length}</strong> of {floors.length} spaces</span>
                  {modalSelectedFloorIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setModalSelectedFloorIds([])}
                      className="text-red-500 hover:underline font-semibold cursor-pointer"
                    >
                      Deselect All
                    </button>
                  )}
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
                onClick={handleSaveFSModal}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer flex items-center gap-1.5"
              >
                Save Fan System
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal (Ventilation style) */}
      {bulkEditOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <div>
                <h3 className="font-bold text-base text-foreground">Bulk Edit Spaces</h3>
                <span className="text-xs text-muted-foreground">Updating {bulkEditTargetIds.length} space(s)</span>
              </div>
              <button onClick={() => setBulkEditOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs font-sans">
              <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                Check the parameters you want to modify across all selected spaces. Unchecked parameters will remain unchanged.
              </p>

              {/* Floor Level Name */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bulkEditFields.basementLevel}
                  onChange={e => setBulkEditFields({ ...bulkEditFields, basementLevel: e.target.checked })}
                  className="rounded border-border cursor-pointer size-4"
                />
                <span className="w-24 font-semibold text-foreground">Floor / Level</span>
                <input
                  type="text"
                  disabled={!bulkEditFields.basementLevel}
                  value={bulkEditValues.basementLevel}
                  onChange={e => setBulkEditValues({ ...bulkEditValues, basementLevel: e.target.value })}
                  placeholder="e.g. Level 1"
                  className="flex-1 bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7] text-xs disabled:opacity-40"
                />
              </div>

              {/* Zone Name */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bulkEditFields.zoneName}
                  onChange={e => setBulkEditFields({ ...bulkEditFields, zoneName: e.target.checked })}
                  className="rounded border-border cursor-pointer size-4"
                />
                <span className="w-24 font-semibold text-foreground">Lobby Zone</span>
                <input
                  type="text"
                  disabled={!bulkEditFields.zoneName}
                  value={bulkEditValues.zoneName}
                  onChange={e => setBulkEditValues({ ...bulkEditValues, zoneName: e.target.value })}
                  placeholder="e.g. Lift Lobby 1"
                  className="flex-1 bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7] text-xs disabled:opacity-40"
                />
              </div>

              {/* Gross Area */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bulkEditFields.area}
                  onChange={e => setBulkEditFields({ ...bulkEditFields, area: e.target.checked })}
                  className="rounded border-border cursor-pointer size-4"
                />
                <span className="w-24 font-semibold text-foreground">Gross Area ({ip ? "ft²" : "m²"})</span>
                <input
                  type="number"
                  disabled={!bulkEditFields.area}
                  value={bulkEditValues.area}
                  onChange={e => setBulkEditValues({ ...bulkEditValues, area: e.target.value })}
                  placeholder="350"
                  className="flex-1 bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7] text-xs disabled:opacity-40 font-mono"
                />
              </div>

              {/* Height */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bulkEditFields.height}
                  onChange={e => setBulkEditFields({ ...bulkEditFields, height: e.target.checked })}
                  className="rounded border-border cursor-pointer size-4"
                />
                <span className="w-24 font-semibold text-foreground">Height ({ip ? "ft" : "m"})</span>
                <input
                  type="number"
                  step="0.1"
                  disabled={!bulkEditFields.height}
                  value={bulkEditValues.height}
                  onChange={e => setBulkEditValues({ ...bulkEditValues, height: e.target.value })}
                  placeholder="3"
                  className="flex-1 bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none focus:border-[#0A7BC7] text-xs disabled:opacity-40 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setBulkEditOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBulkEdit}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer flex items-center gap-1.5"
              >
                Apply Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fan System Calculation Breakdown & Formula Modal (Eye Button) */}
      {inspectFS && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 flex flex-col gap-4 shadow-2xl animate-fade-in max-h-[88vh] overflow-y-auto font-sans">
            <div className="flex justify-between items-center pb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Eye className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    {inspectFS.name}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      {inspectFS.fanType} System
                    </span>
                  </h3>
                  <span className="text-xs text-muted-foreground">Fan System Sizing Formulas & Step-by-Step Mathematical Trace</span>
                </div>
              </div>
              <button 
                onClick={() => setInspectFS(null)} 
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs">
              {/* 1. Served Spaces Airflow Sum */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-[#0A7BC7]" />
                    <span>1. Total Required Airflow (6 ACH)</span>
                  </div>
                  <span className="text-primary font-mono">{inspectFS.totalFlow6.toLocaleString()} {ip ? "CFM" : "L/s"}</span>
                </div>
                <div className="bg-background border border-border/60 rounded-lg p-2.5 font-mono text-[11px] flex flex-col gap-1.5">
                  <div className="text-muted-foreground font-semibold">
                    Formula: Q_total = Σ(Served Spaces 6 ACH Flow)
                  </div>
                  <div className="text-[10.5px] text-slate-700 dark:text-slate-300 border-t border-border/50 pt-1">
                    Served Spaces ({inspectFS.servedFloors.length}):
                    <div className="mt-1 flex flex-col gap-0.5 max-h-24 overflow-y-auto">
                      {inspectFS.servedFloors.map((sf, idx) => (
                        <div key={sf.id || idx} className="flex justify-between text-muted-foreground">
                          <span>• {sf.name} ({sf.area} {ip ? "ft²" : "m²"} × {sf.height} {ip ? "ft" : "m"})</span>
                          <strong className="text-foreground">{sf.flow6ach.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Per-Fan Capacity */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-[#0A7BC7]" />
                    <span>2. Per-Fan Airflow Capacity Split</span>
                  </div>
                  <span className="text-primary font-mono">{inspectFS.perFanCap.toLocaleString()} {ip ? "CFM" : "L/s"}</span>
                </div>
                <div className="bg-background border border-border/60 rounded-lg p-2.5 font-mono text-[11px] flex flex-col gap-1">
                  <div className="text-muted-foreground font-semibold">
                    Formula: Q_fan = Q_total ÷ Fan Qty
                  </div>
                  <div className="text-foreground">
                    Calculation: {inspectFS.totalFlow6.toLocaleString()} ÷ {inspectFS.fanQty || 1} Fan(s) = <strong className="text-primary">{inspectFS.perFanCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                  </div>
                </div>
              </div>

              {/* 3. Ductwork Head Loss Equations */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-[#0A7BC7]" />
                    <span>3. Duct Friction & Component Losses</span>
                  </div>
                  <span className="text-primary font-mono">{inspectFS.totalStatic} {ip ? "in.wg" : "Pa"}</span>
                </div>
                
                <div className="bg-background border border-border/60 rounded-lg p-2.5 font-mono text-[11px] flex flex-col gap-2">
                  <div className="flex justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground">Equivalent Duct Length (L_eq):</span>
                    <span className="text-foreground font-bold">
                      {inspectFS.length} + (0.60 × {inspectFS.length}) = {inspectFS.eqLen.toFixed(1)} {ip ? "ft" : "m"}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground">Duct Friction Loss (ΔP_f):</span>
                    <span className="text-foreground font-bold">
                      {inspectFS.eqLen.toFixed(1)} × {inspectFS.frictionFactor} = {inspectFS.frictionLoss.toFixed(1)} {ip ? "in.wg" : "Pa"}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground">Louvers + Grilles + SAs (ΔP_comp):</span>
                    <span className="text-foreground font-bold">
                      {inspectFS.louver} + {inspectFS.grille} + {inspectFS.sa} = {(inspectFS.louver + inspectFS.grille + inspectFS.sa).toFixed(1)} {ip ? "in.wg" : "Pa"}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground">Safety Allowance (+10%):</span>
                    <span className="text-foreground font-bold">
                      10% × ({(inspectFS.frictionLoss + inspectFS.louver + inspectFS.grille + inspectFS.sa).toFixed(1)}) = {inspectFS.safety.toFixed(1)} {ip ? "in.wg" : "Pa"}
                    </span>
                  </div>

                  <div className="flex justify-between pt-0.5 text-primary font-bold text-xs">
                    <span>Total Static Pressure (ΔP_total):</span>
                    <span className="text-sm">{inspectFS.totalStatic} {ip ? "in.wg" : "Pa"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/60">
              <button
                onClick={() => setInspectFS(null)}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculation Methodology & Formula Guide Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 flex flex-col gap-4 shadow-2xl animate-fade-in max-h-[85vh] overflow-y-auto font-sans">
            <div className="flex justify-between items-center pb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Info className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Lobby Pressurisation & 6 ACH Sizing Methodology</h3>
                  <span className="text-xs text-muted-foreground">Engineering Formulas & Code Calculations</span>
                </div>
              </div>
              <button 
                onClick={() => setShowFormulaModal(false)} 
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              {/* 1. Space Volume */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <div className="size-2 rounded-full bg-[#0A7BC7]" />
                  <span>1. Lobby Space Volume</span>
                </div>
                <div className="bg-background border border-border/60 rounded-lg p-2 font-mono text-[11.5px] text-primary font-semibold">
                  Volume = Gross Area × Height
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Gross floor area of each lift lobby / fire lobby space multiplied by clear floor-to-ceiling height ({ip ? "ft³" : "m³"}).
                </p>
              </div>

              {/* 2. 6 ACH Airflow Rate */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <div className="size-2 rounded-full bg-[#0A7BC7]" />
                  <span>2. Required 6 ACH Airflow Rate</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="bg-background border border-border/60 rounded-lg p-2 flex flex-col gap-1">
                    <span className="font-sans font-bold text-[10px] text-muted-foreground uppercase">IP Units (CFM)</span>
                    <strong className="text-primary font-semibold">CFM = (Volume × 6 ACH) ÷ 60 min</strong>
                  </div>
                  <div className="bg-background border border-border/60 rounded-lg p-2 flex flex-col gap-1">
                    <span className="font-sans font-bold text-[10px] text-muted-foreground uppercase">SI Units (L/s)</span>
                    <strong className="text-primary font-semibold">L/s = (Volume × 6 ACH) ÷ 3.6</strong>
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Mandated 6 air changes per hour for smoke containment and lobby pressurisation pursuant to NFPA 92 / BS EN 12101 standards.
                </p>
              </div>

              {/* 3. Fan Static Pressure Sizing */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <div className="size-2 rounded-full bg-[#0A7BC7]" />
                  <span>3. Fan System Head Loss & Static Pressure</span>
                </div>
                <div className="bg-background border border-border/60 rounded-lg p-2 flex flex-col gap-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Equivalent Length:</span>
                    <strong className="text-foreground">L_eq = Length + (Length × 60% fittings)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duct Friction Loss:</span>
                    <strong className="text-foreground">ΔP_duct = L_eq × Friction Factor</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Safety Margin:</span>
                    <strong className="text-foreground">ΔP_safety = 10% × (ΔP_duct + Louvers + Grilles + SAs)</strong>
                  </div>
                  <div className="flex justify-between border-t border-border/60 pt-1 text-primary">
                    <span className="font-sans font-bold">Total Fan Static:</span>
                    <strong className="font-bold">ΔP_total = ΔP_duct + Louvers + Grilles + SAs + Safety</strong>
                  </div>
                </div>
              </div>

              {/* 4. Multi-Fan Sizing */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border/70 rounded-xl p-3.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <div className="size-2 rounded-full bg-[#0A7BC7]" />
                  <span>4. Multi-Fan Sizing</span>
                </div>
                <div className="bg-background border border-border/60 rounded-lg p-2 font-mono text-[11.5px] text-primary font-semibold">
                  Per Fan Capacity = Total 6 ACH Flow ÷ Number of Fans
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Distributes total required airflow across configured duty fans (e.g. 2 x 50% duty configuration).
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/60">
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Source Selection Modal */}
      <ImportSourceModal
        isOpen={showImportSourceModal}
        onClose={() => setShowImportSourceModal(false)}
        onSelect3D={() => handleExtractFrom3DModel()}
        onSelectExcel={() => excelFileInputRef.current?.click()}
        title="Import Lobby Spaces"
        description="Select whether to import spaces from the active 3D BIM Viewer model or an existing schedule file."
      />

      {/* Hidden file inputs for manual file select if needed */}
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

      {/* 3D Model Extraction Preview Modal */}
      {show3DPreviewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 flex flex-col gap-4 shadow-2xl animate-fade-in max-h-[85vh]">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Box className="size-5 text-[#0A7BC7]" />
                <h3 className="font-bold text-base text-foreground">Import Spaces from 3D BIM Model</h3>
              </div>
              <button onClick={() => setShow3DPreviewModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              We identified <strong>{pending3DSpaces.length}</strong> spaces from your active IFC Model. Select the lobby spaces you wish to populate:
            </p>

            <div className="flex-1 overflow-y-auto border border-border/70 rounded-xl divide-y divide-border/40 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-100/60 dark:bg-slate-900/40 font-bold text-foreground select-none">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected3DIds.size === pending3DSpaces.length && pending3DSpaces.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelected3DIds(new Set(pending3DSpaces.map(s => s.id)));
                      else setSelected3DIds(new Set());
                    }}
                    className="rounded border-border cursor-pointer"
                  />
                  <span>Select All ({pending3DSpaces.length})</span>
                </label>
                <span>{selected3DIds.size} Selected</span>
              </div>

              {pending3DSpaces.map(sp => (
                <label key={sp.id} className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={selected3DIds.has(sp.id)}
                      onChange={(e) => {
                        const next = new Set(selected3DIds);
                        if (e.target.checked) next.add(sp.id);
                        else next.delete(sp.id);
                        setSelected3DIds(next);
                      }}
                      className="rounded border-border cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">{sp.storey || "Storey"} — {sp.name}</span>
                      <span className="text-[10px] text-muted-foreground">Category: {sp.category} | GUID: {sp.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                  <div className="font-mono text-xs text-right">
                    <span className="font-bold text-primary">{Math.round(sp.grossFloorArea || 50)} {ip ? "ft²" : "m²"}</span>
                    <span className="text-muted-foreground text-[10px] block">H: {sp.height || 3} {ip ? "ft" : "m"}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border/60">
              <button
                onClick={() => setShow3DPreviewModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApply3DImport}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="size-3.5" /> Import ({selected3DIds.size}) Spaces
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit System Conversion Modal */}
      {showUnitConfirmModal && pendingUnitTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Change Unit System to {pendingUnitTarget.toUpperCase()}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Would you like to automatically convert existing numerical values (Areas, Heights, and Airflows) to <strong>{pendingUnitTarget.toUpperCase()}</strong>?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => executeUnitSystemChange(pendingUnitTarget, true)}
                className="w-full py-2 px-3 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition cursor-pointer shadow-xs"
              >
                Yes, Convert Existing Values
              </button>
              <button
                onClick={() => executeUnitSystemChange(pendingUnitTarget, false)}
                className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-foreground font-bold rounded-xl text-xs transition cursor-pointer"
              >
                No, Change Unit Labels Only
              </button>
              <button
                onClick={() => { setShowUnitConfirmModal(false); setPendingUnitTarget(null); }}
                className="w-full py-1.5 text-center text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Synced Assign Comment Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          onSave={handleSaveComment}
          spaceId={commentTargetItem.id}
          spaceName={commentTargetItem.name}
          targetType={commentTargetItem.type as any || "space"}
          calculatorPath="/lobby-pressurisation"
          calculatorTitle="Lobby Pressurisation"
        />
      )}

        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <LobbyPressurisationIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              floors={floors}
              calculatedFanSystems={calculatedFanSystems}
              calculatedRows={calculatedRows}
              totals={totals}
              unitSystem={unitSystem}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

interface LobbyPressurisationIntelligenceDrawerProps {
  onClose: () => void;
  floors: LobbyFloor[];
  calculatedFanSystems: any[];
  calculatedRows: any[];
  totals: {
    totalArea: number;
    totalVolume: number;
    total6: number;
    totalM3h: number;
    perFanCapacity: number;
    sizedCap: number;
  };
  unitSystem: "si" | "ip";
}

function LobbyPressurisationIntelligenceDrawer({
  onClose,
  floors,
  calculatedFanSystems,
  calculatedRows,
  totals,
  unitSystem,
}: LobbyPressurisationIntelligenceDrawerProps) {
  const ip = unitSystem === "ip";
  const flowUnit = ip ? "CFM" : "L/s";
  const volUnit = ip ? "ft³" : "m³";
  const pressUnit = ip ? "in.wg" : "Pa";

  // Check unassigned spaces
  const assignedIds = new Set<string>();
  calculatedFanSystems.forEach(fs => {
    (fs.floorIds || []).forEach((id: string) => assignedIds.add(id));
  });
  const unassignedCount = calculatedRows.filter(r => !assignedIds.has(r.id)).length;

  // Max fan static
  const maxStaticSys = [...calculatedFanSystems].sort((a, b) => (b.totalStatic || 0) - (a.totalStatic || 0))[0];

  return (
    <div className="flex flex-col h-full bg-card p-4 overflow-y-auto gap-4 select-none text-xs font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Pressurisation Intelligence</h3>
            <p className="text-[10.5px] text-muted-foreground">Real-time Code & Engineering Sizing Audits</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Summary KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-2 border border-border/70 rounded-xl p-2.5 flex flex-col">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Required 6 ACH</span>
          <span className="font-mono text-base font-extrabold text-primary">
            {totals.total6.toLocaleString()} <span className="text-xs font-normal">{flowUnit}</span>
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">({totals.totalM3h.toLocaleString()} m³/h)</span>
        </div>

        <div className="bg-surface-2 border border-border/70 rounded-xl p-2.5 flex flex-col">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Containment Vol</span>
          <span className="font-mono text-base font-extrabold text-foreground">
            {totals.totalVolume.toLocaleString()} <span className="text-xs font-normal">{volUnit}</span>
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">{floors.length} scheduled {floors.length === 1 ? "space" : "spaces"}</span>
        </div>
      </div>

      {/* Code & Safety Health Checks */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">Compliance & Health Checks</span>

        {/* 6 ACH Standard Verification */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-emerald-800 dark:text-emerald-300">NFPA 92 / BS EN 12101 Compliant</span>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
              Air change rate is actively enforced at 6.0 ACH across all lobby and smoke containment zones.
            </p>
          </div>
        </div>

        {/* Unassigned Spaces Warning */}
        {unassignedCount > 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-amber-800 dark:text-amber-300">{unassignedCount} Unassigned Space(s)</span>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Some lobby spaces are not yet linked to a dedicated Fan System. Head losses cannot be calculated for unserved spaces.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-surface-2 border border-border/70 rounded-xl p-3 flex items-start gap-2.5">
            <Check className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-foreground">Full Fan Coverage</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                All {floors.length} lobby floor spaces are mapped to fan systems.
              </p>
            </div>
          </div>
        )}

        {/* Static Head Loss Evaluation */}
        {maxStaticSys && (
          <div className="bg-surface-2 border border-border/70 rounded-xl p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Critical Path Head Loss</span>
              <span className="font-mono font-extrabold text-primary">{maxStaticSys.totalStatic} {pressUnit}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Highest static pressure in <strong>{maxStaticSys.name}</strong> (Duct friction: {maxStaticSys.frictionLoss.toFixed(1)} {pressUnit}, Safety allowance: +10%).
            </p>
          </div>
        )}
      </div>

      {/* Fan Configuration Insights */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">Duty / Standby Insights</span>
        <div className="bg-surface-2 border border-border/70 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Configured Fan Systems:</span>
            <span className="font-bold font-mono text-foreground">{calculatedFanSystems.length}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Standard Multi-Fan Split:</span>
            <span className="font-bold text-foreground">2 × 50% Duty</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Average Flow per Duty Fan:</span>
            <span className="font-bold font-mono text-primary">{totals.perFanCapacity.toLocaleString()} {flowUnit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
