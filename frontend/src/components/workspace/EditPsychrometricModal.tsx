import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  X,
  Info,
  CheckCircle,
  AlertTriangle,
  Droplets,
  Thermometer,
  Gauge,
  Sparkles,
  Activity,
} from "lucide-react";

export type SecondParam = "rh" | "wb" | "dp" | "w";

export interface PsychrometricFormData {
  unitSystem: "ip" | "si";
  dbtInput: number | "";
  secondParam: SecondParam;
  paramValue: number | "";
  atmPressure: number | "";
}

interface EditPsychrometricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PsychrometricFormData) => void;
  currentData: PsychrometricFormData;
  isApprovedLocked?: boolean;
}

// Psychrometric formulations (Hyland-Wexler)
function satP(tK: number): number {
  if (tK >= 273.15) {
    const c8 = -5.8002206e3;
    const c9 = 1.3914993;
    const c10 = -4.864e-2;
    const c11 = 4.1764768e-5;
    const c12 = -1.4452093e-8;
    const c13 = 6.5459673;
    return Math.exp(c8 / tK + c9 + c10 * tK + c11 * Math.pow(tK, 2) + c12 * Math.pow(tK, 3) + c13 * Math.log(tK));
  }
  const c1 = -5.6745359e3;
  const c2 = 6.3925247;
  const c3 = -9.677843e-3;
  const c4 = 6.2215701e-7;
  const c5 = 2.0747825e-9;
  const c6 = -9.484024e-13;
  const c7 = 4.1635019;
  return Math.exp(c1 / tK + c2 + c3 * tK + c4 * Math.pow(tK, 2) + c5 * Math.pow(tK, 3) + c6 * Math.pow(tK, 4) + c7 * Math.log(tK));
}

function wFromRH(tC: number, rh: number, p: number): number {
  const pws = satP(tC + 273.15);
  return (0.621945 * (rh / 100) * pws) / (p - (rh / 100) * pws);
}

function wFromWB(td: number, tw: number, p: number): number {
  const ws = (0.621945 * satP(tw + 273.15)) / (p - satP(tw + 273.15));
  return ((2501 - 2.381 * tw) * ws - 1.006 * (td - tw)) / (2501 + 1.805 * td - 4.186 * tw);
}

function wFromDP(dp: number, p: number): number {
  const pws = satP(dp + 273.15);
  return (0.621945 * pws) / (p - pws);
}

function dewPt(w: number, p: number): number {
  const pw = (w * p) / (0.621945 + w);
  let lo = -60,
    hi = 80;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (satP(m + 273.15) < pw) lo = m;
    else hi = m;
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}

function wetBulb(td: number, w: number, p: number): number {
  let lo = -60,
    hi = td;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (wFromWB(td, m, p) < w) lo = m;
    else hi = m;
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}

