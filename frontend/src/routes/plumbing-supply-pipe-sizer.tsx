import React, { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { TBtn } from "@/components/workspace/Button";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { exportSupplyPipePDF } from "@/lib/exportSupplyPipePDF";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Flame, Info, Download, MessageSquare, Check, ShieldCheck,
  AlertTriangle, Copy, RotateCcw, CheckCircle2, X, Gauge, Cylinder, Sparkles, FileText, Printer,
  TrendingUp, Layers, HelpCircle, Activity, Zap, Building2, Home, ArrowUpRight, CheckCircle, ChevronDown
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
import {
  type SupplyPipeInputs,
  type PipeSize,
  PIPE_SIZES,
  DEFAULT_INPUTS,
  computeSupplyPipeCalculations
} from "@/lib/calc-plumbing-supply-pipe-sizer";


export const Route = createFileRoute("/plumbing-supply-pipe-sizer")({
  head: () => ({
    meta: [
      { title: "Water Supply Pipe Sizer — MEP Calc" },
      { name: "description", content: "Water supply pipe sizing based on ASPE / IPC velocity limits and Hazen-Williams friction loss." }
    ],
  }),
  component: SupplyPipeSizerPage,
});

export function SupplyPipeSizerPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-supply-pipe-sizer", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-supply-pipe-sizer", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [tab, setTab] = useState<"calculator" | "report">("calculator");
  const [intelOpen, setIntelOpen] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  // Core Inputs State
  const [inputs, setInputs] = useState<SupplyPipeInputs>(DEFAULT_INPUTS);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Comment Assignment State
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);

  // Load calculation state from project storage
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_supply_pipe_sizer_${project.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setInputs({
          flow: parsed.flow !== undefined ? Number(parsed.flow) : DEFAULT_INPUTS.flow,
          pAvail: parsed.pAvail !== undefined ? Number(parsed.pAvail) : DEFAULT_INPUTS.pAvail,
          pResid: parsed.pResid !== undefined ? Number(parsed.pResid) : DEFAULT_INPUTS.pResid,
          length: parsed.length !== undefined ? Number(parsed.length) : DEFAULT_INPUTS.length,
          fittingAllowance: parsed.fittingAllowance !== undefined ? Number(parsed.fittingAllowance) : DEFAULT_INPUTS.fittingAllowance,
          elevation: parsed.elevation !== undefined ? Number(parsed.elevation) : DEFAULT_INPUTS.elevation,
          pipeMaterial: parsed.pipeMaterial || DEFAULT_INPUTS.pipeMaterial,
          unitSystem: (parsed.unitSystem || "SI").toUpperCase() as "SI" | "IP",
        });
      }
      const storedComments = localStorage.getItem(`mep_calc_comments_${project.id}_/plumbing-supply-pipe-sizer`);
      if (storedComments) {
        setCommentsMap(JSON.parse(storedComments));
      }
    } catch (e) {
      console.error("Failed to load supply pipe sizer state", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  const saveState = (newInputs: SupplyPipeInputs) => {
    if (!project?.id) return;
    try {
      localStorage.setItem(`mep_supply_pipe_sizer_${project.id}`, JSON.stringify(newInputs));
      dirtyStore.set(true);
      if (forceSaveToCloud) forceSaveToCloud();
    } catch (e) {
      console.error("Failed to save supply pipe sizer state", e);
    }
  };

  const handleInputChange = (field: keyof SupplyPipeInputs, value: any) => {
    if (isEffectiveReadOnly) return;
    const nextInputs = { ...inputs, [field]: value };
    setInputs(nextInputs);
    saveState(nextInputs);
  };

  const handleUnitSystem = (newUnit: "SI" | "IP") => {
    if (newUnit === inputs.unitSystem || isEffectiveReadOnly) return;
    const toIP = newUnit === "IP";

    // Unit conversion:
    // Flow: L/s <-> GPM (1 L/s = 15.8503 GPM)
    // Pressure: kPa <-> psi (1 psi = 6.89476 kPa)
    // Length / Elevation: m <-> ft (1 m = 3.28084 ft)
    const nextInputs: SupplyPipeInputs = {
      ...inputs,
      unitSystem: newUnit,
      flow: toIP ? Number((inputs.flow * 15.8503).toFixed(2)) : Number((inputs.flow / 15.8503).toFixed(2)),
      pAvail: toIP ? Number((inputs.pAvail / 6.89476).toFixed(1)) : Number((inputs.pAvail * 6.89476).toFixed(1)),
      pResid: toIP ? Number((inputs.pResid / 6.89476).toFixed(1)) : Number((inputs.pResid * 6.89476).toFixed(1)),
      length: toIP ? Number((inputs.length * 3.28084).toFixed(1)) : Number((inputs.length / 3.28084).toFixed(1)),
      elevation: toIP ? Number((inputs.elevation * 3.28084).toFixed(1)) : Number((inputs.elevation / 3.28084).toFixed(1)),
    };

    setInputs(nextInputs);
    saveState(nextInputs);
    toast.info(`Switched to ${newUnit === "IP" ? "Imperial (IP)" : "Metric (SI)"} units`);
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
    localStorage.setItem(`mep_calc_comments_${project.id}_/plumbing-supply-pipe-sizer`, JSON.stringify(updatedMap));
    toast.success(`Comment added to "${activeCommentTarget.label}"`);
    setActiveCommentTarget(null);
  };

  const isIP = inputs.unitSystem === "IP";
  const flowUnit = isIP ? "GPM" : "L/s";
  const pressUnit = isIP ? "psi" : "kPa";
  const lenUnit = isIP ? "ft" : "m";
  const velUnit = isIP ? "fps" : "m/s";

  // Hydraulic Calculations Engine (Hazen-Williams & Continuity Equation)
  const calculations = useMemo(() => {
    return computeSupplyPipeCalculations(inputs, isIP);
  }, [inputs, isIP]);

  const isAdequate = Boolean(calculations.rec && calculations.rec.ok);

  // PDF Export Functionality (Matching Ventilation Standard)
  const handleExportPdf = async () => {
    await exportSupplyPipePDF(
      inputs,
      calculations,
      inputs.unitSystem,
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

  const copyToClipboard = (val: string | number) => {
    navigator.clipboard.writeText(String(val));
    toast.success("Copied to clipboard");
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
      <RowCommentCornerBadge
        id={id}
        count={count}
        onClick={() => setActiveCommentTarget({ id, label: name })}
        title={`${count} comment(s)/task(s) assigned`}
      />
    );
  };

  // Helper renderer for input boxes with context menu matching ventilation
  const renderInputBox = (
    fieldId: keyof SupplyPipeInputs,
    label: string,
    value: number,
    unit: string,
    step: string = "1",
    min: number = 0,
    defaultVal: number
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
            <RowCommentCornerBadge
              id={fieldId}
              count={comments.length}
              onClick={() => setActiveCommentTarget({ id: fieldId, label })}
              title={`${comments.length} comment(s)/task(s) assigned`}
            />
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground tracking-tight">
                {label}
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step={step}
                min={min}
                disabled={isEffectiveReadOnly}
                value={value}
                onChange={(e) => handleInputChange(fieldId, parseFloat(e.target.value) || 0)}
                className="w-full bg-background border border-border/90 rounded-lg px-3 py-1.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition disabled:opacity-60"
              />
              <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap min-w-[45px]">
                {unit}
              </span>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => setActiveCommentTarget({ id: fieldId, label })}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>Add / View Comment</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => copyToClipboard(value)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
          </ContextMenuItem>
          {!isEffectiveReadOnly && (
            <>
              <ContextMenuSeparator className="h-px bg-border my-1" />
              <ContextMenuItem
                onClick={() => handleInputChange(fieldId, defaultVal)}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-muted-foreground"
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

  return (
    <AppShell title="Water Supply Pipe Sizer" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-hidden h-full">
          
          {/* Page Header & Actions */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Water Supply Pipe Sizer</h1>
              
              {/* Intelligence Trigger Button */}
              <button 
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
                title="Toggle Pipe Sizing Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>

              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-supply-pipe-sizer" calculatorTitle="Water Supply Pipe Sizer" />
            </div>

            {/* Unit System Toggle in Header inline with Approve / Reject */}
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={inputs.unitSystem.toLowerCase() as any} onChange={(u) => handleUnitSystem(u.toUpperCase() as any)} disabled={isEffectiveReadOnly} />
            </div>
          </div>

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
                    onClick={() => setTab("calculator")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "calculator"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Pipe Sizer
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
                  title="Detailed Formulas & Hazen-Williams Derivations"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Right Side Action Button: Export */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "calculator" ? (
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

                        {/* Section 1: Flow & Material Selection */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-flowParams"
                              data-field-id="flowParams"
                              data-comment-target="flowParams"
                              className={`space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("flowParams", "Flow & Material")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Flow &amp; Pipe Material
                                  </span>
                                  {renderCommentBadge("flowParams", "Flow & Material")}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                  Design Flow Rate ({flowUnit})
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  disabled={isEffectiveReadOnly}
                                  value={inputs.flow}
                                  onChange={(e) => handleInputChange("flow", parseFloat(e.target.value) || 0)}
                                  className={flowInputClass}
                                />
                              </div>

                              <div>
                                <label className="text-[11px] text-slate-500">Pipe Material &amp; Hazen-Williams (C)</label>
                                <div className="relative mt-1">
                                  <select
                                    disabled={isEffectiveReadOnly}
                                    value={inputs.pipeMaterial}
                                    onChange={(e) => handleInputChange("pipeMaterial", e.target.value)}
                                    className={selectClass}
                                  >
                                    <option value="150">Copper Type L (C = 150)</option>
                                    <option value="150">CPVC Schedule 80 (C = 150)</option>
                                    <option value="130">PEX Tubing (C = 130)</option>
                                    <option value="120">Galvanized Steel Pipe (C = 120)</option>
                                  </select>
                                  {!isEffectiveReadOnly && (
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => {
                                handleInputChange("flow", isIP ? 25 : 1.58);
                                handleInputChange("pipeMaterial", "150");
                                toast.success("Flow parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Flow &amp; Material</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "flowParams", label: "Flow & Material" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 2: Supply & Residual Pressures */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pressureParams"
                              data-field-id="pressureParams"
                              data-comment-target="pressureParams"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("pressureParams", "Supply & Residual Pressures")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Supply &amp; Residual Pressures ({pressUnit})
                                  </span>
                                  {renderCommentBadge("pressureParams", "Supply & Residual Pressures")}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Supply Pressure ({pressUnit})</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={inputs.pAvail}
                                    onChange={(e) => handleInputChange("pAvail", parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Req. Residual ({pressUnit})</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={inputs.pResid}
                                    onChange={(e) => handleInputChange("pResid", parseFloat(e.target.value) || 0)}
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
                                handleInputChange("pAvail", isIP ? 60 : 413.7);
                                handleInputChange("pResid", isIP ? 20 : 137.9);
                                toast.success("Pressure parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Pressures</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "pressureParams", label: "Supply & Residual Pressures" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 3: Piping Layout & Elevation */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pipeLayout"
                              data-field-id="pipeLayout"
                              data-comment-target="pipeLayout"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("pipeLayout", "Piping Layout")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Piping Layout &amp; Geometry
                                  </span>
                                  {renderCommentBadge("pipeLayout", "Piping Layout")}
                                </div>
                                <span className="text-[11px] font-mono font-semibold text-slate-500">
                                  Leff: {(calculations.Leff * (isIP ? 1 : 0.3048)).toFixed(1)} {lenUnit}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Pipe Run Length ({lenUnit})</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={inputs.length}
                                    onChange={(e) => handleInputChange("length", parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Fittings Allowance (%)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min={0}
                                    disabled={isEffectiveReadOnly}
                                    value={inputs.fittingAllowance}
                                    onChange={(e) => handleInputChange("fittingAllowance", parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] text-slate-500">Elevation Rise ({lenUnit})</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  disabled={isEffectiveReadOnly}
                                  value={inputs.elevation}
                                  onChange={(e) => handleInputChange("elevation", parseFloat(e.target.value) || 0)}
                                  className={inputClass}
                                />
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => {
                                handleInputChange("length", isIP ? 120 : 36.6);
                                handleInputChange("fittingAllowance", 20);
                                handleInputChange("elevation", isIP ? 20 : 6.1);
                                toast.success("Piping layout reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Piping Layout</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "pipeLayout", label: "Piping Layout" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                      </div>

                      {/* Hydraulic Pipe Sizing Verification Banner */}
                      <div className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                        isAdequate
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200"
                          : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200"
                      }`}>
                        {isAdequate ? (
                          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        ) : (
                          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        )}
                        <div>
                          <strong className="text-[12px] block">
                            {isAdequate ? "Hydraulic Pipe Sizing Verified:" : "Hydraulic Inadequacy Warning:"}
                          </strong>
                          <p className="mt-0.5 leading-relaxed text-[11.5px]">
                            {isAdequate
                              ? `Selected pipe size ${calculations.rec.nps} NPS (${calculations.rec.dn}) delivers ${(isIP ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} ${pressUnit} residual pressure at remote fixture (exceeding ${inputs.pResid} ${pressUnit} requirement) with velocity of ${(isIP ? calculations.rec.v_fps : calculations.rec.v_ms).toFixed(2)} ${velUnit}.`
                              : `The calculated residual pressure ${(isIP ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} ${pressUnit} is below the required ${inputs.pResid} ${pressUnit}. Please increase supply pressure or reduce run length.`}
                          </p>
                        </div>
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
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isAdequate
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              }`}>
                                {isAdequate ? <ShieldCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                                <span>{isAdequate ? "Adequate Pressure" : "Inadequate Pressure"}</span>
                              </span>
                            </div>

                            {/* 4 Colorful Top Metric Tiles (Matching Pump Sizing) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Recommended Size</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {calculations.rec.nps} <span className="text-xs font-normal text-muted-foreground">NPS</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">({calculations.rec.dn})</span>
                              </div>

                              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Water Velocity</div>
                                <div className={`text-xl font-bold font-mono mt-1 ${calculations.rec.isVelocityOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                  {(isIP ? calculations.rec.v_fps : calculations.rec.v_ms).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{velUnit}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Target: 1.0 - 2.4 m/s</span>
                              </div>

                              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Friction Head Loss</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {(isIP ? calculations.rec.hf_psi : calculations.rec.hf_kpa).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{pressUnit}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Hazen-Williams (C={calculations.C})</span>
                              </div>

                              <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Residual at Fixture</div>
                                <div className={`text-xl font-bold font-mono mt-1 ${calculations.rec.isPressureOk ? "text-purple-600 dark:text-purple-400" : "text-red-500 dark:text-red-400"}`}>
                                  {(isIP ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{pressUnit}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Min Req: {inputs.pResid} {pressUnit}</span>
                              </div>
                            </div>

                            {/* SIZING SCHEDULE (ALL PIPE SIZES TABLE) */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-3">
                              <div className="flex justify-between items-center text-xs font-bold text-foreground">
                                <span className="uppercase tracking-wider text-[11px] text-muted-foreground">Sizing Schedule (All Pipe Sizes)</span>
                                <span className="text-muted-foreground text-[10.5px]">Available: {inputs.pAvail} {pressUnit}</span>
                              </div>

                              <div className="overflow-x-auto border border-border/60 rounded-xl bg-background">
                                <table className="w-full text-[11px] font-sans text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-900 font-bold text-foreground border-b border-border/60">
                                      <th className="py-1.5 px-2.5 text-center">NPS</th>
                                      <th className="py-1.5 px-2.5 text-center">DN</th>
                                      <th className="py-1.5 px-2.5 text-right">Velocity</th>
                                      <th className="py-1.5 px-2.5 text-right">Friction Drop</th>
                                      <th className="py-1.5 px-2.5 text-right">Residual Press</th>
                                      <th className="py-1.5 px-2.5 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/40 font-mono">
                                    {calculations.rows.map((r) => {
                                      const isChosen = calculations.rec?.nps === r.nps;
                                      const showVel = isIP ? r.v_fps : r.v_ms;
                                      const showFric = isIP ? r.hf_psi : r.hf_kpa;
                                      const showResid = isIP ? r.resid_psi : r.resid_kpa;

                                      return (
                                        <tr key={r.nps} className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${isChosen ? "bg-primary/10 font-bold" : ""}`}>
                                          <td className="py-1.5 px-2.5 text-center font-bold font-sans">{r.nps}</td>
                                          <td className="py-1.5 px-2.5 text-center">{r.dn}</td>
                                          <td className="py-1.5 px-2.5 text-right">{showVel.toFixed(2)} {velUnit}</td>
                                          <td className="py-1.5 px-2.5 text-right">{showFric.toFixed(2)} {pressUnit}</td>
                                          <td className={`py-1.5 px-2.5 text-right font-bold ${r.isPressureOk ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                            {showResid.toFixed(1)} {pressUnit}
                                          </td>
                                          <td className="py-1.5 px-2.5 text-center font-sans">
                                            {r.ok ? (
                                              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                                                <Check className="size-3" /> {isChosen ? "RECOMMENDED" : "PASS"}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground/60 text-[10px]">
                                                {r.resid_psi < calculations.pResid_psi ? "NON-COMPLIANT" : "HIGH VELOCITY"}
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

                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => copyToClipboard(`Recommended Size: ${calculations.rec.nps} (${calculations.rec.dn}), Velocity: ${(isIP ? calculations.rec.v_fps : calculations.rec.v_ms).toFixed(2)} ${velUnit}, Residual: ${(isIP ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} ${pressUnit}`)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Results Summary</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={handleExportPdf}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                          >
                            <FileText className="size-3.5" />
                            <span>Export PDF Report</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => setActiveCommentTarget({ id: "results", label: "Calculation Results" })}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add / View Comment</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </div>
                </div>
              ) : (
                /* Report View Tab (Preliminary Document Format) */
                <PipeSizerReportView
                  inputs={inputs}
                  calculations={calculations}
                  project={project}
                  calcReviewState={calcReviewState}
                  currentUserName={currentUserName}
                  isIP={isIP}
                  flowUnit={flowUnit}
                  pressUnit={pressUnit}
                  lenUnit={lenUnit}
                  velUnit={velUnit}
                  isAdequate={isAdequate}
                  onExportPdf={handleExportPdf}
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
            <SupplyPipeIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              inputs={inputs}
              handleInputChange={handleInputChange}
              setInputs={(newInputs: SupplyPipeInputs) => {
                setInputs(newInputs);
                saveState(newInputs);
              }}
              calculations={calculations}
              flowUnit={flowUnit}
              pressUnit={pressUnit}
              lenUnit={lenUnit}
              velUnit={velUnit}
              isIP={isIP}
              isEffectiveReadOnly={isEffectiveReadOnly}
            />
          )}
        </div>
      </div>

      {/* Formula & Derivations Modal */}
      {showFormulaModal && (
        <SupplyPipeFormulaModal
          inputs={inputs}
          calculations={calculations}
          isIP={isIP}
          flowUnit={flowUnit}
          pressUnit={pressUnit}
          lenUnit={lenUnit}
          velUnit={velUnit}
          onClose={() => setShowFormulaModal(false)}
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

// Live Intelligence Drawer Component for Water Supply Pipe Sizer
function SupplyPipeIntelligenceDrawer({
  onClose,
  inputs,
  handleInputChange,
  setInputs,
  calculations,
  flowUnit,
  pressUnit,
  lenUnit,
  velUnit,
  isIP,
  isEffectiveReadOnly,
}: {
  onClose: () => void;
  inputs: SupplyPipeInputs;
  handleInputChange: (field: keyof SupplyPipeInputs, val: any) => void;
  setInputs: (inputs: SupplyPipeInputs) => void;
  calculations: any;
  flowUnit: string;
  pressUnit: string;
  lenUnit: string;
  velUnit: string;
  isIP: boolean;
  isEffectiveReadOnly: boolean;
}) {
  const applyPreset = (preset: {
    flow: number;
    pAvail: number;
    pResid: number;
    length: number;
    fittingAllowance: number;
    elevation: number;
    pipeMaterial: string;
  }) => {
    if (isEffectiveReadOnly) return;
    const nextInputs: SupplyPipeInputs = {
      ...inputs,
      flow: isIP ? Number((preset.flow * 15.8503).toFixed(2)) : preset.flow,
      pAvail: isIP ? Number((preset.pAvail / 6.89476).toFixed(1)) : preset.pAvail,
      pResid: isIP ? Number((preset.pResid / 6.89476).toFixed(1)) : preset.pResid,
      length: isIP ? Number((preset.length * 3.28084).toFixed(1)) : preset.length,
      fittingAllowance: preset.fittingAllowance,
      elevation: isIP ? Number((preset.elevation * 3.28084).toFixed(1)) : preset.elevation,
      pipeMaterial: preset.pipeMaterial,
    };
    setInputs(nextInputs);
    toast.success("Applied archetype preset configuration");
  };

  const recVel = isIP ? calculations.rec.v_fps : calculations.rec.v_ms;
  const isHighVel = recVel > (isIP ? 8.0 : 2.4);
  const isLowVel = recVel < (isIP ? 2.0 : 0.6);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4.5 text-primary" />
          <div>
            <h3 className="font-bold text-[13.5px] uppercase tracking-wider text-foreground">Live Intelligence</h3>
            <p className="text-[10.5px] text-muted-foreground font-medium">ASPE / IPC Hydraulic Optimization Engine</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Close Live Intelligence"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-[12.5px] leading-relaxed text-foreground custom-scrollbar">
        
        {/* 1. Velocity Audit Card */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
              <Activity className="size-4 text-primary" />
              <span>Velocity Compliance Audit</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${calculations.rec.isVelocityOk ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
              {calculations.rec.isVelocityOk ? "OPTIMAL" : isHighVel ? "EROSION RISK" : "SEDIMENT RISK"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-border/60 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Standard Range:</span>
              <span className="font-bold text-foreground font-mono">1.0 - 2.4 m/s (3 - 8 fps)</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Selected Velocity:</span>
              <span className={`font-bold font-mono ${calculations.rec.isVelocityOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {recVel.toFixed(2)} {velUnit}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Recommended Size:</span>
              <span className="font-bold text-primary font-mono">{calculations.rec.nps} NPS ({calculations.rec.dn})</span>
            </div>
          </div>
        </div>

        {/* 2. Pipe Material Roughness Insights */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
            <Zap className="size-4 text-amber-500" />
            <span>Pipe Friction (C-Factor)</span>
          </span>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Hazen-Williams <strong>C = {calculations.C}</strong>. Copper &amp; CPVC (C=150) offer the lowest resistance, reducing pressure drop by up to 35% compared to steel (C=120).
          </p>
        </div>

        {/* 3. Project Archetype Presets */}
        <div className="border border-border rounded-2xl p-4 bg-background shadow-2xs flex flex-col gap-3">
          <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
            <Building2 className="size-4 text-primary" />
            <span>Quick Project Archetypes</span>
          </span>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => applyPreset({
                flow: 1.58,
                pAvail: 413.7,
                pResid: 137.9,
                length: 36.6,
                fittingAllowance: 20,
                elevation: 6.1,
                pipeMaterial: "150",
              })}
              className="p-2.5 rounded-xl border border-border/80 bg-slate-50/70 dark:bg-slate-900/40 hover:border-primary/60 text-left transition flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Home className="size-4 text-primary shrink-0" />
                <div>
                  <strong className="text-xs text-foreground block">Residential Branch Header</strong>
                  <span className="text-[10.5px] text-muted-foreground">1.58 L/s · 36.6 m Run · Copper C=150</span>
                </div>
              </div>
              <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
            </button>

            <button
              type="button"
              disabled={isEffectiveReadOnly}
              onClick={() => applyPreset({
                flow: 6.3,
                pAvail: 480.0,
                pResid: 150.0,
                length: 85.0,
                fittingAllowance: 25,
                elevation: 18.0,
                pipeMaterial: "150",
              })}
              className="p-2.5 rounded-xl border border-border/80 bg-slate-50/70 dark:bg-slate-900/40 hover:border-primary/60 text-left transition flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary shrink-0" />
                <div>
                  <strong className="text-xs text-foreground block">Commercial Multi-Storey Riser</strong>
                  <span className="text-[10.5px] text-muted-foreground">6.30 L/s · 85 m Run · 18 m Elevation</span>
                </div>
              </div>
              <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Preliminary Report View Component
function PipeSizerReportView({
  inputs,
  calculations,
  project,
  calcReviewState,
  currentUserName,
  isIP,
  flowUnit,
  pressUnit,
  lenUnit,
  velUnit,
  isAdequate,
}: {
  inputs: SupplyPipeInputs;
  calculations: any;
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  isIP: boolean;
  flowUnit: string;
  pressUnit: string;
  lenUnit: string;
  velUnit: string;
  isAdequate: boolean;
}) {
  const calcNo = `CALC-WSP-${project?.code || "001"}`;
  const projectNo = project?.code || "PRJ-001";
  const projectName = project?.name || "Water Supply Pipe Sizing Project";
  const clientName = (project as any)?.client || "Client Representative";
  const endUser = (project as any)?.endUser || "Building Facilities / MEP Department";
  const today = formatDateStr(new Date().toISOString());

  const sigDetails = getSignatureBlockDetails(calcReviewState, currentUserName);

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
                Water Supply Pipe Sizing Preliminary Report
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Design Standards: IPC Table 604.4 / ASPE Data Book / Hazen-Williams Friction Loss (C={calculations.C})
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

          {/* Table 1: Design Parameters & Pipe Run Constraints */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              1. Hydraulic Design Parameters &amp; Constraints
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                      <th className="py-2 px-2.5 w-10">Sr.</th>
                      <th className="py-2 px-3 text-left">Parameter Description</th>
                      <th className="py-2 px-3 text-center w-32">Design Value</th>
                      <th className="py-2 px-3 text-center w-36">IP Equivalent</th>
                      <th className="py-2 px-3 text-left">Engineering Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">1</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Design Flow Rate (Q)</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{inputs.flow.toFixed(2)} {flowUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">{calculations.Q_gpm.toFixed(1)} GPM</td>
                      <td className="py-2 px-3 text-muted-foreground">Continuous domestic water fixture flow rate</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">2</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Pipe Material &amp; Friction C</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">C = {calculations.C}</td>
                      <td className="py-2 px-3 text-center font-mono">{inputs.pipeMaterial === "150" ? "Copper / CPVC" : "PEX / Steel"}</td>
                      <td className="py-2 px-3 text-muted-foreground">Hazen-Williams roughness coefficient</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">3</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Available Supply Pressure</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{inputs.pAvail.toFixed(1)} {pressUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">{calculations.pAvail_psi.toFixed(1)} psi</td>
                      <td className="py-2 px-3 text-muted-foreground">Source / booster pump discharge pressure</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">4</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Required Residual Pressure</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{inputs.pResid.toFixed(1)} {pressUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">{calculations.pResid_psi.toFixed(1)} psi</td>
                      <td className="py-2 px-3 text-muted-foreground">Minimum residual at most remote fixture</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">5</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Pipe Linear &amp; Effective Length</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{(calculations.Leff * (isIP ? 1 : 0.3048)).toFixed(1)} {lenUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">{calculations.Leff.toFixed(1)} ft</td>
                      <td className="py-2 px-3 text-muted-foreground">Includes {inputs.fittingAllowance}% equivalent fittings allowance</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">6</td>
                      <td className="py-2 px-3 font-semibold text-foreground">Elevation Static Loss</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{(isIP ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2)} {pressUnit}</td>
                      <td className="py-2 px-3 text-center font-mono">{calculations.elevLoss_psi.toFixed(2)} psi</td>
                      <td className="py-2 px-3 text-muted-foreground">Static head for {inputs.elevation} {lenUnit} elevation rise</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Table 2: Pipe Sizing Schedule */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              2. Complete Pipe Sizing Schedule &amp; Hydraulic Evaluation
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                      <th className="py-2 px-2.5 w-10">Sr.</th>
                      <th className="py-2 px-3 text-center w-28">Nominal (NPS)</th>
                      <th className="py-2 px-3 text-center w-28">Metric (DN)</th>
                      <th className="py-2 px-3 text-right w-32">Velocity</th>
                      <th className="py-2 px-3 text-right w-36">Friction Loss</th>
                      <th className="py-2 px-3 text-right w-36">Residual Press</th>
                      <th className="py-2 px-3 text-center w-36">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    {calculations.rows.map((r: any, idx: number) => {
                      const isChosen = calculations.rec?.nps === r.nps;
                      const showVel = isIP ? r.v_fps : r.v_ms;
                      const showFric = isIP ? r.hf_psi : r.hf_kpa;
                      const showResid = isIP ? r.resid_psi : r.resid_kpa;

                      return (
                        <tr
                          key={r.nps}
                          className={isChosen ? "bg-[#DAE9F8] dark:bg-[#0c2e47] font-bold text-foreground" : "hover:bg-muted/30"}
                        >
                          <td className="py-2 px-2.5 text-center text-muted-foreground font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 text-center font-bold font-mono">{r.nps}</td>
                          <td className="py-2 px-3 text-center font-mono">{r.dn}</td>
                          <td className="py-2 px-3 text-right font-mono">{showVel.toFixed(2)} {velUnit}</td>
                          <td className="py-2 px-3 text-right font-mono">{showFric.toFixed(2)} {pressUnit}</td>
                          <td className={`py-2 px-3 text-right font-mono ${r.isPressureOk ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-red-500 font-bold"}`}>
                            {showResid.toFixed(1)} {pressUnit}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {r.ok ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                {isChosen ? "✓ RECOMMENDED" : "✓ PASS"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/70">
                                {r.resid_psi < calculations.pResid_psi ? "LOW PRESSURE" : "VELOCITY EXCEEDED"}
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
          </div>

          {/* Status Verification Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
            isAdequate
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
          }`}>
            <CheckCircle className={`size-5 shrink-0 ${isAdequate ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} mt-0.5`} />
            <div>
              <strong className="text-sm block">
                {isAdequate ? "Hydraulic Pipe Sizing Verification: PASSED (COMPLIANT)" : "Hydraulic Pipe Sizing Verification: WARNING (NON-COMPLIANT)"}
              </strong>
              <p className="mt-1 leading-relaxed text-xs">
                {isAdequate
                  ? `The selected pipe size of ${calculations.rec.nps} NPS (${calculations.rec.dn}) achieves a velocity of ${(isIP ? calculations.rec.v_fps : calculations.rec.v_ms).toFixed(2)} ${velUnit} and provides ${(isIP ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} ${pressUnit} residual pressure, fully satisfying IPC Table 604.4 and ASPE engineering constraints.`
                  : `Residual pressure is below the minimum design requirement of ${inputs.pResid} ${pressUnit}. Available pressure is insufficient to overcome hydraulic friction and elevation head loss.`}
              </p>
            </div>
          </div>

          {/* Table 3: 4-Column Dynamic Signatures */}
          <div className="space-y-2 pt-2">
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold border-b border-border text-center">
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

// Step-by-Step Formula Breakdown Modal
function SupplyPipeFormulaModal({
  inputs,
  calculations,
  isIP,
  flowUnit,
  pressUnit,
  lenUnit,
  velUnit,
  onClose,
}: {
  inputs: SupplyPipeInputs;
  calculations: any;
  isIP: boolean;
  flowUnit: string;
  pressUnit: string;
  lenUnit: string;
  velUnit: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4 max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Info className="size-5 text-primary" />
            <div>
              <h3 className="font-bold text-base text-foreground">Hazen-Williams Pipe Sizing Derivations</h3>
              <p className="text-xs text-muted-foreground">ASPE / IPC Hydraulic Calculations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Derivations Content */}
        <div className="flex-1 overflow-y-auto space-y-4 text-xs leading-relaxed custom-scrollbar pr-1">
          
          {/* Step 1 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-border space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">1</span>
              <span>Effective Length with Fittings Allowance</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Valves and fittings add equivalent length to the straight physical pipe run:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              L_eff = L_run × (1 + Fittings% ÷ 100)
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              L_eff = {calculations.L_ft.toFixed(1)} ft × (1 + {inputs.fittingAllowance}%) = {calculations.Leff.toFixed(1)} ft ({(calculations.Leff * 0.3048).toFixed(1)} m)
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-border space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">2</span>
              <span>Static Elevation Head Loss</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Gravity pressure loss for lifting water vertically:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              ΔP_elev (psi) = Elevation_Rise (ft) ÷ 2.31
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              ΔP_elev = {calculations.elev_ft.toFixed(1)} ft ÷ 2.31 = {(isIP ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2)} {pressUnit}
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-border space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">3</span>
              <span>Hazen-Williams Hydraulic Friction Equation</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Pressure drop per pipe diameter under specified roughness coefficient C:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              hf (psi) = [4.52 × L_eff × Q^1.85] ÷ [C^1.85 × d^4.87]
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              For {calculations.rec.nps} (d = {calculations.rec.id}"): hf = {(isIP ? calculations.rec.hf_psi : calculations.rec.hf_kpa).toFixed(2)} {pressUnit}
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-border space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px]">4</span>
              <span>Residual Pressure Verification</span>
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Available pressure must exceed the required minimum residual pressure at the remote fixture:
            </p>
            <div className="p-2.5 rounded-lg bg-background border font-mono text-primary text-xs">
              P_residual = P_available − hf − ΔP_elev ≥ P_required
            </div>
            <p className="text-muted-foreground text-[11px] font-mono">
              P_resid = {(isIP ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1)} {pressUnit} (Requirement: ≥ {inputs.pResid} {pressUnit})
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
