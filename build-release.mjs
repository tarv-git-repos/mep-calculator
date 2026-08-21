import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Building desktop app & NSIS setup installer...');
execSync('npm run tauri:full', { stdio: 'inherit', cwd: path.join(process.cwd(), 'frontend') });

const possibleDirs = [
  'C:\\cargo-target\\mep_calculator\\release\\bundle\\nsis',
  'D:\\cargo-target\\release\\bundle\\nsis',
  path.join(process.cwd(), 'frontend', 'src-tauri', 'target', 'release', 'bundle', 'nsis')
];

let copied = false;
for (const nsisDir of possibleDirs) {
  if (fs.existsSync(nsisDir)) {
    const files = fs.readdirSync(nsisDir);
    console.log(`NSIS Bundle Files in ${nsisDir}:`, files);
    const exeFile = files.find(f => f.endsWith('.exe') && !f.endsWith('.nsis') && f !== 'MEP Calculator.exe');
    if (exeFile) {
      const src = path.join(nsisDir, exeFile);
      const destWithSpace = path.join(process.cwd(), exeFile);
      const destWithUnderscore = path.join(process.cwd(), exeFile.replace(/ /g, '_'));

      fs.copyFileSync(src, destWithSpace);
      fs.copyFileSync(src, destWithUnderscore);

      console.log(`\n==================================================`);
      console.log(`✅ SUCCESS! Created new release setup files:`);
      console.log(`   1) ${destWithSpace}`);
      console.log(`   2) ${destWithUnderscore}`);
      console.log(`==================================================\n`);
      copied = true;
      break;
    }
  }
}

if (!copied) {
  console.error('⚠️ Could not locate generated setup .exe file in target directories.');
}
