import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { getMergedItemComments } from "@/utils/commentHelpers";
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
  FileText, Printer, HelpCircle, X, Check, Sparkles,
  Copy, Clipboard, RotateCcw, MessageSquare, Download,
  Activity, Snowflake, ShieldCheck, Gauge, Zap, FileSpreadsheet, Waves, Wind
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
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import {
  type LineType,
  type RefrigerantType,
  type RefrigerantParams,
  type PipeSizingTier,
  PIPE_SIZING_TABLES,
  DEFAULT_PARAMS,
  computeRefrigerantPipeSizing
} from "@/lib/calc-refrigerant-pipe-sizing";


export const Route = createFileRoute("/refrigerant-pipe-sizing")({
  head: () => ({
    meta: [
      { title: "Refrigerant Pipe Sizing — MEP Calc" },
      { name: "description", content: "Determine copper refrigerant line outer diameters (OD), design gas/liquid velocities, and saturation pressure drops for suction, liquid, and discharge lines per ASHRAE Refrigeration Handbook." },
    ],
  }),
  component: RefrigerantPipeSizingPage,
});

function RefrigerantPipeSizingPage() {
  const [intelOpen, setIntelOpen] = useState(false);
  const { project, activeProjectId, isReadOnly } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/refrigerant-pipe-sizing", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/refrigerant-pipe-sizing", activeProjectId || project?.id);
  const { userData, profile, user } = useAuth();
  const currentUserName = userData?.name || profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";
  const isApprovedLocked = useCalculationLock("/refrigerant-pipe-sizing", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  // State definitions
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [tab, setTab] = useState<"calculator" | "report">("calculator");
  const [sizingParams, setSizingParams] = useState<RefrigerantParams>(DEFAULT_PARAMS);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync review state
  

  // Notification target scroll / highlight listener
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();

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

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("commentTargetId");
      const targetName = params.get("commentTargetName");
      if (targetId || targetName) {
        setTimeout(() => {
          handleScrollTarget(targetId || undefined, targetName || undefined);
        }, 300);
      }

      const onGlobalNotification = (e: any) => {
        if (e.detail?.fieldName || e.detail?.targetItemId) {
          handleScrollTarget(e.detail.targetItemId, e.detail.fieldName);
        }
      };
      window.addEventListener("mep-comment-notification-clicked", onGlobalNotification);
      return () => {
        window.removeEventListener("mep-comment-notification-clicked", onGlobalNotification);
      };
    }
  }, []);

  // Load project state
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_refrigerant_pipe_sizing_${pId}`;

    if (loadedProjectId !== pId) {
      let loadedData: any = null;

      if (project?.workspace_data) {
        let wdata = project.workspace_data;
        if (typeof wdata === "string") {
          try { wdata = JSON.parse(wdata); } catch (e) {}
        }
        if (wdata?.refrigerant_pipe_data) {
          loadedData = wdata.refrigerant_pipe_data;
        }
      }

      if (!loadedData && typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) loadedData = JSON.parse(saved);
        } catch (e) {}
      }

      if (loadedData) {
        if (loadedData.sizingParams) setSizingParams(loadedData.sizingParams);
        if (loadedData.unitSystem) setUnitSystem(loadedData.unitSystem);
        if (loadedData.commentsMap) setCommentsMap(loadedData.commentsMap);
      }

      setLoadedProjectId(pId);
    }
  }, [project?.id, loadedProjectId]);

  // Flatten comments list for counter badge
  const totalCommentsCount = useMemo(() => {
    return Object.values(commentsMap).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
  }, [commentsMap]);

  // Save helper
  const saveState = (
    newParams: RefrigerantParams,
    newUnits: "si" | "ip",
    newComments = commentsMap
  ) => {
    const pId = project?.id || "default";
    const dataToSave = {
      sizingParams: newParams,
      unitSystem: newUnits,
      commentsMap: newComments,
      updatedAt: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(`mep_refrigerant_pipe_sizing_${pId}`, JSON.stringify(dataToSave));
    }

    dirtyStore.set(true);
  };

  // Unit conversion
  const handleUnitSystemChange = (target: "si" | "ip", shouldConvert: boolean = true) => {
    if (target === unitSystem) return;
    const cap = sizingParams.coolingCapacity;
    const len = sizingParams.pipeLength;
    const evap = sizingParams.evaporatingTemp;
    const cond = sizingParams.condensingTemp;

    let convertedCap: number | "" = cap;
    let convertedLen: number | "" = len;
    let convertedEvap: number | "" = evap;
    let convertedCond: number | "" = cond;

    if (shouldConvert) {
      if (target === "si") {
        // IP -> SI
        convertedCap = cap !== "" ? Number((Number(cap) * 3.51685).toFixed(2)) : "";
        convertedLen = len !== "" ? Number((Number(len) * 0.3048).toFixed(1)) : "";
        convertedEvap = evap !== "" ? Number(((Number(evap) - 32) * (5 / 9)).toFixed(1)) : "";
        convertedCond = cond !== "" ? Number(((Number(cond) - 32) * (5 / 9)).toFixed(1)) : "";
      } else {
        // SI -> IP
        convertedCap = cap !== "" ? Number((Number(cap) / 3.51685).toFixed(2)) : "";
        convertedLen = len !== "" ? Number((Number(len) / 0.3048).toFixed(1)) : "";
        convertedEvap = evap !== "" ? Number((Number(evap) * (9 / 5) + 32).toFixed(1)) : "";
        convertedCond = cond !== "" ? Number((Number(cond) * (9 / 5) + 32).toFixed(1)) : "";
      }
    }

    const updatedParams: RefrigerantParams = {
      ...sizingParams,
      coolingCapacity: convertedCap,
      pipeLength: convertedLen,
      evaporatingTemp: convertedEvap,
      condensingTemp: convertedCond,
    };

    setUnitSystem(target);
    setSizingParams(updatedParams);
    saveState(updatedParams, target);
    toast.success(`Switched unit system to ${target.toUpperCase()}`);
  };

  // Calculation Engine
  const calc = useMemo(() => {
    return computeRefrigerantPipeSizing(sizingParams, unitSystem);
  }, [sizingParams, unitSystem]);

  // Context menu actions
  const handleCopyValue = (label: string, value: any) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(String(value));
      toast.success(`Copied ${label}: ${value}`);
    }
  };

  const handlePasteValue = async (field: keyof RefrigerantParams, label: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Editing is disabled.");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText();
        const num = parseFloat(text);
        if (!isNaN(num)) {
          const updated = { ...sizingParams, [field]: num };
          setSizingParams(updated);
          saveState(updated, unitSystem);
          toast.success(`Pasted into ${label}: ${num}`);
        }
      } catch (e) {
        toast.error("Failed to read clipboard");
      }
    }
  };

  const handleResetValue = (field: keyof RefrigerantParams, label: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Editing is disabled.");
      return;
    }
    const def = DEFAULT_PARAMS[field];
    const updated = { ...sizingParams, [field]: def };
    setSizingParams(updated);
    saveState(updated, unitSystem);
    toast.info(`Reset ${label} to default (${def})`);
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
    const updated = { ...commentsMap, [targetId]: [...existing, newComment] };
    setCommentsMap(updated);
    saveState(sizingParams, unitSystem, updated);
    setActiveCommentTarget(null);
    toast.success(`Task assigned successfully!`);
  };

  // Reusable Parameter Input Tile matching CHW Pump Head standard
  const renderInputBox = (
    id: string,
    field: keyof RefrigerantParams,
    label: string,
    value: number | "",
    unit: string,
    step: string = "1",
    min: number = 0,
    placeholder: string = "0"
  ) => {
    const itemComments = getMergedItemComments(id, label, commentsMap[id], "/refrigerant-pipe-sizing", project?.id);
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
            className={`flex flex-col gap-1.5 group cursor-context-menu p-1.5 rounded-xl transition-all relative ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <RowCommentCornerBadge
              count={itemComments.length}
              onClick={() => handleOpenComment(id, label)}
            />
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-300 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span>{displayLabel}</span>
              </span>
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">Right-click for options</span>
            </label>
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
              className="w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono focus:outline-none focus:border-primary text-xs font-bold transition hover:border-[#0A7BC7]/50 disabled:opacity-60 disabled:cursor-not-allowed"
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
            <span>Copy Parameter</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handlePasteValue(field, label)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium disabled:opacity-50"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="h-px bg-border my-1" />

          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handleResetValue(field, label)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium disabled:opacity-50"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // PDF Export Generation matching Preliminary layout standard
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const callAutoTable = (autoTable as any).default || autoTable;

      const primaryFill: [number, number, number] = [229, 231, 235]; // #E5E7EB
      const blueFill: [number, number, number] = [218, 233, 248];    // #DAE9F8
      const sigFill: [number, number, number] = [255, 230, 204];     // #FFE6CC

      const calcNo = (project as any)?.calcNo || "TRV-CALC-REF-01";
      const today = formatDateStr(new Date().toISOString());
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || "Refrigerant Pipe Sizing";
      const clientName = project?.client || "-";
      const endUser = (project as any)?.endUser || (project as any)?.location || "-";

      // 1. Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Refrigerant Pipe Sizing Calculation", 14, 14);

      // 2. Metadata Block (182mm width)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.setDrawColor(100, 100, 100);
      doc.rect(14, 18, 182, 18);

      doc.line(105, 18, 105, 36);
      doc.line(14, 24, 196, 24);
      doc.line(14, 30, 196, 30);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 22);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 22);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 28);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 40, 28);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 107, 28);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 120, 28);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 16, 34);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 42, 34);

      doc.setFont("helvetica", "bold");
      doc.text("End User:", 107, 34);
      doc.setFont("helvetica", "normal");
      doc.text(endUser, 125, 34);

      // Table 1: Design Parameters
      const inputRows = [
        [
          { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
          { content: "Design Parameter", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
          { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
          { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
          { content: "Engineering Basis / Remarks", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
        ],
        ["1", "Refrigerant Type", sizingParams.refrigerant, "-", "ASHRAE Standard 34 refrigerant fluid"],
        ["2", "Refrigerant Line Service", `${sizingParams.lineType.toUpperCase()} LINE`, "-", `${sizingParams.lineType === "suction" ? "Low-pressure vapor return line" : sizingParams.lineType === "liquid" ? "High-pressure liquid line" : "High-pressure hot gas discharge line"}`],
        ["3", "Nominal Cooling Capacity", `${sizingParams.coolingCapacity}`, calc.isIp ? "TR" : "kW", "Rated evaporator thermal load capacity"],
        ["4", "Design Safety Margin Factor", `${sizingParams.designSafetyMargin || 0}%`, "%", "Engineering capacity headroom"],
        ["5", "Design Thermal Capacity", calc.isIp ? `${calc.designCapTr} TR` : `${calc.designCapKw} kW`, calc.isIp ? "TR" : "kW", `Equiv: ${calc.designCapTr} TR / ${calc.designCapKw} kW`],
        ["6", "Physical Straight Pipe Run", `${sizingParams.pipeLength}`, calc.isIp ? "ft" : "m", "Linear routing physical distance"],
        ["7", "Fittings Equivalent Allowance", `${sizingParams.fittingsAllowancePct || 0}%`, "%", "Dynamic loss allowance for bends/valves"],
        ["8", "Total Equivalent Route Length", `${calc.equivLenM} m (${calc.equivLenFt} ft)`, calc.isIp ? "ft" : "m", "Straight run + fittings equivalent allowance"],
        ["9", "Operating Evaporating Temp", `${sizingParams.evaporatingTemp}`, calc.isIp ? "°F" : "°C", "Evaporator saturation temperature"],
        ["10", "Operating Condensing Temp", `${sizingParams.condensingTemp}`, calc.isIp ? "°F" : "°C", "Condenser saturation temperature"]
      ];

      callAutoTable(doc, {
        startY: 40,
        margin: { left: 14, right: 14 },
        body: inputRows,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, textColor: [20, 20, 20], lineColor: [200, 200, 200], lineWidth: 0.2 },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 65, halign: "left" },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 62, halign: "left" }
        }
      });

      let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 105;

      // Table 2: Recommended Pipe Sizing & Hydraulic Outputs
      const resultRows = [
        [
          { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
          { content: "Calculated Engineering Metric", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
          { content: "Output Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
          { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
          { content: "Compliance & Safety Factor", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
        ],
        [
          { content: "1", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "Recommended Copper Pipe OD", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
          { content: `${calc.selectedTier.odMm} mm (${calc.selectedTier.odInches})`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "OD", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "Standard ACR Copper Refrigeration Tubing", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
        ],
        ["2", "Internal Pipe Diameter (ID)", `${calc.selectedTier.idMm} mm (${calc.selectedTier.idInches} in)`, "mm (in)", "Net internal flow cross-section"],
        [
          { content: "3", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "Refrigerant Flow Velocity", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
          { content: `${calc.velocityMps} m/s (${calc.velocityFpm} fpm)`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "m/s (fpm)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: `Allowable: ${calc.minVelMps}-${calc.maxVelMps} m/s (${calc.minVelFpm}-${calc.maxVelFpm} fpm)`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
        ],
        [
          { content: "4", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "Velocity & Oil-Return Status", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
          { content: calc.velocityStatus, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "-", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "ASHRAE self-scouring oil-entrainment criteria", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
        ],
        ["5", "Refrigerant Mass Flow Rate", `${calc.massFlowKgSec} kg/s (${calc.massFlowLbMin} lb/min)`, "kg/s", "Based on thermodynamic enthalpy difference"],
        [
          { content: "6", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "Line Friction Pressure Drop (ΔP)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
          { content: `${calc.deltaPBar} bar (${calc.deltaPPsi} psi / ${calc.deltaPKPa} kPa)`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "bar (psi)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "Darcy-Weisbach loss across equivalent length", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
        ],
        [
          { content: "7", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "Equivalent Saturation Temp Drop", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
          { content: `${calc.satTempDropC} °C (${calc.satTempDropF} °F)`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "°C (°F)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
          { content: "Target: < 1.0 °C (~2.0 °F) saturation temperature loss", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
        ]
      ];

      callAutoTable(doc, {
        startY: currentY,
        margin: { left: 14, right: 14 },
        body: resultRows,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, textColor: [20, 20, 20], lineColor: [200, 200, 200], lineWidth: 0.2 },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 65, halign: "left" },
          2: { cellWidth: 42, halign: "center" },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 47, halign: "left" }
        }
      });

      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 190;

      if (currentY + 28 > 280) {
        doc.addPage();
        currentY = 20;
      }

      // 4. Standard 3-tier Signature Block (#FFE6CC header)
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || "default", "/refrigerant-pipe-sizing", currentUserName);

      callAutoTable(doc, {
        startY: currentY,
        margin: { left: 14, right: 14 },
        head: [
          [
            { content: "", styles: { fillColor: sigFill, cellWidth: 32 } },
            { content: "Originator", styles: { halign: "center", fontStyle: "bold", fillColor: sigFill, textColor: [0, 0, 0] } },
            { content: "Reviewer", styles: { halign: "center", fontStyle: "bold", fillColor: sigFill, textColor: [0, 0, 0] } },
            { content: "Approver", styles: { halign: "center", fontStyle: "bold", fillColor: sigFill, textColor: [0, 0, 0] } }
          ]
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "center", fillColor: [248, 250, 252] } },
            { content: originatedName || currentUserName, styles: { halign: "center" } },
            { content: reviewerName || "", styles: { halign: "center" } },
            { content: approverName || "", styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "center", fillColor: [248, 250, 252] } },
            { content: originatedDate || today, styles: { halign: "center" } },
            { content: reviewerDate || "", styles: { halign: "center" } },
            { content: approverDate || "", styles: { halign: "center" } }
          ]
        ],
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.2, lineColor: [200, 200, 200], lineWidth: 0.2 },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 }
        }
      });

      const safeProjCode = projectNo.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `Refrigerant_Pipe_Sizing_Calculation_${safeProjCode}.pdf`;
      const pdfBlob = doc.output("blob");
      downloadFile(pdfBlob, filename, "application/pdf");
      toast.success(`Exported calculation: ${filename}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF calculation.");
    }
  };

  // Excel Export Generation
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["REFRIGERANT PIPE SIZING CALCULATION REPORT"],
        ["Standard: ASHRAE Refrigeration Handbook / ACR Copper Tube Standards"],
        [],
        ["1. DESIGN PARAMETERS"],
        ["Project Name", project?.name || "HVAC DX System"],
        ["Client", project?.client || "Master Client"],
        ["Engineer", currentUserName],
        ["Date", new Date().toLocaleDateString('en-GB')],
        ["Refrigerant Type", sizingParams.refrigerant],
        ["Line Type", sizingParams.lineType.toUpperCase()],
        ["Nominal Capacity", `${sizingParams.coolingCapacity} ${calc.isIp ? "TR" : "kW"}`],
        ["Design Capacity (with margin)", `${calc.designCapTr} TR (${calc.designCapKw} kW)`],
        ["Equivalent Length", `${calc.equivLenM} m (${calc.equivLenFt} ft)`],
        [],
        ["2. SIZING & HYDRAULIC RESULTS"],
        ["Recommended Copper Outer Diameter (OD)", `${calc.selectedTier.odMm} mm (${calc.selectedTier.odInches})`],
        ["Internal Diameter (ID)", `${calc.selectedTier.idMm} mm (${calc.selectedTier.idInches} in)`],
        ["Flow Velocity", `${calc.velocityMps} m/s (${calc.velocityFpm} fpm)`],
        ["Velocity Compliance Status", calc.velocityStatus],
        ["Mass Flow Rate", `${calc.massFlowKgSec} kg/s (${calc.massFlowLbMin} lb/min)`],
        ["Line Pressure Drop", `${calc.deltaPBar} bar (${calc.deltaPPsi} psi)`],
        ["Saturation Temp Drop", `${calc.satTempDropC} °C (${calc.satTempDropF} °F)`],
        [],
        ["3. SIGN-OFF BLOCK"],
        ["Role", "Originator", "Reviewer", "Approver"],
        ["Name", currentUserName, "-", "-"],
        ["Date", new Date().toLocaleDateString('en-GB'), "-", "-"]
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Refrigerant Sizing");
      const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadFile(new Uint8Array(xlsxBuffer), `Refrigerant_Pipe_Sizing_${sizingParams.refrigerant}.xlsx`, "Excel Document", ["xlsx"]);
      toast.success("Excel report exported successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel report");
    }
  };

  return (
    <AppShell
      title="Refrigerant Pipe Sizing"
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
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Refrigerant Pipe Sizer</h1>
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
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/refrigerant-pipe-sizing" calculatorTitle="Refrigerant Pipe Sizer" />
            </div>

            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                inputDescriptions="Cooling capacity, length, and temperatures"
                conversionExample={unitSystem === "si" ? "Convert 35.17 kW → 10.0 TR" : "Convert 10.0 TR → 35.17 kW"}
              />
            </div>
          </div>

          {/* Tabs Selector row */}
          <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/60 modal-blur-bg">
            <div className="flex items-center gap-3">
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

              {tab === "calculator" && (
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  {(["suction", "liquid", "discharge"] as LineType[]).map((t) => {
                    const active = sizingParams.lineType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={isEffectiveReadOnly}
                        onClick={() => {
                          const updated = { ...sizingParams, lineType: t };
                          setSizingParams(updated);
                          saveState(updated, unitSystem);
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-150 cursor-pointer capitalize flex items-center justify-center gap-1 ${
                          active
                            ? "bg-background text-foreground shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground disabled:opacity-50"
                        }`}
                      >
                        {t} Line
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 select-none shrink-0">
              <TBtn onClick={handleExportPdf} title="Export PDF Calculation">
                <FileText className="size-3.5" /> Export
              </TBtn>
            </div>
          </div>

          {/* Main Content Layout Grid */}
          {tab === "calculator" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Input Cards (lg:col-span-5) */}
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
                    count={getMergedItemComments("card-params", "Sizing Parameters", commentsList, "/refrigerant-pipe-sizing", project?.id).length}
                    onClick={() => handleOpenComment("card-params", "Sizing Parameters")}
                  />
                </div>

                {/* Subsection 1: System Capacity & Refrigerant Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Capacity &amp; Refrigerant
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {renderInputBox("coolingCapacity", "coolingCapacity", "Cooling Capacity", sizingParams.coolingCapacity, calc.isIp ? "TR" : "kW", "0.5", 0.1, calc.isIp ? "10" : "35")}

                    {/* Refrigerant Type Dropdown */}
                    <div className="flex flex-col gap-1 p-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-zinc-300">Refrigerant Selection</label>
                      <select
                        value={sizingParams.refrigerant}
                        disabled={isEffectiveReadOnly}
                        onChange={(e) => {
                          const updated = { ...sizingParams, refrigerant: e.target.value as RefrigerantType };
                          setSizingParams(updated);
                          saveState(updated, unitSystem);
                        }}
                        className="w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono focus:outline-none focus:border-primary text-xs font-bold transition hover:border-[#0A7BC7]/50 disabled:opacity-60 cursor-pointer"
                      >
                        <option value="R410A">R-410A (HFC A1 - Standard DX)</option>
                        <option value="R32">R-32 (HFC A2L - High Efficiency)</option>
                        <option value="R134a">R-134a (HFC A1 - Medium Temp/Chillers)</option>
                        <option value="R22">R-22 (HCFC - Legacy Retrofit)</option>
                        <option value="R407C">R-407C (HFC A1 - R22 Replacement)</option>
                        <option value="R404A">R-404A (HFC A1 - Low Temp Commercial)</option>
                        <option value="R1234ze">R-1234ze (HFO A2L - Low GWP)</option>
                        <option value="R290">R-290 (Propane A3 - Natural Refrigerant)</option>
                        <option value="R454B">R-454B (Opteon XL41 A2L)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Subsection 2: Piping Geometry & Design Margins */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Piping Geometry &amp; Oil Return
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderInputBox("pipeLength", "pipeLength", "Equivalent Straight Length", sizingParams.pipeLength, calc.isIp ? "ft" : "m", "1", 1, calc.isIp ? "65" : "20")}
                    {renderInputBox("fittingsAllowancePct", "fittingsAllowancePct", "Fittings & Valve Allowance", sizingParams.fittingsAllowancePct, "%", "5", 0, "20")}
                    {renderInputBox("evaporatingTemp", "evaporatingTemp", "Evaporating Temperature", sizingParams.evaporatingTemp, calc.isIp ? "°F" : "°C", "1", -40, calc.isIp ? "41" : "5")}
                    {renderInputBox("designSafetyMargin", "designSafetyMargin", "Design Capacity Margin", sizingParams.designSafetyMargin, "%", "5", 0, "10")}
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Sizing Results Dashboard (lg:col-span-7) STICKY matching Pump Sizing */}
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
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] font-bold text-xs flex items-center gap-1">
                      <ShieldCheck className="size-3.5" /> ASHRAE Standard
                    </span>
                    <RowCommentCornerBadge
                      count={getMergedItemComments("card-results", "Sizing Results Summary", commentsList, "/refrigerant-pipe-sizing", project?.id).length}
                      onClick={() => handleOpenComment("card-results", "Sizing Results Summary")}
                    />
                  </div>
                </div>

                {/* 4 Stat Cards in a Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Card 1: Blue - Copper Pipe OD */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="res-pipe-od"
                        data-field-id="res-pipe-od"
                        data-comment-target="res-pipe-od"
                        className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 transition-all cursor-context-menu relative"
                      >
                        <RowCommentCornerBadge
                          count={getMergedItemComments("res-pipe-od", "Recommended Copper Pipe OD", commentsList, "/refrigerant-pipe-sizing", project?.id).length}
                          onClick={() => handleOpenComment("res-pipe-od", "Recommended Copper Pipe OD")}
                        />
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Copper ACR OD</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {calc.selectedTier.odMm} mm
                          <span className="text-xs font-normal text-muted-foreground ml-1">({calc.selectedTier.odInches})</span>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment("res-pipe-od", "Recommended Copper Pipe OD")}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add Comment</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Copper Pipe OD", `${calc.selectedTier.odMm} mm (${calc.selectedTier.odInches})`)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                      >
                        <span>Copy Value</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Card 2: Amber - Gas/Liquid Velocity */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="res-velocity"
                        data-field-id="res-velocity"
                        data-comment-target="res-velocity"
                        className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 transition-all cursor-context-menu relative"
                      >
                        <RowCommentCornerBadge
                          count={getMergedItemComments("res-velocity", "Refrigerant Flow Velocity", commentsList, "/refrigerant-pipe-sizing", project?.id).length}
                          onClick={() => handleOpenComment("res-velocity", "Refrigerant Flow Velocity")}
                        />
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Flow Velocity</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {calc.velocityMps} m/s
                          <span className="text-xs font-normal text-muted-foreground ml-1">({calc.velocityFpm} fpm)</span>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment("res-velocity", "Refrigerant Flow Velocity")}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add Comment</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Flow Velocity", `${calc.velocityMps} m/s (${calc.velocityFpm} fpm)`)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                      >
                        <span>Copy Value</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Card 3: Emerald - Pressure Drop */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="res-dp"
                        data-field-id="res-dp"
                        data-comment-target="res-dp"
                        className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 transition-all cursor-context-menu relative"
                      >
                        <RowCommentCornerBadge
                          count={getMergedItemComments("res-dp", "Line Friction Pressure Drop", commentsList, "/refrigerant-pipe-sizing", project?.id).length}
                          onClick={() => handleOpenComment("res-dp", "Line Friction Pressure Drop")}
                        />
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Pressure Drop ΔP</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {calc.deltaPBar} bar
                          <span className="text-xs font-normal text-muted-foreground ml-1">({calc.deltaPPsi} psi)</span>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment("res-dp", "Line Friction Pressure Drop")}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add Comment</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Pressure Drop", `${calc.deltaPBar} bar (${calc.deltaPPsi} psi)`)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                      >
                        <span>Copy Value</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Card 4: Purple - Design Capacity */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="res-capacity"
                        data-field-id="res-capacity"
                        data-comment-target="res-capacity"
                        className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 transition-all cursor-context-menu relative"
                      >
                        <RowCommentCornerBadge
                          count={getMergedItemComments("res-capacity", "Design Capacity", commentsList, "/refrigerant-pipe-sizing", project?.id).length}
                          onClick={() => handleOpenComment("res-capacity", "Design Capacity")}
                        />
                        <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Design Capacity</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {calc.designCapTr} TR
                          <span className="text-xs font-normal text-muted-foreground ml-1">({calc.designCapKw} kW)</span>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment("res-capacity", "Design Capacity")}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add Comment</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleCopyValue("Design Capacity", `${calc.designCapTr} TR (${calc.designCapKw} kW)`)}
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
                    <span className="text-slate-600 dark:text-zinc-400">Internal Pipe Diameter (ID):</span>
                    <span className="font-mono font-bold">{calc.selectedTier.idMm} mm ({calc.selectedTier.idInches} in)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                    <span className="text-slate-600 dark:text-zinc-400">Velocity &amp; Oil-Return Status:</span>
                    <span className={`font-mono font-bold ${calc.isVelWarning ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {calc.velocityStatus} (Allowable: {calc.minVelMps}–{calc.maxVelMps} m/s)
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                    <span className="text-slate-600 dark:text-zinc-400">Total Equivalent Length:</span>
                    <span className="font-mono font-bold">{calc.equivLenM} m ({calc.equivLenFt} ft)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                    <span className="text-slate-600 dark:text-zinc-400">Refrigerant Mass Flow Rate:</span>
                    <span className="font-mono font-bold">{calc.massFlowKgSec} kg/s ({calc.massFlowLbMin} lb/min)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                    <span className="text-slate-600 dark:text-zinc-400">Equiv. Saturation Temperature Drop:</span>
                    <span className="font-mono font-bold">{calc.satTempDropC} °C ({calc.satTempDropF} °F)</span>
                  </div>
                  <div className="flex justify-between py-1 font-bold text-foreground">
                    <span>Recommended Pipe Specification:</span>
                    <span className="font-mono font-bold text-[#0A7BC7]">{calc.selectedTier.odMm} mm ({calc.selectedTier.odInches}) ACR Copper Tube</span>
                  </div>
                </div>

                {/* Design Advisory Note */}
                <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                  <Activity className="size-4 text-[#0A7BC7] shrink-0 mt-0.5" />
                  <span>
                    <strong>ASHRAE Compliance Note:</strong> In vertical suction risers where capacity modulation operates below 50% load, double-risers or oil traps must be installed if minimum gas velocity drops below <strong>4.5 m/s (900 fpm)</strong> to prevent oil stagnation.
                  </span>
                </div>

              </div>
            </div>
          </div>
          )}

          {/* Preliminary formatted Report View */}
          {tab === "report" && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
              <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                
                {/* 1. Title */}
                <div className="pb-1">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                    Refrigerant Pipe Sizing Calculation
                  </h2>
                </div>

                {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
                <div className="border border-border rounded-xl overflow-hidden text-xs">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-border divide-x divide-border">
                        <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                        <td className="p-2.5 font-mono text-foreground font-medium">{(project as any)?.calcNo || "TRV-CALC-REF-01"}</td>
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
                        <td className="p-2.5">{project?.name || "Refrigerant Pipe Sizing"}</td>
                        <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                        <td className="p-2.5">{(project as any)?.endUser || (project as any)?.location || "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. Table 1: Design Parameters */}
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
                        <td className="p-2 border-r border-border font-medium">Refrigerant Type</td>
                        <td className="p-2 text-center border-r border-border font-mono font-bold text-primary">{sizingParams.refrigerant}</td>
                        <td className="p-2 text-center border-r border-border">-</td>
                        <td className="p-2 text-muted-foreground">ASHRAE Standard 34 refrigerant fluid</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">2</td>
                        <td className="p-2 border-r border-border font-medium">Refrigerant Line Service</td>
                        <td className="p-2 text-center border-r border-border font-mono uppercase font-bold">{sizingParams.lineType} LINE</td>
                        <td className="p-2 text-center border-r border-border">-</td>
                        <td className="p-2 text-muted-foreground">{sizingParams.lineType === "suction" ? "Low-pressure vapor return line" : sizingParams.lineType === "liquid" ? "High-pressure liquid line" : "High-pressure hot gas discharge line"}</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">3</td>
                        <td className="p-2 border-r border-border font-medium">Nominal Cooling Capacity</td>
                        <td className="p-2 text-center border-r border-border font-mono">{sizingParams.coolingCapacity}</td>
                        <td className="p-2 text-center border-r border-border">{calc.isIp ? "TR" : "kW"}</td>
                        <td className="p-2 text-muted-foreground">Rated evaporator thermal load capacity</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">4</td>
                        <td className="p-2 border-r border-border font-medium">Design Safety Margin</td>
                        <td className="p-2 text-center border-r border-border font-mono">{sizingParams.designSafetyMargin || 0}%</td>
                        <td className="p-2 text-center border-r border-border">%</td>
                        <td className="p-2 text-muted-foreground">Engineering capacity headroom factor</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">5</td>
                        <td className="p-2 border-r border-border font-medium">Design Thermal Capacity</td>
                        <td className="p-2 text-center border-r border-border font-mono font-bold text-foreground">{calc.isIp ? `${calc.designCapTr} TR` : `${calc.designCapKw} kW`}</td>
                        <td className="p-2 text-center border-r border-border">{calc.isIp ? "TR" : "kW"}</td>
                        <td className="p-2 text-muted-foreground">Equiv: {calc.designCapTr} TR / {calc.designCapKw} kW</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">6</td>
                        <td className="p-2 border-r border-border font-medium">Physical Straight Pipe Run</td>
                        <td className="p-2 text-center border-r border-border font-mono">{sizingParams.pipeLength}</td>
                        <td className="p-2 text-center border-r border-border">{calc.isIp ? "ft" : "m"}</td>
                        <td className="p-2 text-muted-foreground">Linear routing physical distance</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">7</td>
                        <td className="p-2 border-r border-border font-medium">Fittings Equivalent Allowance</td>
                        <td className="p-2 text-center border-r border-border font-mono">{sizingParams.fittingsAllowancePct || 0}%</td>
                        <td className="p-2 text-center border-r border-border">%</td>
                        <td className="p-2 text-muted-foreground">Dynamic loss allowance for bends/valves</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">8</td>
                        <td className="p-2 border-r border-border font-medium">Total Equivalent Route Length</td>
                        <td className="p-2 text-center border-r border-border font-mono">{calc.isIp ? `${calc.equivLenFt} ft` : `${calc.equivLenM} m`}</td>
                        <td className="p-2 text-center border-r border-border">{calc.isIp ? "ft" : "m"}</td>
                        <td className="p-2 text-muted-foreground">Straight run + fittings equivalent allowance</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">9</td>
                        <td className="p-2 border-r border-border font-medium">Operating Evaporating Temp</td>
                        <td className="p-2 text-center border-r border-border font-mono">{sizingParams.evaporatingTemp}</td>
                        <td className="p-2 text-center border-r border-border">{calc.isIp ? "°F" : "°C"}</td>
                        <td className="p-2 text-muted-foreground">Evaporator saturation temperature</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">10</td>
                        <td className="p-2 border-r border-border font-medium">Operating Condensing Temp</td>
                        <td className="p-2 text-center border-r border-border font-mono">{sizingParams.condensingTemp}</td>
                        <td className="p-2 text-center border-r border-border">{calc.isIp ? "°F" : "°C"}</td>
                        <td className="p-2 text-muted-foreground">Condenser saturation temperature</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. Table 2: Recommended Pipe Sizing & Hydraulic Outputs (Highlighted Rows) */}
                <div className="border border-border rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                        <th className="p-2.5 w-12 text-center border-r border-border">No.</th>
                        <th className="p-2.5 text-left border-r border-border">Calculated Engineering Metric</th>
                        <th className="p-2.5 w-44 text-center border-r border-border">Output Value</th>
                        <th className="p-2.5 w-24 text-center border-r border-border">Unit</th>
                        <th className="p-2.5 text-left">Compliance & Safety Factor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {/* Highlighted Row 1 */}
                      <tr className="bg-[#DAE9F8] dark:bg-blue-950/40 font-bold border-y border-blue-200 dark:border-blue-900">
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">1</td>
                        <td className="p-2 border-r border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-100">Recommended Copper Pipe OD</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 font-mono text-blue-950 dark:text-blue-100">{calc.selectedTier.odMm} mm ({calc.selectedTier.odInches})</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">OD</td>
                        <td className="p-2 text-blue-900 dark:text-blue-200">Standard ACR Copper Refrigeration Tubing</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">2</td>
                        <td className="p-2 border-r border-border font-medium">Internal Pipe Diameter (ID)</td>
                        <td className="p-2 text-center border-r border-border font-mono">{calc.selectedTier.idMm} mm ({calc.selectedTier.idInches} in)</td>
                        <td className="p-2 text-center border-r border-border">mm (in)</td>
                        <td className="p-2 text-muted-foreground">Net internal flow cross-section</td>
                      </tr>
                      {/* Highlighted Row 3 */}
                      <tr className="bg-[#DAE9F8] dark:bg-blue-950/40 font-bold border-y border-blue-200 dark:border-blue-900">
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">3</td>
                        <td className="p-2 border-r border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-100">Refrigerant Flow Velocity</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 font-mono text-blue-950 dark:text-blue-100">{calc.velocityMps} m/s ({calc.velocityFpm} fpm)</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">m/s (fpm)</td>
                        <td className="p-2 text-blue-900 dark:text-blue-200">Allowable: {calc.minVelMps}-{calc.maxVelMps} m/s ({calc.minVelFpm}-{calc.maxVelFpm} fpm)</td>
                      </tr>
                      {/* Highlighted Row 4 */}
                      <tr className="bg-[#DAE9F8] dark:bg-blue-950/40 font-bold border-y border-blue-200 dark:border-blue-900">
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">4</td>
                        <td className="p-2 border-r border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-100">Velocity & Oil-Return Status</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 font-bold text-blue-950 dark:text-blue-100">{calc.velocityStatus}</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">-</td>
                        <td className="p-2 text-blue-900 dark:text-blue-200">ASHRAE self-scouring oil-entrainment criteria</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2 text-center border-r border-border font-mono text-muted-foreground">5</td>
                        <td className="p-2 border-r border-border font-medium">Refrigerant Mass Flow Rate</td>
                        <td className="p-2 text-center border-r border-border font-mono">{calc.massFlowKgSec} kg/s ({calc.massFlowLbMin} lb/min)</td>
                        <td className="p-2 text-center border-r border-border">kg/s</td>
                        <td className="p-2 text-muted-foreground">Based on thermodynamic enthalpy difference</td>
                      </tr>
                      {/* Highlighted Row 6 */}
                      <tr className="bg-[#DAE9F8] dark:bg-blue-950/40 font-bold border-y border-blue-200 dark:border-blue-900">
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">6</td>
                        <td className="p-2 border-r border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-100">Line Friction Pressure Drop (ΔP)</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 font-mono text-blue-950 dark:text-blue-100">{calc.deltaPBar} bar ({calc.deltaPPsi} psi)</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">bar (psi)</td>
                        <td className="p-2 text-blue-900 dark:text-blue-200">Darcy-Weisbach loss ({calc.deltaPKPa} kPa) across equivalent run</td>
                      </tr>
                      {/* Highlighted Row 7 */}
                      <tr className="bg-[#DAE9F8] dark:bg-blue-950/40 font-bold border-y border-blue-200 dark:border-blue-900">
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">7</td>
                        <td className="p-2 border-r border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-100">Equiv. Saturation Temp Drop</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 font-mono text-blue-950 dark:text-blue-100">{calc.satTempDropC} °C ({calc.satTempDropF} °F)</td>
                        <td className="p-2 text-center border-r border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">°C (°F)</td>
                        <td className="p-2 text-blue-900 dark:text-blue-200">Target: &lt; 1.0 °C (~2.0 °F) saturation loss limit</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 5. Table 3: Commercial ACR Copper Sizes Evaluated */}
                <div className="border border-border rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                        <th className="p-2.5 w-12 text-center border-r border-border">Sr.</th>
                        <th className="p-2.5 text-center border-r border-border">Outer Dia (OD)</th>
                        <th className="p-2.5 text-center border-r border-border">OD (Inches)</th>
                        <th className="p-2.5 text-center border-r border-border">Inner Dia (ID)</th>
                        <th className="p-2.5 text-center border-r border-border">Capacity Range (TR)</th>
                        <th className="p-2.5 text-center">Selection Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(PIPE_SIZING_TABLES[sizingParams.lineType]?.[sizingParams.refrigerant]?.tiers || []).map((tier, idx) => {
                        const isSelected = tier.odMm === calc.selectedTier.odMm;
                        return (
                          <tr
                            key={idx}
                            className={isSelected ? "bg-[#DAE9F8] dark:bg-blue-950/40 font-bold border-y border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-100" : "hover:bg-slate-50 dark:hover:bg-zinc-800/40"}
                          >
                            <td className="p-2 text-center border-r border-border font-mono">{idx + 1}</td>
                            <td className="p-2 text-center border-r border-border font-mono">{tier.odMm} mm</td>
                            <td className="p-2 text-center border-r border-border font-mono">{tier.odInches}</td>
                            <td className="p-2 text-center border-r border-border font-mono">{tier.idMm} mm</td>
                            <td className="p-2 text-center border-r border-border font-mono">{tier.minCapTr} - {tier.maxCapTr} TR</td>
                            <td className="p-2 text-center">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 dark:text-blue-300">
                                  ✓ Selected Size
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 6. Standard 3-Tier Signature Sign-Off Block (#FFE6CC Header) */}
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
                        {(() => {
                          const sig = getSignatureBlockDetails(
                            project?.id || "default",
                            "/refrigerant-pipe-sizing",
                            currentUserName,
                            calcReviewState
                          );
                          return (
                            <>
                              <tr className="divide-x divide-border">
                                <td className="p-2.5 font-bold text-center bg-muted/10">Name:</td>
                                <td className="p-2.5 text-center font-medium">
                                  {sig.originatedName || currentUserName || "Abubakar Chanda"}
                                </td>
                                <td className="p-2.5 text-center font-medium">
                                  {sig.reviewerName || ""}
                                </td>
                                <td className="p-2.5 text-center font-medium">
                                  {sig.approverName || ""}
                                </td>
                              </tr>
                              <tr className="divide-x divide-border">
                                <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                                <td className="p-2.5 text-center font-mono">
                                  {sig.originatedDate || formatDateStr(new Date().toISOString())}
                                </td>
                                <td className="p-2.5 text-center font-mono">
                                  {sig.reviewerDate || ""}
                                </td>
                                <td className="p-2.5 text-center font-mono">
                                  {sig.approverDate || ""}
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Formulas & Engineering Modal */}
          {showFormulaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto custom-scrollbar font-sans">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Activity className="size-5 text-[#0A7BC7]" />
                    <h2 className="text-lg font-bold text-foreground">Refrigerant Piping Formulas & Derivations</h2>
                  </div>
                  <button
                    onClick={() => setShowFormulaModal(false)}
                    className="p-1 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">1. Refrigerant Mass Flow Rate Equation</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      m_dot = Q_cooling / (h_evap_out - h_evap_in)  [kg / s]
                    </p>
                    <p>
                      Calculated for {sizingParams.refrigerant}: {calc.designCapKw} kW / enthalpy difference = <strong>{calc.massFlowKgSec} kg/s ({calc.massFlowLbMin} lb/min)</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">2. Gas / Liquid Flow Velocity</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      v = (m_dot / rho) / ((pi × d_inner²) / 4)  [m / s]
                    </p>
                    <p>
                      Calculated Velocity: <strong>{calc.velocityMps} m/s ({calc.velocityFpm} fpm)</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">3. Darcy-Weisbach Line Pressure Drop</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      ΔP = f × (L_eq / d_inner) × (rho × v² / 2)  [Pa]
                    </p>
                    <p>
                      Calculated Friction Drop: <strong>{calc.deltaPBar} bar ({calc.deltaPPsi} psi / {calc.deltaPKPa} kPa)</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">4. Oil-Entrainment & Velocity Criteria (ASHRAE)</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      Suction: 4.5 - 20 m/s  |  Discharge: 5 - 18 m/s  |  Liquid: 0.5 - 1.5 m/s
                    </p>
                    <p>
                      Status: <strong>{calc.velocityStatus}</strong>
                    </p>
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
              calculatorPath="/refrigerant-pipe-sizing"
              calculatorTitle="Refrigerant Pipe Sizer"
              existingComments={commentsMap[activeCommentTarget.id] || []}
              onClose={() => setActiveCommentTarget(null)}
              onSave={handleSaveComment}
              onCommentAdded={handleSaveComment}
            />
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
      </div>
    </AppShell>
  );
}
