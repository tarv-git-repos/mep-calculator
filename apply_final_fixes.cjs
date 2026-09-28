const fs = require('fs');
const path = require('path');

// 1. condensate-drain-calc.tsx
const pCondensate = path.join(__dirname, 'frontend/src/routes/condensate-drain-calc.tsx');
let cCond = fs.readFileSync(pCondensate, 'utf8');

if (!cCond.includes('import { useAuth }')) {
  cCond = cCond.replace('import { useWorkspace }', 'import { useAuth } from "@/contexts/AuthContext";\nimport { useWorkspace }');
}
if (!cCond.includes('const { user, userData, profile } = useAuth();')) {
  cCond = cCond.replace(
    'const { project, forceSaveToCloud } = useWorkspace();',
    'const { project, forceSaveToCloud } = useWorkspace();\n  const { user, userData, profile } = useAuth();\n  const currentUserName = userData?.name || profile?.name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";'
  );
}
cCond = cCond.replace(
  'handleDuplicateCoil(isSelected && selected.size > 1 ? rows.filter(x => selected.has(x.id)) : r)',
  'handleDuplicateCoil(isSelected && selected.size > 1 ? rows.filter(x => selected.has(x.id)) : (r as any))'
);
fs.writeFileSync(pCondensate, cCond, 'utf8');
console.log('Fixed condensate-drain-calc.tsx');

// 2. plumbing-drainage.tsx
const pDrainage = path.join(__dirname, 'frontend/src/routes/plumbing-drainage.tsx');
let cDrain = fs.readFileSync(pDrainage, 'utf8');
// remove duplicate useConfirm
cDrain = cDrain.replace('import { useConfirm } from "@/hooks/use-confirm";\n', '');
// change NodeJS.Timeout to any
cDrain = cDrain.replace('useRef<NodeJS.Timeout | null>(null)', 'useRef<any>(null)');
// activeRoom
cDrain = cDrain.replace('const locationRoom = activeRoom?.name', 'const locationRoom = (project as any)?.activeRoom?.name || (project as any)?.location');
// line 3422 fix
cDrain = cDrain.replace(
  'if (updateProject && project) updateProject({ ...project, workspace_data: { ...wdata, drainage_calc: dataToSave, drainage_pipe_calc: dataToSave } } as any);',
  'if (updateProject && project) updateProject({ ...project, workspace_data: updatedWdata } as any);'
);
fs.writeFileSync(pDrainage, cDrain, 'utf8');
console.log('Fixed plumbing-drainage.tsx');

// 3. psychrometric.tsx
const pPsych = path.join(__dirname, 'frontend/src/routes/psychrometric.tsx');
let cPsych = fs.readFileSync(pPsych, 'utf8');
cPsych = cPsych.replace('useRef<NodeJS.Timeout | null>(null)', 'useRef<any>(null)');
fs.writeFileSync(pPsych, cPsych, 'utf8');
console.log('Fixed psychrometric.tsx');

// 4. ups-sizing-calculation.tsx
const pUps = path.join(__dirname, 'frontend/src/routes/ups-sizing-calculation.tsx');
let cUps = fs.readFileSync(pUps, 'utf8');
cUps = cUps.replace(
  /setLoadRows\(\(prev\s*:\s*any\)\s*=>\s*prev\.map\(\(r\s*:\s*any\)\s*=>\s*\(\{([\s\S]*?)\}\)\)\);/g,
  'setLoadRows(loadRows.map((r: LoadRow) => ({$1})));'
);
cUps = cUps.replace(
  /setLoadRows\(\(prev\)\s*=>\s*prev\.map\(\(r\)\s*=>\s*\(\{([\s\S]*?)\}\)\)\);/g,
  'setLoadRows(loadRows.map((r: LoadRow) => ({$1})));'
);
fs.writeFileSync(pUps, cUps, 'utf8');
console.log('Fixed ups-sizing-calculation.tsx');
