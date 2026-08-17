import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "./@floating-ui/react-dom+[...].mjs";
import { l as require_with_selector, u as createStore } from "./@xyflow/react+[...].mjs";
//#region node_modules/zustand/esm/index.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_with_selector = /* @__PURE__ */ __toESM(require_with_selector(), 1);
var { useDebugValue } = import_react.default;
var { useSyncExternalStoreWithSelector } = import_with_selector.default;
var identity = (arg) => arg;
function useStore(api, selector = identity, equalityFn) {
	const slice = useSyncExternalStoreWithSelector(api.subscribe, api.getState, api.getServerState || api.getInitialState, selector, equalityFn);
	useDebugValue(slice);
	return slice;
}
var createImpl = (createState) => {
	const api = typeof createState === "function" ? createStore(createState) : createState;
	const useBoundStore = (selector, equalityFn) => useStore(api, selector, equalityFn);
	Object.assign(useBoundStore, api);
	return useBoundStore;
};
var create = (createState) => createState ? createImpl(createState) : createImpl;
//#endregion
export { create as t };
