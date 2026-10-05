const fs = require('fs');
const tsxPath = 'frontend/src/routes/ventilation.tsx';
let content = fs.readFileSync(tsxPath, 'utf8');

// 1. Update setAssignZoneEquipOpen
const oldSetAssign = `  const setAssignZoneEquipOpen = (open: boolean) => {
    if (open) {
      console.log("setAssignZoneEquipOpen: selectedZones=", Array.from(selectedZones));
      if (selectedZones.size > 1) {
        setAllocZoneId(null);
        setZoneAllocOpen(true);
      } else {
        const zid = Array.from(selectedZones)[0] ?? null;
        console.log("setAssignZoneEquipOpen single zid=", zid);
        if (zid) { setAllocZoneId(zid); setZoneAllocOpen(true); }
      }
    } else { setZoneAllocOpen(false); }
  };`;

const newSetAssign = `  const setAssignZoneEquipOpen = (open: boolean) => {
    if (open) {
      console.log("setAssignZoneEquipOpen: selectedZones=", Array.from(selectedZones));
      if (selectedZones.size > 1) {
        setAllocZoneId(null);
        setZoneAllocOpen(true);
      } else {
        const zid = Array.from(selectedZones)[0] ?? null;
        console.log("setAssignZoneEquipOpen single zid=", zid);
        if (zid) { 
          setAllocZoneId(zid); 
          setZoneAllocOpen(true); 
        } else {
          setAllocZoneId(null);
          setZoneAllocOpen(true);
        }
      }
    } else { setZoneAllocOpen(false); }
  };`;

content = content.replace(oldSetAssign, newSetAssign);

// 2. Remove validation from button
const oldBtn = `          <TBtn
            disabled={isEffectiveReadOnly}
            onClick={() => {
              if (selectedZones.size === 0) {
                toast.error("Please select at least one zone from the table first.");
                return;
              }
              setAssignZoneEquipOpen(true);
            }}
          >
            <Plus className="size-3.5" /> Assign Equipment
          </TBtn>`;

const newBtn = `          <TBtn
            disabled={isEffectiveReadOnly}
            onClick={() => {
              setAssignZoneEquipOpen(true);
            }}
          >
            <Plus className="size-3.5" /> Assign Equipment
          </TBtn>`;

content = content.replace(oldBtn, newBtn);

fs.writeFileSync(tsxPath, content);
console.log('Fixed assign equipment logic');
