import { CalculationReviewBar, CalculationStatusBanner, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useConfirm } from "@/hooks/use-confirm";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, CheckCircle2, Flag, FileText, X, HelpCircle,
  MessageSquare, Check, Activity, Copy, RotateCcw,
  Trash2, Edit3, Droplets, Waves, Gauge, ShieldCheck, ShieldAlert, Layers,
  Download, Cylinder, ChevronDown, ChevronUp, ChevronRight, Search,
  Plus, Minus, SlidersHorizontal, Maximize2, Sparkles, AlertTriangle,
  Zap, ArrowRight, BookOpen, Scissors, ClipboardPaste
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { TBtn } from "@/components/workspace/Button";
import { DrainagePresetSelect } from "@/components/workspace/DrainagePresetSelect";
import { CustomDrainageConfigModal } from "@/components/workspace/CustomDrainageConfigModal";
import {
  type DrainagePresetKey,
  type FixtureRowItem,
  type DrainageFixtureMeta,
  DRAINAGE_FIXTURES_META,
  type DrainageSpaceItem,
  type DrainagePresetConfig,
  DEFAULT_FIXTURES,
  DRAINAGE_PRESET_SPACES,
  DRAINAGE_PRESETS,
  MATERIAL_ROUGHNESS,
  BRANCH_CAPACITY,
  STACK_CAPACITY,
  BUILDING_DRAIN_CAPACITY,
  computeVentSize,
  computeDrainageCalculations,
  computeDrainageFloorSizing,
  getDrainageSpaceValidation
} from "@/lib/calc-plumbing-drainage";


export const Route = createFileRoute("/plumbing-drainage")({
  head: () => ({
    meta: [
      { title: "Drainage Pipe Sizing Calculator — MEP Calc" },
      { name: "description", content: "Determine sanitary drainage branch, stack, and building drain/sewer sizes based on Fixture Units (DFU), slope, and Manning hydraulics per IPC & UPC." },
    ],
  }),
  component: DrainagePage,
});

