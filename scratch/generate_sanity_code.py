import os

target_file = r"z:\00 R&D Server\04 MISC\Vikrams  MEP CALCULATOR UPDATED\vikram_updated_calc\New Ui MEP\MEP_Calculator_Project\frontend\src\routes\sanity-check-tool.tsx"

code = '''import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, CheckCircle2, FileText, Zap, SlidersHorizontal,
  X, Check, Edit3, MessageSquare, Copy, RotateCcw, Trash2, Sparkles,
  ShieldCheck, Info, ArrowRight, BookOpen, Layers, Lightbulb, Activity, Gauge, Sliders, ChevronRight
} from "lucide-react";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { toast } from "sonner";
import { exportSanityCheckPDF } from "@/lib/exportSanityCheckPDF";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { dirtyStore } from "@/lib/dirty-store";
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

// Standard Application Presets (Matching Duct Sizer & Pump Sizing pattern)
const SANITY_PRESETS = {
  commercial_office: {
    label: "Commercial Office (Standard)",
    desc: "Baseline HVAC & hydronic design parameters for typical office space.",
    valuesIP: { ductVel: 1500, ductFr: 0.08, esp: 0.5, cfmTr: 400, pipeVel: 4.0, pumpHead: 50, supTemp: 55, chwDt: 10, chillerEff: 0.65 },
    valuesSI: { ductVel: 7.62, ductFr: 0.65, esp: 124, cfmTr: 47.2, pipeVel: 1.22, pumpHead: 149, supTemp: 12.8, chwDt: 5.6, chillerEff: 5.41 },
  },
  vav_main_riser: {
    label: "High-Velocity VAV Main Riser",
    desc: "Main supply shafts and high-pressure ductwork with VAV fan loops.",
    valuesIP: { ductVel: 2200, ductFr: 0.12, esp: 1.2, cfmTr: 420, pipeVel: 6.0, pumpHead: 75, supTemp: 53, chwDt: 12, chillerEff: 0.58 },
    valuesSI: { ductVel: 11.18, ductFr: 0.98, esp: 298, cfmTr: 49.6, pipeVel: 1.83, pumpHead: 224, supTemp: 11.7, chwDt: 6.7, chillerEff: 6.06 },
  },
  low_noise_quiet: {
    label: "Low-Noise Quiet Zone (Hospital / Hotel)",
    desc: "Acoustically sensitive zones requiring reduced air speed and low pipe friction.",
    valuesIP: { ductVel: 1100, ductFr: 0.05, esp: 0.3, cfmTr: 380, pipeVel: 3.0, pumpHead: 35, supTemp: 57, chwDt: 10, chillerEff: 0.62 },
    valuesSI: { ductVel: 5.59, ductFr: 0.41, esp: 75, cfmTr: 44.8, pipeVel: 0.91, pumpHead: 105, supTemp: 13.9, chwDt: 5.6, chillerEff: 5.67 },
  },
  leed_green_building: {
    label: "High-Efficiency LEED Green Building",
    desc: "Energy-optimized design with high chiller COP and low pressure drops.",
    valuesIP: { ductVel: 1300, ductFr: 0.06, esp: 0.4, cfmTr: 400, pipeVel: 3.5, pumpHead: 40, supTemp: 55, chwDt: 14, chillerEff: 0.52 },
    valuesSI: { ductVel: 6.60, ductFr: 0.49, esp: 100, cfmTr: 47.2, pipeVel: 1.07, pumpHead: 119, supTemp: 12.8, chwDt: 7.8, chillerEff: 6.76 },
  },
};

function SanityCheckToolPage() {
  const { project, activeProjectId, isReadOnly } = useWorkspace();
  const { userData, profile, user } = useAuth();
  const currentUserName = userData?.name || profile?.name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";

  const calcReviewState = useCalculationReviewState("/sanity-check-tool", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/sanity-check-tool", activeProjectId || project?.id);

  // Tabs & Modal state (Matching Duct Sizer & Pump Sizing)
  const [tab, setTab] = useState<"calculator" | "report">("calculator");
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [formulaModalOpen, setFormulaModalOpen] = useState<boolean>(false);
  const [formulaTab, setFormulaTab] = useState<"step-by-step" | "equations">("step-by-step");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("commercial_office");

  // Core Parameters
  const [ductVel, setDuctVel] = useState<number>(7.62);
  const [ductFr, setDuctFr] = useState<number>(0.65);
  const [esp, setEsp] = useState<number>(124);
  const [pipeVel, setPipeVel] = useState<number>(1.22);
  const [pumpHead, setPumpHead] = useState<number>(149);
  const [cfmTr, setCfmTr] = useState<number>(47.2);
  const [supTemp, setSupTemp] = useState<number>(12.8);
  const [chwDt, setChwDt] = useState<number>(5.6);
  const [chillerEff, setChillerEff] = useState<number>(5.41);

  const [hasCalculated, setHasCalculated] = useState<boolean>(true);

  // Edit modal state (triggered on double-click or right-click -> Edit)
  const [editingParam, setEditingParam] = useState<ParamDef | null>(null);
  const [tempEditValue, setTempEditValue] = useState<number>(0);

  // Comment & Task Assignment Modal State
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type?: string } | null>(null);

  const ip = unitSystem === "ip";

  // Project-keyed comments storage
  const [paramComments, setParamComments] = useState<Record<string, any[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const pId = activeProjectId || project?.id || "default";
      const saved = localStorage.getItem(`mep_sanity_comments_${pId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Sync with project changes
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
      selectedPreset,
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
    activeProjectId, project?.id, unitSystem, selectedPreset, ductVel, ductFr, esp,
    pipeVel, pumpHead, cfmTr, supTemp, chwDt, chillerEff, hasCalculated, paramComments
  ]);

  // Restore State on project or version change
  useEffect(() => {
    const pId = activeProjectId || project?.id || "default";
    const stored = localStorage.getItem(`mep_sanity_calc_${pId}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.selectedPreset) setSelectedPreset(data.selectedPreset);
        if (data.ductVel !== undefined) setDuctVel(data.ductVel);
        if (data.ductFr !== undefined) setDuctFr(data.ductFr);
        if (data.esp !== undefined) setEsp(data.esp);
        if (data.pipeVel !== undefined) setPipeVel(data.pipeVel);
        if (data.pumpHead !== undefined) setPumpHead(data.pumpHead);
        if (data.cfmTr !== undefined) setCfmTr(data.cfmTr);
        if (data.supTemp !== undefined) setSupTemp(data.supTemp);
        if (data.chwDt !== undefined) setChwDt(data.chwDt);
        if (data.chillerEff !== undefined) setChillerEff(data.chillerEff);
        if (data.hasCalculated !== undefined) setHasCalculated(data.hasCalculated);
      } catch (e) {}
    }
  }, [activeProjectId, project?.id]);

  // Version History Restore Listener
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
        if (restoredData.selectedPreset) setSelectedPreset(restoredData.selectedPreset);
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

  const handleApplyPreset = (presetKey: string) => {
    if (isEffectiveReadOnly) return;
    const p = SANITY_PRESETS[presetKey as keyof typeof SANITY_PRESETS];
    if (!p) return;
    setSelectedPreset(presetKey);
    const vals = ip ? p.valuesIP : p.valuesSI;
    setDuctVel(vals.ductVel);
    setDuctFr(vals.ductFr);
    setEsp(vals.esp);
    setCfmTr(vals.cfmTr);
    setPipeVel(vals.pipeVel);
    setPumpHead(vals.pumpHead);
    setSupTemp(vals.supTemp);
    setChwDt(vals.chwDt);
    setChillerEff(vals.chillerEff);
    setHasCalculated(true);
    dirtyStore.set(true);
    toast.success(`Applied ${p.label} Preset!`);
  };

  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);

    if (shouldConvert) {
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
        value: `${p.val.toFixed(p.val < 10 ? 2 : 1)} ${p.unit}`,
        status: pass ? "pass" : "warn",
        range: `${p.min} – ${p.max} ${p.unit}`,
        desc: p.desc,
      };
    });
  }, [paramsList]);

  const handleCalculate = () => {
    setHasCalculated(true);
    toast.success("Recalculated engineering sanity checks!");
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
    dirtyStore.set(true);
    toast.success(`Updated ${editingParam.label} to ${tempEditValue} ${editingParam.unit}`);
  };

  const handleResetBaseline = (p: ParamDef) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are disabled.", { id: "readonly-notice" });
      return;
    }
    p.setter(p.baseline);
    setHasCalculated(true);
    dirtyStore.set(true);
    toast.success(`Reset ${p.label} to baseline (${p.baseline} ${p.unit})`);
  };

  const handleResetAllBaselines = () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are disabled.", { id: "readonly-notice" });
      return;
    }
    paramsList.forEach(p => p.setter(p.baseline));
    setHasCalculated(true);
    dirtyStore.set(true);
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

  // Reusable Context Menu Content
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

  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.length - passCount;
  const passPercentage = Math.round((passCount / checks.length) * 100);
  const sigDetails = getSignatureBlockDetails(activeProjectId || project?.id || "default", "/sanity-check-tool", currentUserName, calcReviewState);

  return (
    <AppShell title="Sanity Check Tool" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 pb-6 gap-4 overflow-y-auto h-full w-full">
          
          {/* Header Bar matching Pump Sizing / Duct Sizer */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Engineering Sanity Check Tool</h1>
                <span className="text-[14px] font-semibold text-muted-foreground">({checks.length} Parameters)</span>
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
              />
              {totalCommentsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{totalCommentsCount} Active Task(s) / Comment(s)</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                inputDescriptions="Duct & Pipe Velocities, Pressures, Temps"
                conversionExample={unitSystem === "si" ? "Convert 7.6 m/s → 1,500 FPM, 20 Pa/m → 0.08 in.wg/100ft" : "Convert 1500 FPM → 7.6 m/s, 0.08 in.wg/100ft → 20 Pa/m"}
              />
            </div>
          </div>

          {/* Master White / Dark Card Container for Tabs & Content */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED"
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
              : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                  ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                  : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>

            {/* Action Bar / Tabs Selector Row inside Card Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Tab Switcher */}
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setTab("calculator")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "calculator"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sanity Checker
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report Preview
                  </button>
                </div>

                {/* Formula Breakdown Button */}
                <TBtn
                  onClick={() => setFormulaModalOpen(true)}
                  title="View Step-by-Step Formula Breakdown & Governing Equations"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Action buttons on the right */}
              <div className="flex items-center gap-2">
                <TBtn onClick={handleExportPDF} title="Export PDF Report">
                  <FileText className="size-3.5" /> Export PDF
                </TBtn>
              </div>
            </div>

            {/* Main Workspace Content Area */}
            <div key={tab} className="flex-1 min-h-0 animate-fade-in flex flex-col overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
              {tab === "calculator" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Design Inputs & Presets (lg:col-span-5) */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                      <div className="flex items-center justify-between pb-3 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Design Values &amp; Parameters</h3>
                        </div>
                      </div>

                      {/* Application Preset Selector */}
                      <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40">
                        <label className="text-[11.5px] font-bold text-foreground flex items-center justify-between">
                          <span>Application Preset Profile</span>
                          <span className="text-[10.5px] text-muted-foreground font-mono font-normal">Quick Load</span>
                        </label>
                        <select
                          value={selectedPreset}
                          disabled={isEffectiveReadOnly}
                          onChange={(e) => handleApplyPreset(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-zinc-900 border border-border focus:border-[#0A7BC7] rounded-xl px-3 py-1.5 text-xs font-semibold font-mono text-foreground outline-none transition cursor-pointer"
                        >
                          {Object.entries(SANITY_PRESETS).map(([key, p]) => (
                            <option key={key} value={key}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          {SANITY_PRESETS[selectedPreset as keyof typeof SANITY_PRESETS]?.desc}
                        </p>
                      </div>

                      {/* Parameter Inputs Grid */}
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
                                      dirtyStore.set(true);
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

                  {/* Right Column: Engineering Audit Results & Diagnostics (lg:col-span-7) */}
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
                      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs animate-fade-in">
                        <div className="flex items-center justify-between pb-3 border-b border-border/60 flex-wrap gap-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Engineering Audit Summary</h3>
                            </div>
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
                          </div>
                          <TBtn onClick={handleExportPDF}>
                            <FileText className="size-3.5" /> Export PDF
                          </TBtn>
                        </div>

                        {/* Audit Health Score Bar */}
                        <div className="p-3.5 rounded-xl border border-border bg-slate-50/60 dark:bg-slate-900/40 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Activity className="size-3.5 text-primary" />
                              Overall Audit Health Score
                            </span>
                            <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
                              passPercentage >= 80
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            }`}>
                              {passPercentage}% Compliant
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                passPercentage >= 80 ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${passPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Parameter Audit Results List */}
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
              )}

              {/* REPORT PREVIEW TAB */}
              {tab === "report" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                    
                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          Engineering Sanity Check Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Design Standards: ASHRAE Handbook Fundamentals, SMACNA HVAC Systems Duct Design &amp; Carrier System Design
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TBtn primary onClick={handleExportPDF}>
                          <FileText className="size-3.5" /> Export PDF
                        </TBtn>
                      </div>
                    </div>

                    {/* Enclosed Project Metadata Grid */}
                    <div className="border border-border rounded-xl overflow-hidden text-[12px] bg-card">
                      <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/20">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Calculation No.:</span>
                          <span className="text-muted-foreground font-mono">
                            {(project as any)?.calcNo || `TRV-CAL-SNT-${(activeProjectId || project?.id || "0000").slice(-4).toUpperCase()}`}
                          </span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Date:</span>
                          <span className="text-muted-foreground">{formatDateStr(new Date().toISOString())}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Project No.:</span>
                          <span className="text-muted-foreground">{project?.code || project?.id?.substring(0, 8) || "P000"}</span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Client:</span>
                          <span className="text-muted-foreground">{project?.client || "-"}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Project Name:</span>
                          <span className="text-muted-foreground">{project?.name || "MEP Project"}</span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">End User:</span>
                          <span className="text-muted-foreground">{(project as any)?.endUser || (project as any)?.location || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Structured Summary & Audit Bar */}
                    <div className="border border-border rounded-xl p-3 bg-[#F5F7FA] dark:bg-slate-900/60 flex items-center justify-between text-xs font-bold text-foreground flex-wrap gap-2">
                      <span>Standards: ASHRAE / SMACNA / Carrier</span>
                      <span>Units: {unitSystem === "ip" ? "Imperial (IP)" : "Metric (SI)"}</span>
                      <span className={warnCount === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                        {warnCount === 0
                          ? `Audit: ${passCount}/${checks.length} Passed (All In-Range)`
                          : `Audit: ${passCount} Passed | ${warnCount} Requires Review`}
                      </span>
                    </div>

                    {/* Checklist Table */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-[#D9D9D9] text-black font-bold border-b border-border text-center">
                              <th className="py-2 px-2.5 w-12">Sr. No.</th>
                              <th className="py-2 px-3 text-left">Design Parameter</th>
                              <th className="py-2 px-3 text-center">Design Value</th>
                              <th className="py-2 px-3 text-center">Standard Range</th>
                              <th className="py-2 px-3 text-center">Compliance</th>
                              <th className="py-2 px-3 text-left">Engineering Guideline / Reference</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-sans">
                            {checks.map((c, idx) => {
                              const isPass = c.status === "pass";
                              return (
                                <tr key={idx} className="hover:bg-muted/30">
                                  <td className="py-2 px-2.5 text-center font-mono">{idx + 1}</td>
                                  <td className="py-2 px-3 font-bold text-foreground">{c.label}</td>
                                  <td className="py-2 px-3 text-center font-mono font-bold">{c.value}</td>
                                  <td className="py-2 px-3 text-center font-mono text-muted-foreground">{c.range}</td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold font-mono ${
                                      isPass
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                                    }`}>
                                      {isPass ? "IN RANGE" : "CHECK VALUE"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-muted-foreground text-[10.5px]">{c.desc}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Dynamic Signature Block */}
                    <div className="border border-border rounded-xl overflow-hidden mt-6 bg-card">
                      <table className="w-full text-center text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[#FFE6CC] text-black font-bold border-b border-border">
                            <th className="py-2 px-3 text-left w-1/4">Designation</th>
                            <th className="py-2 px-3 w-1/4">Originator</th>
                            <th className="py-2 px-3 w-1/4">Reviewer</th>
                            <th className="py-2 px-3 w-1/4">Approver</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-sans">
                          <tr>
                            <td className="py-2 px-3 text-left font-bold text-foreground">Name:</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.name || sigDetails?.originatedName || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.name || sigDetails?.reviewerName || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.name || sigDetails?.approverName || "-"}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 text-left font-bold text-foreground">Date:</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.date || sigDetails?.originatedDate || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.date || sigDetails?.reviewerDate || "-"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.date || sigDetails?.approverDate || "-"}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 text-left font-bold text-foreground">Signature:</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.originator?.status || (sigDetails?.originatedName ? "Signed" : "-")}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.reviewer?.status || (sigDetails?.reviewerName ? "Reviewed" : "-")}</td>
                            <td className="py-2 px-3 text-muted-foreground">{sigDetails?.approver?.status || (sigDetails?.approverName ? "Approved" : "-")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

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

      {/* FORMULA BREAKDOWN MODAL (EXACT MATCHING PUMP SIZING & DUCT SIZER PATTERN) */}
      {formulaModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormulaModalOpen(false);
          }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Formula Breakdown &amp; Detailed Calculations</h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    Step-by-step verification proofs, substitutions, and governing ASHRAE / SMACNA / Carrier equations
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Sub-navigation Bar */}
            <div className="flex items-center justify-between px-6 py-2 bg-muted/10 border-b border-border/50">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setFormulaTab("step-by-step")}
                  className={`px-4 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    formulaTab === "step-by-step"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Step-by-Step Proofs ({paramsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFormulaTab("equations")}
                  className={`px-4 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    formulaTab === "equations"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Master Equations Registry
                </button>
              </div>

              <span className="text-[11px] font-mono text-muted-foreground">
                Active System: <strong className="text-foreground uppercase">{unitSystem}</strong>
              </span>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
              {formulaTab === "step-by-step" ? (
                <div className="space-y-4">
                  {/* Step 1: Duct Airflow Velocity */}
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">Step 1</span>
                        <span>Duct Airflow Velocity (V)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        ductVel >= (ip ? 1000 : 5.0) && ductVel <= (ip ? 2500 : 12.7)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {ductVel >= (ip ? 1000 : 5.0) && ductVel <= (ip ? 2500 : 12.7) ? "PASS (In Range)" : "WARN (Outside Limits)"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border/80 font-mono text-[11.5px] space-y-1 text-foreground">
                      <div>Governing Equation: <span className="text-primary font-bold">V_min ≤ V ≤ V_max</span></div>
                      <div>Numerical Substitution: {ip ? `1,000 FPM ≤ ${ductVel} FPM ≤ 2,500 FPM` : `5.00 m/s ≤ ${ductVel} m/s ≤ 12.70 m/s`}</div>
                      <div className="text-primary font-bold pt-0.5">
                        Evaluated Design Value: V = {ductVel} {ip ? "FPM" : "m/s"}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Reference: SMACNA HVAC Duct Design &amp; ASHRAE Handbook. Main duct velocities must be maintained within allowable boundaries to balance acoustic duct noise against fan pressure loss.
                    </p>
                  </div>

                  {/* Step 2: Duct Equal Friction Loss Rate */}
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">Step 2</span>
                        <span>Duct Equal Friction Loss Rate (ΔP / L)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        ductFr >= (ip ? 0.05 : 0.4) && ductFr <= (ip ? 0.15 : 1.2)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {ductFr >= (ip ? 0.05 : 0.4) && ductFr <= (ip ? 0.15 : 1.2) ? "PASS (In Range)" : "WARN (Outside Limits)"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border/80 font-mono text-[11.5px] space-y-1 text-foreground">
                      <div>Governing Equation: <span className="text-primary font-bold">ΔP/L = (f · ρ · V²) / (2 · D_h)</span></div>
                      <div>Conversion Factor: 1 in w.g./100ft = 8.16828 Pa/m</div>
                      <div>Numerical Substitution: {ip ? `0.05 ≤ ${ductFr} ≤ 0.15 in w.g./100ft` : `0.40 ≤ ${ductFr} ≤ 1.20 Pa/m`}</div>
                      <div className="text-primary font-bold pt-0.5">
                        Evaluated Loss Rate: ΔP/L = {ductFr} {ip ? "in w.g./100ft" : "Pa/m"}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Reference: Colebrook-White &amp; SMACNA Equal Friction Method. Higher friction rates demand larger fan motors; lower friction rates require larger duct cross-sections.
                    </p>
                  </div>

                  {/* Step 3: Fan External Static Pressure */}
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">Step 3</span>
                        <span>Fan External Static Pressure (ESP) &amp; Fan Power</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        esp >= (ip ? 0.2 : 50) && esp <= (ip ? 2.0 : 500)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {esp >= (ip ? 0.2 : 50) && esp <= (ip ? 2.0 : 500) ? "PASS (In Range)" : "WARN (Outside Limits)"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border/80 font-mono text-[11.5px] space-y-1 text-foreground">
                      <div>Fan Air Power Equation: <span className="text-primary font-bold">{ip ? "Power = (CFM × ESP) / 6356" : "Power = (L/s × Pa) / 1000"}</span></div>
                      <div>Numerical Substitution: {ip ? `0.20 ≤ ${esp} ≤ 2.00 in w.g.` : `50 ≤ ${esp} ≤ 500 Pa`}</div>
                      <div className="text-primary font-bold pt-0.5">
                        Evaluated Static Head: ESP = {esp} {ip ? "in w.g." : "Pa"}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Reference: AMCA Standard 210 &amp; ASHRAE 90.1. ESP compensates for internal distribution resistance including coils, VAV terminal units, dampers, and filters.
                    </p>
                  </div>

                  {/* Step 4: Airflow / Cooling Capacity Index */}
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">Step 4</span>
                        <span>Cooling Airflow / Capacity Index (CFM/TR or L/s/kW)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        cfmTr >= (ip ? 350 : 47) && cfmTr <= (ip ? 450 : 60)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {cfmTr >= (ip ? 350 : 47) && cfmTr <= (ip ? 450 : 60) ? "PASS (In Range)" : "WARN (Outside Limits)"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border/80 font-mono text-[11.5px] space-y-1 text-foreground">
                      <div>Index Equation: <span className="text-primary font-bold">Airflow Ratio = Total Airflow / Total Cooling Capacity</span></div>
                      <div>Numerical Substitution: {ip ? `350 ≤ ${cfmTr} ≤ 450 CFM/TR` : `47.0 ≤ ${cfmTr} ≤ 60.0 L/s/kW`}</div>
                      <div className="text-primary font-bold pt-0.5">
                        Evaluated Airflow Index: {cfmTr} {ip ? "CFM/TR" : "L/s/kW"}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Reference: Carrier System Design Manual. Essential for sensible heat ratio (SHR ~ 0.75-0.80). Airflow below 350 CFM/TR risks coil icing; above 450 CFM/TR degrades latent moisture removal.
                    </p>
                  </div>

                  {/* Step 5: Hydronic Pipe Fluid Velocity */}
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">Step 5</span>
                        <span>Hydronic Pipe Fluid Velocity &amp; Erosion Limit</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        pipeVel >= (ip ? 2.0 : 0.6) && pipeVel <= (ip ? 8.0 : 2.4)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {pipeVel >= (ip ? 2.0 : 0.6) && pipeVel <= (ip ? 8.0 : 2.4) ? "PASS (In Range)" : "WARN (Outside Limits)"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border/80 font-mono text-[11.5px] space-y-1 text-foreground">
                      <div>Continuity Equation: <span className="text-primary font-bold">V_pipe = (4 · Q) / (π · D²)</span></div>
                      <div>Numerical Substitution: {ip ? `2.0 ≤ ${pipeVel} ≤ 8.0 fps` : `0.60 ≤ ${pipeVel} ≤ 2.40 m/s`}</div>
                      <div className="text-primary font-bold pt-0.5">
                        Evaluated Pipe Velocity: V_pipe = {pipeVel} {ip ? "fps" : "m/s"}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Reference: ASHRAE 90.1 &amp; CIBSE Guide B3. Velocities &gt; 8.0 fps (2.4 m/s) cause pipe wall erosion and water hammer in hydronic loops. Velocities &lt; 2.0 fps allow particulate settling.
                    </p>
                  </div>

                  {/* Step 6: Pump Total Dynamic Head */}
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">Step 6</span>
                        <span>Pump Total Dynamic Head (TDH)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        pumpHead >= (ip ? 20 : 60) && pumpHead <= (ip ? 100 : 300)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {pumpHead >= (ip ? 20 : 60) && pumpHead <= (ip ? 100 : 300) ? "PASS (In Range)" : "WARN (Outside Limits)"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border/80 font-mono text-[11.5px] space-y-1 text-foreground">
                      <div>TDH Equation: <span className="text-primary font-bold">H_total = H_static + H_friction + H_equipment</span></div>
                      <div>Numerical Substitution: {ip ? `20 ≤ ${pumpHead} ≤ 100 ft w.g.` : `60 ≤ ${pumpHead} ≤ 300 kPa`}</div>
                      <div className="text-primary font-bold pt-0.5">
                        Evaluated Dynamic Head: H_pump = {pumpHead} {ip ? "ft w.g." : "kPa"}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Reference: Hydraulic Institute Standards. Head matches total pressure drop across chillers, control valves, heat exchangers, and pipe mains.
                    </p>
                  </div>

                  {/* Step 7: Supply Air Temperature */}
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">Step 7</span>
                        <span>Supply Air Dew Point Temperature</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        supTemp >= (ip ? 50 : 10) && supTemp <= (ip ? 60 : 15)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {supTemp >= (ip ? 50 : 10) && supTemp <= (ip ? 60 : 15) ? "PASS (In Range)" : "WARN (Outside Limits)"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border/80 font-mono text-[11.5px] space-y-1 text-foreground">
                      <div>Supply Air Temperature Equation: <span className="text-primary font-bold">T_supply = T_room - ΔT_air</span></div>
                      <div>Numerical Substitution: {ip ? `50 ≤ ${supTemp} ≤ 60 °F` : `10.0 ≤ ${supTemp} ≤ 15.0 °C`}</div>
                      <div className="text-primary font-bold pt-0.5">
                        Evaluated Air Temperature: T_sup = {supTemp} {ip ? "°F" : "°C"}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Reference: ASHRAE Handbook Fundamentals. Standard 55°F (12.8°C) supply air dew point controls space relative humidity to 50% without terminal duct sweating.
                    </p>
                  </div>

                  {/* Step 8: Chilled Water Delta T */}
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">Step 8</span>
                        <span>Chilled Water Coil Delta T (ΔT)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        chwDt >= (ip ? 8 : 4.4) && chwDt <= (ip ? 14 : 7.7)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {chwDt >= (ip ? 8 : 4.4) && chwDt <= (ip ? 14 : 7.7) ? "PASS (In Range)" : "WARN (Outside Limits)"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border/80 font-mono text-[11.5px] space-y-1 text-foreground">
                      <div>Chilled Water Flow Formula: <span className="text-primary font-bold">{ip ? "GPM = (24 × TR) / ΔT_CHW" : "L/s = kW / (4.186 × ΔT_CHW)"}</span></div>
                      <div>Numerical Substitution: {ip ? `8 ≤ ${chwDt} ≤ 14 °F` : `4.4 ≤ ${chwDt} ≤ 7.7 °C`}</div>
                      <div className="text-primary font-bold pt-0.5">
                        Evaluated Delta T: ΔT = {chwDt} {ip ? "°F" : "°C"}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Reference: CIBSE Guide B2 &amp; ASHRAE 90.1. Low ΔT (&lt; 10°F / 5.6°C) causes Low ΔT Syndrome, increasing pumping energy and reducing central chiller efficiency.
                    </p>
                  </div>

                  {/* Step 9: Chiller Efficiency Rating & COP */}
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">Step 9</span>
                        <span>Chiller Efficiency &amp; COP Conversion</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        chillerEff >= (ip ? 0.5 : 4.4) && chillerEff <= (ip ? 0.8 : 7.0)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {chillerEff >= (ip ? 0.5 : 4.4) && chillerEff <= (ip ? 0.8 : 7.0) ? "PASS (In Range)" : "WARN (Outside Limits)"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border/80 font-mono text-[11.5px] space-y-1 text-foreground">
                      <div>Conversion Formula: <span className="text-primary font-bold">COP = 3.51685 / (kW/TR)</span></div>
                      <div>Numerical Substitution: {ip ? `0.50 ≤ ${chillerEff} ≤ 0.80 kW/TR → COP = ${(3.51685 / chillerEff).toFixed(2)}` : `4.40 ≤ ${chillerEff} ≤ 7.00 COP → kW/TR = ${(3.51685 / chillerEff).toFixed(2)}`}</div>
                      <div className="text-primary font-bold pt-0.5">
                        Evaluated Efficiency Rating: {chillerEff} {ip ? "kW/TR" : "COP"}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Reference: ASHRAE 90.1-2022 Full-load Chiller Efficiency. Water-cooled centrifugal chillers achieve 0.50-0.65 kW/TR (COP 5.4 to 7.0).
                    </p>
                  </div>
                </div>
              ) : (
                /* Tab 2: Master Equations Registry */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2">
                    <div className="font-bold text-primary flex items-center justify-between">
                      <span>1. Duct Velocity &amp; Noise Criteria</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">SMACNA / ASHRAE</span>
                    </div>
                    <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11.5px] text-foreground overflow-x-auto">
                      V = Q / A = Airflow (m³/s or CFM) / Cross-Section Area (m² or ft²)
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Recommended velocity range: Main ducts 1,200–2,200 FPM (6.0–11.0 m/s); Branch ducts 600–1,000 FPM (3.0–5.0 m/s).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2">
                    <div className="font-bold text-primary flex items-center justify-between">
                      <span>2. Colebrook-White Friction Loss Rate</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">Fluid Aerodynamics</span>
                    </div>
                    <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11.5px] text-foreground overflow-x-auto">
                      ΔP / L = (f · ρ · V²) / (2 · D_h)
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Standard Equal Friction design rate: 0.08 in w.g. / 100ft (0.65 Pa/m) for quiet energy-efficient low-pressure ductwork.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2">
                    <div className="font-bold text-primary flex items-center justify-between">
                      <span>3. Fan Air Power &amp; ESP Relation</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">Fan Dynamics</span>
                    </div>
                    <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11.5px] text-foreground overflow-x-auto">
                      {ip ? "Fan Power (BHP) = (Q_CFM × ESP_in.wg) / (6356 × Fan_Efficiency)" : "Fan Power (kW) = (Q_Lps × ESP_Pa) / (1,000,000 × Fan_Efficiency)"}
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Fan power increases linearly with ESP. Standard static pressure range: 0.20 to 1.5 in w.g. (50 to 375 Pa).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2">
                    <div className="font-bold text-primary flex items-center justify-between">
                      <span>4. Pipe Fluid Velocity &amp; Erosion Equation</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">CIBSE / ASHRAE 90.1</span>
                    </div>
                    <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11.5px] text-foreground overflow-x-auto">
                      V = (4 · Q) / (π · D²)
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Maximum velocity limits: Open condenser water mains ≤ 8.0 fps (2.4 m/s); Chilled water headers ≤ 6.0 fps (1.8 m/s); Branch risers ≤ 4.0 fps (1.2 m/s).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2">
                    <div className="font-bold text-primary flex items-center justify-between">
                      <span>5. Chilled Water Flow &amp; Low ΔT Syndrome</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">Thermodynamics</span>
                    </div>
                    <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11.5px] text-foreground overflow-x-auto">
                      Q_water = Q_cooling / (C_p · ρ · ΔT)
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Standard chilled water ΔT: 10°F to 14°F (5.6°C to 7.8°C). Low ΔT forces excessive pump energy consumption and reduces chiller plant capacity.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-2/60 border border-border/80 space-y-2">
                    <div className="font-bold text-primary flex items-center justify-between">
                      <span>6. Chiller COP &amp; kW/TR Efficiency Equivalence</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">ASHRAE 90.1</span>
                    </div>
                    <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11.5px] text-foreground overflow-x-auto">
                      COP = 3.5168515 / (kW / TR)
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      1 TR (Ton of Refrigeration) = 12,000 BTU/h = 3.51685 kW. Lower kW/TR yields higher COP.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-border/60 bg-muted/20">
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="px-5 py-2 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/60 transition cursor-pointer text-muted-foreground"
              >
                Close Breakdown
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[#0A7BC7] hover:bg-[#0863A0] text-white shadow-xs hover:shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="size-3.5" />
                Export Audit PDF
              </button>
            </div>
          </div>
        </div>
      )}

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
                  Apply &amp; Recalculate
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Assign Comment & Task Modal */}
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
        if ((p.val > 1.2 && unitSystem === "ip") || (p.val > 300 && unitSystem === "si")) {
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
        if ((p.val < 10 && unitSystem === "ip") || (p.val < 5.6 && unitSystem === "si")) {
          recs.push({
            title: "Low ΔT Syndrome Risk",
            desc: `Chilled water ΔT of ${p.val} ${p.unit} is below standard threshold. Low ΔT forces extra chillers and pumps to run at partial load, drastically wasting energy.`,
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
            <h3 className="font-bold text-foreground text-sm tracking-tight">Sanity Intelligence &amp; Audit</h3>
            <p className="text-[11px] text-muted-foreground">Real-time HVAC &amp; Plumbing standard verification</p>
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
              <span className="font-semibold text-foreground">Fan &amp; Pipe Limits</span>
            </li>
            <li className="flex items-center justify-between py-0.5 border-b border-border/30">
              <span>SMACNA Duct Design:</span>
              <span className="font-semibold text-foreground">Equal Friction</span>
            </li>
            <li className="flex items-center justify-between py-0.5 border-b border-border/30">
              <span>Carrier System Design:</span>
              <span className="font-semibold text-foreground">Coil ΔT &amp; CFM/TR</span>
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
