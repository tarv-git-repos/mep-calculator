const fs = require('fs');
const file = 'frontend/src/routes/project-load-schedule.tsx';
let data = fs.readFileSync(file, 'utf8');

// 1. Remove invalid hook call inside createDefaultBoard
data = data.replace(
  /const calcReviewState = useCalculationReviewState\("\/project-load-schedule", project\?\.id \|\| activeProjectId\);/,
  ''
);

// 2. Import useWorkspace
if (!data.includes('useWorkspace')) {
  data = data.replace(
    /import \{ AppShell \} from "@\/components\/workspace\/AppShell";/,
    'import { AppShell } from "@/components/workspace/AppShell";\nimport { useWorkspace } from "@/lib/workspace-store";'
  );
}

// 3. Destructure activeProjectId inside ProjectLoadSchedulePage
data = data.replace(
  /const isEffectiveReadOnly = useCalculationEffectiveReadOnly\("\/project-load-schedule", activeProjectId\);/,
  'const { activeProjectId } = useWorkspace();\n  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/project-load-schedule", activeProjectId);'
);

fs.writeFileSync(file, data);
