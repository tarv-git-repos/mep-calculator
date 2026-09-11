import { invoke } from '@tauri-apps/api/core';
import { Matrix4 } from 'three';
import * as WEBIFC from 'web-ifc';
import { GeometryGenerator } from './backend/GeometryGenerator';
import { IfcParser } from './backend/IfcParser';
import { PropertyManager } from './backend/PropertyManager';
import { RelationshipManager } from './backend/RelationshipManager';
import { SpaceGeometryExtractor } from './backend/SpaceGeometryExtractor';
import { CacheManager } from './backend/CacheManager';

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
const isElectron = typeof window !== 'undefined' && (window as any).api && typeof (window as any).api.processIfc === 'function';

const webFileStore = new Map<string, File>();
const webMemoryCache = new Map<string, Uint8Array>();
const webConvertedCache = new Map<string, { frag: string; json: string }>();
const inFlightConversions = new Map<string, Promise<{ frag: string; json: string }>>();
import { useViewerStore } from './store/viewer-store';
import { workspaceStore } from '@/lib/workspace-store';
import { getProjectConvertedBim, saveProjectConvertedBim } from '@/lib/projectIfcStorage';

let activeWorker: Worker | null = null;

export function cancelActiveIfcProcessing() {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
    inFlightConversions.clear();
    console.log("🛑 Cancelled background IFC worker conversion.");
  }
}
(window as any)._cancelIfcProcessing = cancelActiveIfcProcessing;

async function convertIfcInBrowser(file: File): Promise<{ frag: string; json: string }> {
  const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
  if (webConvertedCache.has(cacheKey)) {
    console.log(`⚡ Instant load: Using in-memory cached 3D geometry for "${file.name}"`);
    return webConvertedCache.get(cacheKey)!;
  }

  // 1. FAST PATH: Check persistent IndexedDB cache before launching heavy Web Worker
  const activeProjId = workspaceStore.getState().activeProjectId || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : "");
  try {
    const cachedBim = await getProjectConvertedBim(activeProjId, {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    });

    if (cachedBim && cachedBim.fragBytes && cachedBim.fragBytes.byteLength > 0 && cachedBim.jsonStr) {
      console.log(`⚡ Instant load: Retrieved persistent 3D geometry cache from IndexedDB for "${file.name}" (${(cachedBim.fragBytes.byteLength / (1024 * 1024)).toFixed(2)} MB)`);
      try {
        useViewerStore.getState().setLoadingText('⚡ Instant load: Loading cached 3D geometry...');
      } catch {}

      const fragId = `web-cache-${cacheKey}.frag`;
      const jsonId = `web-cache-${cacheKey}.json`;
      const jsonBytes = new TextEncoder().encode(cachedBim.jsonStr);

      if (webMemoryCache.size > 12) {
        webMemoryCache.clear();
        webConvertedCache.clear();
      }

      webMemoryCache.set(fragId, cachedBim.fragBytes);
      webMemoryCache.set(jsonId, jsonBytes);

      const result = { frag: fragId, json: jsonId };
      webConvertedCache.set(cacheKey, result);
      return result;
    }
  } catch (dbErr) {
    console.warn("Persistent BIM cache lookup warning:", dbErr);
  }

  if (inFlightConversions.has(cacheKey)) {
    console.log(`⏳ Hooking into IFC conversion already in progress for "${file.name}"`);
    return inFlightConversions.get(cacheKey)!;
  }

  const setProgress = (text: string) => {
    try {
      useViewerStore.getState().setLoadingText(text);
    } catch {}
  };

  const conversionPromise = (async () => {
    setProgress('Reading IFC file data (Step 1/5)...');
    await new Promise(r => setTimeout(r, 16));

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const wasmPath = typeof window !== 'undefined' ? `${window.location.origin}/` : './';

    // Terminate any previous worker
    cancelActiveIfcProcessing();

    return new Promise<{ frag: string; json: string }>((resolve, reject) => {
      try {
        const worker = new Worker(new URL('./ifc-worker.ts', import.meta.url), { type: 'module' });
        activeWorker = worker;

        worker.onmessage = (e: MessageEvent) => {
          const data = e.data;
          if (data.type === 'progress') {
            setProgress(data.text);
          } else if (data.type === 'complete') {
            const { fragBytes, jsonStr } = data;
            const jsonBytes = new TextEncoder().encode(jsonStr);
            const fragId = `web-cache-${cacheKey}.frag`;
            const jsonId = `web-cache-${cacheKey}.json`;

            if (webMemoryCache.size > 12) {
              webMemoryCache.clear();
              webConvertedCache.clear();
            }

            webMemoryCache.set(fragId, fragBytes);
            webMemoryCache.set(jsonId, jsonBytes);

            const result = { frag: fragId, json: jsonId };
            webConvertedCache.set(cacheKey, result);

            // Persist converted BIM geometry to IndexedDB in background so all future reloads take < 1s!
            saveProjectConvertedBim(activeProjId, {
              fileName: file.name,
              fileSize: file.size,
              fileModified: file.lastModified || Date.now(),
              fragBytes,
              jsonStr
            }).catch(err => console.warn("Failed to persist converted BIM to IndexedDB:", err));

            activeWorker = null;
            worker.terminate();
            resolve(result);
          } else if (data.type === 'error') {
            activeWorker = null;
            worker.terminate();
            reject(new Error(data.error));
          }
        };

        worker.onerror = (err) => {
          activeWorker = null;
          worker.terminate();
          reject(err);
        };

        worker.postMessage({ fileBytes, wasmPath }, [fileBytes.buffer]);
      } catch (workerErr) {
        activeWorker = null;
        reject(workerErr);
      }
    });
  })().finally(() => {
    inFlightConversions.delete(cacheKey);
  });

  inFlightConversions.set(cacheKey, conversionPromise);
  return conversionPromise;
}

export function ensureApiBridge() {
  if (typeof window === 'undefined') return;

  if (!(window as any).api) {
    (window as any).api = {};
  }

  const api = (window as any).api;

  if (typeof api.getFilePath !== 'function') {
    api.getFilePath = (file: File): string => {
      if (!file) return 'project_model.ifc';
      const key = (file as any).path || file.name || 'project_model.ifc';
      webFileStore.set(key, file);
      if (file.name) webFileStore.set(file.name, file);
      (window as any)._currentLoadedFile = file;
      return key;
    };
  }

  if (typeof api.processIfc !== 'function') {
    api.processIfc = async (key: string): Promise<{ frag: string; json: string }> => {
      let file = webFileStore.get(key) || (key ? webFileStore.get(key.split('/').pop() || '') : null) || (window as any)._currentLoadedFile;
      if (!file) throw new Error(`File reference not found for key: ${key}`);
      return await convertIfcInBrowser(file);
    };
  }

  if (typeof api.readFile !== 'function') {
    api.readFile = async (cacheKey: string): Promise<Uint8Array> => {
      const cached = webMemoryCache.get(cacheKey);
      if (cached) return cached;
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
          const bytes = await invoke<number[]>('read_file', { filePath: cacheKey });
          return new Uint8Array(bytes);
        } catch (e) {}
      }
      throw new Error(`Memory cache miss for key: ${cacheKey}`);
    };
  }
}

// Auto-initialize API bridge on module import
ensureApiBridge();
