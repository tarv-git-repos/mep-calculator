import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportSprinklerDensityPDF, type SprinklerDensityExportData } from "@/lib/exportSprinklerDensityPDF";
import { exportSprinklerDensityExcel } from "@/lib/exportSprinklerDensityExcel";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, FileSpreadsheet, X, HelpCircle,
  Search, Activity, Droplet, Settings, Grid, Flame, ShieldAlert, Check,
  MessageSquare, Copy, Clipboard, RotateCcw, Trash2, Edit3
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { EditSprinklerModal, type SprinklerFormData } from "@/components/workspace/EditSprinklerModal";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace } from "@/lib/workspace-store";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { toast } from "sonner";
import { dirtyStore } from "@/lib/dirty-store";
import {
  type HazardOpt,
  STANDARD_K_FACTORS,
  computeSprinklerDensityCalculations
} from "@/lib/calc-plumbing-sprinkler-density";


export const Route = createFileRoute("/plumbing-sprinkler-density")({
  head: () => ({
    meta: [
      { title: "Sprinkler Density & Flow — MEP Calc" },
      { name: "description", content: "Calculate sprinkler flow rates from design density, design area, and sprinkler K-factor per NFPA 13." },
    ],
  }),
  component: SprinklerDensityPage,
});

function SprinklerDensityPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-sprinkler-density", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-sprinkler-density", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const isApprovedLocked = useCalculationLock("/plumbing-sprinkler-density", project?.id);

  // Tabs
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);

  // Input states
  const [hazard, setHazard] = useState<HazardOpt>("0.15,1500");
  const [customDens, setCustomDens] = useState<number | "">(0.20);
  const [customArea, setCustomArea] = useState<number | "">(1500);
  const [coverage, setCoverage] = useState<number | "">(130);
  const [kFactor, setKFactor] = useState(5.6);
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  const handleSaveSprinklerModal = (data: SprinklerFormData) => {
    setHazard(data.hazard);
    setCustomDens(data.customDens);
    setCustomArea(data.customArea);
    setCoverage(data.coverage);
    setKFactor(data.kFactor);
    setUnitSystem(data.unitSystem);
    dirtyStore.set(true);
  };

  // Comment System State & Persistence (matching Preliminary Cooling Load)
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pId = project?.id || "default";
    const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/plumbing-sprinkler-density`);
    if (savedComments) {
      try {
        setCommentsList(JSON.parse(savedComments));
      } catch (e) {
        console.error("Failed to load comments", e);
      }
    }
  }, [project?.id]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-sprinkler-density`, JSON.stringify(newList));
    // Immediately dispatch notification events for instantaneous UI and badge update (<1ms)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new Event("storage"));
    }
    // Non-blocking background cloud save
    try {
      if (typeof forceSaveToCloud === "function") {
        setTimeout(() => forceSaveToCloud(false), 50);
      }
    } catch (e) {}
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    const commentWithMeta = {
      ...comment,
      spaceId: commentTargetItem?.id,
      targetId: commentTargetItem?.id,
      targetName: commentTargetItem?.name,
      targetType: "parameter",
      calculatorTitle: "Sprinkler Density & Flow",
      calculatorPath: "/plumbing-sprinkler-density",
      projectId: project?.id || "default",
      projectName: project?.name || "Sprinkler Hydraulic Calculation",
    };
    const updated = [commentWithMeta, ...commentsList.filter(c => c.id !== comment.id)];
    saveComments(updated);
    setCommentModalOpen(false);
  };

  // Scroll and highlight notification target item (matching Preliminary Cooling Load)
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanName = (targetName || "").toLowerCase().trim();

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`field-${targetId}`) ||
                 document.getElementById(`res-${targetId}`) ||
                 document.getElementById(`kpi-${targetId}`) ||
                 document.getElementById(`row-${targetId}`) ||
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

    // 1. Check URL parameters on mount
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("commentTargetId");
      const targetName = params.get("commentTargetName");
      if (targetId || targetName) {
        setTimeout(() => {
          handleScrollTarget(targetId || undefined, targetName || undefined);
        }, 300);
      }
    }

    // 2. Listen to custom event from Notification Center navigation
    const handleScrollEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        handleScrollTarget(detail.id, detail.name);
      }
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const handleCopyValue = (label: string, value: string | number) => {
    if (value === "" || value === undefined) {
      toast.info(`No value in ${label} to copy`);
      return;
    }
    navigator.clipboard.writeText(String(value));
    toast.success(`Copied ${label}: ${value} to clipboard`);
  };

  const handlePasteValue = async (label: string, setter: (val: any) => void) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved & Locked by Discipline Coordinator. Unlock required to edit.");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text.trim());
      if (!isNaN(num)) {
        setter(num);
        toast.success(`Pasted ${num} into ${label}`);
      } else {
        toast.error(`Clipboard content "${text}" is not a valid number`);
      }
    } catch (err) {
      toast.error("Unable to read clipboard");
    }
  };

  const handleResetValue = (label: string, setter: (val: any) => void, defaultVal: any) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved & Locked by Discipline Coordinator. Unlock required to edit.");
      return;
    }
    setter(defaultVal);
    toast.success(`Reset ${label} to default ${defaultVal !== "" ? defaultVal : "(blank)"}`);
  };

  const handleClearValue = (label: string, setter: (val: any) => void) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved & Locked by Discipline Coordinator. Unlock required to edit.");
      return;
    }
    setter("");
    toast.info(`Cleared ${label}`);
  };

  // Sync state with active project
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    const projData = project.workspace_data?.sprinkler_density_data;
    if (projData) {
      if (projData.hazard) setHazard(projData.hazard);
      if (projData.customDens !== undefined) setCustomDens(projData.customDens);
      if (projData.customArea !== undefined) setCustomArea(projData.customArea);
      if (projData.coverage !== undefined) setCoverage(projData.coverage);
      if (projData.kFactor !== undefined) setKFactor(projData.kFactor);
      if (projData.unitSystem) setUnitSystem(projData.unitSystem);
    } else {
      const saved = localStorage.getItem(`mep_sprinkler_density_${project.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.hazard) setHazard(parsed.hazard);
          if (parsed.customDens !== undefined) setCustomDens(parsed.customDens);
          if (parsed.customArea !== undefined) setCustomArea(parsed.customArea);
          if (parsed.coverage !== undefined) setCoverage(parsed.coverage);
          if (parsed.kFactor !== undefined) setKFactor(parsed.kFactor);
          if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        } catch (e) {}
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId]);

  // Version History Restore Listener (Full parity with Ventilation & VersionManager)
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = `mep_sprinkler_density_${project?.id || "default"}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache && lsCache[pKey]) {
        try {
          restoredData = typeof lsCache[pKey] === "string" ? JSON.parse(lsCache[pKey]) : lsCache[pKey];
        } catch (err) {}
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey);
        if (stored) {
          try {
            restoredData = JSON.parse(stored);
          } catch (err) {}
        }
      }
      if (restoredData) {
        if (restoredData.hazard !== undefined) setHazard(restoredData.hazard);
        if (restoredData.customDens !== undefined) setCustomDens(restoredData.customDens);
        if (restoredData.customArea !== undefined) setCustomArea(restoredData.customArea);
        if (restoredData.coverage !== undefined) setCoverage(restoredData.coverage);
        if (restoredData.kFactor !== undefined) setKFactor(restoredData.kFactor);
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        toast.success("Sprinkler density parameters restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  // Save changes when modified
  useEffect(() => {
    if (!project?.id || !loadedProjectId || loadedProjectId !== project.id) return;
    const dataToSave = {
      hazard,
      customDens,
      customArea,
      coverage,
      kFactor,
      unitSystem,
    };
    try {
      localStorage.setItem(`mep_sprinkler_density_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    } catch (e) {}
  }, [hazard, customDens, customArea, coverage, kFactor, unitSystem, project?.id, loadedProjectId]);

  // Calculations
  const calcResults = useMemo(() => {
    return computeSprinklerDensityCalculations(hazard, customDens, customArea, coverage, kFactor, unitSystem);
  }, [hazard, customDens, customArea, coverage, kFactor, unitSystem]);

  // Get hazard display label
  const getHazardLabel = () => {
    const isSI = unitSystem === "si";
    switch (hazard) {
      case "0.10,1500":
        return isSI
          ? "Light Hazard (4.07 mm/min / 139 m²)"
          : "Light Hazard (0.10 gpm/ft² / 1,500 ft²)";
      case "0.15,1500":
        return isSI
          ? "Ordinary Hazard Group 1 (6.11 mm/min / 139 m²)"
          : "Ordinary Hazard Group 1 (0.15 gpm/ft² / 1,500 ft²)";
      case "0.20,1500":
        return isSI
          ? "Ordinary Hazard Group 2 (8.15 mm/min / 139 m²)"
          : "Ordinary Hazard Group 2 (0.20 gpm/ft² / 1,500 ft²)";
      case "0.30,2500":
        return isSI
          ? "Extra Hazard Group 1 (12.22 mm/min / 232 m²)"
          : "Extra Hazard Group 1 (0.30 gpm/ft² / 2,500 ft²)";
      case "0.40,2500":
        return isSI
          ? "Extra Hazard Group 2 (16.30 mm/min / 232 m²)"
          : "Extra Hazard Group 2 (0.40 gpm/ft² / 2,500 ft²)";
      default:
        return isSI
          ? `Custom Hazard (${(calcResults.densIP * 40.7458).toFixed(2)} mm/min / ${(calcResults.designAreaFt2 * 0.092903).toFixed(1)} m²)`
          : `Custom Hazard (${calcResults.densIP.toFixed(2)} gpm/ft² / ${calcResults.designAreaFt2.toFixed(0)} ft²)`;
    }
  };

  const getExportData = (): SprinklerDensityExportData => {
    const isSI = unitSystem === "si";
    const waterDurationMin = hazard.startsWith("0.10") ? 30 : (hazard.startsWith("0.30") || hazard.startsWith("0.40") ? 90 : 60);
    const flowGpm = calcResults.systemTotal;
    const totalStorageGal = flowGpm * waterDurationMin;
    const totalStorageM3 = totalStorageGal * 0.00378541;

    const densityVal = isSI ? calcResults.densIP * 40.7458 : calcResults.densIP;
    const designAreaVal = isSI ? calcResults.designAreaFt2 * 0.092903 : calcResults.designAreaFt2;
    const coverageVal = Number(coverage) || (isSI ? 12.1 : 130);
    const kFactorVal = Number(kFactor) || (isSI ? 80 : 5.6);
    const flowPerSprinkVal = isSI ? calcResults.flowPerSprink * 3.78541 : calcResults.flowPerSprink;
    const pressReqVal = isSI ? calcResults.pressReq * 0.0689476 : calcResults.pressReq;
    const totalSprinkFlowVal = isSI ? calcResults.totalSprinkFlow * 3.78541 : calcResults.totalSprinkFlow;
    const hoseAllowVal = isSI ? calcResults.hoseAllow * 3.78541 : calcResults.hoseAllow;
    const systemTotalVal = isSI ? calcResults.systemTotal * 3.78541 : calcResults.systemTotal;

    return {
      hazard,
      hazardLabel: getHazardLabel(),
      density: densityVal,
      densityUnit: isSI ? "mm/min" : "gpm/ft²",
      designArea: parseFloat(designAreaVal.toFixed(1)),
      designAreaUnit: isSI ? "m²" : "ft²",
      coverage: coverageVal,
      coverageUnit: isSI ? "m²" : "ft²",
      kFactor: kFactorVal,
      kFactorUnit: isSI ? "L/min/bar^0.5" : "gpm/psi^0.5",
      unitSystem,
      flowPerSprinkler: flowPerSprinkVal,
      pressureRequired: pressReqVal,
      pressureUnit: isSI ? "bar" : "psi",
      sprinklersCount: calcResults.nSprink,
      totalSprinklerFlow: totalSprinkFlowVal,
      flowUnit: isSI ? "L/min" : "GPM",
      hoseAllowance: hoseAllowVal,
      totalSystemDemand: systemTotalVal,
      waterDurationMin,
      totalStorageGallons: totalStorageGal,
      totalStorageM3,
      isPressureCompliant: calcResults.pressReq >= 7.0,
      isCoverageCompliant: calcResults.coverFt2 <= 225,
    };
  };

  // Export handlers
  const exportExcel = async () => {
    const exportData = getExportData();
    const meta = {
      calcNo: `TRV-CAL-SDF-${(project?.id || "0000").slice(-4).toUpperCase()}`,
      projectNo: project?.code || (project?.id ? project.id.slice(0, 8) : "P000"),
      projectName: project?.name || "Sprinkler Hydraulic Calculation",
      client: project?.client || "Consistent Engineering Consultants",
      endUser: project?.location || (project as any)?.endUser || "Main Complex",
      date: formatDateStr(new Date().toISOString()),
      userName: currentUserName,
      unitSystem,
    };
    await exportSprinklerDensityExcel(exportData, meta);
  };

  const exportPdf = async () => {
    const exportData = getExportData();
    const meta = {
      calcNo: `TRV-CAL-SDF-${(project?.id || "0000").slice(-4).toUpperCase()}`,
      projectNo: project?.code || (project?.id ? project.id.slice(0, 8) : "P000"),
      projectName: project?.name || "Sprinkler Hydraulic Calculation",
      client: project?.client || "Consistent Engineering Consultants",
      endUser: project?.location || (project as any)?.endUser || "Main Complex",
      date: formatDateStr(new Date().toISOString()),
      userName: currentUserName,
      unitSystem,
    };
    await exportSprinklerDensityPDF(exportData, meta);
  };

  const handleUnitToggle = (newUnit: "si" | "ip", shouldConvert: boolean) => {
    if (newUnit === unitSystem) return;
    setUnitSystem(newUnit);
    if (shouldConvert) {
      if (newUnit === "si") {
        if (coverage !== "") {
          setCoverage(parseFloat((Number(coverage) * 0.092903).toFixed(1)));
        }
        if (customDens !== "") {
          setCustomDens(parseFloat((Number(customDens) * 40.7458).toFixed(2)));
        }
        if (customArea !== "") {
          setCustomArea(parseFloat((Number(customArea) * 0.092903).toFixed(1)));
        }
        if (kFactor !== "") {
          setKFactor(parseFloat((Number(kFactor) * 14.288).toFixed(1)));
        }
      } else {
        if (coverage !== "") {
          setCoverage(parseFloat((Number(coverage) * 10.7639).toFixed(0)));
        }
        if (customDens !== "") {
          setCustomDens(parseFloat((Number(customDens) / 40.7458).toFixed(2)));
        }
        if (customArea !== "") {
          setCustomArea(parseFloat((Number(customArea) * 10.7639).toFixed(0)));
        }
        if (kFactor !== "") {
          setKFactor(parseFloat((Number(kFactor) / 14.288).toFixed(1)));
        }
      }
    }
  };

  const renderInputBox = (
    id: string,
    label: string,
    value: number | "",
    setter: (val: number | "") => void,
    unit: string,
    min?: number,
    max?: number,
    step?: number | string,
    defaultVal: number | "" = ""
  ) => {
    const itemComments = commentsList.filter(
      (c) => c.spaceId === id || c.targetId === id || c.itemId === id
    );
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-item-id={id}
            data-field-id={id}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditModalOpen(true);
            }}
            className={`border border-border rounded-2xl p-3.5 bg-background shadow-xs flex flex-col gap-2 transition cursor-context-menu group relative ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20"
                : ""
            }`}
          >
            <RowCommentCornerBadge count={itemComments.length} onClick={() => handleOpenComment(id, label)} />
            <RowCommentCornerBadge
              id={id}
              count={itemComments.length}
              onClick={() => handleOpenComment(id, label)}
              title={`${itemComments.length} comment(s)/task(s) assigned`}
            />
            <div className="flex justify-between items-baseline">
              <span className="flex items-center gap-1.5">
                <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">
                  {label}
                </label>
              </span>
              <span className="text-[11px] font-bold text-muted-foreground font-mono">
                {unit}
              </span>
            </div>
            <input
              id={id}
              disabled={isApprovedLocked}
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => setter(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
              className="h-9.5 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[12.5px] font-mono outline-none disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Parameters</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, value)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handlePasteValue(label, setter)}
            disabled={isApprovedLocked}
            className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg font-medium ${
              isApprovedLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleResetValue(label, setter, defaultVal)}
            disabled={isApprovedLocked}
            className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg font-medium ${
              isApprovedLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default ({defaultVal !== "" ? defaultVal : "Blank"})</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleClearValue(label, setter)}
            disabled={isApprovedLocked}
            className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg font-medium text-amber-600 dark:text-amber-400 ${
              isApprovedLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <Trash2 className="size-3.5" />
            <span>Clear Field</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderHazardSelect = () => {
    const id = "sprinkler-hazard-category";
    const label = "Hazard Category";
    const itemComments = commentsList.filter(
      (c) => c.spaceId === id || c.targetId === id || c.itemId === id
    );
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-item-id={id}
            data-field-id={id}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditModalOpen(true);
            }}
            className={`border border-border rounded-2xl p-3.5 bg-background shadow-xs flex flex-col gap-2 transition cursor-context-menu group ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20"
                : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span>{label}</span>
                
              </label>
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">Right-click for options</span>
            </div>
            <select
              id={id}
              disabled={isApprovedLocked}
              value={hazard}
              onChange={(e) => setHazard(e.target.value as HazardOpt)}
              className="w-full h-9.5 px-3 border border-border focus:border-primary rounded-xl bg-background text-[12.5px] outline-none font-medium cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
            >
              <option value="0.10,1500">Light Hazard - 0.10 GPM/ft² / 1500 ft²</option>
              <option value="0.15,1500">Ordinary Hazard Gp 1 - 0.15 / 1500 ft²</option>
              <option value="0.20,1500">Ordinary Hazard Gp 2 - 0.20 / 1500 ft²</option>
              <option value="0.30,2500">Extra Hazard Gp 1 - 0.30 / 2500 ft²</option>
              <option value="0.40,2500">Extra Hazard Gp 2 - 0.40 / 2500 ft²</option>
              <option value="custom">Custom Parameters...</option>
            </select>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Parameters</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, getHazardLabel())}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleResetValue(label, setHazard, "0.15,1500")}
            disabled={isApprovedLocked}
            className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg font-medium ${
              isApprovedLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default (Ordinary Hazard Gp 1)</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderKFactorSelect = () => {
    const id = "sprinkler-k-factor";
    const label = "Sprinkler K-Factor";
    const itemComments = commentsList.filter(
      (c) => c.spaceId === id || c.targetId === id || c.itemId === id
    );
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-item-id={id}
            data-field-id={id}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditModalOpen(true);
            }}
            className={`border border-border rounded-2xl p-3.5 bg-background shadow-xs flex flex-col gap-2 transition cursor-context-menu group ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20"
                : ""
            }`}
          >
            <div className="flex justify-between items-baseline">
              <span className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">
                  {label}
                </label>
                
              </span>
              <span className="text-[11px] font-bold text-muted-foreground font-mono">
                {unitSystem === "ip" ? "GPM/√psi" : "L/min/√bar"}
              </span>
            </div>
            <select
              id={id}
              disabled={isApprovedLocked}
              value={kFactor}
              onChange={(e) => setKFactor(parseFloat(e.target.value))}
              className="h-9.5 w-full px-3 border border-border focus:border-primary rounded-xl bg-background text-[12.5px] font-medium outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
            >
              {STANDARD_K_FACTORS.map((k) => (
                <option key={k} value={k}>
                  K-{k.toFixed(1)} {unitSystem === "si" ? `(${Math.round(k * 14.28)} SI)` : ""}
                </option>
              ))}
            </select>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Parameters</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, `K-${kFactor}`)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleResetValue(label, setKFactor, 5.6)}
            disabled={isApprovedLocked}
            className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg font-medium ${
              isApprovedLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default (K-5.6)</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderOutputTile = (
    id: string,
    label: string,
    valueDisplay: string,
    isPrimary: boolean = false,
    icon?: any
  ) => {
    const itemComments = commentsList.filter(
      (c) => c.spaceId === id || c.targetId === id || c.itemId === id
    );
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id;
    const IconComp = icon;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`res-${id}`}
            data-item-id={id}
            data-field-id={id}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditModalOpen(true);
            }}
            className={`p-3.5 flex justify-between items-center transition cursor-context-menu group ${
              isPrimary ? "bg-primary/5" : "bg-card"
            } ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20"
                : ""
            }`}
          >
            <RowCommentCornerBadge count={itemComments.length} onClick={() => handleOpenComment(id, label)} />
            <span className={`text-[13px] font-medium flex items-center gap-1.5 ${isPrimary ? "text-foreground font-bold" : "text-muted-foreground"}`}>
              {IconComp && <IconComp className={`size-3.5 ${isPrimary ? "text-red-500" : "text-primary"}`} />}
              <span>{label}</span>
              
            </span>
            <span className={`font-mono ${isPrimary ? "font-extrabold text-red-500 dark:text-red-400 text-[15px]" : "font-bold text-foreground text-[14px]"}`}>
              {valueDisplay}
            </span>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Parameters</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, valueDisplay)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderKpiCard = (
    id: string,
    label: string,
    mainValue: string,
    subValue: string,
    iconBg: string,
    iconColor: string,
    IconComp: any
  ) => {
    const itemComments = commentsList.filter(
      (c) => c.spaceId === id || c.targetId === id || c.itemId === id
    );
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`kpi-${id}`}
            data-item-id={id}
            data-field-id={id}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditModalOpen(true);
            }}
            className={`border border-border rounded-3xl p-4 bg-background shadow-xs flex items-center gap-4 hover:border-primary/20 transition-all cursor-context-menu group ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20"
                : ""
            }`}
          >
            <div className={`size-10 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
              <IconComp className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span>{label}</span>
                
              </span>
              <div className="text-[20px] font-extrabold font-mono text-foreground mt-0.5 truncate">
                {mainValue}
              </div>
              <span className="text-[10.5px] text-muted-foreground mt-0.5 block truncate">{subValue}</span>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Parameters</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, mainValue)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderReportTableRow = (
    id: string,
    label: string,
    valueNum: string | number,
    unit: string,
    isTotalRow?: boolean
  ) => {
    const itemComments = commentsList.filter(
      (c) => c.spaceId === id || c.targetId === id || c.itemId === id
    );
    const hasComments = itemComments.length > 0;
    const isTargetHighlighted = highlightedTargetId === id;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <tr
            id={`row-${id}`}
            data-item-id={id}
            data-field-id={id}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditModalOpen(true);
            }}
            className={`transition cursor-context-menu group ${
              isTotalRow ? "bg-surface/50 border-t border-border font-bold" : ""
            } ${
              isTargetHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20"
                : "hover:bg-muted/40"
            }`}
          >
            <td className={`py-2.5 relative ${isTotalRow ? "text-foreground" : "text-muted-foreground"}`}>
              <RowCommentCornerBadge count={itemComments.length} onClick={() => handleOpenComment(id, label)} />
              <span className="flex items-center gap-1.5">
                <span>{label}</span>
                
              </span>
            </td>
            <td className={`py-2.5 text-right font-mono font-bold ${isTotalRow ? "text-red-500 text-[14.5px]" : "text-foreground"}`}>
              {valueNum}
            </td>
            <td className="py-2.5 text-center text-muted-foreground">
              {unit}
            </td>
          </tr>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Parameters</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, `${valueNum} ${unit}`)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <AppShell
      title="Sprinkler Density & Flow"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sprinkler Density &amp; Flow</h1>
                  
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
                <CalculationReviewBar
                  projectId={project?.id || "default"}
                  calculatorPath="/plumbing-sprinkler-density"
                  calculatorTitle="Sprinkler Density & Flow"
                />
                {commentsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = commentsList[0];
                      handleOpenComment(first.targetId || "hazard-category", first.targetName || "Hazard Category");
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
                    title={`${commentsList.length} total active comment(s)/task(s)`}
                  >
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>{commentsList.length} Active {commentsList.length === 1 ? "Comment/Task" : "Comments/Tasks"}</span>
                  </button>
                )}
              </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitToggle}
                  disabled={isApprovedLocked}
                  inputDescriptions="Coverage, Design Density, Design Area, K-Factor"
                  conversionExample={
                    unitSystem === "si"
                      ? "Convert 130 sq ft → 12.1 m², 0.20 gpm/ft² → 8.15 mm/min, K-5.6 → K-80"
                      : "Convert 12.1 m² → 130 sq ft, 8.15 mm/min → 0.20 gpm/ft², K-80 → K-5.6"
                  }
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
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Density Sizer
                  </button>
                  <button
                    onClick={() => setTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
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
                  title="View NFPA 13 Formulas"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>
              </div>

              {/* Right Side Controls: Export & Unit System Toggle */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={exportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>

                
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4 w-full">
                  {/* Info Header Banner */}
                  <div className="flex items-center gap-3 p-3 bg-surface-2/50 border border-border rounded-xl shadow-2xs">
                    <Info className="size-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-foreground">NFPA 13 Density/Area Method</span>
                      <span className="text-[11.5px] text-muted-foreground font-medium">
                        Determine water flow and pressure demand from hazard category densities.
                      </span>
                    </div>
                  </div>

                  {/* Sizing inputs grid */}
                  {/* Sizing inputs grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {renderHazardSelect()}
                    {renderInputBox(
                      "sprinkler-coverage",
                      "Coverage Area / Head",
                      coverage,
                      setCoverage,
                      unitSystem === "ip" ? "ft²" : "m²",
                      unitSystem === "ip" ? 20 : 2,
                      unitSystem === "ip" ? 400 : 40,
                      undefined,
                      unitSystem === "ip" ? 130 : 12.1
                    )}
                    {renderKFactorSelect()}
                  </div>

                  {/* Custom Hazard Parameters */}
                  {hazard === "custom" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {renderInputBox(
                        "sprinkler-custom-dens",
                        "Custom Density",
                        customDens,
                        setCustomDens,
                        unitSystem === "ip" ? "GPM/ft²" : "mm/min",
                        0.01,
                        1.0,
                        0.01,
                        0.20
                      )}
                      {renderInputBox(
                        "sprinkler-custom-area",
                        "Custom Design Area",
                        customArea,
                        setCustomArea,
                        unitSystem === "ip" ? "ft²" : "m²",
                        100,
                        undefined,
                        50,
                        1500
                      )}
                    </div>
                  )}

                  {/* Calculated Outputs Summary - Fully visible, responsive grid */}
                  <div className="border border-border rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-2.5 border-b border-border/80 bg-surface-2/60 flex items-center justify-between">
                      <span className="text-[11.5px] font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Activity className="size-3.5 text-primary" />
                        Calculated Outputs Summary
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        NFPA 13 Hydraulic Demand
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/80">
                      {renderOutputTile("flow-per-head", "Flow rate per head", calcResults.formatFlow(calcResults.flowPerSprink))}
                      {renderOutputTile("min-press-req", "Min operating pressure", calcResults.formatPressure(calcResults.pressReq))}
                      {renderOutputTile("sprink-count", "Sprinkler count in area", `${calcResults.nSprink} heads`)}
                      {renderOutputTile("sprink-total-flow", "Sprinklers flow demand", calcResults.formatFlow(calcResults.totalSprinkFlow))}
                      {renderOutputTile("hose-allowance", "Hose stream allowance", calcResults.formatFlow(calcResults.hoseAllow))}
                      {renderOutputTile("total-water-demand", "Total water demand", calcResults.formatFlow(calcResults.systemTotal), true, Flame)}
                    </div>
                  </div>

                  {/* Warning Messages */}
                  {(calcResults.pressReq < 7 || calcResults.coverFt2 > 225) && (
                    <div className="flex flex-col gap-2">
                      {calcResults.pressReq < 7 && (
                        <div className="border border-destructive/25 bg-destructive/5 text-destructive rounded-2xl p-3 flex gap-2.5 items-center">
                          <AlertTriangle className="size-4 shrink-0 animate-pulse text-destructive" />
                          <div className="text-[12px] leading-snug">
                            <strong className="font-bold">Low Operating Pressure Violation:</strong> Required pressure ({calcResults.formatPressure(calcResults.pressReq)}) is below the NFPA 13 minimum of {unitSystem === "ip" ? "7.0 psi" : "0.48 bar"}. Sizing is invalid. Increase hazard density or use a smaller K-Factor.
                          </div>
                        </div>
                      )}
                      {calcResults.coverFt2 > 225 && (
                        <div className="border border-warning/25 bg-warning/5 text-warning-foreground rounded-2xl p-3 flex gap-2.5 items-center">
                          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                          <div className="text-[12px] text-amber-800 dark:text-amber-200 leading-snug">
                            <strong className="font-bold">Coverage Spacing Warning:</strong> Sprinkler coverage area ({calcResults.formatArea(calcResults.coverFt2)}) exceeds standard maximum spacing limit of {unitSystem === "ip" ? "225 ft²" : "20.9 m²"} per head. Verify listings for extended coverage heads.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* PRINTABLE REPORT PREVIEW TAB */}
            {tab === "report" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                  
                  <div className="flex justify-between items-start pb-4 border-b border-border">
                    <div>
                      <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                        Sprinkler Density & Flow Calculation Report
                      </h2>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Design Standards: NFPA 13 Standard for the Installation of Sprinkler Systems & Hydraulic Calculations
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TBtn onClick={() => window.print()}>
                        <Printer className="size-3.5" /> Print
                      </TBtn>
                      <TBtn onClick={exportPdf}>
                        <FileText className="size-3.5" /> Export
                      </TBtn>
                    </div>
                  </div>

                  {/* Enclosed Project Metadata Grid (3 rows x 2 cols) */}
                  <div className="border border-border rounded-xl overflow-hidden text-[12px]">
                    <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/20">
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Calculation No.:</span>
                        <span className="text-muted-foreground font-mono">TRV-CAL-SDF-{(project?.id || "0000").slice(-4).toUpperCase()}</span>
                      </div>
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Date:</span>
                        <span className="text-muted-foreground">{formatDateStr(new Date().toISOString())}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Project No.:</span>
                        <span className="text-muted-foreground">{project?.code || project?.id?.substring(0, 8) || "P000"}</span>
                      </div>
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Client:</span>
                        <span className="text-muted-foreground">{project?.client || "Consistent Engineering Consultants"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border bg-muted/10">
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">Project Name:</span>
                        <span className="text-muted-foreground font-semibold">{project?.name || "Sprinkler Hydraulic Calculation"}</span>
                      </div>
                      <div className="p-2.5 px-3 flex justify-between">
                        <span className="font-bold text-foreground">End User:</span>
                        <span className="text-muted-foreground">{project?.endUser || project?.location || "Main Complex"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Table 1: Sprinkler Sizing Parameters */}
                  <div className="space-y-2">
                    <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                      1. Sprinkler Sizing Parameters & Hydraulic Demand Breakdown
                    </h3>
                    <table className="w-full text-[12px] border-collapse border border-border">
                      <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                        <tr>
                          <th className="border border-border p-2 text-center w-10">Sr.</th>
                          <th className="border border-border p-2 text-left">Sprinkler Sizing Parameter</th>
                          <th className="border border-border p-2 text-left">Governing Formula / Rule</th>
                          <th className="border border-border p-2 text-center w-40">Calculated Value</th>
                          <th className="border border-border p-2 text-center w-24">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                          <td className="border border-border p-2 font-bold">Hazard Classification</td>
                          <td className="border border-border p-2 text-muted-foreground">NFPA 13 Standard</td>
                          <td className="border border-border p-2 text-center font-bold">{getHazardLabel()}</td>
                          <td className="border border-border p-2 text-center">-</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                          <td className="border border-border p-2 font-bold">Design Density (d)</td>
                          <td className="border border-border p-2 text-muted-foreground">NFPA 13 Density Curve</td>
                          <td className="border border-border p-2 text-center font-bold">{unitSystem === "si" ? (calcResults.densIP * 40.7458).toFixed(2) : calcResults.densIP.toFixed(2)}</td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "mm/min" : "gpm/ft²"}</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                          <td className="border border-border p-2 font-bold">Design Area of Operation (A_design)</td>
                          <td className="border border-border p-2 text-muted-foreground">NFPA 13 Area Curve</td>
                          <td className="border border-border p-2 text-center font-bold">{unitSystem === "si" ? (calcResults.designAreaFt2 * 0.092903).toLocaleString(undefined, { maximumFractionDigits: 1 }) : calcResults.designAreaFt2.toLocaleString()}</td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "m²" : "ft²"}</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                          <td className="border border-border p-2 font-bold">Sprinkler Coverage Area (A_cov)</td>
                          <td className="border border-border p-2 text-muted-foreground">Spacing Criterion</td>
                          <td className="border border-border p-2 text-center font-bold">{coverage}</td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "m²" : "ft²"}</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                          <td className="border border-border p-2 font-bold">Sprinkler Discharge Coefficient (K)</td>
                          <td className="border border-border p-2 text-muted-foreground">Standard Orifice</td>
                          <td className="border border-border p-2 text-center font-bold">K-{kFactor.toFixed(1)}</td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "L/min/bar^0.5" : "gpm/psi^0.5"}</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">6</td>
                          <td className="border border-border p-2 font-bold">Minimum Flow per Sprinkler (q = d &times; A_cov)</td>
                          <td className="border border-border p-2 text-muted-foreground">q = d &middot; A_cov</td>
                          <td className="border border-border p-2 text-center font-bold">{unitSystem === "si" ? (calcResults.flowPerSprink * 3.78541).toFixed(2) : calcResults.flowPerSprink.toFixed(2)}</td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "L/min" : "GPM"}</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">7</td>
                          <td className="border border-border p-2 font-bold">Minimum Operating Pressure (P = (q/K)&sup2;)</td>
                          <td className="border border-border p-2 text-muted-foreground">P = (q / K)&sup2;</td>
                          <td className="border border-border p-2 text-center font-bold">{unitSystem === "si" ? (calcResults.pressReq * 0.0689476).toFixed(2) : calcResults.pressReq.toFixed(2)}</td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "bar" : "psi"}</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">8</td>
                          <td className="border border-border p-2 font-bold">Number of Design Sprinklers (N)</td>
                          <td className="border border-border p-2 text-muted-foreground">N = ceil(A_design / A_cov)</td>
                          <td className="border border-border p-2 text-center font-bold">{calcResults.nSprink} Heads</td>
                          <td className="border border-border p-2 text-center">heads</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">9</td>
                          <td className="border border-border p-2 font-bold">Sprinkler System Flow Demand (Q_sprinkler)</td>
                          <td className="border border-border p-2 text-muted-foreground">Q_sp = d &middot; A_design</td>
                          <td className="border border-border p-2 text-center font-bold">{unitSystem === "si" ? (calcResults.totalSprinkFlow * 3.78541).toFixed(1) : calcResults.totalSprinkFlow.toFixed(1)}</td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "L/min" : "GPM"}</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">10</td>
                          <td className="border border-border p-2 font-bold">Inside Hose Stream Allowance (Q_hose)</td>
                          <td className="border border-border p-2 text-muted-foreground">NFPA 13 Table Allowance</td>
                          <td className="border border-border p-2 text-center font-bold">{unitSystem === "si" ? (calcResults.hoseAllow * 3.78541).toFixed(1) : calcResults.hoseAllow.toFixed(1)}</td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "L/min" : "GPM"}</td>
                        </tr>
                        <tr className="bg-[#DAE9F8] dark:bg-blue-950/50 text-blue-950 dark:text-blue-200 font-bold">
                          <td className="border border-border p-2 text-center">11</td>
                          <td className="border border-border p-2">TOTAL DESIGN WATER DEMAND (Q_total)</td>
                          <td className="border border-border p-2">Q_sp + Q_hose</td>
                          <td className="border border-border p-2 text-center text-[13px]">{unitSystem === "si" ? (calcResults.systemTotal * 3.78541).toFixed(1) : calcResults.systemTotal.toFixed(1)}</td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "L/min" : "GPM"}</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">12</td>
                          <td className="border border-border p-2 font-bold">Water Supply Duration</td>
                          <td className="border border-border p-2 text-muted-foreground">NFPA 13 Duration Requirement</td>
                          <td className="border border-border p-2 text-center font-bold">{hazard.startsWith("0.10") ? 30 : (hazard.startsWith("0.30") || hazard.startsWith("0.40") ? 90 : 60)} Minutes</td>
                          <td className="border border-border p-2 text-center">min</td>
                        </tr>
                        <tr className="bg-[#DAE9F8] dark:bg-blue-950/50 text-blue-950 dark:text-blue-200 font-bold">
                          <td className="border border-border p-2 text-center">13</td>
                          <td className="border border-border p-2">Required Fire Water Storage Capacity</td>
                          <td className="border border-border p-2">V = Q_total &times; Duration</td>
                          <td className="border border-border p-2 text-center text-[13px]">
                            {(() => {
                              const dur = hazard.startsWith("0.10") ? 30 : (hazard.startsWith("0.30") || hazard.startsWith("0.40") ? 90 : 60);
                              const gal = calcResults.systemTotal * dur;
                              return unitSystem === "si" ? `${(gal * 0.00378541).toFixed(1)} m³` : `${gal.toLocaleString()} Gallons`;
                            })()}
                          </td>
                          <td className="border border-border p-2 text-center">{unitSystem === "si" ? "m³" : "gal"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table 2: NFPA 13 Code Audit & Engineering Compliance */}
                  <div className="space-y-2">
                    <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                      2. NFPA 13 Code Audit & Engineering Compliance
                    </h3>
                    <table className="w-full text-[12px] border-collapse border border-border">
                      <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                        <tr>
                          <th className="border border-border p-2 text-center w-10">Sr.</th>
                          <th className="border border-border p-2 text-left w-56">NFPA 13 Code Audit Item</th>
                          <th className="border border-border p-2 text-center w-36">Calculated Value</th>
                          <th className="border border-border p-2 text-center w-44">Compliance Status</th>
                          <th className="border border-border p-2 text-left">Engineering Recommendations / Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                          <td className="border border-border p-2 font-bold">Minimum Operating Pressure Check</td>
                          <td className="border border-border p-2 text-center font-bold">{unitSystem === "si" ? (calcResults.pressReq * 0.0689476).toFixed(1) + " bar" : calcResults.pressReq.toFixed(1) + " psi"}</td>
                          <td className={`border border-border p-2 text-center font-bold ${calcResults.pressReq >= 7.0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                            {calcResults.pressReq >= 7.0
                              ? (unitSystem === "si" ? "COMPLIANT (>= 0.48 bar)" : "COMPLIANT (>= 7.0 psi)")
                              : (unitSystem === "si" ? "NON-COMPLIANT (< 0.48 bar)" : "NON-COMPLIANT (< 7.0 psi)")}
                          </td>
                          <td className="border border-border p-2 text-muted-foreground">
                            {calcResults.pressReq >= 7.0
                              ? "Meets NFPA 13 standard minimum nozzle discharge pressure criterion."
                              : `VIOLATION: Operating pressure is below minimum allowable ${unitSystem === "si" ? "0.48 bar (7.0 psi)" : "7.0 psi"}. Increase design density or decrease K-factor.`}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                          <td className="border border-border p-2 font-bold">Maximum Coverage Area Check</td>
                          <td className="border border-border p-2 text-center font-bold">{coverage} {unitSystem === "si" ? "m²" : "ft²"}</td>
                          <td className={`border border-border p-2 text-center font-bold ${calcResults.coverFt2 <= 225 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                            {calcResults.coverFt2 <= 225
                              ? (unitSystem === "si" ? "COMPLIANT (<= 20.9 m²)" : "COMPLIANT (<= 225 ft²)")
                              : (unitSystem === "si" ? "ATTENTION (> 20.9 m²)" : "ATTENTION (> 225 ft²)")}
                          </td>
                          <td className="border border-border p-2 text-muted-foreground">
                            {calcResults.coverFt2 <= 225
                              ? "Within standard maximum spacing limits for designated hazard classification."
                              : `Coverage exceeds standard ${unitSystem === "si" ? "20.9 m² (225 ft²)" : "225 ft²"} limit. Confirm extended coverage listing with manufacturer.`}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                          <td className="border border-border p-2 font-bold">Water Supply Demand Summary</td>
                          <td className="border border-border p-2 text-center font-bold">{unitSystem === "si" ? (calcResults.systemTotal * 3.78541).toFixed(1) + " L/min" : calcResults.systemTotal.toFixed(1) + " GPM"}</td>
                          <td className="border border-border p-2 text-center font-bold text-emerald-600 dark:text-emerald-400">VERIFIED</td>
                          <td className="border border-border p-2 text-muted-foreground">
                            Combined flow demand includes {unitSystem === "si" ? (calcResults.totalSprinkFlow * 3.78541).toFixed(1) + " L/min" : calcResults.totalSprinkFlow.toFixed(1) + " GPM"} sprinkler demand and {unitSystem === "si" ? (calcResults.hoseAllow * 3.78541).toFixed(1) + " L/min" : calcResults.hoseAllow.toFixed(1) + " GPM"} hose stream allowance.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table 3: 3-Tier Dynamic Engineering Signature Block */}
                  <div className="pt-2">
                    {(() => {
                      const sig = getSignatureBlockDetails(project?.id || "default", "/plumbing-sprinkler-density", currentUserName, calcReviewState);
                      return (
                        <div className="border border-border rounded-xl overflow-hidden text-[12px] shadow-2xs">
                          <div className="grid grid-cols-4 bg-[#FFE6CC] dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold border-b border-border text-center">
                            <div className="p-2 border-r border-border bg-muted/20">Designation</div>
                            <div className="p-2 border-r border-border">Originator</div>
                            <div className="p-2 border-r border-border">Reviewer</div>
                            <div className="p-2">Approver</div>
                          </div>
                          <div className="grid grid-cols-4 divide-x divide-border border-b border-border text-center">
                            <div className="p-2.5 font-bold text-right pr-3 bg-muted/10">Name:</div>
                            <div className="p-2.5 font-medium text-foreground">{sig.originatedName || currentUserName || "Design Engineer"}</div>
                            <div className="p-2.5 font-medium text-foreground">{sig.reviewerName || "-"}</div>
                            <div className="p-2.5 font-medium text-foreground">{sig.approverName || "-"}</div>
                          </div>
                          <div className="grid grid-cols-4 divide-x divide-border border-b border-border text-center">
                            <div className="p-2.5 font-bold text-right pr-3 bg-muted/10">Role:</div>
                            <div className="p-2.5 text-muted-foreground">Design Engineer</div>
                            <div className="p-2.5 text-muted-foreground">Sr. Design Engineer</div>
                            <div className="p-2.5 text-muted-foreground">Discipline Coordinator</div>
                          </div>
                          <div className="grid grid-cols-4 divide-x divide-border text-center">
                            <div className="p-2.5 font-bold text-right pr-3 bg-muted/10">Date:</div>
                            <div className="p-2.5 text-muted-foreground">{sig.originatedDate || formatDateStr(new Date().toISOString())}</div>
                            <div className="p-2.5 text-muted-foreground">{sig.reviewerDate || "-"}</div>
                            <div className="p-2.5 text-muted-foreground">{sig.approverDate || "-"}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Intelligence Side Drawer */}
        <div
          className={`shrink-0 bg-background overflow-hidden transition-[width] duration-300 ease-out select-none no-print print:hidden ${
            intelOpen ? "w-[360px] border-l border-border" : "w-0"
          }`}
        >
          {intelOpen && (
            <div className="w-[360px] h-full flex flex-col min-h-0 bg-background font-sans">
              <div className="flex items-center justify-between p-4 border-b border-border bg-header-bg shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4.5 text-primary" />
                  <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Live Intelligence</h3>
                </div>
                <button 
                  onClick={() => setIntelOpen(false)} 
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-surface-2 cursor-pointer transition-colors"
                  title="Close Live Intelligence"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {/* 1. Live Sizing Compliance Card */}
                <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                      <Activity className="size-4 text-primary" /> System Compliance Audit
                    </span>
                    {calcResults.pressReq >= 7 && calcResults.coverFt2 <= 225 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-success/15 text-success border border-success/30">
                        <Check className="size-3" /> Compliant
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                        <AlertTriangle className="size-3" /> Attention
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Pressure audit item */}
                    <div className={`p-3 rounded-2xl border text-[12px] flex flex-col gap-1.5 ${
                      calcResults.pressReq < 7 
                        ? "border-destructive/20 bg-destructive/5" 
                        : calcResults.pressReq > 35 
                        ? "border-warning/20 bg-warning/5" 
                        : "border-success/20 bg-success/5"
                    }`}>
                      <div className="flex items-start gap-2">
                        {calcResults.pressReq < 7 ? (
                          <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                        ) : calcResults.pressReq > 35 ? (
                          <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground">
                            Operating Pressure: {calcResults.pressReq.toFixed(1)} psi
                          </div>
                          <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">
                            {calcResults.pressReq < 7 ? (
                              "Below NFPA 13 minimum 7.0 psi rule. The system violates code standards."
                            ) : calcResults.pressReq > 35 ? (
                              "Operating pressure is elevated (>35 psi). May require heavier pump duty."
                            ) : (
                              "Optimal operating pressure within standard 7.0 to 35.0 psi range."
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Auto-Fix Actions */}
                      {!isApprovedLocked && calcResults.pressReq < 7 && (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                          <button
                            onClick={() => setKFactor(4.2)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Set K-4.2 (Fix Pressure)
                          </button>
                        </div>
                      )}
                      {!isApprovedLocked && calcResults.pressReq > 35 && (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                          <button
                            onClick={() => setKFactor(8.0)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Upgrade to K-8.0
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Coverage area audit item */}
                    <div className={`p-3 rounded-2xl border text-[12px] flex flex-col gap-1.5 ${
                      calcResults.coverFt2 > 225 
                        ? "border-warning/20 bg-warning/5" 
                        : "border-success/20 bg-success/5"
                    }`}>
                      <div className="flex items-start gap-2">
                        {calcResults.coverFt2 > 225 ? (
                          <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground">
                            Coverage Area: {calcResults.coverFt2.toFixed(0)} ft²
                          </div>
                          <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-normal">
                            {calcResults.coverFt2 > 225 ? (
                              "Exceeds standard 225 ft² limit. Extended coverage listings required."
                            ) : (
                              "Within NFPA 13 standard maximum spacing limit per head."
                            )}
                          </div>
                        </div>
                      </div>

                      {!isApprovedLocked && calcResults.coverFt2 > 225 && (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                          <button
                            onClick={() => setCoverage(unitSystem === "ip" ? 130 : 12.1)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg cursor-pointer shadow-xs transition-colors"
                          >
                            Set Standard 130 ft²
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. NFPA 13 Standard Hazard Reference Matrix */}
                <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex flex-col gap-2.5">
                  <h4 className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5">
                    <Droplet className="size-4 text-primary" /> NFPA 13 Hazard Criteria Table
                  </h4>
                  <div className="text-[11px] text-muted-foreground flex flex-col gap-1.5">
                    <div className="grid grid-cols-3 gap-1 p-1.5 rounded-lg bg-surface-2/60 font-mono text-[10.5px]">
                      <span className="font-bold text-foreground">Hazard</span>
                      <span className="font-bold text-foreground text-center">Density / Area</span>
                      <span className="font-bold text-foreground text-right">Hose Allowance</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 border-b border-border/40 text-[10.5px]">
                      <span className="font-medium text-foreground">Light</span>
                      <span className="text-center font-mono">0.10 / 1500</span>
                      <span className="text-right font-mono">100 GPM</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 border-b border-border/40 text-[10.5px]">
                      <span className="font-medium text-foreground">Ord. Gp 1</span>
                      <span className="text-center font-mono">0.15 / 1500</span>
                      <span className="text-right font-mono">250 GPM</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 border-b border-border/40 text-[10.5px]">
                      <span className="font-medium text-foreground">Ord. Gp 2</span>
                      <span className="text-center font-mono">0.20 / 1500</span>
                      <span className="text-right font-mono">250 GPM</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 border-b border-border/40 text-[10.5px]">
                      <span className="font-medium text-foreground">Extra Gp 1</span>
                      <span className="text-center font-mono">0.30 / 2500</span>
                      <span className="text-right font-mono">500 GPM</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-1.5 py-1 text-[10.5px]">
                      <span className="font-medium text-foreground">Extra Gp 2</span>
                      <span className="text-center font-mono">0.40 / 2500</span>
                      <span className="text-right font-mono">500 GPM</span>
                    </div>
                  </div>
                </div>

                {/* 3. Mathematical Formula Breakdown Card */}
                <div className="border border-border rounded-3xl p-4 bg-background shadow-xs flex flex-col gap-2">
                  <h4 className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5">
                    <Flame className="size-4 text-red-500" /> Governing Formulas
                  </h4>
                  <ul className="text-[11px] text-muted-foreground list-disc pl-4 flex flex-col gap-1 font-mono bg-surface-2/40 p-2.5 rounded-xl border border-border/50 leading-normal">
                    <li>Discharge per head: <strong>q = d × A_cov</strong></li>
                    <li>Pressure required: <strong>P = (q / K)²</strong></li>
                    <li>Heads in design area: <strong>N = ⌈A_des / A_cov⌉</strong></li>
                    <li>Sprinkler demand: <strong>Q_sp = d × A_design</strong></li>
                    <li>System total: <strong>Q_tot = Q_sp + Q_hose</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="parameter"
          calculatorTitle="Sprinkler Density & Flow"
          calculatorPath="/plumbing-sprinkler-density"
          existingComments={commentsList.filter(
            (c) =>
              c.spaceId === commentTargetItem.id ||
              c.targetId === commentTargetItem.id ||
              c.itemId === commentTargetItem.id
          )}
          onSave={handleSaveComment}
        />
      )}

      {editModalOpen && (
        <EditSprinklerModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSaveSprinklerModal}
          currentData={{
            hazard,
            customDens,
            customArea,
            coverage,
            kFactor,
            unitSystem,
          }}
          isApprovedLocked={isApprovedLocked}
        />
      )}

      {/* NFPA 13 Formula Breakdown Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 flex flex-col gap-4 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <HelpCircle className="size-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">NFPA 13 Sprinkler Density & Flow Equations</h3>
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
                <div className="font-bold text-primary">1. Single Sprinkler Flow Rate (q)</div>
                <p className="text-muted-foreground">
                  Flow per sprinkler head based on hazard design density and head coverage area:
                </p>
                <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                  {"q = Density (d) × Coverage Area (A_cov)   [GPM or L/min]"}
                </div>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                <div className="font-bold text-primary">2. Required Operating Pressure (P)</div>
                <p className="text-muted-foreground">
                  Minimum discharge pressure required at the sprinkler head orifice:
                </p>
                <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                  {"P = (q / K)²   [psi or bar, min 7.0 psi / 0.48 bar]"}
                </div>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                <div className="font-bold text-primary">3. Total System Sprinkler Demand (Q_sprinkler)</div>
                <p className="text-muted-foreground">
                  Total simultaneous water demand over the designated remote hydraulic design area:
                </p>
                <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                  {"Q_sprinkler = Density (d) × Design Area (A_design)   [GPM or L/min]"}
                </div>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                <div className="font-bold text-primary">4. Total Combined Water Supply Demand (Q_total)</div>
                <p className="text-muted-foreground">
                  Combined water supply including inside & outside hose stream allowance per NFPA 13:
                </p>
                <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                  {"Q_total = Q_sprinkler + Q_hose_allowance   [GPM or L/min]"}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
