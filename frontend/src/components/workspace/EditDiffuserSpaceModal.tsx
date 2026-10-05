import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Info, Layers, Wind, CheckCircle2, Copy, Eye } from "lucide-react";
import { type DiffuserRowItem, type DiffuserType, DIFFUSER_NAMES, DIFFUSER_DATA } from "@/lib/calc-diffuser";

interface EditDiffuserSpaceModalProps {
  space: DiffuserRowItem;
  onClose: () => void;
  onSave: (updatedSpace: DiffuserRowItem) => void;
  onPreviewCalculations?: () => void;
  availableFloors: string[];
}

export function EditDiffuserSpaceModal({
  space,
  onClose,
  onSave,
  onPreviewCalculations,
  availableFloors
}: EditDiffuserSpaceModalProps) {
  const [formData, setFormData] = useState<DiffuserRowItem>({ ...space });

  useEffect(() => {
    setFormData({ ...space });
  }, [space]);

  const handleChange = (field: keyof DiffuserRowItem, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Space name cannot be empty");
      return;
    }
    onSave(formData);
    toast.success(`Space ${formData.name} updated`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Wind className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Edit Diffuser Space</h3>
              <p className="text-xs text-muted-foreground">{formData.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onPreviewCalculations && (
              <button
                onClick={onPreviewCalculations}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg text-xs font-semibold transition-colors"
                title="View Detailed Calculation Breakdown"
              >
                <Eye className="size-3.5" />
                Calculation Preview
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/30">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Identity Group */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Info className="size-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-foreground">Space Identity</h4>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Space Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Floor / Level</label>
                  <input
                    type="text"
                    value={formData.floor}
                    onChange={(e) => handleChange("floor", e.target.value)}
                    list="available-floors"
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <datalist id="available-floors">
                    {availableFloors.map((f) => <option key={f} value={f} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Zone (Optional)</label>
                  <input
                    type="text"
                    value={formData.zone}
                    onChange={(e) => handleChange("zone", e.target.value)}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Design Parameters Group */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Wind className="size-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-foreground">Design Parameters</h4>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Diffuser Type</label>
                <select
                  value={formData.diffType}
                  onChange={(e) => handleChange("diffType", e.target.value as DiffuserType)}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Object.entries(DIFFUSER_NAMES).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Airflow (CFM or L/s)</label>
                  <input
                    type="number"
                    value={formData.airflow === "" ? "" : formData.airflow}
                    onChange={(e) => handleChange("airflow", e.target.value === "" ? "" : parseFloat(e.target.value))}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Total Flow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Quantity (Diffusers)</label>
                  <input
                    type="number"
                    value={formData.count === "" ? "" : formData.count}
                    onChange={(e) => handleChange("count", e.target.value === "" ? "" : parseInt(e.target.value))}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Advanced / Optional Group */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Layers className="size-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Advanced Settings</h4>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Target Velocity (m/s)</label>
                <select
                  value={formData.designVelocity}
                  onChange={(e) => handleChange("designVelocity", parseFloat(e.target.value))}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value={2.0}>2.0 m/s (Quiet/Office)</option>
                  <option value={2.5}>2.5 m/s (Standard/Retail)</option>
                  <option value={3.0}>3.0 m/s (Lobby/Industrial)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cooling Load (kW) (Optional)</label>
                <input
                  type="number"
                  value={formData.coolingKw === "" ? "" : formData.coolingKw}
                  onChange={(e) => handleChange("coolingKw", e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Delta T (Optional)</label>
                <input
                  type="number"
                  value={formData.deltaT === "" ? "" : formData.deltaT}
                  onChange={(e) => handleChange("deltaT", e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card">
          <p className="text-xs text-muted-foreground">
            Changes save immediately on clicking 'Save Changes'.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-all active:scale-95"
            >
              <CheckCircle2 className="size-4" />
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
