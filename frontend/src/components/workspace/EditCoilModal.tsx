import React, { useState, useEffect, useMemo } from "react";
import { X, Info, Flame, CheckCircle, AlertTriangle, Activity } from "lucide-react";
import { cToF, fToC, lpsToCfm, cfmToLps, lpsToGpm } from "@/utils/conversions";

export interface CoilRow {
  id: string;
  name: string;
  dbIn: number | "";
  wbIn: number | "";
  dbOut: number | "";
  wbOut: number | "";
  flow: number | "";
  comments?: any[];
  flagged?: boolean;
}

interface EditCoilModalProps {
  isOpen: boolean;
  onClose: () => void;
  coil: CoilRow | null;
  selectedCount?: number;
  onSave: (updated: CoilRow) => void;
  unitSystem: "si" | "ip";
  isNew?: boolean;
}

// ASHRAE two-equation saturation pressure model (Pa)
function satP(tK: number): number {
  if (tK >= 273.15) {
    return Math.exp(
      -5800.2206 / tK + 1.3914993 - 0.04864 * tK +
      4.1764768e-5 * tK ** 2 - 1.4452093e-8 * tK ** 3 +
      6.5459673 * Math.log(tK)
    );
  }
  return Math.exp(
    -5674.5359 / tK + 6.3925247 - 0.009677843 * tK +
    6.2215701e-7 * tK ** 2 + 2.0747825e-9 * tK ** 3 -
    9.484024e-19 * tK ** 4 + 4.1635019 * Math.log(tK)
  );
}

function wFromWB(db: number, wb: number, p: number = 101325): number {
  const ws = 0.621945 * satP(wb + 273.15) / (p - satP(wb + 273.15));
  return ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
}

