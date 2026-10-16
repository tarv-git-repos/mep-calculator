import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import {
  CalculationReviewBar,
  useCalculationEffectiveReadOnly,
  useCalculationReviewState,
} from "@/components/workspace/CalculationReviewBar";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import {
  Plus,
  Trash2,
  Search,
  Download,
  Trash,
  Upload,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  Copy,
  MessageSquare,
  Flag,
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Edit3,
  Zap,
  Lightbulb,
  Check,
  Filter,
  ArrowUpDown,
  FileText,
  Calculator,
  Save,
  Wind,
  FileSpreadsheet,
  Box,
  Snowflake,
  SlidersHorizontal,
  RefreshCw,
  Printer,
  Info,
  CopyPlus,
  Activity,
  BookOpen,
  Layers,
  Sliders,
} from "lucide-react";
import {
  getPreliminaryCoolingLoadSpaces,
  getVentilationSpaces,
} from "@/lib/calc-load-summary";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ImportSourceModal } from "@/components/workspace/ImportSourceModal";
import { FloorSelect } from "@/components/workspace/FloorSelect";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { exportLpdPDF } from "../lib/exportLpdPDF";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import {
  type LightFixture,
  type LpdSpace,
  type LpdGroup,
  type LpdProject,
  type BimSpaceForLpd,
  LPD_AUTHORITY_MAPPING,
  LIGHT_TYPE_MAPPING,
  DEFAULT_AUTHORITY_MAPPING_SQM,
  generateId,
  defaultFixture,
  defaultSpace,
  defaultGroup,
  defaultProject,
  getLpdCalculationPreview,
  convertBimSpacesToLpdGroups,
  convertBimSpacesToLpdGroupsSplit,
} from "@/lib/calc-lpd-calculation";
import { getProjectIfcFile } from "@/lib/projectIfcStorage";
import {
  extractSpacesFromActiveViewer,
  extractSpacesFromIFCFile,
  getFloorRank,
  type Extracted3DSpace,
} from "@/lib/bimViewerSpaceExtractor";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import {
  CalculationPreviewModal,
  type CalculationPreviewData,
} from "@/components/calculator-framework/CalculationPreviewModal";
import { LpdCategorySelect } from "@/components/workspace/LpdCategorySelect";
import { EditLpdSpaceModal } from "@/components/workspace/EditLpdSpaceModal";
import { LpdIntelligenceDrawer } from "@/components/workspace/LpdIntelligenceDrawer";

export const Route = createFileRoute("/lpd-calculation")({
  head: () => ({
    meta: [
      { title: "LPD Calculation — MEP Calc" },
      { name: "description", content: "Lighting Power Density (LPD) Calculations." },
    ],
  }),
  component: LPDCalculationPage,
});

export function migrateLpdProjects(rawProjects: any[]): LpdProject[] {
  if (!Array.isArray(rawProjects) || rawProjects.length === 0) {
    return [defaultProject()];
  }

  const sanitizeGroups = (groups: any[]) =>
    groups.forEach((g: any) => {
      if (g.spaces) {
        g.spaces.forEach((s: any) => {
          if (s.flagged === undefined) s.flagged = false;
          if (!Array.isArray(s.comments)) s.comments = [];
          if (!Array.isArray(s.fixtures) || s.fixtures.length === 0) s.fixtures = [defaultFixture()];
          if (typeof s.remarks === "string" && s.remarks.startsWith("BIM extract:")) {
            s.remarks = "";
          }
        });
      }
    });

  return rawProjects.map((p: any) => {
    if (p.groups) {
      p.internalGroups = p.groups;
      p.externalGroups = [defaultGroup("EXTERNAL AREA")];
      delete p.groups;
    }
    if (!p.internalGroups) p.internalGroups = [defaultGroup("INTERNAL AREA")];
    if (!p.externalGroups) p.externalGroups = [defaultGroup("EXTERNAL AREA")];

    sanitizeGroups(p.internalGroups);
    sanitizeGroups(p.externalGroups);
    return p;
  });
}

