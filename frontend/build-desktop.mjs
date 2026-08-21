import { execSync } from 'child_process';
import { fork } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  fs.rmSync(path.join(__dirname, 'dist-nitro-2'), { recursive: true, force: true });
  fs.rmSync(path.join(__dirname, 'node_modules/.nitro'), { recursive: true, force: true });
} catch (e) {}

console.log('Building Vite project...');
let attempts = 0;
while (attempts < 5) {
  try {
    attempts++;
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
    break;
  } catch (err) {
    if (attempts >= 5) throw err;
    console.warn(`Build attempt ${attempts} hit a file system lock on network share, waiting 2s and retrying...`);
    try {
      execSync('powershell -Command "Remove-Item -Recurse -Force \'node_modules\\.nitro\' -ErrorAction SilentlyContinue"', { cwd: __dirname });
    } catch (e) {}
    execSync('node -e "setTimeout(() => {}, 2000)"');
  }
}

console.log('Starting local Nitro server to capture index.html...');
const port = 8085;
const serverProcess = fork(path.join(__dirname, 'dist-nitro-2/server/index.mjs'), [], {
  env: { ...process.env, PORT: port },
  cwd: __dirname,
  silent: true,
});

serverProcess.stdout.on('data', (data) => {
  const str = data.toString();
  if (str.includes('Listening on')) {
    console.log('Server is ready. Fetching index.html...');
    http.get(`http://localhost:${port}/`, (res) => {
      let html = '';
      res.on('data', (chunk) => { html += chunk; });
      res.on('end', () => {
        let fixedHtml = html
          .replace(/href="\/assets\//g, 'href="./assets/')
          .replace(/src="\/assets\//g, 'src="./assets/')
          .replace(/href="\/favicon/g, 'href="./favicon');

        fs.writeFileSync(path.join(__dirname, 'dist-nitro-2/public/index.html'), fixedHtml);
        console.log('Successfully wrote dist-nitro-2/public/index.html with relative paths');

        // Copy dist-nitro-2/public to dist for electron compatibility
        const distDir = path.join(__dirname, 'dist');
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true });
        }
        fs.cpSync(path.join(__dirname, 'dist-nitro-2/public'), distDir, { recursive: true, force: true });
        console.log('Successfully mirrored dist-nitro-2/public to dist/');

        serverProcess.kill();

        // Apply Tauri CSR patch to the built JS bundle
        patchTauriCSR();

        process.exit(0);
      });
    }).on('error', (err) => {
      console.error('Error fetching HTML:', err);
      serverProcess.kill();
      process.exit(1);
    });
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error(`Server error: ${data}`);
});

// Fallback timeout in case server doesn't output 'Listening on'
setTimeout(() => {
  console.error('Timeout waiting for server to start.');
  serverProcess.kill();
  process.exit(1);
}, 10000);

/**
 * Patches the built JS bundle to use React.createRoot (CSR) in Tauri
 * instead of hydrateRoot (SSR), avoiding the white screen issue.
 * 
 * In Tauri, window.__TAURI_INTERNALS__ is present. We detect it and
 * wipe the SSR-rendered body, then mount React fresh via createRoot.
 */
function patchTauriCSR() {
  console.log('\nApplying Tauri CSR patch...');
  const assetsDir = path.join(__dirname, 'dist-nitro-2', 'public', 'assets');
  const files = fs.readdirSync(assetsDir).filter(f => f.startsWith('index-') && f.endsWith('.js'));

  if (files.length === 0) {
    console.warn('⚠️  No index-*.js found, skipping patch.');
    return;
  }

  const jsFile = path.join(assetsDir, files[0]);
  let js = fs.readFileSync(jsFile, 'utf8');

  // Match the hydrateRoot call dynamically using a regex to handle variable renaming by the minifier
  const regex = /\(0,(\w+)\.hydrateRoot\)\(document,\(0,(\w+)\.jsx\)\((\w+)\.StrictMode,\{children:\(0,\2\.jsx\)\((\w+),\{\}\)\}\)\)/;

  if (!regex.test(js)) {
    console.warn('⚠️  Mount pattern not found — patch skipped. App may show white screen in Tauri.');
    const idx = js.lastIndexOf('hydrateRoot');
    if (idx > -1) {
      console.log('hydrateRoot context:', js.slice(Math.max(0, idx - 100), idx + 200));
    }
    return;
  }

  // Replace: detect Tauri and use createRoot instead of hydrateRoot
  js = js.replace(regex, (match, reactDomClient, jsxCreator, strictMode, rootComponent) => {
    return (
      `window.__TAURI_INTERNALS__ ? (` +
        `document.body.innerHTML = '', ` +
        `(0,${reactDomClient}.createRoot)(document.body).render((0,${jsxCreator}.jsx)(${strictMode}.StrictMode,{children:(0,${jsxCreator}.jsx)(${rootComponent},{})}))` +
      `) : (` +
        `${match}` +
      `)`
    );
  });
  fs.writeFileSync(jsFile, js);
  console.log(`✅ Tauri CSR patch applied to ${files[0]}`);
  console.log('   → Tauri: createRoot (CSR) | Browser: hydrateRoot (SSR)');
}
