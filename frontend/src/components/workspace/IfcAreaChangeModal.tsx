import React, { useState, useEffect } from "react";
import { X, Box, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Space } from "@/lib/ventilation-calc";

interface IfcAreaChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | null;
  onConfirm: (newArea: number) => void;
  initialProposedArea?: number;
}

export function isSpaceFromIfc(space: { id?: string; isFromIfc?: boolean; source?: string } | null | undefined): boolean {
  if (!space) return false;
  if (space.isFromIfc === true) return true;
  if (space.source === "3d-viewer" || space.source === "ifc-file" || space.source === "3d-studio") return true;
  if (typeof space.id === "string" && (space.id.startsWith("3d-sp-") || space.id.startsWith("ifc-sp-"))) return true;
  return false;
}

export function IfcAreaChangeModal({
  isOpen,
  onClose,
  space,
  onConfirm,
  initialProposedArea,
}: IfcAreaChangeModalProps) {
  const currentArea = space ? space.area : 0;
  const [areaInput, setAreaInput] = useState<string>(
    initialProposedArea !== undefined && initialProposedArea !== currentArea
      ? String(initialProposedArea)
      : String(currentArea)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (space) {
      const val = initialProposedArea !== undefined && initialProposedArea !== space.area
        ? String(initialProposedArea)
        : String(space.area);
      setAreaInput(val);
      setError(null);
    }
  }, [space, initialProposedArea, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !space) return null;

  const handleConfirm = () => {
    const num = parseFloat(areaInput);
    if (isNaN(num) || num <= 0) {
      setError("Please enter a valid positive area value in m².");
      return;
    }
    setError(null);
    onConfirm(Math.round(num * 100) / 100);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/30 dark:bg-black/60 backdrop-blur-xs p-4 animate-fade-in font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white/95 dark:bg-neutral-950/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-w-lg overflow-hidden transition-all duration-200 ease-in-out animate-in fade-in zoom-in-95"
      >
        {/* Header - matching EditSpaceModal double-click format */}
        <header className="px-5 h-14 flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/40 dark:bg-black/30">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="size-8 rounded-lg bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Box className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
                  Change Space Area
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold font-mono tracking-tight shrink-0 flex items-center gap-1">
                  <Box className="size-2.5" /> 3D Studio IFC
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {space.name} • <span className="font-mono">{space.code || space.floor || "BIM Space"}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 grid place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            title="Cancel and close"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* IFC Notice Box */}
          <div className="p-4 bg-blue-500/5 dark:bg-blue-400/5 border border-blue-500/20 rounded-xl flex gap-3 items-start">
            <div className="size-8 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0 mt-0.5 shadow-2xs">
              <Info className="size-4" />
            </div>
            <div className="space-y-1.5 text-xs flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-[13px]">
                  This area is from the IFC file
                </h3>
                <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  BIM Geometry
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-[12px] leading-relaxed">
                This space was imported from <strong>3D Studio</strong> with an original BIM model area of{" "}
                <span className="font-mono font-bold text-foreground bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">
                  {currentArea} m²
                </span>
                . Modifying this value will override the architectural geometry for ventilation calculations.
              </p>
              <p className="text-primary font-semibold text-[12px] pt-1">
                Would you like to change the area for this space?
              </p>
            </div>
          </div>

          {/* Area Comparison & Inputs */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1">
                  Current IFC Area
                </label>
                <div className="h-10 px-3 bg-neutral-100/80 dark:bg-neutral-900/80 border border-black/10 dark:border-white/10 rounded-lg flex items-center justify-between font-mono text-[13px] font-bold text-muted-foreground select-none">
                  <span>{currentArea}</span>
                  <span className="text-xs font-normal text-muted-foreground/70">m²</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                  <span>New Target Area</span>
                  <span className="text-primary font-bold text-[9px] lowercase">editable</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    autoFocus
                    value={areaInput}
                    onChange={(e) => {
                      setAreaInput(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirm();
                    }}
                    className={`w-full h-10 px-3 pr-8 bg-white dark:bg-neutral-900 border rounded-lg text-[13.5px] font-mono font-bold outline-none transition-all ${
                      error
                        ? "border-destructive focus:ring-1 focus:ring-destructive"
                        : "border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    }`}
                    placeholder="Enter area..."
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground pointer-events-none">
                    m²
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-destructive text-[11.5px] font-medium pt-0.5">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground/80 leading-relaxed italic bg-neutral-50 dark:bg-neutral-900/40 p-2.5 rounded-lg border border-black/5 dark:border-white/5">
              💡 <strong>Note:</strong> Changing this area will automatically update occupancy estimates, fresh air supply, extract air demands, and ventilation balance for <strong>{space.name}</strong>.
            </div>
          </div>
        </div>

        {/* Footer - matching EditSpaceModal double-click format */}
        <footer className="px-5 h-14 border-t border-black/5 dark:border-white/5 bg-white/20 dark:bg-black/20 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-lg text-[12px] font-medium transition-colors cursor-pointer shadow-2xs"
          >
            Keep IFC Area
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="h-9 px-4.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-[12px] font-semibold transition-all shadow-sm shadow-primary/10 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="size-3.5" />
            <span>Confirm &amp; Change Area</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
