import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle,
  Save, FolderOpen, ChevronDown, ChevronUp, Trash2, Copy, Clipboard,
  RotateCcw, MessageSquare, Edit3, FileText, CheckCircle2, Sparkles,
  Download, Upload, Gauge, Layers, Zap, Flame, X, ArrowRight, Check, Droplet, Droplets, Box, Building2
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";

export const Route = createFileRoute("/plumbing-tank-sizing")({
  head: () => ({
    meta: [
      { title: "Domestic Water Tank Sizing — MEP Calc" },
      { name: "description", content: "Water storage tank capacity sizing based on daily consumption demand, peak surge buffer, and pump refill duration." },
    ],
  }),
  component: TankSizingPage,
});

interface TankSizingParams {
  dailyDemand: number | "";
  storageDays: number | "";
  peakFlow: number | "";
  pumpFillRate: number | "";
  safetyFactor: number | ""; // %
  usableDepth: number | "";
  numCompartments: number;
}

function TankSizingPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  // Core Sizing Parameters
  const [sizingParams, setSizingParams] = useState<TankSizingParams>({
    dailyDemand: 5000, // gal or Litres
    storageDays: 1, // days
    peakFlow: 40, // GPM or L/s
    pumpFillRate: 30, // GPM or L/s
    safetyFactor: 10, // %
    usableDepth: 8, // ft or m
    numCompartments: 2, // 2-cell redundancy standard
  });

  // Project Info for Documentation & Reports
  const [projectInfo, setProjectInfo] = useState({
    projectName: "Domestic Water Storage Facility",
    projectNumber: "MEP-PLB-TNK01",
    client: "Project Master Client",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-PLB-TNK01",
    notes: "Potable and domestic break tank sizing using storage demand method with 2-cell maintenance split.",
  });

  // Modal states
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Comment Assignment State
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll and highlight notification target item
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

  // Sync / Load Project Saved State
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_tank_sizing_${pId}`;

    if (loadedProjectId !== pId) {
      let loadedData: any = null;

      // 1. Check workspace_data
      if (project?.workspace_data) {
        let wdata = project.workspace_data;
        if (typeof wdata === "string") {
          try { wdata = JSON.parse(wdata); } catch (e) {}
        }
        if (wdata?.tank_sizing_data) {
          loadedData = wdata.tank_sizing_data;
        }
      }

      // 2. Check localStorage fallback
      if (!loadedData && typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(storageKey) || localStorage.getItem(`tankSizing_${pId}`);
          if (saved) loadedData = JSON.parse(saved);
        } catch (e) {}
      }

      if (loadedData) {
        if (loadedData.sizingParams) setSizingParams(loadedData.sizingParams);
        else if (loadedData.daily !== undefined) {
          setSizingParams({
            dailyDemand: loadedData.daily ?? 5000,
            storageDays: loadedData.days ?? 1,
            peakFlow: loadedData.peak ?? 40,
            pumpFillRate: loadedData.pump ?? 30,
            safetyFactor: loadedData.safetyFactor ?? 10,
            usableDepth: loadedData.usableDepth ?? 8,
            numCompartments: loadedData.numCompartments ?? 2,
          });
        }
        if (loadedData.unitSystem) setUnitSystem(loadedData.unitSystem);
        if (loadedData.projectInfo) setProjectInfo(loadedData.projectInfo);
        if (loadedData.commentsMap) setCommentsMap(loadedData.commentsMap);
      }

      setLoadedProjectId(pId);
    }
  }, [project?.id, loadedProjectId]);

  // Save changes helper
  const saveState = (
    newParams: TankSizingParams,
    newUnits: "si" | "ip",
    newProjInfo = projectInfo,
    newComments = commentsMap
  ) => {
    const pId = project?.id || "default";
    const dataToSave = {
      sizingParams: newParams,
      unitSystem: newUnits,
      projectInfo: newProjInfo,
      commentsMap: newComments,
      updatedAt: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(`mep_tank_sizing_${pId}`, JSON.stringify(dataToSave));
      localStorage.setItem(`tankSizing_${pId}`, JSON.stringify({
        daily: newParams.dailyDemand,
        days: newParams.storageDays,
        peak: newParams.peakFlow,
        pump: newParams.pumpFillRate,
      }));
    }

    dirtyStore.set(true);
  };

  // Water Demand Import Data Detection
  const waterDemandSummary = useMemo(() => {
    const pId = project?.id || "default";
    try {
      const saved = localStorage.getItem(`mep_water_demand_${pId}`) || localStorage.getItem(`mep_wd_summary_${pId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          available: true,
          dailyLpd: parsed.totalDailyLpd || parsed.totalDailyWaterDemand || 0,
          peakLps: parsed.peakFlowLps || parsed.peakFlowRate || 0,
          source: "Water Demand Calculator",
        };
      }
    } catch (e) {}
    return { available: false, dailyLpd: 0, peakLps: 0, source: "" };
  }, [project]);

  // Unit System Switcher with live metric conversion
  const handleUnitSystemChange = (target: "si" | "ip") => {
    if (target === unitSystem) return;

    const isToSi = target === "si";
    const daily = typeof sizingParams.dailyDemand === "number" ? sizingParams.dailyDemand : 0;
    const peak = typeof sizingParams.peakFlow === "number" ? sizingParams.peakFlow : 0;
    const pump = typeof sizingParams.pumpFillRate === "number" ? sizingParams.pumpFillRate : 0;
    const depth = typeof sizingParams.usableDepth === "number" ? sizingParams.usableDepth : 0;

    let convertedDaily: number | "" = sizingParams.dailyDemand;
    let convertedPeak: number | "" = sizingParams.peakFlow;
    let convertedPump: number | "" = sizingParams.pumpFillRate;
    let convertedDepth: number | "" = sizingParams.usableDepth;

    if (isToSi) {
      // IP (gal, GPM, ft) -> SI (Litres, L/s, m)
      convertedDaily = daily ? Math.round(daily * 3.78541) : "";
      convertedPeak = peak ? Number((peak * 0.06309).toFixed(2)) : "";
      convertedPump = pump ? Number((pump * 0.06309).toFixed(2)) : "";
      convertedDepth = depth ? Number((depth * 0.3048).toFixed(2)) : "";
    } else {
      // SI (Litres, L/s, m) -> IP (gal, GPM, ft)
      convertedDaily = daily ? Math.round(daily / 3.78541) : "";
      convertedPeak = peak ? Number((peak / 0.06309).toFixed(1)) : "";
      convertedPump = pump ? Number((pump / 0.06309).toFixed(1)) : "";
      convertedDepth = depth ? Number((depth / 0.3048).toFixed(1)) : "";
    }

    const updatedParams: TankSizingParams = {
      ...sizingParams,
      dailyDemand: convertedDaily,
      peakFlow: convertedPeak,
      pumpFillRate: convertedPump,
      usableDepth: convertedDepth,
    };

    setUnitSystem(target);
    setSizingParams(updatedParams);
    saveState(updatedParams, target);
    toast.success(`Switched unit system to ${target.toUpperCase()}`);
  };

  // Math Calculations Engine
  const calc = useMemo(() => {
    const isIp = unitSystem === "ip";
    const daily = typeof sizingParams.dailyDemand === "number" ? sizingParams.dailyDemand : 0;
    const days = typeof sizingParams.storageDays === "number" ? sizingParams.storageDays : 0;
    const peak = typeof sizingParams.peakFlow === "number" ? sizingParams.peakFlow : 0;
    const pump = typeof sizingParams.pumpFillRate === "number" ? sizingParams.pumpFillRate : 0;
    const safetyPct = typeof sizingParams.safetyFactor === "number" ? sizingParams.safetyFactor : 0;
    const depth = typeof sizingParams.usableDepth === "number" ? sizingParams.usableDepth : (isIp ? 8 : 2.5);
    const comps = sizingParams.numCompartments || 2;

    // 1. Consumption Storage
    const storageDemandVol = daily * days; // gal or Litres

    // 2. Break Tank / Buffer (30 minutes peak surge flow)
    // In IP: Peak is GPM -> 30 mins = Peak * 30 gal
    // In SI: Peak is L/s -> 30 mins (1800 s) = Peak * 1800 Litres
    const peakSurgeVol = isIp ? peak * 30 : peak * 1800;

    // 3. Base Capacity
    const baseCapacity = Math.max(storageDemandVol, peakSurgeVol);

    // 4. Safety Margin
    const safetyMarginVol = baseCapacity * (safetyPct / 100);
    const recommendedCapacity = Math.round(baseCapacity + safetyMarginVol);

    // Dual Unit Conversions
    const capacityGal = isIp ? recommendedCapacity : Math.round(recommendedCapacity / 3.78541);
    const capacityLitres = isIp ? Math.round(recommendedCapacity * 3.78541) : recommendedCapacity;
    const capacityM3 = Number((capacityLitres / 1000).toFixed(2));
    const capacityFt3 = Number((capacityGal / 7.48052).toFixed(1));

    // Refill / Pump Inflow Calculations
    // In IP: pump is GPM -> fill minutes = recommended / pump
    // In SI: pump is L/s -> fill minutes = (recommended / pump) / 60
    let fillTimeMinutes = 0;
    if (pump > 0) {
      fillTimeMinutes = isIp ? recommendedCapacity / pump : (recommendedCapacity / pump) / 60;
    }
    const fillTimeHours = Number((fillTimeMinutes / 60).toFixed(2));

    // Compartment Split
    const perCompartmentVol = Math.round(recommendedCapacity / comps);
    const perCompartmentM3 = Number((capacityM3 / comps).toFixed(2));
    const perCompartmentGal = Math.round(capacityGal / comps);

    // Suggested Physical Tank Footprint (Aspect Ratio ~ 2:1 Rectangular)
    const effectiveDepth = depth > 0 ? depth : (isIp ? 8 : 2.5);
    let floorArea = 0;
    let tankLength = 0;
    let tankWidth = 0;

    if (isIp) {
      floorArea = capacityFt3 / effectiveDepth;
      tankWidth = Math.sqrt(floorArea / 2);
      tankLength = tankWidth * 2;
    } else {
      floorArea = capacityM3 / effectiveDepth;
      tankWidth = Math.sqrt(floorArea / 2);
      tankLength = tankWidth * 2;
    }

    return {
      isIp,
      volUnit: isIp ? "gal" : "L",
      volUnitAlt: isIp ? "m³" : "gal",
      flowUnit: isIp ? "GPM" : "L/s",
      dimUnit: isIp ? "ft" : "m",
      areaUnit: isIp ? "sq.ft" : "m²",
      storageDemandVol,
      peakSurgeVol,
      baseCapacity,
      safetyMarginVol,
      recommendedCapacity,
      capacityGal,
      capacityLitres,
      capacityM3,
      capacityFt3,
      fillTimeMinutes: Number(fillTimeMinutes.toFixed(1)),
      fillTimeHours,
      perCompartmentVol,
      perCompartmentM3,
      perCompartmentGal,
      comps,
      effectiveDepth,
      floorArea: Number(floorArea.toFixed(1)),
      tankLength: Number(tankLength.toFixed(2)),
      tankWidth: Number(tankWidth.toFixed(2)),
    };
  }, [sizingParams, unitSystem]);

  // Handle Input Changes
  const handleInputChange = (field: keyof TankSizingParams, value: any) => {
    let parsed: any = value;
    if (value === "") {
      parsed = "";
    } else {
      const num = parseFloat(value);
      parsed = isNaN(num) ? "" : num;
    }

    const updated = { ...sizingParams, [field]: parsed };
    setSizingParams(updated);
    saveState(updated, unitSystem);
  };

  // Context Menu Helpers
  const handleCopyLine = (label: string, val: any, unit: string) => {
    const text = `${label}: ${val} ${unit}`;
    navigator.clipboard.writeText(text);
    toast.success(`Copied to clipboard: "${text}"`);
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
      targetLabel: activeCommentTarget.label,
      createdAt: commentData.timestamp || new Date().toISOString(),
    } : {
      id: `comment_${Date.now()}`,
      text: String(commentData),
      targetId,
      targetName: activeCommentTarget.label,
      targetLabel: activeCommentTarget.label,
      createdAt: new Date().toISOString(),
    };
    const updated = { ...commentsMap, [targetId]: [...existing, newComment] };
    setCommentsMap(updated);
    saveState(sizingParams, unitSystem, projectInfo, updated);
    setActiveCommentTarget(null);
    toast.success(`Comment / Task assigned successfully!`);
  };

  // Flatten comments list for counter badge
  const commentsList = useMemo(() => {
    const list: any[] = [];
    Object.values(commentsMap).forEach((arr) => {
      if (Array.isArray(arr)) list.push(...arr);
    });
    return list;
  }, [commentsMap]);

  // Reusable Parameter Input Tile
  const renderInputBox = (
    id: string,
    field: keyof TankSizingParams,
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
              min={min}
              step={step}
              placeholder={placeholder}
              value={value === "" ? "" : value}
              onChange={(e) => handleInputChange(field, e.target.value)}
              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal transition hover:border-[#0A7BC7]/50"
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => handleCopyLine(label, value, unit)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Parameter</span>
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

  // PDF Export matching Smoke Ventilation Report format & UI colors
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("portrait", "mm", "a4");

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        }
      };

      const calcNo = (project as any)?.calcNo || "TRV-CAL-TK-001";
      const today = projectInfo.date || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || projectInfo.projectName || "";
      const clientName = (project as any)?.client || "";
      const endUser = (project as any)?.endUser || (project as any)?.location || "";

      // Header Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Domestic Water Tank Sizing Calculation Report", 14, 14);

      // Metadata Block (182mm width: left 14mm to right 196mm)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.rect(14, 18, 182, 18);

      // Vertical line to separate left/right metadata
      doc.line(105, 18, 105, 36);

      // Horizontal lines
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

      // Smoke Ventilation UI Color Palette
      const primaryFill = [217, 217, 217] as [number, number, number]; // Light gray header
      const blueFill = [218, 233, 248] as [number, number, number];    // Soft blue highlight header
      const blueBodyFill = [242, 248, 253] as [number, number, number]; // Soft blue highlight row/cell

      // Section 1: Water Demand & Inflow Rates
      let currentY = 42;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("1. Input Parameters & Demand Criteria", 14, currentY);
      currentY += 3;

      const inputTableBody = [
        ["1", "Daily Water Consumption Demand", `${sizingParams.dailyDemand}`, calc.volUnit, "Daily Occupancy / Fixture Load Demand"],
        ["2", "Storage Autonomy Duration", `${sizingParams.storageDays} days`, "days", "Continuous uninterrupted supply autonomy"],
        ["3", "Peak Fixture Demand Flow Rate", `${sizingParams.peakFlow}`, calc.flowUnit, "Peak instantaneous plumbing fixture draw"],
        ["4", "Pump Inflow / Municipal Refill Rate", `${sizingParams.pumpFillRate}`, calc.flowUnit, "Available water main refill capacity"],
        ["5", "Safety / Freeboard Margin Allowance", `${sizingParams.safetyFactor} %`, "%", "Freeboard, sludge zone & surge buffer reserve"],
        ["6", "Usable Water Depth", `${sizingParams.usableDepth}`, calc.dimUnit, "Effective water depth below overflow level"],
        ["7", "Compartments / Maintenance Division", `${sizingParams.numCompartments} Cell(s)`, "-", "IPC 606.5 / BS EN 806 online cleaning split"]
      ];

      callAutoTable(doc, {
        startY: currentY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 },
          minCellHeight: 6
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 }
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 70, fontStyle: "bold" },
          2: { cellWidth: 36, fontStyle: "bold" },
          3: { cellWidth: 20 },
          4: { halign: "left", cellWidth: 46 }
        },
        head: [
          [
            { content: "No.", styles: { fillColor: primaryFill } },
            { content: "Design Parameter Description", styles: { fillColor: primaryFill } },
            { content: "Value", styles: { fillColor: primaryFill } },
            { content: "Unit", styles: { fillColor: primaryFill } },
            { content: "Standard / Code Reference", styles: { fillColor: primaryFill } }
          ]
        ],
        body: inputTableBody
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 110;
      nextY += 7;

      // Section 2: Capacity & Storage Sizing Results
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("2. Storage Sizing & Capacity Results", 14, nextY);
      nextY += 3;

      const resultsTableBody = [
        ["A", "RECOMMENDED USABLE TANK CAPACITY", `${calc.recommendedCapacity.toLocaleString()} ${calc.volUnit}`, "Max(Storage Demand, Break Surge) × (1 + Safety Margin)"],
        ["B", "Capacity in Alternate Standard Units", `${calc.capacityM3} m³ / ${calc.capacityGal.toLocaleString()} US gal`, "Volumetric standard conversion equivalent"],
        ["C", "Consumption Storage Demand Volume", `${calc.storageDemandVol.toLocaleString()} ${calc.volUnit}`, "Daily Demand × Autonomy Days"],
        ["D", "Break Tank 30-min Surge Buffer", `${calc.peakSurgeVol.toLocaleString()} ${calc.volUnit}`, "Peak Fixture Flow × 30 minutes continuous surge"],
        ["E", "Safety Margin Volume Added", `+${calc.safetyMarginVol.toLocaleString()} ${calc.volUnit}`, `${sizingParams.safetyFactor}% allowance added`],
        ["F", "Per Compartment Storage Volume", `${calc.perCompartmentVol.toLocaleString()} ${calc.volUnit} (${calc.perCompartmentM3} m³) / cell`, `${calc.comps} equal maintenance cells`],
        ["G", "Pump Refill Duration", `${calc.fillTimeHours} hrs (${calc.fillTimeMinutes} mins)`, "Total Usable Capacity / Pump Inflow Rate"],
        ["H", "Suggested Plan Footprint Dimensions", `${calc.tankLength} m × ${calc.tankWidth} m (Area: ${calc.floorArea} ${calc.areaUnit})`, "Rectangular configuration (effective depth: " + calc.effectiveDepth + " " + calc.dimUnit + ")"]
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
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 },
          minCellHeight: 6
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 70, fontStyle: "bold" },
          2: { cellWidth: 46, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 56 }
        },
        head: [
          [
            { content: "Item", styles: { fillColor: primaryFill } },
            { content: "Sizing Output Parameter", styles: { fillColor: primaryFill } },
            { content: "Calculated Value", styles: { fillColor: blueFill } },
            { content: "Engineering Basis & Formula", styles: { fillColor: primaryFill } }
          ]
        ],
        body: resultsTableBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            // Highlight row A (Recommended Usable Capacity) and F (Per Cell) in blueFill
            if (data.row.index === 0 || data.row.index === 5) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = blueFill;
              if (data.column.index === 2) {
                data.cell.styles.fontSize = 8.5;
              }
            }
          }
        }
      });

      let sigFinalY = (doc as any).lastAutoTable?.finalY ?? 180;
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
      } = getSignatureBlockDetails(project?.id || "default", "/plumbing-tank-sizing", currentUserName);

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
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName, styles: { halign: "center" } },
            { content: reviewerName, styles: { halign: "center" } },
            { content: approverName, styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate, styles: { halign: "center" } },
            { content: reviewerDate, styles: { halign: "center" } },
            { content: approverDate, styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 }
        }
      });

      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), `Water_Tank_Sizing_${project?.code || "CALC"}.pdf`, "PDF Document", ["pdf"]);
      toast.success("Domestic Water Tank PDF Report generated successfully!");
    } catch (err: any) {
      console.error("handleExportPDF error:", err);
      toast.error(`Export PDF failed: ${err?.message || String(err)}`);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    const data = [
      { Parameter: "Daily Water Demand", Value: sizingParams.dailyDemand, Unit: calc.volUnit, Formula: "User Input" },
      { Parameter: "Storage Duration", Value: sizingParams.storageDays, Unit: "days", Formula: "User Input" },
      { Parameter: "Consumption Storage Volume", Value: calc.storageDemandVol, Unit: calc.volUnit, Formula: "Daily Demand × Days" },
      { Parameter: "Peak Instantaneous Flow Rate", Value: sizingParams.peakFlow, Unit: calc.flowUnit, Formula: "User Input" },
      { Parameter: "Break Tank Buffer (30-min peak)", Value: calc.peakSurgeVol, Unit: calc.volUnit, Formula: "Peak Flow × 30 min" },
      { Parameter: "Safety Margin", Value: sizingParams.safetyFactor, Unit: "%", Formula: "User Input" },
      { Parameter: "Recommended Usable Tank Capacity", Value: calc.recommendedCapacity, Unit: calc.volUnit, Formula: "Max(Storage, Break) × (1 + Safety)" },
      { Parameter: "Capacity (Metric m³)", Value: calc.capacityM3, Unit: "m³", Formula: "Litres / 1000" },
      { Parameter: "Capacity (US Gallons)", Value: calc.capacityGal, Unit: "gal", Formula: "Converted" },
      { Parameter: "Number of Compartments", Value: calc.comps, Unit: "cells", Formula: "Maintenance Split" },
      { Parameter: "Capacity per Cell", Value: calc.perCompartmentVol, Unit: calc.volUnit, Formula: "Total Capacity / Cells" },
      { Parameter: "Pump Inflow Refill Rate", Value: sizingParams.pumpFillRate, Unit: calc.flowUnit, Formula: "User Input" },
      { Parameter: "Tank Refill Duration", Value: calc.fillTimeHours, Unit: "hours", Formula: "Capacity / Pump Refill Rate" },
      { Parameter: "Refill Duration (Minutes)", Value: calc.fillTimeMinutes, Unit: "min", Formula: "Capacity / Pump Rate" },
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tank Sizing");
    const xlsxBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    downloadFile(new Uint8Array(xlsxBuffer), `Water_Tank_Sizing_${project?.code || "CALC"}.xlsx`, "Excel Document", ["xlsx"]);
    toast.success("Excel Spreadsheet generated successfully!");
  };

  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);

  return (
    <AppShell 
      title="Domestic Water Tank Sizing" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-3 overflow-y-auto h-full pb-4">
          
          {/* Page Header matching FM-200 Gas Sizing */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-foreground">Tank Sizing</h1>
                <span className="text-[13.5px] font-semibold text-muted-foreground">Domestic & Potable Water Storage (IPC / BS EN 806)</span>
              </div>
              <button 
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-tank-sizing" calculatorTitle="Tank Sizing" />
              {commentsList.length > 0 && (
                <div 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-2xs"
                  title={`${commentsList.length} active comment(s)/task(s) in Tank Sizing`}
                >
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"} / Comment{commentsList.length === 1 ? "" : "s"}</span>
                </div>
              )}
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className="flex-1 flex flex-col min-h-[420px] overflow-hidden rounded-2xl bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="flex bg-surface-2 p-0.5 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sizing Calculator
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
                  className="px-2.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shadow-2xs"
                  title="View Water Tank Formula Breakdown"
                >
                  <Info className="size-3 text-primary" />
                  <span>Formula Breakdown</span>
                </button>
              </div>

              {/* Sizing Unit system toggle & Top Export Action */}
              <div className="flex items-center gap-2 flex-wrap">
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  inputDescriptions="Daily Demand, Peak & Refill Rates, Tank Depths"
                  conversionExample={
                    unitSystem === "si"
                      ? "Convert 20,000 L → 5,283 gal, 2.5 m → 8.2 ft"
                      : "Convert 5,000 gal → 18,927 L, 8 ft → 2.44 m"
                  }
                />

                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="h-7.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 hover:bg-primary/90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                  title="Export calculation report"
                >
                  <Printer className="size-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5 md:p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full items-start">
                    
                    {/* Inputs Column (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col gap-3.5 w-full">
                      
                      {/* Card 1: Water Demand & Inflow Rates */}
                      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                              1. Water Demand & Inflow Rates
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {waterDemandSummary.available && (
                              <button
                                type="button"
                                onClick={() => {
                                  const targetDaily = unitSystem === "si" 
                                    ? Math.round(waterDemandSummary.dailyLpd) 
                                    : Math.round(waterDemandSummary.dailyLpd / 3.78541);
                                  const targetPeak = unitSystem === "si"
                                    ? Number(waterDemandSummary.peakLps.toFixed(2))
                                    : Number((waterDemandSummary.peakLps / 0.06309).toFixed(1));
                                  const next = { ...sizingParams, dailyDemand: targetDaily, peakFlow: targetPeak };
                                  setSizingParams(next);
                                  saveState(next, unitSystem);
                                  toast.success(`Imported ${targetDaily.toLocaleString()} ${calc.volUnit} daily demand from Water Demand Calculator`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/40 border border-emerald-500/25 rounded-md transition shadow-2xs cursor-pointer"
                                title="Import total estimated daily demand from Water Demand Module"
                              >
                                <Sparkles className="size-2.5 text-emerald-500" />
                                <span>Import Demand</span>
                              </button>
                            )}
                            <span className="text-[10.5px] font-mono text-muted-foreground">Demand & Inflow</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          {/* Daily Demand */}
                          {renderInputBox(
                            "tank-daily-demand",
                            "dailyDemand",
                            "Daily Water Consumption Demand",
                            sizingParams.dailyDemand,
                            calc.volUnit,
                            "100",
                            0,
                            unitSystem === "ip" ? "5000" : "20000"
                          )}

                          {/* 2-Column Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {renderInputBox(
                              "tank-storage-days",
                              "storageDays",
                              "Autonomy Duration",
                              sizingParams.storageDays,
                              "days",
                              "0.5",
                              0.5,
                              "1"
                            )}
                            {renderInputBox(
                              "tank-peak-flow",
                              "peakFlow",
                              "Peak Fixture Flow Rate",
                              sizingParams.peakFlow,
                              calc.flowUnit,
                              "1",
                              0,
                              unitSystem === "ip" ? "40" : "2.5"
                            )}
                            {renderInputBox(
                              "tank-pump-refill",
                              "pumpFillRate",
                              "Pump Inflow / Refill Rate",
                              sizingParams.pumpFillRate,
                              calc.flowUnit,
                              "1",
                              0,
                              unitSystem === "ip" ? "30" : "2.0"
                            )}
                            {renderInputBox(
                              "tank-safety-factor",
                              "safetyFactor",
                              "Safety / Freeboard Margin",
                              sizingParams.safetyFactor,
                              "%",
                              "1",
                              0,
                              "10"
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Physical Geometry & Compartments */}
                      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                              2. Physical Geometry & Redundancy
                            </h3>
                          </div>
                          <span className="text-[10.5px] font-mono text-muted-foreground">Dimensions</span>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {renderInputBox(
                              "tank-usable-depth",
                              "usableDepth",
                              "Usable Water Depth",
                              sizingParams.usableDepth,
                              calc.dimUnit,
                              "0.1",
                              0.5,
                              unitSystem === "ip" ? "8" : "2.5"
                            )}

                            <div className="flex flex-col gap-1.5 group p-1.5 rounded-xl">
                              <label className="font-semibold text-foreground text-xs">
                                Maintenance Compartments
                              </label>
                              <select
                                value={sizingParams.numCompartments}
                                onChange={(e) => handleInputChange("numCompartments", parseInt(e.target.value) || 2)}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none transition hover:border-[#0A7BC7]/50 cursor-pointer"
                              >
                                <option value={1}>1 Single Cell (100%)</option>
                                <option value={2}>2 Cells (50%/50% - Recommended)</option>
                                <option value={3}>3 Cells (33% each)</option>
                                <option value={4}>4 Cells (25% each)</option>
                              </select>
                            </div>
                          </div>

                          <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 text-[10.5px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                            <Info className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              <strong>IPC / BS EN 806:</strong> Dual 50% compartments allow full online cleaning & disinfection without disrupting building supply.
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Results Column (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col gap-3.5 w-full">
                      
                      {/* Calculation Results Card */}
                      <div className="border border-border rounded-2xl bg-background p-3.5 shadow-xs flex flex-col gap-2.5">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <div>
                            <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-foreground">
                              Calculation Results
                            </h3>
                            <span className="text-[10.5px] text-muted-foreground">Storage Capacity & Physical Footprint</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            BS EN 806 / IPC
                          </span>
                        </div>

                        {/* Usable Capacity Result */}
                        <div className="border border-border rounded-xl bg-background p-3 flex flex-col gap-0.5 shadow-2xs border-l-4 border-l-primary">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Recommended Usable Capacity
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowFormulaModal(true)}
                              className="size-4.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors cursor-pointer"
                              title="View Formula Breakdown"
                            >
                              <Info className="size-2.5" />
                            </button>
                          </div>
                          <div className="text-[22px] sm:text-[24px] font-bold tracking-tight font-mono text-primary">
                            {calc.recommendedCapacity.toLocaleString()} <span className="text-[13.5px] font-normal">{calc.volUnit}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5 text-[10.5px] text-muted-foreground font-mono">
                            <span>{calc.capacityM3} m³ • {calc.capacityGal.toLocaleString()} US gal</span>
                            <button
                              type="button"
                              onClick={() => setShowFormulaModal(true)}
                              className="text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Breakdown</span>
                              <Info className="size-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Secondary Metrics */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-xl bg-surface-2 border border-border flex flex-col gap-0.5">
                            <span className="text-[9.5px] font-bold uppercase text-muted-foreground">Consumption Demand</span>
                            <span className="font-mono text-[13px] font-bold text-foreground">
                              {calc.storageDemandVol.toLocaleString()} {calc.volUnit}
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">{sizingParams.storageDays} Day(s)</span>
                          </div>

                          <div className="p-2 rounded-xl bg-surface-2 border border-border flex flex-col gap-0.5">
                            <span className="text-[9.5px] font-bold uppercase text-muted-foreground">Break Buffer</span>
                            <span className="font-mono text-[13px] font-bold text-foreground">
                              {calc.peakSurgeVol.toLocaleString()} {calc.volUnit}
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">30-min Surge</span>
                          </div>

                          <div className="p-2 rounded-xl bg-surface-2 border border-border flex flex-col gap-0.5">
                            <span className="text-[9.5px] font-bold uppercase text-muted-foreground">Per Cell Size</span>
                            <span className="font-mono text-[13px] font-bold text-foreground">
                              {calc.perCompartmentVol.toLocaleString()} {calc.volUnit}
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">{calc.comps} Cells ({calc.perCompartmentM3} m³)</span>
                          </div>

                          <div className="p-2 rounded-xl bg-surface-2 border border-border flex flex-col gap-0.5">
                            <span className="text-[9.5px] font-bold uppercase text-muted-foreground">Pump Refill</span>
                            <span className="font-mono text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                              {calc.fillTimeHours} hrs
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">{calc.fillTimeMinutes} mins total</span>
                          </div>
                        </div>

                        {/* Sizing Chart Schematic */}
                        <div className="border border-border rounded-xl bg-background p-2.5 shadow-2xs flex flex-col gap-1.5">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Tank Allocation & Footprint
                          </span>
                          <div className="bg-surface/50 rounded-lg flex flex-col items-center justify-center p-2 border border-border/50 gap-1.5">
                            <div className="flex justify-between w-full text-[10.5px] font-semibold text-muted-foreground px-0.5">
                              <span>Dimensions: {calc.tankLength} × {calc.tankWidth} × {calc.effectiveDepth} {calc.dimUnit}</span>
                              <span>Area: {calc.floorArea} {calc.areaUnit}</span>
                            </div>
                            {/* Compartment cells */}
                            <div className="grid grid-cols-2 gap-1.5 w-full pt-0.5">
                              {Array.from({ length: calc.comps }).map((_, i) => (
                                <div
                                  key={i}
                                  className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col items-center text-center gap-0.5"
                                >
                                  <span className="text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Cell {i + 1} ({(100 / calc.comps).toFixed(0)}%)</span>
                                  <span className="text-[11.5px] font-mono font-bold text-foreground">{calc.perCompartmentVol.toLocaleString()} {calc.volUnit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Report */}
              {tab === "report" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-surface/30">
                  <div className="max-w-5xl mx-auto flex flex-col gap-6">
                    <div className="border border-border rounded-3xl bg-background p-6 flex flex-col gap-5 shadow-sm">
                      <div className="flex justify-between items-start border-b border-border pb-4">
                        <div>
                          <h2 className="text-[16px] font-bold text-foreground">Domestic Water Tank Sizing Sheet</h2>
                          <p className="text-[12px] text-muted-foreground mt-0.5">Calculated parameters for potable water storage and surge reserve</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleExportPDF}
                            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/95 transition-colors cursor-pointer shadow-sm"
                          >
                            <Printer className="size-3.5" /> Export
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] border-b border-border pb-5">
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Project Name</span>
                          <span className="font-semibold text-foreground">{project?.name || "Default Project"}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Project Code</span>
                          <span className="font-semibold font-mono text-foreground">{project?.code || "PROJ"}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Daily Demand</span>
                          <span className="font-semibold text-foreground">
                            {sizingParams.dailyDemand.toLocaleString()} {calc.volUnit} / day
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Storage Autonomy</span>
                          <span className="font-semibold text-foreground">{sizingParams.storageDays} Day(s)</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Recommended Usable Capacity</span>
                          <span className="font-semibold text-primary">
                            {calc.recommendedCapacity.toLocaleString()} {calc.volUnit} ({calc.capacityM3} m³)
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Per Cell Allocation ({calc.comps} Cells)</span>
                          <span className="font-semibold text-foreground">
                            {calc.perCompartmentVol.toLocaleString()} {calc.volUnit} / cell
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Pump Refill Duration</span>
                          <span className="font-semibold text-foreground">{calc.fillTimeHours} hrs ({calc.fillTimeMinutes} mins)</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Estimated Footprint</span>
                          <span className="font-semibold text-foreground">{calc.tankLength} × {calc.tankWidth} × {calc.effectiveDepth} {calc.dimUnit}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Formula & Step-by-Step Breakdown Modal */}
          {showFormulaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Droplets className="size-5 text-[#0A7BC7]" />
                    <h2 className="text-lg font-bold text-foreground">Tank Sizing Formulas & Derivations</h2>
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
                    <h4 className="font-bold text-foreground text-sm mb-1">1. Storage Demand Method</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      V_storage = Q_daily × T_duration
                    </p>
                    <p>
                      Calculated: {sizingParams.dailyDemand} × {sizingParams.storageDays} = <strong>{calc.storageDemandVol.toLocaleString()} {calc.volUnit}</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">2. Break Tank (Peak Surge Buffer)</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      V_break = Q_peak × 30 minutes
                    </p>
                    <p>
                      Calculated: <strong>{calc.peakSurgeVol.toLocaleString()} {calc.volUnit}</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">3. Total Recommended Capacity</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      V_rec = Max(V_storage, V_break) × (1 + Safety Margin)
                    </p>
                    <p>
                      Calculated: Max({calc.storageDemandVol}, {calc.peakSurgeVol}) × (1 + {sizingParams.safetyFactor}%) = <strong>{calc.recommendedCapacity.toLocaleString()} {calc.volUnit} ({calc.capacityM3} m³)</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">4. Refill Inflow Duration</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      T_refill = V_rec / Q_pump
                    </p>
                    <p>
                      Calculated: <strong>{calc.fillTimeHours} hours ({calc.fillTimeMinutes} minutes)</strong>
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
              targetLabel={activeCommentTarget.label}
              calculatorPath="/plumbing-tank-sizing"
              calculatorTitle="Water Tank Sizing"
              existingComments={commentsMap[activeCommentTarget.id] || []}
              onClose={() => setActiveCommentTarget(null)}
              onSave={handleSaveComment}
              onCommentAdded={handleSaveComment}
            />
          )}

        </div>
      </div>
    </AppShell>
  );
}