function FloorNameInput({
  floor,
  disabled,
  onRename,
}: {
  floor: string;
  disabled: boolean;
  onRename: (oldName: string, newName: string) => void;
}) {
  const getCleanFloor = (f: string) => {
    if (!f || f.toLowerCase() === "undefined" || f.toLowerCase() === "null") return "TYPICAL FLOOR";
    return f;
  };

  const [val, setVal] = useState(getCleanFloor(floor));

  useEffect(() => {
    setVal(getCleanFloor(floor));
  }, [floor]);

  const commitRename = () => {
    const trimmed = val.trim();
    if (trimmed && trimmed !== floor) {
      onRename(floor, trimmed);
    } else {
      setVal(getCleanFloor(floor));
    }
  };

  return (
    <input
      type="text"
      value={val}
      disabled={disabled}
      onChange={e => setVal(e.target.value)}
      onBlur={commitRename}
      onFocus={e => e.target.select()}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setVal(getCleanFloor(floor));
          e.currentTarget.blur();
        }
      }}
      className="bg-transparent border border-transparent hover:border-border/80 focus:border-primary focus:bg-background px-2 py-0.5 rounded-md font-bold text-primary text-xs uppercase outline-none transition-all cursor-text min-w-[100px] max-w-[260px]"
      title="Click to edit floor name (Press Enter or click outside to save)"
    />
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
  onDoubleClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder, disabled, onDoubleClick }: InlineInputProps) {
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
      if (!disabled && localVal !== getCleanVal(value)) {
        onCommit(localVal);
      }
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
      disabled={disabled}
      placeholder={placeholder}
      value={localVal}
      onChange={(e) => {
        if (disabled) return;
        setLocalVal(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (disabled) {
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
        if (onDoubleClick) {
          onDoubleClick(e);
        }
      }}
      className={`bg-transparent border border-transparent rounded transition-colors ${disabled
        ? "cursor-not-allowed opacity-75 select-none"
        : "hover:border-border/60 focus:border-primary focus:bg-background focus:outline-none cursor-text"
        } ${className}`}
    />
  );
}

function DrainagePage() {
  const { project, activeProjectId, isReadOnly, forceSaveToCloud, updateProject } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-drainage", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-drainage", activeProjectId || project?.id);
  const confirm = useConfirm();
  const { userData, profile, user } = useAuth();
  const currentUserName = userData?.name || profile?.name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";
  const isApprovedLocked = useCalculationLock("/plumbing-drainage", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const isLocked = isEffectiveReadOnly;

  // Mode: "calculator" vs "report"
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [intelOpen, setIntelOpen] = useState(false);

  // Unit System
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
  const isSI = unitSystem === "si";

  // Selected preset & custom profile state
  const [selectedPreset, setSelectedPreset] = useState<DrainagePresetKey>("commercial_office");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customProfileName, setCustomProfileName] = useState("Commercial Office Floor (Custom)");
  const [customWorkflow, setCustomWorkflow] = useState<"matrix" | "direct">("matrix");

  // Drainage parameters
  const [systemType, setSystemType] = useState<"branch" | "stack_short" | "stack_tall" | "building_drain">("branch");
  const [floorSystemTypes, setFloorSystemTypes] = useState<Record<string, "branch" | "stack_short" | "stack_tall" | "building_drain">>({});
  const [slope, setSlope] = useState<number>(0.25); // in/ft
  const [material, setMaterial] = useState<"pvc" | "cast_iron" | "hdpe" | "copper">("pvc");
  const [safetyFactor, setSafetyFactor] = useState<number>(15); // %
  const [ventLength, setVentLength] = useState<number>(45); // ft

  // Matrix Spaces State (Matrix / Table Grid like Loading Unit Calculator)
  const [floorSections, setFloorSections] = useState<string[]>(DRAINAGE_PRESET_SPACES.commercial_office.floorSections);
  const [drainageSpaces, setDrainageSpaces] = useState<DrainageSpaceItem[]>(DRAINAGE_PRESET_SPACES.commercial_office.spaces);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFloor, setFilterFloor] = useState("all");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const flaggedCount = useMemo(() => {
    return drainageSpaces.filter(s => getDrainageSpaceValidation(s).isFlagged).length;
  }, [drainageSpaces]);

  // Interactive Modals & Comments
  const [editingSpace, setEditingSpace] = useState<{ space: DrainageSpaceItem; floor: string } | null>(null);
  const [showInspectorModal, setShowInspectorModal] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [highlightedSpaceId, setHighlightedSpaceId] = useState<string | null>(null);
  const highlightTimerRef = useRef<any>(null);

  // Auto-clear selection when calculation is locked/approved
  useEffect(() => {
    if (isLocked) {
      setSelectedSpaceIds([]);
    }
  }, [isLocked]);

  // Load calculation state & spaces from localStorage and (project as any)?.workspace_data on project mount/change
  useEffect(() => {
    if (!project?.id) return;
    const pId = project.id;
    const key1 = `mep_plumbing_drainage_${pId}`;
    const key2 = `mep_drainage_pipe_calc_${pId}`;

    try {
      let savedData: any = null;
      const stored1 = localStorage.getItem(key1);
      const stored2 = localStorage.getItem(key2);
      if (stored1) {
        try { savedData = JSON.parse(stored1); } catch (e) { }
      } else if (stored2) {
        try { savedData = JSON.parse(stored2); } catch (e) { }
      }

      if (!savedData && (project as any)?.workspace_data) {
        const wdata = typeof (project as any)?.workspace_data === "string"
          ? JSON.parse((project as any)?.workspace_data)
          : (project as any)?.workspace_data;
        savedData = wdata?.drainage_calc || wdata?.drainage_pipe_calc;
      }

      if (savedData && typeof savedData === "object") {
        if (savedData.unitSystem === "ip" || savedData.unitSystem === "si") setUnitSystem(savedData.unitSystem);
        if (savedData.selectedPreset) setSelectedPreset(savedData.selectedPreset);
        if (savedData.customProfileName) setCustomProfileName(savedData.customProfileName);
        if (savedData.customWorkflow) setCustomWorkflow(savedData.customWorkflow);
        if (savedData.systemType) setSystemType(savedData.systemType);
        if (savedData.floorSystemTypes && typeof savedData.floorSystemTypes === "object") setFloorSystemTypes(savedData.floorSystemTypes);
        if (typeof savedData.slope === "number" && !isNaN(savedData.slope)) setSlope(savedData.slope);
        if (savedData.material) setMaterial(savedData.material);
        if (typeof savedData.safetyFactor === "number" && !isNaN(savedData.safetyFactor)) setSafetyFactor(savedData.safetyFactor);
        if (typeof savedData.ventLength === "number" && !isNaN(savedData.ventLength)) setVentLength(savedData.ventLength);

        let cleanFloors: string[] = [];
        if (Array.isArray(savedData.floorSections) && savedData.floorSections.length > 0) {
          cleanFloors = Array.from(new Set(
            savedData.floorSections
              .map((f: any) => String(f || "").trim())
              .filter((f: string) => f && f !== "undefined" && f !== "null")
          ));
        }

        if (Array.isArray(savedData.drainageSpaces) && savedData.drainageSpaces.length > 0) {
          const cleanSpaces = savedData.drainageSpaces
            .filter((s: any) => s && typeof s === "object")
            .map((s: any, idx: number) => ({
              id: s.id || `space-${Date.now()}-${idx}`,
              floor: String(s.floor || "").trim() && String(s.floor) !== "undefined" && String(s.floor) !== "null"
                ? String(s.floor).trim()
                : (cleanFloors[0] || "6th FLOOR (CORE)"),
              desc: s.desc || `Restroom Space (${idx + 1})`,
              fixtures: s.fixtures && typeof s.fixtures === "object" ? s.fixtures : {},
              spaceQty: Number(s.spaceQty) || 1,
              floorsQty: Number(s.floorsQty) || 1,
              comments: Array.isArray(s.comments) ? s.comments : []
            }));
          if (cleanSpaces.length > 0) {
            setDrainageSpaces(cleanSpaces);
            if (cleanFloors.length === 0) {
              cleanFloors = Array.from(new Set(cleanSpaces.map((s: any) => s.floor)));
            }
          }
        }
        if (cleanFloors.length > 0) {
          setFloorSections(cleanFloors);
        }
      } else {
        // Fresh project default
        setUnitSystem("si");
        setSelectedPreset("commercial_office");
        setFloorSections(DRAINAGE_PRESET_SPACES.commercial_office.floorSections);
        setDrainageSpaces(DRAINAGE_PRESET_SPACES.commercial_office.spaces);
        setSlope(0.25);
        setMaterial("pvc");
        setSafetyFactor(15);
        setVentLength(45);
        setSystemType("branch");
        setFloorSystemTypes({});
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load drainage calculation data:", e);
    }
    setLoadedProjectId(pId);
  }, [project?.id]);

  // Auto-save calculation state to localStorage & (project as any)?.workspace_data whenever values change
  useEffect(() => {
    if (!project?.id || loadedProjectId !== project.id) return;
    const pId = project.id;
    const key = `mep_plumbing_drainage_${pId}`;

    const cleanFloors = Array.from(new Set(
      floorSections
        .map(f => String(f || "").trim())
        .filter(f => f && f !== "undefined" && f !== "null")
    ));

    const cleanSpaces = drainageSpaces
      .filter(s => s && typeof s === "object")
      .map(s => ({
        ...s,
        floor: String(s.floor || "").trim() && String(s.floor) !== "undefined" && String(s.floor) !== "null"
          ? String(s.floor).trim()
          : (cleanFloors[0] || "TYPICAL FLOOR"),
        spaceQty: Number(s.spaceQty) || 1,
        floorsQty: Number(s.floorsQty) || 1
      }));

    const dataToSave = {
      unitSystem,
      selectedPreset,
      customProfileName,
      customWorkflow,
      systemType,
      floorSystemTypes,
      slope,
      material,
      safetyFactor,
      ventLength,
      floorSections: cleanFloors.length > 0 ? cleanFloors : ["TYPICAL FLOOR"],
      drainageSpaces: cleanSpaces,
      lastUpdated: new Date().toISOString()
    };

    try {
      localStorage.setItem(key, JSON.stringify(dataToSave));
      localStorage.setItem(`mep_drainage_pipe_calc_${pId}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);

      if (forceSaveToCloud) forceSaveToCloud();
    } catch (e) {
      console.error("Failed to auto-save drainage calculation", e);
    }
  }, [
    project?.id,
    loadedProjectId,
    unitSystem,
    selectedPreset,
    customProfileName,
    customWorkflow,
    systemType,
    floorSystemTypes,
    slope,
    material,
    safetyFactor,
    ventLength,
    floorSections,
    drainageSpaces
  ]);

  // Global manual save (Ctrl+S) and Version History snapshot restore listener
  useEffect(() => {
    const handleSaveEvent = () => {
      if (!project?.id) return;
      const pId = project.id;
      const key = `mep_plumbing_drainage_${pId}`;
      const dataToSave = {
        unitSystem,
        selectedPreset,
        customProfileName,
        customWorkflow,
        systemType,
        floorSystemTypes,
        slope,
        material,
        safetyFactor,
        ventLength,
        floorSections: floorSections.filter(f => f && f !== "undefined" && f !== "null"),
        drainageSpaces,
        lastUpdated: new Date().toISOString()
      };
      try {
        localStorage.setItem(key, JSON.stringify(dataToSave));
        localStorage.setItem(`mep_drainage_pipe_calc_${pId}`, JSON.stringify(dataToSave));
        const wdata = (project as any)?.workspace_data || {};
        if (updateProject && project) updateProject({ ...project, workspace_data: { ...wdata, drainage_calc: dataToSave, drainage_pipe_calc: dataToSave } } as any);
        if (forceSaveToCloud) forceSaveToCloud();
      } catch (e) { }
    };

    const handleVersionRestored = (e: any) => {
      const pId = project?.id || "default";
      const pKey = `mep_plumbing_drainage_${pId}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache && (lsCache[pKey] || lsCache[`mep_drainage_pipe_calc_${pId}`])) {
        try {
          const raw = lsCache[pKey] || lsCache[`mep_drainage_pipe_calc_${pId}`];
          restoredData = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch (err) { }
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey) || localStorage.getItem(`mep_drainage_pipe_calc_${pId}`);
        if (stored) {
          try { restoredData = JSON.parse(stored); } catch (err) { }
        }
      }
      if (restoredData && typeof restoredData === "object") {
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        if (restoredData.selectedPreset) setSelectedPreset(restoredData.selectedPreset);
        if (restoredData.customProfileName) setCustomProfileName(restoredData.customProfileName);
        if (restoredData.systemType) setSystemType(restoredData.systemType);
        if (restoredData.slope !== undefined) setSlope(restoredData.slope);
        if (restoredData.material) setMaterial(restoredData.material);
        if (restoredData.safetyFactor !== undefined) setSafetyFactor(restoredData.safetyFactor);
        if (restoredData.ventLength !== undefined) setVentLength(restoredData.ventLength);
        if (Array.isArray(restoredData.floorSections) && restoredData.floorSections.length > 0) {
          setFloorSections(restoredData.floorSections.filter((f: any) => f && f !== "undefined" && f !== "null"));
        }
        if (Array.isArray(restoredData.drainageSpaces) && restoredData.drainageSpaces.length > 0) {
          setDrainageSpaces(restoredData.drainageSpaces);
        }
        if (restoredData.floorSystemTypes) setFloorSystemTypes(restoredData.floorSystemTypes);
        toast.success("Restored drainage calculation snapshot!");
      }
    };

    window.addEventListener("mep_save_project", handleSaveEvent);
    window.addEventListener("mep_version_restored", handleVersionRestored);
    return () => {
      window.removeEventListener("mep_save_project", handleSaveEvent);
      window.removeEventListener("mep_version_restored", handleVersionRestored);
    };
  }, [
    project?.id,
    unitSystem,
    selectedPreset,
    customProfileName,
    customWorkflow,
    systemType,
    floorSystemTypes,
    slope,
    material,
    safetyFactor,
    ventLength,
    floorSections,
    drainageSpaces
  ]);

  // Load comments on project switch and merge into spaces
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-drainage`;
    try {
      const stored = localStorage.getItem(storageKey);
      let parsed: any[] = [];
      if (stored) {
        try { parsed = JSON.parse(stored); } catch (e) { }
      }
      const wdata = (project as any)?.workspace_data || {};
      const wdataComments = Array.isArray(wdata.drainage_calc_comments) ? wdata.drainage_calc_comments : [];
      const allComments = [...parsed, ...wdataComments];

      const dedupMap = new Map<string, any>();
      allComments.forEach(c => {
        if (c && typeof c === 'object') {
          const text = String(c.text || c.metadata?.text || "").trim();
          if (!text) return; // Discard dummy / empty comments
          const k = c.id || `${c.targetId}_${text}_${c.timestamp}`;
          if (!dedupMap.has(k)) {
            dedupMap.set(k, {
              ...c,
              text,
              authorName: c.authorName || c.metadata?.authorName || "Design Engineer"
            });
          }
        }
      });
      const mergedComments = Array.from(dedupMap.values());

      if (mergedComments.length > 0) {
        setCommentsList(mergedComments);
        setDrainageSpaces(prev =>
          prev.map(s => {
            const sId = String(s.id || "").trim().toLowerCase();
            const sDesc = String(s.desc || "").trim().toLowerCase();
            const spaceComments = mergedComments.filter(
              (c: any) => {
                const cTargetId = String(c.targetId || c.spaceId || "").trim().toLowerCase();
                const cTargetName = String(c.targetName || "").trim().toLowerCase();
                return (cTargetId && (cTargetId === sId || cTargetId === `space-${sId}`)) || (cTargetName && cTargetName === sDesc);
              }
            );
            return {
              ...s,
              comments: spaceComments.length > 0
                ? spaceComments
                : (s.comments || []).filter((sc: any) => sc && sc.text && String(sc.text).trim())
            };
          })
        );
      } else {
        setCommentsList([]);
      }
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  }, [project?.id]);

  const getSpaceComments = (space: { id?: string; desc?: string; comments?: any[] }): any[] => {
    if (!space) return [];
    const directComments = Array.isArray(space.comments)
      ? space.comments.filter((c: any) => c && typeof c === 'object' && Boolean(c.text && String(c.text).trim().length > 0))
      : [];
    const sDescLow = String(space.desc || "").trim().toLowerCase();
    const sId = String(space.id || "").trim().toLowerCase();

    const fromList = commentsList.filter((c: any) => {
      if (!c || !c.text || !String(c.text).trim()) return false;
      const cTargetId = String(c.targetId || c.metadata?.targetId || c.spaceId || "").trim().toLowerCase();
      const cTargetName = String(c.targetName || c.metadata?.targetName || "").trim().toLowerCase();

      if (cTargetId && (cTargetId === sId || cTargetId === `space-${sId}` || cTargetId === `space-row-${sId}` || `space-${cTargetId}` === sId)) return true;
      if (cTargetName && sDescLow && cTargetName === sDescLow) return true;
      return false;
    });

    const merged = [...directComments, ...fromList];
    const seen = new Set<string>();
    return merged.filter((c: any) => {
      if (!c || !c.text || !String(c.text).trim()) return false;
      const key = c.id || `${c.targetId}_${c.text}_${c.timestamp}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleOpenComment = (id: string, name: string) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Adding comments is locked.", { id: "readonly-notice" });
      return;
    }
    setCommentTargetItem({ id, name });
    setIsCommentModalOpen(true);
  };

  const drainageSpacesRef = useRef(drainageSpaces);
  drainageSpacesRef.current = drainageSpaces;
  const filterFloorRef = useRef(filterFloor);
  filterFloorRef.current = filterFloor;

  // Deep-linking helper to scroll and highlight commented target space
  const handleScrollToTarget = (targetId?: string, targetName?: string) => {
    if (!targetId && !targetName) return;

    const cleanId = String(targetId || "").trim();
    const cleanName = String(targetName || "").trim().toLowerCase();
    const cleanNorm = cleanName.replace(/[^a-z0-9]/g, "");

    const currentSpaces = drainageSpacesRef.current;
    const matched = currentSpaces.find(s => {
      if (cleanId && (s.id === cleanId || `space-row-${s.id}` === cleanId || `space-${s.id}` === cleanId)) return true;
      if (cleanName) {
        const descLow = s.desc.toLowerCase();
        const descNorm = descLow.replace(/[^a-z0-9]/g, "");
        if (descLow === cleanName || descLow.includes(cleanName) || cleanName.includes(descLow)) return true;
        if (cleanNorm && (descNorm === cleanNorm || descNorm.includes(cleanNorm) || cleanNorm.includes(descNorm))) return true;
      }
      return false;
    });

    if (matched) {
      setActiveTab("calculator");
      // If the targeted space is hidden under a different floor filter, show its floor
      if (filterFloorRef.current !== "all" && filterFloorRef.current !== matched.floor) {
        setFilterFloor(matched.floor);
      }
      setHighlightedSpaceId(matched.id);

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedSpaceId(null);
      }, 4500);

      const delays = [50, 150, 300, 600, 1000];
      delays.forEach(delay => {
        setTimeout(() => {
          const el = document.getElementById(`space-row-${matched.id}`) ||
            document.querySelector(`[data-row-id="${matched.id}"]`) ||
            document.querySelector(`[data-space-id="${matched.id}"]`) ||
            document.querySelector(`[data-comment-target="${matched.id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, delay);
      });
    }
  };

  // Listen for comment scroll/highlight navigation from notifications and initial URL parameters
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check URL parameters on mount
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("commentTargetId") || params.get("targetId");
    const targetName = params.get("commentTargetName") || params.get("targetName");
    if (targetId || targetName) {
      setTimeout(() => {
        handleScrollToTarget(targetId || undefined, targetName || undefined);
        // Clean URL query parameters so subsequent additions/edits don't re-trigger target scroll
        try {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch (e) { }
      }, 300);
    }

    // Listen to mep-scroll-to-item window events
    const handleScrollEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string; name?: string; type?: string; commentId?: string }>;
      if (!customEvent || !customEvent.detail) return;
      handleScrollToTarget(customEvent.detail.id, customEvent.detail.name);
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // Handle Preset Switching
  const handleApplyPreset = (key: DrainagePresetKey) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (key === "custom") {
      setSelectedPreset("custom");
      setCustomModalOpen(true);
      return;
    }
    const config = DRAINAGE_PRESETS[key];
    const presetData = DRAINAGE_PRESET_SPACES[key];
    if (!config) return;
    setSelectedPreset(key);
    setSystemType(config.systemType);
    setSlope(config.slope);
    setMaterial(config.material);
    setSafetyFactor(config.safetyFactor);
    setVentLength(config.ventLength);
    if (presetData) {
      const initialFloorTypes: Record<string, "branch" | "stack_short" | "stack_tall" | "building_drain"> = {};
      presetData.floorSections.forEach(fl => {
        initialFloorTypes[fl] = config.systemType;
      });
      setFloorSections([...presetData.floorSections]);
      setDrainageSpaces(presetData.spaces.map(s => ({ ...s, fixtures: { ...s.fixtures } })));
      setFloorSystemTypes(initialFloorTypes);
    }
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.info(`Loaded "${config.label}" matrix schedule.`);
  };

  const handleApplyCustomConfig = (updated: {
    systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
    slope: number;
    material: "pvc" | "cast_iron" | "hdpe" | "copper";
    safetyFactor: number;
    ventLength: number;
    fixtures: FixtureRowItem[];
    customProfileName: string;
    customWorkflow: "matrix" | "direct";
  }) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    setSelectedPreset("custom");
    setSystemType(updated.systemType);
    setSlope(updated.slope);
    setMaterial(updated.material);
    setSafetyFactor(updated.safetyFactor);
    setVentLength(updated.ventLength);
    setCustomProfileName(updated.customProfileName);
    setCustomWorkflow(updated.customWorkflow);

    // Map fixtures array into default space if in custom mode
    const customFixMap: Record<string, number> = {};
    updated.fixtures.forEach(f => {
      if (f.val > 0) customFixMap[f.id] = f.val;
    });
    setFloorSections(["CUSTOM FACILITY"]);
    setFloorSystemTypes({ "CUSTOM FACILITY": updated.systemType });
    setDrainageSpaces([
      {
        id: `space-${Date.now()}`,
        floor: "CUSTOM FACILITY",
        desc: updated.customProfileName || "Custom Sanitary Area",
        fixtures: customFixMap,
        spaceQty: 1,
        floorsQty: 1,
      }
    ]);
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.success(`Applied "${updated.customProfileName}" configuration!`);
  };

  const handleUnitSystemChange = (target: "ip" | "si") => {
    setUnitSystem(target);
    dirtyStore.set(true);
  };

  // Matrix Space Management
  const handleAddSpace = (targetFloor?: string) => {
    if (isLocked) return;
    const defaultFloor = targetFloor || (filterFloor !== "all" ? filterFloor : (floorSections[floorSections.length - 1] || floorSections[0] || "TYPICAL FLOOR"));
    const newId = `space-${Date.now()}`;
        const newSpace: DrainageSpaceItem = {
      id: newId,
      floor: defaultFloor,
      desc: `New Space (${drainageSpaces.length + 1})`,
      fixtures: {},
      spaceQty: 1,
      floorsQty: 1,
      flagged: true,
    };
    setDrainageSpaces(prev => [...prev, newSpace]);
    dirtyStore.set(true);
    toast.success(`Added new space to ${defaultFloor}.`);
  };

  const handleAddNewFloorSection = () => {
    if (isLocked) return;
    let count = floorSections.length + 1;
    let newSection = `FLOOR SECTION ${count}`;
    while (floorSections.includes(newSection)) {
      count++;
      newSection = `FLOOR SECTION ${count}`;
    }
    setFloorSections(prev => [...prev, newSection]);
    setFloorSystemTypes(prev => ({ ...prev, [newSection]: systemType }));
    if (filterFloor !== "all") {
      setFilterFloor(newSection);
    }
    handleAddSpace(newSection);
  };

  const handleRenameFloorGroup = (oldName: string, newName: string) => {
    if (isLocked) return;
    setFloorSections(prev => prev.map(f => (f === oldName ? newName : f)));
    setDrainageSpaces(prev => prev.map(s => (s.floor === oldName ? { ...s, floor: newName } : s)));
    setFloorSystemTypes(prev => {
      const next = { ...prev };
      if (next[oldName]) {
        next[newName] = next[oldName];
        delete next[oldName];
      }
      return next;
    });
    if (filterFloor === oldName) {
      setFilterFloor(newName);
    }
    dirtyStore.set(true);
  };

  const handleDeleteFloorGroup = async (floorName: string) => {
    if (isLocked) return;
    if (floorSections.length <= 1) {
      toast.error("At least one floor section is required.");
      return;
    }
    const spacesInFloor = drainageSpaces.filter(s => s.floor === floorName);
    const count = spacesInFloor.length;
    const msg = count > 0
      ? `Are you sure you want to delete floor section "${floorName}" and its ${count} space(s)?`
      : `Are you sure you want to delete floor section "${floorName}"?`;

    const ok = await confirm(msg, {
      title: "Delete Floor Section",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(drainageSpaces);
    setFloorSections(prev => prev.filter(f => f !== floorName));
    setDrainageSpaces(prev => prev.filter(s => s.floor !== floorName));
    setFloorSystemTypes(prev => {
      const next = { ...prev };
      delete next[floorName];
      return next;
    });
    if (filterFloor === floorName) {
      setFilterFloor("all");
    }
    dirtyStore.set(true);
    toast.info(`Deleted floor section "${floorName}".`);
  };

  const handleFloorSystemTypeChange = (floorName: string, newType: "branch" | "stack_short" | "stack_tall" | "building_drain") => {
    if (isLocked) return;
    setFloorSystemTypes(prev => ({
      ...prev,
      [floorName]: newType,
    }));
    dirtyStore.set(true);
  };

  const getSpaceEditIds = (spaceId: string): string[] => {
    return selectedSpaceIds.includes(spaceId) && selectedSpaceIds.length > 1
      ? selectedSpaceIds
      : [spaceId];
  };

  const handleUpdateSpaceDesc = (spaceId: string, val: string) => {
    if (isLocked) return;
    const clean = val.trim();
    if (!clean) return;
    const targets = getSpaceEditIds(spaceId);
    setDrainageSpaces(prev =>
      prev.map(s => (targets.includes(s.id) ? { ...s, desc: clean } : s))
    );
    dirtyStore.set(true);
    if (targets.length > 1) {
      toast.success(`Updated description for ${targets.length} spaces`);
    }
  };

  const handleUpdateSpaceFixture = (spaceId: string, fixtureId: string, val: number) => {
    if (isLocked) return;
    const clean = Math.max(0, isNaN(val) ? 0 : val);
    const targets = getSpaceEditIds(spaceId);
    setDrainageSpaces(prev =>
      prev.map(s => {
        if (targets.includes(s.id)) {
          return {
            ...s,
            fixtures: {
              ...s.fixtures,
              [fixtureId]: clean,
            },
          };
        }
        return s;
      })
    );
    dirtyStore.set(true);
    if (targets.length > 1) {
      toast.success(`Updated fixture count for ${targets.length} spaces`);
    }
  };

  const handleUpdateSpaceMultiplier = (spaceId: string, field: "spaceQty" | "floorsQty", val: number) => {
    if (isLocked) return;
    const clean = Math.max(1, isNaN(val) ? 1 : val);
    const targets = getSpaceEditIds(spaceId);
    setDrainageSpaces(prev =>
      prev.map(s => (targets.includes(s.id) ? { ...s, [field]: clean } : s))
    );
    dirtyStore.set(true);
    if (targets.length > 1) {
      toast.success(`Updated ${field === "spaceQty" ? "Space Qty" : "Floors Qty"} for ${targets.length} spaces`);
    }
  };

  const handleDuplicateSpace = (space: DrainageSpaceItem) => {
    if (isLocked) return;
    const copy: DrainageSpaceItem = {
      ...space,
      id: `space-${Date.now()}`,
      desc: `${space.desc} (Copy)`,
      fixtures: { ...space.fixtures },
    };
    setDrainageSpaces(prev => [...prev, copy]);
    dirtyStore.set(true);
    toast.success("Duplicated space.");
  };

  const handleDeleteSpace = async (id: string) => {
    if (isLocked) return;
    if (drainageSpaces.length <= 1) {
      toast.error("Cannot delete all spaces. Keep at least one space in schedule.");
      return;
    }
    const target = drainageSpaces.find(s => s.id === id);
    const msg = `Are you sure you want to delete space "${target?.desc || "selected space"}"?`;

    const ok = await confirm(msg, {
      title: "Delete Space",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(drainageSpaces);
    setDrainageSpaces(prev => prev.filter(s => s.id !== id));
    setSelectedSpaceIds(prev => prev.filter(sId => sId !== id));
    dirtyStore.set(true);
    toast.info("Space removed.");
  };

  const handleClearAllSchedule = async () => {
    if (isLocked) return;
    const ok = await confirm("Are you sure you want to clear all fixture quantities across the schedule?", {
      title: "Clear All Fixtures",
      confirmText: "Clear All",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(drainageSpaces);
    setDrainageSpaces(prev =>
      prev.map(s => ({
        ...s,
        fixtures: {},
      }))
    );
    dirtyStore.set(true);
    toast.success("Cleared all fixture quantities across schedule.");
  };

  // Selection handlers
  const handleToggleSelectAll = (checked: boolean) => {
    if (isLocked) {
      toast.info("Calculation is Approved & Locked. Selection is locked.", { id: "readonly-notice" });
      return;
    }
    if (checked) {
      setSelectedSpaceIds(drainageSpaces.map(s => s.id));
      toast.info(`Selected all ${drainageSpaces.length} space(s)`);
    } else {
      setSelectedSpaceIds([]);
    }
  };

  const handleToggleSelectSpace = (id: string, explicitChecked?: boolean) => {
    if (isLocked) return;
    setSelectedSpaceIds(prev => {
      const isCurrentlySelected = prev.includes(id);
      const shouldSelect = explicitChecked !== undefined ? explicitChecked : !isCurrentlySelected;
      if (shouldSelect) {
        return isCurrentlySelected ? prev : [...prev, id];
      } else {
        return prev.filter(sId => sId !== id);
      }
    });
  };

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<DrainageSpaceItem[][]>([]);
  const [redoStack, setRedoStack] = useState<DrainageSpaceItem[][]>([]);

  const pushToUndo = (currentSpaces: DrainageSpaceItem[]) => {
    setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(currentSpaces))]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (isLocked || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(drainageSpaces))]);
    setDrainageSpaces(previous);
    setUndoStack(prev => prev.slice(0, -1));
    dirtyStore.set(true);
    toast.success("Undo successful");
  };

  const handleRedo = () => {
    if (isLocked || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(drainageSpaces))]);
    setDrainageSpaces(next);
    setRedoStack(prev => prev.slice(0, -1));
    dirtyStore.set(true);
    toast.success("Redo successful");
  };

  const handleBulkDelete = async () => {
    if (isLocked || selectedSpaceIds.length === 0) return;
    if (selectedSpaceIds.length >= drainageSpaces.length) {
      toast.error("Cannot delete all spaces. Keep at least one space in schedule.");
      return;
    }
    const count = selectedSpaceIds.length;
    const msg = count === 1
      ? `Are you sure you want to delete space "${drainageSpaces.find(s => s.id === selectedSpaceIds[0])?.desc || "selected space"}"?`
      : `Are you sure you want to delete the ${count} selected space(s)?`;

    const ok = await confirm(msg, {
      title: "Delete Spaces",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(drainageSpaces);
    setDrainageSpaces(prev => prev.filter(s => !selectedSpaceIds.includes(s.id)));
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.info(`Deleted ${count} space(s)`);
  };

  const handleBulkDuplicate = () => {
    if (isLocked || selectedSpaceIds.length === 0) return;
    pushToUndo(drainageSpaces);
    const duplicates: DrainageSpaceItem[] = [];
    selectedSpaceIds.forEach(id => {
      const found = drainageSpaces.find(s => s.id === id);
      if (found) {
        duplicates.push({
          ...found,
          id: `space-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          desc: `${found.desc} (Copy)`,
          fixtures: { ...found.fixtures },
        });
      }
    });
    setDrainageSpaces(prev => [...prev, ...duplicates]);
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.success(`Duplicated ${duplicates.length} space(s).`);
  };

  // Clipboard Storage & Actions (Matching Ventilation & DataGrid Shortcuts)
  const [copiedDrainageSpaces, setCopiedDrainageSpaces] = useState<DrainageSpaceItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_clipboard_drainage_spaces");
        if (saved) return JSON.parse(saved);
      } catch (e) { }
    }
    return [];
  });

  const handleCopySpaces = (ids: string[]) => {
    const targets = drainageSpaces.filter(s => ids.includes(s.id));
    if (targets.length === 0) return;
    const cloned: DrainageSpaceItem[] = JSON.parse(JSON.stringify(targets));
    setCopiedDrainageSpaces(cloned);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("mep_clipboard_drainage_spaces", JSON.stringify(cloned));
        const headers = ["Floor", "Space Description", ...DRAINAGE_FIXTURES_META.map(f => f.name), "Space Qty", "Floors Qty"];
        const rows = cloned.map(s => [
          s.floor,
          s.desc,
          ...DRAINAGE_FIXTURES_META.map(f => s.fixtures[f.id] || 0),
          s.spaceQty,
          s.floorsQty,
        ]);
        const tsv = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
        navigator.clipboard?.writeText(tsv).catch(() => { });
      } catch (e) { }
    }
    toast.info(`${targets.length} space(s) copied to clipboard`);
  };

  const handleCutSpaces = (ids: string[]) => {
    if (isLocked) {
      toast.info("Calculation is Approved & Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const targets = drainageSpaces.filter(s => ids.includes(s.id));
    if (targets.length === 0) return;
    if (targets.length >= drainageSpaces.length) {
      toast.error("Cannot cut all spaces. Keep at least one space in schedule.");
      return;
    }
    pushToUndo(drainageSpaces);
    handleCopySpaces(ids);
    setDrainageSpaces(prev => prev.filter(s => !ids.includes(s.id)));
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.info(`${targets.length} space(s) cut to clipboard`);
  };

  const handlePasteSpaces = () => {
    if (isLocked) {
      toast.info("Calculation is Approved & Locked. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    let sourceSpaces = copiedDrainageSpaces;
    if (sourceSpaces.length === 0 && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_clipboard_drainage_spaces");
        if (saved) sourceSpaces = JSON.parse(saved);
      } catch (e) { }
    }
    if (sourceSpaces.length === 0) {
      toast.info("Clipboard is empty. Copy or cut spaces first (Ctrl+C).");
      return;
    }

    pushToUndo(drainageSpaces);
    const currentFloor = filterFloor !== "all" ? filterFloor : (floorSections[0] || "TYPICAL FLOOR");
    const pasted: DrainageSpaceItem[] = sourceSpaces.map((s, idx) => ({
      ...s,
      id: `space-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      floor: floorSections.includes(s.floor) ? s.floor : currentFloor,
      desc: `${s.desc.replace(/ \(Copy(-\d+)?\)$/, "")} (Copy)`,
      fixtures: { ...s.fixtures },
    }));

    setDrainageSpaces(prev => [...prev, ...pasted]);
    setSelectedSpaceIds(pasted.map(s => s.id));
    dirtyStore.set(true);
    toast.success(`${pasted.length} space(s) pasted from clipboard`);
  };

  // Keyboard Shortcuts Listener (Ctrl+A, Escape, Delete, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Deselect all selected spaces
      if (e.key === "Escape") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          setSelectedSpaceIds([]);
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const activeEl = document.activeElement;
      const isModalActive = Boolean(customModalOpen || showFormulaModal || showInspectorModal || isCommentModalOpen || editingSpace);

      // Lock Protection: Block select-all and modification shortcuts when calculation is locked/approved
      if (isLocked) {
        if (isCmdOrCtrl && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
          e.preventDefault();
          toast.info("Calculation is Approved & Locked. Selection is locked.", { id: "readonly-notice" });
          return;
        }
        if (["Delete", "Backspace"].includes(e.key) || (isCmdOrCtrl && ["x", "v", "d", "z", "y"].includes(e.key.toLowerCase()))) {
          e.preventDefault();
          toast.info("Calculation is Approved & Locked. Modifications are locked.", { id: "readonly-notice" });
          return;
        }
      }

      // 1. Ctrl+A / Cmd+A (Select All Spaces) - should ALWAYS select all spaces in schedule when no modal is open
      if (isCmdOrCtrl && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
        if (!isModalActive) {
          e.preventDefault();
          if (activeEl && "blur" in activeEl) {
            (activeEl as HTMLElement).blur();
          }
          if (drainageSpaces.length > 0) {
            setSelectedSpaceIds(drainageSpaces.map(s => s.id));
            toast.info(`Selected all ${drainageSpaces.length} space(s) (Ctrl+A)`);
          }
          return;
        }
      }

      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isInput) return;

      // 2. Undo / Redo: Ctrl+Z / Ctrl+Y
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

      // 3. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
        return;
      }

      // 4. Ctrl+C (Copy)
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          handleCopySpaces(selectedSpaceIds);
        }
        return;
      }

      // 5. Ctrl+X (Cut)
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          handleCutSpaces(selectedSpaceIds);
        }
        return;
      }

      // 6. Ctrl+V (Paste)
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteSpaces();
        return;
      }

      // 7. Ctrl+D (Duplicate)
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          handleBulkDuplicate();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    drainageSpaces,
    selectedSpaceIds,
    isLocked,
    copiedDrainageSpaces,
    floorSections,
    filterFloor,
    undoStack,
    redoStack,
    customModalOpen,
    showFormulaModal,
    showInspectorModal,
    isCommentModalOpen,
    editingSpace,
  ]);

  // Aggregate Calculations from Matrix Spaces
  const calcResults = useMemo(() => {
    return computeDrainageCalculations(drainageSpaces, systemType, slope, material, safetyFactor, ventLength);
  }, [drainageSpaces, systemType, slope, material, safetyFactor, ventLength]);

  // Per-Floor Drainage Sizing Calculations
  const floorSizing = useMemo(() => {
    return computeDrainageFloorSizing(floorSections, drainageSpaces, safetyFactor, floorSystemTypes, systemType, slope);
  }, [floorSections, drainageSpaces, safetyFactor, floorSystemTypes, systemType, slope]);

  // Handle Right-Click Context Actions
  const handleCopyField = (name: string, value: any) => {
    toast.success(`Copied ${name}: ${value}`);
  };

  // Group spaces by floor for rendering
  const filteredFloorsGrouped = useMemo(() => {
    let filtered = drainageSpaces || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => s.desc.toLowerCase().includes(q) || s.floor.toLowerCase().includes(q));
    }

    if (filterFloor !== "all") {
      filtered = filtered.filter(s => s.floor === filterFloor);
    }

    if (showFlaggedOnly) {
      filtered = filtered.filter(s => getDrainageSpaceValidation(s).isFlagged);
    }

    const grouped: Record<string, DrainageSpaceItem[]> = {};
    const validFloors = floorSections.filter(fl => fl && fl !== "undefined" && fl !== "null");
    validFloors.forEach(fl => {
      grouped[fl] = [];
    });
    filtered.forEach(s => {
      const fl = (s.floor && s.floor !== "undefined" && s.floor !== "null") ? s.floor : (validFloors[0] || "TYPICAL FLOOR");
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(s);
    });
    return grouped;
  }, [drainageSpaces, floorSections, searchQuery, filterFloor, showFlaggedOnly]);

  // PDF Export
  const handleExportPdf = () => {
    try {
      const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
      const doc = new JsPDFClass("portrait", "mm", "a4");

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        }
      };

      const calcNo = (project as any)?.calcNo || "TRV-CAL-DRN-01";
      const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "Sanitary Drainage System";
      const clientName = project?.client || "General Contracting Co.";
      const locationRoom = (project as any)?.activeRoom?.name || (project as any)?.location || "Main Building Sanitary Drainage";

      // 1. Header Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Drainage Pipe & Stack Sizing Calculation Report", 14, 13);

      // 2. Metadata Block
      doc.setFontSize(8.5);
      doc.setLineWidth(0.3);
      doc.rect(14, 16, 182, 17);
      doc.line(105, 16, 105, 33);
      doc.line(14, 21.7, 196, 21.7);
      doc.line(14, 27.4, 196, 27.4);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 40, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 107, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 120, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 16, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 42, 31.6);

      doc.setFont("helvetica", "bold");
      doc.text("End User / Location:", 107, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(locationRoom, 142, 31.6);

      // Connected Sanitary Fixture Schedule
      const activeFixtures = calcResults.aggregatedFixtures.filter(f => f.val > 0);
      const fixtureRows = activeFixtures.map((f, idx) => [
        String(idx + 1),
        f.name,
        `${f.dfu} DFU`,
        String(f.val),
        `${f.dfu * f.val} DFU`,
        calcResults.rawDfu > 0 ? `${((f.dfu * f.val / calcResults.rawDfu) * 100).toFixed(1)}%` : "0%",
        `${f.minTrapSizeInches}" NPS`,
      ]);

      fixtureRows.push([
        { content: "TOTAL", colSpan: 2, styles: { fontStyle: "bold", halign: "center", fillColor: [218, 233, 248] } } as any,
        { content: "-", styles: { halign: "center", fillColor: [218, 233, 248] } },
        { content: String(calcResults.totalCount), styles: { fontStyle: "bold", halign: "center", fillColor: [218, 233, 248] } },
        { content: `${calcResults.rawDfu} DFU`, styles: { fontStyle: "bold", halign: "center", fillColor: [218, 233, 248] } },
        { content: "100%", styles: { fontStyle: "bold", halign: "center", fillColor: [218, 233, 248] } },
        { content: `Design: ${calcResults.designDfu} DFU`, styles: { fontStyle: "bold", fillColor: [218, 233, 248] } },
      ]);

      callAutoTable(doc, {
        startY: 37,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 } },
        headStyles: { fillColor: [217, 217, 217], textColor: [0, 0, 0], fontStyle: "bold" },
        head: [["No.", "Connected Sanitary Fixture", "Unit DFU", "Qty", "Total DFU", "Share", "Min Trap"]],
        body: fixtureRows,
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 70 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 15, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 25, halign: "center", fontStyle: "bold" },
          5: { cellWidth: 18, halign: "center" },
          6: { cellWidth: 24, halign: "center" },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 185;

      // 3-Tier Signature Block
      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails(project?.id || "default", "/plumbing-drainage", currentUserName, calcReviewState);

      callAutoTable(doc, {
        startY: finalY + 5,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 } },
        headStyles: { fillColor: [255, 230, 204], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
        head: [["", "Originator", "Reviewer", "Approver"]],
        body: [
          [{ content: "Name:", styles: { fontStyle: "bold", halign: "right" } }, { content: originatedName || "Abubakar Chanda", styles: { halign: "center" } }, { content: reviewerName || "-", styles: { halign: "center" } }, { content: approverName || "-", styles: { halign: "center" } }],
          [{ content: "Date:", styles: { fontStyle: "bold", halign: "right" } }, { content: originatedDate || today, styles: { halign: "center" } }, { content: reviewerDate || "-", styles: { halign: "center" } }, { content: approverDate || "-", styles: { halign: "center" } }],
        ],
        columnStyles: {
          0: { cellWidth: 25, fontStyle: "bold", halign: "right" },
          1: { cellWidth: 52, halign: "center" },
          2: { cellWidth: 52, halign: "center" },
          3: { cellWidth: 53, halign: "center" },
        },
      });

      doc.save(`Drainage_Pipe_Sizing_${projectNo}.pdf`);
      toast.success("Drainage calculation PDF report exported successfully!");
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(err?.message || "Failed to generate PDF export.");
    }
  };

  const allSpacesSelected = selectedSpaceIds.length === drainageSpaces.length && drainageSpaces.length > 0;

  return (
    <AppShell title="Drainage Pipe Sizing" onIntelClick={() => setIntelOpen(v => !v)} intelOpen={intelOpen} hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-2.5 overflow-hidden h-full animate-in fade-in-50 duration-200">

          {/* Top Stationary Header Block */}
          <div className="shrink-0 flex flex-col gap-2.5 pb-1">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 select-none">
              <div className="flex flex-col gap-1 max-w-2xl">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground mt-0.5">Drainage Pipe Sizing</h1>
                  <button
                    onClick={() => setIntelOpen(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                      }`}
                  >
                    <Sparkles className="size-3.5" />
                    <span>Intelligence</span>
                  </button>
                  <CalculationReviewBar
                    projectId={project?.id || "default"}
                    calculatorPath="/plumbing-drainage"
                    calculatorTitle="Drainage Pipe Sizing"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Subheader Navigation Bar & Main Card Container */}
          <div className={`flex-1 min-h-0 flex flex-col rounded-2xl transition-all duration-300 overflow-hidden ${isApprovedLocked || calcReviewState?.status === "APPROVED"
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            }`}>
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setActiveTab("calculator")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "calculator"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Drainage Sizer
                  </button>
                  <button
                    onClick={() => setActiveTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Report
                  </button>
                </div>



                <button
                  type="button"
                  onClick={() => setShowFormulaModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                  title="View IPC / UPC Formulas"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>

                <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

                {/* Drainage Application Preset Dropdown */}
                <DrainagePresetSelect
                  value={selectedPreset}
                  customProfileName={customProfileName}
                  onChange={handleApplyPreset}
                  onOpenCustomModal={() => setCustomModalOpen(true)}
                  unitSystem={unitSystem}
                  disabled={isEffectiveReadOnly}
                />
              </div>

              {/* Right Side Controls */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>

                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  disabled={isEffectiveReadOnly}
                  inputDescriptions="Drainage DFU, Pipe Diameters (NPS / mm DN), Slope (in/ft / mm/m), Manning Flow (GPM / L/s)"
                  conversionExample={
                    unitSystem === "ip"
                      ? "Convert 1/4 in/ft → 20.8 mm/m, 4 inch NPS → 100 mm DN, 50 GPM → 3.15 L/s"
                      : "Convert 20.8 mm/m → 1/4 in/ft, 100 mm DN → 4 inch NPS, 3.15 L/s → 50 GPM"
                  }
                />
              </div>
            </div>

            {/* Notification Banner across all tabs */}
            <CalculationStatusBanner
              projectId={project?.id || "default"}
              calculatorPath="/plumbing-drainage"
              calculatorTitle="Drainage Pipe Sizing"
            />

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {activeTab === "report" ? (
                /* PRINTABLE REPORT PREVIEW TAB */
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">

                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          Drainage Pipe & Stack Sizing Calculation Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          IPC Chapter 7, UPC Chapter 7 & Gravity Sanitary Drainage Hydraulic Analysis
                        </p>
                      </div>
                    </div>


                    {/* Table 1: Design Parameters & Hydraulic Sizing Criteria */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        1. Design Parameters & Hydraulic Sizing Criteria
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left">Design Parameter Description</th>
                            <th className="border border-border p-2 text-center w-28">Value</th>
                            <th className="border border-border p-2 text-center w-20">Unit</th>
                            <th className="border border-border p-2 text-left">Standard / Code Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                            <td className="border border-border p-2 font-bold">Total Connected Fixture Units (Raw DFU)</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.rawDfu}</td>
                            <td className="border border-border p-2 text-center">DFU</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC Table 709.1 Sanitary Drainage Load</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">Total Design Load (+Safety Margin)</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.designDfu}</td>
                            <td className="border border-border p-2 text-center">DFU</td>
                            <td className="border border-border p-2 text-muted-foreground">Includes +{safetyFactor}% Engineering Safety Allowance</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">Drainage Segment / System Type</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {systemType === "branch"
                                ? "Horizontal Branch"
                                : systemType === "stack_short"
                                  ? "Stack (≤ 3 Intervals)"
                                  : systemType === "stack_tall"
                                    ? "Stack (> 3 Intervals)"
                                    : "Building Drain / Sewer"}
                            </td>
                            <td className="border border-border p-2 text-center">-</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC Chapter 7 System Classification</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">Piping Installation Slope / Fall</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? calcResults.slopeMmPerM : calcResults.slopeInPerFt}
                            </td>
                            <td className="border border-border p-2 text-center">{isSI ? "mm/m" : "in/ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">{calcResults.slopePercent}% Gradient / Fall</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                            <td className="border border-border p-2 font-bold">Piping Material Specification</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.materialName}</td>
                            <td className="border border-border p-2 text-center">-</td>
                            <td className="border border-border p-2 text-muted-foreground">Manning Roughness Coefficient n = {calcResults.roughness}</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">6</td>
                            <td className="border border-border p-2 font-bold">Active Vent Pipe Developed Length</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? (ventLength * 0.3048).toFixed(1) : ventLength.toFixed(0)}
                            </td>
                            <td className="border border-border p-2 text-center">{isSI ? "m" : "ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC Table 906.1 Developed Vent Distance</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">7</td>
                            <td className="border border-border p-2 font-bold">Total Fixture Quantity</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.totalCount}</td>
                            <td className="border border-border p-2 text-center">units</td>
                            <td className="border border-border p-2 text-muted-foreground">Connected Sanitary Appliances Count</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">8</td>
                            <td className="border border-border p-2 font-bold">Water Closets Connected (WC Rule)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {calcResults.hasWc ? `Yes (${calcResults.wcCount} WCs)` : "No"}
                            </td>
                            <td className="border border-border p-2 text-center">-</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC 709.2 Minimum 3" NPS Rule for Water Closets</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 2: Hydraulic Sizing Output Summary */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        2. Hydraulic Sizing Output Summary (IPC / UPC Standard)
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="font-bold">
                          <tr>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-center w-12">Item</th>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Sizing Output Summary (IPC / UPC 7)</th>
                            <th className="bg-[#DAE9F8] dark:bg-sky-950/60 text-sky-950 dark:text-sky-200 border border-border p-2 text-center w-48">Calculated Result</th>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Engineering Basis & Criteria</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">A</td>
                            <td className="border border-border p-2">REQUIRED DRAINAGE PIPE DIAMETER (D)</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI ? `${calcResults.sizedDn} mm DN` : `${calcResults.sizedNps}" NPS`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">
                              IPC Table 710.1 (Max Capacity: {calcResults.maxAllowedDfu} DFU)
                            </td>
                          </tr>
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">B</td>
                            <td className="border border-border p-2">DRAINAGE CAPACITY UTILIZATION</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {calcResults.capacityUtilization.toFixed(1)} %
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">
                              {calcResults.designDfu} DFU Design Load / {calcResults.maxAllowedDfu} DFU Max Limit
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">C</td>
                            <td className="border border-border p-2 font-bold">Self-Cleansing Scour Velocity (v)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.velocityMps.toFixed(2)} m/s` : `${calcResults.velocityFps.toFixed(2)} ft/s`}
                            </td>
                            <td className="border border-border p-2 text-emerald-600 dark:text-emerald-400 font-medium">
                              {calcResults.isScourVelocityOk
                                ? "Compliant (≥ 2.0 ft/s / 0.6 m/s Self-Scouring per IPC 704.1)"
                                : "Below 2.0 ft/s (Low Velocity Warning)"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">D</td>
                            <td className="border border-border p-2 font-bold">Half-Full Gravity Discharge Capacity (Q_cap)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.qCapLps.toFixed(1)} L/s` : `${calcResults.qCapGpm} GPM`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Manning Equation Gravity Flow Capacity @ 50% Pipe Depth
                            </td>
                          </tr>
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">E</td>
                            <td className="border border-border p-2">REQUIRED VENT PIPE DIAMETER (D_vent)</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI ? `${calcResults.ventDn} mm DN` : `${calcResults.ventNps}" NPS`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">
                              IPC Table 906.1 Vent Sizing for {calcResults.designDfu} DFU & {isSI ? (ventLength * 0.3048).toFixed(1) + " m" : ventLength + " ft"} Max Length
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 3: Connected Sanitary Fixture Schedule */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        3. Connected Sanitary Fixture Schedule
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left">Sanitary Fixture</th>
                            <th className="border border-border p-2 text-center w-24">Unit DFU</th>
                            <th className="border border-border p-2 text-center w-20">Qty</th>
                            <th className="border border-border p-2 text-center w-28">Total DFU</th>
                            <th className="border border-border p-2 text-center w-20">Share</th>
                            <th className="border border-border p-2 text-left">Min Trap Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calcResults.aggregatedFixtures.filter(f => f.val > 0).map((f, i) => (
                            <tr key={f.id}>
                              <td className="border border-border p-2 text-center text-muted-foreground">{i + 1}</td>
                              <td className="border border-border p-2 font-bold">{f.name}</td>
                              <td className="border border-border p-2 text-center">{f.dfu} DFU</td>
                              <td className="border border-border p-2 text-center font-bold">{f.val}</td>
                              <td className="border border-border p-2 text-center font-bold text-primary">{f.dfu * f.val} DFU</td>
                              <td className="border border-border p-2 text-center text-muted-foreground">
                                {calcResults.rawDfu > 0 ? ((f.dfu * f.val / calcResults.rawDfu) * 100).toFixed(1) : 0}%
                              </td>
                              <td className="border border-border p-2 text-muted-foreground">
                                {f.minTrapSizeInches}" NPS ({Math.round(f.minTrapSizeInches * 25.4)} mm)
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold border-t-2 border-border">
                            <td className="border border-border p-2 text-center" colSpan={2}>TOTAL CONNECTED FIXTURES</td>
                            <td className="border border-border p-2 text-center">-</td>
                            <td className="border border-border p-2 text-center font-black">{calcResults.totalCount}</td>
                            <td className="border border-border p-2 text-center font-black text-primary">{calcResults.rawDfu} DFU</td>
                            <td className="border border-border p-2 text-center">100%</td>
                            <td className="border border-border p-2 text-muted-foreground">Design Load: {calcResults.designDfu} DFU</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 4: Mandatory Design Standards */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        4. Mandatory Design Standards & Engineering Guidelines
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left w-56">Mandatory Design Standard</th>
                            <th className="border border-border p-2 text-left">Compliance & Engineering Criteria</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                            <td className="border border-border p-2 font-bold">IPC Table 710.1 Pipe Sizing Limits</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Sanitary drainage branch, stack, and building drain sizing shall not exceed maximum fixture unit limits established in IPC Chapter 7.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">IPC 704.1 Self-Scouring Velocity</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Drainage piping shall be installed at a slope that produces a self-cleansing scour velocity of not less than 2.0 ft/s (0.61 m/s) to prevent solids sedimentation.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">IPC 709.2 Water Closet Minimum Size</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Any horizontal drainage branch or vertical stack serving one or more water closets shall be sized at a minimum of 3.0 inches NPS (80 mm DN).
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">IPC Chapter 9 Venting System Sizing</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Vent piping diameter and developed length shall comply with IPC Table 906.1 to ensure adequate air circulation and prevent trap seal siphonage.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                            <td className="border border-border p-2 font-bold">UPC Table 702.1 Fixture Units</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Fixture unit ratings assigned reflect intermittent peak discharge loading for gravity drainage systems under uniform plumbing standards.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>
                </div>
              ) : (
                /* Interactive Calculator Mode - Direct Ventilation-Style Full Height Table */
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

                  {/* Top Toolbar Bar (Matching Ventilation UI) */}
                  <div className="px-4 py-2.5 bg-card border-b border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shrink-0 select-none relative min-h-[46px]">

                    {/* Search & Floor Filter */}
                    <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                      <div className="relative flex items-center">
                        <Search className="size-3.5 absolute left-3 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Filter spaces..."
                          className="h-8 w-56 pl-8 pr-3 bg-surface-2 border border-border rounded-full text-xs outline-none focus:border-primary focus:bg-background transition-all text-foreground placeholder:text-muted-foreground"
                        />
                      </div>

                      {floorSections.filter(fl => fl && fl !== "undefined" && fl !== "null").length > 1 && (
                        <div className="relative inline-flex items-center">
                          <select
                            value={filterFloor}
                            onChange={e => setFilterFloor(e.target.value)}
                            className="h-8 pl-3.5 pr-8 bg-surface-2 border border-border rounded-full text-xs font-semibold outline-none focus:border-primary focus:bg-background transition-all text-foreground cursor-pointer hover:bg-surface-3 appearance-none shadow-2xs"
                          >
                            <option value="all">All Floors ({floorSections.filter(fl => fl && fl !== "undefined" && fl !== "null").length})</option>
                            {floorSections.filter(fl => fl && fl !== "undefined" && fl !== "null").map(fl => (
                              <option key={fl} value={fl}>{fl}</option>
                            ))}
                          </select>
                          <ChevronDown className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                      )}

                      {/* Flagged Only Filter Button matching Ventilation & Discharge Unit */}
                      <button
                        type="button"
                        onClick={() => setShowFlaggedOnly(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition cursor-pointer shadow-2xs ${
                          showFlaggedOnly
                            ? "bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-2xs"
                            : flaggedCount > 0
                              ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100"
                              : "bg-surface-2 border-border text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                        }`}
                        title={showFlaggedOnly ? "Showing flagged spaces only. Click to show all." : `${flaggedCount} flagged space(s)`}
                      >
                        <Flag className={`size-3.5 ${flaggedCount > 0 || showFlaggedOnly ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                        <span>{showFlaggedOnly ? "Flagged Only" : `Flagged (${flaggedCount})`}</span>
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0 justify-end w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleAddNewFloorSection}
                        disabled={isLocked}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        <Plus className="size-3.5" /> Add Floor Section
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddSpace()}
                        disabled={isLocked}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="size-3.5" /> Add Space
                      </button>
                    </div>

                    {/* Bulk Actions Bar Overlay (Exact Ventilation Matching Design) */}
                    {!isApprovedLocked && selectedSpaceIds.length > 0 && (
                      <div className="absolute inset-0 flex items-center gap-4 px-4 bg-[#f0f7ff] dark:bg-blue-950/50 text-[12px] text-[#06456F] dark:text-blue-300 z-20 border-b border-border/80 animate-in fade-in duration-100 flex-wrap select-none">
                        <span className="font-bold text-[#06456F] dark:text-blue-300">
                          {selectedSpaceIds.length} selected
                        </span>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            const sp = drainageSpaces.find(s => s.id === selectedSpaceIds[0]);
                            if (sp) setEditingSpace({ space: sp, floor: sp.floor });
                          }}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Edit3 className="size-3.5" /> Bulk edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopySpaces(selectedSpaceIds)}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer"
                        >
                          <Copy className="size-3.5" /> Copy
                        </button>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleCutSpaces(selectedSpaceIds)}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Scissors className="size-3.5" /> Cut
                        </button>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={handlePasteSpaces}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <ClipboardPaste className="size-3.5" /> Paste
                        </button>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={handleBulkDuplicate}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Copy className="size-3.5" /> Duplicate
                        </button>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={handleBulkDelete}
                          className="inline-flex items-center gap-1.5 font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedSpaceIds([])}
                          className="ml-auto text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors px-2 py-0.5 rounded cursor-pointer"
                        >
                          <X className="size-3" /> Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Schedule Matrix Table Container - Fits screen perfectly without horizontal scrollbar */}
                  <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto w-full custom-scrollbar select-none">
                    <table className="w-full border-collapse text-[11px] font-sans">
                      <thead className="bg-slate-50 dark:bg-slate-900/90 sticky top-0 z-20 border-b border-border text-muted-foreground uppercase text-[10.5px] tracking-wider font-bold">
                        <tr>
                          <th className="p-1 text-center w-8 min-w-[32px] max-w-[34px] border-r border-border/60">
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={allSpacesSelected && !isLocked}
                              onChange={e => handleToggleSelectAll(e.target.checked)}
                              title={isLocked ? "Calculation is locked" : "Select all spaces (Ctrl+A)"}
                              className="size-3.5 accent-primary cursor-pointer rounded disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </th>
                          <th className="p-1.5 px-2.5 text-left min-w-[150px] border-r border-border/60 whitespace-nowrap">
                            Space / Area Name
                          </th>
                          {DRAINAGE_FIXTURES_META.map(f => (
                            <th key={f.id} className="p-1.5 px-1 text-center border-r border-border/60 min-w-[48px]">
                              <div className="truncate text-[10.5px] leading-tight font-bold text-foreground" title={f.name}>{f.short}</div>
                              <div className="text-[10.5px] font-mono font-bold text-[#0A7BC7] dark:text-[#38bdf8] lowercase leading-tight mt-0.5">{f.dfu} dfu</div>
                            </th>
                          ))}
                          <th className="p-1.5 px-2 text-center text-[#0A7BC7] dark:text-[#38bdf8] font-extrabold min-w-[70px] whitespace-nowrap border-r border-border/60">
                            Total DFU
                          </th>
                          <th className="p-1 text-center w-10 min-w-[44px]">
                            {/* Action / Flag */}
                          </th>
                        </tr>
                      </thead>

                      {floorSections.filter(fl => fl && fl.toLowerCase() !== "undefined" && fl.toLowerCase() !== "null").map((floor, floorIndex) => {
                        const spacesInFloor = filteredFloorsGrouped[floor] || [];
                        if (filterFloor !== "all" && filterFloor !== floor) return null;

                        return (
                          <tbody key={`floor-tbody-${floorIndex}`} className="divide-y divide-border/60 border-b border-border">
                            {/* Floor Section Header */}
                            <tr id={`floor-section-${floor}`} className="bg-muted/40 font-bold text-[11px] text-foreground">
                              <td colSpan={DRAINAGE_FIXTURES_META.length + 4} className="py-1.5 px-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <ChevronDown className="size-3.5 text-primary shrink-0" />
                                    <FloorNameInput
                                      floor={floor}
                                      disabled={isLocked}
                                      onRename={handleRenameFloorGroup}
                                    />
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      ({spacesInFloor.length} spaces)
                                    </span>
                                  </div>

                                  {/* Individual Floor Drainage Segment / System Type Dropdown & Sizing Pill */}
                                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                    <span className="text-[10.5px] font-semibold text-muted-foreground hidden sm:inline">Segment Type:</span>
                                    <div className="relative inline-flex items-center">
                                       <select
                                         value={floorSystemTypes[floor] || systemType || "branch"}
                                         disabled={isLocked}
                                         onChange={e => handleFloorSystemTypeChange(floor, e.target.value as any)}
                                         className="h-7 appearance-none pl-2.5 pr-7 text-[11px] font-semibold bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary cursor-pointer disabled:opacity-60 shadow-2xs text-foreground max-w-[240px] sm:max-w-none truncate"
                                       >
                                         <option value="branch">Horizontal Fixture Branch (IPC Table 710.1(2))</option>
                                         <option value="stack_short">Vertical Stack ≤ 3 Stories (IPC Table 710.1(1))</option>
                                         <option value="stack_tall">Multi-Story Stack &gt; 3 Stories (IPC Table 710.1(1))</option>
                                         <option value="building_drain">Building Drain / Main Sewer Collector</option>
                                       </select>
                                       <ChevronDown className="size-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                     </div>

                                    {floorSizing[floor] && (
                                      <div
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 text-[10px] font-bold shadow-2xs shrink-0"
                                        title={`Floor Sized Pipe: ${isSI ? `${floorSizing[floor].sizedDn} mm DN` : `${floorSizing[floor].sizedNps}" NPS`} for ${floorSizing[floor].designDfu} DFU`}
                                      >
                                        <span>{isSI ? `${floorSizing[floor].sizedDn} mm DN` : `${floorSizing[floor].sizedNps}" NPS`}</span>
                                        <span className="text-[9px] font-medium opacity-80">({floorSizing[floor].designDfu} DFU)</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => handleAddSpace(floor)}
                                      className="flex items-center gap-1 text-[#0A7BC7] dark:text-[#38bdf8] hover:bg-blue-500/10 text-[10.5px] font-bold px-3 py-0.5 rounded-full border border-[#0A7BC7]/40 transition-colors cursor-pointer bg-transparent shadow-2xs"
                                      title={`Add space to ${floor}`}
                                    >
                                      <Plus className="size-3" />
                                      <span>Add Space to {floor}</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => handleDeleteFloorGroup(floor)}
                                      className="text-rose-500 hover:text-rose-700 text-[10px] font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                    >
                                      Delete Floor
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* Space Rows */}
                            {spacesInFloor.map((space, idx) => {
                              const isSelected = selectedSpaceIds.includes(space.id);
                              let spaceUnitDfu = 0;
                              DRAINAGE_FIXTURES_META.forEach(f => {
                                spaceUnitDfu += f.dfu * (space.fixtures[f.id] || 0);
                              });
                              const mult = (space.spaceQty || 1) * (space.floorsQty || 1);
                              const spaceTotalDfu = spaceUnitDfu * mult;
                              const validation = getDrainageSpaceValidation(space);
                              const isEffectivelyFlagged = validation.isFlagged;

                              return (
                                <ContextMenu key={space.id}>
                                  <ContextMenuTrigger asChild>
                                    <tr
                                      id={`space-row-${space.id}`}
                                      data-row-id={space.id}
                                      data-space-id={space.id}
                                      data-item-id={space.id}
                                      data-comment-target={space.id}
                                      title="Click to select, Ctrl+Click to multi-select, Double-click to edit, Ctrl+A to select all"
                                      onClick={(e) => {
                                        if (isLocked) return;
                                        const target = e.target as HTMLElement;
                                        if (target.tagName === "INPUT" || target.tagName === "BUTTON" || target.closest("button") || target.closest("input")) {
                                          return;
                                        }
                                        handleToggleSelectSpace(space.id);
                                      }}
                                      onDoubleClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        setEditingSpace({ space, floor });
                                      }}
                                      className={`group transition-colors duration-150 cursor-pointer h-8.5 text-xs ${highlightedSpaceId === space.id
                                        ? "ring-2 ring-primary bg-primary/25 font-bold z-10 relative"
                                        : isSelected
                                          ? "bg-row-selected font-medium"
                                          : idx % 2 === 0
                                            ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebef]/80 dark:hover:bg-[#25252b]/80"
                                            : "bg-white dark:bg-zinc-950 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"
                                        }`}
                                    >
                                      <td className="p-1 text-center w-[36px] min-w-[36px] border-r border-border/40" onDoubleClick={e => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          disabled={isLocked}
                                          checked={isSelected && !isLocked}
                                          onChange={e => handleToggleSelectSpace(space.id, e.target.checked)}
                                          className="size-3.5 accent-primary cursor-pointer rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                      </td>

                                      <td className="p-0.5 px-2 text-foreground min-w-[180px] border-r border-border/40" onDoubleClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-between gap-1 w-full">
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={space.desc || ""}
                                            placeholder="Space / Area Description"
                                            onChange={(e) => {
                                              if (isLocked) return;
                                              const val = e.target.value;
                                              const targets = selectedSpaceIds.includes(space.id) && selectedSpaceIds.length > 1 ? selectedSpaceIds : [space.id];
                                              setDrainageSpaces(prev => prev.map(item => {
                                                if (targets.includes(item.id)) {
                                                  const updated = { ...item, desc: val };
                                                  const wasMissing = getDrainageSpaceValidation(item).isMissing;
                                                  const isMissing = getDrainageSpaceValidation(updated).isMissing;
                                                  let flagged = updated.flagged;
                                                  if (isMissing) {
                                                    flagged = true;
                                                  } else if (wasMissing && !isMissing) {
                                                    flagged = false;
                                                  }
                                                  return { ...updated, flagged };
                                                }
                                                return item;
                                              }));
                                              dirtyStore.set(true);
                                            }}
                                            className="w-full bg-transparent hover:bg-background focus:bg-background border border-transparent hover:border-border/60 focus:border-primary rounded px-1.5 py-0.5 text-xs font-medium text-foreground outline-none transition-all truncate cursor-text"
                                            title={space.desc || "Untitled Space"}
                                          />
                                          {(() => {
                                            const spaceComments = getSpaceComments(space);
                                            if (spaceComments.length === 0) return null;
                                            return (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenComment(space.id, space.desc);
                                                }}
                                                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9.5px] font-bold border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer shrink-0"
                                                title={`${spaceComments.length} comment(s) / task(s)`}
                                              >
                                                <MessageSquare className="size-2.5 text-blue-500" />
                                                <span>{spaceComments.length}</span>
                                              </button>
                                            );
                                          })()}
                                        </div>
                                      </td>

                                      {/* Fixture Quantities with Ventilation clean inline style */}
                                      {DRAINAGE_FIXTURES_META.map(f => {
                                        const count = Number(space.fixtures?.[f.id] || 0);
                                        return (
                                          <td key={f.id} className="p-0.5 text-center font-mono text-[11px] min-w-[48px] border-r border-border/40" onDoubleClick={e => e.stopPropagation()}>
                                            <input
                                              type="number"
                                              min="0"
                                              step="1"
                                              disabled={isLocked}
                                              value={count > 0 ? count : ""}
                                              placeholder="—"
                                              onChange={(e) => {
                                                if (isLocked) return;
                                                const raw = e.target.value;
                                                const val = raw === "" ? 0 : parseInt(raw, 10);
                                                const targets = selectedSpaceIds.includes(space.id) && selectedSpaceIds.length > 1 ? selectedSpaceIds : [space.id];
                                                setDrainageSpaces(prev => prev.map(item => {
                                                    if (targets.includes(item.id)) {
                                                      const updatedFixtures = { ...(item.fixtures || {}) };
                                                      if (!isNaN(val) && val > 0) {
                                                        updatedFixtures[f.id] = val;
                                                      } else {
                                                        delete updatedFixtures[f.id];
                                                      }
                                                      const updated = { ...item, fixtures: updatedFixtures };
                                                      const wasMissing = getDrainageSpaceValidation(item).isMissing;
                                                      const isMissing = getDrainageSpaceValidation(updated).isMissing;
                                                      let flagged = updated.flagged;
                                                      if (isMissing) {
                                                        flagged = true;
                                                      } else if (wasMissing && !isMissing) {
                                                        flagged = false;
                                                      }
                                                      return { ...updated, flagged };
                                                    }
                                                    return item;
                                                  }));
                                                dirtyStore.set(true);
                                              }}
                                              className="w-full h-7 bg-transparent border border-transparent hover:border-border/60 focus:border-primary focus:bg-background rounded px-1 text-center font-mono tabular text-[13px] font-medium text-foreground placeholder:text-muted-foreground/30 outline-none transition-colors cursor-text disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                          </td>
                                        );
                                      })}

                                      {/* Total DFU */}
                                      <td className="p-1 px-1.5 text-center font-mono font-extrabold text-[#0A7BC7] dark:text-[#38bdf8] whitespace-nowrap text-[11.5px] min-w-[70px] border-r border-border/40">
                                        {spaceTotalDfu.toFixed(1)}
                                      </td>

                                      {/* Actions / Flag */}
                                      <td className="p-0.5 text-center min-w-[48px]" onDoubleClick={e => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const targets = selectedSpaceIds.includes(space.id) && selectedSpaceIds.length > 1 ? selectedSpaceIds : [space.id];
                                            const newFlagged = !isEffectivelyFlagged;
                                            setDrainageSpaces(prev => prev.map(item => targets.includes(item.id) ? { ...item, flagged: newFlagged } : item));
                                            dirtyStore.set(true);
                                            toast.info(newFlagged ? `Flagged ${targets.length > 1 ? `${targets.length} spaces` : `"${space.desc}"`} for review` : `Unflagged ${targets.length > 1 ? `${targets.length} spaces` : `"${space.desc}"`}`);
                                          }}
                                          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
                                          title={(() => {
                                            if (validation.isMissing) {
                                              return validation.reason || "Missing space data";
                                            }
                                            return isEffectivelyFlagged ? "Unflag space" : "Flag space for review";
                                          })()}
                                        >
                                          <Flag className={`size-3.5 transition-all duration-200 ${isEffectivelyFlagged ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"}`} />
                                        </button>
                                      </td>
                                    </tr>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs z-50">
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        setEditingSpace({ space, floor });
                                      }}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      <Edit3 className="size-3.5 text-muted-foreground" />
                                      <span>Edit Space Quantities</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double-click</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onClick={() => handleCopySpaces([space.id])}
                                      className="flex items-center gap-2 p-1.5 font-medium cursor-pointer"
                                    >
                                      <Copy className="size-3.5 text-muted-foreground" />
                                      <span>Copy Space</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        handleCutSpaces([space.id]);
                                      }}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      <Scissors className="size-3.5 text-muted-foreground" />
                                      <span>Cut Space</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={handlePasteSpaces}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      <ClipboardPaste className="size-3.5 text-muted-foreground" />
                                      <span>Paste Space</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        handleDuplicateSpace(space);
                                      }}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      <Copy className="size-3.5 text-muted-foreground" />
                                      <span>Duplicate Space</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator className="h-px bg-border my-1" />
                                    <ContextMenuItem onClick={() => handleOpenComment(space.id, space.desc)} className="flex items-center gap-2 p-1.5 cursor-pointer text-blue-600 font-medium">
                                      <MessageSquare className="size-3.5" />
                                      <span>{getSpaceComments(space).length > 0 ? `Comments / Tasks (${getSpaceComments(space).length})` : "Add Comment / Task"}</span>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        if (selectedSpaceIds.includes(space.id) && selectedSpaceIds.length > 1) {
                                          handleBulkDelete();
                                        } else {
                                          handleDeleteSpace(space.id);
                                        }
                                      }}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer text-rose-600"}`}
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>{selectedSpaceIds.includes(space.id) && selectedSpaceIds.length > 1 ? `Delete Selected (${selectedSpaceIds.length} spaces)` : "Delete Space"}</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Del</ContextMenuShortcut>
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              );
                            })}
                          </tbody>
                        );
                      })}
                    </table>
                  </div>

                  {/* Bottom Status & Summary Bar (Matching Ventilation UI) */}
                  <div className="px-4 py-2 bg-card border-t border-border flex items-center justify-between text-xs text-muted-foreground shrink-0 select-none flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span>Showing <strong className="text-foreground">{drainageSpaces.length}</strong> of <strong className="text-foreground">{drainageSpaces.length}</strong> spaces</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap">
                      <span>Total Fixtures: <strong className="text-foreground">{calcResults.totalCount}</strong></span>
                      <span className="text-border">|</span>
                      <span>Design DFU: <strong className="text-primary font-bold">{calcResults.designDfu} DFU</strong></span>
                      <span className="text-border">|</span>
                      <span>Main Sized Pipe: <strong className="text-foreground">{isSI ? `${calcResults.sizedDn} mm DN` : `${calcResults.sizedNps}" NPS`}</strong></span>
                      <span className="text-border">|</span>
                      <span>Velocity: <strong className={calcResults.isScourVelocityOk ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>{isSI ? `${calcResults.velocityMps} m/s` : `${calcResults.velocityFps} fps`}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${intelOpen ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg flex flex-col" : "w-0"
            }`}
        >
          {intelOpen && (
            <DrainageIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calcResults={calcResults}
              drainageSpaces={drainageSpaces}
              floorSections={floorSections}
              floorSystemTypes={floorSystemTypes}
              floorSizing={floorSizing}
              systemType={systemType}
              slope={slope}
              material={material}
              ventLength={ventLength}
              unitSystem={unitSystem}
              selectedPreset={selectedPreset}
              isLocked={isLocked}
              onSelectPreset={handleApplyPreset}
              onSetSlope={(sl) => {
                if (isLocked) {
                  toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                  return;
                }
                setSlope(sl);
                dirtyStore.set(true);
              }}
              onSetFormulaModal={setShowFormulaModal}
              onSetInspectorModal={setShowInspectorModal}
              onScrollToSpace={(spaceId) => {
                const el = document.getElementById(`space-row-${spaceId}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("bg-primary/25");
                  setTimeout(() => el.classList.remove("bg-primary/25"), 2000);
                }
              }}
              onScrollToFloor={(floorName) => {
                const el = document.getElementById(`floor-section-${floorName}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Edit Space Modal (Triggered on Space Double-Click) */}
      {editingSpace && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="size-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-foreground">Edit Space Fixture Schedule</h3>
                  <p className="text-xs text-muted-foreground">Configure plumbing fixtures and multiplier counts for this space</p>
                </div>
              </div>
              <button
                onClick={() => setEditingSpace(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Space Name and Floor Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Space / Room Name</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={editingSpace.space.desc}
                  onChange={e => {
                    const val = e.target.value;
                    setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, desc: val } } : null);
                  }}
                  className="w-full bg-background border border-input rounded-xl p-2 font-semibold text-foreground text-xs disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Floor Section</label>
                <div className="relative flex items-center">
                  <select
                    disabled={isLocked}
                    value={editingSpace.space.floor}
                    onChange={e => {
                      const val = e.target.value;
                      setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, floor: val } } : null);
                    }}
                    className="w-full appearance-none bg-background border border-input rounded-xl p-2 pr-8 font-semibold text-foreground text-xs cursor-pointer disabled:opacity-60 outline-none focus:border-primary"
                  >
                    {floorSections.map(fl => (
                      <option key={fl} value={fl}>{fl}</option>
                    ))}
                  </select>
                  <ChevronDown className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Multipliers */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Space Typical Quantity</label>
                <input
                  type="number"
                  min={1}
                  disabled={isLocked}
                  value={editingSpace.space.spaceQty}
                  onChange={e => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, spaceQty: val } } : null);
                  }}
                  className="w-full bg-background border border-input rounded-xl p-2 font-bold text-foreground text-xs disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Number of Typical Floors</label>
                <input
                  type="number"
                  min={1}
                  disabled={isLocked}
                  value={editingSpace.space.floorsQty}
                  onChange={e => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, floorsQty: val } } : null);
                  }}
                  className="w-full bg-background border border-input rounded-xl p-2 font-bold text-foreground text-xs disabled:opacity-60"
                />
              </div>
            </div>

            {/* Fixture Counters List */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                <span>Sanitary Fixtures</span>
                <span>Total DFU</span>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                {DRAINAGE_FIXTURES_META.map(f => {
                  const count = editingSpace.space.fixtures[f.id] || 0;
                  return (
                    <div key={f.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-surface-2">
                      <div className="flex-1 pr-2">
                        <div className="font-semibold text-xs text-foreground">{f.name}</div>
                        <div className="text-[10px] text-muted-foreground">Unit: {f.dfu} DFU • Trap: {f.minTrapSizeInches}" NPS</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-border rounded-lg bg-background p-0.5">
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              const newVal = Math.max(0, count - 1);
                              setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, fixtures: { ...prev.space.fixtures, [f.id]: newVal } } } : null);
                            }}
                            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                          >
                            <Minus className="size-3" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={count}
                            onChange={e => {
                              const newVal = Math.max(0, parseInt(e.target.value) || 0);
                              setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, fixtures: { ...prev.space.fixtures, [f.id]: newVal } } } : null);
                            }}
                            className="w-10 text-center text-xs font-bold bg-transparent outline-none disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              const newVal = count + 1;
                              setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, fixtures: { ...prev.space.fixtures, [f.id]: newVal } } } : null);
                            }}
                            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                        <div className="w-14 text-right text-xs font-bold text-primary">
                          {(count * f.dfu).toFixed(1)} DFU
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingSpace(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) {
                    toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                    return;
                  }
                  if (editingSpace) {
                    setDrainageSpaces(prev => prev.map(s => s.id === editingSpace.space.id ? editingSpace.space : s));
                    dirtyStore.set(true);
                    toast.success(`Updated space "${editingSpace.space.desc}"`);
                  }
                  setEditingSpace(null);
                }}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 cursor-pointer disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspector & Engineering Verification Modal (Triggered on Double-Clicking Section 3 or Category Breakdown) */}
      {showInspectorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-foreground">Engineering Verification & Load Breakdown Analysis</h3>
                  <p className="text-xs text-muted-foreground">Comprehensive IPC 2021 Table 710.1 & Manning partial gravity flow verification</p>
                </div>
              </div>
              <button
                onClick={() => setShowInspectorModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Top 4 KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 select-none">
              {/* Pipe Size Card */}
              <div className="bg-surface-2 text-card-foreground border border-border rounded-xl p-3.5 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Required Pipe Size</span>
                  <div className="p-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Cylinder className="size-3.5" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">
                    {isSI ? `${calcResults.sizedDn} mm` : `${calcResults.sizedNps}"`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {isSI ? `(${calcResults.sizedNps}" NPS)` : `(${calcResults.sizedDn} mm DN)`}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> IPC 710.1 Compliant
                </div>
              </div>

              {/* Total Design Load */}
              <div className="bg-surface-2 text-card-foreground border border-border rounded-xl p-3.5 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Design Load</span>
                  <div className="p-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Layers className="size-3.5" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">{calcResults.designDfu}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">DFU</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Raw: {calcResults.rawDfu} DFU (+{safetyFactor}% margin)
                </div>
              </div>

              {/* Minimum Slope */}
              <div className="bg-surface-2 text-card-foreground border border-border rounded-xl p-3.5 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Minimum Slope</span>
                  <div className="p-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                    <SlidersHorizontal className="size-3.5" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">
                    {isSI ? `${calcResults.slopeMmPerM}` : `${calcResults.slopeInPerFt}"`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{isSI ? "mm/m" : "in/ft"}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Grade: {calcResults.slopePercent}% slope
                </div>
              </div>

              {/* Scour Velocity */}
              <div className="bg-surface-2 text-card-foreground border border-border rounded-xl p-3.5 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Scour Flow Velocity</span>
                  <div className="p-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <Waves className="size-3.5" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">
                    {isSI ? `${calcResults.velocityMps}` : `${calcResults.velocityFps}`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{isSI ? "m/s" : "ft/s"}</span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Self-Cleansing Scour Ok
                </div>
              </div>
            </div>

            {/* 1. Capacity Utilization & Code Verification */}
            <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipe Capacity Utilization</span>
                <span className="text-xs font-bold text-primary">{calcResults.capacityUtilization.toFixed(1)}% Utilized</span>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, calcResults.capacityUtilization)}%` }}
                  className={`h-full ${calcResults.capacityUtilization > 90 ? "bg-amber-500" : "bg-emerald-500"}`}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1 text-center text-xs">
                <div className="p-2 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Factored Design Load</div>
                  <div className="text-sm font-black text-primary">{calcResults.designDfu} DFU</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Max Permitted Load</div>
                  <div className="text-sm font-black text-foreground">{calcResults.maxAllowedDfu} DFU</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Chosen Diameter</div>
                  <div className="text-sm font-black text-emerald-600">{isSI ? `${calcResults.sizedDn} mm` : `${calcResults.sizedNps}" NPS`}</div>
                </div>
              </div>
            </div>

            {/* 2. Hydraulics & Manning Partial Gravity Flow */}
            <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3 text-xs">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Hydraulic Flow & Scour Verification (Manning Eq.)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Manning Roughness (n)</div>
                  <div className="font-bold text-foreground">{calcResults.roughness}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Installation Slope</div>
                  <div className="font-bold text-foreground">{calcResults.slopePercent}% grade</div>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Scour Flow Velocity</div>
                  <div className={`font-bold ${calcResults.isScourVelocityOk ? "text-emerald-600" : "text-amber-600"}`}>
                    {isSI ? `${calcResults.velocityMps} m/s` : `${calcResults.velocityFps} ft/s`}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Gravity Flow (Q_cap)</div>
                  <div className="font-bold text-primary">{isSI ? `${calcResults.qCapLps} L/s` : `${calcResults.qCapGpm} GPM`}</div>
                </div>
              </div>
            </div>

            {/* 3. Category Load Contribution Breakdown */}
            <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3 text-xs">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Sanitary Fixture Category Shares</h4>
              <div className="h-3.5 w-full bg-muted rounded-full overflow-hidden flex">
                {calcResults.breakdown.map(item => (
                  <div
                    key={item.id}
                    style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    className="h-full"
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {calcResults.breakdown.map(item => (
                  <div key={item.id} className="flex items-start gap-2">
                    <span className="size-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: item.color }} />
                    <div>
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="text-muted-foreground text-[11px]">{item.dfu} DFU ({item.pct.toFixed(1)}%)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Venting Sizing Criteria */}
            <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-2 text-xs">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">IPC Table 906.1 Vent Sizing Compliance</h4>
              <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-background border border-border/60">
                <span>Required Vent Pipe Diameter for {isSI ? (ventLength * 0.3048).toFixed(1) + " m" : ventLength + " ft"} Run:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{isSI ? `${calcResults.ventDn} mm DN` : `${calcResults.ventNps}" NPS`}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowInspectorModal(false)}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formula & Engineering Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="size-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Plumbing Drainage Sizing Engineering Equations</h3>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-foreground">
              <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                <div className="font-bold text-primary">1. Drainage Fixture Unit (DFU) Method (IPC Chapter 7)</div>
                <p className="text-muted-foreground">
                  Drainage systems are sized probabilistically using Drainage Fixture Units (DFUs). The total design load is:
                </p>
                <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                  {"Design DFU = Total Connected Raw DFU × (1 + Safety Margin % / 100)"}
                </div>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                <div className="font-bold text-primary">2. Manning's Equation for Gravity Partial Flow</div>
                <p className="text-muted-foreground">
                  The velocity and gravity flow capacity for partially filled drainage pipes are determined using Manning's formula:
                </p>
                <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                  {"Imperial: V = (1.486 / n) × Rh^(2/3) × S^(1/2)   [ft/s]"}
                  <br />
                  {"Metric:   V = (1.0 / n) × Rh^(2/3) × S^(1/2)     [m/s]"}
                </div>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                <div className="font-bold text-primary">3. Self-Cleansing Scour Velocity Requirement</div>
                <p className="text-muted-foreground">
                  To prevent sanitary solids settling and pipe blockages, a minimum scour velocity of <strong>2.0 ft/s (0.60 m/s)</strong> is enforced by plumbing standards (IPC Table 704.1 & ASPE).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Drainage Config Modal */}
      <CustomDrainageConfigModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        unitSystem={unitSystem}
        currentValues={{
          systemType,
          slope,
          material,
          safetyFactor,
          ventLength,
          fixtures: calcResults.aggregatedFixtures,
          customProfileName,
          customWorkflow,
        }}
        onApply={handleApplyCustomConfig}
      />

      {/* Assign Comment Modal */}
      {isCommentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={isCommentModalOpen}
          onClose={() => {
            setIsCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="space"
          calculatorTitle="Drainage Pipe Sizing"
          calculatorPath="/plumbing-drainage"
          existingComments={commentTargetItem ? getSpaceComments({ id: commentTargetItem.id, desc: commentTargetItem.name } as any) : []}
          onSave={(comment) => {
            const enrichedComment = {
              ...comment,
              calculatorTitle: "Drainage Pipe Sizing",
              calculatorPath: "/plumbing-drainage",
              targetId: commentTargetItem.id,
              targetName: commentTargetItem.name,
              targetType: "space",
              projectId: project?.id || "default",
              projectName: project?.name || "MEP Calculator Project",
            };

            setDrainageSpaces(prev =>
              prev.map(s => {
                if (s.id === commentTargetItem.id || s.desc.trim().toLowerCase() === commentTargetItem.name.trim().toLowerCase()) {
                  const existing = Array.isArray(s.comments) ? s.comments : [];
                  return { ...s, comments: [enrichedComment, ...existing] };
                }
                return s;
              })
            );

            setCommentsList(prev => [enrichedComment, ...prev]);
            const storageKey = `mep_calc_comments_${project?.id || "default"}_/plumbing-drainage`;
            try {
              const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
              localStorage.setItem(storageKey, JSON.stringify([enrichedComment, ...existing]));
            } catch (e) { }

            try {
              if (project?.id) {
                const wdata = (project as any)?.workspace_data || {};
                const existingComments = Array.isArray(wdata.drainage_calc_comments) ? wdata.drainage_calc_comments : [];
                const updatedWdata = {
                  ...wdata,
                  drainage_calc_comments: [enrichedComment, ...existingComments]
                };
                if (updateProject && project) updateProject({ ...project, workspace_data: updatedWdata } as any);
              }
            } catch (e) {
              console.error("Failed to update workspaceStore project comments", e);
            }

            dirtyStore.set(true);
            setIsCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
        />
      )}
    </AppShell>
  );
}

interface DrainageIntelligenceDrawerProps {
  onClose: () => void;
  calcResults: any;
  drainageSpaces: DrainageSpaceItem[];
  floorSections: string[];
  floorSystemTypes: Record<string, "branch" | "stack_short" | "stack_tall" | "building_drain">;
  floorSizing: Record<string, any>;
  systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
  slope: number;
  material: "pvc" | "cast_iron" | "hdpe" | "copper";
  ventLength: number;
  unitSystem: "ip" | "si";
  selectedPreset: DrainagePresetKey;
  isLocked?: boolean;
  onSelectPreset: (presetKey: DrainagePresetKey) => void;
  onSetSlope: (slope: number) => void;
  onSetFormulaModal: (open: boolean) => void;
  onSetInspectorModal: (open: boolean) => void;
  onScrollToSpace: (spaceId: string) => void;
  onScrollToFloor: (floorName: string) => void;
}

function DrainageIntelligenceDrawer({
  onClose,
  calcResults,
  drainageSpaces,
  floorSections,
  floorSystemTypes,
  floorSizing,
  systemType,
  slope,
  material,
  ventLength,
  unitSystem,
  selectedPreset,
  isLocked,
  onSelectPreset,
  onSetSlope,
  onSetFormulaModal,
  onSetInspectorModal,
  onScrollToSpace,
  onScrollToFloor,
}: DrainageIntelligenceDrawerProps) {
  const isSI = unitSystem === "si";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    unassignedSpaces: false,
    floorsList: false,
    fixturesList: false,
  });

  // Compliance calculations
  const isVelocityOk = Boolean(calcResults?.isScourVelocityOk);
  const isUtilizationOk = (calcResults?.capacityUtilization ?? 0) <= 100;
  const isWcOk = !calcResults?.hasWc || (calcResults?.sizedNps ?? 0) >= 3;
  const isVentOk = (calcResults?.ventNps ?? 0) > 0;

  const checks = [isVelocityOk, isUtilizationOk, isWcOk, isVentOk];
  const passedCount = checks.filter(Boolean).length;
  const complianceScore = Math.round((passedCount / checks.length) * 100);

  // Missing data and diagnostics
  const zeroFixtureSpaces = useMemo(() => {
    return (drainageSpaces || [])
      .filter((s) => {
        const sum = Object.values(s.fixtures || {}).reduce((a, b) => a + (Number(b) || 0), 0);
        return sum === 0;
      })
      .map((s) => ({
        id: s.id,
        name: s.desc || "Untitled Space",
        detail: s.floor || "L01",
      }));
  }, [drainageSpaces]);

  const floorItems = useMemo(() => {
    return (floorSections || []).map((floor) => {
      const sizing = floorSizing?.[floor];
      const fDfu = sizing?.designDfu || 0;
      return {
        id: floor,
        name: floor,
        detail: `${fDfu} DFU · ${sizing ? (isSI ? `${sizing.sizedDn} mm DN` : `${sizing.sizedNps}" NPS`) : ""}`,
      };
    });
  }, [floorSections, floorSizing, isSI]);

  const activeFixturesSorted = useMemo(() => {
    return [...(calcResults?.aggregatedFixtures || [])]
      .filter((f: any) => f && f.val > 0)
      .sort((a: any, b: any) => b.dfu * b.val - a.dfu * a.val)
      .map((f: any) => ({
        id: f.id || f.name,
        name: f.name,
        detail: `${f.val} units × ${f.dfu} DFU (${f.dfu * f.val} DFU total)`,
      }));
  }, [calcResults?.aggregatedFixtures]);

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in select-none">
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
        <IntelSection icon={CheckCircle2} tone={complianceScore === 100 ? "success" : "warning"} title="Compliance Status">
          <div className="text-[12px] text-muted-foreground">
            IPC / UPC sanitary drainage validation across {(drainageSpaces || []).length} space(s).
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${complianceScore === 100 ? "bg-success" : "bg-warning"}`}
                style={{ width: `${complianceScore}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px]">{complianceScore}%</span>
          </div>
        </IntelSection>

        <IntelSection icon={Gauge} tone={isVelocityOk ? "success" : "warning"} title="Hydraulic & Pipe Sizing">
          <KV k="Design Load" v={`${calcResults?.designDfu ?? 0} DFU`} />
          <KV
            k="Governing Main Drain"
            v={isSI ? `${calcResults?.sizedDn ?? 40} mm DN` : `${calcResults?.sizedNps ?? 1.5}" NPS`}
          />
          <KV
            k="Scour Velocity"
            v={isSI ? `${(calcResults?.velocityMps ?? 0).toFixed(2)} m/s` : `${(calcResults?.velocityFps ?? 0).toFixed(2)} ft/s`}
          />
          <KV k="Pipe Capacity" v={`${(calcResults?.capacityUtilization ?? 0).toFixed(1)}%`} />
          <KV
            k="Vent Stack Sized"
            v={isSI ? `${calcResults?.ventDn ?? 0} mm DN` : `${calcResults?.ventNps ?? 0}" NPS`}
          />
        </IntelSection>

        <IntelSection
          icon={AlertTriangle}
          tone={!isVelocityOk || !isUtilizationOk || !isWcOk ? "warning" : "muted"}
          title="Code Warnings"
        >
          <KV
            k="Self-Cleansing Velocity"
            v={isVelocityOk ? 'Passed (≥ 2.0 ft/s)' : 'Warning (< 2.0 ft/s)'}
          />
          <KV
            k={'Water Closet 3" Rule'}
            v={isWcOk ? 'Passed (≥ 3" NPS)' : 'Warning (< 3" NPS)'}
          />
          <KV
            k="Slope Standard"
            v={`${slope}"/ft (${(slope * 8.33).toFixed(1)}%)`}
          />
        </IntelSection>

        <IntelSection icon={Layers} tone="primary" title="Floor Hierarchy">
          <CollapsibleMissingSection
            label="Floor Segments"
            count={floorSections.length}
            itemsList={floorItems}
            isOpen={openSections.floorsList}
            onToggle={() => setOpenSections((prev) => ({ ...prev, floorsList: !prev.floorsList }))}
            onItemClick={(floor) => onScrollToFloor(floor)}
          />
        </IntelSection>

        <IntelSection icon={Droplets} tone="primary" title="Active Fixtures">
          <CollapsibleMissingSection
            label="Connected Fixture Types"
            count={activeFixturesSorted.length}
            itemsList={activeFixturesSorted}
            isOpen={openSections.fixturesList}
            onToggle={() => setOpenSections((prev) => ({ ...prev, fixturesList: !prev.fixturesList }))}
            onItemClick={() => {}}
          />
        </IntelSection>

        <IntelSection icon={Info} tone="muted" title="Missing Data">
          <CollapsibleMissingSection
            label="Spaces with 0 Fixtures"
            count={zeroFixtureSpaces.length}
            itemsList={zeroFixtureSpaces}
            isOpen={openSections.unassignedSpaces}
            onToggle={() => setOpenSections((prev) => ({ ...prev, unassignedSpaces: !prev.unassignedSpaces }))}
            onItemClick={(id) => onScrollToSpace(id)}
          />
        </IntelSection>

        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Increase branch slope to 1/4" (2%) if scour velocity is below 2.0 ft/s (0.6 m/s).</li>
            <li>Verify stack size transitions at floor base and building drain entry.</li>
            <li>Maintain minimum 3" NPS for any discharge pipe receiving WC flush volumes.</li>
          </ul>
        </IntelSection>

        <IntelSection icon={Info} tone="muted" title="Engineering Notes">
          <div className="text-[12px] text-muted-foreground">
            Drainage &amp; vent sizing computed per IPC Table 710.1 &amp; Table 906.1 with Manning equation hydraulics.
          </div>
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
  itemsList: { id: string; name: string; detail?: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (id: string) => void;
}) {
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[12px] hover:text-foreground py-0.5 transition-colors cursor-pointer select-none text-left"
      >
        <span className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
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
                {item.detail && (
                  <span className="text-muted-foreground/50 text-[10px] font-mono ml-1.5">
                    ({item.detail})
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}