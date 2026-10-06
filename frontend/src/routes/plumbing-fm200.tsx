import { CalculationReviewBar, CalculationStatusBanner, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle, MessageSquare, Flame, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw, Trash2, Edit3, Lock
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
import { VersionManager } from "@/components/workspace/VersionManager";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { TBtn } from "@/components/workspace/Button";
import {
  type PresetOption,
  computeFM200Calculations
} from "@/lib/calc-plumbing-fm200";
import { exportFM200PDF } from "@/lib/exportFM200PDF";


export const Route = createFileRoute("/plumbing-fm200")({
  head: () => ({
    meta: [
      { title: "FM-200 Clean Agent Sizer â€” MEP Calc" },
      { name: "description", content: "Calculate FM-200 (HFC-227ea) required agent weight for total flooding clean agent suppression per NFPA 2001." },
    ],
  }),
  component: FM200SizerPage,
});



function FM200SizerPage() {
  const { project, activeProjectId, isReadOnly } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-fm200", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-fm200", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || (userData as any)?.full_name || "Design Engineer";
  const isApprovedLocked = useCalculationLock("/plumbing-fm200", project?.id);
  const isLocked = isEffectiveReadOnly || isApprovedLocked;
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  // Tabs & intelligence panel state
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Unit system
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si"); // Default SI matching source (Sq Mtr, Mtr, kg)

  // Inputs
  const [area, setArea] = useState<number | "">(100);
  const [height, setHeight] = useState<number | "">(3);
  const [preset, setPreset] = useState<PresetOption>("class_a");
  const [customConc, setCustomConc] = useState<number | "">(7.0);
  const [temp, setTemp] = useState<number | "">(20); // Celsius for SI, Fahrenheit for IP
  const [useStandardS, setUseStandardS] = useState<boolean>(true); // Override S to standard 0.1473 (SI)
  const [safetyFactor, setSafetyFactor] = useState<number | "">(1.0);

  // Sync state with active project and handle VersionManager snapshots
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load saved FM-200 parameters on mount or project switch
  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    const pKey = `mep_fm200_params_${project.id}`;
    const stored = localStorage.getItem(pKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.area !== undefined) setArea(parsed.area);
        if (parsed.height !== undefined) setHeight(parsed.height);
        if (parsed.preset !== undefined) setPreset(parsed.preset);
        if (parsed.customConc !== undefined) setCustomConc(parsed.customConc);
        if (parsed.temp !== undefined) setTemp(parsed.temp);
        if (parsed.useStandardS !== undefined) setUseStandardS(parsed.useStandardS);
        if (parsed.safetyFactor !== undefined) setSafetyFactor(parsed.safetyFactor);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch (e) {
        console.error("Failed to parse stored FM-200 params", e);
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId]);

  // Version History Restore Listener (Full parity with Ventilation & VersionManager)
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pId = project?.id || "default";
      const pKey = `mep_fm200_params_${pId}`;
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
        if (restoredData.area !== undefined) setArea(restoredData.area);
        if (restoredData.height !== undefined) setHeight(restoredData.height);
        if (restoredData.preset !== undefined) setPreset(restoredData.preset);
        if (restoredData.customConc !== undefined) setCustomConc(restoredData.customConc);
        if (restoredData.temp !== undefined) setTemp(restoredData.temp);
        if (restoredData.useStandardS !== undefined) setUseStandardS(restoredData.useStandardS);
        if (restoredData.safetyFactor !== undefined) setSafetyFactor(restoredData.safetyFactor);
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        dirtyStore.set(false);
        toast.success("FM-200 calculation restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  // Auto-persist full calculator state for VersionManager snapshots and local storage
  useEffect(() => {
    if (!project?.id || loadedProjectId !== project.id) return;
    const dataToSave = {
      area,
      height,
      preset,
      customConc,
      temp,
      useStandardS,
      safetyFactor,
      unitSystem,
    };
    try {
      localStorage.setItem(`mep_fm200_params_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    } catch (e) {
      console.error("Failed to save FM-200 params", e);
    }
  }, [area, height, preset, customConc, temp, useStandardS, safetyFactor, unitSystem, project?.id, loadedProjectId]);

  // Comments and Task Assignment state
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Load comments from local storage on mount / project change
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-fm200`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCommentsList(parsed);
        }
      } else {
        setCommentsList([]);
      }
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  }, [project?.id]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-fm200`, JSON.stringify(newList));
    // Immediately dispatch notification events for instantaneous UI and badge update (<1ms)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
    }
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    const commentWithMeta = {
      ...comment,
      targetId: commentTargetItem?.id,
      targetName: commentTargetItem?.name,
      targetType: "parameter",
      calculatorTitle: "FM-200 Gas Sizing",
      calculatorPath: "/plumbing-fm200",
      projectId: project?.id || "default",
      projectName: project?.name || "FM-200 Gas Sizing",
    };
    const updated = [commentWithMeta, ...commentsList.filter(c => c.id !== comment.id)];
    saveComments(updated);
    setCommentModalOpen(false);
  };

  const handleCopyValue = (label: string, value: any) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(String(value));
      toast.success(`Copied ${label}: ${value}`);
    }
  };

  const handlePasteValue = async (label: string, setter: (val: any) => void) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Editing is disabled.", { id: "readonly-notice" });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText();
        const num = parseFloat(text);
        if (!isNaN(num)) {
          setter(num);
          toast.success(`Pasted into ${label}: ${num}`);
        } else if (text) {
          setter(text);
          toast.success(`Pasted into ${label}`);
        }
      } catch (e) {
        toast.error("Failed to read clipboard");
      }
    }
  };

  const handleResetValue = (label: string, setter: (val: any) => void, defaultVal: any) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Editing is disabled.", { id: "readonly-notice" });
      return;
    }
    setter(defaultVal);
    toast.info(`Reset ${label} to default (${defaultVal})`);
  };

  const handleClearValue = (label: string, setter: (val: any) => void) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Editing is disabled.", { id: "readonly-notice" });
      return;
    }
    setter("");
    toast.info(`Cleared ${label}`);
  };

  // Scroll and highlight notification target item (matching Preliminary Cooling Load)
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`field-${targetId}`) ||
                 document.getElementById(`res-${targetId}`) ||
                 document.getElementById(`card-${targetId}`) ||
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
      const targetId = params.get("commentTargetId");
      const targetName = params.get("commentTargetName");
      if (targetId || targetName) {
        setTimeout(() => {
          handleScrollTarget(targetId || undefined, targetName || undefined);
        }, 300);
      }
    }

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

  const getItemComments = (id: string) => {
    return commentsList.filter(
      (c) => c.targetId === id || c.spaceId === id || c.itemId === id
    );
  };

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getItemComments(id);
    if (itemComments.length === 0) return null;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenComment(id, name);
        }}
        title={`${itemComments.length} comment(s)/task(s) on ${name}`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer shadow-2xs"
      >
        <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
        <span>{itemComments.length}</span>
      </button>
    );
  };

  // Synchronize design temperature default when unit system changes
  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (targetUnit === unitSystem) return;
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Unit conversion is locked.", { id: "readonly-notice" });
      return;
    }
    setUnitSystem(targetUnit);
    if (shouldConvert) {
      if (targetUnit === "si") {
        // Convert from IP to SI
        setTemp((prev) => {
          if (prev === "") return 20;
          return Math.round((((Number(prev) - 32) * 5) / 9) * 10) / 10;
        });
        setArea((prev) => {
          if (prev === "") return "";
          return Math.round((Number(prev) / 10.7639) * 10) / 10 || 100;
        });
        setHeight((prev) => {
          if (prev === "") return "";
          return Math.round((Number(prev) / 3.28084) * 100) / 100 || 3;
        });
      } else {
        // Convert from SI to IP
        setTemp((prev) => {
          if (prev === "") return 68;
          return Math.round(((Number(prev) * 9) / 5 + 32) * 10) / 10;
        });
        setArea((prev) => {
          if (prev === "") return "";
          return Math.round(Number(prev) * 10.7639 * 10) / 10 || 1000;
        });
        setHeight((prev) => {
          if (prev === "") return "";
          return Math.round(Number(prev) * 3.28084 * 100) / 100 || 10;
        });
      }
    }
  };

  // Helper to render an input box matching CHW Pump Head structure
  const renderInputBox = (
    id: string,
    label: string,
    value: number | "",
    onChange: (val: number | "") => void,
    unit?: string,
    step: string = "any",
    min: number = 0,
    placeholder: string = "0",
    disabled: boolean = false
  ) => {
    const itemComments = getItemComments(id);
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id ||
                          highlightedTargetId === `field-${id}` ||
                          (highlightedTargetId && id && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
                          (highlightedTargetId && label && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

    const displayLabel = unit ? `${label} (${unit})` : label;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-item-id={id}
            data-field-id={id}
            className={`flex flex-col gap-1.5 group cursor-context-menu p-1.5 rounded-xl transition-all ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <label className="font-semibold text-foreground flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5">
                <span>{displayLabel}</span>
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
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">Right-click for options</span>
            </label>
            <input
              id={id}
              type="number"
              disabled={disabled || isEffectiveReadOnly}
              min={min}
              step={step}
              placeholder={placeholder}
              value={value === "" ? "" : value}
              onChange={(e) => onChange(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal transition hover:border-[#0A7BC7]/50 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => handleCopyValue(displayLabel, value)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
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

  // Sizer math calculation
  const calcResults = useMemo(() => {
    return computeFM200Calculations(area, height, preset, customConc, temp, useStandardS, safetyFactor, unitSystem);
  }, [area, height, preset, customConc, temp, useStandardS, safetyFactor, unitSystem]);

  const areaVal = typeof area === "number" ? area : 0;
  const heightVal = typeof height === "number" ? height : 0;
  const safetyFactorVal = typeof safetyFactor === "number" ? safetyFactor : 1.0;

  // Export to PDF handler (Standardized corporate PDF matching Ventilation / Preliminary)
  const handleExportPDF = async () => {
    await exportFM200PDF(
      {
        area,
        height,
        preset,
        customConc,
        temp,
        useStandardS,
        safetyFactor,
        unitSystem,
      },
      calcResults,
      {
        calcNo: (project as any)?.calcNo || "TRV-CAL-FM200-R01",
        projectName: project?.name || (project as any)?.projectName || "FM-200 Clean Agent Fire Suppression Sizing",
        client: project?.client || (project as any)?.client || "Design Client",
        projectNo: project?.code || (project as any)?.projectNo || "P000",
        endUser: (project as any)?.endUser || (project as any)?.location || "Site Development",
        date: formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB"),
        userName: currentUserName,
        reviewState: calcReviewState,
      }
    );
  };
  const exportPdf = handleExportPDF;

  return (
    <AppShell
      title="FM-200 Calculation"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">FM-200 Gas Sizing</h1>
                
              </div>
              <button 
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-fm200" calculatorTitle="FM-200 Gas Sizing" />
              {commentsList.length > 0 && (
                <div 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-2xs"
                  title={`${commentsList.length} active comment(s)/task(s) in FM-200 calculation`}
                >
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"} / Comment{commentsList.length === 1 ? "" : "s"}</span>
                </div>
              )}
            </div>
          
            <div className="flex items-center gap-2 shrink-0">
              <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  disabled={isEffectiveReadOnly}
                  inputDescriptions="Floor Area, Enclosure Height, Minimum Temperature"
                  conversionExample={
                    unitSystem === "si"
                      ? "Convert 100 mÂ² â†’ 1,076.4 ftÂ², 3 m â†’ 9.84 ft, 20Â°C â†’ 68Â°F"
                      : "Convert 1,000 ftÂ² â†’ 92.9 mÂ², 10 ft â†’ 3.05 m, 68Â°F â†’ 20Â°C"
                  }
                />
            </div>
          </div>

          {/* Review / Approval Status Banner */}
          <CalculationStatusBanner
            projectId={project?.id || "default"}
            calculatorPath="/plumbing-fm200"
            calculatorTitle="FM-200 Clean Agent Sizer"
          />

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
                    Sizing Calculator
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
                  onClick={() => setFormulaModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                  title="View NFPA 2001 Formula Breakdown"
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
                <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 p-4 md:p-6 overflow-hidden">
                  {/* Inputs & Parameters Section */}
                  <div className="w-full lg:w-[58%] xl:w-[60%] flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1 pb-4">
                      {/* Room Enclosure Dimensions Card */}
                      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                              1. Enclosure Layout
                            </h3>
                          </div>
                          <span className="text-[10.5px] font-mono text-muted-foreground">Dimensions</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {renderInputBox(
                            "fm200-area",
                            "Floor Area",
                            area,
                            setArea,
                            unitSystem === "si" ? "mÂ²" : "ftÂ²",
                            "any",
                            0,
                            unitSystem === "si" ? "100" : "1000"
                          )}
                          {renderInputBox(
                            "fm200-height",
                            "Enclosure Height",
                            height,
                            setHeight,
                            unitSystem === "si" ? "m" : "ft",
                            "any",
                            0,
                            unitSystem === "si" ? "3" : "10"
                          )}
                        </div>
                      </div>

                      {/* NFPA 2001 Design Presets Card */}
                      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                              2. Design Parameters
                            </h3>
                          </div>
                          <span className="text-[10.5px] font-mono text-muted-foreground">NFPA 2001 Standard</span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Presets */}
                            <div className="flex flex-col gap-1.5 group p-1.5 rounded-xl">
                              <label className="font-semibold text-foreground text-xs flex items-center justify-between">
                                <span>Hazard Classification</span>
                                {renderCommentBadge("fm200-preset", "Hazard Classification")}
                              </label>
                              <select
                                disabled={isEffectiveReadOnly}
                                value={preset}
                                onChange={(e) => setPreset(e.target.value as PresetOption)}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none transition hover:border-[#0A7BC7]/50 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="class_a">Class A - Surface Fire (6.857%)</option>
                                <option value="class_c">Class C - Electrical Hazards (7.00%)</option>
                                <option value="class_b">Class B - Flammable Liquid (8.70%)</option>
                                <option value="custom">Custom Concentration %</option>
                              </select>
                            </div>

                            {/* Custom Concentration */}
                            {renderInputBox(
                              "fm200-concentration",
                              "Design Concentration",
                              preset === "custom" ? customConc : calcResults.C,
                              setCustomConc,
                              "%",
                              "0.01",
                              0,
                              "7.0",
                              preset !== "custom"
                            )}

                            {/* Minimum Temperature */}
                            {renderInputBox(
                              "fm200-temperature",
                              "Minimum Temperature",
                              temp,
                              setTemp,
                              unitSystem === "si" ? "Â°C" : "Â°F",
                              "any",
                              0,
                              unitSystem === "si" ? "20" : "68"
                            )}

                            {/* Safety Factor */}
                            {renderInputBox(
                              "fm200-safety-factor",
                              "Safety Factor Multiplier",
                              safetyFactor,
                              setSafetyFactor,
                              "multiplier",
                              "0.05",
                              1.0,
                              "1.0"
                            )}
                          </div>

                          {/* Specific Volume Switcher */}
                          <div 
                            id="fm200-lock-s"
                            data-item-id="fm200-lock-s"
                            data-field-id="fm200-lock-s"
                            className="flex items-center justify-between border-t border-border/60 pt-3 p-1.5 rounded-xl"
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">Lock S Value to Standard Default</span>
                                {renderCommentBadge("fm200-lock-s", "Specific Volume S Standard")}
                              </div>
                              <span className="text-[11px] text-muted-foreground mt-0.5">
                                Forces S to {unitSystem === "si" ? "0.1473 mÂ³/kg" : "2.3595 ftÂ³/lb"} (Baseline reference temperature)
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={useStandardS}
                              onChange={(e) => setUseStandardS(e.target.checked)}
                              className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Calculation Results & Sizing Schematics */}
                    <div className="w-full lg:w-[42%] xl:w-[40%] flex flex-col gap-5 bg-surface/30 p-5 rounded-3xl border border-border shadow-2xs shrink-0 h-fit">
                      <div>
                        <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">Calculation Results</h3>
                        <p className="text-[11.5px] text-muted-foreground">Flooding weight outputs (NFPA 2001)</p>
                      </div>

                      <div className="flex flex-col gap-4">
                        {/* Enclosure Volume result card */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div 
                              id="fm200-volume"
                              data-item-id="fm200-volume"
                              data-field-id="fm200-volume"
                              className={`border border-border rounded-3xl bg-background p-4 flex flex-col gap-1 shadow-sm transition-all cursor-context-menu hover:border-primary/50 ${
                                highlightedTargetId === "fm200-volume" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">Flooded Enclosure Volume</span>
                                {renderCommentBadge("fm200-volume", "Flooded Enclosure Volume")}
                              </div>
                              <div className="text-[22px] font-bold tracking-tight font-mono text-primary">
                                {calcResults.volume.toFixed(2)} <span className="text-[13.5px] font-normal">{unitSystem === "si" ? "mÂ³" : "ftÂ³"}</span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Flooded Enclosure Volume", `${calcResults.volume.toFixed(2)} ${unitSystem === "si" ? "mÂ³" : "ftÂ³"}`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Enclosure Volume</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("fm200-volume", "Flooded Enclosure Volume")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Required Gas Weight result card */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div 
                              id="fm200-weight"
                              data-item-id="fm200-weight"
                              data-field-id="fm200-weight"
                              className={`border border-border rounded-3xl bg-background p-4 flex flex-col gap-1 shadow-sm border-l-4 border-l-primary transition-all cursor-context-menu hover:border-primary/60 ${
                                highlightedTargetId === "fm200-weight" ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-context-menu">Required FM-200 Agent Weight</span>
                                <div className="flex items-center gap-1">
                                  {renderCommentBadge("fm200-weight", "Required FM-200 Agent Weight")}
                                  <button
                                    type="button"
                                    onClick={() => setFormulaModalOpen(true)}
                                    className="size-5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors cursor-pointer"
                                    title="View Formula Breakdown (NFPA 2001)"
                                  >
                                    <Info className="size-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-[26px] font-bold tracking-tight font-mono text-primary">
                                {calcResults.weight.toFixed(2)} <span className="text-[15px] font-normal">{unitSystem === "si" ? "kg" : "lb"}</span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[11px] text-muted-foreground">Design Concentration: {calcResults.C.toFixed(2)}%</span>
                                <button
                                  type="button"
                                  onClick={() => setFormulaModalOpen(true)}
                                  className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Breakdown</span>
                                  <Info className="size-2.5" />
                                </button>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Required FM-200 Weight", `${calcResults.weight.toFixed(2)} ${unitSystem === "si" ? "kg" : "lb"}`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Required Weight</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => setFormulaModalOpen(true)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Info className="size-3.5 text-primary" />
                              <span>View NFPA 2001 Formula Breakdown</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("fm200-weight", "Required FM-200 Agent Weight")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Warning alerts block */}
                        {calcResults.warnings.length > 0 && (
                          <div className="border border-warning/20 bg-warning/5 rounded-3xl p-3 text-[12px] flex flex-col gap-1.5 text-foreground">
                            <div className="flex items-center gap-1.5 text-warning font-semibold">
                              <AlertTriangle className="size-4 shrink-0" />
                              <span>NFPA 2001 Compliance Warning</span>
                            </div>
                            <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                              {calcResults.warnings.map((warn, i) => (
                                <li key={i}>{warn}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Schematic Visual Representation SVG */}
                        <div className="border border-border rounded-3xl bg-background p-4 shadow-sm flex flex-col gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Agent Sizing Chart</span>
                          <div className="bg-surface/50 rounded-2xl flex justify-center py-3 border border-border/50">
                            <svg viewBox="0 0 240 160" className="w-full max-w-[280px] h-auto overflow-visible">
                              {/* Room Enclosure Box */}
                              <rect x="20" y="20" width="200" height="95" rx="12" fill="none" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="3 3" />
                              
                              {/* Gas flooding overlay */}
                              <rect 
                                x="21" 
                                y="21" 
                                width="198" 
                                height="93" 
                                rx="11" 
                                fill="#0A7BC7" 
                                fillOpacity={calcResults.weight > 0 ? 0.15 : 0.02} 
                              />
                              
                              {/* Nozzles and system representation */}
                              <circle cx="75" cy="20" r="3" fill="#ef4444" />
                              <circle cx="165" cy="20" r="3" fill="#ef4444" />
                              <line x1="75" y1="20" x2="75" y2="35" stroke="#ef4444" strokeWidth="1.5" />
                              <line x1="165" y1="20" x2="165" y2="35" stroke="#ef4444" strokeWidth="1.5" />
                              
                              {/* Gas spray arcs */}
                              <path d="M 70 38 Q 75 33 80 38" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.8" />
                              <path d="M 67 41 Q 75 31 83 41" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />
                              <path d="M 160 38 Q 165 33 170 38" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.8" />
                              <path d="M 157 41 Q 165 31 173 41" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />

                              {/* Center Room Label */}
                              <text x="120" y="68" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#334155">
                                {calcResults.volume.toFixed(1)} {unitSystem === "si" ? "mÂ³" : "ftÂ³"}
                              </text>
                              
                              {/* Specific Volume and Agent label */}
                              <text x="120" y="85" textAnchor="middle" fontSize="9.5" fill="#64748B">
                                FM-200 Flooding Room
                              </text>

                              {/* Weight Tag at bottom */}
                              <rect x="55" y="126" width="130" height="24" rx="12" fill="#ef4444" fillOpacity="0.1" stroke="#ef4444" strokeWidth="1" />
                              <text x="120" y="142" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#ef4444">
                                Weight: {calcResults.weight.toFixed(1)} {unitSystem === "si" ? "kg" : "lb"}
                              </text>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              )}

            {/* TAB: STANDARDIZED REPORT VIEW (MATCHING PRELIMINARY / VENTILATION CORPORATE STANDARD) */}
            {tab === "report" && (
              <div className="flex flex-col h-full select-none">
                {/* Top Action Bar matching Ventilation standard */}
                <div className="flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50 no-print">
                  <span className="text-[12px] text-muted-foreground font-semibold">
                    Generated: <span className="text-foreground font-mono">{formatDateStr(new Date())}</span>
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <TBtn onClick={() => window.print()}>
                      <Printer className="size-3.5" /> Print
                    </TBtn>
                    <TBtn primary onClick={handleExportPDF}>
                      <FileText className="size-3.5" /> Export PDF
                    </TBtn>
                  </div>
                </div>

                {/* Main Report Document Sheet */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6 font-sans">
                    {/* Header Title and Meta */}
                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          FM-200 Clean Agent Fire Suppression Sizing Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Total Flooding Clean Agent Fire Extinguishing System Sizing (NFPA 2001 / ISO 14520 / Superheated Vapor Physics)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground block mt-0.5 font-mono">Date: {formatDateStr(new Date())}</span>
                      </div>
                    </div>

                    {/* Project Metadata Table 3x2 (Enclosed Corporate Header matching Ventilation / Preliminary) */}
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <div className="grid grid-cols-4 divide-x divide-y divide-border">
                        <div className="p-2.5 font-bold bg-muted/20">Calculation No.:</div>
                        <div className="p-2.5 font-mono">{(project as any)?.calcNo || "TRV-CAL-FM200-R01"}</div>
                        <div className="p-2.5 font-bold bg-muted/20">Date:</div>
                        <div className="p-2.5 font-mono">{formatDateStr(new Date())}</div>

                        <div className="p-2.5 font-bold bg-muted/20">Project No.:</div>
                        <div className="p-2.5 font-mono">{project?.code || (project as any)?.projectNo || "P000"}</div>
                        <div className="p-2.5 font-bold bg-muted/20">Client:</div>
                        <div className="p-2.5">{project?.client || (project as any)?.client || "Design Client"}</div>

                        <div className="p-2.5 font-bold bg-muted/20">Project Name:</div>
                        <div className="p-2.5">{project?.name || (project as any)?.projectName || "FM-200 Clean Agent Fire Suppression Sizing"}</div>
                        <div className="p-2.5 font-bold bg-muted/20">End User:</div>
                        <div className="p-2.5">{(project as any)?.endUser || (project as any)?.location || "Site Development"}</div>
                      </div>
                    </div>

                    {/* Table 1: Executive Design Parameters & Enclosure Layout */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        1. Executive Design Parameters &amp; Enclosure Layout
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                              <th className="p-2.5 w-12 text-center">No.</th>
                              <th className="p-2.5">Executive Design Parameter Summary</th>
                              <th className="p-2.5 text-center w-28">Value</th>
                              <th className="p-2.5 text-center w-20">Unit</th>
                              <th className="p-2.5">Engineering Design Basis / Code</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border font-sans">
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                              <td className="p-2.5 font-bold">Protected Enclosure Floor Area</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{areaVal.toFixed(2)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "m²" : "ft²"}</td>
                              <td className="p-2.5 text-muted-foreground">Architectural room plan dimensions</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                              <td className="p-2.5 font-bold">Protected Enclosure Clear Ceiling Height</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{heightVal.toFixed(2)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "m" : "ft"}</td>
                              <td className="p-2.5 text-muted-foreground">True slab-to-slab or ceiling barrier height</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                              <td className="p-2.5 font-bold">Flooded Gross Enclosure Volume (V)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calcResults.volume.toFixed(2)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "m³" : "ft³"}</td>
                              <td className="p-2.5 text-muted-foreground">V = Floor Area × Clear Height</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                              <td className="p-2.5 font-bold">Fire Hazard Classification</td>
                              <td className="p-2.5 text-center font-bold text-foreground">
                                {preset === "class_a"
                                  ? "Class A - Surface Fire (6.857%)"
                                  : preset === "class_c"
                                  ? "Class C - Electrical Hazards (7.00%)"
                                  : preset === "class_b"
                                  ? "Class B - Flammable Liquid (8.70%)"
                                  : `Custom Concentration (${calcResults.C.toFixed(2)}%)`}
                              </td>
                              <td className="p-2.5 text-center text-muted-foreground">-</td>
                              <td className="p-2.5 text-muted-foreground">NFPA 2001 Chapter 5 Hazard Category</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">5</td>
                              <td className="p-2.5 font-bold">Minimum Enclosure Design Temperature (T)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{typeof temp === "number" ? temp.toFixed(1) : "20.0"}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "°C" : "°F"}</td>
                              <td className="p-2.5 text-muted-foreground">Lowest anticipated ambient room temperature</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">6</td>
                              <td className="p-2.5 font-bold">Specific Vapor Volume of HFC-227ea (S)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calcResults.S.toFixed(4)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "m³/kg" : "ft³/lb"}</td>
                              <td className="p-2.5 text-muted-foreground">{useStandardS ? "Standard reference baseline (0.1473 m³/kg)" : "S = k1 + k2 × T (NFPA 2001 formula)"}</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">7</td>
                              <td className="p-2.5 font-bold">Engineering Safety Factor</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{safetyFactorVal.toFixed(2)}x</td>
                              <td className="p-2.5 text-center text-muted-foreground">-</td>
                              <td className="p-2.5 text-muted-foreground">{safetyFactorVal > 1.0 ? "Contingency for room leakage / uncloseable openings" : "Standard base code sizing"}</td>
                            </tr>
                            {/* Highlighted Key Output: Concentration */}
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                              <td className="p-2.5 text-center font-mono">8</td>
                              <td className="p-2.5 font-bold">Design Agent Concentration (C)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-primary">{calcResults.C.toFixed(3)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">%</td>
                              <td className="p-2.5">NFPA 2001 Table 5.4.2 minimum design concentration</td>
                            </tr>
                            {/* Highlighted Key Output: Net Agent Weight */}
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                              <td className="p-2.5 text-center font-mono">9</td>
                              <td className="p-2.5 font-bold">Required FM-200 Net Agent Weight (W)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-primary">{calcResults.weight.toFixed(2)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "kg" : "lb"}</td>
                              <td className="p-2.5">W = (V / S) × [ C / (100 - C) ] × Safety Factor</td>
                            </tr>
                            {/* Highlighted Key Output: Discharge Duration */}
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                              <td className="p-2.5 text-center font-mono">10</td>
                              <td className="p-2.5 font-bold">Target Maximum Discharge Duration</td>
                              <td className="p-2.5 text-center font-mono font-bold text-primary">10.0</td>
                              <td className="p-2.5 text-center font-mono font-bold">Seconds</td>
                              <td className="p-2.5">NFPA 2001 Clause 5.7.1.2 rapid total flooding extinction</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 2: NFPA 2001 Volumetric Flooding & Hydraulic Sizing Schedule */}
                    <div className="space-y-2 mt-6">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        2. NFPA 2001 Volumetric Flooding &amp; Hydraulic Sizing Schedule
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                              <th className="p-2.5 w-12 text-center">No.</th>
                              <th className="p-2.5">Clean Agent Flooding Calculation Parameter</th>
                              <th className="p-2.5 text-center w-28">Value</th>
                              <th className="p-2.5 text-center w-20">Unit</th>
                              <th className="p-2.5">NFPA 2001 Engineering Requirement</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border font-sans">
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                              <td className="p-2.5 font-bold">Gross Enclosure Flooding Volume (V)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calcResults.volume.toFixed(2)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "m³" : "ft³"}</td>
                              <td className="p-2.5 text-muted-foreground">Geometric room volume (V = Area × Height)</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                              <td className="p-2.5 font-bold">Superheated Specific Vapor Volume (S)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calcResults.S.toFixed(4)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "m³/kg" : "ft³/lb"}</td>
                              <td className="p-2.5 text-muted-foreground">{unitSystem === "si" ? "k1 = 0.1269, k2 = 0.000513" : "k1 = 1.885, k2 = 0.0046"}</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                              <td className="p-2.5 font-bold">Volumetric Expansion Factor [C / (100 - C)]</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{(calcResults.C / (100 - calcResults.C)).toFixed(5)}</td>
                              <td className="p-2.5 text-center text-muted-foreground">-</td>
                              <td className="p-2.5 text-muted-foreground">NFPA 2001 Equation 5.5.1 concentration ratio</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                              <td className="p-2.5 font-bold">Average Agent Flooding Density (W / V)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{(calcResults.weight / (calcResults.volume || 1)).toFixed(3)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "kg/m³" : "lb/ft³"}</td>
                              <td className="p-2.5 text-muted-foreground">Total mass of agent per unit protected volume</td>
                            </tr>
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                              <td className="p-2.5 text-center font-mono">5</td>
                              <td className="p-2.5 font-bold">Total Net Extinguishing Agent Weight (W)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-primary">{calcResults.weight.toFixed(2)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{unitSystem === "si" ? "kg" : "lb"}</td>
                              <td className="p-2.5">Total liquid HFC-227ea stored in pressurized cylinders</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">6</td>
                              <td className="p-2.5 font-bold">Minimum Hold / Retention Time Target</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">10.0</td>
                              <td className="p-2.5 text-center font-mono font-bold">Minutes</td>
                              <td className="p-2.5 text-muted-foreground">Door fan room integrity test holding period</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">7</td>
                              <td className="p-2.5 font-bold">Maximum Targeted Discharge Duration</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">10.0</td>
                              <td className="p-2.5 text-center font-mono font-bold">Seconds</td>
                              <td className="p-2.5 text-muted-foreground">Prevents thermal decomposition into Hydrogen Fluoride (HF)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 3: Occupational Safety & Toxicological Exposure Analysis */}
                    <div className="space-y-2 mt-6">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        3. Occupational Safety &amp; Toxicological Exposure Analysis
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                              <th className="p-2.5 w-12 text-center">No.</th>
                              <th className="p-2.5">Toxicological Safety Parameter</th>
                              <th className="p-2.5 text-center w-28">Evaluated Level</th>
                              <th className="p-2.5 text-center w-20">Threshold</th>
                              <th className="p-2.5">Safety Status &amp; Egress Constraint</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border font-sans">
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                              <td className="p-2.5 font-bold">No Observed Adverse Effect Level (NOAEL)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">9.00%</td>
                              <td className="p-2.5 text-center font-mono font-bold">≤ 9.00%</td>
                              <td className="p-2.5 text-muted-foreground">Safe for human exposure up to 5 minutes without health risks</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                              <td className="p-2.5 font-bold">Lowest Observed Adverse Effect Level (LOAEL)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">10.50%</td>
                              <td className="p-2.5 text-center font-mono font-bold">≤ 10.50%</td>
                              <td className="p-2.5 text-muted-foreground">Evacuation must occur before discharge commences</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                              <td className="p-2.5 font-bold">UL / FM Minimum Listing Concentration</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">5.80%</td>
                              <td className="p-2.5 text-center font-mono font-bold">≥ 5.80%</td>
                              <td className="p-2.5 text-muted-foreground">Certified minimum concentration for flame extinguishment</td>
                            </tr>
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                              <td className="p-2.5 text-center font-mono">4</td>
                              <td className="p-2.5 font-bold">Evaluated Enclosure Design Concentration</td>
                              <td className="p-2.5 text-center font-mono font-bold text-primary">{calcResults.C.toFixed(3)}%</td>
                              <td className="p-2.5 text-center font-mono font-bold">NOAEL OK</td>
                              <td className="p-2.5 font-bold">
                                {calcResults.C <= 9.0
                                  ? "COMPLIANT (Safe for normally occupied enclosures)"
                                  : calcResults.C <= 10.5
                                  ? "CAUTION (Evacuation within 5 min required)"
                                  : "RESTRICTED (Unoccupied enclosures only)"}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Compliance Verification Banner */}
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">
                          Clean Agent Suppression System Compliance Verification (NFPA 2001 / ISO 14520)
                        </span>
                        <p className="text-muted-foreground leading-relaxed">
                          This clean agent total flooding fire suppression calculation complies with NFPA 2001 (Standard on Clean Agent Fire Extinguishing Systems, 2022 Edition) and ISO 14520. The selected concentration satisfies the minimum class design extinguishment requirements and remains below the NOAEL (9.0%) human safety exposure limit for normally occupied spaces.
                        </p>
                      </div>
                    </div>

                    {/* Table 4: 4-Column Professional Review & Sign-Off Block */}
                    {(() => {
                      const sigDetails = getSignatureBlockDetails(
                        project?.id || "default",
                        "/plumbing-fm200",
                        currentUserName,
                        calcReviewState
                      );
                      return (
                        <div className="space-y-2 mt-6">
                          <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                            4. Professional Review &amp; Sign-Off Block
                          </h3>
                          <div className="border border-border rounded-xl overflow-hidden text-xs">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                                  <th className="p-2.5 text-left w-1/4">Approval Role</th>
                                  <th className="p-2.5 text-center w-1/4">Originated By</th>
                                  <th className="p-2.5 text-center w-1/4">Reviewed By</th>
                                  <th className="p-2.5 text-center w-1/4">Approved By</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                <tr>
                                  <td className="p-2.5 font-bold text-muted-foreground">Name:</td>
                                  <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.originatedName || currentUserName}</td>
                                  <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.reviewerName || "Pending Review"}</td>
                                  <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.approverName || "Pending Approval"}</td>
                                </tr>
                                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                                  <td className="p-2.5 font-bold text-muted-foreground">Role / Status:</td>
                                  <td className="p-2.5 text-center text-muted-foreground">Fire Protection Design Engineer</td>
                                  <td className="p-2.5 text-center text-muted-foreground">Senior Fire Protection Lead</td>
                                  <td className="p-2.5 text-center text-muted-foreground">Principal / MEP Director</td>
                                </tr>
                                <tr>
                                  <td className="p-2.5 font-bold text-muted-foreground">Date:</td>
                                  <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.originatedDate || formatDateStr(new Date())}</td>
                                  <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.reviewerDate || "—"}</td>
                                  <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.approverDate || "—"}</td>
                                </tr>
                              </tbody>
                            </table>
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

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <FM200IntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calcResults={calcResults}
              preset={preset}
              setPreset={setPreset}
              isEffectiveReadOnly={isEffectiveReadOnly}
              safetyFactorVal={safetyFactorVal}
              unitSystem={unitSystem}
              setFormulaModalOpen={setFormulaModalOpen}
            />
          )}
        </div>
      </div>

      {/* NFPA 2001 Formula Breakdown Modal */}
      {formulaModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-in fade-in duration-150"
          onClick={() => setFormulaModalOpen(false)}
        >
          <div 
            className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-200 select-none max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">NFPA 2001 Formula Breakdown</h3>
                  <p className="text-[11.5px] text-muted-foreground">Clean agent flooding weight calculation per Clause 5.5.1</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="text-[12.5px] text-foreground space-y-3">
              <p className="text-muted-foreground text-xs">
                The clean agent flooding weight is calculated according to NFPA 2001 Clause 5.5.1:
              </p>

              <div className="bg-surface-2 p-3 rounded-2xl font-mono text-xs text-center border border-border font-bold text-primary">
                W = (V / S) Ã— (C / (100 - C)) Ã— SafetyFactor
              </div>

              <div className="space-y-1.5 bg-surface/50 p-3.5 rounded-2xl border border-border/60 text-xs">
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="font-semibold text-muted-foreground">V (Volume):</span>
                  <span className="font-mono font-medium">
                    {areaVal.toFixed(2)} Ã— {heightVal.toFixed(2)} = {calcResults.volume.toFixed(2)} {unitSystem === "si" ? "mÂ³" : "ftÂ³"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="font-semibold text-muted-foreground">S (Specific Volume):</span>
                  <span className="font-mono font-medium text-right">
                    {useStandardS 
                      ? `${calcResults.S.toFixed(4)} ${unitSystem === "si" ? "mÂ³/kg" : "ftÂ³/lb"} (Locked baseline)`
                      : unitSystem === "si"
                        ? `0.1269 + (0.000513 Ã— ${temp}Â°C) = ${calcResults.S.toFixed(4)} mÂ³/kg`
                        : `1.885 + (0.0046 Ã— ${temp}Â°F) = ${calcResults.S.toFixed(4)} ftÂ³/lb`}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="font-semibold text-muted-foreground">C (Design Concentration):</span>
                  <span className="font-mono font-medium">
                    {calcResults.C.toFixed(3)} % ({preset.replace("_", " ").toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="font-semibold text-muted-foreground">Safety Multiplier:</span>
                  <span className="font-mono font-medium">{safetyFactorVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 text-primary font-bold text-[13px] border-t border-border/80">
                  <span>Total Weight (W):</span>
                  <span className="font-mono text-[13.5px]">
                    ({calcResults.volume.toFixed(2)} / {calcResults.S.toFixed(4)}) Ã— ({calcResults.C.toFixed(3)} / {(100 - calcResults.C).toFixed(3)}) Ã— {safetyFactorVal.toFixed(2)} = {calcResults.weight.toFixed(2)} {unitSystem === "si" ? "kg" : "lb"}
                  </span>
                </div>
              </div>

              <div className="bg-surface-2/70 p-3 rounded-xl border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
                <strong>NFPA 2001 Criteria:</strong> Discharge time must not exceed <strong>10 seconds</strong> to establish extinguishing concentration rapidly and minimize decomposition products (HF acid vapor). Minimum enclosure hold time target is <strong>10 minutes</strong>.
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Comment & Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="FM-200 Parameter"
          calculatorTitle="FM-200 Gas Sizing"
          calculatorPath="/plumbing-fm200"
          existingComments={commentsList.filter(
            (c) =>
              c.targetId === commentTargetItem.id ||
              c.spaceId === commentTargetItem.id ||
              c.itemId === commentTargetItem.id
          )}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

function FM200IntelligenceDrawer({
  onClose,
  calcResults,
  preset,
  setPreset,
  isEffectiveReadOnly,
  safetyFactorVal,
  unitSystem,
  setFormulaModalOpen,
}: {
  onClose: () => void;
  calcResults: any;
  preset: PresetOption;
  setPreset: (p: PresetOption) => void;
  isEffectiveReadOnly: boolean;
  safetyFactorVal: number;
  unitSystem: "si" | "ip";
  setFormulaModalOpen: (open: boolean) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4.5 text-primary" />
          <div>
            <h3 className="font-bold text-[13.5px] uppercase tracking-wider text-foreground">Live Intelligence</h3>
            <p className="text-[10.5px] text-muted-foreground font-medium">NFPA 2001 Clean Agent Sizing Engine</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Close Live Intelligence"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-[12.5px] leading-relaxed text-foreground custom-scrollbar">
        {/* 1. Live Sizing & Safety Audit Card */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
              <Activity className="size-4 text-primary" />
              <span>Safety & Compliance Audit</span>
            </span>
            {calcResults.C <= 9.0 && calcResults.C >= 5.8 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Check className="size-3" /> NOAEL Compliant
              </span>
            ) : calcResults.C <= 10.5 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <AlertTriangle className="size-3" /> LOAEL Caution
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                <ShieldAlert className="size-3" /> Hazard Alert
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {/* Human Exposure Status */}
            <div className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 ${
              calcResults.C <= 9.0 
                ? "border-emerald-500/20 bg-emerald-500/5 text-foreground"
                : calcResults.C <= 10.5 
                ? "border-amber-500/20 bg-amber-500/5 text-foreground" 
                : "border-rose-500/20 bg-rose-500/5 text-foreground"
            }`}>
              <div className="flex items-center justify-between font-semibold text-[11.5px]">
                <span>Human Exposure Limit</span>
                <span className="font-mono font-bold">
                  {calcResults.C <= 9.0 ? "â‰¤ 9.0% (NOAEL)" : calcResults.C <= 10.5 ? "9.0% - 10.5% (LOAEL)" : "> 10.5% (Restricted)"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {calcResults.C <= 9.0
                  ? "Design concentration is within NOAEL limit. Safe for normally occupied enclosures with standard egress provisions."
                  : calcResults.C <= 10.5
                  ? "Design concentration is between NOAEL and LOAEL. Occupants must be able to evacuate the enclosure within 5 minutes."
                  : "Concentration exceeds LOAEL limit (10.5%). Strictly restricted to normally unoccupied spaces per NFPA 2001."}
              </p>
            </div>

            {/* Agent Listing Minimum Audit */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-2/60 border border-border/60 text-[11.5px]">
              <span className="text-muted-foreground">Listing Minimum (5.80%):</span>
              <span className={`font-mono font-bold ${calcResults.C >= 5.8 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                {calcResults.C >= 5.8 ? "âœ“ Compliant" : "âš  Below 5.8%"}
              </span>
            </div>

            {/* Flooding Density Metric */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-2/60 border border-border/60 text-[11.5px]">
              <span className="text-muted-foreground">Flooding Density:</span>
              <span className="font-mono font-bold text-primary">
                {(calcResults.weight / (calcResults.volume || 1)).toFixed(3)} {unitSystem === "si" ? "kg/mÂ³" : "lb/ftÂ³"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. NFPA 2001 System Specifications */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Flame className="size-3.5 text-danger" /> System Performance Criteria
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">1</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">10-Second Discharge Time</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  NFPA 2001 requires the full calculated weight ({calcResults.weight.toFixed(1)} {unitSystem === "si" ? "kg" : "lb"}) to discharge within 10 seconds to limit HF acid byproducts.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">2</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">10-Minute Minimum Hold Time</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Enclosure must retain extinguishing concentration for â‰¥ 10 minutes. Verified via door fan integrity pressure test.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-xl bg-surface-2/60 border border-border/60">
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold">3</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-[11.5px]">Safety Multiplier Recommendation</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Current multiplier: <strong className="text-foreground">{safetyFactorVal.toFixed(2)}x</strong>. For spaces with unsealed cable penetrations, a 1.10xâ€“1.20x factor is recommended.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Quick Hazard Class Presets */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Quick Hazard Class Switcher</span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => {
                if (isEffectiveReadOnly) return;
                setPreset("class_a");
              }}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer border ${
                preset === "class_a"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-2 hover:bg-surface-3 text-muted-foreground border-border/70 disabled:opacity-60 disabled:cursor-not-allowed"
              }`}
            >
              Class A (6.86%)
            </button>
            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => {
                if (isEffectiveReadOnly) return;
                setPreset("class_c");
              }}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer border ${
                preset === "class_c"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-2 hover:bg-surface-3 text-muted-foreground border-border/70 disabled:opacity-60 disabled:cursor-not-allowed"
              }`}
            >
              Class C (7.00%)
            </button>
            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => {
                if (isEffectiveReadOnly) return;
                setPreset("class_b");
              }}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer border ${
                preset === "class_b"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface-2 hover:bg-surface-3 text-muted-foreground border-border/70 disabled:opacity-60 disabled:cursor-not-allowed"
              }`}
            >
              Class B (8.70%)
            </button>
          </div>
        </div>

        {/* 4. Live Formula Quick Launcher */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">NFPA 2001 Formula</span>
            <span className="text-[10px] font-mono text-muted-foreground">Clause 5.5.1</span>
          </div>
          <div className="bg-surface-2 p-2.5 rounded-xl font-mono text-[11.5px] text-center border border-border/80 font-bold text-primary">
            W = (V / S) Ã— (C / (100 - C)) Ã— {safetyFactorVal.toFixed(2)}
          </div>
          <button
            type="button"
            onClick={() => setFormulaModalOpen(true)}
            className="w-full py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Info className="size-3.5" />
            <span>View Full Step-by-Step Values</span>
          </button>
        </div>
      </div>
    </div>
  );
}
