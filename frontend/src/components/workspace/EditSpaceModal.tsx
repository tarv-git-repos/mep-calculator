import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, CheckCircle, Flame } from "lucide-react";
import { getOccupancyCategories, getOccupancyData, getCategoryDisplayName } from "@/lib/ashrae-data";
import { calculateVentilation, type Space } from "@/lib/ventilation-calc";
import { predictOccupancyCategory, predictSpacePressure } from "@/lib/ai-occupancy";
import { CategorySelect } from "./CategorySelect";
import { FloorSelect } from "./FloorSelect";

interface EditSpaceModalProps {
  space: Space;
  onClose: () => void;
  onSave: (updatedSpace: Space) => void;
  availableZones: string[];
  availableEquipment: string[];
  availableFloors: string[];
}

const RESTROOM_SUBCATS = [
  { key: "toiletPrivateContinuous", label: "Toilet - private (continuous)", rate: "12.5 L/s per toilet" },
  { key: "toiletPublicContinuous", label: "Toilet - public (continuous)", rate: "25.0 L/s per toilet" },
  { key: "toiletPrivateDiscontinuous", label: "Toilet - private (discontinuous)", rate: "25.0 L/s per toilet" },
  { key: "toiletPublicDiscontinuous", label: "Toilet - public (discontinuous)", rate: "35.0 L/s per toilet" },
  { key: "showerContinuous", label: "Shower Rooms (continuous)", rate: "10.0 L/s per shower" },
  { key: "showerDiscontinuous", label: "Shower Rooms (discontinuous)", rate: "25.0 L/s per shower" },
  { key: "janitorCloset", label: "Janitor Closets, Trash Rooms, Recycling", rate: "50.0 L/s per closet" },
  { key: "lockerRoom", label: "Locker Rooms", rate: "25.0 L/s per room" },
];

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
  const [showRestroomModal, setShowRestroomModal] = useState(false);
  const categories = getOccupancyCategories();

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
    if (tempSpace.category && !tempSpace.category.endsWith(" (Custom)") && tempSpace.category !== "Other") {
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
          next.category = "";
          next.aiDetected = false;
        }

        const predPress = predictSpacePressure(next.category);
        if (predPress && predPress.autoDetected) {
          next.pressure = predPress.pressure;
          next.pressureAutoDetected = true;
        } else if (prev.pressureAutoDetected) {
          next.pressure = "Positive";
          next.pressureAutoDetected = false;
        }
      }

      // If category is explicitly changed, run auto pressure detection
      if (field === "category") {
        const predPress = predictSpacePressure(value);
        if (predPress && predPress.autoDetected) {
          next.pressure = predPress.pressure;
          next.pressureAutoDetected = true;
        }
      }

      // Calculate density and occupancy automatically if area is changed
      if (field === "area" || field === "category") {
        const area = field === "area" ? parseFloat(value) || 0 : prev.area;
        const cat = field === "category" ? value : prev.category;
        
        if (cat && !cat.endsWith(" (Custom)") && cat !== "Other") {
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
      if (cat === "Other") {
        next.category = "Custom (Custom)";
        next.customWorkflow = "calculate";
        next.customPeopleOA = 0;
        next.customAreaOA = 0;
        next.customExhaustPerUnit = 0;
        next.customExhaustPerArea = 0;
        next.customAch = 0;
      } else if (cat === "Rest Room / Changing Room") {
        delete next.customWorkflow;
        delete next.customPeopleOA;
        delete next.customAreaOA;
        delete next.customExhaustPerUnit;
        delete next.customExhaustPerArea;
        delete next.customAch;
        delete next.customFreshGiven;
        delete next.customExtTaken;

        if (!next.restroomSubCategories) {
          next.restroomSubCategories = {
            toiletPrivateContinuous: 0,
            toiletPublicContinuous: 0,
            toiletPrivateDiscontinuous: 0,
            toiletPublicDiscontinuous: 0,
            showerContinuous: 0,
            showerDiscontinuous: 0,
            janitorCloset: 0,
            lockerRoom: 0,
          };
        }
        setTimeout(() => setShowRestroomModal(true), 50);
      } else if (cat === "") {
        delete next.customWorkflow;
        delete next.customPeopleOA;
        delete next.customAreaOA;
        delete next.customExhaustPerUnit;
        delete next.customExhaustPerArea;
        delete next.customAch;
        delete next.customFreshGiven;
        delete next.customExtTaken;
        next.category = "";
        next.occupancy = 0;
        next.fixtures = "";
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

  const labelClass = "block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5";
  const inputClass = "w-full h-9 px-3 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400";
  const selectClass = "w-full h-9 px-2.5 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 rounded-lg text-[12px] outline-none transition-all text-neutral-800 dark:text-neutral-100";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/20 dark:bg-black/50 p-4 animate-fade-in font-sans">
      <div onClick={(e) => e.stopPropagation()} className={`bg-white/80 dark:bg-neutral-950/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-h-[88vh] overflow-hidden transition-[max-width] duration-300 ease-in-out ${
        showPreview ? "max-w-4xl" : "max-w-xl"
      }`}>
        {/* Header */}
        <header className="px-5 h-14 flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <h2 className="text-[14.5px] font-bold text-neutral-800 dark:text-neutral-100 truncate">Edit Space Parameters</h2>
            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 text-[10.5px] font-bold font-mono tracking-tight shrink-0">
              {tempSpace.code || "Space"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
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
                    value={tempSpace.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Office Space 1"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    {tempSpace.aiDetected && <span title="Automatically identified" className="inline-block size-1.5 rounded-full bg-primary mr-1 cursor-help" />}Category Classification
                  </label>
                  <CategorySelect
                    value={tempSpace.category || ""}
                    onChange={handleCategoryChange}
                    triggerClassName="w-full bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border rounded-lg px-2.5 py-1 w-full outline-none cursor-pointer transition-all text-foreground h-9 text-[12px]"
                  />
                  {tempSpace.category === "Rest Room / Changing Room" && (
                    <button
                      type="button"
                      onClick={() => setShowRestroomModal(true)}
                      className="mt-1.5 w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition cursor-pointer"
                    >
                      ⚙️ Configure Rest Room Fixtures
                    </button>
                  )}
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
                  <label className={labelClass}>Zone Assigned</label>
                  <input
                    type="text"
                    list="zones-list"
                    value={tempSpace.zone}
                    onChange={(e) => handleInputChange("zone", e.target.value)}
                    className={inputClass}
                    placeholder="Unzoned / Default"
                  />
                  <datalist id="zones-list">
                    {availableZones.map((z) => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Geometric & Occupancy Parameters */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Geometry & Occupancy
              </h3>
              <div className={`grid ${showHeight ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
                <div>
                  <label className={labelClass}>Area (m²)</label>
                  <input
                    type="number"
                    step="any"
                    value={tempSpace.area}
                    onChange={(e) => handleInputChange("area", parseFloat(e.target.value) || 0)}
                    className={`${inputClass} font-mono`}
                    placeholder="100"
                  />
                </div>
                {showHeight && (
                  <div>
                    <label className={labelClass}>Height (m)</label>
                    <input
                      type="number"
                      step="any"
                      value={tempSpace.height || ""}
                      onChange={(e) => handleInputChange("height", parseFloat(e.target.value) || 0)}
                      className={`${inputClass} font-mono`}
                      placeholder="3.0"
                    />
                  </div>
                )}
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
              </div>
            </div>

            {/* Pressure Settings & Manual Overrides */}
            <div className="space-y-3">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" /> Pressure Balancing Intent
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    {tempSpace.pressureAutoDetected && <span title="Automatically identified" className="inline-block size-1.5 rounded-full bg-primary mr-1 cursor-help" />}Space Pressure Class
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
                  <label className={labelClass}>Manual Balancing</label>
                  <div className="flex items-center h-9 gap-2 px-3 bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg">
                    <button
                      type="button"
                      onClick={() => handleInputChange("isManualAirflow", !tempSpace.isManualAirflow)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none ${
                        tempSpace.isManualAirflow ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          tempSpace.isManualAirflow ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-[11.5px] text-neutral-600 dark:text-neutral-400 select-none font-medium">
                      Enable overrides (Bypass)
                    </span>
                  </div>
                </div>
              </div>

              {tempSpace.isManualAirflow && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-fade-in">
                  <div>
                    <label className="block text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
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
                    <label className="block text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
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
              <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 animate-fade-in shadow-xs">
                <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest">
                  Custom Category Parameters
                </h3>
                <div className="grid grid-cols-2 gap-3">
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
                  <div className="grid grid-cols-3 gap-2.5 text-xs">
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">Custom Fresh Given (L/s)</label>
                      <input
                        type="number"
                        value={tempSpace.customFreshGiven || 0}
                        onChange={(e) => handleInputChange("customFreshGiven", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">Custom Extract Taken (L/s)</label>
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
              showPreview ? "w-[360px] opacity-100 p-5 border-l-border" : "w-0 opacity-0 p-0 border-l-transparent"
            }`}
          >
            <div className="w-[320px] space-y-4 flex flex-col h-full overflow-y-auto custom-scrollbar">
              <h3 className="text-[10.5px] uppercase font-bold text-primary tracking-widest pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0 flex items-center gap-1.5">
                <Flame className="size-3.5" /> Calculations Preview
              </h3>

              {/* Classification Card */}
              {tempSpace.category === "Rest Room / Changing Room" ? (
                <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2.5 shrink-0 shadow-xs">
                  <div className="text-[9.5px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                    Rest Room Configuration Summary
                  </div>
                  <div className="space-y-1 text-[11px] font-mono">
                    {Object.entries(tempSpace.restroomSubCategories || {}).map(([key, val]) => {
                      if (!val) return null;
                      const subcat = RESTROOM_SUBCATS.find(s => s.key === key);
                      return (
                        <div key={key} className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1 select-none">
                          <span className="text-neutral-500 dark:text-neutral-400 truncate max-w-[180px]">{subcat?.label}:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 shrink-0">{val} unit(s)</span>
                        </div>
                      );
                    })}
                    {!Object.values(tempSpace.restroomSubCategories || {}).some(Boolean) && (
                      <span className="text-[11px] italic text-neutral-500 dark:text-neutral-400 block py-0.5">No fixtures configured yet.</span>
                    )}
                  </div>
                </div>
              ) : ashraeData && (
                <div className="p-3.5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-2.5 shrink-0 shadow-xs">
                  <div className="text-[9.5px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                    ASHRAE 62.1 Standard Rates
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px] font-mono">
                    <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                      <span className="text-neutral-500 dark:text-neutral-400">Density:</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{ashraeData.defaultDensity} occ</span>
                    </div>
                    <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                      <span className="text-neutral-500 dark:text-neutral-400">OA (People):</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{ashraeData.peopleOA} L/s</span>
                    </div>
                    <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                      <span className="text-neutral-500 dark:text-neutral-400">OA (Area):</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{ashraeData.areaOA} L/s</span>
                    </div>
                    <div className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                      <span className="text-neutral-500 dark:text-neutral-400">ACH Rate:</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{ashraeData.ach}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Calculations Summary */}
              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-4 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl space-y-3 shadow-xs">
                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Minimum Airflow Required
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px]">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Outdoor Air (min):</span>
                      <span className="font-mono font-bold text-[13.5px] text-primary">
                        {calculatedPreview.minOA?.toLocaleString()} L/s
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {tempSpace.isManualAirflow ? (
                        `Manual override: ${tempSpace.manualFreshGiven || 0} L/s`
                      ) : tempSpace.category === "Rest Room / Changing Room" ? (
                        `Restrooms require 0 L/s fresh air supply (exhaust only)`
                      ) : tempSpace.category && tempSpace.category.endsWith(" (Custom)") && tempSpace.customWorkflow === "direct" ? (
                        `Custom Direct: ${tempSpace.customFreshGiven || 0} L/s`
                      ) : (
                        `(${tempSpace.area} m² × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customAreaOA : ashraeData?.areaOA || 0} L/s) + (${tempSpace.occupancy} occ × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customPeopleOA : ashraeData?.peopleOA || 0} L/s)`
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-[11.5px] pt-1.5 border-t border-black/5 dark:border-white/5">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Extract Exhaust (min):</span>
                      <span className="font-mono font-bold text-[13.5px] text-amber-600 dark:text-amber-500">
                        {calculatedPreview.minExt?.toLocaleString()} L/s
                      </span>
                    </div>
                    <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono bg-white/20 dark:bg-black/35 p-1.5 rounded-lg border border-black/5 dark:border-white/5 break-all leading-relaxed">
                      {tempSpace.isManualAirflow ? (
                        `Manual override: ${tempSpace.manualExtTaken || 0} L/s`
                      ) : tempSpace.category === "Rest Room / Changing Room" ? (
                        `Sum of fixtures exhaust`
                      ) : tempSpace.category && tempSpace.category.endsWith(" (Custom)") && tempSpace.customWorkflow === "direct" ? (
                        `Custom Direct: ${tempSpace.customExtTaken || 0} L/s`
                      ) : (
                        `(${tempSpace.occupancy} × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customExhaustPerUnit : ashraeData?.exhaustPerUnit || 0} L/s) + (${tempSpace.area} m² × ${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customExhaustPerArea : ashraeData?.exhaustPerArea || 0} L/s) + (${tempSpace.category && tempSpace.category.endsWith(" (Custom)") ? tempSpace.customAch : ashraeData?.ach || 0} ACH × vol/3.6)`
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Info */}
              <div className="shrink-0 p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl flex items-start gap-2 text-[11.5px] text-emerald-600 dark:text-emerald-400 shadow-xs">
                <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <span className="font-semibold">Calculations verified.</span> Space inputs satisfy ASHRAE 62.1 requirements.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 h-14 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-lg text-[12px] font-medium transition-colors cursor-pointer shadow-xs"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const isReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly);
              if (isReadOnly) {
                toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
                return;
              }
              let finalSpace = { ...tempSpace };
              finalSpace.multiplier = 1;
              onSave(finalSpace);
            }}
            className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            Save Changes
          </button>
        </footer>
      </div>

      {showRestroomModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs font-sans">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <header className="px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/30">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                  Rest Room Configuration
                </h3>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  Enter fixture quantities to compute total exhaust.
                </p>
              </div>
            </header>
            <div className="p-5 max-h-[55vh] overflow-y-auto space-y-3 custom-scrollbar">
              {[
                { key: "toiletPrivateContinuous", label: "Toilet - private (continuous)", rate: "12.5 L/s per toilet" },
                { key: "toiletPublicContinuous", label: "Toilet - public (continuous)", rate: "25.0 L/s per toilet" },
                { key: "toiletPrivateDiscontinuous", label: "Toilet - private (discontinuous)", rate: "25.0 L/s per toilet" },
                { key: "toiletPublicDiscontinuous", label: "Toilet - public (discontinuous)", rate: "35.0 L/s per toilet" },
                { key: "showerContinuous", label: "Shower Rooms (continuous)", rate: "10.0 L/s per shower" },
                { key: "showerDiscontinuous", label: "Shower Rooms (discontinuous)", rate: "25.0 L/s per shower" },
                { key: "janitorCloset", label: "Janitor Closets, Trash Rooms", rate: `5.0 L/s per m² (${(5.0 * (tempSpace.area || 0)).toFixed(1)} L/s)` },
                { key: "lockerRoom", label: "Locker Rooms", rate: `1.25 L/s per m² (${(1.25 * (tempSpace.area || 0)).toFixed(1)} L/s)` },
              ].map((subcat) => {
                const sub = tempSpace.restroomSubCategories || {};
                const qty = sub[subcat.key] || 0;
                return (
                  <div key={subcat.key} className="flex items-center justify-between gap-3 py-1 border-b border-slate-100/60 dark:border-zinc-900/60">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-semibold text-slate-700 dark:text-zinc-300">
                        {subcat.label}
                      </span>
                      <span className="text-[9.5px] text-muted-foreground">
                        {subcat.rate}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={qty}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setTempSpace((prev) => {
                          const sub = prev.restroomSubCategories || {};
                          return {
                            ...prev,
                            restroomSubCategories: {
                              ...sub,
                              [subcat.key]: val
                            }
                          };
                        });
                      }}
                      className="w-16 h-8 px-2 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[12px] font-bold outline-none focus:border-primary text-neutral-800 dark:text-neutral-200"
                    />
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-zinc-900/30 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Exhaust
                </span>
                <span className="text-[14px] font-black text-primary">
                  {(() => {
                    const sub = tempSpace.restroomSubCategories || {};
                    const areaVal = tempSpace.area || 0;
                    let total = 0;
                    total += (sub.toiletPrivateContinuous || 0) * 12.5;
                    total += (sub.toiletPublicContinuous || 0) * 25.0;
                    total += (sub.toiletPrivateDiscontinuous || 0) * 25.0;
                    total += (sub.toiletPublicDiscontinuous || 0) * 35.0;
                    total += (sub.showerContinuous || 0) * 10.0;
                    total += (sub.showerDiscontinuous || 0) * 25.0;
                    total += (sub.janitorCloset || 0) * areaVal * 5.0;
                    total += (sub.lockerRoom || 0) * areaVal * 1.25;
                    return total;
                  })()}{" "}
                  L/s
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRestroomModal(false)}
                className="px-4 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg shadow-sm hover:bg-primary/95 transition cursor-pointer"
              >
                Apply &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
