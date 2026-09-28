const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend', 'src', 'routes', 'plumbing-drainage.tsx');
let c = fs.readFileSync(p, 'utf8');

// 1. imports
c = c.replace(
  /import\s*\{\s*CalculationReviewBar,\s*useCalculationLock,\s*type\s*CalculationReviewState\s*\}\s*from\s*["']@\/components\/workspace\/CalculationReviewBar["'];/,
  'import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";\nimport { useConfirm } from "@/hooks/use-confirm";'
);

// 2. hook destructuring
c = c.replace(
  'const { project, activeProjectId, activeRoom, isReadOnly, forceSaveToCloud } = useWorkspace();',
  'const { project, activeProjectId, isReadOnly, forceSaveToCloud, updateProject } = useWorkspace();'
);

// 3. user_metadata
c = c.replace('user?.user_metadata?.full_name', '(user as any)?.user_metadata?.full_name');

// 4. workspace_data
c = c.replace(/project\?\.workspace_data/g, '(project as any)?.workspace_data');
c = c.replace(/project\.workspace_data/g, '(project as any)?.workspace_data');

// 5. cleanFloors map type
c = c.replace('cleanFloors = Array.from(new Set(cleanSpaces.map(s => s.floor)));',
  'cleanFloors = Array.from(new Set(cleanSpaces.map((s: any) => s.floor)));');

// 6. workspaceStore replacement
c = c.replace(/workspaceStore\.updateProject\(\{[\s\S]*?\}\);/g, (match) => {
  if (match.includes('drainage_calc_comments')) {
    return 'if (updateProject && project) updateProject({ ...project, workspace_data: updatedWdata } as any);';
  }
  return 'if (updateProject && project) updateProject({ ...project, workspace_data: { ...wdata, drainage_calc: dataToSave, drainage_pipe_calc: dataToSave } } as any);';
});
c = c.replace('workspaceStore.forceSaveToCloud();', 'if (forceSaveToCloud) forceSaveToCloud();');

// 7. capacityUtilization type
c = c.replace(/maxAllowedDfu:\s*number;\s*systemType:/, 'maxAllowedDfu: number;\n      capacityUtilization?: number;\n      systemType:');

fs.writeFileSync(p, c, 'utf8');
console.log('plumbing-drainage.tsx updated successfully');
