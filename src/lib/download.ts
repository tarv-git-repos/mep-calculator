import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

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
    } catch (e: any) {
      console.error('Tauri save failed:', e);
      toast.error(`Desktop Save Error: ${e.message || String(e)}`);
      // Fallback
      if (blob instanceof Blob) {
        saveAs(blob, filename);
      } else {
        saveAs(new Blob([blob]), filename);
      }
    }
  } else {
    // Web version
    toast.info("Browser Download Triggered");
    if (blob instanceof Blob) {
      saveAs(blob, filename);
    } else {
      saveAs(new Blob([blob]), filename);
    }
  }
}
