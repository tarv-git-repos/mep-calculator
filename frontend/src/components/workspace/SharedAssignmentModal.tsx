import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Search, ChevronDown, ChevronUp, ChevronRight, Plus, Fan, Check, Edit3 } from "lucide-react";
import { useWorkspace, type Equipment, type Zone } from "@/lib/workspace-store";
import { calculateVentilation } from "@/lib/ventilation-calc";
import { usePrompt } from "@/hooks/use-confirm";

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
  initialShowAddEquip?: boolean;
  onClose: () => void;
}

export function SharedAssignmentModal({
  isOpen,
  initialEquipmentId,
  initialZoneId,
  initialZoneIds,
  initialShowAddEquip,
  onClose,
}: SharedAssignmentModalProps) {
  const { spaces, zones, equipment, setWorkspaceState } = useWorkspace();
  const prompt = usePrompt();

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

  const prevIsOpenRef = useRef(false);

  // Sync initial selection state only when modal transitions to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setShowAddEquip(!!initialShowAddEquip);
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
      } else if (initialZoneId || (initialZoneIds && initialZoneIds.length > 0)) {
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
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialEquipmentId, initialZoneId, initialZoneIds, initialShowAddEquip]);

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
      <div className="bg-background border border-border/80 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] max-h-[830px] flex flex-col overflow-hidden animate-scale-in text-xs">
        {/* Header */}
        <header className="px-5 py-4 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
          <div className="flex flex-col gap-1">
            <h3 className="font-bold text-[16.5px] text-foreground tracking-tight">Equipment Assignment Sizer</h3>
            <p className="text-[11.5px] text-muted-foreground font-medium">
              Select an equipment unit on the left and assign it to zone instances on the right.
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8.5 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150"
          >
            <X className="size-4.5" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex divide-x divide-border/50">
          {/* Left Panel: Equipment List */}
          <div className="w-[32%] flex flex-col bg-slate-50/50 dark:bg-zinc-950/20 min-h-0 p-4 gap-3">
            <div className="flex flex-col gap-2.5 flex-1 min-h-0">
              <span className="text-[9.5px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block">
                Equipment ({filteredEquipment.length})
              </span>
              <div className="relative shrink-0 select-none">
                <Search className="absolute left-3.5 top-3 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search Equipment..."
                  value={searchEquip}
                  onChange={(e) => setSearchEquip(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground transition-all font-sans"
                />
              </div>

              {/* Equipment Items */}
              <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar bg-card border border-border/60 rounded-xl divide-y divide-border/50 shadow-xs">
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
                      className={`flex items-center gap-3 px-3 py-2.5 transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-primary/5 shadow-inner border-l-2 border-l-primary"
                          : "hover:bg-surface-2/60 border-l-2 border-l-transparent"
                      }`}
                    >
                      <div
                        className={`size-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? "border-primary bg-primary/10" : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <div className="size-2 rounded-full bg-primary" />}
                      </div>
                      <div className={`p-1.5 rounded-lg bg-surface-2 dark:bg-zinc-800/40 shrink-0 ${iconColor}`}>
                        <Fan className="size-4 animate-spin-slow" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold font-mono text-[13.5px] text-foreground truncate">{eq.tag}</div>
                        <div className="text-[10.5px] text-muted-foreground font-medium mt-0.5">{mode}</div>
                      </div>
                    </div>
                  );
                })}
                {filteredEquipment.length === 0 && (
                  <div className="text-center text-muted-foreground italic py-10 text-[12px] font-medium">
                    No equipment matched search.
                  </div>
                )}
              </div>

              {/* Add New Equipment block */}
              <div className="pt-3 border-t border-border/50 mt-1 shrink-0">
                <div
                  onClick={() => setShowAddEquip(!showAddEquip)}
                  className="flex items-center justify-between py-1.5 px-1 select-none font-extrabold text-[9.5px] uppercase tracking-widest text-slate-500 dark:text-zinc-400 cursor-pointer hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-primary">
                    <Plus className="size-3.5" /> Add New Equipment
                  </span>
                  {showAddEquip ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </div>

                {showAddEquip && (
                  <div className="border border-border/80 bg-card p-3.5 rounded-xl space-y-3 shrink-0 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02)] mt-1 animate-scale-in">
                    <div className="space-y-2.5 text-[11px]">
                    <div>
                      <label className="block text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none">
                        Equipment Tag
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AHU-02"
                        value={newTag}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewTag(val);
                          const upper = val.toUpperCase();
                          if (upper.includes("MAHU")) {
                            setNewType("MAHU");
                            setNewMode("Fresh Air Only");
                          } else if (upper.includes("EAHU")) {
                            setNewType("EAHU");
                            setNewMode("Extract Air Only");
                          } else if (upper.includes("FAHU")) {
                            setNewType("FAHU");
                          }
                        }}
                        className="w-full bg-background border border-border/70 rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none">
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
                        className="w-full bg-background border border-border/70 rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-semibold transition-all duration-150 cursor-pointer"
                      >
                        <option value="FAHU">FAHU (Fresh / Extract)</option>
                        <option value="MAHU">MAHU (Fresh Air Only)</option>
                        <option value="EAHU">EAHU (Extract Air Only)</option>
                      </select>
                    </div>
                    {newType === "FAHU" && (
                      <div>
                        <label className="block text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none">
                          Ventilation Mode
                        </label>
                        <select
                          value={newMode}
                          onChange={(e) =>
                            setNewMode(e.target.value as "Fresh Air Only" | "Extract Air Only" | "Fresh Air + Extract Air")
                          }
                          className="w-full bg-background border border-border/70 rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-semibold transition-all duration-150 cursor-pointer"
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
                        setNewTag("");
                        setShowAddEquip(false);
                      }}
                      className="px-4 py-1.5 border border-border/80 hover:bg-surface-2 rounded-lg text-muted-foreground hover:text-foreground text-[11.5px] font-semibold transition-all duration-150 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddEquipment}
                      className="px-5 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/95 text-[11.5px] transition-all duration-150 cursor-pointer shadow-md shadow-primary/10"
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
          <div className="w-[68%] flex flex-col min-h-0 p-4 bg-background gap-3">
            <div className="flex flex-col gap-2.5 flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                  Zone / Instances ({filteredZonesList.length})
                </span>
                <div className="flex items-center gap-2 select-none">
                  <button
                    onClick={expandAll}
                    className="text-[10.5px] font-bold text-primary hover:text-primary/80 transition-colors bg-transparent border-0 cursor-pointer"
                  >
                    Expand All
                  </button>
                  <span className="text-muted-foreground/30 text-[10px]">|</span>
                  <button
                    onClick={collapseAll}
                    className="text-[10.5px] font-bold text-primary hover:text-primary/80 transition-colors bg-transparent border-0 cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              <div className="relative shrink-0 select-none">
                <Search className="absolute left-3.5 top-3 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search Zone by name or floor..."
                  value={searchZone}
                  onChange={(e) => setSearchZone(e.target.value)}
                  className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground transition-all font-sans"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-1.5 select-none custom-scrollbar bg-card border border-border/60 rounded-xl divide-y divide-border/50 shadow-xs">
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
                      className="overflow-hidden transition-all hover:bg-surface-2/10"
                    >
                      {/* Zone Header Row */}
                      <div
                        onClick={() => toggleZoneAll(zone, !allSelected)}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-2/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {isMulti ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(zone.id);
                              }}
                              className="p-1 rounded-lg hover:bg-surface-3 text-muted-foreground cursor-pointer shrink-0 transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="size-4 text-slate-500" /> : <ChevronRight className="size-4 text-slate-500" />}
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
                            className="size-4 rounded-md border-border/80 text-primary cursor-pointer transition-all"
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="font-bold text-[13.5px] text-foreground flex items-center gap-2">
                              <span>{zone.name}</span>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newName = await prompt(`Rename zone "${zone.name}":`, zone.name, { title: "Rename Zone" });
                                  if (newName && newName.trim() !== "" && newName.trim() !== zone.name) {
                                    const nextZones = zones.map(z => z.id === zone.id ? { ...z, name: newName.trim() } : z);
                                    const nextSpaces = spaces.map(s => s.zone === zone.name ? { ...s, zone: newName.trim() } : s);
                                    const balanced = calculateVentilation(nextSpaces, nextZones, equipment);
                                    setWorkspaceState({
                                      spaces: balanced.spaces,
                                      zones: balanced.zones,
                                      equipment: balanced.equipment,
                                    });
                                  }
                                }}
                                className="inline-flex p-0.5 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                title="Rename Zone"
                              >
                                <Edit3 className="size-3 text-primary" />
                              </button>
                              {isMulti && (
                                <span className="text-[9.5px] bg-surface-3 text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  {mult} instances
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] font-semibold text-muted-foreground mt-0.5">Floor: {zone.floor || "L01"}</div>
                          </div>
                        </div>

                        {/* Collapsed assignments indicator */}
                        {(!isExpanded || !isMulti) && assignedTags.length > 0 && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10.5px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Assigned:</span>
                            <span className="text-[10px] font-bold font-mono bg-surface-3 px-2 py-0.5 rounded text-foreground">
                              {assignedTags.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Expandable sub-rows for instances */}
                      {isMulti && isExpanded && (
                        <div className="border-t border-border/50 bg-slate-50/50 dark:bg-zinc-950/30 divide-y divide-border/40 relative shadow-inner">
                          <div className="absolute left-6 top-0 bottom-0 w-px bg-border/80" />
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
                                  className="relative flex items-center justify-between pl-11 pr-3 py-1.5 hover:bg-surface-2/80 transition-colors cursor-pointer text-[12px]"
                                >
                                <div className="absolute left-6 top-1/2 w-3.5 h-px bg-border/80 -translate-y-1/2" />
                                <div className="flex items-center gap-3.5 select-none z-10">
                                  <input
                                    type="checkbox"
                                    checked={isInstSelected}
                                    onChange={(e) => toggleInstance(zone.id, instIdx, e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="size-4 rounded border-border/80 text-primary cursor-pointer transition-all"
                                  />
                                  <span className="font-semibold text-[12.5px] text-muted-foreground">
                                    {zone.name}<span className="text-foreground">-{instIdx}</span>
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {currentAssignText && (
                                    <span className="text-[10px] text-muted-foreground mr-2 select-none italic font-medium">
                                      {currentAssignText}
                                    </span>
                                  )}
                                  {faEq && (
                                    <div className="flex items-center gap-1 text-[9.5px] px-2.5 py-0.5 bg-primary/5 border border-primary/20 text-primary rounded-full font-bold shadow-xs">
                                      <Fan className="size-2.5 shrink-0" />
                                      <span>FA: {faEq.tag}</span>
                                    </div>
                                  )}
                                  {eaEq && (
                                    <div className="flex items-center gap-1 text-[9.5px] px-2.5 py-0.5 bg-pink-500/5 border border-pink-500/20 text-pink-600 dark:text-pink-400 rounded-full font-bold shadow-xs">
                                      <Fan className="size-2.5 shrink-0" />
                                      <span>EA: {eaEq.tag}</span>
                                    </div>
                                  )}
                                  {!faEq && !eaEq && (
                                    <span className="text-[10px] text-muted-foreground font-semibold italic bg-surface-2 px-2.5 py-0.5 rounded-full select-none">Unassigned</span>
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
                  <div className="text-center text-muted-foreground italic py-10 text-[12px] font-medium">
                    No zones matched search.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 py-4 border-t border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
          <div className="flex items-center gap-6 text-[12.5px] text-foreground font-medium">
            <div>
              <span className="text-muted-foreground font-medium">Selected Equipment: </span>
              {selectedEquipment ? (
                <span className="font-bold font-mono text-primary bg-primary/10 border border-primary/25 px-2.5 py-0.5 rounded-lg text-[11.5px]">
                  {selectedEquipment.tag}
                </span>
              ) : (
                <span className="text-muted-foreground italic font-medium">None</span>
              )}
            </div>
            <div className="h-4 w-px bg-border/60" />
            <div>
              <span className="text-muted-foreground font-medium">Zones Affected: </span>
              <span className="font-bold font-mono text-foreground">{zonesAffectedCount}</span>
            </div>
            <div className="h-4 w-px bg-border/60" />
            <div>
              <span className="text-muted-foreground font-medium">Instances Selected: </span>
              <span className="font-bold font-mono text-primary">{instancesSelectedCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="border border-border/80 text-xs px-4 py-2 rounded-xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all duration-150"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isDoneDisabled}
              className={`text-xs font-bold px-6 py-2 rounded-xl transition-all cursor-pointer shadow-sm ${
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
