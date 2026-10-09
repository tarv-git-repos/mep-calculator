import React, { useState } from "react";
import {
  Check, ChevronsUpDown, SlidersHorizontal, Building2,
  Home, GraduationCap, Stethoscope, Store, Warehouse, Settings2
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { HEATING_PRESETS, type HeatingPresetKey } from "@/lib/calc-heating-load";
import { cn } from "@/lib/utils";

const SQFT_TO_SQM = 0.092903;

const presetIcons: Record<HeatingPresetKey, React.ComponentType<{ className?: string }>> = {
  commercial_office: Building2,
  residential_house: Home,
  educational_school: GraduationCap,
  healthcare_clinic: Stethoscope,
  retail_showroom: Store,
  warehouse_storage: Warehouse,
  custom: SlidersHorizontal,
};

interface HeatingProfileSelectProps {
  value: HeatingPresetKey;
  customProfileName?: string;
  onChange: (key: HeatingPresetKey) => void;
  onOpenCustomModal?: () => void;
  unitSystem?: "ip" | "si";
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function HeatingProfileSelect({
  value,
  customProfileName,
  onChange,
  onOpenCustomModal,
  unitSystem = "ip",
  className,
  triggerClassName,
  disabled,
}: HeatingProfileSelectProps) {
  const isReadOnly = typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly);
  const isEffectiveDisabled = disabled || isReadOnly;
  const [open, setOpen] = useState(false);

  const isSI = unitSystem === "si";
  const currentPreset = HEATING_PRESETS[value] || HEATING_PRESETS.commercial_office;
  const isCustom = value === "custom";

  // Trigger text display matching Ventilation & Duct Sizer Custom standard
  const triggerLabel = isCustom
    ? (customProfileName ? (customProfileName.endsWith(" (Custom)") ? customProfileName : `${customProfileName} (Custom)`) : "Custom Configuration (Custom)")
    : currentPreset.label;

  const IconComp = isCustom ? SlidersHorizontal : (presetIcons[value] || Building2);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEffectiveDisabled) {
      e.preventDefault();
      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
    }
  };

  const handleTriggerDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEffectiveDisabled && onOpenCustomModal) {
      onOpenCustomModal();
      setOpen(false);
    }
  };

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
            onClick={handleTriggerClick}
            onDoubleClick={handleTriggerDoubleClick}
            title="Click to switch building profile, Double-click to customize"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <IconComp className={cn("size-3.5 shrink-0", isCustom ? "text-primary" : "text-muted-foreground")} />
              <span className="truncate max-w-[200px] font-bold">{triggerLabel}</span>
            </div>
            <ChevronsUpDown className="size-3 text-muted-foreground shrink-0 opacity-60 ml-0.5" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[430px] sm:w-[450px] max-w-[calc(100vw-2rem)] p-0 font-sans z-50 shadow-2xl border-border/80 rounded-xl overflow-hidden bg-popover"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <Command
            filter={(itemVal, search) => {
              const searchLower = search.toLowerCase().trim();
              if (!searchLower) return 1;
              if (itemVal === "custom") {
                const customName = (customProfileName || "Custom Configuration").toLowerCase();
                if (customName.includes(searchLower) || "user-defined envelope geometry airflow".includes(searchLower)) return 1;
                return 0;
              }
              const p = HEATING_PRESETS[itemVal as HeatingPresetKey];
              if (!p) {
                if (itemVal.toLowerCase().includes(searchLower)) return 1;
                return 0;
              }
              const areaStr = isSI ? `${Math.round(p.area * SQFT_TO_SQM)} m²` : `${p.area} ft²`;
              const deltaT = p.iat - p.oat;
              const fullSearch = `${p.label} ${p.category} ${p.description} ${areaStr} ${deltaT}`.toLowerCase();
              return fullSearch.includes(searchLower) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Search building profile (e.g. Office, Residential, School)..." className="h-9 text-xs" />
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No matching building profile found.</CommandEmpty>
            
            <CommandList className="max-h-[340px] overflow-y-auto p-1.5 space-y-1">
              {/* Custom Configuration Option */}
              <CommandGroup heading="Custom Configuration">
                <CommandItem
                  value="custom"
                  onSelect={() => {
                    onChange("custom");
                    setOpen(false);
                    if (onOpenCustomModal) onOpenCustomModal();
                  }}
                  className={cn(
                    "group relative flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all select-none",
                    isCustom
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-accent/80 hover:text-foreground text-muted-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "flex items-center justify-center size-7 rounded-md shrink-0 transition-colors",
                        isCustom
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      <SlidersHorizontal className="size-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <span className={cn(
                        "text-xs truncate leading-snug",
                        isCustom ? "font-bold text-foreground" : "font-semibold text-foreground"
                      )}>
                        {customProfileName || "Custom Configuration"}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground truncate leading-none">
                        User-defined envelope, geometry &amp; airflow
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary border border-primary/20">
                      Custom
                    </span>
                    <div className="w-4 flex items-center justify-center shrink-0">
                      {isCustom && <Check className="size-3.5 text-primary stroke-[2.5]" />}
                    </div>
                  </div>
                </CommandItem>
              </CommandGroup>

              <CommandSeparator className="my-1 opacity-60" />

              {/* Standard ASHRAE & IECC Archetypes */}
              <CommandGroup heading="Standard Building Archetypes (ASHRAE / IECC)">
                {(Object.keys(HEATING_PRESETS) as HeatingPresetKey[])
                  .filter((k) => k !== "custom")
                  .map((key) => {
                    const p = HEATING_PRESETS[key];
                    const isSelected = value === key;
                    const Icon = presetIcons[key] || Building2;
                    const areaText = isSI
                      ? `${Math.round(p.area * SQFT_TO_SQM).toLocaleString()} m²`
                      : `${p.area.toLocaleString()} ft²`;
                    const deltaT = p.iat - p.oat;
                    const dtText = isSI ? `ΔT ${Math.round(deltaT / 1.8)}°C` : `ΔT ${deltaT}°F`;

                    return (
                      <CommandItem
                        key={key}
                        value={key}
                        onSelect={() => {
                          onChange(key);
                          setOpen(false);
                        }}
                        className={cn(
                          "group relative flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all select-none",
                          isSelected
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-accent/80 hover:text-foreground text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={cn(
                              "flex items-center justify-center size-7 rounded-md shrink-0 transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-2xs"
                                : "bg-muted/80 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                            )}
                          >
                            <Icon className="size-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0 gap-0.5">
                            <span className={cn(
                              "text-xs truncate leading-snug",
                              isSelected ? "font-bold text-foreground" : "font-semibold text-foreground group-hover:text-foreground"
                            )}>
                              {p.label}
                            </span>
                            <span className="text-[10.5px] text-muted-foreground truncate flex items-center gap-1 leading-none">
                              <span>{p.category}</span>
                              <span className="text-muted-foreground/50">•</span>
                              <span className="font-mono text-muted-foreground/90 font-medium">{dtText}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/90 text-muted-foreground border border-border/50 shrink-0">
                            {p.height} ft ht
                          </span>
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold tracking-tight shrink-0",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60"
                          )}>
                            {areaText}
                          </span>
                          <div className="w-4 flex items-center justify-center shrink-0">
                            {isSelected && <Check className="size-3.5 text-primary stroke-[2.5]" />}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Quick Configure Custom button when in custom mode or to customize current preset */}
      {onOpenCustomModal && (
        <button
          type="button"
          onClick={onOpenCustomModal}
          disabled={isEffectiveDisabled}
          className={cn(
            "p-1.5 rounded-full border border-border/80 bg-surface-2 hover:bg-surface text-muted-foreground hover:text-foreground transition cursor-pointer shadow-2xs",
            isCustom ? "text-primary border-primary/30 bg-primary/10 hover:bg-primary/20" : ""
          )}
          title="Customize Building Profile Parameters"
        >
          <Settings2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
