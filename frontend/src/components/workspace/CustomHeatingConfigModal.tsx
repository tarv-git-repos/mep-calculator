import React, { useState, useEffect } from "react";
import {
  X, Check, SlidersHorizontal, Building2, Flame, Thermometer,
  Layers, RotateCcw, Sparkles, ShieldAlert, ArrowRight, Info
} from "lucide-react";
import { HEATING_PRESETS, type HeatingPresetKey } from "@/routes/heating-load";
import { toast } from "sonner";

interface CustomHeatingConfigModalProps {
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
    customProfileName?: string;
    customWorkflow?: "calculate" | "direct";
  };
  onApply: (updated: {
    area: number;
    height: number;
    uWall: number;
    uRoof: number;
    uGlaz: number;
    glazArea: number;
    oat: number;
    iat: number;
    ach: number;
    ventCfm: number;
    safetyMargin: number;
    customProfileName: string;
    customWorkflow: "calculate" | "direct";
  }) => void;
}

const SQFT_TO_SQM = 0.092903;
const SQM_TO_SQFT = 10.7639;
const FT_TO_M = 0.3048;
const M_TO_FT = 3.28084;
const U_IP_TO_SI = 5.678263;
const U_SI_TO_IP = 0.17611;
const CFM_TO_LPS = 0.471947;
const LPS_TO_CFM = 2.11888;
const BTU_HR_TO_KW = 0.000293071;

