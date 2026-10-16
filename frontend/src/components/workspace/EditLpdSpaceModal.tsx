import React, { useState, useMemo, useEffect } from "react";
import { X, Info, CheckCircle, Flame, Lightbulb, AlertTriangle } from "lucide-react";
import {
  type LpdSpace,
  type LightFixture,
  LPD_AUTHORITY_MAPPING,
  DEFAULT_AUTHORITY_MAPPING_SQM,
  generateId,
} from "@/lib/calc-lpd-calculation";
import { LpdCategorySelect } from "./LpdCategorySelect";
import { FloorSelect } from "./FloorSelect";

interface EditLpdSpaceModalProps {
  space: LpdSpace;
  groupId: string;
  groupName: string;
  isNew?: boolean;
  onClose: () => void;
  onSave: (updatedSpace: LpdSpace, targetGroupId: string) => void;
  availableGroups: Array<{ id: string; name: string }>;
  unitSystem?: "si" | "ip";
}

export function EditLpdSpaceModal({
  space,
  groupId,
  groupName,
  isNew = false,
  onClose,
  onSave,
  availableGroups,
  unitSystem = "si",
}: EditLpdSpaceModalProps) {
  const [tempSpace, setTempSpace] = useState<LpdSpace>({
    ...space,
    fixtures: space.fixtures && space.fixtures.length > 0
      ? space.fixtures.map((f) => ({ ...f }))
      : [{ id: generateId(), type: "LED Recessed 600x600", watts: "36", qty: "4" }],
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupId);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  useEffect(() => {
    document.body.classList.add("modal-open-blur");
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, []);

  const handleInputChange = (field: keyof LpdSpace, value: any) => {
    setTempSpace((prev) => ({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (category: string) => {
    let baselineVal = LPD_AUTHORITY_MAPPING[category] ?? DEFAULT_AUTHORITY_MAPPING_SQM[category] ?? 0.72;
    if (unitSystem === "ip") {
      baselineVal = Number((baselineVal / 10.7639).toFixed(3));
    }
    setTempSpace((prev) => ({
      ...prev,
      areaType: category,
      baselineLpd: String(baselineVal),
    }));
  };

  const handleFixtureChange = (fIndex: number, field: keyof LightFixture, val: string) => {
    setTempSpace((prev) => {
      const nextFixtures = [...prev.fixtures];
      nextFixtures[fIndex] = { ...nextFixtures[fIndex], [field]: val };
      return { ...prev, fixtures: nextFixtures };
    });
  };

  // Calculations Preview
  const calcs = useMemo(() => {
    const totalWatts = tempSpace.fixtures.reduce((sum, f) => {
      const w = parseFloat(f.watts) || 0;
      const q = parseFloat(f.qty) || 0;
      return sum + w * q;
    }, 0);

    const areaVal = parseFloat(tempSpace.areaSqM) || 0;
    const proposedLpd = areaVal > 0 ? totalWatts / areaVal : 0;
    const baselineLpd = parseFloat(tempSpace.baselineLpd) || 0;
    const isCompliant = baselineLpd > 0 ? proposedLpd <= baselineLpd : true;
    const diff = baselineLpd - proposedLpd;
    const percentSavings = baselineLpd > 0 ? (diff / baselineLpd) * 100 : 0;

    return {
      totalWatts,
      areaVal,
      proposedLpd,
      baselineLpd,
      isCompliant,
      diff,
      percentSavings,
    };
  }, [tempSpace.fixtures, tempSpace.areaSqM, tempSpace.baselineLpd]);

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
        {/* Header */}
        <header className="px-5 h-14 flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <h2 className="text-[14.5px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
              {isNew ? "Add Space & Lighting" : "Edit LPD Space Parameters"}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {tempSpace.name || "Space"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
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
              type="button"
              onClick={onClose}
              className="size-8 grid place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Content body split into Form inputs and Calculations preview */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Form inputs (Left side) */}
          <div className="flex-1 min-w-0 p-5 space-y-4 overflow-y-auto custom-scrollbar">
            {/* General Info */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> General Parameters
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Floor Level</label>
                  <FloorSelect
                    value={availableGroups.find((g) => g.id === selectedGroupId)?.name || selectedGroupId}
                    onChange={(fl) => {
                      const matched = availableGroups.find((g) => g.name.toLowerCase() === fl.toLowerCase());
                      setSelectedGroupId(matched ? matched.id : fl);
                    }}
                    availableFloors={availableGroups.map((g) => g.name)}
                    triggerClassName="h-9 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[12px]"
                  />
                </div>
                <div>
                  <label className={labelClass}>Space Name</label>
                  <input
                    type="text"
                    value={tempSpace.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Office Space 1"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>ASHRAE 90.1 Space Classification</label>
                <LpdCategorySelect
                  value={tempSpace.areaType || ""}
                  onChange={handleCategoryChange}
                  unitSystem={unitSystem}
                  triggerClassName="w-full bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 w-full outline-none cursor-pointer transition-all text-foreground h-9 text-[12px]"
                />
              </div>
            </div>

            {/* Geometry */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Spatial Area &amp; Baseline
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Floor Area ({unitSystem === "si" ? "m²" : "ft²"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={tempSpace.areaSqM}
                    onChange={(e) => handleInputChange("areaSqM", e.target.value)}
                    className={`${inputClass} font-mono`}
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Baseline LPD ({unitSystem === "si" ? "W/m²" : "W/ft²"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={tempSpace.baselineLpd}
                    onChange={(e) => handleInputChange("baselineLpd", e.target.value)}
                    className={`${inputClass} font-mono`}
                    placeholder="0.72"
                  />
                </div>
              </div>
            </div>

            {/* Fixture Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" /> Installed Lighting Fixtures
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setTempSpace((prev) => ({
                      ...prev,
                      fixtures: [
                        ...prev.fixtures,
                        { id: generateId(), type: "LED Downlight", watts: "18", qty: "6" },
                      ],
                    }))
                  }
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  + Add Fixture Row
                </button>
              </div>

              <div className="space-y-2">
                {tempSpace.fixtures.map((f, idx) => (
                  <div key={f.id || idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <input
                        type="text"
                        value={f.type}
                        onChange={(e) => handleFixtureChange(idx, "type", e.target.value)}
                        placeholder="Fixture type..."
                        className={inputClass}
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="any"
                        value={f.watts}
                        onChange={(e) => handleFixtureChange(idx, "watts", e.target.value)}
                        placeholder="Watts (W)"
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={f.qty}
                        onChange={(e) => handleFixtureChange(idx, "qty", e.target.value)}
                        placeholder="Qty"
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {tempSpace.fixtures.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setTempSpace((prev) => ({
                              ...prev,
                              fixtures: prev.fixtures.filter((_, i) => i !== idx),
                            }))
                          }
                          className="size-7 grid place-items-center text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer transition"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <label className={labelClass}>Remarks / Notes</label>
              <input
                type="text"
                value={tempSpace.remarks || ""}
                onChange={(e) => handleInputChange("remarks", e.target.value)}
                className={inputClass}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          {/* Calculations preview (Right side) */}
          <div
            className={`shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
              showPreview ? "w-[360px] opacity-100 p-5 border-l-border" : "w-0 opacity-0 p-0 border-l-transparent"
            }`}
          >
            <div className="w-[320px] space-y-4 flex flex-col h-full overflow-y-auto custom-scrollbar">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0 flex items-center gap-1.5">
                <Flame className="size-3.5" /> Calculations Preview
              </h3>

              {/* Total Watts Card */}
              <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2 shrink-0 shadow-xs font-mono text-[11px]">
                <div className="text-[9.5px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                  Total Connected Lighting Power
                </div>
                <div className="flex justify-between items-baseline border-b border-black/5 dark:border-white/5 pb-1">
                  <span className="text-neutral-500 dark:text-neutral-400">Total Watts:</span>
                  <span className="font-bold text-foreground">{calcs.totalWatts.toLocaleString()} W</span>
                </div>
                <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 leading-normal">
                  Σ (Fixture Watts × Quantity)
                </div>
              </div>

              {/* LPD Calculations Summary */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Lighting Power Density (LPD)
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Proposed LPD:</span>
                      <span
                        className={`font-mono font-bold text-[13.5px] ${
                          calcs.isCompliant ? "text-primary" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {calcs.proposedLpd.toFixed(2)} {unitSystem === "si" ? "W/m²" : "W/ft²"}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5">
                      {calcs.totalWatts} W ÷ {calcs.areaVal || 0} {unitSystem === "si" ? "m²" : "ft²"}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                        Baseline Limit (ASHRAE 90.1):
                      </span>
                      <span className="font-mono font-bold text-[13px] text-neutral-700 dark:text-neutral-300">
                        {calcs.baselineLpd.toFixed(2)} {unitSystem === "si" ? "W/m²" : "W/ft²"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                        Energy Margin / Savings:
                      </span>
                      <span
                        className={`font-mono font-bold text-[13px] ${
                          calcs.diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {calcs.diff >= 0 ? "+" : ""}
                        {calcs.diff.toFixed(2)} ({calcs.percentSavings.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation / Compliance Status */}
              <div
                className={`shrink-0 p-3 rounded-xl flex items-start gap-2 text-[11.5px] shadow-xs border ${
                  calcs.isCompliant
                    ? "bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 dark:bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400"
                }`}
              >
                {calcs.isCompliant ? (
                  <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-rose-500" />
                )}
                <div>
                  <span className="font-semibold">
                    {calcs.isCompliant ? "Compliant with ASHRAE 90.1." : "Exceeds Baseline Allowance."}
                  </span>{" "}
                  {calcs.isCompliant
                    ? "Installed lighting satisfies energy conservation requirements."
                    : "Reduce fixture count or wattage to achieve compliance."}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 h-14 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-lg text-[12px] font-medium transition-colors cursor-pointer shadow-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(tempSpace, selectedGroupId)}
            className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            {isNew ? "Add Space" : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
