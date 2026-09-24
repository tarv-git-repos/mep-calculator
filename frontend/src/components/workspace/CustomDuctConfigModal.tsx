import React, { useState, useEffect } from "react";
import {
  X, Check, SlidersHorizontal, Wind, Gauge,
  RotateCcw, Building2, Store, Hotel, Utensils, Factory, Info
} from "lucide-react";
import { DUCT_PRESETS, type DuctPresetKey } from "./DuctPresetSelect";
import { toast } from "sonner";

export interface CustomDuctConfigModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  unitSystem?: "ip" | "si";
  currentValues?: {
    airflow?: number | "";
    targetFr?: number | "";
    ductShape?: "round" | "rect";
    aspectRatio?: number;
    customProfileName?: string;
  };
  initialConfig?: {
    airflow?: number | "";
    targetFr?: number | "";
    ductShape?: "round" | "rect";
    aspectRatio?: number;
    customProfileName?: string;
  };
  onApply?: (updated: {
    airflow: number;
    targetFr: number;
    ductShape: "round" | "rect";
    aspectRatio: number;
    customProfileName: string;
  }) => void;
  onSave?: (updated: {
    airflow: number;
    targetFr: number;
    ductShape: "round" | "rect";
    aspectRatio: number;
    customProfileName: string;
  }) => void;
}

const CFM_TO_LPS = 0.471947;
const LPS_TO_CFM = 2.11888;
const INWG_TO_PAM = 8.16828;
const PAM_TO_INWG = 1 / 8.16828;

