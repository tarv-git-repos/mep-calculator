import React, { useState, useEffect, useMemo } from "react";
import {
  X, Check, SlidersHorizontal, Droplets, Gauge,
  Clock, ShieldAlert, RotateCcw, Building2, Building, Factory, Home, Utensils, Zap, Cylinder, Info, ArrowUpRight, ShieldCheck, Activity
} from "lucide-react";
import { SEWAGE_PRESETS, type SewagePresetKey } from "@/routes/plumbing-sewage-pump";
import { toast } from "sonner";

interface CustomSewagePumpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitSystem: "ip" | "si";
  currentValues: {
    inflow: number | "";
    flowMultiplier: number | "";
    cycle: number | "";
    starts: number | "";
    lift: number | "";
    pipeDia: number | "";
    pipeLen: number | "";
    fittingsHead: number | "";
    safetyFactor: number | "";
    basinDia: number | "";
    pumpEfficiency: number | "";
    motorEfficiency: number | "";
    pumpCountMode: "1W_1S" | "2W_1S";
    customProfileName?: string;
    customWorkflow?: "dfu" | "direct";
  };
  onApply: (updated: {
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
  }) => void;
}

const GPM_TO_LPS = 0.0630902;
const LPS_TO_GPM = 15.8503;
const FT_TO_M = 0.3048;
const M_TO_FT = 3.28084;
const IN_TO_MM = 25.4;
const GAL_TO_M3 = 0.00378541;
const HP_TO_KW = 0.7457;

const STANDARD_MOTOR_HP = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 7.5, 10.0, 15.0, 20.0, 25.0, 30.0];

