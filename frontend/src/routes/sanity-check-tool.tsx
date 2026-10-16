import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, CheckCircle2, FileText, Zap, SlidersHorizontal,
  X, Check, Edit3, MessageSquare, Copy, RotateCcw, Trash2, Sparkles,
  ShieldCheck, Info, ArrowRight, BookOpen, Layers, Lightbulb, Activity, Gauge, Sliders, ChevronRight
} from "lucide-react";
import {
  type CheckResult,
  SANITY_PRESETS,
  computeSanityCheckResults
} from "@/lib/calc-sanity-check-tool";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { toast } from "sonner";
import { exportSanityCheckPDF } from "@/lib/exportSanityCheckPDF";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { dirtyStore } from "@/lib/dirty-store";
import { CalculationPreviewModal, CalculationPreviewData } from "@/components/calculator-framework/CalculationPreviewModal";
import { useCalculatorFramework } from "@/components/calculator-framework";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";

export const Route = createFileRoute("/sanity-check-tool")({
  head: () => ({
    meta: [
      { title: "Sanity Check Tool — MEP Calc" },
      { name: "description", content: "Interactive engineering sanity checker for duct, pipe, and energy values with step-by-step formula breakdown." },
    ],
  }),
  component: SanityCheckToolPage,
});

function SanityCheckToolPage() {
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const { userData, profile, user } = useAuth();
  const currentUserName = userData?.name || profile?.name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";
  const isApprovedLocked = useCalculationLock("/sanity-check-tool", project?.id);

  const calcReviewState = useCalculationReviewState("/sanity-check-tool", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/sanity-check-tool", activeProjectId || project?.id);

  // States
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string>("commercial_office");

  // Inputs matching Reference MEP Calculator
  const [ductVel, setDuctVel] = useState<number>(7.62); // m/s (1500 fpm)
  const [ductFr, setDuctFr] = useState<number>(0.65);  // Pa/m (0.08 in w.g./100ft)
  const [esp, setEsp] = useState<number>(124);          // Pa (0.5 in w.g.)
  const [pipeVel, setPipeVel] = useState<number>(1.22); // m/s (4.0 fps)
  const [pumpHead, setPumpHead] = useState<number>(149); // kPa (50 ft w.g.)
  const [cfmTr, setCfmTr] = useState<number>(47.2);     // L/s/kW (400 CFM/TR)
  const [supTemp, setSupTemp] = useState<number>(12.8);  // °C (55 °F)
  const [chwDt, setChwDt] = useState<number>(5.6);      // °C (10 °F)
  const [chillerEff, setChillerEff] = useState<number>(5.41); // COP (0.65 kW/TR)

  const isSI = unitSystem === "si";
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Comments state
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);

  const getItemComments = (itemId: string) => commentsList.filter(c => c.targetId === itemId || c.spaceId === itemId || c.itemId === itemId);

  // Load comments on project switch
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/sanity-check-tool`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCommentsList(parsed);
      } else {
        setCommentsList([]);
      }
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  }, [project?.id]);

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId || "ductVel";
    const targetName = commentTargetItem?.name || commentData?.targetName || "Sanity Parameter";

    const commentWithMeta = {
      ...commentData,
      targetId,
      targetName,
      spaceId: targetId,
      spaceName: targetName,
      itemId: targetId,
      targetType: "Sanity Check Parameter",
      calculatorPath: "/sanity-check-tool",
    };

    const updated = [commentWithMeta, ...commentsList];
    setCommentsList(updated);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/sanity-check-tool`, JSON.stringify(updated));

    notifyCommentAssigned({
      ...commentWithMeta,
      url: `/sanity-check-tool?targetId=${targetId}&targetName=${encodeURIComponent(targetName)}`
    });

    setCommentModalOpen(false);
    toast.success("Comment/Task added successfully!");
  };

  const renderCommentBadge = (id: string, name: string) => {
    const existing = getItemComments(id);
    if (existing.length === 0) return null;
    const unresolvedCount = existing.filter(c => c.status !== "resolved").length;
    if (unresolvedCount === 0) return null;
    return (
      <RowCommentCornerBadge
        id={id}
        count={unresolvedCount}
        onClick={() => handleOpenComment(id, name)}
      />
    );
  };

  // Modular Framework Hook
  const framework = useCalculatorFramework({
    calculatorId: "/sanity-check-tool",
    calculatorTitle: "Sanity Check Tool",
    items: [
      {
        id: "sanity-check-1",
        name: "HVAC & Hydronic System Sanity Check",
        code: "SANITY-01",
      },
    ],
  });

  // Handle Unit Toggle with precise mathematical conversions
  const handleUnitToggle = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (targetUnit === unitSystem) return;
    if (shouldConvert) {
      if (targetUnit === "ip") {
        setDuctVel((v) => Math.round(v * 196.85)); // m/s -> FPM
        setDuctFr((v) => Number((v * 0.1233).toFixed(2))); // Pa/m -> in w.g./100ft
        setEsp((v) => Number((v * 0.00401865).toFixed(2))); // Pa -> in w.g.
        setPipeVel((v) => Number((v * 3.28084).toFixed(1))); // m/s -> fps
        setPumpHead((v) => Number((v * 0.33455).toFixed(1))); // kPa -> ft w.g.
        setCfmTr((v) => Math.round(v * 8.473)); // L/s/kW -> CFM/TR
        setSupTemp((v) => Number(((v * 9) / 5 + 32).toFixed(1))); // °C -> °F
        setChwDt((v) => Number((v * 1.8).toFixed(1))); // °C -> °F (delta)
        setChillerEff((v) => Number((3.517 / Math.max(0.1, v)).toFixed(2))); // COP -> kW/TR
      } else {
        setDuctVel((v) => Number((v / 196.85).toFixed(2))); // FPM -> m/s
        setDuctFr((v) => Number((v / 0.1233).toFixed(2))); // in w.g./100ft -> Pa/m
        setEsp((v) => Math.round(v / 0.00401865)); // in w.g. -> Pa
        setPipeVel((v) => Number((v / 3.28084).toFixed(2))); // fps -> m/s
        setPumpHead((v) => Math.round(v / 0.33455)); // ft w.g. -> kPa
        setCfmTr((v) => Number((v / 8.473).toFixed(1))); // CFM/TR -> L/s/kW
        setSupTemp((v) => Number((((v - 32) * 5) / 9).toFixed(1))); // °F -> °C
        setChwDt((v) => Number((v / 1.8).toFixed(1))); // °F -> °C (delta)
        setChillerEff((v) => Number((3.517 / Math.max(0.1, v)).toFixed(2))); // kW/TR -> COP
      }
    }
    setUnitSystem(targetUnit);
    dirtyStore.set(true);
  };

  const applyPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    const p = SANITY_PRESETS[presetKey as keyof typeof SANITY_PRESETS];
    if (!p) return;
    const vals = isSI ? p.valuesSI : p.valuesIP;
    setDuctVel(vals.ductVel);
    setDuctFr(vals.ductFr);
    setEsp(vals.esp);
    setPipeVel(vals.pipeVel);
    setPumpHead(vals.pumpHead);
    setCfmTr(vals.cfmTr);
    setSupTemp(vals.supTemp);
    setChwDt(vals.chwDt);
    setChillerEff(vals.chillerEff);
    dirtyStore.set(true);
    toast.success(`Applied preset: ${p.label}`);
  };

  // Load state from localStorage
  useEffect(() => {
    const pId = activeProjectId || project?.id || "default";
    try {
      const stored = localStorage.getItem(`mep_sanity_calc_${pId}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.ductVel !== undefined) setDuctVel(data.ductVel);
        if (data.ductFr !== undefined) setDuctFr(data.ductFr);
        if (data.esp !== undefined) setEsp(data.esp);
        if (data.pipeVel !== undefined) setPipeVel(data.pipeVel);
        if (data.pumpHead !== undefined) setPumpHead(data.pumpHead);
        if (data.cfmTr !== undefined) setCfmTr(data.cfmTr);
        if (data.supTemp !== undefined) setSupTemp(data.supTemp);
        if (data.chwDt !== undefined) setChwDt(data.chwDt);
        if (data.chillerEff !== undefined) setChillerEff(data.chillerEff);
        if (data.unitSystem !== undefined) setUnitSystem(data.unitSystem);
        if (data.activePreset !== undefined) setActivePreset(data.activePreset);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load sanity check calculation", e);
    }
  }, [activeProjectId, project?.id]);

  const handleSaveCurrent = useCallback(() => {
    try {
      const pId = activeProjectId || project?.id || "default";
      const dataToSave = {
        ductVel, ductFr, esp, pipeVel, pumpHead, cfmTr, supTemp, chwDt, chillerEff,
        unitSystem, activePreset
      };
      localStorage.setItem(`mep_sanity_calc_${pId}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      if (forceSaveToCloud) forceSaveToCloud();
      toast.success("Sanity Check Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  }, [activeProjectId, project?.id, ductVel, ductFr, esp, pipeVel, pumpHead, cfmTr, supTemp, chwDt, chillerEff, unitSystem, activePreset, forceSaveToCloud]);

  useEffect(() => {
    const handleTriggerSave = (e: any) => {
      if (e.detail) e.detail.handled = true;
      handleSaveCurrent();
    };
    window.addEventListener("mep-trigger-save", handleTriggerSave);
    return () => window.removeEventListener("mep-trigger-save", handleTriggerSave);
  }, [handleSaveCurrent]);

  // Compute Evaluated Sanity Check Results
  const results: CheckResult[] = useMemo(() => {
    return computeSanityCheckResults(isSI, ductVel, ductFr, esp, pipeVel, pumpHead, cfmTr, supTemp, chwDt, chillerEff);
  }, [ductVel, ductFr, esp, pipeVel, pumpHead, cfmTr, supTemp, chwDt, chillerEff, isSI]);

  const passCount = useMemo(() => results.filter(r => r.status === "pass").length, [results]);
  const warnCount = useMemo(() => results.filter(r => r.status === "warn").length, [results]);
  const scorePct = useMemo(() => Math.round((passCount / results.length) * 100), [passCount, results.length]);

  // Framework Calculation Preview Data
  const calculationPreviewData: CalculationPreviewData = useMemo(() => {
    return {
      title: "Engineering Sanity Check Step-by-Step Proofs",
      itemName: "HVAC & Hydronic System Checks",
      itemCode: "SANITY-01",
      standardReference: "SMACNA Duct Design / ASHRAE Fundamentals / ASHRAE 90.1",
      inputs: [
        { label: "Supply Main Duct Velocity", value: isSI ? `${ductVel} m/s` : `${ductVel} FPM` },
        { label: "Duct Friction Rate", value: isSI ? `${ductFr} Pa/m` : `${ductFr} in w.g./100ft` },
        { label: "External Static Pressure", value: isSI ? `${esp} Pa` : `${esp} in w.g.` },
        { label: "CHW Main Pipe Velocity", value: isSI ? `${pipeVel} m/s` : `${pipeVel} fps` },
        { label: "Pump Total Head", value: isSI ? `${pumpHead} kPa` : `${pumpHead} ft w.g.` },
        { label: "Airflow Density", value: isSI ? `${cfmTr} L/s/kW` : `${cfmTr} CFM/TR` },
        { label: "Supply Air Temperature", value: isSI ? `${supTemp} °C` : `${supTemp} °F` },
        { label: "CHW ΔT", value: isSI ? `${chwDt} °C` : `${chwDt} °F` },
        { label: "Chiller Efficiency", value: isSI ? `${chillerEff} COP` : `${chillerEff} kW/TR` },
      ],
      steps: results.map((res, index) => {
        return {
          stepNumber: index + 1,
          label: res.label,
          formula: `Evaluation Check: ${res.range}`,
          substitution: `InputValue = ${res.value} vs Recommended Range (${res.range})`,
          result: res.status.toUpperCase(),
          unit: "-",
          status: res.status === "pass" ? "info" : "warning",
          description: `${res.desc} (Standard Reference: SMACNA / ASHRAE 90.1)`
        };
      }),
      results: [
        { label: "Total Evaluated Parameters", value: `${results.length}` },
        { label: "Compliant Parameters", value: `${passCount} PASS` },
        { label: "Guideline Warnings", value: `${warnCount} CHECK` },
        { label: "Sanity Compliance Score", value: `${scorePct}%` },
      ],
    };
  }, [results, passCount, warnCount, scorePct, isSI, ductVel, ductFr, esp, pipeVel, pumpHead, cfmTr, supTemp, chwDt, chillerEff]);

  const handleExportPDF = () => {
    try {
      const pdfChecks = results.map(r => ({
        label: r.label,
        value: r.value,
        status: r.status,
        range: r.range,
        desc: r.desc,
      }));
      exportSanityCheckPDF({
        checks: pdfChecks,
        unitSystem,
        meta: {
          userName: currentUserName,
          projectName: project?.name || "General MEP Project",
          projectNo: activeProjectId !== "default" ? activeProjectId.slice(0, 8) : "P000",
        }
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to export PDF report.");
    }
  };

  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  const getInputClass = (id: string, name?: string) => {
    const isHigh = isFieldHighlighted(id, name);
    const baseStyle = "w-full h-8 px-2 rounded font-mono focus:outline-none disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base transition-all duration-150";

    return `${baseStyle} bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-foreground focus:border-primary ${isHigh}`;
  };

  const getCardCommentClass = (id: string, name: string, baseClass: string) => {
    const isHigh = isFieldHighlighted(id, name);
    return `${baseClass} relative ${isHigh}`;
  };

  return (
    <AppShell
      title="Sanity Check Tool"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Header matching Pump Sizing */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sanity Check Tool</h1>
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
                calculatorPath="/sanity-check-tool"
                calculatorTitle="Sanity Check Tool"
              />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} />
            </div>
          </div>

          {/* White / Dark Card Container */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED"
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
            : calcReviewState?.status === "REJECTED"
              ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
              : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            }`}>

            {/* Top Tabs Selector Row matching Pump Sizing */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  {Object.entries(SANITY_PRESETS).map(([key, p]) => {
                    const active = activePreset === key;
                    return (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${active
                          ? "bg-background text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <TBtn
                  onClick={() => framework.openPreviewModal(calculationPreviewData)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              <div className="flex items-center gap-2">
                <TBtn
                  onClick={handleExportPDF}
                  title="Export PDF Report"
                >
                  <FileText className="size-3.5" /> Export PDF
                </TBtn>
              </div>
            </div>

            {/* Scrollable Content Workspace */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        📥 System Input Parameters
                      </span>
                    </div>

                    {/* AIR & DUCTWORK PARAMETERS */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-airParams" 
                          data-field-id="airParams" 
                          className="space-y-3 p-2 -m-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Air & Ductwork Systems
                            </span>
                            {renderCommentBadge("airParams", "Air & Ductwork Systems")}
                          </div>
                          
                          <div className="space-y-3 text-xs">
                            <div>
                              <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                                <span>Supply Main Duct Velocity</span>
                                <span className="font-mono font-bold text-primary">{ductVel} {isSI ? "m/s" : "FPM"}</span>
                              </div>
                              <input
                                type="number"
                                step={isSI ? "0.1" : "50"}
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={ductVel}
                                onChange={(e) => setDuctVel(parseFloat(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                                <span>Duct Friction Rate</span>
                                <span className="font-mono font-bold text-primary">{ductFr} {isSI ? "Pa/m" : "in w.g./100ft"}</span>
                              </div>
                              <input
                                type="number"
                                step={isSI ? "0.05" : "0.01"}
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={ductFr}
                                onChange={(e) => setDuctFr(parseFloat(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                                <span>Total External Static Pressure (ESP)</span>
                                <span className="font-mono font-bold text-primary">{esp} {isSI ? "Pa" : "in w.g."}</span>
                              </div>
                              <input
                                type="number"
                                step={isSI ? "10" : "0.05"}
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={esp}
                                onChange={(e) => setEsp(parseFloat(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          disabled={framework.isReadOnly || isApprovedLocked}
                          onClick={() => {
                            if (framework.isReadOnly || isApprovedLocked) return;
                            setDuctVel(isSI ? 7.62 : 1500);
                            setDuctFr(isSI ? 0.65 : 0.08);
                            setEsp(isSI ? 124 : 0.5);
                            toast.success("Air parameters reset to baseline");
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <RotateCcw className="size-3.5 text-muted-foreground" />
                          <span>Reset Air Parameters</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("airParams", "Air & Ductwork Systems")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* HYDRONIC & PUMP PARAMETERS */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-hydronicParams" 
                          data-field-id="hydronicParams" 
                          className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Hydronic Piping & Pump Systems
                            </span>
                            {renderCommentBadge("hydronicParams", "Hydronic Piping & Pump Systems")}
                          </div>

                          <div className="space-y-3 text-xs">
                            <div>
                              <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                                <span>CHW Main Pipe Velocity</span>
                                <span className="font-mono font-bold text-primary">{pipeVel} {isSI ? "m/s" : "fps"}</span>
                              </div>
                              <input
                                type="number"
                                step={isSI ? "0.1" : "0.5"}
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={pipeVel}
                                onChange={(e) => setPipeVel(parseFloat(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                                <span>Pump Total Dynamic Head</span>
                                <span className="font-mono font-bold text-primary">{pumpHead} {isSI ? "kPa" : "ft w.g."}</span>
                              </div>
                              <input
                                type="number"
                                step={isSI ? "5" : "5"}
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={pumpHead}
                                onChange={(e) => setPumpHead(parseFloat(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                                <span>CHW ΔT (Supply to Return)</span>
                                <span className="font-mono font-bold text-primary">{chwDt} {isSI ? "°C" : "°F"}</span>
                              </div>
                              <input
                                type="number"
                                step={isSI ? "0.5" : "1"}
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={chwDt}
                                onChange={(e) => setChwDt(parseFloat(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          disabled={framework.isReadOnly || isApprovedLocked}
                          onClick={() => {
                            if (framework.isReadOnly || isApprovedLocked) return;
                            setPipeVel(isSI ? 1.22 : 4.0);
                            setPumpHead(isSI ? 149 : 50);
                            setChwDt(isSI ? 5.6 : 10);
                            toast.success("Hydronic parameters reset to baseline");
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <RotateCcw className="size-3.5 text-muted-foreground" />
                          <span>Reset Hydronic Parameters</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("hydronicParams", "Hydronic Piping & Pump Systems")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* AIRFLOW & PLANT PERFORMANCE */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-plantParams" 
                          data-field-id="plantParams" 
                          className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Airflow & Plant Performance
                            </span>
                            {renderCommentBadge("plantParams", "Airflow & Plant Performance")}
                          </div>

                          <div className="space-y-3 text-xs">
                            <div>
                              <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                                <span>Airflow Density</span>
                                <span className="font-mono font-bold text-primary">{cfmTr} {isSI ? "L/s/kW" : "CFM/TR"}</span>
                              </div>
                              <input
                                type="number"
                                step={isSI ? "1" : "10"}
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={cfmTr}
                                onChange={(e) => setCfmTr(parseFloat(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                                <span>Supply Air Temperature</span>
                                <span className="font-mono font-bold text-primary">{supTemp} {isSI ? "°C" : "°F"}</span>
                              </div>
                              <input
                                type="number"
                                step={isSI ? "0.5" : "1"}
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={supTemp}
                                onChange={(e) => setSupTemp(parseFloat(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <div className="flex justify-between text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                                <span>Chiller Efficiency</span>
                                <span className="font-mono font-bold text-primary">{chillerEff} {isSI ? "COP" : "kW/TR"}</span>
                              </div>
                              <input
                                type="number"
                                step={isSI ? "0.1" : "0.05"}
                                disabled={framework.isReadOnly || isApprovedLocked}
                                value={chillerEff}
                                onChange={(e) => setChillerEff(parseFloat(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          disabled={framework.isReadOnly || isApprovedLocked}
                          onClick={() => {
                            if (framework.isReadOnly || isApprovedLocked) return;
                            setCfmTr(isSI ? 47.2 : 400);
                            setSupTemp(isSI ? 12.8 : 55);
                            setChillerEff(isSI ? 5.41 : 0.65);
                            toast.success("Plant performance parameters reset to baseline");
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <RotateCcw className="size-3.5 text-muted-foreground" />
                          <span>Reset Plant Parameters</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("plantParams", "Airflow & Plant Performance")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                  </div>
                </div>

                {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) matching Pump Sizing */}
                <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div 
                        id="card-hero-results" 
                        data-field-id="card-hero-results" 
                        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 transition-colors"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <div className="flex items-center">
                            <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                              ⚡ Design Sanity Evaluation
                            </span>
                            {renderCommentBadge("card-hero-results", "Design Sanity Evaluation")}
                          </div>
                        </div>

                        {/* STAT CARDS matching Pump Sizing */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Total Checks</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {results.length} <span className="text-xs font-normal text-muted-foreground">params</span>
                            </div>
                          </div>

                          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Compliant</div>
                            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                              {passCount} <span className="text-xs font-normal text-muted-foreground">PASS</span>
                            </div>
                          </div>

                          <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Warnings</div>
                            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                              {warnCount} <span className="text-xs font-normal text-muted-foreground">CHECK</span>
                            </div>
                          </div>

                          <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Compliance</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {scorePct}% <span className="text-xs font-normal text-muted-foreground">score</span>
                            </div>
                          </div>
                        </div>

                        {/* DETAILED CHECK ITEMS TABLE / LIST matching Pump Sizing */}
                        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-3">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-200/50 dark:border-zinc-700/50">
                            Parameter Sanity Verification Table
                          </div>

                          {results.map((r) => (
                            <div key={r.id} className="py-2 border-b border-slate-200/40 dark:border-zinc-800 last:border-none space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-700 dark:text-zinc-200 text-xs flex items-center gap-1.5">
                                  {r.label}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-foreground">{r.value}</span>
                                  {r.status === "pass" ? (
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                      PASS
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                      CHECK
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>Allowable Range: <strong className="font-mono text-slate-600 dark:text-zinc-300">{r.range}</strong></span>
                                <span className="text-[10.5px] italic text-slate-500">{r.desc}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => framework.openPreviewModal(calculationPreviewData)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                      >
                        <Info className="size-3.5 text-primary" />
                        <span>Calculation Preview</span>
                        <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Formula</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onClick={() => handleOpenComment("card-hero-results", "Design Sanity Evaluation")}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add Comment</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* Collapsible Intelligence Drawer matching Pump Sizing */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col"
              : "w-0"
          }`}
        >
          {intelOpen && (
            <SanityCheckIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              unitSystem={unitSystem}
              applyPreset={applyPreset}
              onOpenPreview={() => framework.openPreviewModal(calculationPreviewData)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <CalculationPreviewModal
        isOpen={framework.isPreviewOpen}
        onClose={framework.closePreviewModal}
        data={framework.previewData || calculationPreviewData}
        onExportPDF={handleExportPDF}
      />
      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        targetId={commentTargetItem?.id || ""}
        targetName={commentTargetItem?.name || ""}
        onSave={handleSaveComment}
        currentUserId={userData?.id || "user-1"}
        currentUserName={currentUserName}
      />
    </AppShell>
  );
}

// INTELLIGENCE DRAWER COMPONENT
interface SanityCheckIntelligenceDrawerProps {
  onClose: () => void;
  unitSystem: "si" | "ip";
  applyPreset: (presetKey: string) => void;
  onOpenPreview: () => void;
}

function SanityCheckIntelligenceDrawer({
  onClose,
  unitSystem,
  applyPreset,
  onOpenPreview,
}: SanityCheckIntelligenceDrawerProps) {
  const isSI = unitSystem === "si";

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* Drawer Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Engineering Intelligence</h3>
            <p className="text-[11px] text-muted-foreground">Sanity rules & SMACNA / ASHRAE standard limits</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Drawer Scroll Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar">
        {/* Formula breakdown shortcut */}
        <button
          onClick={onOpenPreview}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <Info className="size-4 shrink-0" />
            <div className="text-left">
              <div className="font-bold text-xs">View Step-by-Step Proofs</div>
              <div className="text-[10.5px] text-muted-foreground">Inspect detailed formulas & numerical substitutions</div>
            </div>
          </div>
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* Quick Presets */}
        <div className="p-3 rounded-xl bg-card border border-border space-y-2">
          <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
            <Sliders className="size-3.5 text-primary" /> Application Design Presets
          </span>
          <div className="grid grid-cols-1 gap-1.5 pt-1">
            {Object.entries(SANITY_PRESETS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className="w-full text-left p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors text-[11.5px] border border-border/50"
              >
                <div className="font-semibold text-foreground">{p.label}</div>
                <div className="text-[10.5px] text-muted-foreground line-clamp-1">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Velocity Limits Reference */}
        <div className="p-3 rounded-xl bg-card border border-border space-y-2">
          <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
            <Gauge className="size-3.5 text-primary" /> Air & Hydronic Limits
          </span>
          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span>Supply Main Duct Velocity:</span>
              <strong className="text-foreground font-mono">{isSI ? "5.0 – 12.7 m/s" : "1,000 – 2,500 FPM"}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span>Duct Friction Rate Target:</span>
              <strong className="text-foreground font-mono">{isSI ? "0.4 – 1.2 Pa/m" : "0.05 – 0.15 in w.g./100ft"}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span>CHW Main Pipe Velocity:</span>
              <strong className="text-foreground font-mono">{isSI ? "0.6 – 2.4 m/s" : "2.0 – 8.0 fps"}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span>AHU Airflow Density:</span>
              <strong className="text-foreground font-mono">{isSI ? "47 – 60 L/s/kW" : "350 – 450 CFM/TR"}</strong>
            </div>
            <div className="flex justify-between py-1">
              <span>CHW Temp Differential ΔT:</span>
              <strong className="text-foreground font-mono">{isSI ? "4.4 – 7.7 °C" : "8 – 14 °F"}</strong>
            </div>
          </div>
        </div>

        {/* Engineering Guidelines */}
        <div className="p-3 rounded-xl bg-card border border-border space-y-2">
          <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
            <BookOpen className="size-3.5 text-primary" /> Standards & Reference Codes
          </span>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground leading-relaxed">
            <li>SMACNA HVAC Duct Construction Standards (High/Low Pressure Ductwork).</li>
            <li>ASHRAE Fundamentals (Chapter 21: Duct Design & Chapter 22: Pipe Sizing).</li>
            <li>ASHRAE Standard 90.1 Energy Efficient Design for Buildings (Chiller COP baselines).</li>
            <li>CIBSE Guide W: Hydronic Pipe Sizing & Noise Control Limits.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