function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function EditPsychrometricModal({
  isOpen,
  onClose,
  onSave,
  currentData,
  isApprovedLocked = false,
}: EditPsychrometricModalProps) {
  const [formData, setFormData] = useState<PsychrometricFormData>({ ...currentData });

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...currentData });
    }
  }, [isOpen, currentData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle unit system change inside modal
  const handleUnitToggle = (newUnit: "ip" | "si") => {
    if (newUnit === formData.unitSystem) return;
    const prevUnit = formData.unitSystem;

    let nextDbt = formData.dbtInput;
    let nextVal = formData.paramValue;

    if (newUnit === "si" && prevUnit === "ip") {
      if (nextDbt !== "") nextDbt = parseFloat(fToC(Number(nextDbt)).toFixed(1));
      if (nextVal !== "") {
        if (formData.secondParam === "wb" || formData.secondParam === "dp") {
          nextVal = parseFloat(fToC(Number(nextVal)).toFixed(1));
        } else if (formData.secondParam === "w") {
          nextVal = parseFloat(((Number(nextVal) * 1000) / 7000).toFixed(2));
        }
      }
    } else if (newUnit === "ip" && prevUnit === "si") {
      if (nextDbt !== "") nextDbt = parseFloat(cToF(Number(nextDbt)).toFixed(1));
      if (nextVal !== "") {
        if (formData.secondParam === "wb" || formData.secondParam === "dp") {
          nextVal = parseFloat(cToF(Number(nextVal)).toFixed(1));
        } else if (formData.secondParam === "w") {
          nextVal = parseFloat(((Number(nextVal) * 7000) / 1000).toFixed(2));
        }
      }
    }

    setFormData((prev) => ({
      ...prev,
      unitSystem: newUnit,
      dbtInput: nextDbt,
      paramValue: nextVal,
    }));
  };

  // Live calculation simulation
  const preview = useMemo(() => {
    const { unitSystem, dbtInput, secondParam, paramValue, atmPressure } = formData;
    const ip = unitSystem === "ip";

    const dbtVal = dbtInput !== "" ? Number(dbtInput) : ip ? 95 : 35;
    const dbtC = ip ? fToC(dbtVal) : dbtVal;

    const pKpa = atmPressure !== "" ? Number(atmPressure) : 101.325;
    const pPa = pKpa * 1000;

    let w = 0.01;
    let rh = 50;
    let wbtC = dbtC;
    let dpC = dbtC;

    try {
      if (secondParam === "rh") {
        rh = paramValue !== "" ? Number(paramValue) : 60;
        w = wFromRH(dbtC, rh, pPa);
        dpC = dewPt(w, pPa);
        wbtC = wetBulb(dbtC, w, pPa);
      } else if (secondParam === "wb") {
        const wbInput = paramValue !== "" ? Number(paramValue) : ip ? 78 : 25.5;
        wbtC = ip ? fToC(wbInput) : wbInput;
        w = wFromWB(dbtC, wbtC, pPa);
        dpC = dewPt(w, pPa);
        const pws = satP(dbtC + 273.15);
        const pw = (w * pPa) / (0.621945 + w);
        rh = Math.min(100, Math.max(0, (pw / pws) * 100));
      } else if (secondParam === "dp") {
        const dpInput = paramValue !== "" ? Number(paramValue) : ip ? 72 : 22;
        dpC = ip ? fToC(dpInput) : dpInput;
        w = wFromDP(dpC, pPa);
        wbtC = wetBulb(dbtC, w, pPa);
        const pws = satP(dbtC + 273.15);
        const pw = (w * pPa) / (0.621945 + w);
        rh = Math.min(100, Math.max(0, (pw / pws) * 100));
      } else if (secondParam === "w") {
        const wInput = paramValue !== "" ? Number(paramValue) : ip ? 100 : 14.5;
        w = ip ? wInput / 7000 : wInput / 1000;
        dpC = dewPt(w, pPa);
        wbtC = wetBulb(dbtC, w, pPa);
        const pws = satP(dbtC + 273.15);
        const pw = (w * pPa) / (0.621945 + w);
        rh = Math.min(100, Math.max(0, (pw / pws) * 100));
      }
    } catch (e) {
      console.error("Preview calc error", e);
    }

    // Moist air properties
    const hKjKg = 1.006 * dbtC + w * (2501 + 1.86 * dbtC);
    const vM3Kg = (287.058 * (dbtC + 273.15) * (1 + 1.6078 * w)) / pPa;
    const pwPa = (w * pPa) / (0.621945 + w);

    const dbtF = cToF(dbtC);
    const wbtF = cToF(wbtC);
    const dpF = cToF(dpC);
    const hBtuLb = hKjKg / 2.326;
    const vFt3Lb = vM3Kg * 0.062428;
    const densitySi = 1 / vM3Kg;
    const densityIp = 1 / vFt3Lb;
    const pwKpa = pwPa / 1000;
    const pwPsi = pwPa / 6894.76;

    // Comfort & Audit checks
    const isSummerComfort = dbtC >= 23 && dbtC <= 26 && rh >= 30 && rh <= 60;
    const isHighHumidity = rh > 65;
    const isCondensationRisk = dpC >= 20;

    return {
      dbtC,
      dbtF,
      wbtC,
      wbtF,
      dpC,
      dpF,
      rh,
      wGKg: w * 1000,
      wGrLb: w * 7000,
      hKjKg,
      hBtuLb,
      vM3Kg,
      vFt3Lb,
      densitySi,
      densityIp,
      pwKpa,
      pwPsi,
      isSummerComfort,
      isHighHumidity,
      isCondensationRisk,
    };
  }, [formData]);

  const handleApplyPreset = (preset: {
    dbt: number;
    param: SecondParam;
    val: number;
    unit: "ip" | "si";
  }) => {
    if (isApprovedLocked) return;
    setFormData((prev) => ({
      ...prev,
      unitSystem: preset.unit,
      dbtInput: preset.dbt,
      secondParam: preset.param,
      paramValue: preset.val,
    }));
    toast.success("Applied preset parameters!");
  };

  const handleSave = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved & Locked by Discipline Coordinator. Unlock required to edit.");
      return;
    }
    onSave(formData);
    toast.success("Psychrometric parameters applied successfully!");
    onClose();
  };

  if (!isOpen) return null;

  const ip = formData.unitSystem === "ip";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground w-full max-w-4xl border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <header className="px-6 py-4 border-b border-border bg-surface-2/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Thermometer className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                Edit Moist Air Psychrometric Parameters
              </h3>
              <p className="text-xs text-muted-foreground">
                Thermodynamic State Simulation &amp; Analysis (ASHRAE / Hyland-Wexler)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Unit Switcher */}
            <div className="flex rounded-full border border-border p-0.5 bg-surface-2 shrink-0">
              <button
                type="button"
                onClick={() => handleUnitToggle("si")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                  formData.unitSystem === "si"
                    ? "bg-background shadow-xs text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                SI Metric
              </button>
              <button
                type="button"
                onClick={() => handleUnitToggle("ip")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                  formData.unitSystem === "ip"
                    ? "bg-background shadow-xs text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                IP Imperial
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 min-h-0 font-sans">
          {/* Presets Bar */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" /> Quick Design Presets
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => handleApplyPreset({ dbt: 95, param: "wb", val: 78, unit: "ip" })}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-foreground transition shrink-0 cursor-pointer"
              >
                ☀️ ASHRAE Summer (95°F / 78°F WB)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset({ dbt: 75, param: "rh", val: 50, unit: "ip" })}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-foreground transition shrink-0 cursor-pointer"
              >
                🏠 Indoor Comfort (75°F / 50% RH)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset({ dbt: 35, param: "rh", val: 80, unit: "si" })}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-foreground transition shrink-0 cursor-pointer"
              >
                🌴 Tropical High Humidity (35°C / 80% RH)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset({ dbt: 24, param: "rh", val: 45, unit: "si" })}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-foreground transition shrink-0 cursor-pointer"
              >
                🖥️ Data Center (24°C / 45% RH)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset({ dbt: 40, param: "wb", val: 35, unit: "ip" })}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-foreground transition shrink-0 cursor-pointer"
              >
                ❄️ Winter Heating (40°F / 35°F WB)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form Controls (6 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="border border-border rounded-2xl p-4 bg-surface-2/20 flex flex-col gap-4 shadow-2xs">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge className="size-3.5 text-primary" /> Input Boundary Conditions
                </h4>

                {/* Dry Bulb Temperature */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-foreground flex justify-between">
                    <span>Dry Bulb Temperature (T_db)</span>
                    <span className="text-muted-foreground font-normal">{ip ? "°F" : "°C"}</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    disabled={isApprovedLocked}
                    value={formData.dbtInput}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        dbtInput: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    placeholder={ip ? "95" : "35"}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold focus:border-primary outline-none transition"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Sensible ambient moist air temperature.
                  </span>
                </div>

                {/* Second Parameter Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Select 2nd Known Thermodynamic Parameter
                  </label>
                  <select
                    disabled={isApprovedLocked}
                    value={formData.secondParam}
                    onChange={(e) => {
                      const newParam = e.target.value as SecondParam;
                      let defaultVal: number | "" = "";
                      if (newParam === "rh") defaultVal = 60;
                      else if (newParam === "wb") defaultVal = ip ? 78 : 25.5;
                      else if (newParam === "dp") defaultVal = ip ? 72 : 22;
                      else if (newParam === "w") defaultVal = ip ? 100 : 14.5;

                      setFormData((p) => ({
                        ...p,
                        secondParam: newParam,
                        paramValue: defaultVal,
                      }));
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold focus:border-primary outline-none transition cursor-pointer"
                  >
                    <option value="rh">Relative Humidity (RH %)</option>
                    <option value="wb">Wet Bulb Temperature (T_wb)</option>
                    <option value="dp">Dew Point Temperature (T_dp)</option>
                    <option value="w">Humidity Ratio (W)</option>
                  </select>
                </div>

                {/* Second Parameter Value Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-foreground flex justify-between">
                    <span>
                      {formData.secondParam === "rh"
                        ? "Relative Humidity (RH)"
                        : formData.secondParam === "wb"
                        ? "Wet Bulb Temperature (T_wb)"
                        : formData.secondParam === "dp"
                        ? "Dew Point Temperature (T_dp)"
                        : "Humidity Ratio (W)"}
                    </span>
                    <span className="text-muted-foreground font-normal">
                      {formData.secondParam === "rh"
                        ? "%"
                        : formData.secondParam === "wb" || formData.secondParam === "dp"
                        ? ip
                          ? "°F"
                          : "°C"
                        : ip
                        ? "gr/lb"
                        : "g/kg"}
                    </span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    disabled={isApprovedLocked}
                    value={formData.paramValue}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        paramValue: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    placeholder={
                      formData.secondParam === "rh"
                        ? "60"
                        : formData.secondParam === "wb"
                        ? ip
                          ? "78"
                          : "25.5"
                        : formData.secondParam === "dp"
                        ? ip
                          ? "72"
                          : "22"
                        : ip
                        ? "100"
                        : "14.5"
                    }
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold focus:border-primary outline-none transition"
                  />
                </div>

                {/* Atmospheric Barometric Pressure */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-foreground flex justify-between">
                    <span>Atmospheric Barometric Pressure (P_atm)</span>
                    <span className="text-muted-foreground font-normal">kPa</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    disabled={isApprovedLocked}
                    value={formData.atmPressure}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        atmPressure: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    placeholder="101.325 (Standard Sea Level)"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold focus:border-primary outline-none transition"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Default 101.325 kPa (14.696 psi / 29.92 inHg sea level standard).
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Calculation Simulation Preview (6 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="border border-border rounded-2xl p-4 bg-background shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Activity className="size-3.5 text-primary" /> Live Thermodynamic Preview
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-primary/10 text-primary">
                    ASHRAE Solved State
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-surface-2/50 border border-border/60 flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-medium">Dry Bulb (T_db)</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {ip ? `${preview.dbtF.toFixed(1)} °F` : `${preview.dbtC.toFixed(1)} °C`}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2/50 border border-border/60 flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-medium">Wet Bulb (T_wb)</span>
                    <span className="font-mono font-bold text-primary text-sm">
                      {ip ? `${preview.wbtF.toFixed(1)} °F` : `${preview.wbtC.toFixed(1)} °C`}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2/50 border border-border/60 flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-medium">Dew Point (T_dp)</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {ip ? `${preview.dpF.toFixed(1)} °F` : `${preview.dpC.toFixed(1)} °C`}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2/50 border border-border/60 flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-medium">Relative Humidity</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {preview.rh.toFixed(1)} %
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2/50 border border-border/60 flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-medium">Humidity Ratio (W)</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {ip ? `${preview.wGrLb.toFixed(1)} gr/lb` : `${preview.wGKg.toFixed(2)} g/kg`}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2/50 border border-border/60 flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-medium">Enthalpy (h)</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {ip ? `${preview.hBtuLb.toFixed(1)} BTU/lb` : `${preview.hKjKg.toFixed(1)} kJ/kg`}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2/50 border border-border/60 flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-medium">Specific Volume (v)</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {ip ? `${preview.vFt3Lb.toFixed(3)} ft³/lb` : `${preview.vM3Kg.toFixed(3)} m³/kg`}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2/50 border border-border/60 flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-medium">Moist Air Density (ρ)</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {ip ? `${preview.densityIp.toFixed(4)} lb/ft³` : `${preview.densitySi.toFixed(3)} kg/m³`}
                    </span>
                  </div>
                </div>

                {/* Audit & Compliance Insights */}
                <div className="flex flex-col gap-2 mt-1">
                  {preview.isSummerComfort ? (
                    <div className="p-2.5 rounded-xl border border-success/30 bg-success/10 text-success flex items-center gap-2 text-xs">
                      <CheckCircle className="size-4 shrink-0" />
                      <span>Within ASHRAE 55 Summer Indoor Comfort Zone</span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl border border-border bg-surface-2/40 text-muted-foreground flex items-center gap-2 text-xs">
                      <Info className="size-4 shrink-0 text-primary" />
                      <span>Outdoor design / non-comfort zone condition</span>
                    </div>
                  )}

                  {preview.isHighHumidity && (
                    <div className="p-2.5 rounded-xl border border-warning/30 bg-warning/10 text-warning flex items-center gap-2 text-xs">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>Elevated moisture level (&gt;65% RH). Risk of mold/condensation.</span>
                    </div>
                  )}

                  {preview.isCondensationRisk && (
                    <div className="p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-2 text-xs">
                      <Droplets className="size-4 shrink-0" />
                      <span>High Dew Point (≥20°C / 68°F). Requires pipe insulation to prevent sweating.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <footer className="px-6 py-4 border-t border-border bg-surface-2/40 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground">
            Double-click on cards or parameters anywhere in Psychrometric Calculator to open this modal.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-border rounded-xl hover:bg-surface-2 text-xs font-semibold text-foreground cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isApprovedLocked}
              className={`h-9 px-5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all ${
                isApprovedLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              Apply &amp; Calculate
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
