import React, { useState, useMemo } from "react";
import { X, Info, CheckCircle, AlertTriangle, Zap, Calculator, Sliders, Layers, Flag } from "lucide-react";

export interface LoadItem {
  desc: string;
  loadKw: number;
}

export interface EditBusbarRowModalProps {
  row: {
    id: string;
    desc?: string;
    ref?: string;
    from?: string;
    length: number | "";
    loadKw?: number | "";
    tcl?: number | "";
    div?: number | "";
    volts?: number | "";
    pf?: number | "";
    ratingId?: string;
    r?: number;
    x?: number;
    flagged?: boolean;
  };
  loadList?: LoadItem[];
  rowIndex?: number;
  sectionName?: string;
  panelName?: string;
  ratingOptions?: Array<{ id: string; label: string; r: number; x: number }>;
  unitSystem?: "si" | "ip";
  onClose: () => void;
  onSave: (updatedFields: any) => void;
}

export function EditBusbarRowModal({
  row,
  loadList = [],
  rowIndex = 1,
  sectionName = "BB-1",
  panelName = "LV PANEL-1",
  ratingOptions = [],
  unitSystem = "si",
  onClose,
  onSave,
}: EditBusbarRowModalProps) {
  const [desc, setDesc] = useState(row.desc || "");
  const [length, setLength] = useState<number | "">(row.length ?? "");
  const [loadKw, setLoadKw] = useState<number | "">(row.loadKw ?? "");
  const [div, setDiv] = useState<number | "">(row.div ?? 1);
  const [volts, setVolts] = useState<number | "">(row.volts ?? 415);
  const [pf, setPf] = useState<number | "">(row.pf ?? 0.8);
  const [ratingId, setRatingId] = useState<string>(row.ratingId || (ratingOptions[0]?.id || "2500_rt"));
  const [flagged, setFlagged] = useState<boolean>(Boolean(row.flagged));
  
  // Show preview panel by default so user sees TCL & MD calculation live
  const [showPreview, setShowPreview] = useState(true);

  // Active busbar rating parameters
  const currentRatingData = useMemo(() => {
    const found = ratingOptions.find((r) => r.id === ratingId);
    if (found) return found;
    return { id: ratingId, label: ratingId, r: row.r || 0.0177, x: row.x || 0.0100 };
  }, [ratingOptions, ratingId, row.r, row.x]);

  // TCL breakdown calculation
  const tclBreakdown = useMemo(() => {
    const currentLoadNum = Number(loadKw) || 0;
    
    if (loadList && loadList.length > 0) {
      // Replace the current row's load in loadList with current edited input value
      const updatedList = loadList.map((item, idx) => {
        if (idx === 0) return { ...item, loadKw: currentLoadNum, desc: desc || item.desc };
        return item;
      });

      const sum = updatedList.reduce((acc, item) => acc + item.loadKw, 0);
      const formulaStr = updatedList
        .map((item) => `${item.loadKw.toFixed(2)} kW${item.desc ? ` (${item.desc})` : ''}`)
        .join(" + ");
      const simpleFormulaStr = updatedList.map((item) => `${item.loadKw.toFixed(2)}`).join(" + ");

      return {
        sum,
        formulaStr,
        simpleFormulaStr,
        items: updatedList,
      };
    }

    const fallbackTcl = row.tcl ? Number(row.tcl) : currentLoadNum;
    return {
      sum: fallbackTcl,
      formulaStr: `${currentLoadNum.toFixed(2)} kW`,
      simpleFormulaStr: `${currentLoadNum.toFixed(2)}`,
      items: [{ desc: desc || "Tap Off", loadKw: currentLoadNum }],
    };
  }, [loadList, loadKw, row.tcl, desc]);

  // Live calculation breakdown
  const calcDetails = useMemo(() => {
    const lenVal = Number(length) || 0;
    const lenMeters = unitSystem === "ip" ? lenVal * 0.3048 : lenVal;
    const kwVal = Number(loadKw) || 0;
    const divVal = Number(div) || 1;
    const vVal = Number(volts) || 415;
    const pfVal = Number(pf) || 0.8;

    const tcl = tclBreakdown.sum;
    const md = tcl * divVal;

    const isThreePhase = vVal > 250;
    let current = 0;
    if (vVal > 0 && pfVal > 0) {
      if (isThreePhase) {
        current = (md * 1000) / (Math.sqrt(3) * vVal * pfVal);
      } else {
        current = (md * 1000) / (vVal * pfVal);
      }
    }

    const rVal = currentRatingData.r || 0;
    const xVal = currentRatingData.x || 0;

    const safePf = Math.min(1, Math.max(-1, pfVal));
    const phi = Math.acos(safePf);
    const sinPhi = Math.sin(phi);

    let vd = 0;
    if (isThreePhase) {
      vd = (Math.sqrt(3) * current * lenMeters * (rVal * safePf + xVal * sinPhi)) / 1000;
    } else {
      vd = (2 * current * lenMeters * (rVal * safePf + xVal * sinPhi)) / 1000;
    }

    const vdPercent = vVal > 0 ? (vd / vVal) * 100 : 0;
    const isExceeded = vdPercent > 2.5;

    return {
      kwVal,
      divVal,
      tcl,
      md,
      current,
      lenMeters,
      lenVal,
      vVal,
      pfVal,
      safePf,
      sinPhi,
      rVal,
      xVal,
      isThreePhase,
      vd,
      vdPercent,
      isExceeded,
    };
  }, [length, loadKw, div, volts, pf, currentRatingData, unitSystem, tclBreakdown]);

  const handleSave = () => {
    onSave({
      id: row.id,
      desc,
      length,
      loadKw,
      div,
      volts,
      pf,
      ratingId,
      flagged,
    });
    onClose();
  };

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5";
  const inputClass = "w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12.5px] outline-none transition-all duration-150 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";
  const selectClass = "w-full h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12.5px] outline-none transition-all duration-150 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] text-neutral-800 dark:text-neutral-100 cursor-pointer";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 p-4 animate-fade-in">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className={`bg-white/80 dark:bg-neutral-950/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full max-h-[90vh] overflow-hidden transition-all duration-300 ease-in-out ${
          showPreview ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        {/* Header */}
        <header className="px-6 h-[72px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <div className="flex flex-col justify-center min-w-0 pr-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-[15px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
                Edit Busbar Tap Off Parameters
              </h2>
              <span className="px-2.5 py-0.75 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold font-mono tracking-tight truncate shrink-0">
                Row #{rowIndex}: {desc || "Tap Off"} ({panelName} : {sectionName})
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
              Configure load, length, diversity factor, and view live TCL, MD & Voltage Drop calculations.
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFlagged(prev => !prev)}
              className={`flex items-center gap-1.5 h-9.5 px-3.5 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-xs ${
                flagged
                  ? "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20"
                  : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"
              }`}
              title={flagged ? "Unflag tap off" : "Flag tap off for review"}
            >
              <Flag className={`size-3.5 ${flagged ? "fill-red-500 text-red-500" : ""}`} />
              <span>{flagged ? "Flagged" : "Flag"}</span>
            </button>
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
                <Sliders className="size-3.5" /> General Parameters
              </h3>
              <div>
                <label className={labelClass}>Connection / Tap Off Description</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. SMDB-L7-1"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Electrical & Geometry Parameters */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Zap className="size-3.5" /> Electrical & Geometry Parameters
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Length ({unitSystem === "ip" ? "ft" : "m"})</label>
                  <input
                    type="number"
                    step="0.1"
                    value={length}
                    onChange={(e) => setLength(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Connected Load (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={loadKw}
                    onChange={(e) => setLoadKw(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Diversity Factor (Div)</label>
                  <input
                    type="number"
                    step="0.01"
                    max="1"
                    value={div}
                    onChange={(e) => setDiv(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>System Voltage (V)</label>
                  <input
                    type="number"
                    value={volts}
                    onChange={(e) => setVolts(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Power Factor (PF)</label>
                  <input
                    type="number"
                    step="0.01"
                    max="1"
                    value={pf}
                    onChange={(e) => setPf(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Computed Summary Badges */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Calculator className="size-3.5" /> Computed Load Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                    <Layers className="size-3" /> Total Connected Load (TCL)
                  </div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.tcl.toFixed(2)} kW
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1 truncate" title={tclBreakdown.formulaStr}>
                    {tclBreakdown.simpleFormulaStr} = {calcDetails.tcl.toFixed(2)} kW
                  </div>
                </div>

                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Maximum Demand (MD)</div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.md.toFixed(2)} kW
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    MD = TCL × Div = {calcDetails.tcl.toFixed(2)} × {calcDetails.divVal}
                  </div>
                </div>

                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Line Current (I)</div>
                  <div className="text-sm font-mono font-bold text-neutral-800 dark:text-neutral-100 mt-0.5">
                    {calcDetails.current.toFixed(2)} A
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    I = (MD × 1000) / ({calcDetails.isThreePhase ? "1.732 × V × PF" : "V × PF"})
                  </div>
                </div>

                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Voltage Drop (Vd %)</div>
                  <div className={`text-sm font-mono font-bold mt-0.5 ${calcDetails.isExceeded ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {calcDetails.vdPercent.toFixed(3)}% ({calcDetails.vd.toFixed(2)} V)
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-1">
                    Status: {calcDetails.isExceeded ? "EXCEEDS LIMIT (>2.5%)" : "PASS (≤2.5%)"}
                  </div>
                </div>
              </div>
            </div>

            {/* Busbar Rating */}
            {ratingOptions.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                  <Sliders className="size-3.5" /> Busbar Specifications
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Busbar Rating (A)</label>
                    <select
                      value={ratingId}
                      onChange={(e) => setRatingId(e.target.value)}
                      className={selectClass}
                    >
                      {ratingOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-4 bg-black/5 dark:bg-white/5 rounded-xl px-4 py-2 border border-black/5 dark:border-white/5">
                    <div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Resistance (R)</div>
                      <div className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-100">
                        {currentRatingData.r.toFixed(4)} mΩ/m
                      </div>
                    </div>
                    <div className="w-px h-6 bg-border" />
                    <div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Reactance (X)</div>
                      <div className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-100">
                        {currentRatingData.x.toFixed(4)} mΩ/m
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Calculation Preview Panel (Right Side) */}
          {showPreview && (
            <div className="w-[380px] border-l border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-6 overflow-y-auto space-y-4 animate-in fade-in slide-in-from-right-4 duration-200 custom-scrollbar">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Calculator className="size-4" /> Live Formula Breakdown
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  calcDetails.isExceeded ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                }`}>
                  {calcDetails.isExceeded ? "FAIL (>2.5%)" : "PASS (≤2.5%)"}
                </span>
              </div>

              {/* Step 1: Total Connected Load (TCL) */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-neutral-400">1. Total Connected Load (TCL)</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  TCL = Sum of downstream tap off loads
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300 leading-relaxed bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-black/5 dark:border-white/5">
                  {tclBreakdown.formulaStr}
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Total TCL = {calcDetails.tcl.toFixed(2)} kW
                </div>
              </div>

              {/* Step 2: Maximum Demand (MD) */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">2. Maximum Demand (MD)</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  MD = TCL × Diversity Factor (Div)
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  MD = {calcDetails.tcl.toFixed(2)} kW × {calcDetails.divVal}
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  MD = {calcDetails.md.toFixed(2)} kW
                </div>
              </div>

              {/* Step 3: Line Current */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">3. Line Current (I)</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  I = (MD × 1000) / ({calcDetails.isThreePhase ? "√3 × V × PF" : "V × PF"})
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  I = ({calcDetails.md.toFixed(2)} × 1000) / ({calcDetails.isThreePhase ? "1.732 × " : ""}{calcDetails.vVal} × {calcDetails.pfVal})
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Current = {calcDetails.current.toFixed(2)} A
                </div>
              </div>

              {/* Step 4: Impedance */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">4. Busbar Impedance (R, X)</div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  R = {calcDetails.rVal.toFixed(4)} mΩ/m | X = {calcDetails.xVal.toFixed(4)} mΩ/m
                </div>
                <div className="text-[11px] font-mono text-neutral-500">
                  cos φ = {calcDetails.pfVal.toFixed(2)} | sin φ = {calcDetails.sinPhi.toFixed(3)}
                </div>
              </div>

              {/* Step 5: Voltage Drop */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">5. Voltage Drop (Vd)</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Vd = ({calcDetails.isThreePhase ? "√3" : "2"} × I × L × (R cos φ + X sin φ)) / 1000
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  Vd = ({calcDetails.isThreePhase ? "1.732" : "2"} × {calcDetails.current.toFixed(2)} × {calcDetails.lenMeters.toFixed(2)}m × ...) / 1000
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Vd = {calcDetails.vd.toFixed(2)} V ({calcDetails.vdPercent.toFixed(3)}%)
                </div>
              </div>

              {/* Summary Banner */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                calcDetails.isExceeded 
                  ? "bg-destructive/10 border-destructive/20 text-destructive" 
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              }`}>
                {calcDetails.isExceeded ? <AlertTriangle className="size-4 shrink-0 mt-0.5" /> : <CheckCircle className="size-4 shrink-0 mt-0.5" />}
                <div className="text-xs leading-relaxed font-medium">
                  {calcDetails.isExceeded ? (
                    <>
                      <strong>Exceeds 2.5% Standard Limit!</strong> The voltage drop of {calcDetails.vdPercent.toFixed(3)}% is higher than recommended. Try choosing a higher rated busbar.
                    </>
                  ) : (
                    <>
                      <strong>Passes Standard Requirements.</strong> Voltage drop is {calcDetails.vdPercent.toFixed(3)}%, within the allowable 2.5% threshold.
                    </>
                  )}
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
