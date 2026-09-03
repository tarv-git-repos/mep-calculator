import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const version = "0.0.6";
console.log(`🚀 Packaging MEP Calculator Desktop App & NSIS Setup Installer (v${version})...`);

if (process.argv.includes('--build')) {
  execSync('npm run tauri:full', { stdio: 'inherit', cwd: path.join(process.cwd(), 'frontend') });
}

const possibleDirs = [
  'C:\\cargo-target\\mep_calculator\\release\\bundle\\nsis',
  'C:\\cargo-target\\mep_calculator\\release\\bundle\\target\\release\\bundle\\nsis',
  'D:\\cargo-target\\release\\bundle\\nsis',
  path.join(process.cwd(), 'frontend', 'src-tauri', 'target', 'release', 'bundle', 'nsis')
];

let copied = false;
let foundExeName = '';
let foundSigContent = '';

for (const nsisDir of possibleDirs) {
  if (fs.existsSync(nsisDir)) {
    const files = fs.readdirSync(nsisDir);
    console.log(`\n📁 Checking NSIS Bundle Files in ${nsisDir}:`, files);

    const exeFile = files.find(f => f.includes(version) && f.endsWith('.exe')) || 
                    files.find(f => f.endsWith('.exe') && !f.endsWith('.nsis') && f !== 'MEP Calculator.exe');
    if (exeFile) {
      foundExeName = exeFile;
      const src = path.join(nsisDir, exeFile);
      const destWithSpace = path.join(process.cwd(), exeFile);
      const destWithUnderscore = path.join(process.cwd(), exeFile.replace(/ /g, '_'));

      fs.copyFileSync(src, destWithSpace);
      fs.copyFileSync(src, destWithUnderscore);

      // Check for .sig file for v0.0.5
      const sigFile = files.find(f => f.includes(version) && f.endsWith('.sig')) || 
                      files.find(f => f.endsWith('.sig'));
      if (sigFile) {
        foundSigContent = fs.readFileSync(path.join(nsisDir, sigFile), 'utf8').trim();
      } else {
        const latestJsonFile = files.find(f => f.endsWith('latest.json') || f.endsWith('update.json'));
        if (latestJsonFile) {
          try {
            const parsed = JSON.parse(fs.readFileSync(path.join(nsisDir, latestJsonFile), 'utf8'));
            foundSigContent = parsed.platforms?.['windows-x86_64']?.signature || parsed.signature || '';
          } catch (e) {}
        }
      }

      console.log(`\n==================================================`);
      console.log(`✅ SUCCESS! Extracted release setup files for v${version}:`);
      console.log(`   1) ${destWithSpace}`);
      console.log(`   2) ${destWithUnderscore}`);
      if (foundSigContent) {
        console.log(`   3) Signature extracted: ${foundSigContent.substring(0, 40)}...`);
      }
      console.log(`==================================================\n`);
      copied = true;
      break;
    }
  }
}

if (!copied) {
  console.error(`⚠️ Could not locate generated setup .exe file for v${version} in target directories.`);
} else {
  const pubDate = new Date().toISOString();
  const exeFileName = foundExeName.replace(/ /g, '_');
  const supabaseStorageUrl = `https://ttqgrcmesxrnujmhesnk.supabase.co/storage/v1/object/public/updater/${exeFileName}`;

  const updateManifest = {
    version: version,
    pub_date: pubDate,
    notes: `MEP Calculator v${version} Release Update - Performance improvements, enhanced calculations, and UI stability updates.`,
    platforms: {
      "windows-x86_64": {
        signature: foundSigContent || undefined,
        url: supabaseStorageUrl
      }
    },
    url: supabaseStorageUrl,
    mandatory: false
  };

  const updateJsonStr = JSON.stringify(updateManifest, null, 2);
  fs.writeFileSync(path.join(process.cwd(), 'update.json'), updateJsonStr);
  fs.writeFileSync(path.join(process.cwd(), 'frontend', 'update.json'), updateJsonStr);
  fs.writeFileSync(path.join(process.cwd(), 'frontend', 'public', 'update.json'), updateJsonStr);

  console.log(`📝 Successfully generated update.json for version v${version}`);
  console.log(`\n☁️  SUPABASE AUTO-UPDATE DEPLOYMENT INSTRUCTIONS:`);
  console.log(`   1. Open Supabase Dashboard -> Storage -> 'updater' public bucket.`);
  console.log(`   2. Upload file: '${exeFileName}'`);
  console.log(`   3. Upload file: 'update.json' (to the root of the 'updater' bucket)`);
  console.log(`   4. Existing user desktop installations will auto-detect v${version} and show the update popup!\n`);
}
