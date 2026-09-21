import React, { useState, useEffect } from "react";
import {
  X, Check, SlidersHorizontal, Flame, Droplets, Gauge,
  Clock, ShieldAlert, RotateCcw, Building2, Building, Factory, Layers, Info
} from "lucide-react";
import { HAZARD_PRESETS, type HazardPresetKey } from "@/routes/plumbing-fire-water-demand";
import { toast } from "sonner";

interface CustomFireDemandConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitSystem: "ip" | "si";
  currentValues: {
    spFlow: number | "";
    spPress: number | "";
    hyCount: number | "";
    hyFlow: number | "";
    hrCount: number | "";
    hrFlow: number | "";
    designDuration: number | "";
    tankReservePct: number | "";
    mainsReplenishFlow: number | "";
    customProfileName?: string;
    customWorkflow?: "calculate" | "direct";
  };
  onApply: (updated: {
    spFlow: number;
    spPress: number;
    hyCount: number;
    hyFlow: number;
    hrCount: number;
    hrFlow: number;
    designDuration: number;
    tankReservePct: number;
    mainsReplenishFlow: number;
    customProfileName: string;
    customWorkflow: "calculate" | "direct";
  }) => void;
}

const GPM_TO_LMIN = 3.78541;
const LMIN_TO_GPM = 0.264172;
const PSI_TO_BAR = 0.0689476;
const BAR_TO_PSI = 14.5038;
const GAL_TO_M3 = 0.00378541;
const M3_TO_GAL = 264.172;

const STANDARD_NFPA20_PUMP_SIZES = [250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000];

