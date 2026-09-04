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
    console.log(`⚡ Instant load: Using cached converted 3D geometry for "${file.name}"`);
    return webConvertedCache.get(cacheKey)!;
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
