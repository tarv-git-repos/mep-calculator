import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportCHWPipePDF } from "@/lib/exportCHWPipePDF";
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
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { CalculationPreviewModal, type CalculationPreviewData } from "@/components/calculator-framework/CalculationPreviewModal";
import { pipeTable, GLYCOL_VISC, GLYCOL_DENS, PIPE_MATERIALS, CHWModePill, CHWPreset, CHW_PRESETS, colebrook, waterDens, waterVisc, fToC, calculateCHWPipeSize } from "@/lib/calc-chw-pipe";

export const Route = createFileRoute("/chw-pipe-sizer")({
  head: () => ({
    meta: [
      { title: "CHW Pipe Sizer — MEP Calc" },
      { name: "description", content: "Chilled water and condenser water pipe sizer based on flowrate, fluid properties, and target pressure drop." },
    ],
  }),
  component: ChwPipeSizerPage,
});

function ChwPipeSizerPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/chw-pipe-sizer", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/chw-pipe-sizer", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const isApprovedLocked = useCalculationLock("/chw-pipe-sizer", project?.id);

  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const handleReset = () => {
    saveParams({
      flowRate: '10',
      fluidType: 'chw',
      temperature: isSI ? '6.7' : '44',
      pipeMaterial: 'steel',
      targetDp: isSI ? '250' : '2.5'
    }, unitSystem);
  };
  const [activeMode, setActiveMode] = useState<CHWModePill>("primary_chw");

  // Input states matching parameter list: Flow Rate, Fluid Type, Fluid Temp, Pipe Material, Target ΔP
  const [sizingParams, setSizingParams] = useState({
    flowRate: "80" as string | number,
    fluidType: "chw" as "chw" | "cw" | "g25" | "g40",
    temperature: "44" as string | number,
    pipeMaterial: "steel" as "steel" | "copper" | "stainless" | "galvanized",
    targetDp: "4.0" as string | number,
  });

  const [formulaModalOpen, setFormulaModalOpen] = useState<boolean>(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);

  // Comment System
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

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

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getMergedItemComments(
      id,
      name,
      commentsList,
      "/chw-pipe-sizer",
      activeProjectId || project?.id || "default"
    );
    if (!itemComments || itemComments.length === 0) return null;
    return (
      <RowCommentCornerBadge
        id={id}
        count={itemComments.length}
        onClick={() => handleOpenComment(id, name)}
      />
    );
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
  const calculatedData = useMemo(() => calculateCHWPipeSize(sizingParams, unitSystem, ip), [sizingParams, unitSystem, ip]);

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
    await exportCHWPipePDF(
      sizingParams,
      calculatedData,
      unitSystem,
      {
        projectName: (project as any)?.name || (project as any)?.projectName,
        client: (project as any)?.client,
        projectNo: (project as any)?.code || (project as any)?.projectNo,
        calcNo: (project as any)?.calcNo,
        endUser: (project as any)?.endUser || (project as any)?.location,
        userName: currentUserName,
        reviewState: calcReviewState,
      }
    );
  };

  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanRaw = String(targetId || "").toLowerCase().trim();
      const cleanId = cleanRaw.replace(/^(field-|card-|metric-|res-)/, "");
      const cleanName = String(targetName || "").toLowerCase().trim();

      setHighlightedTargetId(targetId || cleanRaw || cleanId || targetName || "");

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTargetId(null);
        highlightTimeoutRef.current = null;
      }, 4500);

      requestAnimationFrame(() => {
        let el =
          document.getElementById(targetId || "") ||
          document.getElementById(`field-${cleanRaw}`) ||
          document.getElementById(`card-${cleanRaw}`) ||
          document.getElementById(`metric-${cleanRaw}`) ||
          document.getElementById(`res-${cleanRaw}`) ||
          document.getElementById(`field-card-${cleanRaw}`) ||
          document.getElementById(`field-card-${cleanId}`) ||
          document.getElementById(`card-${cleanId}`) ||
          document.getElementById(cleanRaw) ||
          document.getElementById(cleanId) ||
          document.querySelector(`[data-comment-target="${cleanRaw}"]`) ||
          document.querySelector(`[data-comment-target="${targetId}"]`) ||
          document.querySelector(`[data-field-id="${cleanRaw}"]`) ||
          document.querySelector(`[data-field-id="${cleanId}"]`);

        if (!el && cleanName) {
          const allFields = document.querySelectorAll("[data-comment-target]");
          for (let i = 0; i < allFields.length; i++) {
            const targetAttr = allFields[i].getAttribute("data-comment-target")?.toLowerCase() || "";
            if (targetAttr.includes(cleanName) || cleanName.includes(targetAttr)) {
              el = allFields[i] as HTMLElement;
              break;
            }
          }
        }

        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    };

    const handleScrollEvent = (e: any) => {
      const targetId = e?.detail?.id || e?.detail?.targetItemId || e?.detail?.targetId;
      const targetName = e?.detail?.name || e?.detail?.fieldName || e?.detail?.targetName;
      if (targetId || targetName) handleScrollTarget(targetId, targetName);
    };

    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const urlTargetId = searchParams.get("commentTargetId") || searchParams.get("targetId") || searchParams.get("itemId") || searchParams.get("spaceId");
      if (urlTargetId) {
        setTimeout(() => handleScrollTarget(urlTargetId, searchParams.get("commentTargetName") || searchParams.get("targetName") || ""), 500);
      }
    }

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);
    window.addEventListener("mep_scroll_to_comment_target", handleScrollEvent);
    window.addEventListener("mep-comment-notification-clicked", handleScrollEvent);
    window.addEventListener("mep-highlight-item", handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      window.removeEventListener("mep_scroll_to_comment_target", handleScrollEvent);
      window.removeEventListener("mep-comment-notification-clicked", handleScrollEvent);
      window.removeEventListener("mep-highlight-item", handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const isFieldHighlighted = (id: string, name?: string) => {
    if (!highlightedTargetId) return "";
    const cleanHigh = highlightedTargetId.toLowerCase().trim().replace(/^(field-|card-|metric-|res-)/, "");
    const cleanId = id.toLowerCase().trim().replace(/^(field-|card-|metric-|res-)/, "");
    const cleanName = (name || "").toLowerCase().trim();
    const cleanHighFull = highlightedTargetId.toLowerCase().trim();

    const isMatch =
      cleanHigh === cleanId ||
      cleanHighFull === id.toLowerCase().trim() ||
      (cleanName && cleanHigh.includes(cleanName)) ||
      (cleanName && cleanName.includes(cleanHigh));

    return isMatch ? "ring-2 ring-primary ring-offset-2 border-primary shadow-lg animate-pulse" : "";
  };

  const getInputClass = (id: string, name?: string, isLarger: boolean = false) => {
    const isHigh = isFieldHighlighted(id, name);
    const baseStyle = isLarger
      ? "w-full h-9 px-3 rounded-lg text-xs font-mono font-normal focus:outline-none disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base transition-all duration-150"
      : "w-full h-8 px-2 rounded font-mono text-xs font-normal focus:outline-none disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base transition-all duration-150";

    return `${baseStyle} bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-foreground focus:border-[#0A7BC7] ${isHigh}`;
  };

  const getSelectInputClass = (id: string, name?: string) => {
    const isHigh = isFieldHighlighted(id, name);
    const baseStyle = "w-full h-8 px-2 rounded text-xs font-normal focus:outline-none cursor-pointer transition-all duration-150";

    return `${baseStyle} bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-foreground focus:border-[#0A7BC7] ${isHigh}`;
  };

  const getCardCommentClass = (id: string, name: string, baseClass: string) => {
    const isHigh = isFieldHighlighted(id, name);
    return `${baseClass} relative ${isHigh}`;
  };

  return (
    <AppShell
      title="CHW Pipe Sizer"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          
          {/* Header Row matching Ventilation exactly */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
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

            {/* Sub-header Bar: Tab Selector (CHW Pipe Sizer & Report) */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setActiveTab("calculator")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-150 cursor-pointer ${activeTab === "calculator"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    CHW Pipe Sizer
                  </button>
                  <button
                    onClick={() => setActiveTab("report")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-150 cursor-pointer ${activeTab === "report"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Report
                  </button>
                </div>

                {activeTab === "calculator" && (
                  <select
                    value={activeMode}
                    onChange={(e) => handleModeChange(e.target.value as CHWModePill)}
                    className="h-8 px-3 bg-surface-2 dark:bg-zinc-800 border border-border/80 rounded-full text-xs font-semibold focus:outline-none cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <option value="" disabled>Load Application Profile...</option>
                    {Object.entries(CHW_PRESETS).map(([k, p]) => (
                      <option key={k} value={k}>{p.name}</option>
                    ))}
                  </select>
                )}

                {/* Formula Breakdown button */}
                <TBtn
                  onClick={() => setFormulaModalOpen(true)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Action Export Button */}
              <div className="flex items-center gap-2">
                <TBtn onClick={handleExportPDF} title="Export PDF Report">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* TAB CONTENT: REPORT VIEW OR CALCULATOR VIEW */}
            {activeTab === "report" ? (
              /* REPORT VIEW SECTION (MATCHING VENTILATION DESIGN FORMAT) */
              <div className="flex flex-col h-full select-none">
                {/* Top Action Bar matching Ventilation standard */}
                <div className="flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50 no-print">
                  <span className="text-[12px] text-muted-foreground font-semibold">
                    Generated: <span className="text-foreground font-mono">{formatDateStr(new Date())}</span>
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <TBtn primary onClick={handleExportPDF}>
                      <FileText className="size-3.5" /> Export
                    </TBtn>
                  </div>
                </div>

                {/* Main Report Document Sheet */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6 font-sans">
                    
                    {/* Header Title and Meta */}
                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          CHW Pipe Sizer Calculation
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Hydronic Pipe Sizing &amp; Hydrodynamic Analysis (ASHRAE Fundamentals Ch. 22 / Colebrook-White Friction Model)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground block mt-0.5 font-mono">Date: {new Date().toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>

                    {/* Project Metadata Table 3x2 (Enclosed Corporate Header matching Ventilation) */}
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <div className="grid grid-cols-4 divide-x divide-y divide-border">
                        <div className="p-2.5 font-bold bg-muted/20">Calculation No.:</div>
                        <div className="p-2.5 font-mono">{project?.calcNo || "TRV-CAL-CHW-R01"}</div>
                        <div className="p-2.5 font-bold bg-muted/20">Date:</div>
                        <div className="p-2.5 font-mono">{new Date().toLocaleDateString("en-GB")}</div>

                        <div className="p-2.5 font-bold bg-muted/20">Project No.:</div>
                        <div className="p-2.5 font-mono">{project?.code || project?.projectNo || "P000"}</div>
                        <div className="p-2.5 font-bold bg-muted/20">Client:</div>
                        <div className="p-2.5">{project?.client || "Design Client"}</div>

                        <div className="p-2.5 font-bold bg-muted/20">Project Name:</div>
                        <div className="p-2.5">{project?.name || project?.projectName || "Chilled Water Pipe Sizing"}</div>
                        <div className="p-2.5 font-bold bg-muted/20">End User:</div>
                        <div className="p-2.5">{project?.endUser || project?.location || "Site Development"}</div>
                      </div>
                    </div>

                    {/* Table 1: Executive Design Parameters & Pipe Specification Summary */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        1. Executive Design Parameters &amp; Pipe Specification Summary
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                              <th className="p-2.5 w-12 text-center">No.</th>
                              <th className="p-2.5">Executive Design Parameter Summary</th>
                              <th className="p-2.5 text-center w-28">Value</th>
                              <th className="p-2.5 text-center w-20">Unit</th>
                              <th className="p-2.5">Engineering Design Basis / Code</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                              <td className="p-2.5 font-bold">Hydronic System Service</td>
                              <td className="p-2.5 text-center font-bold text-foreground">Chilled Water Closed Loop</td>
                              <td className="p-2.5 text-center text-muted-foreground">-</td>
                              <td className="p-2.5 text-muted-foreground">Primary/secondary chilled water distribution</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                              <td className="p-2.5 font-bold">Circulating Fluid Type</td>
                              <td className="p-2.5 text-center font-bold text-foreground">
                                {sizingParams.fluidType === "chw" ? "Chilled Water" : sizingParams.fluidType === "cw" ? "Condenser Water" : sizingParams.fluidType === "g25" ? "25% Ethylene Glycol" : "40% Ethylene Glycol"}
                              </td>
                              <td className="p-2.5 text-center text-muted-foreground">-</td>
                              <td className="p-2.5 text-muted-foreground">Specific heat &amp; viscosity adjusted for operating temp</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                              <td className="p-2.5 font-bold">Design Flow Rate (Q)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.flowVal}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{isSI ? "L/s" : "GPM"}</td>
                              <td className="p-2.5 text-muted-foreground">Hydronic loop design flow capacity</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                              <td className="p-2.5 font-bold">Operating Fluid Temperature</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.tRaw}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{isSI ? "°C" : "°F"}</td>
                              <td className="p-2.5 text-muted-foreground">Density: {calculatedData.rho.toFixed(1)} kg/m³, Viscosity: {calculatedData.mu.toExponential(2)} Pa·s</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">5</td>
                              <td className="p-2.5 font-bold">Target Max Friction Loss (ΔP/L)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.dpRaw}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{isSI ? "Pa/m" : "ft/100ft"}</td>
                              <td className="p-2.5 text-muted-foreground">ASHRAE recommended upper friction limit</td>
                            </tr>
                            {/* Highlighted Key Output: Selected Pipe Size */}
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                              <td className="p-2.5 text-center font-mono">6</td>
                              <td className="p-2.5 font-bold">Recommended Pipe Diameter (NPS / DN)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-primary">
                                {calculatedData.chosen ? calculatedData.chosen.nps + '" (DN ' + calculatedData.chosen.idMm + ')' : "-"}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold">NPS (DN)</td>
                              <td className="p-2.5">Smallest diameter satisfying ΔP/L ≤ target limit</td>
                            </tr>
                            {/* Highlighted Key Output: Velocity */}
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                              <td className="p-2.5 text-center font-mono">7</td>
                              <td className="p-2.5 font-bold">Calculated Flow Velocity (v)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-primary">
                                {calculatedData.chosen ? (isSI ? calculatedData.chosen.v.toFixed(2) : calculatedData.chosen.vFps.toFixed(2)) : "-"}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold">{isSI ? "m/s" : "fps"}</td>
                              <td className="p-2.5">Within ASHRAE recommended range (0.9 - 2.4 m/s)</td>
                            </tr>
                            {/* Highlighted Key Output: Friction Gradient */}
                            <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                              <td className="p-2.5 text-center font-mono">8</td>
                              <td className="p-2.5 font-bold">Calculated Friction Head Loss Gradient</td>
                              <td className="p-2.5 text-center font-mono font-bold text-primary">
                                {calculatedData.chosen ? (isSI ? calculatedData.chosen.dpPaM.toFixed(1) : calculatedData.chosen.dpFt.toFixed(2)) : "-"}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold">{isSI ? "Pa/m" : "ft/100ft"}</td>
                              <td className="p-2.5">Colebrook-White friction model (f = {calculatedData.chosen?.f.toFixed(4) || "-"})</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 2: Complete Pipe Sizing Schedule & Hydrodynamic Comparison */}
                    <div className="space-y-2 mt-6">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        2. Complete Pipe Sizing Schedule &amp; Hydrodynamic Comparison
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                              <th className="p-2.5 w-10 text-center">Sr.</th>
                              <th className="p-2.5 text-center w-28">Nominal (NPS)</th>
                              <th className="p-2.5 text-center w-28">Metric (DN)</th>
                              <th className="p-2.5 text-right w-32">Velocity ({isSI ? "m/s" : "fps"})</th>
                              <th className="p-2.5 text-right w-36">Friction Loss ({isSI ? "Pa/m" : "ft/100ft"})</th>
                              <th className="p-2.5 text-right w-36">Reynolds No. (Re)</th>
                              <th className="p-2.5 text-center w-36">Compliance Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border font-sans">
                            {calculatedData.allPipes.map((pipe: any, idx: number) => {
                              const isChosen = calculatedData.chosen?.nps === pipe.nps;
                              const showVel = (isSI ? pipe.v : pipe.vFps).toFixed(2);
                              const showDp = (isSI ? pipe.dpPaM : pipe.dpFt).toFixed(isSI ? 1 : 2);
                              const showRe = Math.round(pipe.Re).toLocaleString();
                              const statusText = isChosen ? "✓ RECOMMENDED (PASS)" : pipe.isCompliant ? "✓ PASS" : "EXCEEDS ΔP LIMIT";

                              return (
                                <tr
                                  key={pipe.nps}
                                  className={isChosen ? "bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-slate-900 dark:text-slate-100 border-y border-border" : "hover:bg-muted/30"}
                                >
                                  <td className="p-2.5 text-center font-mono text-muted-foreground">{idx + 1}</td>
                                  <td className="p-2.5 text-center font-bold font-mono">{pipe.nps}"</td>
                                  <td className="p-2.5 text-center font-mono">{pipe.idMm} mm</td>
                                  <td className="p-2.5 text-right font-mono">{showVel}</td>
                                  <td className="p-2.5 text-right font-mono">{showDp}</td>
                                  <td className="p-2.5 text-right font-mono">{showRe}</td>
                                  <td className="p-2.5 text-center">
                                    {pipe.isCompliant ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        {statusText}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/70 font-semibold">
                                        {statusText}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 3: Thermodynamic & Fluid Physical Properties */}
                    <div className="space-y-2 mt-6">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        3. Thermodynamic &amp; Fluid Physical Properties
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                              <th className="p-2.5 w-12 text-center">No.</th>
                              <th className="p-2.5">Thermodynamic Parameter</th>
                              <th className="p-2.5 text-center w-28">Value</th>
                              <th className="p-2.5 text-center w-20">Unit</th>
                              <th className="p-2.5">Calculation Model / Physical Reference</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                              <td className="p-2.5 font-bold">Operating Fluid Density (ρ)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.rho.toFixed(1)}</td>
                              <td className="p-2.5 text-center">kg/m³</td>
                              <td className="p-2.5 text-muted-foreground">Temperature adjusted polynomial equation</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                              <td className="p-2.5 font-bold">Dynamic Viscosity (μ)</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.mu.toExponential(2)}</td>
                              <td className="p-2.5 text-center">Pa·s</td>
                              <td className="p-2.5 text-muted-foreground">Vogel temperature-viscosity relationship</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                              <td className="p-2.5 font-bold">Flow Regime &amp; Reynolds Number</td>
                              <td className="p-2.5 text-center font-mono font-bold text-foreground">{calculatedData.chosen ? Math.round(calculatedData.chosen.Re).toLocaleString() : "-"}</td>
                              <td className="p-2.5 text-center">{calculatedData.chosen?.regime || "Turbulent"}</td>
                              <td className="p-2.5 text-muted-foreground">Re = (ρ · v · D) / μ (Turbulent flow Re &gt; 4,000)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Compliance Verification Banner */}
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">
                          ASHRAE Hydronic Pipe Sizing Compliance Verification
                        </span>
                        <p className="text-muted-foreground leading-relaxed">
                          This hydronic sizing calculation complies with ASHRAE Fundamentals Chapter 22 and CIBSE Guide C. The selected pipe size maintains fluid velocity within permissible acoustic and erosion limits and achieves a friction loss gradient within the maximum target design threshold.
                        </p>
                      </div>
                    </div>

                    {/* Table 4: 4-Column Professional Review & Sign-Off Block */}
                    <div className="space-y-2 mt-6">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        4. Professional Review &amp; Sign-Off Block
                      </h3>
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                              <th className="p-2.5 text-left w-1/4">Approval Role</th>
                              <th className="p-2.5 text-center w-1/4">Originated By</th>
                              <th className="p-2.5 text-center w-1/4">Reviewed By</th>
                              <th className="p-2.5 text-center w-1/4">Approved By</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="p-2.5 font-bold text-muted-foreground">Name:</td>
                              <td className="p-2.5 text-center font-bold text-foreground">{currentUserName}</td>
                              <td className="p-2.5 text-center font-bold text-foreground">Pending Review</td>
                              <td className="p-2.5 text-center font-bold text-foreground">Pending Approval</td>
                            </tr>
                            <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                              <td className="p-2.5 font-bold text-muted-foreground">Role / Status:</td>
                              <td className="p-2.5 text-center text-muted-foreground">MEP Design Engineer</td>
                              <td className="p-2.5 text-center text-muted-foreground">Senior HVAC Lead</td>
                              <td className="p-2.5 text-center text-muted-foreground">Principal / MEP Director</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold text-muted-foreground">Date:</td>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">{new Date().toLocaleDateString("en-GB")}</td>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">—</td>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">—</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            ) : (
/* CALCULATOR VIEW SECTION */
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                <div className="lg:col-span-5 space-y-5">
                  <div
                    id="card-params"
                    data-field-id="card-params"
                    data-comment-target="card-params"
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        📥 Sizing Parameters
                      </span>
                      {renderCommentBadge("card-params", "Sizing Parameters")}
                    </div>

                    {/* INPUT 1: Flow Rate */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="field-flowRate"
                          data-field-id="field-flowRate"
                          data-comment-target="flowRate"
                          className="space-y-1"
                        >
                          <label className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                            Flow Rate ({isSI ? "L/s" : "GPM"})
                          </label>
                          <div className="relative mt-1">
                            <input
                              type="number"
                              disabled={isEffectiveReadOnly || isApprovedLocked}
                              value={sizingParams.flowRate}
                              onChange={(e) => saveParams({ ...sizingParams, flowRate: e.target.value }, unitSystem)}
                              className={getInputClass("flowRate", "Flow Rate", true)}
                              placeholder={isSI ? "e.g. 5.0" : "e.g. 80"}
                            />
                            {renderCommentBadge("flowRate", "Flow Rate")}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleOpenComment("flowRate", "Flow Rate")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(String(sizingParams.flowRate));
                            toast.success("Copied flow rate");
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <span>Copy Value</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* INPUT 2 & 3: Fluid Type & Operating Temp */}
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Fluid Properties &amp; Temperature
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-fluidType"
                              data-field-id="field-fluidType"
                              data-comment-target="fluidType"
                            >
                              <label className="text-[11px] text-slate-500 font-medium">Fluid Type</label>
                              <div className="relative mt-1">
                                <select
                                  disabled={isEffectiveReadOnly || isApprovedLocked}
                                  value={sizingParams.fluidType}
                                  onChange={(e) => saveParams({ ...sizingParams, fluidType: e.target.value as any }, unitSystem)}
                                  className={getSelectInputClass("fluidType", "Fluid Type")}
                                >
                                  <option value="chw">Chilled Water</option>
                                  <option value="cw">Condenser Water</option>
                                  <option value="g25">25% Ethylene Glycol</option>
                                  <option value="g40">40% Ethylene Glycol</option>
                                </select>
                                {renderCommentBadge("fluidType", "Fluid Type")}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("fluidType", "Fluid Type")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-temperature"
                              data-field-id="field-temperature"
                              data-comment-target="temperature"
                            >
                              <label className="text-[11px] text-slate-500 font-medium">Fluid Temp ({isSI ? "°C" : "°F"})</label>
                              <div className="relative mt-1">
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly || isApprovedLocked}
                                  value={sizingParams.temperature}
                                  onChange={(e) => saveParams({ ...sizingParams, temperature: e.target.value }, unitSystem)}
                                  className={getInputClass("temperature", "Fluid Temperature")}
                                  placeholder={isSI ? "e.g. 6.7" : "e.g. 44"}
                                />
                                {renderCommentBadge("temperature", "Fluid Temperature")}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("temperature", "Fluid Temperature")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(String(sizingParams.temperature));
                                toast.success("Copied fluid temperature");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <span>Copy Value</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </div>
                    </div>

                    {/* INPUT 4 & 5: Material & Target ΔP */}
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Piping &amp; Friction Criteria
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pipeMaterial"
                              data-field-id="field-pipeMaterial"
                              data-comment-target="pipeMaterial"
                            >
                              <label className="text-[11px] text-slate-500 font-medium">Pipe Material</label>
                              <div className="relative mt-1">
                                <select
                                  disabled={isEffectiveReadOnly || isApprovedLocked}
                                  value={sizingParams.pipeMaterial}
                                  onChange={(e) => saveParams({ ...sizingParams, pipeMaterial: e.target.value as any }, unitSystem)}
                                  className={getSelectInputClass("pipeMaterial", "Pipe Material")}
                                >
                                  {Object.entries(PIPE_MATERIALS).map(([k, m]) => (
                                    <option key={k} value={k}>{m.label}</option>
                                  ))}
                                </select>
                                {renderCommentBadge("pipeMaterial", "Pipe Material")}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("pipeMaterial", "Pipe Material")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-targetDp"
                              data-field-id="field-targetDp"
                              data-comment-target="targetDp"
                            >
                              <label className="text-[11px] text-slate-500 font-medium">Target ΔP ({isSI ? "Pa/m" : "ft/100ft"})</label>
                              <div className="relative mt-1">
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly || isApprovedLocked}
                                  value={sizingParams.targetDp}
                                  onChange={(e) => saveParams({ ...sizingParams, targetDp: e.target.value }, unitSystem)}
                                  className={getInputClass("targetDp", "Target Friction Loss")}
                                  placeholder={isSI ? "e.g. 40" : "e.g. 4.0"}
                                />
                                {renderCommentBadge("targetDp", "Target Friction Loss")}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("targetDp", "Target Friction Loss")}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(String(sizingParams.targetDp));
                                toast.success("Copied target friction loss");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <span>Copy Value</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </div>
                    </div>

                  </div>
                </div>

                {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) STICKY matching Pump Sizing */}
                <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                  <div 
                    id="card-results"
                    data-field-id="card-results"
                    data-comment-target="card-results"
                    onDoubleClick={() => setFormulaModalOpen(true)}
                    title="Double-click to view detailed calculations"
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        ⚡ Sizing Results Summary
                      </span>
                      {renderCommentBadge("card-results", "Sizing Results Summary")}
                    </div>

                    {/* 4 TOP DISPLAY STAT CARDS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="res-size"
                            data-field-id="res-size"
                            data-comment-target="res-size"
                            className={getCardCommentClass("res-size", "Selected Pipe Size", "bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                          >
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Selected Pipe Size</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {calculatedData.chosen ? `NPS ${calculatedData.chosen.nps}"` : "NaN"}{" "}
                              <span className="text-xs font-normal text-muted-foreground">{calculatedData.chosen ? `(DN ${calculatedData.chosen.idMm})` : ""}</span>
                            </div>
                            {renderCommentBadge("res-size", "Selected Pipe Size")}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("res-size", "Selected Pipe Size")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => {
                              const val = calculatedData.chosen ? `NPS ${calculatedData.chosen.nps}" (DN ${calculatedData.chosen.idMm})` : "";
                              navigator.clipboard.writeText(val);
                              toast.success("Copied pipe size");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <span>Copy Value</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="res-velocity"
                            data-field-id="res-velocity"
                            data-comment-target="res-velocity"
                            className={getCardCommentClass("res-velocity", "Velocity", "bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                          >
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium font-sans">Velocity</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {calculatedData.chosen ? (isSI ? `${calculatedData.chosen.v.toFixed(2)}` : `${calculatedData.chosen.vFps.toFixed(2)}`) : "NaN"}{" "}
                              <span className="text-xs font-normal text-muted-foreground">{isSI ? "m/s" : "fps"}</span>
                            </div>
                            {renderCommentBadge("res-velocity", "Velocity")}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("res-velocity", "Velocity")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => {
                              const val = calculatedData.chosen ? (isSI ? `${calculatedData.chosen.v.toFixed(2)} m/s` : `${calculatedData.chosen.vFps.toFixed(2)} fps`) : "";
                              navigator.clipboard.writeText(val);
                              toast.success("Copied velocity");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <span>Copy Value</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="res-dp"
                            data-field-id="res-dp"
                            data-comment-target="res-dp"
                            className={getCardCommentClass("res-dp", "Pressure Drop", "bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                          >
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium font-sans">Pressure Drop</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {calculatedData.chosen ? (isSI ? `${calculatedData.chosen.dpPaM.toFixed(1)}` : `${calculatedData.chosen.dpFt.toFixed(2)}`) : "NaN"}{" "}
                              <span className="text-xs font-normal text-muted-foreground">{isSI ? "Pa/m" : "ft/100ft"}</span>
                            </div>
                            {renderCommentBadge("res-dp", "Pressure Drop")}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("res-dp", "Pressure Drop")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => {
                              const val = calculatedData.chosen ? (isSI ? `${calculatedData.chosen.dpPaM.toFixed(1)} Pa/m` : `${calculatedData.chosen.dpFt.toFixed(2)} ft/100ft`) : "";
                              navigator.clipboard.writeText(val);
                              toast.success("Copied pressure drop");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <span>Copy Value</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="res-reynolds"
                            data-field-id="res-reynolds"
                            data-comment-target="res-reynolds"
                            className={getCardCommentClass("res-reynolds", "Reynolds Number", "bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                          >
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium font-sans">Reynolds Number</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {calculatedData.chosen ? Math.round(calculatedData.chosen.Re).toLocaleString() : "NaN"}
                            </div>
                            {renderCommentBadge("res-reynolds", "Reynolds Number")}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("res-reynolds", "Reynolds Number")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => {
                              const val = calculatedData.chosen ? String(Math.round(calculatedData.chosen.Re)) : "";
                              navigator.clipboard.writeText(val);
                              toast.success("Copied Reynolds number");
                            }}
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
                        <span className="font-mono font-bold text-[#0A7BC7]">
                          {calculatedData.chosen ? `NPS ${calculatedData.chosen.nps}" / DN ${calculatedData.chosen.idMm} mm Pipe` : "-"}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
              <ContextMenu>
                <ContextMenuTrigger className="block w-full h-4 mt-2" />
                <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                  <ContextMenuItem
                    onClick={() => handleOpenComment("chw-pipe-sizer", "CHW Pipe Sizer")}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                  >
                    <MessageSquare className="size-3.5" />
                    <span>Add Comment</span>
                  </ContextMenuItem>

                  <ContextMenuSeparator className="h-px bg-border my-1" />

                  <ContextMenuItem
                    onClick={() => setFormulaModalOpen(true)}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                  >
                    <Info className="size-3.5 text-primary" />
                    <span>View Detailed Calcs</span>
                  </ContextMenuItem>

                  <ContextMenuSeparator className="h-px bg-border my-1" />

                  <ContextMenuItem
                    disabled={isEffectiveReadOnly || isApprovedLocked}
                    onClick={() => handleReset()}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Reset to Defaults</span>
                    <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
            )}

          </div>

        </div>

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

      {/* Piping Sizing Schedule Popup Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <FileSpreadsheet className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Piping Sizing Schedule</h3>
                  <p className="text-xs text-muted-foreground">Colebrook-White friction evaluation &amp; hydrodynamic comparison</p>
                </div>
              </div>
              <button
                onClick={() => setScheduleModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body: Schedule Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  Fluid: <strong className="text-foreground">{sizingParams.fluidType.toUpperCase()}</strong> @ <strong className="text-foreground">{calculatedData.tRaw} {isSI ? "°C" : "°F"}</strong> | Material: <strong className="text-foreground">{PIPE_MATERIALS[sizingParams.pipeMaterial]?.label}</strong>
                </span>
                <span className="text-muted-foreground font-medium font-mono">
                  Target ΔP: <strong className="text-foreground">{calculatedData.dpRaw} {isSI ? "Pa/m" : "ft/100ft"}</strong>
                </span>
              </div>

              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-xs font-sans text-left border-collapse">
                  <thead>
                    <tr className="bg-muted font-bold text-foreground border-b border-border">
                      <th className="p-3 text-center">NPS</th>
                      <th className="p-3 text-center">ID ({isSI ? "mm" : "in"})</th>
                      <th className="p-3 text-right">Velocity</th>
                      <th className="p-3 text-right">Pressure Drop</th>
                      <th className="p-3 text-right">Reynolds Number</th>
                      <th className="p-3 text-center">Friction Factor (f)</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {calculatedData.allPipes.map((p) => {
                      const isChosen = calculatedData.chosen?.nps === p.nps;
                      return (
                        <tr key={p.nps} className={`hover:bg-muted/40 transition-colors ${isChosen ? "bg-primary/10 font-bold" : ""}`}>
                          <td className="p-3 text-center font-bold font-sans text-foreground">{p.nps}"</td>
                          <td className="p-3 text-center">{isSI ? p.idMm : p.idIn.toFixed(3)}</td>
                          <td className="p-3 text-right">{isSI ? `${p.v.toFixed(2)} m/s` : `${p.vFps.toFixed(2)} fps`}</td>
                          <td className="p-3 text-right">{isSI ? `${p.dpPaM.toFixed(1)} Pa/m` : `${p.dpFt.toFixed(2)} ft/100ft`}</td>
                          <td className="p-3 text-right">{Math.round(p.Re).toLocaleString()}</td>
                          <td className="p-3 text-center">{p.f.toFixed(4)}</td>
                          <td className="p-3 text-center">
                            {p.isCompliant ? (
                              <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px]">
                                {isChosen ? "✓ SELECTED" : "✓ PASS"}
                              </span>
                            ) : (
                              <span className="bg-red-500/15 text-red-600 dark:text-red-400 font-bold px-2 py-0.5 rounded text-[10px]">
                                HIGH DROP
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/20 text-xs">
              <span className="text-muted-foreground font-mono">
                {calculatedData.chosen ? `Optimal Selected: NPS ${calculatedData.chosen.nps}" / DN ${calculatedData.chosen.idMm} mm` : ""}
              </span>
              <button
                onClick={() => setScheduleModalOpen(false)}
                className="px-4 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Close Schedule
              </button>
            </div>

          </div>
        </div>
      )}
    </AppShell>
  );
}
