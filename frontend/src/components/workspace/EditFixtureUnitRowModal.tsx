import React, { useState, useMemo } from "react";
import { X, Info, CheckCircle, AlertTriangle, Droplets, Calculator, Building2, Sliders, Layers } from "lucide-react";
import {
  FU_FIXTURES_META,
  IP_FIXTURE_UNITS,
  type StandardPreset,
  STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY,
  STANDARD_FIXTURE_WEIGHTS,
  DEFAULT_CATEGORY_FOR_PRESET,
  getFlowLPS,
  getRecommendedPipeSize
} from "@/lib/calc-plumbing-fixture-unit";

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
      return "Dubai DBC (Q = 0.10 × √(Total WSFU))";
    case "abudhabi":
      return "Abu Dhabi ADM Table 6-9 Lookup";
    default:
      return "Standard Plumbing Lookup";
  }
}

export interface EditFixtureUnitRowModalProps {
  space: {
    id: number;
    desc: string;
    floor: string;
    std?: string;
    qty?: number;
    floorQty?: number;
    fixtures: Record<string, number>;
  };
  rowIndex?: number;
  floorName?: string;
  standardPreset?: StandardPreset;
  weightOverrides?: Record<string, number>;
  activeWeights?: Record<string, number>;
  unitSystem?: "si" | "ip";
  showSpaceQty?: boolean;
  showFloorsCol?: boolean;
  onClose: () => void;
  onSave: (updated: {
    desc: string;
    floor: string;
    std: string;
    qty: number;
    floorQty: number;
    fixtures: Record<string, number>;
  }) => void;
}

