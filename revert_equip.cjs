const fs = require('fs');
const p = 'frontend/src/components/workspace/SharedAssignmentModal.tsx';
let lines = fs.readFileSync(p, 'utf8').split('\n');

const promptIdx = lines.findIndex(l => l.includes('import { usePrompt } from "@/hooks/use-confirm";'));
if (promptIdx !== -1) {
  lines.splice(promptIdx, 1);
}

const startHas = lines.findIndex(l => l.includes('const hasUnsavedChanges = useMemo(() => {'));
if (startHas !== -1) {
  const endHas = lines.findIndex((l, i) => i > startHas && l.includes('}, [selectedEquipId, selectedInstances, equipment]);'));
  if (endHas !== -1) {
    lines.splice(startHas, endHas - startHas + 1);
  }
}

const startApply = lines.findIndex(l => l.includes('const applyChanges = (equipIdToSave: string, instancesToSave: Set<string>) => {'));
if (startApply !== -1) {
  let endApply = -1;
  for (let i = startApply + 1; i < lines.length; i++) {
    if (lines[i].trim() === '};' && lines[i-1].includes('});') && lines[i-2].includes('equipment: balanced.equipment,')) {
      endApply = i;
      break;
    }
  }
  if (endApply !== -1) {
    lines.splice(startApply, endApply - startApply + 1);
  }
}

const startHandle = lines.findIndex(l => l.includes('const handleEquipSelect = (eqId: string) => {'));
if (startHandle !== -1) {
  lines[startHandle + 1] = '    setSelectedEquipId(eqId);';
  lines[startHandle + 2] = '    const eq = equipment.find((e) => e.id === eqId);';
  lines[startHandle + 3] = '    if (!eq) return;';
  lines[startHandle + 4] = '    setSelectedInstances(getAssignedInstancesForEquip(eq));';
  lines[startHandle + 5] = '  };';
  
  // Find the old end of handleEquipSelect to remove leftover lines
  let endHandle = -1;
  for (let i = startHandle + 6; i < lines.length; i++) {
    if (lines[i].trim() === '};') {
      endHandle = i;
      break;
    }
  }
  if (endHandle !== -1) {
    lines.splice(startHandle + 6, endHandle - (startHandle + 6) + 1);
  }
}

fs.writeFileSync(p, lines.join('\n'));
console.log('Reverted SharedAssignmentModal changes');
