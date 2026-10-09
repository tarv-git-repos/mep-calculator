import React from "react";
import { FileSpreadsheet, Box, X, ArrowRight, Sparkles, Wind, Zap } from "lucide-react";

interface ImportSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExcel: () => void;
  onSelect3DViewer: () => void;
  onSelectVentilation?: () => void;
  onSelectPreliminary?: () => void;
  footerNote?: string;
}

export function ImportSourceModal({
  isOpen,
  onClose,
  onSelectExcel,
  onSelect3DViewer,
  onSelectVentilation,
  onSelectPreliminary,
  footerNote,
}: ImportSourceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#18181b] border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-1/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground tracking-tight">Import Space Schedule</h2>
              <p className="text-xs text-muted-foreground">Select data source to generate schedule</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body Options */}
        <div className="p-5 grid grid-cols-1 gap-3.5">
          {/* Option 1: Excel File */}
          <button
            onClick={() => {
              onClose();
              onSelectExcel();
            }}
            className="group relative flex items-start gap-4 p-4 rounded-xl border border-border bg-surface-1/30 hover:bg-primary/5 hover:border-primary/40 transition-all text-left shadow-sm hover:shadow-md cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                  Import from Excel (.xlsx)
                </span>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Upload Revit schedule or spreadsheet formatted with Level, Floor, Name & Area.
              </p>
            </div>
          </button>

          {/* Option 2: 3D Studio */}
          <button
            onClick={() => {
              onClose();
              onSelect3DViewer();
            }}
            className="group relative flex items-start gap-4 p-4 rounded-xl border border-border bg-surface-1/30 hover:bg-primary/5 hover:border-primary/40 transition-all text-left shadow-sm hover:shadow-md cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
              <Box className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    Import from 3D Studio
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary">
                    3D Studio
                  </span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Extract spatial geometry, room names, levels, and floor areas directly from active 3D model.
              </p>
            </div>
          </button>

          {/* Option 3: Ventilation Schedule (if provided) */}
          {onSelectVentilation && (
            <button
              onClick={() => {
                onClose();
                onSelectVentilation();
              }}
              className="group relative flex items-start gap-4 p-4 rounded-xl border border-border bg-surface-1/30 hover:bg-sky-500/5 hover:border-sky-500/40 transition-all text-left shadow-sm hover:shadow-md cursor-pointer"
            >
              <div className="p-3 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
                <Wind className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      Import from Ventilation
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-600 dark:text-sky-400">
                      Ventilation
                    </span>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Import all room names, floor levels, and areas directly from the active Ventilation schedule.
                </p>
              </div>
            </button>
          )}

          {/* Option 4: Preliminary Cooling Load (if provided) */}
          {onSelectPreliminary && (
            <button
              onClick={() => {
                onClose();
                onSelectPreliminary();
              }}
              className="group relative flex items-start gap-4 p-4 rounded-xl border border-border bg-surface-1/30 hover:bg-amber-500/5 hover:border-amber-500/40 transition-all text-left shadow-sm hover:shadow-md cursor-pointer"
            >
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <Zap className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      Import from Preliminary Cooling Load
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      Cooling Load
                    </span>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Import room names, floor levels, areas, and space categories from the Preliminary Cooling Load calculation.
                </p>
              </div>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-surface-2/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>{footerNote || "Automatic code baseline & space classification applied"}</span>
          <button 
            onClick={onClose}
            className="font-medium text-foreground hover:underline cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
