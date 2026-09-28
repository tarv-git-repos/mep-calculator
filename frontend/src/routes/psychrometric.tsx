import { CalculationReviewBar, useCalculationLock, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { supabase } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle,
  Info,
  HelpCircle,
  MessageSquare,
  Copy,
  Clipboard,
  RotateCcw,
  Trash2,
  Sparkles,
  FileText,
  X,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  Layers,
  Activity,
  ArrowRight,
  Flame,
  Zap,
  Sliders,
  Lock,
  Edit3,
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
import { EditPsychrometricModal, type PsychrometricFormData } from "@/components/workspace/EditPsychrometricModal";
import { exportPsychrometricPDF } from "@/lib/exportPsychrometricPDF";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { dirtyStore } from "@/lib/dirty-store";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { toast } from "sonner";
import { calculatePsychrometricData, fToC, cToF } from "@/lib/calc-psychrometric";

export const Route = createFileRoute("/psychrometric")({
  head: () => ({
    meta: [
      { title: "Psychrometric — MEP Calc" },
      { name: "description", content: "Moist air psychrometric properties calculator utilizing standard Hyland-Wexler equations." },
    ],
  }),
  component: PsychrometricPage,
});

type SecondParam = "rh" | "wb" | "dp" | "w";

function PsychrometricPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const { user, userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";
  const isCalcLocked = useCalculationLock("/psychrometric", project?.id);
  const [calcReviewState, setCalcReviewState] = useState<CalculationReviewState | null>(null);
  const isApprovedLocked = isCalcLocked || calcReviewState?.status === "APPROVED";

  const [tab, setTab] = useState<"calculator" | "report">("calculator");
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [dbtInput, setDbtInput] = useState<number | "">("");
  const [secondParam, setSecondParam] = useState<SecondParam>("rh");
  const [paramValue, setParamValue] = useState<number | "">("");
  const [atmPressure, setAtmPressure] = useState<number | "">(""); // kPa
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [showFormulaPanel, setShowFormulaPanel] = useState<boolean>(false);
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);

  const handleSavePsychrometricModal = (data: PsychrometricFormData) => {
    setUnitSystem(data.unitSystem);
    setDbtInput(data.dbtInput);
    setSecondParam(data.secondParam);
    setParamValue(data.paramValue);
    setAtmPressure(data.atmPressure);
    setHasCalculated(true);
    dirtyStore.set(true);
  };

  // Load project-scoped psychrometric state
  useEffect(() => {
    if (!project?.id) return;
    const pKey = `mep_psychrometric_calc_${project.id}`;
    const stored = localStorage.getItem(pKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        if (parsed.dbtInput !== undefined) setDbtInput(parsed.dbtInput);
        if (parsed.secondParam) setSecondParam(parsed.secondParam);
        if (parsed.paramValue !== undefined) setParamValue(parsed.paramValue);
        if (parsed.atmPressure !== undefined) setAtmPressure(parsed.atmPressure);
        if (parsed.hasCalculated !== undefined) setHasCalculated(parsed.hasCalculated);
      } catch (e) {
        console.error("Failed to load saved psychrometric calculation", e);
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  // Save project-scoped psychrometric state
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        dbtInput,
        secondParam,
        paramValue,
        atmPressure,
        hasCalculated,
      };
      localStorage.setItem(`mep_psychrometric_calc_${project.id}`, JSON.stringify(dataToSave));
    }
  }, [project?.id, loadedProjectId, unitSystem, dbtInput, secondParam, paramValue, atmPressure, hasCalculated]);

  // Version History Restore Listener (Full parity with Ventilation & VersionManager)
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = `mep_psychrometric_calc_${project?.id || "default"}`;
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
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        if (restoredData.dbtInput !== undefined) setDbtInput(restoredData.dbtInput);
        if (restoredData.secondParam) setSecondParam(restoredData.secondParam);
        if (restoredData.paramValue !== undefined) setParamValue(restoredData.paramValue);
        if (restoredData.atmPressure !== undefined) setAtmPressure(restoredData.atmPressure);
        if (restoredData.hasCalculated !== undefined) setHasCalculated(restoredData.hasCalculated);
        dirtyStore.set(false);
        toast.success("Psychrometric calculation restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  // Comment System State & Persistence (matching Preliminary Cooling Load)
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  const ip = unitSystem === "ip";

  useEffect(() => {
    const pId = project?.id || "default";
    const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/psychrometric`);
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
    localStorage.setItem(`mep_calc_comments_${pId}_/psychrometric`, JSON.stringify(newList));
    // Immediately dispatch notification events for instantaneous UI and badge update (<1ms)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new Event("storage"));
    }
    // Non-blocking background cloud save
    try {
      if (typeof forceSaveToCloud === "function") {
        setTimeout(() => forceSaveToCloud(), 50);
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
      calculatorTitle: "Psychrometric Calculator",
      calculatorPath: "/psychrometric",
      projectId: project?.id || "default",
      projectName: project?.name || "Psychrometric Analysis",
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

  const handlePasteValue = async (label: string, setter: (val: number | "") => void) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved & Locked by Discipline Coordinator. Unlock required to edit.");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text.trim());
      if (!isNaN(num)) {
        setter(num);
        setHasCalculated(false);
        toast.success(`Pasted ${num} into ${label}`);
      } else {
        toast.error(`Clipboard content "${text}" is not a valid number`);
      }
    } catch (err) {
      toast.error("Unable to read clipboard");
    }
  };

  const handleResetValue = (label: string, setter: (val: number | "") => void, defaultVal: number | "") => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved & Locked by Discipline Coordinator. Unlock required to edit.");
      return;
    }
    setter(defaultVal);
    setHasCalculated(false);
    toast.success(`Reset ${label} to default ${defaultVal !== "" ? defaultVal : "(blank)"}`);
  };

  const handleClearValue = (label: string, setter: (val: number | "") => void) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved & Locked by Discipline Coordinator. Unlock required to edit.");
      return;
    }
    setter("");
    setHasCalculated(false);
    toast.info(`Cleared ${label}`);
  };

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved & Locked by Discipline Coordinator. Unlock required to change unit system.");
      return;
    }
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);

    if (shouldConvert) {
      // Convert temperatures and param values
      if (targetUnit === "ip") {
        // SI -> IP
        setDbtInput(dbtInput !== "" ? Number((Number(dbtInput) * 1.8 + 32).toFixed(1)) : "");
        if (secondParam === "wb" || secondParam === "dp") {
          setParamValue(paramValue !== "" ? Number((Number(paramValue) * 1.8 + 32).toFixed(1)) : "");
        } else if (secondParam === "w") {
          setParamValue(paramValue !== "" ? Number((Number(paramValue) * 7).toFixed(2)) : ""); // g/kg to gr/lb
        }
      } else {
        // IP -> SI
        setDbtInput(dbtInput !== "" ? Number(((Number(dbtInput) - 32) / 1.8).toFixed(1)) : "");
        if (secondParam === "wb" || secondParam === "dp") {
          setParamValue(paramValue !== "" ? Number(((Number(paramValue) - 32) / 1.8).toFixed(1)) : "");
        } else if (secondParam === "w") {
          setParamValue(paramValue !== "" ? Number((Number(paramValue) / 7).toFixed(5)) : ""); // gr/lb to g/kg
        }
      }
    }
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  const [calculatedData, setCalculatedData] = useState({
    dbt: 0,
    wbt: 0,
    dp: 0,
    rh: 0,
    w: 0,
    h: 0,
    v: 0,
    pw: 0
  });

  useEffect(() => {
    // TEMPORARY LOCAL BACKEND CALL
    // The logic has been completely separated into @/lib/calc-psychrometric
    // When you have your Supabase credentials, replace this block with:
    // const { data, error } = await supabase.functions.invoke('calc-psychrometric', { body: ... });
    
    try {
      const data = calculatePsychrometricData(dbtInput, secondParam, paramValue, atmPressure, ip);
      setCalculatedData(data);
    } catch (err: any) {
      console.error("Calculation error:", err);
      toast.error("Calculation failed.");
    }
  }, [dbtInput, secondParam, paramValue, atmPressure, ip]);

  const warnings = useMemo(() => {
    const warns: string[] = [];
    if (calculatedData.rh > 90) {
      warns.push(`RH ${calculatedData.rh.toFixed(1)}% - Near saturation. Condensation risk on cold surfaces.`);
    }
    if (calculatedData.rh < 20) {
      warns.push(`RH ${calculatedData.rh.toFixed(1)}% - Very dry air. Check comfort and static electricity concerns.`);
    }
    if (calculatedData.dbt > 40) {
      warns.push(`DBT ${calculatedData.dbt.toFixed(1)}°C - High temperature. Verify application.`);
    }
    return warns;
  }, [calculatedData]);

  const handleCalculate = () => {
    setHasCalculated(true);
  };

  const sigDetails = useMemo(() => {
    return getSignatureBlockDetails(project?.id || "default", "/psychrometric", currentUserName, calcReviewState);
  }, [project?.id, calcReviewState]);

  const handleExportPDF = async () => {
    try {
      toast.loading("Generating Psychrometric calculation PDF report...", { id: "psych-pdf-export" });
      await exportPsychrometricPDF(calculatedData, {
        calcNo: (project as any)?.calcNo || `TRV-CAL-PSY-${(project?.id || "0000").slice(-4).toUpperCase()}`,
        projectNo: project?.code || (project?.id ? project.id.slice(0, 8) : "P000"),
        projectName: project?.name || "MEP Project",
        client: project?.client || "",
        endUser: (project as any)?.endUser || (project as any)?.location || "",
        unitSystem,
        secondParam,
        paramValue,
        atmPressure,
        dbtInput,
      });
      toast.dismiss("psych-pdf-export");
    } catch (e) {
      console.error("Failed to export Psychrometric PDF", e);
      toast.dismiss("psych-pdf-export");
      toast.error("Failed to generate Psychrometric PDF report.");
    }
  };

  // Keyboard Shortcuts Hook for Psychrometric Calculator
  // Keyboard shortcuts matching Ventilation (Ctrl+S, Enter, Escape, Ctrl+E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Escape: Close open drawers or modals
      if (e.key === "Escape") {
        if (showFormulaPanel) {
          setShowFormulaPanel(false);
          e.preventDefault();
          return;
        }
        if (intelOpen) {
          setIntelOpen(false);
          e.preventDefault();
          return;
        }
        if (commentModalOpen) {
          setCommentModalOpen(false);
          e.preventDefault();
          return;
        }
        return;
      }

      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );

      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 2. Enter (inside input) or Ctrl+Enter: Trigger Calculate
      if ((e.key === "Enter" && isInput) || (isCmdOrCtrl && e.key === "Enter")) {
        e.preventDefault();
        handleCalculate();
        toast.success("Psychrometric state calculated!");
        return;
      }

      // 3. Ctrl+S: Save calculation / sync to project
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        try {
          if (typeof forceSaveToCloud === "function") {
            forceSaveToCloud();
          }
        } catch (err) {}
        dirtyStore.set(false);
        toast.success("Psychrometric calculation saved to project!");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showFormulaPanel,
    intelOpen,
    commentModalOpen,
    isApprovedLocked,
    calculatedData,
    forceSaveToCloud
  ]);

  // Helper to render an input box with Context Menu and Comment Indicator
  const renderInputBox = (
    id: string,
    label: string,
    value: number | "",
    setter: (val: number | "") => void,
    defaultVal: number | "" = "",
    placeholder: string = "",
    min?: number,
    step: number | string = "any"
  ) => {
    const itemComments = commentsList.filter(c => c.spaceId === id || c.targetId === id || c.itemId === id);
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id ||
                          highlightedTargetId === `field-${id}` ||
                          (highlightedTargetId && id && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
                          (highlightedTargetId && label && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

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
            className={`flex flex-col gap-1.5 p-1 rounded-xl transition cursor-context-menu group ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20"
                : ""
            }`}
          >
            <label className="font-semibold text-foreground flex items-center justify-between gap-2">
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
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">Double-click to edit</span>
            </label>
            <input
              id={id}
              type="number"
              min={min}
              step={step}
              disabled={isApprovedLocked}
              value={value}
              onChange={(e) => {
                if (isApprovedLocked) return;
                setter(e.target.value === "" ? "" : Number(e.target.value));
                setHasCalculated(false);
              }}
              placeholder={placeholder}
              className={`w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold outline-none placeholder:text-muted-foreground/45 placeholder:font-normal transition ${
                isApprovedLocked
                  ? "opacity-75 cursor-not-allowed bg-slate-200/50 dark:bg-slate-900/60 text-muted-foreground"
                  : "focus:border-[#0A7BC7] hover:border-[#0A7BC7]/50"
              }`}
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

  // Helper to render a result output row with Context Menu and Comment Indicator
  const renderResultRow = (
    id: string,
    label: string,
    valueFormatted: string,
    isHighlight: boolean = false,
    highlightClass: string = "text-foreground",
    colSpanTwo: boolean = false
  ) => {
    const itemComments = commentsList.filter(c => c.spaceId === id || c.targetId === id || c.itemId === id);
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id ||
                          highlightedTargetId === `res-${id}` ||
                          (highlightedTargetId && id && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
                          (highlightedTargetId && label && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

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
            className={`flex justify-between items-center py-1.5 border-b border-border/40 hover:bg-slate-100/40 dark:hover:bg-slate-800/30 px-2 rounded-lg transition cursor-context-menu group ${
              colSpanTwo ? "col-span-2" : ""
            } ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
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
            <strong className={`font-bold font-mono ${highlightClass}`}>{valueFormatted}</strong>
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
            onClick={() => handleCopyValue(label, valueFormatted)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value ({valueFormatted})</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => {
              navigator.clipboard.writeText(`${label}: ${valueFormatted}`);
              toast.success(`Copied full line: "${label}: ${valueFormatted}"`);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Copy Full Line</span>
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

  const renderChart = () => {
    const valDbt = ip ? cToF(calculatedData.dbt) : calculatedData.dbt + 273.15;
    const valDp = ip ? cToF(calculatedData.dp) : calculatedData.dp + 273.15;
    const valH = calculatedData.h;

    const uTemp = ip ? "°F" : "K";
    const uH = ip ? "BTU/lb" : "kJ/kg";

    const bars = [
      { label: `Dry Bulb (${uTemp})`, value: valDbt, color: "#0A7BC7", display: valDbt.toFixed(1) + " " + uTemp },
      { label: `Dew Point (${uTemp})`, value: valDp, color: "#06456F", display: valDp.toFixed(1) + " " + uTemp },
      { label: `Enthalpy (${uH})`, value: valH, color: "#7C3AED", display: valH.toFixed(1) + " " + uH }
    ];

    const W = 560;
    const H = 150;
    const PL = 135;
    const PR = 95;
    const PT = 15;
    const PB = 20;
    const CW = W - PL - PR;
    const CH = H - PT - PB;

    const maxVal = Math.max(...bars.map(b => b.value)) * 1.2 || 1;
    const chartId = "psych-chart-breakdown";
    const chartLabel = "Moist Air Properties Breakdown";
    const itemComments = commentsList.filter(c => c.spaceId === chartId || c.targetId === chartId || c.itemId === chartId);
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === chartId || (highlightedTargetId && chartId.includes(highlightedTargetId.toLowerCase()));

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            id={chartId}
            data-item-id={chartId}
            data-field-id={chartId}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditModalOpen(true);
            }}
            className={`flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40 p-4 border border-border rounded-2xl select-none cursor-context-menu transition overflow-hidden ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20"
                : ""
            }`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{chartLabel}</h4>
              {hasComments && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenComment(chartId, chartLabel);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                  title={`${itemComments.length} comment(s)/task(s) assigned`}
                >
                  <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                  <span>{itemComments.length}</span>
                </button>
              )}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block overflow-hidden mt-1">
              {bars.map((b, i) => {
                const bw = CH / bars.length;
                const barH = bw * 0.55;
                const y = PT + i * bw + (bw - barH) / 2;
                const barW = (b.value / maxVal) * CW;
                return (
                  <g key={i}>
                    <text
                      x={PL - 10}
                      y={y + barH / 2 + 4}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="700"
                      fill="currentColor"
                      className="fill-foreground font-sans"
                    >
                      {b.label}
                    </text>
                    <rect x={PL} y={y} width={Math.max(2, barW)} height={barH} fill={b.color} rx="3" />
                    <text
                      x={PL + barW + 8}
                      y={y + barH / 2 + 4}
                      textAnchor="start"
                      fontSize="10"
                      fontWeight="800"
                      fill={b.color}
                      className="font-mono"
                    >
                      {b.display}
                    </text>
                  </g>
                );
              })}
              <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="currentColor" className="stroke-border" strokeWidth="1.5" />
            </svg>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
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
            onClick={() => handleOpenComment(chartId, chartLabel)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const pAtmKpa = atmPressure !== "" ? Number(atmPressure) : 101.325;
  const pAtmPsi = (pAtmKpa * 0.145038).toFixed(3);
  const dbtC = calculatedData.dbt;
  const dbtF = cToF(dbtC);
  const wbtC = calculatedData.wbt;
  const wbtF = cToF(wbtC);
  const dpC = calculatedData.dp;
  const dpF = cToF(dpC);
  const rhVal = calculatedData.rh;
  const wGPerKg = calculatedData.w * 1000;
  const wGrPerLb = calculatedData.w * 7000;
  const hKjKg = calculatedData.h;
  const hBtuLb = calculatedData.h / 2.326;
  const vM3Kg = calculatedData.v;
  const vFt3Lb = calculatedData.v * 16.0185;
  const pwKpa = calculatedData.pw / 1000;
  const pwPsi = calculatedData.pw / 6894.76;
  const densitySi = 1 / vM3Kg;
  const densityIp = 1 / vFt3Lb;

  const isSummerComfort = dbtC >= 23 && dbtC <= 26 && rhVal >= 30 && rhVal <= 60;
  const isWinterComfort = dbtC >= 20 && dbtC <= 24 && rhVal >= 30 && rhVal <= 60;
  let comfortStatusText = "Standard Conditioned Boundary";
  if (isSummerComfort) comfortStatusText = "Compliant (ASHRAE 55 Summer Comfort Envelope)";
  else if (isWinterComfort) comfortStatusText = "Compliant (ASHRAE 55 Winter Comfort Envelope)";
  else if (rhVal > 80) comfortStatusText = "Caution: High Humidity / Surface Mold & Condensation Risk";
  else if (rhVal < 20) comfortStatusText = "Caution: Low Humidity / Static Discharge & Mucous Dryness";

  const sensEnthalpy = 1.006 * dbtC;
  const latEnthalpy = calculatedData.w * (2501 + 1.805 * dbtC);
  const sensPercent = hKjKg > 0 ? ((sensEnthalpy / hKjKg) * 100).toFixed(1) : "0.0";
  const latPercent = hKjKg > 0 ? ((latEnthalpy / hKjKg) * 100).toFixed(1) : "0.0";
  const wbDepression = (dbtC - wbtC).toFixed(1);

  const paramNameMap: Record<SecondParam, string> = {
    rh: "Relative Humidity (RH)",
    wb: "Wet Bulb Temperature (T_wb)",
    dp: "Dew Point Temperature (T_dp)",
    w: "Humidity Ratio (W)",
  };
  const paramName = paramNameMap[secondParam] || "Relative Humidity (RH)";
  let paramValDisplay = `${rhVal.toFixed(1)} %`;
  if (secondParam === "wb") {
    paramValDisplay = `${wbtC.toFixed(1)} °C (${wbtF.toFixed(1)} °F)`;
  } else if (secondParam === "dp") {
    paramValDisplay = `${dpC.toFixed(1)} °C (${dpF.toFixed(1)} °F)`;
  } else if (secondParam === "w") {
    paramValDisplay = `${wGPerKg.toFixed(2)} g/kg (${wGrPerLb.toFixed(2)} gr/lb)`;
  }

  return (
    <AppShell title="Psychrometric Calculator" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Psychrometric Calculator</h1>
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
                  projectId={project?.id}
                  calculatorPath="/psychrometric"
                  calculatorTitle="Psychrometric Calculator"
                />
                {commentsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = commentsList[0];
                      handleOpenComment(first.targetId || "psych-dbt", first.targetName || "Psychrometric Field");
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
                Calculate complete psychrometric state of moist air from two known properties based on Hyland-Wexler equations.
              </p>
            </div>
          </div>

          {/* White Card Container for Tabs & Content */}
          <div className="flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setTab("calculator")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "calculator"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Calculator
                </button>
                <button
                  type="button"
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

              {/* Units toggle option */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  inputDescriptions="Dry Bulb Temp & Second Known Parameter"
                  conversionExample={unitSystem === "si" ? "Convert 24°C → 75.2°F, 18°C WB → 64.4°F WB" : "Convert 75°F → 23.9°C, 65°F WB → 18.3°C WB"}
                />
              </div>
            </div>

            {/* Active Tab View */}
            <div key={tab} className="flex-1 min-h-0 animate-fade-in flex flex-col overflow-y-auto p-4 md:p-6">
              {tab === "calculator" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Inputs Panel */}
                  <div className="lg:col-span-5 flex flex-col gap-5">
                    <div className={`rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 ${
                      isApprovedLocked
                        ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
                    }`}>
                      {isApprovedLocked && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl p-3 flex items-center justify-between text-xs font-semibold select-none">
                          <div className="flex items-center gap-2">
                            <Lock className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>This calculation is APPROVED & LOCKED.</span>
                          </div>
                          <span className="text-[10.5px] opacity-80">Discipline Coordinator authority required to unlock.</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-3.5 rounded-full ${isApprovedLocked ? "bg-emerald-500" : "bg-[#0A7BC7]"}`}></div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Input Conditions</h3>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3.5 text-xs">
                        {/* Dry Bulb Temperature */}
                        {renderInputBox(
                          "psych-dbt",
                          `Dry Bulb Temperature (${ip ? "°F" : "°C"})`,
                          dbtInput,
                          setDbtInput,
                          ip ? 95 : 35,
                          ip ? "95" : "35.0"
                        )}

                        {/* Known Second Parameter Selector */}
                        {(() => {
                          const paramId = "psych-second-param";
                          const paramComments = commentsList.filter(c => c.spaceId === paramId || c.targetId === paramId || c.itemId === paramId);
                          const hasComments = paramComments.length > 0;
                          const isHighlighted = highlightedTargetId === paramId || (highlightedTargetId && paramId.includes(highlightedTargetId.toLowerCase()));
                          return (
                            <ContextMenu key={paramId}>
                              <ContextMenuTrigger asChild>
                                <div
                                  id={paramId}
                                  data-item-id={paramId}
                                  data-field-id={paramId}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditModalOpen(true);
                                  }}
                                  className={`flex flex-col gap-1.5 p-1 rounded-xl transition cursor-context-menu group ${
                                    isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                                  }`}
                                >
                                  <label className="font-semibold text-foreground flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5">
                                      <span>Known Second Parameter</span>
                                      {hasComments && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenComment(paramId, "Known Second Parameter");
                                          }}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                                          title={`${paramComments.length} comment(s)/task(s) assigned`}
                                        >
                                          <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                          <span>{paramComments.length}</span>
                                        </button>
                                      )}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">Double-click to edit</span>
                                  </label>
                                  <div className="grid grid-cols-2 gap-2 select-none">
                                    {(["rh", "wb", "dp", "w"] as SecondParam[]).map((param) => {
                                      const active = secondParam === param;
                                      const labelMap: Record<SecondParam, string> = { rh: "Rel. Humidity", wb: "Wet Bulb", dp: "Dew Point", w: "Hum. Ratio" };
                                      return (
                                        <button
                                          key={param}
                                          type="button"
                                          disabled={isApprovedLocked}
                                          onClick={() => {
                                            if (isApprovedLocked) {
                                              toast.info("Calculation is Approved & Locked by Discipline Coordinator.");
                                              return;
                                            }
                                            setSecondParam(param);
                                            setHasCalculated(false);
                                          }}
                                          className={`py-1.5 px-3 rounded-lg border text-center font-semibold transition-all ${
                                            isApprovedLocked
                                              ? "opacity-60 cursor-not-allowed"
                                              : "cursor-pointer"
                                          } ${
                                            active
                                              ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                                              : "bg-slate-100/30 border-border/70 hover:bg-slate-100/60 text-muted-foreground"
                                          }`}
                                        >
                                          {labelMap[param]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
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
                                  onClick={() => handleOpenComment(paramId, "Known Second Parameter")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>{hasComments ? `View / Add Comments (${paramComments.length})` : "Add Comment / Assign Task"}</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        })()}

                        {/* Parameter Value Input */}
                        {renderInputBox(
                          "psych-param-value",
                          secondParam === "rh"
                            ? "Relative Humidity (%)"
                            : secondParam === "wb"
                            ? `Wet Bulb Temperature (${ip ? "°F" : "°C"})`
                            : secondParam === "dp"
                            ? `Dew Point Temperature (${ip ? "°F" : "°C"})`
                            : `Humidity Ratio (${ip ? "gr/lb" : "g/kg"})`,
                          paramValue,
                          setParamValue,
                          secondParam === "rh" ? 60 : secondParam === "wb" || secondParam === "dp" ? (ip ? 78 : 25.5) : (ip ? 100 : 15),
                          secondParam === "rh" ? "60" : secondParam === "wb" || secondParam === "dp" ? (ip ? "78" : "25.5") : (ip ? "100" : "15")
                        )}

                        {/* Atmospheric Pressure */}
                        {renderInputBox(
                          "psych-atm-pressure",
                          "Atmospheric Pressure (kPa)",
                          atmPressure,
                          setAtmPressure,
                          101.325,
                          "101.325"
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isApprovedLocked}
                      onClick={handleCalculate}
                      className={`w-full font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs ${
                        isApprovedLocked
                          ? "bg-slate-200 dark:bg-slate-800 text-muted-foreground cursor-not-allowed opacity-75"
                          : "bg-[#0A7BC7] text-white hover:bg-[#06456F] hover:shadow-sm active:scale-[0.98] cursor-pointer"
                      }`}
                    >
                      {isApprovedLocked ? "🔒 Calculation Locked (Approved)" : "⚡ Calculate Psychrometric State"}
                    </button>
                  </div>

                  {/* Right Results Panel */}
                  <div className="lg:col-span-7 flex flex-col gap-5">
                    {!hasCalculated ? (
                      <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center shadow-xs">
                        <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                          📏
                        </div>
                        <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Solve</h4>
                        <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                          Enter the known Dry Bulb Temperature and select a second moist air property to solve the full psychrometric state.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-5 animate-fade-in">
                        {/* Action toolbar matching Ventilation standard */}
                        <div className="flex items-center gap-2 bg-background border border-border rounded-xl p-2 select-none flex-wrap">
                          <TBtn onClick={() => setShowFormulaPanel(!showFormulaPanel)}>
                            <HelpCircle className="size-3.5" /> Formula Reference
                          </TBtn>
                          <TBtn onClick={handleExportPDF}>
                            <FileText className="size-3.5" /> Export PDF
                          </TBtn>
                        </div>

                        {showFormulaPanel && (
                          <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-5 shadow-xs text-xs flex flex-col gap-2">
                            <h4 className="font-bold text-foreground mb-1">Psychrometric Saturation Equations Reference</h4>
                            <p className="text-muted-foreground">Calculations utilize standard Hyland-Wexler equations to determine saturation pressure and humidity ratios.</p>
                            <code className="bg-slate-100 dark:bg-slate-800 p-2 rounded block font-mono text-[10.5px] text-primary">
                              W = 0.621945 × Pw / (P_atm - Pw)
                            </code>
                          </div>
                        )}

                        {/* Warning logs */}
                        {warnings.length > 0 && (
                          <div className="bg-sky-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl p-3.5 flex flex-col gap-2 text-[11.5px]">
                            {warnings.map((w, idx) => (
                              <div key={idx} className="flex gap-2.5 items-start">
                                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Solved Air State Properties Card */}
                        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                            <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Solved Air State</h3>
                          </div>

                          <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                            {renderResultRow(
                              "res-dbt",
                              "Dry Bulb Temp",
                              ip ? `${dbtF.toFixed(1)} °F` : `${dbtC.toFixed(1)} °C`
                            )}
                            {renderResultRow(
                              "res-wbt",
                              "Wet Bulb Temp",
                              ip ? `${wbtF.toFixed(1)} °F` : `${wbtC.toFixed(1)} °C`
                            )}
                            {renderResultRow(
                              "res-dp",
                              "Dew Point Temp",
                              ip ? `${dpF.toFixed(1)} °F` : `${dpC.toFixed(1)} °C`
                            )}
                            {renderResultRow(
                              "res-rh",
                              "Relative Humidity",
                              `${rhVal.toFixed(1)} %`
                            )}
                            {renderResultRow(
                              "res-w",
                              "Humidity Ratio (W)",
                              ip ? `${wGrPerLb.toFixed(2)} gr/lb` : `${wGPerKg.toFixed(2)} g/kg`
                            )}
                            {renderResultRow(
                              "res-h",
                              "Specific Enthalpy (h)",
                              ip ? `${hBtuLb.toFixed(2)} BTU/lb` : `${hKjKg.toFixed(2)} kJ/kg`,
                              true,
                              "text-[#0A7BC7]"
                            )}
                            {renderResultRow(
                              "res-v",
                              "Specific Volume (v)",
                              ip ? `${vFt3Lb.toFixed(4)} ft³/lb` : `${vM3Kg.toFixed(4)} m³/kg`
                            )}
                            {renderResultRow(
                              "res-density",
                              "Moist Air Density (ρ)",
                              ip ? `${densityIp.toFixed(4)} lb/ft³` : `${densitySi.toFixed(3)} kg/m³`
                            )}
                            {renderResultRow(
                              "res-pw",
                              "Vapor Pressure",
                              ip ? `${pwPsi.toFixed(4)} psi` : `${pwKpa.toFixed(3)} kPa`
                            )}
                          </div>
                        </div>

                        {renderChart()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PRINTABLE REPORT PREVIEW TAB (MATCHING VENTILATION & COIL CONDENSATE REPORT FORMAT) */}
              {tab === "report" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                    
                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          Psychrometric State Calculation Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Design Standards: ASHRAE Handbook Fundamentals (Hyland-Wexler Formulation) &amp; ASHRAE Standard 55
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TBtn primary onClick={handleExportPDF}>
                          <FileText className="size-3.5" /> Export PDF
                        </TBtn>
                      </div>
                    </div>

                    {/* Enclosed Project Metadata Grid (3 rows x 2 cols) */}
                    <div className="border border-border rounded-xl overflow-hidden text-[12px] bg-card">
                      <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/20">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Calculation No.:</span>
                          <span className="text-muted-foreground font-mono">
                            {(project as any)?.calcNo || `TRV-CAL-PSY-${(project?.id || "0000").slice(-4).toUpperCase()}`}
                          </span>
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
                          <span className="text-muted-foreground">{project?.client || "-"}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Project Name:</span>
                          <span className="text-muted-foreground">{project?.name || "MEP Project"}</span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">End User:</span>
                          <span className="text-muted-foreground">{(project as any)?.endUser || (project as any)?.location || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Table 1: Design Input Parameter */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                              <th className="py-2 px-2.5 w-10">Sr.</th>
                              <th className="py-2 px-3 text-left">Design Input Parameter</th>
                              <th className="py-2 px-3 text-left">Governing Rule / Basis</th>
                              <th className="py-2 px-3 text-right">Specified Value</th>
                              <th className="py-2 px-3 text-left">Engineering Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-sans">
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">1</td>
                              <td className="py-2 px-3 font-bold text-foreground">Atmospheric Pressure (P_atm)</td>
                              <td className="py-2 px-3 text-muted-foreground">Standard Barometric Design Level</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{pAtmKpa.toFixed(3)} kPa ({pAtmPsi} psi / 29.92 inHg)</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Sea-level standard atmosphere</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">2</td>
                              <td className="py-2 px-3 font-bold text-foreground">Dry Bulb Temperature (T_db)</td>
                              <td className="py-2 px-3 text-muted-foreground">Primary Known Moist Air Temperature</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">
                                {ip ? `${dbtF.toFixed(1)} °F (${dbtC.toFixed(1)} °C)` : `${dbtC.toFixed(1)} °C (${dbtF.toFixed(1)} °F)`}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Sensible boundary condition</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">3</td>
                              <td className="py-2 px-3 font-bold text-foreground">Known 2nd Parameter ({paramName})</td>
                              <td className="py-2 px-3 text-muted-foreground">Independent Thermodynamic Boundary</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{paramValDisplay}</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Governing moisture state condition</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">4</td>
                              <td className="py-2 px-3 font-bold text-foreground">Thermodynamic Formulation</td>
                              <td className="py-2 px-3 text-muted-foreground">ASHRAE Handbook Fundamentals</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">Hyland-Wexler Formulation</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Standard high-precision psychrometric model</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 2: Solved Psychrometric Properties */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                              <th className="py-2 px-2.5 w-10">Sr.</th>
                              <th className="py-2 px-3 text-left">Psychrometric Property</th>
                              <th className="py-2 px-2 text-center">Symbol</th>
                              <th className="py-2 px-3 text-right">SI Metric</th>
                              <th className="py-2 px-3 text-right">IP Imperial</th>
                              <th className="py-2 px-3 text-left">Engineering Definition &amp; Application</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-sans">
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">1</td>
                              <td className="py-2 px-3 font-bold text-foreground">Dry Bulb Temperature</td>
                              <td className="py-2 px-2 text-center font-mono font-bold">T_db</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{dbtC.toFixed(1)} °C</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{dbtF.toFixed(1)} °F</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Sensible thermal state of moist air</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">2</td>
                              <td className="py-2 px-3 font-bold text-foreground">Wet Bulb Temperature</td>
                              <td className="py-2 px-2 text-center font-mono font-bold">T_wb</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{wbtC.toFixed(1)} °C</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{wbtF.toFixed(1)} °F</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Adiabatic saturation limit &amp; evaporative threshold</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">3</td>
                              <td className="py-2 px-3 font-bold text-foreground">Dew Point Temperature</td>
                              <td className="py-2 px-2 text-center font-mono font-bold">T_dp</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{dpC.toFixed(1)} °C</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{dpF.toFixed(1)} °F</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Surface condensation risk boundary</td>
                            </tr>
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-foreground font-semibold">
                              <td className="py-2 px-2.5 text-center font-mono">4</td>
                              <td className="py-2 px-3 font-bold">Relative Humidity</td>
                              <td className="py-2 px-2 text-center font-mono font-bold">RH</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{rhVal.toFixed(1)} %</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{rhVal.toFixed(1)} %</td>
                              <td className="py-2 px-3 text-[10.5px]">Degree of moisture saturation (Pw / Pws)</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">5</td>
                              <td className="py-2 px-3 font-bold text-foreground">Humidity Ratio (Specific Moisture)</td>
                              <td className="py-2 px-2 text-center font-mono font-bold">W</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{wGPerKg.toFixed(2)} g/kg</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{wGrPerLb.toFixed(2)} gr/lb</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Mass ratio of moisture to dry air mass</td>
                            </tr>
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-foreground font-semibold">
                              <td className="py-2 px-2.5 text-center font-mono">6</td>
                              <td className="py-2 px-3 font-bold">Specific Enthalpy (Total Energy)</td>
                              <td className="py-2 px-2 text-center font-mono font-bold">h</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{hKjKg.toFixed(2)} kJ/kg</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{hBtuLb.toFixed(2)} BTU/lb</td>
                              <td className="py-2 px-3 text-[10.5px]">Total energy content (Sensible + Latent)</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">7</td>
                              <td className="py-2 px-3 font-bold text-foreground">Specific Volume</td>
                              <td className="py-2 px-2 text-center font-mono font-bold">v</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{vM3Kg.toFixed(4)} m³/kg</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{vFt3Lb.toFixed(4)} ft³/lb</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Volume per unit mass of dry air</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">8</td>
                              <td className="py-2 px-3 font-bold text-foreground">Moist Air Density</td>
                              <td className="py-2 px-2 text-center font-mono font-bold">ρ</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{densitySi.toFixed(3)} kg/m³</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{densityIp.toFixed(4)} lb/ft³</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Reciprocal of moist air specific volume</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">9</td>
                              <td className="py-2 px-3 font-bold text-foreground">Water Vapor Partial Pressure</td>
                              <td className="py-2 px-2 text-center font-mono font-bold">P_w</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{pwKpa.toFixed(3)} kPa</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{pwPsi.toFixed(4)} psi</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Partial pressure exerted by water vapor</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 3: Engineering Assessment (ASHRAE 55 / Energy Audit) */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                              <th className="py-2 px-2.5 w-10">Sr.</th>
                              <th className="py-2 px-3 text-left">Engineering Assessment Item</th>
                              <th className="py-2 px-3 text-left">Governing Rule / Basis</th>
                              <th className="py-2 px-3 text-right">Result / Value</th>
                              <th className="py-2 px-3 text-left">Design Compliance Note</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-sans">
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-foreground font-semibold">
                              <td className="py-2 px-2.5 text-center font-mono">1</td>
                              <td className="py-2 px-3 font-bold">Thermal Comfort Compliance (ASHRAE 55)</td>
                              <td className="py-2 px-3">ASHRAE 55 Standard</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{comfortStatusText}</td>
                              <td className="py-2 px-3 text-[10.5px]">Evaluates human thermal comfort criteria</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">2</td>
                              <td className="py-2 px-3 font-bold text-foreground">Sensible vs. Latent Enthalpy Breakdown</td>
                              <td className="py-2 px-3 text-muted-foreground">Energy Breakdown</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">Sensible: {sensPercent}% | Latent: {latPercent}%</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Sensible: {sensEnthalpy.toFixed(1)} kJ/kg, Latent: {latEnthalpy.toFixed(1)} kJ/kg</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">3</td>
                              <td className="py-2 px-3 font-bold text-foreground">Condensation Protection Boundary</td>
                              <td className="py-2 px-3 text-muted-foreground">Dew Point Envelope</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">Surface Temp &gt;= {dpC.toFixed(1)} °C ({dpF.toFixed(1)} °F)</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Pipe and duct insulation must maintain surface above T_dp</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                              <td className="py-2 px-2.5 text-center font-mono">4</td>
                              <td className="py-2 px-3 font-bold text-foreground">Evaporative Cooling Potential</td>
                              <td className="py-2 px-3 text-muted-foreground">Wet Bulb Depression</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{wbDepression} °C / K depression</td>
                              <td className="py-2 px-3 text-muted-foreground text-[10.5px]">Direct adiabatic water evaporation limit</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 4: 4-Column Dynamic Signature Block */}
                    <div className="border border-border rounded-xl overflow-hidden mt-6 bg-card">
                      <table className="w-full text-center text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[#FFE6CC] text-black font-bold border-b border-border">
                            <th className="py-2 px-3 text-left w-1/4">Designation</th>
                            <th className="py-2 px-3 w-1/4">Originator</th>
                            <th className="py-2 px-3 w-1/4">Reviewer</th>
                            <th className="py-2 px-3 w-1/4">Approver</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-sans">
                          <tr>
                            <td className="py-2 px-3 text-left font-bold text-foreground">Name:</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.name || sigDetails?.originatedName || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.name || sigDetails?.reviewerName || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.name || sigDetails?.approverName || "-"}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 text-left font-bold text-foreground">Date:</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.date || sigDetails?.originatedDate || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.date || sigDetails?.reviewerDate || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.date || sigDetails?.approverDate || "-"}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 text-left font-bold text-foreground">Signature:</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.status || (sigDetails?.originatedName ? "Signed" : "-")}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.status || (sigDetails?.reviewerName ? "Reviewed" : "-")}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.status || (sigDetails?.approverName ? "Approved" : "-")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Intelligence Side Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-1 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <PsychrometricIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calculatedData={calculatedData}
              unitSystem={unitSystem}
              atmPressure={atmPressure}
              dbtInput={dbtInput}
              secondParam={secondParam}
              paramValue={paramValue}
              onApplyPreset={(preset) => {
                if (isApprovedLocked) {
                  toast.info("Calculation is Approved & Locked by Discipline Coordinator. Unlock required to apply preset.");
                  return;
                }
                setUnitSystem(preset.unitSystem);
                setDbtInput(preset.dbt);
                setSecondParam(preset.secondParam);
                setParamValue(preset.paramValue);
                if (preset.atmPressure !== undefined) {
                  setAtmPressure(preset.atmPressure);
                }
                setHasCalculated(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Assign Comment & Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="parameter"
          calculatorTitle="Psychrometric Calculator"
          calculatorPath="/psychrometric"
          existingComments={commentsList.filter(c => c.spaceId === commentTargetItem.id || c.targetId === commentTargetItem.id || c.itemId === commentTargetItem.id)}
          onSave={handleSaveComment}
        />
      )}

      {/* Edit Psychrometric Parameters Modal (Double Click / Context Menu) */}
      {editModalOpen && (
        <EditPsychrometricModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSavePsychrometricModal}
          currentData={{
            unitSystem,
            dbtInput,
            secondParam,
            paramValue,
            atmPressure,
          }}
          isApprovedLocked={isApprovedLocked}
        />
      )}
    </AppShell>
  );
}

/* ──────────────────── Psychrometric Intelligence Drawer ───────────────────── */

interface PsychPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  unitSystem: "ip" | "si";
  dbt: number;
  secondParam: SecondParam;
  paramValue: number;
  atmPressure?: number;
}

function PsychrometricIntelligenceDrawer({
  onClose,
  calculatedData,
  unitSystem,
  atmPressure,
  dbtInput,
  secondParam,
  paramValue,
  onApplyPreset,
}: {
  onClose: () => void;
  calculatedData: {
    dbt: number;
    wbt: number;
    dp: number;
    rh: number;
    w: number;
    h: number;
    v: number;
    pw: number;
  };
  unitSystem: "si" | "ip";
  atmPressure: number | "";
  dbtInput: number | "";
  secondParam: SecondParam;
  paramValue: number | "";
  onApplyPreset: (preset: PsychPreset) => void;
}) {
  const ip = unitSystem === "ip";
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    comfort: true,
    enthalpy: true,
    condensation: true,
    evaporative: true,
    altitude: false,
    presets: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const tC = calculatedData.dbt;
  const rh = calculatedData.rh;
  const w = calculatedData.w;
  const dpC = calculatedData.dp;
  const wbC = calculatedData.wbt;
  const pAtmVal = atmPressure !== "" ? Number(atmPressure) : 101.325;

  // 1. Thermal Comfort & Health Assessment (ASHRAE 55)
  const comfortAudit = useMemo(() => {
    const isSummerComfort = tC >= 23 && tC <= 26 && rh >= 30 && rh <= 60;
    const isWinterComfort = tC >= 20 && tC <= 24 && rh >= 30 && rh <= 60;
    const isComfortable = isSummerComfort || isWinterComfort;

    let status = "Standard Operable State";
    let badgeClass = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    let message = "Air state is within typical engineering conditioning operating bounds.";
    let icon = Activity;

    if (isComfortable) {
      status = isSummerComfort ? "ASHRAE 55 Summer Comfort Compliant" : "ASHRAE 55 Winter Comfort Compliant";
      badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      message = "Air state fully satisfies human thermal comfort criteria (ASHRAE 55 / ISO 7730 standard).";
      icon = CheckCircle2;
    } else if (rh > 80) {
      status = "High Humidity / Mold & Condensation Risk";
      badgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      message = "Relative humidity exceeds 80%. Elevated likelihood of microbial growth and condensation on uninsulated cool surfaces.";
      icon = AlertTriangle;
    } else if (rh < 25) {
      status = "Excessively Dry / Electrostatic Risk";
      badgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      message = "Relative humidity is below 25%. High risk of electrostatic discharge, dry mucosa, and material shrinkage.";
      icon = AlertTriangle;
    } else if (tC > 38) {
      status = "Extreme Heat / Heat Stress Risk";
      badgeClass = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      message = "High dry bulb temperature requires extensive sensible cooling and occupant heat stress mitigation.";
      icon = Flame;
    } else if (tC < 0) {
      status = "Sub-Freezing / Coil Freeze Risk";
      badgeClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      message = "Dry bulb temperature is below 0°C. Protect cooling and preheat coils with antifreeze controls.";
      icon = Wind;
    }

    return { status, badgeClass, message, isComfortable, icon };
  }, [tC, rh]);

  // 2. Sensible vs Latent Enthalpy Partition
  const enthalpyPartition = useMemo(() => {
    const hSensible_kJ = 1.006 * tC;
    const hLatent_kJ = w * (2501 + 1.805 * tC);
    const total_h_kJ = calculatedData.h;

    const sensibleRatio = total_h_kJ > 0 ? Math.min(100, Math.max(0, Math.round((hSensible_kJ / total_h_kJ) * 100))) : 50;
    const latentRatio = Math.max(0, 100 - sensibleRatio);

    const hSensibleDisplay = ip ? (hSensible_kJ / 2.326).toFixed(2) + " BTU/lb" : hSensible_kJ.toFixed(2) + " kJ/kg";
    const hLatentDisplay = ip ? (hLatent_kJ / 2.326).toFixed(2) + " BTU/lb" : hLatent_kJ.toFixed(2) + " kJ/kg";
    const hTotalDisplay = ip ? (total_h_kJ / 2.326).toFixed(2) + " BTU/lb" : total_h_kJ.toFixed(2) + " kJ/kg";

    // Air density
    const density_kg_m3 = calculatedData.v > 0 ? (1 / calculatedData.v) : 1.2;
    const densityDisplay = ip ? (density_kg_m3 * 0.062428).toFixed(4) + " lb/ft³" : density_kg_m3.toFixed(3) + " kg/m³";

    return {
      hSensibleDisplay,
      hLatentDisplay,
      hTotalDisplay,
      sensibleRatio,
      latentRatio,
      densityDisplay,
    };
  }, [tC, w, calculatedData.h, calculatedData.v, ip]);

  // 3. Condensation & Dew Point Depression Analysis
  const condensationAnalysis = useMemo(() => {
    const dpDepressionC = tC - dpC;
    const dpDepressionF = dpDepressionC * 1.8;
    const depressionDisplay = ip ? `${dpDepressionF.toFixed(1)} °F` : `${dpDepressionC.toFixed(1)} °C`;

    let riskLevel = "Low Risk";
    let riskClass = "text-emerald-600 dark:text-emerald-400";
    let advice = "Safe thermal margin against envelope and ductwork condensation.";

    if (dpDepressionC < 2.0) {
      riskLevel = "Critical Risk";
      riskClass = "text-red-600 dark:text-red-400";
      advice = "Any surface cooler than the air by >2°C will immediately form condensate. Vapor retarder required.";
    } else if (dpDepressionC < 5.0) {
      riskLevel = "Moderate Risk";
      riskClass = "text-amber-600 dark:text-amber-400";
      advice = "Ensure chilled water piping and supply ducts are adequately insulated.";
    }

    return {
      depressionDisplay,
      riskLevel,
      riskClass,
      advice,
    };
  }, [tC, dpC, ip]);

  // 4. Direct Evaporative & Dehumidification Analysis
  const hvacFeasibility = useMemo(() => {
    const wbDepressionC = tC - wbC;
    const wbDepressionF = wbDepressionC * 1.8;
    const evaporativePotential = ip ? `${wbDepressionF.toFixed(1)} °F` : `${wbDepressionC.toFixed(1)} °C`;

    // Moisture to remove to reach 50% RH at current DBT
    const targetW = wFromRH(tC, 50, pAtmVal * 1000);
    const deltaW_kg = Math.max(0, w - targetW);
    const deltaWDisplay = ip
      ? `${(deltaW_kg * 7000).toFixed(1)} gr/lb`
      : `${(deltaW_kg * 1000).toFixed(2)} g/kg`;

    return {
      evaporativePotential,
      deltaWDisplay,
      needsDehumidification: deltaW_kg > 0.0005,
    };
  }, [tC, wbC, w, pAtmVal, ip]);

  // 5. Altitude & Atmospheric Analysis
  const altitudeAnalysis = useMemo(() => {
    const altMeters = 44330 * (1 - Math.pow(pAtmVal / 101.325, 0.190284));
    const altFeet = altMeters * 3.28084;
    const densityRatio = (calculatedData.v > 0 ? (1 / calculatedData.v) : 1.2) / 1.204;

    return {
      altDisplay: ip ? `${Math.round(altFeet).toLocaleString()} ft` : `${Math.round(altMeters).toLocaleString()} m`,
      densityRatioPct: Math.round(densityRatio * 100),
      isHighAltitude: Math.abs(altMeters) > 300,
    };
  }, [pAtmVal, calculatedData.v, ip]);

  // 6. Presets list
  const presets: PsychPreset[] = [
    {
      id: "ashrae-summer-peak",
      name: "ASHRAE 0.4% Summer Peak",
      category: "Outdoor Design",
      description: "Standard hot summer ambient design condition for cooling coil sizing.",
      unitSystem: "ip",
      dbt: 95,
      secondParam: "wb",
      paramValue: 78,
      atmPressure: 101.325,
    },
    {
      id: "ashrae-indoor-comfort",
      name: "Standard Indoor Comfort",
      category: "ASHRAE 55",
      description: "Typical conditioned indoor office space (75°F / 50% RH).",
      unitSystem: "ip",
      dbt: 75,
      secondParam: "rh",
      paramValue: 50,
      atmPressure: 101.325,
    },
    {
      id: "winter-heating",
      name: "Winter Heating Condition",
      category: "Winter Design",
      description: "Indoor space during winter heating season (70°F / 30% RH).",
      unitSystem: "ip",
      dbt: 70,
      secondParam: "rh",
      paramValue: 30,
      atmPressure: 101.325,
    },
    {
      id: "datacenter-white-space",
      name: "Data Center (ASHRAE TC 9.9)",
      category: "Critical Facility",
      description: "Recommended data hall inlet condition (68°F DBT / 50°F DP).",
      unitSystem: "ip",
      dbt: 68,
      secondParam: "dp",
      paramValue: 50,
      atmPressure: 101.325,
    },
    {
      id: "hospital-operating-room",
      name: "Hospital Surgery Suite",
      category: "Healthcare",
      description: "ASHRAE 170 surgical suite condition (66°F DBT / 45% RH).",
      unitSystem: "ip",
      dbt: 66,
      secondParam: "rh",
      paramValue: 45,
      atmPressure: 101.325,
    },
    {
      id: "cleanroom-iso5",
      name: "Cleanroom Class 100 / ISO 5",
      category: "Pharmaceutical",
      description: "High-spec semiconductor or cleanroom space (20°C DBT / 40% RH).",
      unitSystem: "si",
      dbt: 20,
      secondParam: "rh",
      paramValue: 40,
      atmPressure: 101.325,
    },
    {
      id: "cold-storage",
      name: "Cold Storage Room",
      category: "Refrigeration",
      description: "Chilled produce preservation chamber (2°C DBT / 85% RH).",
      unitSystem: "si",
      dbt: 2,
      secondParam: "rh",
      paramValue: 85,
      atmPressure: 101.325,
    },
  ];

  const StatusIcon = comfortAudit.icon;

  return (
    <div className="h-full w-[360px] flex flex-col font-sans select-none animate-in fade-in duration-200 bg-card">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-border/80 bg-slate-50/50 dark:bg-slate-900/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <span className="text-[13px] font-bold text-foreground tracking-tight">Psychrometric Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Close Intelligence Drawer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60 text-xs">
        {/* 1. Comfort & Health Assessment */}
        <section className="p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <StatusIcon className="size-3.5 text-primary" /> ASHRAE 55 Audit
            </span>
          </div>

          <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${comfortAudit.badgeClass}`}>
            <span className="font-bold text-[11.5px] flex items-center gap-1.5">
              <StatusIcon className="size-3.5 shrink-0" />
              {comfortAudit.status}
            </span>
            <p className="text-[11px] opacity-90 leading-relaxed">
              {comfortAudit.message}
            </p>
          </div>
        </section>

        {/* 2. Sensible vs Latent Enthalpy Breakdown */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("enthalpy")}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-3.5 text-[#0A7BC7]" /> Enthalpy & Density
            </span>
            {openSections.enthalpy ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.enthalpy && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Sensible Heat</span>
                  <div className="font-mono font-bold text-xs text-foreground mt-0.5">
                    {enthalpyPartition.hSensibleDisplay}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {enthalpyPartition.sensibleRatio}% of Enthalpy
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Latent (Moisture)</span>
                  <div className="font-mono font-bold text-xs text-primary mt-0.5">
                    {enthalpyPartition.hLatentDisplay}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {enthalpyPartition.latentRatio}% of Enthalpy
                  </span>
                </div>
              </div>

              {/* Progress bar for Sensible vs Latent */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                  <span>Sensible ({enthalpyPartition.sensibleRatio}%)</span>
                  <span>Latent ({enthalpyPartition.latentRatio}%)</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                  <div style={{ width: `${enthalpyPartition.sensibleRatio}%` }} className="bg-[#0A7BC7] h-full" />
                  <div style={{ width: `${enthalpyPartition.latentRatio}%` }} className="bg-primary h-full" />
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg border border-border/50 text-[11px] mt-1">
                <span className="font-semibold text-muted-foreground">Moist Air Density</span>
                <span className="font-mono font-bold text-foreground">{enthalpyPartition.densityDisplay}</span>
              </div>
            </div>
          )}
        </section>

        {/* 3. Condensation & Dew Point Margin */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("condensation")}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Droplets className="size-3.5 text-blue-500" /> Condensation Risk
            </span>
            {openSections.condensation ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.condensation && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Dew Point Depression</span>
                  <span className="font-mono font-bold text-sm text-foreground">{condensationAnalysis.depressionDisplay}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Risk Level</span>
                  <span className={`font-bold text-xs ${condensationAnalysis.riskClass}`}>{condensationAnalysis.riskLevel}</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                {condensationAnalysis.advice}
              </p>
            </div>
          )}
        </section>

        {/* 4. Evaporative Cooling Potential & Dehumidification */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("evaporative")}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wind className="size-3.5 text-emerald-500" /> Process Feasibility
            </span>
            {openSections.evaporative ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.evaporative && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10.5px] font-semibold text-muted-foreground">Evaporative Cooling Potential</span>
                  <span className="font-mono font-bold text-foreground">{hvacFeasibility.evaporativePotential}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Max sensible temperature drop achievable via direct 100% adiabatic saturation.
                </span>
              </div>

              {hvacFeasibility.needsDehumidification && (
                <div className="bg-primary/5 p-2.5 rounded-xl border border-primary/20 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10.5px] font-semibold text-primary">Dehumidification Needed</span>
                    <span className="font-mono font-bold text-primary">{hvacFeasibility.deltaWDisplay}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Moisture removal required per unit mass of dry air to reach 50% relative humidity.
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 5. Altitude & Atmospheric Correction */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("altitude")}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gauge className="size-3.5 text-purple-500" /> Altitude & Barometric
            </span>
            {openSections.altitude ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.altitude && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Equiv. Altitude</span>
                  <div className="font-mono font-bold text-xs text-foreground mt-0.5">
                    {altitudeAnalysis.altDisplay}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Density Multiplier</span>
                  <div className="font-mono font-bold text-xs text-foreground mt-0.5">
                    {altitudeAnalysis.densityRatioPct}%
                  </div>
                </div>
              </div>
              <p className="text-[10.5px] text-muted-foreground px-1">
                {altitudeAnalysis.isHighAltitude
                  ? "Significant altitude variance. Airflow rates (CFM / L/s) must be derated by the density multiplier."
                  : "Sea level standard barometric conditions (101.325 kPa / 29.921 inHg)."}
              </p>
            </div>
          )}
        </section>

        {/* 6. Standard HVAC Presets (One-Click Apply) */}
        <section className="p-4 flex flex-col gap-2.5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("presets")}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="size-3.5 text-amber-500" /> Standard HVAC Presets
            </span>
            {openSections.presets ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </div>

          {openSections.presets && (
            <div className="flex flex-col gap-2 mt-1">
              <p className="text-[10.5px] text-muted-foreground px-0.5">
                Click any standard design benchmark to immediately load and solve:
              </p>
              <div className="flex flex-col gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onApplyPreset(p);
                      toast.success(`Applied preset "${p.name}"`);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-primary/5 transition text-left group cursor-pointer"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[11.5px] text-foreground group-hover:text-primary transition-colors">{p.name}</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground">{p.category}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-tight">{p.description}</span>
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
