import React, { useState, useEffect } from "react";
import {
  X, Check, Calculator, BookOpen, Layers, Flame, Thermometer,
  Building2, Sparkles, Copy, ShieldCheck, ArrowRight, Info, CheckCircle2,
  SlidersHorizontal, Wind, Activity
} from "lucide-react";
import { toast } from "sonner";
import { HEATING_PRESETS, type HeatingPresetKey } from "@/lib/calc-heating-load";

interface HeatingLoadFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitSystem: "ip" | "si";
  currentValues: {
    area: number | "";
    height: number | "";
    uWall: number | "";
    uRoof: number | "";
    uGlaz: number | "";
    glazArea: number | "";
    oat: number | "";
    iat: number | "";
    ach: number | "";
    ventCfm: number | "";
    safetyMargin: number | "";
    preset?: HeatingPresetKey;
    customProfileName?: string;
  };
  calcResults: {
    qWall: number;
    qRoof: number;
    qGlaz: number;
    qSlab: number;
    qInfil: number;
    qVent: number;
    qBase: number;
    qTotal: number;
    kwWall: number;
    kwRoof: number;
    kwGlaz: number;
    kwSlab: number;
    kwInfil: number;
    kwVent: number;
    kwBase: number;
    kwTotal: number;
    pctWall: number;
    pctRoof: number;
    pctGlaz: number;
    pctSlab: number;
    pctInfil: number;
    pctVent: number;
  };
}

const SQFT_TO_SQM = 0.092903;
const FT_TO_M = 0.3048;
const U_IP_TO_SI = 5.678263;
const CFM_TO_LPS = 0.471947;

