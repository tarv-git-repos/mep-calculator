import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Download, Edit3, Trash2, X, AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace, type Equipment } from "@/lib/workspace-store";
import { useConfirm } from "@/hooks/use-confirm";


export const Route = createFileRoute("/equipment")({
  head: () => ({
    meta: [
      { title: "Equipment — Airflow" },
      { name: "description", content: "Manage HVAC equipment assignments, capacity utilization, and zone coverage." },
    ],
  }),
  component: EquipmentPage,
});

function EquipmentPage() {
  const {
    spaces,
    zones,
    equipment,
    addEquipment,
    deleteEquipment,
    assignZoneToEquipment,
    removeZoneFromEquipment,
    updateZoneInstances,
  } = useWorkspace();

  const confirm = useConfirm();

  const [newEquipOpen, setNewEquipOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState<Equipment | null>(null);

  const handleAssignInstance = (zoneId: string, instanceIndex: number, stream: "FA" | "EA", equipId: string | null) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    const mult = zone.multiplier || 1;
    const instances = [...(zone.instances || [])];
    
    // Ensure all instances are filled
    for (let idx = 0; idx < mult; idx++) {
      if (!instances[idx]) {
        // Inherit legacy zone-level assignments as default
        instances[idx] = {
          instanceIndex: idx + 1,
          faEquipId: idx === 0 ? (zone.faAssignment ?? null) : null,
          eaEquipId: idx === 0 ? (zone.eaAssignment ?? null) : null,
        };
      }
    }

    const instIdx = instanceIndex - 1;
    if (stream === "FA") {
      instances[instIdx].faEquipId = equipId;
    } else {
      instances[instIdx].eaEquipId = equipId;
    }

    updateZoneInstances(zoneId, instances);
  };

  const [newEquipValues, setNewEquipValues] = useState({
    tag: "",
    type: "MAHU",
    mode: "Fresh Air Only",
    capacity: 2500,
  });

  const handleNewEquipmentApply = () => {
    if (!newEquipValues.tag.trim()) {
      alert("Please enter an equipment tag!");
      return;
    }
    if (equipment.some(e => e.tag.toLowerCase() === newEquipValues.tag.trim().toLowerCase())) {
      alert("An equipment with this tag already exists!");
      return;
    }

    const newUnit: Equipment = {
      id: `equip-${Date.now()}`,
      tag: newEquipValues.tag.trim(),
      type: newEquipValues.type,
      zones: 0,
      spaces: 0,
      totalAirflow: 0,
      capacity: newEquipValues.capacity || 2000,
      utilization: 0,
      status: "design",
      mode: newEquipValues.type === "FAHU" ? (newEquipValues.mode as any) : undefined,
      zoneIds: [],
      totalFA: 0,
      totalEA: 0,
    };

    addEquipment(newUnit);
    setNewEquipOpen(false);
    setNewEquipValues({ tag: "", type: "MAHU", mode: "Fresh Air Only", capacity: 2500 });
  };

  const actions = (
    <>
      <TBtn><Download className="size-3.5" /> Export</TBtn>
      <TBtn primary onClick={() => setNewEquipOpen(true)}><Plus className="size-3.5" /> New Equipment</TBtn>
    </>
  );

  return (
    <AppShell title="Equipment" subtitle={`${equipment.length} units`} actions={actions}>
      <div className="h-full overflow-auto p-4">
        <div className="bg-background border border-border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-[12.5px] border-collapse">
            <thead className="bg-header-bg sticky top-0 border-b border-border z-10 font-semibold text-muted-foreground">
              <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <Th>Tag</Th>
                <Th>Type & Mode</Th>
                <Th align="right">Zones</Th>
                <Th align="right">Spaces</Th>
                <Th align="right">Fresh Load (L/s)</Th>
                <Th align="right">Extract Load (L/s)</Th>
                <Th align="right">Total Airflow (L/s)</Th>
                <Th align="right">Capacity (L/s)</Th>
                <Th>Utilization</Th>
                <Th>Status</Th>
                <Th align="center">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {equipment.map((e) => {
                const fresh = e.totalFA || 0;
                const extract = e.totalEA || 0;
                const totalFlow = e.totalAirflow || 0;

                // Build a list of assigned zone names
                const assignedZoneNames = zones
                  .filter((z) => z.faAssignment === e.id || z.eaAssignment === e.id)
                  .map((z) => z.name)
                  .join(", ");

                return (
                  <tr key={e.id} className="hover:bg-row-hover transition-colors">
                    <td className="px-4 py-2 font-mono font-medium">
                      <div className="flex flex-col">
                        <span className="text-foreground">{e.tag}</span>
                        {assignedZoneNames && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={assignedZoneNames}>
                            Zones: {assignedZoneNames}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      <div className="flex flex-col">
                        <span>{e.type}</span>
                        {e.mode && <span className="text-[10px] text-primary">{e.mode}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular">{e.zones}</td>
                    <td className="px-4 py-2 text-right font-mono tabular">{e.spaces}</td>
                    <td className="px-4 py-2 text-right font-mono tabular text-primary">{fresh.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono tabular text-pink-600">{extract.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono tabular font-medium">{totalFlow.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono tabular text-muted-foreground">{e.capacity.toLocaleString()}</td>
                    <td className="px-4 py-2 w-[220px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div className={`h-full ${e.utilization > 92 ? "bg-warning" : e.utilization > 70 ? "bg-primary" : "bg-success"}`} style={{ width: `${e.utilization}%` }} />
                        </div>
                        <span className="font-mono tabular text-[11.5px] w-9 text-right">{e.utilization}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider ${
                        e.status === "operational" ? "bg-success/10 text-success" :
                        e.status === "warning" ? "bg-warning/15 text-warning" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        <span className="size-1 rounded-full bg-current" />{e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingEquip(e)}
                          className="hover:text-foreground p-1 rounded hover:bg-surface-2 transition-colors text-muted-foreground"
                          title="Assign zones & edit capacity"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirm(`Are you sure you want to delete ${e.tag}? All zone stream assignments to it will be cleared.`)) {
                              deleteEquipment(e.id);
                            }
                          }}
                          className="hover:text-destructive p-1 rounded hover:bg-surface-2 transition-colors text-muted-foreground"
                          title="Delete equipment"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Equipment Dialog */}
      {newEquipOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-sm animate-scale-in">
            <header className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-[14px]">Create Equipment Unit</h3>
              <button onClick={() => setNewEquipOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </header>
            <div className="p-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Equipment Tag</label>
                <input
                  type="text"
                  placeholder="e.g. MAHU-01 or Ecology-02"
                  value={newEquipValues.tag}
                  onChange={(e) => {
                    const tagVal = e.target.value;
                    const normalized = tagVal.toUpperCase();
                    let detectedType = newEquipValues.type;
                    if (normalized.includes("FAHU")) {
                      detectedType = "FAHU";
                    } else if (normalized.includes("EAHU") || normalized.includes("ECOLOGY") || normalized.startsWith("EA")) {
                      detectedType = "Ecology";
                    } else if (normalized.includes("MAHU") || normalized.startsWith("MA")) {
                      detectedType = "MAHU";
                    }
                    setNewEquipValues({ ...newEquipValues, tag: tagVal, type: detectedType });
                  }}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Equipment Type</label>
                <select
                  value={newEquipValues.type}
                  onChange={(e) => setNewEquipValues({ ...newEquipValues, type: e.target.value })}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                >
                  <option value="MAHU">MAHU (Fresh Air Only)</option>
                  <option value="Ecology">Ecology Unit (Extract Air Only)</option>
                  <option value="FAHU">FAHU (Multi-stream Ventilation)</option>
                </select>
              </div>

              {newEquipValues.type === "FAHU" && (
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">FAHU Ventilation Mode</label>
                  <select
                    value={newEquipValues.mode}
                    onChange={(e) => setNewEquipValues({ ...newEquipValues, mode: e.target.value })}
                    className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                  >
                    <option value="Fresh Air Only">Fresh Air Only</option>
                    <option value="Extract Air Only">Extract Air Only</option>
                    <option value="Fresh Air + Extract Air">Fresh Air + Extract Air</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Capacity (L/s)</label>
                <input
                  type="number"
                  placeholder="Capacity L/s"
                  value={newEquipValues.capacity}
                  onChange={(e) => setNewEquipValues({ ...newEquipValues, capacity: parseInt(e.target.value) || 0 })}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none"
                />
              </div>
            </div>
            <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
              <button onClick={() => setNewEquipOpen(false)} className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2">
                Cancel
              </button>
              <button onClick={handleNewEquipmentApply} className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95">
                Create Equipment
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Edit Equipment assignments modal */}
      {editingEquip && (
        <EditEquipmentModal
          equip={editingEquip}
          zones={zones}
          equipment={equipment}
          onClose={() => setEditingEquip(null)}
          onAssignInstance={handleAssignInstance}
        />
      )}
    </AppShell>
  );
}

interface EditModalProps {
  equip: Equipment;
  zones: any[];
  equipment: Equipment[];
  onClose: () => void;
  onAssignInstance: (zoneId: string, instanceIndex: number, stream: "FA" | "EA", equipId: string | null) => void;
}

function EditEquipmentModal({ equip, zones, equipment, onClose, onAssignInstance }: EditModalProps) {
  // Flatten all zones into zone instances (Zone Name repeated Multiplier times)
  const zoneInstances = useMemo(() => {
    const list: {
      id: string; // zone ID
      name: string; // zone name
      instanceIndex: number;
      multiplier: number;
      floor: string;
      faEquipId: string | null;
      eaEquipId: string | null;
    }[] = [];

    zones.forEach((z) => {
      const mult = z.multiplier || 1;
      for (let i = 1; i <= mult; i++) {
        const inst = z.instances?.find((ins: any) => ins.instanceIndex === i);
        
        let faEquipId = null;
        let eaEquipId = null;

        if (z.instances && z.instances.length > 0) {
          faEquipId = inst?.faEquipId ?? null;
          eaEquipId = inst?.eaEquipId ?? null;
        } else {
          // Fallback to legacy assignments for the first instance
          if (i === 1) {
            faEquipId = z.faAssignment ?? null;
            eaEquipId = z.eaAssignment ?? null;
          }
        }

        list.push({
          id: z.id,
          name: z.name,
          instanceIndex: i,
          multiplier: mult,
          floor: z.floor || "L01",
          faEquipId,
          eaEquipId,
        });
      }
    });

    return list;
  }, [zones]);

  // Assigned instances: where this equipment is assigned to at least one stream
  const assignedInstances = useMemo(() => {
    return zoneInstances.filter(zi => zi.faEquipId === equip.id || zi.eaEquipId === equip.id);
  }, [zoneInstances, equip.id]);

  // Available instances: where this equipment is NOT fully assigned to both streams
  const availableInstances = useMemo(() => {
    return zoneInstances.filter(zi => zi.faEquipId !== equip.id || zi.eaEquipId !== equip.id);
  }, [zoneInstances, equip.id]);

  const canFresh = equip.type === "MAHU" || equip.type === "Air Handling Unit" || (equip.type === "FAHU" && (equip.mode === "Fresh Air Only" || equip.mode === "Fresh Air + Extract Air"));
  const canExtract = equip.type === "Ecology" || (equip.type === "FAHU" && (equip.mode === "Extract Air Only" || equip.mode === "Fresh Air + Extract Air"));

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[85vh] flex flex-col animate-scale-in">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h3 className="font-semibold text-[14px]">Edit Equipment assignments: {equip.tag}</h3>
            <span className="text-[10px] text-muted-foreground uppercase bg-surface-2 px-1.5 py-0.5 rounded border border-border font-semibold">
              Type: {equip.type} {equip.mode ? `(${equip.mode})` : ""}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </header>

        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 gap-4 text-xs">
          {/* Left panel: Assigned Zones */}
          <div className="flex flex-col gap-2 min-h-0 border border-border rounded-lg p-3 bg-surface-1">
            <h4 className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider mb-1 flex items-center justify-between">
              <span>Assigned Zone Instances</span>
              <span className="bg-accent text-accent-foreground px-1.5 py-0.2 rounded-full font-mono">{assignedInstances.length}</span>
            </h4>
            <div className="overflow-y-auto flex-1 flex flex-col gap-1.5 max-h-[45vh]">
              {assignedInstances.map((zi, idx) => {
                const assignedStreams: string[] = [];
                if (zi.faEquipId === equip.id) assignedStreams.push("Fresh Air");
                if (zi.eaEquipId === equip.id) assignedStreams.push("Extract Air");

                return (
                  <div key={`${zi.id}-${zi.instanceIndex}-${idx}`} className="bg-background border border-border p-2 rounded flex items-center justify-between hover:bg-surface-2 transition-colors">
                    <div>
                      <div className="font-semibold font-mono text-[12px] text-foreground">
                        {zi.name} <span className="text-[10px] text-muted-foreground font-sans">(Instance {zi.instanceIndex}/{zi.multiplier})</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Floor: {zi.floor} · Streams: {assignedStreams.join(" + ")}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {zi.faEquipId === equip.id && (
                        <button
                          onClick={() => onAssignInstance(zi.id, zi.instanceIndex, "FA", null)}
                          className="px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors text-[10px]"
                        >
                          Remove FA
                        </button>
                      )}
                      {zi.eaEquipId === equip.id && (
                        <button
                          onClick={() => onAssignInstance(zi.id, zi.instanceIndex, "EA", null)}
                          className="px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors text-[10px]"
                        >
                          Remove EA
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {assignedInstances.length === 0 && (
                <div className="text-center text-muted-foreground italic py-10">No zone instances assigned to this equipment unit yet.</div>
              )}
            </div>
          </div>

          {/* Right panel: Available Zones */}
          <div className="flex flex-col gap-2 min-h-0 border border-border rounded-lg p-3 bg-surface-1">
            <h4 className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider mb-1">
              Available Zone Instances ({availableInstances.length})
            </h4>
            <div className="overflow-y-auto flex-1 flex flex-col gap-1.5 max-h-[45vh]">
              {availableInstances.map((zi, idx) => {
                const otherFA = zi.faEquipId ? (equipment.find(e => e.id === zi.faEquipId)?.tag || "Other") : null;
                const otherEA = zi.eaEquipId ? (equipment.find(e => e.id === zi.eaEquipId)?.tag || "Other") : null;

                return (
                  <div key={`${zi.id}-${zi.instanceIndex}-${idx}`} className="bg-background border border-border p-2 rounded flex items-center justify-between hover:bg-surface-2 transition-colors">
                    <div>
                      <div className="font-semibold font-mono text-[12px] text-foreground">
                        {zi.name} <span className="text-[10px] text-muted-foreground font-sans">(Instance {zi.instanceIndex}/{zi.multiplier})</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Floor: {zi.floor}
                        {otherFA && ` · FA linked (${otherFA})`}
                        {otherEA && ` · EA linked (${otherEA})`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canFresh && zi.faEquipId !== equip.id && (
                        <button
                          onClick={() => onAssignInstance(zi.id, zi.instanceIndex, "FA", equip.id)}
                          className="px-2 py-0.5 rounded bg-green-100 hover:bg-green-200 text-green-700 font-medium transition-colors text-[10px]"
                        >
                          Add FA
                        </button>
                      )}
                      {canExtract && zi.eaEquipId !== equip.id && (
                        <button
                          onClick={() => onAssignInstance(zi.id, zi.instanceIndex, "EA", equip.id)}
                          className="px-2 py-0.5 rounded bg-green-100 hover:bg-green-200 text-green-700 font-medium transition-colors text-[10px]"
                        >
                          Add EA
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {availableInstances.length === 0 && (
                <div className="text-center text-muted-foreground italic py-10">No available zone instances in this project.</div>
              )}
            </div>
          </div>
        </div>

        <footer className="px-4 py-3 border-t border-border flex items-center justify-end bg-header-bg">
          <button onClick={onClose} className="bg-primary text-primary-foreground font-semibold px-4 py-1.5 rounded hover:bg-primary/95 transition-colors">
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" | "center" }) {
  const alignment = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return <th className={`px-4 py-2 font-semibold ${alignment}`}>{children}</th>;
}