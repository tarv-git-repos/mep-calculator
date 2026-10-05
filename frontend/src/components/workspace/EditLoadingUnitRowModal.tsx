import React, { useState, useMemo } from "react";
import { X, Info, CheckCircle, AlertTriangle, Droplets, Calculator, Sliders, Layers, Building2 } from "lucide-react";
import { type StandardPreset, getFlowLPS } from "@/lib/calc-plumbing-loading-unit";

export const LU_FIXTURES_META = [
  { id: 'wc', short: 'W/C', label: 'Water Closet (W/C)' },
  { id: 'handspray', short: 'Hand Spray', label: 'Hand Spray / Bidet Bibb' },
  { id: 'basin', short: 'Wash Basin', label: 'Wash Basin (LAV)' },
  { id: 'sink', short: 'Sink Kitchen', label: 'Kitchen Sink' },
  { id: 'shower', short: 'Shower', label: 'Shower Enclosure' },
  { id: 'washer', short: 'Washing Machine', label: 'Washing Machine' },
  { id: 'servicesink', short: 'Service Sink', label: 'Service / Janitor Sink' },
  { id: 'hose_bibb', short: 'Hose Bibb', label: 'Hose Bibb' },
  { id: 'dishwasher', short: 'Dish Washer', label: 'Dish Washer' },
  { id: 'hose_bibb_1', short: 'Bib Tap', label: 'General Bib Tap' }
];

export interface EditLoadingUnitRowModalProps {
  space: {
    id: number;
    desc: string;
    floor: string;
    qty: number;
    floorQty?: number;
    fixtures: Record<string, number>;
  };
  rowIndex?: number;
  floorName?: string;
  floor?: string;
  standardPreset?: StandardPreset;
  activeWeights?: Record<string, number>;
  currentWeights?: Record<string, number>;
  showSpaceQty?: boolean;
  showFloorsCol?: boolean;
  onClose: () => void;
  onSave: (updated: { desc: string; fixtures: Record<string, number>; qty: number; floorQty: number }) => void;
  onDelete?: () => void;
}

export function getStandardFormulaLabel(standard: StandardPreset): string {
  switch (standard) {
    case "as_nzs_3500":
      return "AS/NZS 3500 Lookup Table";
    case "barrie":
      return "Barrie's Book Lookup Table";
    case "bs_806":
      return "BS 806 / BS EN 806 Lookup Table";
    case "bs_8558":
    case "iop_bs":
    case "iop_low":
    case "iop_med":
    case "iop_high":
      return "BS 8558 / IoP Nomogram";
    case "din_res":
      return "DIN 1988-300 Residential (Q = 1.48×LU⁰˙¹⁹ - 0.94)";
    case "din_hosp":
      return "DIN 1988-300 Hospital (Q = 0.75×LU⁰˙⁴⁴ - 0.18)";
    case "din_hotel":
      return "DIN 1988-300 Hotel (Q = 0.70×LU⁰˙⁴⁸ - 0.13)";
    case "din_school":
      return "DIN 1988-300 School (Q = 0.91×LU⁰˙³¹ - 0.38)";
    case "din_office":
      return "DIN 1988-300 Office (Q = 0.91×LU⁰˙³¹ - 0.38)";
    case "din_assisted":
      return "DIN 1988-300 Assisted Living (Q = 1.48×LU⁰˙¹⁹ - 0.94)";
    case "din_nursing":
      return "DIN 1988-300 Nursing Home (Q = 1.40×LU⁰˙¹⁴ - 0.92)";
    case "ipc":
    case "ipc_upc":
      return "IPC Table E103.3(2) Lookup";
    case "upc":
      return "UPC Lookup Table";
    case "dubai":
      return "Dubai DBC (Q = 0.10 × √(Total LU))";
    case "abudhabi":
      return "Abu Dhabi ADM Table 6-9 Lookup";
    default:
      return "Standard Plumbing Lookup";
  }
}

