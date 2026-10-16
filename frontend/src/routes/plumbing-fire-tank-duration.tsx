import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  FileText, Printer, HelpCircle, X, Check,
  Copy, Clipboard, RotateCcw, MessageSquare, Download,
  Activity, ShieldCheck, Gauge, Zap, FileSpreadsheet,
  Layers, ArrowUpRight, Flame, ShieldAlert, ChevronUp, ChevronDown, Info,
  CheckCircle2, AlertTriangle, Clock, Droplets, Waves, Timer, Sparkles
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { TBtn } from "@/components/workspace/Button";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import {
  type FireTankDurationParams,
  DEFAULT_PARAMS_SI,
  DEFAULT_PARAMS_IP,
  computeFireTankDurationCalculations
} from "@/lib/calc-plumbing-fire-tank-duration";


export const Route = createFileRoute("/plumbing-fire-tank-duration")({
  head: () => ({
    meta: [
      { title: "Fire Tank Duration & Refill — MEP Calc" },
      { name: "description", content: "Verify fire water tank autonomy duration, net storage requirement, and municipal refill replenishment times per NFPA 22, NFPA 13 & NFPA 14." },
    ],
  }),
  component: FireTankDurationPage,
});

export function FireTankDurationPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-fire-tank-duration", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-fire-tank-duration", activeProjectId || project?.id);
  const { user } = useAuth();
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [sizingParams, setSizingParams] = useState<FireTankDurationParams>(DEFAULT_PARAMS_SI);
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [isLoaded, setIsLoaded] = useState(false);

  const { isLocked: isReviewLocked } = useCalculationLock("/plumbing-fire-tank-duration");
  const sigDetails = getSignatureBlockDetails(project?.id || "default", "/plumbing-fire-tank-duration", user?.name || "MEP Engineer", calcReviewState);

  // Deep-link from comment notifications and URL query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("commentTargetId");
      if (targetId) {
        setHighlightedTargetId(targetId);
        setTimeout(() => {
          const el = document.getElementById(`field-${targetId}`) || document.getElementById(targetId);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }

      const onGlobalNotification = (e: any) => {
        const detail = e.detail;
        if (detail?.targetId) {
          setHighlightedTargetId(detail.targetId);
          if (detail.autoOpen) {
            setActiveCommentTarget({ id: detail.targetId, label: detail.targetName || detail.targetId });
          }
          const el = document.getElementById(`field-${detail.targetId}`) || document.getElementById(detail.targetId);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };

      window.addEventListener("mep-comment-notification-clicked", onGlobalNotification);
      return () => {
        window.removeEventListener("mep-comment-notification-clicked", onGlobalNotification);
      };
    }
  }, []);

  // Sync state on load
  useEffect(() => {
    const pId = project?.id || "default";
    try {
      const saved = localStorage.getItem(`fireTankDuration_${pId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        if (parsed.sizingParams) setSizingParams(parsed.sizingParams);
        if (parsed.commentsMap) setCommentsMap(parsed.commentsMap);
      }
    } catch (err) {
      console.error("Failed loading saved fire tank duration state", err);
    }
    setIsLoaded(true);
  }, [project?.id]);

  // Persist state
  const saveState = (
    params: FireTankDurationParams,
    unit: "si" | "ip",
    comments = commentsMap
  ) => {
    const pId = project?.id || "default";
    try {
      localStorage.setItem(
        `fireTankDuration_${pId}`,
        JSON.stringify({
          unitSystem: unit,
          sizingParams: params,
          commentsMap: comments,
          updatedAt: new Date().toISOString(),
        })
      );
      dirtyStore.set(true);
      if (forceSaveToCloud) forceSaveToCloud();
    } catch (e) {
      console.error("Error saving state", e);
    }
  };

  // Flatten comments list for counter badge
  const totalCommentsCount = useMemo(() => {
    return Object.values(commentsMap).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
  }, [commentsMap]);

  // Unit system change with accurate conversion
  const handleUnitSystemChange = (newUnit: "si" | "ip") => {
    if (newUnit === unitSystem) return;

    const converted: FireTankDurationParams = { ...sizingParams };
    if (newUnit === "ip") {
      // SI (L/min, L) -> IP (GPM, gal)
      if (converted.demandRate !== "") converted.demandRate = Number((converted.demandRate * 0.264172).toFixed(1));
      if (converted.tankCapacity !== "") converted.tankCapacity = Math.round(converted.tankCapacity * 0.264172);
      if (converted.refillRate !== "") converted.refillRate = Number((converted.refillRate * 0.264172).toFixed(1));
    } else {
      // IP (GPM, gal) -> SI (L/min, L)
      if (converted.demandRate !== "") converted.demandRate = Number((converted.demandRate / 0.264172).toFixed(1));
      if (converted.tankCapacity !== "") converted.tankCapacity = Math.round(converted.tankCapacity / 0.264172);
      if (converted.refillRate !== "") converted.refillRate = Number((converted.refillRate / 0.264172).toFixed(1));
    }

    setUnitSystem(newUnit);
    setSizingParams(converted);
    saveState(converted, newUnit);
  };

  // Preset duration handler
  const handlePresetChange = (preset: "30" | "60" | "90" | "120" | "custom") => {
    let dur = sizingParams.targetDurationMin;
    if (preset !== "custom") {
      dur = parseInt(preset, 10);
    }
    const updated = { ...sizingParams, hazardPreset: preset, targetDurationMin: dur };
    setSizingParams(updated);
    saveState(updated, unitSystem);
  };

  // Hydraulic Calculations
  const calc = useMemo(() => {
    return computeFireTankDurationCalculations(sizingParams, unitSystem);
  }, [sizingParams, unitSystem]);

  // Context Menu Handlers
  const handleCopyValue = (label: string, val: number | string | boolean) => {
    navigator.clipboard.writeText(String(val));
    toast.success(`Copied ${label}: ${val}`);
  };

  const handlePasteValue = async (field: keyof FireTankDurationParams, label: string) => {
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text);
      if (!isNaN(num)) {
        const updated = { ...sizingParams, [field]: num };
        setSizingParams(updated);
        saveState(updated, unitSystem);
        toast.success(`Pasted ${label}: ${num}`);
      } else {
        toast.error("Clipboard does not contain a valid number");
      }
    } catch {
      toast.error("Unable to read clipboard");
    }
  };

  const handleResetValue = (field: keyof FireTankDurationParams, label: string) => {
    const defaultVal = (unitSystem === "si" ? DEFAULT_PARAMS_SI : DEFAULT_PARAMS_IP)[field];
    const updated = { ...sizingParams, [field]: defaultVal };
    setSizingParams(updated);
    saveState(updated, unitSystem);
    toast.success(`Reset ${label} to default`);
  };

  const handleOpenComment = (id: string, label: string) => {
    setActiveCommentTarget({ id, label });
  };

  const handleSaveComment = (commentData: any) => {
    if (!activeCommentTarget) return;
    const targetId = activeCommentTarget.id;
    const existing = commentsMap[targetId] || [];
    const newComment = typeof commentData === "object" ? {
      ...commentData,
      id: commentData.id || `comment_${Date.now()}`,
      targetId,
      targetName: activeCommentTarget.label,
      createdAt: commentData.timestamp || new Date().toISOString(),
    } : {
      id: `comment_${Date.now()}`,
      text: String(commentData),
      targetId,
      targetName: activeCommentTarget.label,
      createdAt: new Date().toISOString(),
    };
    const updatedList = [...existing, newComment];
    const updated = { ...commentsMap, [targetId]: updatedList };
    setCommentsMap(updated);
    saveState(sizingParams, unitSystem, updated);
    setActiveCommentTarget(null);
    toast.success("Comment / Task assigned successfully!");
  };

  const renderCommentBadge = (id: string, label: string) => {
    const itemComments = commentsMap[id] || [];
    if (itemComments.length === 0) return null;
    return (
      <RowCommentCornerBadge
        count={itemComments.length}
        onClick={() => handleOpenComment(id, label)}
      />
    );
  };

  const renderResultRowWithContext = (
    id: string,
    label: string,
    value: string,
    options: {
      modalKey?: boolean;
      rowClassName?: string;
      labelClassName?: string;
      valueClassName?: string;
    } = {}
  ) => {
    const { modalKey, rowClassName = "", labelClassName = "", valueClassName = "" } = options;
    const itemComments = commentsMap[id] || [];
    const isHighlighted = highlightedTargetId === id || highlightedTargetId === `res-${id}`;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`res-${id}`}
            data-item-id={id}
            data-field-id={id}
            className={`flex items-center justify-between py-1 transition cursor-context-menu hover:bg-slate-100/60 dark:hover:bg-slate-800/40 px-1.5 rounded-lg ${
              isHighlighted ? "ring-2 ring-primary bg-primary/20 z-10" : ""
            } ${rowClassName}`}
          >
            <span className={`font-sans flex items-center gap-1.5 ${labelClassName || "text-muted-foreground text-xs sm:text-sm"}`}>
              <span>{label}</span>
              {modalKey && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFormulaModal(true);
                  }}
                  className="cursor-pointer text-[#0A7BC7] hover:opacity-80 p-0.5"
                  title="View Calculation Formula"
                >
                  <Info className="size-3.5" />
                </button>
              )}
              {renderCommentBadge(id, label)}
            </span>
            <span className={`font-bold font-mono ${valueClassName || "text-foreground text-xs sm:text-sm"}`}>
              {value}
            </span>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => handleCopyValue(label, value)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(`${label}: ${value}`);
                toast.success(`Copied: "${label}: ${value}"`);
              }
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Copy Full Line</span>
          </ContextMenuItem>

          {modalKey && (
            <ContextMenuItem
              onClick={() => setShowFormulaModal(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium text-[#0A7BC7]"
            >
              <Info className="size-3.5" />
              <span>View Calculation Formula</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{itemComments.length ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderInputBox = (
    id: string,
    field: keyof FireTankDurationParams,
    label: string,
    sublabel: string,
    value: number | "",
    unit: string,
    step: string = "1",
    min: number = 0,
    placeholder: string = "0",
    description?: string,
    colSpan: string = "sm:col-span-1"
  ) => {
    const itemComments = commentsMap[id] || [];
    const isHighlighted =
      highlightedTargetId === id ||
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
            className={`flex flex-col gap-1.5 ${colSpan} rounded-xl p-1 transition cursor-context-menu ${
              isHighlighted ? "ring-2 ring-[#0A7BC7] bg-[#0A7BC7]/10" : ""
            }`}
          >
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>{label}</span>
                {renderCommentBadge(id, label)}
              </span>
              {sublabel && <span className="text-[11px] font-mono font-normal text-muted-foreground">{sublabel}</span>}
            </label>
            <div className="relative flex items-center">
              <input
                id={id}
                type="number"
                disabled={isEffectiveReadOnly}
                min={min}
                step={step}
                placeholder={placeholder}
                value={value === "" ? "" : value}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                  const updated = { ...sizingParams, [field]: isNaN(val as number) ? "" : val };
                  setSizingParams(updated);
                  saveState(updated, unitSystem);
                }}
                className="w-full bg-background border border-border focus:ring-[#0A7BC7]/40 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-foreground focus:ring-2 focus:border-[#0A7BC7] outline-none transition"
              />
              {unit && (
                <span className="absolute right-3 text-xs font-semibold text-muted-foreground pointer-events-none">
                  {unit}
                </span>
              )}
            </div>
            {description && (
              <span className="text-[10.5px] text-muted-foreground">
                {description}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => handleCopyValue(label, `${value} ${unit}`.trim())}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handlePasteValue(field, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handleResetValue(field, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default</span>
          </ContextMenuItem>
          <ContextMenuSeparator className="h-px bg-border my-1" />
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{itemComments.length ? `View / Add Comments (${itemComments.length})` : "Add Comment"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // PDF Export Generation (Matching Smoke Ventilation & MEP Blue standard)
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const callAutoTable = (autoTable as any).default || autoTable;

      const headerFill: [number, number, number] = [220, 235, 252];
      const primaryFill: [number, number, number] = [240, 245, 250];

      // Page Header Bar
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 123, 199); // #0A7BC7
      doc.text("FIRE WATER TANK DURATION & REFILL REPORT", 14, 16);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text("Water Storage Autonomy & Replenishment Analysis per NFPA 22, NFPA 13 & NFPA 14", 14, 21.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 23.5, 196, 23.5);

      // Section 1: Project Metadata
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("1. Project Information & Design Basis", 14, 29);

      const metadataBody = [
        [
          { content: "Project Name:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: project?.name || "Life Safety Fire Suppression System" },
          { content: "Calculation ID:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: "CALC-FIRE-TANK-01" },
        ],
        [
          { content: "Client:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: project?.client || "Master Client" },
          { content: "Date:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: new Date().toISOString().split("T")[0] },
        ],
        [
          { content: "Fire Demand Flowrate:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: `${calc.demand} ${calc.flowUnit}` },
          { content: "Target Duration:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: `${calc.targetDur} minutes (${sizingParams.hazardPreset} min preset)` },
        ],
        [
          { content: "Available Tank Capacity:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: `${calc.tankCap.toLocaleString()} ${calc.volUnit} (${calc.tankCapM3} m³)` },
          { content: "Dedicated Refill Inflow:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: `${calc.refill} ${calc.flowUnit} (Inflow Credit: ${sizingParams.allowInflowCredit ? "YES" : "NO"})` },
        ],
      ];

      callAutoTable(doc, {
        startY: 32,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, lineColor: [100, 100, 100], lineWidth: 0.1 },
        body: metadataBody,
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 60;
      nextY += 7;

      // Section 2: Storage Sizing & Autonomy Results
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("2. Storage Sizing & Autonomy Analysis", 14, nextY);
      nextY += 3;

      const resultsBody = [
        ["A", "AVAILABLE TANK STORAGE CAPACITY", `${calc.tankCap.toLocaleString()} ${calc.volUnit} (${calc.tankCapM3} m³ / ${calc.tankCapGal.toLocaleString()} gal)`, "Physical dedicated effective fire water volume"],
        ["B", "REQUIRED EFFECTIVE FIRE STORAGE", `${calc.actualReqVol.toLocaleString()} ${calc.volUnit} (${calc.actualReqVolM3} m³ / ${calc.actualReqVolGal.toLocaleString()} gal)`, `Q_demand (${calc.demand} ${calc.flowUnit}) Ã— ${calc.targetDur} min + ${calc.marginPct}% safety reserve`],
        ["C", "ACTUAL AUTONOMY FIRE DURATION", `${calc.actualDurMin} minutes (${calc.actualDurHrs} hours)`, `Actual duration tank can supply fire flow before depletion`],
        ["D", "STORAGE SURPLUS / DEFICIT", `${calc.volumeSurplusDeficit >= 0 ? "+" : ""}${calc.volumeSurplusDeficit.toLocaleString()} ${calc.volUnit}`, calc.isAdequate ? "ADEQUATE STORAGE COMPLIANT" : "UNDERSIZED — EXPANSION REQUIRED"],
        ["E", "TANK REPLENISHMENT REFILL TIME", calc.refillTimeHrs === Infinity ? "No Dedicated Refill Supply" : `${calc.refillTimeHrs} hours (${calc.refillTimeMin} min)`, `NFPA 22 Maximum: ${sizingParams.maxRefillHours} hours limit (${calc.isRefillCompliant ? "COMPLIANT" : "SLOW REFILL"})`],
        ["F", "OVERALL NFPA 22 STATUS", calc.isAdequate ? "ADEQUATE — FULLY COMPLIANT" : "UNDERSIZED TANK — NON-COMPLIANT", `Capacity provides ${calc.compliancePct}% of required design autonomy`],
      ];

      callAutoTable(doc, {
        startY: nextY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.2, lineColor: [100, 100, 100], lineWidth: 0.1 },
        head: [["#", "HYDRAULIC PARAMETER", "CALCULATED VALUE", "ENGINEERING DESIGN BASIS"]],
        headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
        body: resultsBody,
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 130;
      nextY += 7;

      // Section 3: Engineering Signatures
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("3. Engineering Approval & Verification", 14, nextY);
      nextY += 4;

      const sigDetails = getSignatureBlockDetails();
      const signBody = [
        [
          { content: "Prepared By:\n\n_______________________\nFire Protection Engineer", styles: { cellPadding: 3 } },
          { content: "Reviewed By:\n\n_______________________\nLead MEP Consultant", styles: { cellPadding: 3 } },
          { content: `Authorized Signature:\n\n_______________________\nDate: ${formatDateStr(new Date())}`, styles: { cellPadding: 3 } },
        ],
      ];

      callAutoTable(doc, {
        startY: nextY,
        margin: { left: 14, right: 14 },
        theme: "plain",
        styles: { fontSize: 7.5, cellPadding: 2, lineColor: [150, 150, 150], lineWidth: 0.1 },
        body: signBody,
      });

      doc.save(`Fire_Tank_Duration_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Exported Fire Tank Duration PDF Report");
    } catch (err) {
      console.error("PDF export failed", err);
      toast.error("Failed generating PDF report");
    }
  };

  // Excel Export Generation
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const summaryData = [
        ["FIRE WATER TANK DURATION & REFILL CALCULATION"],
        ["Standard Reference", "NFPA 22 / NFPA 13 / NFPA 14"],
        ["Project Name", project?.name || "Fire Water System"],
        ["Date", new Date().toISOString().split("T")[0]],
        [],
        ["DESIGN INPUT PARAMETERS", "VALUE", "UNIT"],
        ["Total Fire Demand Flowrate", calc.demand, calc.flowUnit],
        ["Target Duration", calc.targetDur, "minutes"],
        ["Available Tank Capacity", calc.tankCap, calc.volUnit],
        ["Tank Capacity (Cubic Meters)", calc.tankCapM3, "m³"],
        ["Dedicated Refill Rate", calc.refill, calc.flowUnit],
        ["Safety Reserve Margin", sizingParams.reserveMarginPct, "%"],
        ["Inflow Credit Allowed", sizingParams.allowInflowCredit ? "Yes" : "No", "-"],
        ["Maximum Refill Permissible Time", sizingParams.maxRefillHours, "hours"],
        [],
        ["SIZING & AUTONOMY RESULTS", "VALUE", "UNIT", "STATUS / CRITERIA"],
        ["Required Effective Volume", calc.actualReqVol, calc.volUnit, "Gross required storage + safety margin"],
        ["Required Volume (Cubic Meters)", calc.actualReqVolM3, "m³", "Metric volume requirement"],
        ["Actual Autonomy Duration", calc.actualDurMin, "minutes", `${calc.actualDurHrs} hours continuous supply`],
        ["Net Storage Surplus / Deficit", calc.volumeSurplusDeficit, calc.volUnit, calc.isAdequate ? "ADEQUATE" : "UNDERSIZED"],
        ["Replenishment Refill Time", calc.refillTimeHrs === Infinity ? "N/A" : calc.refillTimeHrs, "hours", calc.isRefillCompliant ? "COMPLIANT (<8h)" : "SLOW REFILL"],
        ["Overall NFPA 22 Status", calc.isAdequate ? "COMPLIANT" : "NON-COMPLIANT", "-", `${calc.compliancePct}% autonomy met`],
      ];

      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, "Tank Duration Sizing");
      XLSX.writeFile(wb, `Fire_Tank_Duration_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Exported Excel Workbook (.xlsx)");
    } catch (err) {
      console.error("Excel export error", err);
      toast.error("Failed to generate Excel file");
    }
  };

  return (
    <AppShell 
      title="Fire Tank Duration" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-hidden h-full">

          {/* Breadcrumbs & Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                    Fire Tank Duration Calculation
                  </h1>
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
                <CalculationReviewBar
                  projectId={project?.id || "default"}
                  calculatorPath="/plumbing-fire-tank-duration"
                  calculatorTitle="Fire Water Tank Duration"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                ipLabel="IP"
                siLabel="SI"
                inputDescriptions="Demand flows, tank volumes, and refill rates"
                conversionExample={unitSystem === "si" ? "Convert 1,000 L to 264 gal" : "Convert 264 gal to 1,000 L"}
              />
            </div>
          </div>

          {/* White card container for Tabs & Content */}
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
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-surface-2 p-0.5 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Duration Sizer
                  </button>
                  <button
                    onClick={() => setTab("report")}
                    className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFormulaModal(true)}
                  className="px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                  title="View Calculation Formulas & Step-by-Step Breakdown"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>
              </div>

              {/* Right Side Controls: Export */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>
                <TBtn onClick={handleExportExcel}>
                  <FileSpreadsheet className="size-3.5" /> Export Excel
                </TBtn>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">

            {/* Left Column: Scrollable Inputs */}
            <div className="h-full overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4">

              {/* CORE INPUTS CARD */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-sm font-bold text-foreground">
                      Core Inputs
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFormulaModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#0A7BC7] hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/40 transition cursor-pointer"
                    title="View NFPA 22 / NFPA 13 Standards Reference"
                  >
                    <Info className="size-3.5" />
                    <span>NFPA 22 Reference</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* INPUT 1: DEMAND FLOW */}
                  {renderInputBox(
                    "demandRate",
                    "demandRate",
                    "1. Total Fire Demand Flow",
                    "NFPA 13 / 14",
                    sizingParams.demandRate,
                    calc.flowUnit,
                    calc.isIp ? "10" : "50",
                    0,
                    calc.isIp ? "500" : "1892.7",
                    "Design fire suppression demand flowrate",
                    "sm:col-span-2"
                  )}

                  {/* INPUT 2: HAZARD CLASSIFICATION PRESET */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="field-hazardPreset"
                        data-item-id="hazardPreset"
                        className={`flex flex-col gap-1.5 sm:col-span-1 rounded-xl p-1 transition cursor-context-menu ${
                          highlightedTargetId === "hazardPreset" || highlightedTargetId === "field-hazardPreset" ? "ring-2 ring-[#0A7BC7] bg-[#0A7BC7]/10" : ""
                        }`}
                      >
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span>2. Hazard Preset</span>
                            {renderCommentBadge("hazardPreset", "2. Hazard Preset")}
                          </span>
                          <span className="text-[11px] font-mono font-normal text-muted-foreground">NFPA 13</span>
                        </label>
                        <div className="relative">
                          <select
                            disabled={isEffectiveReadOnly}
                            value={sizingParams.hazardPreset}
                            onChange={(e) => handlePresetChange(e.target.value as any)}
                            className="w-full bg-background border border-border focus:ring-[#0A7BC7]/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-foreground focus:ring-2 focus:border-[#0A7BC7] outline-none transition appearance-none cursor-pointer pr-9"
                          >
                            <option value="30">30 min (Light Hazard - LH)</option>
                            <option value="60">60 min (Ordinary Hazard 1 - OH-1)</option>
                            <option value="90">90 min (Ordinary Hazard 2 - OH-2)</option>
                            <option value="120">120 min (Extra Hazard - EH)</option>
                            <option value="custom">Custom Duration</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        </div>
                        <span className="text-[10.5px] text-muted-foreground">
                          Standard hazard duration classification
                        </span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Hazard Preset", `${sizingParams.hazardPreset} min`)}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                        <span>Copy Value</span>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handlePresetChange("60")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <RotateCcw className="size-3.5 text-muted-foreground" />
                        <span>Reset to Default (60 min)</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleOpenComment("hazardPreset", "2. Hazard Preset")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{commentsMap["hazardPreset"]?.length ? `View / Add Comments (${commentsMap["hazardPreset"].length})` : "Add Comment"}</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* INPUT 3: TARGET FIRE DURATION */}
                  {renderInputBox(
                    "targetDurationMin",
                    "targetDurationMin",
                    "3. Target Duration",
                    "Operating Time",
                    sizingParams.targetDurationMin,
                    "min",
                    "5",
                    1,
                    "60",
                    "Required fire operating duration",
                    "sm:col-span-1"
                  )}

                  {/* INPUT 4: SAFETY RESERVE MARGIN */}
                  {renderInputBox(
                    "reserveMarginPct",
                    "reserveMarginPct",
                    "4. Reserve Margin",
                    "Dead Water",
                    sizingParams.reserveMarginPct,
                    "%",
                    "1",
                    0,
                    "10",
                    "Dead water and pump priming margin",
                    "sm:col-span-1"
                  )}

                  {/* INPUT 5: ACTUAL TANK WATER VOLUME */}
                  {renderInputBox(
                    "tankCapacity",
                    "tankCapacity",
                    "5. Actual Tank Volume",
                    "Storage Capacity",
                    sizingParams.tankCapacity,
                    calc.volUnit,
                    calc.isIp ? "500" : "1000",
                    0,
                    calc.isIp ? "33000" : "125000",
                    "Usable fire water volume in tank",
                    "sm:col-span-1"
                  )}

                  {/* INPUT 6: DEDICATED REFILL RATE */}
                  {renderInputBox(
                    "refillRate",
                    "refillRate",
                    "6. Dedicated Refill Rate",
                    "Replenishment",
                    sizingParams.refillRate,
                    calc.flowUnit,
                    calc.isIp ? "5" : "20",
                    0,
                    calc.isIp ? "66" : "250",
                    "Dedicated supply flow from main/source",
                    "sm:col-span-1"
                  )}

                  {/* INPUT 7: MAX REFILL TIME */}
                  {renderInputBox(
                    "maxRefillHours",
                    "maxRefillHours",
                    "7. Max Refill Time",
                    "Restoration Goal",
                    sizingParams.maxRefillHours,
                    "hours",
                    "1",
                    1,
                    "8",
                    "NFPA 22 restoration benchmark (typically 8 hrs)",
                    "sm:col-span-1"
                  )}

                  {/* INPUT 8: CONTINUOUS INFLOW CREDIT TOGGLE */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="field-allowInflowCredit"
                        data-item-id="allowInflowCredit"
                        className={`flex flex-col gap-1.5 sm:col-span-2 rounded-xl p-1 transition cursor-context-menu ${
                          highlightedTargetId === "allowInflowCredit" || highlightedTargetId === "field-allowInflowCredit" ? "ring-2 ring-[#0A7BC7] bg-[#0A7BC7]/10" : ""
                        }`}
                      >
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span>8. Continuous Inflow Credit</span>
                            {renderCommentBadge("allowInflowCredit", "8. Continuous Inflow Credit")}
                          </span>
                          <span className="text-[11px] font-mono font-normal text-muted-foreground">NFPA 22 Â§14.4</span>
                        </label>
                        <button
                          type="button"
                          disabled={isEffectiveReadOnly}
                          onClick={() => {
                            const updated = { ...sizingParams, allowInflowCredit: !sizingParams.allowInflowCredit };
                            setSizingParams(updated);
                            saveState(updated, unitSystem);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            sizingParams.allowInflowCredit
                              ? "bg-blue-50 dark:bg-blue-950/40 border-[#0A7BC7] text-[#0A7BC7]"
                              : "bg-background border-border text-muted-foreground hover:border-[#0A7BC7]/50"
                          }`}
                        >
                          <span className="font-semibold">{sizingParams.allowInflowCredit ? "Deduct Continuous Inflow from Required Storage" : "No Inflow Credit (Conservative NFPA Sizing)"}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            sizingParams.allowInflowCredit ? "bg-[#0A7BC7] text-white" : "bg-muted text-muted-foreground"
                          }`}>
                            {sizingParams.allowInflowCredit ? "Active" : "Off"}
                          </span>
                        </button>
                        <span className="text-[10.5px] text-muted-foreground">
                          Only allow when continuous replenishment source is automatic and certified reliable under emergency power.
                        </span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                      <ContextMenuItem
                        onClick={() => {
                          const updated = { ...sizingParams, allowInflowCredit: !sizingParams.allowInflowCredit };
                          setSizingParams(updated);
                          saveState(updated, unitSystem);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                      >
                        <RotateCcw className="size-3.5 text-muted-foreground" />
                        <span>Toggle Inflow Credit</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleOpenComment("allowInflowCredit", "8. Continuous Inflow Credit")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{commentsMap["allowInflowCredit"]?.length ? `View / Add Comments (${commentsMap["allowInflowCredit"].length})` : "Add Comment"}</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                </div>

                {/* AUTOMATIC ENGINEERING PARAMETERS (DERIVED VALUES) */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-border/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-[#0A7BC7]" />
                      <span>Automatic Engineering Parameters (Standards Derived)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFormulaModal(true)}
                      className="text-[10.5px] text-[#0A7BC7] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Info className="size-3" />
                      <span>Formulas &amp; Methodology</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-lg bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Safety Reserve</span>
                      <strong className="font-mono text-foreground">{calc.marginPct}%</strong>
                      <span className="text-[9.5px] text-muted-foreground block">Dead Water Margin</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Refill Benchmark</span>
                      <strong className="font-mono text-[#0A7BC7]">{sizingParams.maxRefillHours || 8} hrs</strong>
                      <span className="text-[9.5px] text-muted-foreground block">NFPA 22 Â§14.4</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Inflow Credit</span>
                      <strong className="font-mono text-foreground">{sizingParams.allowInflowCredit ? "Allowed" : "Zero Credit"}</strong>
                      <span className="text-[9.5px] text-muted-foreground block">NFPA 22 Design</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Compliance Autonomy</span>
                      <strong className={`font-mono ${calc.isAdequate ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {calc.compliancePct}%
                      </strong>
                      <span className="text-[9.5px] text-muted-foreground block">{calc.isAdequate ? "Compliant" : "Undersized"}</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Right Column: Results Card (Equal 50% Width & Standard Readable Fonts) */}
            <div className="h-full overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4 select-none">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                
                {/* Result Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-sm font-bold text-foreground font-sans">
                      Calculation Results
                    </h3>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs border ${
                    calc.isAdequate
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                      : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
                  }`}>
                    {calc.isAdequate ? <ShieldCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                    <span>{calc.isAdequate ? "Compliant" : "Undersized Storage"}</span>
                  </div>
                </div>

                {/* Primary Hero Result Metric: Actual Fire Autonomy Duration */}
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      id="res-actual-dur"
                      data-item-id="actual-dur"
                      className={`p-4 rounded-xl bg-slate-100/90 dark:bg-slate-900/90 border border-border flex flex-col gap-2 relative transition cursor-context-menu ${
                        highlightedTargetId === "actual-dur" || highlightedTargetId === "res-actual-dur" ? "ring-2 ring-primary bg-primary/20" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <span>Actual Fire Autonomy Duration</span>
                          {renderCommentBadge("actual-dur", "Actual Fire Autonomy Duration")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowFormulaModal(true)}
                          className="p-1 rounded-md text-[#0A7BC7] hover:bg-[#0A7BC7]/10 transition cursor-pointer"
                          title="Click to view calculation formula"
                        >
                          <Info className="size-4" />
                        </button>
                      </div>
                      <div className="flex items-baseline justify-between flex-wrap gap-2">
                        <div className="text-3xl sm:text-4xl font-black font-mono text-[#0A7BC7] tracking-tight">
                          {calc.actualDurMin} <span className="text-base sm:text-lg font-semibold text-muted-foreground">min</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm sm:text-base font-bold font-mono text-foreground block">
                            {calc.actualDurHrs} hours continuous
                          </span>
                          <span className="text-xs text-muted-foreground block font-mono">
                            (Target: {calc.targetDur} min Â· {calc.compliancePct}% autonomy)
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground border-t border-border/60 pt-2 mt-1 flex justify-between items-center">
                        <span>Includes {calc.marginPct}% safety reserve margin</span>
                        <span className={`font-mono font-bold ${calc.isAdequate ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {calc.isAdequate ? "NFPA 22 Compliant" : "Capacity Shortfall"}
                        </span>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                    <ContextMenuItem
                      onClick={() => handleCopyValue("Actual Fire Autonomy Duration", `${calc.actualDurMin} min`)}
                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                    >
                      <Copy className="size-3.5 text-muted-foreground" />
                      <span>Copy Value ({calc.actualDurMin} min)</span>
                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        if (typeof navigator !== "undefined" && navigator.clipboard) {
                          navigator.clipboard.writeText(`Actual Fire Autonomy Duration: ${calc.actualDurMin} min (${calc.actualDurHrs} hrs continuous supply, Target: ${calc.targetDur} min)`);
                          toast.success("Copied summary to clipboard");
                        }
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                    >
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span>Copy Full Specification</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => setShowFormulaModal(true)}
                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium text-[#0A7BC7]"
                    >
                      <Info className="size-3.5" />
                      <span>View Calculation Formula</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator className="h-px bg-border my-1" />
                    <ContextMenuItem
                      onClick={() => handleOpenComment("actual-dur", "Actual Fire Autonomy Duration")}
                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>{commentsMap["actual-dur"]?.length ? `View / Add Comments (${commentsMap["actual-dur"].length})` : "Add Comment"}</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>

                {/* Step-by-Step Clean Summary Rows */}
                <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-border/70 text-xs sm:text-sm font-mono">
                  {renderResultRowWithContext("demand-rate", "Total Fire Demand Flow:", `${calc.demand.toLocaleString()} ${calc.flowUnit}`, {
                    modalKey: true,
                    rowClassName: "border-b border-border/50",
                  })}
                  {renderResultRowWithContext("target-duration", "Target Fire Duration:", `${calc.targetDur} min`, {
                    modalKey: true,
                    rowClassName: "border-b border-border/50",
                  })}
                  {renderResultRowWithContext("gross-storage", "Gross Water Requirement:", `${calc.grossReqVol.toLocaleString()} ${calc.volUnit}`, {
                    modalKey: true,
                    rowClassName: "border-b border-border/50",
                  })}
                  {renderResultRowWithContext("reserve-margin", "Safety Reserve Margin:", `${calc.marginPct}% (${calc.reserveVol.toLocaleString()} ${calc.volUnit})`, {
                    modalKey: true,
                    rowClassName: "border-b border-border/50",
                  })}
                  {renderResultRowWithContext("net-storage", "Required Effective Storage:", `${calc.actualReqVol.toLocaleString()} ${calc.volUnit} (${calc.actualReqVolM3} m³)`, {
                    modalKey: true,
                    rowClassName: "bg-blue-50/60 dark:bg-blue-950/40 px-2 py-1.5 rounded-lg border-b border-border/50",
                    labelClassName: "text-[#0A7BC7] font-semibold text-xs sm:text-sm",
                    valueClassName: "text-[#0A7BC7] text-xs sm:text-sm font-bold",
                  })}
                  {renderResultRowWithContext("tank-capacity", "Available Tank Capacity:", `${calc.tankCap.toLocaleString()} ${calc.volUnit} (${calc.tankCapM3} m³)`, {
                    modalKey: true,
                    rowClassName: "border-b border-border/50",
                  })}
                  {renderResultRowWithContext("surplus-deficit", "Storage Surplus / Deficit:", `${calc.volumeSurplusDeficit >= 0 ? `+${calc.volumeSurplusDeficit.toLocaleString()}` : calc.volumeSurplusDeficit.toLocaleString()} ${calc.volUnit}`, {
                    modalKey: true,
                    rowClassName: "bg-sky-50/60 dark:bg-sky-950/40 px-2 py-1.5 rounded-lg border-b border-border/50",
                    labelClassName: "text-sky-700 dark:text-sky-300 font-semibold text-xs sm:text-sm",
                    valueClassName: `${calc.isAdequate ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"} text-xs sm:text-sm font-bold`,
                  })}
                  {renderResultRowWithContext("refill-rate", "Dedicated Refill Rate:", `${calc.refill.toLocaleString()} ${calc.flowUnit}`, {
                    modalKey: true,
                    rowClassName: "border-b border-border/50",
                  })}
                  {renderResultRowWithContext("refill-time", "Replenishment Refill Time:", calc.refillTimeHrs === Infinity ? "No refill supply" : `${calc.refillTimeHrs} hrs (${calc.refillTimeMin} min)`, {
                    modalKey: true,
                    valueClassName: `${calc.isRefillCompliant ? "text-foreground" : "text-amber-600 dark:text-amber-400"} text-xs sm:text-sm font-bold`,
                  })}
                </div>

                {/* Additional Derived Engineering Results */}
                <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-border/70 text-xs sm:text-sm">
                  {renderResultRowWithContext("refill-benchmark", "NFPA 22 Refill Benchmark:", `â‰¤ ${sizingParams.maxRefillHours || 8} Hours (${calc.isRefillCompliant ? "Compliant" : "Exceeded"})`, {
                    modalKey: true,
                    valueClassName: `${calc.isRefillCompliant ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"} font-bold text-xs sm:text-sm font-mono`,
                  })}
                  {renderResultRowWithContext("compliance-ratio", "Autonomy Compliance Ratio:", `${calc.compliancePct}% of Design Autonomy`, {
                    modalKey: true,
                    rowClassName: "border-t border-border/50 pt-1.5",
                    valueClassName: `${calc.isAdequate ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"} font-bold text-xs sm:text-sm font-mono`,
                  })}
                </div>

                {/* Confirmation Badge */}
                <div className="p-2.5 rounded-xl border flex items-center gap-2.5 text-xs bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold">Standard Verified:</span> Verified against NFPA 22 Section 14 &amp; NFPA 13 duration tables.
                  </div>
                </div>

                {/* Status Advisory Banner */}
                {!calc.isAdequate && (
                  <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Storage Deficit:</strong> Current tank capacity {calc.tankCap.toLocaleString()} {calc.volUnit} is short of the required {calc.actualReqVol.toLocaleString()} {calc.volUnit} by <strong>{Math.abs(calc.volumeSurplusDeficit).toLocaleString()} {calc.volUnit}</strong> ({calc.isIp ? `${(Math.abs(calc.volumeSurplusDeficit)*0.00378541).toFixed(1)} m³` : `${(Math.abs(calc.volumeSurplusDeficit)/1000).toFixed(1)} m³`}). Increase tank volume or connect certified continuous replenishment.
                    </span>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      )}

              {/* Report Tab View matching Ventilation / Condensate Drain standard */}
              {tab === "report" && (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">

                    {/* 1. Title */}
                    <div className="pb-1">
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground uppercase tracking-wide">
                        Fire Water Tank Duration Sizing Calculation
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        NFPA 22 Dedicated Storage Autonomy & Continuous Refill Replenishment Analysis
                      </p>
                    </div>

                    {/* 2. Project Metadata Header Box (Canonical 2-column x 3-row format) */}
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b border-border divide-x divide-border">
                            <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                            <td className="p-2.5 font-mono text-foreground font-medium">
                              {(project as any)?.calcNo || `TRV-CAL-FTD-${(project?.id || "0000").slice(-4).toUpperCase()}`}
                            </td>
                            <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                            <td className="p-2.5 font-mono font-medium">
                              {formatDateStr(new Date().toISOString())}
                            </td>
                          </tr>
                          <tr className="border-b border-border divide-x divide-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                            <td className="p-2.5 font-mono">
                              {project?.code || (project?.id ? project.id.slice(0, 8) : "MEP-FTD-2026")}
                            </td>
                            <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                            <td className="p-2.5">{project?.client || "-"}</td>
                          </tr>
                          <tr className="divide-x divide-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                            <td className="p-2.5">{project?.name || "MEP Fire Protection Project"}</td>
                            <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                            <td className="p-2.5">{(project as any)?.endUser || (project as any)?.location || "-"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 3. Table 1: Core System Parameters */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                        1. System Design Parameters
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                              <th className="p-2.5 w-12 text-center border-r border-border">No.</th>
                              <th className="p-2.5 text-left border-r border-border">Design Parameter</th>
                              <th className="p-2.5 text-center border-r border-border w-36">Value</th>
                              <th className="p-2.5 text-center border-r border-border w-24">Unit</th>
                              <th className="p-2.5 text-left">Code / Standard Basis</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">1</td>
                              <td className="p-2.5 font-medium border-r border-border">Total System Fire Demand Flow (Q)</td>
                              <td className="p-2.5 text-center font-mono font-bold border-r border-border">{calc.demand.toLocaleString()}</td>
                              <td className="p-2.5 text-center text-muted-foreground border-r border-border">{calc.flowUnit}</td>
                              <td className="p-2.5 text-muted-foreground">NFPA 13 / 14 combined sprinkler & hose demand</td>
                            </tr>
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">2</td>
                              <td className="p-2.5 font-medium border-r border-border">Required Hazard Duration Target</td>
                              <td className="p-2.5 text-center font-mono font-bold border-r border-border">{calc.targetDur}</td>
                              <td className="p-2.5 text-center text-muted-foreground border-r border-border">min</td>
                              <td className="p-2.5 text-muted-foreground">NFPA 13 Table 19.3.3.1.2 hazard duration criteria</td>
                            </tr>
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">3</td>
                              <td className="p-2.5 font-medium border-r border-border">Actual Installed Tank Gross Capacity</td>
                              <td className="p-2.5 text-center font-mono font-bold border-r border-border">{calc.tankCap.toLocaleString()}</td>
                              <td className="p-2.5 text-center text-muted-foreground border-r border-border">{calc.volUnit}</td>
                              <td className="p-2.5 text-muted-foreground">Equivalent: {calc.isIp ? `${calc.tankCapM3} m³` : `${calc.tankCapGal.toLocaleString()} gal`}</td>
                            </tr>
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">4</td>
                              <td className="p-2.5 font-medium border-r border-border">Municipal Continuous Refill Supply</td>
                              <td className="p-2.5 text-center font-mono font-bold border-r border-border">{calc.refill.toLocaleString()}</td>
                              <td className="p-2.5 text-center text-muted-foreground border-r border-border">{calc.flowUnit}</td>
                              <td className="p-2.5 text-muted-foreground">{sizingParams.allowInflowCredit ? "Active certified inflow credit applied per NFPA 22" : "Inflow credit not deducted (stand-alone storage)"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">5</td>
                              <td className="p-2.5 font-medium border-r border-border">Reserve Safety Contingency Margin</td>
                              <td className="p-2.5 text-center font-mono font-bold border-r border-border">{calc.marginPct}%</td>
                              <td className="p-2.5 text-center text-muted-foreground border-r border-border">%</td>
                              <td className="p-2.5 text-muted-foreground">Bottom vortex & evaporation unusable volume allowance</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 4. Table 2: Duration & Storage Performance Outputs */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                        2. Autonomy Duration & Sizing Performance Results
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                              <th className="p-2.5 w-12 text-center border-r border-border">No.</th>
                              <th className="p-2.5 text-left border-r border-border">Sizing Parameter / Output</th>
                              <th className="p-2.5 text-center border-r border-border w-36">Calculated Value</th>
                              <th className="p-2.5 text-center border-r border-border w-24">Unit</th>
                              <th className="p-2.5 text-left">Compliance & Design Assessment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {/* Primary Result 1: Required Storage Volume */}
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">1</td>
                              <td className="p-2.5 font-bold text-foreground border-r border-border">Required Fire Water Storage Volume</td>
                              <td className="p-2.5 text-center font-mono text-primary font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                                {calc.actualReqVol.toLocaleString()}
                              </td>
                              <td className="p-2.5 text-center font-mono border-r border-border">{calc.volUnit}</td>
                              <td className="p-2.5 text-muted-foreground">Net capacity required ({calc.isIp ? `${calc.actualReqVolM3} m³` : `${calc.actualReqVolGal.toLocaleString()} gal`})</td>
                            </tr>
                            {/* Primary Result 2: Actual Duration Sustained */}
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">2</td>
                              <td className="p-2.5 font-bold text-foreground border-r border-border">Actual Sustained Fire Flow Duration</td>
                              <td className="p-2.5 text-center font-mono text-primary font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                                {calc.actualDurMin} min ({calc.actualDurHrs} hrs)
                              </td>
                              <td className="p-2.5 text-center font-mono border-r border-border">min</td>
                              <td className="p-2.5 text-muted-foreground">Target minimum is {calc.targetDur} min</td>
                            </tr>
                            {/* Primary Result 3: Storage Surplus / Deficit */}
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">3</td>
                              <td className="p-2.5 font-bold text-foreground border-r border-border">Storage Volume Margin / Delta</td>
                              <td className={`p-2.5 text-center font-mono font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47] ${calc.isAdequate ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                {calc.volumeSurplusDeficit >= 0 ? `+${calc.volumeSurplusDeficit.toLocaleString()}` : calc.volumeSurplusDeficit.toLocaleString()} {calc.volUnit}
                              </td>
                              <td className="p-2.5 text-center font-mono border-r border-border">{calc.volUnit}</td>
                              <td className="p-2.5 text-muted-foreground">{calc.isAdequate ? "Adequate storage capacity satisfies full NFPA 22 target duration" : "Deficit: tank capacity short of required volume"}</td>
                            </tr>
                            {/* Primary Result 4: Refill Time */}
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">4</td>
                              <td className="p-2.5 font-bold text-foreground border-r border-border">Full Tank Refill Replenishment Time</td>
                              <td className="p-2.5 text-center font-mono text-primary font-bold border-r border-border bg-[#DAE9F8] dark:bg-[#0c2e47]">
                                {calc.refillTimeHrs === Infinity ? "N/A" : `${calc.refillTimeHrs} hrs`}
                              </td>
                              <td className="p-2.5 text-center font-mono border-r border-border">hours</td>
                              <td className="p-2.5 text-muted-foreground">NFPA 22 max replenishment window: {sizingParams.maxRefillHours || 8} hrs ({calc.isRefillCompliant ? "Compliant" : "Exceeds Limit"})</td>
                            </tr>
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 text-center font-mono text-muted-foreground border-r border-border">5</td>
                              <td className="p-2.5 font-bold text-foreground border-r border-border">Overall NFPA 22 Duration Compliance</td>
                              <td className={`p-2.5 text-center font-bold border-r border-border ${calc.isAdequate ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" : "text-rose-600 dark:text-rose-400 bg-rose-500/10"}`}>
                                {calc.isAdequate ? "COMPLIANT" : "NON-COMPLIANT"} ({calc.compliancePct}%)
                              </td>
                              <td className="p-2.5 text-center font-mono border-r border-border">%</td>
                              <td className="p-2.5 text-muted-foreground">{calc.isAdequate ? "Tank volume meets or exceeds minimum code requirement" : "Tank volume insufficient to maintain required fire duration"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 5. 3-Tier Signature Sign-Off Block (Peach #FFE6CC Header) */}
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
                                {sigDetails?.originatedName || user?.name || "MEP Engineer"}
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
                                {sigDetails?.originatedDate || formatDateStr(new Date().toISOString())}
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
              )}
    </div>
  </div>

          {/* Formulas & NFPA 22 Engineering Modal */}
          {showFormulaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto custom-scrollbar font-sans">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Activity className="size-5 text-[#0A7BC7]" />
                    <h2 className="text-lg font-bold text-foreground">
                      Fire Tank Duration Calculations & NFPA 22 Derivations
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowFormulaModal(false)}
                    className="p-1 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
                  {/* Detailed Step-by-Step Breakdown */}
                  <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col gap-3">
                    <div className="flex items-center gap-2 font-bold text-foreground text-sm border-b border-border/60 pb-2">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <span>Detailed Step-by-Step Numerical Breakdown</span>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2.5">
                      <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0A7BC7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</div>
                      <div>
                        <div className="font-bold text-foreground">Step 1: Gross Fire Water Volume Requirement</div>
                        <div className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] my-0.5">
                          V_gross = Q_demand Ã— T_required
                        </div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">
                          {calc.demand} {calc.flowUnit} Ã— {calc.targetDur} min = <strong>{calc.grossReqVol.toLocaleString()} {calc.volUnit}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2.5">
                      <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0A7BC7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</div>
                      <div>
                        <div className="font-bold text-foreground">Step 2: Safety & Dead Water Reserve Allowance</div>
                        <div className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] my-0.5">
                          V_req = V_gross Ã— (1 + Safety Margin %)
                        </div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">
                          {calc.grossReqVol.toLocaleString()} {calc.volUnit} Ã— (1 + {calc.marginPct}%) = <strong>{calc.actualReqVol.toLocaleString()} {calc.volUnit} ({calc.actualReqVolM3} m³)</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2.5">
                      <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0A7BC7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</div>
                      <div>
                        <div className="font-bold text-foreground">Step 3: Actual Tank Autonomy Duration</div>
                        <div className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] my-0.5">
                          T_actual = V_tank / Q_demand
                        </div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">
                          {calc.tankCap.toLocaleString()} {calc.volUnit} / {calc.demand} {calc.flowUnit} = <strong className="text-[#0A7BC7]">{calc.actualDurMin} minutes ({calc.actualDurHrs} hours)</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0A7BC7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</div>
                      <div>
                        <div className="font-bold text-foreground">Step 4: Replenishment Refill Time (NFPA 22)</div>
                        <div className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] my-0.5">
                          T_refill = V_tank / Q_refill
                        </div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">
                          {calc.refill > 0 ? `${calc.tankCap.toLocaleString()} ${calc.volUnit} / ${calc.refill} ${calc.flowUnit} = ${calc.refillTimeHrs} hours (${calc.refillTimeMin} min)` : "No dedicated refill flow configured"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Governing Standards & Equations */}
                  <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col gap-3">
                    <div className="flex items-center gap-2 font-bold text-foreground text-sm border-b border-border/60 pb-2">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <span>Governing Standards & Criteria</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-foreground text-xs">1. NFPA 13 Hazard Duration Mandates</h4>
                        <p className="text-[11.5px]">
                          â€¢ <strong>Light Hazard (LH):</strong> 30 minutes minimum duration.<br />
                          â€¢ <strong>Ordinary Hazard Group 1 (OH-1):</strong> 60 to 90 minutes minimum.<br />
                          â€¢ <strong>Ordinary Hazard Group 2 (OH-2):</strong> 90 minutes minimum.<br />
                          â€¢ <strong>Extra Hazard (EH-1 / EH-2):</strong> 120 minutes minimum.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground text-xs">2. NFPA 22 Refill Replenishment Benchmark</h4>
                        <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold my-0.5">
                          T_refill = V_tank / Q_refill â‰¤ 8.0 hours
                        </p>
                        <p className="text-[11.5px]">
                          NFPA 22 Section 14 mandates that automatic water supply sources must be capable of filling the fire storage tank within 8 hours (or 24 hours if approved by the AHJ).
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground text-xs">3. Continuous Inflow Credit Rules (NFPA 22)</h4>
                        <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold my-0.5">
                          V_required = (Q_demand - Q_inflow) Ã— T_duration Ã— (1 + Safety Margin)
                        </p>
                        <p className="text-[11.5px]">
                          Inflow credit is only permitted when the municipal or well supply is automatic, uninterruptible, and certified reliable under emergency seismic and electrical failure conditions.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <button
                    onClick={() => setShowFormulaModal(false)}
                    className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs cursor-pointer hover:bg-primary/90 transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Comment Assignment Modal */}
        {activeCommentTarget && (
          <AssignCommentModal
            isOpen={Boolean(activeCommentTarget)}
            targetId={activeCommentTarget.id}
            targetName={activeCommentTarget.label}
            calculatorPath="/plumbing-fire-tank-duration"
            calculatorTitle="Fire Water Tank Duration"
            existingComments={commentsMap[activeCommentTarget.id] || []}
            onClose={() => setActiveCommentTarget(null)}
            onSave={handleSaveComment}
            onCommentAdded={handleSaveComment}
          />
        )}

        </div>

        {/* Intelligence Drawer (Collapsible Right Side Panel) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <FireTankDurationIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calc={calc}
              sizingParams={sizingParams}
              onSelectDuration={(dur) => {
                const updated = {
                  ...sizingParams,
                  targetDurationMin: dur,
                  hazardPreset: (dur === 30 || dur === 60 || dur === 90 || dur === 120 ? String(dur) : "custom"),
                };
                setSizingParams(updated);
                saveState(updated, unitSystem);
                toast.success(`Applied ${dur} minutes NFPA 22 target duration`);
              }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Drawer Component for Fire Tank Duration Calculator
// ─────────────────────────────────────────────────────────────────────────────
function FireTankDurationIntelligenceDrawer({
  onClose,
  calc,
  sizingParams,
  onSelectDuration,
}: {
  onClose: () => void;
  calc: any;
  sizingParams: FireTankDurationParams;
  onSelectDuration: (dur: number) => void;
}) {
  const isCompliant = calc.isAdequate;

  const durationPresets = [
    { dur: 30, label: "Light Hazard (30 min)", desc: "Offices, schools, hospitals (NFPA 13)" },
    { dur: 60, label: "Ordinary Hazard 1 & 2 (60 min)", desc: "Commercial, retail, manufacturing" },
    { dur: 90, label: "Extra Hazard 1 (90 min)", desc: "Aircraft hangars, flammable storage" },
    { dur: 120, label: "High Piled Storage (120 min)", desc: "Warehouses, logistics, hazardous fuels" },
  ];

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in font-sans">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          title="Close Intelligence"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* NFPA 22 Duration Compliance Status */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2">
            {isCompliant ? (
              <CheckCircle2 className="size-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="size-4 text-amber-500" />
            )}
            <span className="text-xs font-bold text-foreground">NFPA 22 Autonomy Compliance</span>
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            Sustains <span className="font-mono font-bold text-foreground">{calc.actualDurMin} min</span> continuous supply (Target: {calc.targetDur} min).
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isCompliant ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, Math.round(calc.compliancePct))}%` }}
              />
            </div>
            <span
              className={`font-mono text-[11px] font-bold ${
                isCompliant ? "text-emerald-500" : "text-amber-500"
              }`}
            >
              {calc.compliancePct}%
            </span>
          </div>
        </div>

        {/* Volume & Duration KPIs */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Fire Tank Storage Summary</span>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Actual Autonomy:</span>
              <span className="font-mono font-bold text-primary text-xs">
                {calc.actualDurMin} min ({calc.actualDurHrs} hrs)
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Required Tank Storage:</span>
              <span className="font-mono font-bold text-foreground">
                {calc.actualReqVol.toLocaleString()} {calc.volUnit} ({calc.actualReqVolM3} m³)
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Current Available Volume:</span>
              <span className="font-mono font-bold text-foreground">
                {calc.tankCap.toLocaleString()} {calc.volUnit} ({calc.tankCapM3} m³)
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Storage Margin:</span>
              <span
                className={`font-mono font-bold ${
                  calc.volumeSurplusDeficit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {calc.volumeSurplusDeficit >= 0 ? "+" : ""}
                {calc.volumeSurplusDeficit.toLocaleString()} {calc.volUnit}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 font-bold">
              <span className="text-foreground">Replenishment Period:</span>
              <span className="font-mono text-primary text-xs font-extrabold">
                {calc.refillTimeHrs === Infinity ? "No refill" : `${calc.refillTimeHrs} hrs`}
              </span>
            </div>
          </div>
        </div>

        {/* Hazard Class Presets */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">NFPA 13 Hazard Presets</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-xs">
            {durationPresets.map((p) => {
              const isSelected = Number(sizingParams.targetDurationMin) === p.dur;
              return (
                <button
                  key={p.dur}
                  type="button"
                  onClick={() => onSelectDuration(p.dur)}
                  className={`flex flex-col p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border/60 hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11.5px] font-semibold">{p.label}</span>
                    <span className="font-mono text-xs font-bold shrink-0">{p.dur}m</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Standards Guidance Reference */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 shadow-xs text-xs">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-blue-500" />
            <span className="font-bold text-foreground">NFPA 22 Storage & Refill Rules</span>
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            NFPA 22 mandates tank refill within 8 hours (or 24 hours under AHJ approval). Automatic replenishment credit may only be factored if connected to an approved, dual-source municipal supply.
          </p>
        </div>
      </div>
    </div>
  );
}
