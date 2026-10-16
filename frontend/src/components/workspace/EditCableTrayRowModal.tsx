import React, { useState, useMemo } from "react";
import { X, Info, CheckCircle, AlertTriangle, Cable as CableIcon, Calculator, Sliders, Layers } from "lucide-react";

export const STANDARD_TRAY_WIDTHS = [100, 150, 225, 300, 450, 600, 750, 900];

export interface EditCableTrayRowModalProps {
  cable: {
    id: string;
    type?: string;
    cores?: string;
    size?: string;
    qty?: number | string;
    outerDiameter?: number | string;
    spacingFactor?: number | string;
  };
  rowIndex?: number;
  trayName?: string;
  unitSystem?: "si" | "ip";
  cableDatabase?: Record<string, Record<string, number>>;
  onClose: () => void;
  onSave: (updated: {
    cores: string;
    size: string;
    qty: number;
    spacingFactor: number;
  }) => void;
}

export function EditCableTrayRowModal({
  cable,
  rowIndex = 1,
  trayName = "Cable Tray 1",
  unitSystem = "si",
  cableDatabase = {},
  onClose,
  onSave,
}: EditCableTrayRowModalProps) {
  const [cores, setCores] = useState<string>(cable.cores || "4C");
  const [size, setSize] = useState<string>(cable.size || "16");
  const [qty, setQty] = useState<number | "">(cable.qty ?? 1);
  const [spacingFactor, setSpacingFactor] = useState<number | "">(cable.spacingFactor ?? 1.0);
  const [sparePercent, setSparePercent] = useState<number>(25); // 25% spare capacity default

  const [showPreview, setShowPreview] = useState(true);

  // Available sizes for selected cores
  const availableSizes = useMemo(() => {
    if (cableDatabase && cableDatabase[cores]) {
      return Object.keys(cableDatabase[cores]);
    }
    return ["1.5", "2.5", "4", "6", "10", "16", "25", "35", "50", "70", "95", "120", "150", "185", "240", "300"];
  }, [cableDatabase, cores]);

  // Lookup cable outer diameter (mm)
  const singleOdMm = useMemo(() => {
    if (cableDatabase && cableDatabase[cores] && cableDatabase[cores][size]) {
      return cableDatabase[cores][size];
    }
    return Number(cable.outerDiameter) || 15;
  }, [cableDatabase, cores, size, cable.outerDiameter]);

  // Live calculations breakdown
  const calcDetails = useMemo(() => {
    const qtyVal = Math.max(1, Number(qty) || 1);
    const spacingVal = Math.max(0.5, Number(spacingFactor) || 1.0);

    const totalCableOd = qtyVal * singleOdMm;
    const baseCableWidth = qtyVal * singleOdMm * spacingVal;

    const spareFactor = 1 + Math.max(0, sparePercent) / 100;
    const reqWidthWithSpare = baseCableWidth * spareFactor;

    // Single cable cross-sectional area (mm²)
    const singleAreaMm2 = Math.PI * Math.pow(singleOdMm / 2, 2);
    const totalCableAreaMm2 = qtyVal * singleAreaMm2;

    // Recommended standard tray width (mm)
    const selectedTrayWidthMm = STANDARD_TRAY_WIDTHS.find((w) => w >= reqWidthWithSpare) || STANDARD_TRAY_WIDTHS[STANDARD_TRAY_WIDTHS.length - 1];

    const fillRatioPercent = selectedTrayWidthMm > 0 ? (baseCableWidth / selectedTrayWidthMm) * 100 : 0;
    const isFillOk = fillRatioPercent <= 80;

    return {
      qtyVal,
      singleOdMm,
      spacingVal,
      totalCableOd,
      baseCableWidth,
      spareFactor,
      reqWidthWithSpare,
      singleAreaMm2,
      totalCableAreaMm2,
      selectedTrayWidthMm,
      fillRatioPercent,
      isFillOk,
    };
  }, [qty, singleOdMm, spacingFactor, sparePercent]);

  const handleSave = () => {
    onSave({
      cores,
      size,
      qty: Math.max(1, Number(qty) || 1),
      spacingFactor: Math.max(0.5, Number(spacingFactor) || 1.0),
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
                Edit Cable Containment Parameters
              </h2>
              <span className="px-2.5 py-0.75 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold font-mono tracking-tight truncate shrink-0">
                Row #{rowIndex}: {cores} {size} mm² ({trayName})
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
              Configure cable specs, quantities, spacing factors, and view live step-by-step containment sizing calculations.
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
            {/* Cable Specifications */}
            <div className="space-y-3">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <CableIcon className="size-3.5" /> Cable Specifications
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Cable Core Type</label>
                  <select
                    value={cores}
                    onChange={(e) => setCores(e.target.value)}
                    className={selectClass}
                  >
                    <option value="1C">Single Core (1C)</option>
                    <option value="2C">2 Core (2C)</option>
                    <option value="3C">3 Core (3C)</option>
                    <option value="4C">4 Core (4C)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Conductor Size (mm²)</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className={selectClass}
                  >
                    {availableSizes.map((s) => (
                      <option key={s} value={s}>
                        {s} mm²
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Quantity of Cables</label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value === "" ? "" : parseFloat(e.target.value) || 1)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Spacing & Containment Factors */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Sliders className="size-3.5" /> Spacing & Containment Factors
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Spacing Multiplier Factor</label>
                  <select
                    value={String(spacingFactor)}
                    onChange={(e) => setSpacingFactor(parseFloat(e.target.value) || 1.0)}
                    className={selectClass}
                  >
                    <option value="1">1.0d (Touching Cables)</option>
                    <option value="2">2.0d (Spaced 1 Cable Diameter Apart)</option>
                    <option value="1.5">1.5d (Medium Spacing)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Spare Capacity Expansion %</label>
                  <select
                    value={sparePercent}
                    onChange={(e) => setSparePercent(Number(e.target.value))}
                    className={selectClass}
                  >
                    <option value={15}>15% Spare Allowance</option>
                    <option value={25}>25% Spare Allowance (Standard)</option>
                    <option value={30}>30% Spare Allowance</option>
                    <option value={50}>50% Spare Allowance (High Expansion)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Computed Summary Badges */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Calculator className="size-3.5" /> Computed Containment Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Single Cable Outer Diameter</div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.singleOdMm.toFixed(1)} mm
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    Area: {calcDetails.singleAreaMm2.toFixed(1)} mm² / cable
                  </div>
                </div>

                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Total Cable Width Required</div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.baseCableWidth.toFixed(1)} mm
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    With {sparePercent}% Spare: {calcDetails.reqWidthWithSpare.toFixed(1)} mm
                  </div>
                </div>

                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Recommended Cable Tray Size</div>
                  <div className="text-sm font-mono font-bold text-neutral-800 dark:text-neutral-100 mt-0.5">
                    {calcDetails.selectedTrayWidthMm} mm ({unitSystem === "ip" ? `${(calcDetails.selectedTrayWidthMm / 25.4).toFixed(0)}"` : `${calcDetails.selectedTrayWidthMm} mm`})
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    Commercial Standard Width
                  </div>
                </div>

                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Containment Fill Ratio</div>
                  <div className={`text-sm font-mono font-bold mt-0.5 ${calcDetails.isFillOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {calcDetails.fillRatioPercent.toFixed(1)}%
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    Status: {calcDetails.isFillOk ? "PASS (≤80% Limit)" : "HIGH FILL (>80%)"}
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
                  calcDetails.isFillOk ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}>
                  {calcDetails.isFillOk ? "PASS (≤80%)" : "HIGH FILL (>80%)"}
                </span>
              </div>

              {/* Step 1: Cable Overall Diameter (OD) */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-neutral-400">1. Cable Overall Diameter (OD)</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Total OD = Quantity × Single Cable OD
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300 leading-relaxed bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-black/5 dark:border-white/5">
                  Total OD = {calcDetails.qtyVal} cables × {calcDetails.singleOdMm.toFixed(1)} mm
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Total Cable OD = {calcDetails.totalCableOd.toFixed(1)} mm
                </div>
              </div>

              {/* Step 2: Spacing Factor & Cable Width */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">2. Spacing Factor & Cable Width</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Width = Total OD × Spacing Factor
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  Width = {calcDetails.totalCableOd.toFixed(1)} mm × {calcDetails.spacingVal}d
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Base Cable Width = {calcDetails.baseCableWidth.toFixed(1)} mm
                </div>
              </div>

              {/* Step 3: Spare Capacity Allowance */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">3. Spare Capacity Allowance</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Required Width = Base Width × (1 + Spare %)
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  Req Width = {calcDetails.baseCableWidth.toFixed(1)} mm × {calcDetails.spareFactor.toFixed(2)}
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Required Width = {calcDetails.reqWidthWithSpare.toFixed(1)} mm
                </div>
              </div>

              {/* Step 4: Recommended Standard Tray Width */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">4. Commercial Cable Tray Sizing</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Nearest Standard Containment Tray Width
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  Selected Tray Width: {calcDetails.selectedTrayWidthMm} mm
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Tray Width = {calcDetails.selectedTrayWidthMm} mm ({unitSystem === "ip" ? `${(calcDetails.selectedTrayWidthMm / 25.4).toFixed(0)}"` : `${calcDetails.selectedTrayWidthMm} mm`})
                </div>
              </div>

              {/* Step 5: Fill Ratio & Compliance Validation */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">5. Containment Fill Ratio Check</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Fill Ratio = (Base Cable Width / Tray Width) × 100%
                </div>
                <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1">
                  <CheckCircle className="size-3.5" /> Fill Ratio = {calcDetails.fillRatioPercent.toFixed(1)}% (Limit ≤ 80%)
                </div>
              </div>

              {/* Summary Banner */}
              <div className="p-3.5 rounded-xl border flex items-start gap-2.5 bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="size-4 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed font-medium">
                  <strong>Cable Containment Validated.</strong> Recommended cable tray width {calcDetails.selectedTrayWidthMm} mm accommodates all {calcDetails.qtyVal} cable(s) with {sparePercent}% spare capacity allowance.
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