export function CustomDuctConfigModal({
  open,
  isOpen,
  onClose,
  unitSystem = "ip",
  currentValues,
  initialConfig,
  onApply,
  onSave,
}: CustomDuctConfigModalProps) {
  const isModalOpen = Boolean(open ?? isOpen);
  const isSI = unitSystem === "si";

  const config = currentValues || initialConfig || {};

  // Form State (Internal IP storage)
  const [profileName, setProfileName] = useState(
    config.customProfileName || "Custom Duct Sizing Profile"
  );
  const [airflow, setAirflow] = useState<number>(Number(config.airflow) || 2500);
  const [targetFr, setTargetFr] = useState<number>(Number(config.targetFr) || 0.08);
  const [ductShape, setDuctShape] = useState<"round" | "rect">(config.ductShape || "rect");
  const [aspectRatio, setAspectRatio] = useState<number>(config.aspectRatio || 1.5);

  useEffect(() => {
    if (isModalOpen) {
      const activeConfig = currentValues || initialConfig || {};
      setProfileName(activeConfig.customProfileName || "Custom Duct Sizing Profile");
      setAirflow(Number(activeConfig.airflow) || 2500);
      setTargetFr(Number(activeConfig.targetFr) || 0.08);
      setDuctShape(activeConfig.ductShape || "rect");
      setAspectRatio(activeConfig.aspectRatio || 1.5);
    }
  }, [isModalOpen, currentValues, initialConfig]);

  if (!isModalOpen) return null;

  const handleApplyPresetTemplate = (key: DuctPresetKey) => {
    const t = DUCT_PRESETS[key];
    if (!t) return;
    setAirflow(t.airflow);
    setTargetFr(t.targetFr);
    setDuctShape(t.ductShape);
    setAspectRatio(t.aspectRatio);
    setProfileName(`${t.label} (Customized)`);
    toast.info(`Loaded parameters from template "${t.label}"`);
  };

  const handleResetToDefault = () => {
    const def = DUCT_PRESETS.commercial_office_main;
    setAirflow(def.airflow);
    setTargetFr(def.targetFr);
    setDuctShape(def.ductShape);
    setAspectRatio(def.aspectRatio);
    setProfileName("Commercial Office Main Supply (Custom)");
    toast.info("Reset parameters to standard commercial supply");
  };

  const handleSaveAndApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      toast.error("Please enter a custom profile name");
      return;
    }
    if (airflow <= 0) {
      toast.error("Airflow must be greater than 0");
      return;
    }
    if (targetFr <= 0) {
      toast.error("Target friction rate must be greater than 0");
      return;
    }

    const payload = {
      airflow,
      targetFr,
      ductShape,
      aspectRatio,
      customProfileName: profileName.trim(),
    };

    if (onApply) onApply(payload);
    else if (onSave) onSave(payload);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in font-sans select-none"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-foreground animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-border/80 flex items-center justify-between bg-surface-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Custom Duct Sizing Profile</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase">
                  SMACNA Equal Friction
                </span>
              </div>
              <p className="text-[11.5px] text-muted-foreground">
                Configure user-defined airflow, target friction rate, shape, and aspect ratio.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSaveAndApply} className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {/* Quick-Start Template Pills */}
          <div className="space-y-2">
            <label className="text-[11.5px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" /> Load Starting Template:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPresetTemplate("commercial_office_main")}
                className="flex items-center gap-2 p-2 rounded-xl border border-border/70 bg-surface-2 hover:bg-surface text-xs font-semibold transition text-left cursor-pointer"
              >
                <Building2 className="size-3.5 text-primary shrink-0" />
                <span className="truncate">Office Supply</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetTemplate("retail_branch_duct")}
                className="flex items-center gap-2 p-2 rounded-xl border border-border/70 bg-surface-2 hover:bg-surface text-xs font-semibold transition text-left cursor-pointer"
              >
                <Store className="size-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Retail Branch</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetTemplate("hotel_guestroom_riser")}
                className="flex items-center gap-2 p-2 rounded-xl border border-border/70 bg-surface-2 hover:bg-surface text-xs font-semibold transition text-left cursor-pointer"
              >
                <Hotel className="size-3.5 text-blue-500 shrink-0" />
                <span className="truncate">Hotel Riser</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetTemplate("kitchen_exhaust_duct")}
                className="flex items-center gap-2 p-2 rounded-xl border border-border/70 bg-surface-2 hover:bg-surface text-xs font-semibold transition text-left cursor-pointer"
              >
                <Utensils className="size-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">Kitchen Exhaust</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetTemplate("industrial_high_velocity")}
                className="flex items-center gap-2 p-2 rounded-xl border border-border/70 bg-surface-2 hover:bg-surface text-xs font-semibold transition text-left cursor-pointer"
              >
                <Factory className="size-3.5 text-purple-500 shrink-0" />
                <span className="truncate">Industrial Trunk</span>
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="flex items-center gap-2 p-2 rounded-xl border border-border/70 bg-surface-2 hover:bg-surface text-xs font-semibold text-muted-foreground transition text-left cursor-pointer"
              >
                <RotateCcw className="size-3.5 shrink-0" />
                <span className="truncate">Reset Defaults</span>
              </button>
            </div>
          </div>

          {/* Profile Name */}
          <div className="space-y-1.5 bg-surface-2/60 p-3 rounded-xl border border-border/60">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Custom Profile Display Name</span>
              <span className="text-[10.5px] text-muted-foreground font-normal">Appears in header dropdown</span>
            </label>
            <input
              type="text"
              required
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g. AHU-01 Main Supply Header"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-primary text-foreground"
            />
          </div>

          {/* Aerodynamic Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Airflow */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-surface-2/40">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Design Airflow (Q)</span>
                <span className="text-[10px] font-mono text-primary font-bold">{isSI ? "L/s" : "CFM"}</span>
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={isSI ? Math.round(airflow * CFM_TO_LPS) : airflow}
                onChange={(e) => {
                  const num = parseFloat(e.target.value) || 0;
                  setAirflow(isSI ? num * LPS_TO_CFM : num);
                }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-primary font-mono text-foreground"
              />
              <span className="text-[10.5px] text-muted-foreground block">
                {isSI ? `Equivalent to ${Math.round(airflow)} CFM` : `Equivalent to ${(airflow * CFM_TO_LPS).toFixed(1)} L/s`}
              </span>
            </div>

            {/* Target Friction Rate */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-surface-2/40">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Target Friction Rate</span>
                <span className="text-[10px] font-mono text-primary font-bold">{isSI ? "Pa/m" : "in.wg/100ft"}</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                required
                value={isSI ? Number((targetFr * INWG_TO_PAM).toFixed(2)) : targetFr}
                onChange={(e) => {
                  const num = parseFloat(e.target.value) || 0;
                  setTargetFr(isSI ? num * PAM_TO_INWG : num);
                }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-primary font-mono text-foreground"
              />
              <span className="text-[10.5px] text-muted-foreground block">
                Standard design: 0.08 in.wg/100ft (0.65 Pa/m)
              </span>
            </div>
          </div>

          {/* Duct Geometry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Shape */}
            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-surface-2/40">
              <label className="text-xs font-bold text-foreground">Duct Cross-Section Shape</label>
              <div className="flex bg-surface p-1 rounded-lg gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setDuctShape("round")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                    ductShape === "round"
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Round Spiral
                </button>
                <button
                  type="button"
                  onClick={() => setDuctShape("rect")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                    ductShape === "rect"
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Rectangular
                </button>
              </div>
            </div>

            {/* Aspect Ratio */}
            {ductShape === "rect" ? (
              <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-surface-2/40">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Aspect Ratio (W:H)</span>
                  <span className="text-[10px] font-mono text-primary font-bold">{aspectRatio.toFixed(1)}:1</span>
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-primary text-foreground"
                >
                  <option value="1.0">1:1 - Square Duct</option>
                  <option value="1.5">1.5:1 - Low Profile (Standard)</option>
                  <option value="2.0">2:1 - Medium Aspect</option>
                  <option value="3.0">3:1 - Flat / Wide Space</option>
                  <option value="4.0">4:1 - Maximum Recommended</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-surface-2/40 opacity-50">
                <label className="text-xs font-bold text-muted-foreground">Aspect Ratio (W:H)</label>
                <div className="text-xs text-muted-foreground py-2 italic">Not applicable for circular ducts (1:1)</div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/80 bg-surface-2 hover:bg-surface text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="size-4" /> Apply Custom Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
