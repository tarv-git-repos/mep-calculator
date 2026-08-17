import React, { useState, useEffect } from "react";

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
  const [val, setVal] = useState<string>(String(value ?? ""));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setVal(String(value ?? ""));
  }, [value]);

  if (!editing) {
    return (
      <span
        onDoubleClick={() => setEditing(true)}
        className={`cursor-pointer hover:bg-primary/10 rounded px-1.5 py-0.5 transition-colors ${className}`}
        title="Double-click to edit"
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
        onCommit(val);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
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
  return (
    <select
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      className={`bg-surface-2 border border-border/60 rounded px-2 py-1 outline-none text-xs cursor-pointer ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
