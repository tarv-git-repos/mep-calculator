import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle,
  Save, FolderOpen, ChevronDown, ChevronUp, Trash2, Copy, Clipboard,
  RotateCcw, MessageSquare, Edit3, FileText, CheckCircle2, Sparkles,
  Download, Upload, Gauge, Layers, Zap, Flame, X, ArrowRight, Check,
  Droplet, Droplets, Box, Building2, ShieldCheck, Home, Utensils,
  GraduationCap, Hotel, Activity, ShieldAlert
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import {
  type TankSizingParams,
  type TankPresetKey,
  type TankPresetConfig,
  SI_PRESETS,
  computeTankSizingCalculations
} from "@/lib/calc-plumbing-tank-sizing";

import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  CalculationReviewBar,
  CalculationStatusBanner,
  useCalculationEffectiveReadOnly,
  useCalculationReviewState,
  type CalculationReviewState
} from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";

export const Route = createFileRoute("/plumbing-tank-sizing")({
  head: () => ({
    meta: [
      { title: "Domestic Water Tank Sizing Calculator — MEP Calc" },
      { name: "description", content: "Size domestic and potable water storage tanks, break buffers, compartment splits, and pump refill rates per IPC Chapter 6 & BS EN 806." },
    ],
  }),
  component: TankSizingPage,
});

function TankSizingPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-tank-sizing", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-tank-sizing", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [preset, setPreset] = useState<TankPresetKey>("residential_apartment");

  // Core Sizing Parameters
  const [sizingParams, setSizingParams] = useState<TankSizingParams>({
    dailyDemand: 5000, // Litres or Gal
    storageDays: 1, // days
    peakFlow: 40, // L/s or GPM
    pumpFillRate: 30, // L/s or GPM
    safetyFactor: 10, // %
    usableDepth: 8, // m or ft
    numCompartments: 2, // 2-cell redundancy standard
  });

  // Modal and Navigation States
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

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
        if (loadedData.preset) setPreset(loadedData.preset);
        if (loadedData.commentsMap) setCommentsMap(loadedData.commentsMap);
      }

      setLoadedProjectId(pId);
    }
  }, [project?.id, loadedProjectId]);

  // Save changes helper
  const saveState = (
    newParams: TankSizingParams,
    newUnits: "si" | "ip",
    newPreset: TankPresetKey = preset,
    newComments = commentsMap
  ) => {
    const pId = project?.id || "default";
    const dataToSave = {
      sizingParams: newParams,
      unitSystem: newUnits,
      preset: newPreset,
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
    saveState(updatedParams, target, preset);
    toast.success(`Switched unit system to ${target.toUpperCase()}`);
  };

  // Apply Building Preset
  const handleApplyPreset = (presetKey: TankPresetKey) => {
    const pConfig = SI_PRESETS[presetKey];
    if (!pConfig) return;

    const isIp = unitSystem === "ip";
    let newDaily = pConfig.dailyDemand;
    let newPeak = pConfig.peakFlow;
    let newPump = pConfig.pumpFillRate;
    let newDepth = pConfig.usableDepth;

    if (isIp) {
      newDaily = Math.round(pConfig.dailyDemand / 3.78541);
      newPeak = Number((pConfig.peakFlow / 0.06309).toFixed(1));
      newPump = Number((pConfig.pumpFillRate / 0.06309).toFixed(1));
      newDepth = Number((pConfig.usableDepth / 0.3048).toFixed(1));
    }

    const updated: TankSizingParams = {
      dailyDemand: newDaily,
      storageDays: pConfig.storageDays,
      peakFlow: newPeak,
      pumpFillRate: newPump,
      safetyFactor: pConfig.safetyFactor,
      usableDepth: newDepth,
      numCompartments: pConfig.numCompartments,
    };

    setPreset(presetKey);
    setSizingParams(updated);
    saveState(updated, unitSystem, presetKey);
    toast.success(`Applied ${pConfig.label} preset`);
  };

  // Math Calculations Engine
  const calc = useMemo(() => {
    return computeTankSizingCalculations(sizingParams, unitSystem);
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
    saveState(updated, unitSystem, preset);
  };

  // Clipboard copy helper
  const copyToClipboard = (text: any) => {
    navigator.clipboard.writeText(String(text));
    toast.success(`Copied "${text}" to clipboard`);
  };

  // Comment Save Handler
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
    saveState(sizingParams, unitSystem, preset, updated);
    setActiveCommentTarget(null);
    toast.success(`Comment / Task assigned successfully!`);
  };

  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono text-xs text-foreground focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground";
  const flowInputClass = "w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground";
  const selectClass = "w-full h-8 pl-2.5 pr-7 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-xs text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground";

  const isFieldHighlighted = (id: string, name?: string) => {
    if (!highlightedTargetId) return "";
    const target = highlightedTargetId.toLowerCase();
    if (target === id.toLowerCase() || (name && target === name.toLowerCase())) {
      return "ring-2 ring-primary bg-blue-50/50 dark:bg-blue-950/40";
    }
    return "";
  };

  const renderCommentBadge = (id: string, name: string) => {
    const count = (commentsMap[id] || []).length;
    if (count === 0) return null;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setActiveCommentTarget({ id, label: name });
        }}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline ml-1.5 cursor-pointer"
      >
        <MessageSquare className="size-3 fill-primary/20" />
        <span>{count}</span>
      </button>
    );
  };

  // Preliminary Engineering Report Standard PDF Export
  const exportPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const primaryFill = [217, 217, 217] as [number, number, number];
      const blueFill = [218, 233, 248] as [number, number, number];

      const callAutoTable = (autoTable as any).default || autoTable;

      const calcNo = `CALC-TNK-${project?.code || "001"}`;
      const projectNo = project?.code || "PRJ-001";
      const projectName = project?.name || "Domestic Water Storage Facility Project";
      const clientName = (project as any)?.client || "Client Representative";
      const endUser = (project as any)?.endUser || "Building Facilities / MEP Department";
      const today = formatDateStr(new Date().toISOString());

      // Document Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("DOMESTIC WATER TANK SIZING PRELIMINARY REPORT", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Design Standards: IPC Chapter 6 / BS EN 806 / ASPE Potable Water Storage", 14, 20);

      doc.setFont("helvetica", "bold");
      doc.text(`Date: ${today}`, 196, 20, { align: "right" });

      let currentY = 24;

      // Metadata Enclosed Grid
      callAutoTable(doc, {
        startY: currentY,
        head: [],
        body: [
          [
            { content: "Calculation No.:", styles: { fontStyle: "bold", cellWidth: 32 } },
            { content: calcNo, styles: { cellWidth: 60 } },
            { content: "Date:", styles: { fontStyle: "bold", cellWidth: 32 } },
            { content: today, styles: { cellWidth: 58 } },
          ],
          [
            { content: "Project No.:", styles: { fontStyle: "bold" } },
            { content: projectNo },
            { content: "Client:", styles: { fontStyle: "bold" } },
            { content: clientName },
          ],
          [
            { content: "Project Name:", styles: { fontStyle: "bold" } },
            { content: projectName },
            { content: "End User:", styles: { fontStyle: "bold" } },
            { content: endUser },
          ],
        ],
        theme: "grid",
        styles: { fontSize: 8, textColor: [40, 40, 40], cellPadding: 2 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });

      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 48;

      // Section 1: Design Parameters & Consumption Criteria
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text("1. Input Parameters & Demand Criteria", 14, currentY);

      const paramTableBody = [
        ["1", "Daily Water Consumption Demand", `${sizingParams.dailyDemand} ${calc.volUnit}`, calc.isIp ? `${(Number(sizingParams.dailyDemand) * 3.78541).toFixed(0)} L` : `${(Number(sizingParams.dailyDemand) / 3.78541).toFixed(0)} gal`, "Daily Occupancy / Plumbing Load Demand"],
        ["2", "Storage Autonomy Duration", `${sizingParams.storageDays} Day(s)`, `${(Number(sizingParams.storageDays) * 24).toFixed(0)} Hours`, "Continuous uninterrupted supply autonomy"],
        ["3", "Peak Fixture Demand Flow Rate", `${sizingParams.peakFlow} ${calc.flowUnit}`, calc.isIp ? `${(Number(sizingParams.peakFlow) * 0.06309).toFixed(2)} L/s` : `${(Number(sizingParams.peakFlow) / 0.06309).toFixed(1)} GPM`, "Peak instantaneous fixture demand draw"],
        ["4", "Pump Inflow / Refill Rate", `${sizingParams.pumpFillRate} ${calc.flowUnit}`, calc.isIp ? `${(Number(sizingParams.pumpFillRate) * 0.06309).toFixed(2)} L/s` : `${(Number(sizingParams.pumpFillRate) / 0.06309).toFixed(1)} GPM`, "Available municipal / transfer refill rate"],
        ["5", "Safety / Freeboard Margin Allowance", `${sizingParams.safetyFactor} %`, `+${calc.safetyMarginVol.toLocaleString()} ${calc.volUnit}`, "Freeboard, air gap & surge reserve"],
        ["6", "Usable Water Depth", `${sizingParams.usableDepth} ${calc.dimUnit}`, calc.isIp ? `${(Number(sizingParams.usableDepth) * 0.3048).toFixed(2)} m` : `${(Number(sizingParams.usableDepth) / 0.3048).toFixed(1)} ft`, "Effective water depth below overflow"],
        ["7", "Compartment Maintenance Division", `${sizingParams.numCompartments} Cell(s)`, `${(100 / (sizingParams.numCompartments || 2)).toFixed(0)}% per cell`, "IPC 606.5 / BS EN 806 online cleaning"],
      ];

      callAutoTable(doc, {
        startY: currentY + 2.5,
        head: [["Sr.", "Parameter Description", "Design Value", "Equivalent", "Standard / Code Reference"]],
        body: paramTableBody,
        theme: "grid",
        headStyles: {
          fillColor: primaryFill,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "center",
        },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 56, fontStyle: "bold" },
          2: { cellWidth: 36, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 32, halign: "center" },
          4: { cellWidth: 48, halign: "left" },
        },
      });

      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 100;

      // Section 2: Storage Sizing & Capacity Results
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text("2. Storage Sizing & Capacity Evaluation", 14, currentY);

      const resultsTableBody = [
        ["1", "RECOMMENDED USABLE CAPACITY", `${calc.recommendedCapacity.toLocaleString()} ${calc.volUnit}`, "Storage Sizing", "Max(Storage Demand, Break Surge) × (1 + Safety)"],
        ["2", "Volumetric Standard Equivalence", `${calc.capacityM3} m³ (${calc.capacityGal.toLocaleString()} US gal)`, "Equivalent", "Metric & Imperial standard conversions"],
        ["3", "Consumption Storage Demand", `${calc.storageDemandVol.toLocaleString()} ${calc.volUnit}`, "Demand", "Daily Demand × Autonomy Days"],
        ["4", "Break Tank 30-min Surge Buffer", `${calc.peakSurgeVol.toLocaleString()} ${calc.volUnit}`, "Buffer", "Peak Flow × 30-min continuous surge"],
        ["5", "Per Cell Maintenance Volume", `${calc.perCompartmentVol.toLocaleString()} ${calc.volUnit} / cell`, "Compartments", `${calc.comps} equal maintenance cells (${calc.perCompartmentM3} m³)`],
        ["6", "Pump Refill Duration", `${calc.fillTimeHours} hrs (${calc.fillTimeMinutes} mins)`, "Refill Rate", "Capacity / Pump Inflow Rate"],
        ["7", "Suggested Plan Dimensions", `${calc.tankLength} × ${calc.tankWidth} × ${calc.effectiveDepth} ${calc.dimUnit}`, "Footprint", `Area: ${calc.floorArea} ${calc.areaUnit} (2:1 aspect ratio)`],
      ];

      callAutoTable(doc, {
        startY: currentY + 2.5,
        head: [["Sr.", "Metric / Sizing Parameter", "Calculated Value", "Allocation", "Formula & Code Reference"]],
        body: resultsTableBody,
        theme: "grid",
        headStyles: {
          fillColor: blueFill,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "center",
        },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 58, fontStyle: "bold" },
          2: { cellWidth: 42, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 26, halign: "center" },
          4: { cellWidth: 46, halign: "left" },
        },
      });

      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 160;

      // Status Verification Banner
      doc.setDrawColor(16, 185, 129);
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(14, currentY, 182, 14, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(5, 150, 105);
      doc.text("✔ Potable Water Storage Capacity Satisfies BS EN 806 & IPC Chapter 6", 20, currentY + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      doc.text(`Dual ${calc.comps}-cell compartment split ensures 100% online maintenance and continuous building potable water availability.`, 20, currentY + 10.5);

      currentY += 20;

      // Section 3: 3-Tier Approval & Sign-Off Block
      const sigDetails = getSignatureBlockDetails(project?.id || "default", "/plumbing-tank-sizing", currentUserName, calcReviewState);

      callAutoTable(doc, {
        startY: currentY,
        head: [["Approval Role", "Engineers Name", "Status / Role Title", "Signature / Date"]],
        body: [
          ["Originator / Prepared By", sigDetails.originatedName, "MEP Design Engineer", sigDetails.originatedDate],
          ["Reviewer / Checked By", sigDetails.reviewerName || "Pending Review", "Senior Plumbing Lead", sigDetails.reviewerDate || "—"],
          ["Approver / Verified By", sigDetails.approverName || "Pending Approval", "Principal / MEP Director", sigDetails.approverDate || "—"],
        ],
        theme: "grid",
        headStyles: {
          fillColor: primaryFill,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "center",
        },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        columnStyles: {
          0: { cellWidth: 44, fontStyle: "bold" },
          1: { cellWidth: 50, halign: "center" },
          2: { cellWidth: 46, halign: "center" },
          3: { cellWidth: 42, halign: "center" },
        },
      });

      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), `Water_Tank_Sizing_Report_${project?.code || "CALC"}.pdf`, "PDF Document", ["pdf"]);
      toast.success("Preliminary Engineering PDF Report exported successfully!");
    } catch (err: any) {
      console.error("exportPdf error:", err);
      toast.error(`Export PDF failed: ${err?.message || String(err)}`);
    }
  };

  return (
    <AppShell title="Tank Sizing" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-hidden h-full">
          
          {/* Page Header & Actions */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Tank Sizing</h1>
              
              {/* Intelligence Trigger Button */}
              <button 
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Domestic Water Tank Sizing Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>

              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-tank-sizing" calculatorTitle="Tank Sizing" />
            </div>

            {/* Unit System Toggle in Header inline with Approve / Reject */}
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* Review / Approval Status Banner */}
          <CalculationStatusBanner
            projectId={project?.id || "default"}
            calculatorPath="/plumbing-tank-sizing"
            calculatorTitle="Tank Sizing"
          />

          {/* Main Content Card Container */}
          <div className={`flex-1 flex flex-col min-h-0 overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
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

                {/* Formula Breakdown button placed right next to tabs */}
                <TBtn
                  onClick={() => setShowFormulaModal(true)}
                  title="Detailed Formulas & Sizing Derivations"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>

                {/* Water Demand Import shortcut if available */}
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
                      saveState(next, unitSystem, preset);
                      toast.success(`Imported ${targetDaily.toLocaleString()} ${calc.volUnit} daily demand from Water Demand Module`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/40 border border-emerald-500/25 rounded-full transition shadow-xs cursor-pointer"
                    title="Import calculated demand directly from Water Demand Sizer"
                  >
                    <Sparkles className="size-3.5 text-emerald-500" />
                    <span>Import Demand ({unitSystem === "si" ? `${Math.round(waterDemandSummary.dailyLpd).toLocaleString()} L/d` : `${Math.round(waterDemandSummary.dailyLpd / 3.78541).toLocaleString()} GPD`})</span>
                  </button>
                )}
              </div>

              {/* Right Side Action Button: Export */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={exportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" ? (
                <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-y-hidden p-4 md:p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    
                    {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4.5 space-y-4">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                            🕹 SIZING PARAMETERS
                          </span>
                        </div>

                        {/* Section 1: Water Demand & Storage Criteria */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-tankDemandParams"
                              data-field-id="tankDemandParams"
                              data-comment-target="tankDemandParams"
                              className={`pt-0 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("tankDemandParams", "Water Demand & Inflow")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Water Demand &amp; Inflow Rates
                                  </span>
                                  {renderCommentBadge("tankDemandParams", "Water Demand & Inflow")}
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] text-slate-500">Daily Water Consumption Demand ({calc.volUnit})</label>
                                <input
                                  type="number"
                                  step="100"
                                  min="0"
                                  disabled={isEffectiveReadOnly}
                                  value={sizingParams.dailyDemand}
                                  onChange={(e) => handleInputChange("dailyDemand", e.target.value)}
                                  className={flowInputClass}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Autonomy Duration (days)</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    disabled={isEffectiveReadOnly}
                                    value={sizingParams.storageDays}
                                    onChange={(e) => handleInputChange("storageDays", e.target.value)}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Peak Fixture Flow Rate ({calc.flowUnit})</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    disabled={isEffectiveReadOnly}
                                    value={sizingParams.peakFlow}
                                    onChange={(e) => handleInputChange("peakFlow", e.target.value)}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Pump Inflow / Refill Rate ({calc.flowUnit})</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    disabled={isEffectiveReadOnly}
                                    value={sizingParams.pumpFillRate}
                                    onChange={(e) => handleInputChange("pumpFillRate", e.target.value)}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Safety / Freeboard Margin (%)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    disabled={isEffectiveReadOnly}
                                    value={sizingParams.safetyFactor}
                                    onChange={(e) => handleInputChange("safetyFactor", e.target.value)}
                                    className={inputClass}
                                  />
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => {
                                const next = {
                                  ...sizingParams,
                                  dailyDemand: unitSystem === "ip" ? 5000 : 20000,
                                  storageDays: 1,
                                  peakFlow: unitSystem === "ip" ? 40 : 2.5,
                                  pumpFillRate: unitSystem === "ip" ? 30 : 2.0,
                                  safetyFactor: 10,
                                };
                                setSizingParams(next);
                                saveState(next, unitSystem, preset);
                                toast.success("Demand and inflow parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Demand &amp; Inflow</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "tankDemandParams", label: "Water Demand & Inflow" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 2: Physical Geometry & Redundancy */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-tankGeometryParams"
                              data-field-id="tankGeometryParams"
                              data-comment-target="tankGeometryParams"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("tankGeometryParams", "Geometry & Redundancy")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Physical Geometry &amp; Redundancy
                                  </span>
                                  {renderCommentBadge("tankGeometryParams", "Geometry & Redundancy")}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Usable Water Depth ({calc.dimUnit})</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0.5"
                                    disabled={isEffectiveReadOnly}
                                    value={sizingParams.usableDepth}
                                    onChange={(e) => handleInputChange("usableDepth", e.target.value)}
                                    className={inputClass}
                                  />
                                </div>

                                <div>
                                  <label className="text-[11px] text-slate-500">Maintenance Compartments</label>
                                  <div className="relative mt-1">
                                    <select
                                      disabled={isEffectiveReadOnly}
                                      value={sizingParams.numCompartments}
                                      onChange={(e) => handleInputChange("numCompartments", parseInt(e.target.value) || 2)}
                                      className={selectClass}
                                    >
                                      <option value={1}>1 Single Cell (100%)</option>
                                      <option value={2}>2 Cells (50%/50% - Recommended)</option>
                                      <option value={3}>3 Cells (33% each)</option>
                                      <option value={4}>4 Cells (25% each)</option>
                                    </select>
                                    {!isEffectiveReadOnly && (
                                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                                <Info className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>
                                  <strong>IPC / BS EN 806:</strong> Dual 50% compartments allow online cleaning &amp; disinfection without disrupting building water service.
                                </span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => {
                                const next = {
                                  ...sizingParams,
                                  usableDepth: unitSystem === "ip" ? 8 : 2.5,
                                  numCompartments: 2,
                                };
                                setSizingParams(next);
                                saveState(next, unitSystem, preset);
                                toast.success("Geometry parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Geometry</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "tankGeometryParams", label: "Geometry & Redundancy" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                      </div>
                    </div>

                    {/* RIGHT COLUMN: CALCULATION RESULTS SUMMARY (lg:col-span-7) */}
                    <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-0 self-start">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-calculation-results"
                            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4.5 space-y-4 transition-all hover:border-slate-300 dark:hover:border-zinc-700"
                          >
                            
                            {/* Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2">
                                <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                  ⚡ Sizing Results Summary
                                </span>
                              </div>

                              {/* Status Badge */}
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <ShieldCheck className="size-3.5" />
                                <span>BS EN 806 / IPC Compliant</span>
                              </span>
                            </div>

                            {/* 4 Colorful Top Metric Tiles (Matching Pump Sizing Standard) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              
                              {/* Tile 1: Recommended Usable Capacity (Blue) */}
                              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Total Usable Capacity</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {calc.recommendedCapacity.toLocaleString()}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {calc.volUnit}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  {calc.capacityM3} m³ • {calc.capacityGal.toLocaleString()} gal
                                </span>
                              </div>

                              {/* Tile 2: Break / Surge Buffer (Amber) */}
                              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Break Buffer (30m)</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {calc.peakSurgeVol.toLocaleString()}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {calc.volUnit}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  30-min peak surge
                                </span>
                              </div>

                              {/* Tile 3: Per-Cell Storage (Emerald) */}
                              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Per Cell Storage</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {calc.perCompartmentVol.toLocaleString()}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {calc.volUnit}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {calc.comps} cells ({calc.perCompartmentM3} m³/cell)
                                </span>
                              </div>

                              {/* Tile 4: Pump Refill Duration (Purple) */}
                              <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Refill Duration</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {calc.fillTimeHours}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    hrs
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {calc.fillTimeMinutes} mins total refill
                                </span>
                              </div>

                            </div>

                            {/* DETAILED HYDRAULICS SUMMARY TABLE */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Consumption Storage Demand Volume:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {calc.storageDemandVol.toLocaleString()} {calc.volUnit} ({sizingParams.storageDays} Day Autonomy)
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Peak Fixture Surge Buffer Volume:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {calc.peakSurgeVol.toLocaleString()} {calc.volUnit} (30 mins @ {sizingParams.peakFlow} {calc.flowUnit})
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Safety &amp; Freeboard Allowance:</span>
                                <span className="font-mono font-bold text-foreground">
                                  +{calc.safetyMarginVol.toLocaleString()} {calc.volUnit} (+{sizingParams.safetyFactor}%)
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Usable Water Depth:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {calc.effectiveDepth} {calc.dimUnit}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Estimated Plan Footprint:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {calc.tankLength} × {calc.tankWidth} {calc.dimUnit} (Floor Area: {calc.floorArea} {calc.areaUnit})
                                </span>
                              </div>
                              <div className="flex justify-between py-1 font-bold text-foreground">
                                <span>Total Usable Storage Capacity:</span>
                                <span className="font-mono text-primary text-sm">
                                  {calc.recommendedCapacity.toLocaleString()} {calc.volUnit} ({calc.capacityM3} m³ / {calc.capacityGal.toLocaleString()} US gal)
                                </span>
                              </div>
                            </div>

                            {/* Compartment Footprint Visual Layout */}
                            <div className="border border-border/80 rounded-xl bg-slate-50/50 dark:bg-zinc-900/50 p-3.5 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-foreground">Tank Allocation &amp; Footprint Layout</span>
                                <span className="text-muted-foreground font-mono text-[11px]">
                                  {calc.tankLength} × {calc.tankWidth} × {calc.effectiveDepth} {calc.dimUnit} • {calc.floorArea} {calc.areaUnit}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                {Array.from({ length: calc.comps }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col items-center justify-center text-center gap-1"
                                  >
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                      Cell {i + 1} ({(100 / calc.comps).toFixed(0)}%)
                                    </span>
                                    <span className="text-base font-bold font-mono text-foreground">
                                      {calc.perCompartmentVol.toLocaleString()} {calc.volUnit}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      {calc.perCompartmentM3} m³ / cell
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        </ContextMenuTrigger>
                        
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50 font-sans">
                          <ContextMenuItem
                            onClick={() => setActiveCommentTarget({ id: "results", label: "Calculation Results" })}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium text-[13px]"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add / View Comment</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => copyToClipboard(`Usable Capacity: ${calc.recommendedCapacity.toLocaleString()} ${calc.volUnit} (${calc.capacityM3} m³), Refill: ${calc.fillTimeHours} hrs`)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Results Summary</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={exportPdf}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary text-[13px]"
                          >
                            <FileText className="size-3.5" />
                            <span>Export PDF Report</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>

                  </div>
                </div>
              ) : (
                /* Report View Tab (Preliminary Document Format) */
                <TankSizingReportView
                  calc={calc}
                  sizingParams={sizingParams}
                  project={project}
                  calcReviewState={calcReviewState}
                  currentUserName={currentUserName}
                  onExportPdf={exportPdf}
                />
              )}
            </div>
          </div>
        </div>

        {/* Intelligence Drawer (Collapsible Right Side Panel) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <TankSizingIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calc={calc}
              preset={preset}
              onSelectPreset={handleApplyPreset}
              isEffectiveReadOnly={isEffectiveReadOnly}
              unitSystem={unitSystem}
              setShowFormulaModal={setShowFormulaModal}
            />
          )}
        </div>
      </div>

      {/* Formula & Derivations Modal */}
      {showFormulaModal && (
        <TankSizingFormulaModal
          onClose={() => setShowFormulaModal(false)}
          calc={calc}
          sizingParams={sizingParams}
        />
      )}

      {/* Assign / View Comment Modal */}
      {activeCommentTarget && (
        <AssignCommentModal
          isOpen={true}
          onClose={() => setActiveCommentTarget(null)}
          onSave={handleSaveComment}
          targetId={activeCommentTarget.id}
          targetName={activeCommentTarget.label}
          existingComments={commentsMap[activeCommentTarget.id] || []}
        />
      )}
    </AppShell>
  );
}

// In-Browser Preliminary Engineering Report Component
function TankSizingReportView({
  calc,
  sizingParams,
  project,
  calcReviewState,
  currentUserName,
  onExportPdf,
}: {
  calc: any;
  sizingParams: TankSizingParams;
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  onExportPdf: () => void;
}) {
  const calcNo = `CALC-TNK-${project?.code || "001"}`;
  const projectNo = project?.code || "PRJ-001";
  const projectName = project?.name || "Domestic Water Storage Facility Project";
  const clientName = (project as any)?.client || "Client Representative";
  const endUser = (project as any)?.endUser || "Building Facilities / MEP Department";
  const today = formatDateStr(new Date().toISOString());

  const sigDetails = getSignatureBlockDetails(project?.id || "default", "/plumbing-tank-sizing", currentUserName, calcReviewState);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/50 dark:bg-zinc-950/40 custom-scrollbar">
      <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6">
        
        {/* Document Header */}
        <div className="flex justify-between items-start pb-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">
              Domestic Water Tank Sizing Preliminary Report
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Design Standards: IPC Chapter 6 / BS EN 806 / ASPE Potable Water Storage
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TBtn onClick={onExportPdf}>
              <FileText className="size-3.5" /> Export PDF
            </TBtn>
          </div>
        </div>

        {/* Metadata Enclosed Grid */}
        <div className="border border-border rounded-xl overflow-hidden text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 bg-muted/40 font-bold border-b border-border divide-x divide-border">
            <div className="p-2.5">Calculation No:</div>
            <div className="p-2.5 font-mono text-primary font-normal">{calcNo}</div>
            <div className="p-2.5">Date:</div>
            <div className="p-2.5 font-normal">{today}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border divide-x divide-border">
            <div className="p-2.5 font-bold bg-muted/20">Project No:</div>
            <div className="p-2.5 font-mono">{projectNo}</div>
            <div className="p-2.5 font-bold bg-muted/20">Client:</div>
            <div className="p-2.5">{clientName}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
            <div className="p-2.5 font-bold bg-muted/20">Project Name:</div>
            <div className="p-2.5">{projectName}</div>
            <div className="p-2.5 font-bold bg-muted/20">End User:</div>
            <div className="p-2.5">{endUser}</div>
          </div>
        </div>

        {/* Section 1: Demand & Inflow Parameters */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground">1. Input Parameters &amp; Demand Criteria</h3>
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-200/80 dark:bg-zinc-800 font-bold border-b border-border">
                  <th className="p-2.5 w-12 text-center">Sr.</th>
                  <th className="p-2.5">Parameter Description</th>
                  <th className="p-2.5 text-center">Design Value</th>
                  <th className="p-2.5 text-center">Equivalent</th>
                  <th className="p-2.5">Standard / Code Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-2.5 text-center font-mono">1</td>
                  <td className="p-2.5 font-bold">Daily Water Consumption Demand</td>
                  <td className="p-2.5 text-center font-mono font-bold text-primary">{sizingParams.dailyDemand} {calc.volUnit}</td>
                  <td className="p-2.5 text-center font-mono">{calc.isIp ? `${(Number(sizingParams.dailyDemand) * 3.78541).toFixed(0)} L` : `${(Number(sizingParams.dailyDemand) / 3.78541).toFixed(0)} gal`}</td>
                  <td className="p-2.5 text-muted-foreground">Daily Occupancy / Plumbing Load Demand</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">2</td>
                  <td className="p-2.5 font-bold">Storage Autonomy Duration</td>
                  <td className="p-2.5 text-center font-mono font-bold">{sizingParams.storageDays} Day(s)</td>
                  <td className="p-2.5 text-center font-mono">{(Number(sizingParams.storageDays) * 24).toFixed(0)} Hours</td>
                  <td className="p-2.5 text-muted-foreground">Continuous uninterrupted supply autonomy</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">3</td>
                  <td className="p-2.5 font-bold">Peak Fixture Demand Flow Rate</td>
                  <td className="p-2.5 text-center font-mono font-bold">{sizingParams.peakFlow} {calc.flowUnit}</td>
                  <td className="p-2.5 text-center font-mono">{calc.isIp ? `${(Number(sizingParams.peakFlow) * 0.06309).toFixed(2)} L/s` : `${(Number(sizingParams.peakFlow) / 0.06309).toFixed(1)} GPM`}</td>
                  <td className="p-2.5 text-muted-foreground">Peak instantaneous plumbing fixture draw</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">4</td>
                  <td className="p-2.5 font-bold">Pump Inflow / Municipal Refill Rate</td>
                  <td className="p-2.5 text-center font-mono font-bold">{sizingParams.pumpFillRate} {calc.flowUnit}</td>
                  <td className="p-2.5 text-center font-mono">{calc.isIp ? `${(Number(sizingParams.pumpFillRate) * 0.06309).toFixed(2)} L/s` : `${(Number(sizingParams.pumpFillRate) / 0.06309).toFixed(1)} GPM`}</td>
                  <td className="p-2.5 text-muted-foreground">Available water main refill capacity</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">5</td>
                  <td className="p-2.5 font-bold">Safety / Freeboard Margin Allowance</td>
                  <td className="p-2.5 text-center font-mono font-bold">+{sizingParams.safetyFactor} %</td>
                  <td className="p-2.5 text-center font-mono">+{calc.safetyMarginVol.toLocaleString()} {calc.volUnit}</td>
                  <td className="p-2.5 text-muted-foreground">Freeboard, air gap &amp; surge reserve</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">6</td>
                  <td className="p-2.5 font-bold">Usable Water Depth</td>
                  <td className="p-2.5 text-center font-mono font-bold">{sizingParams.usableDepth} {calc.dimUnit}</td>
                  <td className="p-2.5 text-center font-mono">{calc.isIp ? `${(Number(sizingParams.usableDepth) * 0.3048).toFixed(2)} m` : `${(Number(sizingParams.usableDepth) / 0.3048).toFixed(1)} ft`}</td>
                  <td className="p-2.5 text-muted-foreground">Effective water depth below overflow</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">7</td>
                  <td className="p-2.5 font-bold">Compartment Maintenance Division</td>
                  <td className="p-2.5 text-center font-mono font-bold">{sizingParams.numCompartments} Cell(s)</td>
                  <td className="p-2.5 text-center font-mono">{(100 / (sizingParams.numCompartments || 2)).toFixed(0)}% per cell</td>
                  <td className="p-2.5 text-muted-foreground">IPC 606.5 / BS EN 806 online cleaning split</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Storage Sizing Results */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground">2. Storage Sizing &amp; Capacity Evaluation</h3>
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-100 dark:bg-blue-950/60 font-bold border-b border-border">
                  <th className="p-2.5 w-12 text-center">Sr.</th>
                  <th className="p-2.5">Metric / Sizing Parameter</th>
                  <th className="p-2.5 text-center">Calculated Value</th>
                  <th className="p-2.5 text-center">Allocation</th>
                  <th className="p-2.5">Formula &amp; Code Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="bg-blue-50/50 dark:bg-blue-950/20 font-bold">
                  <td className="p-2.5 text-center font-mono">1</td>
                  <td className="p-2.5 text-primary">RECOMMENDED USABLE CAPACITY</td>
                  <td className="p-2.5 text-center font-mono text-sm text-primary">{calc.recommendedCapacity.toLocaleString()} {calc.volUnit}</td>
                  <td className="p-2.5 text-center">Total Storage</td>
                  <td className="p-2.5 text-muted-foreground">Max(Storage Demand, Break Surge) × (1 + Safety)</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">2</td>
                  <td className="p-2.5 font-semibold">Volumetric Standard Equivalence</td>
                  <td className="p-2.5 text-center font-mono font-bold">{calc.capacityM3} m³ ({calc.capacityGal.toLocaleString()} gal)</td>
                  <td className="p-2.5 text-center">Equivalent</td>
                  <td className="p-2.5 text-muted-foreground">Standard volumetric conversions</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">3</td>
                  <td className="p-2.5 font-semibold">Consumption Storage Demand</td>
                  <td className="p-2.5 text-center font-mono font-bold">{calc.storageDemandVol.toLocaleString()} {calc.volUnit}</td>
                  <td className="p-2.5 text-center">Demand</td>
                  <td className="p-2.5 text-muted-foreground">Daily Demand × Autonomy Days</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">4</td>
                  <td className="p-2.5 font-semibold">Break Tank 30-min Surge Buffer</td>
                  <td className="p-2.5 text-center font-mono font-bold">{calc.peakSurgeVol.toLocaleString()} {calc.volUnit}</td>
                  <td className="p-2.5 text-center">Buffer</td>
                  <td className="p-2.5 text-muted-foreground">Peak Flow × 30-min continuous surge</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">5</td>
                  <td className="p-2.5 font-semibold">Per Cell Maintenance Volume</td>
                  <td className="p-2.5 text-center font-mono font-bold">{calc.perCompartmentVol.toLocaleString()} {calc.volUnit} / cell</td>
                  <td className="p-2.5 text-center">Compartments</td>
                  <td className="p-2.5 text-muted-foreground">{calc.comps} equal maintenance cells ({calc.perCompartmentM3} m³)</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">6</td>
                  <td className="p-2.5 font-semibold">Pump Refill Duration</td>
                  <td className="p-2.5 text-center font-mono font-bold">{calc.fillTimeHours} hrs ({calc.fillTimeMinutes} mins)</td>
                  <td className="p-2.5 text-center">Refill Rate</td>
                  <td className="p-2.5 text-muted-foreground">Capacity / Pump Inflow Rate</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">7</td>
                  <td className="p-2.5 font-semibold">Suggested Plan Dimensions</td>
                  <td className="p-2.5 text-center font-mono font-bold">{calc.tankLength} × {calc.tankWidth} × {calc.effectiveDepth} {calc.dimUnit}</td>
                  <td className="p-2.5 text-center">Footprint</td>
                  <td className="p-2.5 text-muted-foreground">Area: {calc.floorArea} {calc.areaUnit} (2:1 aspect ratio)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Banner */}
        <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800/50 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 flex items-start gap-3 text-xs">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div>
            <strong className="text-sm block">Potable Water Storage Capacity Satisfies BS EN 806 &amp; IPC Chapter 6:</strong>
            <p className="mt-0.5 leading-relaxed text-[11.5px]">
              The calculated usable volume of {calc.recommendedCapacity.toLocaleString()} {calc.volUnit} ({calc.capacityM3} m³) accommodates full daily consumption plus mandatory peak break buffer. Dual {calc.comps}-cell compartment split ensures 100% online maintenance without building supply disruption.
            </p>
          </div>
        </div>

        {/* Section 3: 3-Tier Approval Block */}
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-bold text-foreground">3. Approval &amp; Sign-Off Block</h3>
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-200/80 dark:bg-zinc-800 font-bold border-b border-border">
                  <th className="p-2.5">Approval Role</th>
                  <th className="p-2.5 text-center">Engineers Name</th>
                  <th className="p-2.5 text-center">Status / Role Title</th>
                  <th className="p-2.5 text-center">Signature / Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-2.5 font-bold">Originator / Prepared By</td>
                  <td className="p-2.5 text-center font-medium">{sigDetails.originatedName}</td>
                  <td className="p-2.5 text-center text-muted-foreground">MEP Design Engineer</td>
                  <td className="p-2.5 text-center font-mono">{sigDetails.originatedDate}</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 font-bold">Reviewer / Checked By</td>
                  <td className="p-2.5 text-center font-medium">{sigDetails.reviewerName || "Pending Review"}</td>
                  <td className="p-2.5 text-center text-muted-foreground">Senior Plumbing Lead</td>
                  <td className="p-2.5 text-center font-mono">{sigDetails.reviewerDate || "—"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold">Approver / Verified By</td>
                  <td className="p-2.5 text-center font-medium">{sigDetails.approverName || "Pending Approval"}</td>
                  <td className="p-2.5 text-center text-muted-foreground">Principal / MEP Director</td>
                  <td className="p-2.5 text-center font-mono">{sigDetails.approverDate || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// Intelligence Drawer Component
function TankSizingIntelligenceDrawer({
  onClose,
  calc,
  preset,
  onSelectPreset,
  isEffectiveReadOnly,
  unitSystem,
  setShowFormulaModal,
}: {
  onClose: () => void;
  calc: any;
  preset: TankPresetKey;
  onSelectPreset: (k: TankPresetKey) => void;
  isEffectiveReadOnly: boolean;
  unitSystem: "si" | "ip";
  setShowFormulaModal: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground">Tank Sizing Intelligence</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs custom-scrollbar">
        {/* Quick Presets */}
        <div className="space-y-2.5">
          <span className="font-bold text-foreground text-[11px] uppercase tracking-wider block">
            ⚡ Building Application Presets
          </span>
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(SI_PRESETS) as TankPresetKey[]).filter(k => k !== "custom").map((k) => {
              const p = SI_PRESETS[k];
              const isSelected = preset === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={isEffectiveReadOnly}
                  onClick={() => onSelectPreset(k)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border/80 bg-surface-2 hover:bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span>{p.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                    {p.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Design Standards Matrix */}
        <div className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-2">
          <span className="font-bold text-foreground text-[11px] uppercase tracking-wider block">
            📐 Design Standards &amp; Codes
          </span>
          <div className="space-y-1.5 text-[11.5px] text-muted-foreground">
            <p>• <strong>IPC Chapter 6:</strong> Potable water supply storage and air gap backflow protection.</p>
            <p>• <strong>BS EN 806:</strong> Minimum 24h domestic storage requirement with dual-cell maintenance split.</p>
            <p>• <strong>ASPE Plumbing Engineering:</strong> 30-minute peak fixture draw buffer sizing method.</p>
          </div>
        </div>

        {/* Sizing Recommendations */}
        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 space-y-2">
          <span className="font-bold text-blue-700 dark:text-blue-300 text-[11px] uppercase tracking-wider block">
            💡 Engineering Guidelines
          </span>
          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            <p>• <strong>Residential:</strong> 150–200 L/person/day.</p>
            <p>• <strong>Offices:</strong> 45 L/employee/day.</p>
            <p>• <strong>Hospitals:</strong> 350–500 L/bed/day with mandatory 48h autonomy.</p>
            <p>• <strong>Hotels:</strong> 250–300 L/guest/day.</p>
          </div>
        </div>
      </div>

      <div className="p-3.5 border-t border-border bg-card">
        <button
          type="button"
          onClick={() => setShowFormulaModal(true)}
          className="w-full py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 transition shadow-xs cursor-pointer"
        >
          <Info className="size-3.5" />
          <span>View Formula Breakdown</span>
        </button>
      </div>
    </div>
  );
}

// Formula & Mathematical Derivations Modal
function TankSizingFormulaModal({
  onClose,
  calc,
  sizingParams,
}: {
  onClose: () => void;
  calc: any;
  sizingParams: TankSizingParams;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Droplets className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Tank Sizing Formulas &amp; Derivations</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
            <h4 className="font-bold text-foreground text-sm mb-1">1. Storage Demand Method</h4>
            <p className="font-mono text-primary font-semibold mb-1">
              V_storage = Q_daily × T_duration
            </p>
            <p>
              Calculated: {sizingParams.dailyDemand} × {sizingParams.storageDays} = <strong>{calc.storageDemandVol.toLocaleString()} {calc.volUnit}</strong>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
            <h4 className="font-bold text-foreground text-sm mb-1">2. Break Tank (Peak Surge Buffer)</h4>
            <p className="font-mono text-primary font-semibold mb-1">
              V_break = Q_peak × 30 minutes
            </p>
            <p>
              Calculated: <strong>{calc.peakSurgeVol.toLocaleString()} {calc.volUnit}</strong>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
            <h4 className="font-bold text-foreground text-sm mb-1">3. Total Recommended Capacity</h4>
            <p className="font-mono text-primary font-semibold mb-1">
              V_rec = Max(V_storage, V_break) × (1 + Safety Margin)
            </p>
            <p>
              Calculated: Max({calc.storageDemandVol}, {calc.peakSurgeVol}) × (1 + {sizingParams.safetyFactor}%) = <strong>{calc.recommendedCapacity.toLocaleString()} {calc.volUnit} ({calc.capacityM3} m³)</strong>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
            <h4 className="font-bold text-foreground text-sm mb-1">4. Refill Inflow Duration</h4>
            <p className="font-mono text-primary font-semibold mb-1">
              T_refill = V_rec / Q_pump
            </p>
            <p>
              Calculated: <strong>{calc.fillTimeHours} hours ({calc.fillTimeMinutes} minutes)</strong>
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs cursor-pointer hover:bg-primary/90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
