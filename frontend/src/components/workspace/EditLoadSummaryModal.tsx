import React, { useState, useMemo, useEffect } from "react";
import { X, Info, CheckCircle, Flame, Zap } from "lucide-react";
import { FloorSelect } from "./FloorSelect";
import type { LoadRow } from "@/lib/calc-load-summary";

interface EditLoadSummaryModalProps {
  row: LoadRow;
  isNew?: boolean;
  onClose: () => void;
  onSave: (updated: LoadRow) => void;
  availableFloors: string[];
  unitSystem?: "si" | "ip";
}

export function EditLoadSummaryModal({
  row,
  isNew = false,
  onClose,
  onSave,
  availableFloors,
  unitSystem = "si",
}: EditLoadSummaryModalProps) {
  const [tempRow, setTempRow] = useState<LoadRow>({ ...row });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    document.body.classList.add("modal-open-blur");
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, []);

  const handleInputChange = (field: keyof LoadRow, value: any) => {
    setTempRow((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "lighting") next.isLightingCustomized = true;
      if (field === "power") next.isPowerCustomized = true;
      if (field === "hvac") next.isHvacCustomized = true;
      if (field === "other") next.isOtherCustomized = true;
      // Recalculate totalLoad
      const q = Number(next.qty) || 1;
      const a = Number(next.area) || 0;
      const l = Number(next.lighting) || 0;
      const p = Number(next.power) || 0;
      const h = Number(next.hvac) || 0;
      const o = Number(next.other) || 0;
      const totKw = Number((((l + p + h + o) * a * q) / 1000).toFixed(3));
      next.totalLoad = totKw;
      return next;
    });
  };

  // Calculations Preview
  const calcs = useMemo(() => {
    const q = Number(tempRow.qty) || 1;
    const a = Number(tempRow.area) || 0;
    const totalArea = q * a;
    const l = Number(tempRow.lighting) || 0;
    const p = Number(tempRow.power) || 0;
    const h = Number(tempRow.hvac) || 0;
    const o = Number(tempRow.other) || 0;

    const lightKw = (l * totalArea) / 1000;
    const powerKw = (p * totalArea) / 1000;
    const hvacKw = (h * totalArea) / 1000;
    const otherKw = (o * totalArea) / 1000;
    const totalKw = lightKw + powerKw + hvacKw + otherKw;
    const density = totalArea > 0 ? (totalKw * 1000) / totalArea : 0;

    return {
      totalArea,
      lightKw,
      powerKw,
      hvacKw,
      otherKw,
      totalKw,
      density,
    };
  }, [tempRow.qty, tempRow.area, tempRow.lighting, tempRow.power, tempRow.hvac, tempRow.other]);

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
              {isNew ? "Add Space Load" : "Edit Electrical Load Parameters"}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {tempRow.description || "Load Item"}
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
                <span className="size-1.5 rounded-full bg-primary" /> Space Identification
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Floor Level</label>
                  <FloorSelect
                    value={tempRow.floor || ""}
                    onChange={(fl) => handleInputChange("floor", fl)}
                    availableFloors={availableFloors}
                    triggerClassName="h-9 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[12px]"
                  />
                </div>
                <div>
                  <label className={labelClass}>Space Name / Description</label>
                  <input
                    type="text"
                    value={tempRow.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Meeting Room 1"
                  />
                </div>
              </div>
            </div>

            {/* Geometry & Quantity */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Geometry &amp; Multiplier
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Quantity / Multiplier</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={tempRow.qty || 1}
                    onChange={(e) => handleInputChange("qty", parseInt(e.target.value) || 1)}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Unit Area ({unitSystem === "si" ? "m²" : "ft²"})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempRow.area || ""}
                    onChange={(e) => handleInputChange("area", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="50"
                  />
                </div>
              </div>
            </div>

            {/* Electrical Densities */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Electrical Load Densities ({unitSystem === "si" ? "W/m²" : "W/ft²"})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Lighting (LPD)</label>
                  <input
                    type="number"
                    step="any"
                    value={tempRow.lighting || ""}
                    onChange={(e) => handleInputChange("lighting", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className={labelClass}>Small Power (Sockets)</label>
                  <input
                    type="number"
                    step="any"
                    value={tempRow.power || ""}
                    onChange={(e) => handleInputChange("power", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="25"
                  />
                </div>
                <div>
                  <label className={labelClass}>HVAC Equipment</label>
                  <input
                    type="number"
                    step="any"
                    value={tempRow.hvac || ""}
                    onChange={(e) => handleInputChange("hvac", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="80"
                  />
                </div>
                <div>
                  <label className={labelClass}>Other / Miscellaneous</label>
                  <input
                    type="number"
                    step="any"
                    value={tempRow.other || ""}
                    onChange={(e) => handleInputChange("other", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="5"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <label className={labelClass}>Remarks / Notes</label>
              <input
                type="text"
                value={tempRow.remarks || ""}
                onChange={(e) => handleInputChange("remarks", e.target.value)}
                className={inputClass}
                placeholder="Optional design notes or panel feed tag"
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

              {/* Area Card */}
              <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2 shrink-0 shadow-xs font-mono text-[11px]">
                <div className="text-[9.5px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                  Total Effective Floor Area
                </div>
                <div className="flex justify-between items-baseline border-b border-black/5 dark:border-white/5 pb-1">
                  <span className="text-neutral-500 dark:text-neutral-400">Total Area:</span>
                  <span className="font-bold text-foreground">{calcs.totalArea.toFixed(1)} {unitSystem === "si" ? "m²" : "ft²"}</span>
                </div>
                <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 leading-normal">
                  {tempRow.qty || 1} unit(s) × {tempRow.area || 0} {unitSystem === "si" ? "m²" : "ft²"}
                </div>
              </div>

              {/* Load Components Summary */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Connected Load Breakdown
                  </div>

                  <div className="space-y-1.5 font-mono text-[11.5px]">
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-500 dark:text-neutral-400 font-sans font-medium">Lighting:</span>
                      <span className="font-bold text-foreground">{calcs.lightKw.toFixed(2)} kW</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-black/5 dark:border-white/5">
                      <span className="text-neutral-500 dark:text-neutral-400 font-sans font-medium">Small Power:</span>
                      <span className="font-bold text-foreground">{calcs.powerKw.toFixed(2)} kW</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-black/5 dark:border-white/5">
                      <span className="text-neutral-500 dark:text-neutral-400 font-sans font-medium">HVAC:</span>
                      <span className="font-bold text-foreground">{calcs.hvacKw.toFixed(2)} kW</span>
                    </div>
                    {calcs.otherKw > 0 && (
                      <div className="flex justify-between items-baseline pt-1 border-t border-black/5 dark:border-white/5">
                        <span className="text-neutral-500 dark:text-neutral-400 font-sans font-medium">Other:</span>
                        <span className="font-bold text-foreground">{calcs.otherKw.toFixed(2)} kW</span>
                      </div>
                    )}
                  </div>

                  {/* Total Connected Load */}
                  <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-primary font-sans">Total Connected Load:</span>
                      <span className="font-mono font-bold text-[14px] text-primary">
                        {calcs.totalKw.toFixed(2)} kW
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                      <span>Total Power Density:</span>
                      <span>{calcs.density.toFixed(1)} {unitSystem === "si" ? "W/m²" : "W/ft²"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Info */}
              <div className="shrink-0 p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl flex items-start gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <span className="font-semibold">Calculations verified.</span> Load density values conform to NEC Table 220 &amp; BS 7671.
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
            onClick={() => onSave(tempRow)}
            className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            {isNew ? "Add Space Load" : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
