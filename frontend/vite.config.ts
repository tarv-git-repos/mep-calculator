// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    clearScreen: false,
    server: {
      host: true,
      port: 8081,
      strictPort: true,
      fs: {
        strict: false,
        allow: ['.', '..'],
      },
      proxy: {
        '/api': {
          target: 'https://universal-mep-calculator.onrender.com',
          changeOrigin: true,
          secure: false,
        },
      },
      watch: {
        ignored: ["**/src-tauri/**"],
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
      include: ['iobuffer', 'setimmediate', 'dompurify', 'pako'],
    },
  },
  nitro: {
    preset: 'node-server',
    prerender: { routes: ['/'] },
    output: {
      dir: './dist-nitro-2',
      serverDir: './dist-nitro-2/server',
      publicDir: './dist-nitro-2/public'
    }
  },
  tanstackStart: {
    ssr: false,
    server: { entry: "server" },
  },
});
