import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportSmokeExtractPDF } from "@/lib/exportSmokeExtractPDF";
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

  const handleUnitToggle = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (targetUnit === unitSystem) return;
    if (shouldConvert) {
      if (targetUnit === "ip") {
        if (typeof area === "number") setArea(Number((area * 10.7639).toFixed(1)));
        if (typeof height === "number") setHeight(Number((height * 3.28084).toFixed(2)));
        if (typeof ductLength === "number") setDuctLength(Number((ductLength * 3.28084).toFixed(1)));
        if (typeof frictionFactor === "number") setFrictionFactor(Number((frictionFactor * 0.1233).toFixed(3)));
        if (typeof louverLoss === "number") setLouverLoss(Number((louverLoss * 0.00401865).toFixed(3)));
        if (typeof fanLoss === "number") setFanLoss(Number((fanLoss * 0.00401865).toFixed(3)));
      } else {
        if (typeof area === "number") setArea(Number((area / 10.7639).toFixed(1)));
        if (typeof height === "number") setHeight(Number((height / 3.28084).toFixed(2)));
        if (typeof ductLength === "number") setDuctLength(Number((ductLength / 3.28084).toFixed(1)));
        if (typeof frictionFactor === "number") setFrictionFactor(Number((frictionFactor / 0.1233).toFixed(2)));
        if (typeof louverLoss === "number") setLouverLoss(Math.round(louverLoss / 0.00401865));
        if (typeof fanLoss === "number") setFanLoss(Math.round(fanLoss / 0.00401865));
      }
    }
    setUnitSystem(targetUnit);
  };

  const calculatedData = useMemo(() => {
    const areaSI = unitSystem === "ip" && typeof area === "number" ? area / 10.7639 : area;
    const heightSI = unitSystem === "ip" && typeof height === "number" ? height / 3.28084 : height;
    const ductLengthSI = unitSystem === "ip" && typeof ductLength === "number" ? ductLength / 3.28084 : ductLength;
    const frictionFactorSI = unitSystem === "ip" && typeof frictionFactor === "number" ? frictionFactor / 0.1233 : frictionFactor;
    const louverLossSI = unitSystem === "ip" && typeof louverLoss === "number" ? louverLoss / 0.00401865 : louverLoss;
    const fanLossSI = unitSystem === "ip" && typeof fanLoss === "number" ? fanLoss / 0.00401865 : fanLoss;
    return computeSmokeExtractFanData(areaSI, heightSI, acph, fanQty, ductLengthSI, frictionFactorSI, louverLossSI, fanLossSI, effMotor, effFan, numFansMotor);
  }, [area, height, acph, fanQty, ductLength, frictionFactor, louverLoss, fanLoss, effMotor, effFan, numFansMotor, unitSystem]);

  const currentUserName = profile?.name || profile?.email || userData?.username || "Abubakar Chanda";
  const sigDetails = getSignatureBlockDetails(
    activeProjectId || project?.id || "default",
    "/smoke-extract-fan",
    currentUserName,
    calcReviewState
  );

  const handleExportPDF = () => {
    exportSmokeExtractPDF(
      {
        area: Number(area) || (unitSystem === "ip" ? 1076 : 100),
        height: Number(height) || (unitSystem === "ip" ? 10 : 3.0),
        acph: Number(acph) || 10,
        fanQty: Number(fanQty) || 1,
        ductLength: Number(ductLength) || (unitSystem === "ip" ? 65 : 20),
        frictionFactor: Number(frictionFactor) || (unitSystem === "ip" ? 0.12 : 1.0),
        louverLoss: Number(louverLoss) || (unitSystem === "ip" ? 0.2 : 50),
        fanLoss: Number(fanLoss) || (unitSystem === "ip" ? 0.08 : 20),
        effMotor: Number(effMotor) || 90,
        effFan: Number(effFan) || 75,
        numFansMotor: Number(numFansMotor) || 1,
        calculatedData,
      },
      unitSystem
    );
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
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-300 flex items-center justify-between gap-2">
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
              className="w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono focus:outline-none focus:border-primary text-xs font-bold transition hover:border-[#0A7BC7]/50"
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>Add Comment</span>
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
            <span>Add Comment</span>
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
    <AppShell
      title="Smoke Extract Fan"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Corridor Smoke Extract Fan</h1>
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
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/smoke-extract-fan" calculatorTitle="Corridor Smoke Extract Fan" />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitToggle}
                inputDescriptions="Corridor dimensions, duct length & friction"
                conversionExample={unitSystem === "si" ? "Convert 100 m² → 1,076 ft², 20 m → 65.6 ft" : "Convert 1,076 ft² → 100 m², 65.6 ft → 20 m"}
              />
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
                  Sizing Calculator
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
            </div>

            <div className="flex items-center gap-2 select-none shrink-0">
              <TBtn onClick={handleExportPDF} title="Export PDF Calculation">
                <FileText className="size-3.5" /> Export
              </TBtn>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {tab === "calculator" && (
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Inputs Column (lg:col-span-5) */}
                  <div className="lg:col-span-5 space-y-5">
                    <div
                      id="card-params"
                      data-field-id="card-params"
                      data-comment-target="card-params"
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          📥 Sizing Parameters
                        </span>
                        <RowCommentCornerBadge
                          id="card-params"
                          count={getMergedItemComments("card-params", "Sizing Parameters", commentsList, "/smoke-extract-fan", project?.id).length}
                          onClick={() => handleOpenComment("card-params", "Sizing Parameters")}
                        />
                      </div>

                      {/* Subsection 1: Corridor Parameters */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Corridor Parameters
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {renderInputBox("se-corridor-area", `Area of Corridor (${unitSystem === "ip" ? "ft²" : "m²"})`, area, setArea, unitSystem === "ip" ? 1076 : 100, unitSystem === "ip" ? "1076" : "100")}
                          {renderInputBox("se-corridor-height", `Height of Corridor (${unitSystem === "ip" ? "ft" : "m"})`, height, setHeight, unitSystem === "ip" ? 10 : 3.0, unitSystem === "ip" ? "10.0" : "3.0")}
                          {renderInputBox("se-acph", "Air Changes per Hour (ACPH)", acph, setAcph, 10, "10")}
                          {renderInputBox("se-fan-qty", "Quantity of Fans", fanQty, (val) => { setFanQty(val); setNumFansMotor(val); }, 1, "1", 1, "1")}
                        </div>
                      </div>

                      {/* Subsection 2: Duct Static Head Loss */}
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Duct Static Head Loss
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {renderInputBox("se-smoke-duct-length", `Ducting Length (${unitSystem === "ip" ? "ft" : "m"})`, ductLength, setDuctLength, unitSystem === "ip" ? 65 : 20, unitSystem === "ip" ? "65" : "20")}
                          {renderInputBox("se-smoke-duct-friction-factor", `Frictional Factor (${unitSystem === "ip" ? "in.wg/100ft" : "Pa/m"})`, frictionFactor, setFrictionFactor, unitSystem === "ip" ? 0.12 : 1.0, unitSystem === "ip" ? "0.12" : "1.0")}
                          {renderInputBox("se-smoke-losses-louvers", `Louver & Grille Pressure Drop (${unitSystem === "ip" ? "in.wg" : "Pa"})`, louverLoss, setLouverLoss, unitSystem === "ip" ? 0.2 : 50, unitSystem === "ip" ? "0.20" : "50")}
                          {renderInputBox("se-smoke-losses-fan", `Fan Internal Losses (${unitSystem === "ip" ? "in.wg" : "Pa"})`, fanLoss, setFanLoss, unitSystem === "ip" ? 0.08 : 20, unitSystem === "ip" ? "0.08" : "20")}
                        </div>
                      </div>

                      {/* Subsection 3: Fan Motor Sizing */}
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Fan Motor Sizing
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {renderInputBox("se-motor-eff-motor", "Motor Efficiency (%)", effMotor, setEffMotor, 90, "90")}
                          {renderInputBox("se-motor-eff-fan", "Fan Efficiency (%)", effFan, setEffFan, 75, "75")}
                          {renderInputBox("se-motor-fan-qty", "Number of Fans (Motor calculation)", numFansMotor, setNumFansMotor, 1, "1", 1, "1")}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Results Column (lg:col-span-7) STICKY matching Pump Sizing */}
                  <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                    <div
                      id="card-results"
                      data-field-id="card-results"
                      data-comment-target="card-results"
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          ⚡ Sizing Results Summary
                        </span>
                        <RowCommentCornerBadge
                          id="card-results"
                          count={getMergedItemComments("card-results", "Sizing Results Summary", commentsList, "/smoke-extract-fan", project?.id).length}
                          onClick={() => handleOpenComment("card-results", "Sizing Results Summary")}
                        />
                      </div>

                      {/* 4 Stat Cards in a Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Card 1: Blue - Airflow per Fan */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="res-flow-fan"
                              data-field-id="res-flow-fan"
                              data-comment-target="res-flow-fan"
                              className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 transition-all cursor-context-menu relative"
                            >
                              <RowCommentCornerBadge
                                id="res-flow-fan"
                                count={getMergedItemComments("res-flow-fan", "Airflow per Fan", commentsList, "/smoke-extract-fan", project?.id).length}
                                onClick={() => handleOpenComment("res-flow-fan", "Airflow per Fan")}
                              />
                              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Airflow / Fan</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {unitSystem === "ip" ? `${(calculatedData.flowEachLsRound * 2.11888).toFixed(0)} CFM` : `${calculatedData.flowEachLsRound} L/s`}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("res-flow-fan", "Airflow per Fan")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Airflow per Fan", unitSystem === "ip" ? `${(calculatedData.flowEachLsRound * 2.11888).toFixed(0)} CFM` : `${calculatedData.flowEachLsRound} L/s`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <span>Copy Value</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Card 2: Amber - Total Fan Static Head */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="res-total-static"
                              data-field-id="res-total-static"
                              data-comment-target="res-total-static"
                              className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 transition-all cursor-context-menu relative"
                            >
                              <RowCommentCornerBadge
                                id="res-total-static"
                                count={getMergedItemComments("res-total-static", "Total Fan Static Head Loss", commentsList, "/smoke-extract-fan", project?.id).length}
                                onClick={() => handleOpenComment("res-total-static", "Total Fan Static Head Loss")}
                              />
                              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Static Head Loss</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {unitSystem === "ip" ? `${(calculatedData.headRound * 0.00401865).toFixed(3)} in.wg` : `${calculatedData.headRound} Pa`}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("res-total-static", "Total Fan Static Head Loss")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Total Fan Static Head Loss", unitSystem === "ip" ? `${(calculatedData.headRound * 0.00401865).toFixed(3)} in.wg` : `${calculatedData.headRound} Pa`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <span>Copy Value</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Card 3: Emerald - Total Motor Power */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="res-total-motor-power"
                              data-field-id="res-total-motor-power"
                              data-comment-target="res-total-motor-power"
                              className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 transition-all cursor-context-menu relative"
                            >
                              <RowCommentCornerBadge
                                id="res-total-motor-power"
                                count={getMergedItemComments("res-total-motor-power", "Total Motor Power", commentsList, "/smoke-extract-fan", project?.id).length}
                                onClick={() => handleOpenComment("res-total-motor-power", "Total Motor Power")}
                              />
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Total Motor Power</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {unitSystem === "ip" ? `${(calculatedData.totalMotorPower * 1.34102).toFixed(2)} HP` : `${calculatedData.totalMotorPower.toFixed(2)} kW`}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("res-total-motor-power", "Total Motor Power")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Total Motor Power", unitSystem === "ip" ? `${(calculatedData.totalMotorPower * 1.34102).toFixed(2)} HP` : `${calculatedData.totalMotorPower.toFixed(2)} kW`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <span>Copy Value</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Card 4: Purple - Power per Fan */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="res-power-fan"
                              data-field-id="res-power-fan"
                              data-comment-target="res-power-fan"
                              className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 transition-all cursor-context-menu relative"
                            >
                              <RowCommentCornerBadge
                                id="res-power-fan"
                                count={getMergedItemComments("res-power-fan", "Power Required per Fan", commentsList, "/smoke-extract-fan", project?.id).length}
                                onClick={() => handleOpenComment("res-power-fan", "Power Required per Fan")}
                              />
                              <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Power / Fan</div>
                              <div className="text-xl font-bold font-mono text-foreground mt-1">
                                {unitSystem === "ip" ? `${(calculatedData.powerEachRound * 1.34102).toFixed(2)} HP` : `${calculatedData.powerEachRound.toFixed(2)} kW`}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("res-power-fan", "Power Required per Fan")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Power Required per Fan", unitSystem === "ip" ? `${(calculatedData.powerEachRound * 1.34102).toFixed(2)} HP` : `${calculatedData.powerEachRound.toFixed(2)} kW`)}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <span>Copy Value</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </div>

                      {/* DETAILED METRICS TABLE */}
                      <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                          <span className="text-slate-600 dark:text-zinc-400">Corridor Volume:</span>
                          <span className="font-mono font-bold">{unitSystem === "ip" ? `${(calculatedData.volume * 35.3147).toFixed(1)} ft³` : `${calculatedData.volume.toFixed(1)} m³`}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                          <span className="text-slate-600 dark:text-zinc-400">Total Smoke Extract Rate:</span>
                          <span className="font-mono font-bold">{unitSystem === "ip" ? `${(calculatedData.smokeExtractRate * 2118.88).toFixed(0)} CFM` : `${calculatedData.smokeExtractRate.toFixed(3)} m³/s`}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                          <span className="text-slate-600 dark:text-zinc-400">Equivalent Length of Fittings:</span>
                          <span className="font-mono font-bold">{unitSystem === "ip" ? `${(calculatedData.fittingsEqLen * 3.28084).toFixed(1)} ft` : `${calculatedData.fittingsEqLen.toFixed(2)} m`}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                          <span className="text-slate-600 dark:text-zinc-400">Total Equivalent Duct Length:</span>
                          <span className="font-mono font-bold">{unitSystem === "ip" ? `${(calculatedData.totalEqLen * 3.28084).toFixed(1)} ft` : `${calculatedData.totalEqLen.toFixed(1)} m`}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                          <span className="text-slate-600 dark:text-zinc-400">Head Loss in Ducting:</span>
                          <span className="font-mono font-bold">{unitSystem === "ip" ? `${(calculatedData.frictionLoss * 0.00401865).toFixed(3)} in.wg` : `${calculatedData.frictionLoss.toFixed(2)} Pa`}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                          <span className="text-slate-600 dark:text-zinc-400">Flow Rate per Fan:</span>
                          <span className="font-mono font-bold">{unitSystem === "ip" ? `${(calculatedData.flowEachM3s * 2118.88).toFixed(0)} CFM` : `${calculatedData.flowEachM3s.toFixed(3)} m³/s`}</span>
                        </div>
                        <div className="flex justify-between py-1 font-bold text-foreground">
                          <span>Total Motor Power (+10% Safety):</span>
                          <span className="font-mono font-bold text-[#0A7BC7]">{unitSystem === "ip" ? `${(calculatedData.totalMotorPower * 1.34102).toFixed(2)} HP (${calculatedData.totalMotorPower.toFixed(2)} kW)` : `${calculatedData.totalMotorPower.toFixed(2)} kW`}</span>
                        </div>
                      </div>

                      {/* Assumptions reference block */}
                      <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                        <p className="font-semibold text-foreground mb-1">Standard Reference &amp; Assumptions:</p>
                        <ul className="list-disc pl-4 space-y-1.5">
                          <li>Calculates smoke extract in accordance with NFPA 92 and BS EN 12101-6.</li>
                          <li>Friction loss calculation uses equivalent length index for typical fittings ($1.6 \times$ duct length).</li>
                          <li>Fan motor sizing includes a $+10\%$ electrical security factor applied to nominal shaft power.</li>
                        </ul>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === "report" && (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                  
                  {/* 1. Title */}
                  <div className="pb-1">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                      Corridor Smoke Extract Fan Calculation
                    </h2>
                  </div>

                  {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-b border-border divide-x divide-border">
                          <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                          <td className="p-2.5 font-mono text-foreground font-medium">{(project as any)?.calcNo || "TRV-CALC-SEF-01"}</td>
                          <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                          <td className="p-2.5 font-mono font-medium">{formatDateStr(new Date().toISOString())}</td>
                        </tr>
                        <tr className="border-b border-border divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                          <td className="p-2.5 font-mono">{project?.code || (project as any)?.projectNo || "P000"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                          <td className="p-2.5">{project?.client || "-"}</td>
                        </tr>
                        <tr className="divide-x divide-border">
                          <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                          <td className="p-2.5">{project?.name || "Corridor Smoke Extract Fan Sizing"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                          <td className="p-2.5">{(project as any)?.endUser || (project as any)?.location || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. Table 1: Design Input Parameters */}
                  <div className="border border-border rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                          <th className="p-2.5 w-12 text-center border-r border-border">No.</th>
                          <th className="p-2.5 text-left border-r border-border">Design Parameter</th>
                          <th className="p-2.5 w-28 text-center border-r border-border">Value</th>
                          <th className="p-2.5 w-24 text-center border-r border-border">Unit</th>
                          <th className="p-2.5 text-left">Engineering Basis / Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">1</td>
                          <td className="p-2 border-r border-border font-medium">Area of Corridor</td>
                          <td className="p-2 text-center border-r border-border font-mono">{area || (unitSystem === "ip" ? 1076 : 100)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "ft²" : "m²"}</td>
                          <td className="p-2 text-muted-foreground">Corridor floor footprint</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">2</td>
                          <td className="p-2 border-r border-border font-medium">Height of Corridor</td>
                          <td className="p-2 text-center border-r border-border font-mono">{height || (unitSystem === "ip" ? 10 : 3.0)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "ft" : "m"}</td>
                          <td className="p-2 text-muted-foreground">Floor-to-ceiling clear smoke zone height</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">3</td>
                          <td className="p-2 border-r border-border font-medium">Air Changes per Hour (ACPH)</td>
                          <td className="p-2 text-center border-r border-border font-mono">{acph || 10}</td>
                          <td className="p-2 text-center border-r border-border">ACPH</td>
                          <td className="p-2 text-muted-foreground">Per NFPA 92 / BS EN 12101 standards</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">4</td>
                          <td className="p-2 border-r border-border font-medium">Quantity of Operating Fans</td>
                          <td className="p-2 text-center border-r border-border font-mono">{fanQty || 1}</td>
                          <td className="p-2 text-center border-r border-border">No.</td>
                          <td className="p-2 text-muted-foreground">Operating smoke extract fan count</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">5</td>
                          <td className="p-2 border-r border-border font-medium">Ducting Equivalent Route Length</td>
                          <td className="p-2 text-center border-r border-border font-mono">{ductLength || (unitSystem === "ip" ? 65 : 20)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "ft" : "m"}</td>
                          <td className="p-2 text-muted-foreground">Physical duct run length</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">6</td>
                          <td className="p-2 border-r border-border font-medium">Duct Friction Gradient Factor</td>
                          <td className="p-2 text-center border-r border-border font-mono">{frictionFactor || (unitSystem === "ip" ? 0.12 : 1.0)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "in.wg/100ft" : "Pa/m"}</td>
                          <td className="p-2 text-muted-foreground">Duct design friction rate</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">7</td>
                          <td className="p-2 border-r border-border font-medium">Louver & Grille Pressure Drop</td>
                          <td className="p-2 text-center border-r border-border font-mono">{louverLoss || (unitSystem === "ip" ? 0.2 : 50)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "in.wg" : "Pa"}</td>
                          <td className="p-2 text-muted-foreground">Intake / discharge component head loss</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">8</td>
                          <td className="p-2 border-r border-border font-medium">Fan Internal & Casing Losses</td>
                          <td className="p-2 text-center border-r border-border font-mono">{fanLoss || (unitSystem === "ip" ? 0.08 : 20)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "in.wg" : "Pa"}</td>
                          <td className="p-2 text-muted-foreground">Internal silencer, dampers & casing losses</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">9</td>
                          <td className="p-2 border-r border-border font-medium">Motor Efficiency</td>
                          <td className="p-2 text-center border-r border-border font-mono">{effMotor || 90}%</td>
                          <td className="p-2 text-center border-r border-border">%</td>
                          <td className="p-2 text-muted-foreground">Nominal electric motor efficiency</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">10</td>
                          <td className="p-2 border-r border-border font-medium">Fan Aerodynamic Efficiency</td>
                          <td className="p-2 text-center border-r border-border font-mono">{effFan || 75}%</td>
                          <td className="p-2 text-center border-r border-border">%</td>
                          <td className="p-2 text-muted-foreground">Fan impeller static efficiency</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 4. Table 2: Aerodynamic Sizing & Motor Power Results (Highlighted Rows) */}
                  <div className="border border-border rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                          <th className="p-2.5 w-12 text-center border-r border-border">No.</th>
                          <th className="p-2.5 text-left border-r border-border">Calculated Engineering Metric</th>
                          <th className="p-2.5 w-36 text-center border-r border-border">Output Value</th>
                          <th className="p-2.5 w-24 text-center border-r border-border">Unit</th>
                          <th className="p-2.5 text-left">Compliance & Safety Factor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">1</td>
                          <td className="p-2 border-r border-border font-medium">Total Corridor Volume</td>
                          <td className="p-2 text-center border-r border-border font-mono">{unitSystem === "ip" ? (calculatedData.volume * 35.3147).toFixed(1) : calculatedData.volume.toFixed(1)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "ft³" : "m³"}</td>
                          <td className="p-2 text-muted-foreground">Gross enclosed volume</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">2</td>
                          <td className="p-2 border-r border-border font-medium">Total Required Smoke Extract</td>
                          <td className="p-2 text-center border-r border-border font-mono">{unitSystem === "ip" ? Math.round(calculatedData.smokeExtractRate * 2118.88) : calculatedData.smokeExtractRate.toFixed(3)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "CFM" : "m³/s"}</td>
                          <td className="p-2 text-muted-foreground">Total exhaust airflow capacity</td>
                        </tr>
                        {/* Highlighted Row 3 */}
                        <tr className="bg-[#DAE9F8] dark:bg-blue-950/40 font-bold border-y border-blue-200 dark:border-blue-900">
                          <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">3</td>
                          <td className="p-2 border-r border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-100">Sized Airflow per Fan (Operating)</td>
                          <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 font-mono text-blue-950 dark:text-blue-100">{unitSystem === "ip" ? Math.round(calculatedData.flowEachLsRound * 2.11888) : `${calculatedData.flowEachLsRound} L/s`}</td>
                          <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">{unitSystem === "ip" ? "CFM" : "L/s"}</td>
                          <td className="p-2 text-blue-900 dark:text-blue-200">Rounded up to standard fan increment (5 L/s)</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">4</td>
                          <td className="p-2 border-r border-border font-medium">Fittings Equivalent Length</td>
                          <td className="p-2 text-center border-r border-border font-mono">{unitSystem === "ip" ? (calculatedData.fittingsEqLen * 3.28084).toFixed(1) : calculatedData.fittingsEqLen.toFixed(1)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "ft" : "m"}</td>
                          <td className="p-2 text-muted-foreground">60% equivalent dynamic loss allowance</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">5</td>
                          <td className="p-2 border-r border-border font-medium">Total Equivalent Duct Run</td>
                          <td className="p-2 text-center border-r border-border font-mono">{unitSystem === "ip" ? (calculatedData.totalEqLen * 3.28084).toFixed(1) : calculatedData.totalEqLen.toFixed(1)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "ft" : "m"}</td>
                          <td className="p-2 text-muted-foreground">Straight duct + equivalent fittings</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">6</td>
                          <td className="p-2 border-r border-border font-medium">Ductwork Friction Pressure Loss</td>
                          <td className="p-2 text-center border-r border-border font-mono">{unitSystem === "ip" ? (calculatedData.frictionLoss * 0.00401865).toFixed(3) : calculatedData.frictionLoss.toFixed(1)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "in.wg" : "Pa"}</td>
                          <td className="p-2 text-muted-foreground">Calculated friction drop along route</td>
                        </tr>
                        {/* Highlighted Row 7 */}
                        <tr className="bg-[#DAE9F8] dark:bg-blue-950/40 font-bold border-y border-blue-200 dark:border-blue-900">
                          <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">7</td>
                          <td className="p-2 border-r border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-100">Total Fan Static External Head Loss</td>
                          <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 font-mono text-blue-950 dark:text-blue-100">{unitSystem === "ip" ? (calculatedData.headRound * 0.00401865).toFixed(3) : calculatedData.headRound}</td>
                          <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">{unitSystem === "ip" ? "in.wg" : "Pa"}</td>
                          <td className="p-2 text-blue-900 dark:text-blue-200">Includes +10% engineering margin, rounded to 10 Pa</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">8</td>
                          <td className="p-2 border-r border-border font-medium">Calculated Shaft Power per Fan</td>
                          <td className="p-2 text-center border-r border-border font-mono">{unitSystem === "ip" ? (calculatedData.powerEachRound * 1.34102).toFixed(2) : calculatedData.powerEachRound.toFixed(2)}</td>
                          <td className="p-2 text-center border-r border-border">{unitSystem === "ip" ? "HP" : "kW"}</td>
                          <td className="p-2 text-muted-foreground">Net aerodynamic shaft horsepower</td>
                        </tr>
                        {/* Highlighted Row 9 */}
                        <tr className="bg-[#DAE9F8] dark:bg-blue-950/40 font-bold border-y border-blue-200 dark:border-blue-900">
                          <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">9</td>
                          <td className="p-2 border-r border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-100">Recommended Total Motor Rating</td>
                          <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 font-mono text-blue-950 dark:text-blue-100">{unitSystem === "ip" ? (calculatedData.totalMotorPower * 1.34102).toFixed(2) : calculatedData.totalMotorPower.toFixed(2)}</td>
                          <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">{unitSystem === "ip" ? "HP" : "kW"}</td>
                          <td className="p-2 text-blue-900 dark:text-blue-200">Includes +10% electrical safety factor margin</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 5. Table 3: Detailed Step-by-Step Calculations */}
                  <div className="border border-border rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                          <th className="p-2.5 w-12 text-center border-r border-border">Step</th>
                          <th className="p-2.5 text-left border-r border-border">Calculation Description & Governing Formula</th>
                          <th className="p-2.5 text-left border-r border-border">Substituted Values</th>
                          <th className="p-2.5 w-32 text-center">Calculated Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">1</td>
                          <td className="p-2 border-r border-border font-medium">Corridor Volume: V = Area × Height</td>
                          <td className="p-2 border-r border-border font-mono text-muted-foreground">V = {area || 100} m² × {height || 3.0} m</td>
                          <td className="p-2 text-center font-mono font-bold text-foreground">{calculatedData.volume.toFixed(2)} m³</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">2</td>
                          <td className="p-2 border-r border-border font-medium">Smoke Extract Rate: Q = (V × ACPH) / 3600</td>
                          <td className="p-2 border-r border-border font-mono text-muted-foreground">Q = ({calculatedData.volume.toFixed(2)} × {acph || 10}) / 3600</td>
                          <td className="p-2 text-center font-mono font-bold text-foreground">{calculatedData.smokeExtractRate.toFixed(3)} m³/s</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">3</td>
                          <td className="p-2 border-r border-border font-medium">Airflow per Fan: Q_fan = ceil((Q / N × 1000) / 5) * 5</td>
                          <td className="p-2 border-r border-border font-mono text-muted-foreground">Q_fan = ceil(({calculatedData.smokeExtractRate.toFixed(3)} / {fanQty || 1} × 1000) / 5) * 5</td>
                          <td className="p-2 text-center font-mono font-bold text-primary">{calculatedData.flowEachLsRound} L/s</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">4</td>
                          <td className="p-2 border-r border-border font-medium">Duct Friction Loss: ΔP = L_eq × FrictionFactor</td>
                          <td className="p-2 border-r border-border font-mono text-muted-foreground">ΔP = {calculatedData.totalEqLen.toFixed(1)} m × {frictionFactor || 1.0} Pa/m</td>
                          <td className="p-2 text-center font-mono font-bold text-foreground">{calculatedData.frictionLoss.toFixed(2)} Pa</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">5</td>
                          <td className="p-2 border-r border-border font-medium">Fan Static Head: H = ceil((ΔP + Louver + Fan) × 1.1, 10)</td>
                          <td className="p-2 border-r border-border font-mono text-muted-foreground">H = ceil(({calculatedData.frictionLoss.toFixed(1)} + {louverLoss || 50} + {fanLoss || 20}) × 1.1)</td>
                          <td className="p-2 text-center font-mono font-bold text-primary">{calculatedData.headRound} Pa</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">6</td>
                          <td className="p-2 border-r border-border font-medium">Fan Shaft Power: P = (Q × H) / (η_m × η_f × 1000)</td>
                          <td className="p-2 border-r border-border font-mono text-muted-foreground">P = ({calculatedData.flowEachM3s.toFixed(4)} × {calculatedData.headRound}) / ({(Number(effMotor) || 90) / 100} × {(Number(effFan) || 75) / 100} × 1000)</td>
                          <td className="p-2 text-center font-mono font-bold text-foreground">{calculatedData.powerEachRound.toFixed(2)} kW</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">7</td>
                          <td className="p-2 border-r border-border font-medium">Total Motor Power: P_tot = P_fan × 1.1 × N_fans</td>
                          <td className="p-2 border-r border-border font-mono text-muted-foreground">P_tot = {calculatedData.powerEachRound.toFixed(2)} kW × 1.1 × {numFansMotor || 1}</td>
                          <td className="p-2 text-center font-mono font-bold text-primary">{calculatedData.totalMotorPower.toFixed(2)} kW</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 6. Standard 3-Tier Signature Sign-Off Block (#FFE6CC Header) */}
                  <div className="pt-2">
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <table className="w-full border-collapse">
                        <thead className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold border-b border-border">
                          <tr className="divide-x border-b border-border">
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
                              {sigDetails.originatedName || currentUserName || "Abubakar Chanda"}
                            </td>
                            <td className="p-2.5 text-center font-medium">
                              {sigDetails.reviewerName || ""}
                            </td>
                            <td className="p-2.5 text-center font-medium">
                              {sigDetails.approverName || ""}
                            </td>
                          </tr>
                          <tr className="divide-x divide-border">
                            <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                            <td className="p-2.5 text-center font-mono">
                              {sigDetails.originatedDate || formatDateStr(new Date().toISOString())}
                            </td>
                            <td className="p-2.5 text-center font-mono">
                              {sigDetails.reviewerDate || ""}
                            </td>
                            <td className="p-2.5 text-center font-mono">
                              {sigDetails.approverDate || ""}
                            </td>
                          </tr>
                        </tbody>
                      </table>
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
