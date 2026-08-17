import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/supabase-CCCDNKe9.js
var supabaseUrl = "https://ttqgrcmesxrnujmhesnk.supabase.co";
var supabaseAnonKey = "sb_publishable_wT2VLfy-bH-r5ZWi3IcWKQ_QEO0yAfI";
if (typeof window === "undefined" && typeof globalThis !== "undefined") {
	if (!globalThis.WebSocket) globalThis.WebSocket = class DummyWebSocket {
		constructor() {}
		addEventListener() {}
		removeEventListener() {}
		send() {}
		close() {}
	};
}
var supabase = createClient(supabaseUrl, supabaseAnonKey);
//#endregion
export { supabase as t };
