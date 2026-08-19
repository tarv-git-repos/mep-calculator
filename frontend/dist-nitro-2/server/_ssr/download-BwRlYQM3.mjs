import { o as __toESM } from "../_runtime.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as writeFile } from "../_libs/tauri-apps__plugin-fs.mjs";
import { r as save } from "../_libs/tauri-apps__plugin-dialog.mjs";
import { t as require_FileSaver_min } from "../_libs/file-saver.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/download-BwRlYQM3.js
var import_FileSaver_min = /* @__PURE__ */ __toESM(require_FileSaver_min());
function getSaveAsFunction() {
	try {
		if (typeof import_FileSaver_min?.saveAs === "function") return import_FileSaver_min.saveAs;
		if (typeof import_FileSaver_min?.default?.saveAs === "function") return import_FileSaver_min.default.saveAs;
		if (typeof import_FileSaver_min?.default === "function") return import_FileSaver_min.default;
		if (typeof import_FileSaver_min === "function") return import_FileSaver_min;
	} catch (e) {
		console.warn("Failed to resolve fileSaver:", e);
	}
	return null;
}
/**
* Universally handles downloading files on both the Web (Browser) and Tauri Desktop App.
* On Desktop, it natively prompts the user where to save the file.
*/
async function downloadFile(blob, filename, filterName, extensions) {
	if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window || "__TAURI_IPC__" in window)) try {
		const ext = filename.split(".").pop() || "*";
		const path = await save({
			defaultPath: filename,
			filters: [{
				name: filterName || ext.toUpperCase(),
				extensions: extensions || [ext]
			}]
		});
		if (!path) return;
		await writeFile(path, blob instanceof Blob ? new Uint8Array(await blob.arrayBuffer()) : blob);
		toast.success("File saved successfully!");
		return;
	} catch (e) {
		console.error("Tauri save failed, falling back to browser download:", e);
	}
	try {
		const mimeType = filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
		const blobObj = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType });
		const saveAsFn = getSaveAsFunction();
		if (saveAsFn) saveAsFn(blobObj, filename);
		else {
			const url = URL.createObjectURL(blobObj);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(url), 5e3);
		}
	} catch (err) {
		console.error("Download failed:", err);
		toast.error(`Download Error: ${err.message || String(err)}`);
	}
}
//#endregion
export { downloadFile as t };
