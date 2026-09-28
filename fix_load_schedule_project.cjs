const fs = require('fs');
const file = 'frontend/src/routes/project-load-schedule.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  'const { activeProjectId } = useWorkspace();',
  'const { activeProjectId, project } = useWorkspace();'
);

fs.writeFileSync(file, data);