export function CustomHeatingConfigModal({
  isOpen,
  onClose,
  unitSystem,
  currentValues,
  onApply,
}: CustomHeatingConfigModalProps) {
  const isSI = unitSystem === "si";

  // Form State (Internal IP Storage)
  const [profileName, setProfileName] = useState(
    currentValues.customProfileName || "Custom Profile"
  );
  const [workflow, setWorkflow] = useState<"calculate" | "direct">(
    currentValues.customWorkflow || "calculate"
  );
  const [area, setArea] = useState<number>(Number(currentValues.area) || 5000);
  const [height, setHeight] = useState<number>(Number(currentValues.height) || 10);
  const [uWall, setUWall] = useState<number>(Number(currentValues.uWall) || 0.065);
  const [uRoof, setURoof] = useState<number>(Number(currentValues.uRoof) || 0.035);
  const [uGlaz, setUGlaz] = useState<number>(Number(currentValues.uGlaz) || 0.32);
  const [glazArea, setGlazArea] = useState<number>(Number(currentValues.glazArea) || 600);
  const [oat, setOat] = useState<number>(Number(currentValues.oat) || 20);
  const [iat, setIat] = useState<number>(Number(currentValues.iat) || 70);
  const [ach, setAch] = useState<number>(Number(currentValues.ach) || 0.35);
  const [ventCfm, setVentCfm] = useState<number>(Number(currentValues.ventCfm) || 450);
  const [safetyMargin, setSafetyMargin] = useState<number>(Number(currentValues.safetyMargin) || 15);

  // Sync with prop updates
  useEffect(() => {
    if (isOpen) {
      setProfileName(currentValues.customProfileName || "Custom Profile");
      setWorkflow(currentValues.customWorkflow || "calculate");
      setArea(Number(currentValues.area) || 5000);
      setHeight(Number(currentValues.height) || 10);
      setUWall(Number(currentValues.uWall) || 0.065);
      setURoof(Number(currentValues.uRoof) || 0.035);
      setUGlaz(Number(currentValues.uGlaz) || 0.32);
      setGlazArea(Number(currentValues.glazArea) || 600);
      setOat(Number(currentValues.oat) || 20);
      setIat(Number(currentValues.iat) || 70);
      setAch(Number(currentValues.ach) || 0.35);
      setVentCfm(Number(currentValues.ventCfm) || 450);
      setSafetyMargin(Number(currentValues.safetyMargin) || 15);
    }
  }, [isOpen, currentValues]);

  if (!isOpen) return null;

  // Clone from baseline archetype
  const handleCloneFromPreset = (key: HeatingPresetKey) => {
    const p = HEATING_PRESETS[key];
    if (p) {
      setArea(p.area);
      setHeight(p.height);
      setUWall(p.uWall);
      setURoof(p.uRoof);
      setUGlaz(p.uGlaz);
      setGlazArea(p.glazArea);
      setOat(p.oat);
      setIat(p.iat);
      setAch(p.ach);
      setVentCfm(p.ventCfm);
      setSafetyMargin(p.safetyMargin);
      setProfileName(`${p.label} (Custom)`);
      toast.info(`Cloned baseline criteria from ${p.label}`);
    }
  };

  // Quick live calculated heat loss preview
  const deltaTF = Math.max(0, iat - oat);
  const deltaTC = deltaTF / 1.8;
  const sideLength = Math.sqrt(area);
  const perimeterFt = sideLength * 4;
  const grossWallAreaFt2 = perimeterFt * height;
  const netWallAreaFt2 = Math.max(0, grossWallAreaFt2 - glazArea);
  const volumeFt3 = area * height;
  const qWall = uWall * netWallAreaFt2 * deltaTF;
  const qRoof = uRoof * area * deltaTF;
  const qGlaz = uGlaz * glazArea * deltaTF;
  const qSlab = 0.5 * perimeterFt * deltaTF;
  const infilCfm = (volumeFt3 * ach) / 60;
  const qInfil = 1.08 * infilCfm * deltaTF;
  const qVent = 1.08 * ventCfm * deltaTF;
  const qBase = qWall + qRoof + qGlaz + qSlab + qInfil + qVent;
  const qTotal = qBase * (1 + safetyMargin / 100);
  const kwTotal = qTotal * BTU_HR_TO_KW;
  const wwrPct = grossWallAreaFt2 > 0 ? (glazArea / grossWallAreaFt2) * 100 : 0;

  const handleSave = () => {
    let cleanName = profileName.trim() || "Custom Configuration";
    if (!cleanName.endsWith(" (Custom)")) {
      cleanName = `${cleanName} (Custom)`;
    }

    onApply({
      area,
      height,
      uWall,
      uRoof,
      uGlaz,
      glazArea,
      oat,
      iat,
      ach,
      ventCfm,
      safetyMargin,
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
                <span>Custom Heating Profile Configuration</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase">
                  Ventilation Standard
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Customize building geometry, envelope thermal resistance, and ventilation parameters.
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
                  placeholder="e.g. Data Center / Cleanroom"
                  className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Clone Baseline Archetype</span>
                  <span className="text-[10px] text-muted-foreground">1-Click Preset</span>
                </label>
                <select
                  onChange={(e) => handleCloneFromPreset(e.target.value as HeatingPresetKey)}
                  className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-primary cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>Select baseline archetype to clone...</option>
                  <option value="commercial_office">Commercial Office (5,000 ft²)</option>
                  <option value="residential_house">Residential Home / Villa (2,500 ft²)</option>
                  <option value="educational_school">School / Classrooms (8,000 ft²)</option>
                  <option value="healthcare_clinic">Healthcare Clinic (4,000 ft²)</option>
                  <option value="retail_showroom">Retail Showroom (6,000 ft²)</option>
                  <option value="warehouse_storage">Warehouse / Storage (15,000 ft²)</option>
                </select>
              </div>
            </div>

            {/* Workflow Method Selection (matching Ventilation custom workflow) */}
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
                  Calculate from U-Values &amp; Airflow
                </button>
                <button
                  type="button"
                  onClick={() => setWorkflow("direct")}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                    workflow === "direct" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Direct Airflow Input
                </button>
              </div>
            </div>
          </div>

          {/* Section 1: Space Geometry */}
          <div className="border border-border/70 rounded-xl p-3.5 bg-card space-y-2.5">
            <h4 className="text-[11.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="size-3.5 text-primary" /> 1. Space Geometry &amp; Glazing Dimensions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  <span>Floor Area</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "m²" : "sq ft"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((area * SQFT_TO_SQM).toFixed(1)) : area}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setArea(isSI ? v * SQM_TO_SQFT : v);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Ceiling Clear Height</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "m" : "ft"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((height * FT_TO_M).toFixed(2)) : height}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setHeight(isSI ? v * M_TO_FT : v);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Total Window Area</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "m²" : "sq ft"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((glazArea * SQFT_TO_SQM).toFixed(1)) : glazArea}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setGlazArea(isSI ? v * SQM_TO_SQFT : v);
                  }}
                  className={inputClass}
                />
                <span className="text-[10px] font-mono text-muted-foreground mt-0.5 block">
                  WWR: {wwrPct.toFixed(1)}% of gross wall
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Envelope U-Values */}
          <div className="border border-border/70 rounded-xl p-3.5 bg-card space-y-2.5">
            <h4 className="text-[11.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" /> 2. Envelope Thermal Conductances (U-Values)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  <span>Wall U-Value</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((uWall * U_IP_TO_SI).toFixed(2)) : uWall}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setUWall(isSI ? v * U_SI_TO_IP : v);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Roof U-Value</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((uRoof * U_IP_TO_SI).toFixed(2)) : uRoof}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setURoof(isSI ? v * U_SI_TO_IP : v);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Glazing U-Value</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((uGlaz * U_IP_TO_SI).toFixed(2)) : uGlaz}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setUGlaz(isSI ? v * U_SI_TO_IP : v);
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Climate & Airflow Criteria */}
          <div className="border border-border/70 rounded-xl p-3.5 bg-card space-y-2.5">
            <h4 className="text-[11.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Thermometer className="size-3.5 text-primary" /> 3. Climatic Temperatures &amp; Ventilation Rates
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>
                  <span>Outdoor Temp</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "°C" : "°F"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number(((oat - 32) / 1.8).toFixed(1)) : oat}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setOat(isSI ? v * 1.8 + 32 : v);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Indoor Setpoint</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "°C" : "°F"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number(((iat - 32) / 1.8).toFixed(1)) : iat}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setIat(isSI ? v * 1.8 + 32 : v);
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Infiltration</span>
                  <span className="font-mono text-muted-foreground">ACH</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={ach}
                  onChange={(e) => setAch(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>Fresh Air Vent</span>
                  <span className="font-mono text-muted-foreground">{isSI ? "L/s" : "CFM"}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={isSI ? Number((ventCfm * CFM_TO_LPS).toFixed(1)) : ventCfm}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setVentCfm(isSI ? v * LPS_TO_CFM : v);
                  }}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Intermittent Safety / Warm-up Margin (%):
              </label>
              <input
                type="number"
                step="any"
                value={safetyMargin}
                onChange={(e) => setSafetyMargin(parseFloat(e.target.value) || 0)}
                className="w-24 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-foreground text-right"
              />
            </div>
          </div>

          {/* Section 4: Live Estimated Heat Loss Summary */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-500/10 via-sky-500/5 to-transparent border border-blue-500/20 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Flame className="size-3.5 text-amber-500" /> Sized Plant Capacity:
              </span>
              <span className="text-[13px] font-extrabold font-mono text-primary">
                {isSI ? `${kwTotal.toFixed(2)} kW` : `${Math.round(qTotal).toLocaleString()} BTU/hr`}
              </span>
            </div>
            <div className="text-[10.5px] font-mono text-muted-foreground text-right">
              <span>ΔT = {isSI ? `${deltaTC.toFixed(1)} °C` : `${deltaTF.toFixed(1)} °F`}</span> • 
              <span className="ml-1">Base Loss = {isSI ? `${(qBase * BTU_HR_TO_KW).toFixed(2)} kW` : `${Math.round(qBase).toLocaleString()} BTU/hr`}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/80 bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={() => handleCloneFromPreset("commercial_office")}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>Reset to Office Baseline</span>
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
