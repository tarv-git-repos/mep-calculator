import { r as __exportAll } from "../_runtime.mjs";
import { r as invoke } from "./tauri-apps__api.mjs";
//#region node_modules/@tauri-apps/plugin-process/dist-js/index.js
var dist_js_exports = /* @__PURE__ */ __exportAll({ relaunch: () => relaunch });
/**
* Exits the current instance of the app then relaunches it.
* @example
* ```typescript
* import { relaunch } from '@tauri-apps/plugin-process';
* await relaunch();
* ```
*
* @returns A promise indicating the success or failure of the operation.
*
* @since 2.0.0
*/
async function relaunch() {
	await invoke("plugin:process|restart");
}
//#endregion
export { relaunch as n, dist_js_exports as t };
