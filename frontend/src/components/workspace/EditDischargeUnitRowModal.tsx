import React, { useState, useMemo } from "react";
import { X, Info, CheckCircle, AlertTriangle, Droplets, Calculator, Building2 } from "lucide-react";
import { DU_FIXTURES_META } from "@/lib/calc-plumbing-discharge-unit";

export interface EditDischargeUnitRowModalProps {
  space: {
    id: number;
    desc: string;
    floor: string;
    std: string;
    fixtures: Record<string, number>;
  };
  rowIndex?: number;
  floorName?: string;
  weightOverrides: Record<string, number>;
  onClose: () => void;
  onSave: (updated: { desc: string; floor: string; std: string; fixtures: Record<string, number> }) => void;
}

export function EditDischargeUnitRowModal({
  space,
  rowIndex = 1,
  floorName = "1F",
  weightOverrides,
  onClose,
  onSave,
}: EditDischargeUnitRowModalProps) {
  const [desc, setDesc] = useState(space.desc || "");
  const [floor, setFloor] = useState(space.floor || floorName || "1F");
  const [std, setStd] = useState(space.std || "total-du");
  const [fixtures, setFixtures] = useState<Record<string, number>>({ ...space.fixtures });
  const [showPreview, setShowPreview] = useState(true);

  // Calculate Unit DU for this space
  const unitDUBreakdown = useMemo(() => {
    const activeItems: Array<{ id: string; short: string; count: number; unitDU: number; totalDU: number; isBlack: boolean }> = [];
    let sumTotal = 0;
    let sumBlack = 0;
    let sumGrey = 0;

    DU_FIXTURES_META.forEach((f) => {
      const count = Number(fixtures[f.id]) || 0;
      const defaultWeights: Record<string, number> = {
        wc: 4,
        urinal: 0.3,
        basin: 1,
        bath: 10,
        shower: 5,
        sink: 3,
        bibtap: 1,
        laundry: 4,
        catchbasin: 2,
      };
      const unitDU = weightOverrides[f.id] !== undefined ? weightOverrides[f.id] : (defaultWeights[f.id] ?? 1);
      if (count > 0) {
        const itemTotal = count * unitDU;
        const isBlack = f.id === "wc" || f.id === "urinal";
        sumTotal += itemTotal;
        if (isBlack) {
          sumBlack += itemTotal;
        } else {
          sumGrey += itemTotal;
        }
        activeItems.push({
          id: f.id,
          short: f.short,
          count,
          unitDU,
          totalDU: itemTotal,
          isBlack,
        });
      }
    });

    const formulaStr = activeItems.length > 0
      ? activeItems.map((item) => `${item.count} (${item.short}) × ${item.unitDU}`).join(" + ")
      : "0 D.U. (No fixtures assigned)";

    return {
      sumTotal,
      sumBlack,
      sumGrey,
      formulaStr,
      items: activeItems,
    };
  }, [fixtures, weightOverrides]);

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
                Edit Discharge Unit Space Parameters
              </h2>
              <span className="px-2.5 py-0.75 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold font-mono tracking-tight truncate shrink-0">
                Row #{rowIndex}: {desc || "Space"} ({floor} : Fixture Schedule)
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
              Configure fixture counts, drainage categorization (Black / Grey Water), and view live calculation breakdown.
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
                  Space Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>Description / Space Name</span>
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="e.g. 1F Female Washroom"
                    className="w-full h-9 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12.5px] font-medium outline-none transition-all text-neutral-800 dark:text-neutral-100"
                  />
                </div>

                <div>
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

                <div>
                  <label className={labelClass}>
                    <span>Standard Type</span>
                  </label>
                  <select
                    value={std}
                    onChange={(e) => setStd(e.target.value)}
                    className="w-full h-9 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-[12px] font-semibold outline-none transition-all cursor-pointer"
                  >
                    <option value="total-du">Total D.U. (Black + Grey)</option>
                    <option value="black-water">Black Water Only</option>
                    <option value="grey-water">Grey Water Only</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Fixtures Grid Section */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <Droplets className="size-4 text-primary" />
                  <h3 className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                    Drainage Fixture Schedule
                  </h3>
                </div>
                <span className="text-[10.5px] font-mono text-muted-foreground">
                  Fixture Quantity Count
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DU_FIXTURES_META.map((f) => {
                  const currentCount = fixtures[f.id] || 0;
                  const defaultWeights: Record<string, number> = {
                    wc: 4, urinal: 0.3, basin: 1, bath: 10, shower: 5, sink: 3, bibtap: 1, laundry: 4, catchbasin: 2
                  };
                  const unitWeight = weightOverrides[f.id] !== undefined ? weightOverrides[f.id] : (defaultWeights[f.id] ?? 1);
                  const isBlack = f.id === "wc" || f.id === "urinal";

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
                        <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 truncate" title={f.short}>
                          {f.short}
                        </label>
                        <span className={`text-[9.5px] font-bold px-1 py-0.2 rounded font-mono ${
                          isBlack ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {unitWeight} DU
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
                  <span className="text-[11.5px] font-semibold text-muted-foreground">Total Space DU:</span>
                  <span className="text-base font-extrabold font-mono text-primary">
                    {unitDUBreakdown.sumTotal.toFixed(1)} D.U.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-red-500/5 border border-red-500/20 rounded-xl flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Black Water DU</span>
                    <span className="text-sm font-extrabold font-mono text-red-700 dark:text-red-300">
                      {unitDUBreakdown.sumBlack.toFixed(1)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Grey Water DU</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                      {unitDUBreakdown.sumGrey.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Formula Breakdown */}
              <div className="space-y-2">
                <label className="text-[10.5px] font-bold text-neutral-500 uppercase tracking-wider">
                  Formula Breakdown
                </label>
                <div className="p-3 bg-slate-100/70 dark:bg-slate-900/60 rounded-xl border border-border/60 text-[11px] font-mono text-muted-foreground leading-relaxed break-words">
                  {unitDUBreakdown.formulaStr} = <strong className="text-foreground">{unitDUBreakdown.sumTotal.toFixed(1)} D.U.</strong>
                </div>
              </div>

              {/* Fixture Contribution List */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-neutral-500 uppercase tracking-wider">
                  Active Fixtures ({unitDUBreakdown.items.length})
                </label>
                {unitDUBreakdown.items.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No fixtures specified.</p>
                ) : (
                  <div className="space-y-1">
                    {unitDUBreakdown.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-[11px] py-1 border-b border-border/40 font-mono">
                        <span className="text-foreground">{it.short} ({it.count}×{it.unitDU})</span>
                        <span className={`font-bold ${it.isBlack ? "text-red-600" : "text-emerald-600"}`}>
                          +{it.totalDU.toFixed(1)} DU
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
