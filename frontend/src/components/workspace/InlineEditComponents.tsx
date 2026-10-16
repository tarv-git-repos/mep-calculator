import React, { useState, useEffect } from "react";
import { toast } from "sonner";

export function InlineInput({
  value,
  onCommit,
  className = "",
  placeholder = "",
  type = "text",
}: {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  placeholder?: string;
  type?: string;
}) {
  const getCleanVal = (v: any) => {
    if (v === undefined || v === null || v === "undefined" || v === "null") return "";
    return String(v);
  };

  const [val, setVal] = useState<string>(getCleanVal(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setVal(getCleanVal(value));
  }, [value]);

  const isReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly || (window as any).__mep_approved_readonly);

  if (!editing) {
    return (
      <span
        onDoubleClick={() => {
          if (isReadOnly) {
            toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit.", { id: "readonly-notice" });
            return;
          }
          setEditing(true);
        }}
        className={`cursor-pointer hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors ${className} ${isReadOnly ? "cursor-not-allowed opacity-80" : ""}`}
        title={isReadOnly ? "Calculation is Approved and Locked. Unlock to edit." : "Double-click to edit"}
      >
        {val || placeholder || "-"}
      </span>
    );
  }

  return (
    <input
      type={type}
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (isReadOnly) {
          toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit.", { id: "readonly-notice" });
          return;
        }
        onCommit(val);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          if (isReadOnly) {
            toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit.", { id: "readonly-notice" });
            return;
          }
          onCommit(val);
        } else if (e.key === "Escape") {
          setEditing(false);
          setVal(String(value ?? ""));
        }
      }}
      className={`bg-background border border-primary rounded px-1.5 py-0.5 outline-none text-xs w-full ${className}`}
    />
  );
}

export function InlineSelect({
  value,
  options,
  onCommit,
  className = "",
}: {
  value: string;
  options: { value: string; label: string }[];
  onCommit: (val: string) => void;
  className?: string;
}) {
  const isReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly || (window as any).__mep_approved_readonly);
  return (
    <select
      value={value}
      disabled={isReadOnly}
      onChange={(e) => {
        if (isReadOnly) {
          toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to edit.", { id: "readonly-notice" });
          return;
        }
        onCommit(e.target.value);
      }}
      className={`bg-surface-2 border border-border/60 rounded px-2 py-1 outline-none text-xs ${isReadOnly ? "cursor-not-allowed opacity-75 pointer-events-none" : "cursor-pointer"} ${className}`}
      title={isReadOnly ? "Calculation is Approved and Locked. Unlock to edit." : undefined}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
