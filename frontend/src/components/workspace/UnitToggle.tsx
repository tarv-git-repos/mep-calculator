import React, { useState } from "react";
import { Gauge, X, RefreshCw, Check } from "lucide-react";

export interface UnitToggleProps {
  unitSystem: "si" | "ip";
  onChange: (targetUnit: "si" | "ip", shouldConvert: boolean) => void;
  className?: string;
  ipLabel?: string;
  siLabel?: string;
  ipDescription?: string;
  siDescription?: string;
  inputDescriptions?: string;
  conversionExample?: string;
  disabled?: boolean;
}

export function UnitToggle({
  unitSystem,
  onChange,
  className = "",
  ipLabel = "IP",
  siLabel = "SI",
  ipDescription = "Imperial (IP)",
  siDescription = "Metric (SI)",
  inputDescriptions,
  conversionExample,
  disabled = false,
}: UnitToggleProps) {
  const [showModal, setShowModal] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<"si" | "ip" | null>(null);

  const handleClick = (target: "si" | "ip") => {
    if (disabled) return;
    if (target === unitSystem) return;
    setPendingTarget(target);
    setShowModal(true);
  };

  const handleConfirm = (shouldConvert: boolean) => {
    if (disabled) return;
    if (pendingTarget) {
      onChange(pendingTarget, shouldConvert);
    }
    setShowModal(false);
    setPendingTarget(null);
  };

  const handleCancel = () => {
    setShowModal(false);
    setPendingTarget(null);
  };

  return (
    <>
      {/* Unit System Toggle Pill */}
      <div
        className={`inline-flex w-fit items-center shrink-0 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-full border border-border/80 text-xs font-semibold select-none ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        } ${className}`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleClick("ip")}
          className={`px-3 py-0.5 rounded-full transition font-bold ${
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          } ${
            unitSystem === "ip"
              ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {ipLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleClick("si")}
          className={`px-3 py-0.5 rounded-full transition font-bold ${
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          } ${
            unitSystem === "si"
              ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {siLabel}
        </button>
      </div>

      {/* Unit System Conversion Preference Modal */}
      {showModal && pendingTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl animate-fade-in select-none">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Gauge className="size-5" />
                </div>
                <h3 className="font-bold text-base text-foreground">Unit System Change</h3>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">
                Switching to {pendingTarget === "ip" ? ipDescription : siDescription}
              </p>
              <p>
                {inputDescriptions
                  ? `How would you like to handle your entered inputs (${inputDescriptions})?`
                  : "How would you like to handle your entered input parameters?"}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Option 1: Convert Input Values */}
              <button
                type="button"
                onClick={() => handleConfirm(true)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-primary/15 text-primary shrink-0 mt-0.5">
                  <RefreshCw className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground group-hover:text-primary transition">
                    Convert Input Values (Convert Numbers)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {conversionExample ||
                      (pendingTarget === "ip"
                        ? "Convert existing metric values to imperial units. Output calculations recalculate accordingly."
                        : "Convert existing imperial values to metric units. Output calculations recalculate accordingly.")}
                  </span>
                </div>
              </button>

              {/* Option 2: Keep Current Input Values */}
              <button
                type="button"
                onClick={() => handleConfirm(false)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-slate-100/40 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 text-muted-foreground shrink-0 mt-0.5">
                  <Check className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground group-hover:text-primary transition">
                    Keep Current Input Numbers Unchanged
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Do not convert input numbers. Only update calculation formulas & unit labels.
                  </span>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-1 border-t border-border/50">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
