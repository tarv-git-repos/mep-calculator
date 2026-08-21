import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Building desktop app & NSIS setup installer...');
execSync('npm run tauri:full', { stdio: 'inherit', cwd: path.join(process.cwd(), 'frontend') });

const nsisDir = path.join(process.cwd(), 'frontend', 'src-tauri', 'target', 'release', 'bundle', 'nsis');
if (fs.existsSync(nsisDir)) {
  const files = fs.readdirSync(nsisDir);
  console.log('NSIS Bundle Files:', files);
  const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('2.0.8') && !f.includes('1.0.0'));
  if (exeFile) {
    const src = path.join(nsisDir, exeFile);
    const dest = path.join(process.cwd(), exeFile);
    fs.copyFileSync(src, dest);
    console.log(`✅ Successfully generated and copied ${exeFile} to root directory!`);
  }
}
