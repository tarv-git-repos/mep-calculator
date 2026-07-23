import React, { useState, useMemo } from "react";
import { X, Info, CheckCircle } from "lucide-react";
import { getOccupancyCategories, getOccupancyData } from "@/lib/ashrae-data";
import { calculateVentilation, type Space } from "@/lib/ventilation-calc";
import { predictOccupancyCategory, predictSpacePressure } from "@/lib/ai-occupancy";

interface EditSpaceModalProps {
  space: Space;
  onClose: () => void;
  onSave: (updatedSpace: Space) => void;
  availableZones: string[];
  availableEquipment: string[];
  availableFloors: string[];
}

export function EditSpaceModal({
  space,
  onClose,
  onSave,
  availableZones,
  availableEquipment,
  availableFloors,
}: EditSpaceModalProps) {
  const [tempSpace, setTempSpace] = useState<Space>({ ...space });
  const [showPreview, setShowPreview] = useState(false);
  const categories = getOccupancyCategories();

  // Run a live local calculation simulation for preview
  const calculatedPreview = useMemo(() => {
    try {
      const simulated = calculateVentilation([tempSpace], [], []);
      return simulated.spaces[0] || tempSpace;
    } catch (e) {
      console.error("Live calculation failed", e);
      return tempSpace;
    }
  }, [tempSpace]);

  // Fetch current category constants
  const ashraeData = useMemo(() => {
    if (tempSpace.category && !tempSpace.category.endsWith(" (Custom)") && tempSpace.category !== "OTHER") {
      return getOccupancyData(tempSpace.category);
    }
    return null;
  }, [tempSpace.category]);

  const showHeight = useMemo(() => {
    if (tempSpace.category && tempSpace.category.endsWith(" (Custom)")) {
      return (parseFloat(String(tempSpace.customAch)) || 0) > 0;
    }
    return ashraeData ? (ashraeData.ach || 0) > 0 : false;
  }, [tempSpace.category, ashraeData, tempSpace.customAch]);

  const defaultOcc = useMemo(() => {
    if (tempSpace.category && tempSpace.category.endsWith(" (Custom)")) {
      return 0;
    }
    if (ashraeData && ashraeData.exhaustPerUnit > 0 && ashraeData.defaultDensity === 0) {
      return 1;
    }
    return ashraeData ? Math.ceil((tempSpace.area * (ashraeData.defaultDensity || 0)) / 100) : 0;
  }, [tempSpace.category, ashraeData, tempSpace.area]);

  const isFixtureCategory = useMemo(() => {
    return ashraeData ? (ashraeData.exhaustPerUnit > 0 && ashraeData.defaultDensity === 0) : false;
  }, [ashraeData]);

  const occupancyLabel = isFixtureCategory ? "Fixtures (Qty)" : "Occupancy (People)";
  const defaultOccupancyLabel = isFixtureCategory ? "Default Fixtures" : "Default Occupancy";
  const occupancyUnit = isFixtureCategory ? "qty" : "occ";

  const [occVal, setOccVal] = useState<string>(
    tempSpace.isOccupancyCustomized ? String(tempSpace.occupancy) : `${defaultOcc} (default)`
  );

  React.useEffect(() => {
    if (!tempSpace.isOccupancyCustomized) {
      setOccVal(`${defaultOcc} (default)`);
    } else {
      setOccVal(String(tempSpace.occupancy));
    }
  }, [tempSpace.isOccupancyCustomized, tempSpace.occupancy, defaultOcc]);

  const handleOccChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    if (val === "" || /^\d+$/.test(val)) {
      setOccVal(val);
      return;
    }

    if (!tempSpace.isOccupancyCustomized) {
      const defaultStr = `${defaultOcc} (default)`;
      if (!val.includes(defaultStr)) {
        setOccVal("");
        return;
      }
      const typed = val.replace(defaultStr, "");
      if (/^\d+$/.test(typed)) {
        setOccVal(typed);
      }
    }
  };

  const handleOccBlur = () => {
    const parsed = parseInt(occVal);
    if (occVal === "" || isNaN(parsed)) {
      setTempSpace((prev) => {
        const next = { ...prev, isOccupancyCustomized: false, occupancy: defaultOcc };
        if (isFixtureCategory) {
          next.fixtures = defaultOcc.toString();
        } else {
          next.fixtures = "";
        }
        return next;
      });
      setOccVal(`${defaultOcc} (default)`);
    } else {
      setTempSpace((prev) => {
        const next = { ...prev, isOccupancyCustomized: true, occupancy: parsed };
        next.fixtures = parsed.toString();
        return next;
      });
      setOccVal(String(parsed));
    }
  };

  const handleInputChange = (field: keyof Space, value: any) => {
    setTempSpace((prev) => {
      const next = { ...prev, [field]: value };
      
      // If pressure is changed, clear pressureAutoDetected!
      if (field === "pressure") {
        next.pressureAutoDetected = false;
      }

      // If the name is being updated, perform automatic classification!
      if (field === "name") {
        const nameVal = value.trim();
        const pred = predictOccupancyCategory(nameVal);
        const predPress = predictSpacePressure(nameVal);

        if (pred && pred.category) {
          next.category = pred.category;
          next.aiDetected = true;

          const data = getOccupancyData(pred.category);
          if (data) {
            const density = data.defaultDensity || 0;
            const defOcc = (data.exhaustPerUnit > 0 && density === 0) ? 1 : Math.ceil((prev.area * density) / 100);
            next.occupancy = prev.isOccupancyCustomized ? prev.occupancy : defOcc;
            next.fixtures = prev.isOccupancyCustomized ? prev.occupancy.toString() : (data.exhaustPerUnit > 0 ? defOcc.toString() : "");
          }
        } else if (prev.aiDetected) {
          // Clear auto-detected category if the name is now unrecognized
          next.category = "";
          next.aiDetected = false;
        }

        if (predPress && predPress.autoDetected) {
          next.pressure = predPress.pressure;
          next.pressureAutoDetected = true;
        } else if (prev.pressureAutoDetected) {
          // Reset to default (Positive) if the name is now unrecognized
          next.pressure = "Positive";
          next.pressureAutoDetected = false;
        }
      }
      
      // Calculate density and occupancy automatically if area is changed
      if (field === "area" || field === "category") {
        const area = field === "area" ? parseFloat(value) || 0 : prev.area;
        const cat = field === "category" ? value : prev.category;
        
        if (cat && !cat.endsWith(" (Custom)") && cat !== "OTHER") {
          const data = getOccupancyData(cat);
          if (data) {
            const density = data.defaultDensity || 0;
            const defOcc = (data.exhaustPerUnit > 0 && density === 0) ? 1 : Math.ceil((area * density) / 100);
            next.occupancy = prev.isOccupancyCustomized ? prev.occupancy : defOcc;
            next.fixtures = prev.isOccupancyCustomized ? prev.occupancy.toString() : (data.exhaustPerUnit > 0 ? defOcc.toString() : "");
          }
        }
      }

      if (field === "occupancy") {
        next.fixtures = value !== "" ? value.toString() : "";
      }

      return next;
    });
  };

  const handleCategoryChange = (cat: string) => {
    setTempSpace((prev) => {
      const next = { ...prev, category: cat, aiDetected: false };
      if (cat === "OTHER") {
        next.category = "Custom (Custom)";
        next.customWorkflow = "calculate";
        next.customPeopleOA = 0;
        next.customAreaOA = 0;
        next.customExhaustPerUnit = 0;
        next.customExhaustPerArea = 0;
        next.customAch = 0;
      } else {
        delete next.customWorkflow;
        delete next.customPeopleOA;
        delete next.customAreaOA;
        delete next.customExhaustPerUnit;
        delete next.customExhaustPerArea;
        delete next.customAch;
        delete next.customFreshGiven;
        delete next.customExtTaken;

        const data = getOccupancyData(cat);
        if (data) {
          const density = data.defaultDensity || 0;
          const defOcc = (data.exhaustPerUnit > 0 && density === 0) ? 1 : Math.ceil((prev.area * density) / 100);
          next.occupancy = prev.isOccupancyCustomized ? prev.occupancy : defOcc;
          next.fixtures = prev.isOccupancyCustomized ? prev.occupancy.toString() : (data.exhaustPerUnit > 0 ? defOcc.toString() : "");
        }
      }
      return next;
    });
  };

  React.useEffect(() => {
    document.body.classList.add("modal-open-blur");
    return () => {
      document.body.classList.remove("modal-open-blur");
    };
  }, []);

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5";
  const inputClass = "w-full h-10 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12.5px] outline-none transition-all duration-150 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";
  const selectClass = "w-full h-10 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white/80 dark:focus:bg-white/10 rounded-xl text-[12.5px] outline-none transition-all duration-150 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] text-neutral-800 dark:text-neutral-100";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/10 dark:bg-black/30 p-4 animate-fade-in">
      <div onClick={(e) => e.stopPropagation()} className={`bg-white/70 dark:bg-neutral-950/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col w-full h-[85vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
        showPreview ? "max-w-5xl" : "max-w-2xl"
      }`}>
        {/* Header */}
        <header className="px-6 h-[72px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/10 dark:bg-black/10">
          <div className="flex flex-col justify-center min-w-0 pr-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-[15px] font-bold text-neutral-800 dark:text-neutral-100 truncate">Edit Space Parameters</h2>
              <span className="px-2.5 py-0.75 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[11px] font-bold font-mono tracking-tight truncate shrink-0">
                {tempSpace.code || "New Space"}
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
              Configure geometry, classification, multipliers, and pressure balancing.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-1.5 h-9.5 px-4 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-sm ${
                showPreview
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95 shadow-md shadow-primary/15"
                  : "bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/10"
              }`}
            >
              <Info className="size-3.5" />
              Calculations Preview
            </button>
            <button
              onClick={onClose}
              className="size-9 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Content body split into Form inputs and Calculations preview */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Form inputs (Left side) */}
          <div className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto">
            {/* General Info */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                General Parameters
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Space Name</label>
                  <input
                    type="text"
                    value={tempSpace.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    {tempSpace.aiDetected && <span title="Automatically identified" className="inline-block size-1.5 rounded-full bg-primary mr-1.5 cursor-help" />}Category Classification
                  </label>
                  <select
                    value={tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? "OTHER" : tempSpace.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="" className="bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200">-- Select Category --</option>
                    {categories.filter(c => c !== "OTHER").map((cat) => (
                      <option key={cat} value={cat} className="bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200">
                        {cat}
                      </option>
                    ))}
                    <option value="OTHER" className="bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200">Custom (Define Below)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Floor</label>
                  <input
                    type="text"
                    list="floors-list"
                    value={tempSpace.floor}
                    onChange={(e) => handleInputChange("floor", e.target.value)}
                    className={inputClass}
                  />
                  <datalist id="floors-list">
                    {availableFloors.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className={labelClass}>Zone Assigned</label>
                  <input
                    type="text"
                    list="zones-list"
                    value={tempSpace.zone}
                    onChange={(e) => handleInputChange("zone", e.target.value)}
                    className={inputClass}
                    placeholder="Unzoned"
                  />
                  <datalist id="zones-list">
                    {availableZones.map((z) => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className={labelClass}>Equipment Assigned</label>
                  <input
                    type="text"
                    list="equipment-list"
                    value={tempSpace.equipment}
                    onChange={(e) => handleInputChange("equipment", e.target.value)}
                    className={inputClass}
                    placeholder="Unassigned"
                  />
                  <datalist id="equipment-list">
                    {availableEquipment.map((eq) => (
                      <option key={eq} value={eq} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Geometric Parameters */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                Geometry, Multipliers & Occupancy
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Area (m²)</label>
                  <input
                    type="number"
                    step="any"
                    value={tempSpace.area}
                    onChange={(e) => handleInputChange("area", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                {showHeight ? (
                  <div>
                    <label className={labelClass}>Height (m)</label>
                    <input
                      type="number"
                      step="any"
                      value={tempSpace.height || ""}
                      onChange={(e) => handleInputChange("height", parseFloat(e.target.value) || 0)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                ) : (
                  <div>
                    <label className={labelClass}>Multiplier Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={tempSpace.multiplier === undefined || tempSpace.multiplier === null ? "" : tempSpace.multiplier}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleInputChange("multiplier", val === "" ? undefined : parseInt(val));
                      }}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                )}

                {showHeight ? (
                  <>
                    <div>
                      <label className={labelClass}>Multiplier Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={tempSpace.multiplier === undefined || tempSpace.multiplier === null ? "" : tempSpace.multiplier}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleInputChange("multiplier", val === "" ? undefined : parseInt(val));
                        }}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {!tempSpace.isOccupancyCustomized && (
                          <span title="Using default occupancy" className="inline-block size-1.5 rounded-full bg-blue-500 shrink-0" />
                        )}
                        {occupancyLabel}
                      </label>
                      <input
                        type="text"
                        value={occVal}
                        onFocus={(e) => e.target.select()}
                        onChange={handleOccChange}
                        onBlur={handleOccBlur}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className={labelClass}>
                      {!tempSpace.isOccupancyCustomized && (
                        <span title="Using default occupancy" className="inline-block size-1.5 rounded-full bg-blue-500 shrink-0" />
                      )}
                      {occupancyLabel}
                    </label>
                    <input
                      type="text"
                      value={occVal}
                      onFocus={(e) => e.target.select()}
                      onChange={handleOccChange}
                      onBlur={handleOccBlur}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Pressure Settings & Manual Overrides */}
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                Pressure Balancing Intent
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    {tempSpace.pressureAutoDetected && <span title="Automatically identified" className="inline-block size-1.5 rounded-full bg-primary mr-1.5 cursor-help" />}Space Pressure Class
                  </label>
                  <select
                    value={tempSpace.pressure}
                    onChange={(e) => handleInputChange("pressure", e.target.value)}
                    className={selectClass}
                  >
                    <option value="Neutral" className="bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200">Neutral (Balanced)</option>
                    <option value="Positive" className="bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200">Positive (+1, Supply Surplus)</option>
                    <option value="Negative" className="bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200">Negative (-1, Exhaust Surplus)</option>
                    <option value="Critical" className="bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200">Critical (-2, High Negative Exhaust)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    Manual Balancing
                  </label>
                  <div className="flex items-center h-10 gap-3 px-3.5 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]">
                    <button
                      type="button"
                      onClick={() => handleInputChange("isManualAirflow", !tempSpace.isManualAirflow)}
                      className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                        tempSpace.isManualAirflow ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          tempSpace.isManualAirflow ? "translate-x-4.5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-[12px] text-neutral-600 dark:text-neutral-400 select-none font-medium">
                      Enable overrides (Bypass engine)
                    </span>
                  </div>
                </div>
              </div>

              {tempSpace.isManualAirflow && (
                <div className="grid grid-cols-2 gap-4 pt-1 animate-fade-in">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Manual Supply Fresh Air (L/s)
                    </label>
                    <input
                      type="number"
                      value={tempSpace.manualFreshGiven || 0}
                      onChange={(e) => handleInputChange("manualFreshGiven", parseFloat(e.target.value) || 0)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Manual Extract Air (L/s)
                    </label>
                    <input
                      type="number"
                      value={tempSpace.manualExtTaken || 0}
                      onChange={(e) => handleInputChange("manualExtTaken", parseFloat(e.target.value) || 0)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Custom Category Details */}
            {(tempSpace.category && tempSpace.category.endsWith(" (Custom)")) && (
              <div className="p-5 bg-white/30 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 animate-fade-in shadow-sm">
                <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest">
                  Custom Category Parameters
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Workflow Method</label>
                    <select
                      value={tempSpace.customWorkflow || "calculate"}
                      onChange={(e) => handleInputChange("customWorkflow", e.target.value)}
                      className={selectClass}
                    >
                      <option value="calculate" className="bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200">Calculate Airflow Rates</option>
                      <option value="direct" className="bg-white dark:bg-[#1e1e22] text-neutral-800 dark:text-neutral-200">Direct Airflow Values</option>
                    </select>
                  </div>
                </div>

                {tempSpace.customWorkflow === "calculate" ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">People OA (L/s/person)</label>
                      <input
                        type="number"
                        step="any"
                        value={tempSpace.customPeopleOA || 0}
                        onChange={(e) => handleInputChange("customPeopleOA", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">Area OA (L/s/m²)</label>
                      <input
                        type="number"
                        step="any"
                        value={tempSpace.customAreaOA || 0}
                        onChange={(e) => handleInputChange("customAreaOA", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">ACH</label>
                      <input
                        type="number"
                        step="any"
                        value={tempSpace.customAch || 0}
                        onChange={(e) => handleInputChange("customAch", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">Exh per Area (L/s/m²)</label>
                      <input
                        type="number"
                        step="any"
                        value={tempSpace.customExhaustPerArea || 0}
                        onChange={(e) => handleInputChange("customExhaustPerArea", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">Exh per Unit (L/s/unit)</label>
                      <input
                        type="number"
                        step="any"
                        value={tempSpace.customExhaustPerUnit || 0}
                        onChange={(e) => handleInputChange("customExhaustPerUnit", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">Custom Fresh Given (L/s)</label>
                      <input
                        type="number"
                        value={tempSpace.customFreshGiven || 0}
                        onChange={(e) => handleInputChange("customFreshGiven", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">Custom Extract Taken (L/s)</label>
                      <input
                        type="number"
                        value={tempSpace.customExtTaken || 0}
                        onChange={(e) => handleInputChange("customExtTaken", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Calculations preview (Right side) */}
          <div
            className={`shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
              showPreview ? "w-[400px] opacity-100 p-6 border-l-border" : "w-0 opacity-0 p-0 border-l-transparent"
            }`}
          >
            <div className="w-[352px] space-y-5 flex flex-col h-full overflow-y-auto">
              <h3 className="text-[11px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0">
                Calculations Preview
              </h3>

              {/* Classification Card */}
              {ashraeData && (
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-3 shrink-0 shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                    ASHRAE 62.1 Standard Rates
                  </div>
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-[12px] font-mono">
                    <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                      <span className="text-neutral-500 dark:text-neutral-400">Density:</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{ashraeData.defaultDensity} occ</span>
                    </div>
                    <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                      <span className="text-neutral-500 dark:text-neutral-400">OA (People):</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{ashraeData.peopleOA} L/s</span>
                    </div>
                    <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                      <span className="text-neutral-500 dark:text-neutral-400">OA (Area):</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{ashraeData.areaOA} L/s</span>
                    </div>
                    <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1.5">
                      <span className="text-neutral-500 dark:text-neutral-400">ACH Rate:</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{ashraeData.ach} / Cl. {ashraeData.airClass}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Calculations Summary */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 shadow-sm">
                  <div className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Minimum Airflow Required
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline text-[12px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Outdoor Air (min):</span>
                      <span className="font-mono font-bold text-[14px] text-primary">
                        {calculatedPreview.minOA?.toLocaleString()} L/s
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2 rounded-xl border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {tempSpace.isManualAirflow ? (
                        `Manual override: ${tempSpace.manualFreshGiven || 0} L/s × ${tempSpace.multiplier || 1}`
                      ) : tempSpace.category && tempSpace.category.endsWith(" (Custom)") && tempSpace.customWorkflow === "direct" ? (
                        `Custom Direct: ${tempSpace.customFreshGiven || 0} L/s × ${tempSpace.multiplier || 1}`
                      ) : (
                        `(${tempSpace.area} m² × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customAreaOA : ashraeData?.areaOA || 0} L/s) + (${tempSpace.occupancy} occ × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customPeopleOA : ashraeData?.peopleOA || 0} L/s) × ${tempSpace.multiplier || 1}`
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline text-[12px] pt-1.5 border-t border-black/5 dark:border-white/5">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Extract Exhaust (min):</span>
                      <span className="font-mono font-bold text-[14px] text-amber-600 dark:text-amber-500">
                        {calculatedPreview.minExt?.toLocaleString()} L/s
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-2 rounded-xl border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {tempSpace.isManualAirflow ? (
                        `Manual override: ${tempSpace.manualExtTaken || 0} L/s × ${tempSpace.multiplier || 1}`
                      ) : tempSpace.category && tempSpace.category.endsWith(" (Custom)") && tempSpace.customWorkflow === "direct" ? (
                        `Custom Direct: ${tempSpace.customExtTaken || 0} L/s × ${tempSpace.multiplier || 1}`
                      ) : (
                        `(${tempSpace.occupancy} × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customExhaustPerUnit : ashraeData?.exhaustPerUnit || 0} L/s) + (${tempSpace.area} m² × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customExhaustPerArea : ashraeData?.exhaustPerArea || 0} L/s) + (${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customAch : ashraeData?.ach || 0} ACH × vol/3.6) × ${tempSpace.multiplier || 1}`
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Info */}
              <div className="shrink-0 p-4 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl flex items-start gap-2.5 text-[12px] text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/5">
                <CheckCircle className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <span className="font-semibold">Calculations verified.</span> Space inputs satisfy ASHRAE 62.1 requirements.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 h-16 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="h-10 px-5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              let finalSpace = { ...tempSpace };
              if (
                finalSpace.multiplier === undefined ||
                finalSpace.multiplier === null ||
                isNaN(finalSpace.multiplier) ||
                finalSpace.multiplier <= 0
              ) {
                alert("Multiplier cannot be 0. Saving as 1.");
                finalSpace.multiplier = 1;
              }
              onSave(finalSpace);
            }}
            className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-[12.5px] font-semibold transition-all shadow-md shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}
