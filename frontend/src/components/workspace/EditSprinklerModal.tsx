import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, CheckCircle, AlertTriangle, Droplet, Flame, ShieldAlert, Sparkles, Activity } from "lucide-react";

export type HazardOpt = "0.10,1500" | "0.15,1500" | "0.20,1500" | "0.30,2500" | "0.40,2500" | "custom";

export const STANDARD_K_FACTORS = [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];

export interface SprinklerFormData {
  hazard: HazardOpt;
  customDens: number | "";
  customArea: number | "";
  coverage: number | "";
  kFactor: number;
  unitSystem: "ip" | "si";
}

interface EditSprinklerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SprinklerFormData) => void;
  currentData: SprinklerFormData;
  isApprovedLocked?: boolean;
}

export function EditSprinklerModal({
  isOpen,
  onClose,
  onSave,
  currentData,
  isApprovedLocked = false,
}: EditSprinklerModalProps) {
  const [formData, setFormData] = useState<SprinklerFormData>({ ...currentData });
  const [showPreview, setShowPreview] = useState(true);

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

  // Handle unit system switch inside modal with auto-conversion
  const handleUnitToggle = (newUnit: "ip" | "si") => {
    if (newUnit === formData.unitSystem) return;
    const prevUnit = formData.unitSystem;
    let nextCov = formData.coverage;

    if (newUnit === "si" && prevUnit === "ip") {
      if (nextCov !== "") {
        nextCov = parseFloat((Number(nextCov) / 10.7639).toFixed(1));
      }
    } else if (newUnit === "ip" && prevUnit === "si") {
      if (nextCov !== "") {
        nextCov = parseFloat((Number(nextCov) * 10.7639).toFixed(0));
      }
    }

    setFormData((prev) => ({
      ...prev,
      unitSystem: newUnit,
      coverage: nextCov,
    }));
  };

  // Live calculation simulation
  const preview = useMemo(() => {
    const { hazard, customDens, customArea, coverage, kFactor, unitSystem } = formData;
    const ip = unitSystem === "ip";

    const customDensVal = customDens === "" ? 0 : customDens;
    const customAreaVal = customArea === "" ? 0 : customArea;
    const coverageVal = coverage === "" ? 0 : coverage;

    let dens = 0.15;
    let designArea = 1500;

    if (hazard === "custom") {
      dens = customDensVal;
      designArea = customAreaVal;
    } else {
      const parts = hazard.split(",");
      dens = parseFloat(parts[0]);
      designArea = parseFloat(parts[1]);
    }

    // Convert to IP base for formulas
    const densIP = ip ? dens : dens / 40.74;
    const coverFt2 = ip ? coverageVal : coverageVal * 10.7639;
    const designAreaFt2 = ip ? designArea : designArea * 10.7639;

    const flowPerSprink = densIP * coverFt2; // GPM
    const pressReq = kFactor > 0 ? Math.pow(flowPerSprink / kFactor, 2) : 0; // psi
    const nSprink = coverFt2 > 0 ? Math.ceil(designAreaFt2 / coverFt2) : 0;
    const totalSprinkFlow = densIP * designAreaFt2; // GPM

    // Hose stream allowance: LH=100, OH=250, EH=500 GPM
    const hoseAllow = densIP <= 0.10 ? 100 : densIP <= 0.20 ? 250 : 500;
    const systemTotal = totalSprinkFlow + hoseAllow;

    const waterDurationMin = hazard.startsWith("0.10") ? 30 : (hazard.startsWith("0.30") || hazard.startsWith("0.40") ? 90 : 60);
    const totalStorageGal = systemTotal * waterDurationMin;
    const totalStorageM3 = totalStorageGal * 0.00378541;

    const isPressureCompliant = pressReq >= 7.0;
    const isCoverageCompliant = coverFt2 <= 225 && coverFt2 > 0;

    // Formatted strings
    const formatFlow = (gpm: number) =>
      ip ? `${gpm.toFixed(1)} GPM` : `${(gpm * 0.06309).toFixed(2)} L/s (${(gpm * 3.78541).toFixed(1)} L/min)`;

    const formatPressure = (psi: number) =>
      ip ? `${psi.toFixed(1)} psi` : `${(psi * 0.0689476).toFixed(2)} bar (${(psi * 6.89476).toFixed(1)} kPa)`;

    const formatArea = (ft2: number) =>
      ip ? `${ft2.toFixed(0)} ft²` : `${(ft2 / 10.7639).toFixed(1)} m²`;

    const formatDens = (gpmft2: number) =>
      ip ? `${gpmft2.toFixed(3)} GPM/ft²` : `${(gpmft2 * 40.74).toFixed(2)} mm/min`;

    return {
      densIP,
      coverFt2,
      designAreaFt2,
      flowPerSprink,
      pressReq,
      nSprink,
      totalSprinkFlow,
      hoseAllow,
      systemTotal,
      waterDurationMin,
      totalStorageGal,
      totalStorageM3,
      isPressureCompliant,
      isCoverageCompliant,
      formatFlow,
      formatPressure,
      formatArea,
      formatDens,
    };
  }, [formData]);

  if (!isOpen) return null;

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5";
  const inputClass = "w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12.5px] outline-none transition-all duration-150 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";
  const selectClass = "w-full h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12.5px] outline-none transition-all duration-150 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] text-neutral-800 dark:text-neutral-100 cursor-pointer";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/20 dark:bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white/85 dark:bg-neutral-950/85 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full h-[85vh] max-h-[820px] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
          showPreview ? "max-w-5xl" : "max-w-2xl"
        }`}
      >
        {/* Header */}
        <header className="px-6 h-[72px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <div className="flex flex-col justify-center min-w-0 pr-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <Flame className="size-4" />
              </div>
              <h2 className="text-[16px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
                Edit Sprinkler Sizing Parameters
              </h2>
              <span className="px-2.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-bold font-mono tracking-tight shrink-0">
                NFPA 13
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
              Modify hazard classification, coverage per head, K-factor, and view live hydraulic simulation.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-1.5 h-9.5 px-3.5 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-sm ${
                showPreview
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95 shadow-md shadow-primary/15"
                  : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"
              }`}
            >
              <Activity className="size-3.5" />
              Hydraulic Preview
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-9 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Form Inputs (Left) */}
          <div className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto">
            {/* Unit System Switch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold text-primary tracking-widest">
                  Unit System
                </span>
                <div className="inline-flex rounded-xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => handleUnitToggle("ip")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      formData.unitSystem === "ip"
                        ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    IP Units (GPM, psi, ft²)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitToggle("si")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      formData.unitSystem === "si"
                        ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    SI Units (L/s, bar, m²)
                  </button>
                </div>
              </div>
            </div>

            {/* Hazard & Geometry */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                Hazard Classification &amp; Design Criteria
              </h3>

              <div>
                <label className={labelClass}>NFPA 13 Hazard Category</label>
                <select
                  disabled={isApprovedLocked}
                  value={formData.hazard}
                  onChange={(e) => setFormData((prev) => ({ ...prev, hazard: e.target.value as HazardOpt }))}
                  className={selectClass}
                >
                  <option value="0.10,1500">Light Hazard — 0.10 GPM/ft² (4.07 mm/min) / 1,500 ft² (139 m²)</option>
                  <option value="0.15,1500">Ordinary Hazard Group 1 — 0.15 GPM/ft² (6.11 mm/min) / 1,500 ft²</option>
                  <option value="0.20,1500">Ordinary Hazard Group 2 — 0.20 GPM/ft² (8.15 mm/min) / 1,500 ft²</option>
                  <option value="0.30,2500">Extra Hazard Group 1 — 0.30 GPM/ft² (12.22 mm/min) / 2,500 ft²</option>
                  <option value="0.40,2500">Extra Hazard Group 2 — 0.40 GPM/ft² (16.30 mm/min) / 2,500 ft²</option>
                  <option value="custom">Custom Density &amp; Design Area...</option>
                </select>
              </div>

              {formData.hazard === "custom" && (
                <div className="grid grid-cols-2 gap-4 pt-1 animate-fade-in">
                  <div>
                    <label className={labelClass}>
                      Custom Density ({formData.unitSystem === "ip" ? "GPM/ft²" : "mm/min"})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={formData.customDens}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customDens: e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                        }))
                      }
                      className={`${inputClass} font-mono`}
                      placeholder="e.g. 0.20"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Custom Design Area ({formData.unitSystem === "ip" ? "ft²" : "m²"})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="100"
                      value={formData.customArea}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customArea: e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                        }))
                      }
                      className={`${inputClass} font-mono`}
                      placeholder="e.g. 1500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sprinkler Hardware & Coverage */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                Sprinkler Head Hardware &amp; Layout
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Coverage Area per Head ({formData.unitSystem === "ip" ? "ft²" : "m²"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={formData.coverage}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        coverage: e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                      }))
                    }
                    className={`${inputClass} font-mono`}
                    placeholder={formData.unitSystem === "ip" ? "130" : "12.1"}
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Standard: {formData.unitSystem === "ip" ? "130 ft² (max 225 ft²)" : "12.1 m² (max 20.9 m²)"}
                  </span>
                </div>

                <div>
                  <label className={labelClass}>Sprinkler Discharge Coefficient (K-Factor)</label>
                  <select
                    disabled={isApprovedLocked}
                    value={formData.kFactor}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, kFactor: parseFloat(e.target.value) || 5.6 }))
                    }
                    className={selectClass}
                  >
                    {STANDARD_K_FACTORS.map((k) => (
                      <option key={k} value={k}>
                        K-{k.toFixed(1)} {k === 5.6 ? "(Standard ½″ NPT)" : k === 8.0 ? "(Large Orifice ¾″)" : ""} {formData.unitSystem === "si" ? `(${Math.round(k * 14.28)} SI)` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Discharge formula: q = K × √P
                  </span>
                </div>
              </div>
            </div>

            {/* Compliance Tips */}
            <div className="p-4 rounded-2xl bg-surface-2/60 border border-border flex items-start gap-3">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="text-[11.5px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">NFPA 13 Standard:</span> Minimum operating pressure for standard spray sprinklers is <strong>7.0 psi (0.48 bar)</strong>. Hose stream allowance and fire water duration are automatically applied based on hazard level.
              </div>
            </div>
          </div>

          {/* Calculations Preview (Right) */}
          {showPreview && (
            <div className="w-[380px] border-l border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-900/30 p-6 flex flex-col justify-between overflow-y-auto animate-fade-in shrink-0">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                  <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest flex items-center gap-1.5">
                    <Droplet className="size-3.5 text-blue-500" />
                    Hydraulic Simulation
                  </h3>
                  <span className="text-[11px] font-mono font-bold text-muted-foreground">
                    {formData.unitSystem.toUpperCase()} Mode
                  </span>
                </div>

                {/* Primary KPI Results */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                        Flow per Sprinkler Head (q)
                      </span>
                      <span className="text-[16px] font-mono font-extrabold text-foreground">
                        {preview.formatFlow(preview.flowPerSprink)}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">q = d × A</span>
                  </div>

                  <div className={`p-3 rounded-2xl border shadow-xs flex items-center justify-between ${
                    preview.isPressureCompliant
                      ? "bg-white dark:bg-zinc-900 border-black/5 dark:border-white/5"
                      : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                  }`}>
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                        Required Operating Pressure (P)
                      </span>
                      <span className={`text-[16px] font-mono font-extrabold ${preview.isPressureCompliant ? "text-primary" : "text-red-600 dark:text-red-400"}`}>
                        {preview.formatPressure(preview.pressReq)}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">P = (q/K)²</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                        Active Sprinklers in Area (N)
                      </span>
                      <span className="text-[16px] font-mono font-extrabold text-foreground">
                        {preview.nSprink} heads
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">⌈A_des / A_cov⌉</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                        Sprinkler Demand (Q_sp)
                      </span>
                      <span className="text-[16px] font-mono font-extrabold text-foreground">
                        {preview.formatFlow(preview.totalSprinkFlow)}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">d × A_des</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">
                        Total Water Demand (Q_tot)
                      </span>
                      <span className="text-[18px] font-mono font-black text-red-600 dark:text-red-400">
                        {preview.formatFlow(preview.systemTotal)}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-red-600/70 dark:text-red-400/70">
                      +{preview.hoseAllow} GPM hose
                    </span>
                  </div>
                </div>

                {/* Storage tank requirement */}
                <div className="p-3.5 rounded-2xl bg-surface-2 border border-border flex flex-col gap-1">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                    Fire Water Storage ({preview.waterDurationMin} min duration)
                  </span>
                  <div className="text-[14px] font-mono font-extrabold text-foreground">
                    {preview.totalStorageGal.toLocaleString("en-US", { maximumFractionDigits: 0 })} Gallons
                    <span className="text-muted-foreground font-normal text-xs ml-2">
                      ({preview.totalStorageM3.toFixed(1)} m³)
                    </span>
                  </div>
                </div>

                {/* Validation Status Badge */}
                {preview.isPressureCompliant && preview.isCoverageCompliant ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium shadow-xs">
                    <CheckCircle className="size-4 text-emerald-500 shrink-0" />
                    <span>NFPA 13 Compliant (P ≥ 7.0 psi, A_cov ≤ 225 ft²)</span>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400 font-medium shadow-xs">
                    <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      {!preview.isPressureCompliant && <div>• Operating pressure is below 7.0 psi minimum.</div>}
                      {!preview.isCoverageCompliant && <div>• Sprinkler coverage area exceeds 225 ft² limit.</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 h-16 border-t border-black/5 dark:border-white/5 bg-white/20 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shadow-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isApprovedLocked}
            onClick={() => {
              if (isApprovedLocked) {
                toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit parameters.", { id: "readonly-notice" });
                return;
              }
              onSave(formData);
              toast.success("Sprinkler sizing parameters updated successfully!");
              onClose();
            }}
            className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-[12.5px] font-semibold transition-all shadow-md shadow-primary/10 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}
