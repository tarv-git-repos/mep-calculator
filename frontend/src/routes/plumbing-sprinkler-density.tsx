import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
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
import { EditSprinklerModal, type SprinklerFormData } from "@/components/workspace/EditSprinklerModal";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { toast } from "sonner";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/plumbing-sprinkler-density")({
  head: () => ({
    meta: [
      { title: "Sprinkler Density & Flow — MEP Calc" },
      { name: "description", content: "Calculate sprinkler flow rates from design density, design area, and sprinkler K-factor per NFPA 13." },
    ],
  }),
  component: SprinklerDensityPage,
});

type HazardOpt = "0.10,1500" | "0.15,1500" | "0.20,1500" | "0.30,2500" | "0.40,2500" | "custom";

const STANDARD_K_FACTORS = [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];

function SprinklerDensityPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-sprinkler-density", project?.id);
  const [calcReviewState, setCalcReviewState] = useState<any>({ status: "DRAFT" });

  // Tabs
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);

  // Input states
  const [hazard, setHazard] = useState<HazardOpt>("0.15,1500");
  const [customDens, setCustomDens] = useState<number | "">(0.20);
  const [customArea, setCustomArea] = useState<number | "">(1500);
  const [coverage, setCoverage] = useState<number | "">(130);
  const [kFactor, setKFactor] = useState(5.6);
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("ip");
  const [editModalOpen, setEditModalOpen] = useState(false);

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
    const customDensVal = customDens === "" ? 0 : customDens;
    const customAreaVal = customArea === "" ? 0 : customArea;
    const coverageVal = coverage === "" ? 0 : coverage;

    let dens = 0.15;
    let designArea = 1500;

    if (hazard === "custom") {
      dens = customDensVal;
      designArea = customAreaVal;
    } else {
      const parts = hazard.split(",");
      dens = parseFloat(parts[0]);
      designArea = parseFloat(parts[1]);
    }

    const ip = unitSystem === "ip";
    // Convert to IP if SI is selected (SI: mm/min and m²)
    // mm/min -> GPM/ft²: divide by 40.74
    // m² -> ft²: multiply by 10.7639
    const densIP = ip ? dens : dens / 40.74;
    const coverFt2 = ip ? coverageVal : coverageVal * 10.7639;
    const designAreaFt2 = ip ? designArea : designArea * 10.7639;

    const flowPerSprink = densIP * coverFt2; // GPM
    const pressReq = Math.pow(flowPerSprink / kFactor, 2); // psi
    const nSprink = coverFt2 > 0 ? Math.ceil(designAreaFt2 / coverFt2) : 0;
    const totalSprinkFlow = densIP * designAreaFt2; // GPM

    // Hose stream allowance: LH=100, OH=250, EH=500 GPM
    const hoseAllow = densIP <= 0.10 ? 100 : densIP <= 0.20 ? 250 : 500;
    const systemTotal = totalSprinkFlow + hoseAllow;

    // Unit conversions for display
    const formatFlow = (gpm: number) => {
      return ip ? `${gpm.toFixed(1)} GPM` : `${(gpm * 0.06309).toFixed(2)} L/s`;
    };

    const formatPressure = (psi: number) => {
      return ip ? `${psi.toFixed(1)} psi` : `${(psi * 0.0689476).toFixed(2)} bar`;
    };

    const formatArea = (ft2: number) => {
      return ip ? `${ft2.toFixed(0)} ft²` : `${(ft2 / 10.7639).toFixed(1)} m²`;
    };

    const formatDens = (gpmft2: number) => {
      return ip ? `${gpmft2.toFixed(3)} GPM/ft²` : `${(gpmft2 * 40.74).toFixed(2)} mm/min`;
    };

    return {
      densIP,
      coverFt2,
      designAreaFt2,
      flowPerSprink,
      pressReq,
      nSprink,
      totalSprinkFlow,
      hoseAllow,
      systemTotal,
      formatFlow,
      formatPressure,
      formatArea,
      formatDens
    };
  }, [hazard, customDens, customArea, coverage, kFactor, unitSystem]);

  // Get hazard display label
  const getHazardLabel = () => {
    switch (hazard) {
      case "0.10,1500": return "Light Hazard (0.10 gpm/ft² / 1,500 ft²)";
      case "0.15,1500": return "Ordinary Hazard Group 1 (0.15 gpm/ft² / 1,500 ft²)";
      case "0.20,1500": return "Ordinary Hazard Group 2 (0.20 gpm/ft² / 1,500 ft²)";
      case "0.30,2500": return "Extra Hazard Group 1 (0.30 gpm/ft² / 2,500 ft²)";
      case "0.40,2500": return "Extra Hazard Group 2 (0.40 gpm/ft² / 2,500 ft²)";
      default: return `Custom Hazard (${calcResults.densIP.toFixed(2)} gpm/ft² / ${calcResults.designAreaFt2} ft²)`;
    }
  };

  const getExportData = (): SprinklerDensityExportData => {
    const isSI = unitSystem === "si";
    const waterDurationMin = hazard.startsWith("0.10") ? 30 : (hazard.startsWith("0.30") || hazard.startsWith("0.40") ? 90 : 60);
    const flowGpm = calcResults.systemTotal;
    const totalStorageGal = flowGpm * waterDurationMin;
    const totalStorageM3 = totalStorageGal * 0.00378541;

    return {
      hazard,
      hazardLabel: getHazardLabel(),
      density: isSI ? calcResults.densIP * 40.7458 : calcResults.densIP,
      densityUnit: isSI ? "mm/min" : "gpm/ft²",
      designArea: isSI ? calcResults.designAreaFt2 * 0.092903 : calcResults.designAreaFt2,
      designAreaUnit: isSI ? "m²" : "ft²",
      coverage: Number(coverage) || (isSI ? 12 : 130),
      coverageUnit: isSI ? "m²" : "ft²",
      kFactor,
      kFactorUnit: isSI ? "L/min/bar^0.5" : "gpm/psi^0.5",
      unitSystem,
      flowPerSprinkler: isSI ? calcResults.flowPerSprink * 3.78541 : calcResults.flowPerSprink,
      pressureRequired: isSI ? calcResults.pressReq * 0.0689476 : calcResults.pressReq,
      pressureUnit: isSI ? "bar" : "psi",
      sprinklersCount: calcResults.nSprink,
      totalSprinklerFlow: isSI ? calcResults.totalSprinkFlow * 3.78541 : calcResults.totalSprinkFlow,
      flowUnit: isSI ? "L/min" : "GPM",
      hoseAllowance: isSI ? calcResults.hoseAllow * 3.78541 : calcResults.hoseAllow,
      totalSystemDemand: isSI ? calcResults.systemTotal * 3.78541 : calcResults.systemTotal,
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
      calcNo: `TRV-CAL-SDF-${project?.code || "001"}`,
      projectNo: project?.code || "CALC-001",
      projectName: project?.name || "Sprinkler Hydraulic Calculation",
      client: project?.client || "Consistent Engineering Consultants",
      endUser: project?.location || project?.name || "Main Complex",
      date: new Date().toLocaleDateString("en-GB"),
      userName: currentUserName,
      unitSystem,
    };
    await exportSprinklerDensityExcel(exportData, meta);
  };

  const exportPdf = async () => {
    const exportData = getExportData();
    const meta = {
      calcNo: `TRV-CAL-SDF-${project?.code || "001"}`,
      projectNo: project?.code || "CALC-001",
      projectName: project?.name || "Sprinkler Hydraulic Calculation",
      client: project?.client || "Consistent Engineering Consultants",
      endUser: project?.location || project?.name || "Main Complex",
      date: new Date().toLocaleDateString("en-GB"),
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
          setCoverage(parseFloat((Number(coverage) / 10.7639).toFixed(1)));
        }
        if (customDens !== "") {
          setCustomDens(parseFloat((Number(customDens) * 40.7458).toFixed(2)));
        }
        if (customArea !== "") {
          setCustomArea(parseFloat((Number(customArea) / 10.7639).toFixed(1)));
        }
        if (kFactor) {
          setKFactor(parseFloat((Number(kFactor) * 14.28).toFixed(1)));
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
        if (kFactor) {
          setKFactor(parseFloat((Number(kFactor) / 14.28).toFixed(1)));
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
            className={`border border-border rounded-2xl p-3.5 bg-background shadow-xs flex flex-col gap-2 transition cursor-context-menu group ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20"
                : ""
            }`}
          >
            <div className="flex justify-between items-baseline">
              <span className="flex items-center gap-1.5">
                <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">
                  {label}
                </label>
                {hasComments && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComment(id, label);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                    title={`${itemComments.length} comment(s)/task(s) assigned`}
                  >
                    <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                    <span>{itemComments.length}</span>
                  </button>
                )}
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
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
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
                {hasComments && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComment(id, label);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                    title={`${itemComments.length} comment(s)/task(s) assigned`}
                  >
                    <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                    <span>{itemComments.length}</span>
                  </button>
                )}
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
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
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
                {hasComments && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComment(id, label);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                    title={`${itemComments.length} comment(s)/task(s) assigned`}
                  >
                    <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                    <span>{itemComments.length}</span>
                  </button>
                )}
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
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
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
            <span className={`text-[13px] font-medium flex items-center gap-1.5 ${isPrimary ? "text-foreground font-bold" : "text-muted-foreground"}`}>
              {IconComp && <IconComp className={`size-3.5 ${isPrimary ? "text-red-500" : "text-primary"}`} />}
              <span>{label}</span>
              {hasComments && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenComment(id, label);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                  title={`${itemComments.length} comment(s)/task(s) assigned`}
                >
                  <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                  <span>{itemComments.length}</span>
                </button>
              )}
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
            <span>{hasComments ? `View Comments (${itemComments.length})` : "Add Comment / Task"}</span>
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
                {hasComments && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComment(id, label);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                    title={`${itemComments.length} comment(s)/task(s) assigned`}
                  >
                    <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                    <span>{itemComments.length}</span>
                  </button>
                )}
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
            <span>{hasComments ? `View Comments (${itemComments.length})` : "Add Comment / Task"}</span>
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
            <td className={`py-2.5 ${isTotalRow ? "text-foreground" : "text-muted-foreground"}`}>
              <span className="flex items-center gap-1.5">
                <span>{label}</span>
                {hasComments && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComment(id, label);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                    title={`${itemComments.length} comment(s)/task(s) assigned`}
                  >
                    <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                    <span>{itemComments.length}</span>
                  </button>
                )}
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
            <span>{hasComments ? `View Comments (${itemComments.length})` : "Add Comment / Task"}</span>
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
                  <span className="text-[15px] font-semibold text-muted-foreground">NFPA 13 density/area</span>
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
                  onReviewStateChange={setCalcReviewState}
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
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Preliminary NFPA 13 sprinkler water density, design area, and water supply sizing schedule.
              </p>
            </div>
            
            {/* Unit Switcher */}
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
            isApprovedLocked
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setTab("solver")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "solver"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Calculator
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

            {/* Sizing Report summary */}
            {tab === "report" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6 w-full">
                {/* Toolbar */}
                <div className="flex justify-between items-center pb-4 border-b border-border">
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground">Sprinkler Density & Demand Report</h3>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5">Summary of NFPA 13 preliminary water supply requirements.</p>
                  </div>
                  <div className="flex items-center gap-2 no-print print:hidden">
                    <button
                      onClick={exportPdf}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-[12.5px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs transition-all active:scale-95"
                    >
                      <FileText className="size-3.5 text-white" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>

                {/* Four KPI cards */}
                <div className="grid grid-cols-4 gap-4">
                  {renderKpiCard("report-design-area", "Design Area", calcResults.formatArea(calcResults.designAreaFt2), `${calcResults.nSprink} heads in area`, "bg-blue-500/10", "text-blue-500", Grid)}
                  {renderKpiCard("report-flow-head", "Discharge / Head", calcResults.formatFlow(calcResults.flowPerSprink), `K-${kFactor} coefficient`, "bg-red-500/10", "text-red-500", Droplet)}
                  {renderKpiCard("report-press-req", "Pressure Required", `${calcResults.pressReq.toFixed(1)} psi`, "At remote sprinkler", "bg-sky-500/10", "text-amber-500", Activity)}
                  {renderKpiCard("report-system-total", "Total Water Supply", calcResults.formatFlow(calcResults.systemTotal), "With hose allowance", "bg-emerald-500/10", "text-emerald-500", Flame)}
                </div>

                {/* Two Column Layout: Parameters (left) and Audit Sidebar (right) */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  
                  {/* Left Column: Sizing Parameters table */}
                  <div className="flex-1 min-w-0 w-full border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-2/15 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-foreground">Sprinkler Sizing Parameters Preview</span>
                      <span className="text-[11px] text-muted-foreground font-mono">NFPA 13</span>
                    </div>
                    <div className="p-4 flex flex-col gap-4 text-[13px] text-foreground">
                      <div className="grid grid-cols-2 gap-y-2 border-b border-border pb-3">
                        <div>Project Code: <span className="font-semibold font-mono">{project?.code || "CALC-001"}</span></div>
                        <div>Project Name: <span className="font-semibold">{project?.name || "MEP Project"}</span></div>
                        <div>Client Name: <span className="font-semibold">{project?.client || "Client"}</span></div>
                        <div>Hazard Sized: <span className="font-semibold capitalize">{hazard === "custom" ? "Custom" : hazard}</span></div>
                      </div>

                      <table className="w-full text-left border-collapse text-[12.5px]">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                            <th className="py-2.5">Sizing Parameter</th>
                            <th className="py-2.5 text-right">Value</th>
                            <th className="py-2.5 text-center">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium">
                          {renderReportTableRow("preview-design-density", "Design Density", calcResults.formatDens(calcResults.densIP).split(" ")[0], calcResults.formatDens(calcResults.densIP).split(" ").slice(1).join(" "))}
                          {renderReportTableRow("preview-design-area", "Design Area", calcResults.formatArea(calcResults.designAreaFt2).split(" ")[0], calcResults.formatArea(calcResults.designAreaFt2).split(" ").slice(1).join(" "))}
                          {renderReportTableRow("preview-coverage", "Coverage per Sprinkler", coverage, unitSystem === "ip" ? "ft²" : "m²")}
                          {renderReportTableRow("preview-kfactor", "Sprinkler K-Factor", kFactor, "gpm/psi⁰·⁵")}
                          {renderReportTableRow("preview-flow-sprinkler", "Flow Rate per Sprinkler", calcResults.formatFlow(calcResults.flowPerSprink).split(" ")[0], calcResults.formatFlow(calcResults.flowPerSprink).split(" ").slice(1).join(" "))}
                          {renderReportTableRow("preview-sprink-count", "Sprinkler Count in Area", calcResults.nSprink, "heads")}
                          {renderReportTableRow("preview-sprink-flow", "Sprinkler Flow Demand", calcResults.formatFlow(calcResults.totalSprinkFlow).split(" ")[0], calcResults.formatFlow(calcResults.totalSprinkFlow).split(" ").slice(1).join(" "))}
                          {renderReportTableRow("preview-hose-allow", "Hose Allowance (NFPA 13)", calcResults.formatFlow(calcResults.hoseAllow).split(" ")[0], calcResults.formatFlow(calcResults.hoseAllow).split(" ").slice(1).join(" "))}
                          {renderReportTableRow("preview-system-total", "Total Water Supply Demand", calcResults.formatFlow(calcResults.systemTotal).split(" ")[0], calcResults.formatFlow(calcResults.systemTotal).split(" ").slice(1).join(" "), true)}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Audits & Recommendations */}
                  <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-4">
                    {/* Compliance Auditor Card */}
                    {(() => {
                      const hasLowPressure = calcResults.pressReq < 7.0;
                      const hasOverCoverage = calcResults.coverFt2 > 225;
                      
                      if (hasLowPressure) {
                        return (
                          <div className="border border-destructive/20 bg-destructive/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <h4 className="text-[13px] font-bold text-destructive">NFPA 13 Code Warning</h4>
                              <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                                Required sprinkler pressure is {calcResults.pressReq.toFixed(1)} psi, which is below the NFPA 13 code minimum limit of 7.0 psi. System is non-compliant.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (hasOverCoverage) {
                        return (
                          <div className="border border-warning/20 bg-warning/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                            <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-[13px] font-bold text-warning">Coverage Area Alert</h4>
                              <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                                Sprinkler coverage area ({calcResults.coverFt2.toFixed(0)} ft²) exceeds the standard maximum limit of 225 ft² per head. Check listings for extended coverage.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="border border-success/20 bg-success/5 rounded-3xl p-4 flex gap-3 shadow-xs">
                          <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[13px] font-bold text-success">NFPA 13 Sizing Audit</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 leading-normal">
                              System meets sizing code guidelines. Pressure and coverage requirements comply with general NFPA 13 design criteria.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Recommendation details card */}
                    <div className="border border-border rounded-3xl bg-background p-5 shadow-sm flex flex-col gap-3.5">
                      <p className="text-[13px] font-bold text-foreground leading-snug flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-primary" /> Sizing Recommendations
                      </p>
                      <div className="text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-2.5">
                        {calcResults.pressReq > 35 && (
                          <div className="p-2.5 rounded bg-muted/65 border border-border text-foreground">
                            Operating pressure is very high ({calcResults.pressReq.toFixed(1)} psi). Changing to a larger sprinkler coefficient (e.g. K-8.0 or K-11.2) is recommended to decrease friction loss.
                          </div>
                        )}
                        {calcResults.pressReq < 7 && (
                          <div className="p-2.5 rounded bg-destructive/5 border border-destructive/10 text-foreground">
                            Decrease sprinkler K-Factor (e.g. K-4.2) or increase design density to raise pressure above 7.0 psi.
                          </div>
                        )}
                        {calcResults.pressReq >= 7 && calcResults.pressReq <= 35 && (
                          <div className="p-2.5 rounded bg-success/5 border border-success/10 text-foreground">
                            Operating pressure is optimal ({calcResults.pressReq.toFixed(1)} psi). No adjustments required.
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1 border-t border-border pt-2 leading-normal">
                          Always check sprinkler manufacturer datasheets for exact listing criteria and k-factor coefficients.
                        </div>
                      </div>
                    </div>
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
    </AppShell>
  );
}
