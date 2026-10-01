import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, X, HelpCircle,
  MessageSquare, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Droplets, Gauge, ShieldCheck, Layers,
  Zap, Cylinder, ArrowUpRight, ChevronDown, ChevronRight, Lightbulb,
  Home, Building2, Utensils, Factory, SlidersHorizontal, Building, CheckCircle
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { TBtn } from "@/components/workspace/Button";
import { SewagePresetSelect } from "@/components/workspace/SewagePresetSelect";
import { CustomSewagePumpConfigModal } from "@/components/workspace/CustomSewagePumpConfigModal";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";

export const Route = createFileRoute("/plumbing-sewage-pump")({
  head: () => ({
    meta: [
      { title: "Sewage Pump Sizing Calculator — MEP Calc" },
      { name: "description", content: "Size sewage ejector and submersible sump pumps, wet well storage volume, dynamic head, and motor ratings per IPC & ASPE." },
    ],
  }),
  component: SewagePumpPage,
});

export type SewagePresetKey =
  | "residential_basement"
  | "commercial_building"
  | "restaurant_kitchen"
  | "high_rise_basement"
  | "heavy_duty_station"
  | "custom";

export interface SewagePresetConfig {
  key: SewagePresetKey;
  label: string;
  category: string;
  description: string;
  inflow: number; // GPM
  cycle: number; // minutes
  starts: number; // max starts/hr
  lift: number; // ft
  pipeDia: number; // inches
  pipeLen: number; // ft
  fittingsHead: number; // ft
  safetyFactor: number; // %
  basinDia: number; // inches
}

export const SEWAGE_PRESETS: Record<SewagePresetKey, SewagePresetConfig> = {
  residential_basement: {
    key: "residential_basement",
    label: "Residential Basement",
    category: "IPC / Residential Ejector",
    description: "Single-family or multi-family basement sanitary fixture drainage (WC, basin, laundry).",
    inflow: 20,
    cycle: 5,
    starts: 6,
    lift: 15,
    pipeDia: 2.0,
    pipeLen: 35,
    fittingsHead: 3.5,
    safetyFactor: 15,
    basinDia: 24,
  },
  commercial_building: {
    key: "commercial_building",
    label: "Commercial Office / Retail",
    category: "ASPE / Commercial",
    description: "Multi-fixture public basement restrooms with duplex alternating sewage ejectors.",
    inflow: 50,
    cycle: 6,
    starts: 6,
    lift: 25,
    pipeDia: 3.0,
    pipeLen: 65,
    fittingsHead: 6.0,
    safetyFactor: 15,
    basinDia: 36,
  },
  restaurant_kitchen: {
    key: "restaurant_kitchen",
    label: "Restaurant / Commercial Kitchen",
    category: "IPC / High Solids & Grease",
    description: "Grease-laden waste & high-temperature kitchen discharge requiring high-torque solids handling.",
    inflow: 65,
    cycle: 5,
    starts: 8,
    lift: 20,
    pipeDia: 3.0,
    pipeLen: 50,
    fittingsHead: 5.5,
    safetyFactor: 20,
    basinDia: 42,
  },
  high_rise_basement: {
    key: "high_rise_basement",
    label: "High-Rise Deep Basement",
    category: "ASPE / High Head",
    description: "Deep subterranean parking levels (B3–B5) requiring high-head discharge to street sewer.",
    inflow: 75,
    cycle: 8,
    starts: 6,
    lift: 55,
    pipeDia: 4.0,
    pipeLen: 120,
    fittingsHead: 10.0,
    safetyFactor: 15,
    basinDia: 48,
  },
  heavy_duty_station: {
    key: "heavy_duty_station",
    label: "Heavy-Duty Wet Well Station",
    category: "Municipal / ASPE Chapter 7",
    description: "Large commercial complex or hotel central wet well with large non-clog solids-handling pumps.",
    inflow: 150,
    cycle: 10,
    starts: 6,
    lift: 35,
    pipeDia: 4.0,
    pipeLen: 150,
    fittingsHead: 12.0,
    safetyFactor: 20,
    basinDia: 60,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Engineering",
    description: "Custom user-defined sewage pump hydraulic configuration.",
    inflow: 50,
    cycle: 6,
    starts: 6,
    lift: 20,
    pipeDia: 3.0,
    pipeLen: 50,
    fittingsHead: 5.0,
    safetyFactor: 15,
    basinDia: 36,
  },
};

// Standard Motor Ratings (HP)
const STANDARD_MOTOR_HP = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 7.5, 10.0, 15.0, 20.0, 25.0, 30.0];

// Conversion Constants
const GPM_TO_LPS = 0.0630902;
const GPM_TO_LMIN = 3.78541;
const FT_TO_M = 0.3048;
const IN_TO_MM = 25.4;
const GAL_TO_M3 = 0.00378541;
const GAL_TO_L = 3.78541;
const HP_TO_KW = 0.7457;

