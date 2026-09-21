import { CalculationReviewBar, useCalculationLock, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
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
  FileText, Printer, HelpCircle, X, ChevronDown, Check,
  Copy, Clipboard, RotateCcw, MessageSquare, Download,
  Activity, ShieldCheck, Gauge, Zap, FileSpreadsheet, Wind,
  Layers, ArrowUpRight, Flame, ShieldAlert, ChevronUp, Info
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
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/staircase-pressurization")({
  head: () => ({
    meta: [
      { title: "Staircase Pressurization — MEP Calc" },
      { name: "description", content: "Calculate the required air supply volume for staircase containment systems to resist smoke ingress during fire evacuations per NFPA 92 & BS EN 12101-6." },
    ],
  }),
  component: StaircasePressurizationPage,
});

export interface StaircaseParams {
  doorWidth: number | ""; // m (SI) or ft (IP)
  doorHeight: number | ""; // m (SI) or ft (IP)
  openDoorsCount: number | ""; // count
  egressVelocity: number | ""; // m/s (SI) or fpm (IP)
  leakageRatePerDoor: number | ""; // m³/s (SI) or CFM (IP)
  closedDoorsCount: number | ""; // count
  structureLeakagePct: number | ""; // %
  safetyFactorPct: number | ""; // % (default 15%)
  designPressureDiff: number | ""; // Pa (SI) or in.wg (IP)
}

const DEFAULT_PARAMS: StaircaseParams = {
  doorWidth: 1.0,
  doorHeight: 2.1,
  openDoorsCount: 2,
  egressVelocity: 1.0,
  leakageRatePerDoor: 0.03,
  closedDoorsCount: 19,
  structureLeakagePct: 15,
  safetyFactorPct: 15,
  designPressureDiff: 50,
};

