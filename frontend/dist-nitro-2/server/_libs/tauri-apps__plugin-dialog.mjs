import { r as __exportAll } from "../_runtime.mjs";
import { r as invoke } from "./tauri-apps__api.mjs";
//#region node_modules/@tauri-apps/plugin-dialog/dist-js/index.js
var dist_js_exports = /* @__PURE__ */ __exportAll({
	open: () => open,
	save: () => save
});
/**
* Open a file/directory selection dialog.
*
* The selected paths are added to the filesystem and asset protocol scopes.
* When security is more important than the easy of use of this API,
* prefer writing a dedicated command instead.
*
* Note that the scope change is not persisted, so the values are cleared when the application is restarted.
* You can save it to the filesystem using [tauri-plugin-persisted-scope](https://github.com/tauri-apps/tauri-plugin-persisted-scope).
* @example
* ```typescript
* import { open } from '@tauri-apps/plugin-dialog';
* // Open a selection dialog for image files
* const selected = await open({
*   multiple: true,
*   filters: [{
*     name: 'Image',
*     extensions: ['png', 'jpeg']
*   }]
* });
* if (Array.isArray(selected)) {
*   // user selected multiple files
* } else if (selected === null) {
*   // user cancelled the selection
* } else {
*   // user selected a single file
* }
* ```
*
* @example
* ```typescript
* import { open } from '@tauri-apps/plugin-dialog';
* import { appDir } from '@tauri-apps/api/path';
* // Open a selection dialog for directories
* const selected = await open({
*   directory: true,
*   multiple: true,
*   defaultPath: await appDir(),
* });
* if (Array.isArray(selected)) {
*   // user selected multiple directories
* } else if (selected === null) {
*   // user cancelled the selection
* } else {
*   // user selected a single directory
* }
* ```
*
* @returns A promise resolving to the selected path(s)
*
* @since 2.0.0
*/
async function open(options = {}) {
	if (typeof options === "object") Object.freeze(options);
	return await invoke("plugin:dialog|open", { options });
}
/**
* Open a file/directory save dialog.
*
* The selected path is added to the filesystem and asset protocol scopes.
* When security is more important than the easy of use of this API,
* prefer writing a dedicated command instead.
*
* Note that the scope change is not persisted, so the values are cleared when the application is restarted.
* You can save it to the filesystem using [tauri-plugin-persisted-scope](https://github.com/tauri-apps/tauri-plugin-persisted-scope).
* @example
* ```typescript
* import { save } from '@tauri-apps/plugin-dialog';
* const filePath = await save({
*   filters: [{
*     name: 'Image',
*     extensions: ['png', 'jpeg']
*   }]
* });
* ```
*
* @returns A promise resolving to the selected path.
*
* @since 2.0.0
*/
async function save(options = {}) {
	if (typeof options === "object") Object.freeze(options);
	return await invoke("plugin:dialog|save", { options });
}
//#endregion
export { open as n, save as r, dist_js_exports as t };
