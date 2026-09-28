const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend', 'src', 'routes', 'sanity-check-tool.tsx');
let c = fs.readFileSync(p, 'utf8');

// 1. imports
if (!c.includes('import { useAuth }')) {
  c = c.replace('import { useWorkspace }', 'import { useAuth } from "@/contexts/AuthContext";\nimport { useWorkspace }');
}

// 2. add auth & currentUserName
c = c.replace(
  'const { project, activeProjectId, isReadOnly } = useWorkspace();',
  'const { project, activeProjectId, isReadOnly } = useWorkspace();\n  const { userData, profile, user } = useAuth();\n  const currentUserName = userData?.name || profile?.name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";'
);

// 3. sigDetails
c = c.replace(
  'const sigDetails = getSignatureBlockDetails(activeProjectId || project?.id || "default", "/sanity-check-tool");',
  'const sigDetails = getSignatureBlockDetails(activeProjectId || project?.id || "default", "/sanity-check-tool", currentUserName, calcReviewState);'
);

// 4. location
c = c.replace(/project\?\.location/g, '(project as any)?.location');

fs.writeFileSync(p, c, 'utf8');
console.log('sanity-check-tool.tsx patched successfully');
