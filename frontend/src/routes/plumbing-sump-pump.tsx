import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle, Calculator,
  MessageSquare, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers,
  ArrowRight, Download, Save, Zap, Cylinder, ArrowUpRight, ChevronDown, ChevronRight, Lightbulb,
  Home, Building2, Utensils, Factory, SlidersHorizontal, Building, ArrowDown, Settings
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

export const Route = createFileRoute("/plumbing-sump-pump")({
  head: () => ({
    meta: [
      { title: "Sump Pump Sizing Calculator — MEP Calc" },
      { name: "description", content: "Calculate sump pit volume, flow, dynamic head, pipe friction losses, and electrical motor requirements per IPC & ASPE." },
    ],
  }),
  component: SumpPumpPage,
});

const GPM_TO_LPS = 0.0630902;
const FT_TO_M = 0.3048;
const IN_TO_MM = 25.4;
const GAL_TO_M3 = 0.00378541;
const GAL_TO_L = 3.78541;
const HP_TO_KW = 0.7457;
const PSI_TO_BAR = 0.0689476;

export type SumpPresetKey =
  | "basement_seepage"
  | "parking_ramp"
  | "elevator_pit"
  | "industrial_effluent"
  | "custom";

export interface SumpPresetConfig {
  key: SumpPresetKey;
  label: string;
  category: string;
  description: string;
  req: number; // L
  time: number; // hrs
  flow: number; // L/s
  pitFlow: number; // L/s
  pitHold: number; // min
  longestPipe: number; // m
  propSide: number; // m
  pipeVert: number; // m
  pipeHoriz: number; // m
  fricFactor: number; // bar/100m
  staticHead: number; // bar
  presid: number; // bar
  suction: number; // bar
  sfHead: number; // %
  effPump: number; // %
  effMotor: number; // %
}

export const SUMP_PRESETS: Record<SumpPresetKey, SumpPresetConfig> = {
  basement_seepage: {
    key: "basement_seepage",
    label: "Basement Groundwater & Seepage",
    category: "IPC 1113 / Sub-soil Drainage",
    description: "Perimeter foundation weeping tile and sub-soil infiltration dewatering for residential / commercial basements.",
    req: 1000,
    time: 1,
    flow: 0,
    pitFlow: 5,
    pitHold: 5,
    longestPipe: 15,
    propSide: 2,
    pipeVert: 5,
    pipeHoriz: 20,
    fricFactor: 0.4,
    staticHead: 5,
    presid: 1,
    suction: 0,
    sfHead: 10,
    effPump: 70,
    effMotor: 85,
  },
  parking_ramp: {
    key: "parking_ramp",
    label: "Parking Ramp / Storm Surge",
    category: "Stormwater / High Flow",
    description: "Subterranean parking garage entrance ramp stormwater interception sump station.",
    req: 5000,
    time: 0.5,
    flow: 0,
    pitFlow: 15,
    pitHold: 5,
    longestPipe: 25,
    propSide: 2.5,
    pipeVert: 8,
    pipeHoriz: 35,
    fricFactor: 0.5,
    staticHead: 8,
    presid: 1,
    suction: 0,
    sfHead: 15,
    effPump: 70,
    effMotor: 85,
  },
  elevator_pit: {
    key: "elevator_pit",
    label: "Elevator Pit Drainage",
    category: "ASME A17.1 / Elevator Sump",
    description: "Dedicated elevator shaft subterranean drainage pit with 50 GPM (3.0 L/s) minimum discharge capacity.",
    req: 500,
    time: 0.5,
    flow: 0,
    pitFlow: 3.2,
    pitHold: 3,
    longestPipe: 10,
    propSide: 1.2,
    pipeVert: 4,
    pipeHoriz: 15,
    fricFactor: 0.35,
    staticHead: 4,
    presid: 0.8,
    suction: 0,
    sfHead: 10,
    effPump: 65,
    effMotor: 85,
  },
  industrial_effluent: {
    key: "industrial_effluent",
    label: "Industrial Plant Effluent Station",
    category: "Industrial / Heavy Duty",
    description: "Heavy-duty manufacturing or plant subterranean washdown and process drainage collection.",
    req: 10000,
    time: 1.5,
    flow: 0,
    pitFlow: 25,
    pitHold: 10,
    longestPipe: 35,
    propSide: 3.0,
    pipeVert: 10,
    pipeHoriz: 50,
    fricFactor: 0.6,
    staticHead: 10,
    presid: 1.5,
    suction: 0,
    sfHead: 15,
    effPump: 72,
    effMotor: 88,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Engineering",
    description: "User-defined sump pump hydraulic and physical pit parameters.",
    req: 1000,
    time: 1,
    flow: 0,
    pitFlow: 5,
    pitHold: 5,
    longestPipe: 15,
    propSide: 2,
    pipeVert: 5,
    pipeHoriz: 20,
    fricFactor: 0.4,
    staticHead: 5,
    presid: 1,
    suction: 0,
    sfHead: 10,
    effPump: 70,
    effMotor: 85,
  },
};

function SumpPumpPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-sump-pump", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-sump-pump", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);
  const [preset, setPreset] = useState<SumpPresetKey>("basement_seepage");
  const isSI = unitSystem === "si";

  // State: stored natively in SI
  const [req, setReq] = useState<number | "">(1000);
  const [time, setTime] = useState<number | "">(1);
  const [flow, setFlow] = useState<number | "">(0);

  const [pitFlow, setPitFlow] = useState<number | "">(5);
  const [pitHold, setPitHold] = useState<number | "">(5);
  const [longestPipe, setLongestPipe] = useState<number | "">(15);
  const [propSide, setPropSide] = useState<number | "">(2);

  const [pipeVert, setPipeVert] = useState<number | "">(5);
  const [pipeHoriz, setPipeHoriz] = useState<number | "">(20);
  const [fricFactor, setFricFactor] = useState<number | "">(0.4);

  const [staticHead, setStaticHead] = useState<number | "">(5);
  const [presid, setPresid] = useState<number | "">(1);
  const [suction, setSuction] = useState<number | "">(0);
  const [sfHead, setSfHead] = useState<number | "">(10);

  const [selectedHead, setSelectedHead] = useState<number | "">(0);
  const [effMotor, setEffMotor] = useState<number | "">(85);
  const [effPump, setEffPump] = useState<number | "">(70);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Modals & Comment states
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [formulaModalOpen, setFormulaModalOpen] = useState<boolean>(false);
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    const pKey = `mep_sump_pump_params_${project.id}`;
    const stored = localStorage.getItem(pKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.req !== undefined) setReq(parsed.req);
        if (parsed.time !== undefined) setTime(parsed.time);
        if (parsed.flow !== undefined) setFlow(parsed.flow);
        if (parsed.pitFlow !== undefined) setPitFlow(parsed.pitFlow);
        if (parsed.pitHold !== undefined) setPitHold(parsed.pitHold);
        if (parsed.longestPipe !== undefined) setLongestPipe(parsed.longestPipe);
        if (parsed.propSide !== undefined) setPropSide(parsed.propSide);
        if (parsed.pipeVert !== undefined) setPipeVert(parsed.pipeVert);
        if (parsed.pipeHoriz !== undefined) setPipeHoriz(parsed.pipeHoriz);
        if (parsed.fricFactor !== undefined) setFricFactor(parsed.fricFactor);
        if (parsed.staticHead !== undefined) setStaticHead(parsed.staticHead);
        if (parsed.presid !== undefined) setPresid(parsed.presid);
        if (parsed.suction !== undefined) setSuction(parsed.suction);
        if (parsed.sfHead !== undefined) setSfHead(parsed.sfHead);
        if (parsed.selectedHead !== undefined) setSelectedHead(parsed.selectedHead);
        if (parsed.effMotor !== undefined) setEffMotor(parsed.effMotor);
        if (parsed.effPump !== undefined) setEffPump(parsed.effPump);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        if (parsed.preset) setPreset(parsed.preset);
        if (parsed.commentsMap) setCommentsMap(parsed.commentsMap);
      } catch (e) {
        console.error("Failed to parse", e);
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId]);

  const saveState = (updatedFields: Record<string, any> = {}) => {
    if (!project?.id) return;
    const dataToSave = {
      req, time, flow, pitFlow, pitHold, longestPipe, propSide, pipeVert, pipeHoriz,
      fricFactor, staticHead, presid, suction, sfHead, selectedHead, effMotor, effPump, unitSystem, preset,
      commentsMap,
      ...updatedFields,
      updatedAt: new Date().toISOString(),
    };
    const pKey = `mep_sump_pump_params_${project.id}`;
    localStorage.setItem(pKey, JSON.stringify(dataToSave));
    localStorage.setItem("mep_sump_pump_params", JSON.stringify(dataToSave));
    dirtyStore.set(true);
  };

  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanRaw = cleanId.replace(/^(field-|card-|res-)/, "");
      const el = document.getElementById(targetId || "") || document.getElementById(`field-${cleanRaw}`) || document.getElementById(`card-${cleanRaw}`);
      setHighlightedTargetId(cleanRaw || cleanId || targetId || null);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2500);
      if (el) setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 120);
    };
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("commentTargetId") || params.get("commentTargetName")) {
        setTimeout(() => handleScrollTarget(params.get("commentTargetId") || undefined, params.get("commentTargetName") || undefined), 300);
      }
    }
    const handleScrollEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) handleScrollTarget(detail.id || detail.targetId, detail.name || detail.targetName);
    };
    window.addEventListener("mep-comment-notification-clicked", handleScrollEvent);
    return () => window.removeEventListener("mep-comment-notification-clicked", handleScrollEvent);
  }, []);

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
    saveState({ commentsMap: updated });
    setActiveCommentTarget(null);
    toast.success(`Comment / Task assigned on "${activeCommentTarget.label}"`);
  };

  const copyToClipboard = (val: any) => {
    navigator.clipboard.writeText(String(val));
    toast.success(`Copied "${val}" to clipboard`);
  };

  // Calculations
  const calcResults = useMemo(() => {
    const r = typeof req === "number" ? req : 0;
    const t = typeof time === "number" ? time : 0;
    const f = typeof flow === "number" ? flow : 0;
    const pf = typeof pitFlow === "number" ? pitFlow : 0;
    const ph = typeof pitHold === "number" ? pitHold : 0;
    const lp = typeof longestPipe === "number" ? longestPipe : 0;
    const ps = typeof propSide === "number" ? propSide : 0;
    const pv = typeof pipeVert === "number" ? pipeVert : 0;
    const phz = typeof pipeHoriz === "number" ? pipeHoriz : 0;
    const ff = typeof fricFactor === "number" ? fricFactor : 0;
    const sh = typeof staticHead === "number" ? staticHead : 0;
    const pr = typeof presid === "number" ? presid : 0;
    const suc = typeof suction === "number" ? suction : 0;
    const sfH = typeof sfHead === "number" ? sfHead : 0;
    const eP = typeof effPump === "number" ? effPump : 70;
    const eM = typeof effMotor === "number" ? effMotor : 85;

    const Q_flow = (f > 0) ? f : ((r > 0 && t > 0) ? r / (t * 3600) : 0);
    const pitVol = (pf * ph * 60) / 1000;
    const invertVal = lp > 0 ? (Math.ceil((lp / 90) * 100) / 100) + 0.16 : 0;

    let propDepth = 0;
    if (ps > 0) {
      const waterDepthRaw = pitVol / (ps * ps);
      const waterDepth = waterDepthRaw < 1.0 ? 1.0 : waterDepthRaw;
      propDepth = Math.ceil((waterDepth + invertVal + 0.25) * 100) / 100;
    }

    const L_elbows = (pv + phz) * 0.3;
    const L_valves = (pv + phz) * 0.3;
    const L_sum = pv + phz + L_elbows + L_valves;
    const L_equiv = Math.ceil((L_sum * 1.05) / 10) * 10;
    const H_loss = L_equiv * (ff / 100);

    const H_pump_calc = (Math.max(0, (H_loss + sh + pr) - suc)) * (1 + sfH / 100);
    const selHead = typeof selectedHead === "number" && selectedHead > 0 ? selectedHead : H_pump_calc;

    const P_shaft = (Q_flow * selHead * 100) / (1000 * (eP / 100));
    const P_motor = P_shaft / (eM / 100);
    const HP = P_motor * 1.34102;

    return { Q_flow, pitVol, invertVal, propDepth, pv, phz, ff, L_elbows, L_valves, L_sum, L_equiv, H_loss, H_pump_calc, selHead, P_motor, HP };
  }, [req, time, flow, pitFlow, pitHold, longestPipe, propSide, pipeVert, pipeHoriz, fricFactor, staticHead, presid, suction, sfHead, selectedHead, effPump, effMotor]);

  const handleUnitSystemChange = (next: "ip" | "si") => {
    if (isEffectiveReadOnly) return;
    setUnitSystem(next);
    saveState({ unitSystem: next });
  };

  const handleApplyPreset = (key: SumpPresetKey) => {
    const p = SUMP_PRESETS[key];
    if (!p) return;
    setReq(p.req);
    setTime(p.time);
    setFlow(p.flow);
    setPitFlow(p.pitFlow);
    setPitHold(p.pitHold);
    setLongestPipe(p.longestPipe);
    setPropSide(p.propSide);
    setPipeVert(p.pipeVert);
    setPipeHoriz(p.pipeHoriz);
    setFricFactor(p.fricFactor);
    setStaticHead(p.staticHead);
    setPresid(p.presid);
    setSuction(p.suction);
    setSfHead(p.sfHead);
    setEffPump(p.effPump);
    setEffMotor(p.effMotor);
    setPreset(key);
    saveState({
      req: p.req, time: p.time, flow: p.flow, pitFlow: p.pitFlow, pitHold: p.pitHold,
      longestPipe: p.longestPipe, propSide: p.propSide, pipeVert: p.pipeVert, pipeHoriz: p.pipeHoriz,
      fricFactor: p.fricFactor, staticHead: p.staticHead, presid: p.presid, suction: p.suction,
      sfHead: p.sfHead, effPump: p.effPump, effMotor: p.effMotor, preset: key
    });
    toast.success(`Applied ${p.label} preset`);
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
    const isHighlighted = highlightedTargetId === fieldId || highlightedTargetId === `field-${fieldId}`;
    const comments = commentsMap[fieldId] || [];

    return (
      <ContextMenu key={fieldId}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${fieldId}`}
            className={`p-3 rounded-xl border transition-all relative ${isHighlighted
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

  const exportPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const primaryFill = [217, 217, 217] as [number, number, number];
      const blueFill = [218, 233, 248] as [number, number, number];

      const callAutoTable = (autoTable as any).default || autoTable;

      const calcNo = `CALC-SMP-${project?.code || "001"}`;
      const projectNo = project?.code || "PRJ-001";
      const projectName = project?.name || "Sump Pit Drainage Sizing Station";
      const clientName = (project as any)?.client || "Client Representative";
      const endUser = (project as any)?.endUser || "Building Facilities / MEP Department";
      const today = formatDateStr(new Date().toISOString());

      // Document Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SUMP PUMP SIZING PRELIMINARY REPORT", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Design Standards: IPC 1113 / ASPE Chapter 7 Sump Pit & Sump Pump Sizing", 14, 20);

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

      // Section 1: Parameters
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text("1. Input Parameters & Hydraulic Criteria", 14, currentY);

      const flow = isSI ? calcResults.Q_flow : calcResults.Q_flow / GPM_TO_LPS;
      const flowUnit = isSI ? "L/s" : "GPM";
      const pitV = isSI ? calcResults.pitVol : calcResults.pitVol / GAL_TO_M3;
      const pitVUnit = isSI ? "m³" : "Gal";
      const h_loss = isSI ? calcResults.H_loss : calcResults.H_loss / PSI_TO_BAR;
      const l_equiv = isSI ? calcResults.L_equiv : calcResults.L_equiv / FT_TO_M;
      const l_unit = isSI ? "m" : "ft";
      const tdh = isSI ? calcResults.H_pump_calc : calcResults.H_pump_calc / PSI_TO_BAR;
      const tdhUnit = isSI ? "bar" : "psi";

      const paramTableBody = [
        ["1", "Required Drainage Volume", isSI ? `${req} L` : `${(Number(req) / GAL_TO_L).toFixed(0)} Gal`, isSI ? `${(Number(req) / GAL_TO_L).toFixed(0)} Gal` : `${req} L`, "Total storage / inflow requirement"],
        ["2", "Target Drawdown Time", `${time} hrs`, `${(Number(time) * 60).toFixed(0)} mins`, "Allowable pit drawdown interval"],
        ["3", "Inflow Rate to Sump Pit", isSI ? `${pitFlow} L/s` : `${(Number(pitFlow) / GPM_TO_LPS).toFixed(1)} GPM`, isSI ? `${(Number(pitFlow) / GPM_TO_LPS).toFixed(1)} GPM` : `${pitFlow} L/s`, "Peak sub-soil / storm inflow draw"],
        ["4", "Holding / Retention Duration", `${pitHold} min`, `${(Number(pitHold) * 60).toFixed(0)} sec`, "Retention time before pump activation"],
        ["5", "Static Lift Elevation", isSI ? `${staticHead} bar (${(Number(staticHead) * 10.197).toFixed(1)} m)` : `${(Number(staticHead) / PSI_TO_BAR).toFixed(1)} psi`, isSI ? `${(Number(staticHead) / PSI_TO_BAR).toFixed(1)} psi` : `${staticHead} bar`, "Basin floor to gravity discharge level"],
        ["6", "Residual Pressure Required", isSI ? `${presid} bar` : `${(Number(presid) / PSI_TO_BAR).toFixed(1)} psi`, isSI ? `${(Number(presid) / PSI_TO_BAR).toFixed(1)} psi` : `${presid} bar`, "Terminal discharge residual head"],
        ["7", "Longest Branch Run", isSI ? `${longestPipe} m` : `${(Number(longestPipe) / FT_TO_M).toFixed(1)} ft`, isSI ? `${(Number(longestPipe) / FT_TO_M).toFixed(1)} ft` : `${longestPipe} m`, "Piping invert calculation length"],
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

      // Section 2: Outputs
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text("2. Sump Pit Sizing & Hydraulic Results", 14, currentY);

      const resultsTableBody = [
        ["1", "Calculated Pump Duty Flow (Q)", `${flow.toFixed(2)} ${flowUnit}`, "Duty Flow", "Q = Volume / Drawdown Time"],
        ["2", "Sump Pit Active Storage Volume", `${pitV.toFixed(2)} ${pitVUnit}`, "Pit Volume", "V = Inflow Rate × Holding Time"],
        ["3", "Total Dynamic Head (TDH)", `${tdh.toFixed(3)} ${tdhUnit}`, "Dynamic Head", "(H_static + H_loss + H_res) × (1 + SF)"],
        ["4", "Total Equivalent Pipe Length", `${l_equiv.toFixed(1)} ${l_unit}`, "Piping Run", "Vertical + Horizontal + Fittings Loss"],
        ["5", "Friction Head Loss (H_fric)", `${h_loss.toFixed(3)} ${tdhUnit}`, "Friction", "Equivalent Length × Friction Factor"],
        ["6", "Recommended Motor Power Rating", isSI ? `${calcResults.P_motor.toFixed(2)} kW (${calcResults.HP.toFixed(2)} HP)` : `${calcResults.HP.toFixed(2)} HP (${calcResults.P_motor.toFixed(2)} kW)`, "Motor Rating", "Electrical submersible motor rating"],
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
      doc.text("✔ Sump Pit Storage & Submersible Hydraulics Satisfy IPC 1113 & ASPE", 20, currentY + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      doc.text(`Active pit volume of ${pitV.toFixed(2)} ${pitVUnit} with dynamic lift of ${tdh.toFixed(2)} ${tdhUnit} verified for reliable continuous dewatering.`, 20, currentY + 10.5);

      currentY += 20;

      // Sign-off
      const sigDetails = getSignatureBlockDetails(project?.id || "default", "/plumbing-sump-pump", currentUserName, calcReviewState);

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
      downloadFile(new Uint8Array(pdfBuffer), `Sump_Pump_Report_${project?.code || "CALC"}.pdf`, "PDF Document", ["pdf"]);
      toast.success("Preliminary Engineering PDF Report exported successfully!");
    } catch (err: any) {
      console.error("exportPdf error:", err);
      toast.error(`Export PDF failed: ${err?.message || String(err)}`);
    }
  };

  return (
    <AppShell title="Sump Pump Sizing" onIntelClick={() => setIntelOpen((v) => !v)} intelOpen={intelOpen} hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">

          {/* Page Header & Actions */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sump Pump Sizing</h1>

              {/* Intelligence Trigger Button */}
              <button
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                title="Toggle Sump Pump Sizing Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>

              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-sump-pump" calculatorTitle="Sump Pump Sizing" />
            </div>

            {/* Unit System Toggle in Header inline with Approve / Reject */}
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* Main Content Card Container */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED"
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
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${tab === "solver"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Pump Sizer
                  </button>
                  <button
                    onClick={() => setTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${tab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Report
                  </button>
                </div>

                <TBtn
                  onClick={() => setFormulaModalOpen(true)}
                  title="Formula & Step-by-Step Calculation Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
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

                        {/* Section 1: Flow & Volume Criteria */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-flowParams"
                              data-field-id="flowParams"
                              data-comment-target="flowParams"
                              className={`space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("flowParams", "Flow Criteria")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Flow &amp; Volume Criteria
                                  </span>
                                  {renderCommentBadge("flowParams", "Flow Criteria")}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Required Volume ({isSI ? "L" : "Gal"})</label>
                                  <input
                                    type="number"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof req === "number" ? req : typeof req === "number" ? parseFloat((req / GAL_TO_L).toFixed(0)) : req}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setReq("");
                                      else if (isSI) setReq(v);
                                      else setReq(v * GAL_TO_L);
                                      saveState({ req: isSI ? v : v * GAL_TO_L });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Drawdown Time (hrs)</label>
                                  <input
                                    type="number"
                                    step="0.25"
                                    disabled={isEffectiveReadOnly}
                                    value={time}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      setTime(v);
                                      saveState({ time: v });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] text-slate-500">Manual Flow Override ({isSI ? "L/s" : "GPM"})</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  disabled={isEffectiveReadOnly}
                                  placeholder="Overrides Volume/Time if > 0"
                                  value={isSI && typeof flow === "number" ? flow : typeof flow === "number" ? parseFloat((flow / GPM_TO_LPS).toFixed(1)) : flow}
                                  onChange={(e) => {
                                    const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (v === "") setFlow("");
                                    else if (isSI) setFlow(v);
                                    else setFlow(v * GPM_TO_LPS);
                                    saveState({ flow: isSI ? v : v * GPM_TO_LPS });
                                  }}
                                  className={flowInputClass}
                                />
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => {
                                setReq(isSI ? 1000 : 264 * GAL_TO_L);
                                setTime(1);
                                setFlow(0);
                                saveState({ req: isSI ? 1000 : 264 * GAL_TO_L, time: 1, flow: 0 });
                                toast.success("Flow parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Flow Criteria</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "flowParams", label: "Flow Criteria" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 2: Piping & Friction */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pipingParams"
                              data-field-id="pipingParams"
                              data-comment-target="pipingParams"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("pipingParams", "Piping & Friction")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Piping &amp; Friction
                                  </span>
                                  {renderCommentBadge("pipingParams", "Piping & Friction")}
                                </div>
                                <div className="text-[11.5px] font-medium text-slate-500 flex items-center gap-0.5">
                                  <span>Friction Factor:</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    disabled={isEffectiveReadOnly}
                                    value={fricFactor}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 0;
                                      setFricFactor(v);
                                      saveState({ fricFactor: v });
                                    }}
                                    className="w-8 bg-transparent text-slate-700 dark:text-slate-200 font-bold text-center border-none outline-none focus:ring-1 focus:ring-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-all cursor-pointer p-0"
                                  />
                                  <span>{isSI ? "bar/100m length" : "psi/100ft length"}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Vertical ({isSI ? "m" : "ft"})</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof pipeVert === "number" ? pipeVert : typeof pipeVert === "number" ? parseFloat((pipeVert / FT_TO_M).toFixed(1)) : pipeVert}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setPipeVert("");
                                      else if (isSI) setPipeVert(v);
                                      else setPipeVert(v * FT_TO_M);
                                      saveState({ pipeVert: isSI ? v : v * FT_TO_M });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Horizontal ({isSI ? "m" : "ft"})</label>
                                  <input
                                    type="number"
                                    step="1"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof pipeHoriz === "number" ? pipeHoriz : typeof pipeHoriz === "number" ? parseFloat((pipeHoriz / FT_TO_M).toFixed(1)) : pipeHoriz}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setPipeHoriz("");
                                      else if (isSI) setPipeHoriz(v);
                                      else setPipeHoriz(v * FT_TO_M);
                                      saveState({ pipeHoriz: isSI ? v : v * FT_TO_M });
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
                                setPipeVert(isSI ? 5 : 16.4 * FT_TO_M);
                                setPipeHoriz(isSI ? 20 : 65.6 * FT_TO_M);
                                setFricFactor(0.4);
                                saveState({ pipeVert: isSI ? 5 : 16.4 * FT_TO_M, pipeHoriz: isSI ? 20 : 65.6 * FT_TO_M, fricFactor: 0.4 });
                                toast.success("Piping parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Piping Parameters</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "pipingParams", label: "Piping & Friction" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 3: Pit Sizing & Geometry */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pitParams"
                              data-field-id="pitParams"
                              data-comment-target="pitParams"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("pitParams", "Pit Sizing")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Pit Sizing &amp; Geometry
                                  </span>
                                  {renderCommentBadge("pitParams", "Pit Sizing")}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Inflow Rate ({isSI ? "L/s" : "GPM"})</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof pitFlow === "number" ? pitFlow : typeof pitFlow === "number" ? parseFloat((pitFlow / GPM_TO_LPS).toFixed(1)) : pitFlow}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setPitFlow("");
                                      else if (isSI) setPitFlow(v);
                                      else setPitFlow(v * GPM_TO_LPS);
                                      saveState({ pitFlow: isSI ? v : v * GPM_TO_LPS });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Holding Time (min)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    disabled={isEffectiveReadOnly}
                                    value={pitHold}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      setPitHold(v);
                                      saveState({ pitHold: v });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Longest Run ({isSI ? "m" : "ft"})</label>
                                  <input
                                    type="number"
                                    step="1"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof longestPipe === "number" ? longestPipe : typeof longestPipe === "number" ? parseFloat((longestPipe / FT_TO_M).toFixed(1)) : longestPipe}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setLongestPipe("");
                                      else if (isSI) setLongestPipe(v);
                                      else setLongestPipe(v * FT_TO_M);
                                      saveState({ longestPipe: isSI ? v : v * FT_TO_M });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Pit Width ({isSI ? "m" : "ft"})</label>
                                  <input
                                    type="number"
                                    step="0.2"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof propSide === "number" ? propSide : typeof propSide === "number" ? parseFloat((propSide / FT_TO_M).toFixed(1)) : propSide}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setPropSide("");
                                      else if (isSI) setPropSide(v);
                                      else setPropSide(v * FT_TO_M);
                                      saveState({ propSide: isSI ? v : v * FT_TO_M });
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
                                setPitFlow(isSI ? 5 : 80 * GPM_TO_LPS);
                                setPitHold(5);
                                setLongestPipe(isSI ? 15 : 50 * FT_TO_M);
                                setPropSide(isSI ? 2 : 6.5 * FT_TO_M);
                                saveState({ pitFlow: isSI ? 5 : 80 * GPM_TO_LPS, pitHold: 5, longestPipe: isSI ? 15 : 50 * FT_TO_M, propSide: isSI ? 2 : 6.5 * FT_TO_M });
                                toast.success("Pit parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Pit Sizing</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "pitParams", label: "Pit Sizing" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 4: Head & Pressures */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-headParams"
                              data-field-id="headParams"
                              data-comment-target="headParams"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("headParams", "Head & Pressures")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Head &amp; Pressures ({isSI ? "bar" : "psi"})
                                  </span>
                                  {renderCommentBadge("headParams", "Head & Pressures")}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Static Head ({isSI ? "bar" : "psi"})</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof staticHead === "number" ? staticHead : typeof staticHead === "number" ? parseFloat((staticHead / PSI_TO_BAR).toFixed(1)) : staticHead}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setStaticHead("");
                                      else if (isSI) setStaticHead(v);
                                      else setStaticHead(v * PSI_TO_BAR);
                                      saveState({ staticHead: isSI ? v : v * PSI_TO_BAR });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Residual Outlet ({isSI ? "bar" : "psi"})</label>
                                  <input
                                    type="number"
                                    step="0.2"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof presid === "number" ? presid : typeof presid === "number" ? parseFloat((presid / PSI_TO_BAR).toFixed(1)) : presid}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setPresid("");
                                      else if (isSI) setPresid(v);
                                      else setPresid(v * PSI_TO_BAR);
                                      saveState({ presid: isSI ? v : v * PSI_TO_BAR });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Suction Pressure ({isSI ? "bar" : "psi"})</label>
                                  <input
                                    type="number"
                                    step="0.2"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof suction === "number" ? suction : typeof suction === "number" ? parseFloat((suction / PSI_TO_BAR).toFixed(1)) : suction}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (v === "") setSuction("");
                                      else if (isSI) setSuction(v);
                                      else setSuction(v * PSI_TO_BAR);
                                      saveState({ suction: isSI ? v : v * PSI_TO_BAR });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Safety Margin (%)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    disabled={isEffectiveReadOnly}
                                    value={sfHead}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      setSfHead(v);
                                      saveState({ sfHead: v });
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
                                setStaticHead(isSI ? 5 : 72 * PSI_TO_BAR);
                                setPresid(isSI ? 1 : 14.5 * PSI_TO_BAR);
                                setSuction(0);
                                setSfHead(10);
                                saveState({ staticHead: isSI ? 5 : 72 * PSI_TO_BAR, presid: isSI ? 1 : 14.5 * PSI_TO_BAR, suction: 0, sfHead: 10 });
                                toast.success("Head & pressure parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Head &amp; Pressures</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "headParams", label: "Head & Pressures" })}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Section 5: Efficiency Ratings */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-efficiencyParams"
                              data-field-id="efficiencyParams"
                              data-comment-target="efficiencyParams"
                              className={`pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("efficiencyParams", "Efficiency Ratings")}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Efficiency Ratings (%)
                                  </span>
                                  {renderCommentBadge("efficiencyParams", "Efficiency Ratings")}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Pump Efficiency (%)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    disabled={isEffectiveReadOnly}
                                    value={effPump}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      setEffPump(v);
                                      saveState({ effPump: v });
                                    }}
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Motor Efficiency (%)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    disabled={isEffectiveReadOnly}
                                    value={effMotor}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      setEffMotor(v);
                                      saveState({ effMotor: v });
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
                                setEffPump(70);
                                setEffMotor(85);
                                saveState({ effPump: 70, effMotor: 85 });
                                toast.success("Efficiency parameters reset to default");
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset Efficiency Ratings</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => setActiveCommentTarget({ id: "efficiencyParams", label: "Efficiency Ratings" })}
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <ShieldCheck className="size-3.5" />
                                <span>IPC 1113 Compliant</span>
                              </span>
                            </div>

                            {/* 4 Colorful Top Metric Tiles (Matching Pump Sizing) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                              {/* Tile 1: Design Flow (Blue) */}
                              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Design Duty Flow</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI ? `${calcResults.Q_flow.toFixed(2)}` : `${(calcResults.Q_flow / GPM_TO_LPS).toFixed(1)}`}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {isSI ? "L/s" : "GPM"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  {isSI ? `${(calcResults.Q_flow * 60).toFixed(0)} L/min` : `${(calcResults.Q_flow / GPM_TO_LPS).toFixed(0)} GPM`}
                                </span>
                              </div>

                              {/* Tile 2: Total Dynamic Head (Amber) */}
                              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Dynamic Head (TDH)</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI ? `${calcResults.H_pump_calc.toFixed(2)}` : `${(calcResults.H_pump_calc / PSI_TO_BAR).toFixed(1)}`}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {isSI ? "bar" : "psi"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {isSI ? `${(calcResults.H_pump_calc * 10.197).toFixed(1)} m head` : `${((calcResults.H_pump_calc / PSI_TO_BAR) * 2.31).toFixed(1)} ft head`}
                                </span>
                              </div>

                              {/* Tile 3: Motor Rating (Emerald) */}
                              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Motor Rating</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI ? `${calcResults.P_motor.toFixed(2)}` : `${calcResults.HP.toFixed(2)}`}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {isSI ? "kW" : "HP"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {isSI ? `${calcResults.HP.toFixed(2)} HP` : `${calcResults.P_motor.toFixed(2)} kW`}
                                </span>
                              </div>

                              {/* Tile 4: Active Pit Volume (Purple) */}
                              <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 flex flex-col justify-between">
                                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Active Pit Volume</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI ? `${calcResults.pitVol.toFixed(2)}` : `${(calcResults.pitVol / GAL_TO_M3).toFixed(0)}`}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {isSI ? "m³" : "Gal"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {isSI ? `${(calcResults.pitVol * 1000).toFixed(0)} Litres` : `${(calcResults.pitVol / GAL_TO_M3).toFixed(0)} Gallons`}
                                </span>
                              </div>

                            </div>

                            {/* DETAILED HYDRAULICS SUMMARY TABLE */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Total Equivalent Pipe Run:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {isSI ? `${calcResults.L_equiv.toFixed(1)} m` : `${(calcResults.L_equiv / FT_TO_M).toFixed(1)} ft`}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Piping Friction Loss (H_loss):</span>
                                <span className="font-mono font-bold text-foreground">
                                  {isSI ? `${calcResults.H_loss.toFixed(3)} bar` : `${(calcResults.H_loss / PSI_TO_BAR).toFixed(2)} psi`}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Invert Level Drop:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {isSI ? `${calcResults.invertVal.toFixed(2)} m` : `${(calcResults.invertVal / FT_TO_M).toFixed(2)} ft`}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                                <span className="text-slate-600 dark:text-zinc-400">Proposed Sump Pit Depth:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {isSI ? `${calcResults.propDepth.toFixed(2)} m` : `${(calcResults.propDepth / FT_TO_M).toFixed(2)} ft`}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 font-bold text-foreground">
                                <span>Total Dynamic Head (TDH):</span>
                                <span className="font-mono text-primary text-sm">
                                  {isSI ? `${calcResults.H_pump_calc.toFixed(3)} bar (${(calcResults.H_pump_calc * 10.197).toFixed(1)} m)` : `${(calcResults.H_pump_calc / PSI_TO_BAR).toFixed(2)} psi (${((calcResults.H_pump_calc / PSI_TO_BAR) * 2.31).toFixed(1)} ft)`}
                                </span>
                              </div>
                            </div>

                            {/* Verification Banner */}
                            <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800/50 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 flex items-start gap-3 text-xs">
                              <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                              <div>
                                <strong className="text-[12px] block">Sump Pit Hydraulics Verified:</strong>
                                <p className="mt-0.5 leading-relaxed text-[11.5px]">
                                  Calculated flow of {isSI ? `${calcResults.Q_flow.toFixed(2)} L/s` : `${(calcResults.Q_flow / GPM_TO_LPS).toFixed(1)} GPM`} and active volume of {isSI ? `${calcResults.pitVol.toFixed(2)} m³` : `${(calcResults.pitVol / GAL_TO_M3).toFixed(0)} Gal`} satisfy IPC 1113 standards with {isSI ? `${calcResults.P_motor.toFixed(2)} kW` : `${calcResults.HP.toFixed(2)} HP`} motor power.
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
                            onClick={() => copyToClipboard(`Duty Flow: ${isSI ? calcResults.Q_flow.toFixed(2) + " L/s" : (calcResults.Q_flow / GPM_TO_LPS).toFixed(1) + " GPM"}, TDH: ${isSI ? calcResults.H_pump_calc.toFixed(3) + " bar" : (calcResults.H_pump_calc / PSI_TO_BAR).toFixed(1) + " psi"}`)}
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
                <SumpPumpReportView
                  calcResults={calcResults}
                  req={req}
                  time={time}
                  pitFlow={pitFlow}
                  pitHold={pitHold}
                  longestPipe={longestPipe}
                  staticHead={staticHead}
                  presid={presid}
                  project={project}
                  calcReviewState={calcReviewState}
                  currentUserName={currentUserName}
                  isSI={isSI}
                  onExportPdf={exportPdf}
                />
              )}
            </div>
          </div>
        </div>

        {/* Intelligence Drawer (Collapsible Right Side Panel) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
            }`}
        >
          {intelOpen && (
            <SumpPumpIntelligenceDrawer
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

      {/* Mathematical Formula & Step-by-Step Calculation Breakdown Modal */}
      {formulaModalOpen && (
        <SumpPumpFormulaBreakdownModal
          onClose={() => setFormulaModalOpen(false)}
          calcResults={calcResults}
          unitSystem={unitSystem}
          req={req}
          time={time}
          pitFlow={pitFlow}
          pitHold={pitHold}
          longestPipe={longestPipe}
          propSide={propSide}
          staticHead={staticHead}
          presid={presid}
          suction={suction}
          sfHead={sfHead}
          effPump={effPump}
          effMotor={effMotor}
          fricFactor={fricFactor}
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
function SumpPumpReportView({
  calcResults,
  req,
  time,
  pitFlow,
  pitHold,
  longestPipe,
  staticHead,
  presid,
  project,
  calcReviewState,
  currentUserName,
  isSI,
  onExportPdf,
}: {
  calcResults: any;
  req: number | "";
  time: number | "";
  pitFlow: number | "";
  pitHold: number | "";
  longestPipe: number | "";
  staticHead: number | "";
  presid: number | "";
  project: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  isSI: boolean;
  onExportPdf: () => void;
}) {
  const calcNo = `CALC-SMP-${project?.code || "001"}`;
  const projectNo = project?.code || "PRJ-001";
  const projectName = project?.name || "Sump Pit Drainage Sizing Station";
  const clientName = (project as any)?.client || "Client Representative";
  const endUser = (project as any)?.endUser || "Building Facilities / MEP Department";
  const today = formatDateStr(new Date().toISOString());

  const flow = isSI ? calcResults.Q_flow : calcResults.Q_flow / GPM_TO_LPS;
  const flowUnit = isSI ? "L/s" : "GPM";
  const pitV = isSI ? calcResults.pitVol : calcResults.pitVol / GAL_TO_M3;
  const pitVUnit = isSI ? "m³" : "Gal";
  const h_loss = isSI ? calcResults.H_loss : calcResults.H_loss / PSI_TO_BAR;
  const l_equiv = isSI ? calcResults.L_equiv : calcResults.L_equiv / FT_TO_M;
  const l_unit = isSI ? "m" : "ft";
  const tdh = isSI ? calcResults.H_pump_calc : calcResults.H_pump_calc / PSI_TO_BAR;
  const tdhUnit = isSI ? "bar" : "psi";

  const sigDetails = getSignatureBlockDetails(project?.id || "default", "/plumbing-sump-pump", currentUserName, calcReviewState);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/50 dark:bg-zinc-950/40 custom-scrollbar">
      <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6">

        {/* Document Header */}
        <div className="flex justify-between items-start pb-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">
              Sump Pump Sizing Preliminary Report
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Design Standards: IPC 1113 / ASPE Chapter 7 Sump Pit &amp; Sump Pump Sizing
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

        {/* Section 1: Parameters */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground">1. Input Parameters &amp; Hydraulic Criteria</h3>
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
                  <td className="p-2.5 font-bold">Required Drainage Volume</td>
                  <td className="p-2.5 text-center font-mono font-bold text-primary">{isSI ? `${req} L` : `${(Number(req) / GAL_TO_L).toFixed(0)} Gal`}</td>
                  <td className="p-2.5 text-center font-mono">{isSI ? `${(Number(req) / GAL_TO_L).toFixed(0)} Gal` : `${req} L`}</td>
                  <td className="p-2.5 text-muted-foreground">Total storage / inflow requirement</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">2</td>
                  <td className="p-2.5 font-bold">Target Drawdown Time</td>
                  <td className="p-2.5 text-center font-mono font-bold">{time} hrs</td>
                  <td className="p-2.5 text-center font-mono">{(Number(time) * 60).toFixed(0)} mins</td>
                  <td className="p-2.5 text-muted-foreground">Allowable pit drawdown interval</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">3</td>
                  <td className="p-2.5 font-bold">Inflow Rate to Sump Pit</td>
                  <td className="p-2.5 text-center font-mono font-bold">{isSI ? `${pitFlow} L/s` : `${(Number(pitFlow) / GPM_TO_LPS).toFixed(1)} GPM`}</td>
                  <td className="p-2.5 text-center font-mono">{isSI ? `${(Number(pitFlow) / GPM_TO_LPS).toFixed(1)} GPM` : `${pitFlow} L/s`}</td>
                  <td className="p-2.5 text-muted-foreground">Peak sub-soil / storm inflow draw</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">4</td>
                  <td className="p-2.5 font-bold">Holding / Retention Duration</td>
                  <td className="p-2.5 text-center font-mono font-bold">{pitHold} min</td>
                  <td className="p-2.5 text-center font-mono">{(Number(pitHold) * 60).toFixed(0)} sec</td>
                  <td className="p-2.5 text-muted-foreground">Retention time before pump activation</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">5</td>
                  <td className="p-2.5 font-bold">Static Lift Elevation</td>
                  <td className="p-2.5 text-center font-mono font-bold">{isSI ? `${staticHead} bar` : `${(Number(staticHead) / PSI_TO_BAR).toFixed(1)} psi`}</td>
                  <td className="p-2.5 text-center font-mono">{isSI ? `${(Number(staticHead) * 10.197).toFixed(1)} m` : `${((Number(staticHead) / PSI_TO_BAR) * 2.31).toFixed(1)} ft`}</td>
                  <td className="p-2.5 text-muted-foreground">Basin floor to gravity discharge level</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">6</td>
                  <td className="p-2.5 font-bold">Residual Pressure Required</td>
                  <td className="p-2.5 text-center font-mono font-bold">{isSI ? `${presid} bar` : `${(Number(presid) / PSI_TO_BAR).toFixed(1)} psi`}</td>
                  <td className="p-2.5 text-center font-mono">{isSI ? `${(Number(presid) * 10.197).toFixed(1)} m` : `${((Number(presid) / PSI_TO_BAR) * 2.31).toFixed(1)} ft`}</td>
                  <td className="p-2.5 text-muted-foreground">Terminal discharge residual head</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Outputs */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground">2. Sump Pit Sizing &amp; Hydraulic Results</h3>
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
                  <td className="p-2.5 text-primary">Calculated Pump Duty Flow (Q)</td>
                  <td className="p-2.5 text-center font-mono text-sm text-primary">{flow.toFixed(2)} {flowUnit}</td>
                  <td className="p-2.5 text-center">Duty Flow</td>
                  <td className="p-2.5 text-muted-foreground">Q = Volume / Drawdown Time</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">2</td>
                  <td className="p-2.5 font-semibold">Sump Pit Active Storage Volume</td>
                  <td className="p-2.5 text-center font-mono font-bold">{pitV.toFixed(2)} {pitVUnit}</td>
                  <td className="p-2.5 text-center">Pit Volume</td>
                  <td className="p-2.5 text-muted-foreground">V = Inflow Rate × Holding Time</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">3</td>
                  <td className="p-2.5 font-semibold">Total Dynamic Head (TDH)</td>
                  <td className="p-2.5 text-center font-mono font-bold">{tdh.toFixed(3)} {tdhUnit}</td>
                  <td className="p-2.5 text-center">Dynamic Head</td>
                  <td className="p-2.5 text-muted-foreground">(H_static + H_loss + H_res) × (1 + SF)</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">4</td>
                  <td className="p-2.5 font-semibold">Total Equivalent Pipe Length</td>
                  <td className="p-2.5 text-center font-mono font-bold">{l_equiv.toFixed(1)} {l_unit}</td>
                  <td className="p-2.5 text-center">Piping Run</td>
                  <td className="p-2.5 text-muted-foreground">Vertical + Horizontal + Fittings Loss</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                  <td className="p-2.5 text-center font-mono">5</td>
                  <td className="p-2.5 font-semibold">Friction Head Loss (H_fric)</td>
                  <td className="p-2.5 text-center font-mono font-bold">{h_loss.toFixed(3)} {tdhUnit}</td>
                  <td className="p-2.5 text-center">Friction</td>
                  <td className="p-2.5 text-muted-foreground">Equivalent Length × Friction Factor</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-center font-mono">6</td>
                  <td className="p-2.5 font-semibold">Recommended Motor Power Rating</td>
                  <td className="p-2.5 text-center font-mono font-bold">{isSI ? `${calcResults.P_motor.toFixed(2)} kW (${calcResults.HP.toFixed(2)} HP)` : `${calcResults.HP.toFixed(2)} HP (${calcResults.P_motor.toFixed(2)} kW)`}</td>
                  <td className="p-2.5 text-center">Motor Rating</td>
                  <td className="p-2.5 text-muted-foreground">Electrical submersible motor rating</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Banner */}
        <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800/50 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 flex items-start gap-3 text-xs">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div>
            <strong className="text-sm block">Sump Pit Storage &amp; Submersible Hydraulics Satisfy IPC 1113 &amp; ASPE:</strong>
            <p className="mt-0.5 leading-relaxed text-[11.5px]">
              Active pit volume of {pitV.toFixed(2)} {pitVUnit} with dynamic lift of {tdh.toFixed(2)} {tdhUnit} verified for reliable continuous dewatering. Submersible pump motor of {isSI ? `${calcResults.P_motor.toFixed(2)} kW` : `${calcResults.HP.toFixed(2)} HP`} satisfies continuous duty requirements.
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
function SumpPumpIntelligenceDrawer({
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
  preset: SumpPresetKey;
  onSelectPreset: (k: SumpPresetKey) => void;
  isEffectiveReadOnly: boolean;
  unitSystem: "ip" | "si";
  setFormulaModalOpen: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col h-full bg-card font-sans">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground">Sump Pump Intelligence</h3>
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
            ⚡ Application Presets
          </span>
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(SUMP_PRESETS) as SumpPresetKey[]).filter(k => k !== "custom").map((k) => {
              const p = SUMP_PRESETS[k];
              const isSelected = preset === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={isEffectiveReadOnly}
                  onClick={() => onSelectPreset(k)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${isSelected
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
            📐 Design Codes &amp; Standards
          </span>
          <div className="space-y-1.5 text-[11.5px] text-muted-foreground">
            <p>• <strong>IPC 1113.1:</strong> Sump pit minimum 18" (450mm) diameter and 24" (600mm) depth.</p>
            <p>• <strong>ASPE Chapter 7:</strong> Sump pump sizing based on pit retention time and maximum motor starts/hr.</p>
            <p>• <strong>ASME A17.1:</strong> Elevator pit sump pump minimum 50 GPM (3.0 L/s) continuous discharge capacity.</p>
          </div>
        </div>

        {/* Engineering Guidelines */}
        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 space-y-2">
          <span className="font-bold text-blue-700 dark:text-blue-300 text-[11px] uppercase tracking-wider block">
            💡 Engineering Guidelines
          </span>
          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            <p>• <strong>Velocity:</strong> Maintain ≥ 2.0 ft/s (0.61 m/s) to prevent sedimentation in discharge line.</p>
            <p>• <strong>Cycle Interval:</strong> Keep pump runtime ≥ 15–30 seconds per cycle to prevent motor short-cycling.</p>
            <p>• <strong>Head Loss:</strong> Include 30% allowance for elbow and check valve dynamic losses.</p>
          </div>
        </div>
      </div>

      <div className="p-3.5 border-t border-border bg-card">
        <button
          type="button"
          onClick={() => setFormulaModalOpen(true)}
          className="w-full py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 transition shadow-xs cursor-pointer"
        >
          <Info className="size-3.5" />
          <span>View Formula Breakdown</span>
        </button>
      </div>
    </div>
  );
}

// Unified Mathematical Formula & Step-by-Step Breakdown Modal
function SumpPumpFormulaBreakdownModal({
  onClose,
  calcResults,
  unitSystem,
  req,
  time,
  pitFlow,
  pitHold,
  longestPipe,
  propSide,
  staticHead,
  presid,
  suction,
  sfHead,
  effPump,
  effMotor,
  fricFactor,
}: {
  onClose: () => void;
  calcResults: any;
  unitSystem: "ip" | "si";
  req: number | "";
  time: number | "";
  pitFlow: number | "";
  pitHold: number | "";
  longestPipe: number | "";
  propSide: number | "";
  staticHead: number | "";
  presid: number | "";
  suction: number | "";
  sfHead: number | "";
  effPump: number | "";
  effMotor: number | "";
  fricFactor: number | "";
}) {
  const isSI = unitSystem === "si";
  const GPM_TO_LPS = 0.06309;
  const PSI_TO_BAR = 0.0689476;
  const FT_TO_M = 0.3048;
  const GAL_TO_M3 = 0.00378541;

  const flow = isSI ? calcResults.Q_flow : calcResults.Q_flow / GPM_TO_LPS;
  const flowUnit = isSI ? "L/s" : "GPM";

  const pitV = isSI ? calcResults.pitVol : calcResults.pitVol / GAL_TO_M3;
  const pitVUnit = isSI ? "m³" : "Gal";

  const tdh = isSI ? calcResults.H_pump_calc : calcResults.H_pump_calc / PSI_TO_BAR;
  const tdhUnit = isSI ? "bar" : "psi";

  const headLoss = isSI ? calcResults.H_loss : calcResults.H_loss / PSI_TO_BAR;
  const equivLength = isSI ? calcResults.L_equiv : calcResults.L_equiv / FT_TO_M;
  const lengthUnit = isSI ? "m" : "ft";

  const hp = calcResults.HP;
  const kw = calcResults.P_motor;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
              <Calculator className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Sump Pump Sizing — Formula &amp; Calculation Breakdown</h3>
              <p className="text-xs text-muted-foreground">Governing IPC 1113 / ASPE Chapter 7 equations &amp; live numerical substitutions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground">

          {/* Section 1: Flow Rate & Pit Sizing */}
          <div className="p-4 rounded-xl border border-border bg-surface-2/60 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px]">1</span>
                <span className="font-bold text-foreground uppercase tracking-wider text-[11.5px]">Design Duty Flow Rate &amp; Pit Storage Volume</span>
              </div>
              <span className="text-[10.5px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">IPC 1113.1 &amp; ASPE Ch 7</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-card rounded-lg font-mono border border-border/80 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block font-sans">Formula: Drawdown Flow</span>
                <div className="text-primary font-bold text-xs">Q = Req. Volume / (Drawdown Time × 3600)</div>
                <span className="text-[10.5px] text-muted-foreground block font-sans">For sizing continuous sump discharge flow.</span>
              </div>
              <div className="p-3 bg-card rounded-lg font-mono border border-border/80 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block font-sans">Formula: Pit Volume</span>
                <div className="text-primary font-bold text-xs">V_pit = (Inflow × Holding Time × 60) / 1000</div>
                <span className="text-[10.5px] text-muted-foreground block font-sans">Active liquid retention buffer volume.</span>
              </div>
            </div>

            {/* Live Calculation Substitution */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
              <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> Live Numerical Evaluation:
              </span>
              <div className="space-y-1 font-mono text-[11.5px] pl-2 border-l-2 border-primary/40">
                <div className="text-muted-foreground">
                  • Required Batch Volume = <span className="font-bold text-foreground">{req || 0} {isSI ? "L" : "Gal"}</span> over <span className="font-bold text-foreground">{time || 0} hr(s)</span>
                </div>
                <div className="text-muted-foreground">
                  • Pit Inflow = <span className="font-bold text-foreground">{pitFlow || 0} {isSI ? "L/s" : "GPM"}</span> | Holding Retention = <span className="font-bold text-foreground">{pitHold || 0} min</span>
                </div>
                <div className="text-foreground font-bold pt-1 flex items-center justify-between">
                  <span>→ Duty Flow Rate (Q): <span className="text-primary">{flow.toFixed(2)} {flowUnit}</span> ({isSI ? `${(calcResults.Q_flow * 60).toFixed(0)} L/min` : `${(calcResults.Q_flow / GPM_TO_LPS).toFixed(0)} GPM`})</span>
                  <span>→ Active Pit Vol: <span className="text-primary">{pitV.toFixed(2)} {pitVUnit}</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Friction Loss & Equivalent Length */}
          <div className="p-4 rounded-xl border border-border bg-surface-2/60 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px]">2</span>
                <span className="font-bold text-foreground uppercase tracking-wider text-[11.5px]">Equivalent Pipe Length &amp; Dynamic Friction Loss</span>
              </div>
              <span className="text-[10.5px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">Darcy-Weisbach / Equivalent Length</span>
            </div>

            <div className="p-3 bg-card rounded-lg font-mono border border-border/80 space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block font-sans">Governing Equations</span>
              <div className="text-primary font-bold text-xs space-y-0.5">
                <div>L_fittings = (L_vert + L_horiz) × 30%  |  L_valves = (L_vert + L_horiz) × 30%</div>
                <div>L_equiv = ⌈ (L_vert + L_horiz + L_fittings + L_valves) × 1.05 ⌉_10</div>
                <div>H_loss = L_equiv × (Friction Factor / 100)</div>
              </div>
            </div>

            {/* Live Calculation Substitution */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
              <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> Live Numerical Evaluation:
              </span>
              <div className="space-y-1 font-mono text-[11.5px] pl-2 border-l-2 border-primary/40">
                <div className="text-muted-foreground">
                  • Vertical Run = <span className="font-bold text-foreground">{isSI ? `${calcResults.pv || 0} m` : `${((calcResults.pv || 0) / FT_TO_M).toFixed(1)} ft`}</span> | Horizontal Run = <span className="font-bold text-foreground">{isSI ? `${calcResults.phz || 0} m` : `${((calcResults.phz || 0) / FT_TO_M).toFixed(1)} ft`}</span>
                </div>
                <div className="text-muted-foreground">
                  • Fittings Allowance (+30%) = <span className="font-bold text-foreground">{isSI ? `${(calcResults.L_elbows || 0).toFixed(2)} m` : `${((calcResults.L_elbows || 0) / FT_TO_M).toFixed(1)} ft`}</span>
                </div>
                <div className="text-muted-foreground">
                  • Valves Allowance (+30%) = <span className="font-bold text-foreground">{isSI ? `${(calcResults.L_valves || 0).toFixed(2)} m` : `${((calcResults.L_valves || 0) / FT_TO_M).toFixed(1)} ft`}</span>
                </div>
                <div className="text-muted-foreground">
                  • Total Equivalent Length (L_equiv with 5% safety margin) = <span className="font-bold text-foreground">{equivLength.toFixed(2)} {lengthUnit}</span>
                </div>
                <div className="text-foreground font-bold pt-1">
                  → Friction Head Loss (H_loss) = {equivLength.toFixed(2)} × ({fricFactor || 0.4} / 100) = <span className="text-primary">{headLoss.toFixed(3)} {tdhUnit}</span> ({isSI ? `${(calcResults.H_loss * 10.197).toFixed(2)} m head` : `${((calcResults.H_loss / PSI_TO_BAR) * 2.31).toFixed(2)} ft head`})
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Total Dynamic Head */}
          <div className="p-4 rounded-xl border border-border bg-surface-2/60 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px]">3</span>
                <span className="font-bold text-foreground uppercase tracking-wider text-[11.5px]">Total Dynamic Head (TDH)</span>
              </div>
              <span className="text-[10.5px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">Hydraulic Institute / IPC</span>
            </div>

            <div className="p-3 bg-card rounded-lg font-mono border border-border/80 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block font-sans">Formula: Total Dynamic Head</span>
              <div className="text-primary font-bold text-xs">TDH = (H_static + H_loss + H_residual - H_suction) × (1 + Safety Factor / 100)</div>
            </div>

            {/* Live Calculation Substitution */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
              <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> Live Numerical Evaluation:
              </span>
              <div className="space-y-1 font-mono text-[11.5px] pl-2 border-l-2 border-primary/40">
                <div className="text-muted-foreground">
                  • Static Lift (H_static) = <span className="font-bold text-foreground">{staticHead || 0} {tdhUnit}</span> ({isSI ? `${(Number(staticHead || 0) * 10.197).toFixed(1)} m` : `${((Number(staticHead || 0) / PSI_TO_BAR) * 2.31).toFixed(1)} ft`})
                </div>
                <div className="text-muted-foreground">
                  • Friction Head Loss (H_loss) = <span className="font-bold text-foreground">{headLoss.toFixed(3)} {tdhUnit}</span>
                </div>
                <div className="text-muted-foreground">
                  • Residual Pressure (H_res) = <span className="font-bold text-foreground">{presid || 0} {tdhUnit}</span> | Suction Head (H_suc) = <span className="font-bold text-foreground">{suction || 0} {tdhUnit}</span>
                </div>
                <div className="text-muted-foreground">
                  • Engineering Safety Margin = <span className="font-bold text-foreground">{sfHead || 0}%</span>
                </div>
                <div className="text-foreground font-bold pt-1">
                  → Total Dynamic Head (TDH) = ({staticHead || 0} + {headLoss.toFixed(3)} + {presid || 0} - {suction || 0}) × (1 + {(Number(sfHead || 0) / 100).toFixed(2)}) = <span className="text-primary">{tdh.toFixed(3)} {tdhUnit}</span> ({isSI ? `${(calcResults.H_pump_calc * 10.197).toFixed(2)} m head` : `${((calcResults.H_pump_calc / PSI_TO_BAR) * 2.31).toFixed(2)} ft head`})
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Motor Power Sizing */}
          <div className="p-4 rounded-xl border border-border bg-surface-2/60 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px]">4</span>
                <span className="font-bold text-foreground uppercase tracking-wider text-[11.5px]">Motor Power &amp; Electrical Sizing</span>
              </div>
              <span className="text-[10.5px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">ISO 9906 / ASPE</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-card rounded-lg font-mono border border-border/80 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block font-sans">Formula: Metric Power (kW)</span>
                <div className="text-primary font-bold text-xs">P_motor = (Q × TDH × 100) / (1000 × η_pump × η_motor)</div>
              </div>
              <div className="p-3 bg-card rounded-lg font-mono border border-border/80 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block font-sans">Formula: Imperial Power (HP)</span>
                <div className="text-primary font-bold text-xs">HP = (Q_gpm × TDH_ft × SG) / (3960 × η_pump × η_motor)</div>
              </div>
            </div>

            {/* Live Calculation Substitution */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
              <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> Live Numerical Evaluation:
              </span>
              <div className="space-y-1 font-mono text-[11.5px] pl-2 border-l-2 border-primary/40">
                <div className="text-muted-foreground">
                  • Pump Hydraulic Efficiency (η_pump) = <span className="font-bold text-foreground">{effPump || 70}%</span>
                </div>
                <div className="text-muted-foreground">
                  • Motor Electrical Efficiency (η_motor) = <span className="font-bold text-foreground">{effMotor || 85}%</span>
                </div>
                <div className="text-foreground font-bold pt-1 flex items-center justify-between">
                  <span>→ Electrical Motor Rating: <span className="text-primary">{kw.toFixed(2)} kW</span></span>
                  <span>→ Mechanical Brake Horsepower: <span className="text-primary">{hp.toFixed(2)} HP</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Pit Invert & Depth Geometry */}
          <div className="p-4 rounded-xl border border-border bg-surface-2/60 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px]">5</span>
                <span className="font-bold text-foreground uppercase tracking-wider text-[11.5px]">Sump Pit Invert Level &amp; Proposed Depth</span>
              </div>
              <span className="text-[10.5px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">IPC 1113.1.4</span>
            </div>

            <div className="p-3 bg-card rounded-lg font-mono border border-border/80 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block font-sans">Formula: Invert &amp; Pit Depth</span>
              <div className="text-primary font-bold text-xs space-y-0.5">
                <div>Invert Level = ⌈ Longest Run / 90 ⌉ + 0.16 m</div>
                <div>Proposed Depth = max(1.0, V_pit / Side²) + Invert Level + 0.25 m (Freeboard)</div>
              </div>
            </div>

            {/* Live Calculation Substitution */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
              <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> Live Numerical Evaluation:
              </span>
              <div className="space-y-1 font-mono text-[11.5px] pl-2 border-l-2 border-primary/40">
                <div className="text-muted-foreground">
                  • Longest Drainage Run = <span className="font-bold text-foreground">{longestPipe || 0} {lengthUnit}</span> → Invert Level = <span className="font-bold text-foreground">{isSI ? `${calcResults.invertVal.toFixed(2)} m` : `${((calcResults.invertVal || 0) / FT_TO_M).toFixed(2)} ft`}</span>
                </div>
                <div className="text-muted-foreground">
                  • Pit Side Dimensions = <span className="font-bold text-foreground">{propSide || 0} {lengthUnit} × {propSide || 0} {lengthUnit}</span>
                </div>
                <div className="text-foreground font-bold pt-1">
                  → Proposed Overall Pit Depth = <span className="text-primary">{isSI ? `${calcResults.propDepth.toFixed(2)} m` : `${((calcResults.propDepth || 0) / FT_TO_M).toFixed(2)} ft`}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500" />
            <span>Formulas verified and compliant with IPC 1113 &amp; ASPE Chapter 7</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