export function EditFixtureUnitRowModal({
  space,
  rowIndex = 1,
  floorName = "1F",
  standardPreset = "ipc_upc",
  weightOverrides = {},
  activeWeights,
  unitSystem = "si",
  showSpaceQty = true,
  showFloorsCol = true,
  onClose,
  onSave,
}: EditFixtureUnitRowModalProps) {
  const [desc, setDesc] = useState(space.desc || "");
  const [floor, setFloor] = useState(space.floor || floorName || "1F");
  const [std, setStd] = useState(space.std || DEFAULT_CATEGORY_FOR_PRESET[standardPreset] || "ipc_total");
  const [qty, setQty] = useState<number>(space.qty || 1);
  const [floorQty, setFloorQty] = useState<number>(space.floorQty || 1);
  const [fixtures, setFixtures] = useState<Record<string, number>>({ ...space.fixtures });
  const [showPreview, setShowPreview] = useState(true);

  const isWsfu = standardPreset === "abudhabi" || standardPreset === "ipc_upc" || standardPreset === "ipc" || standardPreset === "upc";
  const unitLabel = isWsfu ? "WSFU" : "LU";

  // Compute active weights for this category
  const resolvedWeights = useMemo(() => {
    if (activeWeights && Object.keys(activeWeights).length > 0) {
      return activeWeights;
    }
    const catDict = STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY[standardPreset];
    const defaultCat = DEFAULT_CATEGORY_FOR_PRESET[standardPreset];
    const baseWeights = catDict?.[std] || catDict?.[defaultCat] || STANDARD_FIXTURE_WEIGHTS[standardPreset] || {};
    return { ...baseWeights, ...weightOverrides };
  }, [standardPreset, std, weightOverrides, activeWeights]);

  // Calculate Unit WSFU breakdown for this space
  const unitWSFUBreakdown = useMemo(() => {
    const activeItems: Array<{ id: string; short: string; label: string; count: number; unitFU: number; totalFU: number }> = [];
    let sumUnit = 0;

    FU_FIXTURES_META.forEach((f) => {
      const count = Number(fixtures[f.id]) || 0;
      const unitFU = resolvedWeights[f.id] !== undefined
        ? resolvedWeights[f.id]
        : (IP_FIXTURE_UNITS[f.id]?.[std] ?? 1);

      if (count > 0) {
        const itemTotal = count * unitFU;
        sumUnit += itemTotal;
        activeItems.push({
          id: f.id,
          short: f.short,
          label: f.label,
          count,
          unitFU,
          totalFU: itemTotal,
        });
      }
    });

    const spaceMultiplier = showSpaceQty ? Math.max(1, qty || 1) : 1;
    const floorMultiplier = showFloorsCol ? Math.max(1, floorQty || 1) : 1;
    const totalWSFU = sumUnit * spaceMultiplier * floorMultiplier;

    const formulaStr = activeItems.length > 0
      ? activeItems.map((item) => `${item.count} (${item.short}) × ${item.unitFU}`).join(" + ")
      : `0 ${unitLabel} (No fixtures assigned)`;

    return {
      sumUnit,
      totalWSFU,
      formulaStr,
      items: activeItems,
    };
  }, [fixtures, resolvedWeights, std, qty, floorQty, showSpaceQty, showFloorsCol, unitLabel]);

  // Pipe Sizing Recommendation based on Loading Unit sizing table
  const pipeRecommendation = useMemo(() => {
    const flowLPS = getFlowLPS(unitWSFUBreakdown.totalWSFU, standardPreset);
    const flowGPM = flowLPS * 15.8503;
    const sizing = getRecommendedPipeSize(unitWSFUBreakdown.totalWSFU, flowLPS);
    const sizeInch = sizing.sizeMM <= 15 ? "½\"" : sizing.sizeMM <= 20 ? "¾\"" : sizing.sizeMM <= 25 ? "1\"" : sizing.sizeMM <= 32 ? "1¼\"" : sizing.sizeMM <= 40 ? "1½\"" : sizing.sizeMM <= 50 ? "2\"" : sizing.sizeMM <= 65 ? "2½\"" : sizing.sizeMM <= 80 ? "3\"" : sizing.sizeMM <= 100 ? "4\"" : sizing.sizeMM <= 150 ? "6\"" : "8\"";
    return {
      sizeMM: sizing.sizeMM,
      sizeInch,
      flowLPS,
      flowGPM
    };
  }, [unitWSFUBreakdown.totalWSFU, standardPreset]);

  const handleFixtureCountChange = (fixtureId: string, val: number) => {
    setFixtures((prev) => ({
      ...prev,
      [fixtureId]: Math.max(0, val),
    }));
  };

  const handleSave = () => {
    onSave({
      desc,
      floor,
      std,
      qty: Math.max(1, qty || 1),
      floorQty: Math.max(1, floorQty || 1),
      fixtures,
    });
    onClose();
  };

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center justify-between";
  const inputClass = "w-full h-9 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12px] outline-none transition-all duration-150 text-neutral-800 dark:text-neutral-100 font-mono";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 p-4 animate-fade-in">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className={`bg-white/90 dark:bg-neutral-950/90 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full max-h-[90vh] overflow-hidden transition-all duration-300 ease-in-out ${
          showPreview ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        {/* Header */}
        <header className="px-6 h-[72px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <div className="flex flex-col justify-center min-w-0 pr-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-[15px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
                Edit Fixture Unit Space Parameters
              </h2>
              <span className="px-2.5 py-0.75 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold font-mono tracking-tight truncate shrink-0">
                Row #{rowIndex}: {desc || "Space"} ({floor} : Fixture Schedule)
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
              {getStandardFormulaLabel(standardPreset)} · Multiplier: Space Qty × No. of Floors
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
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
              type="button"
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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* General Section */}
            <section className="space-y-3.5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-black/5 dark:border-white/5">
                <Building2 className="size-4 text-primary" />
                <h3 className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                  Space Configuration
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-4">
                  <label className={labelClass}>
                    <span>Description / Space Name</span>
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="e.g. 1F Washroom Block A"
                    className="w-full h-9 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] font-medium outline-none transition-all text-neutral-800 dark:text-neutral-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>Floor Section</span>
                  </label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. 1F, Ground Floor"
                    className="w-full h-9 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12px] font-semibold text-muted-foreground outline-none transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>Standard Category</span>
                  </label>
                  <select
                    value={std}
                    onChange={(e) => setStd(e.target.value)}
                    className="w-full h-9 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12px] font-semibold outline-none transition-all cursor-pointer"
                  >
                    <option value="ipc_total">Total WSFU (IPC/UPC)</option>
                    <option value="ipc_cold">Cold Water WSFU</option>
                    <option value="ipc_hot">Hot Water WSFU</option>
                    <option value="low">Low Demand (Residential)</option>
                    <option value="med">Medium Demand (Commercial)</option>
                    <option value="high">High Demand (Public / Congested)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>Space Multiplier (Qty)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-9 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12px] font-bold outline-none transition-all text-foreground"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>No. of Floors (Floors Qty)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={floorQty}
                    onChange={(e) => setFloorQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-9 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12px] font-bold outline-none transition-all text-foreground"
                  />
                </div>
              </div>
            </section>

            {/* Fixtures Grid Section */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <Droplets className="size-4 text-primary" />
                  <h3 className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                    Water Supply Fixture Schedule
                  </h3>
                </div>
                <span className="text-[10.5px] font-mono text-muted-foreground">
                  Fixture Quantity Count
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FU_FIXTURES_META.map((f) => {
                  const currentCount = fixtures[f.id] || 0;
                  const unitWeight = resolvedWeights[f.id] !== undefined
                    ? resolvedWeights[f.id]
                    : (IP_FIXTURE_UNITS[f.id]?.[std] ?? 1);

                  return (
                    <div
                      key={f.id}
                      className={`p-2.5 rounded-xl border transition-all ${
                        currentCount > 0
                          ? "bg-primary/5 border-primary/25 shadow-2xs"
                          : "bg-white/20 dark:bg-white/5 border-black/5 dark:border-white/5 hover:border-black/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 truncate" title={f.label || f.short}>
                          {f.short}
                        </label>
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded font-mono bg-[#0A7BC7]/10 text-[#0A7BC7]">
                          {unitWeight} {unitLabel}
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={fixtures[f.id] || ""}
                        onChange={(e) => handleFixtureCountChange(f.id, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Calculations Preview Side Panel */}
          {showPreview && (
            <aside className="w-[340px] shrink-0 border-l border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 p-5 overflow-y-auto space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
                <Calculator className="size-4 text-primary" />
                <h3 className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                  Calculations Preview
                </h3>
              </div>

              {/* Total Summary Cards */}
              <div className="space-y-2">
                <div className="p-3 bg-card border border-border/80 rounded-xl flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-muted-foreground">Unit {unitLabel} (1 Space):</span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {unitWSFUBreakdown.sumUnit.toFixed(1)} {unitLabel}
                  </span>
                </div>

                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-primary">
                    Total {unitLabel} (×{qty} ×{floorQty}):
                  </span>
                  <span className="text-base font-extrabold font-mono text-primary">
                    {unitWSFUBreakdown.totalWSFU.toFixed(1)} {unitLabel}
                  </span>
                </div>

                <div className="p-3 bg-card border border-border/80 rounded-xl flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-muted-foreground">Estimated Flow:</span>
                  <span className="text-xs font-bold font-mono text-primary">
                    {unitSystem === "ip"
                      ? `${pipeRecommendation.flowGPM.toFixed(1)} GPM`
                      : `${pipeRecommendation.flowLPS.toFixed(3)} L/s`}
                  </span>
                </div>

                <div className="p-3 bg-card border border-border/80 rounded-xl flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-muted-foreground">Recommended Pipe:</span>
                  <span className="text-xs font-bold font-mono text-foreground">
                    {unitSystem === "ip"
                      ? pipeRecommendation.sizeInch
                      : `DN${pipeRecommendation.sizeMM} mm (${pipeRecommendation.sizeInch})`}
                  </span>
                </div>
              </div>

              {/* Formula Breakdown */}
              <div className="space-y-2">
                <label className="text-[10.5px] font-bold text-neutral-500 uppercase tracking-wider">
                  Formula Breakdown
                </label>
                <div className="p-3 bg-slate-100/70 dark:bg-slate-900/60 rounded-xl border border-border/60 text-[11px] font-mono text-muted-foreground leading-relaxed break-words">
                  {unitWSFUBreakdown.formulaStr} = <strong className="text-foreground">{unitWSFUBreakdown.sumUnit.toFixed(1)} {unitLabel}</strong>
                  {(qty > 1 || floorQty > 1) && (
                    <div className="mt-1 text-primary font-bold">
                      × {qty} (Qty) × {floorQty} (Floors) = {unitWSFUBreakdown.totalWSFU.toFixed(1)} Total {unitLabel}
                    </div>
                  )}
                </div>
              </div>

              {/* Fixture Contribution List */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-neutral-500 uppercase tracking-wider">
                  Active Fixtures ({unitWSFUBreakdown.items.length})
                </label>
                {unitWSFUBreakdown.items.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No fixtures specified.</p>
                ) : (
                  <div className="space-y-1">
                    {unitWSFUBreakdown.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-[11px] py-1 border-b border-border/40 font-mono">
                        <span className="text-foreground">{it.short} ({it.count}×{it.unitFU})</span>
                        <span className="font-bold text-primary">
                          +{it.totalFU.toFixed(1)} {unitLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 h-[64px] flex items-center justify-end gap-2.5 border-t border-black/5 dark:border-white/5 bg-white/20 dark:bg-black/20 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/95 shadow-md shadow-primary/20 rounded-xl transition-all cursor-pointer"
          >
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}
