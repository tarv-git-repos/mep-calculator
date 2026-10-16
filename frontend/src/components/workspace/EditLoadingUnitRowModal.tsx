import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, CheckCircle, AlertTriangle, Flame, Droplets, Calculator, Building2, Sliders, Layers } from "lucide-react";
import { type StandardPreset, getFlowLPS } from "@/lib/calc-plumbing-loading-unit";
import { FloorSelect } from "./FloorSelect";

export const LU_FIXTURES_META = [
  { id: 'wc', short: 'W/C', label: 'Water Closet (W/C)' },
  { id: 'handspray', short: 'Hand Spray', label: 'Hand Spray / Bidet Bibb' },
  { id: 'basin', short: 'Wash Basin', label: 'Wash Basin (LAV)' },
  { id: 'sink', short: 'Kitchen Sink', label: 'Kitchen Sink' },
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
  isNew?: boolean;
  availableFloors?: string[];
  rowIndex?: number;
  floorName?: string;
  floor?: string;
  standardPreset?: StandardPreset;
  activeWeights?: Record<string, number>;
  currentWeights?: Record<string, number>;
  showSpaceQty?: boolean;
  showFloorsCol?: boolean;
  onClose: () => void;
  onSave: (updated: { desc: string; floor?: string; fixtures: Record<string, number>; qty: number; floorQty: number }) => void;
  onChange?: (updated: { desc: string; floor?: string; fixtures: Record<string, number>; qty: number; floorQty: number }) => void;
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
  isNew = false,
  availableFloors,
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
  onChange,
  onDelete,
}: EditLoadingUnitRowModalProps) {
  const effectiveWeights = activeWeights || currentWeights || {};
  const effectiveFloor = floor || floorName || space.floor || "GROUND FLOOR";
  const [desc, setDesc] = useState(space.desc || (isNew ? `New Space` : ""));
  const [selectedFloor, setSelectedFloor] = useState<string>(effectiveFloor);
  const [qty, setQty] = useState<number>(space.qty || 1);
  const [floorQty, setFloorQty] = useState<number>(space.floorQty || 1);
  const [fixtures, setFixtures] = useState<Record<string, number>>({ ...space.fixtures });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    document.body.classList.add("modal-open-blur");
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, []);

  useEffect(() => {
    const isReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly);
    if (isReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
      : `0 ${unitLabel} (No fixtures entered)`;

    return {
      sum,
      formulaStr,
      items: activeItems,
    };
  }, [fixtures, effectiveWeights, unitLabel]);

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
      desc: desc.trim() || (isNew ? "New Space" : space.desc),
      floor: selectedFloor,
      fixtures,
      qty,
      floorQty,
    });
    onClose();
  };

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5";
  const inputClass = "w-full h-9 px-3 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";
  const selectClass = "w-full h-9 px-2.5 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/20 dark:bg-black/50 p-4 animate-fade-in font-sans">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className={`bg-white/80 dark:bg-neutral-950/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-h-[88vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
          showPreview ? "max-w-4xl" : "max-w-xl"
        }`}
      >
        {/* Header - Matching Ventilation EditSpaceModal Format */}
        <header className="px-5 h-14 flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <h2 className="text-[14.5px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
              {isNew ? "Add Space Parameters" : "Edit Space Parameters"}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {isNew ? (selectedFloor || "New Space") : (desc || `Row #${rowIndex}`)}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <button
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
              onClick={onClose}
              className="size-8 grid place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Modal Body: Split into Form Inputs and Live Calculations Preview */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Form Inputs (Left side) */}
          <div className="flex-1 min-w-0 p-5 space-y-4 overflow-y-auto custom-scrollbar">
            {/* Section 1: General Parameters */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> General Parameters
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Space Name / Description</label>
                  <input
                    type="text"
                    value={desc}
                    onChange={(e) => { const v = e.target.value; setDesc(v); onChange?.({ desc: v, floor: selectedFloor, fixtures, qty, floorQty }); }}
                    placeholder="e.g. Toilet Group 1 / Office Space"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Floor Section</label>
                  <FloorSelect
                    value={selectedFloor}
                    onChange={(fl) => {
                      setSelectedFloor(fl);
                      onChange?.({ desc, floor: fl, fixtures, qty, floorQty });
                    }}
                    availableFloors={availableFloors}
                    triggerClassName="h-9 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[12px] font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Fixture Schedule Inputs */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Fixture Schedule &amp; Assigned Weights ({unitLabel})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {LU_FIXTURES_META.map((f) => {
                  const weight = effectiveWeights[f.id] ?? 0;
                  const count = fixtures[f.id] || 0;
                  return (
                    <div key={f.id} className="p-2.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
                        <span className="truncate" title={f.label}>{f.short}</span>
                        <span className="px-1.5 py-0.25 rounded bg-primary/10 text-primary text-[9px] font-mono font-bold shrink-0">
                          {weight} {unitLabel}
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={count || ""}
                        placeholder="0"
                        onChange={(e) => handleFixtureCountChange(f.id, e.target.value !== "" ? Number(e.target.value) : 0)}
                        className="w-full h-8 px-2.5 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg text-[12px] font-mono font-bold text-neutral-800 dark:text-neutral-100 outline-none transition-all"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Quantity Multipliers */}
            <div className="space-y-3 pt-1">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Space Multipliers &amp; Floor Replication
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Space Qty (Per Floor)</label>
                  <input
                    type="number"
                    min="1"
                    disabled={!showSpaceQty}
                    value={showSpaceQty ? qty : 1}
                    onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setQty(v); onChange?.({ desc, floor: selectedFloor, fixtures, qty: v, floorQty }); }}
                    className={`${inputClass} font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className={labelClass}>No. of Typical Floors</label>
                  <input
                    type="number"
                    min="1"
                    disabled={!showFloorsCol}
                    value={showFloorsCol ? floorQty : 1}
                    onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setFloorQty(v); onChange?.({ desc, floor: selectedFloor, fixtures, qty, floorQty: v }); }}
                    className={`${inputClass} font-mono font-bold`}
                  />
                </div>
              </div>
            </div>

            {/* Quick Sizing Metric Card (when preview is collapsed) */}
            {!showPreview && (
              <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2 shrink-0 shadow-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-neutral-500 dark:text-neutral-400">Total Loading Units ({unitLabel}):</span>
                  <span className="font-mono font-bold text-primary text-[13px]">{calcDetails.totalLU.toFixed(1)} {unitLabel}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold border-t border-black/5 dark:border-white/5 pt-1.5">
                  <span className="text-neutral-500 dark:text-neutral-400">Design Peak Flow Rate:</span>
                  <span className="font-mono font-bold text-foreground text-[12px]">{calcDetails.peakFlowLs.toFixed(2)} L/s ({calcDetails.peakFlowGpm.toFixed(1)} GPM)</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold border-t border-black/5 dark:border-white/5 pt-1.5">
                  <span className="text-neutral-500 dark:text-neutral-400">Recommended Pipe Size:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[12px]">{calcDetails.selectedPipe.nominal} ({calcDetails.actualVel.toFixed(2)} m/s)</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Live Calculations Preview Panel (Matching Ventilation Format) */}
          <div
            className={`shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
              showPreview ? "w-[360px] opacity-100 p-5 border-l-border" : "w-0 opacity-0 p-0 border-l-transparent"
            }`}
          >
            <div className="w-[320px] space-y-4 flex flex-col h-full overflow-y-auto custom-scrollbar">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0 flex items-center gap-1.5">
                <Flame className="size-3.5" /> Calculations Preview
              </h3>

              {/* Standard Lookup Reference Card */}
              <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2.5 shrink-0 shadow-xs">
                <div className="text-[9.5px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                  Standard Sizing Model
                </div>
                <div className="text-[12px] font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                  <Calculator className="size-3.5 text-primary" />
                  <span>{getStandardFormulaLabel(standardPreset)}</span>
                </div>
                <div className="text-[10.5px] font-mono text-neutral-500 dark:text-neutral-400 leading-relaxed bg-white/30 dark:bg-black/30 p-2 rounded-lg border border-black/5 dark:border-white/5">
                  Total {unitLabel} = Unit {unitLabel} × Space Qty ({calcDetails.spaceMultiplier}) × Floors ({calcDetails.floorMultiplier})
                </div>
              </div>

              {/* Calculations Summary Card */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Demand &amp; Pipe Flow Calculations
                  </div>

                  {/* Step 1: Unit LU */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Unit {unitLabel}:</span>
                      <span className="font-mono font-bold text-[13.5px] text-primary">
                        {calcDetails.unitLU.toFixed(1)} {unitLabel}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {unitLUBreakdown.formulaStr}
                    </div>
                  </div>

                  {/* Step 2: Total LU */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Total Space {unitLabel}:</span>
                      <span className="font-mono font-bold text-[13.5px] text-primary">
                        {calcDetails.totalLU.toFixed(1)} {unitLabel}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {calcDetails.unitLU.toFixed(1)} × {calcDetails.spaceMultiplier} × {calcDetails.floorMultiplier} = {calcDetails.totalLU.toFixed(1)} {unitLabel}
                    </div>
                  </div>

                  {/* Step 3: Peak Flow Rate */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Design Peak Flow (Q):</span>
                      <span className="font-mono font-bold text-[13.5px] text-amber-600 dark:text-amber-500">
                        {calcDetails.peakFlowLs.toFixed(2)} L/s
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      Equivalent to {calcDetails.peakFlowGpm.toFixed(1)} GPM ({calcDetails.selectedPipe.nominal} pipe)
                    </div>
                  </div>

                  {/* Step 4: Pipe Sizing Velocity */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Pipe Velocity (v):</span>
                      <span className={`font-mono font-bold text-[13px] ${calcDetails.isVelocityOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {calcDetails.actualVel.toFixed(2)} m/s
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      Target limit ≤ 1.50 m/s ({calcDetails.isVelocityOk ? "Passes criteria" : "Consider sizing up"})
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Status Info Badge */}
              <div className={`shrink-0 p-3 rounded-xl border flex items-start gap-2 text-[11.5px] shadow-xs ${
                calcDetails.isVelocityOk 
                  ? "bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/20 dark:border-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/20 dark:border-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}>
                {calcDetails.isVelocityOk ? (
                  <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
                )}
                <div>
                  <span className="font-semibold">{calcDetails.isVelocityOk ? "Calculations verified." : "Notice:"}</span>{" "}
                  {calcDetails.isVelocityOk 
                    ? `Pipe diameter ${calcDetails.selectedPipe.nominal} satisfies peak flow criteria.` 
                    : `Velocity at ${calcDetails.actualVel.toFixed(2)} m/s exceeds 1.5 m/s threshold.`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Matching Ventilation EditSpaceModal Format */}
        <footer className="px-5 h-14 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-lg text-[12px] font-medium transition-colors cursor-pointer shadow-xs"
            >
              Cancel
            </button>
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="h-9 px-3.5 border border-red-500/20 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-[12px] font-medium transition-colors cursor-pointer shadow-xs"
              >
                Delete Space
              </button>
            )}
          </div>
          <button
            onClick={handleSave}
            className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            {isNew ? "Create Space" : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
