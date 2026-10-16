const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function patchFile(relPath, replacements) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-thatopen] Skip (not found): ${relPath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const { pattern, replacement } of replacements) {
    if (typeof pattern === 'string') {
      if (content.includes(pattern)) {
        content = content.split(pattern).join(replacement);
        changed = true;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-thatopen] Successfully patched: ${relPath}`);
  } else {
    console.log(`[patch-thatopen] Already patched or no matches: ${relPath}`);
  }
}

// 1. @thatopen/components/dist/index.mjs
patchFile('node_modules/@thatopen/components/dist/index.mjs', [
  {
    pattern: /import\(\.\.\._args\)\s*\{\s*let\s*\[exported,\s*imported\s*=\s*\{\},\s*first\s*=\s*true\]\s*=\s*_args;/,
    replacement: "['import'](exported, imported = {}, first = true) {"
  },
  {
    pattern: /import\(exported,\s*imported\s*=\s*\{\},\s*first\s*=\s*true\)\s*\{/,
    replacement: "['import'](exported, imported = {}, first = true) {"
  },
  {
    pattern: /import\(result\)\s*\{/,
    replacement: "['import'](result) {"
  }
]);

// 2. @thatopen/components/dist/index.min.mjs
patchFile('node_modules/@thatopen/components/dist/index.min.mjs', [
  {
    pattern: '}import(t,e={},i=!0){',
    replacement: "}['import'](t,e={},i=!0){"
  },
  {
    pattern: '}import(t){const{data:e}=t',
    replacement: "}['import'](t){const{data:e}=t"
  }
]);

// 3. @thatopen/components-front/dist/index.js
patchFile('node_modules/@thatopen/components-front/dist/index.js', [
  {
    pattern: /import\(\.\.\._args\)\s*\{\s*let\s*\[e,\s*t\s*=\s*\{\},\s*s\s*=\s*!0\]\s*=\s*_args;/,
    replacement: "['import'](e, t = {}, s = !0) {"
  },
  {
    pattern: /import\(e,\s*t\s*=\s*\{\},\s*s\s*=\s*!0\)\s*\{/,
    replacement: "['import'](e, t = {}, s = !0) {"
  },
  {
    pattern: /import\(e\)\s*\{/,
    replacement: "['import'](e) {"
  }
]);

console.log('[patch-thatopen] Complete.');