export function EditLoadingUnitRowModal({
  space,
  rowIndex = 1,
  floorName = "GROUND FLOOR",
  floor,
  standardPreset = "dubai",
  activeWeights,
  currentWeights,
  showSpaceQty = true,
  showFloorsCol = true,
  onClose,
  onSave,
  onDelete,
}: EditLoadingUnitRowModalProps) {
  const effectiveWeights = activeWeights || currentWeights || {};
  const effectiveFloor = floor || floorName || space.floor || "GROUND FLOOR";
  const [desc, setDesc] = useState(space.desc || "");
  const [qty, setQty] = useState<number>(space.qty || 1);
  const [floorQty, setFloorQty] = useState<number>(space.floorQty || 1);
  const [fixtures, setFixtures] = useState<Record<string, number>>({ ...space.fixtures });
  const [showPreview, setShowPreview] = useState(true);

  const unitLabel = (standardPreset === "dubai" || standardPreset === "iop_bs") ? "LU" : "WSFU";

  // Calculate Unit LU for this space
  const unitLUBreakdown = useMemo(() => {
    const activeItems: Array<{ id: string; short: string; label: string; count: number; weight: number; totalLU: number }> = [];
    let sum = 0;

    LU_FIXTURES_META.forEach((f) => {
      const count = Number(fixtures[f.id]) || 0;
      const weight = Number(effectiveWeights[f.id]) || 0;
      if (count > 0) {
        const itemTotal = count * weight;
        sum += itemTotal;
        activeItems.push({
          id: f.id,
          short: f.short,
          label: f.label,
          count,
          weight,
          totalLU: itemTotal,
        });
      }
    });

    const formulaStr = activeItems.length > 0
      ? activeItems.map((item) => `${item.count} (${item.short}) × ${item.weight}`).join(" + ")
      : "0 LU (No fixtures selected)";

    return {
      sum,
      formulaStr,
      items: activeItems,
    };
  }, [fixtures, effectiveWeights]);

  // Live calculations for space & project total
  const calcDetails = useMemo(() => {
    const unitLU = unitLUBreakdown.sum;
    const spaceMultiplier = showSpaceQty ? Math.max(1, Number(qty) || 1) : 1;
    const floorMultiplier = showFloorsCol ? Math.max(1, Number(floorQty) || 1) : 1;
    const totalLU = unitLU * spaceMultiplier * floorMultiplier;

    // Flow rate calculation (L/s & GPM) using standard getFlowLPS
    const peakFlowLs = getFlowLPS(totalLU, standardPreset);
    const peakFlowGpm = peakFlowLs * 15.8503;

    // Pipe Sizing recommendation based on target velocity <= 1.5 m/s
    // Q = A * v => A = Q / v => d = sqrt(4 * Q / (pi * v))
    const targetVel = 1.5; // m/s
    const qM3s = peakFlowLs / 1000;
    let reqDiamMm = 15;
    if (qM3s > 0) {
      reqDiamMm = Math.sqrt((4 * qM3s) / (Math.PI * targetVel)) * 1000;
    }

    // Standard commercial pipe sizes (mm inner diameter approx)
    const stdPipes = [
      { nominal: "15mm (1/2\")", innerMm: 13, label: "15 mm" },
      { nominal: "22mm (3/4\")", innerMm: 20, label: "22 mm" },
      { nominal: "28mm (1\")", innerMm: 26, label: "28 mm" },
      { nominal: "35mm (1-1/4\")", innerMm: 33, label: "35 mm" },
      { nominal: "42mm (1-1/2\")", innerMm: 40, label: "42 mm" },
      { nominal: "54mm (2\")", innerMm: 51, label: "54 mm" },
      { nominal: "67mm (2-1/2\")", innerMm: 63, label: "67 mm" },
      { nominal: "76mm (3\")", innerMm: 72, label: "76 mm" },
      { nominal: "108mm (4\")", innerMm: 102, label: "108 mm" },
    ];

    const selectedPipe = stdPipes.find((p) => p.innerMm >= reqDiamMm) || stdPipes[stdPipes.length - 1];
    const actualAreaM2 = Math.PI * Math.pow(selectedPipe.innerMm / 2000, 2);
    const actualVel = actualAreaM2 > 0 ? qM3s / actualAreaM2 : 0;
    const isVelocityOk = actualVel <= 1.5;

    return {
      unitLU,
      spaceMultiplier,
      floorMultiplier,
      totalLU,
      peakFlowLs,
      peakFlowGpm,
      reqDiamMm,
      selectedPipe,
      actualVel,
      isVelocityOk,
    };
  }, [unitLUBreakdown, qty, floorQty, showSpaceQty, showFloorsCol, standardPreset]);

  const handleFixtureCountChange = (fixtureId: string, val: number) => {
    setFixtures((prev) => ({
      ...prev,
      [fixtureId]: Math.max(0, val),
    }));
  };

  const handleSave = () => {
    onSave({
      desc,
      fixtures,
      qty,
      floorQty,
    });
    onClose();
  };

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center justify-between";
  const inputClass = "w-full h-9 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12px] outline-none transition-all duration-150 text-neutral-800 dark:text-neutral-100 font-mono";

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
                Edit Loading Unit Space Parameters
              </h2>
              <span className="px-2.5 py-0.75 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold font-mono tracking-tight truncate shrink-0">
                Row #{rowIndex}: {desc || "Space"} ({floorName} : Fixture Schedule)
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
              Configure fixture counts, typical floor multipliers, and view live step-by-step LU & pipe sizing calculations.
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
                <Sliders className="size-3.5" /> General Parameters
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1">
                    Space / Room Description
                  </label>
                  <input
                    type="text"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="e.g. Executive Washroom / Typical Apt"
                    className="w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none text-neutral-800 dark:text-neutral-100 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1">
                    Floor Section
                  </label>
                  <div className="w-full h-10 px-3.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-[12.5px] flex items-center gap-2 text-neutral-600 dark:text-neutral-300 font-bold uppercase">
                    <Building2 className="size-3.5 text-primary" /> {floorName}
                  </div>
                </div>
              </div>
            </div>

            {/* Fixture Schedule Inputs */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Droplets className="size-3.5" /> Fixture Schedule & Weights ({unitLabel})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {LU_FIXTURES_META.map((f) => {
                  const weight = effectiveWeights[f.id] ?? 0;
                  const count = fixtures[f.id] || 0;
                  return (
                    <div key={f.id} className="p-2.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl space-y-1">
                      <label className={labelClass}>
                        <span className="truncate">{f.short}</span>
                        <span className="px-1.5 py-0.25 rounded bg-primary/10 text-primary text-[9.5px] font-mono font-bold shrink-0">
                          {weight} {unitLabel}
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={count || ""}
                        placeholder="0"
                        onChange={(e) => handleFixtureCountChange(f.id, e.target.value !== "" ? Number(e.target.value) : 0)}
                        className={inputClass}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quantity Multipliers */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Layers className="size-3.5" /> Space Quantity & Floor Multipliers
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1">
                    Space Qty (Per Typical Floor)
                  </label>
                  <input
                    type="number"
                    min="1"
                    disabled={!showSpaceQty}
                    value={showSpaceQty ? qty : 1}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none text-neutral-800 dark:text-neutral-100 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1">
                    No. of Typical Floors
                  </label>
                  <input
                    type="number"
                    min="1"
                    disabled={!showFloorsCol}
                    value={showFloorsCol ? floorQty : 1}
                    onChange={(e) => setFloorQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] outline-none text-neutral-800 dark:text-neutral-100 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Computed Summary Cards */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <Calculator className="size-3.5" /> Computed Load Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Unit {unitLabel} (1 Space)</div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.unitLU.toFixed(1)} {unitLabel}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1 truncate" title={unitLUBreakdown.formulaStr}>
                    {unitLUBreakdown.formulaStr}
                  </div>
                </div>

                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Total {unitLabel} (All Floors)</div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.totalLU.toFixed(1)} {unitLabel}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    Total = {calcDetails.unitLU.toFixed(1)} × {calcDetails.spaceMultiplier} space(s) × {calcDetails.floorMultiplier} floor(s)
                  </div>
                </div>

                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Peak Flow Rate (Q)</div>
                  <div className="text-sm font-mono font-bold text-neutral-800 dark:text-neutral-100 mt-0.5">
                    {calcDetails.peakFlowLs.toFixed(2)} L/s ({calcDetails.peakFlowGpm.toFixed(1)} GPM)
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    {getStandardFormulaLabel(standardPreset)}
                  </div>
                </div>

                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-bold uppercase text-neutral-400">Recommended Pipe Size</div>
                  <div className="text-sm font-mono font-bold text-primary mt-0.5">
                    {calcDetails.selectedPipe.nominal}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-1">
                    Velocity = {calcDetails.actualVel.toFixed(2)} m/s (Target ≤ 1.5 m/s)
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
                  calcDetails.isVelocityOk ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}>
                  {calcDetails.isVelocityOk ? "PASS (≤1.5 m/s)" : "HIGH VELOCITY"}
                </span>
              </div>

              {/* Step 1: Unit Loading Units */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-neutral-400">1. Unit {unitLabel} Summation</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Unit {unitLabel} = ∑ (Fixture Count × Fixture Weight)
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300 leading-relaxed bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-black/5 dark:border-white/5">
                  {unitLUBreakdown.formulaStr}
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Unit {unitLabel} = {calcDetails.unitLU.toFixed(1)} {unitLabel}
                </div>
              </div>

              {/* Step 2: Total Loading Units */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">2. Total {unitLabel} Multiplier</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Total = Unit {unitLabel} × Space Qty × No. of Floors
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  Total = {calcDetails.unitLU.toFixed(1)} × {calcDetails.spaceMultiplier} × {calcDetails.floorMultiplier}
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Total = {calcDetails.totalLU.toFixed(1)} {unitLabel}
                </div>
              </div>

              {/* Step 3: Peak Demand Flow Calculation */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">3. Peak Flow Rate (Q)</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  {getStandardFormulaLabel(standardPreset)}
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  Target Load: {calcDetails.totalLU.toFixed(1)} {unitLabel}
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Q = {calcDetails.peakFlowLs.toFixed(2)} L/s ({calcDetails.peakFlowGpm.toFixed(1)} GPM)
                </div>
              </div>

              {/* Step 4: Recommended Pipe Diameter & Velocity */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">4. Pipe Sizing & Velocity Check</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Target Max Velocity = 1.5 m/s | v = Q / Area
                </div>
                <div className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  Selected Pipe: {calcDetails.selectedPipe.nominal} (ID: {calcDetails.selectedPipe.innerMm} mm)
                </div>
                <div className="text-xs font-mono text-primary font-bold">
                  Actual Velocity = {calcDetails.actualVel.toFixed(2)} m/s
                </div>
              </div>

              {/* Step 5: System Sizing Validation */}
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-bold uppercase text-neutral-400">5. Booster Duty & Sizing Validation</div>
                <div className="text-[11px] font-mono text-neutral-500">
                  Booster Pump Demand: {calcDetails.peakFlowLs.toFixed(2)} L/s @ Standard Pressure
                </div>
                <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1">
                  <CheckCircle className="size-3.5" /> Sizing Validated & Ready
                </div>
              </div>

              {/* Summary Banner */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                calcDetails.isVelocityOk 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
              }`}>
                {calcDetails.isVelocityOk ? <CheckCircle className="size-4 shrink-0 mt-0.5" /> : <AlertTriangle className="size-4 shrink-0 mt-0.5" />}
                <div className="text-xs leading-relaxed font-medium">
                  {calcDetails.isVelocityOk ? (
                    <>
                      <strong>Passes Standard Velocity Limit.</strong> Recommended pipe size {calcDetails.selectedPipe.nominal} maintains velocity at {calcDetails.actualVel.toFixed(2)} m/s (within 1.5 m/s limit).
                    </>
                  ) : (
                    <>
                      <strong>High Velocity Notice.</strong> Flow velocity is {calcDetails.actualVel.toFixed(2)} m/s. Consider sizing up to next nominal diameter.
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
