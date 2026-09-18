import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import {
  AlertTriangle, CheckCircle2, FileText, Zap, SlidersHorizontal,
  X, Check, Edit3, MessageSquare, Copy, RotateCcw, Trash2, Sparkles,
  ShieldCheck, Info
} from "lucide-react";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { toast } from "sonner";
import { exportSanityCheckPDF } from "@/lib/exportSanityCheckPDF";
import { useWorkspace } from "@/lib/workspace-store";
import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { VersionManager } from "@/components/workspace/VersionManager";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
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
      { name: "description", content: "Interactive engineering sanity checker for duct, pipe, and energy values." },
    ],
  }),
  component: SanityCheckToolPage,
});

interface CheckResult {
  label: string;
  value: string;
  status: "pass" | "warn";
  range: string;
  desc: string;
}

interface ParamDef {
  id: string;
  label: string;
  val: number;
  unit: string;
  min: number;
  baseline: number;
  max: number;
  desc: string;
  setter: (val: number) => void;
  gridSpan?: string;
}

function SanityCheckToolPage() {
  const { project, activeProjectId, isReadOnly } = useWorkspace();

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  const [ductVel, setDuctVel] = useState<number>(1500);
  const [ductFr, setDuctFr] = useState<number>(0.08);
  const [esp, setEsp] = useState<number>(0.5);
  const [pipeVel, setPipeVel] = useState<number>(4.0);
  const [pumpHead, setPumpHead] = useState<number>(50);
  const [cfmTr, setCfmTr] = useState<number>(400);
  const [supTemp, setSupTemp] = useState<number>(55);
  const [chwDt, setChwDt] = useState<number>(10);
  const [chillerEff, setChillerEff] = useState<number>(0.65);
  const [hasCalculated, setHasCalculated] = useState<boolean>(true);
  const [calcReviewState, setCalcReviewState] = useState<any>(null);
  const isApprovedLocked = calcReviewState?.status === "APPROVED";
  const isEffectiveReadOnly = isReadOnly || (typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly)) || isApprovedLocked;
  const [intelOpen, setIntelOpen] = useState<boolean>(false);

  // Edit modal state (triggered on double-click or right-click -> Edit)
  const [editingParam, setEditingParam] = useState<ParamDef | null>(null);
  const [tempEditValue, setTempEditValue] = useState<number>(0);

  // Comment & Task Assignment Modal State - exactly like Preliminary Cooling Load
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type?: string } | null>(null);

  const ip = unitSystem === "ip";

  // Project-keyed comments storage - exactly matching Preliminary Cooling Load logic
  const [paramComments, setParamComments] = useState<Record<string, any[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const pId = activeProjectId || project?.id || "default";
      const saved = localStorage.getItem(`mep_sanity_comments_${pId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Sync with project changes - exactly like Preliminary Cooling Load
  useEffect(() => {
    const pId = activeProjectId || project?.id;
    if (!pId) return;
    const projKey = `mep_sanity_comments_${pId}`;
    const saved = localStorage.getItem(projKey);
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setParamComments(parsed);
          return;
        }
      } catch {}
    }
    setParamComments({});
  }, [activeProjectId, project?.id]);

  const saveParamComments = (updated: Record<string, any[]>) => {
    setParamComments(updated);
    try {
      const pId = activeProjectId || project?.id || "default";
      localStorage.setItem(`mep_sanity_comments_${pId}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-persist full calculator state for VersionManager snapshots
  useEffect(() => {
    const pId = activeProjectId || project?.id || "default";
    const dataToSave = {
      unitSystem,
      ductVel,
      ductFr,
      esp,
      pipeVel,
      pumpHead,
      cfmTr,
      supTemp,
      chwDt,
      chillerEff,
      hasCalculated,
      paramComments,
    };
    try {
      localStorage.setItem(`mep_sanity_calc_${pId}`, JSON.stringify(dataToSave));
    } catch (e) {}
  }, [
    activeProjectId, project?.id, unitSystem, ductVel, ductFr, esp,
    pipeVel, pumpHead, cfmTr, supTemp, chwDt, chillerEff, hasCalculated, paramComments
  ]);

  // Version History Restore Listener (Full parity with Ventilation & VersionManager)
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pId = activeProjectId || project?.id || "default";
      const pKey = `mep_sanity_calc_${pId}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache && lsCache[pKey]) {
        try {
          restoredData = typeof lsCache[pKey] === "string" ? JSON.parse(lsCache[pKey]) : lsCache[pKey];
        } catch (err) {}
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey);
        if (stored) {
          try {
            restoredData = JSON.parse(stored);
          } catch (err) {}
        }
      }
      if (restoredData) {
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        if (restoredData.ductVel !== undefined) setDuctVel(restoredData.ductVel);
        if (restoredData.ductFr !== undefined) setDuctFr(restoredData.ductFr);
        if (restoredData.esp !== undefined) setEsp(restoredData.esp);
        if (restoredData.pipeVel !== undefined) setPipeVel(restoredData.pipeVel);
        if (restoredData.pumpHead !== undefined) setPumpHead(restoredData.pumpHead);
        if (restoredData.cfmTr !== undefined) setCfmTr(restoredData.cfmTr);
        if (restoredData.supTemp !== undefined) setSupTemp(restoredData.supTemp);
        if (restoredData.chwDt !== undefined) setChwDt(restoredData.chwDt);
        if (restoredData.chillerEff !== undefined) setChillerEff(restoredData.chillerEff);
        if (restoredData.hasCalculated !== undefined) setHasCalculated(restoredData.hasCalculated);
        if (restoredData.paramComments !== undefined) {
          setParamComments(restoredData.paramComments);
          try {
            localStorage.setItem(`mep_sanity_comments_${pId}`, JSON.stringify(restoredData.paramComments));
          } catch (err) {}
        }
        toast.success("Sanity Check Tool restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [activeProjectId, project?.id]);

  const handleOpenComment = (id: string, name: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Adding comments is locked.", { id: "readonly-notice" });
      return;
    }
    setCommentTargetItem({ id, name, type: "parameter" });
    setCommentModalOpen(true);
  };

  const totalCommentsCount = useMemo(() => {
    return Object.values(paramComments).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  }, [paramComments]);

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);

    if (shouldConvert) {
      // Convert inputs
      if (targetUnit === "ip") {
        setDuctVel(Number((ductVel * 196.85).toFixed(0)));
        setDuctFr(Number((ductFr / 8.16828).toFixed(3)));
        setEsp(Number((esp / 248.84).toFixed(2)));
        setPipeVel(Number((pipeVel * 3.28084).toFixed(1)));
        setPumpHead(Number((pumpHead * 0.33455).toFixed(1)));
        setCfmTr(Number((cfmTr * 8.48).toFixed(0)));
        setSupTemp(Number((supTemp * 1.8 + 32).toFixed(1)));
        setChwDt(Number((chwDt * 1.8).toFixed(1)));
        setChillerEff(Number((3.51685 / chillerEff).toFixed(2)));
      } else {
        setDuctVel(Number((ductVel / 196.85).toFixed(2)));
        setDuctFr(Number((ductFr * 8.16828).toFixed(2)));
        setEsp(Number((esp * 248.84).toFixed(0)));
        setPipeVel(Number((pipeVel / 3.28084).toFixed(2)));
        setPumpHead(Number((pumpHead / 0.33455).toFixed(0)));
        setCfmTr(Number((cfmTr / 8.48).toFixed(1)));
        setSupTemp(Number(((supTemp - 32) / 1.8).toFixed(1)));
        setChwDt(Number((chwDt / 1.8).toFixed(1)));
        setChillerEff(Number((3.51685 / chillerEff).toFixed(2)));
      }
    }
    toast.info(`Switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"} units`);
  };

  const paramsList = useMemo((): ParamDef[] => [
    {
      id: "duct-vel",
      label: "Duct Velocity",
      val: ductVel,
      unit: ip ? "FPM" : "m/s",
      min: ip ? 1000 : 5.0,
      baseline: ip ? 1500 : 7.62,
      max: ip ? 2500 : 12.7,
      desc: "Main duct velocity range to balance noise and friction.",
      setter: setDuctVel,
    },
    {
      id: "duct-fr",
      label: "Duct Friction",
      val: ductFr,
      unit: ip ? "in w.g./100ft" : "Pa/m",
      min: ip ? 0.05 : 0.4,
      baseline: ip ? 0.08 : 0.65,
      max: ip ? 0.15 : 1.2,
      desc: "Standard friction design rate for equal friction method.",
      setter: setDuctFr,
    },
    {
      id: "esp",
      label: "Duct Static (ESP)",
      val: esp,
      unit: ip ? "in w.g." : "Pa",
      min: ip ? 0.2 : 50,
      baseline: ip ? 0.5 : 124,
      max: ip ? 2.0 : 500,
      desc: "Typical external static pressure for fans.",
      setter: setEsp,
    },
    {
      id: "cfm-tr",
      label: "Airflow / Ton",
      val: cfmTr,
      unit: ip ? "CFM/TR" : "L/s/kW",
      min: ip ? 350 : 47,
      baseline: ip ? 400 : 47.2,
      max: ip ? 450 : 60,
      desc: "Comfort cooling sensible heat ratio airflow index.",
      setter: setCfmTr,
    },
    {
      id: "pipe-vel",
      label: "Pipe Velocity",
      val: pipeVel,
      unit: ip ? "fps" : "m/s",
      min: ip ? 2.0 : 0.6,
      baseline: ip ? 4.0 : 1.22,
      max: ip ? 8.0 : 2.4,
      desc: "Pipe fluid velocity limits to prevent erosion and sedimentation.",
      setter: setPipeVel,
    },
    {
      id: "pump-head",
      label: "Pump Total Head",
      val: pumpHead,
      unit: ip ? "ft w.g." : "kPa",
      min: ip ? 20 : 60,
      baseline: ip ? 50 : 149,
      max: ip ? 100 : 300,
      desc: "Typical chilled water circuit head requirement.",
      setter: setPumpHead,
    },
    {
      id: "sup-temp",
      label: "Supply Air Temp",
      val: supTemp,
      unit: ip ? "°F" : "°C",
      min: ip ? 50 : 10,
      baseline: ip ? 55 : 12.8,
      max: ip ? 60 : 15,
      desc: "Cooling coil supply dew point range for space relative humidity control.",
      setter: setSupTemp,
    },
    {
      id: "chw-dt",
      label: "CHW Delta T",
      val: chwDt,
      unit: ip ? "°F" : "°C",
      min: ip ? 8 : 4.4,
      baseline: ip ? 10 : 5.6,
      max: ip ? 14 : 7.7,
      desc: "Chilled water temperature rise across coil.",
      setter: setChwDt,
    },
    {
      id: "chiller-eff",
      label: ip ? "Chiller Efficiency" : "Chiller COP",
      val: chillerEff,
      unit: ip ? "kW/TR" : "COP",
      min: ip ? 0.5 : 4.4,
      baseline: ip ? 0.65 : 5.41,
      max: ip ? 0.8 : 7.0,
      desc: ip
        ? "Centrifugal / water-cooled chiller full-load index."
        : "Centrifugal / water-cooled chiller full-load coefficient of performance.",
      setter: setChillerEff,
      gridSpan: "sm:col-span-2",
    },
  ], [ductVel, ductFr, esp, cfmTr, pipeVel, pumpHead, supTemp, chwDt, chillerEff, ip]);

  const checks = useMemo((): CheckResult[] => {
    return paramsList.map((p) => {
      const pass = p.val >= p.min && p.val <= p.max;
      return {
        label: p.label,
        value: `${p.val.toFixed(p.val < 10 ? 3 : 1)} ${p.unit}`,
        status: pass ? "pass" : "warn",
        range: `${p.min} – ${p.max} ${p.unit}`,
        desc: p.desc,
      };
    });
  }, [paramsList]);

  const handleCalculate = () => {
    setHasCalculated(true);
  };

  const handleExportPDF = () => {
    exportSanityCheckPDF({
      checks,
      unitSystem,
    });
  };

  // Double-click / Right-click handlers
  const handleOpenEditParam = (p: ParamDef) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are disabled.", { id: "readonly-notice" });
      return;
    }
    setEditingParam(p);
    setTempEditValue(p.val);
  };

  const handleSaveEditedParam = () => {
    if (!editingParam) return;
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are disabled.", { id: "readonly-notice" });
      setEditingParam(null);
      return;
    }
    editingParam.setter(tempEditValue);
    setEditingParam(null);
    setHasCalculated(true);
    toast.success(`Updated ${editingParam.label} to ${tempEditValue} ${editingParam.unit}`);
  };

  const handleResetBaseline = (p: ParamDef) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are disabled.", { id: "readonly-notice" });
      return;
    }
    p.setter(p.baseline);
    setHasCalculated(true);
    toast.success(`Reset ${p.label} to baseline (${p.baseline} ${p.unit})`);
  };

  const handleResetAllBaselines = () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are disabled.", { id: "readonly-notice" });
      return;
    }
    paramsList.forEach(p => p.setter(p.baseline));
    setHasCalculated(true);
    toast.success("Reset all parameters to standard baseline values!");
  };

  const handleCopyParamValue = (p: ParamDef) => {
    navigator.clipboard.writeText(`${p.val} ${p.unit}`);
    toast.success(`Copied ${p.label} value: ${p.val} ${p.unit}`);
  };

  const handleCopyParam = (p: ParamDef) => {
    const text = `${p.label}: ${p.val} ${p.unit}\nStandard Range: ${p.min} – ${p.max} ${p.unit}\nGuideline: ${p.desc}`;
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${p.label} details to clipboard`);
  };

  // Reusable Context Menu Content (Standardized to match Preliminary Cooling Load / Ventilation)
  const renderParamContextMenu = (p: ParamDef) => {
    const itemComments = paramComments[p.id] || [];
    return (
      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={() => handleOpenEditParam(p)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Edit Parameter</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => handleCopyParamValue(p)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>Duplicate / Copy Value</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => handleOpenComment(p.id, p.label)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>{itemComments.length > 0 ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={() => handleResetBaseline(p)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <RotateCcw className="size-3.5 text-muted-foreground" />
          <span>Reset to Baseline ({p.baseline} {p.unit})</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => handleCopyParam(p)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>Copy Value & Guideline</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
        >
          <FileText className="size-3.5 text-muted-foreground" />
          <span>Export PDF Report</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        <ContextMenuItem
          onClick={() => handleResetBaseline(p)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Reset to Default</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  return (
    <AppShell title="Sanity Check Tool" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 pb-6 gap-5 overflow-y-auto h-full w-full">
          {/* Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Engineering Sanity Check Tool</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{checks.length} checks</span>
                </div>
                <button
                  type="button"
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
                <CalculationReviewBar
                  projectId={activeProjectId || project?.id || "default"}
                  calculatorPath="/sanity-check-tool"
                  calculatorTitle="Engineering Sanity Check Tool"
                  onReviewStateChange={setCalcReviewState}
                />
                {totalCommentsCount > 0 && (
                  <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>{totalCommentsCount} Active Task(s) / Comment(s)</span>
                  </div>
                )}
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Verify your design numbers against standard ASHRAE, SMACNA, and Carrier parameters.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Inputs */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Design Values</h3>
                  </div>
                  <UnitToggle
                    unitSystem={unitSystem}
                    onChange={handleUnitSystemChange}
                    inputDescriptions="Duct & Pipe Velocities, Pressures, Temps"
                    conversionExample={unitSystem === "si" ? "Convert 7.6 m/s → 1,500 FPM, 20 Pa/m → 0.08 in.wg/100ft" : "Convert 1500 FPM → 7.6 m/s, 0.08 in.wg/100ft → 20 Pa/m"}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {paramsList.map((p) => {
                    const itemComments = paramComments[p.id] || [];
                    const isActive = editingParam?.id === p.id;
                    return (
                      <ContextMenu key={p.id}>
                        <ContextMenuTrigger asChild>
                          <div
                            onDoubleClick={() => handleOpenEditParam(p)}
                            className={`flex flex-col gap-1 select-none p-2 rounded-xl transition-all hover:bg-slate-100/70 dark:hover:bg-slate-800/50 cursor-pointer group border ${
                              isActive
                                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                                : "border-transparent"
                            } ${p.gridSpan || ""}`}
                            title="Right-click for options • Double-click to edit"
                          >
                            <label className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between cursor-pointer">
                              <span className="flex items-center gap-1.5">
                                <span>{p.label}</span>
                                {Array.isArray(itemComments) && itemComments.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenComment(p.id, p.label);
                                    }}
                                    className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
                                    title={`${itemComments.length} comment(s)/task(s) assigned to "${p.label}"`}
                                  >
                                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                                    <span className="text-[10px] font-bold font-mono">{itemComments.length}</span>
                                  </button>
                                )}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground/70">{p.unit}</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={p.val}
                              disabled={isEffectiveReadOnly}
                              onChange={(e) => {
                                if (isEffectiveReadOnly) return;
                                p.setter(Number(e.target.value));
                                setHasCalculated(true);
                              }}
                              className={`bg-slate-50/80 dark:bg-slate-900/60 border border-border/80 focus:border-[#0A7BC7] focus:ring-1 focus:ring-[#0A7BC7] rounded-lg px-2.5 py-1.5 font-bold font-mono text-xs text-foreground outline-none transition-all ${
                                isEffectiveReadOnly ? "opacity-60 cursor-not-allowed" : ""
                              }`}
                            />
                          </div>
                        </ContextMenuTrigger>
                        {renderParamContextMenu(p)}
                      </ContextMenu>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCalculate}
                className="w-full bg-[#0A7BC7] hover:bg-[#0863A0] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs hover:shadow-sm active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Zap className="size-3.5 fill-current" />
                Run Sanity Check
              </button>
            </div>

            {/* Right Results */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!hasCalculated ? (
                <div className="bg-card border border-border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[350px] text-center shadow-xs">
                  <div className="size-12 rounded-full bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-muted-foreground text-xl mb-4 border border-border/40 select-none">
                    📐
                  </div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase tracking-wider">Ready to Check</h4>
                  <p className="text-[11.5px] text-muted-foreground max-w-xs leading-normal">
                    Enter your calculated project parameters and run sanity checks to verify they comply with engineering guidelines.
                  </p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60 flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Engineering Audit Summary</h3>
                      </div>
                      {(() => {
                        const passCount = checks.filter(c => c.status === "pass").length;
                        const warnCount = checks.length - passCount;
                        return (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono">
                            <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="size-3" />
                              {passCount} Passed
                            </span>
                            {warnCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                <AlertTriangle className="size-3" />
                                {warnCount} Requires Review
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground transition-colors border border-border/60 cursor-pointer shadow-2xs"
                    >
                      <FileText className="size-3.5 text-red-600 dark:text-red-400" />
                      Export PDF
                    </button>
                  </div>

                  <div className="flex flex-col font-sans text-xs divide-y divide-border/40">
                    {checks.map((c, i) => {
                      const p = paramsList[i];
                      const itemComments = p ? (paramComments[p.id] || []) : [];
                      const isActive = p && editingParam?.id === p.id;
                      return (
                        <ContextMenu key={i}>
                          <ContextMenuTrigger asChild>
                            <div
                              onDoubleClick={() => p && handleOpenEditParam(p)}
                              className={`flex items-center justify-between py-2 px-2.5 rounded-lg transition-colors gap-3 cursor-pointer select-none border ${
                                isActive
                                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                                  : "border-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                              }`}
                              title="Right-click for options • Double-click to edit"
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-foreground text-xs leading-snug flex items-center gap-1.5">
                                  <span>{c.label}</span>
                                  {Array.isArray(itemComments) && itemComments.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (p) handleOpenComment(p.id, p.label);
                                      }}
                                      className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 dark:text-blue-400 shrink-0 cursor-pointer flex items-center gap-1"
                                      title={`${itemComments.length} comment(s)/task(s) assigned to "${c.label}"`}
                                    >
                                      <MessageSquare className="size-3.5 fill-blue-500/20" />
                                      <span className="text-[10px] font-bold font-mono">{itemComments.length}</span>
                                    </button>
                                  )}
                                </span>
                                <span className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">{c.desc}</span>
                              </div>
                              <div className="flex flex-col items-end shrink-0">
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                                  c.status === "pass"
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                }`}>
                                  <span>{c.value}</span>
                                  {c.status === "pass" ? (
                                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  ) : (
                                    <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground/80 mt-1">Std: {c.range}</span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          {p && renderParamContextMenu(p)}
                        </ContextMenu>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col" : "w-0"
          }`}
        >
          {intelOpen && (
            <SanityIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              checks={checks}
              paramsList={paramsList}
              unitSystem={unitSystem}
              handleExportPDF={handleExportPDF}
              onResetAllBaseline={handleResetAllBaselines}
              isReadOnly={isEffectiveReadOnly}
            />
          )}
        </div>
      </div>

      {/* Edit Parameter Modal (Triggered on Double-Click or Context Menu -> Edit) */}
      {editingParam && (() => {
        const isCompliant = tempEditValue >= editingParam.min && tempEditValue <= editingParam.max;
        return (
          <div 
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingParam(null);
            }}
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-scale-in">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <SlidersHorizontal className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Edit {editingParam.label}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Standard Range: {editingParam.min} – {editingParam.max} {editingParam.unit}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingParam(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 flex flex-col gap-4 text-xs">
                {/* Engineering Guidance Box */}
                <div className="text-[12px] text-muted-foreground bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-border/60 leading-relaxed">
                  <span className="font-semibold text-foreground">Engineering Guidance:</span> {editingParam.desc}
                </div>

                {/* Live Real-time Compliance Status */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isCompliant
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                }`}>
                  {isCompliant ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Complies with standard engineering guidelines ({editingParam.min} – {editingParam.max} {editingParam.unit})</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                      <span>Outside allowable range ({editingParam.min} – {editingParam.max} {editingParam.unit}) — Requires review</span>
                    </>
                  )}
                </div>

                {/* Input with Baseline reference */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-foreground flex justify-between items-center">
                    <span>Design Value ({editingParam.unit})</span>
                    <span className="text-muted-foreground font-mono text-[11px]">Std Baseline: {editingParam.baseline} {editingParam.unit}</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    autoFocus
                    value={tempEditValue}
                    onChange={(e) => setTempEditValue(Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEditedParam();
                      if (e.key === "Escape") setEditingParam(null);
                    }}
                    className="w-full bg-slate-100/60 dark:bg-slate-950/60 border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3.5 py-2 text-sm font-mono font-bold outline-none text-foreground"
                  />
                </div>

                {/* Quick Baseline Presets */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-[11px] font-semibold text-muted-foreground">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setTempEditValue(editingParam.min)}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border/60 transition cursor-pointer"
                  >
                    Min ({editingParam.min})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempEditValue(editingParam.baseline)}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition cursor-pointer font-bold"
                  >
                    Baseline ({editingParam.baseline})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempEditValue(editingParam.max)}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border/60 transition cursor-pointer"
                  >
                    Max ({editingParam.max})
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border/60 bg-muted/20">
                <button
                  type="button"
                  onClick={() => setEditingParam(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/60 transition cursor-pointer text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedParam}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[#0A7BC7] hover:bg-[#0863A0] text-white shadow-xs hover:shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="size-3.5" />
                  Apply & Recalculate
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Assign Comment & Task Modal - exactly like Preliminary Cooling Load */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="Parameter"
          calculatorTitle="Engineering Sanity Check Tool"
          calculatorPath="/sanity-check-tool"
          existingComments={paramComments[commentTargetItem.id] || []}
          onSave={(comment) => {
            const currentList = paramComments[commentTargetItem.id] || [];
            const nextComments = {
              ...paramComments,
              [commentTargetItem.id]: [...currentList, comment],
            };
            saveParamComments(nextComments);
          }}
        />
      )}
    </AppShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sanity Check Intelligence Drawer Component
   Real-time HVAC & Plumbing audit metrics, compliance scoring,
   dynamic engineering optimization advice, standards checks, and 1-click presets.
───────────────────────────────────────────────────────────────────────────── */

interface SanityIntelligenceDrawerProps {
  onClose: () => void;
  checks: CheckResult[];
  paramsList: ParamDef[];
  unitSystem: "si" | "ip";
  handleExportPDF: () => void;
  onResetAllBaseline: () => void;
  isReadOnly: boolean;
}

function SanityIntelligenceDrawer({
  onClose,
  checks,
  paramsList,
  unitSystem,
  handleExportPDF,
  onResetAllBaseline,
  isReadOnly,
}: SanityIntelligenceDrawerProps) {
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.length - passCount;
  const passPercentage = Math.round((passCount / checks.length) * 100);

  // Generate dynamic smart recommendations based on actual parameter values
  const recommendations = useMemo(() => {
    const recs: { title: string; desc: string; type: "warning" | "success" | "info" }[] = [];

    paramsList.forEach((p) => {
      if (p.id === "duct-vel") {
        if (p.val > p.max) {
          recs.push({
            title: "Excessive Duct Velocity",
            desc: `Duct velocity of ${p.val} ${p.unit} exceeds the recommended ${p.max} ${p.unit} maximum. High airflow speeds create regenerative duct noise, increase fan static pressure demand, and may require sound attenuators (SMACNA Manual).`,
            type: "warning",
          });
        } else if (p.val < p.min) {
          recs.push({
            title: "Low Duct Velocity",
            desc: `Duct velocity of ${p.val} ${p.unit} is below the ${p.min} ${p.unit} threshold. This may result in oversized duct dimensions and space constraints.`,
            type: "info",
          });
        }
      }

      if (p.id === "duct-fr") {
        if (p.val > p.max) {
          recs.push({
            title: "High Duct Friction Loss",
            desc: `Friction rate of ${p.val} ${p.unit} exceeds energy-efficient targets (${p.max} ${p.unit}). Consider resizing main trunk ducts to reduce fan brake horsepower (BHP).`,
            type: "warning",
          });
        }
      }

      if (p.id === "esp") {
        if (p.val > 1.2) {
          recs.push({
            title: "High Fan External Static Pressure",
            desc: `ESP of ${p.val} ${p.unit} requires heavy-duty centrifugal or VAV fans. Verify filter pressure drop, silencers, and VAV box resistance.`,
            type: "warning",
          });
        }
      }

      if (p.id === "pipe-vel") {
        if (p.val > p.max) {
          recs.push({
            title: "High Piping Velocity (Erosion Risk)",
            desc: `Water velocity of ${p.val} ${p.unit} exceeds ASHRAE 90.1 limits (${p.max} ${p.unit}). Velocities above threshold cause internal pipe wall erosion and water hammer in copper/steel headers.`,
            type: "warning",
          });
        }
      }

      if (p.id === "chw-dt") {
        if (p.val < 10 && unitSystem === "ip") {
          recs.push({
            title: "Low ΔT Syndrome Risk",
            desc: `Chilled water ΔT of ${p.val}°F is below standard 10°F–14°F. Low ΔT forces extra chillers and pumps to run at partial load, drastically wasting energy.`,
            type: "warning",
          });
        }
      }

      if (p.id === "chiller-eff") {
        if ((unitSystem === "ip" && p.val > 0.7) || (unitSystem === "si" && p.val < 5.0)) {
          recs.push({
            title: "Chiller Efficiency Optimization",
            desc: `Current chiller rating (${p.val} ${p.unit}) has room for improvement. Upgrading to VFD magnetic-bearing centrifugal chillers can achieve < 0.55 kW/TR (COP > 6.4).`,
            type: "info",
          });
        }
      }
    });

    if (recs.length === 0) {
      recs.push({
        title: "All Systems Within Engineering Guidelines",
        desc: "All entered ductwork, hydronic, and thermodynamic parameters fully comply with ASHRAE 90.1, SMACNA, and Carrier standard baselines.",
        type: "success",
      });
    }

    return recs;
  }, [paramsList, unitSystem]);

  return (
    <div className="flex flex-col h-full text-xs font-sans select-none overflow-hidden">
      {/* Drawer Header */}
      <div className="p-4 border-b border-border/80 flex items-center justify-between bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#0A7BC7]/10 text-[#0A7BC7]">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm tracking-tight">Sanity Intelligence & Audit</h3>
            <p className="text-[11px] text-muted-foreground">Real-time HVAC & Plumbing standard verification</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer"
          title="Close Intelligence Drawer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Drawer Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Compliance Health Score Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Audit Compliance Score</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
              passPercentage >= 80
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
            }`}>
              {passPercentage}% Compliant
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
              <span>{passCount} of {checks.length} Passed</span>
              <span>{warnCount} Requires Review</span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  passPercentage >= 80 ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${passPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Intelligent Optimizations & Warnings */}
        <div className="flex flex-col gap-2.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
            <Sparkles className="size-3.5 text-[#0A7BC7]" />
            Smart Optimization Insights
          </h4>

          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs flex flex-col gap-1 transition-all ${
                rec.type === "warning"
                  ? "bg-amber-500/5 border-amber-500/20 text-amber-900 dark:text-amber-200"
                  : rec.type === "success"
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                  : "bg-blue-500/5 border-blue-500/20 text-blue-900 dark:text-blue-200"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {rec.type === "warning" && <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />}
                {rec.type === "success" && <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />}
                {rec.type === "info" && <Info className="size-3.5 text-blue-600 shrink-0" />}
                <span>{rec.title}</span>
              </div>
              <p className="text-[11.5px] leading-relaxed opacity-90">{rec.desc}</p>
            </div>
          ))}
        </div>

        {/* Governing Engineering Standards */}
        <div className="bg-muted/30 border border-border/60 rounded-xl p-3 flex flex-col gap-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-slate-500" />
            Governing Standards Reference
          </h4>
          <ul className="text-[11px] text-muted-foreground space-y-1 font-mono">
            <li className="flex items-center justify-between py-0.5 border-b border-border/30">
              <span>ASHRAE 90.1-2022:</span>
              <span className="font-semibold text-foreground">Fan & Pipe Limits</span>
            </li>
            <li className="flex items-center justify-between py-0.5 border-b border-border/30">
              <span>SMACNA Duct Design:</span>
              <span className="font-semibold text-foreground">Equal Friction</span>
            </li>
            <li className="flex items-center justify-between py-0.5 border-b border-border/30">
              <span>Carrier System Design:</span>
              <span className="font-semibold text-foreground">Coil ΔT & CFM/TR</span>
            </li>
            <li className="flex items-center justify-between py-0.5">
              <span>CIBSE Guide B2/B3:</span>
              <span className="font-semibold text-foreground">Hydronic Velocity</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Drawer Footer Actions */}
      <div className="p-3 border-t border-border/80 bg-muted/20 flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={onResetAllBaseline}
          disabled={isReadOnly}
          className="w-full py-2 px-3 bg-card hover:bg-muted border border-border text-foreground font-semibold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
        >
          <RotateCcw className="size-3.5 text-muted-foreground" />
          Reset All Parameters to Baseline
        </button>

        <button
          type="button"
          onClick={handleExportPDF}
          className="w-full py-2 px-3 bg-[#0A7BC7] hover:bg-[#0863A0] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-2xs"
        >
          <FileText className="size-3.5" />
          Export Sanity Audit PDF
        </button>
      </div>
    </div>
  );
}
