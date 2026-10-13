import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface GridDropdownOption<T extends string = string> {
  value: T;
  label: string;
}

interface GridDropdownProps<T extends string = string> {
  value: T;
  options: GridDropdownOption<T>[];
  onChange: (val: T) => void;
  onOtherSelect?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentWidth?: number;
  hasOther?: boolean;
  otherLabel?: string;
  otherValue?: T;
  hideChevron?: boolean;
}

export function GridDropdown<T extends string = string>({
  value,
  options,
  onChange,
  onOtherSelect,
  placeholder = "Select...",
  disabled,
  className,
  triggerClassName,
  contentWidth = 260,
  hasOther = false,
  otherLabel = "Other / Custom",
  otherValue = "other" as T,
  hideChevron = false,
}: GridDropdownProps<T>) {
  const isReadOnly = typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly);
  const isEffectiveDisabled = disabled || isReadOnly;
  const [open, setOpen] = useState(false);

  // Determine current display label
  const selectedOption = options.find((o) => o.value === value);
  const isOtherSelected = value === otherValue || String(value).toLowerCase() === "other" || String(value).toLowerCase().includes("custom");
  const triggerText = selectedOption
    ? selectedOption.label
    : isOtherSelected
    ? otherLabel
    : value
    ? String(value)
    : placeholder;

  return (
    <div className={cn("relative w-full min-w-0", className)} onClick={(e) => e.stopPropagation()}>
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
              "flex items-center justify-between w-full bg-transparent border border-transparent hover:bg-surface-2 hover:border-muted-foreground/20 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-0.5 px-1 rounded text-foreground text-[13px] min-w-0 transition-all",
              isEffectiveDisabled
                ? "cursor-not-allowed opacity-75 pointer-events-none hover:bg-transparent"
                : "cursor-pointer",
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
            <span className="truncate mr-1.5">{triggerText}</span>
            {!hideChevron && <ChevronsUpDown className="size-3 text-muted-foreground shrink-0 opacity-55" />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 font-mori z-50 shadow-xl border border-border"
          style={{ width: contentWidth }}
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <Command
            filter={(val, search) => {
              const item = options.find((o) => o.value.toLowerCase() === val.toLowerCase());
              const label = item ? item.label.toLowerCase() : val.toLowerCase();
              const s = search.toLowerCase();
              if (label.includes(s) || val.toLowerCase().includes(s)) return 1;
              const words = s.split(/\s+/).filter(Boolean);
              if (words.length > 1 && words.every((w) => label.includes(w))) return 1;
              return 0;
            }}
          >
            <CommandInput placeholder="Search..." className="h-8 text-[12.5px]" />
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">No options found.</CommandEmpty>
            <CommandList className="max-h-[250px] overflow-y-auto">
              <CommandGroup>
                {/* 1. Other / Custom option pinned strictly at the top (first place) */}
                {hasOther && (
                  <CommandItem
                    value={String(otherValue)}
                    onSelect={() => {
                      setOpen(false);
                      if (onOtherSelect) {
                        onOtherSelect();
                      } else {
                        onChange(otherValue);
                      }
                    }}
                    className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10 font-semibold text-primary"
                  >
                    <span className="truncate">{otherLabel}</span>
                    {isOtherSelected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" />}
                  </CommandItem>
                )}

                {/* 2. Standard Options */}
                {options.map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10"
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" />}
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
