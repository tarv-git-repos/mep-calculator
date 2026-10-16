import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import * as fileSaver from 'file-saver';
import { toast } from 'sonner';

function getSaveAsFunction() {
  try {
    if (typeof (fileSaver as any)?.saveAs === 'function') return (fileSaver as any).saveAs;
    if (typeof (fileSaver as any)?.default?.saveAs === 'function') return (fileSaver as any).default.saveAs;
    if (typeof (fileSaver as any)?.default === 'function') return (fileSaver as any).default;
    if (typeof fileSaver === 'function') return fileSaver;
  } catch (e) {
    console.warn("Failed to resolve fileSaver:", e);
  }
  return null;
}

/**
 * Universally handles downloading files on both the Web (Browser) and Tauri Desktop App.
 * On Desktop, it natively prompts the user where to save the file.
 */
export async function downloadFile(
  blob: Blob | Uint8Array,
  filename: string,
  filterName?: string,
  extensions?: string[]
) {
  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_IPC__' in window);
  
  if (isTauri) {
    try {
      const ext = filename.split('.').pop() || '*';
      const path = await save({
        defaultPath: filename,
        filters: [{
          name: filterName || ext.toUpperCase(),
          extensions: extensions || [ext]
        }]
      });
      
      if (!path) return; // user cancelled

      const buffer = blob instanceof Blob 
        ? new Uint8Array(await blob.arrayBuffer()) 
        : blob;
        
      await writeFile(path, buffer);
      toast.success("File saved successfully!");
      return;
    } catch (e: any) {
      console.error('Tauri save failed, falling back to browser download:', e);
    }
  }

  // Web / Fallback version
  try {
    const mimeType = filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
    const blobObj = blob instanceof Blob ? blob : new Blob([blob as any], { type: mimeType });
    const saveAsFn = getSaveAsFunction();
    if (saveAsFn) {
      saveAsFn(blobObj, filename);
    } else {
      const url = URL.createObjectURL(blobObj);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch (err: any) {
    console.error('Download failed:', err);
    toast.error(`Download Error: ${err.message || String(err)}`);
  }
}

