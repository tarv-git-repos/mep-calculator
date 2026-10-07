import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import {
  CalculationReviewBar,
  useCalculationEffectiveReadOnly,
  useCalculationReviewState,
} from "@/components/workspace/CalculationReviewBar";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
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
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
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

export const Route = createFileRoute("/lpd-calculation")({
  head: () => ({
    meta: [
      { title: "LPD Calculation — MEP Calc" },
      { name: "description", content: "Lighting Power Density (LPD) Calculations." },
    ],
  }),
  component: LPDCalculationPage,
});

function LPDCalculationPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/lpd-calculation", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/lpd-calculation", activeProjectId || project?.id);
  const [projects, setProjects] = useState<LpdProject[]>([defaultProject()]);
  const [currentProjectId, setCurrentProjectId] = useState<string>(projects[0].id);
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

  const getBaselineLpdForType = (type: string, system: "si" | "ip" = unitSystem): number | undefined => {
    if (!type) return undefined;
    const norm = type.toLowerCase().trim();
    let sqmVal = authorityMapping[type] ?? authorityMapping[norm];
    if (sqmVal === undefined) {
      const matchKey = Object.keys(authorityMapping).find(
        (k) => k.toLowerCase().trim() === norm
      );
      if (matchKey) sqmVal = authorityMapping[matchKey];
    }

    if (system === "ip") {
      if (LPD_AUTHORITY_MAPPING[norm] !== undefined) return LPD_AUTHORITY_MAPPING[norm];
      if (sqmVal !== undefined) return Number((sqmVal / 10.76391).toFixed(2));
      return undefined;
    } else {
      if (sqmVal !== undefined) return Number(sqmVal.toFixed(2));
      if (LPD_AUTHORITY_MAPPING[norm] !== undefined) return Number((LPD_AUTHORITY_MAPPING[norm] * 10.76391).toFixed(2));
      return undefined;
    }
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  // Add Custom Area Type Modal State
  const [customAreaModalOpen, setCustomAreaModalOpen] = useState(false);
  const [customAreaTarget, setCustomAreaTarget] = useState<{
    groupId: string;
    spaceId: string;
  } | null>(null);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaBaselineLpd, setNewAreaBaselineLpd] = useState("");

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

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem("mep-lpd-calc-v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.projects && parsed.projects.length > 0) {
          const migratedProjects = parsed.projects.map((p: any) => {
            if (p.groups) {
              p.internalGroups = p.groups;
              p.externalGroups = [defaultGroup("EXTERNAL AREA")];
              delete p.groups;
            }
            if (!p.internalGroups) p.internalGroups = [defaultGroup("INTERNAL AREA")];
            if (!p.externalGroups) p.externalGroups = [defaultGroup("EXTERNAL AREA")];

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

            sanitizeGroups(p.internalGroups);
            sanitizeGroups(p.externalGroups);
            return p;
          });
          setProjects(migratedProjects);
          const validCurrentId =
            parsed.currentProjectId && migratedProjects.some((p: any) => p.id === parsed.currentProjectId)
              ? parsed.currentProjectId
              : migratedProjects[0].id;
          setCurrentProjectId(validCurrentId);
        }
      } catch (e) {}
    }

    const savedMapping = localStorage.getItem("mep-lpd-custom-mapping-sqm");
    if (savedMapping) {
      try {
        const parsed = JSON.parse(savedMapping);
        setAuthorityMapping((prev) => ({ ...prev, ...parsed }));
      } catch (e) {}
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem("mep-lpd-calc-v2", JSON.stringify({ projects, currentProjectId }));
    localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(authorityMapping));
    dirtyStore.set(true);
  }, [projects, currentProjectId, authorityMapping]);

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
    // If search or filter is hiding empty spaces, reset filter so user sees the newly added space immediately
    if (searchQuery) setSearchQuery("");
    if (filterStatus !== "all") setFilterStatus("all");
    if (filterAreaType !== "all") setFilterAreaType("all");
    if (filterFlaggedOnly) setFilterFlaggedOnly(false);
    if (filterMinArea !== null) setFilterMinArea(null);

    updateActiveGroups((groups) =>
      groups.map((g) =>
        g.id === gid
          ? {
              ...g,
              isExpanded: true,
              spaces: [...(g.spaces || []), defaultSpace()],
            }
          : g
      )
    );
    toast.success("New space added");
  };

  const handleAddNewSpace = () => {
    if (searchQuery) setSearchQuery("");
    if (filterStatus !== "all") setFilterStatus("all");
    if (filterAreaType !== "all") setFilterAreaType("all");
    if (filterFlaggedOnly) setFilterFlaggedOnly(false);
    if (filterMinArea !== null) setFilterMinArea(null);

    if (!activeGroups || activeGroups.length === 0) {
      const newGroup = defaultGroup(isInt ? "FLOOR 1" : "EXTERNAL AREA 1");
      const space = defaultSpace();
      newGroup.spaces = [space];
      newGroup.isExpanded = true;
      updateActiveGroups(() => [newGroup]);
      toast.success("Created floor group and added new space");
      return;
    }

    const targetGroup = activeGroups.find((g) => g.isExpanded) || activeGroups[0];
    addSpace(targetGroup.id);
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

      // Fallback 3: Check workspace store spaces if available
      if (extracted.length === 0) {
        const wsSpaces = workspaceStore.getState().spaces || [];
        if (wsSpaces.length > 0) {
          extracted = wsSpaces.map((s: any) => ({
            id: s.id,
            name: s.name,
            level: s.floor || s.level || "GROUND FLOOR",
            zone: s.zone || "Default",
            category: s.category || "General Office / Space",
            area: Number(s.area) || 20,
            height: Number(s.height) || 3.0,
            fixtures: s.fixtures || "",
            multiplier: s.multiplier || 1,
            aiDetected: true,
            confidence: 0.9,
            pressure: s.pressure || "0",
            pressureAutoDetected: false,
            source: "workspace" as const,
          }));
        }
      }

      if (extracted.length === 0) {
        toast.info("No active 3D IFC spaces found.", {
          description: "Open 3D Studio (/bim-viewer) to load your IFC model, or click below to launch 3D Studio.",
          action: {
            label: "Open 3D Studio",
            onClick: () => {
              window.location.href = "/bim-viewer";
            },
          },
        });
        return;
      }

      const { internalGroups, externalGroups, internalSpacesCount, externalSpacesCount } = convertBimSpacesToLpdGroupsSplit(extracted);

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

  const handleOpenCalculationPreview = (space: LpdSpace, groupName?: string) => {
    const data = getLpdCalculationPreview(space, unitSystem, groupName);
    setPreviewData(data);
    setIsPreviewOpen(true);
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

      // Sort spaces within the group if sortKey is set
      const sortedSpaces = [...filteredSpaces];
      if (sortKey === "default") {
        sortedSpaces.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
      } else if (sortKey === "name-asc") {
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
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">LPD Calculation</h1>
                <span className="text-[15px] font-semibold text-muted-foreground">{totalSpacesCount} {totalSpacesCount === 1 ? "space" : "spaces"}</span>
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
            <div className="flex items-center gap-2 flex-wrap">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitToggle}
                ipLabel="IP"
                siLabel="SI"
                ipDescription="Imperial (IP) [Area in sq.ft, LPD in W/sq.ft]"
                siDescription="Metric (SI) [Area in m², LPD in W/m²]"
                inputDescriptions="Space Areas and Baseline LPD values"
                conversionExample="Convert existing metric values (m², W/m²) to imperial units (sq.ft, W/sq.ft). Output calculations recalculate accordingly."
              />
            </div>
          </div>

          {/* White Card Container for Grid */}
          <div
            className={`flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden transition-all duration-300 relative ${
              calcReviewState?.status === "APPROVED"
                ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            }`}
          >
            {/* Space Action Toolbar Matching Space Management Layout */}
            <div className="relative flex items-center justify-between gap-2 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none">
              {/* Left Controls: Filter spaces search, Filter Popover, Sort Popover */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter spaces..."
                    className="h-7 w-56 pl-8 pr-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none text-foreground transition-all"
                  />
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Filter Button & Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer ${
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
                      className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer ${
                        sortKey !== "default"
                          ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                          : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      }`}
                      title="Sort Spaces"
                    >
                      <ArrowUpDown className="size-3.5 shrink-0" />
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
              </div>

              {/* Right Controls: Sync 3D BIM, Import, Export, + New Space */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncFrom3DStudio}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-all cursor-pointer shadow-2xs"
                  title="Extract & sync rooms and fixture counts from 3D Studio (IFC model)"
                >
                  <Sparkles className="size-3.5 text-blue-500" />
                  <span>Sync 3D BIM</span>
                </button>

                <ImportExcelBtn
                  columnMapping={{
                    "Space Name": ["Space Name", "Space", "Room", "Location", "Area Description"],
                    "Area Type": ["Area Type", "Space Type", "Category", "Type"],
                    "Area": ["Area", "Area (m²)", "Area (sq.ft)", "Area (sqm)", "Area (sqft)", "Floor Area"],
                    "Baseline LPD": ["Baseline LPD", "Target LPD", "Max LPD", "Code LPD", "LPD Limit"],
                    "Fixture Type": ["Fixture Type", "Light Type", "Fitting Type", "Luminaire"],
                    "Watts": ["Watts", "Wattage", "Power (W)", "W/Fixture", "Lamp Watts"],
                    "Qty": ["Qty", "Quantity", "Count", "Number of Fixtures", "No. of Fittings"],
                    "Remarks": ["Remarks", "Notes", "Comments"],
                  }}
                  onImport={handleImportExcelRows}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border border-border bg-background hover:bg-surface-2 text-foreground transition-all cursor-pointer shadow-2xs"
                >
                  <Upload className="size-3.5 text-muted-foreground" />
                  <span>Import</span>
                </ImportExcelBtn>

                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border border-border bg-background hover:bg-surface-2 text-foreground transition-all cursor-pointer shadow-2xs"
                >
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span>Export</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddNewSpace}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="size-3.5" />
                  <span>New Space</span>
                </button>
              </div>

              {/* Floating Bulk Actions Overlay Bar */}
              {!isEffectiveReadOnly && selected.size > 0 && (
                <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print backdrop-blur-md animate-in fade-in-50">
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
                    className="ml-auto flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="size-3.5" />
                    <span>Deselect All</span>
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
                    addGroup();
                  }}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11.5px] font-semibold bg-surface-2 hover:bg-surface-3 border border-border text-foreground transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <Plus className="size-3.5" /> Add Floor Group
                </button>
              </div>
            </div>

            {/* Table Area (Clean HTML table DOM without non-tr elements inside tbody) */}
            <div className="flex-1 overflow-auto bg-background">
              <table className="w-full text-left border-collapse min-w-[1240px]">
                {/* Master Table Header */}
                <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shadow-2xs">
                  <tr className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider h-10 select-none">
                    <th className="px-2 py-2 w-10 text-center border-r border-border/50">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="size-3.5 accent-primary cursor-pointer align-middle"
                        title={allSelected ? "Deselect All" : "Select All Spaces"}
                      />
                    </th>
                    <th className="px-3 py-2 w-56 border-r border-border/50">Space Name</th>
                    <th className="px-3 py-2 w-56 border-r border-border/50">Category / Type of Area</th>
                    <th className="px-3 py-2 w-44 border-r border-border/50">Light Type</th>
                    <th className="px-2 py-2 w-20 text-center border-r border-border/50">Watts</th>
                    <th className="px-2 py-2 w-16 text-center border-r border-border/50">Qty</th>
                    <th className="px-2 py-2 w-24 text-center border-r border-border/50">Total Watts</th>
                    <th className="px-2 py-2 w-28 text-center border-r border-border/50">
                      Area {unitSystem === "si" ? "(m²)" : "(sq.ft)"}
                    </th>
                    <th className="px-3 py-2 w-32 text-center border-r border-border/50 text-primary">
                      Proposed LPD
                      <br />
                      <span className="text-[9.5px] font-normal text-muted-foreground">
                        ({unitSystem === "si" ? "W/m²" : "W/sq.ft"})
                      </span>
                    </th>
                    <th className="px-3 py-2 w-28 text-center border-r border-border/50">
                      Baseline LPD
                      <br />
                      <span className="text-[9.5px] font-normal text-muted-foreground">
                        ({unitSystem === "si" ? "W/m²" : "W/sq.ft"})
                      </span>
                    </th>
                    <th className="px-3 py-2 w-36 border-r border-border/50">Remarks</th>
                    <th className="px-2 py-2 w-10 text-center border-r border-border/50" title="Add Fixture to Space"></th>
                    <th className="px-2 py-2 w-10 text-center" title="Flag Space">
                      <Flag className="size-3.5 mx-auto text-muted-foreground/60" />
                    </th>
                  </tr>
                </thead>

                <tbody className="text-[12.5px] divide-y divide-border/40">
                  {filteredGroups.map((group) => {
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
                          className="bg-slate-100/90 dark:bg-zinc-800/70 border-y border-border select-none"
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
                          <td colSpan={13} className="p-0">
                            <div className="flex items-center px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allGroupSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSelectGroup(group.id, !allGroupSelected);
                                }}
                                className="size-3.5 accent-primary cursor-pointer mr-2.5"
                                title="Select all spaces on this floor"
                              />
                              <button
                                type="button"
                                onClick={() => updateGroup(group.id, "isExpanded", !group.isExpanded)}
                                className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded mr-1.5 text-foreground/80 transition-colors"
                              >
                                {group.isExpanded ? (
                                  <ChevronDown className="size-4" />
                                ) : (
                                  <ChevronRight className="size-4" />
                                )}
                              </button>
                              <span className="flex items-center gap-1.5 font-medium">
                                <input
                                  type="text"
                                  className="bg-transparent font-bold text-primary tracking-wide uppercase text-[13px] outline-none focus:bg-background/80 px-1 py-0.5 rounded border border-transparent hover:border-border/60 focus:border-primary transition-colors cursor-text min-w-[120px] max-w-[240px]"
                                  value={group.name}
                                  onChange={(e) => updateGroup(group.id, "name", e.target.value.toUpperCase())}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Click to edit floor name"
                                />
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
                            const secondaryArea = isIp ? sqM : sqF;
                            const proposedLpd = primaryArea > 0 ? totalWatts / primaryArea : 0;
                            const baselineLpd = parseFloat(String(space.baselineLpd)) || 0;
                            const isCompliant = primaryArea > 0 && baselineLpd > 0 ? proposedLpd <= baselineLpd : null;
                            const srNo = globalSrNo++;
                            const isSelected = selected.has(space.id);
                            const isHighlighted = highlightedSpaceId === space.id;

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
                                    onClick={() => {
                                      // Row selection is handled by checkbox and S.NO click
                                    }}
                                    onDoubleClick={(e) => {
                                      const target = e.target as HTMLElement;
                                      if (
                                        (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") ||
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
                                    onDoubleClick={(e) => {
                                      const tag = (e.target as HTMLElement).tagName;
                                      if (tag !== "INPUT" && tag !== "SELECT" && tag !== "BUTTON") {
                                        handleOpenCalculationPreview(space, group.name);
                                      }
                                    }}
                                    className={cn(
                                      "border-b border-border/40 transition-colors group/row",
                                      isSelected
                                        ? "bg-primary/10 dark:bg-primary/15"
                                        : "hover:bg-muted/40",
                                      isHighlighted &&
                                        "ring-2 ring-primary ring-inset bg-primary/20 animate-pulse duration-700"
                                    )}
                                  >
                                    {/* Space Details (Spans all fixture rows) */}
                                    {fIndex === 0 && (
                                      <>
                                        {/* Row Selection Checkbox */}
                                        <td
                                          className="px-2 py-1.5 text-center border-r border-border/40"
                                          rowSpan={space.fixtures.length}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectRow(space.id)}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                            className="size-3.5 accent-primary cursor-pointer align-middle"
                                          />
                                        </td>

                                        {/* Space Name */}
                                        <td
                                          className="p-0 border-r border-border/40"
                                          rowSpan={space.fixtures.length}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                        >
                                          <div className="flex items-center gap-1.5 w-full h-full px-2.5">
                                            {itemComments.length > 0 && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenComment(space.id, space.name);
                                                }}
                                                onDoubleClick={(e) => e.stopPropagation()}
                                                title={`${itemComments.length} comment(s)/task(s) assigned`}
                                                className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
                                              >
                                                <MessageSquare className="size-3.5 fill-blue-500/20" />
                                                <span className="text-[10px] font-bold">{itemComments.length}</span>
                                              </button>
                                            )}
                                            <input
                                              className="w-full h-full min-h-[34px] bg-transparent outline-none font-medium text-[13px] text-foreground focus:bg-primary/5 px-1 rounded transition-colors"
                                              value={space.name}
                                              onChange={(e) =>
                                                updateSpace(group.id, space.id, "name", e.target.value)
                                              }
                                              onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenCalculationPreview(space, group.name);
                                              }}
                                              placeholder="e.g. Electrical Room"
                                              title="Double-click to view calculation preview"
                                            />
                                          </div>
                                        </td>

                                        {/* Category / Type of Area */}
                                        <td
                                          className="p-0 border-r border-border/40"
                                          rowSpan={space.fixtures.length}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                        >
                                          <div className="flex items-center gap-2 px-2.5 w-full h-full">
                                            <span
                                              className={`size-2 rounded-full shrink-0 ${
                                                space.areaType ? "bg-primary" : "bg-muted-foreground/30"
                                              }`}
                                            />
                                            <select
                                              className="w-full h-full min-h-[34px] bg-transparent outline-none cursor-pointer font-medium text-[12.5px] text-foreground transition-colors"
                                              value={space.areaType || ""}
                                              onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenCalculationPreview(space, group.name);
                                              }}
                                              title="Double-click to view calculation preview"
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "ADD_NEW") {
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
                                                  return;
                                                }
                                                updateSpace(group.id, space.id, "areaType", val);
                                              }}
                                            >
                                              <option value="">Select Category / Type...</option>
                                              {space.areaType && authorityMapping[space.areaType] === undefined && (
                                                <option value={space.areaType}>{space.areaType}</option>
                                              )}
                                              {Object.keys(authorityMapping)
                                                .sort()
                                                .map((k) => (
                                                  <option key={k} value={k}>
                                                    {k.replace(/\b\w/g, (l) => l.toUpperCase())}
                                                  </option>
                                                ))}
                                              <option disabled>──────────</option>
                                              <option value="ADD_NEW">+ Add Custom Area Type...</option>
                                            </select>
                                          </div>
                                        </td>
                                      </>
                                    )}

                                    {/* Fixture Light Type */}
                                    <td
                                      className="p-0 border-r border-border/40 relative"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCalculationPreview(space, group.name);
                                      }}
                                    >
                                      {!Object.keys(LIGHT_TYPE_MAPPING).includes(fixture.type) &&
                                      fixture.type !== "" ? (
                                        <div className="flex w-full h-full items-center px-2">
                                          <input
                                            className="w-full h-full min-h-[34px] bg-transparent outline-none font-medium text-[12.5px] transition-colors"
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
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenCalculationPreview(space, group.name);
                                            }}
                                            placeholder="Type Light Name..."
                                            autoFocus={fixture.type === "custom"}
                                            title="Double-click to view calculation preview"
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateFixture(group.id, space.id, fixture.id, "type", "")
                                            }
                                            onDoubleClick={(e) => e.stopPropagation()}
                                            className="px-1 text-muted-foreground hover:text-red-500 font-bold transition-colors"
                                            title="Reset to Dropdown"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ) : (
                                        <select
                                          className="w-full h-full min-h-[34px] px-3 bg-transparent outline-none cursor-pointer font-medium text-[12.5px] text-foreground transition-colors"
                                          value={fixture.type}
                                          onChange={(e) =>
                                            updateFixture(group.id, space.id, fixture.id, "type", e.target.value)
                                          }
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title="Double-click to view calculation preview"
                                        >
                                          <option value="">Select Light...</option>
                                          {Object.keys(LIGHT_TYPE_MAPPING).map((k) => (
                                            <option key={k} value={k}>
                                              {k} ({LIGHT_TYPE_MAPPING[k]}W)
                                            </option>
                                          ))}
                                          <option value="custom">Custom Input...</option>
                                        </select>
                                      )}
                                    </td>

                                    {/* Fixture Watts */}
                                    <td
                                      className="p-0 border-r border-border/40"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCalculationPreview(space, group.name);
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        className="w-full h-full min-h-[34px] px-2 text-center font-mono text-[12.5px] bg-transparent outline-none focus:bg-primary/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                                        value={fixture.watts}
                                        onChange={(e) =>
                                          updateFixture(group.id, space.id, fixture.id, "watts", e.target.value)
                                        }
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenCalculationPreview(space, group.name);
                                        }}
                                        placeholder="0"
                                        disabled={Object.keys(LIGHT_TYPE_MAPPING).includes(fixture.type)}
                                        title="Double-click to view calculation preview"
                                      />
                                    </td>

                                    {/* Fixture Qty */}
                                    <td
                                      className="p-0 border-r border-border/40"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCalculationPreview(space, group.name);
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min="1"
                                        className="w-full h-full min-h-[34px] px-2 text-center font-mono text-[12.5px] bg-transparent outline-none focus:bg-primary/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                                        value={fixture.qty}
                                        onChange={(e) =>
                                          updateFixture(group.id, space.id, fixture.id, "qty", e.target.value)
                                        }
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenCalculationPreview(space, group.name);
                                        }}
                                        placeholder="1"
                                        title="Double-click to view calculation preview"
                                      />
                                    </td>

                                    {/* Space Metrics (Spans all fixture rows) */}
                                    {fIndex === 0 && (
                                      <>
                                        {/* Total Watts */}
                                        <td
                                          className="px-2 py-1.5 border-r border-border/40 text-center font-mono font-semibold text-[13px] text-foreground cursor-pointer hover:bg-primary/5 select-none"
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title="Click or double-click to view calculation preview"
                                        >
                                          {totalWatts.toLocaleString()}
                                        </td>

                                        {/* Area */}
                                        <td
                                          className="p-0 border-r border-border/40"
                                          rowSpan={space.fixtures.length}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                        >
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            className="w-full h-full min-h-[34px] px-2 text-center font-mono text-[13px] bg-transparent outline-none focus:bg-primary/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                                            value={space.areaSqM}
                                            onChange={(e) =>
                                              updateSpace(group.id, space.id, "areaSqM", e.target.value)
                                            }
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenCalculationPreview(space, group.name);
                                            }}
                                            placeholder="0.0"
                                            title="Double-click to view calculation preview"
                                          />
                                        </td>

                                        {/* Proposed LPD (W/m²) */}
                                        <td
                                          className="px-2 py-1.5 border-r border-border/40 text-center cursor-pointer select-none group/lpd hover:bg-primary/5"
                                          rowSpan={space.fixtures.length}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                          title="Click or double-click to view step-by-step calculation preview & formula breakdown"
                                        >
                                          {rawArea > 0 ? (
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

                                        {/* Baseline LPD (W/m²) */}
                                        <td
                                          className="p-0 border-r border-border/40"
                                          rowSpan={space.fixtures.length}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                        >
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full h-full min-h-[34px] px-2 text-center font-mono text-[13px] bg-transparent outline-none focus:bg-primary/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                                            value={space.baselineLpd}
                                            onChange={(e) =>
                                              updateSpace(group.id, space.id, "baselineLpd", e.target.value)
                                            }
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenCalculationPreview(space, group.name);
                                            }}
                                            placeholder={unitSystem === "ip" ? "0.65" : "7.00"}
                                            title="Double-click to view calculation preview"
                                          />
                                        </td>

                                        {/* Remarks */}
                                        <td
                                          className="p-0 border-r border-border/40"
                                          rowSpan={space.fixtures.length}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCalculationPreview(space, group.name);
                                          }}
                                        >
                                          <input
                                            type="text"
                                            className="w-full h-full min-h-[34px] px-2.5 text-left text-[12px] bg-transparent outline-none focus:bg-primary/5 transition-colors"
                                            value={space.remarks || ""}
                                            onChange={(e) =>
                                              updateSpace(group.id, space.id, "remarks", e.target.value)
                                            }
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenCalculationPreview(space, group.name);
                                            }}
                                            placeholder="Notes..."
                                            title="Double-click to view calculation preview"
                                          />
                                        </td>

                                        {/* Add Fixture */}
                                        <td
                                          className="px-1 py-1.5 text-center border-r border-border/40 w-10"
                                          rowSpan={space.fixtures.length}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              addFixture(group.id, space.id);
                                            }}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                            className="p-1 hover:bg-surface-2 rounded text-muted-foreground hover:text-primary transition-colors cursor-pointer mx-auto flex items-center justify-center"
                                            title="Add another fixture to space"
                                          >
                                            <Plus className="size-3.5" />
                                          </button>
                                        </td>

                                        {/* Flag Button Column (At end of row) */}
                                        <td
                                          className="px-2 py-1.5 text-center"
                                          rowSpan={space.fixtures.length}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFlag(group.id, space.id);
                                            }}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                            className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
                                            title={
                                              space.flagged
                                                ? "Flagged for review (Click to unflag)"
                                                : !isCompliant && sqM > 0
                                                ? `Warning: Exceeds baseline LPD by +${(proposedLpd - baselineLpd).toFixed(2)} W/m² (Click to flag)`
                                                : "Click to flag this space"
                                            }
                                          >
                                            <Flag
                                              className={cn(
                                                "size-3.5 transition-all duration-200",
                                                space.flagged
                                                  ? "fill-red-500 text-red-500 scale-110 drop-shadow-xs"
                                                  : !isCompliant && sqM > 0
                                                  ? "text-red-400/80 hover:text-red-500 group-hover:scale-110"
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

                        {/* Add Row Button at bottom of group */}
                        {group.isExpanded && (
                          <tr>
                            <td colSpan={13} className="p-2 bg-background/50 border-t border-border/40">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  addSpace(group.id);
                                }}
                                className="w-full flex items-center justify-center py-2.5 border-2 border-dashed border-border/60 hover:border-primary/60 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all font-medium text-[12.5px] cursor-pointer"
                              >
                                <Plus className="size-3.5 mr-1.5" /> Add Space to {group.name}
                              </button>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
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
          className="fixed z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl p-1.5 w-56 text-[12.5px] animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${Math.min(spaceContextMenu.y, window.innerHeight - 260)}px`,
            left: `${Math.min(spaceContextMenu.x, window.innerWidth - 240)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[11px] font-bold text-muted-foreground truncate border-b border-border/50 mb-1">
            {activeContextSpace.name || "Unnamed Space"}
          </div>

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/10 text-primary rounded cursor-pointer font-semibold transition-colors"
            onClick={() => {
              const gName = activeGroups.find((g) => g.id === spaceContextMenu.groupId)?.name;
              handleOpenCalculationPreview(activeContextSpace, gName);
              setSpaceContextMenu(null);
            }}
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>Calculation Preview</span>
          </button>

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded cursor-pointer font-medium transition-colors"
            onClick={() => {
              handleOpenComment(activeContextSpace.id, activeContextSpace.name);
              setSpaceContextMenu(null);
            }}
          >
            <MessageSquare className="size-3.5" />
            <span>Add Comment / Task</span>
          </button>

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
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

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
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
              className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer transition-colors"
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
              <Trash2 className="size-3.5" />
              <span>Remove Extra Fixture</span>
            </button>
          )}

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
            onClick={() => {
              duplicateSpace(spaceContextMenu.groupId, activeContextSpace.id);
              setSpaceContextMenu(null);
            }}
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Duplicate Space</span>
          </button>

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
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

          {selected.size > 1 && selected.has(activeContextSpace.id) && (
            <>
              <div className="h-px bg-border my-1" />
              <button
                type="button"
                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
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
                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
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

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer transition-colors"
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
          </button>
        </div>
      )}

      {/* Floating Floor Group Context Menu */}
      {groupContextMenu && activeContextGroup && (
        <div
          className="fixed z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl p-1.5 w-56 text-[12.5px] animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${Math.min(groupContextMenu.y, window.innerHeight - 200)}px`,
            left: `${Math.min(groupContextMenu.x, window.innerWidth - 240)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[11px] font-bold text-muted-foreground truncate border-b border-border/50 mb-1">
            {activeContextGroup.name}
          </div>

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
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
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
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
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
            onClick={() => {
              const gid = activeContextGroup.id;
              setGroupContextMenu(null);
              duplicateGroup(gid);
            }}
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Duplicate Floor</span>
          </button>

          <div className="h-px bg-border my-1" />

          <button
            type="button"
            className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer transition-colors"
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
    </AppShell>
  );
}

// ---------------------------------------------------------
// Intelligence Drawer Component
// ---------------------------------------------------------

function LpdIntelligenceDrawer({
  groups,
  unitSystem = "si",
  authorityMapping,
  onClose,
  onScrollToSpace,
  onAutoFlagNonCompliant,
  onClearAllFlags,
  onAutoFillBaselines,
  onOpenPreview,
}: {
  groups: LpdGroup[];
  unitSystem?: "si" | "ip";
  authorityMapping: Record<string, number>;
  onClose: () => void;
  onScrollToSpace: (spaceId: string, groupId?: string) => void;
  onAutoFlagNonCompliant: () => void;
  onClearAllFlags: () => void;
  onAutoFillBaselines: () => void;
  onOpenPreview?: (space: any, groupName?: string) => void;
}) {
  const allSpaces = useMemo(() => {
    const isIp = unitSystem === "ip";
    return groups.flatMap((g) =>
      (g.spaces || []).map((s) => {
        const totalWatts = (s.fixtures || []).reduce(
          (sum, f) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0),
          0
        );
        const rawArea = parseFloat(s.areaSqM) || 0;
        const sqM = isIp ? rawArea / 10.76391 : rawArea;
        const sqF = isIp ? rawArea : rawArea * 10.76391;
        const primaryArea = isIp ? sqF : sqM;
        const proposedLpd = primaryArea > 0 ? totalWatts / primaryArea : 0;
        const baselineLpd = parseFloat(s.baselineLpd) || 0;
        const isCompliant = primaryArea > 0 && baselineLpd > 0 ? proposedLpd <= baselineLpd : null;
        const isExceeding = primaryArea > 0 && baselineLpd > 0 && proposedLpd > baselineLpd;
        const diffLpd = proposedLpd - baselineLpd;

        return {
          ...s,
          groupId: g.id,
          groupName: g.name,
          totalWatts,
          rawArea,
          sqM,
          sqF,
          primaryArea,
          proposedLpd,
          baselineLpd,
          isCompliant,
          isExceeding,
          diffLpd,
        };
      })
    );
  }, [groups, unitSystem]);

  const isIp = unitSystem === "ip";
  const totalSpaces = allSpaces.length;
  const evaluatedSpaces = allSpaces.filter((s) => s.primaryArea > 0 && s.baselineLpd > 0);
  const compliantSpaces = evaluatedSpaces.filter((s) => s.isCompliant);
  const nonCompliantSpaces = allSpaces.filter((s) => s.isExceeding);
  const flaggedSpaces = allSpaces.filter((s) => s.flagged);

  const missingAreaSpaces = allSpaces.filter((s) => s.primaryArea <= 0);
  const missingTypeSpaces = allSpaces.filter((s) => !s.areaType || s.areaType.trim() === "");
  const missingBaselineSpaces = allSpaces.filter((s) => s.baselineLpd <= 0);
  const missingWattsSpaces = allSpaces.filter((s) => s.totalWatts <= 0);

  const complianceRate =
    evaluatedSpaces.length > 0
      ? Math.round((compliantSpaces.length / evaluatedSpaces.length) * 100)
      : 100;

  const totalWattsAll = allSpaces.reduce((a, s) => a + s.totalWatts, 0);
  const totalAreaAll = allSpaces.reduce((a, s) => a + s.primaryArea, 0);
  const allowedWattsAll = allSpaces.reduce((a, s) => a + s.primaryArea * s.baselineLpd, 0);
  const avgProposedLpd = totalAreaAll > 0 ? totalWattsAll / totalAreaAll : 0;
  const avgBaselineLpd = totalAreaAll > 0 ? allowedWattsAll / totalAreaAll : 0;
  const wattsDiff = totalWattsAll - allowedWattsAll;
  const pctSavings =
    allowedWattsAll > 0 ? ((allowedWattsAll - totalWattsAll) / allowedWattsAll) * 100 : 0;

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in bg-card text-foreground select-none">
      {/* Drawer Header */}
      <header className="h-11 px-3.5 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-[13.5px] font-bold tracking-tight">LPD Intelligence</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </header>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Compliance Status Card */}
        <div className="p-3 rounded-xl border border-border bg-surface-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Compliance Status
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[11px] font-mono font-bold",
                complianceRate >= 100
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : complianceRate >= 80
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-red-500/15 text-red-600 dark:text-red-400"
              )}
            >
              {complianceRate}%
            </span>
          </div>

          <div className="text-[12px] text-muted-foreground">
            ASHRAE 90.1 & Local Authority LPD verification across {totalSpaces} spaces.
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  complianceRate >= 100
                    ? "bg-emerald-500"
                    : complianceRate >= 80
                    ? "bg-amber-500"
                    : "bg-red-500"
                )}
                style={{ width: `${complianceRate}%` }}
              />
            </div>
            <span className="font-mono text-[11.5px] font-bold text-foreground">
              {compliantSpaces.length}/{evaluatedSpaces.length}
            </span>
          </div>

          <div className="text-[11.5px] text-muted-foreground border-t border-border/50 pt-2 flex justify-between">
            <span>Non-Compliant:</span>
            <span className="font-mono font-bold text-red-500">{nonCompliantSpaces.length} space(s)</span>
          </div>
        </div>

        {/* Project Energy & Load Summary */}
        <div className="p-3 rounded-xl border border-border bg-surface-1 space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            <Zap className="size-3.5 text-primary" />
            Energy Balance
          </div>
          <div className="space-y-1.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connected Load:</span>
              <span className="font-mono font-semibold">
                {(totalWattsAll / 1000).toFixed(2)} kW ({totalWattsAll.toLocaleString()} W)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Lit Area:</span>
              <span className="font-mono font-semibold">
                {isIp
                  ? `${totalAreaAll.toFixed(1)} sq.ft (${(totalAreaAll / 10.76391).toFixed(1)} m²)`
                  : `${totalAreaAll.toFixed(1)} m² (${(totalAreaAll * 10.764).toFixed(0)} ft²)`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Area-Weighted LPD:</span>
              <span className="font-mono font-semibold">
                {avgProposedLpd.toFixed(2)} {isIp ? "W/sq.ft" : "W/m²"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Baseline Allowance:</span>
              <span className="font-mono font-semibold">
                {avgBaselineLpd.toFixed(2)} {isIp ? "W/sq.ft" : "W/m²"}
              </span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-1.5">
              <span className="text-muted-foreground">Power Margin:</span>
              <span
                className={cn(
                  "font-mono font-bold",
                  pctSavings >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {pctSavings >= 0
                  ? `+${pctSavings.toFixed(1)}% Saving (${(Math.abs(wattsDiff) / 1000).toFixed(2)} kW)`
                  : `${pctSavings.toFixed(1)}% Excess (+${(Math.abs(wattsDiff) / 1000).toFixed(2)} kW)`}
              </span>
            </div>
          </div>
        </div>

        {/* Non-Compliant Spaces List */}
        <div className="p-3 rounded-xl border border-border bg-surface-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-red-500" />
              Exceeding Baseline ({nonCompliantSpaces.length})
            </span>
            {nonCompliantSpaces.length > 0 && (
              <button
                type="button"
                onClick={onAutoFlagNonCompliant}
                className="text-[10.5px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Flag All
              </button>
            )}
          </div>

          {nonCompliantSpaces.length === 0 ? (
            <div className="text-[12px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 py-1">
              <Check className="size-3.5" /> All evaluated spaces meet LPD baseline limits!
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {nonCompliantSpaces.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onScrollToSpace(s.id, s.groupId)}
                  onDoubleClick={() => onOpenPreview?.(s, s.groupName)}
                  className="p-2 rounded-lg bg-background hover:bg-surface-2 border border-border/60 transition-colors cursor-pointer text-[12px] group/item"
                  title="Click to locate. Double-click to preview calculation."
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate max-w-[160px]">
                      {s.name || "Unnamed Space"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {onOpenPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPreview(s, s.groupName);
                          }}
                          className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-primary/10 text-primary transition-opacity cursor-pointer"
                          title="Preview calculation"
                        >
                          <Sparkles className="size-3" />
                        </button>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {s.groupName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                    <span className="text-red-500 font-bold">
                      {s.proposedLpd.toFixed(2)} {isIp ? "W/sq.ft" : "W/m²"}
                    </span>
                    <span className="text-muted-foreground">Baseline: {s.baselineLpd.toFixed(2)}</span>
                    <span className="text-red-500 font-bold">+{s.diffLpd.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flagged Spaces List */}
        <div className="p-3 rounded-xl border border-border bg-surface-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Flag className="size-3.5 text-amber-500" />
              Flagged Spaces ({flaggedSpaces.length})
            </span>
            {flaggedSpaces.length > 0 && (
              <button
                type="button"
                onClick={onClearAllFlags}
                className="text-[10.5px] font-semibold text-muted-foreground hover:text-red-500 cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {flaggedSpaces.length === 0 ? (
            <div className="text-[12px] text-muted-foreground py-1">No spaces currently flagged.</div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {flaggedSpaces.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onScrollToSpace(s.id, s.groupId)}
                  onDoubleClick={() => onOpenPreview?.(s, s.groupName)}
                  className="p-2 rounded-lg bg-background hover:bg-surface-2 border border-border/60 transition-colors cursor-pointer text-[12px] flex items-center justify-between group/item"
                  title="Click to locate. Double-click to preview calculation."
                >
                  <div className="truncate max-w-[190px]">
                    <span className="font-semibold text-foreground">{s.name || "Unnamed Space"}</span>
                    <div className="text-[10.5px] text-muted-foreground">{s.groupName}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onOpenPreview && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPreview(s, s.groupName);
                        }}
                        className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-primary/10 text-primary transition-opacity cursor-pointer"
                        title="Preview calculation"
                      >
                        <Sparkles className="size-3" />
                      </button>
                    )}
                    <Flag className="size-3.5 fill-red-500 text-red-500 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Integrity / Incomplete Inputs */}
        <div className="p-3 rounded-xl border border-border bg-surface-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5 text-amber-500" />
              Audit Checks
            </span>
            {missingBaselineSpaces.length > 0 && (
              <button
                type="button"
                onClick={onAutoFillBaselines}
                className="text-[10.5px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Auto-Fill
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-background border border-border/60 flex flex-col">
              <span className="text-muted-foreground">Missing Area:</span>
              <span className="font-mono font-bold text-foreground text-[13px]">
                {missingAreaSpaces.length}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-background border border-border/60 flex flex-col">
              <span className="text-muted-foreground">Missing Type:</span>
              <span className="font-mono font-bold text-foreground text-[13px]">
                {missingTypeSpaces.length}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-background border border-border/60 flex flex-col">
              <span className="text-muted-foreground">Zero Wattage:</span>
              <span className="font-mono font-bold text-foreground text-[13px]">
                {missingWattsSpaces.length}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-background border border-border/60 flex flex-col">
              <span className="text-muted-foreground">No Baseline:</span>
              <span className="font-mono font-bold text-foreground text-[13px]">
                {missingBaselineSpaces.length}
              </span>
            </div>
          </div>
        </div>

        {/* Smart Tips */}
        <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5 text-[11.5px] text-muted-foreground">
          <div className="flex items-center gap-1.5 font-bold text-primary text-[12px]">
            <Lightbulb className="size-3.5" />
            Engineering Optimization Tip
          </div>
          <p className="leading-relaxed">
            Spaces exceeding baseline LPD by &gt;15% can achieve full compliance by retrofitting to 10W–15W LED downlights
            or implementing occupancy-sensing daylight harvesting.
          </p>
        </div>
      </div>
    </div>
  );
}
