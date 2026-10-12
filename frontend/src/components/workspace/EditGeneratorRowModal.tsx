import React, { useState, useMemo } from "react";
import { X, Info, CheckCircle, AlertTriangle, Zap, Calculator, Sliders, Layers, Server } from "lucide-react";
import { decideStarterAndMultiplier } from "@/lib/calc-generator";

export type StarterType = "DOL" | "SD" | "Soft Starter" | "VFD" | "None";

export const STARTER_MULTIPLIERS: Record<StarterType, number> = {
  DOL: 7,
  SD: 3,
  "Soft Starter": 2,
  VFD: 1,
  None: 0,
};

export const STANDARD_GENERATOR_SIZES = [
  5, 7.5, 10, 12.5, 15, 20, 25, 30, 35, 40, 45, 50, 62.5, 75, 82.5, 100,
  125, 160, 200, 250, 320, 400, 500, 625, 750, 800, 1000, 1250, 1500, 1600, 2000, 2500,
  2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500, 4750, 5000
];

export interface EditGeneratorRowModalProps {
  row: {
    id: string;
    desc: string;
    unit: number | string;
    kwPerUnit: number | string;
    starter: StarterType;
    multiplier: number | string;
    standby: number | string;
    emergency: number | string;
    powerFail: number | string;
    remark: string;
    excludeEmergency?: boolean;
  };
  rowIndex?: number;
  projectName?: string;
  pf?: number;
  lf?: number;
  unitSystem?: "si" | "ip";
  onClose: () => void;
  onSave: (updated: {
    desc: string;
    unit: number | string;
    kwPerUnit: number | string;
    starter: StarterType;
    multiplier: number | string;
    remark: string;
    excludeEmergency: boolean;
  }) => void;
}

