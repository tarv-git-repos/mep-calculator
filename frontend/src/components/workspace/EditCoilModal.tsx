import React, { useState, useEffect, useMemo } from "react";
import { X, Wrench, Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { cToF, fToC, lpsToCfm, cfmToLps, lpsToGpm } from "@/utils/conversions";

export interface CoilRow {
  id: string;
  name: string;
  dbIn: number;
  wbIn: number;
  dbOut: number;
  wbOut: number;
  flow: number;
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
}: EditCoilModalProps) {
  if (!isOpen || !coil) return null;

  const isBulk = selectedCount > 1;
  const ip = unitSystem === "ip";
  const uTemp = ip ? "°F" : "°C";
  const uFlow = ip ? "CFM" : "L/s";

  const [name, setName] = useState(coil.name);
  const [dbIn, setDbIn] = useState<number | "">(coil.dbIn);
  const [wbIn, setWbIn] = useState<number | "">(coil.wbIn);
  const [dbOut, setDbOut] = useState<number | "">(coil.dbOut);
  const [wbOut, setWbOut] = useState<number | "">(coil.wbOut);
  const [flow, setFlow] = useState<number | "">(coil.flow);

  useEffect(() => {
    if (coil) {
      setName(coil.name);
      setDbIn(coil.dbIn);
      setWbIn(coil.wbIn);
      setDbOut(coil.dbOut);
      setWbOut(coil.wbOut);
      setFlow(coil.flow);
    }
  }, [coil]);

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
    try { wIn = wFromWB(dbInC, wbInC); } catch (e) {}
    try { wOut = wFromWB(dbOutC, wbOutC); } catch (e) {}

    const dw = Math.max(0, wIn - wOut);
    const flowLps = ip ? cfmToLps(numFlow) : numFlow;
    const massAirFlow = (flowLps / 1000) * 1.2;
    const condFlowLps = massAirFlow * dw;
    const condFlowGpm = lpsToGpm(condFlowLps);

    // Warnings
    const warnings: string[] = [];
    if (numWbIn > numDbIn) warnings.push("Entering Wet-Bulb cannot exceed Dry-Bulb.");
    if (numWbOut > numDbOut) warnings.push("Leaving Wet-Bulb cannot exceed Dry-Bulb.");
    if (wIn < wOut && numFlow > 0) warnings.push("Leaving moisture is higher than entering (No dehumidification).");

    return {
      wIn,
      wOut,
      dw,
      condFlowLps,
      condFlowGpm,
      warnings,
    };
  }, [dbIn, wbIn, dbOut, wbOut, flow, ip]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      ...coil,
      name: name.trim(),
      dbIn: Number(dbIn) || 0,
      wbIn: Number(wbIn) || 0,
      dbOut: Number(dbOut) || 0,
      wbOut: Number(wbOut) || 0,
      flow: Number(flow) || 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#0A7BC7]/10 text-[#0A7BC7] rounded-xl">
              <Wrench className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isBulk ? `Bulk Edit (${selectedCount} Coils)` : "Edit Coil Properties"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isBulk ? "Apply psychrometric parameters across all selected cooling coils" : "Modify on-coil and off-coil psychrometric parameters"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unit Reference / Tag</label>
              {isBulk && (
                <span className="text-[11px] text-[#0A7BC7] font-medium">(Individual unit tags will be preserved in bulk edit)</span>
              )}
            </div>
            <input
              type="text"
              required={!isBulk}
              disabled={isBulk}
              value={isBulk ? `[Multiple Coils Selected (${selectedCount})]` : name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AHU-01"
              className={`border border-border/80 rounded-xl px-3.5 py-2 text-sm font-semibold outline-none focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/20 transition-all ${
                isBulk ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-background text-foreground"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-3 p-3.5 bg-slate-50 dark:bg-slate-950/30 border border-border/60 rounded-xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500"></span> Entering (On-Coil)
              </span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Dry-Bulb ({uTemp})</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={dbIn}
                  onChange={(e) => setDbIn(e.target.value === "" ? "" : Number(e.target.value))}
                  className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-[#0A7BC7]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Wet-Bulb ({uTemp})</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={wbIn}
                  onChange={(e) => setWbIn(e.target.value === "" ? "" : Number(e.target.value))}
                  className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-[#0A7BC7]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 p-3.5 bg-slate-50 dark:bg-slate-950/30 border border-border/60 rounded-xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500"></span> Leaving (Off-Coil)
              </span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Dry-Bulb ({uTemp})</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={dbOut}
                  onChange={(e) => setDbOut(e.target.value === "" ? "" : Number(e.target.value))}
                  className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-[#0A7BC7]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Wet-Bulb ({uTemp})</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={wbOut}
                  onChange={(e) => setWbOut(e.target.value === "" ? "" : Number(e.target.value))}
                  className="bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-[#0A7BC7]"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Airflow Rate ({uFlow})</label>
            <input
              type="number"
              step="1"
              required
              value={flow}
              onChange={(e) => setFlow(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={ip ? "1000" : "500"}
              className="bg-background border border-border/80 rounded-xl px-3.5 py-2 text-sm font-semibold outline-none focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/20 transition-all"
            />
          </div>

          {/* Live psychrometric preview */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-primary">
              <span className="flex items-center gap-1.5"><Activity className="size-3.5" /> Calculated Dehumidification</span>
              <span className="font-mono font-bold text-sm">
                {ip ? previewCalc.condFlowGpm.toFixed(5) : previewCalc.condFlowLps.toFixed(5)} {ip ? "GPM" : "L/s"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground font-mono">
              <div>W_in: <span className="text-foreground font-medium">{previewCalc.wIn.toFixed(6)} kg/kg</span></div>
              <div>W_out: <span className="text-foreground font-medium">{previewCalc.wOut.toFixed(6)} kg/kg</span></div>
            </div>
            {previewCalc.warnings.map((warn, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="size-3 shrink-0" />
                <span>{warn}</span>
              </div>
            ))}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#0A7BC7] hover:bg-[#06456F] text-white px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-3.5" /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
