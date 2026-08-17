globalThis.__nitro_main__ = import.meta.url;
import { a as toEventHandler, c as NodeResponse, i as defineLazyEventHandler, l as serve, n as HTTPError, r as defineHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { i as withoutTrailingSlash, n as joinURL, r as withLeadingSlash, t as decodePath } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/assets/AuthContext-DmS7AB8j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"28bf-6fADXEZhWEeTeb+qgYtkK0nwLC0\"",
		"mtime": "2026-08-17T11:39:48.328Z",
		"size": 10431,
		"path": "../public/assets/AuthContext-DmS7AB8j.js"
	},
	"/assets/admin-CyJp0sXc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a2a7-eecXnJDWZYk+9gWi+xejB1PUgJ4\"",
		"mtime": "2026-08-17T11:39:48.416Z",
		"size": 107175,
		"path": "../public/assets/admin-CyJp0sXc.js"
	},
	"/assets/api-Bi67w5qv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d19a-ZthfH6oHcXiFGnQb/0PU4zHWKtA\"",
		"mtime": "2026-08-17T11:39:48.465Z",
		"size": 53658,
		"path": "../public/assets/api-Bi67w5qv.js"
	},
	"/assets/busbar-calculation-B_WtDOJg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6841-6WxM3z1rYvpR2/pUcso6jzgGIB4\"",
		"mtime": "2026-08-17T11:39:48.571Z",
		"size": 26689,
		"path": "../public/assets/busbar-calculation-B_WtDOJg.js"
	},
	"/assets/AppShell-D8v0tQU_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2493d-JMK9mXrmUbOhY58cOgCP21S3W5E\"",
		"mtime": "2026-08-17T11:39:48.278Z",
		"size": 149821,
		"path": "../public/assets/AppShell-D8v0tQU_.js"
	},
	"/assets/busbar-voltage-drop-Er91orkb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"49d5-Iq7ldHZbnCFqMAsncPW19W4XP/Q\"",
		"mtime": "2026-08-17T11:39:48.597Z",
		"size": 18901,
		"path": "../public/assets/busbar-voltage-drop-Er91orkb.js"
	},
	"/assets/arrow-right-sgioIv0D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-8zTkHt89nPh2ysnn7UxC0xiQ2GI\"",
		"mtime": "2026-08-17T11:39:48.514Z",
		"size": 153,
		"path": "../public/assets/arrow-right-sgioIv0D.js"
	},
	"/assets/basement-smoke-calc-ChYyDQUQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"60e1-wHmiYh3KviB6nVq+0ngIGiObcFY\"",
		"mtime": "2026-08-17T11:39:48.533Z",
		"size": 24801,
		"path": "../public/assets/basement-smoke-calc-ChYyDQUQ.js"
	},
	"/assets/arrow-left-jFGn2LTL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-Mjziij8+SB2/w7evq1szXKge04A\"",
		"mtime": "2026-08-17T11:39:48.497Z",
		"size": 153,
		"path": "../public/assets/arrow-left-jFGn2LTL.js"
	},
	"/assets/calculator-DvLaY4PX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"206-GQqgYXfkp/NN+HCX80ZWe4dEH+I\"",
		"mtime": "2026-08-17T11:39:48.681Z",
		"size": 518,
		"path": "../public/assets/calculator-DvLaY4PX.js"
	},
	"/assets/cable-voltage-drop-DTwYmE_v.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"489f-E7VHnjd1OYzgmdYM4E2l/l9oZMs\"",
		"mtime": "2026-08-17T11:39:48.653Z",
		"size": 18591,
		"path": "../public/assets/cable-voltage-drop-DTwYmE_v.js"
	},
	"/assets/central-battery-sizing-xgemxAO-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"67c2-IojAqBIcd8fPfwhYVPMbqhqgHhM\"",
		"mtime": "2026-08-17T11:39:48.752Z",
		"size": 26562,
		"path": "../public/assets/central-battery-sizing-xgemxAO-.js"
	},
	"/assets/cable-tray-sizing-UTbvn0SL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8790-QPu78QNUzpVGka7zTytkRLvetJo\"",
		"mtime": "2026-08-17T11:39:48.623Z",
		"size": 34704,
		"path": "../public/assets/cable-tray-sizing-UTbvn0SL.js"
	},
	"/assets/calculators-CqVZib4C.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6e33-F8evzXTVGFVkjU+yE8h0RdHzty4\"",
		"mtime": "2026-08-17T11:39:48.698Z",
		"size": 28211,
		"path": "../public/assets/calculators-CqVZib4C.js"
	},
	"/assets/chw-pipe-sizer-BaTT2eQ-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9782-YmYHpJc7bXFWqvgQbdIqVXfeqVg\"",
		"mtime": "2026-08-17T11:39:48.777Z",
		"size": 38786,
		"path": "../public/assets/chw-pipe-sizer-BaTT2eQ-.js"
	},
	"/assets/chw-pump-head-CHBXhMAy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a433-Xq06S2S3HXXsxZmsODuQ/JCCljQ\"",
		"mtime": "2026-08-17T11:39:48.807Z",
		"size": 42035,
		"path": "../public/assets/chw-pump-head-CHBXhMAy.js"
	},
	"/assets/capacitor-bank-sizing-BBqpblE9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4373-TNeAWuOuDZLoE+hNbdv1sq5+IuE\"",
		"mtime": "2026-08-17T11:39:48.725Z",
		"size": 17267,
		"path": "../public/assets/capacitor-bank-sizing-BBqpblE9.js"
	},
	"/assets/condensate-drain-calc-1a4Ec76q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2fcf-eaNBpXPyNTW2nME1aob+5KLmPqw\"",
		"mtime": "2026-08-17T11:39:48.926Z",
		"size": 12239,
		"path": "../public/assets/condensate-drain-calc-1a4Ec76q.js"
	},
	"/assets/circle-check-DgNNP-sL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-/2imCqYQCjIWjGH6nzylSsPU4nI\"",
		"mtime": "2026-08-17T11:39:48.834Z",
		"size": 166,
		"path": "../public/assets/circle-check-DgNNP-sL.js"
	},
	"/assets/circuit-breaker-sizing-BirGFsDO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5732-7CbbTxjOoMOzsgaGwNxuGuxDIz0\"",
		"mtime": "2026-08-17T11:39:48.873Z",
		"size": 22322,
		"path": "../public/assets/circuit-breaker-sizing-BirGFsDO.js"
	},
	"/assets/circle-question-mark-DN2fAxES.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ec-AQqjnRKjEppEB6HzLwZhkNVh20Q\"",
		"mtime": "2026-08-17T11:39:48.853Z",
		"size": 236,
		"path": "../public/assets/circle-question-mark-DN2fAxES.js"
	},
	"/assets/conductor-sizing-GRG7A-Zg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5e82-Qc2f2teO+r6OXhZqVen48IyI8n8\"",
		"mtime": "2026-08-17T11:39:48.949Z",
		"size": 24194,
		"path": "../public/assets/conductor-sizing-GRG7A-Zg.js"
	},
	"/assets/condensate-drain-CBizC2yi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b52-9dXRKX1cdU1FRRjnqE/km7rbQnw\"",
		"mtime": "2026-08-17T11:39:48.898Z",
		"size": 15186,
		"path": "../public/assets/condensate-drain-CBizC2yi.js"
	},
	"/assets/conversions-GCj7hGJL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f1-GlaMnaUOw3h8fNFkilq1BMpNRZE\"",
		"mtime": "2026-08-17T11:39:48.973Z",
		"size": 497,
		"path": "../public/assets/conversions-GCj7hGJL.js"
	},
	"/assets/core-BFqLT5rb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"745-zkAz33hXLRPZ1d0z6KamQrjAkXg\"",
		"mtime": "2026-08-17T11:39:48.995Z",
		"size": 1861,
		"path": "../public/assets/core-BFqLT5rb.js"
	},
	"/assets/diffuser-selector-mnNVdnu1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c49-RhPUQ5d49CZos+fq0ZP2zP07n8c\"",
		"mtime": "2026-08-17T11:39:49.037Z",
		"size": 11337,
		"path": "../public/assets/diffuser-selector-mnNVdnu1.js"
	},
	"/assets/database-DzqHLng5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7-erqFXGQCJHUnw5S9zK/DktmSBVQ\"",
		"mtime": "2026-08-17T11:39:49.021Z",
		"size": 231,
		"path": "../public/assets/database-DzqHLng5.js"
	},
	"/assets/dist-87QSDKkM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"95fd-hQhiQ0cipo75l7m9W3wvPHt4v1w\"",
		"mtime": "2026-08-17T11:39:49.064Z",
		"size": 38397,
		"path": "../public/assets/dist-87QSDKkM.js"
	},
	"/assets/dist-js-DNCGvLYM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ff-1ZDHQJ6oGq32grhA9XzReArygyM\"",
		"mtime": "2026-08-17T11:39:49.115Z",
		"size": 1023,
		"path": "../public/assets/dist-js-DNCGvLYM.js"
	},
	"/assets/dist-js-C5eqIYwC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72-j57qcLNNzV25+P/cmgzz+98xqrw\"",
		"mtime": "2026-08-17T11:39:49.099Z",
		"size": 114,
		"path": "../public/assets/dist-js-C5eqIYwC.js"
	},
	"/assets/dist-js-mWlZkCFq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"172-g7fnQaRG809JyOj7Le5X51OFO5o\"",
		"mtime": "2026-08-17T11:39:49.136Z",
		"size": 370,
		"path": "../public/assets/dist-js-mWlZkCFq.js"
	},
	"/assets/download-CyllO8Xo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc-HOS7QnmPVXQ16vpsQdAM7XJ8C8s\"",
		"mtime": "2026-08-17T11:39:49.156Z",
		"size": 220,
		"path": "../public/assets/download-CyllO8Xo.js"
	},
	"/assets/droplet-BHWgpaNJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c8-p7uhmbZSVJ754NMCve5gVRSCqKk\"",
		"mtime": "2026-08-17T11:39:49.175Z",
		"size": 200,
		"path": "../public/assets/droplet-BHWgpaNJ.js"
	},
	"/assets/duct-sizer-BVw1nOYr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37c5-nGeCQlWRjGvEyTNh0W4fWsLYq+w\"",
		"mtime": "2026-08-17T11:39:49.196Z",
		"size": 14277,
		"path": "../public/assets/duct-sizer-BVw1nOYr.js"
	},
	"/assets/electrical-network-Dt-tMFls.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1366-wfyN3IsFESWOnzrJfJuXtv/k7YA\"",
		"mtime": "2026-08-17T11:39:49.232Z",
		"size": 4966,
		"path": "../public/assets/electrical-network-Dt-tMFls.js"
	},
	"/assets/equipment-DZVJ8qHw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bb9-63mXhg4+zIGNo8WcCeCWMop4Y0E\"",
		"mtime": "2026-08-17T11:39:49.260Z",
		"size": 15289,
		"path": "../public/assets/equipment-DZVJ8qHw.js"
	},
	"/assets/eye-Co-nw305.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f4-gnZDnf5W+DAeosvw/cOdwlM6brw\"",
		"mtime": "2026-08-17T11:39:49.502Z",
		"size": 244,
		"path": "../public/assets/eye-Co-nw305.js"
	},
	"/assets/FileSaver.min-BvZiQU7D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a81-Jy6giDvb9ZYC00C8iidLJXE2o1M\"",
		"mtime": "2026-08-17T11:39:48.365Z",
		"size": 2689,
		"path": "../public/assets/FileSaver.min-BvZiQU7D.js"
	},
	"/assets/fresh-air-cooling-load-rhKsfc6c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf2-AEaT+TEue5Fk/glMsyQ2a8Li/NE\"",
		"mtime": "2026-08-17T11:39:49.567Z",
		"size": 15602,
		"path": "../public/assets/fresh-air-cooling-load-rhKsfc6c.js"
	},
	"/assets/eye-off-SfyVyF-s.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a2-54O/2NxK0M6Onc4KK65MgzChov4\"",
		"mtime": "2026-08-17T11:39:49.524Z",
		"size": 418,
		"path": "../public/assets/eye-off-SfyVyF-s.js"
	},
	"/assets/heating-load-DJ_mKmX2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"362a-VZBdkUh0H/PRxCLFL8MXB63Bcjc\"",
		"mtime": "2026-08-17T11:39:49.639Z",
		"size": 13866,
		"path": "../public/assets/heating-load-DJ_mKmX2.js"
	},
	"/assets/folder-plus-bQKg9G32.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"126-rCZ0Pfxr02Ik8JhXGGBgpimXG7c\"",
		"mtime": "2026-08-17T11:39:49.547Z",
		"size": 294,
		"path": "../public/assets/folder-plus-bQKg9G32.js"
	},
	"/assets/generator-sizing-KMCo8N6M.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f2df-i1uRC0sLiRAibtt6+Bn2ndkwpLE\"",
		"mtime": "2026-08-17T11:39:49.604Z",
		"size": 62175,
		"path": "../public/assets/generator-sizing-KMCo8N6M.js"
	},
	"/assets/ImportExcelBtn-BYp5xIQN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"509-HM0Tw3+xBrs5keankbOoJAWBjrM\"",
		"mtime": "2026-08-17T11:39:48.394Z",
		"size": 1289,
		"path": "../public/assets/ImportExcelBtn-BYp5xIQN.js"
	},
	"/assets/html2canvas-CLVA0Ark.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b99-sy1E4G2SIiMI6zbWBtfrFwNUxbY\"",
		"mtime": "2026-08-17T11:39:49.667Z",
		"size": 199577,
		"path": "../public/assets/html2canvas-CLVA0Ark.js"
	},
	"/assets/index.es-ZMW733Np.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24f81-lspEY2myjvJWJpmCDY//kl31rsw\"",
		"mtime": "2026-08-17T11:39:49.880Z",
		"size": 151425,
		"path": "../public/assets/index.es-ZMW733Np.js"
	},
	"/assets/exceljs.min-CGHY4pgT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e307c-2xdY+nkeG0nTLAkvWgxBkYweVMs\"",
		"mtime": "2026-08-17T11:39:49.295Z",
		"size": 929916,
		"path": "../public/assets/exceljs.min-CGHY4pgT.js"
	},
	"/assets/load-summary--sIvMj5f.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"384f-iojy0aWKmGK1s7mdsgPARekR/3I\"",
		"mtime": "2026-08-17T11:39:49.975Z",
		"size": 14415,
		"path": "../public/assets/load-summary--sIvMj5f.js"
	},
	"/assets/index-Bxh1_5Mq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1091aa-NxuV57K8GPc3o5EhCV5ZbtAQfcE\"",
		"mtime": "2026-08-17T11:39:47.915Z",
		"size": 1085866,
		"path": "../public/assets/index-Bxh1_5Mq.js"
	},
	"/assets/lock-4tIh0Kro.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c2-QjX1/zElCB/M1osoTbd39l/WDtI\"",
		"mtime": "2026-08-17T11:39:50.042Z",
		"size": 194,
		"path": "../public/assets/lock-4tIh0Kro.js"
	},
	"/assets/lighting-lux-calculation-D_QCVvAz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b72-womaIHn5fwQ/JN2cH+eDiYErlek\"",
		"mtime": "2026-08-17T11:39:49.946Z",
		"size": 15218,
		"path": "../public/assets/lighting-lux-calculation-D_QCVvAz.js"
	},
	"/assets/login-C2hEmzeA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ba4-yk8npU6scT8m7rzN74T6f1fEXdQ\"",
		"mtime": "2026-08-17T11:39:50.061Z",
		"size": 23460,
		"path": "../public/assets/login-C2hEmzeA.js"
	},
	"/assets/lobby-pressurisation-DxUAcBcu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72f4-tTrDCcEZSOq+keYacHRyfyxDJbQ\"",
		"mtime": "2026-08-17T11:39:50.011Z",
		"size": 29428,
		"path": "../public/assets/lobby-pressurisation-DxUAcBcu.js"
	},
	"/assets/lpd-calculation-CGNxRhHr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6636-JI7UZfIUeF9jgzS0mWqfs3wjfhc\"",
		"mtime": "2026-08-17T11:39:50.090Z",
		"size": 26166,
		"path": "../public/assets/lpd-calculation-CGNxRhHr.js"
	},
	"/assets/plumbing-drainage-BA0HsVAm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1615-3fNZjpULtK0h+M9wGHaL91wn4Zo\"",
		"mtime": "2026-08-17T11:39:50.173Z",
		"size": 5653,
		"path": "../public/assets/plumbing-drainage-BA0HsVAm.js"
	},
	"/assets/navigation-B4PzNTkR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7c82-SLSaGi6KFlCAY8fUmGqA2k5vtqQ\"",
		"mtime": "2026-08-17T11:39:50.117Z",
		"size": 31874,
		"path": "../public/assets/navigation-B4PzNTkR.js"
	},
	"/assets/play-BM08r4ym.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2-L+QvNoF47QWlK0CzWTv2jaAbK4o\"",
		"mtime": "2026-08-17T11:39:50.153Z",
		"size": 178,
		"path": "../public/assets/play-BM08r4ym.js"
	},
	"/assets/plumbing-fire-pump-duty-BhWZcr5O.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25b5-c253PHp5iPhNHjRLsWgmbR+vW/M\"",
		"mtime": "2026-08-17T11:39:50.198Z",
		"size": 9653,
		"path": "../public/assets/plumbing-fire-pump-duty-BhWZcr5O.js"
	},
	"/assets/plumbing-fire-tank-capacity-DMOzDvfL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"345a-BpPWTMKUlpGisqEyOvsCJLPzOC4\"",
		"mtime": "2026-08-17T11:39:50.224Z",
		"size": 13402,
		"path": "../public/assets/plumbing-fire-tank-capacity-DMOzDvfL.js"
	},
	"/assets/plumbing-fire-water-demand-Dp6V6vKA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a7b-ZaTh67Zmmjitd41iAP+Tujasua4\"",
		"mtime": "2026-08-17T11:39:50.274Z",
		"size": 10875,
		"path": "../public/assets/plumbing-fire-water-demand-Dp6V6vKA.js"
	},
	"/assets/plumbing-fire-tank-duration-Y6H90gvH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2407-YcqsIcC13RewB4ICyYEgRbfRdng\"",
		"mtime": "2026-08-17T11:39:50.249Z",
		"size": 9223,
		"path": "../public/assets/plumbing-fire-tank-duration-Y6H90gvH.js"
	},
	"/assets/plumbing-fm200-DX1sZUs_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6612-HmeuCzMAY1UE3vSAEqAcr/myDSE\"",
		"mtime": "2026-08-17T11:39:50.340Z",
		"size": 26130,
		"path": "../public/assets/plumbing-fm200-DX1sZUs_.js"
	},
	"/assets/plumbing-fixture-unit-BFNuGQDb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46f8-zuH1coriAqW1xgIqxNm8aq5w9q0\"",
		"mtime": "2026-08-17T11:39:50.299Z",
		"size": 18168,
		"path": "../public/assets/plumbing-fixture-unit-BFNuGQDb.js"
	},
	"/assets/plumbing-gas-tank-JU5KM3th.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"315f-KS2D/v2FuMV7nIIPS9MdnaIlpQs\"",
		"mtime": "2026-08-17T11:39:50.368Z",
		"size": 12639,
		"path": "../public/assets/plumbing-gas-tank-JU5KM3th.js"
	},
	"/assets/plumbing-hazen-williams-5eUqhP_G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"778b-EzWsEqUP38ue3oJncmlcyzamslY\"",
		"mtime": "2026-08-17T11:39:50.395Z",
		"size": 30603,
		"path": "../public/assets/plumbing-hazen-williams-5eUqhP_G.js"
	},
	"/assets/plumbing-loading-unit-CDwu5Mjg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"375f-Nh+V9aWzHAW+6xS74Z29PUh+yU4\"",
		"mtime": "2026-08-17T11:39:50.422Z",
		"size": 14175,
		"path": "../public/assets/plumbing-loading-unit-CDwu5Mjg.js"
	},
	"/assets/plumbing-pressure-vessel-W4VgDFut.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"35a9-VA+VHtT/xmEjRVYu0mlYipLMzrw\"",
		"mtime": "2026-08-17T11:39:50.463Z",
		"size": 13737,
		"path": "../public/assets/plumbing-pressure-vessel-W4VgDFut.js"
	},
	"/assets/plumbing-pump-sizing-DsmBi0ZV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"97e1-dYnXc6l0eA9hqE32G8AoDhM2aXU\"",
		"mtime": "2026-08-17T11:39:50.503Z",
		"size": 38881,
		"path": "../public/assets/plumbing-pump-sizing-DsmBi0ZV.js"
	},
	"/assets/plumbing-sewage-pump-CYD_8d4p.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2359-T/AnnTds/z/zj2Yql0w8hMdRQtE\"",
		"mtime": "2026-08-17T11:39:50.534Z",
		"size": 9049,
		"path": "../public/assets/plumbing-sewage-pump-CYD_8d4p.js"
	},
	"/assets/plumbing-sprinkler-density-yAfulrRE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7d20-SuUI/Z68cTUvclZ7MUqpxJjzQOU\"",
		"mtime": "2026-08-17T11:39:50.559Z",
		"size": 32032,
		"path": "../public/assets/plumbing-sprinkler-density-yAfulrRE.js"
	},
	"/assets/plumbing-sprinkler-kfactor-DQ29jz_B.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"101d7-4s+HZBBanDAJQG8YF9ZJESaClJY\"",
		"mtime": "2026-08-17T11:39:50.587Z",
		"size": 66007,
		"path": "../public/assets/plumbing-sprinkler-kfactor-DQ29jz_B.js"
	},
	"/assets/plumbing-sump-pump-D0LU9PY0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dfc-i3qW+rZsgPxpMmEruRLneR1rk9U\"",
		"mtime": "2026-08-17T11:39:50.649Z",
		"size": 11772,
		"path": "../public/assets/plumbing-sump-pump-D0LU9PY0.js"
	},
	"/assets/plumbing-storm-water-DBH3FAQt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"28ea-ZIn6Mvtmt7I22bPHj9/BPI5YymI\"",
		"mtime": "2026-08-17T11:39:50.622Z",
		"size": 10474,
		"path": "../public/assets/plumbing-storm-water-DBH3FAQt.js"
	},
	"/assets/plumbing-tank-sizing-BQJ66yS4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ef2-VW8fH9QAXsntdg80iF3CXuxoWuM\"",
		"mtime": "2026-08-17T11:39:50.706Z",
		"size": 7922,
		"path": "../public/assets/plumbing-tank-sizing-BQJ66yS4.js"
	},
	"/assets/preload-helper-BcNkJ6ai.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2247-D847jCAP5ERD+46cfjV3zrCHpa8\"",
		"mtime": "2026-08-17T11:39:50.798Z",
		"size": 8775,
		"path": "../public/assets/preload-helper-BcNkJ6ai.js"
	},
	"/assets/plumbing-water-demand-DJuE2MHh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6885-B2W1mJKYjxcEjLt4LoowRus92pY\"",
		"mtime": "2026-08-17T11:39:50.733Z",
		"size": 26757,
		"path": "../public/assets/plumbing-water-demand-DJuE2MHh.js"
	},
	"/assets/plumbing-supply-pipe-sizer-CpOSmTN_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ef5-INbL8svrQUU8RTiYTZ1wtX0PMzk\"",
		"mtime": "2026-08-17T11:39:50.679Z",
		"size": 16117,
		"path": "../public/assets/plumbing-supply-pipe-sizer-CpOSmTN_.js"
	},
	"/assets/preliminary-cooling-load-Cm_9zG8Y.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ce58-T7leBRxei/MUcgca+kKhJCTAq/A\"",
		"mtime": "2026-08-17T11:39:50.761Z",
		"size": 52824,
		"path": "../public/assets/preliminary-cooling-load-Cm_9zG8Y.js"
	},
	"/assets/privacy-BUC8WykN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11ae-R2lCTqQ8TZR9LGUH8NIiaqw3M8M\"",
		"mtime": "2026-08-17T11:39:50.839Z",
		"size": 4526,
		"path": "../public/assets/privacy-BUC8WykN.js"
	},
	"/assets/project-load-schedule-CIMyqBcA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37aa0-QeZ7hDCgFZ5nJc/vDJt2vxYYro8\"",
		"mtime": "2026-08-17T11:39:50.866Z",
		"size": 228e3,
		"path": "../public/assets/project-load-schedule-CIMyqBcA.js"
	},
	"/assets/projects-wdDD_QwZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a02a-UUp9bFtBR3LSyMB0HBkUUjYNwNA\"",
		"mtime": "2026-08-17T11:39:50.944Z",
		"size": 41002,
		"path": "../public/assets/projects-wdDD_QwZ.js"
	},
	"/assets/psychrometric-CXQVeJ6Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3782-YVVmChN94jKFmiBfFllzToPs3k8\"",
		"mtime": "2026-08-17T11:39:51.042Z",
		"size": 14210,
		"path": "../public/assets/psychrometric-CXQVeJ6Q.js"
	},
	"/assets/purify.es-Bu4Grnl0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"65fb-UUUgPD99pIfMSCpTHJ8CGM9NB7I\"",
		"mtime": "2026-08-17T11:39:51.069Z",
		"size": 26107,
		"path": "../public/assets/purify.es-Bu4Grnl0.js"
	},
	"/assets/refrigerant-pipe-sizing-DCXb7OXW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2335-55ONUN9lGbSIKA2qqFCA5n27n0M\"",
		"mtime": "2026-08-17T11:39:51.107Z",
		"size": 9013,
		"path": "../public/assets/refrigerant-pipe-sizing-DCXb7OXW.js"
	},
	"/assets/proxy-CHsxYjb7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e987-29n4yhJtOnjG4bdE9/4lmPhIqPQ\"",
		"mtime": "2026-08-17T11:39:50.982Z",
		"size": 125319,
		"path": "../public/assets/proxy-CHsxYjb7.js"
	},
	"/assets/reports-DXzjaO8W.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7a8-3hruBDF07xFo34uB8eRHkmZP4yQ\"",
		"mtime": "2026-08-17T11:39:51.131Z",
		"size": 1960,
		"path": "../public/assets/reports-DXzjaO8W.js"
	},
	"/assets/project-load-schedule-DLioOiRN.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-lFaZK5XKLiA1ueePpWy3ZyWmewg\"",
		"mtime": "2026-08-17T11:39:51.860Z",
		"size": 15413,
		"path": "../public/assets/project-load-schedule-DLioOiRN.css"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-17T11:39:51.175Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/reset-password-YmuN4KOO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ab7-9NaWLejW6N1aeUjm7uoq3UEMm2k\"",
		"mtime": "2026-08-17T11:39:51.153Z",
		"size": 2743,
		"path": "../public/assets/reset-password-YmuN4KOO.js"
	},
	"/assets/routes-Doja9CyG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"27f1c-ne1RyKiSJeoT4sb2wfVSxshhMsg\"",
		"mtime": "2026-08-17T11:39:51.204Z",
		"size": 163612,
		"path": "../public/assets/routes-Doja9CyG.js"
	},
	"/assets/sanity-check-tool-CfVwgjcV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dea-f9SPgWRE17FFjhMxHFNeOfAfU5s\"",
		"mtime": "2026-08-17T11:39:51.254Z",
		"size": 11754,
		"path": "../public/assets/sanity-check-tool-CfVwgjcV.js"
	},
	"/assets/3d-view-C6fZvkQQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a5534-/dIEhQkFUTLbY+89owvlpJDsNsU\"",
		"mtime": "2026-08-17T11:39:48.143Z",
		"size": 5920052,
		"path": "../public/assets/3d-view-C6fZvkQQ.js"
	},
	"/assets/short-circuit-calculations-k7OeqZvN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"740d-gDwCOEoe51kgQlItCoE6Bb4ZEWk\"",
		"mtime": "2026-08-17T11:39:51.277Z",
		"size": 29709,
		"path": "../public/assets/short-circuit-calculations-k7OeqZvN.js"
	},
	"/assets/smoke-extract-fan-DBAsA2W0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6793-mVPb21EPNBS8YDOAyMWGUNK0cIk\"",
		"mtime": "2026-08-17T11:39:51.302Z",
		"size": 26515,
		"path": "../public/assets/smoke-extract-fan-DBAsA2W0.js"
	},
	"/assets/staircase-pressurization-BSKT8mnZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4476-Zx0DVPOb9OFVfShOoYkOQNGLMTA\"",
		"mtime": "2026-08-17T11:39:51.329Z",
		"size": 17526,
		"path": "../public/assets/staircase-pressurization-BSKT8mnZ.js"
	},
	"/assets/transformer-sizing-CgQju-ek.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"629b-je6NGINcUvRUQgTNd7toshrqR5U\"",
		"mtime": "2026-08-17T11:39:51.442Z",
		"size": 25243,
		"path": "../public/assets/transformer-sizing-CgQju-ek.js"
	},
	"/assets/teams-CzXGJr_z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ace-rEylJ47FQ41qEt92OqZCR11SWvo\"",
		"mtime": "2026-08-17T11:39:51.415Z",
		"size": 6862,
		"path": "../public/assets/teams-CzXGJr_z.js"
	},
	"/assets/supabase-i9O9rBUK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3284f-KKY4kTo0lUwJOvpekcNxSXA4cF8\"",
		"mtime": "2026-08-17T11:39:51.362Z",
		"size": 206927,
		"path": "../public/assets/supabase-i9O9rBUK.js"
	},
	"/assets/tslib.es6-Tae09705.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"42d-qJHuGuq51+EbLaebsBAkbj1JLbk\"",
		"mtime": "2026-08-17T11:39:51.495Z",
		"size": 1069,
		"path": "../public/assets/tslib.es6-Tae09705.js"
	},
	"/assets/trash-CB4AGGJ4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f0-MY8NFW/Yv6oDnFUmoTn8Ut3ygxs\"",
		"mtime": "2026-08-17T11:39:51.473Z",
		"size": 240,
		"path": "../public/assets/trash-CB4AGGJ4.js"
	},
	"/assets/useShortcuts-D13ue_Cw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b0d-qjCU+ZXgDketrdkR6q2yUI7Kdbw\"",
		"mtime": "2026-08-17T11:39:51.637Z",
		"size": 2829,
		"path": "../public/assets/useShortcuts-D13ue_Cw.js"
	},
	"/assets/ups-sizing-calculation-CVVaM0Dx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"552b-ARho+6XgkOaiBWtqYz+3sCSJFn0\"",
		"mtime": "2026-08-17T11:39:51.548Z",
		"size": 21803,
		"path": "../public/assets/ups-sizing-calculation-CVVaM0Dx.js"
	},
	"/assets/typeof-B5XbjTb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f-yPXEOGyFHb1Ws7OoWyWNEEBz4mQ\"",
		"mtime": "2026-08-17T11:39:51.522Z",
		"size": 271,
		"path": "../public/assets/typeof-B5XbjTb1.js"
	},
	"/assets/styles-Cp5Sb4N2.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"413e7-SaVdNMBO9tpRpK6tSER+2fBEROk\"",
		"mtime": "2026-08-17T11:39:51.878Z",
		"size": 267239,
		"path": "../public/assets/styles-Cp5Sb4N2.css"
	},
	"/assets/use-confirm-rXT7zL3g.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"119c3-QHX+LS+9zkKwAtZNMfSSrKXFwm8\"",
		"mtime": "2026-08-17T11:39:51.593Z",
		"size": 72131,
		"path": "../public/assets/use-confirm-rXT7zL3g.js"
	},
	"/assets/workspace-store-CTWg2a40.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c56c-neeiVSNe+OYEmOmcmFdM5X7LmD8\"",
		"mtime": "2026-08-17T11:39:51.684Z",
		"size": 50540,
		"path": "../public/assets/workspace-store-CTWg2a40.js"
	},
	"/assets/ventilation-BfLbnW_m.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47-+J3vxJFgy6LYsWYcNquo9aEsMpQ\"",
		"mtime": "2026-08-17T11:39:51.660Z",
		"size": 71,
		"path": "../public/assets/ventilation-BfLbnW_m.js"
	},
	"/assets/xlsx-BypCUzQ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66dcf-v5fE1ZHiIyXM+ndXVEhWkdB+Sgw\"",
		"mtime": "2026-08-17T11:39:51.721Z",
		"size": 421327,
		"path": "../public/assets/xlsx-BypCUzQ8.js"
	},
	"/assets/zones-B2Dt0_a9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f4c-G7SzYqr3BzZSE5l9RJ2wZbEEteY\"",
		"mtime": "2026-08-17T11:39:51.831Z",
		"size": 16204,
		"path": "../public/assets/zones-B2Dt0_a9.js"
	},
	"/assets/worker-GQlxtHkx.mjs": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"35116f-m5Y7pJ85tGx3dIPUddxTWwrru+g\"",
		"mtime": "2026-08-17T11:39:51.924Z",
		"size": 3477871,
		"path": "../public/assets/worker-GQlxtHkx.mjs"
	}
};
//#endregion
//#region #nitro/virtual/public-assets-node
function readAsset(id) {
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	return promises.readFile(resolve(serverDir, public_assets_data_default[id].path));
}
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
function getAsset(id) {
	return public_assets_data_default[id];
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/static.mjs
var METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
var EncodingMap = {
	gzip: ".gz",
	br: ".br",
	zstd: ".zst"
};
var static_default = defineHandler((event) => {
	if (event.req.method && !METHODS.has(event.req.method)) return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	let asset;
	const encodings = [...(event.req.headers.get("accept-encoding") || "").split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
	for (const encoding of encodings) for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
		const _asset = getAsset(_id);
		if (_asset) {
			asset = _asset;
			id = _id;
			break;
		}
	}
	if (!asset) {
		if (isPublicAssetURL(id)) {
			event.res.headers.delete("Cache-Control");
			throw new HTTPError({ status: 404 });
		}
		return;
	}
	if (encodings.length > 1) event.res.headers.append("Vary", "Accept-Encoding");
	if (event.req.headers.get("if-none-match") === asset.etag) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	const ifModifiedSinceH = event.req.headers.get("if-modified-since");
	const mtimeDate = new Date(asset.mtime);
	if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	if (asset.type) event.res.headers.set("Content-Type", asset.type);
	if (asset.etag && !event.res.headers.has("ETag")) event.res.headers.set("ETag", asset.etag);
	if (asset.mtime && !event.res.headers.has("Last-Modified")) event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
	if (asset.encoding && !event.res.headers.has("Content-Encoding")) event.res.headers.set("Content-Encoding", asset.encoding);
	if (asset.size > 0 && !event.res.headers.has("Content-Length")) event.res.headers.set("Content-Length", asset.size.toString());
	return readAsset(id);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_xNnLi0 = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_xNnLi0
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~middleware"].push(...globalMiddleware);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		middleware.push(...h3App["~middleware"]);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/hooks.mjs
function _captureError(error, type) {
	console.error(`[${type}]`, error);
	useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
	process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
	process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
//#endregion
//#region #nitro/virtual/tracing
var tracingSrvxPlugins = [];
//#endregion
//#region node_modules/nitro/dist/presets/node/runtime/node-server.mjs
var _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
var port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
var host = process.env.NITRO_HOST || process.env.HOST;
var cert = process.env.NITRO_SSL_CERT;
var key = process.env.NITRO_SSL_KEY;
var nitroApp = useNitroApp();
serve({
	port,
	hostname: host,
	tls: cert && key ? {
		cert,
		key
	} : void 0,
	fetch: nitroApp.fetch,
	plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
var node_server_default = {};
//#endregion
export { node_server_default as default };
