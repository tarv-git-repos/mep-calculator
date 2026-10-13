import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
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
  Copy, CopyPlus, Scissors, Clipboard, ClipboardPaste, Flame, CheckCircle2, RefreshCw, Check,
  Box, Upload, Download, Filter, ArrowUpDown, Search, MessageSquare, ShieldCheck,
  Building2, LayoutGrid, SplitSquareVertical, Eye, SlidersHorizontal, BookOpen
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportLobbyPressurisationPDF } from "@/lib/exportLobbyPressurisationPDF";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { ImportSourceModal } from "@/components/workspace/ImportSourceModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { EditLobbySpaceModal } from "@/components/workspace/EditLobbySpaceModal";
import { FloorSelect } from "@/components/workspace/FloorSelect";
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
import { useConfirm } from "@/hooks/use-confirm";

export const Route = createFileRoute("/lobby-pressurisation")({
  head: () => ({
    meta: [
      { title: "Lobby Pressurisation — MEP Calc" },
      { name: "description", content: "Lobby Pressurisation ventilation calculator and fan system head sizer." },
    ],
  }),
  component: LobbyPressurisationPage,
});

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

function LobbyPressurisationPage() {
  const { project, activeProjectId, forceSaveToCloud, isInitializing, updateProject } = useWorkspace();
  const confirm = useConfirm();
  const calcReviewState = useCalculationReviewState("/lobby-pressurisation", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/lobby-pressurisation", activeProjectId || project?.id);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  
  // Active section view state
  const [activeSection, setActiveSection] = useState<"schedule" | "fan-systems" | "report">("schedule");
  
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
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const isApprovedLocked = useCalculationLock("/lobby-pressurisation", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  
  
  // Schedule state
  const [floors, setFloors] = useState<LobbyFloor[]>([]);
  const [newFloor, setNewFloor] = useState<{ name: string; zone: string; area: number | ""; height: number | ""; numZones: number | "" }>({ name: "", zone: "", area: "", height: "", numZones: "" });

  // Fan Systems state
  const [fanSystems, setFanSystems] = useState<FanSystem[]>([]);
  const [totalFans, setTotalFans] = useState<number>(2);

  // Modal state
  const [showEditLevelModal, setShowEditLevelModal] = useState<boolean>(false);
  const [editLevelTarget, setEditLevelTarget] = useState<string | null>(null);
  const [editLevelData, setEditLevelData] = useState<{ levelName: string; area: number | ""; height: number | ""; numZones: number | "" }>({ levelName: "", area: "", height: "", numZones: "" });
  const [editingFloor, setEditingFloor] = useState<LobbyFloor | null>(null);
  const [isNewFloor, setIsNewFloor] = useState<boolean>(false);
  
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
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );

      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
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
        toast.info(`Selected all ${floors.length} space(s)`);
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
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          if (isApprovedLocked || isEffectiveReadOnly) {
            toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
            return;
          }
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
        if (clipboard.length > 0) {
          e.preventDefault();
          if (isApprovedLocked || isEffectiveReadOnly) {
            toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
            return;
          }
          const baseTime = Date.now();
          const newPasted: LobbyFloor[] = clipboard.map((item, idx) => ({
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
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          if (isApprovedLocked || isEffectiveReadOnly) {
            toast.info("Workspace is in Read-Only mode. Duplicating spaces is locked.", { id: "readonly-notice" });
            return;
          }
          const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
          const baseTime = Date.now();
          const clones: LobbyFloor[] = selectedItems.map((item, idx) => ({
            ...item,
            id: `floor-${baseTime}-${idx}`,
            name: item.name.includes("(Copy)") ? item.name : `${item.name} (Copy)`
          }));
          updateFloorsWithHistory([...floors, ...clones]);
          setSelectedRowIds(new Set(clones.map(n => n.id)));
          toast.success(`Duplicated ${clones.length} space(s)`);
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
      <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => handleOpenComment(groupValue, groupValue, "level")}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5 shrink-0" />
          <span className="whitespace-nowrap">Add Comment to {groupValue}</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => handleAddZoneToLevel(groupValue)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Plus className="size-3.5 text-muted-foreground shrink-0" />
          <span className="whitespace-nowrap">Add Space to {groupValue}</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {grp && (
          <ContextMenuItem
            onClick={() => handleOpenEditLevelModal(grp)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-muted-foreground shrink-0" />
            <span className="whitespace-nowrap">Edit Group Parameters</span>
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
          onClick={() => handleOpenComment(row.id, row.name || row.zoneName, "space")}
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
            const newPasted: LobbyFloor[] = clipboard.map((item, idx) => ({
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
              const clones: LobbyFloor[] = selectedItems.map((item, idx) => ({
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
                  setSelectedRowIds(prev => {
                    const next = new Set(prev);
                    targetIds.forEach(id => next.delete(id));
                    return next;
                  });
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
      key: "basementLevel",
      header: "LEVEL / FLOOR",
      width: 180,
      editable: true,
      render: (r) => (
        <InlineInput
          disabled={isApprovedLocked}
          value={r.basementLevel}
          onCommit={(val) => handleUpdateFloorCell(r.id, "basementLevel", val)}
          className="font-medium text-[13.5px]"
          placeholder="Level 1"
        />
      ),
    },
    {
      key: "zoneName",
      header: "ZONE",
      width: 260,
      editable: true,
      render: (r) => {
        const itemComments = getMergedItemComments(r.id, r.zoneName || r.name, commentsList, "/lobby-pressurisation", project?.id);
        return (
          <div className="flex items-center gap-1.5 w-full pr-1">
            <InlineInput
              disabled={isApprovedLocked}
              value={r.zoneName}
              onCommit={(val) => handleUpdateFloorCell(r.id, "zoneName", val)}
              className="font-medium text-[13.5px] flex-1 min-w-0"
              placeholder="Lift Lobby 1"
            />
          </div>
        );
      },
    },
    {
      key: "area",
      header: `AREA (${ip ? "FT²" : "M²"})`,
      width: 120,
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
          onCommit={(val) => handleUpdateFloorCell(r.id, "area", parseFloat(val) || 0)}
          className="font-mono tabular text-[13.5px] text-center"
          placeholder="0"
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
          onCommit={(val) => handleUpdateFloorCell(r.id, "height", parseFloat(val) || 0)}
          className="font-mono tabular text-[13.5px] text-center"
          placeholder="0"
        />
      ),
    },
    {
      key: "volume",
      header: `VOLUME (${ip ? "FT³" : "M³"})`,
      width: 130,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono tabular text-[13.5px] text-muted-foreground font-medium text-center w-full block">
          {r.volume.toLocaleString()}
        </span>
      ),
    },
    {
      key: "flow6ach",
      header: `6 ACH (${ip ? "CFM" : "L/S"})`,
      width: 150,
      align: "center",
      mono: true,
      render: (r) => (
        <span className="font-mono tabular text-[13.5px] text-primary font-bold text-center w-full block">
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
            if (isApprovedLocked) return;
            const targetIds = selectedRowIds.has(r.id) ? Array.from(selectedRowIds) : [r.id];
            const nextFlagged = !r.flagged;
            const updated = floors.map(f => targetIds.includes(f.id) ? { ...f, flagged: nextFlagged } : f);
            updateFloorsWithHistory(updated);
          }}
          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto disabled:cursor-default"
          title={
            (() => {
              const isNoLevel = !r.basementLevel || r.basementLevel.trim() === "";
              const isNoZone = !r.zoneName || r.zoneName.trim() === "";
              const isNoArea = !r.area || Number(r.area) <= 0 || isNaN(Number(r.area));
              const isNoHeight = !r.height || Number(r.height) <= 0 || isNaN(Number(r.height));
              if (isNoArea && isNoHeight) return "Missing lobby area and height";
              if (isNoArea) return "Missing lobby area";
              if (isNoHeight) return "Missing floor height";
              if (isNoZone) return "Missing zone name";
              if (isNoLevel) return "Missing level / floor";
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

  const handleAddNewLobbySpace = () => {
    const newId = `lobby-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const defaultLevel = uniqueLevels[0] || "GF";
    const defaultZone = uniqueZones[0] || "Lift Lobby 1";
    const newFloorItem: LobbyFloor = {
      id: newId,
      name: `Lobby Space ${floors.length + 1}`,
      basementLevel: defaultLevel,
      zoneName: defaultZone,
      area: ip ? 215 : 20,
      height: ip ? 9.8 : 3.0,
      flagged: true,
    };
    updateFloorsWithHistory([...floors, newFloorItem]);
    setEditingFloor(newFloorItem);
    setIsNewFloor(true);
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
    
    const newLevelName = isZoneGroup ? (uniqueLevels[0] || "GF") : groupName;
    const newZoneName = isZoneGroup ? groupName : `Lift Lobby ${existing.length + 1}`;
    const newId = `lobby-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newFloorItem: LobbyFloor = {
      id: newId,
      name: `${newLevelName} - ${newZoneName}`,
      basementLevel: newLevelName,
      zoneName: newZoneName,
      area: sample?.area || (ip ? 215 : 20),
      height: sample?.height || (ip ? 9.8 : 3.0),
      flagged: true,
    };
    updateFloorsWithHistory([...floors, newFloorItem]);
    setEditingFloor(newFloorItem);
    setIsNewFloor(true);
  };

  const checkIfLobbyMissingData = (f: LobbyFloor) => {
    const isNoLevel = !f.basementLevel || f.basementLevel.trim() === "";
    const isNoZone = !f.zoneName || f.zoneName.trim() === "";
    const isNoArea = !f.area || Number(f.area) <= 0 || isNaN(Number(f.area));
    const isNoHeight = !f.height || Number(f.height) <= 0 || isNaN(Number(f.height));
    return isNoLevel || isNoZone || isNoArea || isNoHeight;
  };

  const handleUpdateFloorCell = (id: string, field: keyof LobbyFloor, val: any) => {
    const updated = floors.map(f => {
      if (f.id === id) {
        const next = { ...f, [field]: val };
        if (field === "basementLevel" || field === "zoneName") {
          next.name = `${next.basementLevel} - ${next.zoneName}`;
        }
        if (field !== "flagged") {
          const wasMissing = checkIfLobbyMissingData(f);
          const isMissing = checkIfLobbyMissingData(next);
          if (isMissing) {
            next.flagged = true;
          } else if (wasMissing && !isMissing) {
            next.flagged = false;
          }
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
          
          {/* Page Header & Actions matching Pump Sizing */}
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
            </div>
            
            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={executeUnitSystemChange}
                disabled={isEffectiveReadOnly}
                inputDescriptions="Area, Height, Flow Rate"
                conversionExample={unitSystem === "si" ? "Convert 350 m² → 3,767 sq ft, 3m → 9.8 ft, 1,750 L/s → 3,708 CFM" : "Convert 3,767 sq ft → 350 m², 9.8 ft → 3m, 3,708 CFM → 1,750 L/s"}
              />
            </div>
          </div>

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
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap modal-blur-bg">
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
                  <button
                    type="button"
                    onClick={() => setActiveSection("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      activeSection === "report"
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
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Level / Floor</span>
                      <select
                        value={filterLevel}
                        onChange={e => setFilterLevel(e.target.value)}
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
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
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
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
                      className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                        levelSortOrder !== "asc" || zoneSortBy !== "none"
                          ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                          : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      <ArrowUpDown className="size-3.5 shrink-0" />
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                        Sort
                      </span>
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
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
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
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                      >
                        <option value="none">Original Order</option>
                        <option value="name">Name (A-Z)</option>
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
                          localStorage.removeItem("mep_grid_lobby_pressurisation_schedule");
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

                {/* Right Controls: Paste, Import, PDF, Add Level */}
                <div className="ml-auto flex items-center gap-1">
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
                    disabled={isEffectiveReadOnly}
                    onClick={() => setShowImportSourceModal(true)}
                    title="Import lobby floor levels from 3D Studio or Excel schedule"
                  >
                    <Download className="size-3.5" /> Import
                  </TBtn>

                  {/* New Space (EXTREME RIGHT) */}
                  <TBtn
                    primary
                    disabled={isEffectiveReadOnly}
                    onClick={handleAddNewLobbySpace}
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
                      const duplicated: LobbyFloor[] = selectedItems.map((r, idx) => ({
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
                      toast.success(`Updated review flags for ${selectedRowIds.size} space(s)`);
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

            {/* Main Content Area */}
            {activeSection === "schedule" ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
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
                            onClick={handleAddNewLobbySpace}
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
                      onCommentClick={(r) => handleOpenComment(r.id, r.zoneName || (r as any).name || 'Lobby')}
                      renderContextMenu={renderRowContextMenu}
                      groupBy={(r) => (groupByMode === "zone" ? ((r.zoneName || "Lift Lobby 1").trim() || "Lift Lobby 1") : ((r.basementLevel || "Level 1").trim() || "Level 1"))}
                      groupOrder={groupOrder}
                      renderGroupHeader={renderGroupHeader}
                      renderGroupContextMenu={renderGroupContextMenu}
                      onToggleGroup={handleToggleGroup}
                      activeRowId={editingFloor?.id}
                      onRowDoubleClick={(r) => {
                        setEditingFloor(r);
                        setIsNewFloor(false);
                      }}
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
            ) : activeSection === "fan-systems" ? (
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
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenEditFS(fs)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                          >
                            <Edit3 className="size-3.5 text-muted-foreground" />
                            <span>Edit System</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                          </ContextMenuItem>

                          <ContextMenuItem
                            onClick={() => handleDuplicateFanSystem(fs)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                          >
                            <CopyPlus className="size-3.5 text-muted-foreground" />
                            <span>Duplicate System</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
                          </ContextMenuItem>

                          <ContextMenuSeparator className="h-px bg-border my-1" />

                          <ContextMenuItem
                            onClick={() => setFanSystems(fanSystems.filter(x => x.id !== fs.id))}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Delete System</span>
                            <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
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
            ) : (
              /* Printable Report tab view matching exact Preliminary Cooling Load layout */
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                  
                  {/* 1. Title */}
                  <div className="pb-1">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                      Lobby Pressurisation Calculation
                    </h2>
                  </div>

                  {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-b border-border divide-x divide-border">
                          <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                          <td className="p-2.5 font-mono text-foreground font-medium">{project?.calcNo || "TRV-CAL-LP-001"}</td>
                          <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                          <td className="p-2.5 font-mono font-medium">{new Date().toISOString().split("T")[0]}</td>
                        </tr>
                        <tr className="border-b border-border divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                          <td className="p-2.5 font-mono">{project?.code || "MEP-LP-2026"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                          <td className="p-2.5">{project?.client || "Prestige Group developers"}</td>
                        </tr>
                        <tr className="divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                          <td className="p-2.5">{project?.name || "Lobby Pressurisation Study"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                          <td className="p-2.5">{(project as any)?.endUser || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. Space & Airflow Schedule (2-Tier Header Table) */}
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
                          <th colSpan={3} className="p-2 border-r border-border text-center">
                            Volume & Airflow Metrics
                          </th>
                          <th colSpan={3} className="p-2 text-center">
                            System & Compliance
                          </th>
                        </tr>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                          <th className="p-2 border-r border-border w-24 text-center">Floor Level</th>
                          <th className="p-2 border-r border-border text-left min-w-[130px]">Lobby Space</th>
                          <th className="p-2 border-r border-border w-20 text-center">Area ({ip ? "ft²" : "m²"})</th>
                          <th className="p-2 border-r border-border w-20 text-center">Height ({ip ? "ft" : "m"})</th>
                          <th className="p-2 border-r border-border w-24 text-center">Volume ({ip ? "ft³" : "m³"})</th>
                          <th className="p-2 border-r border-border w-24 text-right">6 ACH Flow ({ip ? "CFM" : "L/s"})</th>
                          <th className="p-2 border-r border-border w-24 text-right">Flow (m³/h)</th>
                          <th className="p-2 border-r border-border min-w-[120px] text-left">Fan System</th>
                          <th className="p-2 w-20 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(() => {
                          const rowsByLevel: { [level: string]: CalculatedLobbyFloor[] } = {};
                          const levelOrder: string[] = [];

                          const sorted = [...calculatedRows].sort((a, b) => {
                            const lvlA = (a.basementLevel || "Level 1").toLowerCase();
                            const lvlB = (b.basementLevel || "Level 1").toLowerCase();
                            if (lvlA !== lvlB) return lvlA.localeCompare(lvlB, undefined, { numeric: true });
                            return (a.name || "").localeCompare(b.name || "");
                          });

                          sorted.forEach((r) => {
                            const lvl = r.basementLevel || "Level 1";
                            if (!rowsByLevel[lvl]) {
                              rowsByLevel[lvl] = [];
                              levelOrder.push(lvl);
                            }
                            rowsByLevel[lvl].push(r);
                          });

                          let globalSrNo = 1;
                          let grandArea = 0;
                          let grandVol = 0;
                          let grandFlow = 0;
                          let grandM3h = 0;

                          return (
                            <>
                              {levelOrder.map((levelName) => {
                                const levelRows = rowsByLevel[levelName];
                                let levelArea = 0;
                                let levelVol = 0;
                                let levelFlow = 0;
                                let levelM3h = 0;

                                return (
                                  <React.Fragment key={levelName}>
                                    {levelRows.map((r) => {
                                      const areaVal = r.area || 0;
                                      const volVal = r.volume || 0;
                                      const flowVal = r.flow6ach || 0;
                                      const m3hVal = r.flowM3h || (ip ? flowVal * 1.699 : flowVal * 3.6);
                                      const assignedFs = calculatedFanSystems.find(fs => fs.servedFloors.some(sf => sf.id === r.id));

                                      levelArea += areaVal;
                                      levelVol += volVal;
                                      levelFlow += flowVal;
                                      levelM3h += m3hVal;
                                      grandArea += areaVal;
                                      grandVol += volVal;
                                      grandFlow += flowVal;
                                      grandM3h += m3hVal;

                                      return (
                                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                          <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">
                                            {globalSrNo++}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-medium">
                                            {r.basementLevel || "Level 1"}
                                          </td>
                                          <td className="p-2 border-r border-border font-medium">
                                            {r.zoneName || r.name || "-"}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-mono">
                                            {areaVal.toFixed(1)}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-mono text-muted-foreground">
                                            {r.height !== undefined ? Number(r.height).toFixed(1) : "-"}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-mono">
                                            {Math.round(volVal).toLocaleString()}
                                          </td>
                                          <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">
                                            {Math.round(flowVal).toLocaleString()}
                                          </td>
                                          <td className="p-2 border-r border-border text-right font-mono text-muted-foreground">
                                            {Math.round(m3hVal).toLocaleString()}
                                          </td>
                                          <td className="p-2 border-r border-border font-medium text-foreground">
                                            {assignedFs ? assignedFs.name : "Pressurisation System"}
                                          </td>
                                          <td className="p-2 text-center font-bold">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                              PASS
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* Floor Total Row matching Preliminary format */}
                                    <tr className="bg-slate-50/70 dark:bg-zinc-900/60 font-bold border-t border-b border-border">
                                      <td className="p-2 border-r border-border text-center"></td>
                                      <td className="p-2 border-r border-border text-center font-bold">
                                        {levelName}
                                      </td>
                                      <td className="p-2 border-r border-border font-bold">
                                        TOTAL ({levelName})
                                      </td>
                                      <td className="p-2 border-r border-border text-center font-mono font-bold">
                                        {levelArea.toFixed(1)}
                                      </td>
                                      <td className="p-2 border-r border-border"></td>
                                      <td className="p-2 border-r border-border text-center font-mono font-bold">
                                        {Math.round(levelVol).toLocaleString()}
                                      </td>
                                      <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">
                                        {Math.round(levelFlow).toLocaleString()}
                                      </td>
                                      <td className="p-2 border-r border-border text-right font-mono font-bold text-muted-foreground">
                                        {Math.round(levelM3h).toLocaleString()}
                                      </td>
                                      <td className="p-2 border-r border-border font-medium text-muted-foreground">
                                        All Compliant
                                      </td>
                                      <td className="p-2 text-center font-bold text-emerald-600">
                                        PASS
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              })}

                              {/* Grand Total Row if multiple levels */}
                              {levelOrder.length > 1 && (
                                <tr className="bg-slate-100 dark:bg-zinc-800 font-black border-t-2 border-border">
                                  <td className="p-2 border-r border-border text-center"></td>
                                  <td className="p-2 border-r border-border text-center font-bold">ALL</td>
                                  <td className="p-2 border-r border-border font-bold">OVERALL TOTAL</td>
                                  <td className="p-2 border-r border-border text-center font-mono">
                                    {grandArea.toFixed(1)}
                                  </td>
                                  <td className="p-2 border-r border-border"></td>
                                  <td className="p-2 border-r border-border text-center font-mono">
                                    {Math.round(grandVol).toLocaleString()}
                                  </td>
                                  <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">
                                    {Math.round(grandFlow).toLocaleString()}
                                  </td>
                                  <td className="p-2 border-r border-border text-right font-mono font-bold text-muted-foreground">
                                    {Math.round(grandM3h).toLocaleString()}
                                  </td>
                                  <td className="p-2 border-r border-border font-bold text-muted-foreground">
                                    All Systems Sized
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

                  {/* 4. Fan Systems Sizing Summary Table */}
                  {calculatedFanSystems.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Pressurisation Fan System Sizing Summary
                      </h4>
                      <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                            <tr>
                              <th className="p-2 border-r border-border">Fan Tag</th>
                              <th className="p-2 border-r border-border">Type</th>
                              <th className="p-2 border-r border-border text-center">Qty</th>
                              <th className="p-2 border-r border-border text-right">Duty Airflow ({ip ? "CFM" : "L/s"})</th>
                              <th className="p-2 border-r border-border text-right">Per Fan ({ip ? "CFM" : "L/s"})</th>
                              <th className="p-2 border-r border-border text-right">Static Pressure ({ip ? "in.wg" : "Pa"})</th>
                              <th className="p-2 border-r border-border text-center">Spaces</th>
                              <th className="p-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {calculatedFanSystems.map((fs) => (
                              <tr key={fs.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                <td className="p-2 border-r border-border font-bold text-foreground">{fs.name}</td>
                                <td className="p-2 border-r border-border text-muted-foreground">{fs.fanType}</td>
                                <td className="p-2 border-r border-border text-center font-mono">{fs.fanQty || 2}</td>
                                <td className="p-2 border-r border-border text-right font-mono font-bold text-primary">{Math.round(fs.totalFlow6).toLocaleString()}</td>
                                <td className="p-2 border-r border-border text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{Math.round(fs.perFanCap).toLocaleString()}</td>
                                <td className="p-2 border-r border-border text-right font-mono">{fs.totalStatic}</td>
                                <td className="p-2 border-r border-border text-center font-mono">{fs.servedFloors.length}</td>
                                <td className="p-2 text-center font-bold text-emerald-600">PASS</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 5. 3-Tier Signature Sign-Off Block (Exact #FFE6CC Header) */}
                  {(() => {
                    const sig = getSignatureBlockDetails(
                      project?.id || activeProjectId || "default",
                      "/lobby-pressurisation",
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
                <div className="flex-1">
                  <FloorSelect
                    value={bulkEditValues.basementLevel}
                    onChange={(fl) => setBulkEditValues({ ...bulkEditValues, basementLevel: fl })}
                    availableFloors={uniqueLevels}
                    disabled={!bulkEditFields.basementLevel}
                    triggerClassName="h-8 rounded-lg text-xs"
                    placeholder="Select or enter floor..."
                  />
                </div>
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
        <LobbyFormulaModal
          onClose={() => setShowFormulaModal(false)}
          unitSystem={unitSystem}
          activeFloor={(selectedRowIds.size > 0 ? calculatedRows.find(f => selectedRowIds.has(f.id)) : null) || calculatedRows[0]}
          totals={totals}
        />
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

      {/* Edit Lobby Space Modal (Ventilation EditSpaceModal layout & calculations preview) */}
      {editingFloor && (
        <EditLobbySpaceModal
          floor={editingFloor}
          isNew={isNewFloor}
          unitSystem={unitSystem}
          availableLevels={uniqueLevels}
          availableZones={uniqueZones}
          onClose={() => {
            if (isNewFloor) {
              updateFloorsWithHistory(floors.filter((f) => f.id !== editingFloor.id));
            }
            setEditingFloor(null);
            setIsNewFloor(false);
          }}
          onSave={(updated) => {
            updateFloorsWithHistory(floors.map((f) => (f.id === updated.id ? updated : f)));
            setEditingFloor(null);
            setIsNewFloor(false);
            if (!isApprovedLocked) dirtyStore.getState().markDirty();
          }}
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
              onHighlightFloor={(id) => {
                setSelectedRowIds(new Set([id]));
                setTimeout(() => {
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
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
  onHighlightFloor?: (id: string) => void;
}

function LobbyPressurisationIntelligenceDrawer({
  onClose,
  floors,
  calculatedFanSystems,
  calculatedRows,
  totals,
  unitSystem,
  onHighlightFloor,
}: LobbyPressurisationIntelligenceDrawerProps) {
  const ip = unitSystem === "ip";
  const flowUnit = ip ? "CFM" : "L/s";
  const volUnit = ip ? "ft³" : "m³";
  const pressUnit = ip ? "in.wg" : "Pa";
  const areaUnit = ip ? "ft²" : "m²";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    unassigned: false,
    missingArea: false,
    missingHeight: false,
  });

  // Check unassigned spaces
  const assignedIds = new Set<string>();
  calculatedFanSystems.forEach(fs => {
    (fs.floorIds || []).forEach((id: string) => assignedIds.add(id));
  });

  const unassignedLobbies = useMemo(() => {
    return calculatedRows
      .filter(r => !assignedIds.has(r.id))
      .map(r => ({
        id: r.id,
        name: r.name,
        detail: r.zoneName ? `${r.zoneName} (${r.basementLevel || "L01"})` : r.basementLevel || "L01",
      }));
  }, [calculatedRows, assignedIds]);

  const missingAreaLobbies = useMemo(() => {
    return calculatedRows
      .filter(r => !r.area || Number(r.area) <= 0)
      .map(r => ({
        id: r.id,
        name: r.name,
        detail: `0 ${areaUnit}`,
      }));
  }, [calculatedRows, areaUnit]);

  const missingHeightLobbies = useMemo(() => {
    return calculatedRows
      .filter(r => !r.height || Number(r.height) <= 0)
      .map(r => ({
        id: r.id,
        name: r.name,
        detail: `0 ${ip ? "ft" : "m"}`,
      }));
  }, [calculatedRows, ip]);

  const totalSpaces = floors.length;
  const compliantSpaces = calculatedRows.filter(r => assignedIds.has(r.id) && (Number(r.area) || 0) > 0 && (Number(r.height) || 0) > 0);
  const compliancePct = totalSpaces > 0 ? Math.round((compliantSpaces.length / totalSpaces) * 100) : 100;

  // Max fan static
  const maxStaticSys = [...calculatedFanSystems].sort((a, b) => (b.totalStatic || 0) - (a.totalStatic || 0))[0];

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in font-sans">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button onClick={onClose} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {/* Compliance Status */}
        <IntelSection icon={CheckCircle2} tone="success" title="Compliance Status">
          <div className="text-[12px] text-muted-foreground">
            NFPA 92 &amp; BS EN 12101 6.0 ACH pressurisation across {totalSpaces} scheduled space{totalSpaces === 1 ? "" : "s"}.
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
            {compliantSpaces.length} of {totalSpaces} spaces assigned &amp; fully dimensioned
          </div>
        </IntelSection>

        {/* Pressurisation Airflow & Volume */}
        <IntelSection icon={Gauge} tone="primary" title="Pressurisation Airflow & Volume">
          <KV k="Required Supply (6 ACH)" v={`${totals.total6.toLocaleString()} ${flowUnit}`} />
          <KV k="Airflow Volume Rate" v={`${totals.totalM3h.toLocaleString()} m³/h`} />
          <KV k="Total Containment Volume" v={`${totals.totalVolume.toLocaleString()} ${volUnit}`} />
          <KV k="Total Gross Area" v={`${totals.totalArea.toLocaleString()} ${areaUnit}`} />
          <KV k="Configured Fan Systems" v={`${calculatedFanSystems.length} systems`} />
          <KV k="Avg Duty Fan Capacity" v={`${totals.perFanCapacity.toLocaleString()} ${flowUnit}`} />
        </IntelSection>

        {/* System & Static Checks */}
        <IntelSection icon={AlertTriangle} tone={unassignedLobbies.length > 0 ? "warning" : "muted"} title="System & Static Checks">
          <KV k="Unassigned Lobbies" v={unassignedLobbies.length} />
          {maxStaticSys ? (
            <>
              <KV k={`Max Static (${maxStaticSys.name})`} v={`${maxStaticSys.totalStatic} ${pressUnit}`} />
              <KV k="Critical Friction Loss" v={`${maxStaticSys.frictionLoss.toFixed(1)} ${pressUnit}`} />
            </>
          ) : (
            <KV k="Critical Path Static" v="No fans" />
          )}
        </IntelSection>

        {/* Missing Data Section */}
        <IntelSection icon={Info} tone="muted" title="Missing Data & Coverage">
          <CollapsibleMissingSection
            label="Unassigned Lobbies"
            count={unassignedLobbies.length}
            itemsList={unassignedLobbies}
            isOpen={openSections.unassigned}
            onToggle={() => setOpenSections(prev => ({ ...prev, unassigned: !prev.unassigned }))}
            onItemClick={(id) => onHighlightFloor?.(id)}
          />
          <CollapsibleMissingSection
            label="Spaces with 0 / Missing Area"
            count={missingAreaLobbies.length}
            itemsList={missingAreaLobbies}
            isOpen={openSections.missingArea}
            onToggle={() => setOpenSections(prev => ({ ...prev, missingArea: !prev.missingArea }))}
            onItemClick={(id) => onHighlightFloor?.(id)}
          />
          <CollapsibleMissingSection
            label="Spaces with 0 / Missing Height"
            count={missingHeightLobbies.length}
            itemsList={missingHeightLobbies}
            isOpen={openSections.missingHeight}
            onToggle={() => setOpenSections(prev => ({ ...prev, missingHeight: !prev.missingHeight }))}
            onItemClick={(id) => onHighlightFloor?.(id)}
          />
        </IntelSection>

        {/* Optimization Suggestions */}
        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Calibrate lobby relief dampers to limit differential pressure to 50 Pa against escape stair doors.</li>
            <li>For fire-fighting lobbies, specify 100% standby fan capacity (duty + standby) with auto changeover per BS 9999.</li>
            <li>Coordinate air supply duct insulation where routes pass through high-temperature or unconditioned shafts.</li>
          </ul>
        </IntelSection>

        {/* Engineering Notes */}
        <IntelSection icon={Info} tone="muted" title="Engineering Notes">
          <div className="text-[12px] text-muted-foreground leading-relaxed">
            NFPA 92 &amp; BS EN 12101-6 Class A/B criteria: Minimum 6.0 air changes per hour (ACH) or 45-50 Pa pressurisation differential maintained against fire floor to ensure tenant escape route integrity.
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

// SUB-COMPONENT: LOBBY PRESSURISATION FORMULA BREAKDOWN MODAL (MATCHING FRESH AIR COOLING LOAD STANDARD)
function LobbyFormulaModal({
  onClose,
  unitSystem,
  activeFloor,
  totals,
}: {
  onClose: () => void;
  unitSystem: "si" | "ip";
  activeFloor?: any;
  totals?: any;
}) {
  const [activeTab, setActiveTab] = React.useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isSI = unitSystem === "si";
  const ip = !isSI;

  const floor = activeFloor || {
    name: "Sample Lobby Level",
    area: 45,
    height: 3.2,
    flow6: 240,
    volume: 144,
  };

  const area = Number(floor.area) || (isSI ? 45 : 485);
  const height = Number(floor.height) || (isSI ? 3.2 : 10.5);
  const volume = Number(floor.volume) || Math.round(area * height);

  // 6 ACH calculation: SI: Vol * 6 / 3.6 = L/s; IP: Vol * 6 / 60 = CFM
  const flow6 = isSI ? Math.round((volume * 6) / 3.6) : Math.round((volume * 6) / 60);
  const flow6M3s = isSI ? flow6 / 1000 : flow6 * 0.000471947;
  const qPerFan = Math.round(flow6 / 2);

  // Duct sizing trace
  const eqLengthM = isSI ? 25 : 82;
  const ductFrictionPaM = isSI ? 1.2 : 0.15;
  const ductLossPa = isSI ? Math.round(eqLengthM * 1.6 * ductFrictionPaM) : Math.round(eqLengthM * 1.6 * 0.15 * 2.49);
  const componentLossPa = 65; // Louvers, grilles, dampers
  const safetyLossPa = Math.round((ductLossPa + componentLossPa) * 0.10);
  const totalStaticPa = ductLossPa + componentLossPa + safetyLossPa;
  const totalStaticInWg = (totalStaticPa / 249.0889).toFixed(3);

  const handleCopySummary = () => {
    const text = `=== LOBBY PRESSURISATION & 6 ACH FORMULA BREAKDOWN ===
Governing Design Standards: BS EN 12101-6, NFPA 92 & ASHRAE Handbook
Unit System: ${isSI ? "SI Metric (m, m², m³, L/s, Pa)" : "IP Imperial (ft, ft², ft³, CFM, in.wg)"}
Lobby Space: ${floor.name || "Active Lobby"}

--- 1. ACTIVE SIZING PARAMETERS ---
• Lobby Floor Area (A): ${area.toLocaleString()} ${isSI ? "m²" : "sq ft"}
• Clear Ceiling Height (H): ${height.toFixed(2)} ${isSI ? "m" : "ft"}
• Net Lobby Space Volume (V): ${Math.round(volume).toLocaleString()} ${isSI ? "m³" : "cu ft"}
• Mandated Smoke Containment Rate: 6.0 Air Changes per Hour (ACH)
• Fan Configuration: 2 × 50% Duty Fans

--- 2. STEP-BY-STEP CALCULATION TRACE ---
[1] Lobby Space Volume:
    V = Area × Height = ${area} × ${height} = ${Math.round(volume).toLocaleString()} ${isSI ? "m³" : "cu ft"}

[2] Required 6 ACH Airflow Rate:
    ${isSI ? `Q_6ACH = (V × 6 ACH) / 3.6 = (${Math.round(volume)} × 6) / 3.6 = ${flow6.toLocaleString()} L/s (${flow6M3s.toFixed(3)} m³/s)` : `Q_6ACH = (V × 6 ACH) / 60 = (${Math.round(volume)} × 6) / 60 = ${flow6.toLocaleString()} CFM`}

[3] Multi-Fan Duty Distribution (2 × 50%):
    Q_fan = Q_6ACH / 2 = ${qPerFan.toLocaleString()} ${isSI ? "L/s" : "CFM"} per duty fan

[4] Duct Equivalent Length (60% Fittings Allowance):
    L_eq = Length × 1.60 = ${eqLengthM} m × 1.60 = ${(eqLengthM * 1.6).toFixed(1)} m

[5] Aerodynamic Duct Friction Loss:
    ΔP_duct = L_eq × f_rate = ${(eqLengthM * 1.6).toFixed(1)} m × ${ductFrictionPaM} Pa/m = ${ductLossPa} Pa

[6] Terminal & In-Line Component Losses:
    ΔP_components = Louvers (25 Pa) + Grilles (20 Pa) + Fire Dampers (20 Pa) = ${componentLossPa} Pa

[7] 10% Engineering Safety Margin & Total Fan Static:
    ΔP_safety = 10% × (${ductLossPa} + ${componentLossPa}) = ${safetyLossPa} Pa
    ΔP_total = ${ductLossPa} + ${componentLossPa} + ${safetyLossPa} = ${totalStaticPa} Pa (${totalStaticInWg} in.wg)
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Lobby calculation breakdown copied to clipboard!");
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
                Lobby Pressurisation Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              EN 12101-6 / NFPA 92
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
                    <SlidersHorizontal className="size-3 text-primary" /> Active Lobby Parameters
                  </span>
                  <span className="font-mono text-primary normal-case font-bold">
                    {floor.name || "Active Floor"} | {isSI ? `${flow6} L/s` : `${flow6} CFM`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Dimensions &amp; Volume</span>
                    <span className="font-mono font-bold text-foreground">{area} {isSI ? "m²" : "sq.ft"} × {height} {isSI ? "m" : "ft"}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">({volume} {isSI ? "m³" : "ft³"})</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Code Mandate &amp; Split</span>
                    <span className="font-mono font-bold text-foreground">6 ACH Containment</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">(2 × 50% Fans)</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: SPACE GEOMETRIC VOLUME */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Lobby Space Net Volume (V)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {Math.round(volume).toLocaleString()} {isSI ? "m³" : "cu ft"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Volume = Gross Floor Area × Clear Ceiling Height</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{area} {isSI ? "m²" : "sq.ft"} × {height} {isSI ? "m" : "ft"}</span>
                    <span className="text-primary font-bold">= {Math.round(volume).toLocaleString()} {isSI ? "m³" : "cu ft"}</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: 6 ACH AIRFLOW */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Smoke Containment Flow Rate (6 ACH)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {flow6.toLocaleString()} {isSI ? "L/s" : "CFM"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: {isSI ? "Q_6ACH = (Volume × 6 ACH) / 3.6 (L/s)" : "Q_6ACH = (Volume × 6 ACH) / 60 (CFM)"}</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">({Math.round(volume)} × 6) / {isSI ? "3.6" : "60"}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {flow6.toLocaleString()} {isSI ? "L/s" : "CFM"} ({flow6M3s.toFixed(3)} m³/s)</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: MULTI-FAN SPLIT */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Multi-Fan Capacity Division (2 × 50%)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {qPerFan.toLocaleString()} {isSI ? "L/s" : "CFM"} / fan
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_fan = Total Airflow / N_fans (Redundant Duty Config)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{flow6.toLocaleString()} / 2 duty fans</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">= {qPerFan.toLocaleString()} {isSI ? "L/s" : "CFM"} per fan</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: DUCT EQUIVALENT LENGTH */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Duct Equivalent Length (L_eq)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {(eqLengthM * 1.6).toFixed(1)} {isSI ? "m" : "ft"}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: L_eq = Straight Run + 60% allowance for elbows &amp; transitions</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{eqLengthM} m × 1.60</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">= {(eqLengthM * 1.6).toFixed(1)} {isSI ? "m" : "ft"}</span>
                  </div>
                </div>
              </div>

              {/* STEP 5: AERODYNAMIC HEAD LOSS & TOTAL STATIC */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      5
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Total System Fan Static Pressure (ΔP_total)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                    {totalStaticPa} Pa ({totalStaticInWg} in.wg)
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">Duct Friction Loss ({(eqLengthM * 1.6).toFixed(0)}m @ {ductFrictionPaM} Pa/m):</span>
                    <span className="font-bold text-foreground">{ductLossPa} Pa</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">Louvers (25 Pa) + Grilles (20 Pa) + Dampers (20 Pa):</span>
                    <span className="font-bold text-foreground">{componentLossPa} Pa</span>
                  </div>
                  <div className="flex justify-between text-foreground pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">+10% Safety Allowance:</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">+{safetyLossPa} Pa → Total: {totalStaticPa} Pa</span>
                  </div>
                </div>
              </div>

              {/* Sizing Outcome Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">Recommended Fan Duty</div>
                  <div className="text-[11.5px] font-bold text-foreground mt-0.5">2 × {qPerFan.toLocaleString()} {isSI ? "L/s" : "CFM"} @ {totalStaticPa} Pa</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-primary leading-tight">{flow6.toLocaleString()} <span className="text-xs font-normal">{isSI ? "L/s" : "CFM"}</span></div>
                  <div className="text-[9.5px] text-muted-foreground font-mono">6 ACH Total Flow</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" /> Mandated 6 ACH Smoke Containment Flow
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>SI: Q (L/s) = [ Volume (m³) × 6 ACH ] / 3.6</div>
                  <div>IP: Q (CFM) = [ Volume (ft³) × 6 ACH ] / 60</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Pursuant to BS EN 12101-6, NFPA 92 and local fire safety codes, lift lobbies and fire-fighting access lobbies require a minimum ventilation rate of 6 air changes per hour for smoke dilution and escape path protection.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-blue-500" /> Duct Equivalent Length &amp; Fittings Loss
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>L_eq = L_straight + (L_straight × 0.60) = 1.60 · L_straight</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Standard ASHRAE design practice incorporates an additional 60% linear equivalent length to account for standard 90° bends, branch take-offs, and transitions in vertical riser shafts.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Total Fan Static Pressure Formula
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>ΔP_total = ( ΔP_duct + ΔP_louver + ΔP_grille + ΔP_damper ) × 1.10</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Includes duct friction loss, rain/sand louvers (25 Pa), supply grilles (20 Pa), motorised fire smoke dampers (20 Pa), and sound attenuators with a standard 10% design safety factor.
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
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">A</td>
                      <td className="py-1.5 px-2 text-foreground">Lobby Floor Area</td>
                      <td className="py-1.5 px-2 font-mono">m²</td>
                      <td className="py-1.5 px-2 font-mono">sq ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">H</td>
                      <td className="py-1.5 px-2 text-foreground">Clear Ceiling Height</td>
                      <td className="py-1.5 px-2 font-mono">m</td>
                      <td className="py-1.5 px-2 font-mono">ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">V</td>
                      <td className="py-1.5 px-2 text-foreground">Lobby Space Net Volume</td>
                      <td className="py-1.5 px-2 font-mono">m³</td>
                      <td className="py-1.5 px-2 font-mono">cu ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_6ACH</td>
                      <td className="py-1.5 px-2 text-foreground">Mandated 6 ACH Smoke Airflow</td>
                      <td className="py-1.5 px-2 font-mono">L/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">L_eq</td>
                      <td className="py-1.5 px-2 text-foreground">Duct Equivalent Length (+60%)</td>
                      <td className="py-1.5 px-2 font-mono">m</td>
                      <td className="py-1.5 px-2 font-mono">ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ΔP_total</td>
                      <td className="py-1.5 px-2 text-foreground">Total Fan Static Head Loss</td>
                      <td className="py-1.5 px-2 font-mono">Pa</td>
                      <td className="py-1.5 px-2 font-mono">in.wg</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">N_fans</td>
                      <td className="py-1.5 px-2 text-foreground">Duty Fans in Parallel (2 × 50%)</td>
                      <td className="py-1.5 px-2 font-mono">qty</td>
                      <td className="py-1.5 px-2 font-mono">qty</td>
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
