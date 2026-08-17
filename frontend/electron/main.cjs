const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const http = require('http');
const { fork } = require('child_process');

function startStaticServer(distPath) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };

  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    let filePath = path.join(distPath, reqUrl);

    if (!fsSync.existsSync(filePath) || fsSync.statSync(filePath).isDirectory()) {
      filePath = path.join(distPath, 'index.html');
    }

    const ext = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fsSync.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(500);
        res.end('Error loading file');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(content, 'utf-8');
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`Embedded app server running on http://127.0.0.1:${port}`);
      resolve(port);
    });
  });
}

async function createWindow(serverPort) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "MEP Calculator",
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (serverPort) {
    win.loadURL(`http://127.0.0.1:${serverPort}/`);
  } else {
    const distIndex = path.join(__dirname, '../dist/index.html');
    win.loadFile(distIndex);
  }
}

app.whenReady().then(async () => {
  try {
    const authServerPath = path.join(__dirname, '../backend/authServer.js');
    if (fsSync.existsSync(authServerPath)) {
      const authProc = fork(authServerPath);
      authProc.on('error', (err) => console.log('Auth server error:', err.message));
    }
  } catch (e) {
    console.log('Auth server fork note:', e.message);
  }

  ipcMain.handle('read-file', async (e, fp) => {
    return await fs.readFile(fp);
  });

  let serverPort = null;
  const nitroPublic = path.join(__dirname, '../dist-nitro-2/public');
  const distDir = path.join(__dirname, '../dist');
  const distPath = fsSync.existsSync(nitroPublic) ? nitroPublic : distDir;

  if (fsSync.existsSync(distPath)) {
    try {
      serverPort = await startStaticServer(distPath);
    } catch (err) {
      console.error('Failed to start embedded static server:', err);
    }
  }

  createWindow(serverPort);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(serverPort);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
