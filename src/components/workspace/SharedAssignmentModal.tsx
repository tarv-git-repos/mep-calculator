import React, { useState, useEffect, useMemo } from "react";
import { X, Search, ChevronDown, ChevronRight, Plus, Fan, Check } from "lucide-react";
import { useWorkspace, type Equipment, type Zone } from "@/lib/workspace-store";
import { calculateVentilation } from "@/lib/ventilation-calc";

export function getEquipVentMode(e: Equipment): string {
  const t = e.mode as string | undefined;
  const n = e.type;
  if (t === "Extract Air Only" || t === "Exhaust Air Only" || n === "Ecology" || n === "EAHU") {
    return "Exhaust Air Only";
  }
  if (t === "Fresh Air + Extract Air" || t === "Fresh + Exhaust" || n === "Air Handling Unit" || (n === "MAHU" && t === "Fresh + Exhaust")) {
    return "Fresh + Exhaust";
  }
  return "Fresh Air Only";
}

interface SharedAssignmentModalProps {
  isOpen: boolean;
  initialEquipmentId?: string | null;
  initialZoneId?: string | null;
  initialZoneIds?: string[] | null;
  onClose: () => void;
}

export function SharedAssignmentModal({
  isOpen,
  initialEquipmentId,
  initialZoneId,
  initialZoneIds,
  onClose,
}: SharedAssignmentModalProps) {
  const { spaces, zones, equipment, setWorkspaceState } = useWorkspace();

  const [selectedEquipId, setSelectedEquipId] = useState<string | null>(null);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set()); // `${zoneId}_${instanceIndex}`
  const [searchEquip, setSearchEquip] = useState("");
  const [searchZone, setSearchZone] = useState("");
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [showAddEquip, setShowAddEquip] = useState(false);

  // Add Equipment Form State
  const [newTag, setNewTag] = useState("");
  const [newType, setNewType] = useState<"FAHU" | "MAHU" | "EAHU">("FAHU");
  const [newMode, setNewMode] = useState<"Fresh Air Only" | "Extract Air Only" | "Fresh Air + Extract Air">("Fresh Air Only");
  const [newCapacity, setNewCapacity] = useState<number>(2500);

  // Sync initial selection state
  useEffect(() => {
    if (isOpen) {
      if (initialEquipmentId) {
        setSelectedEquipId(initialEquipmentId);
        const eq = equipment.find((e) => e.id === initialEquipmentId);
        if (eq) {
          const mode = getEquipVentMode(eq);
          const instances = new Set<string>();
          zones.forEach((z) => {
            const mult = z.multiplier || 1;
            for (let idx = 1; idx <= mult; idx++) {
              const inst = z.instances?.find((i) => i.instanceIndex === idx);
              const faId = inst?.faEquipId ?? (idx === 1 ? z.faAssignment : null);
              const eaId = inst?.eaEquipId ?? (idx === 1 ? z.eaAssignment : null);
              let assigned = false;
              if (mode === "Fresh Air Only" && faId === eq.id) assigned = true;
              if (mode === "Exhaust Air Only" && eaId === eq.id) assigned = true;
              if (mode === "Fresh + Exhaust" && (faId === eq.id || eaId === eq.id)) assigned = true;
              if (assigned) {
                instances.add(`${z.id}_${idx}`);
              }
            }
          });
          setSelectedInstances(instances);
        }
      } else if (initialZoneId || initialZoneIds) {
        setSelectedEquipId(null);
        const targetIds = initialZoneIds && initialZoneIds.length > 0 ? Array.from(initialZoneIds) : initialZoneId ? [initialZoneId] : [];
        const instances = new Set<string>();
        const expanded = new Set<string>();
        targetIds.forEach((id) => {
          const z = zones.find((zone) => zone.id === id);
          if (z) {
            const mult = z.multiplier || 1;
            for (let idx = 1; idx <= mult; idx++) {
              instances.add(`${z.id}_${idx}`);
            }
            expanded.add(z.id);
          }
        });
        setSelectedInstances(instances);
        setExpandedZones(expanded);
      } else {
        setSelectedEquipId(null);
        setSelectedInstances(new Set());
      }
    }
  }, [isOpen, initialEquipmentId, initialZoneId, initialZoneIds, zones, equipment]);

  // Handle equipment selection
  const handleEquipSelect = (eqId: string) => {
    setSelectedEquipId(eqId);
    const eq = equipment.find((e) => e.id === eqId);
    if (!eq) return;
    const mode = getEquipVentMode(eq);
    const instances = new Set<string>();
    const hasTargetZone = !!initialZoneId || (!!initialZoneIds && initialZoneIds.length > 0);

    if (hasTargetZone) {
      // ONLY check target zones
      const targetIds = initialZoneIds && initialZoneIds.length > 0 ? Array.from(initialZoneIds) : initialZoneId ? [initialZoneId] : [];
      targetIds.forEach((id) => {
        const z = zones.find((zone) => zone.id === id);
        if (z) {
          const mult = z.multiplier || 1;
          for (let idx = 1; idx <= mult; idx++) {
            instances.add(`${z.id}_${idx}`);
          }
        }
      });
    } else {
      // Manage Equipment mode: check all zones/instances currently assigned to this equipment
      zones.forEach((z) => {
        const mult = z.multiplier || 1;
        for (let idx = 1; idx <= mult; idx++) {
          const inst = z.instances?.find((i) => i.instanceIndex === idx);
          const faId = inst?.faEquipId ?? (idx === 1 ? z.faAssignment : null);
          const eaId = inst?.eaEquipId ?? (idx === 1 ? z.eaAssignment : null);
          let assigned = false;
          if (mode === "Fresh Air Only" && faId === eq.id) assigned = true;
          if (mode === "Exhaust Air Only" && eaId === eq.id) assigned = true;
          if (mode === "Fresh + Exhaust" && (faId === eq.id || eaId === eq.id)) assigned = true;
          if (assigned) {
            instances.add(`${z.id}_${idx}`);
          }
        }
      });
    }
    setSelectedInstances(instances);
  };

  const selectedEquipment = useMemo(
    () => equipment.find((eq) => eq.id === selectedEquipId) || null,
    [equipment, selectedEquipId]
  );

  const filteredEquipment = useMemo(() => {
    const q = searchEquip.toLowerCase().trim();
    return equipment.filter((eq) => {
      const mode = getEquipVentMode(eq);
      return !q || `${eq.tag} ${eq.type} ${mode}`.toLowerCase().includes(q);
    });
  }, [equipment, searchEquip]);

  const filteredZonesList = useMemo(() => {
    const q = searchZone.toLowerCase().trim();
    return zones.filter((z) => !q || `${z.name} ${z.floor || ""}`.toLowerCase().includes(q));
  }, [zones, searchZone]);

  const expandAll = () => {
    setExpandedZones(new Set(zones.map((z) => z.id)));
  };

  const collapseAll = () => {
    setExpandedZones(new Set());
  };

  const toggleExpand = (zoneId: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      return next;
    });
  };

  const toggleInstance = (zoneId: string, instanceIndex: number, checked: boolean) => {
    setSelectedInstances((prev) => {
      const next = new Set(prev);
      const key = `${zoneId}_${instanceIndex}`;
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const toggleZoneAll = (zone: Zone, checked: boolean) => {
    const mult = zone.multiplier || 1;
    setSelectedInstances((prev) => {
      const next = new Set(prev);
      for (let idx = 1; idx <= mult; idx++) {
        const key = `${zone.id}_${idx}`;
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  };

  const getZoneSelectionState = (zone: Zone) => {
    const mult = zone.multiplier || 1;
    let count = 0;
    for (let idx = 1; idx <= mult; idx++) {
      if (selectedInstances.has(`${zone.id}_${idx}`)) {
        count++;
      }
    }
    return {
      allSelected: count === mult,
      noneSelected: count === 0,
      isIndeterminate: count > 0 && count < mult,
      selectedCount: count,
    };
  };

  const zonesAffectedCount = useMemo(() => {
    const affected = new Set<string>();
    selectedInstances.forEach((key) => {
      const [zoneId] = key.split("_");
      affected.add(zoneId);
    });
    return affected.size;
  }, [selectedInstances]);

  const instancesSelectedCount = selectedInstances.size;
  const isDoneDisabled = !selectedEquipId || instancesSelectedCount === 0;

  const handleAddEquipment = () => {
    if (!newTag.trim()) {
      alert("Please enter an equipment tag!");
      return;
    }
    if (equipment.some((e) => e.tag.toLowerCase() === newTag.trim().toLowerCase())) {
      alert("An equipment with this tag already exists!");
      return;
    }
    const newEquip: Equipment = {
      id: `equip-${Date.now()}`,
      tag: newTag.trim(),
      type: newType === "EAHU" ? "Ecology" : newType,
      zones: 0,
      spaces: 0,
      totalAirflow: 0,
      capacity: newCapacity || 2500,
      utilization: 0,
      status: "design",
      mode: newMode,
      zoneIds: [],
      totalFA: 0,
      totalEA: 0,
    };
    const balanced = calculateVentilation(spaces, zones, [...equipment, newEquip]);
    setWorkspaceState({
      spaces: balanced.spaces,
      zones: balanced.zones,
      equipment: balanced.equipment,
    });
    setSelectedEquipId(newEquip.id);
    setShowAddEquip(false);
    setNewTag("");
    setNewCapacity(2500);
  };

  const handleSave = () => {
    if (!selectedEquipment) return;
    const mode = getEquipVentMode(selectedEquipment);
    const hasTargetZone = !!initialZoneId || (!!initialZoneIds && initialZoneIds.length > 0);
    const targetIds = initialZoneIds && initialZoneIds.length > 0 ? Array.from(initialZoneIds) : initialZoneId ? [initialZoneId] : [];

    const nextZones = zones.map((zone) => {
      if (hasTargetZone && !targetIds.includes(zone.id)) {
        return zone;
      }
      const mult = zone.multiplier || 1;
      const instances = [...(zone.instances || [])];
      let changed = false;
      const nextInstances = [];

      for (let o = 0; o < mult; o++) {
        const instIdx = o + 1;
        const key = `${zone.id}_${instIdx}`;
        let inst = instances.find((e) => e.instanceIndex === instIdx);

        if (!inst) {
          inst = {
            instanceIndex: instIdx,
            faEquipId: instIdx === 1 ? (zone.faAssignment ?? null) : null,
            eaEquipId: instIdx === 1 ? (zone.eaAssignment ?? null) : null,
          };
        } else {
          inst = { ...inst };
        }

        const isSelected = selectedInstances.has(key);
        let faId = inst.faEquipId;
        let eaId = inst.eaEquipId;

        if (isSelected) {
          if (mode === "Fresh Air Only") {
            faId = selectedEquipment.id;
          } else if (mode === "Exhaust Air Only") {
            eaId = selectedEquipment.id;
          } else if (mode === "Fresh + Exhaust") {
            faId = selectedEquipment.id;
            eaId = selectedEquipment.id;
          }
        } else {
          if (mode === "Fresh Air Only" && inst.faEquipId === selectedEquipment.id) {
            faId = null;
          } else if (mode === "Exhaust Air Only" && inst.eaEquipId === selectedEquipment.id) {
            eaId = null;
          } else if (mode === "Fresh + Exhaust") {
            if (inst.faEquipId === selectedEquipment.id) faId = null;
            if (inst.eaEquipId === selectedEquipment.id) eaId = null;
          }
        }

        if (faId !== inst.faEquipId || eaId !== inst.eaEquipId) {
          changed = true;
        }

        nextInstances.push({
          instanceIndex: instIdx,
          faEquipId: faId,
          eaEquipId: eaId,
        });
      }

      if (!changed && zone.instances) return zone;

      const faAssignments: Record<string, number> = {};
      const eaAssignments: Record<string, number> = {};

      nextInstances.forEach((inst) => {
        if (inst.faEquipId) {
          faAssignments[inst.faEquipId] = (faAssignments[inst.faEquipId] || 0) + 1;
        }
        if (inst.eaEquipId) {
          eaAssignments[inst.eaEquipId] = (eaAssignments[inst.eaEquipId] || 0) + 1;
        }
      });

      const firstFa = Object.keys(faAssignments)[0] || null;
      const firstEa = Object.keys(eaAssignments)[0] || null;

      return {
        ...zone,
        instances: nextInstances,
        faAssignments,
        eaAssignments,
        faAssignment: firstFa,
        eaAssignment: firstEa,
        faAssignedQty: firstFa ? faAssignments[firstFa] : 1,
        eaAssignedQty: firstEa ? eaAssignments[firstEa] : 1,
      };
    });

    const balanced = calculateVentilation(spaces, nextZones, equipment);
    setWorkspaceState({
      spaces: balanced.spaces,
      zones: balanced.zones,
      equipment: balanced.equipment,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-scale-in text-xs">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 select-none bg-card">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-bold text-[16px] text-foreground tracking-tight">Equipment Assignment Sizer</h3>
            <p className="text-[11.5px] text-muted-foreground">
              Select an equipment unit on the left and assign it to zone instances on the right.
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full hover:bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex divide-x divide-border">
          {/* Left Panel: Equipment List */}
          <div className="w-[30%] flex flex-col bg-surface-1 min-h-0 p-4">
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Equipment ({filteredEquipment.length})
              </span>
              <div className="relative shrink-0 select-none">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search Equipment..."
                  value={searchEquip}
                  onChange={(e) => setSearchEquip(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                />
              </div>

              {/* Equipment Items */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredEquipment.map((eq) => {
                  const mode = getEquipVentMode(eq);
                  const isSelected = selectedEquipId === eq.id;
                  let iconColor = "text-primary";
                  if (mode === "Exhaust Air Only") {
                    iconColor = "text-pink-600 dark:text-pink-400";
                  } else if (mode === "Fresh + Exhaust") {
                    iconColor = "text-purple-600 dark:text-purple-400";
                  }

                  return (
                    <div
                      key={eq.id}
                      onClick={() => handleEquipSelect(eq.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20"
                          : "bg-background border-border hover:bg-surface-2"
                      }`}
                    >
                      <div
                        className={`size-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? "border-primary" : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <div className="size-2.5 rounded-full bg-primary" />}
                      </div>
                      <div className={`p-2 rounded-lg bg-surface-2 shrink-0 ${iconColor}`}>
                        <Fan className="size-4 animate-spin-slow" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold font-mono text-[13px] text-foreground truncate">{eq.tag}</div>
                        <div className="text-[10.5px] text-muted-foreground mt-0.5">{mode}</div>
                      </div>
                    </div>
                  );
                })}
                {filteredEquipment.length === 0 && (
                  <div className="text-center text-muted-foreground italic py-10 text-[12px]">
                    No equipment matched search.
                  </div>
                )}
              </div>

              {/* Add New Equipment collapsible block */}
              <div className="pt-2 border-t border-border mt-1 shrink-0">
                <div
                  onClick={() => setShowAddEquip(!showAddEquip)}
                  className="flex items-center justify-between py-2 px-3 hover:bg-surface-2 rounded-lg cursor-pointer select-none font-bold text-[11px] uppercase tracking-wider text-muted-foreground transition-all duration-150"
                >
                  <span className="flex items-center gap-1.5 text-primary">
                    <Plus className="size-3.5" /> Add New Equipment
                  </span>
                  {showAddEquip ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </div>

                {showAddEquip && (
                  <div className="border border-border bg-background p-4 rounded-2xl space-y-4 shrink-0 select-none shadow-sm mt-1 animate-scale-in">
                    <div className="space-y-3 text-[11px]">
                      <div>
                        <label className="block text-muted-foreground font-bold text-[10px] uppercase tracking-wider mb-1.5 select-none">
                          Equipment Tag
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. AHU-02"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] font-mono text-foreground transition-all duration-150"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground font-bold text-[10px] uppercase tracking-wider mb-1.5 select-none">
                          Equipment Type
                        </label>
                        <select
                          value={newType}
                          onChange={(e) => {
                            const val = e.target.value as "FAHU" | "MAHU" | "EAHU";
                            setNewType(val);
                            if (val === "MAHU") setNewMode("Fresh Air Only");
                            else if (val === "EAHU") setNewMode("Extract Air Only");
                          }}
                          className="w-full bg-background border border-border rounded-xl px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-semibold transition-all duration-150"
                        >
                          <option value="FAHU">FAHU (Fresh / Extract)</option>
                          <option value="MAHU">MAHU (Fresh Air Only)</option>
                          <option value="EAHU">EAHU (Extract Air Only)</option>
                        </select>
                      </div>
                      {newType === "FAHU" && (
                        <div>
                          <label className="block text-muted-foreground font-bold text-[10px] uppercase tracking-wider mb-1.5 select-none">
                            Ventilation Mode
                          </label>
                          <select
                            value={newMode}
                            onChange={(e) =>
                              setNewMode(e.target.value as "Fresh Air Only" | "Extract Air Only" | "Fresh Air + Extract Air")
                            }
                            className="w-full bg-background border border-border rounded-xl px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-semibold transition-all duration-150"
                          >
                            <option value="Fresh Air Only">Fresh Air Only</option>
                            <option value="Extract Air Only">Extract Air Only</option>
                            <option value="Fresh Air + Extract Air">Fresh Air + Extract Air</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2 text-[11px] pt-1">
                      <button
                        onClick={() => {
                          setShowAddEquip(false);
                          setNewTag("");
                        }}
                        className="px-4 py-2 border border-border hover:bg-surface-2 rounded-xl text-muted-foreground hover:text-foreground text-[11.5px] font-semibold transition-all duration-150 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddEquipment}
                        className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/95 text-[11.5px] transition-all duration-150 cursor-pointer shadow-sm shadow-primary/10"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Zone / Instances List */}
          <div className="w-[70%] flex flex-col min-h-0 p-4 bg-background">
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Zone / Instances ({filteredZonesList.length})
                </span>
                <div className="flex items-center gap-2 select-none">
                  <button
                    onClick={expandAll}
                    className="text-[11px] font-semibold text-primary hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    Expand All
                  </button>
                  <span className="text-muted-foreground/30 text-[10px]">|</span>
                  <button
                    onClick={collapseAll}
                    className="text-[11px] font-semibold text-primary hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              <div className="relative shrink-0 select-none">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search Zone by name or floor..."
                  value={searchZone}
                  onChange={(e) => setSearchZone(e.target.value)}
                  className="w-full bg-surface-1 border border-border rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none">
                {filteredZonesList.map((zone) => {
                  const mult = zone.multiplier || 1;
                  const isMulti = mult > 1;
                  const isExpanded = expandedZones.has(zone.id);
                  const { allSelected, noneSelected, isIndeterminate } = getZoneSelectionState(zone);

                  // Collect assigned equipments for display on the collapsed zone item
                  const assignedTags: string[] = [];
                  const instances = zone.instances || [];
                  for (let idx = 1; idx <= mult; idx++) {
                    const inst = instances.find((i) => i.instanceIndex === idx);
                    const faId = inst?.faEquipId ?? (idx === 1 ? zone.faAssignment : null);
                    const eaId = inst?.eaEquipId ?? (idx === 1 ? zone.eaAssignment : null);
                    if (faId) {
                      const eq = equipment.find((e) => e.id === faId);
                      if (eq && !assignedTags.includes(eq.tag)) assignedTags.push(eq.tag);
                    }
                    if (eaId) {
                      const eq = equipment.find((e) => e.id === eaId);
                      if (eq && !assignedTags.includes(eq.tag)) assignedTags.push(eq.tag);
                    }
                  }

                  return (
                    <div
                      key={zone.id}
                      className="border border-border/80 rounded-xl overflow-hidden bg-surface-1/40"
                    >
                      {/* Zone Header Row */}
                      <div
                        onClick={() => toggleZoneAll(zone, !allSelected)}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {isMulti ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(zone.id);
                              }}
                              className="p-1 rounded hover:bg-surface-3 text-muted-foreground cursor-pointer shrink-0 transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                          ) : (
                            <div className="size-6 shrink-0" />
                          )}
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isIndeterminate;
                            }}
                            onChange={(e) => toggleZoneAll(zone, e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="size-4 rounded border-border text-primary focus:ring-primary focus:ring-1 cursor-pointer"
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="font-semibold text-[13px] text-foreground flex items-center gap-2">
                              <span>{zone.name}</span>
                              {isMulti && (
                                <span className="text-[10px] bg-surface-3 px-1.5 py-0.2 rounded-full text-muted-foreground font-mono">
                                  {mult} instances
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-muted-foreground">Floor: {zone.floor || "L01"}</div>
                          </div>
                        </div>

                        {/* Collapsed assignments indicator */}
                        {(!isExpanded || !isMulti) && assignedTags.length > 0 && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10.5px] text-muted-foreground font-semibold">Assigned:</span>
                            <span className="text-[11px] font-mono bg-surface-3 px-2 py-0.5 rounded text-foreground font-semibold">
                              {assignedTags.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Expandable sub-rows for instances */}
                      {isMulti && isExpanded && (
                        <div className="border-t border-border/60 bg-background divide-y divide-border/60">
                          {Array.from({ length: mult }).map((_, o) => {
                            const instIdx = o + 1;
                            const instKey = `${zone.id}_${instIdx}`;
                            const isInstSelected = selectedInstances.has(instKey);
                            const inst = zone.instances?.find((i) => i.instanceIndex === instIdx);
                            const faId = inst?.faEquipId ?? (instIdx === 1 ? zone.faAssignment : null);
                            const eaId = inst?.eaEquipId ?? (instIdx === 1 ? zone.eaAssignment : null);
                            const faEq = equipment.find((e) => e.id === faId);
                            const eaEq = equipment.find((e) => e.id === eaId);

                            let currentAssignText = "";
                            if (selectedEquipment) {
                              const mode = getEquipVentMode(selectedEquipment);
                              if (mode === "Fresh Air Only" && faEq && faEq.id !== selectedEquipment.id) {
                                currentAssignText = `Currently Assigned: ${faEq.tag}`;
                              } else if (mode === "Exhaust Air Only" && eaEq && eaEq.id !== selectedEquipment.id) {
                                currentAssignText = `Currently Assigned: ${eaEq.tag}`;
                              } else if (mode === "Fresh + Exhaust") {
                                const faText = faEq && faEq.id !== selectedEquipment.id ? `FA: ${faEq.tag}` : "";
                                const eaText = eaEq && eaEq.id !== selectedEquipment.id ? `EA: ${eaEq.tag}` : "";
                                if (faText && eaText) currentAssignText = `Currently Assigned: ${faText} + ${eaText}`;
                                else if (faText || eaText) currentAssignText = `Currently Assigned: ${faText || eaText}`;
                              }
                            }

                            return (
                              <div
                                key={instKey}
                                onClick={() => toggleInstance(zone.id, instIdx, !isInstSelected)}
                                className="flex items-center justify-between pl-10 pr-3 py-2 hover:bg-surface-2 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-3 select-none">
                                  <input
                                    type="checkbox"
                                    checked={isInstSelected}
                                    onChange={(e) => toggleInstance(zone.id, instIdx, e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="size-3.5 rounded border-border text-primary focus:ring-primary focus:ring-1 cursor-pointer"
                                  />
                                  <span className="font-mono text-[12px] text-foreground">
                                    {zone.name}-{instIdx}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {currentAssignText && (
                                    <span className="text-[10px] text-muted-foreground mr-2 select-none italic font-medium">
                                      {currentAssignText}
                                    </span>
                                  )}
                                  {faEq && (
                                    <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-full">
                                      <Fan className="size-2.5 shrink-0" />
                                      <span className="font-semibold">FA: {faEq.tag}</span>
                                    </div>
                                  )}
                                  {eaEq && (
                                    <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-pink-500/10 border border-pink-500/20 text-pink-600 dark:text-pink-400 rounded-full">
                                      <Fan className="size-2.5 shrink-0" />
                                      <span className="font-semibold">EA: {eaEq.tag}</span>
                                    </div>
                                  )}
                                  {!faEq && !eaEq && (
                                    <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredZonesList.length === 0 && (
                  <div className="text-center text-muted-foreground italic py-10 text-[12px]">
                    No zones matched search.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0 select-none bg-card">
          <div className="flex items-center gap-6 text-[12.5px] text-foreground font-medium">
            <div>
              <span className="text-muted-foreground">Selected Equipment: </span>
              {selectedEquipment ? (
                <span className="font-bold font-mono text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 rounded">
                  {selectedEquipment.tag}
                </span>
              ) : (
                <span className="text-muted-foreground italic">None</span>
              )}
            </div>
            <div className="h-4 w-px bg-border" />
            <div>
              <span className="text-muted-foreground">Zones Affected: </span>
              <span className="font-bold font-mono">{zonesAffectedCount}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div>
              <span className="text-muted-foreground">Instances Selected: </span>
              <span className="font-bold font-mono text-primary">{instancesSelectedCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="border border-border text-xs px-5 py-2 rounded-xl hover:bg-surface-2 text-foreground cursor-pointer transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isDoneDisabled}
              className={`text-xs font-semibold px-6 py-2 rounded-xl transition-all cursor-pointer ${
                isDoneDisabled
                  ? "bg-surface-3 text-muted-foreground border border-border cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/10"
              }`}
            >
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