export function SewagePumpPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-sewage-pump", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-sewage-pump", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  // Tabs & drawer state
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Unit system (IP / SI)
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
  const isSI = unitSystem === "si";

  // Preset
  const [preset, setPreset] = useState<SewagePresetKey>("commercial_building");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customProfileName, setCustomProfileName] = useState("Commercial Office / Retail (Custom)");
  const [customWorkflow, setCustomWorkflow] = useState<"dfu" | "direct">("direct");

  // Core Inputs (stored in IP units internally)
  const [inflow, setInflow] = useState<number | "">(50); // Peak Sewage Inflow (GPM)
  const [flowMultiplier, setFlowMultiplier] = useState<number | "">(2.0); // Pump duty factor (typically 1.5 - 2.0x)
  const [cycle, setCycle] = useState<number | "">(6); // Desired cycle time (minutes)
  const [starts, setStarts] = useState<number | "">(6); // Max starts per hour
  const [lift, setLift] = useState<number | "">(25); // Static lift (ft)
  const [pipeDia, setPipeDia] = useState<number | "">(3.0); // Discharge pipe internal diameter (inches)
  const [pipeLen, setPipeLen] = useState<number | "">(65); // Total pipe developed length (ft)
  const [fittingsHead, setFittingsHead] = useState<number | "">(6.0); // Minor losses (valves/bends) (ft)
  const [safetyFactor, setSafetyFactor] = useState<number | "">(15); // Head safety margin (%)
  const [basinDia, setBasinDia] = useState<number | "">(36); // Wet well diameter (inches)
  const [pumpEfficiency, setPumpEfficiency] = useState<number | "">(60); // % pump efficiency
  const [motorEfficiency, setMotorEfficiency] = useState<number | "">(85); // % motor efficiency
  const [pumpCountMode, setPumpCountMode] = useState<"1W_1S" | "2W_1S">("1W_1S"); // 1W+1S (Duplex) or 2W+1S (Triplex)

  // Comments State
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);

  // Sync state with active project
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load saved parameters on mount or project switch
  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    const pKey = `mep_sewage_pump_params_${project.id}`;
    const stored = localStorage.getItem(pKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.preset !== undefined) setPreset(parsed.preset);
        if (parsed.inflow !== undefined) setInflow(parsed.inflow);
        if (parsed.flowMultiplier !== undefined) setFlowMultiplier(parsed.flowMultiplier);
        if (parsed.cycle !== undefined) setCycle(parsed.cycle);
        if (parsed.starts !== undefined) setStarts(parsed.starts);
        if (parsed.lift !== undefined) setLift(parsed.lift);
        if (parsed.pipeDia !== undefined) setPipeDia(parsed.pipeDia);
        if (parsed.pipeLen !== undefined) setPipeLen(parsed.pipeLen);
        if (parsed.fittingsHead !== undefined) setFittingsHead(parsed.fittingsHead);
        if (parsed.safetyFactor !== undefined) setSafetyFactor(parsed.safetyFactor);
        if (parsed.basinDia !== undefined) setBasinDia(parsed.basinDia);
        if (parsed.pumpEfficiency !== undefined) setPumpEfficiency(parsed.pumpEfficiency);
        if (parsed.motorEfficiency !== undefined) setMotorEfficiency(parsed.motorEfficiency);
        if (parsed.pumpCountMode !== undefined) setPumpCountMode(parsed.pumpCountMode);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch (e) {
        console.error("Failed to parse stored Sewage Pump params", e);
      }
    }
    try {
      const storedComments = localStorage.getItem(`mep_comments_${project.id}_/plumbing-sewage-pump`);
      if (storedComments) {
        setCommentsMap(JSON.parse(storedComments));
      }
    } catch (e) {}
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId]);

  // Auto-persist full calculator state
  const saveState = (overrides?: any) => {
    if (!project?.id) return;
    const dataToSave = {
      preset,
      inflow,
      flowMultiplier,
      cycle,
      starts,
      lift,
      pipeDia,
      pipeLen,
      fittingsHead,
      safetyFactor,
      basinDia,
      pumpEfficiency,
      motorEfficiency,
      pumpCountMode,
      unitSystem,
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    const pKey = `mep_sewage_pump_params_${project.id}`;
    localStorage.setItem(pKey, JSON.stringify(dataToSave));
    localStorage.setItem("mep_sewage_pump_params", JSON.stringify(dataToSave));
    dirtyStore.set(true);
    if (forceSaveToCloud) forceSaveToCloud();
  };

  const handleApplyPreset = (key: SewagePresetKey) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode.", { id: "readonly-notice" });
      return;
    }
    if (key === "custom") {
      setPreset("custom");
      setCustomModalOpen(true);
      return;
    }
    const p = SEWAGE_PRESETS[key];
    setPreset(key);
    setInflow(p.inflow);
    setCycle(p.cycle);
    setStarts(p.starts);
    setLift(p.lift);
    setPipeDia(p.pipeDia);
    setPipeLen(p.pipeLen);
    setFittingsHead(p.fittingsHead);
    setSafetyFactor(p.safetyFactor);
    setBasinDia(p.basinDia);
    setCustomProfileName(`${p.label} (Custom)`);
    saveState({
      preset: key,
      inflow: p.inflow,
      cycle: p.cycle,
      starts: p.starts,
      lift: p.lift,
      pipeDia: p.pipeDia,
      pipeLen: p.pipeLen,
      fittingsHead: p.fittingsHead,
      safetyFactor: p.safetyFactor,
      basinDia: p.basinDia,
    });
    toast.success(`Preset applied: ${p.label}`);
  };

  const handleApplyCustomConfig = (updated: {
    inflow: number;
    flowMultiplier: number;
    cycle: number;
    starts: number;
    lift: number;
    pipeDia: number;
    pipeLen: number;
    fittingsHead: number;
    safetyFactor: number;
    basinDia: number;
    pumpEfficiency: number;
    motorEfficiency: number;
    pumpCountMode: "1W_1S" | "2W_1S";
    customProfileName: string;
    customWorkflow: "dfu" | "direct";
  }) => {
    if (isEffectiveReadOnly) return;
    setPreset("custom");
    setCustomProfileName(updated.customProfileName);
    setCustomWorkflow(updated.customWorkflow);
    setInflow(updated.inflow);
    setFlowMultiplier(updated.flowMultiplier);
    setCycle(updated.cycle);
    setStarts(updated.starts);
    setLift(updated.lift);
    setPipeDia(updated.pipeDia);
    setPipeLen(updated.pipeLen);
    setFittingsHead(updated.fittingsHead);
    setSafetyFactor(updated.safetyFactor);
    setBasinDia(updated.basinDia);
    setPumpEfficiency(updated.pumpEfficiency);
    setMotorEfficiency(updated.motorEfficiency);
    setPumpCountMode(updated.pumpCountMode);
    saveState(updated);
    toast.success("Custom Sewage Pump configuration applied!");
  };

  const handleUnitSystemChange = (nextSystem: "ip" | "si") => {
    if (isEffectiveReadOnly) return;
    setUnitSystem(nextSystem);
    saveState({ unitSystem: nextSystem });
    toast.info(`Switched to ${nextSystem === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  const handleSaveComment = (commentData: any) => {
    if (!activeCommentTarget || !project?.id) return;
    const targetId = activeCommentTarget.id;
    const newComment = {
      id: `comment_${Date.now()}`,
      authorName: currentUserName,
      text: commentData.text,
      timestamp: new Date().toISOString(),
      status: "OPEN",
    };
    const currentList = commentsMap[targetId] || [];
    const updatedMap = { ...commentsMap, [targetId]: [newComment, ...currentList] };
    setCommentsMap(updatedMap);
    localStorage.setItem(`mep_comments_${project.id}_/plumbing-sewage-pump`, JSON.stringify(updatedMap));
    toast.success(`Comment added to "${activeCommentTarget.label}"`);
    setActiveCommentTarget(null);
  };

  const copyToClipboard = (val: string | number) => {
    navigator.clipboard.writeText(String(val));
    toast.success("Copied to clipboard");
  };

  // ==========================================
  // HYDRAULIC & SEWAGE SIZING CALCULATIONS
  // ==========================================
  const calcResults = useMemo(() => {
    const qIn = typeof inflow === "number" ? inflow : 50;
    const mult = typeof flowMultiplier === "number" ? flowMultiplier : 2.0;
    const tCycle = typeof cycle === "number" ? cycle : 6;
    const maxStarts = typeof starts === "number" ? starts : 6;
    const hStatic = typeof lift === "number" ? lift : 25;
    const dPipe = typeof pipeDia === "number" ? pipeDia : 3.0;
    const lPipe = typeof pipeLen === "number" ? pipeLen : 65;
    const hFittings = typeof fittingsHead === "number" ? fittingsHead : 6.0;
    const sf = typeof safetyFactor === "number" ? safetyFactor : 15;
    const dBasin = typeof basinDia === "number" ? basinDia : 36;
    const effP = typeof pumpEfficiency === "number" ? pumpEfficiency / 100 : 0.6;
    const effM = typeof motorEfficiency === "number" ? motorEfficiency / 100 : 0.85;

    // 1. Pump Duty Flow Rate (Q_pump)
    const dutyFlowPerPump = qIn * mult;
    const totalWorkingFlow = pumpCountMode === "2W_1S" ? dutyFlowPerPump * 2 : dutyFlowPerPump;

    // 2. Discharge Pipe Velocity (v)
    const pipeAreaSqFt = (Math.PI * Math.pow(dPipe / 24, 2));
    const flowCfs = (dutyFlowPerPump * 0.13368) / 60;
    const velocityFps = pipeAreaSqFt > 0 ? flowCfs / pipeAreaSqFt : 0;
    const velocityMs = velocityFps * FT_TO_M;

    // 3. Friction Head Loss (H_f) via Hazen-Williams (C=120 for PVC/Cast Iron)
    const C = 120;
    const frictionHead =
      dPipe > 0
        ? 0.002083 * lPipe * Math.pow(100 / C, 1.852) * (Math.pow(dutyFlowPerPump, 1.852) / Math.pow(dPipe, 4.8655))
        : 0;

    // 4. Total Dynamic Head (TDH)
    const totalDynamicLosses = hStatic + frictionHead + hFittings;
    const tdh = totalDynamicLosses * (1 + sf / 100);

    // 5. Active Wet Well Storage Volume (V_active)
    const activeVolGal = (dutyFlowPerPump * tCycle) / 4;
    const activeVolM3 = activeVolGal * GAL_TO_M3;
    const activeVolL = activeVolGal * GAL_TO_L;

    // 6. Basin Liquid Depth & Geometry
    const basinRadiusFt = dBasin / 24;
    const basinAreaSqFt = Math.PI * Math.pow(basinRadiusFt, 2);
    const activeVolCuFt = activeVolGal * 0.13368;
    const activeDepthFt = basinAreaSqFt > 0 ? activeVolCuFt / basinAreaSqFt : 0;
    const activeDepthInches = activeDepthFt * 12;
    const totalBasinDepthInches = activeDepthInches + 24;

    // 7. Power Requirements & Motor Selection
    const waterHP = (dutyFlowPerPump * tdh) / 3960;
    const bhp = effP > 0 ? waterHP / effP : waterHP / 0.6;
    const motorKW = effM > 0 ? (bhp * HP_TO_KW) / effM : bhp * HP_TO_KW;

    let recommendedMotorHP = STANDARD_MOTOR_HP[0];
    for (const stdHP of STANDARD_MOTOR_HP) {
      if (stdHP >= bhp) {
        recommendedMotorHP = stdHP;
        break;
      }
      recommendedMotorHP = stdHP;
    }
    const recommendedMotorKW = recommendedMotorHP * HP_TO_KW;

    // 8. Checks & Verification
    const isScouringCompliant = velocityFps >= 2.0;
    const isMaxVelocityCompliant = velocityFps <= 8.0;
    const isSolidsCompliant = dPipe >= 2.0;
    const calculatedStartsPerHour = tCycle > 0 ? 60 / tCycle : 0;

    return {
      qIn,
      mult,
      tCycle,
      dutyFlowPerPump,
      totalWorkingFlow,
      velocityFps,
      velocityMs,
      frictionHead,
      hStatic,
      hFittings,
      tdh,
      sf,
      activeVolGal,
      activeVolM3,
      activeVolL,
      dBasin,
      dPipe,
      activeDepthInches,
      totalBasinDepthInches,
      waterHP,
      bhp,
      motorKW,
      recommendedMotorHP,
      recommendedMotorKW,
      isScouringCompliant,
      isMaxVelocityCompliant,
      isSolidsCompliant,
      calculatedStartsPerHour,
      maxStarts,
    };
  }, [
    inflow,
    flowMultiplier,
    cycle,
    starts,
    lift,
    pipeDia,
    pipeLen,
    fittingsHead,
    safetyFactor,
    basinDia,
    pumpEfficiency,
    motorEfficiency,
    pumpCountMode,
  ]);

  // Export to PDF (Preliminary Engineering Report Standard)
  const exportPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const primaryFill = [217, 217, 217] as [number, number, number];
      const blueFill = [218, 233, 248] as [number, number, number];

      const callAutoTable = (autoTable as any).default || autoTable;

      const calcNo = `CALC-SEW-${project?.code || "001"}`;
      const projectNo = project?.code || "PRJ-001";
      const projectName = project?.name || "Sewage Lift Station Sizing Project";
      const clientName = (project as any)?.client || "Client Representative";
      const endUser = (project as any)?.endUser || "Building Facilities / MEP Department";
      const today = formatDateStr(new Date().toISOString());

      // Document Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SEWAGE PUMP SIZING PRELIMINARY REPORT", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Design Standards: IPC 709 / IPC 712 / ASPE Chapter 7 Wet Well Sizing", 14, 20);

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

      // Section 1: Design Parameters & Inflow Criteria
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text("1. Sanitary Inflow & Piping Design Parameters", 14, currentY);

      const paramTableBody = [
        ["1", "Peak Sanitary Inflow Rate (Q_in)", isSI ? `${(calcResults.qIn * GPM_TO_LPS).toFixed(2)} L/s` : `${calcResults.qIn.toFixed(1)} GPM`, isSI ? `${calcResults.qIn.toFixed(1)} GPM` : `${(calcResults.qIn * GPM_TO_LPS).toFixed(2)} L/s`, "IPC Table 709.1 Sanitary Drainage Load"],
        ["2", "Pump Drawdown Factor", `${calcResults.mult.toFixed(2)}x`, `${(calcResults.mult * 100).toFixed(0)}%`, "ASPE Chapter 7 Multiplier (1.5x – 2.0x)"],
        ["3", "Target Pump Cycle Time (t)", `${calcResults.tCycle.toFixed(1)} min`, `${(calcResults.tCycle * 60).toFixed(0)} sec`, "Desired interval between successive starts"],
        ["4", "Static Elevation Lift (H_static)", isSI ? `${(calcResults.hStatic * FT_TO_M).toFixed(2)} m` : `${calcResults.hStatic.toFixed(1)} ft`, isSI ? `${calcResults.hStatic.toFixed(1)} ft` : `${(calcResults.hStatic * FT_TO_M).toFixed(2)} m`, "Basin invert to gravity discharge point"],
        ["5", "Discharge Pipe Diameter (D)", isSI ? `${(calcResults.dPipe * IN_TO_MM).toFixed(0)} mm` : `${calcResults.dPipe.toFixed(1)}" NPS`, isSI ? `${calcResults.dPipe.toFixed(1)}" NPS` : `${(calcResults.dPipe * IN_TO_MM).toFixed(0)} mm`, 'IPC 712.4.2 Solids Handling (Min 2.0" / 3.0")'],
        ["6", "Total Developed Pipe Length (L)", isSI ? `${(pipeLen * FT_TO_M).toFixed(1)} m` : `${pipeLen.toFixed(1)} ft`, isSI ? `${pipeLen.toFixed(1)} ft` : `${(pipeLen * FT_TO_M).toFixed(1)} m`, "Isometric developed piping run"],
        ["7", "Wet Well Basin Diameter (Ø)", isSI ? `${(calcResults.dBasin * IN_TO_MM).toFixed(0)} mm` : `${calcResults.dBasin.toFixed(1)}" Ø`, isSI ? `${calcResults.dBasin.toFixed(1)}" Ø` : `${(calcResults.dBasin * IN_TO_MM).toFixed(0)} mm`, "Duplex submersible clearance dimension"],
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

      // Section 2: Hydraulic Sizing Output Summary
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text("2. Hydraulic Sizing & Wet Well Output Evaluation", 14, currentY);

      const resultsTableBody = [
        ["1", "Required Pump Duty Flow (Q_pump)", isSI ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s` : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`, "Duty Flow", "Q_pump = Q_in × Multiplier"],
        ["2", "Discharge Fluid Velocity (v)", isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${calcResults.velocityFps.toFixed(2)} ft/s`, "Scouring", "≥ 2.0 ft/s (0.61 m/s) per IPC 712.4"],
        ["3", "Total Dynamic Head (TDH)", isSI ? `${(calcResults.tdh * FT_TO_M).toFixed(1)} m` : `${calcResults.tdh.toFixed(1)} ft`, "Dynamic Head", `(H_static + H_fric + H_fit) × (1 + ${calcResults.sf}%)`],
        ["4", "Active Sump Volume (V_active)", isSI ? `${calcResults.activeVolM3.toFixed(2)} m³ (${calcResults.activeVolL.toFixed(0)} L)` : `${calcResults.activeVolGal.toFixed(0)} Gal`, "Storage", "V = (Q_pump × t_cycle) / 4 (ASPE 7)"],
        ["5", "Recommended Motor Power Rating", isSI ? `${calcResults.recommendedMotorKW.toFixed(2)} kW (${calcResults.recommendedMotorHP} HP)` : `${calcResults.recommendedMotorHP} HP (${calcResults.recommendedMotorKW.toFixed(2)} kW)`, "Motor Power", "NEMA Heavy-Duty Submersible Rating"],
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

      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 150;

      // Status Verification Banner
      const isPassed = calcResults.isScouringCompliant && calcResults.isSolidsCompliant;
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      if (isPassed) {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(16, 185, 129);
      } else {
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(239, 68, 68);
      }
      doc.rect(14, currentY, 182, 13, "FD");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(isPassed ? 5 : 185, isPassed ? 150 : 28, isPassed ? 105 : 28);
      doc.text(isPassed ? "SEWAGE PUMP SIZING VERIFICATION: PASSED (COMPLIANT)" : "SEWAGE PUMP SIZING VERIFICATION: WARNING (CHECK VELOCITY/SOLIDS)", 18, currentY + 5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      const verifyMsg = isPassed
        ? `Discharge velocity of ${calcResults.velocityFps.toFixed(2)} ft/s (${calcResults.velocityMs.toFixed(2)} m/s) satisfies self-scouring requirements (≥ 2.0 ft/s) and pipe size (${calcResults.dPipe}" NPS) complies with IPC 712.4 solids handling.`
        : `Discharge velocity or pipe solids handling clearance is below IPC 712.4 thresholds. Please adjust pipe size or inflow parameters.`;
      doc.text(verifyMsg, 18, currentY + 9.5);

      // Section 3: Signature Block (Table 3)
      currentY = currentY + 17;
      const reviewDetails = getSignatureBlockDetails(calcReviewState, currentUserName);
      const originatedDate = reviewDetails?.originatedDate || formatDateStr(new Date().toISOString());
      const reviewerDate = reviewDetails?.reviewerDate || "-";
      const approverDate = reviewDetails?.approverDate || "-";

      callAutoTable(doc, {
        startY: currentY,
        head: [["Approvals", "Originated By", "Reviewed By", "Approved By"]],
        body: [
          [
            { content: "Name / Role:", styles: { fontStyle: "bold", halign: "right" } },
            { content: reviewDetails.originator?.name || reviewDetails.originatedName || currentUserName || "-", styles: { halign: "center" } },
            { content: reviewDetails.reviewer?.name || reviewDetails.reviewerName || "-", styles: { halign: "center" } },
            { content: reviewDetails.approver?.name || reviewDetails.approverName || "-", styles: { halign: "center" } },
          ],
          [
            { content: "Status:", styles: { fontStyle: "bold", halign: "right" } },
            { content: reviewDetails.originator?.status || "Signed", styles: { halign: "center" } },
            { content: reviewDetails.reviewer?.status || (reviewDetails.reviewerName ? "Reviewed" : "Pending"), styles: { halign: "center" } },
            { content: reviewDetails.approver?.status || (reviewDetails.approverName ? "Approved" : "Pending"), styles: { halign: "center" } },
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate, styles: { halign: "center" } },
            { content: reviewerDate, styles: { halign: "center" } },
            { content: approverDate, styles: { halign: "center" } },
          ],
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
          0: { cellWidth: 32 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 },
        },
      });

      const pdfBuffer = doc.output("arraybuffer");
      await downloadFile(
        new Uint8Array(pdfBuffer),
        `Sewage_Pump_Sizing_${project?.code || "P001"}.pdf`,
        "PDF Document",
        ["pdf"]
      );
      toast.success("Sewage Pump Sizing PDF report exported successfully!");
    } catch (err: any) {
      console.error("PDF generation failed", err);
      toast.error(`Failed generating PDF report: ${err?.message || String(err)}`);
    }
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

  // Helper renderer for input boxes matching standard design
  const renderInputBox = (
    fieldId: string,
    label: string,
    value: number | string,
    unit: string,
    step: string = "1",
    min: number = 0,
    defaultVal: number,
    onChangeVal: (v: any) => void,
    subtitle?: string
  ) => {
    const isHighlighted = highlightedTargetId === fieldId;
    const comments = commentsMap[fieldId] || [];

    return (
      <ContextMenu key={fieldId}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${fieldId}`}
            className={`p-3 rounded-xl border transition-all relative ${
              isHighlighted
                ? "ring-2 ring-primary bg-blue-50/40 dark:bg-blue-950/30 border-primary"
                : "bg-slate-50/70 dark:bg-slate-900/50 border-border/80 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground tracking-tight">
                {label}
              </label>
              <div className="flex items-center gap-1">
                {comments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCommentTarget({ id: fieldId, label })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    title={`${comments.length} comment(s)`}
                  >
                    <MessageSquare className="size-3 fill-primary/20" />
                    <span>{comments.length}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step={step}
                min={min}
                disabled={isEffectiveReadOnly}
                value={value}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                  onChangeVal(val);
                }}
                className="w-full bg-background border border-border/90 rounded-lg px-3 py-1.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition disabled:opacity-60"
              />
              <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap min-w-[35px]">
                {unit}
              </span>
            </div>
            {subtitle && (
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {subtitle}
              </span>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50 font-sans">
          <ContextMenuItem
            onClick={() => setActiveCommentTarget({ id: fieldId, label })}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium text-[13px]"
          >
            <MessageSquare className="size-3.5" />
            <span>Add / View Comment</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => copyToClipboard(value)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
          </ContextMenuItem>
          {!isEffectiveReadOnly && (
            <>
              <ContextMenuSeparator className="h-px bg-border my-1" />
              <ContextMenuItem
                onClick={() => onChangeVal(defaultVal)}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-muted-foreground text-[13px]"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset Default ({defaultVal})</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // Helper renderer for select boxes with context menu
  const renderSelectBox = (
    fieldId: string,
    label: string,
    value: string | number,
    options: { label: string; value: string | number }[],
    defaultVal: string | number,
    onChangeVal: (v: any) => void,
    subtitle?: string
  ) => {
    const isHighlighted = highlightedTargetId === fieldId;
    const comments = commentsMap[fieldId] || [];

    return (
      <ContextMenu key={fieldId}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${fieldId}`}
            className={`p-3 rounded-xl border transition-all relative ${
              isHighlighted
                ? "ring-2 ring-primary bg-blue-50/40 dark:bg-blue-950/30 border-primary"
                : "bg-slate-50/70 dark:bg-slate-900/50 border-border/80 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground tracking-tight">
                {label}
              </label>
              <div className="flex items-center gap-1">
                {comments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCommentTarget({ id: fieldId, label })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    title={`${comments.length} comment(s)`}
                  >
                    <MessageSquare className="size-3 fill-primary/20" />
                    <span>{comments.length}</span>
                  </button>
                )}
              </div>
            </div>

            <select
              disabled={isEffectiveReadOnly}
              value={value}
              onChange={(e) => onChangeVal(parseFloat(e.target.value) || e.target.value)}
              className="w-full bg-background border border-border/90 rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition cursor-pointer disabled:opacity-60"
            >
              {options.map((opt) => (
                <option key={String(opt.value)} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {subtitle && (
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {subtitle}
              </span>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50 font-sans">
          <ContextMenuItem
            onClick={() => setActiveCommentTarget({ id: fieldId, label })}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium text-[13px]"
          >
            <MessageSquare className="size-3.5" />
            <span>Add / View Comment</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => copyToClipboard(value)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
          </ContextMenuItem>
          {!isEffectiveReadOnly && (
            <>
              <ContextMenuSeparator className="h-px bg-border my-1" />
              <ContextMenuItem
                onClick={() => onChangeVal(defaultVal)}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-muted-foreground text-[13px]"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset Default ({defaultVal})</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // Helper renderer for pumping arrangement mode
  const renderArrangementBox = () => {
    const isHighlighted = highlightedTargetId === "pumpingArrangement";
    const comments = commentsMap["pumpingArrangement"] || [];

    return (
      <ContextMenu key="pumpingArrangement">
        <ContextMenuTrigger asChild>
          <div
            id="field-pumpingArrangement"
            className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs relative ${
              isHighlighted
                ? "ring-2 ring-primary bg-blue-50/40 dark:bg-blue-950/30 border-primary"
                : "bg-slate-50/70 dark:bg-slate-900/50 border-border/80 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground block">Pumping Arrangement</span>
                {comments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCommentTarget({ id: "pumpingArrangement", label: "Pumping Arrangement" })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                  >
                    <MessageSquare className="size-3 fill-primary/20" />
                    <span>{comments.length}</span>
                  </button>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">100% Standby redundancy mode</span>
            </div>
            <div className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-border/80">
              <button
                type="button"
                disabled={isEffectiveReadOnly}
                onClick={() => {
                  setPumpCountMode("1W_1S");
                  saveState({ pumpCountMode: "1W_1S" });
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  pumpCountMode === "1W_1S"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Duplex (1W+1S)
              </button>
              <button
                type="button"
                disabled={isEffectiveReadOnly}
                onClick={() => {
                  setPumpCountMode("2W_1S");
                  saveState({ pumpCountMode: "2W_1S" });
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  pumpCountMode === "2W_1S"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Triplex (2W+1S)
              </button>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50 font-sans">
          <ContextMenuItem
            onClick={() => setActiveCommentTarget({ id: "pumpingArrangement", label: "Pumping Arrangement" })}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium text-[13px]"
          >
            <MessageSquare className="size-3.5" />
            <span>Add / View Comment</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => copyToClipboard(pumpCountMode === "1W_1S" ? "Duplex (1W+1S)" : "Triplex (2W+1S)")}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
          </ContextMenuItem>
          {!isEffectiveReadOnly && (
            <>
              <ContextMenuSeparator className="h-px bg-border my-1" />
              <ContextMenuItem
                onClick={() => {
                  setPumpCountMode("1W_1S");
                  saveState({ pumpCountMode: "1W_1S" });
                }}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-muted-foreground text-[13px]"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset Default (Duplex 1W+1S)</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <AppShell title="Sewage Pump Sizing" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Page Header & Actions */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sewage Pump Sizing</h1>
              
              {/* Intelligence Trigger Button */}
              <button 
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Sewage Pump Sizing Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>

              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-sewage-pump" calculatorTitle="Sewage Pump Sizing" />
            </div>

            {/* Unit System Toggle in Header inline with Approve / Reject */}
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* Main Content Card Container */}
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
                    Pump Sizer
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
                  onClick={() => setFormulaModalOpen(true)}
                  title="Detailed Formulas & Sizing Derivations"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>

                <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

                {/* Sewage Application Preset Dropdown */}
                <SewagePresetSelect
                  value={preset}
                  customProfileName={customProfileName}
                  onChange={handleApplyPreset}
                  onOpenCustomModal={() => setCustomModalOpen(true)}
                  unitSystem={unitSystem}
                  disabled={isEffectiveReadOnly}
                />
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
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-8">
                    
                    {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                    <div className="lg:col-span-5 space-y-5">
                      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                            🕹 SIZING PARAMETERS
                          </span>
                        </div>

                        {/* Section 1: Sanitary Inflow & Pumping Criteria */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-inflowParams"
                              data-field-id="inflowParams"
                              data-comment-target="inflowParams"
                              className={`space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("inflowParams", "Sanitary Inflow")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Sanitary Inflow &amp; Pumping Duty
                                  </span>
                                  {renderCommentBadge("inflowParams", "Sanitary Inflow")}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                  Peak Sanitary Inflow Rate (Q_in) ({isSI ? "L/s" : "GPM"})
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={0.1}
                                  disabled={isEffectiveReadOnly}
                                  value={isSI && typeof inflow === "number" ? parseFloat((inflow * GPM_TO_LPS).toFixed(2)) : inflow}
                                  onChange={(e) => {
                                    const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (v === "") setInflow("");
                                    else if (isSI) setInflow(v / GPM_TO_LPS);
                                    else setInflow(v);
                                    saveState({ inflow: isSI ? v / GPM_TO_LPS : v });
                                  }}
                                  className={flowInputClass}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Drawdown Factor (x)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min={1.0}
                                    disabled={isEffectiveReadOnly}
                                    value={flowMultiplier}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 1.5;
                                      setFlowMultiplier(v);
                                      saveState({ flowMultiplier: v });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Cycle Time (min)</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min={2}
                                    disabled={isEffectiveReadOnly}
                                    value={cycle}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 6;
                                      setCycle(v);
                                      saveState({ cycle: v });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                              </div>

                              {/* Pumping Arrangement Mode */}
                              <div className="flex items-center justify-between pt-1 text-xs">
                                <span className="text-[11px] text-slate-500">Arrangement:</span>
                                <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                                  <button
                                    type="button"
                                    disabled={isEffectiveReadOnly}
                                    onClick={() => {
                                      setPumpCountMode("1W_1S");
                                      saveState({ pumpCountMode: "1W_1S" });
                                    }}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                      pumpCountMode === "1W_1S"
                                        ? "bg-white dark:bg-zinc-700 text-foreground shadow-xs font-bold"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    Duplex (1W+1S)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isEffectiveReadOnly}
                                    onClick={() => {
                                      setPumpCountMode("2W_1S");
                                      saveState({ pumpCountMode: "2W_1S" });
                                    }}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                      pumpCountMode === "2W_1S"
                                        ? "bg-white dark:bg-zinc-700 text-foreground shadow-xs font-bold"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    Triplex (2W+1S)
                                  </button>
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => {
                                setInflow(isSI ? 3.15 / GPM_TO_LPS : 50);
                                setFlowMultiplier(2.0);
                                setCycle(6);
                                setPumpCountMode("1W_1S");
                                saveState({ inflow: isSI ? 3.15 / GPM_TO_LPS : 50, flowMultiplier: 2.0, cycle: 6, pumpCountMode: "1W_1S" });
                                toast.success("Inflow parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Inflow Criteria</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "inflowParams", label: "Sanitary Inflow" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 2: Piping & Dynamic Head */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-sewagePiping"
                              data-field-id="sewagePiping"
                              data-comment-target="sewagePiping"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("sewagePiping", "Piping & Head")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Piping Layout &amp; Dynamic Head
                                  </span>
                                  {renderCommentBadge("sewagePiping", "Piping & Head")}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Static Lift ({isSI ? "m" : "ft"})</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof lift === "number" ? parseFloat((lift * FT_TO_M).toFixed(2)) : lift}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setLift("");
                                      else if (isSI) setLift(v / FT_TO_M);
                                      else setLift(v);
                                      saveState({ lift: isSI ? v / FT_TO_M : v });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Discharge Pipe Size</label>
                                  <div className="relative mt-1">
                                    <select
                                      disabled={isEffectiveReadOnly}
                                      value={pipeDia}
                                      onChange={(e) => {
                                        const v = parseFloat(e.target.value) || 3.0;
                                        setPipeDia(v);
                                        saveState({ pipeDia: v });
                                      }}
                                      className={selectClass}
                                    >
                                      <option value="2">2.0" NPS (50mm)</option>
                                      <option value="2.5">2.5" NPS (65mm)</option>
                                      <option value="3">3.0" NPS (80mm)</option>
                                      <option value="4">4.0" NPS (100mm)</option>
                                      <option value="6">6.0" NPS (150mm)</option>
                                    </select>
                                    {!isEffectiveReadOnly && (
                                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Pipe Length ({isSI ? "m" : "ft"})</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof pipeLen === "number" ? parseFloat((pipeLen * FT_TO_M).toFixed(1)) : pipeLen}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setPipeLen("");
                                      else if (isSI) setPipeLen(v / FT_TO_M);
                                      else setPipeLen(v);
                                      saveState({ pipeLen: isSI ? v / FT_TO_M : v });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Fittings Head ({isSI ? "m" : "ft"})</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof fittingsHead === "number" ? parseFloat((fittingsHead * FT_TO_M).toFixed(1)) : fittingsHead}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setFittingsHead("");
                                      else if (isSI) setFittingsHead(v / FT_TO_M);
                                      else setFittingsHead(v);
                                      saveState({ fittingsHead: isSI ? v / FT_TO_M : v });
                                    }}
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
                                setLift(isSI ? 7.62 / FT_TO_M : 25);
                                setPipeDia(3.0);
                                setPipeLen(isSI ? 19.8 / FT_TO_M : 65);
                                setFittingsHead(isSI ? 1.83 / FT_TO_M : 6.0);
                                saveState({ lift: isSI ? 7.62 / FT_TO_M : 25, pipeDia: 3.0, pipeLen: isSI ? 19.8 / FT_TO_M : 65, fittingsHead: isSI ? 1.83 / FT_TO_M : 6.0 });
                                toast.success("Piping parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Piping &amp; Head</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "sewagePiping", label: "Piping & Head" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 3: Wet Well Basin & Efficiency */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-basinEfficiency"
                              data-field-id="basinEfficiency"
                              data-comment-target="basinEfficiency"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("basinEfficiency", "Basin & Efficiency")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Wet Well Sump &amp; Efficiency
                                  </span>
                                  {renderCommentBadge("basinEfficiency", "Basin & Efficiency")}
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] text-slate-500">Basin Internal Diameter (Ø)</label>
                                <div className="relative mt-1">
                                  <select
                                    disabled={isEffectiveReadOnly}
                                    value={basinDia}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 36;
                                      setBasinDia(v);
                                      saveState({ basinDia: v });
                                    }}
                                    className={selectClass}
                                  >
                                    <option value="24">24" Ø (600mm)</option>
                                    <option value="30">30" Ø (750mm)</option>
                                    <option value="36">36" Ø (900mm)</option>
                                    <option value="42">42" Ø (1050mm)</option>
                                    <option value="48">48" Ø (1200mm)</option>
                                    <option value="60">60" Ø (1500mm)</option>
                                    <option value="72">72" Ø (1800mm)</option>
                                  </select>
                                  {!isEffectiveReadOnly && (
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Pump Efficiency (%)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min={30}
                                    disabled={isEffectiveReadOnly}
                                    value={pumpEfficiency}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 60;
                                      setPumpEfficiency(v);
                                      saveState({ pumpEfficiency: v });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Motor Efficiency (%)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min={50}
                                    disabled={isEffectiveReadOnly}
                                    value={motorEfficiency}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 85;
                                      setMotorEfficiency(v);
                                      saveState({ motorEfficiency: v });
                                    }}
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
                                setBasinDia(36);
                                setPumpEfficiency(60);
                                setMotorEfficiency(85);
                                saveState({ basinDia: 36, pumpEfficiency: 60, motorEfficiency: 85 });
                                toast.success("Basin and efficiency reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Basin &amp; Efficiency</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "basinEfficiency", label: "Basin & Efficiency" })}
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
                    <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-calculation-results"
                            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5 transition-all hover:border-slate-300 dark:hover:border-zinc-700"
                          >
                            
                            {/* Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2">
                                <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                  ⚡ Sizing Results Summary
                                </span>
                              </div>

                              {/* Status Badge */}
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                calcResults.isScouringCompliant && calcResults.isSolidsCompliant
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              }`}>
                                {calcResults.isScouringCompliant ? <ShieldCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                                <span>{calcResults.isScouringCompliant ? "Self-Scouring (≥ 2.0 ft/s)" : "Low Velocity (< 2 ft/s)"}</span>
                              </span>
                            </div>

                            {/* 4 Colorful Top Metric Tiles (Matching Pump Sizing) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              
                              {/* Tile 1: Duty Flow (Blue) */}
                              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Design Duty Flow</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI
                                    ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)}`
                                    : `${calcResults.dutyFlowPerPump.toFixed(1)}`}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {isSI ? "L/s" : "GPM"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{calcResults.mult}x peak inflow</span>
                              </div>

                              {/* Tile 2: Total Dynamic Head (Amber) */}
                              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Dynamic Head (TDH)</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI
                                    ? `${(calcResults.tdh * FT_TO_M).toFixed(1)}`
                                    : `${calcResults.tdh.toFixed(1)}`}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {isSI ? "m" : "ft"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">+{calcResults.sf}% safety margin</span>
                              </div>

                              {/* Tile 3: Motor Rating (Emerald) */}
                              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Motor Rating</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI
                                    ? `${calcResults.recommendedMotorKW.toFixed(2)}`
                                    : `${calcResults.recommendedMotorHP}`}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {isSI ? "kW" : "HP"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">BHP: {calcResults.bhp.toFixed(2)} HP</span>
                              </div>

                              {/* Tile 4: Active Sump Volume (Purple) */}
                              <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Active Sump Vol</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI
                                    ? `${calcResults.activeVolM3.toFixed(2)}`
                                    : `${calcResults.activeVolGal.toFixed(0)}`}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {isSI ? "m³" : "Gal"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">{calcResults.dBasin}" Ø basin</span>
                              </div>

                            </div>

                            {/* DETAILED HYDRAULICS SUMMARY TABLE */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Pumping Redundancy Mode:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {pumpCountMode === "1W_1S" ? "Duplex (1 Duty + 1 Standby)" : "Triplex (2 Duty + 1 Standby)"}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Discharge Fluid Velocity:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {calcResults.velocityFps.toFixed(2)} ft/s ({calcResults.velocityMs.toFixed(2)} m/s)
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Friction Head Loss (H_fric):</span>
                                <span className="font-mono font-bold text-foreground">
                                  {isSI ? `${(calcResults.frictionHead * FT_TO_M).toFixed(2)} m` : `${calcResults.frictionHead.toFixed(2)} ft`}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Active Liquid Depth:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {isSI ? `${(calcResults.activeDepthInches * IN_TO_MM).toFixed(0)} mm` : `${calcResults.activeDepthInches.toFixed(1)} inches`}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Total Wet Well Dimensions:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {calcResults.dBasin}" Ø × {isSI ? `${(calcResults.totalBasinDepthInches * IN_TO_MM).toFixed(0)} mm` : `${calcResults.totalBasinDepthInches.toFixed(0)}" Depth`}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 font-bold text-foreground">
                                <span>Estimated Motor Rating:</span>
                                <span className="font-mono text-primary text-sm">
                                  {isSI
                                    ? `${calcResults.recommendedMotorKW.toFixed(2)} kW (${calcResults.recommendedMotorHP} HP)`
                                    : `${calcResults.recommendedMotorHP} HP (${calcResults.recommendedMotorKW.toFixed(2)} kW)`}
                                </span>
                              </div>
                            </div>

                            {/* Verification Banner */}
                            <div className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                              calcResults.isScouringCompliant && calcResults.isSolidsCompliant
                                ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200"
                                : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200"
                            }`}>
                              {calcResults.isScouringCompliant && calcResults.isSolidsCompliant ? (
                                <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                              ) : (
                                <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                              )}
                              <div>
                                <strong className="text-[12px] block">
                                  {calcResults.isScouringCompliant && calcResults.isSolidsCompliant ? "Sewage Hydraulics Verified:" : "Hydraulic Velocity Advisory:"}
                                </strong>
                                <p className="mt-0.5 leading-relaxed text-[11.5px]">
                                  {calcResults.isScouringCompliant && calcResults.isSolidsCompliant
                                    ? `Discharge velocity of ${calcResults.velocityFps.toFixed(2)} ft/s (${calcResults.velocityMs.toFixed(2)} m/s) satisfies IPC 712.4 self-scouring requirements and limits cycle frequency to ${calcResults.calculatedStartsPerHour.toFixed(1)} starts/hr.`
                                    : `Discharge velocity (${calcResults.velocityFps.toFixed(2)} ft/s) is below 2.0 ft/s minimum self-scouring speed per IPC 712.4.`}
                                </p>
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
                            onClick={() => copyToClipboard(`Duty Flow: ${isSI ? (calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2) + " L/s" : calcResults.dutyFlowPerPump.toFixed(1) + " GPM"}, TDH: ${isSI ? (calcResults.tdh * FT_TO_M).toFixed(1) + " m" : calcResults.tdh.toFixed(1) + " ft"}`)}
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
                <SewagePumpReportView
                  calcResults={calcResults}
                  project={project}
                  calcReviewState={calcReviewState}
                  currentUserName={currentUserName}
                  isSI={isSI}
                  pipeLen={typeof pipeLen === "number" ? pipeLen : 65}
                  pumpEfficiency={typeof pumpEfficiency === "number" ? pumpEfficiency : 60}
                  pumpCountMode={pumpCountMode}
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
            <SewagePumpIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calcResults={calcResults}
              preset={preset}
              onSelectPreset={handleApplyPreset}
              isEffectiveReadOnly={isEffectiveReadOnly}
              unitSystem={unitSystem}
              setFormulaModalOpen={setFormulaModalOpen}
            />
          )}
        </div>
      </div>

      {/* Custom Sewage Pump Configuration Modal */}
      {customModalOpen && (
        <CustomSewagePumpConfigModal
          isOpen={customModalOpen}
          onClose={() => setCustomModalOpen(false)}
          unitSystem={unitSystem}
          currentValues={{
            inflow,
            flowMultiplier,
            cycle,
            starts,
            lift,
            pipeDia,
            pipeLen,
            fittingsHead,
            safetyFactor,
            basinDia,
            pumpEfficiency,
            motorEfficiency,
            pumpCountMode,
            customProfileName,
            customWorkflow,
          }}
          onApply={handleApplyCustomConfig}
        />
      )}

      {/* Mathematical Formula Modal */}
      {formulaModalOpen && (
        <SewagePumpFormulaModal
          onClose={() => setFormulaModalOpen(false)}
          calcResults={calcResults}
          preset={preset}
          unitSystem={unitSystem}
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

// Preliminary Report View Component
function SewagePumpReportView({
  calcResults,
  project,
  calcReviewState,
  currentUserName,
  isSI,
  pipeLen,
  pumpEfficiency,
  pumpCountMode,
}: {
  calcResults: any;
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  isSI: boolean;
  pipeLen: number;
  pumpEfficiency: number;
  pumpCountMode: "1W_1S" | "2W_1S";
}) {
  const calcNo = `CALC-SEW-${project?.code || "001"}`;
  const projectNo = project?.code || "PRJ-001";
  const projectName = project?.name || "Sewage Lift Station Sizing Project";
  const clientName = (project as any)?.client || "Client Representative";
  const endUser = (project as any)?.endUser || "Building Facilities / MEP Department";
  const today = formatDateStr(new Date().toISOString());

  const sigDetails = getSignatureBlockDetails(calcReviewState, currentUserName);
  const isPassed = calcResults.isScouringCompliant && calcResults.isSolidsCompliant;

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50 no-print">
        <span className="text-[12px] text-muted-foreground font-semibold">
          Generated: <span className="text-foreground font-mono">{today}</span>
        </span>
      </div>

      {/* Main Report Document Sheet */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
        <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6 font-sans">
          
          {/* Header Title & Date */}
          <div className="flex justify-between items-start pb-4 border-b border-border">
            <div>
              <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                Sewage Pump Sizing Preliminary Report
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Design Standards: IPC 709 / IPC 712 / ASPE Chapter 7 Wet Well Sizing
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block font-mono">Date: {today}</span>
            </div>
          </div>

          {/* Enclosed Project Metadata Grid (3 rows x 2 cols) */}
          <div className="border border-border rounded-xl overflow-hidden text-[12px]">
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/20">
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Calculation No.:</span>
                <span className="text-muted-foreground font-mono">{calcNo}</span>
              </div>
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Date:</span>
                <span className="text-muted-foreground">{today}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Project No.:</span>
                <span className="text-muted-foreground">{projectNo}</span>
              </div>
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Client:</span>
                <span className="text-muted-foreground">{clientName}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">Project Name:</span>
                <span className="text-muted-foreground">{projectName}</span>
              </div>
              <div className="p-2.5 px-3 flex justify-between">
                <span className="font-bold text-foreground">End User:</span>
                <span className="text-muted-foreground">{endUser}</span>
              </div>
            </div>
          </div>

          {/* Table 1: Design Parameters & Inflow Criteria */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              1. Sanitary Inflow &amp; Piping Design Parameters
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                      <th className="py-2 px-2.5 w-10">Sr.</th>
                      <th className="py-2 px-3 text-left">Parameter Description</th>
                      <th className="py-2 px-3 text-center w-32">Design Value</th>
                      <th className="py-2 px-3 text-center w-36">Equivalent</th>
                      <th className="py-2 px-3 text-left">Standard / Code Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">1</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Peak Sanitary Inflow Rate (Q_in)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{isSI ? `${(calcResults.qIn * GPM_TO_LPS).toFixed(2)} L/s` : `${calcResults.qIn.toFixed(1)} GPM`}</td>
                      <td className="py-2 px-3 text-center font-mono">{isSI ? `${calcResults.qIn.toFixed(1)} GPM` : `${(calcResults.qIn * GPM_TO_LPS).toFixed(2)} L/s`}</td>
                      <td className="py-2 px-3 text-muted-foreground">IPC Table 709.1 Sanitary Drainage Load</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">2</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Pump Drawdown Factor</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{calcResults.mult.toFixed(2)}x</td>
                      <td className="py-2 px-3 text-center font-mono">{(calcResults.mult * 100).toFixed(0)}%</td>
                      <td className="py-2 px-3 text-muted-foreground">ASPE Chapter 7 Multiplier (1.5x – 2.0x)</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">3</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Target Pump Cycle Time (t)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{calcResults.tCycle.toFixed(1)} min</td>
                      <td className="py-2 px-3 text-center font-mono">{(calcResults.tCycle * 60).toFixed(0)} sec</td>
                      <td className="py-2 px-3 text-muted-foreground">Desired interval between successive starts</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">4</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Static Elevation Lift (H_static)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{isSI ? `${(calcResults.hStatic * FT_TO_M).toFixed(2)} m` : `${calcResults.hStatic.toFixed(1)} ft`}</td>
                      <td className="py-2 px-3 text-center font-mono">{isSI ? `${calcResults.hStatic.toFixed(1)} ft` : `${(calcResults.hStatic * FT_TO_M).toFixed(2)} m`}</td>
                      <td className="py-2 px-3 text-muted-foreground">Basin invert to gravity discharge point</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">5</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Discharge Pipe Diameter (D)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{isSI ? `${(calcResults.dPipe * IN_TO_MM).toFixed(0)} mm` : `${calcResults.dPipe.toFixed(1)}" NPS`}</td>
                      <td className="py-2 px-3 text-center font-mono">{isSI ? `${calcResults.dPipe.toFixed(1)}" NPS` : `${(calcResults.dPipe * IN_TO_MM).toFixed(0)} mm`}</td>
                      <td className="py-2 px-3 text-muted-foreground">IPC 712.4.2 Solids Clearance (Min 2.0" / 3.0")</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">6</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Total Developed Pipe Length (L)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{isSI ? `${(pipeLen * FT_TO_M).toFixed(1)} m` : `${pipeLen.toFixed(1)} ft`}</td>
                      <td className="py-2 px-3 text-center font-mono">{isSI ? `${pipeLen.toFixed(1)} ft` : `${(pipeLen * FT_TO_M).toFixed(1)} m`}</td>
                      <td className="py-2 px-3 text-muted-foreground">Isometric developed piping run</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">7</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Wet Well Basin Diameter (Ø)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{isSI ? `${(calcResults.dBasin * IN_TO_MM).toFixed(0)} mm` : `${calcResults.dBasin.toFixed(1)}" Ø`}</td>
                      <td className="py-2 px-3 text-center font-mono">{isSI ? `${calcResults.dBasin.toFixed(1)}" Ø` : `${(calcResults.dBasin * IN_TO_MM).toFixed(0)} mm`}</td>
                      <td className="py-2 px-3 text-muted-foreground">Duplex submersible clearance dimension</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Table 2: Hydraulic Sizing Output Summary */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              2. Hydraulic Sizing &amp; Wet Well Output Evaluation
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                      <th className="py-2 px-2.5 w-10">Sr.</th>
                      <th className="py-2 px-3 text-left">Metric / Sizing Parameter</th>
                      <th className="py-2 px-3 text-center w-40">Calculated Value</th>
                      <th className="py-2 px-3 text-center w-28">Allocation</th>
                      <th className="py-2 px-3 text-left">Formula &amp; Code Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground">
                      <td className="py-2 px-2.5 text-center font-mono">1</td>
                      <td className="py-2 px-3 text-primary">Required Pump Duty Flow (Q_pump)</td>
                      <td className="py-2 px-3 text-center font-mono text-primary font-bold text-xs">
                        {isSI
                          ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s`
                          : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">Duty Flow</td>
                      <td className="py-2 px-3 text-primary">Q_pump = Q_in × Multiplier</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">2</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Discharge Fluid Velocity (v)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">
                        {isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${calcResults.velocityFps.toFixed(2)} ft/s`}
                      </td>
                      <td className="py-2 px-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">
                        {calcResults.isScouringCompliant ? "Self-Scouring" : "Low Velocity"}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">≥ 2.0 ft/s (0.61 m/s) per IPC 712.4</td>
                    </tr>
                    <tr className="bg-[#DAE9F8]/60 dark:bg-[#0c2e47]/60 font-bold text-foreground">
                      <td className="py-2 px-2.5 text-center font-mono">3</td>
                      <td className="py-2 px-3 text-foreground font-bold">Total Dynamic Head (TDH)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-xs">
                        {isSI ? `${(calcResults.tdh * FT_TO_M).toFixed(1)} m` : `${calcResults.tdh.toFixed(1)} ft`}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">Dynamic Head</td>
                      <td className="py-2 px-3 text-muted-foreground">(H_static + H_fric + H_fit) × (1 + {calcResults.sf}%)</td>
                    </tr>
                    <tr className="bg-[#DAE9F8]/60 dark:bg-[#0c2e47]/60 font-bold text-foreground">
                      <td className="py-2 px-2.5 text-center font-mono">4</td>
                      <td className="py-2 px-3 text-foreground font-bold">Active Sump Volume (V_active)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-xs">
                        {isSI ? `${calcResults.activeVolM3.toFixed(2)} m³` : `${calcResults.activeVolGal.toFixed(0)} Gal`}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">Storage</td>
                      <td className="py-2 px-3 text-muted-foreground">V = (Q_pump × t_cycle) / 4 (ASPE 7)</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">5</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Recommended Motor Power Rating</td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-primary">
                        {isSI
                          ? `${calcResults.recommendedMotorKW.toFixed(2)} kW (${calcResults.recommendedMotorHP} HP)`
                          : `${calcResults.recommendedMotorHP} HP (${calcResults.recommendedMotorKW.toFixed(2)} kW)`}
                      </td>
                      <td className="py-2 px-3 text-center text-muted-foreground">Motor Power</td>
                      <td className="py-2 px-3 text-muted-foreground">NEMA Heavy-Duty Submersible Rating</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Status Verification Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
            isPassed
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
          }`}>
            <CheckCircle className={`size-5 shrink-0 ${isPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} mt-0.5`} />
            <div>
              <strong className="text-sm block">
                {isPassed ? "Sewage Pump Sizing Verification: PASSED (COMPLIANT)" : "Sewage Pump Sizing Verification: WARNING (CHECK VELOCITY/SOLIDS)"}
              </strong>
              <p className="mt-1 leading-relaxed text-xs">
                {isPassed
                  ? `Discharge velocity of ${calcResults.velocityFps.toFixed(2)} ft/s (${calcResults.velocityMs.toFixed(2)} m/s) satisfies self-scouring requirements (≥ 2.0 ft/s) and pipe size (${calcResults.dPipe}" NPS) complies with IPC 712.4 solids handling.`
                  : `Discharge velocity or pipe solids handling clearance is below IPC 712.4 thresholds. Please adjust pipe size or inflow parameters.`}
              </p>
            </div>
          </div>

          {/* Table 3: 4-Column Dynamic Signatures */}
          <div className="space-y-2 pt-2">
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                    <th className="py-2 px-3 w-32">Approvals</th>
                    <th className="py-2 px-3 text-center">Originated By</th>
                    <th className="py-2 px-3 text-center">Reviewed By</th>
                    <th className="py-2 px-3 text-center">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-sans">
                  <tr>
                    <td className="py-2 px-3 font-bold text-foreground text-right">Name / Role:</td>
                    <td className="py-2 px-3 text-center text-foreground font-medium">{sigDetails.originator?.name || sigDetails.originatedName || currentUserName}</td>
                    <td className="py-2 px-3 text-center text-foreground">{sigDetails.reviewer?.name || sigDetails.reviewerName || "-"}</td>
                    <td className="py-2 px-3 text-center text-foreground">{sigDetails.approver?.name || sigDetails.approverName || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-foreground text-right">Status:</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{sigDetails.originator?.status || "Signed"}</td>
                    <td className="py-2 px-3 text-center text-foreground">{sigDetails.reviewer?.status || (sigDetails.reviewerName ? "Reviewed" : "Pending")}</td>
                    <td className="py-2 px-3 text-center text-foreground">{sigDetails.approver?.status || (sigDetails.approverName ? "Approved" : "Pending")}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-foreground text-right">Date:</td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{sigDetails?.originatedDate || today}</td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{sigDetails?.reviewerDate || "-"}</td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{sigDetails?.approverDate || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Live Intelligence Drawer Component
function SewagePumpIntelligenceDrawer({
  onClose,
  calcResults,
  preset,
  onSelectPreset,
  isEffectiveReadOnly,
  unitSystem,
  setFormulaModalOpen,
}: {
  onClose: () => void;
  calcResults: any;
  preset: SewagePresetKey;
  onSelectPreset: (key: SewagePresetKey) => void;
  isEffectiveReadOnly: boolean;
  unitSystem: "ip" | "si";
  setFormulaModalOpen: (open: boolean) => void;
}) {
  const isSI = unitSystem === "si";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    compliance: true,
    presets: true,
    advisories: true,
  });

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  return (
    <div className="h-full flex flex-col bg-card select-none text-xs">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="font-bold text-foreground text-sm">Sewage Sizing Intelligence</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        
        {/* Section 1: IPC & ASPE Compliance Audit */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("compliance")}
            className="w-full p-3 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>Compliance &amp; Safety Audit</span>
            </div>
            {openSections.compliance ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {openSections.compliance && (
            <div className="p-3 space-y-2.5 bg-background">
              {/* Check 1: Scouring Velocity */}
              <div className="flex items-start gap-2 text-[11.5px]">
                {calcResults.isScouringCompliant ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-foreground">Discharge Scouring Velocity</div>
                  <div className="text-muted-foreground text-[10.5px]">
                    Current: <strong>{calcResults.velocityFps.toFixed(2)} ft/s ({calcResults.velocityMs.toFixed(2)} m/s)</strong>. IPC 712.4 mandates ≥ 2.0 ft/s (0.61 m/s).
                  </div>
                </div>
              </div>

              {/* Check 2: Minimum Pipe Size */}
              <div className="flex items-start gap-2 text-[11.5px]">
                {calcResults.isSolidsCompliant ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="size-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-foreground">Solids Passage Clearance</div>
                  <div className="text-muted-foreground text-[10.5px]">
                    Pipe size <strong>{calcResults.dPipe}" NPS</strong>. IPC 712.4.2 mandates min 2.0" discharge diameter.
                  </div>
                </div>
              </div>

              {/* Check 3: Motor Starts */}
              <div className="flex items-start gap-2 text-[11.5px]">
                {calcResults.calculatedStartsPerHour <= calcResults.maxStarts ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-foreground">Thermal Cycle Starts/Hour</div>
                  <div className="text-muted-foreground text-[10.5px]">
                    Calculated <strong>{calcResults.calculatedStartsPerHour.toFixed(1)} starts/hr</strong> (Limit: {calcResults.maxStarts} starts/hr max per NEMA MG-1).
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Application Profiles */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("presets")}
            className="w-full p-3 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>Application Profiles</span>
            </div>
            {openSections.presets ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {openSections.presets && (
            <div className="p-3 space-y-2 bg-background">
              {(Object.keys(SEWAGE_PRESETS) as SewagePresetKey[]).map((key) => {
                const p = SEWAGE_PRESETS[key];
                const isSelected = preset === key;
                return (
                  <div
                    key={key}
                    onClick={() => onSelectPreset(key)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-[11.5px]">{p.label}</span>
                      {isSelected && <span className="text-[10px] font-bold text-primary">ACTIVE</span>}
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5">{p.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-muted-foreground">
                      <span>Flow: {p.inflow} GPM</span>
                      <span>•</span>
                      <span>Lift: {p.lift} ft</span>
                      <span>•</span>
                      <span>Pipe: {p.pipeDia}"</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Engineering Advisories */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("advisories")}
            className="w-full p-3 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-500" />
              <span>Engineering Advisories</span>
            </div>
            {openSections.advisories ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {openSections.advisories && (
            <div className="p-3 space-y-2 bg-background text-[11px] text-muted-foreground">
              <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-bold text-foreground block mb-0.5">Check Valve Placement</span>
                Install a full-flow swing check valve and gate valve on the horizontal discharge of each pump before the header connection (IPC 712.4.3).
              </div>
              <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-bold text-foreground block mb-0.5">Basin Venting</span>
                Sump &amp; ejector basins must be gas-tight and vented with a minimum 2" vent pipe connecting through the building roof (IPC 712.4.1).
              </div>
              <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-bold text-foreground block mb-0.5">High Water Alarm</span>
                Provide an audio-visual high water alarm float set 6 inches below the gravity inlet invert.
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-card flex items-center justify-between">
        <button
          onClick={() => setFormulaModalOpen(true)}
          className="flex items-center gap-1.5 text-primary text-xs font-semibold hover:underline cursor-pointer"
        >
          <HelpCircle className="size-3.5" />
          <span>Formula Breakdown</span>
        </button>
        <span className="text-[10.5px] text-muted-foreground font-mono">IPC 712 / ASPE 7</span>
      </div>
    </div>
  );
}

// Mathematical Formula Breakdown Modal
function SewagePumpFormulaModal({
  onClose,
  calcResults,
  preset,
  unitSystem,
}: {
  onClose: () => void;
  calcResults: any;
  preset: SewagePresetKey;
  unitSystem: "ip" | "si";
}) {
  const isSI = unitSystem === "si";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">IPC &amp; ASPE Sewage Pump Mathematical Equations</h3>
              <p className="text-xs text-muted-foreground">Standard formulas applied in dynamic head, storage volume &amp; power sizing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 text-xs text-foreground">
          
          {/* Equation 1: Pump Duty Flow */}
          <div className="p-3.5 rounded-xl border border-border bg-slate-50 dark:bg-zinc-900 space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">1</span>
              <span>Pump Duty Flow (Q_pump)</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              ASPE Chapter 7 recommends a drawdown factor of 1.5x to 2.0x peak fixture drainage inflow:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              Q_pump = Q_inflow × Drawdown_Factor
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              Q_pump = {calcResults.qIn.toFixed(1)} GPM × {calcResults.mult.toFixed(2)} = {calcResults.dutyFlowPerPump.toFixed(1)} GPM ({ (calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2) } L/s)
            </p>
          </div>

          {/* Equation 2: Velocity */}
          <div className="p-3.5 rounded-xl border border-border bg-slate-50 dark:bg-zinc-900 space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">2</span>
              <span>Fluid Velocity &amp; Scouring (v)</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              IPC 712.4 requires a minimum self-scouring velocity of 2.0 ft/s (0.61 m/s):
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              v = (0.4085 × Q_pump) / (d_pipe)²  [fps]
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              v = (0.4085 × {calcResults.dutyFlowPerPump.toFixed(1)}) / ({calcResults.dPipe.toFixed(1)})² = {calcResults.velocityFps.toFixed(2)} ft/s ({calcResults.velocityMs.toFixed(2)} m/s)
            </p>
          </div>

          {/* Equation 3: Hazen-Williams Friction */}
          <div className="p-3.5 rounded-xl border border-border bg-slate-50 dark:bg-zinc-900 space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">3</span>
              <span>Friction Head Loss (Hazen-Williams)</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Standard friction calculation where C=120 for PVC/cast iron force mains:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              H_f = 0.002083 × L × (100 / C)^1.852 × (Q^1.852 / d^4.8655)
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              H_f = {calcResults.frictionHead.toFixed(2)} ft ({ (calcResults.frictionHead * FT_TO_M).toFixed(2) } m)
            </p>
          </div>

          {/* Equation 4: Active Volume */}
          <div className="p-3.5 rounded-xl border border-border bg-slate-50 dark:bg-zinc-900 space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">4</span>
              <span>Active Wet Well Sump Volume</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              ASPE wet well volumetric formula based on minimum pump cycle time:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              V_active = (Q_pump × t_cycle) / 4  [Gallons]
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              V_active = ({calcResults.dutyFlowPerPump.toFixed(1)} × {calcResults.tCycle}) / 4 = {calcResults.activeVolGal.toFixed(0)} Gal ({calcResults.activeVolM3.toFixed(2)} m³)
            </p>
          </div>

          {/* Equation 5: Motor Power */}
          <div className="p-3.5 rounded-xl border border-border bg-slate-50 dark:bg-zinc-900 space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">5</span>
              <span>Brake Horsepower &amp; Wire-to-Water Power</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Wire-to-water electrical rating selected to nearest NEMA standard motor:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              BHP = (Q_pump × TDH) / (3960 × η_pump)
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              BHP = ({calcResults.dutyFlowPerPump.toFixed(1)} × {calcResults.tdh.toFixed(1)}) / (3960 × {calcResults.effP || 0.6}) = {calcResults.bhp.toFixed(2)} BHP → Recommended: {calcResults.recommendedMotorHP} HP ({calcResults.recommendedMotorKW.toFixed(2)} kW)
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            Close Formula Guide
          </button>
        </div>
      </div>
    </div>
  );
}
