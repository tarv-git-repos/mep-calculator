const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend', 'src', 'routes', 'psychrometric.tsx');
let c = fs.readFileSync(p, 'utf8');

// 1. imports
if (!c.includes('import { useAuth }')) {
  c = c.replace('import { useWorkspace }', 'import { useAuth } from "@/contexts/AuthContext";\nimport { useWorkspace }');
}

// 2. useWorkspace and useAuth hook
c = c.replace(
  'const { project, user, forceSaveToCloud } = useWorkspace();',
  'const { project, forceSaveToCloud } = useWorkspace();\n  const { user, userData, profile } = useAuth();\n  const currentUserName = userData?.name || profile?.name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";'
);

// 3. getSignatureBlockDetails call
c = c.replace(
  'return getSignatureBlockDetails(project?.id || "default", "/psychrometric");',
  'return getSignatureBlockDetails(project?.id || "default", "/psychrometric", currentUserName, calcReviewState);'
);

// 4. location -> (project as any)?.location
c = c.replace(/project\?\.location/g, '(project as any)?.location');

// 5. forceSaveToCloud args
c = c.replace(/forceSaveToCloud\([a-zA-Z0-9_]*\)/g, 'forceSaveToCloud()');

fs.writeFileSync(p, c, 'utf8');
console.log('psychrometric.tsx patched successfully');
