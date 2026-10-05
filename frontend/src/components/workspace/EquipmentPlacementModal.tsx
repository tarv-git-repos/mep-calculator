import React, { useState, useMemo } from "react";
import { X, Search, MapPin, Building, ChevronDown, ChevronRight, Check, Trash2, Plus } from "lucide-react";
import { useWorkspace, type Equipment, type Space } from "@/lib/workspace-store";

interface EquipmentPlacementModalProps {
  isOpen: boolean;
  equipment: Equipment | null;
  onClose: () => void;
  onSave: (equipId: string, locationFloor: string, locationSpaceId: string, locationSpaceName: string) => void;
}

export function EquipmentPlacementModal({
  isOpen,
  equipment,
  onClose,
  onSave,
}: EquipmentPlacementModalProps) {
  const { spaces } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<string>(equipment?.locationFloor || "");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(equipment?.locationSpaceId || "");
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>(equipment?.locationSpaceName || "");

  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(() => {
    const allFloors = new Set<string>();
    spaces.forEach((s) => {
      if (s.floor) allFloors.add(s.floor);
    });
    return allFloors;
  });

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customFloor, setCustomFloor] = useState("");
  const [customSpaceName, setCustomSpaceName] = useState("");

  // Sync state when equipment changes or modal opens
  React.useEffect(() => {
    if (equipment) {
      setSelectedFloor(equipment.locationFloor || "");
      setSelectedSpaceId(equipment.locationSpaceId || "");
      setSelectedSpaceName(equipment.locationSpaceName || "");
      setShowCustomInput(false);
      setCustomFloor("");
      setCustomSpaceName("");
    }
  }, [equipment, isOpen]);

  // Group spaces by floor
  const groupedSpaces = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const map = new Map<string, Space[]>();

    spaces.forEach((s) => {
      const fl = s.floor || "Unassigned Floor";
      const match = !q || `${s.name} ${s.code || ""} ${fl} ${s.building || ""}`.toLowerCase().includes(q);
      if (match) {
        if (!map.has(fl)) map.set(fl, []);
        map.get(fl)!.push(s);
      }
    });

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [spaces, searchQuery]);

  const toggleFloor = (fl: string) => {
    setExpandedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(fl)) next.delete(fl);
      else next.add(fl);
      return next;
    });
  };

  const handleSelectSpace = (space: Space) => {
    setSelectedSpaceId(space.id);
    setSelectedSpaceName(space.name);
    setSelectedFloor(space.floor || "");
    setShowCustomInput(false);
  };

  const handleApplyCustom = () => {
    if (!customSpaceName.trim()) return;
    const customId = `custom-space-${Date.now()}`;
    const fl = customFloor.trim() || "Roof / Mechanical Floor";
    const spName = customSpaceName.trim();
    setSelectedSpaceId(customId);
    setSelectedSpaceName(spName);
    setSelectedFloor(fl);
  };

  const handleClear = () => {
    setSelectedSpaceId("");
    setSelectedSpaceName("");
    setSelectedFloor("");
  };

  const handleSave = () => {
    if (!equipment) return;
    onSave(equipment.id, selectedFloor, selectedSpaceId, selectedSpaceName);
    onClose();
  };

  if (!isOpen || !equipment) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border/80 rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] max-h-[750px] flex flex-col overflow-hidden animate-scale-in text-xs">
        {/* Header */}
        <header className="px-5 py-4 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <MapPin className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-[16.5px] text-foreground tracking-tight flex items-center gap-2">
                3D Studio Placement: <span className="font-mono text-primary">{equipment.tag}</span>
              </h3>
              <p className="text-[11.5px] text-muted-foreground font-medium mt-0.5">
                Select the floor and space where this {equipment.type || "equipment"} machine will be installed inside 3D Studio.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8.5 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150"
          >
            <X className="size-4.5" />
          </button>
        </header>

        {/* Selected Placement Summary Banner */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-900/50 border-b border-border/50 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Selected Location:
            </span>
            {selectedSpaceName ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-bold text-[12px]">
                <MapPin className="size-3.5" />
                <span>{selectedSpaceName}</span>
                {selectedFloor && (
                  <span className="text-[10.5px] font-medium opacity-80">({selectedFloor})</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground italic font-medium">No space selected (Unassigned)</span>
            )}
          </div>

          {selectedSpaceName && (
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Clear Placement</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex flex-col p-4 gap-3 bg-background overflow-hidden">
          {/* Search and Custom Placement Bar */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex-1 select-none">
              <Search className="absolute left-3.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search space name, code, or floor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground transition-all font-sans"
              />
            </div>
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/80 hover:bg-surface-2 text-foreground font-semibold text-[11.5px] transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="size-3.5 text-primary" />
              <span>Custom Location</span>
            </button>
          </div>

          {/* Custom Location Input Form */}
          {showCustomInput && (
            <div className="p-3 bg-card border border-primary/20 rounded-xl space-y-2.5 shrink-0 animate-scale-in">
              <div className="text-[11px] font-bold text-foreground">Specify Custom Equipment Location</div>
              <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1 text-[10px] uppercase">Floor / Level</label>
                  <input
                    type="text"
                    placeholder="e.g. Roof, Mechanical Level..."
                    value={customFloor}
                    onChange={(e) => setCustomFloor(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1 text-[10px] uppercase">Space / Room Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Plant Room 01..."
                    value={customSpaceName}
                    onChange={(e) => setCustomSpaceName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowCustomInput(false)}
                  className="px-3 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground text-[11px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyCustom}
                  className="px-4 py-1 rounded-lg bg-primary text-primary-foreground font-bold text-[11px]"
                >
                  Set Custom Placement
                </button>
              </div>
            </div>
          )}

          {/* Floor-wise Grouped Spaces List */}
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar bg-card border border-border/60 rounded-xl divide-y divide-border/50 shadow-xs">
            {groupedSpaces.map(([floor, floorSpaces]) => {
              const isExpanded = expandedFloors.has(floor);
              const selectedInFloorCount = floorSpaces.filter((s) => s.id === selectedSpaceId).length;

              return (
                <div key={floor} className="overflow-hidden">
                  {/* Floor Header Row */}
                  <div
                    onClick={() => toggleFloor(floor)}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/70 dark:bg-zinc-950/40 hover:bg-surface-2/60 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 font-bold text-foreground text-[12.5px]">
                      <Building className="size-4 text-primary shrink-0" />
                      <span>Floor: {floor}</span>
                      <span className="text-[10px] font-semibold bg-surface-3 text-muted-foreground px-2 py-0.5 rounded-full">
                        {floorSpaces.length} {floorSpaces.length === 1 ? "space" : "spaces"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedInFloorCount > 0 && (
                        <span className="text-[9.5px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                          Selected
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Floor Spaces List */}
                  {isExpanded && (
                    <div className="divide-y divide-border/40 bg-background">
                      {floorSpaces.map((space) => {
                        const isSelected = selectedSpaceId === space.id;

                        return (
                          <div
                            key={space.id}
                            onClick={() => handleSelectSpace(space)}
                            className={`flex items-center justify-between px-4 py-2.5 transition-all cursor-pointer select-none ${
                              isSelected
                                ? "bg-primary/5 border-l-3 border-l-primary"
                                : "hover:bg-surface-2/50 border-l-3 border-l-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div
                                className={`size-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected ? "border-primary bg-primary/10" : "border-muted-foreground/30"
                                }`}
                              >
                                {isSelected && <div className="size-2 rounded-full bg-primary" />}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="font-bold text-[13px] text-foreground flex items-center gap-2 truncate">
                                  <span>{space.name}</span>
                                  {space.code && (
                                    <span className="font-mono text-[10.5px] font-semibold text-muted-foreground bg-surface-3 px-1.5 py-0.5 rounded">
                                      {space.code}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10.5px] text-muted-foreground font-medium mt-0.5 flex items-center gap-3">
                                  {space.category && <span>Category: {space.category}</span>}
                                  <span>Area: {space.area} m²</span>
                                  {space.zone && <span>Zone: {space.zone}</span>}
                                </div>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="flex items-center gap-1.5 text-primary font-bold text-[11px] shrink-0">
                                <Check className="size-4" />
                                <span>Selected</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {groupedSpaces.length === 0 && (
              <div className="text-center text-muted-foreground italic py-12 text-[12px] font-medium">
                No spaces found matching your search.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 py-4 border-t border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
          <div className="text-[12px] text-muted-foreground font-medium">
            {selectedSpaceName ? (
              <span>
                Placement target: <strong className="text-foreground">{selectedSpaceName}</strong> ({selectedFloor})
              </span>
            ) : (
              <span className="italic">No space selected</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="border border-border/80 text-xs px-4 py-2 rounded-xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all duration-150"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10"
            >
              Save Placement
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
