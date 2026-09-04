// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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
          getStore() { return undefined; }
          run(store, fn) { return typeof fn === 'function' ? fn() : fn; }
          enterWith() {}
          disable() {}
        }
        export default { AsyncLocalStorage };
      `;
    }
    if (id === '\0http-external') {
      return `export default {};`;
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
    process.on('unhandledRejection', (err) => {
      console.error('=== SSR UNHANDLED REJECTION ===\n', err);
    });
    process.on('uncaughtException', (err) => {
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
      host: true,
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
        interval: 1000,
        ignored: [
          "**/src-tauri/**",
          "**/dist/**",
          "**/dist-nitro-2/**",
          "**/dist-electron/**",
          "**/scratch/**",
          "**/MEP_Calculator_App/**",
          "**/.system_generated/**",
          "**/.git/**"
        ],
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
      external: ['xlsx', 'jspdf', 'file-saver', 'jspdf-autotable', 'exceljs', 'iobuffer', 'dompurify', 'pako', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-updater', '@tauri-apps/plugin-process', '@tauri-apps/api'],
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
    clean: false,
    prerender: { routes: ['/'] },
    output: {
      dir: path.resolve(__dirname, 'dist-nitro-build'),
      serverDir: path.resolve(__dirname, 'dist-nitro-build/server'),
      publicDir: path.resolve(__dirname, 'dist-nitro-build/public')
    }
  },
});
