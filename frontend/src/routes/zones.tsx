import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Edit3, Flag } from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace, type Zone, type Space } from "@/lib/workspace-store";
import { useCalculationReviewState, useCalculationLock, useCalculationEffectiveReadOnly } from "@/components/workspace/CalculationReviewBar";
import { useConfirm } from "@/hooks/use-confirm";
import { EditSpaceModal } from "@/components/workspace/EditSpaceModal";
import { calculateVentilation } from "@/lib/ventilation-calc";


export const Route = createFileRoute("/zones")({
  head: () => ({
    meta: [
      { title: "Zones — Airflow" },
      { name: "description", content: "Master-detail zone management with live pressure balance and equipment assignment." },
    ],
  }),
  component: ZonesPage,
});

function ZonesPage() {
  const [query, setQuery] = useState("");
  const { spaces, zones, addZone, deleteZone, equipment, assignZoneToEquipment, removeZoneFromEquipment, setWorkspaceState, activeProjectId, isReadOnly } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/ventilation", activeProjectId);
  const isApprovedLocked = Boolean(activeProjectId) && calcReviewState?.status === "APPROVED";
  const calcEffectiveReadOnly = useCalculationEffectiveReadOnly("/ventilation", activeProjectId);
  const isEffectiveReadOnly = isReadOnly || isApprovedLocked || calcEffectiveReadOnly || (typeof window !== 'undefined' && (Boolean((window as any).__mep_is_readonly) || Boolean((window as any).__mep_approved_readonly)));
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [qtyPrompt, setQtyPrompt] = useState<{
    zoneId: string;
    equipId: string;
    stream: "FA" | "EA" | "Both";
    max: number;
    equipTag: string;
  } | null>(null);

  const [hasDefaulted, setHasDefaulted] = useState(false);
  useEffect(() => {
    if (!hasDefaulted && zones.length > 0 && !selectedId) {
      setSelectedId(zones[0].id);
      setHasDefaulted(true);
    }
  }, [zones, selectedId, hasDefaulted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isInput) return;

      if (e.key === "Escape") {
        setSelectedId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const zoneToDelete = zones.find((z) => z.id === selectedId);
        if (zoneToDelete) {
          e.preventDefault();
          confirm(`Are you sure you want to delete zone "${zoneToDelete.name}"?`).then((ok: any) => {
            if (ok) {
              deleteZone(selectedId);
              setSelectedId(null);
            }
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, zones, deleteZone]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return zones.filter((z) => !q || z.name.toLowerCase().includes(q) || z.building.toLowerCase().includes(q));
  }, [zones, query]);

  const zone = useMemo(() => zones.find((z) => z.id === selectedId), [zones, selectedId]);
  const zoneSpaces = useMemo(
    () => (zone ? spaces.filter((s) => s.zone === zone.id || s.zone === zone.name) : []),
    [spaces, zone],
  );

  const handleNewZone = () => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    const name = `Z-${String(zones.length + 1).padStart(3, "0")}`;
    const newZone: Zone = {
      id: `zone-${Date.now()}`,
      name,
      building: "Tower A",
      floor: "L01",
      spaceCount: 0,
      area: 0,
      freshAir: 0,
      extractAir: 0,
      pressure: 0,
      equipment: [],
      pressureType: "neutral",
    };
    addZone(newZone);
    setSelectedId(newZone.id);
  };

  return (
    <AppShell
      title="Zones"
      subtitle={`${zones.length} zones`}
      actions={<TBtn primary disabled={isEffectiveReadOnly || isApprovedLocked} title={isApprovedLocked ? "Calculation is Approved & Locked. Unlock to add zones." : undefined} onClick={handleNewZone}><Plus className="size-3.5" /> New Zone</TBtn>}
    >
      <div className="grid grid-cols-[360px_1fr] h-full">
        {/* Zone list */}
        <div className="border-r border-border flex flex-col min-h-0">
          <div className="px-3 h-10 border-b border-border flex items-center gap-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter zones…"
              className="flex-1 h-7 bg-transparent text-[12.5px] outline-none"
            />
            <span className="text-[11px] text-muted-foreground tabular">{filtered.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((z) => {
              const active = z.id === selectedId;
              const tone = z.pressureType === "positive" ? "text-success" : z.pressureType === "negative" ? "text-destructive" : "text-muted-foreground";
              return (
                <button
                  key={z.id}
                  onClick={() => setSelectedId(z.id)}
                  className={`w-full text-left px-3 py-2 border-b border-border/60 ${active ? "bg-row-selected border-l-2 border-l-primary" : "hover:bg-row-hover"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono font-medium text-[12.5px] flex items-center gap-1.5">
                      {z.name}
                      {!spaces.some(s => s.zone === z.name && s.pressure === "Positive") && (
                        <span title="There is no positive space in this zone (at least 1 positive space is required).">
                          <Flag className="size-3.5 text-warning" />
                        </span>
                      )}
                    </span>
                    <span className={`font-mono text-[11px] tabular ${tone}`}>{z.pressure > 0 ? "+" : ""}{z.pressure} L/s</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span>{z.building}</span>
                    <span>·</span>
                    <span>{z.spaceCount} spaces</span>
                    <span>·</span>
                    <span className="tabular">{z.area.toFixed(0)} m²</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col min-h-0">
          {zone ? (
            <>
              <div className="px-5 py-4 border-b border-border">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Zone</div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[18px] font-semibold tracking-tight font-mono">{zone.name}</h2>
                      {!spaces.some(s => s.zone === zone.name && s.pressure === "Positive") && (
                        <span title="There is no positive space in this zone (at least 1 positive space is required).">
                          <Flag className="size-4 text-warning cursor-help" />
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{zone.building} · {zone.floor}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider ${
                    zone.pressureType === "positive" ? "bg-success/10 text-success" :
                    zone.pressureType === "negative" ? "bg-destructive/10 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>{zone.pressureType} pressure</span>
                </div>

                <div className="grid grid-cols-5 gap-px bg-border mt-4 border border-border rounded overflow-hidden">
                  <Stat label="Spaces" value={zone.spaceCount} />
                  <Stat label="Area" value={`${zone.area.toFixed(0)}`} unit="m²" />
                  <Stat label="Fresh Air" value={zone.freshAir.toLocaleString()} unit="L/s" tone="primary" />
                  <Stat label="Extract Air" value={zone.extractAir.toLocaleString()} unit="L/s" tone="primary" />
                  <Stat label="Balance" value={`${zone.pressure > 0 ? "+" : ""}${zone.pressure}`} unit="L/s" tone={zone.pressureType === "neutral" ? undefined : zone.pressureType === "positive" ? "success" : "destructive"} />
                </div>
              </div>

              <div className="px-5 py-3 border-b border-border flex flex-col gap-2">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Assigned Equipment</div>
                <div className="flex gap-4 text-[12.5px]">
                  <div className="flex flex-col gap-1">
                    <label className="text-muted-foreground text-[11px] font-medium">Fresh Air (FA) Unit</label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={zone.faAssignment || ""}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (val) {
                            if (zone.faAssignment && zone.faAssignment !== val) {
                              const otherEq = equipment.find((eq) => eq.id === zone.faAssignment);
                              const newEq = equipment.find((eq) => eq.id === val);
                              const otherName = otherEq ? otherEq.tag : "another equipment";
                              const newName = newEq ? newEq.tag : "this equipment";
                              const ok = await confirm(
                                `Fresh Air is already assigned to equipment "${otherName}". Do you want to reassign it to "${newName}"?`,
                                {
                                  title: "Reassign Fresh Air Unit",
                                  confirmText: "Reassign",
                                  cancelText: "Cancel",
                                }
                              );
                              if (!ok) return;
                            }
                            const eqObj = equipment.find(item => item.id === val);
                            if (zone.multiplier && zone.multiplier > 1 && eqObj) {
                              setQtyPrompt({
                                zoneId: zone.id,
                                equipId: val,
                                stream: "FA",
                                max: zone.multiplier,
                                equipTag: eqObj.tag,
                              });
                            } else {
                              assignZoneToEquipment(zone.id, val, "FA", 1);
                            }
                          } else if (zone.faAssignment) {
                            removeZoneFromEquipment(zone.id, zone.faAssignment, "FA");
                          }
                        }}
                        className="bg-surface-2 border border-border rounded px-2 py-1 text-xs outline-none w-48 text-foreground font-medium"
                      >
                        <option value="">-- No Assignment --</option>
                        {equipment
                          .filter(e => e.type === "MAHU" || e.type === "Air Handling Unit" || (e.type === "FAHU" && (e.mode === "Fresh Air Only" || e.mode === "Fresh Air + Extract Air")))
                          .map(eq => (
                            <option key={eq.id} value={eq.id}>{eq.tag} ({eq.type})</option>
                          ))}
                      </select>
                      {zone.faAssignment && (zone.multiplier || 1) > 1 && (
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className="text-[10px] text-muted-foreground">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            max={zone.multiplier || 1}
                            value={zone.faAssignedQty || 1}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(zone.multiplier || 1, parseInt(e.target.value) || 1));
                              const nextZones = zones.map(z => z.id === zone.id ? { ...z, faAssignedQty: val } : z);
                              setWorkspaceState({ spaces, zones: nextZones, equipment });
                            }}
                            className="w-10 bg-background border border-border rounded px-1 py-0.5 text-[11px] text-center outline-none text-foreground font-semibold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-muted-foreground text-[11px] font-medium">Extract Air (EA) Unit</label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={zone.eaAssignment || ""}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (val) {
                            if (zone.eaAssignment && zone.eaAssignment !== val) {
                              const otherEq = equipment.find((eq) => eq.id === zone.eaAssignment);
                              const newEq = equipment.find((eq) => eq.id === val);
                              const otherName = otherEq ? otherEq.tag : "another equipment";
                              const newName = newEq ? newEq.tag : "this equipment";
                              const ok = await confirm(
                                `Extract Air is already assigned to equipment "${otherName}". Do you want to reassign it to "${newName}"?`,
                                {
                                  title: "Reassign Extract Air Unit",
                                  confirmText: "Reassign",
                                  cancelText: "Cancel",
                                }
                              );
                              if (!ok) return;
                            }
                            const eqObj = equipment.find(item => item.id === val);
                            if (zone.multiplier && zone.multiplier > 1 && eqObj) {
                              setQtyPrompt({
                                zoneId: zone.id,
                                equipId: val,
                                stream: "EA",
                                max: zone.multiplier,
                                equipTag: eqObj.tag,
                              });
                            } else {
                              assignZoneToEquipment(zone.id, val, "EA", 1);
                            }
                          } else if (zone.eaAssignment) {
                            removeZoneFromEquipment(zone.id, zone.eaAssignment, "EA");
                          }
                        }}
                        className="bg-surface-2 border border-border rounded px-2 py-1 text-xs outline-none w-48 text-foreground font-medium"
                      >
                        <option value="">-- No Assignment --</option>
                        {equipment
                          .filter(e => e.type === "Ecology" || (e.type === "FAHU" && (e.mode === "Extract Air Only" || e.mode === "Fresh Air + Extract Air")))
                          .map(eq => (
                            <option key={eq.id} value={eq.id}>{eq.tag} ({eq.type})</option>
                          ))}
                      </select>
                      {zone.eaAssignment && (zone.multiplier || 1) > 1 && (
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className="text-[10px] text-muted-foreground">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            max={zone.multiplier || 1}
                            value={zone.eaAssignedQty || 1}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(zone.multiplier || 1, parseInt(e.target.value) || 1));
                              const nextZones = zones.map(z => z.id === zone.id ? { ...z, eaAssignedQty: val } : z);
                              setWorkspaceState({ spaces, zones: nextZones, equipment });
                            }}
                            className="w-10 bg-background border border-border rounded px-1 py-0.5 text-[11px] text-center outline-none text-foreground font-semibold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-5 h-9 flex items-center border-b border-border bg-header-bg">
                  <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Spaces in zone · {zoneSpaces.length}</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-[12.5px]">
                    <thead className="bg-header-bg sticky top-0 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left font-semibold px-5 py-2">ID</th>
                        <th className="text-left font-semibold px-2 py-2">Name</th>
                        <th className="text-left font-semibold px-2 py-2">Category</th>
                        <th className="text-right font-semibold px-2 py-2">Area</th>
                        <th className="text-right font-semibold px-2 py-2">Fresh Given</th>
                        <th className="text-right font-semibold px-2 py-2">Extract Taken</th>
                        <th className="text-right font-semibold px-5 py-2">ΔP Balance</th>
                        <th className="text-center font-semibold px-2 py-2 w-10">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zoneSpaces.map((s) => {
                        const spaceBalance = (s.freshAir || 0) - (s.extractAir || 0);
                        return (
                          <tr 
                            key={s.id} 
                            onDoubleClick={() => setEditingSpace(s)}
                            className="border-b border-border/60 hover:bg-row-hover cursor-pointer select-none"
                          >
                            <td 
                              className="px-5 py-1.5 font-mono text-primary/95 font-semibold hover:underline cursor-pointer text-[12px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSpace(s);
                              }}
                            >
                              {s.code}
                            </td>
                            <td className="px-2 py-1.5 font-medium">{s.name}</td>
                            <td className="px-2 py-1.5 text-muted-foreground text-xs truncate max-w-[150px]" title={s.category}>{s.category}</td>
                            <td className="px-2 py-1.5 text-right font-mono tabular">{s.area.toFixed(1)}</td>
                            <td className="px-2 py-1.5 text-right font-mono tabular">{s.freshAir.toLocaleString()} L/s</td>
                            <td className="px-2 py-1.5 text-right font-mono tabular">{s.extractAir.toLocaleString()} L/s</td>
                            <td className="px-5 py-1.5 text-right font-mono tabular">{spaceBalance > 0 ? "+" : ""}{spaceBalance.toFixed(0)} L/s</td>
                            <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setEditingSpace(s)}
                                title="Edit Space Parameters"
                                className="p-1 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              >
                                <Edit3 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="grid place-items-center h-full text-muted-foreground text-[13px]">Select a zone</div>
          )}
        </div>
      </div>

      {qtyPrompt && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-lg w-full max-w-sm animate-scale-in">
            <header className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-[13px] uppercase tracking-wider text-muted-foreground">Assign Zone Instances</h3>
            </header>
            <div className="p-4 flex flex-col gap-3 text-[12px]">
              <p className="text-muted-foreground leading-relaxed">
                How many instances of zone <strong>{zones.find(z => z.id === qtyPrompt.zoneId)?.name}</strong> do you want to assign to <strong>{qtyPrompt.equipTag}</strong>?
              </p>
              <input
                type="number"
                min={1}
                max={qtyPrompt.max}
                defaultValue={qtyPrompt.max}
                id="qty-prompt-input-zones"
                className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none text-foreground font-mono text-center font-bold text-[14px]"
                autoFocus
              />
              <span className="text-[10px] text-muted-foreground text-center">Available instances: 1 to {qtyPrompt.max}</span>
            </div>
            <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg rounded-b-2xl">
              <button 
                onClick={() => setQtyPrompt(null)} 
                className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const el = document.getElementById("qty-prompt-input-zones") as HTMLInputElement;
                  const val = Math.max(1, Math.min(qtyPrompt.max, parseInt(el?.value) || 1));
                  
                  if (qtyPrompt.stream === "Both") {
                    assignZoneToEquipment(qtyPrompt.zoneId, qtyPrompt.equipId, "FA", val);
                    assignZoneToEquipment(qtyPrompt.zoneId, qtyPrompt.equipId, "EA", val);
                  } else {
                    assignZoneToEquipment(qtyPrompt.zoneId, qtyPrompt.equipId, qtyPrompt.stream, val);
                  }
                  setQtyPrompt(null);
                }} 
                className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 cursor-pointer"
              >
                Confirm
              </button>
            </footer>
          </div>
        </div>
      )}
      {editingSpace && (
        <EditSpaceModal
          space={editingSpace}
          onClose={() => setEditingSpace(null)}
          onSave={(updated) => {
            // 1. Check if zone is a new zone name
            let nextZones = [...zones];
            if (updated.zone && updated.zone !== "") {
              const zoneExists = zones.some(
                (z) => z.id.toLowerCase() === updated.zone.toLowerCase() || z.name.toLowerCase() === updated.zone.toLowerCase()
              );
              if (!zoneExists) {
                const zoneId = `zone-${Date.now()}`;
                const newZone = {
                  id: zoneId,
                  name: updated.zone,
                  building: updated.building || "Tower A",
                  floor: updated.floor || "L01",
                  spaceCount: 0,
                  area: 0,
                  freshAir: 0,
                  extractAir: 0,
                  pressure: 0,
                  equipment: [],
                  pressureType: "neutral" as const,
                  faAssignment: null,
                  eaAssignment: null,
                };
                nextZones.push(newZone);
              }
            }

            // 2. Check if equipment is a new equipment tag
            let nextEquipment = [...equipment];
            if (updated.equipment && updated.equipment !== "") {
              const equipExists = equipment.some(
                (eq) => eq.id.toLowerCase() === updated.equipment.toLowerCase() || eq.tag.toLowerCase() === updated.equipment.toLowerCase()
              );
              if (!equipExists) {
                const equipId = `equip-${Date.now()}`;
                const newEquip = {
                  id: equipId,
                  tag: updated.equipment,
                  type: "Air Handling Unit",
                  zones: 0,
                  spaces: 0,
                  totalAirflow: 0,
                  capacity: 2000,
                  utilization: 0,
                  status: "design" as const,
                  mode: "Fresh Air + Extract Air" as const,
                  zoneIds: [],
                };
                nextEquipment.push(newEquip);
              }
            }

            // 3. Prepare updated spaces list
            let nextSpaces = spaces.map((s) => s.id === updated.id ? updated : s);

            // 4. Multiplier expansion: if updated.multiplier > 1, create clones!
            const mult = parseInt(String(updated.multiplier)) || 1;
            if (mult > 1) {
              const originalUpdated = { ...updated, multiplier: 1 };
              nextSpaces = nextSpaces.map((s) => s.id === updated.id ? originalUpdated : s);
              
              const clones: Space[] = [];
              for (let i = 1; i < mult; i++) {
                const nextNum = Math.floor(Math.random() * 1000);
                clones.push({
                  ...updated,
                  id: `sp-${Date.now()}-${i}-${nextNum}`,
                  code: `${updated.code}-${i}`,
                  name: `${updated.name}-${i}`,
                  multiplier: 1,
                });
              }
              nextSpaces.push(...clones);
            }

            // 5. Balance ventilation airflows and commit state in a single operation
            const balanced = calculateVentilation(nextSpaces, nextZones, nextEquipment);
            setWorkspaceState({
              spaces: balanced.spaces,
              zones: balanced.zones,
              equipment: balanced.equipment,
            });

            setEditingSpace(null);
          }}
          availableZones={zones.map(z => z.name)}
          availableEquipment={equipment.map(e => e.tag)}
          availableFloors={Array.from(new Set(spaces.map((s) => s.floor).filter(Boolean)))}
        />
      )}
    </AppShell>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: React.ReactNode; unit?: string; tone?: "primary" | "success" | "destructive" }) {
  const color = tone === "primary" ? "text-foreground" : tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${color}`}>
        <span className="font-mono tabular text-[16px] font-semibold">{value}</span>
        {unit && <span className="text-[11px] text-muted-foreground ml-1">{unit}</span>}
      </div>
    </div>
  );
}