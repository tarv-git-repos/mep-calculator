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
  if (!projectId) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(projectId);
  } catch (e) {}
}