export function HeatingLoadFormulaModal({
  isOpen,
  onClose,
  unitSystem,
  currentValues,
  calcResults,
}: HeatingLoadFormulaModalProps) {
  const [activeTab, setActiveTab] = useState<"trace" | "formulas" | "variables">("trace");
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
  const ip = !isSI;

  // Numeric Values
  const areaIP = Number(currentValues.area) || 5000;
  const heightIP = Number(currentValues.height) || 10;
  const uWallIP = Number(currentValues.uWall) || 0.065;
  const uRoofIP = Number(currentValues.uRoof) || 0.035;
  const uGlazIP = Number(currentValues.uGlaz) || 0.32;
  const glazAreaIP = Number(currentValues.glazArea) || 600;
  const oatIP = Number(currentValues.oat) || 20;
  const iatIP = Number(currentValues.iat) || 70;
  const ach = Number(currentValues.ach) || 0.35;
  const ventCfmIP = Number(currentValues.ventCfm) || 450;
  const safetyMargin = Number(currentValues.safetyMargin) || 15;

  // Geometry derivations
  const sideLengthFt = Math.sqrt(areaIP);
  const perimeterFt = sideLengthFt * 4;
  const grossWallAreaFt2 = perimeterFt * heightIP;
  const netWallAreaFt2 = Math.max(0, grossWallAreaFt2 - glazAreaIP);
  const volumeFt3 = areaIP * heightIP;
  const wwrPct = grossWallAreaFt2 > 0 ? (glazAreaIP / grossWallAreaFt2) * 100 : 0;
  const infilCfm = (volumeFt3 * ach) / 60;

  // Temperature Deltas
  const deltaTF = Math.max(0, iatIP - oatIP);
  const oatC = (oatIP - 32) / 1.8;
  const iatC = (iatIP - 32) / 1.8;
  const deltaTC = deltaTF / 1.8;

  // Metric Converted Equivalents
  const areaM2 = areaIP * SQFT_TO_SQM;
  const heightM = heightIP * FT_TO_M;
  const perimeterM = perimeterFt * FT_TO_M;
  const netWallM2 = netWallAreaFt2 * SQFT_TO_SQM;
  const glazAreaM2 = glazAreaIP * SQFT_TO_SQM;
  const uWallSI = uWallIP * U_IP_TO_SI;
  const uRoofSI = uRoofIP * U_IP_TO_SI;
  const uGlazSI = uGlazIP * U_IP_TO_SI;
  const infilLps = infilCfm * CFM_TO_LPS;
  const ventLps = ventCfmIP * CFM_TO_LPS;

  // Intensity load
  const intensityBtuSqft = areaIP > 0 ? calcResults.qTotal / areaIP : 0;
  const intensityWm2 = areaM2 > 0 ? (calcResults.kwTotal * 1000) / areaM2 : 0;

  const handleCopySummary = () => {
    const text = `=== HEATING LOAD CALCULATION BREAKDOWN ===
Governing Standards: ASHRAE Fundamentals (Ch. 18 Heat Loss) & CIBSE Guide A
Unit System: ${isSI ? "SI Metric (m², °C, kW)" : "IP Imperial (sq ft, °F, BTU/hr)"}
Active Profile: ${currentValues.customProfileName || (currentValues.preset ? HEATING_PRESETS[currentValues.preset]?.label : "Custom Configuration")}

--- 1. ACTIVE DESIGN PARAMETERS ---
• Indoor Setpoint (IAT): ${isSI ? `${iatC.toFixed(1)} °C` : `${iatIP.toFixed(1)} °F`}
• Outdoor Design Temp (OAT): ${isSI ? `${oatC.toFixed(1)} °C` : `${oatIP.toFixed(1)} °F`} (ΔT = ${isSI ? `${deltaTC.toFixed(1)} °C` : `${deltaTF.toFixed(1)} °F`})
• Floor Area: ${isSI ? `${areaM2.toFixed(1)} m²` : `${areaIP.toFixed(0)} ft²`} | Height: ${isSI ? `${heightM.toFixed(2)} m` : `${heightIP.toFixed(1)} ft`}
• Net Wall Area: ${isSI ? `${netWallM2.toFixed(1)} m²` : `${netWallAreaFt2.toFixed(0)} ft²`} | Glazing: ${isSI ? `${glazAreaM2.toFixed(1)} m²` : `${glazAreaIP.toFixed(0)} ft²`} (WWR: ${wwrPct.toFixed(1)}%)
• Wall U-Value: ${isSI ? `${uWallSI.toFixed(2)} W/m²K` : `${uWallIP.toFixed(3)} BTU/hr·ft²·°F`}
• Roof U-Value: ${isSI ? `${uRoofSI.toFixed(2)} W/m²K` : `${uRoofIP.toFixed(3)} BTU/hr·ft²·°F`}
• Glazing U-Value: ${isSI ? `${uGlazSI.toFixed(2)} W/m²K` : `${uGlazIP.toFixed(2)} BTU/hr·ft²·°F`}

--- 2. STEP-BY-STEP HEAT LOSS DERIVATION ---
[1] Opaque Wall Conduction:
    Q_wall = U × A × ΔT = ${isSI ? `${calcResults.kwWall.toFixed(2)} kW` : `${Math.round(calcResults.qWall).toLocaleString()} BTU/hr`} (${calcResults.pctWall.toFixed(1)}%)

[2] Roof Conduction:
    Q_roof = U × A × ΔT = ${isSI ? `${calcResults.kwRoof.toFixed(2)} kW` : `${Math.round(calcResults.qRoof).toLocaleString()} BTU/hr`} (${calcResults.pctRoof.toFixed(1)}%)

[3] Glazing Conduction:
    Q_glaz = U × A × ΔT = ${isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/hr`} (${calcResults.pctGlaz.toFixed(1)}%)

[4] Slab-on-Grade Perimeter:
    Q_slab = F_p × P × ΔT = ${isSI ? `${calcResults.kwSlab.toFixed(2)} kW` : `${Math.round(calcResults.qSlab).toLocaleString()} BTU/hr`} (${calcResults.pctSlab.toFixed(1)}%)

[5] Infiltration Sensible Loss:
    Q_infil = 1.08 × CFM × ΔT = ${isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/hr`} (${calcResults.pctInfil.toFixed(1)}%)

[6] Mechanical Fresh Air Vent:
    Q_vent = 1.08 × CFM × ΔT = ${isSI ? `${calcResults.kwVent.toFixed(2)} kW` : `${Math.round(calcResults.qVent).toLocaleString()} BTU/hr`} (${calcResults.pctVent.toFixed(1)}%)

--- 3. SIZED PLANT DUTY ---
• Steady-State Base Loss (Q_base): ${isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr`}
• Warm-Up Margin (+${safetyMargin}%): ${(calcResults.kwTotal - calcResults.kwBase).toFixed(2)} kW / ${Math.round(calcResults.qTotal - calcResults.qBase).toLocaleString()} BTU/hr
• TOTAL SIZED PLANT DUTY: ${isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr`}
• Specific Heating Intensity: ${isSI ? `${intensityWm2.toFixed(1)} W/m²` : `${intensityBtuSqft.toFixed(1)} BTU/hr·ft²`}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Heating load formula breakdown copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150 select-none font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[86vh] flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Fresh Air Cooling Load standard */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Calculator className="size-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-[13px] font-bold text-foreground truncate">
                Heating Load Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              ASHRAE Ch. 18 / CIBSE
            </span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] font-mono font-medium shrink-0">
              {ip ? "IP" : "SI"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close modal (Esc)"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/10 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setActiveTab("trace")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "trace"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Activity className="size-3" />
            <span>Calculation Steps</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("formulas")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "formulas"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <BookOpen className="size-3" />
            <span>Master Formulas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("variables")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "variables"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Layers className="size-3" />
            <span>Variables Reference</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {/* TAB 1: CALCULATION TRACE */}
          {activeTab === "trace" && (
            <div className="space-y-2.5">
              {/* Compact Active Design Conditions */}
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider pb-1.5 mb-1.5 border-b border-border/60">
                  <span className="flex items-center gap-1 text-foreground">
                    <SlidersHorizontal className="size-3 text-primary" /> Active Design Parameters
                  </span>
                  <span className="font-mono text-primary normal-case font-bold">
                    {isSI ? `${areaM2.toFixed(1)} m²` : `${areaIP.toLocaleString()} sq ft`} | ΔT: {isSI ? `${deltaTC.toFixed(1)} °C` : `${deltaTF.toFixed(1)} °F`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Climatic Design (IAT / OAT)</span>
                    <span className="font-mono font-bold text-foreground">
                      {isSI ? `${iatC.toFixed(1)}° / ${oatC.toFixed(1)}° C` : `${iatIP.toFixed(0)}° / ${oatIP.toFixed(0)}° F`}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">(ΔT: {isSI ? `${deltaTC.toFixed(1)}K` : `${deltaTF.toFixed(0)}°F`})</span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Envelope &amp; Ventilation</span>
                    <span className="font-mono font-bold text-foreground">
                      {isSI ? `${uWallSI.toFixed(2)} / ${uRoofSI.toFixed(2)} U` : `${uWallIP.toFixed(3)} / ${uRoofIP.toFixed(3)} U`}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">({isSI ? `${ventLps.toFixed(0)} L/s` : `${ventCfmIP.toFixed(0)} CFM`})</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: OPAQUE WALL CONDUCTION */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Opaque Exterior Walls Conduction (Q_wall)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {isSI ? `${calcResults.kwWall.toFixed(2)} kW` : `${Math.round(calcResults.qWall).toLocaleString()} BTU/h`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_wall = U_wall × A_net_wall × ΔT</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">
                      {isSI
                        ? `${uWallSI.toFixed(2)} W/m²K × ${netWallM2.toFixed(1)} m² × ${deltaTC.toFixed(1)} K`
                        : `${uWallIP.toFixed(3)} × ${netWallAreaFt2.toFixed(0)} ft² × ${deltaTF.toFixed(1)}°F`}
                    </span>
                    <span className="text-primary font-bold">
                      = {isSI ? `${calcResults.kwWall.toFixed(2)} kW` : `${Math.round(calcResults.qWall).toLocaleString()} BTU/h`} ({calcResults.pctWall.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 2: ROOF CONDUCTION */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Roof / Ceiling Assembly Conduction (Q_roof)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {isSI ? `${calcResults.kwRoof.toFixed(2)} kW` : `${Math.round(calcResults.qRoof).toLocaleString()} BTU/h`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_roof = U_roof × A_roof × ΔT</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">
                      {isSI
                        ? `${uRoofSI.toFixed(2)} W/m²K × ${areaM2.toFixed(1)} m² × ${deltaTC.toFixed(1)} K`
                        : `${uRoofIP.toFixed(3)} × ${areaIP.toFixed(0)} ft² × ${deltaTF.toFixed(1)}°F`}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                      = {isSI ? `${calcResults.kwRoof.toFixed(2)} kW` : `${Math.round(calcResults.qRoof).toLocaleString()} BTU/h`} ({calcResults.pctRoof.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 3: FENESTRATION / GLAZING */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Fenestration / Glazing Conduction (Q_glaz)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/h`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_glaz = U_glaz × A_glaz × ΔT (WWR: {wwrPct.toFixed(1)}%)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">
                      {isSI
                        ? `${uGlazSI.toFixed(2)} W/m²K × ${glazAreaM2.toFixed(1)} m² × ${deltaTC.toFixed(1)} K`
                        : `${uGlazIP.toFixed(2)} × ${glazAreaIP.toFixed(0)} ft² × ${deltaTF.toFixed(1)}°F`}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      = {isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/h`} ({calcResults.pctGlaz.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 4: SLAB-ON-GRADE */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Slab-on-Grade Perimeter Loss (Q_slab)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {isSI ? `${calcResults.kwSlab.toFixed(2)} kW` : `${Math.round(calcResults.qSlab).toLocaleString()} BTU/h`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_slab = F_p × Perimeter × ΔT (F_p = {isSI ? "0.865 W/mK" : "0.50 BTU/hr·ft·°F"})</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">
                      {isSI
                        ? `0.865 × ${perimeterM.toFixed(1)} m × ${deltaTC.toFixed(1)} K`
                        : `0.50 × ${perimeterFt.toFixed(1)} ft × ${deltaTF.toFixed(1)}°F`}
                    </span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">
                      = {isSI ? `${calcResults.kwSlab.toFixed(2)} kW` : `${Math.round(calcResults.qSlab).toLocaleString()} BTU/h`} ({calcResults.pctSlab.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 5: INFILTRATION SENSIBLE LOSS */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      5
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Building Air Infiltration Loss (Q_infil)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/h`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">
                    Formula: {isSI ? "Q_infil = 1.21 × L/s × ΔT" : "Q_infil = 1.08 × CFM × ΔT"} ({ach.toFixed(2)} ACH)
                  </div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">
                      {isSI
                        ? `1.21 × ${infilLps.toFixed(1)} L/s × ${deltaTC.toFixed(1)} K`
                        : `1.08 × ${infilCfm.toFixed(0)} CFM × ${deltaTF.toFixed(1)}°F`}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      = {isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/h`} ({calcResults.pctInfil.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 6: MECHANICAL VENTILATION */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      6
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Fresh Air Mechanical Vent (Q_vent)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                    {isSI ? `${calcResults.kwVent.toFixed(2)} kW` : `${Math.round(calcResults.qVent).toLocaleString()} BTU/h`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">
                    Formula: {isSI ? "Q_vent = 1.21 × L/s × ΔT" : "Q_vent = 1.08 × CFM × ΔT"}
                  </div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">
                      {isSI
                        ? `1.21 × ${ventLps.toFixed(1)} L/s × ${deltaTC.toFixed(1)} K`
                        : `1.08 × ${ventCfmIP.toFixed(0)} CFM × ${deltaTF.toFixed(1)}°F`}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                      = {isSI ? `${calcResults.kwVent.toFixed(2)} kW` : `${Math.round(calcResults.qVent).toLocaleString()} BTU/h`} ({calcResults.pctVent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 7: TOTAL SIZED DUTY */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      7
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Total Sized Boiler / Plant Duty (Q_total)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                    {isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/h`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_total = Q_base × (1 + SafetyMargin%)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">
                      {isSI ? `${calcResults.kwBase.toFixed(2)} kW with +${safetyMargin}%` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/h with +${safetyMargin}%`}
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      = {isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sizing Outcome Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">Total Sized Plant Duty</div>
                  <div className="text-[11.5px] font-bold text-foreground mt-0.5">
                    {isSI ? `${calcResults.kwTotal.toFixed(2)} kW (${Math.round(calcResults.qTotal).toLocaleString()} BTU/h)` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr (${calcResults.kwTotal.toFixed(2)} kW)`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-primary leading-tight">
                    {isSI ? `${intensityWm2.toFixed(1)}` : `${intensityBtuSqft.toFixed(1)}`} <span className="text-xs font-normal">{isSI ? "W/m²" : "BTU/h·ft²"}</span>
                  </div>
                  <div className="text-[9.5px] text-muted-foreground font-mono">+{safetyMargin}% Warm-Up Margin</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" /> Envelope Thermal Transmittance (Fourier's Conduction Law)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Q_envelope = Σ [ U_i × A_i × (T_indoor - T_outdoor) ]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Where U_i = thermal transmittance (W/m²·K or BTU/hr·ft²·°F), A_i = net surface area (m² or ft²), and ΔT = design thermal differential.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-blue-500" /> Air Sensible Heating Equation &amp; Constants
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>SI: Q_sens = 1.21 × L/s × ΔT [Watts]</div>
                  <div>IP: Q_sens = 1.08 × CFM × ΔT [BTU/h]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Constants 1.08 in IP and 1.21 in SI account for standard dry air density (ρ = 0.075 lb/ft³ / 1.204 kg/m³) and specific heat (c_p = 0.24 BTU/lb·°F / 1.005 kJ/kg·K).
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Slab-on-Grade Perimeter Heat Loss (F-Factor Method)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Q_slab = F_p × P_exposed × (T_indoor - T_outdoor)</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Where F_p = slab edge heat loss coefficient (0.50 BTU/hr·ft·°F / 0.865 W/m·K) and P_exposed = linear exposed slab perimeter.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-rose-500" /> Intermittent Heating &amp; Safety Sizing Margin
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>Q_sized = Q_steady_state × [ 1 + (Margin_% / 100) ]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Accounts for morning warm-up recovery after night setback (typically 10%–20%).
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: VARIABLES & CONSTANTS */}
          {activeTab === "variables" && (
            <div className="space-y-2.5">
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <table className="w-full text-left text-[10.5px]">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border font-bold text-foreground">
                      <th className="py-1.5 px-2">Symbol</th>
                      <th className="py-1.5 px-2">Parameter</th>
                      <th className="py-1.5 px-2">SI Standard</th>
                      <th className="py-1.5 px-2">IP Standard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">IAT</td>
                      <td className="py-1.5 px-2 text-foreground">Indoor Air Temperature Setpoint</td>
                      <td className="py-1.5 px-2 font-mono">°C</td>
                      <td className="py-1.5 px-2 font-mono">°F</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">OAT</td>
                      <td className="py-1.5 px-2 text-foreground">Outdoor 99.6% Design Temperature</td>
                      <td className="py-1.5 px-2 font-mono">°C</td>
                      <td className="py-1.5 px-2 font-mono">°F</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ΔT</td>
                      <td className="py-1.5 px-2 text-foreground">Thermal Temperature Differential</td>
                      <td className="py-1.5 px-2 font-mono">K / °C</td>
                      <td className="py-1.5 px-2 font-mono">°F</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">U_wall</td>
                      <td className="py-1.5 px-2 text-foreground">Opaque Wall U-Value</td>
                      <td className="py-1.5 px-2 font-mono">W/m²·K</td>
                      <td className="py-1.5 px-2 font-mono">BTU/hr·ft²·°F</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">U_roof</td>
                      <td className="py-1.5 px-2 text-foreground">Roof / Ceiling U-Value</td>
                      <td className="py-1.5 px-2 font-mono">W/m²·K</td>
                      <td className="py-1.5 px-2 font-mono">BTU/hr·ft²·°F</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">U_glaz</td>
                      <td className="py-1.5 px-2 text-foreground">Fenestration / Glazing U-Value</td>
                      <td className="py-1.5 px-2 font-mono">W/m²·K</td>
                      <td className="py-1.5 px-2 font-mono">BTU/hr·ft²·°F</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">F_p</td>
                      <td className="py-1.5 px-2 text-foreground">Slab Edge F-Factor</td>
                      <td className="py-1.5 px-2 font-mono">W/m·K</td>
                      <td className="py-1.5 px-2 font-mono">BTU/hr·ft·°F</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ACH</td>
                      <td className="py-1.5 px-2 text-foreground">Air Changes per Hour (Infiltration)</td>
                      <td className="py-1.5 px-2 font-mono">1/h</td>
                      <td className="py-1.5 px-2 font-mono">1/h</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_base</td>
                      <td className="py-1.5 px-2 text-foreground">Total Steady-State Heat Loss</td>
                      <td className="py-1.5 px-2 font-mono">kW</td>
                      <td className="py-1.5 px-2 font-mono">BTU/h</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q_total</td>
                      <td className="py-1.5 px-2 text-foreground">Total Sized Boiler / Plant Duty</td>
                      <td className="py-1.5 px-2 font-mono">kW</td>
                      <td className="py-1.5 px-2 font-mono">BTU/h</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-muted border border-border/70 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-primary text-primary-foreground text-[11.5px] font-semibold px-4 py-1.5 rounded-lg hover:bg-primary/90 transition shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
