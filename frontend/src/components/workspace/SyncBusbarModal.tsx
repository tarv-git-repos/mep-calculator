import React, { useState } from "react";
import { X, Sparkles, Building2, Zap, ArrowRight, CheckCircle2, Sliders, ShieldCheck } from "lucide-react";
import { BusbarSyncResult } from "@/lib/calc-busbar-sync";

interface SyncBusbarModalProps {
  syncResult: BusbarSyncResult;
  onApply: (mode: "replace" | "append") => void;
  onClose: () => void;
}

export function SyncBusbarModal({ syncResult, onApply, onClose }: SyncBusbarModalProps) {
  const [diversity, setDiversity] = useState(syncResult.diversityFactor);
  const [applyMode, setApplyMode] = useState<"replace" | "append">("append");

  const adjustedDemandKw = Number((syncResult.totalConnectedLoadKw * diversity).toFixed(2));
  const adjustedCurrentA = Number(
    ((adjustedDemandKw * 1000) / (Math.sqrt(3) * 415 * 0.8)).toFixed(2)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Sync 3D Studio & Load Summary
              </h2>
              <p className="text-xs text-muted-foreground">
                Auto-generate vertical busduct riser from 3D floor elevations & floor electrical loads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status Source Badge */}
          <div className="flex items-center justify-between p-3.5 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-2.5">
              <Building2 className="size-4 text-primary shrink-0" />
              <div>
                <div className="text-xs font-semibold text-foreground">
                  {syncResult.source === "3d-and-load-summary" && "✅ Connected to 3D Studio & Load Summary"}
                  {syncResult.source === "3d-only" && "⚡ 3D Floor Geometry Synced (Benchmark Loads Applied)"}
                  {syncResult.source === "load-summary-only" && "📊 Load Summary Synced (Standard Floor Heights Applied)"}
                  {syncResult.source === "default-preset" && "🏢 Multi-Storey High-Rise Riser Template"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {syncResult.floors.length} Building Storeys detected | Floor Heights: 3.5m - 4.2m
                </div>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 bg-primary text-primary-foreground rounded-full">
              {syncResult.recommendedRatingLabel}
            </span>
          </div>

          {/* Sizing Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Total TCL
              </span>
              <span className="text-sm font-black font-mono text-foreground mt-0.5 block">
                {syncResult.totalConnectedLoadKw} kW
              </span>
              <span className="text-[10px] text-muted-foreground">Cumulative Load</span>
            </div>

            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Diversity (DF)
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1.0"
                  value={diversity}
                  onChange={(e) => setDiversity(parseFloat(e.target.value) || 0.85)}
                  className="w-14 h-6 text-sm font-black font-mono text-primary bg-background border border-border rounded px-1 text-center"
                />
              </div>
              <span className="text-[10px] text-muted-foreground">IEC Preset</span>
            </div>

            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Max Demand
              </span>
              <span className="text-sm font-black font-mono text-foreground mt-0.5 block">
                {adjustedDemandKw} kW
              </span>
              <span className="text-[10px] text-muted-foreground">TCL × DF</span>
            </div>

            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Line Current
              </span>
              <span className="text-sm font-black font-mono text-primary mt-0.5 block">
                {adjustedCurrentA} A
              </span>
              <span className="text-[10px] text-muted-foreground">at 415V, 0.8 PF</span>
            </div>
          </div>

          {/* Detected Floor-by-Floor Riser Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                Detected Riser Tap-Off Schedule
              </span>
              <span className="text-[11px] text-muted-foreground">
                {syncResult.floors.length} Floors (Bottom to Top)
              </span>
            </div>

            <div className="border border-border rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-2 border-b border-border text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-3 py-2">Floor Level</th>
                    <th className="px-3 py-2">Tap-Off Name</th>
                    <th className="px-3 py-2 text-center">Length (m)</th>
                    <th className="px-3 py-2 text-right">Floor Load (kW)</th>
                    <th className="px-3 py-2 text-center">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {syncResult.floors.map((flr, idx) => (
                    <tr key={idx} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-3 py-2 font-medium text-foreground">
                        {flr.floorName}
                      </td>
                      <td className="px-3 py-2 font-mono text-primary">
                        SMDB-{flr.floorCode}
                      </td>
                      <td className="px-3 py-2 text-center font-mono">
                        {flr.height.toFixed(1)} m
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                        {flr.loadKw.toFixed(2)} kW
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          flr.isFromLoadSummary
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}>
                          {flr.isFromLoadSummary ? "Load Summary" : "3D Benchmark"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Voltage Drop Standard Compliance Note */}
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5">
            <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-xs text-emerald-800 dark:text-emerald-200">
              <strong>IEC 61439-6 Compliance:</strong> Riser will be sized using rating{" "}
              <strong>{syncResult.recommendedRatingLabel}</strong> to ensure cumulative voltage drop stays well below the 2.5% maximum allowable limit.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-surface-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="applyMode"
                checked={applyMode === "append"}
                onChange={() => setApplyMode("append")}
                className="accent-primary"
              />
              Add as New Riser Panel
            </label>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="applyMode"
                checked={applyMode === "replace"}
                onChange={() => setApplyMode("replace")}
                className="accent-primary"
              />
              Replace Current Schedule
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(applyMode)}
              className="px-5 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Apply Riser Automation
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
