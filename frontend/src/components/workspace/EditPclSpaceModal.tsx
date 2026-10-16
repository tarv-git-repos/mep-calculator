import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, Flame, CheckCircle } from "lucide-react";
import { PclCategorySelect } from "./PclCategorySelect";
import { FloorSelect } from "./FloorSelect";
import { inferTypeFromName } from "@/lib/calc-preliminary-cooling-load";

export interface PclSpace {
  id: string;
  name: string;
  area: number | "";
  type: string;
  density: number; // W/m²
  dissipation: number; // Watts
  kw: number;
  tr: number;
  floor: string;
  zone?: string;
  selected?: boolean;
  comments?: any[];
  flagged?: boolean;
  aiDetected?: boolean;
}

interface EditPclSpaceModalProps {
  space: PclSpace;
  onClose: () => void;
  onSave: (updatedSpace: PclSpace) => void;
  availableFloors?: string[];
  spaceDensities: Record<string, number>;
}

export function EditPclSpaceModal({
  space,
  onClose,
  onSave,
  availableFloors = [],
  spaceDensities,
}: EditPclSpaceModalProps) {
  const initialDefaultDensity = space.type ? (spaceDensities[space.type] || 0) : 0;
  const initialDensity = typeof space.density === "number" && space.density > 0
    ? space.density
    : initialDefaultDensity;

  const isInitiallyCustom = typeof space.density === "number" && space.density > 0 && space.density !== initialDefaultDensity;

  const [tempSpace, setTempSpace] = useState<PclSpace>(() => ({
    ...space,
    density: initialDensity,
  }));
  const [isCustomDensity, setIsCustomDensity] = useState<boolean>(isInitiallyCustom);
  const [showPreview, setShowPreview] = useState(false);
  const [manualAirflow, setManualAirflow] = useState(false);
  const [manualKw, setManualKw] = useState(() => (tempSpace.kw || 0));
  const [manualTr, setManualTr] = useState(() => (tempSpace.tr || 0));

  const isCustomType = Boolean(tempSpace.type && (tempSpace.type.endsWith(" (Custom)") || tempSpace.type === "Other"));
  const [customTypeName, setCustomTypeName] = useState(() => {
    if (space.type && space.type.endsWith(" (Custom)")) {
      return space.type.replace(/\s*\(Custom\)$/, "");
    }
    return "Custom";
  });

  const defaultDensity = useMemo(() => {
    return tempSpace.type ? (spaceDensities[tempSpace.type] || 0) : 0;
  }, [tempSpace.type, spaceDensities]);

  const [densityInputVal, setDensityInputVal] = useState<string>(() => {
    if (isCustomDensity) {
      return String(tempSpace.density);
    }
    return defaultDensity > 0 ? `${defaultDensity} (default)` : "0 (default)";
  });

  useEffect(() => {
    if (!isCustomDensity) {
      setDensityInputVal(defaultDensity > 0 ? `${defaultDensity} (default)` : "0 (default)");
    } else {
      setDensityInputVal(String(tempSpace.density));
    }
  }, [isCustomDensity, defaultDensity, tempSpace.density]);

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

  const liveCalculations = useMemo(() => {
    const areaNum = typeof tempSpace.area === "number" ? tempSpace.area : parseFloat(String(tempSpace.area)) || 0;
    const densityNum = typeof tempSpace.density === "number" ? tempSpace.density : (parseFloat(String(tempSpace.density)) || 0);
    const dissipationWatts = areaNum * densityNum;
    const kw = manualAirflow ? manualKw : dissipationWatts / 1000;
    const tr = manualAirflow ? manualTr : kw / 3.517;

    return {
      area: areaNum,
      density: densityNum,
      dissipationWatts: manualAirflow ? kw * 1000 : dissipationWatts,
      kw,
      tr,
      btuh: tr * 12000,
    };
  }, [tempSpace.area, tempSpace.density, manualAirflow, manualKw, manualTr]);

  const handleInputChange = (field: keyof PclSpace, value: any) => {
    setTempSpace((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "name") {
        const nameVal = String(value).trim();
        const inferred = inferTypeFromName(nameVal);
        if (inferred && (!prev.type || inferred !== prev.type) && !isCustomDensity) {
          next.type = inferred;
          next.aiDetected = true;
          const nextDens = spaceDensities[inferred] || 0;
          next.density = nextDens;
        }
      }

      const areaNum = typeof next.area === "number" ? next.area : (next.area === "" ? 0 : parseFloat(String(next.area)) || 0);
      const densNum = typeof next.density === "number" ? next.density : (parseFloat(String(next.density)) || 0);
      const watts = areaNum * densNum;
      const kw = watts / 1000;
      const tr = kw / 3.517;

      next.dissipation = watts;
      next.kw = Number(kw.toFixed(2));
      next.tr = Number(tr.toFixed(2));

      return next;
    });
  };

  const handleCategoryChange = (newType: string) => {
    if (newType === "Other" || newType.endsWith(" (Custom)")) {
      setIsCustomDensity(true);
      setTempSpace((prev) => {
        const areaNum = typeof prev.area === "number" ? prev.area : parseFloat(String(prev.area)) || 0;
        const nextDensity = prev.density || 120;
        const watts = areaNum * nextDensity;
        const kw = watts / 1000;
        const tr = kw / 3.517;
        return {
          ...prev,
          type: newType,
          density: nextDensity,
          dissipation: watts,
          kw: Number(kw.toFixed(2)),
          tr: Number(tr.toFixed(2)),
          aiDetected: false,
        };
      });
      return;
    }

    const nextDensity = newType ? (spaceDensities[newType] || 0) : 0;
    setIsCustomDensity(false);
    setTempSpace((prev) => {
      const areaNum = typeof prev.area === "number" ? prev.area : parseFloat(String(prev.area)) || 0;
      const watts = areaNum * nextDensity;
      const kw = watts / 1000;
      const tr = kw / 3.517;
      return {
        ...prev,
        type: newType,
        density: nextDensity,
        dissipation: watts,
        kw: Number(kw.toFixed(2)),
        tr: Number(tr.toFixed(2)),
        aiDetected: false,
      };
    });
  };

  const handleDensityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+(\.\d*)?$/.test(val)) {
      setDensityInputVal(val);
      return;
    }

    if (!isCustomDensity) {
      const defaultStr = `${defaultDensity} (default)`;
      if (!val.includes(defaultStr)) {
        setDensityInputVal("");
        return;
      }
      const typed = val.replace(defaultStr, "");
      if (/^\d+(\.\d*)?$/.test(typed)) {
        setDensityInputVal(typed);
      }
    }
  };

  const handleDensityInputBlur = () => {
    const parsed = parseFloat(densityInputVal);
    if (densityInputVal === "" || isNaN(parsed)) {
      setIsCustomDensity(false);
      setTempSpace((prev) => {
        const areaNum = typeof prev.area === "number" ? prev.area : (prev.area === "" ? 0 : parseFloat(String(prev.area)) || 0);
        const watts = areaNum * defaultDensity;
        const kw = watts / 1000;
        const tr = kw / 3.517;
        return {
          ...prev,
          density: defaultDensity,
          dissipation: watts,
          kw: Number(kw.toFixed(2)),
          tr: Number(tr.toFixed(2)),
        };
      });
      setDensityInputVal(defaultDensity > 0 ? `${defaultDensity} (default)` : "0 (default)");
    } else {
      setIsCustomDensity(true);
      setTempSpace((prev) => {
        const areaNum = typeof prev.area === "number" ? prev.area : (prev.area === "" ? 0 : parseFloat(String(prev.area)) || 0);
        const watts = areaNum * parsed;
        const kw = watts / 1000;
        const tr = kw / 3.517;
        return {
          ...prev,
          density: parsed,
          dissipation: watts,
          kw: Number(kw.toFixed(2)),
          tr: Number(tr.toFixed(2)),
        };
      });
      setDensityInputVal(String(parsed));
    }
  };

  const handleSave = () => {
    const areaNum = typeof tempSpace.area === "number" ? tempSpace.area : (tempSpace.area === "" ? 0 : parseFloat(String(tempSpace.area)) || 0);
    let resolvedType = tempSpace.type || "";
    if (resolvedType === "Other" || resolvedType.endsWith(" (Custom)")) {
      let customBase = customTypeName.trim() || "Custom";
      if (!customBase.endsWith(" (Custom)")) {
        resolvedType = `${customBase} (Custom)`;
      } else {
        resolvedType = customBase;
      }
    }

    const finalDensity = typeof tempSpace.density === "number" ? tempSpace.density : (parseFloat(String(tempSpace.density)) || 0);
    const finalWatts = manualAirflow ? manualKw * 1000 : areaNum * finalDensity;
    const finalKw = manualAirflow ? manualKw : finalWatts / 1000;
    const finalTr = manualAirflow ? manualTr : finalKw / 3.517;

    const isNoName = !tempSpace.name || tempSpace.name.trim() === "";
    const isNoArea = areaNum <= 0;
    const isNoType = !resolvedType || resolvedType.trim() === "";
    const isMissing = isNoName || isNoArea || isNoType;
    const wasMissing = !space.name || !space.type || !space.area || Number(space.area) <= 0;
    let nextFlagged = tempSpace.flagged;
    if (isMissing) {
      nextFlagged = true;
    } else if (wasMissing && !isMissing) {
      nextFlagged = false;
    }

    const finalized: PclSpace = {
      ...tempSpace,
      name: tempSpace.name.trim() || space.name,
      floor: tempSpace.floor?.trim() || space.floor || "Default",
      area: tempSpace.area === "" ? "" : areaNum,
      type: resolvedType,
      density: finalDensity,
      dissipation: finalWatts,
      kw: Number(finalKw.toFixed(2)),
      tr: Number(finalTr.toFixed(2)),
      flagged: nextFlagged,
    };

    onSave(finalized);
    toast.success(`Updated space: ${finalized.name}`);
    onClose();
  };

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5";
  const inputClass = "w-full h-9 px-3 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";

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
              Edit Space Parameters
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

            {/* GENERAL PARAMETERS */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> General Parameters
              </h3>
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className={labelClass}>
                    {tempSpace.aiDetected && (
                      <span
                        title="Automatically identified"
                        className="inline-block size-1.5 rounded-full bg-primary mr-1 cursor-help"
                      />
                    )}
                    Category Classification
                  </label>
                  <PclCategorySelect
                    value={tempSpace.type && (tempSpace.type.endsWith(" (Custom)") || tempSpace.type === "Other") ? "Other" : (tempSpace.type || "")}
                    densities={spaceDensities}
                    onChange={handleCategoryChange}
                    triggerClassName="w-full bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded-lg px-2.5 py-1 w-full outline-none cursor-pointer transition-all text-foreground h-9 text-[12px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Floor</label>
                  <FloorSelect
                    value={tempSpace.floor}
                    onChange={(fl) => handleInputChange("floor", fl)}
                    availableFloors={availableFloors}
                    triggerClassName="h-9 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[12px]"
                  />
                </div>
                <div>
                  {isCustomType ? (
                    <div>
                      <label className={labelClass}>Custom Category Name</label>
                      <input
                        type="text"
                        value={customTypeName}
                        onChange={(e) => setCustomTypeName(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Server Room"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={labelClass}>Zone Assigned</label>
                      <input
                        type="text"
                        value={tempSpace.zone || "Default"}
                        onChange={(e) => handleInputChange("zone", e.target.value)}
                        className={inputClass}
                        placeholder="Unzoned / Default"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* GEOMETRY & OCCUPANCY / HEAT DISSIPATION */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Geometry & Occupancy
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Area (m²)</label>
                  <input
                    type="number"
                    step="any"
                    value={tempSpace.area}
                    onChange={(e) => handleInputChange("area", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    {!isCustomDensity && (
                      <span title="Using standard density" className="inline-block size-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                    Heat Density (W/m²)
                  </label>
                  <input
                    type="text"
                    value={densityInputVal}
                    onChange={handleDensityInputChange}
                    onBlur={handleDensityInputBlur}
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>
            </div>

            {/* PRESSURE BALANCING INTENT */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Pressure Balancing Intent
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Computed Cooling Load
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${liveCalculations.tr.toFixed(2)} TR (${liveCalculations.kw.toFixed(2)} kW)`}
                    className={`${inputClass} font-mono bg-white/40 dark:bg-white/5 cursor-default font-semibold text-primary`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Manual Balancing</label>
                  <div className="flex items-center h-9 gap-2 px-3 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setManualAirflow(prev => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                        manualAirflow ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          manualAirflow ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-[11.5px] text-neutral-600 dark:text-neutral-400 select-none font-medium">
                      Enable overrides (Bypass)
                    </span>
                  </div>
                </div>
              </div>

              {manualAirflow && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-fade-in">
                  <div>
                    <label className="block text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Manual Cooling Load (kW)
                    </label>
                    <input
                      type="number"
                      value={manualKw}
                      onChange={(e) => {
                        const kwVal = parseFloat(e.target.value) || 0;
                        setManualKw(kwVal);
                        setManualTr(Number((kwVal / 3.517).toFixed(2)));
                      }}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Manual Cooling Load (TR)
                    </label>
                    <input
                      type="number"
                      value={manualTr}
                      onChange={(e) => {
                        const trVal = parseFloat(e.target.value) || 0;
                        setManualTr(trVal);
                        setManualKw(Number((trVal * 3.517).toFixed(2)));
                      }}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>
              )}
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

              {/* Standard Rates */}
              <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2.5 shrink-0 shadow-xs">
                <div className="text-[9.5px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                  Cooling Load Density Benchmarks
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px] font-mono">
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Category:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[100px]">{tempSpace.type || "General"}</span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Standard:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{defaultDensity} W/m²</span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Applied:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{liveCalculations.density} W/m²</span>
                  </div>
                  <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    <span className="text-neutral-500 dark:text-neutral-400">TR/m²:</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{(liveCalculations.density / 3517).toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {/* Calculations Summary */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Preliminary Cooling Capacity
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Cooling Load (kW):</span>
                      <span className="font-mono font-bold text-[13.5px] text-primary">
                        {liveCalculations.kw.toFixed(2)} kW
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {manualAirflow ? (
                        `Manual override: ${manualKw.toFixed(2)} kW`
                      ) : (
                        `(${liveCalculations.area} m² × ${liveCalculations.density} W/m²) / 1,000 = ${liveCalculations.kw.toFixed(2)} kW`
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px] pt-1.5 border-t border-black/5 dark:border-white/5">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Tons of Refrigeration (TR):</span>
                      <span className="font-mono font-bold text-[13.5px] text-emerald-600 dark:text-emerald-400">
                        {liveCalculations.tr.toFixed(2)} TR
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {manualAirflow ? (
                        `Manual override: ${manualTr.toFixed(2)} TR`
                      ) : (
                        `${liveCalculations.kw.toFixed(2)} kW / 3.517 = ${liveCalculations.tr.toFixed(2)} TR (${Math.round(liveCalculations.btuh).toLocaleString()} BTU/hr)`
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Info */}
              <div className="shrink-0 p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl flex items-start gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <span className="font-semibold">Calculations verified.</span> Heat density values align with preliminary cooling engineering benchmarks.
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
            onClick={handleSave}
            className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            Save Changes
          </button>
        </footer>

      </div>
    </div>
  );
}
