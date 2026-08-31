import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, Gauge, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface ChwPumpParams {
  flowUsgpm: number | "";
  flowLps: number | "";
  vertLength: number | "";
  horizLength: number | "";
  frictionFactor: number | "";
  staticHead: number | "";
  residualPressure: number | "";
  suctionPressure: number | "";
  safetyFactorHead: number;
  selectedHead: number | "";
  effMotor: number;
  effPump: number;
}

interface EditChwPumpModalProps {
  params: ChwPumpParams;
  unitSystem: "ip" | "si";
  onClose: () => void;
  onSave: (updatedParams: ChwPumpParams) => void;
  calculatedData: {
    pumpHeadCalcDisplay: number;
    flowRateDisplay: number;
    headUnit: string;
    flowUnit: string;
    lengthUnit: string;
    shaftPowerKw: number;
    motorPowerKw: number;
    motorHP: number;
    sumLengthsDisplay: number;
    equivLengthDisplay: number;
    frictionLossDisplay: number;
  };
}

export function EditChwPumpModal({
  params,
  unitSystem,
  onClose,
  onSave,
  calculatedData,
}: EditChwPumpModalProps) {
  const [tempParams, setTempParams] = useState<ChwPumpParams>({ ...params });
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
    toast.success("Updated CHW pump head & duty parameters!");
    onClose();
  };

  const labelClass = "block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5";
  const inputClass = "w-full bg-white/70 dark:bg-slate-900/60 border border-border/80 rounded-xl px-3.5 py-2 text-[13px] text-foreground font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50";

  const isIp = unitSystem === "ip";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className={`relative w-full bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-[max-width] duration-300 ease-in-out ${showPreview ? "max-w-4xl" : "max-w-2xl"}`}>
        
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-card shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-foreground tracking-tight">Edit Pump Head Parameters</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 uppercase tracking-wider border border-orange-500/20">
                {calculatedData.flowRateDisplay.toFixed(1)} {calculatedData.flowUnit} @ {calculatedData.pumpHeadCalcDisplay.toFixed(2)} {calculatedData.headUnit}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Configure pipe lengths, dynamic friction, static elevation, and pump operating efficiencies.
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
            
            {/* GENERAL PARAMETERS & FLOW RATE */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-orange-600 dark:text-orange-400 tracking-widest border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-orange-500" /> General Parameters & Flow Rate
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Flow Rate ({calculatedData.flowUnit})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempParams.flowUsgpm}
                    onChange={(e) => setTempParams(p => ({ ...p, flowUsgpm: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder="500"
                  />
                </div>

                <div>
                  <label className={labelClass}>Vertical Length ({calculatedData.lengthUnit})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempParams.vertLength}
                    onChange={(e) => setTempParams(p => ({ ...p, vertLength: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder={isIp ? "100" : "30"}
                  />
                </div>

                <div>
                  <label className={labelClass}>Horizontal Length ({calculatedData.lengthUnit})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempParams.horizLength}
                    onChange={(e) => setTempParams(p => ({ ...p, horizLength: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder={isIp ? "400" : "120"}
                  />
                </div>
              </div>
            </div>

            {/* PRESSURE HEAD & RESISTANCE */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-orange-600 dark:text-orange-400 tracking-widest border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-orange-500" /> System Pressure & Friction Losses
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Friction Factor Rate ({isIp ? "ft/100ft" : "m/100m"})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tempParams.frictionFactor}
                    onChange={(e) => setTempParams(p => ({ ...p, frictionFactor: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder={isIp ? "1.77" : "0.4"}
                  />
                </div>

                <div>
                  <label className={labelClass}>Static Head ({calculatedData.headUnit})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempParams.staticHead}
                    onChange={(e) => setTempParams(p => ({ ...p, staticHead: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder={isIp ? "43.5" : "3.0"}
                  />
                </div>

                <div>
                  <label className={labelClass}>Residual / Outlet ({calculatedData.headUnit})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempParams.residualPressure}
                    onChange={(e) => setTempParams(p => ({ ...p, residualPressure: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder={isIp ? "29.0" : "2.0"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Suction Pressure ({calculatedData.headUnit})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempParams.suctionPressure}
                    onChange={(e) => setTempParams(p => ({ ...p, suctionPressure: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder="0.0"
                  />
                </div>

                <div>
                  <label className={labelClass}>Safety Factor Head (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={tempParams.safetyFactorHead}
                    onChange={(e) => setTempParams(p => ({ ...p, safetyFactorHead: parseFloat(e.target.value) || 0 }))}
                    className={`${inputClass} font-mono`}
                    placeholder="5"
                  />
                </div>
              </div>
            </div>

            {/* PUMP EFFICIENCIES & MOTOR POWER */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-orange-600 dark:text-orange-400 tracking-widest border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-orange-500" /> Pump Efficiencies & Motor Power
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Pump Efficiency (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={tempParams.effPump}
                    onChange={(e) => setTempParams(p => ({ ...p, effPump: parseFloat(e.target.value) || 70 }))}
                    className={`${inputClass} font-mono`}
                    placeholder="70"
                  />
                </div>

                <div>
                  <label className={labelClass}>Motor Efficiency (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={tempParams.effMotor}
                    onChange={(e) => setTempParams(p => ({ ...p, effMotor: parseFloat(e.target.value) || 85 }))}
                    className={`${inputClass} font-mono`}
                    placeholder="85"
                  />
                </div>
              </div>

              {/* Power Results Display */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="bg-surface-2 p-3.5 rounded-2xl border border-border/70 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Required Head</span>
                  <div className="text-[18px] font-extrabold text-orange-600 dark:text-orange-400 font-mono">
                    {calculatedData.pumpHeadCalcDisplay.toFixed(2)}
                    <span className="text-xs font-semibold text-muted-foreground ml-1">{calculatedData.headUnit}</span>
                  </div>
                </div>

                <div className="bg-surface-2 p-3.5 rounded-2xl border border-border/70 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Shaft Power</span>
                  <div className="text-[18px] font-extrabold text-foreground font-mono">
                    {calculatedData.shaftPowerKw.toFixed(2)}
                    <span className="text-xs font-semibold text-muted-foreground ml-1">kW</span>
                  </div>
                </div>

                <div className="bg-surface-2 p-3.5 rounded-2xl border border-border/70 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Motor Rating</span>
                  <div className="text-[18px] font-extrabold text-foreground font-mono">
                    {calculatedData.motorHP.toFixed(1)}
                    <span className="text-xs font-semibold text-muted-foreground ml-1">HP</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Calculations Preview Drawer with smooth slide transition */}
          <div
            className={`shrink-0 bg-surface-2/60 border-l border-border overflow-hidden transition-[width,opacity,padding] duration-300 ease-in-out flex flex-col ${
              showPreview ? "w-[360px] opacity-100 p-6" : "w-0 opacity-0 p-0 border-l-transparent"
            }`}
          >
            <div className="w-[312px] space-y-4 flex flex-col h-full overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold text-xs uppercase tracking-wider border-b border-border/50 pb-2 shrink-0">
                <Zap className="size-4" /> Hydraulic Solver Preview
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-card rounded-xl border border-border/60">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Friction Head Loss</div>
                  <div className="font-mono text-sm font-bold text-foreground mt-1">
                    {calculatedData.equivLengthDisplay.toFixed(1)} {calculatedData.lengthUnit} × Friction
                  </div>
                  <div className="text-orange-600 dark:text-orange-400 font-bold font-mono text-xs mt-0.5">
                    = {calculatedData.frictionLossDisplay.toFixed(3)} {calculatedData.headUnit}
                  </div>
                </div>

                <div className="p-3 bg-card rounded-xl border border-border/60">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Motor Power Calculation</div>
                  <div className="font-mono text-xs font-bold text-foreground mt-1">
                    P_motor = P_shaft / η_motor
                  </div>
                  <div className="text-primary font-bold font-mono text-xs mt-0.5">
                    = {calculatedData.motorPowerKw.toFixed(2)} kW ({calculatedData.motorHP.toFixed(1)} HP)
                  </div>
                </div>
              </div>
            </div>
          </div>
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
