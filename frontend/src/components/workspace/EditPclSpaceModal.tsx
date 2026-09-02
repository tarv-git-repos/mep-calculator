import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, Flame, Zap, Shield, CheckCircle2, AlertTriangle, Sparkles, Flag } from "lucide-react";
import { PclCategorySelect } from "./PclCategorySelect";

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
  selected?: boolean;
  comments?: any[];
  flagged?: boolean;
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
  const [tempSpace, setTempSpace] = useState<PclSpace>({ ...space });
  const [showPreview, setShowPreview] = useState(false);
  const [customDensityOverride, setCustomDensityOverride] = useState<boolean>(() => {
    if (!space.type) return false;
    if (space.type.endsWith(" (Custom)") || space.type === "Other") return true;
    return typeof space.density === "number" && space.density !== (spaceDensities[space.type] || 0);
  });

  const isCustomType = Boolean(tempSpace.type && (tempSpace.type.endsWith(" (Custom)") || tempSpace.type === "Other"));
  const [customTypeName, setCustomTypeName] = useState(() => {
    if (space.type && space.type.endsWith(" (Custom)")) {
      return space.type.replace(/\s*\(Custom\)$/, "");
    }
    return "Custom";
  });

  useEffect(() => {
    const isReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly);
    if (isReadOnly) {
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      onClose();
    }
  }, [onClose]);

  // Handle automatic or custom density update
  const defaultDensity = useMemo(() => {
    return tempSpace.type ? (spaceDensities[tempSpace.type] || 0) : 0;
  }, [tempSpace.type, spaceDensities]);

  const liveCalculations = useMemo(() => {
    const areaNum = typeof tempSpace.area === "number" ? tempSpace.area : parseFloat(String(tempSpace.area)) || 0;
    const densityNum = tempSpace.type ? (customDensityOverride ? tempSpace.density : (spaceDensities[tempSpace.type] || tempSpace.density || 0)) : 0;
    const dissipationWatts = areaNum * densityNum;
    const kw = dissipationWatts / 1000;
    const tr = kw / 3.51685;

    return {
      area: areaNum,
      density: densityNum,
      dissipationWatts,
      kw,
      tr,
      btuh: tr * 12000,
    };
  }, [tempSpace.area, tempSpace.density, tempSpace.type, customDensityOverride, spaceDensities]);

  const handleTypeChange = (newType: string) => {
    if (newType === "Other" || newType.endsWith(" (Custom)")) {
      setCustomDensityOverride(true);
      setTempSpace((prev) => {
        const areaNum = typeof prev.area === "number" ? prev.area : parseFloat(String(prev.area)) || 0;
        const nextDensity = prev.density || 120;
        const watts = areaNum * nextDensity;
        const kw = watts / 1000;
        const tr = kw / 3.51685;
        return {
          ...prev,
          type: newType,
          density: nextDensity,
          dissipation: watts,
          kw: Number(kw.toFixed(2)),
          tr: Number(tr.toFixed(2)),
        };
      });
      return;
    }

    const nextDensity = newType ? (spaceDensities[newType] || 0) : 0;
    setCustomDensityOverride(false);
    setTempSpace((prev) => {
      const areaNum = typeof prev.area === "number" ? prev.area : parseFloat(String(prev.area)) || 0;
      const watts = areaNum * nextDensity;
      const kw = watts / 1000;
      const tr = kw / 3.51685;
      return {
        ...prev,
        type: newType,
        density: nextDensity,
        dissipation: watts,
        kw: Number(kw.toFixed(2)),
        tr: Number(tr.toFixed(2)),
      };
    });
  };

  const handleAreaChange = (val: number | "") => {
    setTempSpace((prev) => {
      const areaNum = typeof val === "number" ? val : (val === "" ? 0 : parseFloat(String(val)) || 0);
      const densityToUse = prev.type ? (customDensityOverride ? prev.density : (spaceDensities[prev.type] || prev.density || 0)) : 0;
      const watts = areaNum * densityToUse;
      const kw = watts / 1000;
      const tr = kw / 3.51685;
      return {
        ...prev,
        area: val,
        dissipation: watts,
        kw: Number(kw.toFixed(2)),
        tr: Number(tr.toFixed(2)),
      };
    });
  };

  const handleDensityChange = (val: number) => {
    setCustomDensityOverride(true);
    setTempSpace((prev) => {
      const areaNum = typeof prev.area === "number" ? prev.area : (prev.area === "" ? 0 : parseFloat(String(prev.area)) || 0);
      const watts = areaNum * val;
      const kw = watts / 1000;
      const tr = kw / 3.51685;
      return {
        ...prev,
        density: val,
        dissipation: watts,
        kw: Number(kw.toFixed(2)),
        tr: Number(tr.toFixed(2)),
      };
    });
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

    const finalDensity = resolvedType ? (customDensityOverride ? tempSpace.density : (spaceDensities[resolvedType] || tempSpace.density || 0)) : 0;
    const finalWatts = areaNum * finalDensity;
    const finalKw = finalWatts / 1000;
    const finalTr = finalKw / 3.51685;

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

  const labelClass = "block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5";
  const inputClass = "w-full bg-white/70 dark:bg-slate-900/60 border border-border/80 rounded-xl px-3.5 py-2 text-[13px] text-foreground font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className={`relative w-full bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-[max-width] duration-300 ease-in-out ${showPreview ? "max-w-4xl" : "max-w-2xl"}`}>
        
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-card shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-foreground tracking-tight">Edit Space Parameters</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary uppercase tracking-wider border border-primary/20">
                {tempSpace.floor ? `${tempSpace.floor} - ${tempSpace.name}` : tempSpace.name}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Configure room geometry, heat density factors, and cooling load capacity.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTempSpace(prev => ({ ...prev, flagged: !prev.flagged }))}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-xs ${
                tempSpace.flagged
                  ? "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20"
                  : "bg-surface-2 border-border/80 text-muted-foreground hover:text-foreground hover:bg-surface-3"
              }`}
              title={tempSpace.flagged ? "Unflag space" : "Flag space for review"}
            >
              <Flag className={`size-3.5 ${tempSpace.flagged ? "fill-red-500 text-red-500" : ""}`} />
              <span>{tempSpace.flagged ? "Flagged" : "Flag"}</span>
            </button>
            <button
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-xs ${
                showPreview
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95 shadow-md shadow-primary/15"
                  : "bg-surface-2 border-border/80 text-foreground hover:bg-surface-3"
              }`}
            >
              <Info className="size-3.5" />
              Calculations Preview
            </button>
            <button
              onClick={onClose}
              className="size-8.5 grid place-items-center rounded-xl hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto custom-scrollbar">
            
            {/* GENERAL PARAMETERS */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" /> General Parameters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Space Name</label>
                  <input
                    type="text"
                    value={tempSpace.name}
                    onChange={(e) => setTempSpace(prev => ({ ...prev, name: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. BEDROOM 2"
                  />
                </div>
                <div>
                  <label className={labelClass}>Category Classification</label>
                  <PclCategorySelect
                    value={tempSpace.type && (tempSpace.type.endsWith(" (Custom)") || tempSpace.type === "Other") ? "Other" : (tempSpace.type || "")}
                    densities={spaceDensities}
                    onChange={(val) => handleTypeChange(val)}
                    triggerClassName="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
                  />
                </div>
              </div>

              {isCustomType && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  <label className={labelClass}>Custom Category Name</label>
                  <input
                    type="text"
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Custom or Server Room"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Custom categories will be automatically formatted and saved as <code className="font-semibold text-foreground">"{customTypeName.trim() || 'Custom'} (Custom)"</code>.
                  </p>
                </div>
              )}

              <div>
                <label className={labelClass}>Floor Assigned</label>
                <input
                  type="text"
                  list="pcl-floors-list"
                  value={tempSpace.floor}
                  onChange={(e) => setTempSpace(prev => ({ ...prev, floor: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. FIRST FLOOR"
                />
                <datalist id="pcl-floors-list">
                  {availableFloors.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* GEOMETRY & HEAT DISSIPATION */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" /> Geometry & Heat Dissipation Density
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Area (m²)</label>
                  <input
                    type="number"
                    step="any"
                    value={tempSpace.area}
                    onChange={(e) => handleAreaChange(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    className={`${inputClass} font-mono`}
                    placeholder="17"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      Heat Density (W/m²)
                    </label>
                    {customDensityOverride && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomDensityOverride(false);
                          handleDensityChange(defaultDensity);
                        }}
                        className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                      >
                        Reset to Default ({defaultDensity} W/m²)
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="1"
                    value={tempSpace.density}
                    onChange={(e) => handleDensityChange(parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder={String(defaultDensity)}
                  />
                </div>
              </div>
            </div>

            {/* COOLING CAPACITY & POWER METRICS */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" /> Computed Cooling Load Capacity
              </h3>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-2 p-3.5 rounded-2xl border border-border/70 flex flex-col gap-1">
                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">Total Dissipation</span>
                  <div className="text-[18px] font-extrabold text-foreground font-mono">
                    {Math.round(liveCalculations.dissipationWatts).toLocaleString()} <span className="text-xs font-semibold text-muted-foreground">W</span>
                  </div>
                </div>

                <div className="bg-primary/5 p-3.5 rounded-2xl border border-primary/20 flex flex-col gap-1">
                  <span className="text-[10.5px] font-bold text-primary uppercase tracking-wider">Cooling Load (kW)</span>
                  <div className="text-[18px] font-extrabold text-primary font-mono">
                    {liveCalculations.kw.toFixed(2)} <span className="text-xs font-semibold text-primary/70">kW</span>
                  </div>
                </div>

                <div className="bg-emerald-500/5 p-3.5 rounded-2xl border border-emerald-500/20 flex flex-col gap-1">
                  <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Cooling Load (TR)</span>
                  <div className="text-[18px] font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    {liveCalculations.tr.toFixed(2)} <span className="text-xs font-semibold text-emerald-600/70">TR</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Calculations Preview Drawer with smooth slide transition */}
          <div
            className={`shrink-0 bg-surface-2/60 border-l border-border overflow-hidden transition-[width,opacity,padding] duration-300 ease-in-out flex flex-col ${
              showPreview ? "w-[360px] opacity-100 p-6" : "w-0 opacity-0 p-0 border-l-transparent"
            }`}
          >
            <div className="w-[312px] space-y-4 flex flex-col h-full overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider border-b border-border/50 pb-2 shrink-0">
                <Flame className="size-4" /> Thermal Equations Preview
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-card rounded-xl border border-border/60">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Heat Dissipation (Watts)</div>
                  <div className="font-mono text-sm font-bold text-foreground mt-1">
                    Area ({liveCalculations.area} m²) × Density ({liveCalculations.density} W/m²)
                  </div>
                  <div className="text-primary font-bold font-mono text-xs mt-0.5">
                    = {Math.round(liveCalculations.dissipationWatts).toLocaleString()} Watts
                  </div>
                </div>

                <div className="p-3 bg-card rounded-xl border border-border/60">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Kilowatts Conversion</div>
                  <div className="font-mono text-sm font-bold text-foreground mt-1">
                    {Math.round(liveCalculations.dissipationWatts)} W / 1,000
                  </div>
                  <div className="text-primary font-bold font-mono text-xs mt-0.5">
                    = {liveCalculations.kw.toFixed(2)} kW
                  </div>
                </div>

                <div className="p-3 bg-card rounded-xl border border-border/60">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Tons of Refrigeration (TR)</div>
                  <div className="font-mono text-sm font-bold text-foreground mt-1">
                    {liveCalculations.kw.toFixed(2)} kW / 3.51685
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-xs mt-0.5">
                    = {liveCalculations.tr.toFixed(2)} TR ({Math.round(liveCalculations.btuh).toLocaleString()} BTU/hr)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-border/60 flex items-center justify-end gap-3 bg-card shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl text-xs font-bold bg-[#0A7BC7] hover:bg-[#0866A5] text-white shadow-md shadow-[#0A7BC7]/20 transition-all cursor-pointer"
          >
            Save Changes
          </button>
        </footer>

      </div>
    </div>
  );
}
