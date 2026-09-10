import React from "react";
import { X, Sparkles, CheckCircle2, AlertTriangle, Info, Copy, FileText } from "lucide-react";
import { toast } from "sonner";

export interface CalculationStep {
  stepNumber?: number;
  label: string;
  formula: string;
  substitution?: string;
  result: string | number;
  unit?: string;
  status?: "pass" | "warning" | "info";
  description?: string;
}

export interface CalculationPreviewData {
  title: string;
  itemName: string;
  itemCode?: string;
  standardReference?: string;
  inputs?: Array<{ label: string; value: string | number; unit?: string }>;
  steps: CalculationStep[];
  finalResultLabel?: string;
  finalResultValue?: string | number;
  finalResultUnit?: string;
  complianceNote?: string;
}

interface CalculationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CalculationPreviewData | null;
}

export function CalculationPreviewModal({ isOpen, onClose, data }: CalculationPreviewModalProps) {
  if (!isOpen || !data) return null;

  const handleCopySummary = () => {
    const lines = [
      `=== ${data.title.toUpperCase()} CALCULATION PREVIEW ===`,
      `Item: ${data.itemName} ${data.itemCode ? `(${data.itemCode})` : ""}`,
      data.standardReference ? `Standard: ${data.standardReference}` : "",
      "--- INPUT PARAMETERS ---",
      ...(data.inputs || []).map((i) => `• ${i.label}: ${i.value} ${i.unit || ""}`),
      "--- CALCULATION STEPS ---",
      ...data.steps.map(
        (s, idx) =>
          `[Step ${s.stepNumber || idx + 1}] ${s.label}: ${s.formula} => ${s.result} ${
            s.unit || ""
          }`
      ),
      data.finalResultLabel
        ? `--- RESULT: ${data.finalResultLabel} = ${data.finalResultValue} ${
            data.finalResultUnit || ""
          } ---`
        : "",
      data.complianceNote ? `Compliance: ${data.complianceNote}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(lines);
    toast.success("Calculation summary copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                {data.title}
                {data.standardReference && (
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {data.standardReference}
                  </span>
                )}
              </h3>
              <p className="text-[12px] text-muted-foreground">
                Step-by-step calculation preview for{" "}
                <span className="font-semibold text-foreground">{data.itemName}</span>
                {data.itemCode && ` (${data.itemCode})`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* Inputs Section */}
          {data.inputs && data.inputs.length > 0 && (
            <div className="bg-surface-2 rounded-lg p-3.5 border border-border/60">
              <h4 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" /> Input Parameters
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {data.inputs.map((inp, i) => (
                  <div key={i} className="bg-background/80 rounded p-2 border border-border/40">
                    <div className="text-[10.5px] text-muted-foreground">{inp.label}</div>
                    <div className="font-mono font-semibold text-foreground mt-0.5">
                      {inp.value}{" "}
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {inp.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculation Steps Section */}
          <div className="space-y-3">
            <h4 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" /> Mathematical Formula Steps
            </h4>

            <div className="space-y-2.5">
              {data.steps.map((step, idx) => {
                const stepNum = step.stepNumber || idx + 1;
                return (
                  <div
                    key={idx}
                    className="border border-border/80 rounded-lg p-3 bg-background hover:border-primary/40 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-5 rounded-full bg-primary/10 text-primary text-[10.5px] font-mono font-bold flex items-center justify-center">
                          {stepNum}
                        </span>
                        <span className="font-medium text-[12.5px] text-foreground">
                          {step.label}
                        </span>
                      </div>
                      {step.status && (
                        <span
                          className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                            step.status === "pass"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : step.status === "warning"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {step.status === "pass" ? (
                            <CheckCircle2 className="size-3" />
                          ) : step.status === "warning" ? (
                            <AlertTriangle className="size-3" />
                          ) : (
                            <Info className="size-3" />
                          )}
                          {step.status.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Formula */}
                    <div className="bg-surface-2 font-mono text-[11.5px] px-2.5 py-1.5 rounded text-primary border border-primary/10 flex items-center justify-between">
                      <span>{step.formula}</span>
                      <span className="font-bold text-foreground">
                        = {step.result} {step.unit}
                      </span>
                    </div>

                    {step.description && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Final Result / Compliance Banner */}
          {data.finalResultLabel && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  {data.finalResultLabel}
                </div>
                {data.complianceNote && (
                  <div className="text-[11.5px] text-foreground mt-0.5">
                    {data.complianceNote}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xl font-bold font-mono text-primary">
                  {data.finalResultValue}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {data.finalResultUnit}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
          <button
            onClick={handleCopySummary}
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
          >
            <Copy className="size-3.5" /> Copy Calculation Summary
          </button>
          <button
            onClick={onClose}
            className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded-md hover:bg-primary/95 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
