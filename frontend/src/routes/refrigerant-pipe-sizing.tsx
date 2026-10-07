import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
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
              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal transition hover:border-[#0A7BC7]/50 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 font-sans text-xs bg-card border border-border rounded-xl shadow-xl z-50">
          <ContextMenuItem
            onClick={() => handleCopyValue(label, value)}
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-accent"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Parameter</span>
            <ContextMenuShortcut className="text-[10px]">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handlePasteValue(field, label)}
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-accent disabled:opacity-50"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px]">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handleResetValue(field, label)}
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-accent disabled:opacity-50"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default</span>
          </ContextMenuItem>
          <ContextMenuSeparator className="my-1 bg-border/60" />
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-accent text-primary font-semibold"
          >
            <MessageSquare className="size-3.5" />
            <span>Assign Comment / Task</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // PDF Export Generation matching Smoke Ventilation Report standard
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const callAutoTable = (autoTable as any).default || autoTable;

      const headerFill: [number, number, number] = [220, 235, 252];
      const accentFill: [number, number, number] = [240, 246, 255];
      const primaryFill: [number, number, number] = [240, 245, 250];
      const blueFill: [number, number, number] = [215, 235, 255];

      // Page Title & Subtitle Header
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 123, 199); // #0A7BC7
      doc.text("REFRIGERANT PIPE SIZING CALCULATION REPORT", 14, 16);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text("ASHRAE Refrigeration Handbook Standards (Oil-Return & Velocity Limits)", 14, 21.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 23.5, 196, 23.5);

      // Section 0: Project Information & Design Metadata
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("1. Project Information & Design Basis", 14, 29);

      const metadataBody = [
        [
          { content: "Project Name:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: project?.name || "HVAC Chilled & DX Refrigeration Design" },
          { content: "Calculation ID:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: "CALC-REF-01" }
        ],
        [
          { content: "Client:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: project?.client || "Master Client" },
          { content: "Date:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: new Date().toISOString().split("T")[0] }
        ],
        [
          { content: "Refrigerant:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: sizingParams.refrigerant },
          { content: "Line Sized:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: sizingParams.lineType.toUpperCase() + " LINE" }
        ],
        [
          { content: "Cooling Capacity:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: `${sizingParams.coolingCapacity} ${calc.isIp ? "TR" : "kW"} (Design: ${calc.designCapTr} TR / ${calc.designCapKw} kW)` },
          { content: "Unit System:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: calc.isIp ? "Imperial (IP)" : "Metric (SI)" }
        ]
      ];

      callAutoTable(doc, {
        startY: 32,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, lineColor: [100, 100, 100], lineWidth: 0.1 },
        body: metadataBody
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 60;
      nextY += 7;

      // Section 1: Pipe Sizing Results
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("2. Refrigerant Line Sizing & Hydraulic Output", 14, nextY);
      nextY += 3;

      const resultsBody = [
        ["A", "RECOMMENDED COPPER PIPE OD", `${calc.selectedTier.odMm} mm (${calc.selectedTier.odInches})`, "ASHRAE Standard Copper ACR Refrigeration Tube Outer Diameter"],
        ["B", "Internal Diameter (ID)", `${calc.selectedTier.idMm} mm (${calc.selectedTier.idInches} in)`, "Internal Flow Cross Section Area"],
        ["C", "Refrigerant Gas/Liquid Velocity", `${calc.velocityMps} m/s (${calc.velocityFpm} fpm)`, `Allowable Velocity Range: ${calc.minVelMps} - ${calc.maxVelMps} m/s (${calc.minVelFpm} - ${calc.maxVelFpm} fpm)`],
        ["D", "Velocity & Oil-Return Status", calc.velocityStatus, "ASHRAE oil-entrainment & self-scouring criteria"],
        ["E", "Refrigerant Mass Flow Rate", `${calc.massFlowKgSec} kg/s (${calc.massFlowLbMin} lb/min)`, "m = Q_cooling / delta_h"],
        ["F", "Total Equivalent Length", `${calc.equivLenM} m (${calc.equivLenFt} ft)`, `Straight length + ${sizingParams.fittingsAllowancePct}% fittings allowance`],
        ["G", "Line Pressure Drop (ΔP)", `${calc.deltaPBar} bar (${calc.deltaPPsi} psi / ${calc.deltaPKPa} kPa)`, "Darcy-Weisbach frictional loss in copper ACR tubing"],
        ["H", "Equiv. Saturation Temperature Drop", `${calc.satTempDropC} °C (${calc.satTempDropF} °F)`, "Target: < 1.0 °C (~2.0 °F) saturation loss across line"]
      ];

      callAutoTable(doc, {
        startY: nextY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 }
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 70, fontStyle: "bold" },
          2: { cellWidth: 48, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 54 }
        },
        head: [
          [
            { content: "Item", styles: { fillColor: primaryFill } },
            { content: "Hydraulic Output Parameter", styles: { fillColor: primaryFill } },
            { content: "Calculated Value", styles: { fillColor: blueFill } },
            { content: "Engineering Basis & Criteria", styles: { fillColor: primaryFill } }
          ]
        ],
        body: resultsBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            if (data.row.index === 0) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = blueFill;
              if (data.column.index === 2) {
                data.cell.styles.fontSize = 8.5;
              }
            }
          }
        }
      });

      let sigFinalY = (doc as any).lastAutoTable?.finalY ?? 150;
      sigFinalY += 7;

      if (sigFinalY > 230) {
        doc.addPage();
        sigFinalY = 18;
      }

      // Section 3: 3-Tier Signature Block
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("3. Approval & Sign-Off Block", 14, sigFinalY);
      sigFinalY += 3;

      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || "default", "/refrigerant-pipe-sizing", currentUserName);

      callAutoTable(doc, {
        startY: sigFinalY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 8, halign: "center", valign: "middle", lineColor: [100, 100, 100], lineWidth: 0.1, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 } },
        headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: "bold" },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" }
          ]
        ],
        body: [
          ["Name", originatedName || currentUserName, reviewerName || "-", approverName || "-"],
          ["Designation", "HVAC Design Engineer", "Senior Mechanical Reviewer", "Lead MEP Approver"],
          ["Date", formatDateStr(originatedDate) || new Date().toLocaleDateString('en-GB'), formatDateStr(reviewerDate) || "-", formatDateStr(approverDate) || "-"]
        ]
      });

      doc.save(`Refrigerant_Pipe_Sizing_${sizingParams.refrigerant}_${sizingParams.lineType}.pdf`);
      toast.success("PDF calculation report downloaded successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report");
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
    <AppShell title="Refrigerant Pipe Sizing" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Header & CalculationReviewBar */}
          <div className="flex flex-col gap-1 select-none no-print">
            <div className="flex flex-wrap items-center justify-between gap-4 mt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Refrigerant Pipe Sizer</h1>
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
                {totalCommentsCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-900/60 shadow-2xs"
                    title={`${totalCommentsCount} active comment(s)/task(s) in Refrigerant Pipe Sizer`}
                  >
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>{totalCommentsCount} Active Task{totalCommentsCount === 1 ? "" : "s"}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  ipLabel="IP"
                  siLabel="SI"
                  inputDescriptions="Cooling capacity, length, and temperatures"
                  conversionExample={unitSystem === "si" ? "Convert 35.17 kW → 10.0 TR" : "Convert 10.0 TR → 35.17 kW"}
                />
              </div>
            </div>
          </div>

          {/* Secondary Action Row */}
          <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 mt-2 mb-2">
            <div className="flex items-center gap-2">
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
                      className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer capitalize flex items-center justify-center gap-1 ${
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
              
              <TBtn onClick={() => setShowFormulaModal(true)} title="Formulas & Engineering">
                <HelpCircle className="size-3.5 text-primary" /> Formula Breakdown
              </TBtn>
            </div>

            <TBtn onClick={handleExportPdf} title="Export PDF Report">
              <FileText className="size-3.5" /> Export
            </TBtn>
          </div>

          {/* Main Content Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left Column: Input Cards */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              
              {/* Card 1: System Capacity & Refrigerant Selection */}
              <div className={`bg-card border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs transition-all ${getCalculationStatusBorderClass(calcReviewState?.status)}`}>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">1. SYSTEM CAPACITY & REFRIGERANT TYPE</h3>
                  </div>
                  <Snowflake className="size-4 text-[#0A7BC7]" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderInputBox("coolingCapacity", "coolingCapacity", "Cooling Capacity", sizingParams.coolingCapacity, calc.isIp ? "TR" : "kW", "0.5", 0.1, calc.isIp ? "10" : "35")}

                  {/* Refrigerant Type Dropdown */}
                  <div className="flex flex-col gap-1.5 p-1.5">
                    <label className="font-semibold text-foreground text-xs">Refrigerant Selection</label>
                    <select
                      value={sizingParams.refrigerant}
                      disabled={isEffectiveReadOnly}
                      onChange={(e) => {
                        const updated = { ...sizingParams, refrigerant: e.target.value as RefrigerantType };
                        setSizingParams(updated);
                        saveState(updated, unitSystem);
                      }}
                      className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none transition hover:border-[#0A7BC7]/50 disabled:opacity-60"
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

              {/* Card 2: Piping Geometry & Design Margins */}
              <div className={`bg-card border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs transition-all ${getCalculationStatusBorderClass(calcReviewState?.status)}`}>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">2. PIPING GEOMETRY & OIL RETURN</h3>
                  </div>
                  <Gauge className="size-4 text-[#0A7BC7]" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderInputBox("pipeLength", "pipeLength", "Equivalent Straight Length", sizingParams.pipeLength, calc.isIp ? "ft" : "m", "1", 1, calc.isIp ? "65" : "20")}
                  {renderInputBox("fittingsAllowancePct", "fittingsAllowancePct", "Fittings & Valve Allowance", sizingParams.fittingsAllowancePct, "%", "5", 0, "20")}
                  {renderInputBox("evaporatingTemp", "evaporatingTemp", "Evaporating Temperature", sizingParams.evaporatingTemp, calc.isIp ? "°F" : "°C", "1", -40, calc.isIp ? "41" : "5")}
                  {renderInputBox("designSafetyMargin", "designSafetyMargin", "Design Capacity Margin", sizingParams.designSafetyMargin, "%", "5", 0, "10")}
                </div>
              </div>
            </div>

            {/* Right Column: Sizing Results Dashboard */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              
              {/* Main Sizing Highlight Card */}
              <div className={`bg-card border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs transition-all ${getCalculationStatusBorderClass(calcReviewState?.status)}`}>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">HYDRAULIC SIZING RESULTS</h3>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] font-bold text-xs">
                    <ShieldCheck className="size-3.5" />
                    <span>ASHRAE Standard</span>
                  </div>
                </div>

                {/* Primary Metric Tile */}
                <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recommended Copper ACR OD</span>
                    <div className="text-2xl font-bold font-mono text-[#0A7BC7] mt-0.5">
                      {calc.selectedTier.odMm} mm ({calc.selectedTier.odInches})
                    </div>
                    <span className="text-[11px] text-muted-foreground">Internal Flow Diameter: {calc.selectedTier.idMm} mm ({calc.selectedTier.idInches} in)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Design Capacity</span>
                    <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                      {calc.designCapTr} TR
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">({calc.designCapKw} kW)</span>
                  </div>
                </div>

                {/* Velocity and Oil-Return Check Card */}
                <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 ${
                  calc.isVelWarning
                    ? "bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                    : "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                }`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <Wind className="size-4" />
                      <span>Refrigerant Gas/Liquid Velocity:</span>
                    </span>
                    <strong className="font-mono text-sm font-bold">
                      {calc.velocityMps} m/s ({calc.velocityFpm} fpm)
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>Allowable Range: {calc.minVelMps}–{calc.maxVelMps} m/s ({calc.minVelFpm}–{calc.maxVelFpm} fpm)</span>
                    <span className={`font-bold ${calc.isVelWarning ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {calc.velocityStatus}
                    </span>
                  </div>
                </div>

                {/* Secondary Results Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-surface-2/60 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Total Equivalent Length</span>
                    <strong className="font-mono text-foreground text-sm">
                      {calc.equivLenM} m ({calc.equivLenFt} ft)
                    </strong>
                  </div>

                  <div className="p-3 bg-surface-2/60 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Refrigerant Mass Flow Rate</span>
                    <strong className="font-mono text-foreground text-sm">
                      {calc.massFlowKgSec} kg/s ({calc.massFlowLbMin} lb/min)
                    </strong>
                  </div>

                  <div className="p-3 bg-surface-2/60 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Line Frictional Pressure Drop (ΔP)</span>
                    <strong className="font-mono text-[#0A7BC7] text-sm">
                      {calc.deltaPBar} bar ({calc.deltaPPsi} psi)
                    </strong>
                  </div>

                  <div className="p-3 bg-surface-2/60 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Equiv. Saturation Loss</span>
                    <strong className="font-mono text-foreground text-sm">
                      {calc.satTempDropC} °C ({calc.satTempDropF} °F)
                    </strong>
                  </div>
                </div>
              </div>

              {/* Design Advisory Note */}
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                <Activity className="size-4 text-[#0A7BC7] shrink-0 mt-0.5" />
                <span>
                  <strong>ASHRAE Compliance Note:</strong> In vertical suction risers where capacity modulation / inverters operate below 50% load, double-risers or oil traps must be installed if minimum gas velocity drops below <strong>4.5 m/s (900 fpm)</strong> to prevent oil stagnation in the evaporator.
                </span>
              </div>
            </div>
          </div>

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
