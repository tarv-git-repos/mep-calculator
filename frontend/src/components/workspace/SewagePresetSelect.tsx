import React, { useState } from "react";
import {
  Check, ChevronsUpDown, SlidersHorizontal, Home, Building2,
  Utensils, Building, Factory, Droplets, Settings2
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { SEWAGE_PRESETS, type SewagePresetKey } from "@/routes/plumbing-sewage-pump";
import { cn } from "@/lib/utils";

const presetIcons: Record<SewagePresetKey, React.ComponentType<{ className?: string }>> = {
  residential_basement: Home,
  commercial_building: Building2,
  restaurant_kitchen: Utensils,
  high_rise_basement: Building,
  heavy_duty_station: Factory,
  custom: SlidersHorizontal,
};

const FT_TO_M = 0.3048;
const GPM_TO_LPS = 0.0630902;

interface SewagePresetSelectProps {
  value: SewagePresetKey;
  customProfileName?: string;
  onChange: (key: SewagePresetKey) => void;
  onOpenCustomModal?: () => void;
  unitSystem?: "ip" | "si";
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function SewagePresetSelect({
  value,
  customProfileName,
  onChange,
  onOpenCustomModal,
  unitSystem = "ip",
  className,
  triggerClassName,
  disabled,
}: SewagePresetSelectProps) {
  const isReadOnly = typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly);
  const isEffectiveDisabled = disabled || isReadOnly;
  const [open, setOpen] = useState(false);

  const isSI = unitSystem === "si";
  const currentPreset = SEWAGE_PRESETS[value] || SEWAGE_PRESETS.commercial_building;
  const isCustom = value === "custom";

  // Trigger text display matching Ventilation Custom standard
  const triggerLabel = isCustom
    ? (customProfileName ? (customProfileName.endsWith(" (Custom)") ? customProfileName : `${customProfileName} (Custom)`) : "Custom Configuration (Custom)")
    : currentPreset.label;

  const IconComp = isCustom ? SlidersHorizontal : (presetIcons[value] || Droplets);

  return (
    <div className={cn("relative inline-flex items-center gap-1.5", className)}>
      <Popover open={isEffectiveDisabled ? false : open} onOpenChange={(val) => { if (!isEffectiveDisabled) setOpen(val); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isEffectiveDisabled}
            className={cn(
              "inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all select-none shadow-2xs",
              isCustom
                ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/15"
                : "bg-surface-2 border-border/80 text-foreground hover:bg-surface hover:border-border",
              isEffectiveDisabled ? "cursor-not-allowed opacity-75 pointer-events-none" : "cursor-pointer",
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
            <div className="flex items-center gap-1.5 min-w-0">
              <IconComp className={cn("size-3.5 shrink-0", isCustom ? "text-primary" : "text-muted-foreground")} />
              <span className="truncate max-w-[200px] font-bold">{triggerLabel}</span>
            </div>
            <ChevronsUpDown className="size-3 text-muted-foreground shrink-0 opacity-60 ml-0.5" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[360px] p-0 font-sans z-50 shadow-xl border-border rounded-xl" align="start" onClick={(e) => e.stopPropagation()}>
          <Command
            filter={(itemVal, search) => {
              const searchLower = search.toLowerCase();
              const p = SEWAGE_PRESETS[itemVal as SewagePresetKey];
              if (!p) {
                if (itemVal.toLowerCase().includes(searchLower)) return 1;
                return 0;
              }
              if (
                p.label.toLowerCase().includes(searchLower) ||
                p.category.toLowerCase().includes(searchLower) ||
                p.description.toLowerCase().includes(searchLower)
              ) {
                return 1;
              }
              return 0;
            }}
          >
            <CommandInput placeholder="Search sewage application preset..." className="h-9 text-xs" />
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No sewage preset found.</CommandEmpty>
            
            <CommandList className="max-h-[320px] overflow-y-auto p-1">
              {/* Custom Configuration Option (matching Ventilation Custom standard) */}
              <CommandGroup heading="Custom Configuration">
                <CommandItem
                  value="custom"
                  onSelect={() => {
                    onChange("custom");
                    setOpen(false);
                    if (onOpenCustomModal) onOpenCustomModal();
                  }}
                  className="text-xs py-2 px-2.5 rounded-lg cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10 transition-colors"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="p-1 rounded bg-primary/10 text-primary shrink-0 mt-0.5">
                      <SlidersHorizontal className="size-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <span>{customProfileName || "Custom Configuration"}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase">
                          Custom
                        </span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground truncate">User-defined inflow, head, basin geometry &amp; motor specs</span>
                    </div>
                  </div>
                  {isCustom && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                </CommandItem>
              </CommandGroup>

              <CommandSeparator className="my-1" />

              {/* Standard IPC / ASPE Application Profiles */}
              <CommandGroup heading="Standard Sanitary Lift Profiles (IPC / ASPE 7)">
                {(Object.keys(SEWAGE_PRESETS) as SewagePresetKey[])
                  .filter((k) => k !== "custom")
                  .map((key) => {
                    const p = SEWAGE_PRESETS[key];
                    const isSelected = value === key;
                    const Icon = presetIcons[key] || Droplets;
                    const liftText = isSI ? `${(p.lift * FT_TO_M).toFixed(1)}m lift` : `${p.lift}ft lift`;
                    const flowText = isSI ? `${(p.inflow * GPM_TO_LPS).toFixed(1)} L/s` : `${p.inflow} GPM`;

                    return (
                      <CommandItem
                        key={key}
                        value={key}
                        onSelect={() => {
                          onChange(key);
                          setOpen(false);
                        }}
                        className="text-xs py-2 px-2.5 rounded-lg cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10 transition-colors"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <div className={cn("p-1 rounded shrink-0 mt-0.5", isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                            <Icon className="size-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>{p.label}</span>
                              <span className="text-[10px] font-mono font-semibold px-1.5 rounded bg-muted text-muted-foreground">
                                {liftText}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-primary px-1.5 rounded bg-primary/10">
                                {flowText}
                              </span>
                            </div>
                            <span className="text-[10.5px] text-muted-foreground truncate">{p.category}</span>
                          </div>
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

      {/* Quick Configure Custom button */}
      {onOpenCustomModal && (
        <button
          type="button"
          onClick={onOpenCustomModal}
          disabled={isEffectiveDisabled}
          className={cn(
            "p-1.5 rounded-full border border-border/80 bg-surface-2 hover:bg-surface text-muted-foreground hover:text-foreground transition cursor-pointer shadow-2xs",
            isCustom ? "text-primary border-primary/30 bg-primary/10 hover:bg-primary/20" : ""
          )}
          title="Customize Sewage Pump Hydraulic Parameters"
        >
          <Settings2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
