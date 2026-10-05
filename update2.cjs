const fs = require('fs');
const p = 'frontend/src/routes/ventilation.tsx';
let c = fs.readFileSync(p, 'utf8');

const target = `  const setAssignZoneEquipOpen = (open: boolean) => {
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

const repl = `  const setAssignZoneEquipOpen = (open: boolean) => {
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

if (c.includes(target)) {
  fs.writeFileSync(p, c.replace(target, repl));
  console.log('Successfully replaced!');
} else {
  console.log('Target not found!!');
}