export function EditGeneratorRowModal({
  row,
  rowIndex = 1,
  projectName = "Default Project",
  pf = 0.8,
  lf = 0.9,
  unitSystem = "si",
  onClose,
  onSave,
}: EditGeneratorRowModalProps) {
  const [desc, setDesc] = useState(row.desc || "");
  const [unit, setUnit] = useState<number | string>(row.unit ?? 1);
  const [kwPerUnit, setKwPerUnit] = useState<number | string>(row.kwPerUnit ?? 0);
  const [starter, setStarter] = useState<StarterType>(row.starter || "DOL");
  const [multiplier, setMultiplier] = useState<number | string>(row.multiplier ?? STARTER_MULTIPLIERS[row.starter || "DOL"]);
  const [remark, setRemark] = useState(row.remark || "");
  const [excludeEmergency, setExcludeEmergency] = useState(Boolean(row.excludeEmergency));

  const [showPreview, setShowPreview] = useState(true);

  // Synchronize starter multiplier default when starter type changes
  const handleStarterChange = (newStarter: StarterType) => {
    setStarter(newStarter);
    setMultiplier(STARTER_MULTIPLIERS[newStarter] ?? 0);
  };

  // Calculations breakdown
  const calcDetails = useMemo(() => {
    const unitCount = Number(unit) || 0;
    const kwVal = Number(kwPerUnit) || 0;
    const runningKw = unitCount * kwVal;

    const multVal = Number(multiplier) || 0;
    const startingKva = pf > 0 ? (runningKw * multVal) / pf : 0;
    const startingKw = runningKw * multVal;

    const effectiveEmergencyKw = excludeEmergency ? 0 : runningKw;

    // Minimum DG kVA required for this load item considering PF and Load Factor
    const minKvaReq = (pf * lf) > 0 ? runningKw / (pf * lf) : 0;

    // Recommended standard generator size
    const recSizeKva = STANDARD_GENERATOR_SIZES.find((s) => s >= minKvaReq) || STANDARD_GENERATOR_SIZES[STANDARD_GENERATOR_SIZES.length - 1];
    const recSizeKw = recSizeKva * pf;

    const isSizingOk = recSizeKva >= minKvaReq;

    return {
      unitCount,
      kwVal,
      runningKw,
      multVal,
      startingKva,
      startingKw,
      effectiveEmergencyKw,
      minKvaReq,
      recSizeKva,
      recSizeKw,
      isSizingOk,
    };
  }, [unit, kwPerUnit, starter, multiplier, excludeEmergency, pf, lf]);

  const handleSave = () => {
    onSave({
      desc,
      unit,
      kwPerUnit,
      starter,
      multiplier,
      remark,
      excludeEmergency,
    });
    onClose();
  };

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center justify-between";
  const inputClass = "w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none text-neutral-800 dark:text-neutral-100 font-mono font-semibold";
  const selectClass = "w-full h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none text-neutral-800 dark:text-neutral-100 font-semibold cursor-pointer";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 p-4 animate-fade-in">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className={`bg-white/85 dark:bg-neutral-950/85 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full max-h-[90vh] overflow-hidden transition-all duration-300 ease-in-out ${
          showPreview ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        {/* Header */}
        <header className="px-6 h-[72px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <div className="flex flex-col justify-center min-w-0 pr-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-[15px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
                Edit Generator Load Parameters
              </h2>
              <span className="px-2.5 py-0.75 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold font-mono tracking-tight truncate shrink-0">
                Row #{rowIndex}: {desc || "Equipment Load"} ({projectName})
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
              Configure load power, starter method, emergency classification, and view live step-by-step generator sizing calculations.
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-1.5 h-9.5 px-4 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-xs ${
                showPreview
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95 shadow-md shadow-primary/15"
                  : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"
              }`}
            >
              <Info className="size-3.5" />
              Calculations Preview
            </button>
            <button
              onClick={onClose}
              className="size-9 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Form Side */}
          <div className="flex-1 min-w-0 p-6 space-y-5 overflow-y-auto custom-scrollbar">
            {/* General Parameters */}
            <div className="space-y-3">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Sliders className="size-3.5" /> Load Identification & Remarks
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1">
                    Equipment / Load Description
                  </label>
                  <input
                    type="text"
                    value={desc}
                    onChange={(e) => {
                      const nextDesc = e.target.value;
                      setDesc(nextDesc);
                      const kwRaw = Number(kwPerUnit) || 0;
                      const kwSi = unitSystem === "ip" ? kwRaw * 0.746 : kwRaw;
                      if (nextDesc.trim() !== "") {
                        const ai = decideStarterAndMultiplier(nextDesc, kwSi);
                        setStarter(ai.starter);
                        setMultiplier(ai.multiplier);
                      }
                    }}
                    placeholder="e.g. Fire Pump 1 / AHU-01"
                    className="w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none text-neutral-800 dark:text-neutral-100 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1">
                    Location / Remark
                  </label>
                  <input
                    type="text"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="e.g. Roof Plant / Basement 1"
                    className="w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none text-neutral-800 dark:text-neutral-100 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Electrical Power Parameters */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Zap className="size-3.5" /> Electrical Ratings & Starter Method
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Quantity / No. of Units</label>
                  <input
                    type="number"
                    min="1"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{unitSystem === "ip" ? "Rating (HP / Unit)" : "Rating (kW / Unit)"}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={kwPerUnit}
                    onChange={(e) => {
                      const nextKw: number | "" = e.target.value === "" ? "" : parseFloat(e.target.value) || 0;
                      setKwPerUnit(nextKw);
                      const kwRaw = Number(nextKw) || 0;
                      const kwSi = unitSystem === "ip" ? kwRaw * 0.746 : kwRaw;
                      if (desc.trim() !== "" || kwSi > 0) {
                        const ai = decideStarterAndMultiplier(desc, kwSi);
                        setStarter(ai.starter);
                        setMultiplier(ai.multiplier);
                      }
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Starter Method</label>
                  <select
                    value={starter}
                    onChange={(e) => handleStarterChange(e.target.value as StarterType)}
                    className={selectClass}
                  >
                    <option value="DOL">DOL (7x Starting)</option>
                    <option value="SD">Star-Delta (3x Starting)</option>
                    <option value="Soft Starter">Soft Starter (2x Starting)</option>
                    <option value="VFD">VFD Drive (1x Starting)</option>
                    <option value="None">None / Static Load (0x)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Starter Multiplier</label>
                  <input
                    type="number"
                    step="0.5"
                    value={multiplier}
                    onChange={(e) => setMultiplier(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2 flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={excludeEmergency}
                      onChange={(e) => setExcludeEmergency(e.target.checked)}
                      className="size-4 accent-primary rounded cursor-pointer"
                    />
                    Exclude from Emergency Generator Load Calculation
                  </label>
                </div>
              </div>
            </div>

            {/* Computed Summary Badges */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Calculator className="size-3.5" /> Computed Load Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Total Running Load (kW)</div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.runningKw.toFixed(2)} kW
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    P = {calcDetails.unitCount} unit(s) × {calcDetails.kwVal.toFixed(2)} kW
                  </div>
                </div>

                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Starting Demand (kVA)</div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.startingKva.toFixed(2)} kVA
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    S = ({calcDetails.runningKw.toFixed(2)} kW × {calcDetails.multVal}x) / {pf} PF
                  </div>
                </div>

                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Emergency Generator Demand</div>
                  <div className={`text-sm font-mono font-bold mt-0.5 ${excludeEmergency ? "text-neutral-400 line-through" : "text-neutral-800 dark:text-neutral-100"}`}>
                    {calcDetails.effectiveEmergencyKw.toFixed(2)} kW
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    Status: {excludeEmergency ? "Excluded" : "Included in Emergency Bush"}
                  </div>
                </div>

                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Recommended Generator Sizing</div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.recSizeKva} kVA ({calcDetails.recSizeKw.toFixed(1)} kW)
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    Min Req: {calcDetails.minKvaReq.toFixed(2)} kVA @ {pf} PF
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Calculation Preview Panel (Right Side, 380px) */}
          {showPreview && (
            <div className="w-[380px] border-l border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-6 overflow-y-auto space-y-4 animate-in fade-in slide-in-from-right-4 duration-200 custom-scrollbar">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Calculator className="size-4" /> Live Formula Breakdown
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  calcDetails.isSizingOk ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}>
                  {calcDetails.isSizingOk ? "PASS (SIZED OK)" : "CHECK RATING"}
                </span>
              </div>

              {/* Step 1: Running Load Calculation */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-neutral-400">1. Running Active Load (kW)</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  P_run = Unit Count × Power Rating per Unit
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300 leading-relaxed bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-black/5 dark:border-white/5">
                  P_run = {calcDetails.unitCount} × {calcDetails.kwVal.toFixed(2)} kW
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  P_run = {calcDetails.runningKw.toFixed(2)} kW
                </div>
              </div>

              {/* Step 2: Starter Starting Multiplier & kVA */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">2. Starter Starting Demand</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  S_start = (P_run × Multiplier) / Power Factor
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  Starter: {starter} ({calcDetails.multVal}x) | S_start = ({calcDetails.runningKw.toFixed(2)} × {calcDetails.multVal}) / {pf}
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  S_start = {calcDetails.startingKva.toFixed(2)} kVA ({calcDetails.startingKw.toFixed(2)} kW)
                </div>
              </div>

              {/* Step 3: Emergency Classification */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">3. Emergency Load Categorization</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Emergency Load Contribution
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  {excludeEmergency ? "Excluded from Emergency Diesel Generator Sizing" : `Included: ${calcDetails.runningKw.toFixed(2)} kW`}
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  P_em = {calcDetails.effectiveEmergencyKw.toFixed(2)} kW
                </div>
              </div>

              {/* Step 4: Minimum Generator Sizing */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">4. Required Generator Sizing Formula</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  S_req = P_run / (Power Factor × Load Factor)
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  S_req = {calcDetails.runningKw.toFixed(2)} kW / ({pf} × {lf})
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Min Required S_req = {calcDetails.minKvaReq.toFixed(2)} kVA
                </div>
              </div>

              {/* Step 5: Recommended Rating Selection */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">5. Standard DG Set Selection</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Nearest Standard Prime/Standby Rating
                </div>
                <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1">
                  <CheckCircle className="size-3.5" /> Recommended Rating: {calcDetails.recSizeKva} kVA ({calcDetails.recSizeKw.toFixed(1)} kW)
                </div>
              </div>

              {/* Summary Banner */}
              <div className="p-3.5 rounded-xl border flex items-start gap-2.5 bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="size-4 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed font-medium">
                  <strong>Generator Load Validated.</strong> The selected load item requires minimum {calcDetails.minKvaReq.toFixed(1)} kVA capacity. Recommended standard generator size is {calcDetails.recSizeKva} kVA.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="px-6 h-16 flex items-center justify-between border-t border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <button
            onClick={onClose}
            className="px-5 h-9.5 rounded-xl text-xs font-semibold border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 h-9.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-md shadow-primary/20 cursor-pointer"
          >
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}