export function CustomFireDemandConfigModal({
  isOpen,
  onClose,
  unitSystem,
  currentValues,
  onApply,
}: CustomFireDemandConfigModalProps) {
  const isSI = unitSystem === "si";

  // Form State (Internal IP Storage)
  const [profileName, setProfileName] = useState(
    currentValues.customProfileName || "Custom Fire Demand Profile"
  );
  const [workflow, setWorkflow] = useState<"calculate" | "direct">(
    currentValues.customWorkflow || "calculate"
  );
  const [spFlow, setSpFlow] = useState<number>(Number(currentValues.spFlow) || 500);
  const [spPress, setSpPress] = useState<number>(Number(currentValues.spPress) || 65);
  const [hyCount, setHyCount] = useState<number>(Number(currentValues.hyCount) || 2);
  const [hyFlow, setHyFlow] = useState<number>(Number(currentValues.hyFlow) || 250);
  const [hrCount, setHrCount] = useState<number>(Number(currentValues.hrCount) || 2);
  const [hrFlow, setHrFlow] = useState<number>(Number(currentValues.hrFlow) || 30);
  const [designDuration, setDesignDuration] = useState<number>(Number(currentValues.designDuration) || 90);
  const [tankReservePct, setTankReservePct] = useState<number>(Number(currentValues.tankReservePct) || 10);
  const [mainsReplenishFlow, setMainsReplenishFlow] = useState<number>(Number(currentValues.mainsReplenishFlow) || 0);

  // Sync with prop updates
  useEffect(() => {
    if (isOpen) {
      setProfileName(currentValues.customProfileName || "Custom Fire Demand Profile");
      setWorkflow(currentValues.customWorkflow || "calculate");
      setSpFlow(Number(currentValues.spFlow) || 500);
      setSpPress(Number(currentValues.spPress) || 65);
      setHyCount(Number(currentValues.hyCount) || 2);
      setHyFlow(Number(currentValues.hyFlow) || 250);
      setHrCount(Number(currentValues.hrCount) || 2);
      setHrFlow(Number(currentValues.hrFlow) || 30);
      setDesignDuration(Number(currentValues.designDuration) || 90);
      setTankReservePct(Number(currentValues.tankReservePct) || 10);
      setMainsReplenishFlow(Number(currentValues.mainsReplenishFlow) || 0);
    }
  }, [isOpen, currentValues]);

  if (!isOpen) return null;

  // Clone from baseline archetype
  const handleCloneFromPreset = (key: HazardPresetKey) => {
    const p = HAZARD_PRESETS[key];
    if (p) {
      setSpFlow(p.spFlow);
      setSpPress(p.spPress);
      setHyCount(p.hyCount);
      setHyFlow(p.hyFlow);
      setHrCount(p.hrCount);
      setHrFlow(p.hrFlow);
      setDesignDuration(p.designDuration);
      setTankReservePct(p.tankReservePct);
      setProfileName(`${p.label} (Custom)`);
      toast.info(`Cloned baseline parameters from ${p.label}`);
    }
  };

  // Live Calculations Preview
  const hyTotal = hyCount * hyFlow;
  const hrTotal = hrCount * hrFlow;
  const totalFlowGPM = spFlow + hyTotal + hrTotal;
  const totalFlowLMIN = totalFlowGPM * GPM_TO_LMIN;

  let recommendedPumpGPM = 250;
  for (const size of STANDARD_NFPA20_PUMP_SIZES) {
    if (size >= totalFlowGPM) {
      recommendedPumpGPM = size;
      break;
    }
    recommendedPumpGPM = size;
  }
  if (totalFlowGPM > 5000) {
    recommendedPumpGPM = Math.ceil(totalFlowGPM / 1000) * 1000;
  }

  const effectiveTankGal = totalFlowGPM * designDuration;
  const grossTankGal = effectiveTankGal * (1 + tankReservePct / 100);
  const grossTankM3 = grossTankGal * GAL_TO_M3;

  const handleSave = () => {
    let cleanName = profileName.trim() || "Custom User Defined";
    if (!cleanName.endsWith(" (Custom)")) {
      cleanName = `${cleanName} (Custom)`;
    }

    onApply({
      spFlow,
      spPress,
      hyCount,
      hyFlow,
      hrCount,
      hrFlow,
      designDuration,
      tankReservePct,
      mainsReplenishFlow,
      customProfileName: cleanName,
      customWorkflow: workflow,
    });
    onClose();
    toast.success(`Applied "${cleanName}" parameters!`);
  };

  const inputClass = "w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";
  const labelClass = "text-[11px] font-semibold text-muted-foreground mb-1 flex items-center justify-between";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Custom Fire Demand &amp; Tank Configuration</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase">
                  Ventilation Standard
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Customize sprinkler demand, hydrants, hose reels, and storage tank sizing per NFPA standards.
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

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
          {/* Profile Name & Clone Base Row */}
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border/70 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  <span>Custom Profile Title</span>
                  <span className="text-[10px] font-mono text-primary font-bold">Appends (Custom)</span>
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Airport Hangar / Petrochemical"
                  className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Clone Baseline Archetype</span>
                  <span className="text-[10px] text-muted-foreground">1-Click Preset</span>
                </label>
                <select
                  onChange={(e) => handleCloneFromPreset(e.target.value as HazardPresetKey)}
                  className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-primary cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>Select baseline hazard to clone...</option>
                  <option value="light_hazard">Light Hazard (LH - 30 min)</option>
                  <option value="oh_1">Ordinary Hazard Group 1 (OH-1 - 60 min)</option>
                  <option value="oh_2">Ordinary Hazard Group 2 (OH-2 - 90 min)</option>
                  <option value="extra_hazard">Extra Hazard (EH-1/2 - 120 min)</option>
                  <option value="high_rise_standpipe">High-Rise Standpipe &amp; Sprinkler (90 min)</option>
                </select>
              </div>
            </div>

            {/* Workflow Method Selection */}
            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
              <span className="font-semibold text-muted-foreground text-[11.5px]">Calculation Workflow Method:</span>
              <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/60 gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setWorkflow("calculate")}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                    workflow === "calculate" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Simultaneous Component Sum
                </button>
                <button
                  type="button"
                  onClick={() => setWorkflow("direct")}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                    workflow === "direct" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Direct Flow Input
                </button>
              </div>
            </div>
          </div>

          {/* Section 1: Sprinkler System Demand */}
          <div className="border border-border/70 rounded-xl p-3.5 bg-card space-y-2.5">
            <h4 className="text-[11.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Droplets className="size-3.5 text-primary" /> 1. Sprinkler System Demand (NFPA 13)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  <span>Sprinkler Flow Rate</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "L/min" : "GPM"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((spFlow * GPM_TO_LMIN).toFixed(0)) : spFlow}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setSpFlow(isSI ? v * LMIN_TO_GPM : v);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Minimum Required Pressure</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "bar" : "psi"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((spPress * PSI_TO_BAR).toFixed(2)) : spPress}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setSpPress(isSI ? v * BAR_TO_PSI : v);
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Hydrants & Hose Reels */}
          <div className="border border-border/70 rounded-xl p-3.5 bg-card space-y-2.5">
            <h4 className="text-[11.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Flame className="size-3.5 text-primary" /> 2. Fire Hydrants &amp; Hose Reels (NFPA 14 / 24)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>
                  <span>Hydrant Count</span>
                  <span className="font-mono text-muted-foreground">Qty</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={hyCount}
                  onChange={(e) => setHyCount(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Hydrant Unit Flow</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "L/min" : "GPM"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((hyFlow * GPM_TO_LMIN).toFixed(0)) : hyFlow}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setHyFlow(isSI ? v * LMIN_TO_GPM : v);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Hose Reel Count</span>
                  <span className="font-mono text-muted-foreground">Qty</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={hrCount}
                  onChange={(e) => setHrCount(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Hose Reel Unit Flow</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "L/min" : "GPM"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((hrFlow * GPM_TO_LMIN).toFixed(0)) : hrFlow}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setHrFlow(isSI ? v * LMIN_TO_GPM : v);
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Water Storage Duration & Safety Reserve */}
          <div className="border border-border/70 rounded-xl p-3.5 bg-card space-y-2.5">
            <h4 className="text-[11.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" /> 3. Tank Storage Duration &amp; Safety Reserve (NFPA 22)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  <span>Design Duration</span>
                  <span className="font-mono text-muted-foreground">Minutes</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={designDuration}
                  onChange={(e) => setDesignDuration(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Tank Ullage Reserve</span>
                  <span className="font-mono text-muted-foreground">%</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={tankReservePct}
                  onChange={(e) => setTankReservePct(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>City Mains Refill</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "L/min" : "GPM"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((mainsReplenishFlow * GPM_TO_LMIN).toFixed(0)) : mainsReplenishFlow}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setMainsReplenishFlow(isSI ? v * LMIN_TO_GPM : v);
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Live Estimated Water Demand & Tank Sizing Summary */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-red-500/10 via-orange-500/5 to-transparent border border-orange-500/20 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Flame className="size-3.5 text-red-500" /> Sized Total Fire Water Demand:
              </span>
              <span className="text-[13px] font-extrabold font-mono text-primary">
                {isSI ? `${totalFlowLMIN.toFixed(0)} L/min (${totalFlowGPM.toFixed(0)} GPM)` : `${totalFlowGPM.toFixed(0)} GPM (${totalFlowLMIN.toFixed(0)} L/min)`}
              </span>
            </div>
            <div className="text-[10.5px] font-mono text-muted-foreground text-right">
              <span>Gross Tank = {grossTankGal.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal ({grossTankM3.toFixed(1)} m³)</span> • 
              <span className="ml-1">Pump = {recommendedPumpGPM} GPM</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/80 bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={() => handleCloneFromPreset("oh_2")}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>Reset to OH-2 Baseline</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/60 transition cursor-pointer text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs hover:shadow-sm transition cursor-pointer flex items-center gap-1.5"
            >
              <Check className="size-3.5" />
              <span>Apply Custom Profile</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
