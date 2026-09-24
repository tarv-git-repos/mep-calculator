import React, { useState } from "react";
import {
  Check, ChevronsUpDown, SlidersHorizontal, Building2,
  Hotel, Utensils, Factory, Wind, Settings2, Store
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type DuctPresetKey =
  | "commercial_office_main"
  | "retail_branch_duct"
  | "hotel_guestroom_riser"
  | "kitchen_exhaust_duct"
  | "industrial_high_velocity"
  | "custom";

export interface DuctPresetConfig {
  key: DuctPresetKey;
  label: string;
  category: string;
  description: string;
  airflow: number; // CFM
  targetFr: number; // in w.g./100ft
  ductShape: "round" | "rect";
  aspectRatio: number;
}

export const DUCT_PRESETS: Record<DuctPresetKey, DuctPresetConfig> = {
  commercial_office_main: {
    key: "commercial_office_main",
    label: "Commercial Office Main Supply",
    category: "SMACNA / Low-Pressure Supply",
    description: "Main supply air trunk duct sized for low noise (0.08 in.wg/100ft / 0.65 Pa/m, 2500 CFM / 1180 L/s).",
    airflow: 2500,
    targetFr: 0.08,
    ductShape: "rect",
    aspectRatio: 1.5,
  },
  retail_branch_duct: {
    key: "retail_branch_duct",
    label: "Retail / Mall Branch Duct",
    category: "ASHRAE / Branch Distribution",
    description: "Medium branch ducts feeding variable air volume terminal units (0.10 in.wg/100ft, 1200 CFM).",
    airflow: 1200,
    targetFr: 0.10,
    ductShape: "round",
    aspectRatio: 1.0,
  },
  hotel_guestroom_riser: {
    key: "hotel_guestroom_riser",
    label: "Hotel / Residential Guestroom Riser",
    category: "SMACNA / Low-Noise Acoustic",
    description: "Acoustically sensitive vertical duct risers feeding FCUs or DOAS (0.06 in.wg/100ft, 800 CFM).",
    airflow: 800,
    targetFr: 0.06,
    ductShape: "rect",
    aspectRatio: 2.0,
  },
  kitchen_exhaust_duct: {
    key: "kitchen_exhaust_duct",
    label: "Kitchen & Restroom Exhaust Duct",
    category: "NFPA 96 / High Velocity Exhaust",
    description: "High-velocity exhaust duct maintaining minimum capture velocity (0.15 in.wg/100ft, 3500 CFM).",
    airflow: 3500,
    targetFr: 0.15,
    ductShape: "rect",
    aspectRatio: 1.5,
  },
  industrial_high_velocity: {
    key: "industrial_high_velocity",
    label: "Industrial High-Velocity Trunk",
    category: "Industrial / High Pressure",
    description: "High-capacity air distribution trunk in industrial plant / plant room (0.20 in.wg/100ft, 8000 CFM).",
    airflow: 8000,
    targetFr: 0.20,
    ductShape: "round",
    aspectRatio: 1.0,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Engineering",
    description: "User-defined airflow, target friction rate, shape, and aspect ratio.",
    airflow: 2500,
    targetFr: 0.08,
    ductShape: "rect",
    aspectRatio: 1.5,
  },
};

const presetIcons: Record<DuctPresetKey, React.ComponentType<{ className?: string }>> = {
  commercial_office_main: Building2,
  retail_branch_duct: Store,
  hotel_guestroom_riser: Hotel,
  kitchen_exhaust_duct: Utensils,
  industrial_high_velocity: Factory,
  custom: SlidersHorizontal,
};

const CFM_TO_LPS = 0.471947;
const INWG_TO_PAM = 8.16828;

interface DuctPresetSelectProps {
  value: DuctPresetKey;
  customProfileName?: string;
  onChange: (key: DuctPresetKey) => void;
  onOpenCustomModal?: () => void;
  unitSystem?: "ip" | "si";
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function DuctPresetSelect({
  value,
  customProfileName,
  onChange,
  onOpenCustomModal,
  unitSystem = "ip",
  className,
  triggerClassName,
  disabled,
}: DuctPresetSelectProps) {
  const isReadOnly = typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly);
  const isEffectiveDisabled = disabled || isReadOnly;
  const [open, setOpen] = useState(false);

  const isSI = unitSystem === "si";
  const currentPreset = DUCT_PRESETS[value] || DUCT_PRESETS.commercial_office_main;
  const isCustom = value === "custom";

  const triggerLabel = isCustom
    ? (customProfileName ? (customProfileName.endsWith(" (Custom)") ? customProfileName : `${customProfileName} (Custom)`) : "Custom Configuration (Custom)")
    : currentPreset.label;

  const IconComp = isCustom ? SlidersHorizontal : (presetIcons[value] || Wind);

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
            title="Click to switch application preset, Double-click to customize"
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
              const p = DUCT_PRESETS[itemVal as DuctPresetKey];
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
            <CommandInput placeholder="Search duct sizing preset..." className="h-9 text-xs" />
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No duct preset found.</CommandEmpty>
            
            <CommandList className="max-h-[320px] overflow-y-auto p-1">
              {/* Custom Configuration Option */}
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
                      <span className="text-[10.5px] text-muted-foreground truncate">User-defined airflow, friction rate, shape & aspect ratio</span>
                    </div>
                  </div>
                  {isCustom && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                </CommandItem>
              </CommandGroup>

              <CommandSeparator className="my-1" />

              {/* Standard SMACNA / ASHRAE Presets */}
              <CommandGroup heading="Standard SMACNA & ASHRAE Duct Profiles">
                {(Object.keys(DUCT_PRESETS) as DuctPresetKey[])
                  .filter((k) => k !== "custom")
                  .map((key) => {
                    const p = DUCT_PRESETS[key];
                    const isSelected = value === key;
                    const Icon = presetIcons[key] || Wind;
                    const flowText = isSI ? `${Math.round(p.airflow * CFM_TO_LPS)} L/s` : `${p.airflow} CFM`;
                    const frText = isSI ? `${(p.targetFr * INWG_TO_PAM).toFixed(2)} Pa/m` : `${p.targetFr} in.wg`;

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
                                {p.ductShape === "round" ? "Round" : `Rect (${p.aspectRatio}:1)`}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-primary px-1.5 rounded bg-primary/10">
                                {flowText}
                              </span>
                            </div>
                            <span className="text-[10.5px] text-muted-foreground truncate">{p.category} • {frText}</span>
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
    </div>
  );
}
