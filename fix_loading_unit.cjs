const fs = require('fs');
const file = 'frontend/src/routes/plumbing-loading-unit.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  'const { project, activeProjectId, forceSaveToCloud } = useWorkspace();',
  'const { project, activeProjectId, forceSaveToCloud, isReadOnly } = useWorkspace();'
);

fs.writeFileSync(file, data);
