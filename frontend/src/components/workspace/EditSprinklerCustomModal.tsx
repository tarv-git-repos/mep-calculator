import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, CheckCircle2, AlertTriangle, Sparkles, Flag, Gauge } from "lucide-react";

export interface SprinklerModalRow {
  id: string;
  label: string;
  kFactor: number;
  solveFor: "Q" | "P";
  pressure: number;
  flow: number;
  coverage: number;
  hazard: string;
  notes?: string;
  flagged?: boolean;
  flagReason?: string;
}

interface EditSprinklerCustomModalProps {
  sprinkler: SprinklerModalRow;
  onClose: () => void;
  onSave: (updated: SprinklerModalRow) => void;
  unitSystem: "ip" | "si";
}

const STANDARD_K_FACTORS_IP = [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];
const STANDARD_K_FACTORS_SI = [40.0, 60.0, 80.0, 115.0, 160.0, 200.0, 242.0, 282.0, 320.0, 360.0, 400.0];

const HAZARD_COVERAGE_LIMITS_IP: Record<string, number> = {
  "Light Hazard": 225,
  "Ordinary Hazard Gp 1": 130,
  "Ordinary Hazard Gp 2": 130,
  "Extra Hazard Gp 1": 100,
  "Extra Hazard Gp 2": 100,
  "Storage / ESFR": 100,
};

