import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { X, Info, Flame, CheckCircle, Wind } from "lucide-react";
import { FloorSelect } from "./FloorSelect";
import {
  type DiffuserRowItem,
  type DiffuserType,
  DIFFUSER_NAMES,
  DIFFUSER_DATA,
  computeRowSizing,
  computeAirflowFromKw
} from "@/lib/calc-diffuser";

interface EditDiffuserSpaceModalProps {
  space: DiffuserRowItem;
  isNew?: boolean;
  onClose: () => void;
  onSave: (updatedSpace: DiffuserRowItem) => void;
  availableFloors: string[];
  unitSystem?: "si" | "ip";
}

export function EditDiffuserSpaceModal({
  space,
  isNew = false,
  onClose,
  onSave,
  availableFloors,
  unitSystem = "si"
}: EditDiffuserSpaceModalProps) {
  const isIp = unitSystem === "ip";
  const [formData, setFormData] = useState<DiffuserRowItem>({ ...space });
  const [showPreview, setShowPreview] = useState(false);

  // Background blur effect
  useEffect(() => {
    document.body.classList.add("modal-open-blur");
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, []);

  // Update formData if space prop changes
  useEffect(() => {
    setFormData({ ...space });
  }, [space]);

  const handleInputChange = (field: keyof DiffuserRowItem, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      // If user modifies cooling kW or delta T, auto compute airflow
      if (field === "coolingKw" || field === "deltaT") {
        const kw = field === "coolingKw" ? Number(value) : Number(prev.coolingKw);
        const dt = field === "deltaT" ? Number(value) : (prev.deltaT !== "" ? Number(prev.deltaT) : (isIp ? 18 : 10));
        if (kw > 0 && dt > 0) {
          const flowRes = computeAirflowFromKw(kw, dt, isIp, "air", 20);
          next.airflow = flowRes.flowRate;
        }
      }

      return next;
    });
  };

  // Live calculation preview
  const sizing = useMemo(() => {
    return computeRowSizing(formData, isIp);
  }, [formData, isIp]);

  const labelClass =
    "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5";
  const inputClass =
    "w-full h-9 px-3 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";
  const selectClass =
    "w-full h-9 px-2.5 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/20 dark:bg-black/50 p-4 animate-fade-in font-sans"
    >
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
              {isNew ? "Add Diffuser Space" : "Edit Diffuser Parameters"}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {formData.name || "Diffuser Space"}
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
                  <label className={labelClass}>Space Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Executive Office 101"
                  />
                </div>
                <div>
                  <label className={labelClass}>Floor / Level</label>
                  <FloorSelect
                    value={formData.floor || "GF"}
                    onChange={(fl) => handleInputChange("floor", fl)}
                    availableFloors={availableFloors}
                    triggerClassName="h-9 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[12px]"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Zone / Thermal Group</label>
                <input
                  type="text"
                  value={formData.zone}
                  onChange={(e) => handleInputChange("zone", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. North Perimeter Zone"
                />
              </div>
            </div>

            {/* Thermal Load & Airflow Sizing */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Airflow & Thermal Load
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Cooling Load (kW) <span className="text-[9px] font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.coolingKw ?? ""}
                    onChange={(e) =>
                      handleInputChange("coolingKw", e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className={inputClass}
                    placeholder="e.g. 5.5"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Supply ΔT ({isIp ? "°F" : "°C"})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={formData.deltaT ?? ""}
                    onChange={(e) =>
                      handleInputChange("deltaT", e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className={inputClass}
                    placeholder={isIp ? "18" : "10"}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Design Airflow ({isIp ? "CFM" : "L/s"})
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.airflow ?? ""}
                  onChange={(e) =>
                    handleInputChange("airflow", e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className={inputClass}
                  placeholder={isIp ? "e.g. 450" : "e.g. 210"}
                />
              </div>
            </div>

            {/* Terminal Configuration */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Diffuser Terminal Config
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Diffusers (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.count ?? ""}
                    onChange={(e) =>
                      handleInputChange("count", e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className={inputClass}
                    placeholder="e.g. 2"
                  />
                </div>
                <div>
                  <label className={labelClass}>Design Neck Velocity</label>
                  <select
                    value={formData.designVelocity}
                    onChange={(e) => handleInputChange("designVelocity", Number(e.target.value))}
                    className={selectClass}
                  >
                    <option value={2.0}>2.0 m/s (~400 FPM) - Quiet / Office</option>
                    <option value={2.5}>2.5 m/s (~500 FPM) - Commercial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Terminal Model / Pattern</label>
                <select
                  value={formData.diffType}
                  onChange={(e) => handleInputChange("diffType", e.target.value as DiffuserType)}
                  className={selectClass}
                >
                  <option value="square">{DIFFUSER_NAMES.square}</option>
                  <option value="round">{DIFFUSER_NAMES.round}</option>
                  <option value="slot16">{DIFFUSER_NAMES.slot16}</option>
                  <option value="slot20">{DIFFUSER_NAMES.slot20}</option>
                  <option value="slot25">{DIFFUSER_NAMES.slot25}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Calculations preview (Right side) */}
          <div
            className={`border-l border-black/10 dark:border-white/10 transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${
              showPreview ? "w-[360px] opacity-100" : "w-0 opacity-0 border-l-0 pointer-events-none"
            }`}
          >
            <div className="w-[360px] h-full p-5 bg-neutral-50/50 dark:bg-white/[0.02] flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              <div className="shrink-0 flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                <span className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Flame className="size-4 text-primary" /> Live Calculations Preview
                </span>
                <span className="text-[10px] font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                  LIVE
                </span>
              </div>

              {/* Standard Basis Card */}
              <div className="border border-black/5 dark:border-white/5 p-3 rounded-xl bg-white/40 dark:bg-white/5 space-y-1.5 text-[11px]">
                <div className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Wind className="size-3.5 text-primary" /> {DIFFUSER_NAMES[formData.diffType] || "Terminal"}
                </div>
                <div className="text-[10.5px] space-y-1 pt-1">
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Total Space Flow:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {formData.airflow || 0} {isIp ? "CFM" : "L/s"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Terminal Units:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {formData.count || 1} Diffusers
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Design Velocity:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {formData.designVelocity} m/s ({Math.round(formData.designVelocity * 196.85)} FPM)
                    </span>
                  </div>
                </div>
              </div>

              {/* Calculations Summary */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Terminal Performance
                  </div>

                  {/* Flow per Diffuser */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Flow Per Diffuser:</span>
                      <span className="font-mono font-bold text-[13.5px] text-primary">
                        {Math.round(Number(sizing.flowPerDiff || 0)).toLocaleString()} {isIp ? "CFM" : "L/s"}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {`Total Flow (${formData.airflow || 0} ${isIp ? "CFM" : "L/s"}) ÷ ${formData.count || 1} units = ${Math.round(Number(sizing.flowPerDiff || 0))} ${isIp ? "CFM" : "L/s"}`}
                    </div>
                  </div>

                  {/* Selected Neck Size */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Recommended Neck Size:</span>
                      <span className="font-mono font-bold text-[13.5px] text-[#06456F] dark:text-[#0A7BC7]">
                        {sizing.neckSize}
                      </span>
                    </div>
                  </div>

                  {/* Throw & Noise Criteria */}
                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-black/5 dark:border-white/5 text-[11.5px]">
                    <div>
                      <span className="text-neutral-500 dark:text-neutral-400 block text-[10.5px]">Throw (T0.5):</span>
                      <span className="font-mono font-bold text-foreground text-[12.5px]">{sizing.throwVal}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 dark:text-neutral-400 block text-[10.5px]">Noise Rating:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[12.5px]">
                        {sizing.nc}
                      </span>
                    </div>
                  </div>

                  {/* ADPI Rating */}
                  <div className="pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-center text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">ADPI Comfort:</span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[10.5px] ${
                          sizing.status === "PASS"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : sizing.status === "WARN"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {sizing.adpi}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Info */}
              <div className="shrink-0 p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl flex items-start gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <span className="font-semibold">Calculations verified.</span> Diffuser selection satisfies ASHRAE 55 thermal comfort and acoustic criteria.
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
            onClick={() => {
              if (!formData.name.trim()) {
                toast.error("Please enter a space name");
                return;
              }
              onSave(formData);
            }}
            className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            {isNew ? "Add Space" : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
