import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, Gauge, Droplets, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface ChwPipeParams {
  flowRate: number | "";
  fluidType: "chw" | "cw" | "g25" | "g40";
  temperature: number | "";
  materialRoughness: number;
  targetDp: number | "";
}

interface EditChwPipeModalProps {
  params: ChwPipeParams;
  unitSystem: "ip" | "si";
  onClose: () => void;
  onSave: (updatedParams: ChwPipeParams) => void;
  calculatedData: {
    nps: number;
    DN: number;
    innerDiameterMm: number;
    velocity: number;
    velocityFps: number;
    pressureDropFt100ft: number;
    pressureDropPaM: number;
    reynoldsNumber: number;
    regime: string;
    frictionFactor: number;
  };
}

export function EditChwPipeModal({
  params,
  unitSystem,
  onClose,
  onSave,
  calculatedData,
}: EditChwPipeModalProps) {
  const [tempParams, setTempParams] = useState<ChwPipeParams>({ ...params });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const isReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly);
    if (isReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      onClose();
    }
  }, [onClose]);

  const handleSave = () => {
    onSave(tempParams);
    toast.success("Updated CHW pipe sizing parameters!");
    onClose();
  };

  const labelClass = "block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5";
  const inputClass = "w-full bg-white/70 dark:bg-slate-900/60 border border-border/80 rounded-xl px-3.5 py-2 text-[13px] text-foreground font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50";

  const isIp = unitSystem === "ip";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-card shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-foreground tracking-tight">Edit Pipe Sizing Parameters</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0A7BC7]/10 text-[#0A7BC7] uppercase tracking-wider border border-[#0A7BC7]/20">
                NPS {calculatedData.nps}" / DN {calculatedData.DN} mm
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Configure fluid properties, design flow rates, and allowable friction loss thresholds.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
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
              onClick={onClose}
              className="size-8.5 grid place-items-center rounded-xl hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto custom-scrollbar">
            
            {/* GENERAL & FLUID PROPERTIES */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-[#0A7BC7] tracking-widest border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[#0A7BC7]" /> General & Fluid Properties
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Fluid Type</label>
                  <select
                    value={tempParams.fluidType}
                    onChange={(e) => setTempParams(p => ({ ...p, fluidType: e.target.value as any }))}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="chw">Chilled Water (CHW)</option>
                    <option value="cw">Condenser Water (CW)</option>
                    <option value="g25">25% Ethylene Glycol</option>
                    <option value="g40">40% Ethylene Glycol</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Operating Temperature ({isIp ? "°F" : "°C"})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempParams.temperature}
                    onChange={(e) => setTempParams(p => ({ ...p, temperature: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder={isIp ? "44" : "6.7"}
                  />
                </div>
              </div>
            </div>

            {/* FLOW & TARGET PRESSURE DROP */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-[#0A7BC7] tracking-widest border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[#0A7BC7]" /> Design Flow & Pressure Drop Limits
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Design Flow Rate ({isIp ? "GPM" : "L/s"})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempParams.flowRate}
                    onChange={(e) => setTempParams(p => ({ ...p, flowRate: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder={isIp ? "150" : "9.5"}
                  />
                </div>

                <div>
                  <label className={labelClass}>Target Pressure Drop Limit ({isIp ? "ft w.g./100ft" : "Pa/m"})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempParams.targetDp}
                    onChange={(e) => setTempParams(p => ({ ...p, targetDp: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder={isIp ? "4.0" : "350"}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Pipe Material Roughness (mm)</label>
                <input
                  type="number"
                  step="0.001"
                  value={tempParams.materialRoughness * 1000}
                  onChange={(e) => setTempParams(p => ({ ...p, materialRoughness: (parseFloat(e.target.value) || 0.046) / 1000 }))}
                  className={`${inputClass} font-mono`}
                  placeholder="0.046"
                />
              </div>
            </div>

            {/* HYDRAULIC SIZING PERFORMANCE CARD */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-[#0A7BC7] tracking-widest border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[#0A7BC7]" /> Computed Hydraulic Performance
              </h3>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-2 p-3.5 rounded-2xl border border-border/70 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fluid Velocity</span>
                  <div className="text-[18px] font-extrabold text-[#0A7BC7] font-mono">
                    {isIp ? calculatedData.velocityFps.toFixed(2) : calculatedData.velocity.toFixed(3)}
                    <span className="text-xs font-semibold text-muted-foreground ml-1">{isIp ? "fps" : "m/s"}</span>
                  </div>
                </div>

                <div className="bg-surface-2 p-3.5 rounded-2xl border border-border/70 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Friction Loss</span>
                  <div className="text-[18px] font-extrabold text-foreground font-mono">
                    {isIp ? calculatedData.pressureDropFt100ft.toFixed(2) : calculatedData.pressureDropPaM.toFixed(1)}
                    <span className="text-xs font-semibold text-muted-foreground ml-1">{isIp ? "ft/100ft" : "Pa/m"}</span>
                  </div>
                </div>

                <div className="bg-surface-2 p-3.5 rounded-2xl border border-border/70 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reynolds (Re)</span>
                  <div className="text-[18px] font-extrabold text-foreground font-mono truncate">
                    {Math.round(calculatedData.reynoldsNumber).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Calculations Preview Drawer */}
          {showPreview && (
            <div className="w-[300px] border-l border-border bg-surface-2/60 p-5 flex flex-col gap-4 overflow-y-auto shrink-0 animate-slide-in font-sans">
              <div className="flex items-center gap-2 text-[#0A7BC7] font-bold text-xs uppercase tracking-wider border-b border-border/50 pb-2">
                <Gauge className="size-4" /> Hydraulic Solver Preview
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-card rounded-xl border border-border/60">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Colebrook-White Friction Factor</div>
                  <div className="font-mono text-sm font-bold text-foreground mt-1">
                    f = {calculatedData.frictionFactor.toFixed(5)}
                  </div>
                  <div className="text-[#0A7BC7] font-bold text-[11px] mt-0.5">
                    Flow Regime: {calculatedData.regime}
                  </div>
                </div>

                <div className="p-3 bg-card rounded-xl border border-border/60">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Darcy-Weisbach Formula</div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-1">
                    Δh = f × (L/D) × (v² / 2g)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-border/60 flex items-center justify-end gap-3 bg-card shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl text-xs font-bold bg-[#0A7BC7] hover:bg-[#0866A5] text-white shadow-md shadow-[#0A7BC7]/20 transition-all cursor-pointer"
          >
            Save Changes
          </button>
        </footer>

      </div>
    </div>
  );
}
