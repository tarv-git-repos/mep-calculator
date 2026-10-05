const fs = require('fs');
const p = 'frontend/src/components/workspace/SharedAssignmentModal.tsx';
let lines = fs.readFileSync(p, 'utf8').split('\n');

const repl1 = `  const hasUnsavedChanges = useMemo(() => {
    if (!selectedEquipId) return false;
    const eq = equipment.find((e) => e.id === selectedEquipId);
    if (!eq) return false;
    const saved = getAssignedInstancesForEquip(eq);
    if (saved.size !== selectedInstances.size) return true;
    for (const inst of selectedInstances) {
      if (!saved.has(inst)) return true;
    }
    return false;
  }, [selectedEquipId, selectedInstances, equipment]);

  const applyChanges = (equipIdToSave: string, instancesToSave: Set<string>) => {
    const equip = equipment.find((e) => e.id === equipIdToSave);
    if (!equip) return;
    const mode = getEquipVentMode(equip);
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
        const key = \`\${zone.id}_\${instIdx}\`;
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

        const isSelected = instancesToSave.has(key);
        let faId = inst.faEquipId;
        let eaId = inst.eaEquipId;

        if (isSelected) {
          if (mode === "Fresh Air Only") {
            faId = equip.id;
          } else if (mode === "Exhaust Air Only") {
            eaId = equip.id;
          } else if (mode === "Fresh + Exhaust") {
            faId = equip.id;
            eaId = equip.id;
          }
        } else {
          if (mode === "Fresh Air Only" && inst.faEquipId === equip.id) {
            faId = null;
          } else if (mode === "Exhaust Air Only" && inst.eaEquipId === equip.id) {
            eaId = null;
          } else if (mode === "Fresh + Exhaust") {
            if (inst.faEquipId === equip.id) faId = null;
            if (inst.eaEquipId === equip.id) eaId = null;
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
  };

  // Handle equipment selection
  const handleEquipSelect = (eqId: string) => {
    if (hasUnsavedChanges && selectedEquipId) {
      if (window.confirm("You have unsaved assignments for the current equipment. Would you like to apply them before switching?")) {
        applyChanges(selectedEquipId, selectedInstances);
      }
    }
    setSelectedEquipId(eqId);
    const eq = equipment.find((e) => e.id === eqId);
    if (!eq) return;
    setSelectedInstances(getAssignedInstancesForEquip(eq));
  };`;

const match = lines.findIndex(l => l.includes('const handleEquipSelect ='));
if (match !== -1) {
  lines.splice(match - 1, 7, repl1);
  fs.writeFileSync(p, lines.join('\n'));
  console.log('Successfully injected auto-apply!');
} else {
  console.log('match not found!');
}
