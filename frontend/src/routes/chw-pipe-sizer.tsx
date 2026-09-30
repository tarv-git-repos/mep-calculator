import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet,
  Save, RotateCcw, MessageSquare, FileText, Sparkles,
  Eye, Zap, X
} from "lucide-react";
import * as XLSX from "xlsx";
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
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { CalculationPreviewModal, type CalculationPreviewData } from "@/components/calculator-framework/CalculationPreviewModal";

export const Route = createFileRoute("/chw-pipe-sizer")({
  head: () => ({
    meta: [
      { title: "CHW Pipe Sizer — MEP Calc" },
      { name: "description", content: "Chilled water and condenser water pipe sizer based on flowrate, fluid properties, and target pressure drop." },
    ],
  }),
  component: ChwPipeSizerPage,
});

const pipeTable: Record<string, number> = {
  0.5: 15.80, 0.75: 20.93, 1.0: 26.64, 1.25: 35.05, 1.5: 40.89,
  2.0: 52.50, 2.5: 62.71, 3.0: 77.93, 3.5: 90.12, 4.0: 102.26,
  5.0: 128.19, 6.0: 154.05, 8.0: 202.72, 10.0: 254.46, 12.0: 303.23
};

const GLYCOL_VISC: Record<string, number> = { chw: 1, cw: 1, g25: 1.8, g40: 2.6 };
const GLYCOL_DENS: Record<string, number> = { chw: 1, cw: 1, g25: 1.03, g40: 1.05 };

const PIPE_MATERIALS: Record<string, { label: string; roughness: number }> = {
  steel: { label: "Carbon Steel", roughness: 0.000046 },
  copper: { label: "Copper", roughness: 0.0000015 },
  stainless: { label: "Stainless Steel", roughness: 0.000015 },
  hdpe: { label: "HDPE / PPR", roughness: 0.000007 },
};

export type CHWModePill = "primary_chw" | "secondary_chw" | "condenser_cw" | "district_cooling" | "glycol_loop";

interface CHWPreset {
  id: CHWModePill;
  name: string;
  flowRateSI: number;
  flowRateIP: number;
  fluidType: "chw" | "cw" | "g25" | "g40";
  tempSI: number;
  tempIP: number;
  targetDpSI: number;
  targetDpIP: number;
  material: "steel" | "copper" | "stainless" | "hdpe";
}

const CHW_PRESETS: Record<CHWModePill, CHWPreset> = {
  primary_chw: {
    id: "primary_chw",
    name: "Primary CHW Loop",
    flowRateSI: 5.0,
    flowRateIP: 80.0,
    fluidType: "chw",
    tempSI: 6.7,
    tempIP: 44.0,
    targetDpSI: 40,
    targetDpIP: 4.0,
    material: "steel",
  },
  secondary_chw: {
    id: "secondary_chw",
    name: "Secondary Riser",
    flowRateSI: 12.0,
    flowRateIP: 190.0,
    fluidType: "chw",
    tempSI: 6.7,
    tempIP: 44.0,
    targetDpSI: 50,
    targetDpIP: 3.5,
    material: "steel",
  },
  condenser_cw: {
    id: "condenser_cw",
    name: "Condenser Water",
    flowRateSI: 40.0,
    flowRateIP: 634.0,
    fluidType: "cw",
    tempSI: 32.0,
    tempIP: 89.6,
    targetDpSI: 45,
    targetDpIP: 3.0,
    material: "steel",
  },
  district_cooling: {
    id: "district_cooling",
    name: "District Cooling",
    flowRateSI: 60.0,
    flowRateIP: 951.0,
    fluidType: "chw",
    tempSI: 5.5,
    tempIP: 41.9,
    targetDpSI: 25,
    targetDpIP: 1.8,
    material: "steel",
  },
  glycol_loop: {
    id: "glycol_loop",
    name: "Glycol Loop",
    flowRateSI: 8.0,
    flowRateIP: 127.0,
    fluidType: "g25",
    tempSI: 4.0,
    tempIP: 39.2,
    targetDpSI: 60,
    targetDpIP: 4.0,
    material: "steel",
  },
};