export function EditSprinklerCustomModal({
  sprinkler,
  onClose,
  onSave,
  unitSystem,
}: EditSprinklerCustomModalProps) {
  const isSI = unitSystem === "si";
  const pressureUnit = isSI ? "bar" : "psi";
  const flowUnit = isSI ? "L/min" : "GPM";
  const areaUnit = isSI ? "m²" : "ft²";
  const minPressure = isSI ? 0.48 : 7.0;

  const [tempRow, setTempRow] = useState<SprinklerModalRow>({ ...sprinkler });
  const [showPreview, setShowPreview] = useState(false);

  const isStandardK = useMemo(() => {
    const standards = isSI ? STANDARD_K_FACTORS_SI : STANDARD_K_FACTORS_IP;
    return standards.some((k) => Math.abs(k - tempRow.kFactor) < 0.05);
  }, [tempRow.kFactor, isSI]);

  const [customKInput, setCustomKInput] = useState<string>(() => String(tempRow.kFactor));
  const [customHazardInput, setCustomHazardInput] = useState<string>(() => {
    if (tempRow.hazard.endsWith(" (Custom)")) {
      return tempRow.hazard.replace(/\s*\(Custom\)$/, "");
    }
    return tempRow.hazard || "Custom Hazard";
  });

  useEffect(() => {
    const isReadOnly = typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly);
    if (isReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      onClose();
    }
  }, [onClose]);

  // Live hydraulic calculations
  const liveCalcs = useMemo(() => {
    const k = parseFloat(customKInput) || (isSI ? 80.0 : 5.6);
    let p = tempRow.pressure;
    let q = tempRow.flow;

    if (tempRow.solveFor === "Q") {
      if (p <= 0) {
        q = 0;
      } else {
        q = parseFloat((k * Math.sqrt(p)).toFixed(2));
      }
    } else {
      if (k <= 0) {
        p = 0;
      } else {
        p = parseFloat(Math.pow(q / k, 2).toFixed(2));
      }
    }

    const isLowPressure = p < minPressure;
    const baseLimit = HAZARD_COVERAGE_LIMITS_IP[tempRow.hazard] || 130;
    const maxCoverage = isSI ? parseFloat((baseLimit / 10.7639).toFixed(1)) : baseLimit;
    const isOverCoverage = tempRow.coverage > maxCoverage;

    return {
      k,
      p,
      q,
      isLowPressure,
      maxCoverage,
      isOverCoverage,
    };
  }, [customKInput, tempRow.pressure, tempRow.flow, tempRow.solveFor, tempRow.hazard, tempRow.coverage, isSI, minPressure]);

  const handleSave = () => {
    const kVal = parseFloat(customKInput) || (isSI ? 80.0 : 5.6);
    let resolvedHazard = tempRow.hazard;

    if (tempRow.hazard === "Other" || tempRow.hazard.endsWith(" (Custom)")) {
      const cleanH = customHazardInput.trim() || "Custom Hazard";
      resolvedHazard = cleanH.endsWith(" (Custom)") ? cleanH : `${cleanH} (Custom)`;
    }

    const isMissing = !tempRow.label || tempRow.label.trim() === "" || kVal <= 0 || liveCalcs.p <= 0 || liveCalcs.q <= 0;
    let nextFlagged = tempRow.flagged;
    if (isMissing) {
      nextFlagged = true;
    } else if (sprinkler.flagged && !isMissing && !sprinkler.flagReason) {
      nextFlagged = false;
    }

    const finalized: SprinklerModalRow = {
      ...tempRow,
      label: tempRow.label.trim() || "Sprinkler Head",
      kFactor: kVal,
      hazard: resolvedHazard,
      pressure: liveCalcs.p,
      flow: liveCalcs.q,
      flagged: nextFlagged,
    };

    onSave(finalized);
    toast.success(`Custom parameters updated for ${finalized.label}`);
    onClose();
  };

  const labelClass = "block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5";
  const inputClass = "w-full bg-white/70 dark:bg-slate-900/60 border border-border/80 rounded-xl px-3.5 py-2 text-[13px] text-foreground font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
      <div
        className={`relative w-full bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-[max-width] duration-300 ease-in-out ${
          showPreview ? "max-w-4xl" : "max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-card shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-[17px] font-bold text-foreground tracking-tight">Configure Custom Parameters</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary uppercase tracking-wider border border-primary/20">
                {tempRow.label || "Sprinkler Head"}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Define custom orifice coefficients, operating pressures, and design hazard classes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTempRow((prev) => ({ ...prev, flagged: !prev.flagged }))}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-xs ${
                tempRow.flagged
                  ? "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20"
                  : "bg-surface-2 border-border/80 text-muted-foreground hover:text-foreground hover:bg-surface-3"
              }`}
              title={tempRow.flagged ? "Unflag sprinkler" : "Flag for review"}
            >
              <Flag className={`size-3.5 ${tempRow.flagged ? "fill-red-500 text-red-500" : ""}`} />
              <span>{tempRow.flagged ? "Flagged" : "Flag"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-xs ${
                showPreview
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95 shadow-md shadow-primary/15"
                  : "bg-surface-2 border-border/80 text-foreground hover:bg-surface-3"
              }`}
            >
              <Info className="size-3.5" />
              Calculations Preview
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-8.5 grid place-items-center rounded-xl hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6 custom-scrollbar">
          {/* Form Fields */}
          <div className="flex-1 space-y-4">
            {/* Label / Name */}
            <div>
              <label className={labelClass}>Sprinkler Label / Room Location</label>
              <input
                type="text"
                value={tempRow.label}
                onChange={(e) => setTempRow((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Master Bedroom Sprinkler, Level 1 Lobby"
                className={inputClass}
              />
            </div>

            {/* K-Factor Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>
                  K-Factor ({isSI ? "SI Metric" : "US IP"})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={customKInput}
                    onChange={(e) => setCustomKInput(e.target.value)}
                    placeholder={isSI ? "80.0" : "5.6"}
                    className={`${inputClass} font-mono font-bold text-primary`}
                  />
                  <span className="absolute right-3 top-2 text-[11px] font-bold text-muted-foreground uppercase pointer-events-none">
                    K-Coeff
                  </span>
                </div>
              </div>

              {/* Sizing Target */}
              <div>
                <label className={labelClass}>Hydraulic Sizing Target</label>
                <select
                  value={tempRow.solveFor}
                  onChange={(e) => setTempRow((prev) => ({ ...prev, solveFor: e.target.value as "Q" | "P" }))}
                  className={inputClass}
                >
                  <option value="Q">Solve for Flow (Q) from Pressure</option>
                  <option value="P">Solve for Pressure (P) from Flow</option>
                </select>
              </div>
            </div>

            {/* Operating Pressure & Flow */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>
                  Operating Pressure ({pressureUnit}) {tempRow.solveFor === "P" && <span className="text-primary font-normal">(Calculated)</span>}
                </label>
                <input
                  type="number"
                  step={isSI ? "0.05" : "0.5"}
                  min="0"
                  disabled={tempRow.solveFor === "P"}
                  value={tempRow.solveFor === "P" ? liveCalcs.p : tempRow.pressure}
                  onChange={(e) => setTempRow((prev) => ({ ...prev, pressure: parseFloat(e.target.value) || 0 }))}
                  className={`${inputClass} font-mono ${tempRow.solveFor === "P" ? "bg-muted/30 text-primary font-bold cursor-not-allowed" : ""}`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Design Flow ({flowUnit}) {tempRow.solveFor === "Q" && <span className="text-primary font-normal">(Calculated)</span>}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  disabled={tempRow.solveFor === "Q"}
                  value={tempRow.solveFor === "Q" ? liveCalcs.q : tempRow.flow}
                  onChange={(e) => setTempRow((prev) => ({ ...prev, flow: parseFloat(e.target.value) || 0 }))}
                  className={`${inputClass} font-mono ${tempRow.solveFor === "Q" ? "bg-muted/30 text-primary font-bold cursor-not-allowed" : ""}`}
                />
              </div>
            </div>

            {/* Hazard & Coverage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>Hazard Classification</label>
                <select
                  value={tempRow.hazard.endsWith(" (Custom)") ? "Other" : tempRow.hazard}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Other") {
                      setTempRow((prev) => ({ ...prev, hazard: "Other" }));
                    } else {
                      setTempRow((prev) => ({ ...prev, hazard: val }));
                    }
                  }}
                  className={inputClass}
                >
                  <option value="Light Hazard">Light Hazard</option>
                  <option value="Ordinary Hazard Gp 1">Ordinary Hazard Gp 1</option>
                  <option value="Ordinary Hazard Gp 2">Ordinary Hazard Gp 2</option>
                  <option value="Extra Hazard Gp 1">Extra Hazard Gp 1</option>
                  <option value="Extra Hazard Gp 2">Extra Hazard Gp 2</option>
                  <option value="Storage / ESFR">Storage / ESFR</option>
                  <option value="Other">Other (Custom Hazard)...</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Coverage Area ({areaUnit})</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={tempRow.coverage}
                  onChange={(e) => setTempRow((prev) => ({ ...prev, coverage: parseFloat(e.target.value) || 0 }))}
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>

            {/* Custom Hazard Name (if Other selected) */}
            {(tempRow.hazard === "Other" || tempRow.hazard.endsWith(" (Custom)")) && (
              <div>
                <label className={labelClass}>Custom Hazard Label</label>
                <input
                  type="text"
                  value={customHazardInput}
                  onChange={(e) => setCustomHazardInput(e.target.value)}
                  placeholder="e.g. Clean Agent Protected Room, High-Bay Deluge"
                  className={inputClass}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className={labelClass}>Engineering Notes & Comments</label>
              <textarea
                value={tempRow.notes || ""}
                onChange={(e) => setTempRow((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional design comments or specification requirements..."
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          {/* Right Column: Live Calculations Preview */}
          {showPreview && (
            <div className="w-full lg:w-[320px] shrink-0 border border-border/70 rounded-2xl p-4 bg-surface-1/50 flex flex-col gap-4 animate-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                <Gauge className="size-4 text-primary" />
                <h4 className="font-bold text-[13px] text-foreground">Hydraulic Formulas & Audit</h4>
              </div>

              {/* Dynamic Formula Display */}
              <div className="p-3 rounded-xl bg-card border border-border/80 text-xs space-y-2">
                <div className="font-bold text-muted-foreground text-[10.5px] uppercase tracking-wider">Discharge Formula</div>
                <div className="font-mono text-xs font-semibold text-primary">
                  {tempRow.solveFor === "Q"
                    ? `Q = ${liveCalcs.k.toFixed(1)} × √(${liveCalcs.p.toFixed(2)}) = ${liveCalcs.q.toFixed(2)} ${flowUnit}`
                    : `P = (${liveCalcs.q.toFixed(1)} / ${liveCalcs.k.toFixed(1)})² = ${liveCalcs.p.toFixed(2)} ${pressureUnit}`}
                </div>
              </div>

              {/* NFPA 13 Checks */}
              <div className="space-y-2 text-xs">
                <div className="font-bold text-muted-foreground text-[10.5px] uppercase tracking-wider">NFPA 13 Compliance</div>
                <div className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                  liveCalcs.isLowPressure ? "bg-red-500/10 border-red-500/30 text-red-600" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                }`}>
                  {liveCalcs.isLowPressure ? <AlertTriangle className="size-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="size-4 shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-bold block">
                      {liveCalcs.isLowPressure ? "Low Operating Pressure" : "Pressure Compliant"}
                    </span>
                    <span className="text-[11px] opacity-90 leading-tight block mt-0.5">
                      {liveCalcs.isLowPressure
                        ? `Operating pressure (${liveCalcs.p.toFixed(2)} ${pressureUnit}) is below NFPA minimum ${minPressure} ${pressureUnit}.`
                        : `Operating pressure (${liveCalcs.p.toFixed(2)} ${pressureUnit}) satisfies the NFPA minimum.`}
                    </span>
                  </div>
                </div>

                <div className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                  liveCalcs.isOverCoverage ? "bg-amber-500/10 border-amber-500/30 text-amber-600" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                }`}>
                  {liveCalcs.isOverCoverage ? <AlertTriangle className="size-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="size-4 shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-bold block">
                      {liveCalcs.isOverCoverage ? "Coverage Area Exceeded" : "Coverage Compliant"}
                    </span>
                    <span className="text-[11px] opacity-90 leading-tight block mt-0.5">
                      Max coverage for ${tempRow.hazard}: ${liveCalcs.maxCoverage} ${areaUnit}.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="px-6 py-4 border-t border-border/60 flex items-center justify-between bg-surface-1/40 shrink-0">
          <span className="text-xs text-muted-foreground">
            {isStandardK ? "Standard NFPA Orifice" : "Custom Orifice Coefficient"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-surface-2 transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-md shadow-primary/20 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="size-3.5" />
              Save Parameters
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