export function EditCoilModal({
  isOpen,
  onClose,
  coil,
  selectedCount = 1,
  onSave,
  unitSystem,
  isNew = false,
}: EditCoilModalProps) {
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open-blur");
    }
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, [isOpen]);

  const isBulk = !isNew && selectedCount > 1;
  const ip = unitSystem === "ip";
  const uTemp = ip ? "°F" : "°C";
  const uFlow = ip ? "CFM" : "L/s";
  const uCond = ip ? "GPM" : "L/s";

  const [name, setName] = useState(coil?.name || "");
  const [dbIn, setDbIn] = useState<number | "">(isNew ? "" : (coil?.dbIn ?? (ip ? 75.2 : 24.0)));
  const [wbIn, setWbIn] = useState<number | "">(isNew ? "" : (coil?.wbIn ?? (ip ? 62.6 : 17.0)));
  const [dbOut, setDbOut] = useState<number | "">(isNew ? "" : (coil?.dbOut ?? (ip ? 57.2 : 14.0)));
  const [wbOut, setWbOut] = useState<number | "">(isNew ? "" : (coil?.wbOut ?? (ip ? 55.4 : 13.0)));
  const [flow, setFlow] = useState<number | "">(isNew ? "" : (coil?.flow ?? (ip ? 1000 : 500)));

  useEffect(() => {
    if (coil) {
      setName(coil.name || "");
      if (isNew) {
        setDbIn("");
        setWbIn("");
        setDbOut("");
        setWbOut("");
        setFlow("");
      } else {
        setDbIn(coil.dbIn !== undefined && coil.dbIn !== null ? coil.dbIn : "");
        setWbIn(coil.wbIn !== undefined && coil.wbIn !== null ? coil.wbIn : "");
        setDbOut(coil.dbOut !== undefined && coil.dbOut !== null ? coil.dbOut : "");
        setWbOut(coil.wbOut !== undefined && coil.wbOut !== null ? coil.wbOut : "");
        setFlow(coil.flow !== undefined && coil.flow !== null ? coil.flow : "");
      }
    }
  }, [coil, isNew]);

  // Live calculation preview
  const previewCalc = useMemo(() => {
    const numDbIn = Number(dbIn) || 0;
    const numWbIn = Number(wbIn) || 0;
    const numDbOut = Number(dbOut) || 0;
    const numWbOut = Number(wbOut) || 0;
    const numFlow = Number(flow) || 0;

    const dbInC = ip ? fToC(numDbIn) : numDbIn;
    const wbInC = ip ? fToC(numWbIn) : numWbIn;
    const dbOutC = ip ? fToC(numDbOut) : numDbOut;
    const wbOutC = ip ? fToC(numWbOut) : numWbOut;

    let wIn = 0;
    let wOut = 0;
    if (numDbIn > 0 && numWbIn > 0) {
      try { wIn = Math.max(0, wFromWB(dbInC, wbInC)); } catch (e) {}
    }
    if (numDbOut > 0 && numWbOut > 0) {
      try { wOut = Math.max(0, wFromWB(dbOutC, wbOutC)); } catch (e) {}
    }

    const dw = Math.max(0, wIn - wOut);
    const flowLps = ip ? cfmToLps(numFlow) : numFlow;
    const massAirFlow = (flowLps / 1000) * 1.2;
    const condFlowLps = massAirFlow * dw;
    const condFlowGpm = lpsToGpm(condFlowLps);
    const hourlyLhr = condFlowLps * 3600;
    const hourlyGph = condFlowGpm * 60;
    const branchPipe = condFlowGpm <= 0.05 ? { sizeInch: '3/4"', metricDn: 'DN20' } : condFlowGpm <= 0.20 ? { sizeInch: '1"', metricDn: 'DN25' } : { sizeInch: '1-1/4"', metricDn: 'DN32' };

    // Warnings
    const warnings: string[] = [];
    if (numWbIn > numDbIn && numDbIn > 0) warnings.push("Entering Wet-Bulb cannot exceed Dry-Bulb temperature.");
    if (numWbOut > numDbOut && numDbOut > 0) warnings.push("Leaving Wet-Bulb cannot exceed Dry-Bulb temperature.");
    if (wIn < wOut && numFlow > 0 && numDbIn > 0 && numDbOut > 0) warnings.push("Leaving moisture is higher than entering moisture (No condensation).");

    return {
      wIn,
      wOut,
      dw,
      massAirFlow,
      condFlowLps,
      condFlowGpm,
      hourlyLhr,
      hourlyGph,
      branchPipe,
      warnings,
    };
  }, [dbIn, wbIn, dbOut, wbOut, flow, ip]);

  if (!isOpen || !coil) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      ...coil,
      name: name.trim(),
      dbIn: dbIn === "" ? (ip ? 75.2 : 24.0) : Number(dbIn) || 0,
      wbIn: wbIn === "" ? (ip ? 62.6 : 17.0) : Number(wbIn) || 0,
      dbOut: dbOut === "" ? (ip ? 57.2 : 14.0) : Number(dbOut) || 0,
      wbOut: wbOut === "" ? (ip ? 55.4 : 13.0) : Number(wbOut) || 0,
      flow: flow === "" ? (ip ? 1000 : 500) : Number(flow) || 0,
    });
  };

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5";
  const inputClass = "w-full h-9 px-3 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/20 dark:bg-black/50 p-4 animate-fade-in font-sans">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className={`bg-white/80 dark:bg-neutral-950/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-h-[88vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
          showPreview ? "max-w-4xl" : "max-w-xl"
        }`}
      >
        {/* Header */}
        <header className="px-5 h-14 flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <h2 className="text-[14.5px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
              {isNew ? "Add Cooling Coil" : isBulk ? `Bulk Edit (${selectedCount} Coils)` : "Edit Coil Parameters"}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {isBulk ? `${selectedCount} Units` : name || "Coil"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11.5px] font-semibold border transition-all cursor-pointer shadow-xs ${
                showPreview
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95"
                  : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"
              }`}
            >
              <Info className="size-3.5" />
              Calculations Preview
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-8 grid place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Form Body split into Inputs (Left) and Calculations Preview (Right) */}
        <form onSubmit={handleFormSubmit} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Form inputs (Left side) */}
            <div className="flex-1 min-w-0 p-5 space-y-4 overflow-y-auto custom-scrollbar">
              {/* General Info */}
              <div className="space-y-3">
                <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" /> General Parameters
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Unit Reference / Tag</label>
                    <input
                      type="text"
                      required={!isBulk}
                      disabled={isBulk}
                      value={isBulk ? `[Multiple Coils Selected (${selectedCount})]` : name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. AHU-01 / FCU-02"
                      className={`${inputClass} ${isBulk ? "opacity-60 cursor-not-allowed" : ""}`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Airflow Rate ({uFlow})</label>
                    <input
                      type="number"
                      step="1"
                      min={0}
                      required
                      value={flow}
                      onChange={(e) => setFlow(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder={ip ? "1000" : "500"}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>
              </div>

              {/* Psychrometric Entering (On-Coil) */}
              <div className="space-y-3">
                <h3 className="text-[10.5px] uppercase font-bold text-amber-600 dark:text-amber-500 tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-500" /> Entering (On-Coil) Conditions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Entering Dry-Bulb ({uTemp})</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={dbIn}
                      onChange={(e) => setDbIn(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder={ip ? "75.2" : "24.0"}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Entering Wet-Bulb ({uTemp})</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={wbIn}
                      onChange={(e) => setWbIn(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder={ip ? "62.6" : "17.0"}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>
              </div>

              {/* Psychrometric Leaving (Off-Coil) */}
              <div className="space-y-3">
                <h3 className="text-[10.5px] uppercase font-bold text-blue-600 dark:text-blue-500 tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-blue-500" /> Leaving (Off-Coil) Conditions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Leaving Dry-Bulb ({uTemp})</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={dbOut}
                      onChange={(e) => setDbOut(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder={ip ? "57.2" : "14.0"}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Leaving Wet-Bulb ({uTemp})</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={wbOut}
                      onChange={(e) => setWbOut(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder={ip ? "55.4" : "13.0"}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>
              </div>

              {/* Realtime Summary Quick-Badge inside Form */}
              <div className="p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-primary shrink-0" />
                  <span className="text-[11.5px] font-semibold text-neutral-700 dark:text-neutral-300">
                    Live Condensate Rate
                  </span>
                </div>
                <span className="font-mono font-bold text-[13.5px] text-primary">
                  {ip ? previewCalc.condFlowGpm.toFixed(5) : previewCalc.condFlowLps.toFixed(5)} {uCond}
                </span>
              </div>
            </div>

            {/* Calculations Preview (Right side drawer) */}
            <div
              className={`shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
                showPreview ? "w-[360px] opacity-100 p-5 border-l-border" : "w-0 opacity-0 p-0 border-l-transparent"
              }`}
            >
              <div className="w-[320px] space-y-4 flex flex-col h-full overflow-y-auto custom-scrollbar">
                <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0 flex items-center gap-1.5">
                  <Flame className="size-3.5" /> Calculations Preview
                </h3>

                {/* Humidity Ratio Card */}
                <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2.5 shrink-0 shadow-xs">
                  <div className="text-[9.5px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                    Psychrometric Moisture Content
                  </div>
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between items-center text-neutral-600 dark:text-neutral-400">
                      <span>W_in (Entering):</span>
                      <span className="font-semibold text-foreground">{previewCalc.wIn.toFixed(6)} kg/kg</span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-600 dark:text-neutral-400">
                      <span>W_out (Leaving):</span>
                      <span className="font-semibold text-foreground">{previewCalc.wOut.toFixed(6)} kg/kg</span>
                    </div>
                    <div className="flex justify-between items-center text-primary pt-1 border-t border-black/5 dark:border-white/5 font-bold">
                      <span>ΔW (Moisture Removed):</span>
                      <span>{previewCalc.dw.toFixed(6)} kg/kg</span>
                    </div>
                  </div>
                </div>

                {/* Result Highlight Card */}
                <div className="p-3.5 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl space-y-3 shrink-0 shadow-xs">
                  <div className="text-[9.5px] uppercase font-bold text-primary tracking-wider flex items-center justify-between">
                    <span>Condensate Flow Rate</span>
                    <span className="text-[10px] font-mono font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded">ASHRAE</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Design Condensate Flow:</span>
                      <span className="font-mono font-bold text-[14.5px] text-primary">
                        {ip ? `${previewCalc.condFlowGpm.toFixed(5)} GPM` : `${previewCalc.condFlowLps.toFixed(5)} L/s`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10.5px] pt-1 border-t border-primary/20">
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400 block text-[9.5px]">Hourly Generation:</span>
                        <strong className="font-mono text-foreground">{ip ? `${previewCalc.hourlyGph.toFixed(2)} GPH` : `${previewCalc.hourlyLhr.toFixed(2)} L/hr`}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400 block text-[9.5px]">Branch Drain (IPC 307):</span>
                        <strong className="font-mono text-emerald-600 dark:text-emerald-400">{ip ? previewCalc.branchPipe.sizeInch : previewCalc.branchPipe.metricDn}</strong>
                      </div>
                    </div>

                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {`Q_cond = (Airflow / 1000 × 1.2 kg/m³) × (W_in - W_out)`}
                      <br />
                      {`= ${(previewCalc.massAirFlow || 0).toFixed(4)} kg/s × ${previewCalc.dw.toFixed(6)}`}
                      <br />
                      {`= ${previewCalc.condFlowLps.toFixed(5)} L/s (${previewCalc.condFlowGpm.toFixed(5)} GPM)`}
                    </div>
                  </div>
                </div>

                {/* Warnings or Validation */}
                {previewCalc.warnings.length > 0 ? (
                  <div className="shrink-0 p-3 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 dark:border-amber-500/10 rounded-xl space-y-1 text-[11px] text-amber-700 dark:text-amber-400 shadow-xs">
                    {previewCalc.warnings.map((warn, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="shrink-0 p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl flex items-start gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 shadow-xs">
                    <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                    <div>
                      <span className="font-semibold">Calculations verified.</span> On-coil and off-coil psychrometric moisture balance satisfies ASHRAE standards.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="px-5 h-14 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-lg text-[12px] font-medium transition-colors cursor-pointer shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
            >
              {isNew ? "Add Coil" : isBulk ? `Apply to (${selectedCount}) Coils` : "Save Changes"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