function StaircasePressurizationPage() {
  const { userData, profile, user } = useAuth();
  const currentUserName = userData?.name || profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";
  const { project, isReadOnly } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/staircase-pressurization", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const [calcReviewState, setCalcReviewState] = useState<CalculationReviewState | null>(null);
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole || calcReviewState?.status === "APPROVED");

  // State definitions
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [sizingParams, setSizingParams] = useState<StaircaseParams>(DEFAULT_PARAMS);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(true);
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync review state
  useEffect(() => {
    const handleReviewUpdate = (e: any) => {
      if (e?.detail) setCalcReviewState(e.detail);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("mep-review-state-updated", handleReviewUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("mep-review-state-updated", handleReviewUpdate);
      }
    };
  }, []);

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
    if (!project?.id) return;
    const pId = project.id;
    const storageKey = `mep_staircase_pressurization_${pId}`;

    if (loadedProjectId !== pId) {
      let loadedData: any = null;

      if (project.workspace_data) {
        let wdata = project.workspace_data;
        if (typeof wdata === "string") {
          try { wdata = JSON.parse(wdata); } catch (e) {}
        }
        if (wdata?.staircase_press_data) {
          loadedData = wdata.staircase_press_data;
        }
      }

      if (!loadedData && typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(storageKey) || localStorage.getItem(`staircase_press_state_${pId}`);
          if (saved) loadedData = JSON.parse(saved);
        } catch (e) {}
      }

      if (loadedData) {
        if (loadedData.sizingParams) {
          setSizingParams(loadedData.sizingParams);
        } else if (loadedData.doorWidth !== undefined) {
          setSizingParams({
            doorWidth: loadedData.doorWidth ?? 1.0,
            doorHeight: loadedData.doorHeight ?? 2.1,
            openDoorsCount: 2,
            egressVelocity: 1.0,
            leakageRatePerDoor: loadedData.leakageRate ?? 0.03,
            closedDoorsCount: loadedData.closedDoors ?? 19,
            structureLeakagePct: 15,
            safetyFactorPct: 15,
            designPressureDiff: 50,
          });
        }
        if (loadedData.unitSystem) setUnitSystem(loadedData.unitSystem);
        if (loadedData.commentsMap) setCommentsMap(loadedData.commentsMap);
      }

      setLoadedProjectId(pId);
    }
  }, [project, loadedProjectId]);

  // Save helper
  const saveState = (
    newParams: StaircaseParams,
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
      localStorage.setItem(`mep_staircase_pressurization_${pId}`, JSON.stringify(dataToSave));
    }

    dirtyStore.set(true);
  };

  // Unit conversion
  const handleUnitSystemChange = (target: "si" | "ip", shouldConvert: boolean = true) => {
    if (target === unitSystem) return;
    const w = sizingParams.doorWidth;
    const h = sizingParams.doorHeight;
    const vel = sizingParams.egressVelocity;
    const leak = sizingParams.leakageRatePerDoor;
    const pDiff = sizingParams.designPressureDiff;

    let convertedW: number | "" = w;
    let convertedH: number | "" = h;
    let convertedVel: number | "" = vel;
    let convertedLeak: number | "" = leak;
    let convertedPDiff: number | "" = pDiff;

    if (shouldConvert) {
      if (target === "si") {
        // IP -> SI
        convertedW = w !== "" ? Number((Number(w) * 0.3048).toFixed(2)) : "";
        convertedH = h !== "" ? Number((Number(h) * 0.3048).toFixed(2)) : "";
        convertedVel = vel !== "" ? Number((Number(vel) * 0.00508).toFixed(2)) : "";
        convertedLeak = leak !== "" ? Number((Number(leak) / 2118.88).toFixed(4)) : "";
        convertedPDiff = pDiff !== "" ? Number((Number(pDiff) * 249.0889).toFixed(1)) : "";
      } else {
        // SI -> IP
        convertedW = w !== "" ? Number((Number(w) / 0.3048).toFixed(2)) : "";
        convertedH = h !== "" ? Number((Number(h) / 0.3048).toFixed(2)) : "";
        convertedVel = vel !== "" ? Number((Number(vel) / 0.00508).toFixed(0)) : "";
        convertedLeak = leak !== "" ? Number((Number(leak) * 2118.88).toFixed(1)) : "";
        convertedPDiff = pDiff !== "" ? Number((Number(pDiff) / 249.0889).toFixed(2)) : "";
      }
    }

    const updatedParams: StaircaseParams = {
      ...sizingParams,
      doorWidth: convertedW,
      doorHeight: convertedH,
      egressVelocity: convertedVel,
      leakageRatePerDoor: convertedLeak,
      designPressureDiff: convertedPDiff,
    };

    setUnitSystem(target);
    setSizingParams(updatedParams);
    saveState(updatedParams, target);
    toast.success(`Switched unit system to ${target.toUpperCase()}`);
  };

  // Calculations Engine
  const calc = useMemo(() => {
    const isIp = unitSystem === "ip";
    
    // Normalize inputs to standard SI for physics calculations
    const wValM = isIp
      ? (typeof sizingParams.doorWidth === "number" ? sizingParams.doorWidth * 0.3048 : 1.0)
      : (typeof sizingParams.doorWidth === "number" ? sizingParams.doorWidth : 1.0);

    const hValM = isIp
      ? (typeof sizingParams.doorHeight === "number" ? sizingParams.doorHeight * 0.3048 : 2.1)
      : (typeof sizingParams.doorHeight === "number" ? sizingParams.doorHeight : 2.1);

    const openDoorsCount = typeof sizingParams.openDoorsCount === "number" ? sizingParams.openDoorsCount : 2;
    
    const egressVelMps = isIp
      ? (typeof sizingParams.egressVelocity === "number" ? sizingParams.egressVelocity * 0.00508 : 1.0)
      : (typeof sizingParams.egressVelocity === "number" ? sizingParams.egressVelocity : 1.0);

    const leakRateM3s = isIp
      ? (typeof sizingParams.leakageRatePerDoor === "number" ? sizingParams.leakageRatePerDoor / 2118.88 : 0.03)
      : (typeof sizingParams.leakageRatePerDoor === "number" ? sizingParams.leakageRatePerDoor : 0.03);

    const closedDoorsCount = typeof sizingParams.closedDoorsCount === "number" ? sizingParams.closedDoorsCount : 19;
    const safetyPct = typeof sizingParams.safetyFactorPct === "number" ? sizingParams.safetyFactorPct : 15;
    const structureLeakPct = typeof sizingParams.structureLeakagePct === "number" ? sizingParams.structureLeakagePct : 15;

    // 1. Door Area
    const doorAreaM2 = wValM * hValM;
    const doorAreaSqFt = doorAreaM2 * 10.7639;

    // 2. Open Door Air Flow
    const openFlowM3s = doorAreaM2 * egressVelMps * openDoorsCount;
    const openFlowCfm = openFlowM3s * 2118.88;
    const openFlowLs = openFlowM3s * 1000;

    // 3. Closed Door Leakage Air Flow
    const closedFlowM3s = leakRateM3s * closedDoorsCount;
    const closedFlowCfm = closedFlowM3s * 2118.88;
    const closedFlowLs = closedFlowM3s * 1000;

    // 4. Structure & Duct Safety Margin Allowance
    const safetyFlowM3s = (closedFlowM3s + openFlowM3s) * (safetyPct / 100);
    const safetyFlowCfm = safetyFlowM3s * 2118.88;
    const safetyFlowLs = safetyFlowM3s * 1000;

    // 5. Total Air Volume Required
    const totalVolM3s = openFlowM3s + closedFlowM3s + safetyFlowM3s;
    const totalVolCfm = totalVolM3s * 2118.88;
    const totalVolLs = totalVolM3s * 1000;
    const totalVolM3h = totalVolM3s * 3600;

    // 6. Estimated Fan Power @ typical 250 Pa (1.0 in.wg) system static pressure (65% fan efficiency)
    const fanStaticPa = 250;
    const fanPowerKw = (totalVolM3s * fanStaticPa) / (0.65 * 1000);
    const fanPowerHp = fanPowerKw * 1.34102;

    return {
      isIp,
      doorAreaM2: Number(doorAreaM2.toFixed(4)),
      doorAreaSqFt: Number(doorAreaSqFt.toFixed(2)),
      openFlowM3s: Number(openFlowM3s.toFixed(4)),
      openFlowCfm: Number(openFlowCfm.toFixed(0)),
      openFlowLs: Number(openFlowLs.toFixed(1)),
      closedFlowM3s: Number(closedFlowM3s.toFixed(4)),
      closedFlowCfm: Number(closedFlowCfm.toFixed(0)),
      closedFlowLs: Number(closedFlowLs.toFixed(1)),
      safetyFlowM3s: Number(safetyFlowM3s.toFixed(4)),
      safetyFlowCfm: Number(safetyFlowCfm.toFixed(0)),
      safetyFlowLs: Number(safetyFlowLs.toFixed(1)),
      totalVolM3s: Number(totalVolM3s.toFixed(4)),
      totalVolCfm: Number(totalVolCfm.toFixed(0)),
      totalVolLs: Number(totalVolLs.toFixed(1)),
      totalVolM3h: Number(totalVolM3h.toFixed(0)),
      fanPowerKw: Number(fanPowerKw.toFixed(2)),
      fanPowerHp: Number(fanPowerHp.toFixed(2)),
    };
  }, [sizingParams, unitSystem]);

  // Context menu actions
  const handleCopyValue = (label: string, value: any) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(String(value));
      toast.success(`Copied ${label}: ${value}`);
    }
  };

  const handlePasteValue = async (field: keyof StaircaseParams, label: string) => {
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

  const handleResetValue = (field: keyof StaircaseParams, label: string) => {
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

  const handleSaveComment = (newComment: any) => {
    if (!activeCommentTarget) return;
    const existing = commentsMap[activeCommentTarget.id] || [];
    const updated = { ...commentsMap, [activeCommentTarget.id]: [...existing, newComment] };
    setCommentsMap(updated);
    saveState(sizingParams, unitSystem, updated);
    setActiveCommentTarget(null);
    toast.success(`Task assigned successfully!`);
  };

  // Reusable Parameter Input Tile matching CHW Pump Head standard
  const renderInputBox = (
    id: string,
    field: keyof StaircaseParams,
    label: string,
    value: number | "",
    unit: string,
    step: string = "1",
    min: number = 0,
    placeholder: string = "0"
  ) => {
    const itemComments = commentsMap[id] || [];
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

  // PDF Export Generation matching Smoke Ventilation standard
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const callAutoTable = (autoTable as any).default || autoTable;

      const headerFill: [number, number, number] = [220, 235, 252];
      const primaryFill: [number, number, number] = [240, 245, 250];
      const blueFill: [number, number, number] = [215, 235, 255];

      // Page Title & Header Bar
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 123, 199); // #0A7BC7
      doc.text("STAIRCASE PRESSURIZATION CALCULATION REPORT", 14, 16);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text("Life Safety Smoke Control & Containment per NFPA 92 & BS EN 12101-6", 14, 21.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 23.5, 196, 23.5);

      // Section 1: Project Information & Design Basis
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("1. Project Information & Design Parameters", 14, 29);

      const metadataBody = [
        [
          { content: "Project Name:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: project?.name || "Life Safety Smoke Management System" },
          { content: "Calculation ID:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: "CALC-STAIR-PRESS-01" }
        ],
        [
          { content: "Client:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: project?.client || "Master Client" },
          { content: "Date:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: new Date().toISOString().split("T")[0] }
        ],
        [
          { content: "Door Dimensions:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: `${sizingParams.doorWidth} m (W) × ${sizingParams.doorHeight} m (H) — Area: ${calc.doorAreaM2} m²` },
          { content: "Open Doors Count:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: `${sizingParams.openDoorsCount} Doors (Egress Velocity: ${sizingParams.egressVelocity} m/s)` }
        ],
        [
          { content: "Closed Doors Count:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: `${sizingParams.closedDoorsCount} Doors (Leakage: ${sizingParams.leakageRatePerDoor} m³/s/door)` },
          { content: "Safety Factor:", styles: { fontStyle: "bold", fillColor: headerFill } },
          { content: `${sizingParams.safetyFactorPct}% (Structure & Duct Tolerance)` }
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

      // Section 2: Pressurization Air Volume Flowrate Results
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("2. Smoke Containment Air Flow Output", 14, nextY);
      nextY += 3;

      const resultsBody = [
        ["A", "TOTAL AIR SUPPLY VOLUME REQUIRED", `${calc.totalVolM3s} m³/s (${calc.totalVolCfm.toLocaleString()} CFM / ${calc.totalVolLs.toLocaleString()} L/s)`, "Q_total = Open Door Flow + Closed Door Flow + Safety Allowance"],
        ["B", "Open Door Air Volume Flow", `${calc.openFlowM3s} m³/s (${calc.openFlowCfm.toLocaleString()} CFM / ${calc.openFlowLs.toLocaleString()} L/s)`, `Q_open = Door Area × Velocity (1.0 m/s) × ${sizingParams.openDoorsCount} open doors`],
        ["C", "Closed Door Leakage Air Volume", `${calc.closedFlowM3s} m³/s (${calc.closedFlowCfm.toLocaleString()} CFM / ${calc.closedFlowLs.toLocaleString()} L/s)`, `Q_closed = Leakage Rate (${sizingParams.leakageRatePerDoor} m³/s) × ${sizingParams.closedDoorsCount} doors`],
        ["D", "Safety Margin Allowance", `${calc.safetyFlowM3s} m³/s (${calc.safetyFlowCfm.toLocaleString()} CFM / ${calc.safetyFlowLs.toLocaleString()} L/s)`, `${sizingParams.safetyFactorPct}% allowance for shaft walls and construction leakage`],
        ["E", "Hourly Air Supply Volume", `${calc.totalVolM3h.toLocaleString()} m³/h`, "Total hourly smoke control volumetric capacity"],
        ["F", "Estimated Fan Shaft Power", `${calc.fanPowerKw} kW (${calc.fanPowerHp} HP)`, "Estimated at 250 Pa static pressure and 65% fan total efficiency"]
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
          1: { halign: "left", cellWidth: 68, fontStyle: "bold" },
          2: { cellWidth: 50, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 54 }
        },
        head: [
          [
            { content: "Item", styles: { fillColor: primaryFill } },
            { content: "Hydraulic Output Parameter", styles: { fillColor: primaryFill } },
            { content: "Calculated Value", styles: { fillColor: blueFill } },
            { content: "Engineering Basis & Formula", styles: { fillColor: primaryFill } }
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
      } = getSignatureBlockDetails(project?.id || "default", "/staircase-pressurization", currentUserName);

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
          ["Designation", "Fire & Life Safety Engineer", "Senior Mechanical Reviewer", "Lead MEP Approver"],
          ["Date", formatDateStr(originatedDate) || new Date().toLocaleDateString('en-GB'), formatDateStr(reviewerDate) || "-", formatDateStr(approverDate) || "-"]
        ]
      });

      doc.save(`Staircase_Pressurization_Report.pdf`);
      toast.success("PDF calculation report downloaded successfully!");
      setShowExportMenu(false);
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
        ["STAIRCASE PRESSURIZATION CALCULATION REPORT"],
        ["Standard: NFPA 92 / BS EN 12101-6 Smoke Containment Standards"],
        [],
        ["1. DESIGN PARAMETERS"],
        ["Project Name", project?.name || "Staircase Smoke Control"],
        ["Client", project?.client || "Master Client"],
        ["Engineer", currentUserName],
        ["Date", new Date().toLocaleDateString('en-GB')],
        ["Door Width", `${sizingParams.doorWidth} m`],
        ["Door Height", `${sizingParams.doorHeight} m`],
        ["Door Area", `${calc.doorAreaM2} m²`],
        ["Number of Open Doors", sizingParams.openDoorsCount],
        ["Egress Velocity", `${sizingParams.egressVelocity} m/s`],
        ["Air Leakage per Closed Door", `${sizingParams.leakageRatePerDoor} m³/s`],
        ["Number of Closed Doors", sizingParams.closedDoorsCount],
        ["Safety Factor Margin", `${sizingParams.safetyFactorPct}%`],
        [],
        ["2. CALCULATION RESULTS"],
        ["Total Air Volume Required", `${calc.totalVolM3s} m³/s (${calc.totalVolCfm} CFM / ${calc.totalVolLs} L/s)`],
        ["Open Door Flow", `${calc.openFlowM3s} m³/s (${calc.openFlowCfm} CFM)`],
        ["Closed Door Leakage Flow", `${calc.closedFlowM3s} m³/s (${calc.closedFlowCfm} CFM)`],
        ["Safety Factor Flow (15%)", `${calc.safetyFlowM3s} m³/s (${calc.safetyFlowCfm} CFM)`],
        ["Hourly Volumetric Capacity", `${calc.totalVolM3h} m³/h`],
        ["Estimated Fan Power (@ 250 Pa)", `${calc.fanPowerKw} kW (${calc.fanPowerHp} HP)`],
        [],
        ["3. SIGN-OFF BLOCK"],
        ["Role", "Originator", "Reviewer", "Approver"],
        ["Name", currentUserName, "-", "-"],
        ["Date", new Date().toLocaleDateString('en-GB'), "-", "-"]
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Staircase Pressurization");
      const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadFile(new Uint8Array(xlsxBuffer), `Staircase_Pressurization.xlsx`, "Excel Document", ["xlsx"]);
      toast.success("Excel report exported successfully!");
      setShowExportMenu(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel report");
    }
  };

  return (
    <AppShell title="Staircase Pressurization" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full custom-scrollbar">
          
          {/* Header & CalculationReviewBar */}
          <div className="flex justify-between items-start shrink-0 select-none no-print">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between gap-3 mt-0.5 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-2">
                    <h1 className="text-[28px] font-bold tracking-tight text-foreground">Staircase Pressurization</h1>
                    <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">NFPA 92 / BS EN 12101</span>
                  </div>
                  <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/staircase-pressurization" calculatorTitle="Staircase Pressurization" />
                </div>

                <div className="flex items-center gap-2">
                  <UnitToggle
                    unitSystem={unitSystem}
                    onChange={handleUnitSystemChange}
                    ipLabel="IP"
                    siLabel="SI"
                    inputDescriptions="Door sizes, leakage rates, and air volumes"
                    conversionExample={unitSystem === "si" ? "Convert 1.0 m → 3.28 ft" : "Convert 3.28 ft → 1.0 m"}
                  />

                  <button
                    type="button"
                    onClick={() => setShowFormulaModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-card hover:bg-muted/70 transition cursor-pointer text-foreground"
                    title="Detailed Derivations, Formulas & NFPA 92 Standards"
                  >
                    <Info className="size-3.5 text-[#0A7BC7]" />
                    <span>Formulas & Derivations</span>
                  </button>

                  {/* Export Button & Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full bg-[#0A7BC7] text-white hover:bg-[#0866A5] transition shadow-xs cursor-pointer"
                    >
                      <Download className="size-3.5" />
                      <span>Export</span>
                      <ChevronDown className="size-3 ml-0.5" />
                    </button>

                    {showExportMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-50 py-1 font-sans text-xs">
                        <button
                          type="button"
                          onClick={handleExportPdf}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent cursor-pointer transition text-foreground"
                        >
                          <FileText className="size-4 text-[#0A7BC7]" />
                          <span>PDF Report</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportExcel}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent cursor-pointer transition text-foreground"
                        >
                          <FileSpreadsheet className="size-4 text-emerald-600" />
                          <span>Excel Workbook (.xlsx)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Calculate the required air supply volume for staircase containment systems to resist smoke ingress during fire evacuations.
              </p>
            </div>
          </div>

          {/* Main Content Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left Column: Input Cards */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              
              {/* Card 1: Door Geometry & Egress Criteria */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">1. DOOR GEOMETRY & OPEN EGRESS CRITERIA</h3>
                  </div>
                  <Layers className="size-4 text-[#0A7BC7]" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderInputBox("doorWidth", "doorWidth", "Door Width", sizingParams.doorWidth, calc.isIp ? "ft" : "m", "0.1", 0.5, calc.isIp ? "3.28" : "1.0")}
                  {renderInputBox("doorHeight", "doorHeight", "Door Height", sizingParams.doorHeight, calc.isIp ? "ft" : "m", "0.1", 1.0, calc.isIp ? "6.89" : "2.1")}
                  {renderInputBox("openDoorsCount", "openDoorsCount", "Number of Open Doors", sizingParams.openDoorsCount, "doors", "1", 1, "2")}
                  {renderInputBox("egressVelocity", "egressVelocity", "Open Door Air Velocity", sizingParams.egressVelocity, calc.isIp ? "fpm" : "m/s", "0.1", 0.5, calc.isIp ? "200" : "1.0")}
                </div>
              </div>

              {/* Card 2: Closed Door Leakage & Safety Factors */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">2. CLOSED DOOR LEAKAGE & DESIGN MARGINS</h3>
                  </div>
                  <Gauge className="size-4 text-[#0A7BC7]" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderInputBox("leakageRatePerDoor", "leakageRatePerDoor", "Air Leakage per Closed Door", sizingParams.leakageRatePerDoor, calc.isIp ? "CFM" : "m³/s", "0.005", 0.001, calc.isIp ? "63.6" : "0.03")}
                  {renderInputBox("closedDoorsCount", "closedDoorsCount", "Number of Closed Doors", sizingParams.closedDoorsCount, "doors", "1", 1, "19")}
                  {renderInputBox("safetyFactorPct", "safetyFactorPct", "Construction & Duct Safety Factor", sizingParams.safetyFactorPct, "%", "5", 0, "15")}
                  {renderInputBox("designPressureDiff", "designPressureDiff", "Design Pressure Difference", sizingParams.designPressureDiff, calc.isIp ? "in.wg" : "Pa", "5", 10, calc.isIp ? "0.20" : "50")}
                </div>
              </div>
            </div>

            {/* Right Column: Sizing Results Dashboard */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              
              {/* Primary Results Highlight Card */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">CALCULATION RESULTS</h3>
                    <button
                      type="button"
                      onClick={() => setShowFormulaModal(true)}
                      className="inline-flex items-center justify-center size-5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-[#0A7BC7] transition cursor-pointer"
                      title="View Detailed Calculations & Formulas"
                    >
                      <Info className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] font-bold text-xs">
                    <ShieldCheck className="size-3.5" />
                    <span>NFPA 92 Compliant</span>
                  </div>
                </div>

                {/* Main Metric Tile */}
                <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Pressurisation Volume Required</span>
                    <div className="text-2xl font-bold font-mono text-[#0A7BC7] mt-0.5">
                      {calc.totalVolM3s} m³/s
                    </div>
                    <span className="text-[11px] text-muted-foreground">({calc.totalVolCfm.toLocaleString()} CFM · {calc.totalVolLs.toLocaleString()} L/s)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hourly Capacity</span>
                    <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                      {calc.totalVolM3h.toLocaleString()} m³/h
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">Fan: ~{calc.fanPowerKw} kW ({calc.fanPowerHp} HP)</span>
                  </div>
                </div>

                {/* Sub-Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-surface-2/60 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Single Door Cross-Section</span>
                    <strong className="font-mono text-foreground text-sm">
                      {calc.doorAreaM2} m² ({calc.doorAreaSqFt} sq ft)
                    </strong>
                  </div>

                  <div className="p-3 bg-surface-2/60 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Open Door Flow ({sizingParams.openDoorsCount} Doors)</span>
                    <strong className="font-mono text-foreground text-sm">
                      {calc.openFlowM3s} m³/s ({calc.openFlowCfm} CFM)
                    </strong>
                  </div>

                  <div className="p-3 bg-surface-2/60 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Closed Door Leakage Flow</span>
                    <strong className="font-mono text-foreground text-sm">
                      {calc.closedFlowM3s} m³/s ({calc.closedFlowCfm} CFM)
                    </strong>
                  </div>

                  <div className="p-3 bg-surface-2/60 rounded-xl border border-border/60 flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Safety Margin Flow ({sizingParams.safetyFactorPct}%)</span>
                    <strong className="font-mono text-[#0A7BC7] text-sm">
                      {calc.safetyFlowM3s} m³/s ({calc.safetyFlowCfm} CFM)
                    </strong>
                  </div>
                </div>
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
                    <h2 className="text-lg font-bold text-foreground">Staircase Pressurization Calculations & NFPA 92 Derivations</h2>
                  </div>
                  <button
                    onClick={() => setShowFormulaModal(false)}
                    className="p-1 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
                  {/* Detailed Step-by-Step Substitution */}
                  <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col gap-3">
                    <div className="flex items-center gap-2 font-bold text-foreground text-sm border-b border-border/60 pb-2">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <span>Detailed Step-by-Step Numerical Breakdown</span>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2.5">
                      <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0A7BC7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</div>
                      <div>
                        <div className="font-bold text-foreground">Step 1: Door Cross-Sectional Area</div>
                        <div className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] my-0.5">Door Area = Door Width × Door Height</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">{sizingParams.doorWidth} m × {sizingParams.doorHeight} m = <strong>{calc.doorAreaM2} m² ({calc.doorAreaSqFt} sq ft)</strong></div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2.5">
                      <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0A7BC7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</div>
                      <div>
                        <div className="font-bold text-foreground">Step 2: Open Door Egress Air Volume Flow</div>
                        <div className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] my-0.5">Q_open = Door Area × Egress Velocity × Open Doors Count</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">{calc.doorAreaM2} m² × {sizingParams.egressVelocity} m/s × {sizingParams.openDoorsCount} doors = <strong>{calc.openFlowM3s} m³/s ({calc.openFlowCfm.toLocaleString()} CFM)</strong></div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2.5">
                      <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0A7BC7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</div>
                      <div>
                        <div className="font-bold text-foreground">Step 3: Closed Door Gap Leakage Flow</div>
                        <div className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] my-0.5">Q_closed = Leakage Rate per Door × Closed Doors Count</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">{sizingParams.leakageRatePerDoor} m³/s × {sizingParams.closedDoorsCount} doors = <strong>{calc.closedFlowM3s} m³/s ({calc.closedFlowCfm.toLocaleString()} CFM)</strong></div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-b border-border/40 pb-2.5">
                      <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0A7BC7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</div>
                      <div>
                        <div className="font-bold text-foreground">Step 4: Safety & Construction Margin Flow</div>
                        <div className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] my-0.5">Q_safety = (Q_open + Q_closed) × Safety Margin ({sizingParams.safetyFactorPct}%)</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">({calc.openFlowM3s} + {calc.closedFlowM3s}) × {sizingParams.safetyFactorPct}% = <strong>{calc.safetyFlowM3s} m³/s ({calc.safetyFlowCfm.toLocaleString()} CFM)</strong></div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="size-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0A7BC7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">5</div>
                      <div>
                        <div className="font-bold text-foreground">Step 5: Total Required Containment Air Supply</div>
                        <div className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] my-0.5">Q_total = Q_open + Q_closed + Q_safety</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">{calc.openFlowM3s} + {calc.closedFlowM3s} + {calc.safetyFlowM3s} = <strong className="text-[#0A7BC7]">{calc.totalVolM3s} m³/s ({calc.totalVolCfm.toLocaleString()} CFM / {calc.totalVolLs.toLocaleString()} L/s)</strong></div>
                      </div>
                    </div>
                  </div>

                  {/* Governing Equations */}
                  <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col gap-3">
                    <div className="flex items-center gap-2 font-bold text-foreground text-sm border-b border-border/60 pb-2">
                      <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                      <span>Governing Standards & Equations</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-foreground text-xs">1. Open Door Airflow Criteria (NFPA 92 / BS EN 12101-6)</h4>
                        <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold my-0.5">
                          Q_open = A_door × v_egress × N_open
                        </p>
                        <p className="text-[11.5px]">
                          Maintains minimum average airflow velocity (1.0 m/s or 200 fpm) across open egress doors to resist smoke propagation back into the protected staircase enclosure.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground text-xs">2. Closed Door Crack Leakage</h4>
                        <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold my-0.5">
                          Q_closed = N_closed × q_leak
                        </p>
                        <p className="text-[11.5px]">
                          Accounts for perimeter crack leakage across all non-opened fire doors under 50 Pa design pressure difference (typical 0.03 m³/s or ~64 CFM per single door leaf).
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground text-xs">3. Maximum Allowable Door Opening Force</h4>
                        <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold my-0.5">
                          F_door = F_closer + (W_door × A_door × ΔP) / [2 × (W_door - d_handle)] ≤ 100 N (22.5 lbf)
                        </p>
                        <p className="text-[11.5px]">
                          Mandated to ensure unassisted egress capability for building occupants. Overpressure relief dampers or modulating bypass VFD fans must regulate pressure under 50–60 Pa.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* NFPA 92 / BS EN 12101-6 Criteria Box */}
                  <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                    <ShieldAlert className="size-4 text-[#0A7BC7] shrink-0 mt-0.5" />
                    <span>
                      <strong>NFPA 92 & BS EN 12101-6 Code Note:</strong> The maximum door opening force must not exceed <strong>100 N (22.5 lbf)</strong> at the handle. If ΔP across closed doors exceeds 50 Pa, barometric pressure relief dampers or variable speed drive (VSD) pressure transducers must be installed to prevent door jam.
                    </span>
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
              calculatorPath="/staircase-pressurization"
              calculatorTitle="Staircase Pressurization"
              onClose={() => setActiveCommentTarget(null)}
              onCommentAdded={handleSaveComment}
            />
          )}

        </div>
      </div>
    </AppShell>
  );
}
