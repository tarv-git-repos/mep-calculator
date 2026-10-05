const fs = require('fs');
const tsxPath = 'frontend/src/routes/ventilation.tsx';
let lines = fs.readFileSync(tsxPath, 'utf8').split('\n');

const newZoneBtnIdx = lines.findIndex(l => l.includes('<Plus className="size-3.5" /> New Zone'));
if (newZoneBtnIdx !== -1) {
  const insertLines = [
    '          <TBtn',
    '            disabled={isEffectiveReadOnly}',
    '            onClick={() => {',
    '              if (selectedZones.size === 0) {',
    '                toast.error("Please select at least one zone from the table first.");',
    '                return;',
    '              }',
    '              setAssignZoneEquipOpen(true);',
    '            }}',
    '          >',
    '            <Plus className="size-3.5" /> Assign Equipment',
    '          </TBtn>'
  ];
  
  let searchPos = newZoneBtnIdx;
  while(searchPos > 0 && !lines[searchPos].includes('<TBtn')) {
    searchPos--;
  }
  
  lines.splice(searchPos, 0, ...insertLines);
  fs.writeFileSync(tsxPath, lines.join('\n'));
  console.log('Added Assign Equipment button next to New Zone button in ventilation.tsx');
} else {
  console.log('Could not find New Zone button');
}
