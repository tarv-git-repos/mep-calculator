// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "path";
import fs from "fs";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Fix Vite 8 es-module-lexer bug where `import(a, b = {}, c = true) {` class methods
// in @thatopen/components and @thatopen/components-front are mistaken for dynamic import() calls
function patchThatOpenMethodSyntax(code: string): string {
  return code.replace(
    /\bimport\(([^()\n]*=[^()\n]*)\)\s*\{/g,
    (_match, params) => `import(..._args) { let [${params}] = _args;`
  );
}

for (const relPath of [
  "node_modules/@thatopen/components/dist/index.mjs",
  "node_modules/@thatopen/components-front/dist/index.js",
]) {
  try {
    const fullPath = path.resolve(__dirname, relPath);
    if (fs.existsSync(fullPath)) {
      const original = fs.readFileSync(fullPath, "utf8");
      const patched = patchThatOpenMethodSyntax(original);
      if (patched !== original) {
        fs.writeFileSync(fullPath, patched, "utf8");
        console.log(`[vite-patch] Patched class method import() syntax in ${relPath}`);
      }
    }
  } catch (e) {
    console.warn(`[vite-patch] Could not patch ${relPath}:`, e);
  }
}

const asyncHooksPolyfill = {
  name: 'async-hooks-polyfill',
  enforce: 'pre' as const,
  resolveId(id: string) {
    if (id === 'node:async_hooks' || id === 'async_hooks') {
      return id;
    }
    if (id.startsWith('https:') || id.startsWith('http:')) {
      return '\0http-external';
    }
  },
  load(id: string) {
    if (id === 'node:async_hooks' || id === 'async_hooks') {
      return `
        export class AsyncLocalStorage {
          constructor() { this._store = undefined; }
          getStore() { return this._store; }
          run(store, fn, ...args) {
            const prev = this._store;
            this._store = store;
            try {
              return typeof fn === 'function' ? fn(...args) : fn;
            } finally {
              this._store = prev;
            }
          }
          enterWith(store) { this._store = store; }
          disable() { this._store = undefined; }
        }
        export default { AsyncLocalStorage };
      `;
    }
    if (id === '\0http-external') {
      return `export default {};`;
    }
  },
  transform(code: string, id: string) {
    if (id.includes('@thatopen')) {
      const patched = patchThatOpenMethodSyntax(code);
      if (patched !== code) {
        return { code: patched, map: null };
      }
    }
  }
};

const ssrErrorPrinter = {
  name: 'ssr-error-printer',
  enforce: 'pre' as const,
  configureServer() {
    (globalThis as any).__LOVABLE_TANSTACK_CAPTURE_SSR_ERROR__ = (err: any) => {
      console.error('\n******************** TANSTACK SSR ERROR ********************\n', err, '\n*************************************************************\n');
    };
    process.on('unhandledRejection', (err: any) => {
      if (err && (err.code === 'UNKNOWN' || err.code === 'ENOENT' || err.syscall === 'stat' || err.syscall === 'lstat')) {
        console.warn('[vite-network-warning] Transient network filesystem stat/lstat error caught and ignored:', err.message || err);
        return;
      }
      console.error('=== SSR UNHANDLED REJECTION ===\n', err);
    });
    process.on('uncaughtException', (err: any) => {
      if (err && (err.code === 'UNKNOWN' || err.code === 'ENOENT' || err.syscall === 'stat' || err.syscall === 'lstat')) {
        console.warn('[vite-network-warning] Transient network filesystem stat/lstat error caught and ignored:', err.message || err);
        return;
      }
      console.error('=== SSR UNCAUGHT EXCEPTION ===\n', err);
    });
  }
};

import os from "os";

const localCacheDir = path.join(os.tmpdir(), "mep_calculator_vite_cache");

export default defineConfig({
  vite: {
    cacheDir: localCacheDir,
    plugins: [asyncHooksPolyfill, ssrErrorPrinter],
    clearScreen: false,
    server: {
      host: "0.0.0.0",
      port: 8081,
      strictPort: false,
      fs: {
        strict: false,
        allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '.')],
      },
      proxy: {
        '/api': {
          target: process.env.VITE_DEV_API_URL || 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: process.env.VITE_DEV_API_URL || 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
        },
      },
      watch: {
        usePolling: true,
        interval: 2000,
        binaryInterval: 4000,
        ignored: (watchPath: string) => {
          if (!watchPath || typeof watchPath !== 'string') return false;
          const norm = watchPath.replace(/\\/g, '/');
          return (
            norm.includes('/node_modules/') ||
            norm.includes('/.vite/') ||
            norm.includes('/.output/') ||
            norm.includes('/.tanstack/') ||
            norm.includes('/dist/') ||
            norm.includes('/dist-nitro-2/') ||
            norm.includes('/dist-electron/') ||
            norm.includes('/src-tauri/') ||
            norm.includes('/scratch/') ||
            norm.includes('/MEP_Calculator_App/') ||
            norm.includes('/.system_generated/') ||
            norm.includes('/.git/') ||
            norm.includes('/src/backup_calculators/')
          );
        },
      },
    },
    build: {
      emptyOutDir: false,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs", ".json", ""],
      tsconfigPaths: true,
    },
    ssr: {
      external: ['fast-png', 'pako', 'xlsx', 'jspdf', 'file-saver', 'jspdf-autotable', 'exceljs', 'iobuffer', 'dompurify', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-updater', '@tauri-apps/plugin-process', '@tauri-apps/api'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@tanstack/react-router',
        '@tanstack/react-query',
        'lucide-react',
        'clsx',
        'tailwind-merge'
      ],
      exclude: ['@tanstack/react-start', 'node:async_hooks', 'async_hooks', '@thatopen/components', '@thatopen/components-front', '@thatopen/fragments', 'web-ifc'],
    },
  },
  nitro: {
    preset: 'node-server',
    output: {
      dir: path.resolve(__dirname, 'dist-nitro-2'),
      serverDir: path.resolve(__dirname, 'dist-nitro-2/server'),
      publicDir: path.resolve(__dirname, 'dist-nitro-2/public')
    }
  } as any,
});
