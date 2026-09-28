const fs = require('fs');
const file = 'frontend/src/routes/ups-sizing-calculation.tsx';
let data = fs.readFileSync(file, 'utf8');

// 1. Fix UpsSizingCalculationPage variable order
data = data.replace(
  /function UpsSizingCalculationPage\(\) \{\n  const isEffectiveReadOnly = useCalculationEffectiveReadOnly\("\/ups-sizing-calculation", project\?\.id \|\| activeProjectId\);\n  const \{ userData, profile \} = useAuth\(\);\n  const \{ project, activeProjectId \} = useWorkspace\(\);/g,
  'function UpsSizingCalculationPage() {\n  const { userData, profile } = useAuth();\n  const { project, activeProjectId } = useWorkspace();\n  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/ups-sizing-calculation", project?.id || activeProjectId);'
);

// 2. Fix InlineInput missing variables
data = data.replace(
  /function InlineInput\(\{ value, onCommit, className = "", type = "text", step, min \}: InlineInputProps\) \{\n  const calcReviewState = useCalculationReviewState/g,
  'function InlineInput({ value, onCommit, className = "", type = "text", step, min }: InlineInputProps) {\n  const { project, activeProjectId } = useWorkspace();\n  const calcReviewState = useCalculationReviewState'
);

fs.writeFileSync(file, data);
