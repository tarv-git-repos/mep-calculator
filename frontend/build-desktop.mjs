import { execSync, fork } from 'child_process';
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

const publicDir = path.join(__dirname, 'dist-nitro-2', 'public');
const assetsDir = path.join(publicDir, 'assets');

let htmlCaptured = false;

console.log('Capturing index.html...');
const port = 8085;
const serverPath = path.join(__dirname, 'dist-nitro-2', 'server', 'index.mjs');

if (fs.existsSync(serverPath)) {
  const serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: port },
    cwd: __dirname,
    silent: true,
  });

  serverProcess.stdout.on('data', (data) => {
    const str = data.toString();
    if (str.includes('Listening on') && !htmlCaptured) {
      console.log('Nitro server is ready. Fetching index.html...');
      http.get(`http://localhost:${port}/`, (res) => {
        let html = '';
        res.on('data', (chunk) => { html += chunk; });
        res.on('end', () => {
          if (html && html.includes('<html') && !htmlCaptured) {
            htmlCaptured = true;
            let fixedHtml = html
              .replace(/href="\/assets\//g, 'href="./assets/')
              .replace(/src="\/assets\//g, 'src="./assets/')
              .replace(/href="\/favicon/g, 'href="./favicon');

            fs.mkdirSync(publicDir, { recursive: true });
            fs.writeFileSync(path.join(publicDir, 'index.html'), fixedHtml);
            console.log('✅ Captured index.html via Nitro server');
            finishBuild(serverProcess);
          }
        });
      }).on('error', () => {});
    }
  });

  // Fallback timeout in case Nitro server fails or errors
  setTimeout(() => {
    if (!htmlCaptured) {
      console.log('⚠️  Nitro server html capture fallback triggered.');
      generateFallbackHtml();
      finishBuild(serverProcess);
    }
  }, 12000);
} else {
  generateFallbackHtml();
  finishBuild();
}

function generateFallbackHtml() {
  if (htmlCaptured) return;
  htmlCaptured = true;
  fs.mkdirSync(publicDir, { recursive: true });

  let jsFile = '';
  let cssFiles = [];

  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    jsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js')) || files.find(f => f.endsWith('.js')) || '';
    cssFiles = files.filter(f => f.endsWith('.css'));
  }

  const cssLinks = cssFiles.map(f => `<link rel="stylesheet" href="./assets/${f}">`).join('\n    ');

  const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MEP Calculator</title>
    ${cssLinks}
  </head>
  <body>
    <div id="root"></div>
    ${jsFile ? `<script type="module" src="./assets/${jsFile}"></script>` : ''}
  </body>
</html>`;

  fs.writeFileSync(path.join(publicDir, 'index.html'), fallbackHtml);
  console.log('✅ Generated robust static index.html fallback with all CSS stylesheets');
}

function finishBuild(serverProcess) {
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
  }

  // Mirror dist-nitro-2/public to dist for electron/tauri compatibility
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  fs.cpSync(publicDir, distDir, { recursive: true, force: true });
  console.log('Successfully mirrored dist-nitro-2/public to dist/');

  // Apply Tauri CSR patch to the built JS bundle
  patchTauriCSR();

  process.exit(0);
}

function patchTauriCSR() {
  console.log('\nApplying Tauri CSR patch...');
  if (!fs.existsSync(assetsDir)) {
    console.warn('⚠️  assetsDir not found, skipping patch.');
    return;
  }
  const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));

  if (files.length === 0) {
    console.warn('⚠️  No .js found, skipping patch.');
    return;
  }

  const regex = /\(0,(\w+)\.hydrateRoot\)\(document,\(0,(\w+)\.jsx\)\((\w+)\.StrictMode,\{children:\(0,\2\.jsx\)\((\w+),\{\}\)\}\)\)/;

  let patchedCount = 0;
  for (const file of files) {
    const jsFile = path.join(assetsDir, file);
    let js = fs.readFileSync(jsFile, 'utf8');
    if (regex.test(js)) {
      js = js.replace(regex, (match, reactDomClient, jsxCreator, strictMode, rootComponent) => {
        return (
          `window.__TAURI_INTERNALS__ ? (` +
            `window.$_TSR = { t: new Map(), buffer: [], initialized: true, matches: [], streamEnded: true, h: () => {}, dehydrated: {}, router: { matches: [] } }, ` +
            `document.body.innerHTML = '', ` +
            `(0,${reactDomClient}.createRoot)(document.body).render((0,${jsxCreator}.jsx)(${strictMode}.StrictMode,{children:(0,${jsxCreator}.jsx)(${rootComponent},{})}))` +
          `) : (` +
            `${match}` +
          `)`
        );
      });
      fs.writeFileSync(jsFile, js);
      console.log(`✅ Tauri CSR patch applied to ${file}`);
      patchedCount++;
    }
  }

  if (patchedCount === 0) {
    console.warn('⚠️  Mount pattern not found in any JS file — patch skipped.');
  } else {
    console.log(`   → Patched ${patchedCount} file(s). Tauri: createRoot (CSR) | Browser: hydrateRoot (SSR)`);
  }
}