export function CustomSewagePumpConfigModal({
  isOpen,
  onClose,
  unitSystem,
  currentValues,
  onApply,
}: CustomSewagePumpConfigModalProps) {
  const isSI = unitSystem === "si";

  // Form State (Internal IP Storage)
  const [profileName, setProfileName] = useState(
    currentValues.customProfileName || "Custom Sanitary Lift Profile"
  );
  const [workflow, setWorkflow] = useState<"dfu" | "direct">(
    currentValues.customWorkflow || "direct"
  );

  // DFU Input for Method A
  const [dfuCount, setDfuCount] = useState<number>(80);

  // Direct Parameters (IP units)
  const [inflow, setInflow] = useState<number>(Number(currentValues.inflow) || 50);
  const [flowMultiplier, setFlowMultiplier] = useState<number>(Number(currentValues.flowMultiplier) || 2.0);
  const [cycle, setCycle] = useState<number>(Number(currentValues.cycle) || 6);
  const [starts, setStarts] = useState<number>(Number(currentValues.starts) || 6);
  const [lift, setLift] = useState<number>(Number(currentValues.lift) || 25);
  const [pipeDia, setPipeDia] = useState<number>(Number(currentValues.pipeDia) || 3.0);
  const [pipeLen, setPipeLen] = useState<number>(Number(currentValues.pipeLen) || 65);
  const [fittingsHead, setFittingsHead] = useState<number>(Number(currentValues.fittingsHead) || 6.0);
  const [safetyFactor, setSafetyFactor] = useState<number>(Number(currentValues.safetyFactor) || 15);
  const [basinDia, setBasinDia] = useState<number>(Number(currentValues.basinDia) || 36);
  const [pumpEfficiency, setPumpEfficiency] = useState<number>(Number(currentValues.pumpEfficiency) || 60);
  const [motorEfficiency, setMotorEfficiency] = useState<number>(Number(currentValues.motorEfficiency) || 85);
  const [pumpCountMode, setPumpCountMode] = useState<"1W_1S" | "2W_1S">(currentValues.pumpCountMode || "1W_1S");

  // Sync with prop updates
  useEffect(() => {
    if (isOpen) {
      setProfileName(currentValues.customProfileName || "Custom Sanitary Lift Profile");
      setWorkflow(currentValues.customWorkflow || "direct");
      setInflow(Number(currentValues.inflow) || 50);
      setFlowMultiplier(Number(currentValues.flowMultiplier) || 2.0);
      setCycle(Number(currentValues.cycle) || 6);
      setStarts(Number(currentValues.starts) || 6);
      setLift(Number(currentValues.lift) || 25);
      setPipeDia(Number(currentValues.pipeDia) || 3.0);
      setPipeLen(Number(currentValues.pipeLen) || 65);
      setFittingsHead(Number(currentValues.fittingsHead) || 6.0);
      setSafetyFactor(Number(currentValues.safetyFactor) || 15);
      setBasinDia(Number(currentValues.basinDia) || 36);
      setPumpEfficiency(Number(currentValues.pumpEfficiency) || 60);
      setMotorEfficiency(Number(currentValues.motorEfficiency) || 85);
      setPumpCountMode(currentValues.pumpCountMode || "1W_1S");
    }
  }, [isOpen, currentValues]);

  // If DFU workflow is selected, update inflow automatically
  useEffect(() => {
    if (workflow === "dfu") {
      // IPC / Hunter Curve approximation: Q = 10 + 0.5 * DFU (min 20 GPM)
      const calculatedGpm = Math.max(20, Math.round(10 + 0.5 * dfuCount));
      setInflow(calculatedGpm);
    }
  }, [workflow, dfuCount]);

  // Clone from baseline archetype
  const handleCloneFromPreset = (key: SewagePresetKey) => {
    const p = SEWAGE_PRESETS[key];
    if (p) {
      setInflow(p.inflow);
      setCycle(p.cycle);
      setStarts(p.starts);
      setLift(p.lift);
      setPipeDia(p.pipeDia);
      setPipeLen(p.pipeLen);
      setFittingsHead(p.fittingsHead);
      setSafetyFactor(p.safetyFactor);
      setBasinDia(p.basinDia);
      setProfileName(`${p.label} (Custom)`);
      toast.success(`Cloned parameters from: ${p.label}`);
    }
  };

  // Live Calculations
  const liveResults = useMemo(() => {
    const qIn = inflow;
    const mult = flowMultiplier;
    const tCycle = cycle;
    const hStatic = lift;
    const dPipe = pipeDia;
    const lPipe = pipeLen;
    const hFittings = fittingsHead;
    const sf = safetyFactor;
    const dBasin = basinDia;
    const effP = pumpEfficiency / 100;
    const effM = motorEfficiency / 100;

    const dutyFlowPerPump = qIn * mult;
    const totalWorkingFlow = pumpCountMode === "2W_1S" ? dutyFlowPerPump * 2 : dutyFlowPerPump;

    const pipeAreaSqFt = (Math.PI * Math.pow(dPipe / 24, 2));
    const flowCfs = (dutyFlowPerPump * 0.13368) / 60;
    const velocityFps = pipeAreaSqFt > 0 ? flowCfs / pipeAreaSqFt : 0;
    const velocityMs = velocityFps * FT_TO_M;

    const C = 120;
    const frictionHead =
      dPipe > 0
        ? 0.002083 * lPipe * Math.pow(100 / C, 1.852) * (Math.pow(dutyFlowPerPump, 1.852) / Math.pow(dPipe, 4.8655))
        : 0;

    const totalDynamicLosses = hStatic + frictionHead + hFittings;
    const tdh = totalDynamicLosses * (1 + sf / 100);

    const activeVolGal = (dutyFlowPerPump * tCycle) / 4;
    const activeVolM3 = activeVolGal * GAL_TO_M3;

    const basinRadiusFt = dBasin / 24;
    const basinAreaSqFt = Math.PI * Math.pow(basinRadiusFt, 2);
    const activeVolCuFt = activeVolGal * 0.13368;
    const activeDepthFt = basinAreaSqFt > 0 ? activeVolCuFt / basinAreaSqFt : 0;
    const activeDepthInches = activeDepthFt * 12;
    const totalBasinDepthInches = activeDepthInches + 24;

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

    const isScouringCompliant = velocityFps >= 2.0;

    return {
      dutyFlowPerPump,
      totalWorkingFlow,
      velocityFps,
      velocityMs,
      tdh,
      activeVolGal,
      activeVolM3,
      totalBasinDepthInches,
      bhp,
      recommendedMotorHP,
      recommendedMotorKW,
      isScouringCompliant,
    };
  }, [
    inflow,
    flowMultiplier,
    cycle,
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = profileName.trim()
      ? profileName.trim().endsWith(" (Custom)")
        ? profileName.trim()
        : `${profileName.trim()} (Custom)`
      : "Custom Sanitary Lift Profile (Custom)";

    onApply({
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
      customProfileName: finalName,
      customWorkflow: workflow,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-surface-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Custom Sewage Pump &amp; Wet Well Sizing
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-primary/20 text-primary uppercase">
                  Custom
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure tailored peak inflow, static elevation, developed friction head, basin sizing &amp; motor selection.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Profile Name & Tagging */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Custom Configuration Name</span>
              <span className="text-[11px] font-normal text-muted-foreground">Auto-labeled with (Custom) tag</span>
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g., Commercial Basement Duplex Station"
              className="w-full h-9 px-3 bg-background border border-input rounded-xl text-xs font-semibold focus:border-primary outline-none"
            />
          </div>

          {/* 1-Click Baseline Preset Clone Bar */}
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Droplets className="size-3.5 text-primary" />
                Clone from Standard IPC/ASPE Baseline
              </span>
              <span className="text-[10.5px] text-muted-foreground">1-click populate initial design basis</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  { key: "residential_basement", label: "Residential", icon: Home, lift: "15ft", gpm: "20 GPM" },
                  { key: "commercial_building", label: "Commercial", icon: Building2, lift: "25ft", gpm: "50 GPM" },
                  { key: "restaurant_kitchen", label: "Restaurant", icon: Utensils, lift: "20ft", gpm: "65 GPM" },
                  { key: "high_rise_basement", label: "High-Rise", icon: Building, lift: "55ft", gpm: "75 GPM" },
                  { key: "heavy_duty_station", label: "Wet Well", icon: Factory, lift: "35ft", gpm: "150 GPM" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleCloneFromPreset(item.key)}
                  className="px-2.5 py-1.5 rounded-lg border border-border/70 bg-card hover:bg-surface hover:border-border text-left transition flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <item.icon className="size-3 text-primary shrink-0" />
                    <span className="text-[11px] font-bold text-foreground truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{item.lift}</span>
                    <span className="font-semibold text-primary">{item.gpm}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sizing Method Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Inflow Determination Method</label>
            <div className="grid grid-cols-2 gap-2 bg-surface-2 p-1 rounded-xl border border-border/80">
              <button
                type="button"
                onClick={() => setWorkflow("direct")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  workflow === "direct"
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Gauge className="size-3.5 text-primary" />
                <span>Direct Peak Inflow (GPM / L/s)</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkflow("dfu")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  workflow === "dfu"
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Droplets className="size-3.5 text-primary" />
                <span>Drainage Fixture Units (DFU / Hunter)</span>
              </button>
            </div>
          </div>

          {/* Section 1: Inflow & Pumping Duty */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border/60 pb-1">
              <Gauge className="size-3.5 text-primary" /> 1. Inflow &amp; Pumping Arrangement
            </h3>
            
            {workflow === "dfu" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Total Connected DFU (Hunter Load)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={dfuCount}
                    onChange={(e) => setDfuCount(Math.max(1, Number(e.target.value)))}
                    className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Sum of WC, lavatories &amp; floor drains
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Calculated Peak Inflow ({isSI ? "L/s" : "GPM"})
                  </label>
                  <div className="h-8 px-2 flex items-center bg-primary/10 text-primary font-bold text-xs rounded-lg">
                    {isSI ? (inflow * GPM_TO_LPS).toFixed(2) + " L/s" : inflow + " GPM"}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Q = 10 + 0.5 × DFU per IPC curve
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Pump Drawdown Multiplier
                  </label>
                  <input
                    type="number"
                    min="1.0"
                    max="3.0"
                    step="0.1"
                    value={flowMultiplier}
                    onChange={(e) => setFlowMultiplier(Number(e.target.value))}
                    className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    1.5x – 2.0x recommended by ASPE
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Peak Inflow Rate ({isSI ? "L/s" : "GPM"})
                  </label>
                  <input
                    type="number"
                    min="5"
                    step={isSI ? "0.1" : "1"}
                    value={isSI ? Number((inflow * GPM_TO_LPS).toFixed(2)) : inflow}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setInflow(isSI ? v * LPS_TO_GPM : v);
                    }}
                    className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Peak gravity sanitary drainage flow
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Pump Drawdown Multiplier
                  </label>
                  <input
                    type="number"
                    min="1.0"
                    max="3.0"
                    step="0.1"
                    value={flowMultiplier}
                    onChange={(e) => setFlowMultiplier(Number(e.target.value))}
                    className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    1.5x – 2.0x recommended by ASPE
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Pumping Redundancy Mode
                  </label>
                  <select
                    value={pumpCountMode}
                    onChange={(e) => setPumpCountMode(e.target.value as "1W_1S" | "2W_1S")}
                    className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold cursor-pointer"
                  >
                    <option value="1W_1S">Duplex (1 Working + 1 Standby)</option>
                    <option value="2W_1S">Triplex (2 Working + 1 Standby)</option>
                  </select>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    100% standby backup per IPC 712
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Target Sump Cycle Time (Minutes)
                </label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  step="0.5"
                  value={cycle}
                  onChange={(e) => setCycle(Number(e.target.value))}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Typical 5 to 10 min interval between pump starts
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Maximum Starts / Hour (NEMA MG-1)
                </label>
                <input
                  type="number"
                  min="2"
                  max="15"
                  step="1"
                  value={starts}
                  onChange={(e) => setStarts(Number(e.target.value))}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Submersible motor thermal protection limit (max 6–10/hr)
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Hydraulics & Discharge Piping */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border/60 pb-1">
              <ArrowUpRight className="size-3.5 text-primary" /> 2. Hydraulics &amp; Discharge Piping Run
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Static Elevation Lift ({isSI ? "m" : "ft"})
                </label>
                <input
                  type="number"
                  min="1"
                  step={isSI ? "0.1" : "1"}
                  value={isSI ? Number((lift * FT_TO_M).toFixed(2)) : lift}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setLift(isSI ? v * M_TO_FT : v);
                  }}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Basin low invert to gravity main
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Discharge Pipe Diameter (NPS)
                </label>
                <select
                  value={pipeDia}
                  onChange={(e) => setPipeDia(Number(e.target.value))}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold cursor-pointer"
                >
                  <option value="2.0">2.0" NPS (50 mm)</option>
                  <option value="2.5">2.5" NPS (65 mm)</option>
                  <option value="3.0">3.0" NPS (80 mm)</option>
                  <option value="4.0">4.0" NPS (100 mm)</option>
                  <option value="6.0">6.0" NPS (150 mm)</option>
                  <option value="8.0">8.0" NPS (200 mm)</option>
                </select>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  IPC 712: min 2.0" for solids clearance
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Developed Pipe Length ({isSI ? "m" : "ft"})
                </label>
                <input
                  type="number"
                  min="5"
                  step={isSI ? "0.5" : "1"}
                  value={isSI ? Number((pipeLen * FT_TO_M).toFixed(1)) : pipeLen}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPipeLen(isSI ? v * M_TO_FT : v);
                  }}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Total linear pipe run including risers
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Fittings &amp; Valve Minor Head Loss ({isSI ? "m" : "ft"})
                </label>
                <input
                  type="number"
                  min="0.5"
                  step={isSI ? "0.1" : "0.5"}
                  value={isSI ? Number((fittingsHead * FT_TO_M).toFixed(2)) : fittingsHead}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFittingsHead(isSI ? v * M_TO_FT : v);
                  }}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Check valve, gate valves &amp; 90° bends
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Hydraulic Safety Margin (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  value={safetyFactor}
                  onChange={(e) => setSafetyFactor(Number(e.target.value))}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Friction aging &amp; grease slime margin (+10%–20%)
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Basin Geometry & Motor Specs */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border/60 pb-1">
              <Cylinder className="size-3.5 text-primary" /> 3. Wet Well Basin &amp; Motor Electrics
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Wet Well Diameter (Ø)
                </label>
                <select
                  value={basinDia}
                  onChange={(e) => setBasinDia(Number(e.target.value))}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold cursor-pointer"
                >
                  <option value="24">24" Ø (600 mm)</option>
                  <option value="30">30" Ø (750 mm)</option>
                  <option value="36">36" Ø (900 mm)</option>
                  <option value="42">42" Ø (1050 mm)</option>
                  <option value="48">48" Ø (1200 mm)</option>
                  <option value="60">60" Ø (1500 mm)</option>
                  <option value="72">72" Ø (1800 mm)</option>
                </select>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Fiberglass / polyethylene basin size
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Pump Hydraulic Efficiency (%)
                </label>
                <input
                  type="number"
                  min="30"
                  max="90"
                  step="1"
                  value={pumpEfficiency}
                  onChange={(e) => setPumpEfficiency(Number(e.target.value))}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Typical non-clog impeller: 55%–70%
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Motor Electrical Efficiency (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="98"
                  step="1"
                  value={motorEfficiency}
                  onChange={(e) => setMotorEfficiency(Number(e.target.value))}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Submersible motor: 80%–90%
                </span>
              </div>
            </div>
          </div>

          {/* Live Hydraulic Sizing Readout */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Activity className="size-4" />
                Live Hydraulic Sizing Output Summary
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                IPC 712 / ASPE 7 Calculations
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Duty Flow / Pump</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {isSI ? `${(liveResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s` : `${liveResults.dutyFlowPerPump.toFixed(1)} GPM`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Total Dynamic Head</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {isSI ? `${(liveResults.tdh * FT_TO_M).toFixed(1)} m` : `${liveResults.tdh.toFixed(1)} ft`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Pipe Velocity</span>
                <span className={`font-mono font-bold text-sm ${liveResults.isScouringCompliant ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                  {isSI ? `${liveResults.velocityMs.toFixed(2)} m/s` : `${liveResults.velocityFps.toFixed(2)} ft/s`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Active Storage</span>
                <span className="font-mono font-bold text-primary text-sm">
                  {isSI ? `${liveResults.activeVolM3.toFixed(2)} m³` : `${liveResults.activeVolGal.toFixed(0)} Gal`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Selected Motor</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {isSI ? `${liveResults.recommendedMotorKW.toFixed(2)} kW` : `${liveResults.recommendedMotorHP} HP`}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Check className="size-4" />
              Apply Custom Configuration
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
