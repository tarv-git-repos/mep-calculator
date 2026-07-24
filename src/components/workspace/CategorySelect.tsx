import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getOccupancyCategories, getCategoryDisplayName } from "@/lib/ashrae-data";
import { cn } from "@/lib/utils";

interface CategorySelectProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  triggerClassName?: string;
}

export function CategorySelect({ value, onChange, className, triggerClassName }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const categories = getOccupancyCategories();

  // Find the selected display text
  const displayVal = value && value.endsWith(" (Custom)") ? "Other" : value;
  const triggerText = displayVal ? getCategoryDisplayName(displayVal) : "Select Category...";

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center justify-between w-full bg-transparent border border-transparent hover:bg-surface-2 hover:border-muted-foreground/20 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none py-0.5 px-1 rounded text-foreground text-[13px] cursor-pointer min-w-0 transition-all",
              triggerClassName
            )}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <span className="truncate mr-1.5">{triggerText}</span>
            <ChevronsUpDown className="size-3 text-muted-foreground shrink-0 opacity-55" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[320px] p-0 font-mori z-50" 
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <Command filter={(value, search) => {
            // Custom robust search helper for cmdk to match display names
            const display = getCategoryDisplayName(value).toLowerCase();
            const searchLower = search.toLowerCase();
            if (display.includes(searchLower) || value.toLowerCase().includes(searchLower)) return 1;
            // Also split search query into words to match singular/plural (e.g. locker room matches Locker rooms)
            const words = searchLower.split(/\s+/).filter(Boolean);
            if (words.length > 1 && words.every(word => display.includes(word))) return 1;
            return 0;
          }}>
            <CommandInput placeholder="Search category..." className="h-9 text-[13px]" />
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">No category found.</CommandEmpty>
            <CommandList className="max-h-[250px] overflow-y-auto">
              <CommandGroup>
                <CommandItem
                  value=""
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10"
                >
                  <span className="italic text-muted-foreground">Select Category...</span>
                  {value === "" && <Check className="size-3.5 text-primary" />}
                </CommandItem>
                <CommandItem
                  value="Other"
                  onSelect={() => {
                    onChange("Other");
                    setOpen(false);
                  }}
                  className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10"
                >
                  <span>Other</span>
                  {(value === "Other" || value === "Custom (Custom)") && <Check className="size-3.5 text-primary" />}
                </CommandItem>
                {categories.map((c) => {
                  const disp = getCategoryDisplayName(c);
                  const isSelected = value === c;
                  return (
                    <CommandItem
                      key={c}
                      value={c}
                      onSelect={() => {
                        onChange(c);
                        setOpen(false);
                      }}
                      className="text-[12px] py-1.5 px-2 cursor-pointer flex items-center justify-between hover:bg-primary/10 focus:bg-primary/10"
                    >
                      <span className="truncate">{disp}</span>
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
