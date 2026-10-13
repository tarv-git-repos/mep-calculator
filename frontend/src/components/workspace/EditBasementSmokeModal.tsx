import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, CheckCircle, Flame, Activity, ShieldCheck, Flag } from "lucide-react";
import { calculateSmokeFlows, calculateMakeupScaling } from "@/lib/calc-basement-smoke";
import { FloorSelect } from "@/components/workspace/FloorSelect";

export interface BasementFloor {
  id: string;
  basementLevel: string;
  zoneName: string;
  name: string;
  area: number;
  effArea: number;
  height: number;
  flagged?: boolean;
}

interface EditBasementSmokeModalProps {
  floor: BasementFloor;
  unitSystem: "si" | "ip";
  isNew?: boolean;
  isReadOnly?: boolean;
  availableLevels?: string[];
  onClose: () => void;
  onSave: (updatedFloor: BasementFloor) => void;
}

export function EditBasementSmokeModal({
  floor,
  unitSystem,
  isNew = false,
  isReadOnly = false,
  availableLevels = [],
  onClose,
  onSave,
}: EditBasementSmokeModalProps) {
  const [tempFloor, setTempFloor] = useState<BasementFloor>({ ...floor });
  const [showPreview, setShowPreview] = useState(false);
  const isIp = unitSystem === "ip";

  useEffect(() => {
    document.body.classList.add("modal-open-blur");
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, []);

  useEffect(() => {
    setTempFloor({ ...floor });
  }, [floor]);

  // Live calculation results
  const calc = useMemo(() => {
    const effArea = Number(tempFloor.effArea) || 0;
    const height = Number(tempFloor.height) || 0;
    return calculateSmokeFlows(effArea, height, isIp);
  }, [tempFloor.effArea, tempFloor.height, isIp]);

  const makeupFlow = useMemo(() => {
    return calculateMakeupScaling(calc.flow10ach);
  }, [calc.flow10ach]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isReadOnly) return;
    onSave(tempFloor);
  };

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
              {isNew ? "Add Basement Space" : "Edit Space Parameters"}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {tempFloor.name || tempFloor.zoneName || "Space"}
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
            {/* General Parameters */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Location &amp; Identification
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Basement Level</label>
                  <FloorSelect
                    value={tempFloor.basementLevel || "B1"}
                    onChange={(newLvl) => {
                      const zName = tempFloor.zoneName || "Zone 1";
                      setTempFloor({
                        ...tempFloor,
                        basementLevel: newLvl,
                        name: `${newLvl} - ${zName}`,
                      });
                    }}
                    availableFloors={availableLevels}
                    disabled={isReadOnly}
                    triggerClassName="h-9 rounded-lg text-[12px]"
                  />
                </div>
                <div>
                  <label className={labelClass}>Zone / Room Name</label>
                  <input
                    type="text"
                    value={tempFloor.zoneName}
                    onChange={(e) => {
                      const newZ = e.target.value;
                      const lvl = tempFloor.basementLevel || "Basement 1";
                      setTempFloor({
                        ...tempFloor,
                        zoneName: newZ,
                        name: `${lvl} - ${newZ}`,
                      });
                    }}
                    className={inputClass}
                    placeholder="e.g. Zone 1"
                    disabled={isReadOnly}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Full Space Identifier</label>
                <input
                  type="text"
                  value={tempFloor.name}
                  onChange={(e) => setTempFloor({ ...tempFloor, name: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Basement 1 - Zone 1"
                  disabled={isReadOnly}
                />
              </div>
            </div>

            {/* Geometry Parameters */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Geometric Dimensions
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>
                    Gross Area ({isIp ? "ft²" : "m²"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={tempFloor.area || ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                      setTempFloor((prev) => ({
                        ...prev,
                        area: val,
                        // If effective area was empty or equal to area, update it too
                        effArea: prev.effArea === 0 || prev.effArea === prev.area ? val : prev.effArea,
                      }));
                    }}
                    className={inputClass}
                    disabled={isReadOnly}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Eff. Area ({isIp ? "ft²" : "m²"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={tempFloor.effArea || ""}
                    onChange={(e) =>
                      setTempFloor({
                        ...tempFloor,
                        effArea: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                    disabled={isReadOnly}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Height ({isIp ? "ft" : "m"})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={tempFloor.height || ""}
                    onChange={(e) =>
                      setTempFloor({
                        ...tempFloor,
                        height: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                    disabled={isReadOnly}
                    placeholder="3.0"
                  />
                </div>
              </div>
            </div>

            {/* Engineering Review Flag */}
            <div className="pt-1">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-white/40 dark:bg-white/5 cursor-pointer hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={Boolean(tempFloor.flagged)}
                  onChange={(e) => setTempFloor({ ...tempFloor, flagged: e.target.checked })}
                  disabled={isReadOnly}
                  className="rounded text-primary focus:ring-primary/20 size-4 cursor-pointer"
                />
                <span className="text-[11.5px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Flag className={`size-3.5 ${tempFloor.flagged ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
                  Flag this zone for engineering review
                </span>
              </label>
            </div>

            {/* Standard Protocol Card */}
            <div className="p-3 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-[11px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" /> Basement Smoke Standard Protocol
              </div>
              <p className="leading-relaxed">
                Calculations comply with NFPA 204, IBC Section 909, and BS 7346-7 standards: 3 ACH normal background ventilation, 6 ACH elevated CO/clearance extraction, and 10 ACH emergency smoke purge with 80% dedicated makeup air.
              </p>
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

              {/* Smoke Control Basis Card */}
              <div className="border border-black/5 dark:border-white/5 p-3 rounded-xl bg-white/40 dark:bg-white/5 space-y-1.5 text-[11px]">
                <div className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary" /> Compartment Volume Basis
                </div>
                <div className="text-[10.5px] space-y-1 pt-1">
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Effective Volume (V):</span>
                    <span className="font-semibold font-mono text-neutral-800 dark:text-neutral-200">
                      {calc.volume.toLocaleString()} {isIp ? "ft³" : "m³"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Eff. vs Gross Area:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {tempFloor.effArea || 0} / {tempFloor.area || 0} {isIp ? "ft²" : "m²"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Compartment Height:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {tempFloor.height || 0} {isIp ? "ft" : "m"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Extraction & Makeup Flow Sizing */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Smoke Extraction &amp; Makeup Flows
                  </div>

                  {/* 10 ACH Emergency Purge */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">10 ACH Fire Smoke Purge:</span>
                      <span className="font-mono font-bold text-[13.5px] text-rose-600 dark:text-rose-400">
                        {calc.flow10ach.toLocaleString()} {isIp ? "CFM" : "L/s"}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {`Q_10 = (${calc.volume} × 10) / ${isIp ? "60" : "3.6"} = ${calc.flow10ach.toLocaleString()} ${isIp ? "CFM" : "L/s"}`}
                    </div>
                  </div>

                  {/* 6 ACH Medium Extract */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5 text-[11px]">
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-500 dark:text-neutral-400">6 ACH Elevated / CO Extract:</span>
                      <span className="font-mono font-bold text-[12px] text-foreground">
                        {calc.flow6ach.toLocaleString()} {isIp ? "CFM" : "L/s"}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {`Q_6 = (${calc.volume} × 6) / ${isIp ? "60" : "3.6"} = ${calc.flow6ach.toLocaleString()} ${isIp ? "CFM" : "L/s"}`}
                    </div>
                  </div>

                  {/* 3 ACH Normal Extract */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5 text-[11px]">
                    <div className="flex justify-between items-baseline">
                      <span className="text-neutral-500 dark:text-neutral-400">3 ACH Normal Background:</span>
                      <span className="font-mono font-semibold text-muted-foreground">
                        {calc.flow3ach.toLocaleString()} {isIp ? "CFM" : "L/s"}
                      </span>
                    </div>
                  </div>

                  {/* 80% Makeup Air Supply */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">80% Makeup Air Required:</span>
                      <span className="font-mono font-bold text-[13px] text-primary">
                        {makeupFlow.toLocaleString()} {isIp ? "CFM" : "L/s"}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {`Q_makeup = Q_10 × 0.80 = ${makeupFlow.toLocaleString()} ${isIp ? "CFM" : "L/s"}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Info */}
              <div className="shrink-0 p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl flex items-start gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <span className="font-semibold">Calculations verified.</span> 10 ACH fire extract and 80% makeup air comply with NFPA 204 &amp; IBC Section 909.
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
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
            >
              {isNew ? "Add Space" : "Save Changes"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
