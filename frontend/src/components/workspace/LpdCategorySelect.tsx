import React, { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface LpdCategorySelectProps {
  value: string;
  onChange: (val: string) => void;
  onAddCustom?: () => void;
  authorityMapping?: Record<string, number>;
  unitSystem?: "si" | "ip";
  getBaselineLpd?: (type: string) => number | undefined;
  className?: string;
  triggerClassName?: string;
  hideChevron?: boolean;
  disabled?: boolean;
}

export function formatCategoryName(name: string): string {
  if (!name) return "";
  // Preserve acronyms or existing mixed casing
  if (/[A-Z]/.test(name)) return name;
  return name.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function LpdCategorySelect({
  value,
  onChange,
  onAddCustom,
  authorityMapping = {},
  unitSystem = "si",
  getBaselineLpd,
  className,
  triggerClassName,
  hideChevron = false,
  disabled = false,
}: LpdCategorySelectProps) {
  const isReadOnly =
    typeof window !== "undefined" &&
    Boolean((window as any).__mep_is_readonly || (window as any).__mep_approved_readonly);
  const isEffectiveDisabled = Boolean(disabled || isReadOnly);
  const [open, setOpen] = useState(false);

  // Compile unique, sorted categories
  const categories = useMemo(() => {
    const map = new Map<string, string>(); // lowercase -> display string

    if (authorityMapping) {
      Object.keys(authorityMapping).forEach((k) => {
        if (k && k.trim() && k !== "ADD_NEW") {
          const trimmed = k.trim();
          const lower = trimmed.toLowerCase();
          // If we already have a lowercase entry, prefer the title-cased or upper-cased one
          if (!map.has(lower) || (/[A-Z]/.test(trimmed) && !/[A-Z]/.test(map.get(lower)!))) {
            map.set(lower, trimmed);
          }
        }
      });
    }

    if (value && value.trim() && value !== "ADD_NEW") {
      const trimmed = value.trim();
      const lower = trimmed.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, trimmed);
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      formatCategoryName(a).localeCompare(formatCategoryName(b), undefined, {
        sensitivity: "base",
      })
    );
  }, [authorityMapping, value]);

  const displayVal = value ? formatCategoryName(value) : "";
  const triggerText = displayVal || "Select Category...";
  const unitSuffix = unitSystem === "ip" ? "W/ft²" : "W/m²";

  return (
    <div
      className={cn("relative w-full min-w-0", className, isEffectiveDisabled && "pointer-events-none")}
      onClick={(e) => e.stopPropagation()}
    >
      <Popover
        open={isEffectiveDisabled ? false : open}
        onOpenChange={(val) => {
          if (!isEffectiveDisabled) setOpen(val);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isEffectiveDisabled}
            className={cn(
              "flex items-center justify-between w-full h-8 px-2 bg-surface-2/40 hover:bg-surface-2 border border-border/70 hover:border-muted-foreground/30 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none rounded-md text-foreground text-[12.5px] font-medium min-w-0 transition-all text-left",
              !value && "text-muted-foreground/60 italic font-normal",
              isEffectiveDisabled
                ? "cursor-not-allowed opacity-75 pointer-events-none hover:bg-transparent"
                : "cursor-pointer",
              triggerClassName
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (isEffectiveDisabled) {
                e.preventDefault();
                toast.info("Workspace is in Read-Only mode. Modifications are locked.", {
                  id: "readonly-notice",
                });
              }
            }}
          >
            <span className="truncate mr-1">{triggerText}</span>
            {!hideChevron && (
              <ChevronsUpDown className="size-3 text-muted-foreground shrink-0 opacity-55" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[330px] p-0 font-mori z-50 bg-popover border border-border rounded-lg shadow-xl"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <Command
            filter={(itemVal, search) => {
              const display = itemVal.toLowerCase();
              const searchLower = search.toLowerCase().trim();
              if (display.includes(searchLower)) return 1;
              const words = searchLower.split(/\s+/).filter(Boolean);
              if (words.length > 1 && words.every((word) => display.includes(word))) return 1;
              return 0;
            }}
          >
            <CommandInput placeholder="Search category..." className="h-9 text-[13px]" />
            <CommandEmpty className="py-2.5 text-center text-xs text-muted-foreground">
              No category found.
            </CommandEmpty>
            <CommandList className="max-h-[260px] overflow-y-auto custom-scrollbar">
              <CommandGroup>
                {/* 1. Clear / Select Category... */}
                <CommandItem
                  value="__select_category_clear__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10 rounded"
                >
                  <span className="italic text-muted-foreground">Select Category...</span>
                  {(!value || value === "") && <Check className="size-3.5 text-primary" />}
                </CommandItem>

                {/* 2. Other / Add Custom Area Type */}
                <CommandItem
                  value="Other Custom Area Type"
                  onSelect={() => {
                    setOpen(false);
                    if (onAddCustom) {
                      onAddCustom();
                    } else {
                      onChange("Other");
                    }
                  }}
                  className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between text-primary font-medium hover:bg-primary/10 focus:bg-primary/10 rounded"
                >
                  <span className="flex items-center gap-1.5">
                    <Plus className="size-3.5" />
                    Other
                  </span>
                  {(value === "Other" || (value && value.includes("(Custom)"))) && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </CommandItem>

                {/* 3. Category Items */}
                {categories.map((c) => {
                  const isSelected = value.toLowerCase().trim() === c.toLowerCase().trim();
                  const lpdVal = getBaselineLpd ? getBaselineLpd(c) : undefined;
                  const disp = formatCategoryName(c);

                  return (
                    <CommandItem
                      key={c}
                      value={`${disp} ${c}`}
                      onSelect={() => {
                        onChange(c);
                        setOpen(false);
                      }}
                      className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10 rounded"
                    >
                      <span className="truncate mr-2">{disp}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        {lpdVal !== undefined && (
                          <span className="text-[10px] text-muted-foreground/80 font-mono">
                            ({lpdVal.toFixed(2)} {unitSuffix})
                          </span>
                        )}
                        {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                      </div>
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