function colebrook(Re: number, relR: number): number {
  if (Re <= 0) return 0.1;
  if (Re < 2300) return 64 / Re;
  let f = 0.25 / Math.pow(Math.log(relR / 3.7 + 5.74 / Math.pow(Re, 0.9)) / Math.LN10, 2);
  for (let i = 0; i < 80; i++) {
    const r = -2 * Math.log((relR / 3.7) + (2.51 / (Re * Math.sqrt(f)))) / Math.LN10;
    const fn = 1 / (r * r);
    if (Math.abs(fn - f) < 1e-10) {
      f = fn;
      break;
    }
    f = fn;
  }
  return f;
}

function waterDens(tC: number): number {
  return 999.842594 + 6.793952e-2 * tC - 9.09529e-3 * Math.pow(tC, 2) + 1.001685e-4 * Math.pow(tC, 3) - 1.120083e-6 * Math.pow(tC, 4) + 6.536332e-9 * Math.pow(tC, 5);
}

function waterVisc(tC: number): number {
  return 2.414e-5 * Math.pow(10, 247.8 / (tC + 406.15));
}

function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

function ChwPipeSizerPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/chw-pipe-sizer", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/chw-pipe-sizer", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const isApprovedLocked = useCalculationLock("/chw-pipe-sizer", project?.id);

  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [activeMode, setActiveMode] = useState<CHWModePill>("primary_chw");

  // Input states matching parameter list: Flow Rate, Fluid Type, Fluid Temp, Pipe Material, Target ΔP
  const [sizingParams, setSizingParams] = useState({
    flowRate: "80" as string | number,
    fluidType: "chw" as "chw" | "cw" | "g25" | "g40",
    temperature: "44" as string | number,
    pipeMaterial: "steel" as "steel" | "copper" | "stainless" | "hdpe",
    targetDp: "4.0" as string | number,
  });

  const [formulaModalOpen, setFormulaModalOpen] = useState<boolean>(false);

  // Comment System
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);

  const isSI = unitSystem === "si";
  const ip = unitSystem === "ip";

  useEffect(() => {
    const pId = project?.id || "default";
    const savedComments = localStorage.getItem(`mep_calc_comments_${pId}_/chw-pipe-sizer`);
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
    localStorage.setItem(`mep_calc_comments_${pId}_/chw-pipe-sizer`, JSON.stringify(newList));
    try {
      if (typeof forceSaveToCloud === "function") {
        forceSaveToCloud(true);
      }
    } catch (e) {}
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const newComment = {
      id: `cmt_${Date.now()}`,
      text: commentData.text,
      authorName: currentUserName,
      authorRole: profile?.role || "Engineer",
      timestamp: new Date().toISOString(),
      assignedUsers: commentData.assignedUsers || [],
      itemId: commentTargetItem?.id,
      spaceId: commentTargetItem?.id,
      targetId: commentTargetItem?.id,
      targetName: commentTargetItem?.name,
      calculatorTitle: "CHW Pipe Sizer",
      calculatorPath: "/chw-pipe-sizer",
      projectId: project?.id || "default",
      projectName: project?.name || "CHW Pipe Sizing",
    };
    const updated = [newComment, ...commentsList];
    saveComments(updated);
    toast.success(`Comment assigned on "${commentTargetItem?.name || "parameter"}"`);
    setCommentModalOpen(false);

    notifyCommentAssigned({
      comment: newComment,
      targetId: commentTargetItem?.id || "chw-pipe-sizer",
      targetName: commentTargetItem?.name || "CHW Pipe",
      targetType: "equipment",
      calculatorTitle: "CHW Pipe Sizer",
      calculatorPath: "/chw-pipe-sizer",
      project,
      currentUserName,
      currentUserId: userData?.id || profile?.id
    }).catch(console.error);
  };

  const saveParams = (params: typeof sizingParams, unit: "si" | "ip") => {
    setSizingParams(params);
    setUnitSystem(unit);
    try {
      localStorage.setItem("chw_pipe_sizer_params", JSON.stringify({ sizingParams: params, unitSystem: unit }));
      dirtyStore.set(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleModeChange = (modeKey: CHWModePill) => {
    setActiveMode(modeKey);
    const preset = CHW_PRESETS[modeKey];
    if (!preset) return;

    const nextParams = {
      ...sizingParams,
      flowRate: String(isSI ? preset.flowRateSI : preset.flowRateIP),
      fluidType: preset.fluidType,
      temperature: String(isSI ? preset.tempSI : preset.tempIP),
      targetDp: String(isSI ? preset.targetDpSI : preset.targetDpIP),
      pipeMaterial: preset.material,
    };
    saveParams(nextParams, unitSystem);
    toast.success(`Applied profile: ${preset.name}`);
  };

  const handleUnitToggle = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (targetUnit === unitSystem) return;

    let updatedParams = { ...sizingParams };

    if (shouldConvert) {
      const flowNum = parseFloat(String(sizingParams.flowRate));
      const dpNum = parseFloat(String(sizingParams.targetDp));
      const tempNum = parseFloat(String(sizingParams.temperature));

      if (targetUnit === "ip") {
        if (!isNaN(flowNum)) updatedParams.flowRate = (flowNum * 15.8503).toFixed(1);
        if (!isNaN(dpNum)) updatedParams.targetDp = (dpNum / 10).toFixed(1);
        if (!isNaN(tempNum)) updatedParams.temperature = (tempNum * 1.8 + 32).toFixed(1);
      } else {
        if (!isNaN(flowNum)) updatedParams.flowRate = (flowNum / 15.8503).toFixed(2);
        if (!isNaN(dpNum)) updatedParams.targetDp = (dpNum * 10).toFixed(0);
        if (!isNaN(tempNum)) updatedParams.temperature = (((tempNum - 32) * 5) / 9).toFixed(1);
      }
    }

    saveParams(updatedParams, targetUnit);
  };

  const handleSaveCalculation = () => {
    try {
      localStorage.setItem(`chw_pipe_sizer_saved_${project?.id || "default"}`, JSON.stringify({
        sizingParams,
        unitSystem,
        savedAt: new Date().toISOString()
      }));
      dirtyStore.set(false);
      if (typeof forceSaveToCloud === "function") forceSaveToCloud();
      toast.success("CHW Pipe Calculation saved successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  // Calculation logic
  const calculatedData = useMemo(() => {
    const flowVal = parseFloat(String(sizingParams.flowRate));
    const tRaw = parseFloat(String(sizingParams.temperature));
    const dpRaw = parseFloat(String(sizingParams.targetDp));

    const isValid = !isNaN(flowVal) && flowVal > 0 && !isNaN(tRaw) && !isNaN(dpRaw) && dpRaw > 0;

    if (!isValid) {
      return {
        isValid: false,
        flowVal: 0,
        tRaw: 0,
        dpRaw: 0,
        chosen: null,
        allPipes: [],
        rho: 1000,
        mu: 0.001
      };
    }

    const Q = ip ? flowVal * 6.30902e-5 : flowVal * 1e-3; // m³/s
    const tC = ip ? fToC(tRaw) : tRaw;
    const eps = PIPE_MATERIALS[sizingParams.pipeMaterial]?.roughness || 0.000046;
    const targetDpPaM = ip ? dpRaw * 29.89 : dpRaw; // 1 ft w.g./100ft ≈ 29.89 Pa/m

    const rho = waterDens(tC) * GLYCOL_DENS[sizingParams.fluidType];
    const mu = waterVisc(tC) * GLYCOL_VISC[sizingParams.fluidType];

    let chosen: any = null;
    const allPipes: any[] = [];

    for (const [nps, idMm] of Object.entries(pipeTable)) {
      const D = idMm / 1000; // m
      const A = (Math.PI * D * D) / 4; // m²
      const v = Q / A; // m/s
      const Re = (rho * v * D) / mu;
      const f = colebrook(Re, eps / D);
      const dpPaM = (f * rho * v * v) / (2 * D); // Pa/m
      const dpFt = dpPaM / 29.89; // ft w.g. / 100ft
      const vFps = v / 0.3048;
      const idIn = idMm / 25.4;
      const isCompliant = dpPaM <= targetDpPaM * 1.05;

      const rowObj = {
        nps: Number(nps),
        idMm,
        idIn,
        D,
        A,
        v,
        vFps,
        Re,
        f,
        dpPaM,
        dpFt,
        isCompliant,
        regime: Re > 4000 ? "Turbulent" : "Laminar"
      };
      allPipes.push(rowObj);

      if (!chosen && isCompliant) {
        chosen = rowObj;
      }
    }

    if (!chosen && allPipes.length > 0) {
      chosen = allPipes[allPipes.length - 1];
    }

    return {
      isValid: true,
      flowVal,
      tRaw,
      tC,
      dpRaw,
      rho,
      mu,
      chosen,
      allPipes
    };
  }, [sizingParams, unitSystem, ip]);

  // Step-by-step Formula Breakdown Data for Modal
  const calculationPreviewData: CalculationPreviewData = useMemo(() => {
    if (!calculatedData.chosen || !calculatedData.isValid) return null;
    const p = calculatedData.chosen;
    return {
      title: "CHW Pipe Sizing Step-by-Step Calculation",
      itemName: `CHW Pipe (${p.nps}" NPS)`,
      itemCode: `PIPE-${p.nps}`,
      standardReference: "ASHRAE Fundamentals Ch. 22 / Colebrook-White",
      inputs: [
        { label: "Flow Rate", value: `${calculatedData.flowVal} ${ip ? "GPM" : "L/s"}` },
        { label: "Fluid Type", value: sizingParams.fluidType.toUpperCase() },
        { label: "Fluid Temp", value: `${calculatedData.tRaw} ${ip ? "°F" : "°C"}` },
        { label: "Pipe Material", value: PIPE_MATERIALS[sizingParams.pipeMaterial]?.label || "Steel" },
        { label: "Target ΔP", value: `${calculatedData.dpRaw} ${ip ? "ft w.g./100ft" : "Pa/m"}` },
      ],
      steps: [
        {
          stepNumber: 1,
          label: "Fluid Density (ρ) & Dynamic Viscosity (μ)",
          formula: "ρ = ρ_water(T_c) × Glycol_Factor,  μ = μ_water(T_c) × Glycol_Factor",
          substitution: `T_c = ${calculatedData.tC.toFixed(1)} °C, Fluid = ${sizingParams.fluidType.toUpperCase()}`,
          result: `ρ = ${calculatedData.rho.toFixed(1)} kg/m³, μ = ${calculatedData.mu.toExponential(2)} Pa·s`,
          status: "info",
        },
        {
          stepNumber: 2,
          label: "Internal Cross-Sectional Area (A) & Mean Velocity (v)",
          formula: "A = (π × D²) / 4,  v = Q / A",
          substitution: `D = ${p.idMm} mm (${p.idIn.toFixed(3)} in), Q = ${(ip ? calculatedData.flowVal * 6.30902e-5 : calculatedData.flowVal * 1e-3).toExponential(3)} m³/s`,
          result: ip ? `${p.vFps.toFixed(2)} fps` : `${p.v.toFixed(2)} m/s`,
          status: "pass",
        },
        {
          stepNumber: 3,
          label: "Reynolds Number (Re) & Flow Regime",
          formula: "Re = (ρ × v × D) / μ",
          substitution: `Re = (${calculatedData.rho.toFixed(0)} × ${p.v.toFixed(2)} × ${p.D.toFixed(4)}) / ${calculatedData.mu.toExponential(2)}`,
          result: `${Math.round(p.Re).toLocaleString()} (${p.regime})`,
          status: p.Re > 4000 ? "pass" : "info",
        },
        {
          stepNumber: 4,
          label: "Colebrook Friction Factor (f)",
          formula: "1 / √f = -2 log10( (ε/D)/3.7 + 2.51/(Re √f) )",
          substitution: `ε = ${(PIPE_MATERIALS[sizingParams.pipeMaterial].roughness * 1000).toFixed(4)} mm, D = ${p.idMm} mm`,
          result: p.f.toFixed(4),
          status: "info",
        },
        {
          stepNumber: 5,
          label: "Darcy-Weisbach Pressure Drop Gradient (ΔP/L)",
          formula: "ΔP/L = (f × ρ × v²) / (2 × D)",
          substitution: `ΔP/L = (${p.f.toFixed(4)} × ${calculatedData.rho.toFixed(1)} × ${p.v.toFixed(2)}²) / (2 × ${p.D.toFixed(4)})`,
          result: ip ? `${p.dpFt.toFixed(2)} ft w.g./100ft` : `${p.dpPaM.toFixed(1)} Pa/m`,
          status: p.isCompliant ? "pass" : "warning",
        },
        {
          stepNumber: 6,
          label: "Optimal Pipe Size Selection",
          formula: "Select smallest NPS where ΔP/L ≤ Target ΔP",
          substitution: `Target ΔP = ${calculatedData.dpRaw} ${ip ? "ft w.g./100ft" : "Pa/m"}`,
          result: `NPS ${p.nps}" / DN ${p.idMm} mm`,
          status: p.isCompliant ? "pass" : "warning",
        }
      ],
      finalResultLabel: "Selected Pipe Size",
      finalResultValue: `NPS ${p.nps}" / DN ${p.idMm} mm`,
      finalResultUnit: ip ? `@ ${p.dpFt.toFixed(2)} ft/100ft, ${p.vFps.toFixed(2)} fps` : `@ ${p.dpPaM.toFixed(1)} Pa/m, ${p.v.toFixed(2)} m/s`,
      complianceNote: p.isCompliant ? "Fully compliant with ASHRAE & CIBSE hydronic limits." : "Pressure drop exceeds target limit.",
    };
  }, [calculatedData, sizingParams, ip]);

  const handleExportPDF = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;

      const doc = new jsPDF("p", "mm", "a4");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(10, 123, 199);
      doc.text("CHW PIPE SIZING REPORT", 14, 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Project: ${project?.name || "General Project"} | Date: ${new Date().toLocaleDateString()}`, 14, 24);

      const p = calculatedData.chosen;
      const tableData = [
        ["Flow Rate", `${calculatedData.flowVal} ${ip ? "GPM" : "L/s"}`],
        ["Fluid Type", sizingParams.fluidType.toUpperCase()],
        ["Operating Temperature", `${calculatedData.tRaw} ${ip ? "°F" : "°C"}`],
        ["Pipe Material", PIPE_MATERIALS[sizingParams.pipeMaterial]?.label || "Steel"],
        ["Target ΔP", `${calculatedData.dpRaw} ${ip ? "ft w.g./100ft" : "Pa/m"}`],
        ["SELECTED PIPE SIZE", p ? `NPS ${p.nps}" / DN ${p.idMm} mm` : "-"],
        ["Internal Diameter", p ? (ip ? `${p.idIn.toFixed(3)} in` : `${p.idMm} mm`) : "-"],
        ["Velocity", p ? (ip ? `${p.vFps.toFixed(2)} fps` : `${p.v.toFixed(2)} m/s`) : "-"],
        ["Pressure Drop", p ? (ip ? `${p.dpFt.toFixed(2)} ft/100ft` : `${p.dpPaM.toFixed(1)} Pa/m`) : "-"],
        ["Reynolds Number", p ? Math.round(p.Re).toLocaleString() : "-"],
        ["Flow Regime", p ? p.regime : "-"],
      ];

      autoTable(doc, {
        startY: 30,
        head: [["Parameter", "Design Value"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 3.5 },
      });

      const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : 120;
      addPdfSignatureBlock(doc, finalY, currentUserName, project?.id || "default", "chw-pipe-sizer");

      doc.save(`CHW_Pipe_Sizing_${Date.now()}.pdf`);
      toast.success("PDF Report generated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report.");
    }
  };

  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono text-xs font-semibold focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";
  const flowInputClass = "w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  return (
    <AppShell
      title="CHW Pipe Sizer"
      hideSubHeader={true}
    >
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Header Row matching Pump Sizing exactly */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">CHW Pipe Sizer</h1>
              </div>
              <button
                onClick={() => setIntelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar
                projectId={activeProjectId}
                calculatorPath="/chw-pipe-sizer"
                calculatorTitle="CHW Pipe Sizer"
              />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} />
            </div>
          </div>

          {/* White Card Frame matching Pump Sizing exactly */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED"
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
            : calcReviewState?.status === "REJECTED"
              ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
              : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            }`}>

            {/* Sub-header Bar: Mode Pills & Formula Breakdown button matching Pump Sizing */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  {(["primary_chw", "secondary_chw", "condenser_cw", "district_cooling", "glycol_loop"] as const).map((mode) => {
                    const active = activeMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => handleModeChange(mode)}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${active
                          ? "bg-background text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        {CHW_PRESETS[mode].name}
                      </button>
                    );
                  })}
                </div>

                {/* Formula Breakdown button */}
                <TBtn
                  onClick={() => setFormulaModalOpen(true)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Action Export Button matching Pump Sizing */}
              <div className="flex items-center gap-2">
                <TBtn onClick={handleExportPDF} title="Export PDF Report">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Sizing Parameters Grid and Results matching Pump Sizing styling exactly */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        📥 Sizing Parameters
                      </span>
                    </div>

                    {/* Flow Rate */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Flow Rate ({isSI ? "L/s" : "GPM"})
                      </label>
                      <input
                        type="number"
                        disabled={isEffectiveReadOnly || isApprovedLocked}
                        value={sizingParams.flowRate}
                        onChange={(e) => saveParams({ ...sizingParams, flowRate: e.target.value }, unitSystem)}
                        className={flowInputClass}
                        placeholder={isSI ? "e.g. 5.0" : "e.g. 80"}
                      />
                    </div>

                    {/* Fluid Type & Temp */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Fluid Type</label>
                        <select
                          disabled={isEffectiveReadOnly || isApprovedLocked}
                          value={sizingParams.fluidType}
                          onChange={(e) => saveParams({ ...sizingParams, fluidType: e.target.value as any }, unitSystem)}
                          className="w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#0A7BC7]"
                        >
                          <option value="chw">Chilled Water</option>
                          <option value="cw">Condenser Water</option>
                          <option value="g25">25% Ethylene Glycol</option>
                          <option value="g40">40% Ethylene Glycol</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Fluid Temp ({isSI ? "°C" : "°F"})</label>
                        <input
                          type="number"
                          disabled={isEffectiveReadOnly || isApprovedLocked}
                          value={sizingParams.temperature}
                          onChange={(e) => saveParams({ ...sizingParams, temperature: e.target.value }, unitSystem)}
                          className={flowInputClass}
                          placeholder={isSI ? "e.g. 6.7" : "e.g. 44"}
                        />
                      </div>
                    </div>

                    {/* Pipe Material & Target ΔP */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Pipe Material</label>
                        <select
                          disabled={isEffectiveReadOnly || isApprovedLocked}
                          value={sizingParams.pipeMaterial}
                          onChange={(e) => saveParams({ ...sizingParams, pipeMaterial: e.target.value as any }, unitSystem)}
                          className="w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#0A7BC7]"
                        >
                          {Object.entries(PIPE_MATERIALS).map(([k, m]) => (
                            <option key={k} value={k}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Target ΔP ({isSI ? "Pa/m" : "ft/100ft"})</label>
                        <input
                          type="number"
                          disabled={isEffectiveReadOnly || isApprovedLocked}
                          value={sizingParams.targetDp}
                          onChange={(e) => saveParams({ ...sizingParams, targetDp: e.target.value }, unitSystem)}
                          className={flowInputClass}
                          placeholder={isSI ? "e.g. 40" : "e.g. 4.0"}
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        ⚡ Sizing Results Summary
                      </span>
                    </div>

                    {/* 4 TOP DISPLAY STAT CARDS matching Pump Sizing layout exactly */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5">
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Selected Pipe Size</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {calculatedData.chosen ? `NPS ${calculatedData.chosen.nps}"` : "NaN"}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{calculatedData.chosen ? `(DN ${calculatedData.chosen.idMm})` : ""}</span>
                        </div>
                      </div>

                      <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5">
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Velocity</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {calculatedData.chosen ? (isSI ? `${calculatedData.chosen.v.toFixed(2)}` : `${calculatedData.chosen.vFps.toFixed(2)}`) : "NaN"}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{isSI ? "m/s" : "fps"}</span>
                        </div>
                      </div>

                      <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5">
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Pressure Drop</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {calculatedData.chosen ? (isSI ? `${calculatedData.chosen.dpPaM.toFixed(1)}` : `${calculatedData.chosen.dpFt.toFixed(2)}`) : "NaN"}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{isSI ? "Pa/m" : "ft/100ft"}</span>
                        </div>
                      </div>

                      <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5">
                        <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Reynolds Number</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {calculatedData.chosen ? Math.round(calculatedData.chosen.Re).toLocaleString() : "NaN"}
                        </div>
                      </div>
                    </div>

                    {/* DETAILED METRICS TABLE matching Pump Sizing */}
                    <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                        <span className="text-slate-600 dark:text-zinc-400">Internal Diameter:</span>
                        <span className="font-mono font-bold">
                          {calculatedData.chosen ? (isSI ? `${calculatedData.chosen.idMm} mm` : `${calculatedData.chosen.idIn.toFixed(3)} in (${calculatedData.chosen.idMm} mm)`) : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                        <span className="text-slate-600 dark:text-zinc-400">Flow Regime:</span>
                        <span className="font-mono font-bold">{calculatedData.chosen ? calculatedData.chosen.regime : "-"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                        <span className="text-slate-600 dark:text-zinc-400">Darcy Friction Factor (f):</span>
                        <span className="font-mono font-bold">{calculatedData.chosen ? calculatedData.chosen.f.toFixed(4) : "-"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                        <span className="text-slate-600 dark:text-zinc-400">Fluid Density (ρ) &amp; Viscosity (μ):</span>
                        <span className="font-mono font-bold">{calculatedData.rho.toFixed(1)} kg/m³ | {calculatedData.mu.toExponential(2)} Pa·s</span>
                      </div>
                      <div className="flex justify-between py-1 font-bold text-foreground">
                        <span>Optimal Pipe Specification:</span>
                        <span className="font-mono text-[#0A7BC7]">
                          {calculatedData.chosen ? `NPS ${calculatedData.chosen.nps}" / DN ${calculatedData.chosen.idMm} mm Pipe` : "-"}
                        </span>
                      </div>
                    </div>

                    {/* PIPING SIZING SCHEDULE TABLE */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wide">
                          Piping Sizing Schedule
                        </span>
                        <span className="text-[11px] text-muted-foreground">Colebrook-White friction model</span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-[11px] font-sans text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-zinc-800 font-bold text-foreground border-b border-slate-200 dark:border-zinc-700">
                              <th className="p-2 text-center">NPS</th>
                              <th className="p-2 text-center">ID ({isSI ? "mm" : "in"})</th>
                              <th className="p-2 text-right">Velocity</th>
                              <th className="p-2 text-right">Pressure Drop</th>
                              <th className="p-2 text-right">Reynolds</th>
                              <th className="p-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-mono">
                            {calculatedData.allPipes.map((p) => {
                              const isChosen = calculatedData.chosen?.nps === p.nps;
                              return (
                                <tr key={p.nps} className={`hover:bg-slate-50 dark:hover:bg-zinc-800/50 ${isChosen ? "bg-primary/10 font-bold" : ""}`}>
                                  <td className="p-2 text-center font-bold font-sans">{p.nps}"</td>
                                  <td className="p-2 text-center">{isSI ? p.idMm : p.idIn.toFixed(3)}</td>
                                  <td className="p-2 text-right">{isSI ? `${p.v.toFixed(2)} m/s` : `${p.vFps.toFixed(2)} fps`}</td>
                                  <td className="p-2 text-right">{isSI ? `${p.dpPaM.toFixed(1)} Pa/m` : `${p.dpFt.toFixed(2)} ft/100ft`}</td>
                                  <td className="p-2 text-right">{Math.round(p.Re).toLocaleString()}</td>
                                  <td className="p-2 text-center">
                                    {p.isCompliant ? (
                                      <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                        {isChosen ? "✓ SELECTED" : "✓ PASS"}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/60 text-[10px]">HIGH DROP</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Collapsible Intelligence Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col"
              : "w-0"
          }`}
        >
          {intelOpen && (
            <div className="p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-4 text-primary" /> CHW Sizing Intelligence
                </span>
                <button onClick={() => setIntelOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/40">
                  <h4 className="font-bold text-blue-700 dark:text-blue-300">Design Recommendations</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    For primary CHW headers, maintain friction loss between 4.0 ft w.g./100ft (40 Pa/m). Keep maximum fluid velocity below 2.4 m/s (8 fps) to prevent noise and erosion.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Modals */}
      <CalculationPreviewModal
        isOpen={formulaModalOpen}
        onClose={() => setFormulaModalOpen(false)}
        data={calculationPreviewData}
        onExportPDF={handleExportPDF}
      />

      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        targetItem={commentTargetItem}
        comments={commentsList}
        onSave={handleSaveComment}
      />
    </AppShell>
  );
}
