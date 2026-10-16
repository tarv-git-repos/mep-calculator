import React, { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, Plus, Building2, Layers, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FloorSelectProps {
  value: string;
  onChange: (floor: string) => void;
  availableFloors?: string[];
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
}

const DEFAULT_PRESET_FLOORS = [
  "GF",
  "1F",
  "2F",
  "3F",
  "4F",
  "RF",
  "BF",
  "Basement 1",
  "Basement 2",
  "L01",
  "L02",
  "L03",
  "Roof",
];

export function FloorSelect({
  value,
  onChange,
  availableFloors = [],
  className = "",
  triggerClassName = "",
  disabled = false,
  placeholder = "Select or enter floor...",
}: FloorSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Merge availableFloors from active project with common building engineering floor standards
  const allFloors = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    // 1. Add project floors first
    availableFloors.forEach((f) => {
      const trimmed = f ? f.trim() : "";
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    // 2. Add default presets
    DEFAULT_PRESET_FLOORS.forEach((f) => {
      if (!seen.has(f.toLowerCase())) {
        seen.add(f.toLowerCase());
        list.push(f);
      }
    });

    // 3. Ensure active value is included
    if (value && value.trim() && !seen.has(value.trim().toLowerCase())) {
      list.unshift(value.trim());
    }

    return list;
  }, [availableFloors, value]);

  const filteredFloors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allFloors;
    return allFloors.filter((f) => f.toLowerCase().includes(q));
  }, [allFloors, search]);

  const isExactMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return allFloors.some((f) => f.toLowerCase() === q);
  }, [allFloors, search]);

  const handleSelectFloor = (selected: string) => {
    onChange(selected);
    setSearch("");
    setOpen(false);
  };

  const handleCreateCustom = () => {
    const custom = search.trim();
    if (custom) {
      handleSelectFloor(custom);
    }
  };

  // Format label for display
  const getFloorDisplay = (fl: string) => {
    if (!fl) return "";
    if (fl.toLowerCase() === "gf") return "Ground Floor (GF)";
    if (fl.toLowerCase() === "rf" || fl.toLowerCase() === "roof") return "Roof Floor (RF)";
    if (fl.toLowerCase() === "bf") return "Basement Floor (BF)";
    return fl;
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={disabled ? false : open} onOpenChange={(val) => { if (!disabled) setOpen(val); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "w-full h-9 px-3 bg-white/70 dark:bg-slate-900/60 border border-border/80 hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-[13px] text-foreground font-normal outline-none transition-all flex items-center justify-between cursor-pointer shadow-xs group select-none text-left",
              disabled && "opacity-60 cursor-not-allowed pointer-events-none",
              triggerClassName
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
              {value ? (
                <>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[11px] font-bold border border-primary/20 shrink-0 group-hover:bg-primary/15 transition-colors">
                    {value}
                  </span>
                  <span className="text-[12.5px] font-medium text-foreground truncate">
                    {getFloorDisplay(value)}
                  </span>
                </>
              ) : (
                <span className="text-[12.5px] text-muted-foreground/60 italic truncate">
                  {placeholder}
                </span>
              )}
            </div>
            <ChevronsUpDown className="size-3.5 text-muted-foreground/60 group-hover:text-primary shrink-0 ml-1.5 transition-colors" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[300px] p-3 bg-card/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-border/90 rounded-2xl shadow-2xl z-50 flex flex-col gap-2.5 font-sans animate-in fade-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Building2 className="size-3.5 text-primary" />
              <span>Assign Floor Level</span>
            </div>
            {value && (
              <span className="text-[10px] font-mono font-bold text-primary px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                Current: {value}
              </span>
            )}
          </div>

          {/* Search / Custom Entry Bar */}
          <div className="relative">
            <Search className="size-3.5 text-muted-foreground/70 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  e.preventDefault();
                  handleCreateCustom();
                }
              }}
              placeholder="Search or enter custom floor..."
              className="w-full h-8 pl-8 pr-7 bg-surface-2 dark:bg-neutral-800/80 border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-xs outline-none text-foreground placeholder:text-muted-foreground/50 transition-all font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="size-5 grid place-items-center absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Quick Preset Chips */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
              <Layers className="size-3" /> Quick Levels
            </span>
            <div className="flex flex-wrap gap-1">
              {["GF", "1F", "2F", "3F", "4F", "RF", "BF"].map((preset) => {
                const isActive = value?.toLowerCase() === preset.toLowerCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectFloor(preset)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border transition-all cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-surface-2 dark:bg-neutral-800/60 border-border/70 text-foreground hover:border-primary/40 hover:bg-surface-3"
                    )}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Create Custom Action Button (if typing something new) */}
          {!isExactMatch && search.trim() && (
            <button
              type="button"
              onClick={handleCreateCustom}
              className="w-full py-1.5 px-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer shadow-xs"
            >
              <span className="truncate">
                Assign Custom: <strong className="font-mono">"{search.trim()}"</strong>
              </span>
              <Plus className="size-3.5 shrink-0 ml-1" />
            </button>
          )}

          {/* Scrollable Floor List */}
          <div className="max-h-40 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5 divide-y divide-border/20 border-t border-border/50 pt-1">
            {filteredFloors.length > 0 ? (
              filteredFloors.map((floorName) => {
                const isSelected = value?.toLowerCase() === floorName.toLowerCase();
                const isProjectFloor = availableFloors.includes(floorName);

                return (
                  <button
                    key={floorName}
                    type="button"
                    onClick={() => handleSelectFloor(floorName)}
                    className={cn(
                      "w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer text-left select-none",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-foreground hover:bg-surface-2 dark:hover:bg-neutral-800/80"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded font-mono text-[10.5px] font-bold shrink-0",
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-surface-3 dark:bg-neutral-800 text-muted-foreground border border-border/60"
                        )}
                      >
                        {floorName}
                      </span>
                      <span className="truncate text-xs font-medium">
                        {getFloorDisplay(floorName)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isProjectFloor && !isSelected && (
                        <span className="text-[9.5px] font-sans px-1 py-0.2 rounded bg-primary/5 text-primary/80 font-medium">
                          Project
                        </span>
                      )}
                      {isSelected && <Check className="size-3.5 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-3 text-center text-xs text-muted-foreground">
                No matching floors. Press Enter to create.
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
