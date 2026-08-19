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
	"/assets/api-CXyV4iib.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d897-twsOPn0LZTFg545yEd4qjp8d3lI\"",
		"mtime": "2026-08-19T05:16:34.475Z",
		"size": 55447,
		"path": "../public/assets/api-CXyV4iib.js"
	},
	"/assets/admin-CfRncBxk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a298-fBYV34sWxafc32yD+szCMDUuRdU\"",
		"mtime": "2026-08-19T05:16:34.431Z",
		"size": 107160,
		"path": "../public/assets/admin-CfRncBxk.js"
	},
	"/assets/AppShell-BDiiU5fS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2534a-rKBSNSmcdBfehzzdSvszRKBjPgk\"",
		"mtime": "2026-08-19T05:16:34.288Z",
		"size": 152394,
		"path": "../public/assets/AppShell-BDiiU5fS.js"
	},
	"/assets/arrow-right-sgioIv0D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-8zTkHt89nPh2ysnn7UxC0xiQ2GI\"",
		"mtime": "2026-08-19T05:16:34.517Z",
		"size": 153,
		"path": "../public/assets/arrow-right-sgioIv0D.js"
	},
	"/assets/busbar-voltage-drop-Bg7ARS3T.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a38-Lhs1SnvA1W59bmipWFR4VsdaZGE\"",
		"mtime": "2026-08-19T05:16:34.587Z",
		"size": 19e3,
		"path": "../public/assets/busbar-voltage-drop-Bg7ARS3T.js"
	},
	"/assets/arrow-left-jFGn2LTL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-Mjziij8+SB2/w7evq1szXKge04A\"",
		"mtime": "2026-08-19T05:16:34.505Z",
		"size": 153,
		"path": "../public/assets/arrow-left-jFGn2LTL.js"
	},
	"/assets/basement-smoke-calc-Da_zn-KN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"60e1-kZWqmxcEjkZ3l5nD0veQ9A/ALMk\"",
		"mtime": "2026-08-19T05:16:34.527Z",
		"size": 24801,
		"path": "../public/assets/basement-smoke-calc-Da_zn-KN.js"
	},
	"/assets/busbar-calculation-pa5DgA-p.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"690c-FnQFaj8xHPSoZvp/vtIPB/LB9Ng\"",
		"mtime": "2026-08-19T05:16:34.557Z",
		"size": 26892,
		"path": "../public/assets/busbar-calculation-pa5DgA-p.js"
	},
	"/assets/AuthContext-FyjnFCUV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"263b-6c8owItvCkZCKsIR3qRMk8muHEg\"",
		"mtime": "2026-08-19T05:16:34.341Z",
		"size": 9787,
		"path": "../public/assets/AuthContext-FyjnFCUV.js"
	},
	"/assets/cable-voltage-drop-JWAhACif.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48f7-SzRlXRuqPC5P04MNiaEPX5zlZL8\"",
		"mtime": "2026-08-19T05:16:34.651Z",
		"size": 18679,
		"path": "../public/assets/cable-voltage-drop-JWAhACif.js"
	},
	"/assets/calculator-DvLaY4PX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"206-GQqgYXfkp/NN+HCX80ZWe4dEH+I\"",
		"mtime": "2026-08-19T05:16:34.678Z",
		"size": 518,
		"path": "../public/assets/calculator-DvLaY4PX.js"
	},
	"/assets/cable-tray-sizing-BTa3Tnxi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8856-SuxJl7v78VrP8kGFOq/+R8Dy5xA\"",
		"mtime": "2026-08-19T05:16:34.617Z",
		"size": 34902,
		"path": "../public/assets/cable-tray-sizing-BTa3Tnxi.js"
	},
	"/assets/calculators-BvyI7rd9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6e33-Cv9S63L+fd9JP1h/VXPXmPiSYAY\"",
		"mtime": "2026-08-19T05:16:34.698Z",
		"size": 28211,
		"path": "../public/assets/calculators-BvyI7rd9.js"
	},
	"/assets/central-battery-sizing-D1wUg3co.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6891-fe62YezRmwZn3+fklyKwds8ViOs\"",
		"mtime": "2026-08-19T05:16:34.750Z",
		"size": 26769,
		"path": "../public/assets/central-battery-sizing-D1wUg3co.js"
	},
	"/assets/capacitor-bank-sizing-ZuBGsZEZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4437-zOCpST2pJbvsuKvGobHH9ToRJ60\"",
		"mtime": "2026-08-19T05:16:34.723Z",
		"size": 17463,
		"path": "../public/assets/capacitor-bank-sizing-ZuBGsZEZ.js"
	},
	"/assets/chw-pipe-sizer-DJG2URYQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"983a-jVPs+658bbuAniiGEHmIKnGldx0\"",
		"mtime": "2026-08-19T05:16:34.780Z",
		"size": 38970,
		"path": "../public/assets/chw-pipe-sizer-DJG2URYQ.js"
	},
	"/assets/circle-check-DgNNP-sL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-/2imCqYQCjIWjGH6nzylSsPU4nI\"",
		"mtime": "2026-08-19T05:16:34.837Z",
		"size": 166,
		"path": "../public/assets/circle-check-DgNNP-sL.js"
	},
	"/assets/circuit-breaker-sizing-qCAkMJHl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"57f7-oUF1MmVSyD/AzEJOZ4T4ROPv4+I\"",
		"mtime": "2026-08-19T05:16:34.860Z",
		"size": 22519,
		"path": "../public/assets/circuit-breaker-sizing-qCAkMJHl.js"
	},
	"/assets/circle-question-mark-DN2fAxES.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ec-AQqjnRKjEppEB6HzLwZhkNVh20Q\"",
		"mtime": "2026-08-19T05:16:34.841Z",
		"size": 236,
		"path": "../public/assets/circle-question-mark-DN2fAxES.js"
	},
	"/assets/condensate-drain-calc-B1gf3oHa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2fcf-s2UuXmEw+ajZgWGK6asPkGC/Dew\"",
		"mtime": "2026-08-19T05:16:34.911Z",
		"size": 12239,
		"path": "../public/assets/condensate-drain-calc-B1gf3oHa.js"
	},
	"/assets/condensate-drain-C1TqvwFK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b52-pgJR/WdU20XltczFwSAjZfrhQcA\"",
		"mtime": "2026-08-19T05:16:34.889Z",
		"size": 15186,
		"path": "../public/assets/condensate-drain-C1TqvwFK.js"
	},
	"/assets/chw-pump-head-B5oB69If.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a4f9-Mb8lIjo96tLVYtejIL8aZBBdeYg\"",
		"mtime": "2026-08-19T05:16:34.812Z",
		"size": 42233,
		"path": "../public/assets/chw-pump-head-B5oB69If.js"
	},
	"/assets/conversions-GCj7hGJL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f1-GlaMnaUOw3h8fNFkilq1BMpNRZE\"",
		"mtime": "2026-08-19T05:16:34.960Z",
		"size": 497,
		"path": "../public/assets/conversions-GCj7hGJL.js"
	},
	"/assets/conductor-sizing-DB-4SYvX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5edf-HvGErYHHJcxqMB7OtSlwCnSv99Q\"",
		"mtime": "2026-08-19T05:16:34.936Z",
		"size": 24287,
		"path": "../public/assets/conductor-sizing-DB-4SYvX.js"
	},
	"/assets/core-BFqLT5rb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"745-zkAz33hXLRPZ1d0z6KamQrjAkXg\"",
		"mtime": "2026-08-19T05:16:34.982Z",
		"size": 1861,
		"path": "../public/assets/core-BFqLT5rb.js"
	},
	"/assets/database-DzqHLng5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7-erqFXGQCJHUnw5S9zK/DktmSBVQ\"",
		"mtime": "2026-08-19T05:16:34.987Z",
		"size": 231,
		"path": "../public/assets/database-DzqHLng5.js"
	},
	"/assets/dist-js-mWlZkCFq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"172-g7fnQaRG809JyOj7Le5X51OFO5o\"",
		"mtime": "2026-08-19T05:16:35.049Z",
		"size": 370,
		"path": "../public/assets/dist-js-mWlZkCFq.js"
	},
	"/assets/diffuser-selector-BnW_vZlR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c49-+12SXbPSIjbRsR6+uJN59VQZL4o\"",
		"mtime": "2026-08-19T05:16:34.991Z",
		"size": 11337,
		"path": "../public/assets/diffuser-selector-BnW_vZlR.js"
	},
	"/assets/dist-87QSDKkM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"95fd-hQhiQ0cipo75l7m9W3wvPHt4v1w\"",
		"mtime": "2026-08-19T05:16:35.015Z",
		"size": 38397,
		"path": "../public/assets/dist-87QSDKkM.js"
	},
	"/assets/droplet-BHWgpaNJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c8-p7uhmbZSVJ754NMCve5gVRSCqKk\"",
		"mtime": "2026-08-19T05:16:35.056Z",
		"size": 200,
		"path": "../public/assets/droplet-BHWgpaNJ.js"
	},
	"/assets/download-CyllO8Xo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc-HOS7QnmPVXQ16vpsQdAM7XJ8C8s\"",
		"mtime": "2026-08-19T05:16:35.053Z",
		"size": 220,
		"path": "../public/assets/download-CyllO8Xo.js"
	},
	"/assets/duct-sizer-BT4cpxkZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37c5-clH9cVb6Flfeb8lmnx4mKT5tMyE\"",
		"mtime": "2026-08-19T05:16:35.061Z",
		"size": 14277,
		"path": "../public/assets/duct-sizer-BT4cpxkZ.js"
	},
	"/assets/eye-Co-nw305.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f4-gnZDnf5W+DAeosvw/cOdwlM6brw\"",
		"mtime": "2026-08-19T05:16:35.457Z",
		"size": 244,
		"path": "../public/assets/eye-Co-nw305.js"
	},
	"/assets/electrical-network-bDqdO0uB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1366-C0klwOoaX1zrGHZcPdt5Xs2Duz8\"",
		"mtime": "2026-08-19T05:16:35.084Z",
		"size": 4966,
		"path": "../public/assets/electrical-network-bDqdO0uB.js"
	},
	"/assets/excelHelpers-BVjZkoOe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b9-WqugWUrTdkk/o9bPy5qQZVrMCg8\"",
		"mtime": "2026-08-19T05:16:35.113Z",
		"size": 953,
		"path": "../public/assets/excelHelpers-BVjZkoOe.js"
	},
	"/assets/equipment-CHXtbNns.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bb9-v1LYxSSRURl3xYLdLuJm4ZqLdo4\"",
		"mtime": "2026-08-19T05:16:35.091Z",
		"size": 15289,
		"path": "../public/assets/equipment-CHXtbNns.js"
	},
	"/assets/eye-off-SfyVyF-s.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a2-54O/2NxK0M6Onc4KK65MgzChov4\"",
		"mtime": "2026-08-19T05:16:35.461Z",
		"size": 418,
		"path": "../public/assets/eye-off-SfyVyF-s.js"
	},
	"/assets/folder-plus-bQKg9G32.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"126-rCZ0Pfxr02Ik8JhXGGBgpimXG7c\"",
		"mtime": "2026-08-19T05:16:35.465Z",
		"size": 294,
		"path": "../public/assets/folder-plus-bQKg9G32.js"
	},
	"/assets/FileSaver.min-BvZiQU7D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a81-Jy6giDvb9ZYC00C8iidLJXE2o1M\"",
		"mtime": "2026-08-19T05:16:34.370Z",
		"size": 2689,
		"path": "../public/assets/FileSaver.min-BvZiQU7D.js"
	},
	"/assets/fresh-air-cooling-load-BWbmplJ5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf2-HB2eYNK+AlwXOcA96EL+IiWFjMk\"",
		"mtime": "2026-08-19T05:16:35.486Z",
		"size": 15602,
		"path": "../public/assets/fresh-air-cooling-load-BWbmplJ5.js"
	},
	"/assets/heating-load-CHU0rqgB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"362a-PGybdTgekCGTUPo2PWgvEaUnT58\"",
		"mtime": "2026-08-19T05:16:35.550Z",
		"size": 13866,
		"path": "../public/assets/heating-load-CHU0rqgB.js"
	},
	"/assets/generator-sizing-B5EfbryU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ed1a-4MRd0H1/YLJp7802Mm0qWcx6Ofk\"",
		"mtime": "2026-08-19T05:16:35.516Z",
		"size": 60698,
		"path": "../public/assets/generator-sizing-B5EfbryU.js"
	},
	"/assets/html2canvas-CLVA0Ark.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b99-sy1E4G2SIiMI6zbWBtfrFwNUxbY\"",
		"mtime": "2026-08-19T05:16:35.592Z",
		"size": 199577,
		"path": "../public/assets/html2canvas-CLVA0Ark.js"
	},
	"/assets/exceljs.min-CGHY4pgT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e307c-2xdY+nkeG0nTLAkvWgxBkYweVMs\"",
		"mtime": "2026-08-19T05:16:35.243Z",
		"size": 929916,
		"path": "../public/assets/exceljs.min-CGHY4pgT.js"
	},
	"/assets/ImportExcelBtn-IPML889K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"509-dmozMvcmpfrcfcMFDDGTlXRAfM8\"",
		"mtime": "2026-08-19T05:16:34.401Z",
		"size": 1289,
		"path": "../public/assets/ImportExcelBtn-IPML889K.js"
	},
	"/assets/lighting-lux-calculation-C-r53pmZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bca-RGDMXkWVzR1T9yWh5gI/vBnUlx0\"",
		"mtime": "2026-08-19T05:16:35.881Z",
		"size": 15306,
		"path": "../public/assets/lighting-lux-calculation-C-r53pmZ.js"
	},
	"/assets/index.es-ZMW733Np.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24f81-lspEY2myjvJWJpmCDY//kl31rsw\"",
		"mtime": "2026-08-19T05:16:35.815Z",
		"size": 151425,
		"path": "../public/assets/index.es-ZMW733Np.js"
	},
	"/assets/index-C6GdMGC4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10bc20-3wr7Chggi300GAky7jwJz7QP60E\"",
		"mtime": "2026-08-19T05:16:33.453Z",
		"size": 1096736,
		"path": "../public/assets/index-C6GdMGC4.js"
	},
	"/assets/lobby-pressurisation-DMb3lyT1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72f4-4jOl1BxgNrKalpz0Gbg1E43FQSc\"",
		"mtime": "2026-08-19T05:16:35.937Z",
		"size": 29428,
		"path": "../public/assets/lobby-pressurisation-DMb3lyT1.js"
	},
	"/assets/load-summary-CkiPQeZx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"38b1-sQKtiAl6UWB8wbU+DfwC6R3D6/w\"",
		"mtime": "2026-08-19T05:16:35.907Z",
		"size": 14513,
		"path": "../public/assets/load-summary-CkiPQeZx.js"
	},
	"/assets/lock-4tIh0Kro.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c2-QjX1/zElCB/M1osoTbd39l/WDtI\"",
		"mtime": "2026-08-19T05:16:35.983Z",
		"size": 194,
		"path": "../public/assets/lock-4tIh0Kro.js"
	},
	"/assets/login-CFuwtT6I.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ba4-npiu2/X5rnr/JRxSbOuk/V3m/Yk\"",
		"mtime": "2026-08-19T05:16:35.989Z",
		"size": 23460,
		"path": "../public/assets/login-CFuwtT6I.js"
	},
	"/assets/plumbing-fire-pump-duty-4c8K9_SH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2612-3HobbFFgolUM4nDJHHwoSwUfnLA\"",
		"mtime": "2026-08-19T05:16:36.116Z",
		"size": 9746,
		"path": "../public/assets/plumbing-fire-pump-duty-4c8K9_SH.js"
	},
	"/assets/plumbing-drainage-bWZZbUJA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1615-Nh1PtYqkro+iDz+sxij5ne5O9UI\"",
		"mtime": "2026-08-19T05:16:36.093Z",
		"size": 5653,
		"path": "../public/assets/plumbing-drainage-bWZZbUJA.js"
	},
	"/assets/navigation-B4PzNTkR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7c82-SLSaGi6KFlCAY8fUmGqA2k5vtqQ\"",
		"mtime": "2026-08-19T05:16:36.041Z",
		"size": 31874,
		"path": "../public/assets/navigation-B4PzNTkR.js"
	},
	"/assets/lpd-calculation-tBEIRW4k.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6636-LUByEn5DXilh+pDZ53RXLGXEryI\"",
		"mtime": "2026-08-19T05:16:36.016Z",
		"size": 26166,
		"path": "../public/assets/lpd-calculation-tBEIRW4k.js"
	},
	"/assets/plumbing-fire-tank-capacity-B1zMCBSR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"34b7-UjPiSW74o1B2KerUE38O6oIBU/o\"",
		"mtime": "2026-08-19T05:16:36.141Z",
		"size": 13495,
		"path": "../public/assets/plumbing-fire-tank-capacity-B1zMCBSR.js"
	},
	"/assets/plumbing-fixture-unit-CK3H-6kR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46f8-a1oX8rSj9iivKewHGAjWXhrIeJA\"",
		"mtime": "2026-08-19T05:16:36.218Z",
		"size": 18168,
		"path": "../public/assets/plumbing-fixture-unit-CK3H-6kR.js"
	},
	"/assets/play-BM08r4ym.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2-L+QvNoF47QWlK0CzWTv2jaAbK4o\"",
		"mtime": "2026-08-19T05:16:36.075Z",
		"size": 178,
		"path": "../public/assets/play-BM08r4ym.js"
	},
	"/assets/plumbing-fire-tank-duration-BO9aGQ4C.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2407-tSozFjLagmjibCCA4cahNyVqzOY\"",
		"mtime": "2026-08-19T05:16:36.166Z",
		"size": 9223,
		"path": "../public/assets/plumbing-fire-tank-duration-BO9aGQ4C.js"
	},
	"/assets/plumbing-gas-tank-D08GU3FC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31bc-j8SRzYboTYPt5P9uIQkvOqO/7vI\"",
		"mtime": "2026-08-19T05:16:36.274Z",
		"size": 12732,
		"path": "../public/assets/plumbing-gas-tank-D08GU3FC.js"
	},
	"/assets/plumbing-fire-water-demand-Oz-QcvT9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ad8-IE0LnZGgoZxBhc7vBnEUuhyTdyo\"",
		"mtime": "2026-08-19T05:16:36.191Z",
		"size": 10968,
		"path": "../public/assets/plumbing-fire-water-demand-Oz-QcvT9.js"
	},
	"/assets/plumbing-fm200-Df0JuCrp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66cf-z3nB+G4tZ02pDPVyLsoQwe8S92A\"",
		"mtime": "2026-08-19T05:16:36.246Z",
		"size": 26319,
		"path": "../public/assets/plumbing-fm200-Df0JuCrp.js"
	},
	"/assets/plumbing-loading-unit-BxGvIDIm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"375f-C6RRUDH6NlPAYvT1HraipzPtkMk\"",
		"mtime": "2026-08-19T05:16:36.328Z",
		"size": 14175,
		"path": "../public/assets/plumbing-loading-unit-BxGvIDIm.js"
	},
	"/assets/plumbing-pump-sizing-DaZmFuwj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"984c-HABSisZI4s6+wQVpFL1HyWqTrAw\"",
		"mtime": "2026-08-19T05:16:36.382Z",
		"size": 38988,
		"path": "../public/assets/plumbing-pump-sizing-DaZmFuwj.js"
	},
	"/assets/plumbing-hazen-williams-D7qUDldG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784c-+6B/2gftF3Jn1xjmOQTWFD8s6nM\"",
		"mtime": "2026-08-19T05:16:36.299Z",
		"size": 30796,
		"path": "../public/assets/plumbing-hazen-williams-D7qUDldG.js"
	},
	"/assets/plumbing-pressure-vessel-CmKCglcw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3606-ERJG8RUmp8HOCJFriD0hu9GpEew\"",
		"mtime": "2026-08-19T05:16:36.354Z",
		"size": 13830,
		"path": "../public/assets/plumbing-pressure-vessel-CmKCglcw.js"
	},
	"/assets/plumbing-sewage-pump-CPTKxm0G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23b6-N7ggsfn0Vijzgxv+Lx6qsiy0zeY\"",
		"mtime": "2026-08-19T05:16:36.408Z",
		"size": 9142,
		"path": "../public/assets/plumbing-sewage-pump-CPTKxm0G.js"
	},
	"/assets/plumbing-sprinkler-density-DCb8RKtg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7de4-pNmwjuXRtGzk/SSwjqaoFh+p8uM\"",
		"mtime": "2026-08-19T05:16:36.433Z",
		"size": 32228,
		"path": "../public/assets/plumbing-sprinkler-density-DCb8RKtg.js"
	},
	"/assets/plumbing-sprinkler-kfactor-CbbctkDz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"102a7-WuOL7vFLM1DHktCMKQykIuBqL5I\"",
		"mtime": "2026-08-19T05:16:36.463Z",
		"size": 66215,
		"path": "../public/assets/plumbing-sprinkler-kfactor-CbbctkDz.js"
	},
	"/assets/plumbing-storm-water-DOlcrlqk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2947-dSFVqbNPe5CgVW2fcTEfv1xu9TM\"",
		"mtime": "2026-08-19T05:16:36.496Z",
		"size": 10567,
		"path": "../public/assets/plumbing-storm-water-DOlcrlqk.js"
	},
	"/assets/plumbing-sump-pump-CikfmdEZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e5f-T8FLBI+wwBkRR/cCAQJ0YyDHLgE\"",
		"mtime": "2026-08-19T05:16:36.519Z",
		"size": 11871,
		"path": "../public/assets/plumbing-sump-pump-CikfmdEZ.js"
	},
	"/assets/plumbing-tank-sizing-D0OHbZz3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f4f-s/IBB1cI0hJ9kMUVqLXcnD2vfng\"",
		"mtime": "2026-08-19T05:16:36.567Z",
		"size": 8015,
		"path": "../public/assets/plumbing-tank-sizing-D0OHbZz3.js"
	},
	"/assets/plumbing-supply-pipe-sizer-D4AEsUMC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ef5-q2oCjXIfyJUJl0Aw1lJWHPS+XE0\"",
		"mtime": "2026-08-19T05:16:36.544Z",
		"size": 16117,
		"path": "../public/assets/plumbing-supply-pipe-sizer-D4AEsUMC.js"
	},
	"/assets/plumbing-water-demand-Bv20kV1u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6885-7+eFaEVH2AvRXmOlLC6yodTY+HY\"",
		"mtime": "2026-08-19T05:16:36.592Z",
		"size": 26757,
		"path": "../public/assets/plumbing-water-demand-Bv20kV1u.js"
	},
	"/assets/preload-helper-BcNkJ6ai.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2247-D847jCAP5ERD+46cfjV3zrCHpa8\"",
		"mtime": "2026-08-19T05:16:36.651Z",
		"size": 8775,
		"path": "../public/assets/preload-helper-BcNkJ6ai.js"
	},
	"/assets/preliminary-cooling-load-Cx9Iqlj1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"cf26-nc+hvZuZtsF/eh6tPG+qrEUeOUk\"",
		"mtime": "2026-08-19T05:16:36.621Z",
		"size": 53030,
		"path": "../public/assets/preliminary-cooling-load-Cx9Iqlj1.js"
	},
	"/assets/privacy-BrHIbF4c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11ae-z/WptuWvL+TYbm81z8DlOdhRGfo\"",
		"mtime": "2026-08-19T05:16:36.690Z",
		"size": 4526,
		"path": "../public/assets/privacy-BrHIbF4c.js"
	},
	"/assets/psychrometric-BCdWhe_G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3782-MaTt9Mg8fsP8uybzBG5+haHjWjo\"",
		"mtime": "2026-08-19T05:16:36.897Z",
		"size": 14210,
		"path": "../public/assets/psychrometric-BCdWhe_G.js"
	},
	"/assets/project-load-schedule-B2gBV8rW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37b08-d7UJZL41szyB5hKXizgR+GlNjqg\"",
		"mtime": "2026-08-19T05:16:36.731Z",
		"size": 228104,
		"path": "../public/assets/project-load-schedule-B2gBV8rW.js"
	},
	"/assets/projects-DohdGZra.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a02a-19+xxnsUbef+SJ414kmn62/GrbQ\"",
		"mtime": "2026-08-19T05:16:36.805Z",
		"size": 41002,
		"path": "../public/assets/projects-DohdGZra.js"
	},
	"/assets/purify.es-Bu4Grnl0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"65fb-UUUgPD99pIfMSCpTHJ8CGM9NB7I\"",
		"mtime": "2026-08-19T05:16:36.925Z",
		"size": 26107,
		"path": "../public/assets/purify.es-Bu4Grnl0.js"
	},
	"/assets/proxy-CHsxYjb7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e987-29n4yhJtOnjG4bdE9/4lmPhIqPQ\"",
		"mtime": "2026-08-19T05:16:36.842Z",
		"size": 125319,
		"path": "../public/assets/proxy-CHsxYjb7.js"
	},
	"/assets/refrigerant-pipe-sizing-BArRcRQD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2335-tWLEE+iCe+hp/GYKlvEkpYgRJuw\"",
		"mtime": "2026-08-19T05:16:36.960Z",
		"size": 9013,
		"path": "../public/assets/refrigerant-pipe-sizing-BArRcRQD.js"
	},
	"/assets/reset-password-YmuN4KOO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ab7-9NaWLejW6N1aeUjm7uoq3UEMm2k\"",
		"mtime": "2026-08-19T05:16:37.002Z",
		"size": 2743,
		"path": "../public/assets/reset-password-YmuN4KOO.js"
	},
	"/assets/reports-BzdGQZyc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7a8-s/469fg8hZqhsnqYBnJMDs/Mcyg\"",
		"mtime": "2026-08-19T05:16:36.983Z",
		"size": 1960,
		"path": "../public/assets/reports-BzdGQZyc.js"
	},
	"/assets/project-load-schedule-DLioOiRN.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-lFaZK5XKLiA1ueePpWy3ZyWmewg\"",
		"mtime": "2026-08-19T05:16:37.598Z",
		"size": 15413,
		"path": "../public/assets/project-load-schedule-DLioOiRN.css"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-19T05:16:37.006Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/routes-3rBf8abk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"281a6-zNH711uheFGelTrtt4ih7f3hSHY\"",
		"mtime": "2026-08-19T05:16:37.040Z",
		"size": 164262,
		"path": "../public/assets/routes-3rBf8abk.js"
	},
	"/assets/3d-view-D0NGrzup.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a5534-sRdRjzBbmVrWvuaQzbfedCBSovQ\"",
		"mtime": "2026-08-19T05:16:34.132Z",
		"size": 5920052,
		"path": "../public/assets/3d-view-D0NGrzup.js"
	},
	"/assets/sanity-check-tool-BvNLJ0fq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dea-eps6n/H1M65V3LcvVyGamTGVgjU\"",
		"mtime": "2026-08-19T05:16:37.090Z",
		"size": 11754,
		"path": "../public/assets/sanity-check-tool-BvNLJ0fq.js"
	},
	"/assets/short-circuit-calculations-e2gWGlDW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"74e0-j7j/JCLaLNoPm5uJZmaUWd3s1vU\"",
		"mtime": "2026-08-19T05:16:37.114Z",
		"size": 29920,
		"path": "../public/assets/short-circuit-calculations-e2gWGlDW.js"
	},
	"/assets/smoke-extract-fan-B-q3bbsl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6793-EXxJkhOKZiUveKd91BNYyxZonmw\"",
		"mtime": "2026-08-19T05:16:37.142Z",
		"size": 26515,
		"path": "../public/assets/smoke-extract-fan-B-q3bbsl.js"
	},
	"/assets/staircase-pressurization-Z5tsR0XD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4476-M+d28odk3qUuiIXLk59Jt3Orz+s\"",
		"mtime": "2026-08-19T05:16:37.168Z",
		"size": 17526,
		"path": "../public/assets/staircase-pressurization-Z5tsR0XD.js"
	},
	"/assets/supabase-i9O9rBUK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3284f-KKY4kTo0lUwJOvpekcNxSXA4cF8\"",
		"mtime": "2026-08-19T05:16:37.209Z",
		"size": 206927,
		"path": "../public/assets/supabase-i9O9rBUK.js"
	},
	"/assets/teams-Bt-REJZX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ace-SoNJJaP4n6DP2sEVVW8docGzP+k\"",
		"mtime": "2026-08-19T05:16:37.260Z",
		"size": 6862,
		"path": "../public/assets/teams-Bt-REJZX.js"
	},
	"/assets/trash-CB4AGGJ4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f0-MY8NFW/Yv6oDnFUmoTn8Ut3ygxs\"",
		"mtime": "2026-08-19T05:16:37.289Z",
		"size": 240,
		"path": "../public/assets/trash-CB4AGGJ4.js"
	},
	"/assets/transformer-sizing-v3DmRIg5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"635c-H5Pz/+UCHdWwPwKJYhs5sULHKeQ\"",
		"mtime": "2026-08-19T05:16:37.265Z",
		"size": 25436,
		"path": "../public/assets/transformer-sizing-v3DmRIg5.js"
	},
	"/assets/typeof-B5XbjTb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f-yPXEOGyFHb1Ws7OoWyWNEEBz4mQ\"",
		"mtime": "2026-08-19T05:16:37.296Z",
		"size": 271,
		"path": "../public/assets/typeof-B5XbjTb1.js"
	},
	"/assets/tslib.es6-Tae09705.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"42d-qJHuGuq51+EbLaebsBAkbj1JLbk\"",
		"mtime": "2026-08-19T05:16:37.293Z",
		"size": 1069,
		"path": "../public/assets/tslib.es6-Tae09705.js"
	},
	"/assets/ups-sizing-calculation-DHGnKlRn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"55fa-ORb/odEy6Tay6vo57x5gamyVmYo\"",
		"mtime": "2026-08-19T05:16:37.302Z",
		"size": 22010,
		"path": "../public/assets/ups-sizing-calculation-DHGnKlRn.js"
	},
	"/assets/useShortcuts-D13ue_Cw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b0d-qjCU+ZXgDketrdkR6q2yUI7Kdbw\"",
		"mtime": "2026-08-19T05:16:37.375Z",
		"size": 2829,
		"path": "../public/assets/useShortcuts-D13ue_Cw.js"
	},
	"/assets/ventilation-dzl-NgeM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47-J4XZJPsDK2KJgKAFUk1bq1u57pg\"",
		"mtime": "2026-08-19T05:16:37.378Z",
		"size": 71,
		"path": "../public/assets/ventilation-dzl-NgeM.js"
	},
	"/assets/styles-DlXOWG-G.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"41732-jnV1R5v19zWurRbkWS7sXVLRIbI\"",
		"mtime": "2026-08-19T05:16:37.634Z",
		"size": 268082,
		"path": "../public/assets/styles-DlXOWG-G.css"
	},
	"/assets/use-confirm-DQ-l1cD9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"119dc-7pNfxgzC7fIBB8JaF+ZzPpXu+qs\"",
		"mtime": "2026-08-19T05:16:37.333Z",
		"size": 72156,
		"path": "../public/assets/use-confirm-DQ-l1cD9.js"
	},
	"/assets/zones-tcX2Otmc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f4c-hRvBdaNEhGCvmYkdFWfwdexy224\"",
		"mtime": "2026-08-19T05:16:37.574Z",
		"size": 16204,
		"path": "../public/assets/zones-tcX2Otmc.js"
	},
	"/assets/workspace-store-BewiKNkE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c587-M0yaItKJQ9OXA1LOsf6uU/OTpXY\"",
		"mtime": "2026-08-19T05:16:37.402Z",
		"size": 50567,
		"path": "../public/assets/workspace-store-BewiKNkE.js"
	},
	"/assets/xlsx-BypCUzQ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66dcf-v5fE1ZHiIyXM+ndXVEhWkdB+Sgw\"",
		"mtime": "2026-08-19T05:16:37.470Z",
		"size": 421327,
		"path": "../public/assets/xlsx-BypCUzQ8.js"
	},
	"/assets/worker-GQlxtHkx.mjs": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"35116f-m5Y7pJ85tGx3dIPUddxTWwrru+g\"",
		"mtime": "2026-08-19T05:16:37.962Z",
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
