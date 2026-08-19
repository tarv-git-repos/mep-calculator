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
	"/assets/admin-B_O5RYpp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a298-LgZt0QoaHjAkqgZz62hDbk3LH/k\"",
		"mtime": "2026-08-19T05:55:26.814Z",
		"size": 107160,
		"path": "../public/assets/admin-B_O5RYpp.js"
	},
	"/assets/arrow-left-jFGn2LTL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-Mjziij8+SB2/w7evq1szXKge04A\"",
		"mtime": "2026-08-19T05:55:26.889Z",
		"size": 153,
		"path": "../public/assets/arrow-left-jFGn2LTL.js"
	},
	"/assets/AppShell-BDiiU5fS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2534a-rKBSNSmcdBfehzzdSvszRKBjPgk\"",
		"mtime": "2026-08-19T05:55:26.682Z",
		"size": 152394,
		"path": "../public/assets/AppShell-BDiiU5fS.js"
	},
	"/assets/api-CXyV4iib.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d897-twsOPn0LZTFg545yEd4qjp8d3lI\"",
		"mtime": "2026-08-19T05:55:26.858Z",
		"size": 55447,
		"path": "../public/assets/api-CXyV4iib.js"
	},
	"/assets/arrow-right-sgioIv0D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-8zTkHt89nPh2ysnn7UxC0xiQ2GI\"",
		"mtime": "2026-08-19T05:55:26.905Z",
		"size": 153,
		"path": "../public/assets/arrow-right-sgioIv0D.js"
	},
	"/assets/basement-smoke-calc-DlyjhCu-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"60e1-RCT8kxB+kN6G4R/WD+mJkRlOfEY\"",
		"mtime": "2026-08-19T05:55:26.922Z",
		"size": 24801,
		"path": "../public/assets/basement-smoke-calc-DlyjhCu-.js"
	},
	"/assets/calculator-DvLaY4PX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"206-GQqgYXfkp/NN+HCX80ZWe4dEH+I\"",
		"mtime": "2026-08-19T05:55:27.062Z",
		"size": 518,
		"path": "../public/assets/calculator-DvLaY4PX.js"
	},
	"/assets/AuthContext-FyjnFCUV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"263b-6c8owItvCkZCKsIR3qRMk8muHEg\"",
		"mtime": "2026-08-19T05:55:26.732Z",
		"size": 9787,
		"path": "../public/assets/AuthContext-FyjnFCUV.js"
	},
	"/assets/busbar-calculation-IQ1YcV6K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"690c-hNr/X6zILLVpsgF1hCt35/BCwsk\"",
		"mtime": "2026-08-19T05:55:26.950Z",
		"size": 26892,
		"path": "../public/assets/busbar-calculation-IQ1YcV6K.js"
	},
	"/assets/busbar-voltage-drop-Df_tHYqT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a38-r50V74JQa5Hc4VigqPCVFAjJ5Xw\"",
		"mtime": "2026-08-19T05:55:26.977Z",
		"size": 19e3,
		"path": "../public/assets/busbar-voltage-drop-Df_tHYqT.js"
	},
	"/assets/cable-tray-sizing-N3cxQyKE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8856-cy+2GXqqSb2OIbKeSigIr1kU7yQ\"",
		"mtime": "2026-08-19T05:55:27.005Z",
		"size": 34902,
		"path": "../public/assets/cable-tray-sizing-N3cxQyKE.js"
	},
	"/assets/cable-voltage-drop-DKKDK30J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48f7-hjv90AzS1aPwvzVw7ESTtZhAgA8\"",
		"mtime": "2026-08-19T05:55:27.036Z",
		"size": 18679,
		"path": "../public/assets/cable-voltage-drop-DKKDK30J.js"
	},
	"/assets/central-battery-sizing-B3hFPIr8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6891-Tdf8BOdzjf3/MBdoVJrFGhTWQaM\"",
		"mtime": "2026-08-19T05:55:27.134Z",
		"size": 26769,
		"path": "../public/assets/central-battery-sizing-B3hFPIr8.js"
	},
	"/assets/capacitor-bank-sizing-CrYTGQ_k.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4437-xfekgUEa+RUQxoWI+rJMBClNDzo\"",
		"mtime": "2026-08-19T05:55:27.107Z",
		"size": 17463,
		"path": "../public/assets/capacitor-bank-sizing-CrYTGQ_k.js"
	},
	"/assets/chw-pump-head-g_v98rK8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a4f9-X2WtSdbNibJIXoNRjvE2TA1yCnQ\"",
		"mtime": "2026-08-19T05:55:27.194Z",
		"size": 42233,
		"path": "../public/assets/chw-pump-head-g_v98rK8.js"
	},
	"/assets/calculators-X7vpAQhE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6e33-CoX46Je01zxCYkeHRUEYWP86L+U\"",
		"mtime": "2026-08-19T05:55:27.082Z",
		"size": 28211,
		"path": "../public/assets/calculators-X7vpAQhE.js"
	},
	"/assets/chw-pipe-sizer-d4gmMrY2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"983a-8MpFICV4Mj4J1e1O+sLR2ngKe2A\"",
		"mtime": "2026-08-19T05:55:27.161Z",
		"size": 38970,
		"path": "../public/assets/chw-pipe-sizer-d4gmMrY2.js"
	},
	"/assets/circle-check-DgNNP-sL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-/2imCqYQCjIWjGH6nzylSsPU4nI\"",
		"mtime": "2026-08-19T05:55:27.222Z",
		"size": 166,
		"path": "../public/assets/circle-check-DgNNP-sL.js"
	},
	"/assets/condensate-drain-calc-B1gf3oHa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2fcf-s2UuXmEw+ajZgWGK6asPkGC/Dew\"",
		"mtime": "2026-08-19T05:55:27.282Z",
		"size": 12239,
		"path": "../public/assets/condensate-drain-calc-B1gf3oHa.js"
	},
	"/assets/circle-question-mark-DN2fAxES.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ec-AQqjnRKjEppEB6HzLwZhkNVh20Q\"",
		"mtime": "2026-08-19T05:55:27.237Z",
		"size": 236,
		"path": "../public/assets/circle-question-mark-DN2fAxES.js"
	},
	"/assets/circuit-breaker-sizing-Ff-dk_6k.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"57f7-g+JHPxee4+4v2Bk9M2O1VPBzYGA\"",
		"mtime": "2026-08-19T05:55:27.256Z",
		"size": 22519,
		"path": "../public/assets/circuit-breaker-sizing-Ff-dk_6k.js"
	},
	"/assets/conductor-sizing-VF6-UcJW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5edf-4/2W69EpnF41AG5u1BL7YAXsGHo\"",
		"mtime": "2026-08-19T05:55:27.330Z",
		"size": 24287,
		"path": "../public/assets/conductor-sizing-VF6-UcJW.js"
	},
	"/assets/condensate-drain-j79q49pL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b52-szQF8kp3R9yhmkH+PEjeg8izmvA\"",
		"mtime": "2026-08-19T05:55:27.307Z",
		"size": 15186,
		"path": "../public/assets/condensate-drain-j79q49pL.js"
	},
	"/assets/conversions-GCj7hGJL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f1-GlaMnaUOw3h8fNFkilq1BMpNRZE\"",
		"mtime": "2026-08-19T05:55:27.353Z",
		"size": 497,
		"path": "../public/assets/conversions-GCj7hGJL.js"
	},
	"/assets/core-BFqLT5rb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"745-zkAz33hXLRPZ1d0z6KamQrjAkXg\"",
		"mtime": "2026-08-19T05:55:27.357Z",
		"size": 1861,
		"path": "../public/assets/core-BFqLT5rb.js"
	},
	"/assets/database-DzqHLng5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7-erqFXGQCJHUnw5S9zK/DktmSBVQ\"",
		"mtime": "2026-08-19T05:55:27.378Z",
		"size": 231,
		"path": "../public/assets/database-DzqHLng5.js"
	},
	"/assets/dist-87QSDKkM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"95fd-hQhiQ0cipo75l7m9W3wvPHt4v1w\"",
		"mtime": "2026-08-19T05:55:27.422Z",
		"size": 38397,
		"path": "../public/assets/dist-87QSDKkM.js"
	},
	"/assets/diffuser-selector-B-A-K1SX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c49-wkaCniLVKgM7T5z8joZcWigGrUI\"",
		"mtime": "2026-08-19T05:55:27.396Z",
		"size": 11337,
		"path": "../public/assets/diffuser-selector-B-A-K1SX.js"
	},
	"/assets/droplet-BHWgpaNJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c8-p7uhmbZSVJ754NMCve5gVRSCqKk\"",
		"mtime": "2026-08-19T05:55:27.492Z",
		"size": 200,
		"path": "../public/assets/droplet-BHWgpaNJ.js"
	},
	"/assets/download-CyllO8Xo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc-HOS7QnmPVXQ16vpsQdAM7XJ8C8s\"",
		"mtime": "2026-08-19T05:55:27.474Z",
		"size": 220,
		"path": "../public/assets/download-CyllO8Xo.js"
	},
	"/assets/dist-js-mWlZkCFq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"172-g7fnQaRG809JyOj7Le5X51OFO5o\"",
		"mtime": "2026-08-19T05:55:27.456Z",
		"size": 370,
		"path": "../public/assets/dist-js-mWlZkCFq.js"
	},
	"/assets/equipment--9BMyZ_v.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bb9-1gKnPAoMdKD5dCXPnnUBxHtyHaA\"",
		"mtime": "2026-08-19T05:55:27.562Z",
		"size": 15289,
		"path": "../public/assets/equipment--9BMyZ_v.js"
	},
	"/assets/electrical-network-bDqdO0uB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1366-C0klwOoaX1zrGHZcPdt5Xs2Duz8\"",
		"mtime": "2026-08-19T05:55:27.537Z",
		"size": 4966,
		"path": "../public/assets/electrical-network-bDqdO0uB.js"
	},
	"/assets/duct-sizer-BD2oM3HV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37c5-3owbfzJH8Zlle4JIWw1fdeJR1n4\"",
		"mtime": "2026-08-19T05:55:27.511Z",
		"size": 14277,
		"path": "../public/assets/duct-sizer-BD2oM3HV.js"
	},
	"/assets/excelHelpers-u6ImAd-d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b9-lopo79ws7JfvBtCVV/mhkO2Ihb4\"",
		"mtime": "2026-08-19T05:55:27.586Z",
		"size": 953,
		"path": "../public/assets/excelHelpers-u6ImAd-d.js"
	},
	"/assets/eye-Co-nw305.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f4-gnZDnf5W+DAeosvw/cOdwlM6brw\"",
		"mtime": "2026-08-19T05:55:27.889Z",
		"size": 244,
		"path": "../public/assets/eye-Co-nw305.js"
	},
	"/assets/FileSaver.min-BvZiQU7D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a81-Jy6giDvb9ZYC00C8iidLJXE2o1M\"",
		"mtime": "2026-08-19T05:55:26.758Z",
		"size": 2689,
		"path": "../public/assets/FileSaver.min-BvZiQU7D.js"
	},
	"/assets/fresh-air-cooling-load-CSJuGVkA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf2-NAaRwalWG7HzN3XH7XqqAH89Cqk\"",
		"mtime": "2026-08-19T05:55:27.948Z",
		"size": 15602,
		"path": "../public/assets/fresh-air-cooling-load-CSJuGVkA.js"
	},
	"/assets/eye-off-SfyVyF-s.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a2-54O/2NxK0M6Onc4KK65MgzChov4\"",
		"mtime": "2026-08-19T05:55:27.908Z",
		"size": 418,
		"path": "../public/assets/eye-off-SfyVyF-s.js"
	},
	"/assets/folder-plus-bQKg9G32.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"126-rCZ0Pfxr02Ik8JhXGGBgpimXG7c\"",
		"mtime": "2026-08-19T05:55:27.927Z",
		"size": 294,
		"path": "../public/assets/folder-plus-bQKg9G32.js"
	},
	"/assets/ImportExcelBtn-Djsjstf5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"509-sKGOrQAkTobcbl4KEQOhyG2ws/M\"",
		"mtime": "2026-08-19T05:55:26.786Z",
		"size": 1289,
		"path": "../public/assets/ImportExcelBtn-Djsjstf5.js"
	},
	"/assets/generator-sizing-WsAsGGCd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ed1a-JJ7KOyCvQwdpcqZuyTROJiN+Cu4\"",
		"mtime": "2026-08-19T05:55:27.976Z",
		"size": 60698,
		"path": "../public/assets/generator-sizing-WsAsGGCd.js"
	},
	"/assets/heating-load-CHU0rqgB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"362a-PGybdTgekCGTUPo2PWgvEaUnT58\"",
		"mtime": "2026-08-19T05:55:28.008Z",
		"size": 13866,
		"path": "../public/assets/heating-load-CHU0rqgB.js"
	},
	"/assets/html2canvas-CLVA0Ark.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b99-sy1E4G2SIiMI6zbWBtfrFwNUxbY\"",
		"mtime": "2026-08-19T05:55:28.048Z",
		"size": 199577,
		"path": "../public/assets/html2canvas-CLVA0Ark.js"
	},
	"/assets/index.es-ZMW733Np.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24f81-lspEY2myjvJWJpmCDY//kl31rsw\"",
		"mtime": "2026-08-19T05:55:28.271Z",
		"size": 151425,
		"path": "../public/assets/index.es-ZMW733Np.js"
	},
	"/assets/lighting-lux-calculation-BkXxq05H.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bca-Al+IxXn1XLOtfdMlfhAr6MBHW1U\"",
		"mtime": "2026-08-19T05:55:28.337Z",
		"size": 15306,
		"path": "../public/assets/lighting-lux-calculation-BkXxq05H.js"
	},
	"/assets/exceljs.min-CGHY4pgT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e307c-2xdY+nkeG0nTLAkvWgxBkYweVMs\"",
		"mtime": "2026-08-19T05:55:27.684Z",
		"size": 929916,
		"path": "../public/assets/exceljs.min-CGHY4pgT.js"
	},
	"/assets/index-BJVQHz2p.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10bc69-bjJHTT1YIxVs6dzf5ImgOkV88t0\"",
		"mtime": "2026-08-19T05:55:25.850Z",
		"size": 1096809,
		"path": "../public/assets/index-BJVQHz2p.js"
	},
	"/assets/load-summary-CwqHkbK9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"38b1-x2mH8lsS0mz+A1uYhvwquPPLxjk\"",
		"mtime": "2026-08-19T05:55:28.361Z",
		"size": 14513,
		"path": "../public/assets/load-summary-CwqHkbK9.js"
	},
	"/assets/lock-4tIh0Kro.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c2-QjX1/zElCB/M1osoTbd39l/WDtI\"",
		"mtime": "2026-08-19T05:55:28.413Z",
		"size": 194,
		"path": "../public/assets/lock-4tIh0Kro.js"
	},
	"/assets/lobby-pressurisation-DonIhnsb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72f4-uvw6Sjae3kZnH6hwM82Z/HPejm4\"",
		"mtime": "2026-08-19T05:55:28.389Z",
		"size": 29428,
		"path": "../public/assets/lobby-pressurisation-DonIhnsb.js"
	},
	"/assets/lpd-calculation-BaIlWbE2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6636-X9TxDhCvOJg0Hr9XFU5YvfchyeA\"",
		"mtime": "2026-08-19T05:55:28.457Z",
		"size": 26166,
		"path": "../public/assets/lpd-calculation-BaIlWbE2.js"
	},
	"/assets/login-zRIkOuZG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ba4-ghd5OxP39E2whRJi4xC5U8YUOUY\"",
		"mtime": "2026-08-19T05:55:28.432Z",
		"size": 23460,
		"path": "../public/assets/login-zRIkOuZG.js"
	},
	"/assets/play-BM08r4ym.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2-L+QvNoF47QWlK0CzWTv2jaAbK4o\"",
		"mtime": "2026-08-19T05:55:28.515Z",
		"size": 178,
		"path": "../public/assets/play-BM08r4ym.js"
	},
	"/assets/plumbing-drainage-W-hKJRzE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1615-XTFNiqBjxJy3fZe81OFUVL/wgpg\"",
		"mtime": "2026-08-19T05:55:28.519Z",
		"size": 5653,
		"path": "../public/assets/plumbing-drainage-W-hKJRzE.js"
	},
	"/assets/plumbing-fire-pump-duty-4c8K9_SH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2612-3HobbFFgolUM4nDJHHwoSwUfnLA\"",
		"mtime": "2026-08-19T05:55:28.542Z",
		"size": 9746,
		"path": "../public/assets/plumbing-fire-pump-duty-4c8K9_SH.js"
	},
	"/assets/plumbing-fire-water-demand-Oz-QcvT9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ad8-IE0LnZGgoZxBhc7vBnEUuhyTdyo\"",
		"mtime": "2026-08-19T05:55:28.612Z",
		"size": 10968,
		"path": "../public/assets/plumbing-fire-water-demand-Oz-QcvT9.js"
	},
	"/assets/navigation-B4PzNTkR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7c82-SLSaGi6KFlCAY8fUmGqA2k5vtqQ\"",
		"mtime": "2026-08-19T05:55:28.482Z",
		"size": 31874,
		"path": "../public/assets/navigation-B4PzNTkR.js"
	},
	"/assets/plumbing-fire-tank-capacity-B1zMCBSR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"34b7-UjPiSW74o1B2KerUE38O6oIBU/o\"",
		"mtime": "2026-08-19T05:55:28.566Z",
		"size": 13495,
		"path": "../public/assets/plumbing-fire-tank-capacity-B1zMCBSR.js"
	},
	"/assets/plumbing-fire-tank-duration-DgebXR_P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2407-DU2D5eGORwawOE5FLEEIfK5PAYc\"",
		"mtime": "2026-08-19T05:55:28.589Z",
		"size": 9223,
		"path": "../public/assets/plumbing-fire-tank-duration-DgebXR_P.js"
	},
	"/assets/plumbing-gas-tank-D0mP7UCQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31bc-74H1krovrCSHcmdLGfic/olM1V4\"",
		"mtime": "2026-08-19T05:55:28.689Z",
		"size": 12732,
		"path": "../public/assets/plumbing-gas-tank-D0mP7UCQ.js"
	},
	"/assets/plumbing-fixture-unit-Bt7vY7iw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46f8-fcDwULCQY0EC4tIt5AMT8t8aSIE\"",
		"mtime": "2026-08-19T05:55:28.635Z",
		"size": 18168,
		"path": "../public/assets/plumbing-fixture-unit-Bt7vY7iw.js"
	},
	"/assets/plumbing-fm200-C2-waZIt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66cf-W6uJ77yhGL0dxF32OGwmvh5mWOw\"",
		"mtime": "2026-08-19T05:55:28.662Z",
		"size": 26319,
		"path": "../public/assets/plumbing-fm200-C2-waZIt.js"
	},
	"/assets/plumbing-hazen-williams-Be18m-6J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784c-hxiSNw0/UpMfgdu4alYyCwtdIEg\"",
		"mtime": "2026-08-19T05:55:28.714Z",
		"size": 30796,
		"path": "../public/assets/plumbing-hazen-williams-Be18m-6J.js"
	},
	"/assets/plumbing-pressure-vessel-CmKCglcw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3606-ERJG8RUmp8HOCJFriD0hu9GpEew\"",
		"mtime": "2026-08-19T05:55:28.764Z",
		"size": 13830,
		"path": "../public/assets/plumbing-pressure-vessel-CmKCglcw.js"
	},
	"/assets/plumbing-sewage-pump-Da-EXGiZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23b6-M2kIWSTDBg0AVxnF81bRQ0cH0vw\"",
		"mtime": "2026-08-19T05:55:28.819Z",
		"size": 9142,
		"path": "../public/assets/plumbing-sewage-pump-Da-EXGiZ.js"
	},
	"/assets/plumbing-pump-sizing-Bzud_9Ac.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"984c-3ZTP4VJAJa8MwoLkMNAWCAZoLco\"",
		"mtime": "2026-08-19T05:55:28.792Z",
		"size": 38988,
		"path": "../public/assets/plumbing-pump-sizing-Bzud_9Ac.js"
	},
	"/assets/plumbing-loading-unit-Dk_RUiPC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"375f-MUuGB06MpKk+a6ec9nb7kXA9534\"",
		"mtime": "2026-08-19T05:55:28.740Z",
		"size": 14175,
		"path": "../public/assets/plumbing-loading-unit-Dk_RUiPC.js"
	},
	"/assets/plumbing-sprinkler-density-Bw9Ul6sN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7de4-zuV6kUIIFmqcRBbLRkVR22zfjsI\"",
		"mtime": "2026-08-19T05:55:28.843Z",
		"size": 32228,
		"path": "../public/assets/plumbing-sprinkler-density-Bw9Ul6sN.js"
	},
	"/assets/plumbing-sprinkler-kfactor-DGUQXfok.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"102a7-UIcv1yBw85K1EYmXJeBSdEA19uA\"",
		"mtime": "2026-08-19T05:55:28.873Z",
		"size": 66215,
		"path": "../public/assets/plumbing-sprinkler-kfactor-DGUQXfok.js"
	},
	"/assets/plumbing-storm-water-CA8OFFEL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2947-XdGqlGBD6WrufBQgEKpBP1fAe34\"",
		"mtime": "2026-08-19T05:55:28.905Z",
		"size": 10567,
		"path": "../public/assets/plumbing-storm-water-CA8OFFEL.js"
	},
	"/assets/plumbing-supply-pipe-sizer-B6oVRSyz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ef5-X7kCWD2tsRXBvAYVdetldoeQEL8\"",
		"mtime": "2026-08-19T05:55:28.952Z",
		"size": 16117,
		"path": "../public/assets/plumbing-supply-pipe-sizer-B6oVRSyz.js"
	},
	"/assets/plumbing-tank-sizing-CczCzwwA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f4f-7/mRDTGobvwaG6KaSZYacpim0OY\"",
		"mtime": "2026-08-19T05:55:28.977Z",
		"size": 8015,
		"path": "../public/assets/plumbing-tank-sizing-CczCzwwA.js"
	},
	"/assets/plumbing-water-demand-B10oy15b.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6885-SIei8TMOnD8aVPDKe/axmG356Ko\"",
		"mtime": "2026-08-19T05:55:29.001Z",
		"size": 26757,
		"path": "../public/assets/plumbing-water-demand-B10oy15b.js"
	},
	"/assets/preload-helper-BcNkJ6ai.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2247-D847jCAP5ERD+46cfjV3zrCHpa8\"",
		"mtime": "2026-08-19T05:55:29.058Z",
		"size": 8775,
		"path": "../public/assets/preload-helper-BcNkJ6ai.js"
	},
	"/assets/privacy-CM1pHi2W.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11ae-kayuDrdW53QDhXD3JDUf95aUBT0\"",
		"mtime": "2026-08-19T05:55:29.097Z",
		"size": 4526,
		"path": "../public/assets/privacy-CM1pHi2W.js"
	},
	"/assets/plumbing-sump-pump-CRWQCxnc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e5f-Ufi/yvb61yAa5YNIdvFHh0tzkpY\"",
		"mtime": "2026-08-19T05:55:28.929Z",
		"size": 11871,
		"path": "../public/assets/plumbing-sump-pump-CRWQCxnc.js"
	},
	"/assets/preliminary-cooling-load-B6lzru8j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"cf26-hqzcm/tVTxpyhZ4wQn/Aq35iNkY\"",
		"mtime": "2026-08-19T05:55:29.029Z",
		"size": 53030,
		"path": "../public/assets/preliminary-cooling-load-B6lzru8j.js"
	},
	"/assets/psychrometric-D1xWEZ2o.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3782-gqWPnTXBIU1U5MqweNhil8A2mPM\"",
		"mtime": "2026-08-19T05:55:29.305Z",
		"size": 14210,
		"path": "../public/assets/psychrometric-D1xWEZ2o.js"
	},
	"/assets/projects-C4OdfcJr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a02a-VU9q4bl56VdEVdfQgyaqRqYWLXs\"",
		"mtime": "2026-08-19T05:55:29.213Z",
		"size": 41002,
		"path": "../public/assets/projects-C4OdfcJr.js"
	},
	"/assets/project-load-schedule-B2gBV8rW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37b08-d7UJZL41szyB5hKXizgR+GlNjqg\"",
		"mtime": "2026-08-19T05:55:29.136Z",
		"size": 228104,
		"path": "../public/assets/project-load-schedule-B2gBV8rW.js"
	},
	"/assets/proxy-CHsxYjb7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e987-29n4yhJtOnjG4bdE9/4lmPhIqPQ\"",
		"mtime": "2026-08-19T05:55:29.249Z",
		"size": 125319,
		"path": "../public/assets/proxy-CHsxYjb7.js"
	},
	"/assets/purify.es-Bu4Grnl0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"65fb-UUUgPD99pIfMSCpTHJ8CGM9NB7I\"",
		"mtime": "2026-08-19T05:55:29.330Z",
		"size": 26107,
		"path": "../public/assets/purify.es-Bu4Grnl0.js"
	},
	"/assets/reports-XxwcKnUB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7a8-U671TJylnhbi40deVeRlbP2Ky2s\"",
		"mtime": "2026-08-19T05:55:29.388Z",
		"size": 1960,
		"path": "../public/assets/reports-XxwcKnUB.js"
	},
	"/assets/refrigerant-pipe-sizing-bMvP1FDQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2335-+kB2PuSHhanfBzoHgb+jnrcKFmI\"",
		"mtime": "2026-08-19T05:55:29.367Z",
		"size": 9013,
		"path": "../public/assets/refrigerant-pipe-sizing-bMvP1FDQ.js"
	},
	"/assets/reset-password-YmuN4KOO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ab7-9NaWLejW6N1aeUjm7uoq3UEMm2k\"",
		"mtime": "2026-08-19T05:55:29.411Z",
		"size": 2743,
		"path": "../public/assets/reset-password-YmuN4KOO.js"
	},
	"/assets/project-load-schedule-DLioOiRN.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-lFaZK5XKLiA1ueePpWy3ZyWmewg\"",
		"mtime": "2026-08-19T05:55:30.074Z",
		"size": 15413,
		"path": "../public/assets/project-load-schedule-DLioOiRN.css"
	},
	"/assets/routes-KUKZADFK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"281ef-E/kchEaLKu6nNy6Y0BKNl8aADno\"",
		"mtime": "2026-08-19T05:55:29.466Z",
		"size": 164335,
		"path": "../public/assets/routes-KUKZADFK.js"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-19T05:55:29.430Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/sanity-check-tool-BvNLJ0fq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dea-eps6n/H1M65V3LcvVyGamTGVgjU\"",
		"mtime": "2026-08-19T05:55:29.514Z",
		"size": 11754,
		"path": "../public/assets/sanity-check-tool-BvNLJ0fq.js"
	},
	"/assets/short-circuit-calculations-C2EfYz9h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"74e0-ZwlIBZtkhbMWcH5R8wIo/2YLdPM\"",
		"mtime": "2026-08-19T05:55:29.538Z",
		"size": 29920,
		"path": "../public/assets/short-circuit-calculations-C2EfYz9h.js"
	},
	"/assets/smoke-extract-fan-Bl57_sCU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6793-C7oZFiPmUhFfraNEyAnPn5uL7ho\"",
		"mtime": "2026-08-19T05:55:29.566Z",
		"size": 26515,
		"path": "../public/assets/smoke-extract-fan-Bl57_sCU.js"
	},
	"/assets/3d-view-D0NGrzup.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a5534-sRdRjzBbmVrWvuaQzbfedCBSovQ\"",
		"mtime": "2026-08-19T05:55:26.533Z",
		"size": 5920052,
		"path": "../public/assets/3d-view-D0NGrzup.js"
	},
	"/assets/staircase-pressurization-DTB2Nm3e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4476-25jSnpud0Lb4JfKS7GuMbR3+flw\"",
		"mtime": "2026-08-19T05:55:29.592Z",
		"size": 17526,
		"path": "../public/assets/staircase-pressurization-DTB2Nm3e.js"
	},
	"/assets/supabase-i9O9rBUK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3284f-KKY4kTo0lUwJOvpekcNxSXA4cF8\"",
		"mtime": "2026-08-19T05:55:29.635Z",
		"size": 206927,
		"path": "../public/assets/supabase-i9O9rBUK.js"
	},
	"/assets/teams-Bt-REJZX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ace-SoNJJaP4n6DP2sEVVW8docGzP+k\"",
		"mtime": "2026-08-19T05:55:29.685Z",
		"size": 6862,
		"path": "../public/assets/teams-Bt-REJZX.js"
	},
	"/assets/tslib.es6-Tae09705.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"42d-qJHuGuq51+EbLaebsBAkbj1JLbk\"",
		"mtime": "2026-08-19T05:55:29.718Z",
		"size": 1069,
		"path": "../public/assets/tslib.es6-Tae09705.js"
	},
	"/assets/transformer-sizing-BthZw--I.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"635c-n3WaRzcT/HpgxyUOiNCqOmQHN7s\"",
		"mtime": "2026-08-19T05:55:29.690Z",
		"size": 25436,
		"path": "../public/assets/transformer-sizing-BthZw--I.js"
	},
	"/assets/trash-CB4AGGJ4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f0-MY8NFW/Yv6oDnFUmoTn8Ut3ygxs\"",
		"mtime": "2026-08-19T05:55:29.714Z",
		"size": 240,
		"path": "../public/assets/trash-CB4AGGJ4.js"
	},
	"/assets/styles-uIH6QlJ7.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"41690-9382unKhxH1A/9Syo1Gy9yoGR1A\"",
		"mtime": "2026-08-19T05:55:30.109Z",
		"size": 267920,
		"path": "../public/assets/styles-uIH6QlJ7.css"
	},
	"/assets/typeof-B5XbjTb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f-yPXEOGyFHb1Ws7OoWyWNEEBz4mQ\"",
		"mtime": "2026-08-19T05:55:29.740Z",
		"size": 271,
		"path": "../public/assets/typeof-B5XbjTb1.js"
	},
	"/assets/ups-sizing-calculation-CLJQ59ie.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"55fa-HMO/5TSsjdE5tj1YGiVTWQVy/6o\"",
		"mtime": "2026-08-19T05:55:29.760Z",
		"size": 22010,
		"path": "../public/assets/ups-sizing-calculation-CLJQ59ie.js"
	},
	"/assets/useShortcuts-D13ue_Cw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b0d-qjCU+ZXgDketrdkR6q2yUI7Kdbw\"",
		"mtime": "2026-08-19T05:55:29.831Z",
		"size": 2829,
		"path": "../public/assets/useShortcuts-D13ue_Cw.js"
	},
	"/assets/use-confirm-DQ-l1cD9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"119dc-7pNfxgzC7fIBB8JaF+ZzPpXu+qs\"",
		"mtime": "2026-08-19T05:55:29.792Z",
		"size": 72156,
		"path": "../public/assets/use-confirm-DQ-l1cD9.js"
	},
	"/assets/ventilation-DB0bVbEm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47-R9aDdjoeQfPzfOztPFAMoNFarVw\"",
		"mtime": "2026-08-19T05:55:29.855Z",
		"size": 71,
		"path": "../public/assets/ventilation-DB0bVbEm.js"
	},
	"/assets/zones-BMhftnYy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f4c-Gc6piPgZCyuvaTy9VnaDc2Ztc2w\"",
		"mtime": "2026-08-19T05:55:30.049Z",
		"size": 16204,
		"path": "../public/assets/zones-BMhftnYy.js"
	},
	"/assets/workspace-store-BewiKNkE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c587-M0yaItKJQ9OXA1LOsf6uU/OTpXY\"",
		"mtime": "2026-08-19T05:55:29.880Z",
		"size": 50567,
		"path": "../public/assets/workspace-store-BewiKNkE.js"
	},
	"/assets/xlsx-BypCUzQ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66dcf-v5fE1ZHiIyXM+ndXVEhWkdB+Sgw\"",
		"mtime": "2026-08-19T05:55:29.946Z",
		"size": 421327,
		"path": "../public/assets/xlsx-BypCUzQ8.js"
	},
	"/assets/worker-GQlxtHkx.mjs": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"35116f-m5Y7pJ85tGx3dIPUddxTWwrru+g\"",
		"mtime": "2026-08-19T05:55:30.428Z",
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
