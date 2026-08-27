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

async function convertIfcInBrowser(file: File): Promise<{ frag: string; json: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  const localWasmPath = typeof window !== 'undefined' ? `${window.location.origin}/` : './';

  // 1. Generate 3D Fragments geometry
  const geometryGenerator = new GeometryGenerator(localWasmPath);
  const fragResult = await geometryGenerator.generateFragments(fileBytes);
  if (!fragResult) {
    throw new Error('Failed to generate 3D geometry fragments from IFC file.');
  }
  const fragBytes = new Uint8Array(fragResult.buffer ?? fragResult);

  // 2. Extract full IFC metadata, storeys, spaces, polygons & properties
  const parser = new IfcParser();
  await parser.init(localWasmPath);
  parser.openModel(fileBytes);

  let projectTree = null;
  let elements: Record<number, any> = {};

  try {
    const propertyManager = new PropertyManager(parser);
    const relationshipManager = new RelationshipManager(parser);
    const spaceGeometryExtractor = new SpaceGeometryExtractor(parser);
    const cacheManager = new CacheManager(parser, propertyManager, relationshipManager, spaceGeometryExtractor);

    const coordVals = parser.getCoordinationMatrix();
    const coordMatrix = new Matrix4().fromArray(coordVals);

    relationshipManager.extractRelationships();

    const rootIds = parser.getIds(WEBIFC.IFCPROJECT);
    const rootId = rootIds.length > 0 ? rootIds[0] : null;

    projectTree = rootId ? cacheManager.buildTree(rootId, coordMatrix) : null;
    elements = cacheManager.buildElements(coordMatrix);
  } finally {
    parser.closeModel();
  }

  const jsonStr = JSON.stringify({ project: projectTree, elements }, null, 2);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  const fragId = `web-cache-${Date.now()}.frag`;
  const jsonId = `web-cache-${Date.now()}.json`;

  webMemoryCache.set(fragId, fragBytes);
  webMemoryCache.set(jsonId, jsonBytes);

  return { frag: fragId, json: jsonId };
}

if (isElectron) {
  console.log('✅ Electron API bridge active.');
} else if (isTauri) {
  (window as any).api = {
    getFilePath: (file: File): string => {
      const key = (file as any).path || file.name;
      webFileStore.set(key, file);
      webFileStore.set(file.name, file);
      return key;
    },
    processIfc: async (fp: string): Promise<{ frag: string; json: string }> => {
      try {
        return await invoke<{ frag: string; json: string }>('process_ifc', { filePath: fp });
      } catch (err) {
        console.warn('⚠️ Native IPC converter unavailable in Tauri, using full WebAssembly metadata parser:', err);
        const file = webFileStore.get(fp);
        if (file) {
          return await convertIfcInBrowser(file);
        }
        throw err;
      }
    },
    readFile: async (fp: string): Promise<Uint8Array> => {
      if (webMemoryCache.has(fp)) {
        return webMemoryCache.get(fp)!;
      }
      const bytes = await invoke<number[]>('read_file', { filePath: fp });
      return new Uint8Array(bytes);
    }
  };
  console.log('✅ Tauri API bridge initialized with full metadata extraction.');
} else {
  // Web Browser Fallback (e.g. http://localhost:5174 or public website)
  (window as any).api = {
    getFilePath: (file: File): string => {
      const key = (file as any).path || file.name;
      webFileStore.set(key, file);
      webFileStore.set(file.name, file);
      return key;
    },
    processIfc: async (key: string): Promise<{ frag: string; json: string }> => {
      const file = webFileStore.get(key);
      if (!file) throw new Error(`File reference not found for key: ${key}`);
      return await convertIfcInBrowser(file);
    },
    readFile: async (cacheKey: string): Promise<Uint8Array> => {
      const cached = webMemoryCache.get(cacheKey);
      if (!cached) throw new Error(`Memory cache miss for key: ${cacheKey}`);
      return cached;
    }
  };
  console.log('🌐 Web Browser Fallback API bridge initialized with full metadata extraction.');
}