function LPDCalculationPage() {
  const { userData, profile, user } = useAuth();
  const currentUserName =
    userData?.name ||
    profile?.name ||
    (user as any)?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "System Admin";

  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const effectiveProjectId = activeProjectId || project?.id || "default";

  const calcReviewState = useCalculationReviewState("/lpd-calculation", effectiveProjectId);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/lpd-calculation", effectiveProjectId);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const isLoadedRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // Lazy initialization from local storage to prevent mount-time state wipe
  const [projects, setProjects] = useState<LpdProject[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const pId = localStorage.getItem("mep_active_project_id") || "default";
        const saved =
          localStorage.getItem(`mep_lpd_calc_${pId}`) ||
          localStorage.getItem("mep-lpd-calc-v2");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.projects && parsed.projects.length > 0) {
            return migrateLpdProjects(parsed.projects);
          }
        }
      } catch (e) {
        console.error("Failed to parse initial LPD projects:", e);
      }
    }
    return [defaultProject()];
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const pId = localStorage.getItem("mep_active_project_id") || "default";
        const saved =
          localStorage.getItem(`mep_lpd_calc_${pId}`) ||
          localStorage.getItem("mep-lpd-calc-v2");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.currentProjectId) return parsed.currentProjectId;
        }
      } catch (e) {}
    }
    return projects[0]?.id || "proj-default";
  });
  const [authorityMapping, setAuthorityMapping] = useState<Record<string, number>>(DEFAULT_AUTHORITY_MAPPING_SQM);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mep-lpd-unit-system");
      if (saved === "ip" || saved === "si") return saved;
    }
    return "si";
  });

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    localStorage.setItem("mep-lpd-unit-system", newSystem);

    if (shouldConvert) {
      const isToIp = newSystem === "ip";
      const areaFactor = isToIp ? 10.76391 : 1 / 10.76391;
      const lpdFactor = isToIp ? 1 / 10.76391 : 10.76391;

      setProjects((prevProjects) =>
        prevProjects.map((proj) => {
          const convertGroups = (groups: LpdGroup[]) =>
            groups.map((g) => ({
              ...g,
              spaces: (g.spaces || []).map((s) => {
                const currentArea = parseFloat(s.areaSqM);
                const currentBaseline = parseFloat(s.baselineLpd);
                return {
                  ...s,
                  areaSqM:
                    !isNaN(currentArea) && currentArea > 0
                      ? (currentArea * areaFactor).toFixed(1)
                      : s.areaSqM,
                  baselineLpd:
                    !isNaN(currentBaseline) && currentBaseline > 0
                      ? (currentBaseline * lpdFactor).toFixed(2)
                      : s.baselineLpd,
                };
              }),
            }));

          return {
            ...proj,
            internalGroups: convertGroups(proj.internalGroups || []),
            externalGroups: convertGroups(proj.externalGroups || []),
          };
        })
      );
      toast.success(`Converted values to ${newSystem.toUpperCase()}`);
    } else {
      toast.info(`Switched to ${newSystem.toUpperCase()} mode (numbers preserved)`);
    }
  };

  const normalizedAuthorityMapping = useMemo(() => {
    const map = new Map<string, number>();
    Object.entries(authorityMapping).forEach(([k, v]) => {
      map.set(k.toLowerCase().trim(), v);
    });
    return map;
  }, [authorityMapping]);

  const getBaselineLpdForType = useCallback(
    (type: string, system: "si" | "ip" = unitSystem): number | undefined => {
      if (!type) return undefined;
      const norm = type.toLowerCase().trim();
      let sqmVal = authorityMapping[type] ?? normalizedAuthorityMapping.get(norm);

      if (system === "ip") {
        if (LPD_AUTHORITY_MAPPING[norm] !== undefined) return LPD_AUTHORITY_MAPPING[norm];
        if (sqmVal !== undefined) return Number((sqmVal / 10.76391).toFixed(2));
        return undefined;
      } else {
        if (sqmVal !== undefined) return Number(sqmVal.toFixed(2));
        if (LPD_AUTHORITY_MAPPING[norm] !== undefined) return Number((LPD_AUTHORITY_MAPPING[norm] * 10.76391).toFixed(2));
        return undefined;
      }
    },
    [authorityMapping, normalizedAuthorityMapping, unitSystem]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const DEFAULT_LPD_COL_WIDTHS: Record<string, number> = useMemo(() => ({
    select: 38,
    name: 210,
    category: 210,
    lightType: 170,
    watts: 80,
    qty: 65,
    totalWatts: 95,
    area: 105,
    proposedLpd: 120,
    baselineLpd: 105,
    remarks: 140,
    addFixture: 38,
    flag: 38,
  }), []);

  const [lpdColWidths, setLpdColWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_grid_lpd_spaces");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      select: 38,
      name: 210,
      category: 210,
      lightType: 170,
      watts: 80,
      qty: 65,
      totalWatts: 95,
      area: 105,
      proposedLpd: 120,
      baselineLpd: 105,
      remarks: 140,
      addFixture: 38,
      flag: 38,
    };
  });

  const totalLpdTableWidth = useMemo(() => {
    return Object.values(lpdColWidths).reduce((a, b) => a + b, 0);
  }, [lpdColWidths]);

  const getLpdColStyle = (key: string) => {
    const val = lpdColWidths[key] ?? DEFAULT_LPD_COL_WIDTHS[key] ?? 100;
    const pct = ((val / totalLpdTableWidth) * 100).toFixed(2);
    return {
      width: `${pct}%`,
      minWidth: `${Math.min(val, 38)}px`,
    };
  };

  const handleResizeMouseDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = lpdColWidths[key] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const minW = key === "select" || key === "addFixture" || key === "flag" ? 32 : 50;
      const newWidth = Math.max(minW, startWidth + deltaX);
      setLpdColWidths((prev) => {
        const next = { ...prev, [key]: newWidth };
        try { localStorage.setItem("mep_grid_lpd_spaces", JSON.stringify(next)); } catch (err) {}
        return next;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const [activeTab, setActiveTab] = useState<"schedule" | "report">("schedule");
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "compliant" | "non-compliant" | "flagged" | "missing">("all");
  const [filterAreaType, setFilterAreaType] = useState<string>("all");
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState<boolean>(false);
  const [filterMinArea, setFilterMinArea] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string>("default");
  const [intelOpen, setIntelOpen] = useState(false);
  const [highlightedSpaceId, setHighlightedSpaceId] = useState<string | null>(null);

  // Calculation Preview Modal State
  const [previewData, setPreviewData] = useState<CalculationPreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Edit LPD Space Modal State (matching Ventilation layout)
  const [editingLpdSpace, setEditingLpdSpace] = useState<{
    space: LpdSpace;
    groupId: string;
    groupName: string;
    isNew?: boolean;
  } | null>(null);

  // Add Space Modal State
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [newSpaceFloor, setNewSpaceFloor] = useState("");
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceAreaType, setNewSpaceAreaType] = useState("Office - Enclosed");
  const [newSpaceArea, setNewSpaceArea] = useState<number | "">(100);
  const [newSpaceBaselineLpd, setNewSpaceBaselineLpd] = useState<number | "">(0.62);
  const [newSpaceFixtureType, setNewSpaceFixtureType] = useState("2x2 LED Troffer 36W");
  const [newSpaceFixtureWatts, setNewSpaceFixtureWatts] = useState<number | "">(36);
  const [newSpaceFixtureQty, setNewSpaceFixtureQty] = useState<number | "">(4);
  const [newSpaceRemarks, setNewSpaceRemarks] = useState("");

  // Add Custom Area Type Modal State
  const [customAreaModalOpen, setCustomAreaModalOpen] = useState(false);
  const [customAreaTarget, setCustomAreaTarget] = useState<{
    groupId: string;
    spaceId: string;
  } | null>(null);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaBaselineLpd, setNewAreaBaselineLpd] = useState("");

  // Import Sources (Ventilation, Preliminary Cooling Load, Excel, 3D BIM)
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const pclSpacesCount = useMemo(() => {
    if (!sourceModalOpen) return 0;
    const pId = activeProjectId || project?.id || "default";
    return getPreliminaryCoolingLoadSpaces(pId).length;
  }, [activeProjectId, project?.id, sourceModalOpen]);

  const ventSpacesCount = useMemo(() => {
    if (!sourceModalOpen) return 0;
    const pId = activeProjectId || project?.id || "default";
    return getVentilationSpaces(pId).length;
  }, [activeProjectId, project?.id, sourceModalOpen]);

  const lpdImportColumnMapping = useMemo(
    () => ({
      name: ["Space Name", "Space", "Room", "Room Name", "Name", "Description"],
      area: ["Area", "Area (m2)", "Area (sq.m)", "Area (sqm)", "Area (sq.ft)", "Area (sqft)", "Space Area"],
      areaType: ["Area Type", "Space Type", "Category", "Type", "Space Category"],
      baselineLpd: ["Baseline LPD", "Baseline", "LPD Baseline", "LPD Limit"],
      remarks: ["Remarks", "Comments", "Notes"],
      fixtureType: ["Fixture Type", "Light Type", "Luminaire Type"],
      watts: ["Watts", "Wattage", "Power (W)", "W"],
      qty: ["Qty", "Quantity", "Count"],
    }),
    []
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== "all") count++;
    if (filterAreaType !== "all") count++;
    if (filterFlaggedOnly) count++;
    if (filterMinArea !== null && filterMinArea > 0) count++;
    return count;
  }, [filterStatus, filterAreaType, filterFlaggedOnly, filterMinArea]);

  // Floating Context Menu state (avoids DOM table nesting errors with Radix inside tbody)
  const [spaceContextMenu, setSpaceContextMenu] = useState<{
    x: number;
    y: number;
    spaceId: string;
    groupId: string;
  } | null>(null);

  const [groupContextMenu, setGroupContextMenu] = useState<{
    x: number;
    y: number;
    groupId: string;
  } | null>(null);

  const confirm = useConfirm();
  const prompt = usePrompt();

  // Close context menu on outside click or scroll
  useEffect(() => {
    const handleCloseMenu = () => {
      setSpaceContextMenu(null);
      setGroupContextMenu(null);
    };
    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("scroll", handleCloseMenu, true);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("scroll", handleCloseMenu, true);
    };
  }, []);

  // Load from local storage when active project changes
  useEffect(() => {
    const pId = effectiveProjectId;
    try {
      const pKey = `mep_lpd_calc_${pId}`;
      const saved = localStorage.getItem(pKey) || localStorage.getItem("mep-lpd-calc-v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.projects && parsed.projects.length > 0) {
          const migratedProjects = migrateLpdProjects(parsed.projects);
          setProjects(migratedProjects);
          const validCurrentId =
            parsed.currentProjectId && migratedProjects.some((p: any) => p.id === parsed.currentProjectId)
              ? parsed.currentProjectId
              : migratedProjects[0].id;
          setCurrentProjectId(validCurrentId);
        }
      }
    } catch (e) {
      console.error("Failed to load LPD calculation:", e);
    }

    const savedMapping = localStorage.getItem("mep-lpd-custom-mapping-sqm");
    if (savedMapping) {
      try {
        const parsed = JSON.parse(savedMapping);
        setAuthorityMapping((prev) => ({ ...prev, ...parsed }));
      } catch (e) {}
    }

    setLoadedProjectId(pId);
    isLoadedRef.current = true;
    setTimeout(() => dirtyStore.set(false), 50);
  }, [effectiveProjectId]);

  // Auto-save to local storage (strictly guarded by isLoadedRef to prevent overwriting with initial state!)
  useEffect(() => {
    const pId = effectiveProjectId;
    if (!isLoadedRef.current || loadedProjectId !== pId) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    try {
      const dataToSave = {
        projects,
        currentProjectId,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`mep_lpd_calc_${pId}`, JSON.stringify(dataToSave));
      localStorage.setItem("mep-lpd-calc-v2", JSON.stringify({ projects, currentProjectId }));
      localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(authorityMapping));
      dirtyStore.set(true);
    } catch (e) {
      console.error("Failed to auto-save LPD calculation:", e);
    }
  }, [projects, currentProjectId, authorityMapping, effectiveProjectId, loadedProjectId]);

  // Explicit Save Handler (Called by TopBar Save button / Ctrl + S / Toolbar)
  const handleSaveLpd = useCallback(() => {
    const pId = effectiveProjectId;
    try {
      const dataToSave = {
        projects,
        currentProjectId,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`mep_lpd_calc_${pId}`, JSON.stringify(dataToSave));
      localStorage.setItem("mep-lpd-calc-v2", JSON.stringify({ projects, currentProjectId }));
      localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(authorityMapping));
      dirtyStore.set(false);
      if (forceSaveToCloud) forceSaveToCloud();
      toast.success("Lighting Power Density calculation saved successfully!", { id: "lpd-saved" });
    } catch (e) {
      console.error("Failed to save LPD calculation:", e);
      toast.error("Failed to save calculation.");
    }
  }, [projects, currentProjectId, authorityMapping, effectiveProjectId, forceSaveToCloud]);

  // Listen to Global Save (TopBar Save button / Ctrl + S)
  useEffect(() => {
    const handleTriggerSave = (e: any) => {
      if (e?.detail) e.detail.handled = true;
      handleSaveLpd();
    };
    window.addEventListener("mep-trigger-save", handleTriggerSave);
    return () => window.removeEventListener("mep-trigger-save", handleTriggerSave);
  }, [handleSaveLpd]);

  // Version History Restore Listener
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pId = effectiveProjectId;
      const pKey = `mep_lpd_calc_${pId}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache && lsCache[pKey]) {
        try {
          restoredData = typeof lsCache[pKey] === "string" ? JSON.parse(lsCache[pKey]) : lsCache[pKey];
        } catch (err) {}
      }
      if (!restoredData && lsCache && lsCache["mep-lpd-calc-v2"]) {
        try {
          restoredData = typeof lsCache["mep-lpd-calc-v2"] === "string" ? JSON.parse(lsCache["mep-lpd-calc-v2"]) : lsCache["mep-lpd-calc-v2"];
        } catch (err) {}
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey) || localStorage.getItem("mep-lpd-calc-v2");
        if (stored) {
          try {
            restoredData = JSON.parse(stored);
          } catch (err) {}
        }
      }
      if (restoredData && restoredData.projects && Array.isArray(restoredData.projects)) {
        const migrated = migrateLpdProjects(restoredData.projects);
        setProjects(migrated);
        if (restoredData.currentProjectId) setCurrentProjectId(restoredData.currentProjectId);
        toast.success("LPD calculation restored from selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [effectiveProjectId]);

  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0];

  const totalSpacesCount = useMemo(() => {
    const internal = (currentProject?.internalGroups || []).reduce((acc, g) => acc + (g.spaces?.length || 0), 0);
    const external = (currentProject?.externalGroups || []).reduce((acc, g) => acc + (g.spaces?.length || 0), 0);
    return internal + external;
  }, [currentProject]);

  const internalSpacesTotal = useMemo(() => {
    return (currentProject?.internalGroups || []).reduce((acc, g) => acc + (g.spaces?.length || 0), 0);
  }, [currentProject?.internalGroups]);

  const externalSpacesTotal = useMemo(() => {
    return (currentProject?.externalGroups || []).reduce((acc, g) => acc + (g.spaces?.length || 0), 0);
  }, [currentProject?.externalGroups]);

  const updateProject = (fn: (p: LpdProject) => LpdProject) => {
    setProjects((prev) => {
      const targetId = currentProject ? currentProject.id : null;
      const index = targetId ? prev.findIndex((p) => p.id === targetId) : 0;
      if (index === -1) {
        if (prev.length === 0) return [fn(defaultProject())];
        return [fn(prev[0]), ...prev.slice(1)];
      }
      return prev.map((p, idx) => (idx === index ? fn(p) : p));
    });
  };

  const updateProjectField = (field: keyof LpdProject, value: any) => {
    updateProject((p) => ({ ...p, [field]: value }));
  };

  const isInt = currentProject.type === "Internal";
  const activeGroups = isInt ? currentProject.internalGroups : currentProject.externalGroups;

  const updateActiveGroups = (fn: (groups: LpdGroup[]) => LpdGroup[]) => {
    updateProject((p) => {
      const isInternal = p.type === "Internal";
      const targetGroups = isInternal
        ? Array.isArray(p.internalGroups) ? p.internalGroups : []
        : Array.isArray(p.externalGroups) ? p.externalGroups : [];
      const updated = fn(targetGroups);
      return isInternal
        ? { ...p, internalGroups: updated }
        : { ...p, externalGroups: updated };
    });
  };

  const addGroup = () => {
    if (searchQuery) setSearchQuery("");
    if (filterStatus !== "all") setFilterStatus("all");
    if (filterAreaType !== "all") setFilterAreaType("all");
    if (filterFlaggedOnly) setFilterFlaggedOnly(false);
    if (filterMinArea !== null) setFilterMinArea(null);

    const floorPresets = [
      "GROUND FLOOR",
      "FIRST FLOOR",
      "SECOND FLOOR",
      "THIRD FLOOR",
      "FOURTH FLOOR",
      "FIFTH FLOOR",
      "SIXTH FLOOR",
      "SEVENTH FLOOR",
      "ROOF FLOOR",
      "BASEMENT 1",
      "BASEMENT 2",
    ];
    const existingNames = new Set(activeGroups.map((g) => g.name.trim().toUpperCase()));
    let nextName = floorPresets.find((n) => !existingNames.has(n));
    if (!nextName) {
      nextName = isInt ? `FLOOR ${activeGroups.length + 1}` : `EXTERNAL AREA ${activeGroups.length + 1}`;
    }

    const newGroup = defaultGroup(nextName);
    updateActiveGroups((groups) => [...groups, newGroup]);
    toast.success(`Floor group "${nextName}" added`);
  };

  const removeGroup = (gid: string) => {
    updateActiveGroups((groups) => groups.filter((g) => g.id !== gid));
    toast.success("Floor group removed");
  };

  const duplicateGroup = (gid: string) => {
    updateActiveGroups((groups) => {
      const idx = groups.findIndex((g) => g.id === gid);
      if (idx === -1) return groups;
      const target = groups[idx];
      const clone: LpdGroup = {
        ...target,
        id: generateId(),
        name: `${target.name} (COPY)`,
        spaces: target.spaces.map((s) => ({
          ...s,
          id: generateId(),
          fixtures: s.fixtures.map((f) => ({ ...f, id: generateId() })),
          comments: [],
        })),
      };
      const next = [...groups];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    toast.success("Floor group duplicated");
  };

  const addSpace = (gid: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const targetGrp = activeGroups.find((g) => g.id === gid);
    const floorName = targetGrp ? targetGrp.name : (isInt ? "FLOOR 1" : "EXTERNAL AREA 1");
    setNewSpaceFloor(floorName);
    const count = activeGroups.reduce((acc, g) => acc + (g.spaces?.length || 0), 0);
    setNewSpaceName(`Space ${count + 1}`);
    const defaultAreaType = isInt ? "Office" : "Exterior/Landscape Area";
    setNewSpaceAreaType(defaultAreaType);
    const baseline = LPD_AUTHORITY_MAPPING[defaultAreaType] || 0.62;
    setNewSpaceBaselineLpd(unitSystem === "ip" ? baseline : Number((baseline * 10.7639).toFixed(2)));
    setNewSpaceArea(100);
    setNewSpaceFixtureType("2x2 LED Troffer 36W");
    setNewSpaceFixtureWatts(36);
    setNewSpaceFixtureQty(4);
    setNewSpaceRemarks("");
    setShowAddSpaceModal(true);
  };

  const handleAddNewSpace = () => {
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    const targetGroup = activeGroups.find((g) => g.isExpanded) || activeGroups[0] || { id: generateId(), name: isInt ? "FLOOR 1" : "EXTERNAL AREA 1", isExpanded: true, spaces: [] };
    const count = activeGroups.reduce((acc, g) => acc + (g.spaces?.length || 0), 0);
    const spaceId = generateId();
    const defaultAreaType = isInt ? "Office" : "Exterior/Landscape Area";
    const baseline = LPD_AUTHORITY_MAPPING[defaultAreaType] || 0.62;
    const baselineSqM = unitSystem === "ip" ? String(Number((baseline * 10.7639).toFixed(2))) : String(baseline);

    const newSpaceItem: LpdSpace = {
      id: spaceId,
      name: `Space ${count + 1}`,
      areaType: defaultAreaType,
      areaSqM: unitSystem === "ip" ? "1076.4" : "100",
      baselineLpd: baselineSqM,
      remarks: "",
      fixtures: [
        {
          id: generateId(),
          type: "2x2 LED Troffer 36W",
          watts: "36",
          qty: "4",
        },
      ],
      comments: [],
      flagged: false,
    };

    updateActiveGroups((groups) => {
      let found = false;
      const next = groups.map((g) => {
        if (g.id === targetGroup.id) {
          found = true;
          return {
            ...g,
            isExpanded: true,
            spaces: [...(g.spaces || []), newSpaceItem],
          };
        }
        return g;
      });
      if (!found) {
        return [...groups, { ...targetGroup, isExpanded: true, spaces: [newSpaceItem] }];
      }
      return next;
    });

    setSelected(new Set([spaceId]));
    setEditingLpdSpace({
      space: newSpaceItem,
      groupId: targetGroup.id,
      groupName: targetGroup.name,
      isNew: true,
    });
  };

  const handleAddSpaceSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isEffectiveReadOnly) {
      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    if (!newSpaceName.trim()) {
      toast.error("Please enter a space name");
      return;
    }
    const targetFloorName = newSpaceFloor.trim() || (isInt ? "FLOOR 1" : "EXTERNAL AREA 1");
    const baselineVal = typeof newSpaceBaselineLpd === "number" ? newSpaceBaselineLpd : parseFloat(String(newSpaceBaselineLpd)) || 0;
    const areaVal = typeof newSpaceArea === "number" ? newSpaceArea : parseFloat(String(newSpaceArea)) || 100;
    
    // Store in sq.m and W/m2 internally
    const areaSqM = unitSystem === "ip" ? String(Number((areaVal * 0.092903).toFixed(2))) : String(areaVal);
    const baselineLpdSqM = unitSystem === "ip" ? String(Number((baselineVal * 10.7639).toFixed(2))) : String(baselineVal);

    const spaceId = generateId();
    const newCreatedSpace: LpdSpace = {
      id: spaceId,
      name: newSpaceName.trim(),
      areaType: newSpaceAreaType,
      areaSqM,
      baselineLpd: baselineLpdSqM,
      remarks: newSpaceRemarks,
      fixtures: [
        {
          id: generateId(),
          type: newSpaceFixtureType,
          watts: String(newSpaceFixtureWatts || 36),
          qty: String(newSpaceFixtureQty || 1),
        }
      ],
      comments: [],
      flagged: false,
    };

    updateActiveGroups((groups) => {
      let found = false;
      const next = groups.map((g) => {
        if (g.name.toUpperCase() === targetFloorName.toUpperCase()) {
          found = true;
          return {
            ...g,
            isExpanded: true,
            spaces: [...(g.spaces || []), newCreatedSpace],
          };
        }
        return g;
      });

      if (!found) {
        const newGrp = defaultGroup(targetFloorName);
        newGrp.isExpanded = true;
        newGrp.spaces = [newCreatedSpace];
        return [...next, newGrp];
      }
      return next;
    });

    setSelected(new Set([spaceId]));
    setShowAddSpaceModal(false);
    toast.success(`New Space "${newCreatedSpace.name}" added to ${targetFloorName}!`);
  };

  const removeSpace = (gid: string, sid: string) => {
    updateActiveGroups((groups) =>
      groups.map((g) =>
        g.id === gid ? { ...g, spaces: g.spaces.filter((s) => s.id !== sid) } : g
      )
    );
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(sid);
      return next;
    });
    toast.success("Space removed");
  };

  const duplicateSpace = (gid: string, sid: string) => {
    updateActiveGroups((groups) =>
      groups.map((g) => {
        if (g.id !== gid) return g;
        const targetIdx = g.spaces.findIndex((s) => s.id === sid);
        if (targetIdx === -1) return g;
        const target = g.spaces[targetIdx];
        const clone: LpdSpace = {
          ...target,
          id: generateId(),
          name: target.name ? `${target.name} (Copy)` : "Space (Copy)",
          fixtures: target.fixtures.map((f) => ({ ...f, id: generateId() })),
          comments: [],
          flagged: target.flagged || false,
        };
        const next = [...g.spaces];
        next.splice(targetIdx + 1, 0, clone);
        return { ...g, spaces: next };
      })
    );
    toast.success("Space duplicated");
  };

  const toggleFlag = (gid: string, sid: string) => {
    const isMultiTarget = selected.has(sid) && selected.size > 1;
    if (isMultiTarget) {
      let currentFlagged = false;
      for (const g of activeGroups) {
        const found = (g.spaces || []).find((s) => s.id === sid);
        if (found) {
          currentFlagged = Boolean(found.flagged);
          break;
        }
      }
      const nextFlagged = !currentFlagged;
      updateActiveGroups((groups) =>
        groups.map((g) => ({
          ...g,
          spaces: (g.spaces || []).map((s) =>
            selected.has(s.id) ? { ...s, flagged: nextFlagged } : s
          ),
        }))
      );
      toast.info(nextFlagged ? `Flagged ${selected.size} spaces for review` : `Unflagged ${selected.size} spaces`);
    } else {
      updateActiveGroups((groups) =>
        groups.map((g) =>
          g.id === gid
            ? {
                ...g,
                spaces: g.spaces.map((s) =>
                  s.id === sid ? { ...s, flagged: !s.flagged } : s
                ),
              }
            : g
        )
      );
    }
  };

  const addFixture = (gid: string, sid: string) => {
    updateActiveGroups((groups) =>
      groups.map((g) =>
        g.id === gid
          ? {
              ...g,
              spaces: (g.spaces || []).map((s) =>
                s.id === sid
                  ? { ...s, fixtures: [...(s.fixtures || []), defaultFixture()] }
                  : s
              ),
            }
          : g
      )
    );
    toast.success("Light fixture added");
  };

  const removeFixture = (gid: string, sid: string, fid: string) => {
    updateActiveGroups((groups) =>
      groups.map((g) =>
        g.id === gid
          ? {
              ...g,
              spaces: (g.spaces || []).map((s) =>
                s.id === sid
                  ? {
                      ...s,
                      fixtures:
                        s.fixtures && s.fixtures.length > 1
                          ? s.fixtures.filter((f) => f.id !== fid)
                          : s.fixtures,
                    }
                  : s
              ),
            }
          : g
      )
    );
  };

  const updateFixture = (
    gid: string,
    sid: string,
    fid: string,
    field: keyof LightFixture,
    val: any
  ) =>
    updateActiveGroups((groups) =>
      groups.map((g) =>
        g.id === gid
          ? {
              ...g,
              spaces: (g.spaces || []).map((s) =>
                s.id === sid
                  ? {
                      ...s,
                      fixtures: (s.fixtures || []).map((f) => {
                        if (f.id === fid) {
                          const newF = { ...f, [field]: val };
                          if (field === "type" && val !== "custom") {
                            if (LIGHT_TYPE_MAPPING[val] !== undefined) {
                              newF.watts = LIGHT_TYPE_MAPPING[val].toString();
                            } else if (val === "") {
                              newF.watts = "";
                            }
                          }
                          return newF;
                        }
                        return f;
                      }),
                    }
                  : s
              ),
            }
          : g
      )
    );

  const updateSpace = (
    gid: string,
    sid: string,
    field: keyof LpdSpace,
    val: any
  ) =>
    updateActiveGroups((groups) =>
      groups.map((g) =>
        g.id === gid
          ? {
              ...g,
              spaces: (g.spaces || []).map((s) => {
                if (s.id === sid) {
                  const newS = { ...s, [field]: val };
                  if (field === "areaType" && val !== "") {
                    const lpdVal = getBaselineLpdForType(val, unitSystem);
                    if (lpdVal !== undefined) {
                      newS.baselineLpd = Number(lpdVal).toFixed(2);
                    }
                  }
                  return newS;
                }
                return s;
              }),
            }
          : g
      )
    );

  const updateGroup = (gid: string, field: keyof LpdGroup, val: any) =>
    updateActiveGroups((groups) =>
      groups.map((g) => (g.id === gid ? { ...g, [field]: val } : g))
    );

  // Multi-selection helpers
  const allActiveSpaceIds = useMemo(() => {
    return activeGroups.flatMap((g) => (g.spaces || []).map((s) => s.id));
  }, [activeGroups]);

  const allSelected = allActiveSpaceIds.length > 0 && allActiveSpaceIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allActiveSpaceIds));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectGroup = (groupId: string, select: boolean) => {
    const group = activeGroups.find((g) => g.id === groupId);
    if (!group) return;
    const spaceIds = (group.spaces || []).map((s) => s.id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (select) {
        spaceIds.forEach((id) => next.add(id));
      } else {
        spaceIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const toggleFlagSelected = () => {
    if (selected.size === 0) return;
    updateActiveGroups((groups) =>
      groups.map((g) => ({
        ...g,
        spaces: (g.spaces || []).map((s) =>
          selected.has(s.id) ? { ...s, flagged: !s.flagged } : s
        ),
      }))
    );
    toast.success(`Toggled flag for ${selected.size} space(s)`);
  };

  const duplicateSelectedSpaces = () => {
    if (selected.size === 0) return;
    const newSelected = new Set<string>();
    updateActiveGroups((groups) =>
      groups.map((g) => {
        const nextSpaces: LpdSpace[] = [];
        (g.spaces || []).forEach((s) => {
          nextSpaces.push(s);
          if (selected.has(s.id)) {
            const cloneId = generateId();
            newSelected.add(cloneId);
            nextSpaces.push({
              ...s,
              id: cloneId,
              name: s.name ? `${s.name} (Copy)` : "Space (Copy)",
              fixtures: s.fixtures.map((f) => ({ ...f, id: generateId() })),
              comments: [],
            });
          }
        });
        return { ...g, spaces: nextSpaces };
      })
    );
    setSelected(newSelected);
    toast.success(`Duplicated ${selected.size} space(s)`);
  };

  const deleteSelectedSpaces = async () => {
    if (selected.size === 0) return;
    const count = selected.size;
    if (
      await confirm(`Are you sure you want to delete the ${count} selected space(s)?`, {
        title: "Delete Spaces",
        confirmText: "Delete",
        danger: true,
      })
    ) {
      updateActiveGroups((groups) =>
        groups.map((g) => ({
          ...g,
          spaces: (g.spaces || []).filter((s) => !selected.has(s.id)),
        }))
      );
      setSelected(new Set());
      toast.success(`Deleted ${count} space(s)`);
    }
  };

  // Keyboard shortcut for delete
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

        if (selected.size > 0) {
          e.preventDefault();
          deleteSelectedSpaces();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  // Project management
  const createNewProject = () => {
    const p = defaultProject();
    setProjects((prev) => [...prev, p]);
    setCurrentProjectId(p.id);
    setSelected(new Set());
    toast.success("New project created");
  };

  const deleteProject = async () => {
    if (projects.length <= 1) return alert("Cannot delete the last project.");
    if (await confirm("Are you sure you want to delete this project?")) {
      const newProjects = projects.filter((p) => p.id !== currentProjectId);
      setProjects(newProjects);
      setCurrentProjectId(newProjects[0].id);
      setSelected(new Set());
      toast.success("Project deleted");
    }
  };

  const handleExport = () => {
    exportLpdPDF(currentProject, unitSystem);
  };

  const handleSaveCustomArea = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newAreaName.trim();
    if (!cleanName) {
      toast.error("Please enter a valid area type name");
      return;
    }

    let enteredLpd = parseFloat(newAreaBaselineLpd);
    if (isNaN(enteredLpd) || enteredLpd <= 0) {
      enteredLpd = unitSystem === "ip" ? 0.60 : 6.50;
    }

    // In authorityMapping, values are stored in W/m² (SI)
    const lpdSqm = unitSystem === "ip" ? enteredLpd * 10.76391 : enteredLpd;

    const newMap = {
      ...authorityMapping,
      [cleanName]: lpdSqm,
    };
    setAuthorityMapping(newMap);
    localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(newMap));

    if (customAreaTarget) {
      updateSpace(customAreaTarget.groupId, customAreaTarget.spaceId, "areaType", cleanName);
      updateSpace(customAreaTarget.groupId, customAreaTarget.spaceId, "baselineLpd", enteredLpd.toFixed(2));
    }

    toast.success(
      `Added custom area type "${cleanName}" (${enteredLpd.toFixed(2)} ${unitSystem === "ip" ? "W/sq.ft" : "W/m²"})`
    );
    setCustomAreaModalOpen(false);
    setCustomAreaTarget(null);
    setNewAreaName("");
    setNewAreaBaselineLpd("");
  };

  useEffect(() => {
    if (!customAreaModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCustomAreaModalOpen(false);
        setCustomAreaTarget(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [customAreaModalOpen]);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { read, utils } = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[][] = utils.sheet_to_json(firstSheet, { header: 1 });

      const newMap = { ...authorityMapping };
      let added = 0;
      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (row && row[0] && row[1] !== undefined) {
          const areaName = String(row[0]).trim();
          const lpd = Number(row[1]);
          if (areaName && !isNaN(lpd)) {
            newMap[areaName] = lpd;
            added++;
          }
        }
      }

      if (added > 0) {
        setAuthorityMapping(newMap);
        localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(newMap));
        toast.success(`Successfully imported ${added} area types!`);
      } else {
        toast.error("No valid rows found. Ensure Column A has Area Names and Column B has Baseline LPD.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error importing Excel file.");
    }
    e.target.value = "";
  };

  const handleImportExcelRows = (mappedRows: any[]) => {
    if (!mappedRows || mappedRows.length === 0) return;

    // Check if the rows are catalog mappings (areaName, lpd) or space rows
    const first = mappedRows[0];
    const isCatalog =
      (first.areaName || first["Area Name"]) &&
      (first.lpd !== undefined || first["Baseline LPD"] !== undefined || first.baselineLpd !== undefined);

    if (isCatalog) {
      const newMap = { ...authorityMapping };
      let count = 0;
      mappedRows.forEach((r) => {
        const name = String(r.areaName || r["Area Name"] || "").trim();
        const lpd = Number(r.lpd ?? r["Baseline LPD"] ?? r.baselineLpd);
        if (name && !isNaN(lpd)) {
          newMap[name] = lpd;
          count++;
        }
      });
      if (count > 0) {
        setAuthorityMapping(newMap);
        localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(newMap));
        toast.success(`Successfully imported ${count} catalog baseline entries!`);
        return;
      }
    }

    // Otherwise, import as spaces into active/first group!
    const newSpaces: LpdSpace[] = mappedRows.map((r) => {
      const name = String(
        r.name ||
          r.spaceName ||
          r.location ||
          r["Space Name"] ||
          r["Space"] ||
          r["Room"] ||
          `Space ${generateId().slice(0, 4)}`
      ).trim();
      const area = String(r.area || r.areaSqM || r["Area"] || "0").trim();
      const areaType = String(r.areaType || r["Area Type"] || r.type || "").trim();
      const baseline = String(
        r.baselineLpd ||
          r["Baseline LPD"] ||
          (areaType ? getBaselineLpdForType(areaType, unitSystem) ?? "" : "")
      ).trim();
      const remarks = String(r.remarks || r.notes || r["Remarks"] || "").trim();

      const fixType = String(
        r.fixtureType || r["Fixture Type"] || r.lightType || "LED Panel 600x600"
      ).trim();
      const watts = String(r.watts || r["Watts"] || "36").trim();
      const qty = String(r.qty || r["Qty"] || r.quantity || "1").trim();

      return {
        id: generateId(),
        name,
        areaType,
        areaSqM: area,
        baselineLpd: baseline,
        remarks,
        fixtures: [
          {
            id: generateId(),
            type: fixType,
            watts,
            qty,
          },
        ],
        comments: [],
        flagged: false,
      };
    });

    if (newSpaces.length === 0) {
      toast.error("No valid space rows found in Excel");
      return;
    }

    updateActiveGroups((groups) => {
      if (!groups || groups.length === 0) {
        const newGroup = defaultGroup(isInt ? "FLOOR 1" : "EXTERNAL AREA 1");
        newGroup.spaces = newSpaces;
        newGroup.isExpanded = true;
        return [newGroup];
      }
      const target = groups.find((g) => g.isExpanded) || groups[0];
      return groups.map((g) =>
        g.id === target.id
          ? {
              ...g,
              isExpanded: true,
              spaces: [...(g.spaces || []), ...newSpaces],
            }
          : g
      );
    });

    toast.success(`Imported ${newSpaces.length} space(s) from Excel!`);
  };

  // Comment Modal
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    updateActiveGroups((groups) =>
      groups.map((g) => ({
        ...g,
        spaces: (g.spaces || []).map((s) =>
          s.id === commentTargetItem?.id
            ? {
                ...s,
                comments: [...((s as any).comments || []), comment],
              }
            : s
        ),
      }))
    );
    setCommentModalOpen(false);
    toast.success("Comment saved successfully");
  };



  const handleExcelFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { read, utils } = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = read(data);
      if (!workbook.SheetNames.length) {
        toast.error("Excel file is empty");
        return;
      }
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      // Parse sheet as 2D array to locate table header row dynamically
      const raw2D = utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
      if (!raw2D || raw2D.length === 0) {
        toast.error("No valid data rows found in the Excel sheet");
        return;
      }

      const isHeaderTerm = (val: any) => {
        if (typeof val !== "string" && typeof val !== "number") return false;
        const s = String(val).toLowerCase().replace(/[^a-z0-9]/g, "");
        return ["space", "room", "name", "area", "type", "baseline", "lpd", "fixture", "watt", "qty"].some((t) =>
          s.includes(t)
        );
      };

      let headerRowIndex = -1;
      let headerRow: string[] = [];
      for (let i = 0; i < Math.min(raw2D.length, 30); i++) {
        const rowArr = raw2D[i];
        if (Array.isArray(rowArr) && rowArr.some(isHeaderTerm)) {
          headerRowIndex = i;
          headerRow = rowArr.map((c) => String(c || "").trim());
          break;
        }
      }

      let jsonRows: Record<string, any>[] = [];
      if (headerRowIndex !== -1 && headerRow.length > 0) {
        for (let i = headerRowIndex + 1; i < raw2D.length; i++) {
          const rowArr = raw2D[i];
          if (!Array.isArray(rowArr) || rowArr.length === 0) continue;
          const rowObj: Record<string, any> = {};
          let hasValue = false;
          rowArr.forEach((cellVal, colIdx) => {
            const hName = headerRow[colIdx];
            if (hName) {
              rowObj[hName] = cellVal;
              if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== "") {
                hasValue = true;
              }
            }
          });
          if (hasValue) jsonRows.push(rowObj);
        }
      } else {
        jsonRows = utils.sheet_to_json<Record<string, any>>(firstSheet);
      }

      if (!jsonRows || jsonRows.length === 0) {
        toast.error("No valid data rows found in the Excel sheet");
        return;
      }

      // Map rows using lpdImportColumnMapping
      const mappedRows: Record<string, any>[] = [];
      jsonRows.forEach((row) => {
        const newObj: Record<string, any> = { ...row };
        for (const [key, mapping] of Object.entries(lpdImportColumnMapping)) {
          const targets = Array.isArray(mapping) ? mapping : [key, mapping];
          for (const target of targets) {
            if (row[target] !== undefined && row[target] !== null && row[target] !== "") {
              newObj[key] = row[target];
              break;
            }
            const normTarget = target.toLowerCase().replace(/[^a-z0-9]/g, "");
            for (const rKey of Object.keys(row)) {
              const normRKey = rKey.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (normRKey === normTarget && row[rKey] !== undefined && row[rKey] !== "") {
                newObj[key] = row[rKey];
                break;
              }
            }
            if (newObj[key] !== undefined) break;
          }
        }
        mappedRows.push(newObj);
      });

      handleImportExcelRows(mappedRows);
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse Excel file");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const handleImportFromVentilation = useCallback(() => {
    let ventSpaces: any[] = [];
    const projId = activeProjectId || project?.id || "default";

    // 1. Check workspaceStore spaces
    try {
      const wsSpaces = workspaceStore.getState().spaces;
      if (Array.isArray(wsSpaces) && wsSpaces.length > 0) {
        ventSpaces = wsSpaces;
      }
    } catch (e) {}

    // 2. Check project workspace_data spaces
    const projWsSpaces = (project as any)?.workspace_data?.spaces;
    if (ventSpaces.length === 0 && projWsSpaces) {
      if (Array.isArray(projWsSpaces) && projWsSpaces.length > 0) {
        ventSpaces = projWsSpaces;
      }
    }

    // 3. Check local storage cache keys
    if (ventSpaces.length === 0 && typeof localStorage !== "undefined") {
      const keysToTry = [
        `mep_spaces_${projId}`,
        `spaces_${projId}`,
        "mep_spaces",
        "spaces",
      ];
      for (const k of keysToTry) {
        try {
          const saved = localStorage.getItem(k);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              ventSpaces = parsed;
              break;
            }
          }
        } catch (e) {}
      }
    }

    if (ventSpaces.length === 0) {
      toast.info("No spaces found in the Ventilation schedule for this project.", {
        description: "Add spaces in Ventilation (/ventilation) first or upload an Excel schedule.",
      });
      return;
    }

    const bimSpaces: BimSpaceForLpd[] = ventSpaces.map((s: any, idx: number) => ({
      id: s.id || `vent-sp-${idx}`,
      name: s.name || `Space ${idx + 1}`,
      level: s.floor || s.level || "GROUND FLOOR",
      zone: s.zone || "Default",
      category: s.category || "General Office / Space",
      area: typeof s.area === "number" ? s.area : (parseFloat(String(s.area)) || 0),
      height: typeof s.height === "number" ? s.height : (parseFloat(String(s.height)) || 3.0),
    }));

    const { internalGroups, externalGroups, internalSpacesCount, externalSpacesCount } =
      convertBimSpacesToLpdGroupsSplit(bimSpaces, { unitSystem });

    updateProject((p) => ({
      ...p,
      internalGroups: internalGroups.length > 0 ? internalGroups : p.internalGroups,
      externalGroups: externalGroups.length > 0 ? externalGroups : p.externalGroups,
    }));

    const totalCount = internalSpacesCount + externalSpacesCount;
    toast.success(`Successfully imported ${totalCount} space(s) from Ventilation!`, {
      description: `Generated ${internalGroups.length} internal floor(s) and ${externalGroups.length} external group(s).`,
    });
  }, [activeProjectId, project, unitSystem, updateProject]);

  const handleImportFromPreliminary = useCallback(() => {
    let pclRows: any[] = [];
    const projId = activeProjectId || project?.id || "default";

    // 1. Check mep_pcl_rows_${projId} and pcl_rows
    if (typeof localStorage !== "undefined") {
      const keysToTry = [`mep_pcl_rows_${projId}`, "pcl_rows"];
      for (const k of keysToTry) {
        try {
          const saved = localStorage.getItem(k);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              pclRows = parsed;
              break;
            }
          }
        } catch (e) {}
      }
    }

    // 2. Check project.workspace_data?.localStorageCache
    if (pclRows.length === 0 && (project as any)?.workspace_data) {
      const lsCache = (project as any).workspace_data.localStorageCache;
      if (lsCache) {
        const saved = lsCache[`mep_pcl_rows_${projId}`] || lsCache["pcl_rows"];
        if (saved) {
          try {
            const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
            if (Array.isArray(parsed) && parsed.length > 0) {
              pclRows = parsed;
            }
          } catch (e) {}
        }
      }
    }

    if (pclRows.length === 0) {
      toast.info("No spaces found in Preliminary Cooling Load calculation.", {
        description: "Add spaces in Preliminary Cooling Load (/preliminary-cooling-load) first.",
      });
      return;
    }

    const bimSpaces: BimSpaceForLpd[] = pclRows.map((r: any, idx: number) => ({
      id: r.id || `pcl-sp-${idx}`,
      name: r.name || `Space ${idx + 1}`,
      level: r.floor || "GROUND FLOOR",
      category: r.type || "General Office / Space",
      area: typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0),
    }));

    const { internalGroups, externalGroups, internalSpacesCount, externalSpacesCount } =
      convertBimSpacesToLpdGroupsSplit(bimSpaces, { unitSystem });

    updateProject((p) => ({
      ...p,
      internalGroups: internalGroups.length > 0 ? internalGroups : p.internalGroups,
      externalGroups: externalGroups.length > 0 ? externalGroups : p.externalGroups,
    }));

    const totalCount = internalSpacesCount + externalSpacesCount;
    toast.success(`Successfully imported ${totalCount} space(s) from Preliminary Cooling Load!`, {
      description: `Generated ${internalGroups.length} internal floor(s) and ${externalGroups.length} external group(s).`,
    });
  }, [activeProjectId, project, unitSystem, updateProject]);

  const handleSyncFrom3DStudio = async () => {
    try {
      toast.loading("Scanning 3D Studio for spaces & luminaires...", { id: "lpd-3d-sync" });
      let extracted: Extracted3DSpace[] = extractSpacesFromActiveViewer();
      toast.dismiss("lpd-3d-sync");

      // Fallback 1: Check project IFC file in IndexedDB storage
      if (extracted.length === 0) {
        const savedProjectFile = await getProjectIfcFile(activeProjectId || project?.id);
        if (savedProjectFile instanceof File) {
          toast.loading("Extracting 3D geometry & luminaires from project IFC model...", { id: "lpd-ifc-parse" });
          extracted = await extractSpacesFromIFCFile(savedProjectFile);
          toast.dismiss("lpd-ifc-parse");
        }
      }

      // Fallback 2: Check active memory window session file
      if (extracted.length === 0) {
        const win = typeof window !== "undefined" ? (window as any) : {};
        const savedFile = win.__ACTIVE_IFC_FILE__ || win._currentLoadedFile;
        if (savedFile instanceof File) {
          toast.loading("Extracting 3D geometry & luminaires from IFC model...", { id: "lpd-ifc-parse" });
          extracted = await extractSpacesFromIFCFile(savedFile);
          toast.dismiss("lpd-ifc-parse");
        }
      }

      if (extracted.length === 0) {
        toast.info("No active 3D IFC spaces found.", {
          description: "No 3D model loaded yet. You can also import existing spaces from Ventilation or Preliminary Cooling Load.",
          action: {
            label: "Import Sources",
            onClick: () => {
              setSourceModalOpen(true);
            },
          },
        });
        return;
      }

      const { internalGroups, externalGroups, internalSpacesCount, externalSpacesCount } =
        convertBimSpacesToLpdGroupsSplit(extracted, { unitSystem });

      updateProject((p) => ({
        ...p,
        internalGroups: internalGroups.length > 0 ? internalGroups : p.internalGroups,
        externalGroups: externalGroups.length > 0 ? externalGroups : p.externalGroups,
      }));

      const parts: string[] = [];
      if (internalSpacesCount > 0) {
        parts.push(`${internalSpacesCount} internal room(s) in "Internal Area"`);
      }
      if (externalSpacesCount > 0) {
        parts.push(`${externalSpacesCount} outdoor space(s) (e.g. Garden/Terrace) in "External Area"`);
      }

      toast.success(
        `✨ Synced ${extracted.length} spaces from 3D Studio: ${parts.join(" and ")}! ASHRAE 90.1 baselines applied automatically.`,
        { duration: 5500 }
      );
    } catch (err) {
      console.error("Failed to sync spaces from 3D Studio:", err);
      toast.error("Failed to sync spaces from 3D Studio.");
    }
  };

  const handleLoadBenchmarkSpaces = () => {
    const benchmarkBimSpaces: BimSpaceForLpd[] = [
      { id: "bm_1", name: "Reception & Main Lobby", level: "GROUND FLOOR", area: 85, category: "Lobby" },
      { id: "bm_2", name: "Executive Boardroom", level: "FIRST FLOOR", area: 65, category: "Conference / Meeting Room" },
      { id: "bm_3", name: "Main MDF / Server Room", level: "FIRST FLOOR", area: 25, category: "Electrical / Mechanical Room" },
      { id: "bm_4", name: "Meeting Rooms (A & B)", level: "FIRST FLOOR", area: 35, category: "Conference / Meeting Room" },
      { id: "bm_5", name: "Open Office Workstations", level: "FIRST FLOOR", area: 320, category: "Office - Open Plan" },
      { id: "bm_6", name: "Restroom Blocks", level: "FIRST FLOOR", area: 30, category: "Restroom" },
      { id: "bm_7", name: "Staff Breakout Pantry", level: "FIRST FLOOR", area: 45, category: "Dining Area" },
      { id: "bm_8", name: "Circulation Corridors", level: "ROOF LEVEL", area: 110, category: "Corridor" },
      { id: "bm_9", name: "Main Electrical Room", level: "ROOF LEVEL", area: 20, category: "Electrical / Mechanical Room" },
      { id: "bm_10", name: "Primary AHU / Plant Room", level: "ROOF LEVEL", area: 40, category: "Electrical / Mechanical Room" },
    ];

    const { internalGroups, externalGroups } = convertBimSpacesToLpdGroupsSplit(benchmarkBimSpaces, { unitSystem });
    updateProject((p) => ({
      ...p,
      internalGroups: internalGroups.length > 0 ? internalGroups : p.internalGroups,
      externalGroups: externalGroups.length > 0 ? externalGroups : p.externalGroups,
    }));
    toast.success("Loaded 10 standard commercial office benchmark spaces!");
  };

  const handleOpenCalculationPreview = (space: LpdSpace, groupName?: string) => {
    const currentActive = isInt ? currentProject.internalGroups : currentProject.externalGroups;
    const grp = currentActive.find((g) => (g.spaces || []).some((s) => s.id === space.id));
    const gId = grp ? grp.id : (currentActive[0]?.id || "group-1");
    const gName = groupName || grp?.name || "Floor";
    setSelected(new Set([space.id]));
    setEditingLpdSpace({ space, groupId: gId, groupName: gName, isNew: false });
  };

  // Intelligence action triggers
  const handleScrollToSpace = (spaceId: string, groupId?: string) => {
    if (groupId) {
      updateGroup(groupId, "isExpanded", true);
    }
    setHighlightedSpaceId(spaceId);
    setTimeout(() => {
      const el = document.getElementById(`space-row-${spaceId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    setTimeout(() => {
      setHighlightedSpaceId((prev) => (prev === spaceId ? null : prev));
    }, 3500);
  };

  const handleAutoFlagNonCompliant = () => {
    let count = 0;
    updateActiveGroups((groups) =>
      groups.map((g) => ({
        ...g,
        spaces: (g.spaces || []).map((s) => {
          const totalWatts = (s.fixtures || []).reduce(
            (sum, f) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0),
            0
          );
          const rawArea = parseFloat(s.areaSqM) || 0;
          const proposedLpd = rawArea > 0 ? totalWatts / rawArea : 0;
          const baselineLpd = parseFloat(s.baselineLpd) || 0;
          if (rawArea > 0 && baselineLpd > 0 && proposedLpd > baselineLpd) {
            count++;
            return { ...s, flagged: true };
          }
          return s;
        }),
      }))
    );
    toast.success(`Flagged ${count} non-compliant space(s) for review`);
  };

  const handleClearAllFlags = () => {
    updateActiveGroups((groups) =>
      groups.map((g) => ({
        ...g,
        spaces: (g.spaces || []).map((s) => ({ ...s, flagged: false })),
      }))
    );
    toast.success("All space flags cleared");
  };

  const handleAutoFillBaselines = () => {
    let count = 0;
    updateActiveGroups((groups) =>
      groups.map((g) => ({
        ...g,
        spaces: (g.spaces || []).map((s) => {
          if ((!s.baselineLpd || parseFloat(s.baselineLpd) === 0) && s.areaType) {
            const lpdVal = getBaselineLpdForType(s.areaType, unitSystem);
            if (lpdVal !== undefined) {
              count++;
              return { ...s, baselineLpd: Number(lpdVal).toFixed(2) };
            }
          }
          return s;
        }),
      }))
    );
    toast.success(`Auto-filled baseline LPD for ${count} space(s) in ${unitSystem.toUpperCase()} units`);
  };

  const distinctAreaTypes = useMemo(() => {
    const types = new Set<string>();
    activeGroups.forEach((g) => {
      (g.spaces || []).forEach((s) => {
        if (s.areaType && s.areaType.trim()) {
          types.add(s.areaType.trim());
        }
      });
    });
    return Array.from(types).sort();
  }, [activeGroups]);

  // Filtered groups & spaces calculation
  const filteredGroups = useMemo(() => {
    // Sort groups floor-wise (Basement -> Ground -> 1st -> 2nd -> Roof -> Exterior)
    const sortedActiveGroups = [...activeGroups].sort((a, b) => {
      const rankA = getFloorRank(a.name);
      const rankB = getFloorRank(b.name);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

    return sortedActiveGroups.map((group) => {
      const filteredSpaces = (group.spaces || []).filter((space) => {
        // Query search
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const matchName = (space.name || "").toLowerCase().includes(q);
          const matchType = (space.areaType || "").toLowerCase().includes(q);
          const matchRemarks = (space.remarks || "").toLowerCase().includes(q);
          if (!matchName && !matchType && !matchRemarks) return false;
        }

        // Flagged only filter
        if (filterFlaggedOnly && !space.flagged) {
          return false;
        }

        // Area Type filter
        if (filterAreaType !== "all" && space.areaType !== filterAreaType) {
          return false;
        }

        const rawArea = parseFloat(space.areaSqM) || 0;
        // Min Area filter
        if (filterMinArea !== null && filterMinArea > 0) {
          if (rawArea < filterMinArea) return false;
        }

        // Status filters
        const totalWatts = (space.fixtures || []).reduce(
          (sum, f) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0),
          0
        );
        const proposedLpd = rawArea > 0 ? totalWatts / rawArea : 0;
        const baselineLpd = parseFloat(space.baselineLpd) || 0;

        if (filterStatus === "compliant") {
          return rawArea > 0 && baselineLpd > 0 && proposedLpd <= baselineLpd;
        }
        if (filterStatus === "non-compliant") {
          return rawArea > 0 && baselineLpd > 0 && proposedLpd > baselineLpd;
        }
        if (filterStatus === "flagged") {
          return Boolean(space.flagged);
        }
        if (filterStatus === "missing") {
          return rawArea <= 0 || !space.areaType || space.areaType.trim() === "" || totalWatts <= 0;
        }

        return true;
      });

      // Sort spaces within the group if a custom sortKey is set
      const sortedSpaces = [...filteredSpaces];
      if (sortKey === "name-asc") {
        sortedSpaces.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      } else if (sortKey === "name-desc") {
        sortedSpaces.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      } else if (sortKey === "area-desc") {
        sortedSpaces.sort((a, b) => (parseFloat(b.areaSqM) || 0) - (parseFloat(a.areaSqM) || 0));
      } else if (sortKey === "proposed-desc") {
        sortedSpaces.sort((a, b) => {
          const wA = (a.fixtures || []).reduce((sum, f) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0), 0);
          const areaA = parseFloat(a.areaSqM) || 0;
          const pA = areaA > 0 ? wA / areaA : 0;
          const wB = (b.fixtures || []).reduce((sum, f) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0), 0);
          const areaB = parseFloat(b.areaSqM) || 0;
          const pB = areaB > 0 ? wB / areaB : 0;
          return pB - pA;
        });
      } else if (sortKey === "watts-desc") {
        sortedSpaces.sort((a, b) => {
          const wA = (a.fixtures || []).reduce((sum, f) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0), 0);
          const wB = (b.fixtures || []).reduce((sum, f) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0), 0);
          return wB - wA;
        });
      } else if (sortKey === "baseline-desc") {
        sortedSpaces.sort((a, b) => (parseFloat(b.baselineLpd) || 0) - (parseFloat(a.baselineLpd) || 0));
      }

      return {
        ...group,
        filteredSpaces: sortedSpaces,
      };
    });
  }, [activeGroups, searchQuery, filterStatus, filterAreaType, filterFlaggedOnly, filterMinArea, sortKey, unitSystem]);

  // Overall totals across filtered groups
  const allFilteredSpaces = useMemo(() => {
    return filteredGroups.flatMap((g) => g.filteredSpaces);
  }, [filteredGroups]);

  const totalFilteredWatts = useMemo(() => {
    return allFilteredSpaces.reduce((sum, s) => {
      return (
        sum +
        (s.fixtures || []).reduce(
          (fSum, f) => fSum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0),
          0
        )
      );
    }, 0);
  }, [allFilteredSpaces]);

  const totalFilteredArea = useMemo(() => {
    return allFilteredSpaces.reduce((sum, s) => sum + (parseFloat(s.areaSqM) || 0), 0);
  }, [allFilteredSpaces]);

  const avgOverallProposedLpd = totalFilteredArea > 0 ? totalFilteredWatts / totalFilteredArea : 0;

  const totalCompliantSpaces = useMemo(() => {
    return allFilteredSpaces.filter((s) => {
      const tw = (s.fixtures || []).reduce(
        (sum, f) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0),
        0
      );
      const a = parseFloat(s.areaSqM) || 0;
      const b = parseFloat(s.baselineLpd) || 0;
      const p = a > 0 ? tw / a : 0;
      return a > 0 && b > 0 && p <= b;
    }).length;
  }, [allFilteredSpaces]);

  const evaluatedCount = useMemo(() => {
    return allFilteredSpaces.filter((s) => (parseFloat(s.areaSqM) || 0) > 0 && (parseFloat(s.baselineLpd) || 0) > 0).length;
  }, [allFilteredSpaces]);

  const overallComplianceRate = evaluatedCount > 0 ? Math.round((totalCompliantSpaces / evaluatedCount) * 100) : 100;

  let globalSrNo = 1;

  // Active space for context menu
  const activeContextSpace = useMemo(() => {
    if (!spaceContextMenu) return null;
    const group = activeGroups.find((g) => g.id === spaceContextMenu.groupId);
    return group?.spaces.find((s) => s.id === spaceContextMenu.spaceId) || null;
  }, [spaceContextMenu, activeGroups]);

  const activeContextGroup = useMemo(() => {
    if (!groupContextMenu) return null;
    return activeGroups.find((g) => g.id === groupContextMenu.groupId) || null;
  }, [groupContextMenu, activeGroups]);

  return (
    <AppShell
      title="LPD Calculation"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-center shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">LPD Calculation</h1>
              </div>

              {/* Intelligence Button */}
              <button
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>

              <CalculationReviewBar
                projectId={project?.id || "default"}
                calculatorPath="/lpd-calculation"
                calculatorTitle="LPD Calculation"
              />
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* White Card Container for Grid */}
          <div
            className={`flex-1 flex flex-col min-h-[450px] rounded-2xl overflow-hidden transition-all duration-300 relative ${
              calcReviewState?.status === "APPROVED"
                ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            }`}
          >
            {/* Top Row 1: Section Navigation Tabs & Print matching Pump Sizing */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setActiveTab("schedule")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      activeTab === "schedule"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    LPD Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      activeTab === "report"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    Report
                  </button>
                </div>

                {/* Formula Breakdown button placed right next to tabs on the left */}
                <TBtn
                  onClick={() => setShowFormulaModal(true)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Action button on the right of tabs matching Preliminary Standard */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExport} title="Export PDF Calculation">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Space Action Toolbar Matching Ventilation Layout */}
            {activeTab === "schedule" ? (
              <>
                <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print modal-blur-bg select-none">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter spaces..."
                className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
              />

              {/* Filter Button & Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                      activeFiltersCount > 0
                        ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                        : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                    title="Filter Spaces"
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
                  <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50 text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border">
                      <span className="text-[12px] font-semibold text-foreground">Filter Spaces</span>
                      {activeFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterStatus("all");
                            setFilterAreaType("all");
                            setFilterMinArea(null);
                            setFilterFlaggedOnly(false);
                          }}
                          className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Compliance Status</span>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer text-foreground"
                      >
                        <option value="all">All Statuses</option>
                        <option value="compliant">Compliant Only</option>
                        <option value="non-compliant">Non-Compliant Only</option>
                        <option value="missing">Missing Data Only</option>
                      </select>
                    </div>

                    {distinctAreaTypes.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Area / Space Type</span>
                        <select
                          value={filterAreaType}
                          onChange={(e) => setFilterAreaType(e.target.value)}
                          className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer text-foreground"
                        >
                          <option value="all">All Space Types</option>
                          {distinctAreaTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Min Area ({unitSystem === "ip" ? "sq.ft" : "m²"})
                      </span>
                      <input
                        type="number"
                        placeholder="e.g. 50"
                        value={filterMinArea ?? ""}
                        onChange={(e) => setFilterMinArea(e.target.value ? Number(e.target.value) : null)}
                        className="h-8 w-full px-2.5 bg-surface-2 border border-border rounded-lg text-xs text-foreground outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1 pt-1.5 border-t border-border/60">
                      <label className="flex items-center gap-2 text-[11.5px] font-semibold text-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterFlaggedOnly}
                          onChange={(e) => setFilterFlaggedOnly(e.target.checked)}
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

              {/* Sort Button & Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                      sortKey !== "default"
                        ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                        : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                    title="Sort Spaces"
                  >
                    <ArrowUpDown className="size-3.5 shrink-0" />
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                      Sort
                    </span>
                    {sortKey !== "default" && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                        ✓
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans z-50 text-xs">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-border">
                    <span className="text-[11.5px] font-semibold text-foreground">Sort Spaces</span>
                    {sortKey !== "default" && (
                      <button
                        type="button"
                        onClick={() => setSortKey("default")}
                        className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setSortKey(sortKey === "name-asc" ? "default" : "name-asc")}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                        sortKey === "name-asc" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>Space Name (A to Z)</span>
                      {sortKey === "name-asc" && <Check className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortKey(sortKey === "area-desc" ? "default" : "area-desc")}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                        sortKey === "area-desc" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>Area (Largest First)</span>
                      {sortKey === "area-desc" && <Check className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortKey(sortKey === "proposed-desc" ? "default" : "proposed-desc")}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                        sortKey === "proposed-desc" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>Proposed LPD (Highest First)</span>
                      {sortKey === "proposed-desc" && <Check className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortKey(sortKey === "watts-desc" ? "default" : "watts-desc")}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                        sortKey === "watts-desc" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>Total Watts (Highest First)</span>
                      {sortKey === "watts-desc" && <Check className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortKey(sortKey === "baseline-desc" ? "default" : "baseline-desc")}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                        sortKey === "baseline-desc" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>Baseline LPD (Highest First)</span>
                      {sortKey === "baseline-desc" && <Check className="size-3.5" />}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* View Options & Column Distribution Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
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
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem("mep_grid_lpd_spaces");
                          setLpdColWidths(DEFAULT_LPD_COL_WIDTHS);
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

              {/* Right Controls: Import, Export, Save, + New Space matching Ventilation */}
              <div className="ml-auto flex items-center gap-1">
                <TBtn
                  disabled={isEffectiveReadOnly}
                  onClick={() => {
                    if (isEffectiveReadOnly) {
                      toast.info("Calculation is Approved and locked in Read-Only mode.", { id: "readonly-notice" });
                      return;
                    }
                    setSourceModalOpen(true);
                  }}
                  title="Import Spaces from Excel, 3D Studio, Ventilation, or Preliminary Cooling Load"
                >
                  <Upload className="size-3.5" /> Import
                </TBtn>

                <TBtn onClick={handleExport}>
                  <Download className="size-3.5" /> Export
                </TBtn>

                <TBtn onClick={handleSaveLpd} title="Save Calculation (Ctrl+S)">
                  <Save className="size-3.5" /> Save
                </TBtn>

                <TBtn
                  primary
                  disabled={isEffectiveReadOnly}
                  onClick={handleAddNewSpace}
                >
                  <Plus className="size-3.5" /> New Space
                </TBtn>
              </div>

              {/* Bulk actions bar overlay */}
              {!isEffectiveReadOnly && selected.size > 0 && (
                <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                  <span className="font-semibold">{selected.size} selected</span>
                  <span className="text-primary/30">·</span>
                  {selected.size === 1 && (
                    <BulkBtn
                      icon={Sparkles}
                      onClick={() => {
                        const sid = Array.from(selected)[0];
                        for (const g of currentProject.groups || []) {
                          const sp = g.spaces.find((s) => s.id === sid);
                          if (sp) {
                            handleOpenCalculationPreview(sp, g.name);
                            break;
                          }
                        }
                      }}
                    >
                      Calculation Preview
                    </BulkBtn>
                  )}
                  <BulkBtn icon={Flag} onClick={toggleFlagSelected}>
                    Toggle Flag
                  </BulkBtn>
                  <BulkBtn icon={Copy} onClick={duplicateSelectedSpaces}>
                    Duplicate
                  </BulkBtn>
                  <BulkBtn icon={Trash2} onClick={deleteSelectedSpaces}>
                    Delete
                  </BulkBtn>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                  >
                    <X className="size-3" /> Clear
                  </button>
                </div>
              )}
            </div>

            {/* Area & Floor Toolbar Below Filter Line */}
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between px-3 py-1.5 min-h-[42px] h-auto border-b border-border/70 bg-header-bg/50 backdrop-blur-md shrink-0 select-none gap-y-2 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
                {/* Internal / External Area Switch */}
                <div className="flex bg-surface-2 p-0.5 rounded-full border border-border">
                  <button
                    type="button"
                    onClick={() => updateProjectField("type", "Internal")}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                      currentProject.type === "Internal"
                        ? "bg-background shadow-xs text-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Internal Area</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold transition-colors ${
                        currentProject.type === "Internal"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      {internalSpacesTotal}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProjectField("type", "External")}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                      currentProject.type === "External"
                        ? "bg-background shadow-xs text-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>External Area</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold transition-colors ${
                        currentProject.type === "External"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      {externalSpacesTotal}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddNewSpace();
                  }}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11.5px] font-semibold bg-primary text-primary-foreground hover:bg-primary/95 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <Plus className="size-3.5" /> Add Space
                </button>
              </div>
            </div>

            {/* Table Area (Clean HTML table DOM without non-tr elements inside tbody) */}
            <div className="flex-1 overflow-auto bg-background">
              <table className="w-full table-fixed text-left border-collapse min-w-[1240px]">
                {/* Master Table Header */}
                <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shadow-2xs">
                  <tr className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider h-10 select-none bg-background dark:bg-[#1a1a1a] border-t border-b border-border-strong">
                    <th style={getLpdColStyle("select")} className="px-1 py-0 h-10 text-center border-r border-border/60 relative group select-none">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        title={allSelected ? "Deselect all rows" : "Select all rows"}
                        className="h-full w-full flex items-center justify-center font-mono text-[11px] font-bold text-muted-foreground/80 hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer select-none"
                      >
                        <span className={allSelected ? "text-primary font-bold" : ""}>#</span>
                      </button>
                      <div onMouseDown={(e) => handleResizeMouseDown("select", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("name")} className="px-3 py-2 border-r border-border/60 relative group">
                      SPACE NAME
                      <div onMouseDown={(e) => handleResizeMouseDown("name", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("category")} className="px-3 py-2 border-r border-border/60 relative group">
                      CATEGORY / TYPE OF AREA
                      <div onMouseDown={(e) => handleResizeMouseDown("category", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("lightType")} className="px-3 py-2 border-r border-border/60 relative group">
                      LIGHT TYPE
                      <div onMouseDown={(e) => handleResizeMouseDown("lightType", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("watts")} className="px-2 py-2 text-center border-r border-border/60 relative group">
                      WATTS
                      <div onMouseDown={(e) => handleResizeMouseDown("watts", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("qty")} className="px-2 py-2 text-center border-r border-border/60 relative group">
                      QTY
                      <div onMouseDown={(e) => handleResizeMouseDown("qty", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("totalWatts")} className="px-2 py-2 text-center border-r border-border/60 relative group">
                      TOTAL WATTS
                      <div onMouseDown={(e) => handleResizeMouseDown("totalWatts", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("area")} className="px-2 py-0 text-center border-r border-border/60 relative group font-semibold uppercase tracking-wider text-[11.5px]">
                      <span>AREA ({unitSystem === "si" ? "M²" : "SQ.FT"})</span>
                      <div onMouseDown={(e) => handleResizeMouseDown("area", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("proposedLpd")} className="px-2 py-0 text-center border-r border-border/60 text-primary relative group font-semibold uppercase tracking-wider text-[11.5px]">
                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span>PROPOSED LPD</span>
                        <span className="text-[10px] font-normal text-primary/80">({unitSystem === "si" ? "W/M²" : "W/SQ.FT"})</span>
                      </div>
                      <div onMouseDown={(e) => handleResizeMouseDown("proposedLpd", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("baselineLpd")} className="px-2 py-0 text-center border-r border-border/60 relative group font-semibold uppercase tracking-wider text-[11.5px]">
                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span>BASELINE LPD</span>
                        <span className="text-[10px] font-normal text-muted-foreground/80">({unitSystem === "si" ? "W/M²" : "W/SQ.FT"})</span>
                      </div>
                      <div onMouseDown={(e) => handleResizeMouseDown("baselineLpd", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("remarks")} className="px-3 py-2 border-r border-border/60 relative group">
                      REMARKS
                      <div onMouseDown={(e) => handleResizeMouseDown("remarks", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("addFixture")} className="px-2 py-2 text-center border-r border-border/60 relative group" title="Add Fixture to Space">
                      <div onMouseDown={(e) => handleResizeMouseDown("addFixture", e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle" style={{ transform: "translateX(50%)" }}><div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" /></div>
                    </th>
                    <th style={getLpdColStyle("flag")} className="px-2 py-2 text-center w-9" title="Flag Space">
                      <Flag className="size-3.5 mx-auto text-muted-foreground/60" />
                    </th>
                  </tr>
                </thead>

                <tbody className="text-[13.5px] divide-y divide-border/60">
                  {(() => {
                    let globalSrNo = 1;
                    return filteredGroups.map((group) => {
                    const groupSpaces = group.filteredSpaces || [];
                    const groupSpaceIds = (group.spaces || []).map((s) => s.id);
                    const allGroupSelected =
                      groupSpaceIds.length > 0 && groupSpaceIds.every((id) => selected.has(id));

                    const groupTotalWatts = (group.spaces || []).reduce((sum, s) => {
                      return (
                        sum +
                        (s.fixtures || []).reduce(
                          (fSum, f) => fSum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0),
                          0
                        )
                      );
                    }, 0);

                    const groupTotalArea = (group.spaces || []).reduce(
                      (sum, s) => sum + (parseFloat(s.areaSqM) || 0),
                      0
                    );

                    return (
                      <React.Fragment key={group.id}>
                        {/* Floor Group Header Row */}
                        <tr
                          className="h-[30px] bg-primary/5 hover:bg-primary/10 border-b border-border border-l-4 border-l-primary select-none transition-colors cursor-pointer"
                          onClick={() => toggleSelectGroup(group.id, !allGroupSelected)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSpaceContextMenu(null);
                            setGroupContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              groupId: group.id,
                            });
                          }}
                        >
                          <td colSpan={13} className="p-0 h-[30px]">
                            <div className="flex items-center px-3 h-full">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateGroup(group.id, "isExpanded", !group.isExpanded);
                                }}
                                className="p-0.5 rounded hover:bg-primary/10 transition-colors text-primary/70 hover:text-primary flex items-center justify-center cursor-pointer mr-1.5"
                              >
                                {group.isExpanded ? (
                                  <ChevronDown className="size-3.5" />
                                ) : (
                                  <ChevronRight className="size-3.5" />
                                )}
                              </button>
                              <span className="flex items-center gap-1.5 font-medium">
                                <strong className="font-bold text-primary text-[12.5px] tracking-wide uppercase">
                                  {group.name}
                                </strong>
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  (Right-click or press Delete to remove)
                                </span>
                              </span>

                              <div className="ml-auto flex items-center gap-2">
                                <span className="text-[11px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full border border-border/60">
                                  {group.spaces.length} space{group.spaces.length === 1 ? "" : "s"} ·{" "}
                                  {groupTotalWatts.toLocaleString()} W · {groupTotalArea.toFixed(1)} {unitSystem === "si" ? "m²" : "sq.ft"}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    addSpace(group.id);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:text-primary/80 bg-background/70 hover:bg-background border border-border/60 px-2.5 py-1 rounded-md transition-all cursor-pointer shadow-2xs"
                                >
                                  <Plus className="size-3" /> Space
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (
                                      await confirm(
                                        `Are you sure you want to delete floor "${group.name}" and all its spaces?`,
                                        { title: "Delete Floor Group", danger: true }
                                      )
                                    ) {
                                      removeGroup(group.id);
                                    }
                                  }}
                                  className="p-1 text-muted-foreground/60 hover:text-red-500 rounded transition-colors cursor-pointer"
                                  title="Delete floor group"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Space Rows inside Floor Group */}
                        {group.isExpanded &&
                          groupSpaces.map((space) => {
                            const totalWatts = (space.fixtures || []).reduce((sum, f) => {
                              const w = parseFloat(String(f.watts)) || 0;
                              const q = parseFloat(String(f.qty)) || 0;
                              return sum + w * q;
                            }, 0);
                            const isIp = unitSystem === "ip";
                            const rawArea = parseFloat(String(space.areaSqM)) || 0;
                            const sqM = isIp ? rawArea / 10.76391 : rawArea;
                            const sqF = isIp ? rawArea : rawArea * 10.76391;
                            const primaryArea = isIp ? sqF : sqM;
                            const proposedLpd = primaryArea > 0 ? totalWatts / primaryArea : 0;
                            const baselineLpd = parseFloat(String(space.baselineLpd)) || 0;
                            const isCompliant = primaryArea > 0 && baselineLpd > 0 ? proposedLpd <= baselineLpd : null;
                            const srNo = globalSrNo++;
                            const isSelected = selected.has(space.id);
                            const isHighlighted = highlightedSpaceId === space.id;
                            const isEditing = editingLpdSpace?.space.id === space.id;
                            const isModalOpen = editingLpdSpace !== null;
                            const isCellInteractive = isSelected && !isEffectiveReadOnly;

                            const itemComments = getMergedItemComments(
                              space.id,
                              space.name,
                              space.comments,
                              "/lpd-calculation",
                              project?.id
                            );

                            return (
                              <React.Fragment key={space.id}>
                                {(space.fixtures || []).map((fixture, fIndex) => (
                                  <tr
                                    key={fixture.id}
                                    id={`space-row-${space.id}`}
                                    onClick={(e) => {
                                       const target = e.target as HTMLElement;
                                       if (
                                         target.closest('button[title*="comment"]') ||
                                         target.closest('.mep-comment-badge') ||
                                         target.closest('button')
                                       ) {
                                         return;
                                       }
                                       if (!isSelected) {
                                         toggleSelectRow(space.id);
                                       }
                                     }}
                                    onDoubleClick={(e) => {
                                      const target = e.target as HTMLElement;
                                      if (
                                        target.closest("button") ||
                                        target.closest("a")
                                      ) {
                                        return;
                                      }
                                      handleOpenCalculationPreview(space, group.name);
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setGroupContextMenu(null);
                                      setSpaceContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        spaceId: space.id,
                                        groupId: group.id,
                                      });
                                    }}
                                    className={cn(
                                      "h-[30px] border-b border-border/60 hover:bg-row-hover text-[13.5px] transition-colors group/row select-none",
                                      isEditing
                                        ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                                        : isModalOpen
                                        ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200"
                                        : isSelected
                                        ? "bg-row-selected bg-primary/15"
                                        : space.flagged
                                        ? "bg-red-500/[0.04] dark:bg-red-500/[0.08]"
                                        : "",
                                      isHighlighted &&
                                        "ring-2 ring-primary ring-inset bg-primary/20 animate-pulse duration-700"
                                    )}
                                  >
                                    {/* Space Details (Spans all fixture rows) */}
                                    {fIndex === 0 && (
                                      <>
                                        {/* Row Serial Number (Matching Ventilation DataGrid) */}
                                        <td
                                          style={getLpdColStyle("select")}
                                          className={cn(
                                            "px-1 py-0 h-[30px] text-center border-r border-border/40 relative select-none cursor-pointer transition-colors duration-150",
                                            isSelected
                                              ? "bg-primary/15 text-primary font-bold shadow-inner"
                                              : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                                          )}
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSelectRow(space.id);
                                          }}
                                          title={isSelected ? `Row ${srNo} selected. Click to deselect.` : `Click to select row ${srNo}.`}
                                        >
                                          <RowCommentCornerBadge
                                            count={itemComments.length}
                                            position="left"
                                            onClick={() => handleOpenComment(space.id, space.name)}
                                          />
                                          <span className="text-[11px] font-mono leading-none tracking-tight">
                                            {srNo}
                                          </span>
                                        </td>

                                        {/* Space Name */}
                                        <td
                                          style={getLpdColStyle("name")}
                                          className={cn(
                                            "p-0 border-r border-border/40 relative",
                                            !isSelected && !isEffectiveReadOnly ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                                          )}
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            if (!isSelected) {
                                              e.stopPropagation();
                                              toggleSelectRow(space.id);
                                            }
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title={!isSelected && !isEffectiveReadOnly ? "Click to select row, click again to edit" : undefined}
                                        >
                                          <div className={cn("flex items-center gap-1.5 w-full h-full px-2.5", !isCellInteractive && "pointer-events-none select-none")}>
                                            <input
                                              className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded font-medium text-[13.5px] text-foreground transition-colors cursor-text"
                                              value={space.name}
                                              onChange={(e) =>
                                                updateSpace(group.id, space.id, "name", e.target.value)
                                              }
                                              placeholder="e.g. Electrical Room"
                                            />
                                          </div>
                                        </td>

                                        {/* Category / Type of Area */}
                                        <td
                                          style={getLpdColStyle("category")}
                                          className={cn(
                                            "p-1 border-r border-border/40 relative",
                                            !isSelected && !isEffectiveReadOnly ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                                          )}
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            if (!isSelected) {
                                              e.stopPropagation();
                                              toggleSelectRow(space.id);
                                            }
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title={!isSelected && !isEffectiveReadOnly ? "Click to select row, click again to edit" : undefined}
                                        >
                                          <div className={cn("flex items-center gap-1.5 px-1.5 w-full h-full", !isCellInteractive && "pointer-events-none select-none")}>
                                            <span
                                              className={`size-2 rounded-full shrink-0 ${
                                                space.areaType ? "bg-primary" : "bg-muted-foreground/30"
                                              }`}
                                              title={space.areaType ? "Space category assigned" : "No category selected"}
                                            />
                                            <LpdCategorySelect
                                              value={space.areaType || ""}
                                              authorityMapping={authorityMapping}
                                              unitSystem={unitSystem}
                                              getBaselineLpd={getBaselineLpdForType}
                                              onChange={(val) => updateSpace(group.id, space.id, "areaType", val)}
                                              onAddCustom={() => {
                                                const currentBaseline = parseFloat(space.baselineLpd);
                                                setCustomAreaTarget({
                                                  groupId: group.id,
                                                  spaceId: space.id,
                                                });
                                                setNewAreaName("");
                                                setNewAreaBaselineLpd(
                                                  !isNaN(currentBaseline) && currentBaseline > 0
                                                    ? currentBaseline.toFixed(2)
                                                    : unitSystem === "ip"
                                                    ? "0.60"
                                                    : "6.50"
                                                );
                                                setCustomAreaModalOpen(true);
                                              }}
                                              disabled={isEffectiveReadOnly}
                                            />
                                          </div>
                                        </td>
                                      </>
                                    )}

                                    {/* Fixture Light Type */}
                                    <td
                                      style={getLpdColStyle("lightType")}
                                      className={cn(
                                        "p-0 border-r border-border/40 relative",
                                        !isSelected && !isEffectiveReadOnly ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                                      )}
                                      onClick={(e) => {
                                        if (!isSelected) {
                                          e.stopPropagation();
                                          toggleSelectRow(space.id);
                                        }
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCalculationPreview(space, group.name);
                                      }}
                                      title={!isSelected && !isEffectiveReadOnly ? "Click to select row, click again to edit" : undefined}
                                    >
                                      <div className={cn("flex w-full h-full items-center px-2", !isCellInteractive && "pointer-events-none select-none")}>
                                        {!Object.keys(LIGHT_TYPE_MAPPING).includes(fixture.type) &&
                                        fixture.type !== "" ? (
                                          <div className="flex w-full h-full items-center">
                                            <input
                                              className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded font-medium text-[13.5px] text-foreground transition-colors cursor-text"
                                              value={fixture.type === "custom" ? "" : fixture.type}
                                              onChange={(e) =>
                                                updateFixture(
                                                  group.id,
                                                  space.id,
                                                  fixture.id,
                                                  "type",
                                                  e.target.value || "custom"
                                                )
                                              }
                                              placeholder="Type Light Name..."
                                              autoFocus={fixture.type === "custom"}
                                            />
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateFixture(group.id, space.id, fixture.id, "type", "")
                                              }
                                              className="px-1 text-muted-foreground hover:text-red-500 font-bold transition-colors cursor-pointer"
                                              title="Reset to Dropdown"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ) : (
                                          <select
                                            className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded font-medium text-[13.5px] text-foreground transition-colors cursor-pointer"
                                            value={fixture.type}
                                            onChange={(e) =>
                                              updateFixture(group.id, space.id, fixture.id, "type", e.target.value)
                                            }
                                          >
                                            <option value="">Select Light...</option>
                                            <option value="custom">Other / Custom Input...</option>
                                            {Object.keys(LIGHT_TYPE_MAPPING).map((k) => (
                                              <option key={k} value={k}>
                                                {k} ({LIGHT_TYPE_MAPPING[k]}W)
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                      </div>
                                    </td>

                                    {/* Fixture Watts */}
                                    <td
                                      style={getLpdColStyle("watts")}
                                      className={cn(
                                        "p-0 border-r border-border/40 relative",
                                        !isSelected && !isEffectiveReadOnly ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                                      )}
                                      onClick={(e) => {
                                        if (!isSelected) {
                                          e.stopPropagation();
                                          toggleSelectRow(space.id);
                                        }
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCalculationPreview(space, group.name);
                                      }}
                                      title={!isSelected && !isEffectiveReadOnly ? "Click to select row, click again to edit" : undefined}
                                    >
                                      <div className={cn("w-full h-full flex items-center justify-center", !isCellInteractive && "pointer-events-none select-none")}>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text disabled:opacity-60"
                                          value={fixture.watts}
                                          onChange={(e) =>
                                            updateFixture(group.id, space.id, fixture.id, "watts", e.target.value)
                                          }
                                          placeholder="0"
                                          disabled={Object.keys(LIGHT_TYPE_MAPPING).includes(fixture.type)}
                                        />
                                      </div>
                                    </td>

                                    {/* Fixture Qty */}
                                    <td
                                      style={getLpdColStyle("qty")}
                                      className={cn(
                                        "p-0 border-r border-border/40 relative",
                                        !isSelected && !isEffectiveReadOnly ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                                      )}
                                      onClick={(e) => {
                                        if (!isSelected) {
                                          e.stopPropagation();
                                          toggleSelectRow(space.id);
                                        }
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCalculationPreview(space, group.name);
                                      }}
                                      title={!isSelected && !isEffectiveReadOnly ? "Click to select row, click again to edit" : undefined}
                                    >
                                      <div className={cn("w-full h-full flex items-center justify-center", !isCellInteractive && "pointer-events-none select-none")}>
                                        <input
                                          type="number"
                                          min="1"
                                          className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                                          value={fixture.qty}
                                          onChange={(e) =>
                                            updateFixture(group.id, space.id, fixture.id, "qty", e.target.value)
                                          }
                                          placeholder="1"
                                        />
                                      </div>
                                    </td>

                                    {/* Space Metrics (Spans all fixture rows) */}
                                    {fIndex === 0 && (
                                      <>
                                        {/* Total Watts */}
                                        <td
                                          style={getLpdColStyle("totalWatts")}
                                          className="px-2 py-0 h-[30px] border-r border-border/40 text-center font-mono tabular font-medium text-[13.5px] text-foreground cursor-pointer hover:bg-primary/5 select-none"
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isSelected) {
                                              toggleSelectRow(space.id);
                                            } else {
                                              handleOpenCalculationPreview(space, group.name);
                                            }
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title="Click to select row, or view calculation preview"
                                        >
                                          {totalWatts.toLocaleString()}
                                        </td>

                                        {/* Area */}
                                        <td
                                          style={getLpdColStyle("area")}
                                          className={cn(
                                            "p-0 border-r border-border/40 relative",
                                            !isSelected && !isEffectiveReadOnly ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                                          )}
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            if (!isSelected) {
                                              e.stopPropagation();
                                              toggleSelectRow(space.id);
                                            }
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title={!isSelected && !isEffectiveReadOnly ? "Click to select row, click again to edit" : undefined}
                                        >
                                          <div className={cn("w-full h-full flex items-center justify-center", !isCellInteractive && "pointer-events-none select-none")}>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.1"
                                              className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                                              value={space.areaSqM}
                                              onChange={(e) =>
                                                updateSpace(group.id, space.id, "areaSqM", e.target.value)
                                              }
                                              placeholder="0.0"
                                            />
                                          </div>
                                        </td>

                                        {/* Proposed LPD (W/m² or W/sq.ft) */}
                                        <td
                                          style={getLpdColStyle("proposedLpd")}
                                          className="px-2 py-0 h-[30px] border-r border-border/40 text-center font-mono tabular text-[13.5px] cursor-pointer select-none group/lpd hover:bg-primary/5"
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isSelected) {
                                              toggleSelectRow(space.id);
                                            } else {
                                              handleOpenCalculationPreview(space, group.name);
                                            }
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title="Click or double-click to view step-by-step calculation preview & formula breakdown"
                                        >
                                          {primaryArea > 0 ? (
                                            <span
                                              className={cn(
                                                "inline-flex items-center gap-1 justify-center px-2 py-0.5 rounded-full text-[11.5px] font-mono font-bold border transition-all hover:scale-105 shadow-2xs",
                                                isCompliant
                                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                  : "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse"
                                              )}
                                            >
                                              <span>{proposedLpd.toFixed(3)}</span>
                                              <Calculator className="size-3 opacity-60 hover:opacity-100" />
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 font-mono text-muted-foreground text-[11.5px] hover:text-foreground">
                                              <span>0.000</span>
                                              <Calculator className="size-3 opacity-40 hover:opacity-100" />
                                            </span>
                                          )}
                                        </td>

                                        {/* Baseline LPD (W/m² or W/sq.ft) */}
                                        <td
                                          style={getLpdColStyle("baselineLpd")}
                                          className={cn(
                                            "p-0 border-r border-border/40 relative",
                                            !isSelected && !isEffectiveReadOnly ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                                          )}
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            if (!isSelected) {
                                              e.stopPropagation();
                                              toggleSelectRow(space.id);
                                            }
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title={!isSelected && !isEffectiveReadOnly ? "Click to select row, click again to edit" : undefined}
                                        >
                                          <div className={cn("w-full h-full flex items-center justify-center", !isCellInteractive && "pointer-events-none select-none")}>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-center font-mono tabular text-[13.5px] text-foreground transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                                              value={space.baselineLpd}
                                              onChange={(e) =>
                                                updateSpace(group.id, space.id, "baselineLpd", e.target.value)
                                              }
                                              placeholder={unitSystem === "ip" ? "0.65" : "7.00"}
                                            />
                                          </div>
                                        </td>

                                        {/* Remarks */}
                                        <td
                                          style={getLpdColStyle("remarks")}
                                          className={cn(
                                            "p-0 border-r border-border/40 relative",
                                            !isSelected && !isEffectiveReadOnly ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                                          )}
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            if (!isSelected) {
                                              e.stopPropagation();
                                              toggleSelectRow(space.id);
                                            }
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title={!isSelected && !isEffectiveReadOnly ? "Click to select row, click again to edit" : undefined}
                                        >
                                          <div className={cn("w-full h-full flex items-center px-2", !isCellInteractive && "pointer-events-none select-none")}>
                                            <input
                                              type="text"
                                              className="w-full bg-transparent border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-left text-[13.5px] text-foreground transition-colors cursor-text"
                                              value={space.remarks || ""}
                                              onChange={(e) =>
                                                updateSpace(group.id, space.id, "remarks", e.target.value)
                                              }
                                              placeholder="Notes..."
                                            />
                                          </div>
                                        </td>

                                        {/* Add Fixture */}
                                        <td
                                          style={getLpdColStyle("addFixture")}
                                          className="px-1 py-0 h-[30px] text-center border-r border-border/40"
                                          rowSpan={space.fixtures.length}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              addFixture(group.id, space.id);
                                            }}
                                            className="p-1 hover:bg-surface-2 rounded text-muted-foreground hover:text-primary transition-colors cursor-pointer mx-auto flex items-center justify-center"
                                            title="Add another fixture to space"
                                          >
                                            <Plus className="size-3.5" />
                                          </button>
                                        </td>

                                        {/* Flag Button Column (Matching Ventilation flag logic) */}
                                        <td
                                          style={getLpdColStyle("flag")}
                                          className="px-2 py-0 h-[30px] text-center"
                                          rowSpan={space.fixtures.length}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFlag(group.id, space.id);
                                            }}
                                            className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
                                            title={space.flagged ? "Unflag space" : "Flag space"}
                                          >
                                            <Flag
                                              className={cn(
                                                "size-3.5 transition-all duration-200",
                                                space.flagged
                                                  ? "fill-red-500 text-red-500 scale-110 drop-shadow-xs"
                                                  : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
                                              )}
                                            />
                                          </button>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}

                      </React.Fragment>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary Bar */}
            <div className="flex items-center justify-between px-4 h-8 border-t border-border bg-header-bg/80 text-[11.5px] text-muted-foreground shrink-0 select-none no-print modal-blur-bg">
              <div>
                Showing <span className="text-foreground font-semibold tabular">{allFilteredSpaces.length}</span> spaces
                across {filteredGroups.length} floor(s)
              </div>
              <div className="flex items-center gap-4 tabular">
                <span>
                  Σ Total Watts:{" "}
                  <strong className="font-mono text-foreground font-bold">
                    {totalFilteredWatts.toLocaleString()} W ({(totalFilteredWatts / 1000).toFixed(2)} kW)
                  </strong>
                </span>
                <span>
                  Σ Lit Area:{" "}
                  <strong className="font-mono text-foreground font-bold">
                    {totalFilteredArea.toFixed(1)} {unitSystem === "si" ? "m²" : "sq.ft"}
                  </strong>
                </span>
                <span>
                  Average Proposed LPD:{" "}
                  <strong
                    className={cn(
                      "font-mono font-bold",
                      avgOverallProposedLpd > 0 ? "text-primary" : "text-foreground"
                    )}
                  >
                    {avgOverallProposedLpd.toFixed(3)} {unitSystem === "si" ? "W/m²" : "W/sq.ft"}
                  </strong>
                </span>
                <span>
                  Compliance:{" "}
                  <strong
                    className={cn(
                      "font-mono font-bold",
                      overallComplianceRate >= 100
                        ? "text-emerald-600 dark:text-emerald-400"
                        : overallComplianceRate >= 80
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {overallComplianceRate}%
                  </strong>
                </span>
              </div>
            </div>
              </>
            ) : (
              <LpdReportView
                project={currentProject}
                unitSystem={unitSystem}
                calcReviewState={calcReviewState}
                currentUserName={currentUserName}
                authorityMapping={authorityMapping}
                onExportPdf={handleExport}
              />
            )}
          </div>
        </div>

        {/* Intelligence Side Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-2 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg"
              : "w-0"
          }`}
        >
          {intelOpen && (
            <LpdIntelligenceDrawer
              groups={activeGroups}
              unitSystem={unitSystem}
              authorityMapping={authorityMapping}
              onClose={() => setIntelOpen(false)}
              onScrollToSpace={handleScrollToSpace}
              onAutoFlagNonCompliant={handleAutoFlagNonCompliant}
              onClearAllFlags={handleClearAllFlags}
              onAutoFillBaselines={handleAutoFillBaselines}
              onOpenPreview={(space, groupName) => handleOpenCalculationPreview(space, groupName)}
            />
          )}
        </div>
      </div>

      {/* Floating Space Context Menu */}
      {spaceContextMenu && activeContextSpace && (
        <div
          className="fixed z-50 w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground select-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${Math.min(spaceContextMenu.y, window.innerHeight - 340)}px`,
            left: `${Math.min(spaceContextMenu.x, window.innerWidth - 260)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Add Comment - AT THE TOP with blue ventilation styling */}
          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium transition-colors"
            onClick={() => {
              handleOpenComment(activeContextSpace.id, activeContextSpace.name);
              setSpaceContextMenu(null);
            }}
          >
            <MessageSquare className="size-3.5" />
            <span>Add Comment</span>
          </button>

          {/* Calculation Preview */}
          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
            onClick={() => {
              const gName = activeGroups.find((g) => g.id === spaceContextMenu.groupId)?.name;
              handleOpenCalculationPreview(activeContextSpace, gName);
              setSpaceContextMenu(null);
            }}
          >
            <Sparkles className="size-3.5 text-muted-foreground" />
            <span>Calculation Preview</span>
            <span className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</span>
          </button>

          {/* Flag Space */}
          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
            onClick={() => {
              toggleFlag(spaceContextMenu.groupId, activeContextSpace.id);
              setSpaceContextMenu(null);
            }}
          >
            <Flag
              className={cn(
                "size-3.5",
                activeContextSpace.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"
              )}
            />
            <span>{activeContextSpace.flagged ? "Unflag Space" : "Flag Space"}</span>
          </button>

          {/* Add Light Fixture */}
          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
            onClick={() => {
              addFixture(spaceContextMenu.groupId, activeContextSpace.id);
              setSpaceContextMenu(null);
            }}
          >
            <Plus className="size-3.5 text-muted-foreground" />
            <span>Add Light Fixture</span>
          </button>

          {activeContextSpace.fixtures.length > 1 && (
            <button
              type="button"
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
              onClick={() => {
                const gid = spaceContextMenu.groupId;
                const sid = activeContextSpace.id;
                const lastFid = activeContextSpace.fixtures[activeContextSpace.fixtures.length - 1]?.id;
                if (lastFid) {
                  removeFixture(gid, sid, lastFid);
                }
                setSpaceContextMenu(null);
              }}
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
              <span>Remove Extra Fixture</span>
            </button>
          )}

          {/* Add Custom Area Type... */}
          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
            onClick={() => {
              const gid = spaceContextMenu.groupId;
              const sid = activeContextSpace.id;
              setSpaceContextMenu(null);
              const currentBaseline = parseFloat(activeContextSpace.baselineLpd);
              setCustomAreaTarget({ groupId: gid, spaceId: sid });
              setNewAreaName("");
              setNewAreaBaselineLpd(
                !isNaN(currentBaseline) && currentBaseline > 0
                  ? currentBaseline.toFixed(2)
                  : unitSystem === "ip"
                  ? "0.60"
                  : "6.50"
              );
              setCustomAreaModalOpen(true);
            }}
          >
            <Plus className="size-3.5 text-muted-foreground" />
            <span>Add Custom Area Type...</span>
          </button>

          <div className="h-px bg-border my-1" />

          {/* Duplicate Space */}
          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
            onClick={() => {
              duplicateSpace(spaceContextMenu.groupId, activeContextSpace.id);
              setSpaceContextMenu(null);
            }}
          >
            <CopyPlus className="size-3.5 text-muted-foreground" />
            <span>Duplicate Space</span>
            <span className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</span>
          </button>

          {selected.size > 1 && selected.has(activeContextSpace.id) && (
            <>
              <button
                type="button"
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
                onClick={() => {
                  duplicateSelectedSpaces();
                  setSpaceContextMenu(null);
                }}
              >
                <Copy className="size-3.5 text-muted-foreground" />
                <span>Duplicate Selected ({selected.size})</span>
              </button>
              <button
                type="button"
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
                onClick={() => {
                  toggleFlagSelected();
                  setSpaceContextMenu(null);
                }}
              >
                <Flag className="size-3.5 text-red-500" />
                <span>Toggle Flag Selected ({selected.size})</span>
              </button>
            </>
          )}

          <div className="h-px bg-border my-1" />

          {/* Delete Space */}
          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium transition-colors"
            onClick={async () => {
              const sid = activeContextSpace.id;
              const gid = spaceContextMenu.groupId;
              setSpaceContextMenu(null);
              if (selected.size > 1 && selected.has(sid)) {
                deleteSelectedSpaces();
              } else {
                removeSpace(gid, sid);
              }
            }}
          >
            <Trash2 className="size-3.5" />
            <span>
              {selected.size > 1 && selected.has(activeContextSpace.id)
                ? `Delete Selected (${selected.size})`
                : "Delete Space"}
            </span>
            <span className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</span>
          </button>
        </div>
      )}

      {/* Floating Floor Group Context Menu */}
      {groupContextMenu && activeContextGroup && (
        <div
          className="fixed z-50 w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground select-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${Math.min(groupContextMenu.y, window.innerHeight - 200)}px`,
            left: `${Math.min(groupContextMenu.x, window.innerWidth - 240)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
            onClick={async () => {
              const gid = activeContextGroup.id;
              setGroupContextMenu(null);
              const newName = await prompt("Enter new floor/group name:", activeContextGroup.name, {
                title: "Rename Floor",
              });
              if (newName && newName.trim() !== "") {
                updateGroup(gid, "name", newName.trim().toUpperCase());
              }
            }}
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Rename Floor</span>
          </button>

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
            onClick={() => {
              const gid = activeContextGroup.id;
              setGroupContextMenu(null);
              addSpace(gid);
            }}
          >
            <Plus className="size-3.5 text-muted-foreground" />
            <span>Add Space to Floor</span>
          </button>

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium transition-colors"
            onClick={() => {
              const gid = activeContextGroup.id;
              setGroupContextMenu(null);
              duplicateGroup(gid);
            }}
          >
            <CopyPlus className="size-3.5 text-muted-foreground" />
            <span>Duplicate Floor</span>
          </button>

          <div className="h-px bg-border my-1" />

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium transition-colors"
            onClick={async () => {
              const gid = activeContextGroup.id;
              const gName = activeContextGroup.name;
              const count = activeContextGroup.spaces.length;
              setGroupContextMenu(null);
              if (
                await confirm(`Are you sure you want to delete floor "${gName}" with ${count} spaces?`, {
                  title: "Delete Floor",
                  danger: true,
                })
              ) {
                removeGroup(gid);
              }
            }}
          >
            <Trash2 className="size-3.5" />
            <span>Delete Floor</span>
            <span className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</span>
          </button>
        </div>
      )}

      {/* Assign Comment Modal */}
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
          calculatorTitle="LPD Calculation"
          calculatorPath="/lpd-calculation"
          existingComments={getMergedItemComments(
            commentTargetItem.id,
            commentTargetItem.name,
            [],
            "/lpd-calculation",
            project?.id
          )}
          onSave={handleSaveComment}
        />
      )}
      {/* Step-by-Step Calculation Preview Modal */}
      <CalculationPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        data={previewData}
      />

      {/* Edit LPD Space Modal (Exact Ventilation style with calculations preview) */}
      {editingLpdSpace && (
        <EditLpdSpaceModal
          space={editingLpdSpace.space}
          groupId={editingLpdSpace.groupId}
          groupName={editingLpdSpace.groupName}
          isNew={editingLpdSpace.isNew}
          unitSystem={unitSystem}
          availableGroups={(isInt ? currentProject.internalGroups : currentProject.externalGroups).map((g) => ({
            id: g.id,
            name: g.name,
          }))}
          onClose={() => {
            if (editingLpdSpace.isNew) {
              updateActiveGroups((groups) =>
                groups.map((g) => ({
                  ...g,
                  spaces: (g.spaces || []).filter((s) => s.id !== editingLpdSpace.space.id),
                }))
              );
            }
            setEditingLpdSpace(null);
          }}
          onSave={(updated, targetGId) => {
            updateActiveGroups((groups) => {
              const targetGroup = groups.find(
                (g) => g.id === targetGId || g.name.trim().toUpperCase() === targetGId.trim().toUpperCase()
              );
              if (targetGroup) {
                return groups.map((g) => {
                  if (g.id === targetGroup.id) {
                    const exists = (g.spaces || []).some((s) => s.id === updated.id);
                    return {
                      ...g,
                      spaces: exists
                        ? (g.spaces || []).map((s) => (s.id === updated.id ? updated : s))
                        : [...(g.spaces || []), updated],
                    };
                  } else {
                    return {
                      ...g,
                      spaces: (g.spaces || []).filter((s) => s.id !== updated.id),
                    };
                  }
                });
              } else {
                const newGrp = defaultGroup(targetGId);
                newGrp.isExpanded = true;
                newGrp.spaces = [updated];
                const cleaned = groups.map((g) => ({
                  ...g,
                  spaces: (g.spaces || []).filter((s) => s.id !== updated.id),
                }));
                return [...cleaned, newGrp];
              }
            });
            toast.success(`Updated space "${updated.name}"`);
            setEditingLpdSpace(null);
          }}
        />
      )}

      {/* Import Source Selection Modal */}
      <ImportSourceModal
        isOpen={sourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        title="Import Space Schedule"
        subtitle="Select data source to generate schedule"
        excelTitle="Import from Excel (.xlsx)"
        excelSubtitle="Upload schedule or spreadsheet formatted with Level, Floor, Space Name & Area."
        viewerTitle="Import from 3D Studio"
        viewerSubtitle="Extract spatial geometry, room names, levels, and floor areas directly from active 3D model."
        viewerBadge="3D Studio"
        ventilationTitle="Import from Ventilation"
        ventilationSubtitle={
          ventSpacesCount > 0
            ? `Import ${ventSpacesCount} space(s) directly from the active Ventilation schedule.`
            : "Import all room names, floor levels, and areas directly from the active Ventilation schedule."
        }
        ventilationBadge="Ventilation"
        preliminaryTitle="Import from Preliminary Cooling Load"
        preliminarySubtitle={
          pclSpacesCount > 0
            ? `Import ${pclSpacesCount} space(s) from Preliminary Cooling Load calculation.`
            : "Import room names, floor levels, areas, and space categories from Preliminary Cooling Load calculation."
        }
        preliminaryBadge="Cooling Load"
        onSelectBenchmark={handleLoadBenchmarkSpaces}
        benchmarkTitle="Load 10 Benchmark Spaces"
        benchmarkSubtitle="Populate calculation with standard reference architectural spaces for quick verification."
        benchmarkBadge="Benchmarks"
        onSelectExcel={() => {
          if (excelInputRef.current) {
            excelInputRef.current.value = "";
            excelInputRef.current.click();
          }
        }}
        onSelect3DViewer={handleSyncFrom3DStudio}
        onSelectVentilation={handleImportFromVentilation}
        onSelectPreliminary={handleImportFromPreliminary}
        footerNote="Automatic ASHRAE 90.1 lighting power densities & space classifications applied"
      />
      <input
        type="file"
        ref={excelInputRef}
        onChange={handleExcelFileInputChange}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* Add New Space Modal Popup */}
      {showAddSpaceModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddSpaceModal(false);
          }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-surface-1 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Plus className="size-4" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-foreground leading-tight">Add New Space</h2>
                  <p className="text-[11.5px] text-muted-foreground">
                    Create a new space and specify lighting baseline requirements
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSpaceModal(false)}
                className="p-1.5 hover:bg-surface-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAddSpaceSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {/* Floor / Level Selection */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Floor Level <span className="text-red-500">*</span>
                  </label>
                  <FloorSelect
                    value={newSpaceFloor}
                    onChange={setNewSpaceFloor}
                    availableFloors={activeGroups.map((g) => g.name)}
                  />
                </div>

                {/* Space Name */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Space Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    placeholder="e.g. Meeting Room 1"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-[12.5px] font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Area Type / ASHRAE Occupancy */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Area Classification / ASHRAE Space Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newSpaceAreaType}
                  onChange={(e) => {
                    const sel = e.target.value;
                    setNewSpaceAreaType(sel);
                    const base = LPD_AUTHORITY_MAPPING[sel] || 0.62;
                    setNewSpaceBaselineLpd(unitSystem === "ip" ? base : Number((base * 10.7639).toFixed(2)));
                  }}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-[12.5px] font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                >
                  {Object.keys(LPD_AUTHORITY_MAPPING).map((typeKey) => (
                    <option key={typeKey} value={typeKey}>
                      {typeKey} (Base: {unitSystem === "ip" ? `${LPD_AUTHORITY_MAPPING[typeKey]} W/ft²` : `${(LPD_AUTHORITY_MAPPING[typeKey] * 10.7639).toFixed(2)} W/m²`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Area & Baseline LPD */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Floor Area ({unitSystem === "ip" ? "sq.ft" : "m²"}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    step="0.1"
                    min="0.1"
                    value={newSpaceArea}
                    onChange={(e) => setNewSpaceArea(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="100"
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-[12.5px] font-mono text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Baseline LPD ({unitSystem === "ip" ? "W/sq.ft" : "W/m²"}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={newSpaceBaselineLpd}
                    onChange={(e) => setNewSpaceBaselineLpd(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={unitSystem === "ip" ? "0.60" : "6.50"}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-[12.5px] font-mono text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Initial Fixture */}
              <div className="p-3.5 bg-surface-2/60 border border-border/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-foreground">Initial Lighting Fixture</span>
                  <span className="text-[10.5px] text-muted-foreground">Can add more fixtures later</span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Fixture Type</label>
                    <input
                      type="text"
                      list="fixture-type-suggestions"
                      value={newSpaceFixtureType}
                      onChange={(e) => setNewSpaceFixtureType(e.target.value)}
                      placeholder="e.g. 2x2 LED Troffer 36W"
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    />
                    <datalist id="fixture-type-suggestions">
                      {Object.keys(LIGHT_TYPE_MAPPING).map((k) => (
                        <option key={k} value={k} />
                      ))}
                    </datalist>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Watts / Fixture</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={newSpaceFixtureWatts}
                      onChange={(e) => setNewSpaceFixtureWatts(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="36"
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Qty</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={newSpaceFixtureQty}
                      onChange={(e) => setNewSpaceFixtureQty(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="4"
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Remarks / Notes</label>
                <input
                  type="text"
                  value={newSpaceRemarks}
                  onChange={(e) => setNewSpaceRemarks(e.target.value)}
                  placeholder="Optional architectural notes or control requirements"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-[12.5px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowAddSpaceModal(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all shadow-sm cursor-pointer"
                >
                  Add Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Area Type Modal */}
      {customAreaModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCustomAreaModalOpen(false);
              setCustomAreaTarget(null);
            }
          }}
        >
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-surface-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Plus className="size-4" />
                </div>
                <div>
                  <h2 className="text-[14.5px] font-bold text-foreground leading-tight">Add Custom Area Type</h2>
                  <p className="text-[11.5px] text-muted-foreground">
                    Define a custom space classification & baseline LPD limit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomAreaModalOpen(false);
                  setCustomAreaTarget(null);
                }}
                className="p-1.5 hover:bg-surface-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveCustomArea} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Area Type Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="e.g. Server Room, Prayer Room, Coffee Bar, Pantry"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Baseline LPD ({unitSystem === "ip" ? "W/sq.ft" : "W/m²"})
                  </label>
                  <span className="text-[10.5px] text-muted-foreground">
                    {unitSystem === "ip" ? "IP Unit" : "SI Unit"}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newAreaBaselineLpd}
                  onChange={(e) => setNewAreaBaselineLpd(e.target.value)}
                  placeholder={unitSystem === "ip" ? "0.60" : "6.50"}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[13px] font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Standard baseline allowance. Can also be fine-tuned per space in the table.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => {
                    setCustomAreaModalOpen(false);
                    setCustomAreaTarget(null);
                  }}
                  className="px-4 py-2 border border-border bg-background hover:bg-surface-2 rounded-xl text-xs font-medium text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Plus className="size-3.5" />
                  <span>Add Area Type</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Formula Breakdown Modal */}
      {showFormulaModal && (
        <LpdFormulaBreakdownModal
          onClose={() => setShowFormulaModal(false)}
          unitSystem={unitSystem}
          project={currentProject}
          overallComplianceRate={overallComplianceRate}
        />
      )}
    </AppShell>
  );
}


function LpdReportView({
  project,
  unitSystem,
  calcReviewState,
  currentUserName,
  authorityMapping,
}: {
  project: LpdProject;
  unitSystem: "si" | "ip";
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  authorityMapping?: Record<string, number>;
  onExportPdf?: () => void;
}) {
  const isIp = unitSystem === "ip";
  const areaUnit = isIp ? "sq.ft" : "m²";
  const lpdUnit = isIp ? "W/sq.ft" : "W/m²";

  const activeProj: any = workspaceStore.getState()?.project || {};
  const sigDetails = getSignatureBlockDetails(activeProj?.id || "default", "/lpd-calculation", currentUserName, calcReviewState);

  const calcNo = project.calculationNo || activeProj?.calcNo || "TRV-CAL-LPD-01";
  const today = formatDateStr(new Date().toISOString());
  const projectNo = project.projectNo || activeProj?.code || activeProj?.projectNo || "P001";
  const projectName = project.name || activeProj?.name || activeProj?.projectName || "Lighting Power Density";
  const clientName = project.client || activeProj?.client || "-";
  const endUser = project.endUser || activeProj?.endUser || activeProj?.location || "-";

  // Gather spaces
  const activeGroups = project.type === "External" ? project.externalGroups : project.internalGroups;
  const groups = activeGroups || [];

  let grandArea = 0;
  let grandWatts = 0;
  let grandTargetWatts = 0;
  let totalSpacesCount = 0;
  let compliantSpacesCount = 0;

  const processedGroups = groups.map((group) => {
    let floorArea = 0;
    let floorWatts = 0;
    let floorTargetWatts = 0;
    let floorCompliantCount = 0;

    const spaces = (group.spaces || []).map((s) => {
      const rawArea = parseFloat(String(s.areaSqM)) || 0;
      const sqM = isIp ? rawArea / 10.76391 : rawArea;
      const sqF = isIp ? rawArea : rawArea * 10.76391;
      const spaceArea = isIp ? sqF : sqM;

      const spaceWatts = (s.fixtures || []).reduce((sum, f) => {
        const w = parseFloat(String(f.watts)) || 0;
        const q = parseFloat(String(f.qty)) || 0;
        return sum + w * q;
      }, 0);

      const baselineRaw = parseFloat(String(s.baselineLpd)) || 0;
      const mappedBaseline = (s.areaType && authorityMapping && authorityMapping[s.areaType]) ? authorityMapping[s.areaType] : 0;
      const targetLpd = baselineRaw > 0 ? baselineRaw : (mappedBaseline > 0 ? mappedBaseline : (isIp ? 0.65 : 7.00));
      const actualLpd = spaceArea > 0 ? spaceWatts / spaceArea : 0;
      const margin = targetLpd - actualLpd;
      const isCompliant = spaceArea > 0 && targetLpd > 0 ? actualLpd <= targetLpd : false;

      floorArea += spaceArea;
      floorWatts += spaceWatts;
      floorTargetWatts += spaceArea * targetLpd;
      if (isCompliant) floorCompliantCount++;

      grandArea += spaceArea;
      grandWatts += spaceWatts;
      grandTargetWatts += spaceArea * targetLpd;
      totalSpacesCount++;
      if (isCompliant) compliantSpacesCount++;

      return {
        ...s,
        computedArea: spaceArea,
        computedWatts: spaceWatts,
        computedTargetLpd: targetLpd,
        computedActualLpd: actualLpd,
        computedMargin: margin,
        computedIsCompliant: isCompliant,
      };
    });

    const floorActualLpd = floorArea > 0 ? floorWatts / floorArea : 0;
    const floorTargetLpd = floorArea > 0 ? floorTargetWatts / floorArea : 0;

    return {
      ...group,
      processedSpaces: spaces,
      floorArea,
      floorWatts,
      floorActualLpd,
      floorTargetLpd,
      floorCompliantCount,
    };
  });

  const overallActualLpd = grandArea > 0 ? grandWatts / grandArea : 0;
  const overallTargetLpd = grandArea > 0 ? grandTargetWatts / grandArea : 0;
  const energySavingPct = grandTargetWatts > 0 ? ((grandTargetWatts - grandWatts) / grandTargetWatts) * 100 : 0;

  let globalSrNo = 1;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
      <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
        
        {/* 1. Title (Exact Preliminary format) */}
        <div className="pb-1">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Lighting Power Density (LPD) Calculation
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Energy Conservation & Connected Lighting Power Density Compliance (ASHRAE 90.1 / ECBC / IECC)
          </p>
        </div>

        {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
        <div className="border border-border rounded-xl overflow-hidden text-xs">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-border divide-x divide-border">
                <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                <td className="p-2.5 font-mono text-foreground font-medium">{calcNo}</td>
                <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                <td className="p-2.5 font-mono font-medium">{today}</td>
              </tr>
              <tr className="border-b border-border divide-x divide-border">
                <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                <td className="p-2.5 font-mono">{projectNo}</td>
                <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                <td className="p-2.5">{clientName}</td>
              </tr>
              <tr className="divide-x divide-border">
                <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                <td className="p-2.5">{projectName}</td>
                <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                <td className="p-2.5">{endUser}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. LPD Schedule Table (2-Tier Header Table with #E5E7EB header) */}
        <div className="border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                <th rowSpan={2} className="p-2 border-r border-border w-12 text-center">
                  Sr.<br />No.
                </th>
                <th colSpan={3} className="p-2 border-r border-border text-center">
                  Space Classification & Area
                </th>
                <th colSpan={3} className="p-2 border-r border-border text-center">
                  Lighting Power Density Metrics
                </th>
                <th colSpan={2} className="p-2 text-center">
                  Energy Code Compliance
                </th>
              </tr>
              <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                <th className="p-2 border-r border-border text-left min-w-[140px]">Floor / Space Name</th>
                <th className="p-2 border-r border-border text-left min-w-[120px]">Space Type Code</th>
                <th className="p-2 border-r border-border w-24 text-center">Area ({areaUnit})</th>
                <th className="p-2 border-r border-border w-28 text-center">Target LPD ({lpdUnit})</th>
                <th className="p-2 border-r border-border w-28 text-center">Installed (Watts)</th>
                <th className="p-2 border-r border-border w-28 text-center">Actual LPD ({lpdUnit})</th>
                <th className="p-2 border-r border-border w-24 text-center">Margin ({lpdUnit})</th>
                <th className="p-2 w-24 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {processedGroups.map((group) => {
                const spaces = group.processedSpaces || [];

                return (
                  <React.Fragment key={group.id}>
                    {/* Floor Header Row */}
                    <tr className="bg-slate-100/70 dark:bg-zinc-800/60 font-bold border-t border-b border-border">
                      <td colSpan={9} className="p-2 text-foreground font-bold">
                        Floor Level: {group.name} ({spaces.length} space{spaces.length === 1 ? "" : "s"})
                      </td>
                    </tr>

                    {spaces.map((s) => {
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">
                            {globalSrNo++}
                          </td>
                          <td className="p-2 border-r border-border font-sans font-bold text-foreground">
                            {s.name || "-"}
                          </td>
                          <td className="p-2 border-r border-border text-muted-foreground">
                            {s.areaType || "-"}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono">
                            {s.computedArea.toFixed(1)}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono text-muted-foreground">
                            {s.computedTargetLpd.toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono font-semibold">
                            {s.computedWatts.toLocaleString()} W
                          </td>
                          <td className="p-2 border-r border-border text-center font-mono font-bold text-primary">
                            {s.computedActualLpd.toFixed(2)}
                          </td>
                          <td className={`p-2 border-r border-border text-center font-mono font-semibold ${s.computedMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {s.computedMargin >= 0 ? `+${s.computedMargin.toFixed(2)}` : s.computedMargin.toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.computedIsCompliant ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                              {s.computedIsCompliant ? "PASS" : "FAIL"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Floor Subtotal Row */}
                    <tr className="bg-slate-50 dark:bg-zinc-900/60 font-semibold border-b border-border text-xs">
                      <td className="p-2 border-r border-border text-center font-sans font-bold">Subtotal</td>
                      <td colSpan={2} className="p-2 border-r border-border font-bold text-foreground">{group.name} Subtotal</td>
                      <td className="p-2 border-r border-border text-center font-mono font-bold">{group.floorArea.toFixed(1)}</td>
                      <td className="p-2 border-r border-border text-center font-mono">-</td>
                      <td className="p-2 border-r border-border text-center font-mono font-bold">{group.floorWatts.toLocaleString()} W</td>
                      <td className="p-2 border-r border-border text-center font-mono font-bold text-primary">{group.floorActualLpd.toFixed(2)}</td>
                      <td className="p-2 border-r border-border text-center font-mono">-</td>
                      <td className="p-2 text-center">-</td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Grand Total Row */}
              <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold border-t-2 border-border text-foreground">
                <td className="p-2 border-r border-border text-center font-sans">TOTAL</td>
                <td colSpan={2} className="p-2 border-r border-border font-sans font-bold">ALL FLOORS ({totalSpacesCount} Spaces)</td>
                <td className="p-2 border-r border-border text-center font-mono font-bold">{grandArea.toFixed(1)}</td>
                <td className="p-2 border-r border-border text-center font-mono font-bold">{overallTargetLpd.toFixed(2)}</td>
                <td className="p-2 border-r border-border text-center font-mono font-bold text-primary">{grandWatts.toLocaleString()} W</td>
                <td className="p-2 border-r border-border text-center font-mono font-bold text-primary text-xs">{overallActualLpd.toFixed(2)}</td>
                <td className="p-2 border-r border-border text-center font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  {(overallTargetLpd - overallActualLpd >= 0 ? `+${(overallTargetLpd - overallActualLpd).toFixed(2)}` : (overallTargetLpd - overallActualLpd).toFixed(2))}
                </td>
                <td className="p-2 text-center font-bold text-emerald-700 dark:text-emerald-300">
                  {compliantSpacesCount === totalSpacesCount ? "PASS" : `${compliantSpacesCount}/${totalSpacesCount}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. Executive Summary Highlights */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Executive Energy Code Summary
          </h3>
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                  <th className="p-2 w-12 text-center border-r border-border">Sr.</th>
                  <th className="p-2 text-left border-r border-border min-w-[200px]">Energy Metric Parameter</th>
                  <th className="p-2 text-left border-r border-border w-40">Code Basis</th>
                  <th className="p-2 text-center border-r border-border w-44">Calculated Value</th>
                  <th className="p-2 text-center border-r border-border w-20">Unit</th>
                  <th className="p-2 text-left min-w-[200px]">Compliance Evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">1</td>
                  <td className="p-2 font-medium border-r border-border">Total Illuminated Floor Area</td>
                  <td className="p-2 text-muted-foreground border-r border-border">Gross Building Area</td>
                  <td className="p-2 text-center font-mono font-bold border-r border-border">{grandArea.toFixed(1)}</td>
                  <td className="p-2 text-center text-muted-foreground border-r border-border">{areaUnit}</td>
                  <td className="p-2 text-muted-foreground text-[11px]">Sum of all scheduled functional rooms and areas</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">2</td>
                  <td className="p-2 font-bold text-foreground border-r border-border">TOTAL CONNECTED LIGHTING POWER</td>
                  <td className="p-2 text-muted-foreground border-r border-border">Sum(Qty × Wattage)</td>
                  <td className="p-2 text-center font-mono text-primary text-xs font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                    {(grandWatts / 1000).toFixed(3)} kW
                  </td>
                  <td className="p-2 text-center font-mono border-r border-border">kW</td>
                  <td className="p-2 text-muted-foreground text-[11px]">Equivalent to {grandWatts.toLocaleString()} Watts total load</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">3</td>
                  <td className="p-2 font-bold text-foreground border-r border-border">ACTUAL WEIGHTED AVERAGE LPD</td>
                  <td className="p-2 text-muted-foreground border-r border-border">Total W ÷ Total Area</td>
                  <td className="p-2 text-center font-mono text-emerald-700 dark:text-emerald-300 text-xs font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                    {overallActualLpd.toFixed(2)}
                  </td>
                  <td className="p-2 text-center font-mono border-r border-border">{lpdUnit}</td>
                  <td className="p-2 text-muted-foreground text-[11px]">Allowable code maximum: {overallTargetLpd.toFixed(2)} {lpdUnit}</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2 text-center font-mono text-muted-foreground border-r border-border">4</td>
                  <td className="p-2 font-medium border-r border-border">Overall Energy Savings Margin</td>
                  <td className="p-2 text-muted-foreground border-r border-border">Target vs Installed</td>
                  <td className="p-2 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 border-r border-border">
                    {energySavingPct.toFixed(1)}%
                  </td>
                  <td className="p-2 text-center text-muted-foreground border-r border-border">%</td>
                  <td className="p-2 text-muted-foreground text-[11px]">{energySavingPct >= 0 ? "Exceeds standard energy conservation threshold" : "Exceeds allowable energy budget"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. 3-Tier Signature Sign-Off Block (Exact Preliminary Cooling Load Standard) */}
        <div className="pt-2">
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <table className="w-full border-collapse">
              <thead className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                <tr className="divide-x divide-border">
                  <th className="p-2.5 w-28 text-center bg-card"></th>
                  <th className="p-2.5 text-center w-1/3">Originator</th>
                  <th className="p-2.5 text-center w-1/3">Reviewer</th>
                  <th className="p-2.5 text-center w-1/3">Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="divide-x divide-border">
                  <td className="p-2.5 font-bold text-center bg-muted/10">Name:</td>
                  <td className="p-2.5 text-center font-medium">
                    {sigDetails?.originatedName || currentUserName || "-"}
                  </td>
                  <td className="p-2.5 text-center font-medium">
                    {sigDetails?.reviewerName || ""}
                  </td>
                  <td className="p-2.5 text-center font-medium">
                    {sigDetails?.approverName || ""}
                  </td>
                </tr>
                <tr className="divide-x divide-border">
                  <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                  <td className="p-2.5 text-center font-mono">
                    {sigDetails?.originatedDate || today}
                  </td>
                  <td className="p-2.5 text-center font-mono">
                    {sigDetails?.reviewerDate || ""}
                  </td>
                  <td className="p-2.5 text-center font-mono">
                    {sigDetails?.approverDate || ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact Step-by-Step Formula Breakdown & Energy Compliance Derivation Modal (Matching Fresh Air Cooling Load Standard)
// ─────────────────────────────────────────────────────────────────────────────
function LpdFormulaBreakdownModal({
  onClose,
  unitSystem,
  project,
  overallComplianceRate,
}: {
  onClose: () => void;
  unitSystem: "si" | "ip";
  project: LpdProject;
  overallComplianceRate: number;
}) {
  const [activeTab, setActiveTab] = useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = useState(false);
  const ip = unitSystem === "ip";
  const areaUnit = ip ? "sq.ft" : "m²";
  const lpdUnit = ip ? "W/sq.ft" : "W/m²";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const activeGroups = project.type === "External" ? project.externalGroups : project.internalGroups;
  const allSpaces = (activeGroups || []).flatMap((g) => g.spaces || []);
  const sampleSpace = allSpaces[0] || {
    name: "General Office / Space 101",
    area: ip ? 1000 : 100,
    actualWatts: 600,
    actualLpd: ip ? 0.60 : 6.0,
    targetLpd: ip ? 0.79 : 8.5,
    marginWatts: 250,
    isCompliant: true,
  };

  let grandArea = 0;
  let grandWatts = 0;
  let grandTargetWatts = 0;
  allSpaces.forEach((s) => {
    grandArea += s.area || 0;
    grandWatts += s.actualWatts || 0;
    grandTargetWatts += (s.area || 0) * (s.targetLpd || 0);
  });

  const avgActualLpd = grandArea > 0 ? grandWatts / grandArea : sampleSpace.actualLpd;
  const avgTargetLpd = grandArea > 0 ? grandTargetWatts / grandArea : sampleSpace.targetLpd;
  const energySavingPct = grandTargetWatts > 0 ? ((grandTargetWatts - grandWatts) / grandTargetWatts) * 100 : 20.0;

  const handleCopySummary = () => {
    const text = `=== LIGHTING POWER DENSITY (LPD) FORMULA BREAKDOWN ===
Governing Design Standards: ASHRAE Standard 90.1 (Section 9.6), ECBC & IECC
Unit System: ${ip ? "IP Imperial (sq.ft, W/sq.ft)" : "SI Metric (m², W/m²)"}
Building / Area Category: ${project.type} Lighting Compliance

--- 1. ACTIVE SIZING PARAMETERS ---
• Reference Space: ${sampleSpace.name} (Area: ${sampleSpace.area} ${areaUnit})
• Installed Lighting Power: ${sampleSpace.actualWatts} W
• Computed LPD: ${sampleSpace.actualLpd.toFixed(2)} ${lpdUnit}
• Baseline Maximum LPD: ${sampleSpace.targetLpd.toFixed(2)} ${lpdUnit}
• Compliance Status: ${sampleSpace.isCompliant ? "COMPLIANT (Pass)" : "NON-COMPLIANT (Exceeds Budget)"}
• Total Monitored Area: ${grandArea.toLocaleString()} ${areaUnit}
• Total Installed Power: ${grandWatts.toLocaleString()} W
• Maximum Allowable Budget: ${grandTargetWatts.toLocaleString()} W
• Overall Compliance Rate: ${overallComplianceRate}% (Margin: ${energySavingPct.toFixed(1)}% savings)

--- 2. STEP-BY-STEP CALCULATION STEPS ---
[1] Space Connected Load:
    P_installed = ∑ (Fixture_Qty × Rated_Watts) = ${sampleSpace.actualWatts} W

[2] Actual Space LPD:
    LPD_actual = P_installed / Floor_Area = ${sampleSpace.actualWatts} W / ${sampleSpace.area} ${areaUnit} = ${sampleSpace.actualLpd.toFixed(2)} ${lpdUnit}

[3] Maximum Allowable Lighting Power Budget:
    P_budget = Floor_Area × Baseline_LPD = ${sampleSpace.area} ${areaUnit} × ${sampleSpace.targetLpd.toFixed(2)} ${lpdUnit} = ${Math.round(sampleSpace.area * sampleSpace.targetLpd)} W

[4] Compliance Energy Margin:
    ΔP_margin = P_budget - P_installed = ${Math.round(sampleSpace.area * sampleSpace.targetLpd - sampleSpace.actualWatts)} W
    Margin % = ((Baseline_LPD - Actual_LPD) / Baseline_LPD) × 100% = ${(((sampleSpace.targetLpd - sampleSpace.actualLpd) / (sampleSpace.targetLpd || 1)) * 100).toFixed(1)}%

[5] Building-Level Whole Interior Area Compliance:
    Overall LPD = Total_Watts / Total_Area = ${grandWatts.toLocaleString()} W / ${grandArea.toLocaleString()} ${areaUnit} = ${avgActualLpd.toFixed(2)} ${lpdUnit}
    Total Energy Savings = ((${grandTargetWatts.toLocaleString()} W - ${grandWatts.toLocaleString()} W) / ${grandTargetWatts.toLocaleString()}) × 100% = ${energySavingPct.toFixed(1)}%
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("LPD calculation breakdown copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150 font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[86vh] flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Fresh Air Cooling Load Standard */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Calculator className="size-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-[13px] font-bold text-foreground truncate">
                Lighting Power Density (LPD) Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              ASHRAE 90.1 / ECBC
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
          {/* TAB 1: CALCULATION STEPS */}
          {activeTab === "trace" && (
            <div className="space-y-2.5">
              {/* Active Space Conditions Banner */}
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider pb-1.5 mb-1.5 border-b border-border/60">
                  <span className="flex items-center gap-1 text-foreground">
                    <Sliders className="size-3 text-primary" /> Active Space ({sampleSpace.name})
                  </span>
                  <span className={`font-mono font-bold text-[10.5px] px-2 py-0.2 rounded ${
                    sampleSpace.isCompliant
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}>
                    {sampleSpace.isCompliant ? "COMPLIANT" : "NON-COMPLIANT"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Space Area</span>
                    <span className="font-mono font-bold text-foreground">{sampleSpace.area} {areaUnit}</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Installed Power</span>
                    <span className="font-mono font-bold text-foreground">{sampleSpace.actualWatts} W</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: ACTUAL SPACE LPD */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">1</span>
                    <span className="font-bold text-[11.5px] text-foreground">Actual Installed LPD</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {sampleSpace.actualLpd.toFixed(2)} {lpdUnit}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: LPD_actual = Installed_Watts / Floor_Area</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{sampleSpace.actualWatts} W ÷ {sampleSpace.area} {areaUnit}</span>
                    <span className="text-primary font-bold">= {sampleSpace.actualLpd.toFixed(2)} {lpdUnit}</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: CODE BASELINE MAXIMUM */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">2</span>
                    <span className="font-bold text-[11.5px] text-foreground">Allowable Baseline LPD Budget</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {sampleSpace.targetLpd.toFixed(2)} {lpdUnit}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: P_allowable = Floor_Area × Baseline_LPD</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{sampleSpace.area} {areaUnit} × {sampleSpace.targetLpd.toFixed(2)} {lpdUnit}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {Math.round(sampleSpace.area * sampleSpace.targetLpd)} W</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: COMPLIANCE SAVINGS MARGIN */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">3</span>
                    <span className="font-bold text-[11.5px] text-foreground">Energy Savings Margin</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {Math.round(sampleSpace.area * sampleSpace.targetLpd - sampleSpace.actualWatts)} W Margin
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Criterion: LPD_actual ≤ Baseline_LPD</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{sampleSpace.actualLpd.toFixed(2)} vs {sampleSpace.targetLpd.toFixed(2)} {lpdUnit}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {sampleSpace.isCompliant ? "Pass (Complies with Code)" : "Fail (Exceeds Maximum)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 4: BUILDING WHOLE-AREA TOTALS */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">4</span>
                    <span className="font-bold text-[11.5px] text-foreground">Total Portfolio Compliance ({project.type})</span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {overallComplianceRate}% Pass Rate
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Total Connected Load vs Total Code Budget:</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{grandWatts.toLocaleString()} W / {grandArea.toLocaleString()} {areaUnit}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">Avg LPD: {avgActualLpd.toFixed(2)} {lpdUnit}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-3">
              <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                <div className="font-bold text-foreground text-[12px] flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" /> 1. Space-by-Space Lighting Power Density
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg font-mono text-[11px] space-y-1 border border-border/60">
                  <div className="text-primary font-bold">LPD_space = ∑ P_fixtures / Floor_Area</div>
                  <div className="text-foreground">P_allowable = Floor_Area × LPD_baseline</div>
                  <div className="text-emerald-700 dark:text-emerald-400">Compliance: LPD_space ≤ LPD_baseline</div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Evaluates each architectural space category individually using Table 9.6.1 (ASHRAE 90.1) or ECBC space classifications. Luminaire input watts must include ballast/driver losses.
                </p>
              </div>

              <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                <div className="font-bold text-foreground text-[12px] flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" /> 2. Building Area Method (Interior Trade-Off)
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg font-mono text-[11px] space-y-1 border border-border/60">
                  <div className="text-blue-600 dark:text-blue-400 font-bold">P_interior_budget = ∑ (Area_i × LPD_baseline_i)</div>
                  <div className="text-foreground">Total_Installed = ∑ P_installed_i</div>
                  <div className="text-primary font-bold">Energy Savings % = ((P_budget - Total_Installed) / P_budget) × 100%</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VARIABLES REFERENCE */}
          {activeTab === "variables" && (
            <div className="space-y-2">
              <div className="border border-border rounded-xl overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <tr className="divide-x divide-border">
                      <th className="p-2 text-left w-24">Symbol</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left w-24">Code Basis</th>
                      <th className="p-2 text-left w-20">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">Floor_Area</td>
                      <td className="p-2 text-muted-foreground">Gross conditioned interior or exterior lighted area</td>
                      <td className="p-2 font-mono text-[11px]">Architectural</td>
                      <td className="p-2 font-mono text-[11px]">{areaUnit}</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">P_installed</td>
                      <td className="p-2 text-muted-foreground">Total connected lighting input wattage (lamps + ballasts)</td>
                      <td className="p-2 font-mono text-[11px]">IES / Manufacturer</td>
                      <td className="p-2 font-mono text-[11px]">Watts (W)</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">LPD_actual</td>
                      <td className="p-2 text-muted-foreground">Computed lighting power density of installed luminaires</td>
                      <td className="p-2 font-mono text-[11px]">Calculated</td>
                      <td className="p-2 font-mono text-[11px]">{lpdUnit}</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">LPD_baseline</td>
                      <td className="p-2 text-muted-foreground">Maximum allowable lighting power density limit by space type</td>
                      <td className="p-2 font-mono text-[11px]">ASHRAE 90.1 / ECBC</td>
                      <td className="p-2 font-mono text-[11px]">{lpdUnit}</td>
                    </tr>
                    <tr className="divide-x divide-border">
                      <td className="p-2 font-mono font-bold text-primary">Margin %</td>
                      <td className="p-2 text-muted-foreground">Energy conservation savings percentage below baseline</td>
                      <td className="p-2 font-mono text-[11px]">LEED / IGBC</td>
                      <td className="p-2 font-mono text-[11px]">%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer matching Fresh Air Cooling Load Standard */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-2 hover:bg-surface-3 text-foreground border border-border transition-colors cursor-pointer"
          >
            <Copy className="size-3.5" />
            {copied ? "Copied!" : "Copy Breakdown"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
