import React, { useState } from "react";
import { Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SprinklerHazardSelectProps {
  value: string;
  unitSystem: "ip" | "si";
  onChange: (val: string) => void;
  onOpenCustomModal?: () => void;
  className?: string;
  triggerClassName?: string;
  hideChevron?: boolean;
  disabled?: boolean;
}

interface HazardOption {
  name: string;
  desc: string;
  maxCovIP: number;
}

export function SprinklerHazardSelect({
  value,
  unitSystem,
  onChange,
  onOpenCustomModal,
  className,
  triggerClassName,
  hideChevron,
  disabled,
}: SprinklerHazardSelectProps) {
  const isReadOnly = typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly);
  const isEffectiveDisabled = disabled || isReadOnly;
  const [open, setOpen] = useState(false);
  const isSI = unitSystem === "si";

  const standardHazards: HazardOption[] = [
    { name: "Light Hazard", desc: "Offices, Residential, Schools", maxCovIP: 225 },
    { name: "Ordinary Hazard Gp 1", desc: "Bakeries, Laundries, Electronics", maxCovIP: 130 },
    { name: "Ordinary Hazard Gp 2", desc: "Commercial Kitchens, Garages", maxCovIP: 130 },
    { name: "Extra Hazard Gp 1", desc: "Die Casting, Printing, Sawmills", maxCovIP: 100 },
    { name: "Extra Hazard Gp 2", desc: "Flammable Liquids, Asphalt", maxCovIP: 100 },
    { name: "Storage / ESFR", desc: "High-Bay Rack Warehouses", maxCovIP: 100 },
  ];

  const isCustom = Boolean(value && (value.endsWith(" (Custom)") || !standardHazards.some(h => h.name === value)));
  const displayVal = value ? (value.endsWith(" (Custom)") ? value : value) : "Light Hazard";

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <Popover open={isEffectiveDisabled ? false : open} onOpenChange={(val) => { if (!isEffectiveDisabled) setOpen(val); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isEffectiveDisabled}
            className={cn(
              "flex items-center justify-between w-full bg-transparent border border-transparent hover:bg-surface-2 hover:border-muted-foreground/20 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-1 px-1.5 rounded text-foreground text-[13px] font-medium min-w-0 transition-all text-left",
              isEffectiveDisabled ? "cursor-not-allowed opacity-75 pointer-events-none hover:bg-transparent" : "cursor-pointer",
              triggerClassName
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (isEffectiveDisabled) {
                e.preventDefault();
                toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
              }
            }}
          >
            <span className="truncate mr-1.5">{displayVal}</span>
            {!hideChevron && <ChevronsUpDown className="size-3 text-muted-foreground shrink-0 opacity-55" />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[300px] p-0 font-sans z-50 bg-popover border border-border rounded-xl shadow-xl"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <Command
            filter={(itemVal, search) => {
              const display = itemVal.toLowerCase();
              const searchLower = search.toLowerCase();
              if (display.includes(searchLower)) return 1;
              return 0;
            }}
          >
            <div className="p-1.5 border-b border-border">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (onOpenCustomModal) onOpenCustomModal();
                }}
                className="w-full py-1.5 px-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="size-3.5" />
                + Other (Configure Custom)...
              </button>
            </div>
            <CommandInput placeholder="Search hazard class..." className="h-8 text-[12px]" />
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">No hazard class found.</CommandEmpty>
            <CommandList className="max-h-[220px] overflow-y-auto custom-scrollbar p-1">
              <CommandGroup>
                {isCustom && (
                  <CommandItem
                    value={`${displayVal}`}
                    onSelect={() => {
                      if (onOpenCustomModal) onOpenCustomModal();
                      setOpen(false);
                    }}
                    className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10 rounded-md font-bold text-foreground"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground">{displayVal}</span>
                      <span className="text-[10px] text-muted-foreground truncate">User-defined hazard classification</span>
                    </div>
                    <Check className="size-3.5 text-primary shrink-0 ml-2" />
                  </CommandItem>
                )}
                {standardHazards.map((h) => {
                  const isSelected = value === h.name;
                  const covUnit = isSI ? "m²" : "ft²";
                  const covVal = isSI ? (h.maxCovIP / 10.7639).toFixed(1) : h.maxCovIP;
                  return (
                    <CommandItem
                      key={h.name}
                      value={`${h.name} ${h.desc}`}
                      onSelect={() => {
                        onChange(h.name);
                        setOpen(false);
                      }}
                      className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10 rounded-md"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground">{h.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{h.desc} (Max {covVal} {covUnit})</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
