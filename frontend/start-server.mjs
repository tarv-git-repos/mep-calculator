import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8081;
const API_TARGET = process.env.VITE_DEV_API_URL || 'http://127.0.0.1:4000';

function getPublicDir() {
  const nitroPublic = path.join(__dirname, 'dist-nitro-2', 'public');
  if (fs.existsSync(path.join(nitroPublic, 'index.html'))) {
    return nitroPublic;
  }
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    return distDir;
  }
  return nitroPublic;
}

// Proxy API requests to auth/backend server
app.use(['/api', '/health'], (req, res) => {
  const targetUrl = new URL(req.originalUrl, API_TARGET);
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 4000,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`Proxy error for ${req.originalUrl}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Backend unreachable', details: err.message });
    }
  });

  req.pipe(proxyReq);
});

// Serve static assets with correct MIME types from both directories
const staticOpts = {
  index: false,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
};

app.use((req, res, next) => {
  const activeDir = getPublicDir();
  express.static(activeDir, staticOpts)(req, res, next);
});

// SPA Fallback: Serve index.html for all page routes
app.get('*splat', (req, res) => {
  const activeDir = getPublicDir();
  const indexPath = path.join(activeDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found. Please run build first.');
  }
});

// Start listening
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🚀 MEP Calculator Web Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying /api -> ${API_TARGET}`);
  console.log(`📂 Serving static from: ${getPublicDir()}`);
  console.log(`==================================================\n`);
});
