import React, { useState } from "react";
import { Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SprinklerKFactorSelectProps {
  value: number;
  unitSystem: "ip" | "si";
  onChange: (val: number) => void;
  onOpenCustomModal?: () => void;
  className?: string;
  triggerClassName?: string;
  hideChevron?: boolean;
  disabled?: boolean;
}

interface KOption {
  value: number;
  label: string;
  desc: string;
}

export function SprinklerKFactorSelect({
  value,
  unitSystem,
  onChange,
  onOpenCustomModal,
  className,
  triggerClassName,
  hideChevron,
  disabled,
}: SprinklerKFactorSelectProps) {
  const isReadOnly = typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly);
  const isEffectiveDisabled = disabled || isReadOnly;
  const [open, setOpen] = useState(false);
  const isSI = unitSystem === "si";

  const standardOptions: KOption[] = isSI
    ? [
        { value: 40.0, label: "K-40 (Res)", desc: "Residential / Small (9.5 mm)" },
        { value: 60.0, label: "K-60", desc: "Light Hazard (11.0 mm)" },
        { value: 80.0, label: "K-80 (Std)", desc: "Standard Spray (12.7 mm)" },
        { value: 115.0, label: "K-115", desc: "Large Orifice (13.5 mm)" },
        { value: 160.0, label: "K-160 (ESFR)", desc: "Extra Large / ESFR (15.9 mm)" },
        { value: 200.0, label: "K-200", desc: "Early Suppression (18.2 mm)" },
        { value: 242.0, label: "K-242", desc: "Storage / High Density" },
        { value: 282.0, label: "K-282", desc: "High-Bay Deluge" },
        { value: 320.0, label: "K-320", desc: "Ultra High Flow" },
        { value: 360.0, label: "K-360", desc: "Large Storage" },
        { value: 400.0, label: "K-400", desc: "Industrial Deluge" },
      ]
    : [
        { value: 2.8, label: "K-2.8 (Res)", desc: 'Residential / Small Orifice (3/8")' },
        { value: 4.2, label: "K-4.2", desc: 'Light Hazard (7/16")' },
        { value: 5.6, label: "K-5.6 (Std)", desc: 'Standard Spray (1/2")' },
        { value: 8.0, label: "K-8.0", desc: 'Large Orifice (17/32")' },
        { value: 11.2, label: "K-11.2 (ESFR)", desc: 'Extra Large / ESFR (5/8")' },
        { value: 14.0, label: "K-14.0", desc: 'Early Suppression (3/4")' },
        { value: 16.8, label: "K-16.8", desc: "Storage / High Density" },
        { value: 19.6, label: "K-19.6", desc: "High-Bay Deluge" },
        { value: 22.4, label: "K-22.4", desc: "Ultra High Flow" },
        { value: 25.2, label: "K-25.2", desc: "Large Storage" },
        { value: 28.0, label: "K-28.0", desc: "Industrial Deluge" },
      ];

  const matched = standardOptions.find((opt) => Math.abs(opt.value - value) < 0.05);
  const displayLabel = matched ? matched.label : `K-${value.toFixed(1)} (Custom)`;

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
            <span className="truncate mr-1.5">{displayLabel}</span>
            {!hideChevron && <ChevronsUpDown className="size-3 text-muted-foreground shrink-0 opacity-55" />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[280px] p-0 font-sans z-50 bg-popover border border-border rounded-xl shadow-xl"
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
            <CommandInput placeholder="Search K-factor..." className="h-8 text-[12px]" />
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">No K-factor found.</CommandEmpty>
            <CommandList className="max-h-[220px] overflow-y-auto custom-scrollbar p-1">
              <CommandGroup>
                {standardOptions.map((opt) => {
                  const isSelected = Math.abs(opt.value - value) < 0.05;
                  return (
                    <CommandItem
                      key={opt.value}
                      value={`${opt.label} ${opt.desc}`}
                      onSelect={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10 rounded-md"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{opt.desc}</span>
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
