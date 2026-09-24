import React, { useState, useEffect, useMemo } from "react";
import { X, Building2, ShieldCheck, Check, Layers, ShieldAlert, Droplets, Gauge } from "lucide-react";
import {
  type CivilDefenseBuilding,
  type CivilDefenseOccupancy,
  evaluateCivilDefenseFireDemand
} from "@/lib/civilDefenseFireDemandCalc";

export interface EditBuildingModalProps {
  open: boolean;
  onClose: () => void;
  building: CivilDefenseBuilding;
  onSave: (updated: CivilDefenseBuilding) => void;
  isReadOnly?: boolean;
  occupancyOptions: { value: CivilDefenseOccupancy; label: string; desc: string }[];
  unitSystem?: "si" | "ip";
}

export function EditBuildingModal({
  open,
  onClose,
  building,
  onSave,
  isReadOnly = false,
  occupancyOptions,
  unitSystem = "si",
}: EditBuildingModalProps) {
  const [formData, setFormData] = useState<CivilDefenseBuilding>({ ...building });

  // Reset form when building changes or modal opens
  useEffect(() => {
    setFormData({ ...building });
  }, [building, open]);

  // Live evaluation preview of the updated building data
  const previewEvaluation = useMemo(() => {
    try {
      return evaluateCivilDefenseFireDemand(formData);
    } catch (e) {
      return null;
    }
  }, [formData]);

  if (!open) return null;

  const handleChange = (field: keyof CivilDefenseBuilding, value: any) => {
    if (isReadOnly) return;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (isReadOnly) {
      onClose();
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-surface-1 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Active Building Parameters
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure architectural and occupancy parameters for UAE Civil Defense evaluation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Modal Body - Form Fields (Matching Screenshot 2) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          
          {/* Building / Block Name */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Building / Block Name:
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-surface-2 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              placeholder="e.g. Tower A (Hotel & Residences)"
            />
          </div>

          {/* Occupancy Classification */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Occupancy Classification (Chapter 9):
            </label>
            <select
              disabled={isReadOnly}
              value={formData.occupancy}
              onChange={(e) => handleChange("occupancy", e.target.value as CivilDefenseOccupancy)}
              className="w-full px-3.5 py-2 text-xs bg-surface-2 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 cursor-pointer"
            >
              {occupancyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Height to Top Floor & Floors Above Grade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Height to Top Floor (m):
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                disabled={isReadOnly}
                value={formData.height}
                onChange={(e) => handleChange("height", parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 text-xs bg-surface-2 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Civil Defense Tiers: &gt;90m, 45–90m, 23–45m, 15–23m, ≤15m
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Floors Above Grade:
              </label>
              <input
                type="number"
                min="1"
                disabled={isReadOnly}
                value={formData.floors}
                onChange={(e) => handleChange("floors", parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2 text-xs bg-surface-2 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Number of stories (G + {Math.max(0, formData.floors - 1)})
              </span>
            </div>
          </div>

          {/* Ground Floor Area & Plot Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Ground Floor Area (m²):
              </label>
              <input
                type="number"
                min="10"
                disabled={isReadOnly}
                value={formData.groundFloorArea}
                onChange={(e) => handleChange("groundFloorArea", parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 text-xs bg-surface-2 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Code Thresholds: 500 m², 900 m², 3600 m²
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Plot Area (m²):
              </label>
              <input
                type="number"
                min="50"
                disabled={isReadOnly}
                value={formData.plotArea}
                onChange={(e) => handleChange("plotArea", parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 text-xs bg-surface-2 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                &gt;20,000 m² triggers external yard hydrants
              </span>
            </div>
          </div>

          {/* Standpipe Risers & Basements Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Standpipe Risers / Stairs:
              </label>
              <select
                disabled={isReadOnly}
                value={formData.standpipeCount}
                onChange={(e) => handleChange("standpipeCount", parseInt(e.target.value))}
                className="w-full px-3.5 py-2 text-xs bg-surface-2 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 cursor-pointer"
              >
                <option value="1">1 Standpipe Riser (500 GPM min)</option>
                <option value="2">2 Standpipe Risers (750 GPM)</option>
                <option value="3">3+ Standpipe Risers (1000 GPM)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Basements Count:
              </label>
              <input
                type="number"
                min="0"
                disabled={isReadOnly}
                value={formData.basementCount}
                onChange={(e) => handleChange("basementCount", parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2 text-xs bg-surface-2 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                ≥3 basements classified as deep underground
              </span>
            </div>
          </div>

          {/* Checkboxes: Infrastructure Hydrant & Single Stair */}
          <div className="pt-3 border-t border-border/70 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={formData.hasInfraHydrants60m}
                onChange={(e) => handleChange("hasInfraHydrants60m", e.target.checked)}
                className="mt-0.5 rounded border-border text-primary cursor-pointer disabled:opacity-60"
              />
              <div className="text-xs text-foreground font-medium">
                Infrastructure Yard Hydrant available within 60 m radius
                <span className="text-[11px] text-muted-foreground block font-normal">
                  Exempts plot &gt; 20,000 m² from dedicated private yard hydrant pump requirement.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={formData.isSingleExitStair}
                onChange={(e) => handleChange("isSingleExitStair", e.target.checked)}
                className="mt-0.5 rounded border-border text-primary cursor-pointer disabled:opacity-60"
              />
              <div className="text-xs text-foreground font-medium">
                Single Exit Stair complying with Chapter 3 (Area ≤ 500 m²)
                <span className="text-[11px] text-muted-foreground block font-normal">
                  Applies dedicated single stair fire protection provisions.
                </span>
              </div>
            </label>
          </div>

          {/* Live Preview Card */}
          {previewEvaluation && (
            <div className="p-3.5 rounded-xl bg-surface-2 border border-border/80 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Evaluated Civil Defense Duty:
                </div>
                <div className="text-sm font-bold text-foreground font-mono">
                  {unitSystem === "si"
                    ? `${previewEvaluation.lowestFirePumpFlowLpm} LPM @ ${previewEvaluation.lowestFirePumpPressureBar} bar`
                    : `${previewEvaluation.lowestFirePumpFlowGpm} GPM @ ${previewEvaluation.lowestFirePumpPressurePsi} psi`}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Tank: {previewEvaluation.mainTankDurationMin} min ({previewEvaluation.mainTankNetVolumeM3} m³)
                </div>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  {previewEvaluation.categoryCode.replace(/^Table\s+[\d\.]+[a-z]?[\–\-e]*\s*/i, "")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border/80 bg-surface-1 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isReadOnly}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Check className="size-3.5" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
