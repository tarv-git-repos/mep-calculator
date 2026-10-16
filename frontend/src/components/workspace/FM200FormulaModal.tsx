import React, { useState, useEffect } from "react";
import {
  X, Check, Calculator, BookOpen, Layers, Flame, ShieldAlert,
  Building2, Sparkles, Copy, ShieldCheck, ArrowRight, Info, CheckCircle2,
  SlidersHorizontal, Wind, FileText, Activity, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { type PresetOption } from "@/lib/calc-plumbing-fm200";

interface FM200FormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitSystem: "ip" | "si";
  currentValues: {
    area: number | "";
    height: number | "";
    preset: PresetOption;
    customConc: number | "";
    temp: number | "";
    useStandardS: boolean;
    safetyFactor: number | "";
  };
  calcResults: {
    volume: number;
    C: number;
    S: number;
    weight: number;
    warnings: string[];
  };
}

export function FM200FormulaModal({
  isOpen,
  onClose,
  unitSystem,
  currentValues,
  calcResults,
}: FM200FormulaModalProps) {
  const [activeTab, setActiveTab] = useState<"trace" | "formulas" | "standards">("trace");
  const [copied, setCopied] = useState(false);

  // Esc key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSI = unitSystem === "si";

  const areaVal = typeof currentValues.area === "number" ? currentValues.area : 0;
  const heightVal = typeof currentValues.height === "number" ? currentValues.height : 0;
  const tempVal = typeof currentValues.temp === "number" ? currentValues.temp : (isSI ? 20 : 68);
  const safetyFactorVal = typeof currentValues.safetyFactor === "number" ? currentValues.safetyFactor : 1.0;
  const concVal = calcResults.C;
  const specificVol = calcResults.S;
  const netVolume = calcResults.volume;
  const totalWeight = calcResults.weight;

  // Derived metrics
  const concTerm = concVal > 0 && 100 - concVal > 0 ? concVal / (100 - concVal) : 0;
  const dischargeTimeSec = 10.0;
  const avgDischargeRate = totalWeight > 0 ? totalWeight / dischargeTimeSec : 0;
  const agentDensityKgM3 = isSI ? (specificVol > 0 ? 1 / specificVol : 0) : (specificVol > 0 ? 1 / specificVol : 0);

  // Preset Label Map
  const presetLabelMap: Record<PresetOption, { name: string; standard: string; desc: string }> = {
    class_a: {
      name: "Class A: Surface Fire (Data Center / Office)",
      standard: "NFPA 2001 Cl. 5.4.2",
      desc: "Electronic data processing, server rooms, control rooms, telco facilities.",
    },
    class_b: {
      name: "Class B: Flammable Liquid Storage",
      standard: "NFPA 2001 Cl. 5.4.1",
      desc: "Diesel generator rooms, fuel storage, paint lockers, solvents.",
    },
    class_c: {
      name: "Class C: Energized Electrical Equipment",
      standard: "NFPA 2001 Cl. 5.4.3",
      desc: "Substations, main switchboards, UPS halls, transformer vaults.",
    },
    custom: {
      name: "Custom Engineered Concentration",
      standard: "Project Design Criteria",
      desc: "User-defined clean agent concentration and specific safety margin.",
    },
  };

  const currentPresetInfo = presetLabelMap[currentValues.preset] || presetLabelMap.class_a;

  // NOAEL / LOAEL Status
  const isAboveNOAEL = concVal > 9.0;
  const isAboveLOAEL = concVal > 10.5;

  const handleCopySummary = () => {
    const text = `=== NFPA 2001 CLEAN AGENT (FM-200 / HFC-227ea) CALCULATION BREAKDOWN ===
Governing Standards: NFPA 2001 (2022 Edition) Clause 5.5.1 & ISO 14520-9
Unit System: ${isSI ? "SI Metric (m, m³, kg)" : "IP Imperial (ft, ft³, lb)"}
Hazard Classification: ${currentPresetInfo.name} (${currentPresetInfo.standard})

--- 1. ENCLOSURE GEOMETRY & DESIGN PARAMETERS ---
• Protected Floor Area: ${areaVal.toFixed(2)} ${isSI ? "m²" : "ft²"}
• Enclosure Ceiling Height: ${heightVal.toFixed(2)} ${isSI ? "m" : "ft"}
• Net Enclosure Volume (V): ${netVolume.toFixed(2)} ${isSI ? "m³" : "ft³"}
• Design Ambient Temperature (T): ${tempVal.toFixed(1)} ${isSI ? "°C" : "°F"}
• Design Extinguishing Concentration (C): ${concVal.toFixed(3)}%
• Specific Vapor Volume (S): ${specificVol.toFixed(4)} ${isSI ? "m³/kg" : "ft³/lb"} ${currentValues.useStandardS ? "(Locked standard)" : "(Temperature-dependent formula)"}
• Safety Factor Multiplier: ${safetyFactorVal.toFixed(2)}x

--- 2. STEP-BY-STEP CALCULATION DERIVATION (NFPA 2001 EQ 5.5.1) ---
[1] Net Enclosure Volume:
    V = Area × Height = ${areaVal.toFixed(2)} × ${heightVal.toFixed(2)} = ${netVolume.toFixed(2)} ${isSI ? "m³" : "ft³"}

[2] Specific Vapor Volume (S):
    ${currentValues.useStandardS
      ? `S = ${specificVol.toFixed(4)} ${isSI ? "m³/kg" : "ft³/lb"} (Standard constant at reference 20°C / 68°F)`
      : isSI
        ? `S = 0.1269 + (0.000513 × ${tempVal.toFixed(1)}°C) = ${specificVol.toFixed(4)} m³/kg`
        : `S = 1.885 + (0.0046 × ${tempVal.toFixed(1)}°F) = ${specificVol.toFixed(4)} ft³/lb`}

[3] Volumetric Expansion Ratio:
    C / (100 - C) = ${concVal.toFixed(3)} / (100 - ${concVal.toFixed(3)}) = ${concTerm.toFixed(6)}

[4] Required Clean Agent Mass (W):
    W = (V / S) × (C / (100 - C)) × SafetyFactor
    W = (${netVolume.toFixed(2)} / ${specificVol.toFixed(4)}) × (${concVal.toFixed(3)} / ${(100 - concVal).toFixed(3)}) × ${safetyFactorVal.toFixed(2)}
    TOTAL SIZED AGENT MASS = ${totalWeight.toFixed(2)} ${isSI ? "kg" : "lb"}

--- 3. DISCHARGE DYNAMICS & SAFETY CRITERIA ---
• Max Allowed Discharge Time: 10.0 seconds (Mandatory per NFPA 2001 Cl. 5.7.1.2)
• Average Required Discharge Flow Rate: ${avgDischargeRate.toFixed(2)} ${isSI ? "kg/s" : "lb/s"}
• Minimum Enclosure Retention Hold Time: 10.0 minutes (Door Fan Integrity Test)
• Human Exposure NOAEL Benchmark: 9.0% (Current Design: ${concVal.toFixed(2)}% -> ${isAboveNOAEL ? "EXCEEDS NOAEL - Egress controls required" : "SAFE FOR OCCUPIED ENCLOSURE"})
• Lowest Observed Adverse Effect (LOAEL): 10.5% (Current Design: ${concVal.toFixed(2)}% -> ${isAboveLOAEL ? "EXCEEDS LOAEL - Strictly restricted" : "Compliant with LOAEL threshold"})
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("NFPA 2001 FM-200 formula breakdown copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150 select-none font-sans"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Ventilation & Preliminary Cooling standard */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Calculator className="size-4" />
            </div>
            <div className="truncate">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2 truncate">
                <span>FM-200 (HFC-227ea) Clean Agent Formula Breakdown</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase">
                  NFPA 2001 Cl. 5.5.1
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border/70">
                  {isSI ? "SI Metric" : "IP Imperial"}
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground truncate">
                Total flooding clean agent extinguishing weight derivation, vapor specific volume tracing, and NFPA life safety thresholds.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer shrink-0"
            title="Close modal (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-border/70 bg-surface-2/40 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("trace")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold transition cursor-pointer ${
                activeTab === "trace"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <Calculator className="size-3.5" />
              <span>1. Live Substituted Trace</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("formulas")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold transition cursor-pointer ${
                activeTab === "formulas"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <BookOpen className="size-3.5" />
              <span>2. Governing NFPA Formulations</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("standards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold transition cursor-pointer ${
                activeTab === "standards"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>3. Safety Limits &amp; Concentration Benchmarks</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopySummary}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-lg border border-border bg-card hover:bg-surface-2 text-foreground transition cursor-pointer shadow-2xs"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
            <span>{copied ? "Copied!" : "Copy Trace"}</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs">

          {/* TAB 1: LIVE VALUE STEP-BY-STEP DERIVATION */}
          {activeTab === "trace" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Active Space Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-500/10 via-sky-500/5 to-transparent border border-blue-500/20 flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-xs uppercase tracking-wider">
                      Hazard Profile:
                    </span>
                    <span className="font-extrabold text-primary text-xs">
                      {currentPresetInfo.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-3 font-mono">
                    <span>Area: {areaVal.toFixed(2)} {isSI ? "m²" : "sq ft"}</span>
                    <span>•</span>
                    <span>Height: {heightVal.toFixed(2)} {isSI ? "m" : "ft"}</span>
                    <span>•</span>
                    <span>Volume: {netVolume.toFixed(2)} {isSI ? "m³" : "cu ft"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10.5px] font-mono uppercase text-muted-foreground block">Required Agent Weight</span>
                  <span className="text-base font-black font-mono text-primary">
                    {totalWeight.toFixed(2)} {isSI ? "kg" : "lb"}
                  </span>
                </div>
              </div>

              {/* Step 1: Net Protected Enclosure Volume */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded-full bg-primary text-primary-foreground font-black text-[10.5px] flex items-center justify-center">1</span>
                    <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px]">
                      Protected Enclosure Net Volume (V)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/70 text-muted-foreground">
                    NFPA 2001 Cl. 5.2
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-2.5 bg-surface-2/60 rounded-lg border border-border/70 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">General Formula:</span>
                    <div className="font-mono font-bold text-primary text-xs">
                      V = Floor Area × Enclosure Height
                    </div>
                  </div>

                  <div className="p-2.5 bg-surface-2/60 rounded-lg border border-border/70 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Live Substituted Result:</span>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                      {areaVal.toFixed(2)} {isSI ? "m²" : "ft²"} × {heightVal.toFixed(2)} {isSI ? "m" : "ft"} = {netVolume.toFixed(2)} {isSI ? "m³" : "ft³"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Specific Vapor Volume S */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded-full bg-primary text-primary-foreground font-black text-[10.5px] flex items-center justify-center">2</span>
                    <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px]">
                      Specific Vapor Volume of Clean Agent (S)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/70 text-muted-foreground">
                    NFPA 2001 Equation 5.5.1
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div className="p-2.5 bg-surface-2/60 rounded-lg border border-border/60 space-y-1">
                    <span className="text-[10px] font-sans font-semibold text-muted-foreground block">
                      {currentValues.useStandardS ? "Standard Reference Constant:" : "Temperature-Dependent Equation:"}
                    </span>
                    <div className="text-primary font-bold text-xs">
                      {currentValues.useStandardS
                        ? (isSI ? "S_std = 0.1473 m³/kg (at 20°C)" : "S_std = 2.3595 ft³/lb (at 68°F)")
                        : (isSI ? "S = 0.1269 + (0.000513 × T_°C)" : "S = 1.885 + (0.0046 × T_°F)")}
                    </div>
                  </div>

                  <div className="p-2.5 bg-surface-2/60 rounded-lg border border-border/60 space-y-1">
                    <span className="text-[10px] font-sans font-semibold text-muted-foreground block">Evaluated Specific Volume:</span>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      {currentValues.useStandardS
                        ? `${specificVol.toFixed(4)} ${isSI ? "m³/kg" : "ft³/lb"} (Locked baseline)`
                        : isSI
                          ? `0.1269 + (0.000513 × ${tempVal.toFixed(1)}°C) = ${specificVol.toFixed(4)} m³/kg`
                          : `1.885 + (0.0046 × ${tempVal.toFixed(1)}°F) = ${specificVol.toFixed(4)} ft³/lb`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Volumetric Expansion Ratio (C / (100 - C)) */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded-full bg-primary text-primary-foreground font-black text-[10.5px] flex items-center justify-center">3</span>
                    <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px]">
                      Volumetric Expansion &amp; Displacement Ratio
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/70 text-muted-foreground">
                    Design Concentration C = {concVal.toFixed(3)}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div className="p-2.5 bg-surface-2/60 rounded-lg border border-border/60 space-y-1">
                    <span className="text-[10px] font-sans font-semibold text-muted-foreground block">Expansion Ratio Term:</span>
                    <div className="text-primary font-bold text-xs">
                      Factor = C / (100 - C)
                    </div>
                    <span className="text-[10px] text-muted-foreground font-sans block">
                      Accounts for room air volume displaced during rapid flooding.
                    </span>
                  </div>

                  <div className="p-2.5 bg-surface-2/60 rounded-lg border border-border/60 space-y-1">
                    <span className="text-[10px] font-sans font-semibold text-muted-foreground block">Evaluated Expansion Factor:</span>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      {concVal.toFixed(3)} / (100 - {concVal.toFixed(3)}) = {concTerm.toFixed(6)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4: Total Agent Weight Calculation */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded-full bg-primary text-primary-foreground font-black text-[10.5px] flex items-center justify-center">4</span>
                    <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px]">
                      Required Clean Agent Weight (W = (V / S) × [C / (100 - C)] × SF)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">
                    Governing Result
                  </span>
                </div>

                <div className="p-3 bg-card rounded-lg border border-border/80 font-mono space-y-2 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">1. Volume-to-Specific-Volume Ratio (V / S):</span>
                    <strong className="text-foreground">
                      {netVolume.toFixed(2)} / {specificVol.toFixed(4)} = {(specificVol > 0 ? netVolume / specificVol : 0).toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">2. Concentration Displacement Factor [C / (100 - C)]:</span>
                    <strong className="text-foreground">&times; {concTerm.toFixed(6)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">3. Safety Multiplier (SF):</span>
                    <strong className="text-foreground">&times; {safetyFactorVal.toFixed(2)}</strong>
                  </div>
                  <div className="pt-2 border-t border-border flex justify-between items-baseline">
                    <span className="font-sans font-bold text-foreground text-xs uppercase">4. Sized Flooding Weight (W):</span>
                    <span className="text-base font-black text-primary font-mono">
                      {totalWeight.toFixed(2)} {isSI ? "kg" : "lb"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 5: Discharge Dynamics & Flow Logistics */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded-full bg-primary text-primary-foreground font-black text-[10.5px] flex items-center justify-center">5</span>
                    <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px]">
                      Discharge Time, Flow Rate &amp; Enclosure Integrity Criteria
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/70 text-muted-foreground">
                    NFPA 2001 Cl. 5.7
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-[11px]">
                  <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border/60 space-y-1">
                    <span className="text-[10px] font-sans font-semibold text-muted-foreground block">Max Discharge Time:</span>
                    <strong className="text-foreground text-xs font-bold block">10.0 Seconds</strong>
                    <span className="text-[10px] text-muted-foreground font-sans block">Mandatory rapid discharge to limit HF acid decomposition.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border/60 space-y-1">
                    <span className="text-[10px] font-sans font-semibold text-muted-foreground block">Average Mass Flow Rate:</span>
                    <strong className="text-primary text-xs font-bold block">
                      {avgDischargeRate.toFixed(2)} {isSI ? "kg/s" : "lb/s"}
                    </strong>
                    <span className="text-[10px] text-muted-foreground font-sans block">Required nozzle network throughput capability.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border/60 space-y-1">
                    <span className="text-[10px] font-sans font-semibold text-muted-foreground block">Target Hold Time:</span>
                    <strong className="text-foreground text-xs font-bold block">10.0 Minutes</strong>
                    <span className="text-[10px] text-muted-foreground font-sans block">Enclosure integrity hold time target per door fan test.</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: GOVERNING FORMULATIONS */}
          {activeTab === "formulas" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Formula 1: NFPA 2001 Flooding Mass Equation */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px] flex items-center gap-1.5">
                    <Flame className="size-3.5 text-primary" /> 1. NFPA 2001 Total Flooding Mass Equation (Clause 5.5.1)
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    NFPA 2001 Standard
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  The clean agent flooding weight required to establish the design concentration in an enclosed volume:
                </p>
                <div className="p-3 bg-surface-2 rounded-lg font-mono border border-border/80 text-primary font-bold text-xs space-y-2">
                  <div>W = (V / S) &times; [ C / (100 - C) ] &times; SafetyFactor</div>
                  <div className="text-[10.5px] text-muted-foreground font-normal space-y-0.5">
                    <div>• <strong>W</strong> = Total weight of clean agent (kg or lb)</div>
                    <div>• <strong>V</strong> = Net volume of protected hazard enclosure (m³ or ft³)</div>
                    <div>• <strong>S</strong> = Specific vapor volume of superheated clean agent at minimum expected temperature (m³/kg or ft³/lb)</div>
                    <div>• <strong>C</strong> = Design volumetric extinguishing concentration (vol %)</div>
                    <div>• <strong>SafetyFactor</strong> = Additional engineering safety margin (typically 1.00x – 1.20x)</div>
                  </div>
                </div>
              </div>

              {/* Formula 2: Specific Vapor Volume Equation */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px] flex items-center gap-1.5">
                    <Wind className="size-3.5 text-primary" /> 2. HFC-227ea Specific Vapor Volume Polynomial (S(T))
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    ISO 14520 / NFPA 2001
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Vapor volume per unit mass varies linearly with ambient enclosure temperature according to superheated vapor state properties:
                </p>
                <div className="p-3 bg-surface-2 rounded-lg font-mono border border-border/80 space-y-2">
                  <div className="text-primary font-bold text-xs">
                    <div>SI Units: S = 0.1269 + (0.000513 &times; T_°C)  [m³/kg]</div>
                    <div>IP Units: S = 1.885 + (0.0046 &times; T_°F)      [ft³/lb]</div>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground leading-relaxed pt-1 border-t border-border/60 font-sans">
                    The constants <strong>k₁</strong> (0.1269 / 1.885) and <strong>k₂</strong> (0.000513 / 0.0046) are derived from the molecular weight of HFC-227ea (170.03 g/mol) and ideal gas law behavior at standard atmospheric pressure (101.325 kPa / 14.696 psia).
                  </div>
                </div>
              </div>

              {/* Formula 3: Discharge Flow Rate & Rapid Flooding */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px] flex items-center gap-1.5">
                    <Activity className="size-3.5 text-primary" /> 3. Discharge Rate &amp; Nozzle Delivery Dynamics
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    NFPA 2001 Cl. 5.7.1.2
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Clean agent gaseous systems must discharge 95% of the total design mass within 10 seconds to suppress fires rapidly and minimize hydrogen fluoride (HF) toxic pyrolysis:
                </p>
                <div className="p-3 bg-surface-2 rounded-lg font-mono border border-border/80 text-primary font-bold text-xs space-y-1">
                  <div>m_dot_avg = W / t_discharge = W / 10.0 s</div>
                  <div className="text-[10.5px] text-muted-foreground font-normal">
                    Discharge pressure at nozzle tips must remain above 5.0 bar (72.5 psig) to guarantee rapid atomization and vapor distribution.
                  </div>
                </div>
              </div>

              {/* Formula 4: Overpressure Relief Venting */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px] flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-primary" /> 4. Enclosure Overpressure Relief Vent Area (A_vent)
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    FIA / NFPA Annex
                  </span>
                </div>
                <div className="p-3 bg-surface-2 rounded-lg font-mono border border-border/80 text-primary font-bold text-xs space-y-1">
                  <div>A_vent = Q_peak / [ C_d &times; &radic;( 2 &times; &Delta;P_max / &rho;_air ) ]</div>
                  <div className="text-[10.5px] text-muted-foreground font-normal">
                    Prevents structural drywall or ceiling blowout during the initial 5-second rapid gas release phase.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STANDARDS & SAFETY LIMITS */}
          {activeTab === "standards" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* NOAEL / LOAEL Table */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px] flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-emerald-600" /> Human Toxicity &amp; Exposure Limits (NOAEL / LOAEL)
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    EPA SNAP / NFPA 2001 Table 1.5.1.2.1
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-foreground font-bold">
                        <th className="p-2 font-sans">Safety Threshold</th>
                        <th className="p-2">Concentration</th>
                        <th className="p-2 font-sans">Human Exposure Limitation</th>
                        <th className="p-2 font-sans">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      <tr className="bg-emerald-500/5">
                        <td className="p-2 font-sans font-bold text-emerald-700 dark:text-emerald-300">NOAEL (No Observed Adverse Effect)</td>
                        <td className="p-2 font-bold text-emerald-700 dark:text-emerald-300">9.0%</td>
                        <td className="p-2 font-sans text-muted-foreground">Safe for normally occupied spaces; human exposure permitted up to 5 minutes.</td>
                        <td className="p-2 font-sans font-bold text-emerald-600">
                          {concVal <= 9.0 ? "Pass (Compliant)" : "Exceeded"}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-semibold text-amber-700 dark:text-amber-300">LOAEL (Lowest Observed Adverse Effect)</td>
                        <td className="p-2 font-bold text-amber-700 dark:text-amber-300">10.5%</td>
                        <td className="p-2 font-sans text-muted-foreground">Maximum limit for spaces with rapid evacuation; exposure limited to 30 seconds.</td>
                        <td className="p-2 font-sans font-bold text-amber-600">
                          {concVal <= 10.5 ? "Within Limit" : "Exceeded"}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-semibold text-rose-700 dark:text-rose-300">Lethal Concentration (LC50)</td>
                        <td className="p-2 font-bold text-rose-700 dark:text-rose-300">&gt; 80.0%</td>
                        <td className="p-2 font-sans text-muted-foreground">Acute inhalation toxicity threshold (extremely high safety margin).</td>
                        <td className="p-2 font-sans font-bold text-emerald-600">Safe</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Hazard Classification Design Concentrations */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <span className="font-bold text-foreground uppercase tracking-wide text-[11.5px] flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-primary" /> NFPA 2001 Hazard Design Concentrations
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    Minimum Sizing Requirements
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                    <strong className="text-blue-700 dark:text-blue-300 block font-bold">Class A: Surface Fire</strong>
                    <span className="font-mono text-xs font-bold block text-foreground">6.857% – 7.00%</span>
                    <p className="text-[10px] text-muted-foreground leading-tight">Server rooms, Data Centers, Control Rooms, Telecommunications.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 space-y-1">
                    <strong className="text-orange-700 dark:text-orange-300 block font-bold">Class B: Flammable Liquids</strong>
                    <span className="font-mono text-xs font-bold block text-foreground">8.70% – 9.00%</span>
                    <p className="text-[10px] text-muted-foreground leading-tight">Diesel generator rooms, oil storage, paint spray booths.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                    <strong className="text-emerald-700 dark:text-emerald-300 block font-bold">Class C: Electrical</strong>
                    <span className="font-mono text-xs font-bold block text-foreground">7.00% (Minimum)</span>
                    <p className="text-[10px] text-muted-foreground leading-tight">Substations, switchgear rooms, UPS and transformer vaults.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/80 bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Copied to clipboard" : "Copy Full Calculation Trace"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
