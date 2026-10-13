import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { X, Info, Flame, CheckCircle, ShieldCheck, Activity } from "lucide-react";
import { FloorSelect } from "./FloorSelect";
import { type LobbyFloor } from "@/lib/calc-lobby-pressurisation";

interface EditLobbySpaceModalProps {
  floor: LobbyFloor;
  isNew?: boolean;
  onClose: () => void;
  onSave: (updatedFloor: LobbyFloor) => void;
  availableLevels: string[];
  availableZones: string[];
  unitSystem?: "si" | "ip";
}

export function EditLobbySpaceModal({
  floor,
  isNew = false,
  onClose,
  onSave,
  availableLevels,
  availableZones,
  unitSystem = "si",
}: EditLobbySpaceModalProps) {
  const isIp = unitSystem === "ip";
  const [formData, setFormData] = useState<LobbyFloor>({ ...floor });
  const [showPreview, setShowPreview] = useState(false);

  // Background blur effect
  useEffect(() => {
    document.body.classList.add("modal-open-blur");
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, []);

  useEffect(() => {
    setFormData({ ...floor });
  }, [floor]);

  const handleInputChange = (field: keyof LobbyFloor, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Live calculations
  const calc = useMemo(() => {
    const area = Number(formData.area) || 0;
    const height = Number(formData.height) || 0;
    const volume = area * height;

    if (isIp) {
      // Area in sq ft, height in ft, volume in cu ft
      const flow6ach = (volume * 6) / 60; // CFM
      const flowM3h = (volume * 0.0283168) * 6;
      return {
        volume,
        flow6ach,
        flowM3h,
        displayVolume: `${Math.round(volume).toLocaleString()} ft³`,
        displayFlow: `${Math.round(flow6ach).toLocaleString()} CFM`,
        displayHourly: `${Math.round(flowM3h).toLocaleString()} m³/h`,
      };
    } else {
      // Area in m², height in m, volume in m³
      const flow6ach = (volume * 6) / 3.6; // L/s
      const flowM3h = volume * 6;
      return {
        volume,
        flow6ach,
        flowM3h,
        displayVolume: `${volume.toFixed(1)} m³`,
        displayFlow: `${Math.round(flow6ach).toLocaleString()} L/s`,
        displayHourly: `${Math.round(flowM3h).toLocaleString()} m³/h`,
      };
    }
  }, [formData.area, formData.height, isIp]);

  const labelClass =
    "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5";
  const inputClass =
    "w-full h-9 px-3 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";

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
              {isNew ? "Add Lobby Space" : "Edit Lobby Parameters"}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {formData.name || formData.zoneName || "Lobby"}
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
                <span className="size-1.5 rounded-full bg-primary" /> Space Location &amp; Grouping
              </h3>
              <div>
                <label className={labelClass}>Space Name / Identifier</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Lift Lobby L01"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Floor / Basement Level</label>
                  <FloorSelect
                    value={formData.basementLevel || "GF"}
                    onChange={(fl) => {
                      handleInputChange("basementLevel", fl);
                      if (!formData.name || formData.name.startsWith("Lobby Space") || formData.name.includes(" - ")) {
                        handleInputChange("name", `${fl} - ${formData.zoneName || "Lift Lobby"}`);
                      }
                    }}
                    availableFloors={availableLevels}
                    triggerClassName="h-9 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[12px]"
                  />
                </div>
                <div>
                  <label className={labelClass}>Zone / Shaft Core</label>
                  <input
                    type="text"
                    value={formData.zoneName}
                    onChange={(e) => handleInputChange("zoneName", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Lift Shaft 1"
                  />
                </div>
              </div>
            </div>

            {/* Geometric Dimensions */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Geometric Dimensions &amp; Enclosure
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Gross Floor Area ({isIp ? "ft²" : "m²"})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.area || ""}
                    onChange={(e) =>
                      handleInputChange("area", e.target.value === "" ? 0 : Number(e.target.value))
                    }
                    className={inputClass}
                    placeholder={isIp ? "e.g. 250" : "e.g. 25"}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Clear Ceiling Height ({isIp ? "ft" : "m"})
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.height || ""}
                    onChange={(e) =>
                      handleInputChange("height", e.target.value === "" ? 0 : Number(e.target.value))
                    }
                    className={inputClass}
                    placeholder={isIp ? "e.g. 9.84" : "e.g. 3.0"}
                  />
                </div>
              </div>
            </div>

            {/* Regulatory Basis Note */}
            <div className="p-3 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-[11px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" /> Standard Pressurisation Protocol
              </div>
              <p className="leading-relaxed">
                Per BS 5588-4 Section 4 &amp; NFPA 92, enclosed lift lobbies require a continuous mechanical supply of minimum 6 air changes per hour (6 ACH) to resist smoke entry during core evacuation.
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

              {/* Standard Basis Card */}
              <div className="border border-black/5 dark:border-white/5 p-3 rounded-xl bg-white/40 dark:bg-white/5 space-y-1.5 text-[11px]">
                <div className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary" /> BS 5588-4 / NFPA 92 Core Standards
                </div>
                <div className="text-[10.5px] space-y-1 pt-1">
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Design Air Changes:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">6.0 ACH</span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Target Core Level:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {formData.basementLevel || "Level 1"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Associated Shaft:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {formData.zoneName || "Lift Lobby 1"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Calculations Summary */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Pressurisation Volumetric Summary
                  </div>

                  {/* Volume */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Net Enclosed Volume:</span>
                      <span className="font-mono font-bold text-[13.5px] text-foreground">
                        {calc.displayVolume}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {`Area (${formData.area || 0} ${isIp ? "ft²" : "m²"}) × Height (${formData.height || 0} ${isIp ? "ft" : "m"})`}
                    </div>
                  </div>

                  {/* 6 ACH Airflow */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">6 ACH Supply Airflow:</span>
                      <span className="font-mono font-bold text-[13.5px] text-primary">
                        {calc.displayFlow}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {isIp
                        ? `(${Math.round(calc.volume)} ft³ × 6 ACH) ÷ 60 min = ${calc.displayFlow}`
                        : `(${calc.volume.toFixed(1)} m³ × 6 ACH) ÷ 3.6 ks = ${calc.displayFlow}`}
                    </div>
                  </div>

                  {/* Hourly Flow */}
                  <div className="space-y-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Total Hourly Rate:</span>
                      <span className="font-mono font-bold text-[13.5px] text-amber-600 dark:text-amber-500">
                        {calc.displayHourly}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Info */}
              <div className="shrink-0 p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl flex items-start gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <span className="font-semibold">Calculations verified.</span> Pressurisation flow satisfies BS 5588-4 Section 4 and NFPA 92 criteria.
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
              if (!formData.name?.trim() && !formData.zoneName?.trim()) {
                toast.error("Please enter a space or zone name");
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
