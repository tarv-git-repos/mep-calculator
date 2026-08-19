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
	"/assets/admin-DDSupitA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a298-xZ4u/oFC0Yzvm8RysiOsR7FjCgk\"",
		"mtime": "2026-08-19T05:50:42.739Z",
		"size": 107160,
		"path": "../public/assets/admin-DDSupitA.js"
	},
	"/assets/api-CXyV4iib.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d897-twsOPn0LZTFg545yEd4qjp8d3lI\"",
		"mtime": "2026-08-19T05:50:42.783Z",
		"size": 55447,
		"path": "../public/assets/api-CXyV4iib.js"
	},
	"/assets/arrow-left-jFGn2LTL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-Mjziij8+SB2/w7evq1szXKge04A\"",
		"mtime": "2026-08-19T05:50:42.811Z",
		"size": 153,
		"path": "../public/assets/arrow-left-jFGn2LTL.js"
	},
	"/assets/arrow-right-sgioIv0D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-8zTkHt89nPh2ysnn7UxC0xiQ2GI\"",
		"mtime": "2026-08-19T05:50:42.828Z",
		"size": 153,
		"path": "../public/assets/arrow-right-sgioIv0D.js"
	},
	"/assets/AuthContext-FyjnFCUV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"263b-6c8owItvCkZCKsIR3qRMk8muHEg\"",
		"mtime": "2026-08-19T05:50:42.659Z",
		"size": 9787,
		"path": "../public/assets/AuthContext-FyjnFCUV.js"
	},
	"/assets/busbar-voltage-drop-CywTqmli.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a38-R5SN2J7JY+HKymRIvJ1jB9bLOIo\"",
		"mtime": "2026-08-19T05:50:42.901Z",
		"size": 19e3,
		"path": "../public/assets/busbar-voltage-drop-CywTqmli.js"
	},
	"/assets/basement-smoke-calc-gZdxQqUu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"60e1-K6yYG/h9KfZs+qy8s6Q5WL8wHXc\"",
		"mtime": "2026-08-19T05:50:42.847Z",
		"size": 24801,
		"path": "../public/assets/basement-smoke-calc-gZdxQqUu.js"
	},
	"/assets/calculator-DvLaY4PX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"206-GQqgYXfkp/NN+HCX80ZWe4dEH+I\"",
		"mtime": "2026-08-19T05:50:42.997Z",
		"size": 518,
		"path": "../public/assets/calculator-DvLaY4PX.js"
	},
	"/assets/capacitor-bank-sizing-CS93sGgS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4437-vfO+7tDqq27Fy8TRQ7cgDp4znzc\"",
		"mtime": "2026-08-19T05:50:43.045Z",
		"size": 17463,
		"path": "../public/assets/capacitor-bank-sizing-CS93sGgS.js"
	},
	"/assets/AppShell-BDiiU5fS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2534a-rKBSNSmcdBfehzzdSvszRKBjPgk\"",
		"mtime": "2026-08-19T05:50:42.604Z",
		"size": 152394,
		"path": "../public/assets/AppShell-BDiiU5fS.js"
	},
	"/assets/cable-voltage-drop-DvRA77ia.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48f7-8Kmo1FTH6V1iE+v5Q3L64r8H+wE\"",
		"mtime": "2026-08-19T05:50:42.972Z",
		"size": 18679,
		"path": "../public/assets/cable-voltage-drop-DvRA77ia.js"
	},
	"/assets/calculators-AxZrQOOZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6e33-q5sm25vrKN6/ZT1ps5x1rIdmV4I\"",
		"mtime": "2026-08-19T05:50:43.018Z",
		"size": 28211,
		"path": "../public/assets/calculators-AxZrQOOZ.js"
	},
	"/assets/chw-pipe-sizer-BMZykuQs.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"983a-Mqoxt4rM/6z01w0FFezo7Tap9uQ\"",
		"mtime": "2026-08-19T05:50:43.100Z",
		"size": 38970,
		"path": "../public/assets/chw-pipe-sizer-BMZykuQs.js"
	},
	"/assets/circle-question-mark-DN2fAxES.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ec-AQqjnRKjEppEB6HzLwZhkNVh20Q\"",
		"mtime": "2026-08-19T05:50:43.175Z",
		"size": 236,
		"path": "../public/assets/circle-question-mark-DN2fAxES.js"
	},
	"/assets/central-battery-sizing-op03uVBp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6891-5kYRX7rRCvHKY909GL9hABy6dfc\"",
		"mtime": "2026-08-19T05:50:43.072Z",
		"size": 26769,
		"path": "../public/assets/central-battery-sizing-op03uVBp.js"
	},
	"/assets/circle-check-DgNNP-sL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-/2imCqYQCjIWjGH6nzylSsPU4nI\"",
		"mtime": "2026-08-19T05:50:43.157Z",
		"size": 166,
		"path": "../public/assets/circle-check-DgNNP-sL.js"
	},
	"/assets/chw-pump-head-CRT39EmC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a4f9-FcaeNv8Og1izFZJHJXTpYFSzjW0\"",
		"mtime": "2026-08-19T05:50:43.132Z",
		"size": 42233,
		"path": "../public/assets/chw-pump-head-CRT39EmC.js"
	},
	"/assets/condensate-drain-calc-B1gf3oHa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2fcf-s2UuXmEw+ajZgWGK6asPkGC/Dew\"",
		"mtime": "2026-08-19T05:50:43.242Z",
		"size": 12239,
		"path": "../public/assets/condensate-drain-calc-B1gf3oHa.js"
	},
	"/assets/busbar-calculation-BHT9ONRY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"690c-Mof5oKAfPXnE+jLrUmzbJD5DYV4\"",
		"mtime": "2026-08-19T05:50:42.872Z",
		"size": 26892,
		"path": "../public/assets/busbar-calculation-BHT9ONRY.js"
	},
	"/assets/conversions-GCj7hGJL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f1-GlaMnaUOw3h8fNFkilq1BMpNRZE\"",
		"mtime": "2026-08-19T05:50:43.293Z",
		"size": 497,
		"path": "../public/assets/conversions-GCj7hGJL.js"
	},
	"/assets/circuit-breaker-sizing-TuXNQdP2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"57f7-2fDk+xq3bfAy8WGxn7R98XPX+jE\"",
		"mtime": "2026-08-19T05:50:43.192Z",
		"size": 22519,
		"path": "../public/assets/circuit-breaker-sizing-TuXNQdP2.js"
	},
	"/assets/cable-tray-sizing-BFDHA96x.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8856-L9ZW3CFFXyQxMVZI7CJ8YPODEWI\"",
		"mtime": "2026-08-19T05:50:42.928Z",
		"size": 34902,
		"path": "../public/assets/cable-tray-sizing-BFDHA96x.js"
	},
	"/assets/conductor-sizing-D_iP_jAt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5edf-wkug1rz3WC9hw0Vvt2l8YYG5xLg\"",
		"mtime": "2026-08-19T05:50:43.266Z",
		"size": 24287,
		"path": "../public/assets/conductor-sizing-D_iP_jAt.js"
	},
	"/assets/condensate-drain-RlKnJ866.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b52-d7a+bgqevlrMkUpjKpSx0OHP+JA\"",
		"mtime": "2026-08-19T05:50:43.219Z",
		"size": 15186,
		"path": "../public/assets/condensate-drain-RlKnJ866.js"
	},
	"/assets/database-DzqHLng5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7-erqFXGQCJHUnw5S9zK/DktmSBVQ\"",
		"mtime": "2026-08-19T05:50:43.335Z",
		"size": 231,
		"path": "../public/assets/database-DzqHLng5.js"
	},
	"/assets/core-BFqLT5rb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"745-zkAz33hXLRPZ1d0z6KamQrjAkXg\"",
		"mtime": "2026-08-19T05:50:43.314Z",
		"size": 1861,
		"path": "../public/assets/core-BFqLT5rb.js"
	},
	"/assets/diffuser-selector-DX0U0Wl8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c49-zdv4A1Uz2hUmgBAzirrDXTbrXEI\"",
		"mtime": "2026-08-19T05:50:43.352Z",
		"size": 11337,
		"path": "../public/assets/diffuser-selector-DX0U0Wl8.js"
	},
	"/assets/dist-js-mWlZkCFq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"172-g7fnQaRG809JyOj7Le5X51OFO5o\"",
		"mtime": "2026-08-19T05:50:43.411Z",
		"size": 370,
		"path": "../public/assets/dist-js-mWlZkCFq.js"
	},
	"/assets/download-CyllO8Xo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc-HOS7QnmPVXQ16vpsQdAM7XJ8C8s\"",
		"mtime": "2026-08-19T05:50:43.429Z",
		"size": 220,
		"path": "../public/assets/download-CyllO8Xo.js"
	},
	"/assets/dist-87QSDKkM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"95fd-hQhiQ0cipo75l7m9W3wvPHt4v1w\"",
		"mtime": "2026-08-19T05:50:43.377Z",
		"size": 38397,
		"path": "../public/assets/dist-87QSDKkM.js"
	},
	"/assets/droplet-BHWgpaNJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c8-p7uhmbZSVJ754NMCve5gVRSCqKk\"",
		"mtime": "2026-08-19T05:50:43.446Z",
		"size": 200,
		"path": "../public/assets/droplet-BHWgpaNJ.js"
	},
	"/assets/duct-sizer-DMEuPyRz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37c5-1SGKSz/Obs/ihO3aHMhpo8chB0Y\"",
		"mtime": "2026-08-19T05:50:43.465Z",
		"size": 14277,
		"path": "../public/assets/duct-sizer-DMEuPyRz.js"
	},
	"/assets/electrical-network-bDqdO0uB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1366-C0klwOoaX1zrGHZcPdt5Xs2Duz8\"",
		"mtime": "2026-08-19T05:50:43.490Z",
		"size": 4966,
		"path": "../public/assets/electrical-network-bDqdO0uB.js"
	},
	"/assets/equipment-CQ1O1rmR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bb9-zKU5EgdSCMPk2tZ0rHz5duTm4hE\"",
		"mtime": "2026-08-19T05:50:43.515Z",
		"size": 15289,
		"path": "../public/assets/equipment-CQ1O1rmR.js"
	},
	"/assets/eye-Co-nw305.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f4-gnZDnf5W+DAeosvw/cOdwlM6brw\"",
		"mtime": "2026-08-19T05:50:43.852Z",
		"size": 244,
		"path": "../public/assets/eye-Co-nw305.js"
	},
	"/assets/eye-off-SfyVyF-s.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a2-54O/2NxK0M6Onc4KK65MgzChov4\"",
		"mtime": "2026-08-19T05:50:43.870Z",
		"size": 418,
		"path": "../public/assets/eye-off-SfyVyF-s.js"
	},
	"/assets/FileSaver.min-BvZiQU7D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a81-Jy6giDvb9ZYC00C8iidLJXE2o1M\"",
		"mtime": "2026-08-19T05:50:42.683Z",
		"size": 2689,
		"path": "../public/assets/FileSaver.min-BvZiQU7D.js"
	},
	"/assets/excelHelpers-CXGX7efw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b9-TsFEe2atCqqhZrd4rNw2LUCJlC4\"",
		"mtime": "2026-08-19T05:50:43.538Z",
		"size": 953,
		"path": "../public/assets/excelHelpers-CXGX7efw.js"
	},
	"/assets/fresh-air-cooling-load-BF112lXM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf2-R06kG+L0RvON8K8KzJneO1E2K9M\"",
		"mtime": "2026-08-19T05:50:43.911Z",
		"size": 15602,
		"path": "../public/assets/fresh-air-cooling-load-BF112lXM.js"
	},
	"/assets/folder-plus-bQKg9G32.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"126-rCZ0Pfxr02Ik8JhXGGBgpimXG7c\"",
		"mtime": "2026-08-19T05:50:43.891Z",
		"size": 294,
		"path": "../public/assets/folder-plus-bQKg9G32.js"
	},
	"/assets/generator-sizing-DIffI8pn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ed1a-N36AG52izM18mu6zyLuEcAjxdvk\"",
		"mtime": "2026-08-19T05:50:43.940Z",
		"size": 60698,
		"path": "../public/assets/generator-sizing-DIffI8pn.js"
	},
	"/assets/heating-load-CHU0rqgB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"362a-PGybdTgekCGTUPo2PWgvEaUnT58\"",
		"mtime": "2026-08-19T05:50:43.975Z",
		"size": 13866,
		"path": "../public/assets/heating-load-CHU0rqgB.js"
	},
	"/assets/ImportExcelBtn-CEOssl0V.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"509-HLjiSlJWwanoLX5ahBvCuzzBVnA\"",
		"mtime": "2026-08-19T05:50:42.712Z",
		"size": 1289,
		"path": "../public/assets/ImportExcelBtn-CEOssl0V.js"
	},
	"/assets/html2canvas-CLVA0Ark.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b99-sy1E4G2SIiMI6zbWBtfrFwNUxbY\"",
		"mtime": "2026-08-19T05:50:44.013Z",
		"size": 199577,
		"path": "../public/assets/html2canvas-CLVA0Ark.js"
	},
	"/assets/index.es-ZMW733Np.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24f81-lspEY2myjvJWJpmCDY//kl31rsw\"",
		"mtime": "2026-08-19T05:50:44.239Z",
		"size": 151425,
		"path": "../public/assets/index.es-ZMW733Np.js"
	},
	"/assets/exceljs.min-CGHY4pgT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e307c-2xdY+nkeG0nTLAkvWgxBkYweVMs\"",
		"mtime": "2026-08-19T05:50:43.637Z",
		"size": 929916,
		"path": "../public/assets/exceljs.min-CGHY4pgT.js"
	},
	"/assets/lighting-lux-calculation-DIDAvR6j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bca-JTB73uGZixHxXoJr4JQnonC4f78\"",
		"mtime": "2026-08-19T05:50:44.306Z",
		"size": 15306,
		"path": "../public/assets/lighting-lux-calculation-DIDAvR6j.js"
	},
	"/assets/index-CIUErIu6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10bbcc-OFFHJ/GA8TI8AuhblK+Ra/2Sd0c\"",
		"mtime": "2026-08-19T05:50:41.681Z",
		"size": 1096652,
		"path": "../public/assets/index-CIUErIu6.js"
	},
	"/assets/lock-4tIh0Kro.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c2-QjX1/zElCB/M1osoTbd39l/WDtI\"",
		"mtime": "2026-08-19T05:50:44.385Z",
		"size": 194,
		"path": "../public/assets/lock-4tIh0Kro.js"
	},
	"/assets/load-summary-DHrmE7gz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"38b1-7eL4/F0dx1vrZYAzJQN/0QfBwxs\"",
		"mtime": "2026-08-19T05:50:44.332Z",
		"size": 14513,
		"path": "../public/assets/load-summary-DHrmE7gz.js"
	},
	"/assets/lobby-pressurisation-B2zLmphT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72f4-4PZqVuJGL9gP0yIx5KzrRuhMVCI\"",
		"mtime": "2026-08-19T05:50:44.358Z",
		"size": 29428,
		"path": "../public/assets/lobby-pressurisation-B2zLmphT.js"
	},
	"/assets/lpd-calculation-CuADDHDq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6636-JGx5VAgopgoXrKbZiJmtyGmhfak\"",
		"mtime": "2026-08-19T05:50:44.430Z",
		"size": 26166,
		"path": "../public/assets/lpd-calculation-CuADDHDq.js"
	},
	"/assets/login-DhdRS7v2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ba4-MwNdh+07MVfsPlR7rFpdt44gkJ0\"",
		"mtime": "2026-08-19T05:50:44.404Z",
		"size": 23460,
		"path": "../public/assets/login-DhdRS7v2.js"
	},
	"/assets/navigation-B4PzNTkR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7c82-SLSaGi6KFlCAY8fUmGqA2k5vtqQ\"",
		"mtime": "2026-08-19T05:50:44.454Z",
		"size": 31874,
		"path": "../public/assets/navigation-B4PzNTkR.js"
	},
	"/assets/play-BM08r4ym.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2-L+QvNoF47QWlK0CzWTv2jaAbK4o\"",
		"mtime": "2026-08-19T05:50:44.488Z",
		"size": 178,
		"path": "../public/assets/play-BM08r4ym.js"
	},
	"/assets/plumbing-drainage-DZ42i7bg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1615-WnTyBqml/2owrIWmdwDA8dmeM60\"",
		"mtime": "2026-08-19T05:50:44.510Z",
		"size": 5653,
		"path": "../public/assets/plumbing-drainage-DZ42i7bg.js"
	},
	"/assets/plumbing-fire-pump-duty-4c8K9_SH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2612-3HobbFFgolUM4nDJHHwoSwUfnLA\"",
		"mtime": "2026-08-19T05:50:44.534Z",
		"size": 9746,
		"path": "../public/assets/plumbing-fire-pump-duty-4c8K9_SH.js"
	},
	"/assets/plumbing-fire-tank-duration-CcbTMt-u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2407-xYRjITH4Pz3YCHJUB8l1quauKhE\"",
		"mtime": "2026-08-19T05:50:44.581Z",
		"size": 9223,
		"path": "../public/assets/plumbing-fire-tank-duration-CcbTMt-u.js"
	},
	"/assets/plumbing-fire-tank-capacity-B1zMCBSR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"34b7-UjPiSW74o1B2KerUE38O6oIBU/o\"",
		"mtime": "2026-08-19T05:50:44.556Z",
		"size": 13495,
		"path": "../public/assets/plumbing-fire-tank-capacity-B1zMCBSR.js"
	},
	"/assets/plumbing-fire-water-demand-Oz-QcvT9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ad8-IE0LnZGgoZxBhc7vBnEUuhyTdyo\"",
		"mtime": "2026-08-19T05:50:44.604Z",
		"size": 10968,
		"path": "../public/assets/plumbing-fire-water-demand-Oz-QcvT9.js"
	},
	"/assets/plumbing-fm200-Dv2ZDCRf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66cf-RuH73nLCw2y7xmWSt+hJZuAfewM\"",
		"mtime": "2026-08-19T05:50:44.656Z",
		"size": 26319,
		"path": "../public/assets/plumbing-fm200-Dv2ZDCRf.js"
	},
	"/assets/plumbing-gas-tank-J0angLJk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31bc-t5E9UV3pXZ6rx4e7V38pTEY0Y4E\"",
		"mtime": "2026-08-19T05:50:44.682Z",
		"size": 12732,
		"path": "../public/assets/plumbing-gas-tank-J0angLJk.js"
	},
	"/assets/plumbing-fixture-unit-Bml8WAzk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46f8-O/C/3veuqzEIcd8QcF4P9N4VVuI\"",
		"mtime": "2026-08-19T05:50:44.630Z",
		"size": 18168,
		"path": "../public/assets/plumbing-fixture-unit-Bml8WAzk.js"
	},
	"/assets/plumbing-hazen-williams-DKsSf_ej.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784c-ULVgvnN7L3hsEwnfe8vK49YjVPM\"",
		"mtime": "2026-08-19T05:50:44.710Z",
		"size": 30796,
		"path": "../public/assets/plumbing-hazen-williams-DKsSf_ej.js"
	},
	"/assets/plumbing-loading-unit-BOcVYq93.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"375f-uEM/8G7SkRFZFZM8bhhdkebCADo\"",
		"mtime": "2026-08-19T05:50:44.736Z",
		"size": 14175,
		"path": "../public/assets/plumbing-loading-unit-BOcVYq93.js"
	},
	"/assets/plumbing-pressure-vessel-CmKCglcw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3606-ERJG8RUmp8HOCJFriD0hu9GpEew\"",
		"mtime": "2026-08-19T05:50:44.761Z",
		"size": 13830,
		"path": "../public/assets/plumbing-pressure-vessel-CmKCglcw.js"
	},
	"/assets/plumbing-pump-sizing-DmbI4mOK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"984c-g4rAfPyadXp3aSwpmgYj2lG9Ldk\"",
		"mtime": "2026-08-19T05:50:44.788Z",
		"size": 38988,
		"path": "../public/assets/plumbing-pump-sizing-DmbI4mOK.js"
	},
	"/assets/plumbing-sewage-pump-DhJ_62Wn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23b6-WTJQmGTmL3z5qmyPq5qarte6uaA\"",
		"mtime": "2026-08-19T05:50:44.814Z",
		"size": 9142,
		"path": "../public/assets/plumbing-sewage-pump-DhJ_62Wn.js"
	},
	"/assets/plumbing-sprinkler-kfactor-Cvs8Ratr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"102a7-NsZTdcxbj4/S7w4QLz4gM3L6l3Y\"",
		"mtime": "2026-08-19T05:50:44.870Z",
		"size": 66215,
		"path": "../public/assets/plumbing-sprinkler-kfactor-Cvs8Ratr.js"
	},
	"/assets/plumbing-sprinkler-density-D2JjPIQ6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7de4-0VZJWLZpCJYcenYQG2INm+CPKGI\"",
		"mtime": "2026-08-19T05:50:44.840Z",
		"size": 32228,
		"path": "../public/assets/plumbing-sprinkler-density-D2JjPIQ6.js"
	},
	"/assets/plumbing-storm-water-CjOm-UV1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2947-whb52jFajKsf2LXoQ4JYuez5wgY\"",
		"mtime": "2026-08-19T05:50:44.901Z",
		"size": 10567,
		"path": "../public/assets/plumbing-storm-water-CjOm-UV1.js"
	},
	"/assets/plumbing-sump-pump-Cw8k9Uh_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e5f-l1AEagA4ibtyN1ybo+e1GQGkHpY\"",
		"mtime": "2026-08-19T05:50:44.927Z",
		"size": 11871,
		"path": "../public/assets/plumbing-sump-pump-Cw8k9Uh_.js"
	},
	"/assets/plumbing-tank-sizing-CKsedLO8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f4f-M9CW+sxP36iCtKEHgGxJZuAs5Lg\"",
		"mtime": "2026-08-19T05:50:44.976Z",
		"size": 8015,
		"path": "../public/assets/plumbing-tank-sizing-CKsedLO8.js"
	},
	"/assets/plumbing-supply-pipe-sizer-bQKnoP9g.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ef5-ACBpGeEfj8LwLsFFissCD9pQ0qk\"",
		"mtime": "2026-08-19T05:50:44.951Z",
		"size": 16117,
		"path": "../public/assets/plumbing-supply-pipe-sizer-bQKnoP9g.js"
	},
	"/assets/preload-helper-BcNkJ6ai.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2247-D847jCAP5ERD+46cfjV3zrCHpa8\"",
		"mtime": "2026-08-19T05:50:45.058Z",
		"size": 8775,
		"path": "../public/assets/preload-helper-BcNkJ6ai.js"
	},
	"/assets/plumbing-water-demand-DmpLTO6e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6885-JXhKO3sCd7f9WDgiFt03BqNyGg4\"",
		"mtime": "2026-08-19T05:50:45.000Z",
		"size": 26757,
		"path": "../public/assets/plumbing-water-demand-DmpLTO6e.js"
	},
	"/assets/projects-tS2IXr9F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a02a-FztrTa1g9EJPEgW/pxgVQy25yEY\"",
		"mtime": "2026-08-19T05:50:45.214Z",
		"size": 41002,
		"path": "../public/assets/projects-tS2IXr9F.js"
	},
	"/assets/project-load-schedule-B2gBV8rW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37b08-d7UJZL41szyB5hKXizgR+GlNjqg\"",
		"mtime": "2026-08-19T05:50:45.138Z",
		"size": 228104,
		"path": "../public/assets/project-load-schedule-B2gBV8rW.js"
	},
	"/assets/preliminary-cooling-load-8dX6Sqmr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"cf26-JFmNFQyx7r+eBggqpMfWeM44/v4\"",
		"mtime": "2026-08-19T05:50:45.029Z",
		"size": 53030,
		"path": "../public/assets/preliminary-cooling-load-8dX6Sqmr.js"
	},
	"/assets/privacy-BBtQlfHa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11ae-EdCwQpFdkWq74jLSVGxTc9Ir0xM\"",
		"mtime": "2026-08-19T05:50:45.098Z",
		"size": 4526,
		"path": "../public/assets/privacy-BBtQlfHa.js"
	},
	"/assets/psychrometric-CpBRfrFc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3782-oR0NbNumNUOn01Y1qtjC2HObXwc\"",
		"mtime": "2026-08-19T05:50:45.306Z",
		"size": 14210,
		"path": "../public/assets/psychrometric-CpBRfrFc.js"
	},
	"/assets/refrigerant-pipe-sizing-DR_h8xFd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2335-Pej9gezhXVBJKja6CfNJqyQM6T8\"",
		"mtime": "2026-08-19T05:50:45.372Z",
		"size": 9013,
		"path": "../public/assets/refrigerant-pipe-sizing-DR_h8xFd.js"
	},
	"/assets/purify.es-Bu4Grnl0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"65fb-UUUgPD99pIfMSCpTHJ8CGM9NB7I\"",
		"mtime": "2026-08-19T05:50:45.332Z",
		"size": 26107,
		"path": "../public/assets/purify.es-Bu4Grnl0.js"
	},
	"/assets/proxy-CHsxYjb7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e987-29n4yhJtOnjG4bdE9/4lmPhIqPQ\"",
		"mtime": "2026-08-19T05:50:45.251Z",
		"size": 125319,
		"path": "../public/assets/proxy-CHsxYjb7.js"
	},
	"/assets/reports-tfIcnBbC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7a8-3V0p3sYv2N2jzYbFBhF4QxOgRmc\"",
		"mtime": "2026-08-19T05:50:45.394Z",
		"size": 1960,
		"path": "../public/assets/reports-tfIcnBbC.js"
	},
	"/assets/reset-password-YmuN4KOO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ab7-9NaWLejW6N1aeUjm7uoq3UEMm2k\"",
		"mtime": "2026-08-19T05:50:45.415Z",
		"size": 2743,
		"path": "../public/assets/reset-password-YmuN4KOO.js"
	},
	"/assets/project-load-schedule-DLioOiRN.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-lFaZK5XKLiA1ueePpWy3ZyWmewg\"",
		"mtime": "2026-08-19T05:50:46.128Z",
		"size": 15413,
		"path": "../public/assets/project-load-schedule-DLioOiRN.css"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-19T05:50:45.436Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/sanity-check-tool-BvNLJ0fq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dea-eps6n/H1M65V3LcvVyGamTGVgjU\"",
		"mtime": "2026-08-19T05:50:45.521Z",
		"size": 11754,
		"path": "../public/assets/sanity-check-tool-BvNLJ0fq.js"
	},
	"/assets/routes-kXtjk0AD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"28152-wHoyqdhgQrhJ7WYdEJRwS8QQlfo\"",
		"mtime": "2026-08-19T05:50:45.472Z",
		"size": 164178,
		"path": "../public/assets/routes-kXtjk0AD.js"
	},
	"/assets/short-circuit-calculations-C3CUYZoL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"74e0-j2bjNxTdJH8EXl9E2TafCd03kbc\"",
		"mtime": "2026-08-19T05:50:45.548Z",
		"size": 29920,
		"path": "../public/assets/short-circuit-calculations-C3CUYZoL.js"
	},
	"/assets/smoke-extract-fan-BdgQAmUY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6793-Sfvv0HgqytDzPuvhG0A1pb0Grdc\"",
		"mtime": "2026-08-19T05:50:45.575Z",
		"size": 26515,
		"path": "../public/assets/smoke-extract-fan-BdgQAmUY.js"
	},
	"/assets/staircase-pressurization-DVdxqvYX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4476-ziQpSMYw5/eU6FUfGyGqLt1NLlQ\"",
		"mtime": "2026-08-19T05:50:45.600Z",
		"size": 17526,
		"path": "../public/assets/staircase-pressurization-DVdxqvYX.js"
	},
	"/assets/3d-view-D0NGrzup.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a5534-sRdRjzBbmVrWvuaQzbfedCBSovQ\"",
		"mtime": "2026-08-19T05:50:42.450Z",
		"size": 5920052,
		"path": "../public/assets/3d-view-D0NGrzup.js"
	},
	"/assets/supabase-i9O9rBUK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3284f-KKY4kTo0lUwJOvpekcNxSXA4cF8\"",
		"mtime": "2026-08-19T05:50:45.643Z",
		"size": 206927,
		"path": "../public/assets/supabase-i9O9rBUK.js"
	},
	"/assets/trash-CB4AGGJ4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f0-MY8NFW/Yv6oDnFUmoTn8Ut3ygxs\"",
		"mtime": "2026-08-19T05:50:45.746Z",
		"size": 240,
		"path": "../public/assets/trash-CB4AGGJ4.js"
	},
	"/assets/typeof-B5XbjTb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f-yPXEOGyFHb1Ws7OoWyWNEEBz4mQ\"",
		"mtime": "2026-08-19T05:50:45.787Z",
		"size": 271,
		"path": "../public/assets/typeof-B5XbjTb1.js"
	},
	"/assets/teams-Bt-REJZX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ace-SoNJJaP4n6DP2sEVVW8docGzP+k\"",
		"mtime": "2026-08-19T05:50:45.694Z",
		"size": 6862,
		"path": "../public/assets/teams-Bt-REJZX.js"
	},
	"/assets/ups-sizing-calculation-DwUaxZnW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"55fa-fF+lq7K0MsPGPMNWxYwtSU419wU\"",
		"mtime": "2026-08-19T05:50:45.806Z",
		"size": 22010,
		"path": "../public/assets/ups-sizing-calculation-DwUaxZnW.js"
	},
	"/assets/transformer-sizing-DbM1DHGb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"635c-4AaNNgD7Z4ezChv1oqtTvmmYbqg\"",
		"mtime": "2026-08-19T05:50:45.720Z",
		"size": 25436,
		"path": "../public/assets/transformer-sizing-DbM1DHGb.js"
	},
	"/assets/ventilation-CySe2_UF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47-IHnQeLQ7j6X5FtJIWnyTs+2asmQ\"",
		"mtime": "2026-08-19T05:50:45.904Z",
		"size": 71,
		"path": "../public/assets/ventilation-CySe2_UF.js"
	},
	"/assets/zones-BrDdqBdP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f4c-e/ytcZp9rYe42k5kJdD8ElLT5BU\"",
		"mtime": "2026-08-19T05:50:46.103Z",
		"size": 16204,
		"path": "../public/assets/zones-BrDdqBdP.js"
	},
	"/assets/useShortcuts-D13ue_Cw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b0d-qjCU+ZXgDketrdkR6q2yUI7Kdbw\"",
		"mtime": "2026-08-19T05:50:45.878Z",
		"size": 2829,
		"path": "../public/assets/useShortcuts-D13ue_Cw.js"
	},
	"/assets/tslib.es6-Tae09705.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"42d-qJHuGuq51+EbLaebsBAkbj1JLbk\"",
		"mtime": "2026-08-19T05:50:45.763Z",
		"size": 1069,
		"path": "../public/assets/tslib.es6-Tae09705.js"
	},
	"/assets/styles-B-y8X1A3.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"41661-RBDxe8driN8q3zO6wBUo/xej41U\"",
		"mtime": "2026-08-19T05:50:46.165Z",
		"size": 267873,
		"path": "../public/assets/styles-B-y8X1A3.css"
	},
	"/assets/use-confirm-DQ-l1cD9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"119dc-7pNfxgzC7fIBB8JaF+ZzPpXu+qs\"",
		"mtime": "2026-08-19T05:50:45.837Z",
		"size": 72156,
		"path": "../public/assets/use-confirm-DQ-l1cD9.js"
	},
	"/assets/workspace-store-BewiKNkE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c587-M0yaItKJQ9OXA1LOsf6uU/OTpXY\"",
		"mtime": "2026-08-19T05:50:45.930Z",
		"size": 50567,
		"path": "../public/assets/workspace-store-BewiKNkE.js"
	},
	"/assets/xlsx-BypCUzQ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66dcf-v5fE1ZHiIyXM+ndXVEhWkdB+Sgw\"",
		"mtime": "2026-08-19T05:50:45.997Z",
		"size": 421327,
		"path": "../public/assets/xlsx-BypCUzQ8.js"
	},
	"/assets/worker-GQlxtHkx.mjs": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"35116f-m5Y7pJ85tGx3dIPUddxTWwrru+g\"",
		"mtime": "2026-08-19T05:50:46.486Z",
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
