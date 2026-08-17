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
	"/assets/api-Bi67w5qv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d19a-ZthfH6oHcXiFGnQb/0PU4zHWKtA\"",
		"mtime": "2026-08-17T08:33:41.238Z",
		"size": 53658,
		"path": "../public/assets/api-Bi67w5qv.js"
	},
	"/assets/arrow-left-jFGn2LTL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-Mjziij8+SB2/w7evq1szXKge04A\"",
		"mtime": "2026-08-17T08:33:41.268Z",
		"size": 153,
		"path": "../public/assets/arrow-left-jFGn2LTL.js"
	},
	"/assets/admin-vg6BTvHN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a2a7-HA7PUnyxqA5NoKryxbwwtTq21uE\"",
		"mtime": "2026-08-17T08:33:41.197Z",
		"size": 107175,
		"path": "../public/assets/admin-vg6BTvHN.js"
	},
	"/assets/arrow-right-sgioIv0D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-8zTkHt89nPh2ysnn7UxC0xiQ2GI\"",
		"mtime": "2026-08-17T08:33:41.285Z",
		"size": 153,
		"path": "../public/assets/arrow-right-sgioIv0D.js"
	},
	"/assets/AuthContext-DQ8tvMxc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"28bf-sU1Wf68CXBtf4Gpc9PDTWS8oisc\"",
		"mtime": "2026-08-17T08:33:41.119Z",
		"size": 10431,
		"path": "../public/assets/AuthContext-DQ8tvMxc.js"
	},
	"/assets/cable-voltage-drop-BOYk-kL7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"489f-Rp4HFGLd1FnQX2DLz5MYLXL/i2Q\"",
		"mtime": "2026-08-17T08:33:41.418Z",
		"size": 18591,
		"path": "../public/assets/cable-voltage-drop-BOYk-kL7.js"
	},
	"/assets/AppShell-D0dBH7Dg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2493d-9w6xkTO8uJgfTuwWMCEp+15FUWc\"",
		"mtime": "2026-08-17T08:33:41.066Z",
		"size": 149821,
		"path": "../public/assets/AppShell-D0dBH7Dg.js"
	},
	"/assets/basement-smoke-calc-Ov8G2Lob.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"60e1-1ZX7n2F5PrBkJv7LONIalWxbwo0\"",
		"mtime": "2026-08-17T08:33:41.304Z",
		"size": 24801,
		"path": "../public/assets/basement-smoke-calc-Ov8G2Lob.js"
	},
	"/assets/busbar-calculation-Cj2evf-I.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"681d-70Fu/RNWxlmnff/1X7q8tOKbp0M\"",
		"mtime": "2026-08-17T08:33:41.330Z",
		"size": 26653,
		"path": "../public/assets/busbar-calculation-Cj2evf-I.js"
	},
	"/assets/calculator-DvLaY4PX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"206-GQqgYXfkp/NN+HCX80ZWe4dEH+I\"",
		"mtime": "2026-08-17T08:33:41.446Z",
		"size": 518,
		"path": "../public/assets/calculator-DvLaY4PX.js"
	},
	"/assets/busbar-voltage-drop-iZB-G66z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"49d5-2P2sMLQEPbYB4aYJ3W11+zOpuKU\"",
		"mtime": "2026-08-17T08:33:41.359Z",
		"size": 18901,
		"path": "../public/assets/busbar-voltage-drop-iZB-G66z.js"
	},
	"/assets/capacitor-bank-sizing-Bs0SseGL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"434f-xbTcWR6/QeWB166Zy0V08NSJA6M\"",
		"mtime": "2026-08-17T08:33:41.493Z",
		"size": 17231,
		"path": "../public/assets/capacitor-bank-sizing-Bs0SseGL.js"
	},
	"/assets/calculators-DsnJYh2U.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6e33-sbp7Eahpofl5d3SjWILZwy6qhQ4\"",
		"mtime": "2026-08-17T08:33:41.465Z",
		"size": 28211,
		"path": "../public/assets/calculators-DsnJYh2U.js"
	},
	"/assets/cable-tray-sizing-LrC77waJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8768-PJxYfiulwjwMxaDKsB/gu/5YQPI\"",
		"mtime": "2026-08-17T08:33:41.386Z",
		"size": 34664,
		"path": "../public/assets/cable-tray-sizing-LrC77waJ.js"
	},
	"/assets/circle-question-mark-DN2fAxES.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ec-AQqjnRKjEppEB6HzLwZhkNVh20Q\"",
		"mtime": "2026-08-17T08:33:41.642Z",
		"size": 236,
		"path": "../public/assets/circle-question-mark-DN2fAxES.js"
	},
	"/assets/chw-pump-head-C9EDuCc-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a419-N8KDdcNco78NmkyVrvwfwjn+qE0\"",
		"mtime": "2026-08-17T08:33:41.582Z",
		"size": 42009,
		"path": "../public/assets/chw-pump-head-C9EDuCc-.js"
	},
	"/assets/central-battery-sizing-CXOGQ7bA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"67bd-MUwzbly+PUhSANGS7vcmklBRZRo\"",
		"mtime": "2026-08-17T08:33:41.521Z",
		"size": 26557,
		"path": "../public/assets/central-battery-sizing-CXOGQ7bA.js"
	},
	"/assets/circuit-breaker-sizing-dM4hC52H.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5709-0yYE4aTybFl+YJPNg7PN8ryUFVk\"",
		"mtime": "2026-08-17T08:33:41.659Z",
		"size": 22281,
		"path": "../public/assets/circuit-breaker-sizing-dM4hC52H.js"
	},
	"/assets/conductor-sizing-BWXBzHc9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5e82-XiaQJDXN856A9RlsnnGXjnWGhLE\"",
		"mtime": "2026-08-17T08:33:41.743Z",
		"size": 24194,
		"path": "../public/assets/conductor-sizing-BWXBzHc9.js"
	},
	"/assets/circle-check-DgNNP-sL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-/2imCqYQCjIWjGH6nzylSsPU4nI\"",
		"mtime": "2026-08-17T08:33:41.623Z",
		"size": 166,
		"path": "../public/assets/circle-check-DgNNP-sL.js"
	},
	"/assets/chw-pipe-sizer-DUjqG2jU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"975b-Bm09q8CM8cafMedAhqcTfMtSeQw\"",
		"mtime": "2026-08-17T08:33:41.552Z",
		"size": 38747,
		"path": "../public/assets/chw-pipe-sizer-DUjqG2jU.js"
	},
	"/assets/condensate-drain-DzYAuC5k.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b52-MmBA465EaleauUfznW6SyTauflc\"",
		"mtime": "2026-08-17T08:33:41.687Z",
		"size": 15186,
		"path": "../public/assets/condensate-drain-DzYAuC5k.js"
	},
	"/assets/condensate-drain-calc-CxBQR4vf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2fcf-rFmvSLn+K65MdVrzoNgeWPHESe4\"",
		"mtime": "2026-08-17T08:33:41.716Z",
		"size": 12239,
		"path": "../public/assets/condensate-drain-calc-CxBQR4vf.js"
	},
	"/assets/conversions-GCj7hGJL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f1-GlaMnaUOw3h8fNFkilq1BMpNRZE\"",
		"mtime": "2026-08-17T08:33:41.767Z",
		"size": 497,
		"path": "../public/assets/conversions-GCj7hGJL.js"
	},
	"/assets/core-BFqLT5rb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"745-zkAz33hXLRPZ1d0z6KamQrjAkXg\"",
		"mtime": "2026-08-17T08:33:41.792Z",
		"size": 1861,
		"path": "../public/assets/core-BFqLT5rb.js"
	},
	"/assets/database-DzqHLng5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7-erqFXGQCJHUnw5S9zK/DktmSBVQ\"",
		"mtime": "2026-08-17T08:33:41.815Z",
		"size": 231,
		"path": "../public/assets/database-DzqHLng5.js"
	},
	"/assets/diffuser-selector-DkuQGydv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c49-HGY3DRU6uHUnB/OAelO469l2mlY\"",
		"mtime": "2026-08-17T08:33:41.836Z",
		"size": 11337,
		"path": "../public/assets/diffuser-selector-DkuQGydv.js"
	},
	"/assets/dist-js-C5eqIYwC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72-j57qcLNNzV25+P/cmgzz+98xqrw\"",
		"mtime": "2026-08-17T08:33:41.897Z",
		"size": 114,
		"path": "../public/assets/dist-js-C5eqIYwC.js"
	},
	"/assets/dist-87QSDKkM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"95fd-hQhiQ0cipo75l7m9W3wvPHt4v1w\"",
		"mtime": "2026-08-17T08:33:41.861Z",
		"size": 38397,
		"path": "../public/assets/dist-87QSDKkM.js"
	},
	"/assets/dist-js-DNCGvLYM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ff-1ZDHQJ6oGq32grhA9XzReArygyM\"",
		"mtime": "2026-08-17T08:33:41.914Z",
		"size": 1023,
		"path": "../public/assets/dist-js-DNCGvLYM.js"
	},
	"/assets/droplet-BHWgpaNJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c8-p7uhmbZSVJ754NMCve5gVRSCqKk\"",
		"mtime": "2026-08-17T08:33:41.958Z",
		"size": 200,
		"path": "../public/assets/droplet-BHWgpaNJ.js"
	},
	"/assets/dist-js-mWlZkCFq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"172-g7fnQaRG809JyOj7Le5X51OFO5o\"",
		"mtime": "2026-08-17T08:33:41.938Z",
		"size": 370,
		"path": "../public/assets/dist-js-mWlZkCFq.js"
	},
	"/assets/electrical-network-DiRhF6fW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1366-K6i5Rjxf9PoiK79uDJmHpD/NrpI\"",
		"mtime": "2026-08-17T08:33:42.005Z",
		"size": 4966,
		"path": "../public/assets/electrical-network-DiRhF6fW.js"
	},
	"/assets/duct-sizer-Cb9BnjyQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37c5-9Aj8mbI6GsLzWDj8n+xEkFab8kY\"",
		"mtime": "2026-08-17T08:33:41.978Z",
		"size": 14277,
		"path": "../public/assets/duct-sizer-Cb9BnjyQ.js"
	},
	"/assets/eye-off-SfyVyF-s.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a2-54O/2NxK0M6Onc4KK65MgzChov4\"",
		"mtime": "2026-08-17T08:33:42.299Z",
		"size": 418,
		"path": "../public/assets/eye-off-SfyVyF-s.js"
	},
	"/assets/equipment-DXTFZ8FD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b95-1xKiOrnbw6e+zSt3tHMMWGSlLBo\"",
		"mtime": "2026-08-17T08:33:42.030Z",
		"size": 15253,
		"path": "../public/assets/equipment-DXTFZ8FD.js"
	},
	"/assets/eye-Co-nw305.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f4-gnZDnf5W+DAeosvw/cOdwlM6brw\"",
		"mtime": "2026-08-17T08:33:42.278Z",
		"size": 244,
		"path": "../public/assets/eye-Co-nw305.js"
	},
	"/assets/FileSaver.min-BvZiQU7D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a81-Jy6giDvb9ZYC00C8iidLJXE2o1M\"",
		"mtime": "2026-08-17T08:33:41.146Z",
		"size": 2689,
		"path": "../public/assets/FileSaver.min-BvZiQU7D.js"
	},
	"/assets/fresh-air-cooling-load-BV04t-W6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf2-JrmJ2kVSH2270T0jCmjS5oD6/gk\"",
		"mtime": "2026-08-17T08:33:42.355Z",
		"size": 15602,
		"path": "../public/assets/fresh-air-cooling-load-BV04t-W6.js"
	},
	"/assets/folder-plus-bQKg9G32.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"126-rCZ0Pfxr02Ik8JhXGGBgpimXG7c\"",
		"mtime": "2026-08-17T08:33:42.321Z",
		"size": 294,
		"path": "../public/assets/folder-plus-bQKg9G32.js"
	},
	"/assets/heating-load-CwIqNnFf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"362a-MQU2dnyFnozc2tvK6go35/yM798\"",
		"mtime": "2026-08-17T08:33:42.418Z",
		"size": 13866,
		"path": "../public/assets/heating-load-CwIqNnFf.js"
	},
	"/assets/ImportExcelBtn-4R2LMJZW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"509-GlziLPIVcY5B0/bsIDw2D71Rlds\"",
		"mtime": "2026-08-17T08:33:41.175Z",
		"size": 1289,
		"path": "../public/assets/ImportExcelBtn-4R2LMJZW.js"
	},
	"/assets/generator-sizing-DrOw-sVe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f2b8-4aLIqeKXWbegCgpiO2HvCMPT3Y8\"",
		"mtime": "2026-08-17T08:33:42.382Z",
		"size": 62136,
		"path": "../public/assets/generator-sizing-DrOw-sVe.js"
	},
	"/assets/html2canvas-CLVA0Ark.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b99-sy1E4G2SIiMI6zbWBtfrFwNUxbY\"",
		"mtime": "2026-08-17T08:33:42.445Z",
		"size": 199577,
		"path": "../public/assets/html2canvas-CLVA0Ark.js"
	},
	"/assets/index.es-ZMW733Np.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24f81-lspEY2myjvJWJpmCDY//kl31rsw\"",
		"mtime": "2026-08-17T08:33:42.660Z",
		"size": 151425,
		"path": "../public/assets/index.es-ZMW733Np.js"
	},
	"/assets/lighting-lux-calculation-ufS-vW7d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b72-2C8zYZYmnNLDeHg/Pz+uT0gYwao\"",
		"mtime": "2026-08-17T08:33:42.801Z",
		"size": 15218,
		"path": "../public/assets/lighting-lux-calculation-ufS-vW7d.js"
	},
	"/assets/exceljs.min-Ddc7vzpj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e3069-auJo+2I0ERWIXu9/v+qEcR80Rgg\"",
		"mtime": "2026-08-17T08:33:42.064Z",
		"size": 929897,
		"path": "../public/assets/exceljs.min-Ddc7vzpj.js"
	},
	"/assets/index-CuNjanIm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10a5fe-fO92zrsJ4vaw1AojWyaCng1+Ql8\"",
		"mtime": "2026-08-17T08:33:40.643Z",
		"size": 1091070,
		"path": "../public/assets/index-CuNjanIm.js"
	},
	"/assets/lobby-pressurisation-ByaQTDLr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72f4-QaEgSi9g1xTDLWV8RHU2dLQm2y4\"",
		"mtime": "2026-08-17T08:33:42.853Z",
		"size": 29428,
		"path": "../public/assets/lobby-pressurisation-ByaQTDLr.js"
	},
	"/assets/load-summary-Bs4YL083.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3854-GCioorQf196+A4Q2q9O7uzLVlX0\"",
		"mtime": "2026-08-17T08:33:42.826Z",
		"size": 14420,
		"path": "../public/assets/load-summary-Bs4YL083.js"
	},
	"/assets/lpd-calculation-BFjwNKjV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6636-YKQ+kxd3LOiaXL4kIl432omN+rQ\"",
		"mtime": "2026-08-17T08:33:42.927Z",
		"size": 26166,
		"path": "../public/assets/lpd-calculation-BFjwNKjV.js"
	},
	"/assets/lock-4tIh0Kro.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c2-QjX1/zElCB/M1osoTbd39l/WDtI\"",
		"mtime": "2026-08-17T08:33:42.881Z",
		"size": 194,
		"path": "../public/assets/lock-4tIh0Kro.js"
	},
	"/assets/login-CzsBzLpE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ba4-SW3FHSEDr7NG6BS7cdrmgOJBVW0\"",
		"mtime": "2026-08-17T08:33:42.899Z",
		"size": 23460,
		"path": "../public/assets/login-CzsBzLpE.js"
	},
	"/assets/play-BM08r4ym.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2-L+QvNoF47QWlK0CzWTv2jaAbK4o\"",
		"mtime": "2026-08-17T08:33:42.989Z",
		"size": 178,
		"path": "../public/assets/play-BM08r4ym.js"
	},
	"/assets/plumbing-fire-pump-duty-CiTHEjK8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25b5-FGfMZf0xs7yFgDzpnL42b4hBtdg\"",
		"mtime": "2026-08-17T08:33:43.034Z",
		"size": 9653,
		"path": "../public/assets/plumbing-fire-pump-duty-CiTHEjK8.js"
	},
	"/assets/plumbing-drainage-CrBS2rs5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1615-3P3EH/zQAGKADfg9KowaccXvZpw\"",
		"mtime": "2026-08-17T08:33:43.009Z",
		"size": 5653,
		"path": "../public/assets/plumbing-drainage-CrBS2rs5.js"
	},
	"/assets/navigation-B4PzNTkR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7c82-SLSaGi6KFlCAY8fUmGqA2k5vtqQ\"",
		"mtime": "2026-08-17T08:33:42.953Z",
		"size": 31874,
		"path": "../public/assets/navigation-B4PzNTkR.js"
	},
	"/assets/plumbing-fire-tank-capacity-BeSiypTg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"345a-a68U0miLUS/rA4bP8hyfmnrf104\"",
		"mtime": "2026-08-17T08:33:43.057Z",
		"size": 13402,
		"path": "../public/assets/plumbing-fire-tank-capacity-BeSiypTg.js"
	},
	"/assets/plumbing-fixture-unit-BmGJduv3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46f8-x7M//84U+krJSLZ3LnkTt3+N7H0\"",
		"mtime": "2026-08-17T08:33:43.133Z",
		"size": 18168,
		"path": "../public/assets/plumbing-fixture-unit-BmGJduv3.js"
	},
	"/assets/plumbing-fire-tank-duration-BRFLkrUc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2407-9cSXzpXBhs+gHHyTSHMWLHx8Z1I\"",
		"mtime": "2026-08-17T08:33:43.083Z",
		"size": 9223,
		"path": "../public/assets/plumbing-fire-tank-duration-BRFLkrUc.js"
	},
	"/assets/plumbing-fire-water-demand-CAIa6AN-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a7b-VXgBFFyh51c7KeA435inGUM8HRY\"",
		"mtime": "2026-08-17T08:33:43.107Z",
		"size": 10875,
		"path": "../public/assets/plumbing-fire-water-demand-CAIa6AN-.js"
	},
	"/assets/plumbing-gas-tank-DWdKpcOL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"313b-Uyi3tr0DqHRqWsBDcvFeIuGgEgo\"",
		"mtime": "2026-08-17T08:33:43.187Z",
		"size": 12603,
		"path": "../public/assets/plumbing-gas-tank-DWdKpcOL.js"
	},
	"/assets/plumbing-fm200-Dkm0VOrw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"661c-TgMNGfnvwZFnpc4iXevz17jLnLY\"",
		"mtime": "2026-08-17T08:33:43.160Z",
		"size": 26140,
		"path": "../public/assets/plumbing-fm200-Dkm0VOrw.js"
	},
	"/assets/plumbing-loading-unit-DqmJ_iJ5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"375f-A3uT4lYI/RgnChFLfqaikpxV8Ik\"",
		"mtime": "2026-08-17T08:33:43.239Z",
		"size": 14175,
		"path": "../public/assets/plumbing-loading-unit-DqmJ_iJ5.js"
	},
	"/assets/plumbing-hazen-williams-D4-IKGF0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"778b-8yCY/tlgJTOpe59wUWlsoCRwU6k\"",
		"mtime": "2026-08-17T08:33:43.212Z",
		"size": 30603,
		"path": "../public/assets/plumbing-hazen-williams-D4-IKGF0.js"
	},
	"/assets/plumbing-pressure-vessel-BO-1_AJd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"35a9-eDokCH4R4oWvmxzf4anLBRIcMAk\"",
		"mtime": "2026-08-17T08:33:43.265Z",
		"size": 13737,
		"path": "../public/assets/plumbing-pressure-vessel-BO-1_AJd.js"
	},
	"/assets/plumbing-pump-sizing-C_Mbjj15.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"97e1-2YXJ5ShypedkEYsp1osUr7VyBDY\"",
		"mtime": "2026-08-17T08:33:43.292Z",
		"size": 38881,
		"path": "../public/assets/plumbing-pump-sizing-C_Mbjj15.js"
	},
	"/assets/plumbing-sewage-pump-DOm2QeqX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2335-KPz5DZDL8wXQ82XWC34xwf3QQeU\"",
		"mtime": "2026-08-17T08:33:43.320Z",
		"size": 9013,
		"path": "../public/assets/plumbing-sewage-pump-DOm2QeqX.js"
	},
	"/assets/plumbing-sprinkler-density-BPcppgtl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7d20-uHdPSfjCXCuaoxDKaL7ixaaXJ4w\"",
		"mtime": "2026-08-17T08:33:43.346Z",
		"size": 32032,
		"path": "../public/assets/plumbing-sprinkler-density-BPcppgtl.js"
	},
	"/assets/plumbing-sprinkler-kfactor-CpGw3eHg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"101d7-bmSGpj8VPNqoVqzlDKIC5PH1/Dc\"",
		"mtime": "2026-08-17T08:33:43.398Z",
		"size": 66007,
		"path": "../public/assets/plumbing-sprinkler-kfactor-CpGw3eHg.js"
	},
	"/assets/plumbing-storm-water-Bdz_DbnW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"28ea-kOR047nkK/x9PStVQ6lGUupuOYk\"",
		"mtime": "2026-08-17T08:33:43.432Z",
		"size": 10474,
		"path": "../public/assets/plumbing-storm-water-Bdz_DbnW.js"
	},
	"/assets/plumbing-sump-pump-DEvErk8W.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dfc-EXiuqGaswl8D1Bw1BldGeOLWe1w\"",
		"mtime": "2026-08-17T08:33:43.457Z",
		"size": 11772,
		"path": "../public/assets/plumbing-sump-pump-DEvErk8W.js"
	},
	"/assets/plumbing-tank-sizing-DoDurEm_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ece-T6vrLqGt6mCjg6RSSheJpcRwZzg\"",
		"mtime": "2026-08-17T08:33:43.507Z",
		"size": 7886,
		"path": "../public/assets/plumbing-tank-sizing-DoDurEm_.js"
	},
	"/assets/plumbing-supply-pipe-sizer-Dnhng7aI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ef5-Ml1SAy5lV9asIZiYd7FEtuJQGzE\"",
		"mtime": "2026-08-17T08:33:43.481Z",
		"size": 16117,
		"path": "../public/assets/plumbing-supply-pipe-sizer-Dnhng7aI.js"
	},
	"/assets/preload-helper-BcNkJ6ai.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2247-D847jCAP5ERD+46cfjV3zrCHpa8\"",
		"mtime": "2026-08-17T08:33:43.590Z",
		"size": 8775,
		"path": "../public/assets/preload-helper-BcNkJ6ai.js"
	},
	"/assets/plumbing-water-demand-Dqh2dSiB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6885-lPExNEbzF6AL7ME/OBXthBiuJGk\"",
		"mtime": "2026-08-17T08:33:43.532Z",
		"size": 26757,
		"path": "../public/assets/plumbing-water-demand-Dqh2dSiB.js"
	},
	"/assets/privacy-9H2uQAXi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11ae-wUSdw++q1Hn1adlct8dVB/25f9w\"",
		"mtime": "2026-08-17T08:33:43.632Z",
		"size": 4526,
		"path": "../public/assets/privacy-9H2uQAXi.js"
	},
	"/assets/preliminary-cooling-load-CdR4n3_m.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ce58-nY3G806XPjermL2HBBVsDtXHCss\"",
		"mtime": "2026-08-17T08:33:43.559Z",
		"size": 52824,
		"path": "../public/assets/preliminary-cooling-load-CdR4n3_m.js"
	},
	"/assets/projects-Ci3Rnvxt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a025-TJgZCNhA8IdPetOGw1he7ZGOT74\"",
		"mtime": "2026-08-17T08:33:43.736Z",
		"size": 40997,
		"path": "../public/assets/projects-Ci3Rnvxt.js"
	},
	"/assets/project-load-schedule-DLioOiRN.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-lFaZK5XKLiA1ueePpWy3ZyWmewg\"",
		"mtime": "2026-08-17T08:33:44.626Z",
		"size": 15413,
		"path": "../public/assets/project-load-schedule-DLioOiRN.css"
	},
	"/assets/project-load-schedule-uDRfS9xi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"37a99-p+0t06jnMAhB7/6Yxs6CTVlj63I\"",
		"mtime": "2026-08-17T08:33:43.657Z",
		"size": 227993,
		"path": "../public/assets/project-load-schedule-uDRfS9xi.js"
	},
	"/assets/proxy-CHsxYjb7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e987-29n4yhJtOnjG4bdE9/4lmPhIqPQ\"",
		"mtime": "2026-08-17T08:33:43.767Z",
		"size": 125319,
		"path": "../public/assets/proxy-CHsxYjb7.js"
	},
	"/assets/refrigerant-pipe-sizing-DkRRIl5b.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2335-np/Mxx4a22YN0DjPx8HCobjj6kY\"",
		"mtime": "2026-08-17T08:33:43.891Z",
		"size": 9013,
		"path": "../public/assets/refrigerant-pipe-sizing-DkRRIl5b.js"
	},
	"/assets/purify.es-Bu4Grnl0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"65fb-UUUgPD99pIfMSCpTHJ8CGM9NB7I\"",
		"mtime": "2026-08-17T08:33:43.852Z",
		"size": 26107,
		"path": "../public/assets/purify.es-Bu4Grnl0.js"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-17T08:33:43.960Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/reports-CfOSlNae.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784-WsALv3KEf+OsrXir3ANITK/QiQo\"",
		"mtime": "2026-08-17T08:33:43.913Z",
		"size": 1924,
		"path": "../public/assets/reports-CfOSlNae.js"
	},
	"/assets/psychrometric-ByGBXS6n.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3782-aZugxufv+CSDWkYLZAYB7abwvFw\"",
		"mtime": "2026-08-17T08:33:43.826Z",
		"size": 14210,
		"path": "../public/assets/psychrometric-ByGBXS6n.js"
	},
	"/assets/reset-password-YmuN4KOO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ab7-9NaWLejW6N1aeUjm7uoq3UEMm2k\"",
		"mtime": "2026-08-17T08:33:43.935Z",
		"size": 2743,
		"path": "../public/assets/reset-password-YmuN4KOO.js"
	},
	"/assets/sanity-check-tool-Eri-PiQ2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dea-BZkDLYiDqKuRZJPlei998ca+DNw\"",
		"mtime": "2026-08-17T08:33:44.036Z",
		"size": 11754,
		"path": "../public/assets/sanity-check-tool-Eri-PiQ2.js"
	},
	"/assets/routes-BnFk5vgN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"27924-7LstmzKl21J8gjeydE0CWN1UmJ4\"",
		"mtime": "2026-08-17T08:33:43.983Z",
		"size": 162084,
		"path": "../public/assets/routes-BnFk5vgN.js"
	},
	"/assets/short-circuit-calculations-DlfFwKmd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"740d-vMnCW/pqLecM+CXvV1fbYPFK36w\"",
		"mtime": "2026-08-17T08:33:44.073Z",
		"size": 29709,
		"path": "../public/assets/short-circuit-calculations-DlfFwKmd.js"
	},
	"/assets/smoke-extract-fan-D_3_HlNG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6793-RppkV9017kHsCE9EM0xJcPi/7qs\"",
		"mtime": "2026-08-17T08:33:44.102Z",
		"size": 26515,
		"path": "../public/assets/smoke-extract-fan-D_3_HlNG.js"
	},
	"/assets/staircase-pressurization-BUneU4lt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4476-JPe2ogyC7lMpqqiG29EgqbwciG4\"",
		"mtime": "2026-08-17T08:33:44.129Z",
		"size": 17526,
		"path": "../public/assets/staircase-pressurization-BUneU4lt.js"
	},
	"/assets/3d-view-Dl6iSVr5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a5534-Ca46j8f/lYb2L6Ev2zKtbiRPVHM\"",
		"mtime": "2026-08-17T08:33:40.917Z",
		"size": 5920052,
		"path": "../public/assets/3d-view-Dl6iSVr5.js"
	},
	"/assets/styles-Cp5Sb4N2.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"413e7-SaVdNMBO9tpRpK6tSER+2fBEROk\"",
		"mtime": "2026-08-17T08:33:44.643Z",
		"size": 267239,
		"path": "../public/assets/styles-Cp5Sb4N2.css"
	},
	"/assets/supabase-i9O9rBUK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3284f-KKY4kTo0lUwJOvpekcNxSXA4cF8\"",
		"mtime": "2026-08-17T08:33:44.158Z",
		"size": 206927,
		"path": "../public/assets/supabase-i9O9rBUK.js"
	},
	"/assets/transformer-sizing-COPfOOpF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6272-IDOI4len7hyryZPsf6e3/20AOp8\"",
		"mtime": "2026-08-17T08:33:44.234Z",
		"size": 25202,
		"path": "../public/assets/transformer-sizing-COPfOOpF.js"
	},
	"/assets/teams-tssShD4e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ace-tRF3jvLLBtIIT18TISG2MgKE5ws\"",
		"mtime": "2026-08-17T08:33:44.209Z",
		"size": 6862,
		"path": "../public/assets/teams-tssShD4e.js"
	},
	"/assets/ups-sizing-calculation-CjwlhEiY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"550c-7cHAVTsTJNNUfHA3Wt+b3X2Or+o\"",
		"mtime": "2026-08-17T08:33:44.325Z",
		"size": 21772,
		"path": "../public/assets/ups-sizing-calculation-CjwlhEiY.js"
	},
	"/assets/typeof-B5XbjTb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f-yPXEOGyFHb1Ws7OoWyWNEEBz4mQ\"",
		"mtime": "2026-08-17T08:33:44.304Z",
		"size": 271,
		"path": "../public/assets/typeof-B5XbjTb1.js"
	},
	"/assets/use-confirm-rXT7zL3g.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"119c3-QHX+LS+9zkKwAtZNMfSSrKXFwm8\"",
		"mtime": "2026-08-17T08:33:44.352Z",
		"size": 72131,
		"path": "../public/assets/use-confirm-rXT7zL3g.js"
	},
	"/assets/trash-CB4AGGJ4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f0-MY8NFW/Yv6oDnFUmoTn8Ut3ygxs\"",
		"mtime": "2026-08-17T08:33:44.261Z",
		"size": 240,
		"path": "../public/assets/trash-CB4AGGJ4.js"
	},
	"/assets/tslib.es6-Tae09705.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"42d-qJHuGuq51+EbLaebsBAkbj1JLbk\"",
		"mtime": "2026-08-17T08:33:44.281Z",
		"size": 1069,
		"path": "../public/assets/tslib.es6-Tae09705.js"
	},
	"/assets/useShortcuts-D13ue_Cw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b0d-qjCU+ZXgDketrdkR6q2yUI7Kdbw\"",
		"mtime": "2026-08-17T08:33:44.399Z",
		"size": 2829,
		"path": "../public/assets/useShortcuts-D13ue_Cw.js"
	},
	"/assets/ventilation-p5_ZLK4-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47-/LlUyhg90JnFwV/Vzzx+SyPuyq0\"",
		"mtime": "2026-08-17T08:33:44.425Z",
		"size": 71,
		"path": "../public/assets/ventilation-p5_ZLK4-.js"
	},
	"/assets/xlsx-BypCUzQ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66dcf-v5fE1ZHiIyXM+ndXVEhWkdB+Sgw\"",
		"mtime": "2026-08-17T08:33:44.483Z",
		"size": 421327,
		"path": "../public/assets/xlsx-BypCUzQ8.js"
	},
	"/assets/workspace-store-Bn1jXthZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c37c-rrneQ77NSmKmqioDFCXbmr3il28\"",
		"mtime": "2026-08-17T08:33:44.447Z",
		"size": 50044,
		"path": "../public/assets/workspace-store-Bn1jXthZ.js"
	},
	"/assets/zones-yPrAvkR0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f4c-WqhpDvbCm0QwLOpA3Z+Cqrms4aU\"",
		"mtime": "2026-08-17T08:33:44.599Z",
		"size": 16204,
		"path": "../public/assets/zones-yPrAvkR0.js"
	},
	"/assets/worker-GQlxtHkx.mjs": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"35116f-m5Y7pJ85tGx3dIPUddxTWwrru+g\"",
		"mtime": "2026-08-17T08:33:44.688Z",
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
