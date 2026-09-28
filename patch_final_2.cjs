const fs = require('fs');
const path = require('path');

// 1. plumbing-drainage.tsx
const pDrainage = path.join(__dirname, 'frontend/src/routes/plumbing-drainage.tsx');
let cDrain = fs.readFileSync(pDrainage, 'utf8');

// remove duplicate useConfirm
const lines = cDrain.split('\n');
const filtered = [];
let seenUseConfirm = false;
for (const line of lines) {
  if (line.includes('import { useConfirm } from "@/hooks/use-confirm";')) {
    if (seenUseConfirm) continue;
    seenUseConfirm = true;
  }
  filtered.push(line);
}
cDrain = filtered.join('\n');

// fix line 704 & line 3422
cDrain = cDrain.replace(
  'if (updateProject && project) updateProject({ ...project, workspace_data: updatedWdata } as any);',
  'if (updateProject && project) updateProject({ ...project, workspace_data: { ...wdata, drainage_calc: dataToSave, drainage_pipe_calc: dataToSave } } as any);'
);

cDrain = cDrain.replace(
  'if (updateProject && project) updateProject({ ...project, workspace_data: { ...wdata, drainage_calc: dataToSave, drainage_pipe_calc: dataToSave } } as any);\n            }\n          } catch (e) {\n            console.error("Failed to update workspaceStore project comments", e);',
  'if (updateProject && project) updateProject({ ...project, workspace_data: updatedWdata } as any);\n            }\n          } catch (e) {\n            console.error("Failed to update workspaceStore project comments", e);'
);

fs.writeFileSync(pDrainage, cDrain, 'utf8');
console.log('Fixed plumbing-drainage.tsx');

// 2. ups-sizing-calculation.tsx
const pUps = path.join(__dirname, 'frontend/src/routes/ups-sizing-calculation.tsx');
let cUps = fs.readFileSync(pUps, 'utf8');
const oldBlock = `      setLoadRows((prev) =>
        prev.map((r) => ({
          ...r,
          equipmentLoad:
            target === "ip"
              ? Math.round((r.equipmentLoad || 0) / pf)
              : Math.round((r.equipmentLoad || 0) * pf)
        }))
      );`;

const newBlock = `      setLoadRows(
        loadRows.map((r: LoadRow) => ({
          ...r,
          equipmentLoad:
            target === "ip"
              ? Math.round((r.equipmentLoad || 0) / pf)
              : Math.round((r.equipmentLoad || 0) * pf)
        }))
      );`;

cUps = cUps.replace(oldBlock.replace(/\r?\n/g, '\r\n'), newBlock.replace(/\r?\n/g, '\r\n'));
cUps = cUps.replace(oldBlock.replace(/\r?\n/g, '\n'), newBlock.replace(/\r?\n/g, '\n'));

fs.writeFileSync(pUps, cUps, 'utf8');
console.log('Fixed ups-sizing-calculation.tsx');
