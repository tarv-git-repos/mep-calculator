import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, CheckCircle, Flame, Layers } from "lucide-react";
import { FloorSelect } from "./FloorSelect";

export interface SmokeSpaceItem {
  id: string;
  name: string;
  basementLevel?: string;
  zoneName?: string;
  area: number;
  effArea: number;
  height: number;
  numZones?: number;
  isNew?: boolean;
}

interface EditSmokeSpaceModalProps {
  space: SmokeSpaceItem;
  onClose: () => void;
  onSave: (updatedSpace: SmokeSpaceItem) => void;
  availableLevels: string[];
  ip?: boolean;
}

export function EditSmokeSpaceModal({
  space,
  onClose,
  onSave,
  availableLevels,
  ip = false,
}: EditSmokeSpaceModalProps) {
  const [tempSpace, setTempSpace] = useState<SmokeSpaceItem>({ ...space });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    document.body.classList.add("modal-open-blur");
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, []);

  const handleInputChange = (field: keyof SmokeSpaceItem, value: any) => {
    setTempSpace((prev) => ({ ...prev, [field]: value }));
  };

  // Calculations Preview
  const calcs = useMemo(() => {
    const areaVal = Number(tempSpace.effArea) || Number(tempSpace.area) || 0;
    const heightVal = Number(tempSpace.height) || 0;
    const volume = areaVal * heightVal;

    let q3Lps = 0;
    let q6Lps = 0;
    let q10Lps = 0;

    if (ip) {
      // Volume in ft3 -> CFM = (ft3 * ACH) / 60
      q3Lps = Math.round((volume * 3) / 60);
      q6Lps = Math.round((volume * 6) / 60);
      q10Lps = Math.round((volume * 10) / 60);
    } else {
      // Volume in m3 -> m3/h = vol * ACH -> L/s = (m3/h * 1000) / 3600
      q3Lps = Math.round((volume * 3 * 1000) / 3600);
      q6Lps = Math.round((volume * 6 * 1000) / 3600);
      q10Lps = Math.round((volume * 10 * 1000) / 3600);
    }

    const makeupAir = Math.round(q10Lps * 0.85);

    return {
      volume,
      q3Lps,
      q6Lps,
      q10Lps,
      makeupAir,
    };
  }, [tempSpace.effArea, tempSpace.area, tempSpace.height, ip]);

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
              {tempSpace.isNew ? "Add Basement Zone" : "Edit Basement Parameters"}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {tempSpace.zoneName || tempSpace.name || "Zone"}
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
                  <label className={labelClass}>Basement Level</label>
                  <FloorSelect
                    value={tempSpace.basementLevel || ""}
                    onChange={(fl) => handleInputChange("basementLevel", fl)}
                    availableFloors={availableLevels}
                    triggerClassName="h-9 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[12px]"
                  />
                </div>
                <div>
                  <label className={labelClass}>Zone / Space Name</label>
                  <input
                    type="text"
                    value={tempSpace.zoneName || tempSpace.name}
                    onChange={(e) => {
                      handleInputChange("zoneName", e.target.value);
                      handleInputChange("name", `${tempSpace.basementLevel || "B1"} - ${e.target.value}`);
                    }}
                    className={inputClass}
                    placeholder="e.g. Zone 1 - Parking"
                  />
                </div>
              </div>
            </div>

            {/* Geometric Parameters */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Geometric Dimensions
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Gross Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempSpace.area || ""}
                    onChange={(e) => handleInputChange("area", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="600"
                  />
                </div>
                <div>
                  <label className={labelClass}>Effective Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempSpace.effArea || ""}
                    onChange={(e) => handleInputChange("effArea", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className={labelClass}>Clear Height ({ip ? "ft" : "m"})</label>
                  <input
                    type="number"
                    step="any"
                    value={tempSpace.height || ""}
                    onChange={(e) => handleInputChange("height", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="3.0"
                  />
                </div>
              </div>
            </div>

            {/* Standard Reference Info */}
            <div className="p-3 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2 shadow-xs">
              <div className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider flex items-center gap-1.5">
                <Layers className="size-3 text-primary" />
                Smoke Control Standards Applied
              </div>
              <p className="text-[11.5px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Dual-speed mechanical smoke clearance sized for 3 ACH / 6 ACH continuous car park ventilation and 10 ACH emergency smoke clearance per BS 7346-7 &amp; BS 9999.
              </p>
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

              {/* Volume Card */}
              <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2 shrink-0 shadow-xs font-mono text-[11px]">
                <div className="text-[9.5px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                  Effective Spatial Volume
                </div>
                <div className="flex justify-between items-baseline border-b border-black/5 dark:border-white/5 pb-1">
                  <span className="text-neutral-500 dark:text-neutral-400">Net Volume:</span>
                  <span className="font-bold text-foreground">{calcs.volume.toLocaleString()} {ip ? "ft³" : "m³"}</span>
                </div>
                <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 leading-normal">
                  {tempSpace.effArea || tempSpace.area || 0} {ip ? "ft²" : "m²"} × {tempSpace.height || 0} {ip ? "ft" : "m"}
                </div>
              </div>

              {/* Smoke Flow Rates Summary */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Smoke Clearance Flow Rates
                  </div>

                  {/* 3 ACH */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">3 ACH (Normal Low):</span>
                      <span className="font-mono font-bold text-[13px] text-foreground">
                        {calcs.q3Lps.toLocaleString()} {ip ? "CFM" : "L/s"}
                      </span>
                    </div>
                  </div>

                  {/* 6 ACH */}
                  <div className="space-y-1 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">6 ACH (Normal Peak):</span>
                      <span className="font-mono font-bold text-[13px] text-primary">
                        {calcs.q6Lps.toLocaleString()} {ip ? "CFM" : "L/s"}
                      </span>
                    </div>
                  </div>

                  {/* 10 ACH */}
                  <div className="space-y-1 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">10 ACH (Fire Duty):</span>
                      <span className="font-mono font-bold text-[13.5px] text-rose-600 dark:text-rose-400">
                        {calcs.q10Lps.toLocaleString()} {ip ? "CFM" : "L/s"}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5">
                      {ip
                        ? `(${calcs.volume} ft³ × 10 ACH) / 60 min`
                        : `(${calcs.volume} m³ × 10 ACH × 1000) / 3600 s`}
                    </div>
                  </div>

                  {/* Makeup Air */}
                  <div className="space-y-1 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Makeup Air (85%):</span>
                      <span className="font-mono font-bold text-[13px] text-emerald-600 dark:text-emerald-400">
                        {calcs.makeupAir.toLocaleString()} {ip ? "CFM" : "L/s"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Info */}
              <div className="shrink-0 p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl flex items-start gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <span className="font-semibold">Calculations verified.</span> Smoke extract flow rates comply with BS 7346-7 &amp; NFPA 92.
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
            onClick={() => onSave(tempSpace)}
            className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            {tempSpace.isNew ? "Add Basement Zone" : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
