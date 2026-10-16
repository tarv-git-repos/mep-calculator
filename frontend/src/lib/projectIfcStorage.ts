/**
 * IndexedDB storage utility for saving and preloading project-specific IFC files.
 * Each project maintains its own isolated IFC model file.
 */
const DB_NAME = "MEP_Calculator_IFC_DB";
const STORE_NAME = "project_ifc_files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function resolveProjectId(projectId?: string | null): string {
  if (projectId && typeof projectId === "string" && projectId.trim() !== "") {
    return projectId.trim();
  }
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("mep_active_project_id");
    if (saved && saved.trim() !== "") return saved.trim();
  }
  return "";
}

export async function saveProjectIfcFile(projectId: string | null | undefined, file: File): Promise<void> {
  const targetId = resolveProjectId(projectId);
  if (!targetId) {
    console.warn("Cannot save IFC file: No active project ID available.");
    return;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record = {
      name: file.name,
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified || Date.now(),
      buffer: arrayBuffer,
      savedAt: Date.now(),
    };
    store.put(record, targetId);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
    console.log(`Saved IFC file "${file.name}" strictly for project ID "${targetId}".`);
  } catch (err) {
    console.warn("Failed to save IFC file to IndexedDB:", err);
  }
}

export async function getProjectIfcFile(projectId?: string | null): Promise<File | null> {
  const targetId = resolveProjectId(projectId);
  if (!targetId) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const req = store.get(targetId);
    const record = await new Promise<any>((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (record && record.buffer) {
      return new File([record.buffer], record.name || "project_model.ifc", {
        type: record.type || "application/octet-stream",
        lastModified: record.lastModified || Date.now(),
      });
    }
  } catch (err) {
    console.warn("Failed to load IFC file from IndexedDB:", err);
  }
  return null;
}

export async function deleteProjectIfcFile(projectId: string): Promise<void> {
  const targetId = resolveProjectId(projectId);
  if (!targetId) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(targetId);
    store.delete(`${targetId}__converted_bim`);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
    console.log(`Purged IFC file and converted BIM cache for project: "${targetId}".`);
  } catch (e) {}
}

export interface ConvertedBimRecord {
  fileName: string;
  fileSize: number;
  fileModified: number;
  fragBuffer: ArrayBuffer;
  jsonStr: string;
  savedAt: number;
}

export async function saveProjectConvertedBim(
  projectId: string | null | undefined,
  data: {
    fileName: string;
    fileSize: number;
    fileModified: number;
    fragBytes: Uint8Array;
    jsonStr: string;
  }
): Promise<void> {
  const targetId = resolveProjectId(projectId);
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const fragBuffer = data.fragBytes.buffer.slice(
      data.fragBytes.byteOffset,
      data.fragBytes.byteOffset + data.fragBytes.byteLength
    );

    const record: ConvertedBimRecord = {
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileModified: data.fileModified,
      fragBuffer,
      jsonStr: data.jsonStr,
      savedAt: Date.now(),
    };

    if (targetId) {
      store.put(record, `${targetId}__converted_bim`);
    }

    const fileKey = `file_${data.fileName}_${data.fileSize}`;
    store.put(record, fileKey);

    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
    console.log(`💾 Persisted pre-converted 3D BIM geometry to IndexedDB (${(fragBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB).`);
  } catch (err) {
    console.warn("Failed to persist converted BIM geometry to IndexedDB:", err);
  }
}

export async function getProjectConvertedBim(
  projectId?: string | null,
  fileRef?: { name: string; size: number; lastModified?: number } | null
): Promise<{ fragBytes: Uint8Array; jsonStr: string; fileName: string } | null> {
  const targetId = resolveProjectId(projectId);
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    let record: ConvertedBimRecord | null = null;

    if (targetId) {
      const req = store.get(`${targetId}__converted_bim`);
      record = await new Promise<any>((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    }

    if ((!record || (fileRef && (record.fileName !== fileRef.name || record.fileSize !== fileRef.size))) && fileRef) {
      const fileKey = `file_${fileRef.name}_${fileRef.size}`;
      const req = store.get(fileKey);
      record = await new Promise<any>((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    }

    if (record && record.fragBuffer && record.jsonStr) {
      if (fileRef) {
        const nameMatches = record.fileName === fileRef.name;
        const sizeMatches = record.fileSize === fileRef.size;
        if (!nameMatches || !sizeMatches) {
          return null;
        }
      }

      return {
        fragBytes: new Uint8Array(record.fragBuffer),
        jsonStr: record.jsonStr,
        fileName: record.fileName,
      };
    }
  } catch (err) {
    console.warn("Failed to retrieve converted BIM geometry from IndexedDB:", err);
  }
  return null;
}
