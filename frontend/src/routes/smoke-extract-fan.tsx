import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle, X,
  Save, FolderOpen, ChevronDown, ChevronUp, Trash2, Copy, Clipboard,
  RotateCcw, MessageSquare, Edit3, FileText, CheckCircle2, Sparkles
} from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { computeSmokeExtractFanData } from "@/lib/calc-smoke-extract-fan";
import { UnitToggle } from "@/components/workspace/UnitToggle";

export const Route = createFileRoute("/smoke-extract-fan")({
  head: () => ({
    meta: [
      { title: "Smoke Extract Fan — MEP Calc" },
      { name: "description", content: "Smoke Extract Fan calculator for corridor smoke extract sizing and static pressure." },
    ],
  }),
  component: SmokeExtractFanPage,
});

interface SavedCalculation {
  id: string;
  type: string;
  name: string;
  savedAt: string;
  values: Record<string, any>;
}

function SmokeExtractFanPage() {
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [intelOpen, setIntelOpen] = useState(false);
  const [tab, setTab] = useState<"calculator" | "report">("calculator");
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/smoke-extract-fan", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/smoke-extract-fan", activeProjectId || project?.id);
  const { profile, userData } = useAuth();
  const [area, setArea] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");
  const [acph, setAcph] = useState<number | "">("");
  const [fanQty, setFanQty] = useState<number | "">("");

  const [ductLength, setDuctLength] = useState<number | "">("");
  const [frictionFactor, setFrictionFactor] = useState<number | "">(""); // Pa/m
  const [louverLoss, setLouverLoss] = useState<number | "">(""); // Pa
  const [fanLoss, setFanLoss] = useState<number | "">(""); // Pa

  const [effMotor, setEffMotor] = useState<number | "">(90); // %
  const [effFan, setEffFan] = useState<number | "">(75); // %
  const [numFansMotor, setNumFansMotor] = useState<number | "">("");

  // Expandable sections
  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(true);

  const isApprovedLocked = useCalculationLock("/smoke-extract-fan", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Comment System State & Persistence matching Preliminary Cooling Load
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pId = project?.id || "default";
    const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/smoke-extract-fan`);
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
    localStorage.setItem(`mep_calc_comments_${pId}_/smoke-extract-fan`, JSON.stringify(newList));
    try {
      if (typeof forceSaveToCloud === "function") {
        forceSaveToCloud();
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
      calculatorTitle: "Corridor Smoke Extract Fan",
      calculatorPath: "/smoke-extract-fan",
      projectId: project?.id || "default",
      projectName: project?.name || "Corridor Smoke Extract",
    };
    const updated = [commentWithMeta, ...commentsList];
    saveComments(updated);
    toast.success(`Comment / task assigned on "${commentTargetItem?.name || "parameter"}"`);
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

  const handleResetValue = (label: string, setter: (val: number | "") => void, defaultVal: number | "") => {
    setter(defaultVal);
    toast.success(`Reset ${label} to default ${defaultVal !== "" ? defaultVal : "(blank)"}`);
  };

  const handleClearValue = (label: string, setter: (val: number | "") => void) => {
    setter("");
    toast.info(`Cleared ${label}`);
  };

  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`smoke_extract_state_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.area !== undefined) setArea(data.area);
          if (data.height !== undefined) setHeight(data.height);
          if (data.acph !== undefined) setAcph(data.acph);
          if (data.fanQty !== undefined) setFanQty(data.fanQty);
          if (data.ductLength !== undefined) setDuctLength(data.ductLength);
          if (data.frictionFactor !== undefined) setFrictionFactor(data.frictionFactor);
          if (data.louverLoss !== undefined) setLouverLoss(data.louverLoss);
          if (data.fanLoss !== undefined) setFanLoss(data.fanLoss);
          if (data.effMotor !== undefined) setEffMotor(data.effMotor);
          if (data.effFan !== undefined) setEffFan(data.effFan);
          if (data.numFansMotor !== undefined) setNumFansMotor(data.numFansMotor);
        }
      } catch (e) {
        console.error(e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = { area, height, acph, fanQty, ductLength, frictionFactor, louverLoss, fanLoss, effMotor, effFan, numFansMotor };
      localStorage.setItem(`smoke_extract_state_${project.id}`, JSON.stringify(dataToSave));
    }
  }, [project?.id, loadedProjectId, area, height, acph, fanQty, ductLength, frictionFactor, louverLoss, fanLoss, effMotor, effFan, numFansMotor]);

  // Custom Load/Save dialogs
  const [saves, setSaves] = useState<SavedCalculation[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showLoadModal, setShowLoadModal] = useState<boolean>(false);
  const [saveName, setSaveName] = useState<string>("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mep_custom_calculator_saves");
      if (stored) {
        setSaves(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load custom saves", e);
    }
  }, []);

  const saveToLocalStorage = (newSaves: SavedCalculation[]) => {
    setSaves(newSaves);
    localStorage.setItem("mep_custom_calculator_saves", JSON.stringify(newSaves));
  };

  const handleSaveCurrent = () => {
    if (!saveName.trim()) return;
    const newSave: SavedCalculation = {
      id: "custom_calc_" + Date.now(),
      type: "smoke-extract",
      name: saveName.trim(),
      savedAt: new Date().toISOString(),
      values: {
        "se-corridor-area": area,
        "se-corridor-height": height,
        "se-acph": acph,
        "se-fan-qty": fanQty,
        "se-smoke-duct-length": ductLength,
        "se-smoke-duct-friction-factor": frictionFactor,
        "se-smoke-losses-louvers": louverLoss,
        "se-smoke-losses-fan": fanLoss,
        "se-motor-eff-motor": effMotor,
        "se-motor-eff-fan": effFan,
        "se-motor-fan-qty": numFansMotor
      }
    };
    const updated = [newSave, ...saves];
    saveToLocalStorage(updated);
    setSaveName("");
    setShowSaveModal(false);
    forceSaveToCloud();
  };

  const handleLoadSave = (id: string) => {
    const target = saves.find(s => s.id === id);
    if (!target) return;
    const v = target.values;
    if (v["se-corridor-area"] !== undefined) setArea(Number(v["se-corridor-area"]));
    if (v["se-corridor-height"] !== undefined) setHeight(Number(v["se-corridor-height"]));
    if (v["se-acph"] !== undefined) setAcph(Number(v["se-acph"]));
    if (v["se-fan-qty"] !== undefined) setFanQty(Number(v["se-fan-qty"]));
    if (v["se-smoke-duct-length"] !== undefined) setDuctLength(Number(v["se-smoke-duct-length"]));
    if (v["se-smoke-duct-friction-factor"] !== undefined) setFrictionFactor(Number(v["se-smoke-duct-friction-factor"]));
    if (v["se-smoke-losses-louvers"] !== undefined) setLouverLoss(Number(v["se-smoke-losses-louvers"]));
    if (v["se-smoke-losses-fan"] !== undefined) setFanLoss(Number(v["se-smoke-losses-fan"]));
    if (v["se-motor-eff-motor"] !== undefined) setEffMotor(Number(v["se-motor-eff-motor"]));
    if (v["se-motor-eff-fan"] !== undefined) setEffFan(Number(v["se-motor-eff-fan"]));
    if (v["se-motor-fan-qty"] !== undefined) setNumFansMotor(Number(v["se-motor-fan-qty"]));
    setShowLoadModal(false);
  };

  const handleDeleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = saves.filter(s => s.id !== id);
    saveToLocalStorage(updated);
  };

  const calculatedData = useMemo(() => {
    return computeSmokeExtractFanData(area, height, acph, fanQty, ductLength, frictionFactor, louverLoss, fanLoss, effMotor, effFan, numFansMotor);
  }, [area, height, acph, fanQty, ductLength, frictionFactor, louverLoss, fanLoss, effMotor, effFan, numFansMotor]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["Smoke Extract Fan Calculation"],
      [],
      ["Corridor Parameters"],
      ["Corridor Area", `${area} m²`],
      ["Corridor Height", `${height} m`],
      ["Corridor Volume", `${calculatedData.volume.toFixed(2)} m³`],
      ["Air Change per Hour (ACPH)", acph],
      ["Total Smoke Extract Rate", `${calculatedData.smokeExtractRate.toFixed(3)} m³/s`],
      ["Quantity of Fans", fanQty],
      ["Air Flow Rate per Fan", `${calculatedData.flowEachLsRound} L/s`],
      ["Flow of Each Fan", `${calculatedData.flowEachM3s.toFixed(3)} m³/s`],
      [],
      ["Static Head Sizing"],
      ["Ducting Length", `${ductLength} m`],
      ["Equivalent Length of Fittings + Accessories", `${calculatedData.fittingsEqLen.toFixed(2)} m`],
      ["Total Equivalent Length", `${calculatedData.totalEqLen.toFixed(2)} m`],
      ["Duct Friction Factor", `${frictionFactor} Pa/m`],
      ["Head Loss in Ducting", `${calculatedData.frictionLoss.toFixed(2)} Pa`],
      ["Louver & Grille Drop", `${louverLoss} Pa`],
      ["Internal Fan Drop", `${fanLoss} Pa`],
      ["Total Static of the Fan", `${calculatedData.headRound} Pa`],
      [],
      ["Motor Selection"],
      ["Motor Efficiency", `${effMotor} %`],
      ["Fan Efficiency", `${effFan} %`],
      ["Power Required per Fan", `${calculatedData.powerEachRound.toFixed(2)} kW`],
      ["Number of Motor Fans", numFansMotor],
      ["Total Motor Power (+10% Safety)", `${calculatedData.totalMotorPower.toFixed(2)} kW`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Smoke Extract Fan");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Smoke_Extract_Fan.xlsx", "Excel Document", ["xlsx"]);
  };

  // Helper component to render an input field wrapped with Context Menu and Comment Indicator
  const renderInputBox = (
    id: string,
    label: string,
    value: number | "",
    setter: (val: number | "") => void,
    defaultVal: number | "",
    placeholder: string,
    min?: number,
    step: string = "any"
  ) => {
    const itemComments = getMergedItemComments(id, label, commentsList, "/smoke-extract-fan", project?.id);
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
            className={`flex flex-col gap-1.5 group cursor-context-menu p-2 rounded-xl transition-all relative ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <RowCommentCornerBadge
              id={id}
              count={itemComments.length}
              onClick={() => handleOpenComment(id, label)}
              title={`${itemComments.length} comment(s)/task(s) assigned`}
            />
            <label className="font-semibold text-foreground flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span>{label}</span>
              </span>
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">Right-click for options</span>
            </label>
            <input
              id={id}
              type="number"
              min={min}
              step={step}
              value={value}
              onChange={(e) => setter(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={placeholder}
              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal transition hover:border-[#0A7BC7]/50"
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, value)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handlePasteValue(label, setter)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleResetValue(label, setter, defaultVal)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default ({defaultVal !== "" ? defaultVal : "Blank"})</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => handleClearValue(label, setter)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
          >
            <Trash2 className="size-3.5" />
            <span>Clear Field</span>
            <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // Helper component to render a result output row wrapped with Context Menu and Comment Indicator
  const renderResultRow = (
    id: string,
    label: string,
    valueFormatted: string,
    isHighlight: boolean = false,
    highlightClass: string = "text-foreground",
    colSpanTwo: boolean = false
  ) => {
    const itemComments = getMergedItemComments(id, label, commentsList, "/smoke-extract-fan", project?.id);
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
            className={`flex justify-between items-center py-1.5 border-b border-border/40 hover:bg-slate-100/40 dark:hover:bg-slate-800/30 px-2 rounded-lg transition cursor-context-menu group relative ${
              colSpanTwo ? "col-span-2" : ""
            } ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <RowCommentCornerBadge
              id={id}
              count={itemComments.length}
              onClick={() => handleOpenComment(id, label)}
              title={`${itemComments.length} comment(s)/task(s) assigned`}
            />
            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
              <span>{label}</span>
            </span>
            <strong className={`font-bold font-mono ${highlightClass}`}>{valueFormatted}</strong>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleCopyValue(label, valueFormatted)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
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
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Copy Full Line</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <AppShell title="Smoke Extract Fan" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          <div className="flex flex-col gap-1 select-none">
            <div className="flex flex-wrap items-center justify-between gap-4 mt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Corridor Smoke Extract Fan</h1>
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
                <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/smoke-extract-fan" calculatorTitle="Corridor Smoke Extract Fan" />
                {commentsList.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>{commentsList.length} Active Task(s) / Comment(s)</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={setUnitSystem}
                  ipLabel="IP"
                  siLabel="SI"
                  inputDescriptions="System Units"
                />
              </div>
            </div>
          </div>

          {/* Secondary Action Row */}
          <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 mt-2 mb-2">
            <div className="flex items-center gap-2">
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
                  Fan Sizer
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

              <button type="button" onClick={() => setTab("report")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 bg-background hover:bg-slate-50 dark:hover:bg-slate-900 border border-border shadow-sm cursor-pointer text-foreground">
                <HelpCircle className="size-3.5 text-primary" /> Formula Breakdown
              </button>
            </div>

            <button type="button" className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 bg-background hover:bg-slate-50 dark:hover:bg-slate-900 border border-border shadow-sm cursor-pointer text-foreground" onClick={() => window.print()}>
              <FileText className="size-3.5 text-muted-foreground" /> Export
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {tab === "calculator" && (
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Inputs Column */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Card 1: Corridor Parameters */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">1. Corridor Parameters</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox("se-corridor-area", "Area of Corridor (m²)", area, setArea, 100, "100")}
                  {renderInputBox("se-corridor-height", "Height of Corridor (m)", height, setHeight, 3.0, "3.0")}
                  {renderInputBox("se-acph", "Air Changes per Hour (ACPH)", acph, setAcph, 10, "10")}
                  {renderInputBox("se-fan-qty", "Quantity of Fans", fanQty, (val) => { setFanQty(val); setNumFansMotor(val); }, 1, "1", 1, "1")}
                </div>
              </div>

              {/* Card 2: Fan Head Sizing */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">2. Duct Static Head Loss</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox("se-smoke-duct-length", "Ducting Length (m)", ductLength, setDuctLength, 20, "20")}
                  {renderInputBox("se-smoke-duct-friction-factor", "Frictional Factor (Pa/m)", frictionFactor, setFrictionFactor, 1.0, "1.0")}
                  {renderInputBox("se-smoke-losses-louvers", "Louver & Grille Pressure Drop (Pa)", louverLoss, setLouverLoss, 50, "50")}
                  {renderInputBox("se-smoke-losses-fan", "Fan Internal Losses (Pa)", fanLoss, setFanLoss, 20, "20")}
                </div>
              </div>

              {/* Card 3: Fan Motor Sizing */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">3. Fan Motor Sizing</h3>
                </div>

                <div className="flex flex-col gap-3.5 text-xs">
                  {renderInputBox("se-motor-eff-motor", "Motor Efficiency (%)", effMotor, setEffMotor, 90, "90")}
                  {renderInputBox("se-motor-eff-fan", "Fan Efficiency (%)", effFan, setEffFan, 75, "75")}
                  {renderInputBox("se-motor-fan-qty", "Number of Fans (Motor calculation)", numFansMotor, setNumFansMotor, 1, "1", 1, "1")}
                </div>
              </div>
            </div>

            {/* Results Column */}
            <div className="lg:col-span-7 flex flex-col gap-5 sticky top-0 pb-4">
              {/* Summary card */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Airflow & static head results</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                  {renderResultRow("res-volume", "Corridor Volume", `${calculatedData.volume.toFixed(1)} m³`)}
                  {renderResultRow("res-extract-rate", "Total Smoke Extract", `${calculatedData.smokeExtractRate.toFixed(3)} m³/s`)}
                  {renderResultRow("res-flow-fan", "Airflow per Fan", `${calculatedData.flowEachLsRound} L/s`, true, "text-[#0A7BC7] text-[13px]")}
                  {renderResultRow("res-fittings-eq", "Equivalent Length of Fittings", `${calculatedData.fittingsEqLen.toFixed(2)} m`)}
                  {renderResultRow("res-total-eq", "Total Equivalent Length", `${calculatedData.totalEqLen.toFixed(1)} m`)}
                  {renderResultRow("res-[#0A7BC7]", "Head Loss in Ducting", `${calculatedData.frictionLoss.toFixed(2)} Pa`)}
                  {renderResultRow("res-total-static", "Total Fan Static Head Loss", `${calculatedData.headRound} Pa`, true, "text-[#0A7BC7] text-[14px]", true)}
                </div>
              </div>

              {/* Motor sizing card */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Motor Sizing Results</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-sans text-xs">
                  {renderResultRow("res-flow-each-m3s", "Flow of each fan", `${calculatedData.flowEachM3s.toFixed(3)} m³/s`, true, "text-[#0A7BC7]")}
                  {renderResultRow("res-static-fan", "Total Static of the Fan", `${calculatedData.headRound} Pa`, true, "text-[#0A7BC7]")}
                  {renderResultRow("res-power-fan", "Power Required per Fan", `${calculatedData.powerEachRound.toFixed(2)} kW`)}
                  {renderResultRow("res-total-motor-power", "Total Motor Power (+10% Safety margin)", `${calculatedData.totalMotorPower.toFixed(2)} kW`, true, "text-[#0A7BC7] text-[14px]", true)}
                </div>
              </div>

              

              {/* Assumptions reference block */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-1">Standard Reference &amp; Assumptions:</p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>Calculates fresh air requirements in accordance with NFPA 92 and BS EN 12101-6.</li>
                  <li>Friction loss calculation uses equivalent length sizers for typical fitting indices ($1.6 \times$ duct length).</li>
                  <li>Fan motor sizing includes a $+10\%$ electrical security factor applied to nominal shaft horsepower outputs.</li>
                </ul>
              </div>
            </div>
          </div>
              </div>
            )}
            {tab === "report" && (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-card border border-border rounded-2xl shadow-xs mx-4 mb-4 mt-2">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><HelpCircle className="size-5 text-primary"/> Detailed Calculations & Steps</h2>
                <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
                  {/* Detailed Calculations Steps */}
              <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"}`}>
                <button
                  
                  className="w-full flex items-center justify-between p-5 font-bold text-xs uppercase tracking-wider text-muted-foreground font-sans hover:bg-slate-50 dark:hover:bg-slate-900/40 select-none cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="size-4 text-primary" /> Σ Detailed Calculations Steps
                  </span>
                  
                </button>
                <div className="p-5 pt-0 border-t border-border/40 text-xs font-sans flex flex-col gap-4 max-h-[350px] overflow-y-auto">
                    {/* Step 1 */}
                    {(() => {
                      const stepId = "step-1-volume";
                      const stepLabel = "Step 1: Corridor Volume";
                      const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/smoke-extract-fan", project?.id);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start border-b border-border/40 pb-2 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition relative ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <RowCommentCornerBadge
                                count={stepComments.length}
                                onClick={() => handleOpenComment(stepId, stepLabel)}
                              />
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">1</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                </div>
                                <div className="font-mono text-primary my-1">V = Area × Height</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">V = {area || 100} m² × {height || 3.0} m</div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.volume.toFixed(2)} m³</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment(stepId, stepLabel)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Step 1 Volume", `${calculatedData.volume.toFixed(2)} m³`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Step 1 Result</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                    {/* Step 2 */}
                    {(() => {
                      const stepId = "step-2-extract-rate";
                      const stepLabel = "Step 2: Smoke Extract Rate";
                      const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/smoke-extract-fan", project?.id);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start border-b border-border/40 pb-2 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition relative ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <RowCommentCornerBadge
                                count={stepComments.length}
                                onClick={() => handleOpenComment(stepId, stepLabel)}
                              />
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">2</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                </div>
                                <div className="font-mono text-primary my-1">Q_smoke = (Volume × ACPH) / 3600</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">Q_smoke = ({calculatedData.volume.toFixed(2)} m³ × {acph || 10} ACPH) / 3600</div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.smokeExtractRate.toFixed(3)} m³/s</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment(stepId, stepLabel)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Step 2 Extract Rate", `${calculatedData.smokeExtractRate.toFixed(3)} m³/s`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Step 2 Result</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                    {/* Step 3 */}
                    {(() => {
                      const stepId = "step-3-flow-fan";
                      const stepLabel = "Step 3: Sized Flow Rate per Fan";
                      const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/smoke-extract-fan", project?.id);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start border-b border-border/40 pb-2 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition relative ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <RowCommentCornerBadge
                                count={stepComments.length}
                                onClick={() => handleOpenComment(stepId, stepLabel)}
                              />
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">3</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                </div>
                                <div className="font-mono text-primary my-1">Q_each = Ceiling( (Q_smoke / fanQty × 1000) / 5 ) * 5</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">Q_each = Ceiling( ({calculatedData.smokeExtractRate.toFixed(3)} / {fanQty || 1} × 1000) / 5 ) * 5</div>
                                <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">{calculatedData.flowEachLsRound} L/s</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment(stepId, stepLabel)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Step 3 Flow per Fan", `${calculatedData.flowEachLsRound} L/s`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Step 3 Result</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                    {/* Step 4 */}
                    {(() => {
                      const stepId = "step-4-friction-loss";
                      const stepLabel = "Step 4: Ducting Equivalent Length & Friction Loss";
                      const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/smoke-extract-fan", project?.id);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start border-b border-border/40 pb-2 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition relative ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <RowCommentCornerBadge
                                count={stepComments.length}
                                onClick={() => handleOpenComment(stepId, stepLabel)}
                              />
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">4</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                </div>
                                <div className="font-mono text-primary my-1">Eq. Length = DuctLength × 1.6 | frictionLoss = Eq. Length × frictionFactor</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">Eq. Length = {calculatedData.totalEqLen.toFixed(1)} m | frictionLoss = {calculatedData.totalEqLen.toFixed(1)} m × {frictionFactor || 1.0} Pa/m</div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.frictionLoss.toFixed(2)} Pa</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment(stepId, stepLabel)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Step 4 Friction Loss", `${calculatedData.frictionLoss.toFixed(2)} Pa`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Step 4 Result</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                    {/* Step 5 */}
                    {(() => {
                      const stepId = "step-5-static-head";
                      const stepLabel = "Step 5: Fan Total Static Head";
                      const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/smoke-extract-fan", project?.id);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start border-b border-border/40 pb-2 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition relative ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <RowCommentCornerBadge
                                count={stepComments.length}
                                onClick={() => handleOpenComment(stepId, stepLabel)}
                              />
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">5</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                </div>
                                <div className="font-mono text-primary my-1">Total Head = Round( (frictionLoss + LouverDrop + FanDrop) × 1.1 ) to nearest 10</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">Total Head = Round( ({calculatedData.frictionLoss.toFixed(2)} + {louverLoss || 50} + {fanLoss || 20}) × 1.1 ) to nearest 10</div>
                                <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">{calculatedData.headRound} Pa</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment(stepId, stepLabel)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Step 5 Static Head", `${calculatedData.headRound} Pa`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Step 5 Result</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                    {/* Step 6 */}
                    {(() => {
                      const stepId = "step-6-power-fan";
                      const stepLabel = "Step 6: Sized Power per Fan";
                      const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/smoke-extract-fan", project?.id);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start border-b border-border/40 pb-2 cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition relative ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <RowCommentCornerBadge
                                count={stepComments.length}
                                onClick={() => handleOpenComment(stepId, stepLabel)}
                              />
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">6</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                </div>
                                <div className="font-mono text-primary my-1">Power = (FlowEachM3s × HeadRound) / (Eff_Motor × Eff_Fan × 1000)</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">Power = ({calculatedData.flowEachM3s.toFixed(4)} m³/s × {calculatedData.headRound} Pa) / ({(Number(effMotor) || 90) / 100} × {(Number(effFan) || 75) / 100} × 1000)</div>
                                <div className="font-bold text-[11px] text-foreground mt-0.5">{calculatedData.powerEachRound.toFixed(2)} kW</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment(stepId, stepLabel)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Step 6 Power per Fan", `${calculatedData.powerEachRound.toFixed(2)} kW`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Step 6 Result</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}

                    {/* Step 7 */}
                    {(() => {
                      const stepId = "step-7-total-motor-power";
                      const stepLabel = "Step 7: Sized Total Motor Power";
                      const stepComments = getMergedItemComments(stepId, undefined, commentsList, "/smoke-extract-fan", project?.id);
                      const isHighlighted = highlightedTargetId === stepId || (highlightedTargetId && stepId.includes(highlightedTargetId.toLowerCase()));
                      return (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id={stepId}
                              data-item-id={stepId}
                              data-field-id={stepId}
                              className={`flex gap-3 items-start cursor-context-menu hover:bg-slate-100/40 dark:hover:bg-slate-800/30 p-1.5 rounded-lg transition relative ${
                                isHighlighted ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20" : ""
                              }`}
                            >
                              <RowCommentCornerBadge
                                count={stepComments.length}
                                onClick={() => handleOpenComment(stepId, stepLabel)}
                              />
                              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">7</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground flex items-center justify-between">
                                  <span>{stepLabel}</span>
                                </div>
                                <div className="font-mono text-primary my-1">Total Power = PowerEach × 1.1 × qtyFans (Motor calculation)</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">Total Power = {calculatedData.powerEachRound.toFixed(2)} kW × 1.1 × {numFansMotor || 1}</div>
                                <div className="font-bold text-[11px] text-[#0A7BC7] mt-0.5">{calculatedData.totalMotorPower.toFixed(2)} kW</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment(stepId, stepLabel)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>{stepComments.length > 0 ? `View Comments (${stepComments.length})` : "Add Comment"}</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Step 7 Total Motor Power", `${calculatedData.totalMotorPower.toFixed(2)} kW`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Step 7 Result</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })()}
                      </div>
                    </div>
                    </div>
                    </div>
                      )}
                    </div>

{/* Intelligence Drawer (Collapsible Right Side Panel) */}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
        }`}
      >
        {intelOpen && (
          <div className="flex flex-col h-full overflow-hidden w-[360px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="font-bold text-[13.5px] uppercase tracking-wider text-foreground">Live Intelligence</h3>
              </div>
              <button onClick={() => setIntelOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-surface-2">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4 text-sm text-muted-foreground">
              <p>Intelligence insights will appear here.</p>
            </div>
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl">
            <h3 className="font-bold text-base text-foreground">Save Current Smoke Extract</h3>
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-muted-foreground">Calculation Name</label>
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="e.g. GF Entrance Corridor"
                className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
              />
            </div>
            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrent}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs transition hover:bg-primary/95 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 flex flex-col gap-4 shadow-2xl">
            <h3 className="font-bold text-base text-foreground">Load Saved Calculations</h3>
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
              {saves.filter(s => s.type === "smoke-extract").length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  📭 No saved calculations found.
                </div>
              ) : (
                saves
                  .filter(s => s.type === "smoke-extract")
                  .map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleLoadSave(s.id)}
                      className="border border-border/70 rounded-xl p-3.5 hover:border-primary/50 transition cursor-pointer bg-slate-50/20 dark:bg-slate-900/10 flex justify-between items-center gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-foreground block truncate">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                          Area: {s.values["se-corridor-area"]}m² · Ht: {s.values["se-corridor-height"]}m · ACPH: {s.values["se-acph"]}
                        </span>
                        <span className="text-[9.5px] text-muted-foreground/80 mt-1 block">
                          Saved: {new Date(s.savedAt).toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSave(s.id, e)}
                        className="text-muted-foreground hover:text-red-500 transition p-2 cursor-pointer"
                        title="Delete Save"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))
              )}
            </div>
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
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
          targetType="parameter"
          calculatorTitle="Corridor Smoke Extract Fan"
          calculatorPath="/smoke-extract-fan"
          onSave={handleSaveComment}
          existingComments={commentsList.filter(c => c.spaceId === commentTargetItem.id || c.targetId === commentTargetItem.id || c.itemId === commentTargetItem.id)}
        />
      )}
      </div>
      </div>
    </AppShell>
  );
}
